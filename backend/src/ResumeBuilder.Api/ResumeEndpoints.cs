using System.Diagnostics;
using System.Globalization;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Net.Http.Headers;
using ResumeBuilder.Application.Accounts;
using ResumeBuilder.Application.Resumes;
using ResumeBuilder.Domain.Resumes;

namespace ResumeBuilder.Api;

/// <summary>
/// HTTP only: authentication, CSRF, rate limit, size, media type, JSON syntax, schema read, header parsing and
/// problem mapping. Everything after the key check is the use cases' order (DD-P07-08).
/// </summary>
internal static partial class ResumeEndpoints
{
  private const string Resumes = "/api/v1/resumes";
  private const string One = Resumes + "/{resumeId}";
  private const int DefaultLimit = 50;
  private const int MaxLimit = 200;
  private const int MaxCursorLength = 512;
  private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

  public static void MapResumeEndpoints(this WebApplication app)
  {
    Describe(app.MapGet(Resumes, List), "listResumes", "Resumes", [200], 400, 401, 429);
    Describe(app.MapPost(Resumes, Create), "createResume", "Resumes", [201], 400, 401, 403, 404, 409, 413, 415, 422, 429);
    Describe(app.MapGet(One, Get), "getResume", "Resumes", [200], 401, 404, 429);
    Describe(app.MapDelete(One, Trash), "trashResume", "Resumes", [200], 400, 401, 403, 404, 409, 412, 422, 428, 429);
    Describe(app.MapPut(One + "/document", ReplaceDocument), "replaceResumeDocument", "Resumes", [200], 400, 401, 403, 404, 409, 412, 413, 415, 422, 428, 429);
    Describe(app.MapPost(One + "/restore", Restore), "restoreResume", "Resumes", [200], 400, 401, 403, 404, 409, 412, 422, 428, 429);
    Describe(app.MapPost(One + "/purge", Purge), "purgeResume", "Resumes", [204], 400, 401, 403, 404, 409, 412, 422, 428, 429);
    Describe(app.MapGet(One + "/snapshots", ListSnapshots), "listSnapshots", "Snapshots", [200], 400, 401, 404, 429);
    Describe(app.MapPost(One + "/snapshots", CreateSnapshot), "createSnapshot", "Snapshots", [200, 201], 400, 401, 403, 404, 409, 413, 415, 422, 429);
    Describe(app.MapGet(One + "/snapshots/{snapshotId}", GetSnapshot), "getSnapshot", "Snapshots", [200], 401, 404, 429);
    Describe(app.MapPost(One + "/photo", UploadPhoto), "uploadPhoto", "Photos", [200], 400, 401, 403, 404, 409, 412, 413, 415, 422, 428, 429);
    Describe(app.MapDelete(One + "/photo", RemovePhoto), "removePhoto", "Photos", [200], 400, 401, 403, 404, 409, 412, 422, 428, 429);
    Describe(app.MapPut(One + "/photo/crop", UpdateCrop), "updatePhotoCrop", "Photos", [200], 400, 401, 403, 404, 409, 412, 413, 415, 422, 428, 429);
    Describe(app.MapGet(One + "/photo/rendition", GetRendition), "getPhotoRendition", "Photos", [200, 304], 401, 404, 429);
    Describe(app.MapGet(One + "/photo/master", GetMaster), "getPhotoMaster", "Photos", [200, 304], 401, 404, 429);
  }

  private static void Describe(RouteHandlerBuilder route, string name, string tag, int[] successes, params int[] errors)
  {
    route.WithName(name).WithTags(tag);
    foreach (var status in successes)
    {
      if (status is 200 or 201) route.Produces(status, contentType: "application/json");
      else route.Produces(status);
    }
    foreach (var status in errors) route.Produces(status, contentType: "application/problem+json");
    route.Produces(500, contentType: "application/problem+json");
  }

  // ---------------------------------------------------------------- reads

  private static async Task List(HttpContext ctx, IResumeUseCases resumes)
  {
    if (await Owner(ctx) is not Guid owner) return;
    var issues = new List<DocumentIssue>();
    var limit = Limit(ctx, issues);
    var stateValues = ctx.Request.Query["state"];
    ResumeListState? state = stateValues.Count == 0 ? ResumeListState.Active : stateValues.ToString() switch
    {
      "active" => ResumeListState.Active,
      "trashed" => ResumeListState.Trashed,
      _ => null,
    };
    if (state is null) issues.Add(new DocumentIssue("query", "state", "enum"));
    var after = state is ResumeListState known ? Cursor(ctx, owner, ResumeUseCases.ResumeListQuery(known), issues) : null;
    if (issues.Count > 0) { await Invalid(ctx, issues); return; }
    var page = await resumes.ListAsync(owner, state!.Value, limit, after, ctx.RequestAborted);
    await Json(ctx, 200, ResumeRepresentation.ResumePage(page.Items, page.NextCursor));
  }

  private static async Task Get(HttpContext ctx, string resumeId, IResumeUseCases resumes)
  {
    if (await Owner(ctx) is not Guid owner) return;
    var resume = await resumes.GetAsync(owner, ParseId(resumeId), ctx.RequestAborted);
    if (resume is null) { await Problem(ctx, 404, "not_found"); return; }
    SetETag(ctx, resume.Version);
    await Json(ctx, 200, ResumeRepresentation.Resume(resume));
  }

  private static async Task ListSnapshots(HttpContext ctx, string resumeId, IResumeUseCases resumes)
  {
    if (await Owner(ctx) is not Guid owner) return;
    var id = ParseId(resumeId);
    // A resume the caller cannot see answers 404 before any parameter is judged.
    if (await resumes.GetAsync(owner, id, ctx.RequestAborted) is null) { await Problem(ctx, 404, "not_found"); return; }
    var issues = new List<DocumentIssue>();
    var limit = Limit(ctx, issues);
    var after = Cursor(ctx, owner, ResumeUseCases.SnapshotListQuery(id), issues);
    if (issues.Count > 0) { await Invalid(ctx, issues); return; }
    var page = await resumes.ListSnapshotsAsync(owner, id, limit, after, ctx.RequestAborted);
    if (page is null) { await Problem(ctx, 404, "not_found"); return; }
    await Json(ctx, 200, ResumeRepresentation.SnapshotPage(page.Items, page.NextCursor));
  }

  private static async Task GetSnapshot(HttpContext ctx, string resumeId, string snapshotId, IResumeUseCases resumes)
  {
    if (await Owner(ctx) is not Guid owner) return;
    var snapshot = await resumes.GetSnapshotAsync(owner, ParseId(resumeId), ParseId(snapshotId), ctx.RequestAborted);
    if (snapshot is null) { await Problem(ctx, 404, "not_found"); return; }
    await Json(ctx, 200, ResumeRepresentation.Snapshot(snapshot));
  }

  private static Task GetRendition(HttpContext ctx, string resumeId, IResumeUseCases resumes) => Image(ctx, resumeId, PhotoVariant.Rendition, resumes);
  private static Task GetMaster(HttpContext ctx, string resumeId, IResumeUseCases resumes) => Image(ctx, resumeId, PhotoVariant.Master, resumes);

  private static async Task Image(HttpContext ctx, string resumeId, PhotoVariant variant, IResumeUseCases resumes)
  {
    if (await Owner(ctx) is not Guid owner) return;
    var image = await resumes.GetPhotoAsync(owner, ParseId(resumeId), variant, ctx.RequestAborted);
    if (image is null) { await Problem(ctx, 404, "not_found"); return; }
    var tag = $"\"{Convert.ToBase64String(SHA256.HashData(image.Bytes)).TrimEnd('=').Replace('+', '-').Replace('/', '_')}\"";
    ctx.Response.Headers.CacheControl = "private, no-cache";
    ctx.Response.Headers.ETag = tag;
    ctx.Response.Headers.XContentTypeOptions = "nosniff";
    if (IfNoneMatch(ctx, tag)) { ctx.Response.StatusCode = 304; return; }
    ctx.Response.ContentType = image.Mime;
    await ctx.Response.Body.WriteAsync(image.Bytes, ctx.RequestAborted);
  }

  private static bool IfNoneMatch(HttpContext ctx, string tag)
  {
    var header = ctx.Request.Headers.IfNoneMatch.ToString();
    if (header.Length is 0 or > 200) return false;
    return header.Split(',').Select(candidate => candidate.Trim()).Any(candidate => candidate == "*" || candidate == tag || candidate == $"W/{tag}");
  }

  // ---------------------------------------------------------------- writes

  private static async Task Create(HttpContext ctx, IResumeUseCases resumes)
  {
    if (await Writer(ctx, "doc-write") is not Guid owner) return;
    using var body = await ReadJson(ctx);
    if (body is null) return;
    var (command, issues) = ResumeRequestReader.ReadCreate(body.RootElement);
    if (issues.Count > 0) { await Invalid(ctx, issues); return; }
    if (await Keyed(ctx, owner, CanonicalJson.Serialize(body.RootElement)) is not { } request) return;
    var result = await resumes.CreateAsync(request, command!, ctx.RequestAborted);
    await Respond(ctx, result, created =>
    {
      ctx.Response.Headers.Location = $"{Resumes}/{created.Resume!.Id}";
      return ResumeRepresentation.Resume(created.Resume);
    });
  }

  private static async Task ReplaceDocument(HttpContext ctx, string resumeId, IResumeUseCases resumes)
  {
    if (await Writer(ctx, "doc-write") is not Guid owner) return;
    using var body = await ReadJson(ctx);
    if (body is null) return;
    var read = ResumeDocumentReader.Read(body.RootElement);
    if (read.Document is null) { await Invalid(ctx, read.Issues); return; }
    if (await Keyed(ctx, owner, CanonicalJson.Serialize(body.RootElement)) is not { } request) return;
    var result = await resumes.ReplaceDocumentAsync(request, ParseId(resumeId), read.Document, IfMatch(ctx), ctx.RequestAborted);
    await Respond(ctx, result, saved => ResumeRepresentation.DocumentWrite(saved.Write!.Id, saved.Write.Version, saved.Write.UpdatedAt, saved.Write.Warnings));
  }

  private static async Task Trash(HttpContext ctx, string resumeId, IResumeUseCases resumes)
  {
    if (await Writer(ctx, "doc-write") is not Guid owner) return;
    if (await Keyed(ctx, owner, []) is not { } request) return;
    await Respond(ctx, await resumes.TrashAsync(request, ParseId(resumeId), IfMatch(ctx), ctx.RequestAborted), done => ResumeRepresentation.State(done.Resume!));
  }

  private static async Task Restore(HttpContext ctx, string resumeId, IResumeUseCases resumes)
  {
    if (await Writer(ctx, "doc-write") is not Guid owner) return;
    if (await Keyed(ctx, owner, []) is not { } request) return;
    await Respond(ctx, await resumes.RestoreAsync(request, ParseId(resumeId), IfMatch(ctx), ctx.RequestAborted), done => ResumeRepresentation.State(done.Resume!));
  }

  private static async Task Purge(HttpContext ctx, string resumeId, IResumeUseCases resumes)
  {
    if (await Writer(ctx, "doc-write") is not Guid owner) return;
    if (await Keyed(ctx, owner, []) is not { } request) return;
    await Respond(ctx, await resumes.PurgeAsync(request, ParseId(resumeId), IfMatch(ctx), ctx.RequestAborted), null);
  }

  private static async Task CreateSnapshot(HttpContext ctx, string resumeId, IResumeUseCases resumes)
  {
    if (await Writer(ctx, "doc-write") is not Guid owner) return;
    using var body = await ReadJson(ctx);
    if (body is null) return;
    var issues = ResumeRequestReader.ReadSnapshot(body.RootElement);
    if (issues.Count > 0) { await Invalid(ctx, issues); return; }
    if (await Keyed(ctx, owner, CanonicalJson.Serialize(body.RootElement)) is not { } request) return;
    var result = await resumes.CreateSnapshotAsync(request, ParseId(resumeId), ctx.RequestAborted);
    await Respond(ctx, result, done =>
    {
      if (done.Status == 201) ctx.Response.Headers.Location = $"{Resumes}/{done.Snapshot!.ResumeId}/snapshots/{done.Snapshot.Id}";
      return ResumeRepresentation.SnapshotSummary(done.Snapshot!);
    });
  }

  private static async Task UploadPhoto(HttpContext ctx, string resumeId, IResumeUseCases resumes, IPhotoProcessor processor)
  {
    if (await Writer(ctx, "photo-upload") is not Guid owner) return;
    if (!MediaTypeHeaderValue.TryParse(ctx.Request.ContentType, out var media) || !media.MediaType.Equals("multipart/form-data", StringComparison.OrdinalIgnoreCase) || HeaderUtilities.RemoveQuotes(media.Boundary).Length == 0)
    {
      await Problem(ctx, 415, "unsupported_media_type");
      return;
    }
    var bytes = await ReadBody(ctx, ResumeLimits.MaxPhotoBodyBytes);
    if (bytes is null) return;
    var (file, issues) = await ReadFilePart(bytes, HeaderUtilities.RemoveQuotes(media.Boundary).ToString(), ctx.RequestAborted);
    if (issues is null) { await Problem(ctx, 400, "malformed_request"); return; }
    if (issues.Count > 0) { await Invalid(ctx, issues); return; }
    if (file!.Length > ResumeLimits.MaxPhotoFileBytes) { await Problem(ctx, 413, "payload_too_large"); return; }
    if (processor.Detect(file) is not PhotoFormat format) { await Problem(ctx, 415, "unsupported_media_type"); return; }
    if (await Keyed(ctx, owner, file) is not { } request) return;
    var result = await resumes.UploadPhotoAsync(request, ParseId(resumeId), file, format, IfMatch(ctx), ctx.RequestAborted);
    await Respond(ctx, result, done => ResumeRepresentation.PhotoWrite(done.Resume!));
  }

  /// <summary>Exactly one part named `file`. A null issue list means the envelope itself is unreadable.</summary>
  private static async Task<(byte[]? File, List<DocumentIssue>? Issues)> ReadFilePart(byte[] body, string boundary, CancellationToken cancellationToken)
  {
    byte[]? file = null;
    var issues = new List<DocumentIssue>();
    try
    {
      using var stream = new MemoryStream(body, writable: false);
      var reader = new MultipartReader(boundary, stream);
      while (await reader.ReadNextSectionAsync(cancellationToken) is { } section)
      {
        var named = ContentDispositionHeaderValue.TryParse(section.ContentDisposition, out var disposition) && HeaderUtilities.RemoveQuotes(disposition.Name).Equals("file", StringComparison.Ordinal);
        if (!named || file is not null)
        {
          if (!issues.Exists(issue => issue.Code == "unknown_property")) issues.Add(new DocumentIssue("body", "", "unknown_property"));
          continue;
        }
        using var content = new MemoryStream();
        await section.Body.CopyToAsync(content, cancellationToken);
        file = content.ToArray();
      }
    }
    catch (IOException) { return (null, null); }
    catch (InvalidDataException) { return (null, null); }
    if (file is null) issues.Add(new DocumentIssue("body", "/file", "required"));
    return (file, issues);
  }

  private static async Task RemovePhoto(HttpContext ctx, string resumeId, IResumeUseCases resumes)
  {
    if (await Writer(ctx, "doc-write") is not Guid owner) return;
    if (await Keyed(ctx, owner, []) is not { } request) return;
    await Respond(ctx, await resumes.RemovePhotoAsync(request, ParseId(resumeId), IfMatch(ctx), ctx.RequestAborted), done => ResumeRepresentation.State(done.Resume!));
  }

  private static async Task UpdateCrop(HttpContext ctx, string resumeId, IResumeUseCases resumes)
  {
    if (await Writer(ctx, "doc-write") is not Guid owner) return;
    using var body = await ReadJson(ctx);
    if (body is null) return;
    var (crop, issues) = ResumeRequestReader.ReadCrop(body.RootElement);
    if (issues.Count > 0) { await Invalid(ctx, issues); return; }
    if (await Keyed(ctx, owner, CanonicalJson.Serialize(body.RootElement)) is not { } request) return;
    var result = await resumes.UpdateCropAsync(request, ParseId(resumeId), crop!, IfMatch(ctx), ctx.RequestAborted);
    await Respond(ctx, result, done => ResumeRepresentation.PhotoWrite(done.Resume!));
  }

  // ---------------------------------------------------------------- stages

  private static async Task<Guid?> Owner(HttpContext ctx)
  {
    var services = ctx.RequestServices;
    var current = await AccountEndpoints.Current(ctx, services.GetRequiredService<IAccountUseCases>(), services.GetRequiredService<IAccountStore>());
    if (current is { } session) return session.Account.Id;
    await Problem(ctx, 401, "unauthenticated");
    return null;
  }

  /// <summary>401, then 403, then the ADR-038 policy of the operation (DD-P07-14).</summary>
  private static async Task<Guid?> Writer(HttpContext ctx, string policy)
  {
    if (await Owner(ctx) is not Guid owner) return null;
    if (!await AccountEndpoints.CheckCsrf(ctx)) return null;
    var (limit, window) = policy == "photo-upload" ? (20, TimeSpan.FromHours(1)) : (120, TimeSpan.FromMinutes(1));
    var services = ctx.RequestServices;
    if (services.GetRequiredService<AccountRateCounter>().Allow($"{policy}:{owner:N}", services.GetRequiredService<IClock>().UtcNow, limit, window)) return owner;
    ctx.Response.Headers.RetryAfter = ((int)window.TotalSeconds).ToString(CultureInfo.InvariantCulture);
    await Problem(ctx, 429, "rate_limited");
    return null;
  }

  private static async Task<KeyedRequest?> Keyed(HttpContext ctx, Guid owner, byte[] bodyInput)
  {
    var values = ctx.Request.Headers["Idempotency-Key"];
    if (values.Count == 0) { await Problem(ctx, 400, "idempotency_key_required"); return null; }
    if (values.Count != 1 || !Guid.TryParseExact(values[0], "D", out var key))
    {
      await Invalid(ctx, [new DocumentIssue("header", "Idempotency-Key", "format")]);
      return null;
    }
    return new KeyedRequest(owner, key, RequestHash.Compute(ctx.Request.Method, ctx.Request.Path.Value ?? "", bodyInput));
  }

  private static IfMatchValue IfMatch(HttpContext ctx)
  {
    var values = ctx.Request.Headers.IfMatch;
    if (values.Count == 0) return new IfMatchValue(IfMatchKind.Missing, 0);
    if (values.Count == 1 && StrongVersion().IsMatch(values[0] ?? ""))
      return new IfMatchValue(IfMatchKind.Version, long.Parse(values[0]!.AsSpan(1, values[0]!.Length - 2), CultureInfo.InvariantCulture));
    return new IfMatchValue(IfMatchKind.Malformed, 0);
  }

  [GeneratedRegex("""^"[1-9][0-9]{0,17}"\z""")]
  private static partial Regex StrongVersion();

  [GeneratedRegex(@"^[A-Za-z0-9_-]+\z")]
  private static partial Regex CursorText();

  /// <summary>A syntactically wrong ID cannot name anything, so it answers the same 404 as a missing one (DD-P07-07).</summary>
  private static Guid ParseId(string value) => Guid.TryParseExact(value, "D", out var id) ? id : Guid.Empty;

  private static int Limit(HttpContext ctx, List<DocumentIssue> issues)
  {
    var values = ctx.Request.Query["limit"];
    if (values.Count == 0) return DefaultLimit;
    if (values.Count != 1 || !int.TryParse(values[0], NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture, out var limit))
    {
      issues.Add(new DocumentIssue("query", "limit", "type"));
      return DefaultLimit;
    }
    if (limit < 1) issues.Add(new DocumentIssue("query", "limit", "minimum"));
    else if (limit > MaxLimit) issues.Add(new DocumentIssue("query", "limit", "maximum"));
    return limit;
  }

  private static ListPosition? Cursor(HttpContext ctx, Guid owner, string query, List<DocumentIssue> issues)
  {
    var values = ctx.Request.Query["cursor"];
    if (values.Count == 0) return null;
    var cursor = values.Count == 1 ? values[0] ?? "" : "";
    if (cursor.Length > MaxCursorLength) issues.Add(new DocumentIssue("query", "cursor", "max_length"));
    else if (!CursorText().IsMatch(cursor)) issues.Add(new DocumentIssue("query", "cursor", "pattern"));
    else if (PageCursor.Decode(cursor, owner, query) is { } position) return position;
    else issues.Add(new DocumentIssue("query", "cursor", "format"));
    return null;
  }

  private static async Task<byte[]?> ReadBody(HttpContext ctx, int limit)
  {
    if (ctx.Request.ContentLength > limit) { await Problem(ctx, 413, "payload_too_large"); return null; }
    using var buffer = new MemoryStream();
    var chunk = new byte[64 * 1024];
    try
    {
      int read;
      while ((read = await ctx.Request.Body.ReadAsync(chunk, ctx.RequestAborted)) > 0)
      {
        if (buffer.Length + read > limit) { await Problem(ctx, 413, "payload_too_large"); return null; }
        buffer.Write(chunk, 0, read);
      }
    }
    catch (BadHttpRequestException error) when (error.StatusCode == StatusCodes.Status413PayloadTooLarge)
    {
      // A chunked body has no Content-Length, so Kestrel's own limit can end the read first (ADR-038 §3).
      await Problem(ctx, 413, "payload_too_large");
      return null;
    }
    return buffer.ToArray();
  }

  private static async Task<JsonDocument?> ReadJson(HttpContext ctx)
  {
    if (!ctx.Request.HasJsonContentType()) { await Problem(ctx, 415, "unsupported_media_type"); return null; }
    var bytes = await ReadBody(ctx, ResumeLimits.MaxJsonBodyBytes);
    if (bytes is null) return null;
    var document = StrictJson.Parse(bytes);
    if (document is null) await Problem(ctx, 400, "malformed_request");
    return document;
  }

  // ---------------------------------------------------------------- answers

  private static void SetETag(HttpContext ctx, long version) => ctx.Response.Headers.ETag = $"\"{version.ToString(CultureInfo.InvariantCulture)}\"";

  private static async Task Json(HttpContext ctx, int status, byte[] body)
  {
    AccountEndpoints.NoStore(ctx);
    ctx.Response.StatusCode = status;
    ctx.Response.ContentType = "application/json";
    await ctx.Response.Body.WriteAsync(body, ctx.RequestAborted);
  }

  private static async Task Respond(HttpContext ctx, ResumeResult result, Func<ResumeResult, byte[]>? body)
  {
    if (result.Failure is { } failure) { await Fail(ctx, failure); return; }
    if (result.ETagVersion is long version) SetETag(ctx, version);
    if (body is null)
    {
      AccountEndpoints.NoStore(ctx);
      ctx.Response.StatusCode = result.Status;
      return;
    }
    await Json(ctx, result.Status, body(result));
  }

  private static Task Fail(HttpContext ctx, ResumeFailure failure)
  {
    switch (failure.Kind)
    {
      case ResumeFailureKind.NotFound: return Problem(ctx, 404, "not_found");
      case ResumeFailureKind.Trashed: return Problem(ctx, 409, "resume_trashed");
      case ResumeFailureKind.NotTrashed: return Problem(ctx, 409, "resume_not_trashed");
      case ResumeFailureKind.LimitReached: return Problem(ctx, 409, "limit_reached");
      case ResumeFailureKind.KeyReused: return Problem(ctx, 422, "idempotency_key_reused");
      case ResumeFailureKind.PreconditionRequired: return Problem(ctx, 428, "precondition_required");
      case ResumeFailureKind.PhotoInvalid: return Problem(ctx, 400, "photo_invalid");
      case ResumeFailureKind.InProgress:
        ctx.Response.Headers.RetryAfter = failure.RetryAfterSeconds.ToString(CultureInfo.InvariantCulture);
        return Problem(ctx, 409, "idempotency_request_in_progress");
      case ResumeFailureKind.IfMatchMalformed: return Invalid(ctx, [new DocumentIssue("header", "If-Match", "pattern")]);
      case ResumeFailureKind.Validation: return Invalid(ctx, failure.Issues ?? []);
      default:
        ctx.Response.StatusCode = 412;
        return ctx.Response.WriteAsJsonAsync(new
        {
          type = "about:blank",
          title = "Version mismatch",
          status = 412,
          code = "version_mismatch",
          traceId = Trace(ctx),
          currentVersion = failure.CurrentVersion,
          updatedAt = ResumeRepresentation.Stamp(failure.UpdatedAt),
        }, JsonOptions, "application/problem+json", ctx.RequestAborted);
    }
  }

  private static string Trace(HttpContext ctx) => Activity.Current?.Id ?? ctx.TraceIdentifier;

  private static Task Problem(HttpContext ctx, int status, string code) => ProblemWriter.Write(ctx, status, status switch
  {
    400 => "Bad request",
    401 => "Unauthorized",
    404 => "Not found",
    409 => "Conflict",
    413 => "Payload too large",
    415 => "Unsupported media type",
    422 => "Idempotency key reused",
    428 => "Precondition required",
    429 => "Too many requests",
    _ => "Error",
  }, code, ctx.RequestAborted);

  private static Task Invalid(HttpContext ctx, IReadOnlyList<DocumentIssue> issues)
  {
    ctx.Response.StatusCode = 400;
    return ctx.Response.WriteAsJsonAsync(new
    {
      type = "about:blank",
      title = "Validation failed",
      status = 400,
      code = "validation_failed",
      traceId = Trace(ctx),
      errors = issues.Take(100).Select(issue => new { location = issue.Location, pointer = issue.JsonPointer, code = issue.Code }),
    }, JsonOptions, "application/problem+json", ctx.RequestAborted);
  }
}
