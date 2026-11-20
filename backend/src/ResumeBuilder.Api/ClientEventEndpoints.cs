using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using ResumeBuilder.Application.Accounts;
using ResumeBuilder.Application.Resumes;
using ResumeBuilder.Domain.Resumes;

namespace ResumeBuilder.Api;

/// <summary>
/// `reportClientEvents` (NFR-13, DD-P11-14): 401, 403, the ADR-038 limit, then size, media type, syntax and schema.
/// The contract's patterns and the UUID format still admit chosen text, so the log takes only what this product can vouch for:
/// a code or engine version from a closed list, and a resume ID the caller owns. Anything else is accepted, as the contract says, and logged as `other`.
/// </summary>
internal static partial class ResumeEndpoints
{
  private const string ClientEvents = "/api/v1/client-events";
  private const int MaxClientEventBytes = 16 * 1024;
  private const int MaxClientEvents = 20;
  private const int ClientEventsPerWindow = 30;
  private static readonly TimeSpan ClientEventWindow = TimeSpan.FromMinutes(1);
  private static readonly HashSet<string> ClientEventTypes = ["export_mismatch", "export_failed", "preview_failed", "autosave_failed", "idempotency_key_reused", "unexpected_error"];
  private static readonly HashSet<string> ClientEventFields = ["type", "code", "resumeId", "engineVersion", "occurredAt"];

  /// <summary>Every code the client sends. A phase that adds a code adds it here, or it logs as `other`.</summary>
  private static readonly HashSet<string> ClientEventLoggedCodes = ["document_write", "font_load", "engine_load", "layout_error", "unknown", "validation_failed", "resume_text_limit_exceeded", "page_count.differs", "line_breaks.differs", "photo_load", "pdf_write", "txt_write"];
  /// <summary>Every shipped `ENGINE_VERSION` (frontend `entities/layout/version.ts`). A new one joins here, or it logs as `other`.</summary>
  private static readonly HashSet<string> ClientEventLoggedEngines = ["1.0.0", "1.1.0", "1.2.0"];
  private const string UnlistedLogValue = "other";

  [GeneratedRegex("^[a-z0-9_.-]{1,64}$", RegexOptions.CultureInvariant)]
  private static partial Regex ClientEventCode();
  [GeneratedRegex("^[0-9A-Za-z.+-]{1,32}$", RegexOptions.CultureInvariant)]
  private static partial Regex ClientEventEngine();
  [GeneratedRegex(@"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$", RegexOptions.CultureInvariant)]
  private static partial Regex ClientEventTime();

  public static void MapClientEventEndpoints(this WebApplication app) =>
    Describe(app.MapPost(ClientEvents, ReportClientEvents), "reportClientEvents", "Telemetry", [202], 400, 401, 403, 413, 415, 429);

  private static async Task ReportClientEvents(HttpContext ctx, AccountRateCounter rates, IClock clock, ILoggerFactory loggers, IResumeUseCases resumes)
  {
    if (await Owner(ctx) is not Guid owner) return;
    if (!await AccountEndpoints.CheckCsrf(ctx)) return;
    var address = ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    if (!rates.Allow($"client-events:{address}", clock.UtcNow, ClientEventsPerWindow, ClientEventWindow))
    {
      ctx.Response.Headers.RetryAfter = ((int)ClientEventWindow.TotalSeconds).ToString(CultureInfo.InvariantCulture);
      await Problem(ctx, 429, "rate_limited");
      return;
    }
    if (!ctx.Request.HasJsonContentType()) { await Problem(ctx, 415, "unsupported_media_type"); return; }
    var bytes = await ReadBody(ctx, MaxClientEventBytes);
    if (bytes is null) return;
    using var body = StrictJson.Parse(bytes);
    if (body is null) { await Problem(ctx, 400, "malformed_request"); return; }
    var issues = new List<DocumentIssue>();
    var events = ReadClientEvents(body.RootElement, issues);
    if (issues.Count > 0) { await Invalid(ctx, issues); return; }
    var logger = loggers.CreateLogger("ResumeBuilder.Api");
    foreach (var item in events)
    {
      var code = ClientEventLoggedCodes.Contains(item.Code) ? item.Code : UnlistedLogValue;
      var engine = item.EngineVersion == "-" || ClientEventLoggedEngines.Contains(item.EngineVersion) ? item.EngineVersion : UnlistedLogValue;
      var loggedId = item.ResumeId == "-" || await resumes.GetAsync(owner, Guid.ParseExact(item.ResumeId, "D"), ctx.RequestAborted) is not null ? item.ResumeId : UnlistedLogValue;
      SafeLogs.ClientEvent(logger, item.Type, code, loggedId, engine);
    }
    AccountEndpoints.NoStore(ctx);
    ctx.Response.StatusCode = 202;
  }

  private sealed record ClientEvent(string Type, string Code, string ResumeId, string EngineVersion);

  private static List<ClientEvent> ReadClientEvents(JsonElement root, List<DocumentIssue> issues)
  {
    var events = new List<ClientEvent>();
    void Issue(string pointer, string code) => issues.Add(new DocumentIssue("body", pointer, code));
    if (root.ValueKind != JsonValueKind.Object) { Issue("", "type"); return events; }
    foreach (var property in root.EnumerateObject())
      if (property.Name != "events") Issue($"/{JsonPointerName(property.Name)}", "unknown");
    if (!root.TryGetProperty("events", out var list) || list.ValueKind != JsonValueKind.Array) { Issue("/events", "required"); return events; }
    var count = list.GetArrayLength();
    if (count is < 1 or > MaxClientEvents) { Issue("/events", "length"); return events; }
    var index = 0;
    foreach (var item in list.EnumerateArray())
    {
      var at = $"/events/{index++}";
      if (item.ValueKind != JsonValueKind.Object) { Issue(at, "type"); continue; }
      foreach (var property in item.EnumerateObject())
        if (!ClientEventFields.Contains(property.Name)) Issue($"{at}/{JsonPointerName(property.Name)}", "unknown");
      string? Text(string name)
      {
        if (!item.TryGetProperty(name, out var value)) { Issue($"{at}/{name}", "required"); return null; }
        if (value.ValueKind == JsonValueKind.Null && (name == "resumeId" || name == "engineVersion")) return "-";
        if (value.ValueKind != JsonValueKind.String) { Issue($"{at}/{name}", "type"); return null; }
        return value.GetString();
      }
      var type = Text("type");
      if (type is not null && !ClientEventTypes.Contains(type)) { Issue($"{at}/type", "enum"); type = null; }
      var code = Text("code");
      if (code is not null && !ClientEventCode().IsMatch(code)) { Issue($"{at}/code", "pattern"); code = null; }
      var resume = Text("resumeId");
      if (resume is not null && resume != "-")
      {
        if (Guid.TryParseExact(resume, "D", out var parsed)) resume = parsed.ToString("D");
        else { Issue($"{at}/resumeId", "format"); resume = null; }
      }
      var engine = Text("engineVersion");
      if (engine is not null && engine != "-" && !ClientEventEngine().IsMatch(engine)) { Issue($"{at}/engineVersion", "pattern"); engine = null; }
      var time = Text("occurredAt");
      if (time is not null && (!ClientEventTime().IsMatch(time) || !DateTimeOffset.TryParse(time, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out _))) { Issue($"{at}/occurredAt", "format"); time = null; }
      if (type is not null && code is not null && resume is not null && engine is not null && time is not null) events.Add(new ClientEvent(type, code, resume, engine));
    }
    return events;
  }

  /// <summary>An unknown property's name is user input: only a harmless one is echoed in the problem.</summary>
  private static string JsonPointerName(string name) => ClientEventCode().IsMatch(name.ToLowerInvariant()) ? name : "unknown";
}
