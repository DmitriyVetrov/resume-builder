using System.Collections.Concurrent;
using System.Globalization;
using System.Text.Json;
using ResumeBuilder.Application.Accounts;
using ResumeBuilder.Application.CvImport;
using ResumeBuilder.Application.Resumes;
using ResumeBuilder.Domain.Resumes;

namespace ResumeBuilder.Api;

/// <summary>
/// `structureResumeImport` (ADR-055, IMP-01): 401, 403, the per-user limit, then media type, size, syntax and
/// schema, then the use case. The source text and the draft are never logged (rule 03); the log line holds
/// the outcome, the tiers called, token counts and the duration.
/// </summary>
internal static partial class ResumeEndpoints
{
  private const string Imports = "/api/v1/resume-imports/structure";
  private const int MaxImportBytes = 256 * 1024;
  private const int MaxSourceText = 60000;
  private static readonly HashSet<string> ImportFields = ["sourceText", "sourceFormat", "layoutHint"];
  private static readonly HashSet<string> SourceFormats = ["pdf", "txt", "docx"];

  public static void MapImportEndpoints(this WebApplication app) =>
    Describe(app.MapPost(Imports, StructureImport), "structureResumeImport", "Imports", [200], 400, 401, 403, 413, 415, 429, 503);

  private static async Task StructureImport(HttpContext ctx, ImportRateCounter rates, IClock clock, ILoggerFactory loggers, IImportUseCases imports)
  {
    if (await Owner(ctx) is not Guid owner) return;
    if (!await AccountEndpoints.CheckCsrf(ctx)) return;
    if (rates.RetryAfter(owner, clock.UtcNow) is { } wait)
    {
      ctx.Response.Headers.RetryAfter = Math.Max(1, (int)Math.Ceiling(wait.TotalSeconds)).ToString(CultureInfo.InvariantCulture);
      await Problem(ctx, 429, "rate_limited");
      return;
    }
    if (!ctx.Request.HasJsonContentType()) { await Problem(ctx, 415, "unsupported_media_type"); return; }
    var bytes = await ReadBody(ctx, MaxImportBytes);
    if (bytes is null) return;
    using var body = StrictJson.Parse(bytes);
    if (body is null) { await Problem(ctx, 400, "malformed_request"); return; }
    var issues = new List<DocumentIssue>();
    var request = ReadImportRequest(body.RootElement, issues);
    if (request is null) { await Invalid(ctx, issues); return; }

    var outcome = await imports.StructureAsync(request, ctx.RequestAborted);
    var tiers = string.Join('+', outcome.Calls.Select(call => call.Tier == ImportTier.Primary ? "primary" : "escalation"));
    SafeLogs.CvImport(loggers.CreateLogger("ResumeBuilder.Api"), outcome.Draft is null ? "unavailable" : "draft", tiers,
      outcome.Calls.Sum(call => call.InputTokens), outcome.Calls.Sum(call => call.OutputTokens), outcome.Calls.Sum(call => call.Duration.TotalMilliseconds));
    if (outcome.Draft is null) { await ProblemWriter.Write(ctx, 503, "Import unavailable", "import_unavailable", ctx.RequestAborted); return; }
    AccountEndpoints.NoStore(ctx);
    ctx.Response.StatusCode = 200;
    await ctx.Response.WriteAsJsonAsync(new
    {
      draft = outcome.Draft,
      escalated = outcome.Escalated,
      warnings = outcome.Warnings.Select(warning => new { code = warning.Code, pointer = warning.Field }),
    }, JsonOptions, "application/json", ctx.RequestAborted);
  }

  private static ImportRequest? ReadImportRequest(JsonElement root, List<DocumentIssue> issues)
  {
    void Issue(string pointer, string code) => issues.Add(new DocumentIssue("body", pointer, code));
    if (root.ValueKind != JsonValueKind.Object) { Issue("", "type"); return null; }
    foreach (var property in root.EnumerateObject())
      if (!ImportFields.Contains(property.Name)) Issue($"/{JsonPointerName(property.Name)}", "unknown");

    string? text = null;
    if (!root.TryGetProperty("sourceText", out var source)) Issue("/sourceText", "required");
    else if (source.ValueKind != JsonValueKind.String) Issue("/sourceText", "type");
    else
    {
      text = source.GetString()!;
      var length = text.EnumerateRunes().Count();
      if (length < 1) { Issue("/sourceText", "min_length"); text = null; }
      else if (length > MaxSourceText) { Issue("/sourceText", "max_length"); text = null; }
    }

    string? format = null;
    if (!root.TryGetProperty("sourceFormat", out var kind)) Issue("/sourceFormat", "required");
    else if (kind.ValueKind != JsonValueKind.String || !SourceFormats.Contains(kind.GetString()!)) Issue("/sourceFormat", "enum");
    else format = kind.GetString();

    int? columns = null;
    string? side = null;
    var sideValid = false;
    if (!root.TryGetProperty("layoutHint", out var hint)) Issue("/layoutHint", "required");
    else if (hint.ValueKind != JsonValueKind.Object) Issue("/layoutHint", "type");
    else
    {
      foreach (var property in hint.EnumerateObject())
        if (property.Name is not ("columns" or "sidebarSide")) Issue($"/layoutHint/{JsonPointerName(property.Name)}", "unknown");
      if (!hint.TryGetProperty("columns", out var count)) Issue("/layoutHint/columns", "required");
      else if (count.ValueKind != JsonValueKind.Number || !count.TryGetInt32(out var number) || number is not (1 or 2)) Issue("/layoutHint/columns", "enum");
      else columns = number;
      if (!hint.TryGetProperty("sidebarSide", out var sidebar)) Issue("/layoutHint/sidebarSide", "required");
      else if (sidebar.ValueKind == JsonValueKind.Null) sideValid = true;
      else if (sidebar.ValueKind != JsonValueKind.String || sidebar.GetString() is not ("left" or "right")) Issue("/layoutHint/sidebarSide", "enum");
      else { side = sidebar.GetString(); sideValid = true; }
    }
    return issues.Count == 0 && text is not null && format is not null && columns is not null && sideValid ? new ImportRequest(text, format, columns.Value, side) : null;
  }
}

/// <summary>DD-IMP-04: per user, 10 imports per hour and 30 per day, each a fixed window from its first request; in memory (one instance).</summary>
internal sealed class ImportRateCounter
{
  private const int PerHour = 10;
  private const int PerDay = 30;
  private static readonly TimeSpan Hour = TimeSpan.FromHours(1);
  private static readonly TimeSpan Day = TimeSpan.FromDays(1);
  private readonly ConcurrentDictionary<Guid, Windows> users = new();

  private sealed record Windows(DateTimeOffset HourStart, int HourCount, DateTimeOffset DayStart, int DayCount);

  /// <summary>Counts this request and returns null when it is allowed, or how long until the window that refuses it ends.</summary>
  public TimeSpan? RetryAfter(Guid user, DateTimeOffset now)
  {
    TimeSpan? refused = null;
    users.AddOrUpdate(user, _ => new Windows(now, 1, now, 1), (_, old) =>
    {
      var hour = now - old.HourStart >= Hour ? (Start: now, Count: 0) : (Start: old.HourStart, Count: old.HourCount);
      var day = now - old.DayStart >= Day ? (Start: now, Count: 0) : (Start: old.DayStart, Count: old.DayCount);
      refused = day.Count >= PerDay ? day.Start + Day - now : hour.Count >= PerHour ? hour.Start + Hour - now : null;
      return refused is null ? new Windows(hour.Start, hour.Count + 1, day.Start, day.Count + 1) : new Windows(hour.Start, hour.Count, day.Start, day.Count);
    });
    return refused;
  }
}
