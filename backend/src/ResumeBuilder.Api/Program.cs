using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.DataProtection;
using System.Diagnostics;
using System.Net;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.Extensions.DependencyInjection;
using ResumeBuilder.Application;
using ResumeBuilder.Application.Accounts;
using ResumeBuilder.Application.CvImport;
using ResumeBuilder.Application.Resumes;
using ResumeBuilder.Api;
using ResumeBuilder.Domain.Resumes;
using ResumeBuilder.Infrastructure;
using ResumeBuilder.Infrastructure.CvImport;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Logging.SetMinimumLevel(LogLevel.None);
builder.Logging.AddFilter("ResumeBuilder.Api", LogLevel.Information);
// The deletion processor reports a stalled erasure SLA with counts only (review M-1); everything else stays silent.
builder.Logging.AddFilter("ResumeBuilder.Infrastructure.AccountDeletionProcessor", LogLevel.Warning);
builder.Logging.AddFilter("ResumeBuilder.Infrastructure.ResumeDiagnostics", LogLevel.Warning);
// DD-P13-21: the other counts-only operational events (NFR-13, ADR-034). Each is a LoggerMessage with no content.
builder.Logging.AddFilter("ResumeBuilder.Infrastructure.AccountEmailDispatcher", LogLevel.Warning);
builder.Logging.AddFilter("ResumeBuilder.Infrastructure.ScheduledJobWorker", LogLevel.Warning);
builder.Logging.AddFilter("ResumeBuilder.Infrastructure.TrashExpiryJob", LogLevel.Warning);
builder.Logging.AddFilter("ResumeBuilder.Infrastructure.RestoreReconciliation", LogLevel.Information);
// ADR-038 §3: one byte over the largest body, so the endpoints answer 413 with a problem themselves.
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = ResumeLimits.MaxPhotoBodyBytes + 1);
var connection = builder.Configuration["Mongo:ConnectionString"];
if (string.IsNullOrWhiteSpace(connection) || !Uri.TryCreate(connection, UriKind.Absolute, out var uri) || uri.Scheme is not ("mongodb" or "mongodb+srv"))
  throw new InvalidOperationException("Mongo configuration is missing or invalid");
var protection = builder.Services.AddDataProtection().SetApplicationName("ResumeBuilder").SetDefaultKeyLifetime(TimeSpan.FromDays(90));
if (builder.Configuration["Accounts:DataProtection:KeyDirectory"] is { Length: > 0 } keyDirectory)
  protection.PersistKeysToFileSystem(new DirectoryInfo(keyDirectory));
var insecureTestCookies = !builder.Environment.IsProduction() && builder.Configuration.GetValue("Accounts:AllowInsecureCookies", false);
builder.Services.AddAntiforgery(options =>
{
  options.HeaderName = "X-XSRF-TOKEN";
  options.Cookie.Name = "__Host-rb_csrf";
  options.Cookie.SecurePolicy = insecureTestCookies ? CookieSecurePolicy.None : CookieSecurePolicy.Always;
  options.Cookie.SameSite = SameSiteMode.Strict;
  options.Cookie.HttpOnly = true;
});
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie(options =>
{
  options.Cookie.Name = "__Host-rb_session";
  options.Cookie.Path = "/";
  options.Cookie.SecurePolicy = insecureTestCookies ? CookieSecurePolicy.None : CookieSecurePolicy.Always;
  options.Cookie.HttpOnly = true;
  options.Cookie.SameSite = SameSiteMode.Strict;
  options.ExpireTimeSpan = TimeSpan.FromDays(14);
  options.SlidingExpiration = true;
});
builder.Services.AddSingleton<ITicketStore, AccountCookieTicketStore>();
builder.Services.AddOptions<CookieAuthenticationOptions>(CookieAuthenticationDefaults.AuthenticationScheme)
  .Configure<ITicketStore, IClock>((options, store, clock) => { options.SessionStore = store; options.TimeProvider = new AccountTimeProvider(clock); });
builder.Services.AddSingleton<AccountRateCounter>();
builder.Services.AddSingleton<IAccountSecurityCounters>(_ => new MongoAccountSecurityCounters(connection));
builder.Services.AddSingleton<IClock, SystemAccountClock>();
builder.Services.AddSingleton<MongoAccountStore>(sp => new MongoAccountStore(connection, sp.GetRequiredService<IDataProtectionProvider>()));
builder.Services.AddSingleton<IAccountStore>(sp => sp.GetRequiredService<MongoAccountStore>());
builder.Services.AddSingleton<IAccountTokenStore>(sp => sp.GetRequiredService<MongoAccountStore>());
builder.Services.AddSingleton<ISessionStore>(sp => sp.GetRequiredService<MongoAccountStore>());
builder.Services.AddSingleton<IEmailOutboxStore>(sp => sp.GetRequiredService<MongoAccountStore>());
builder.Services.AddSingleton<IAccountPasswordHasher, IdentityAccountPasswordHasher>();
builder.Services.AddSingleton<IAccountUseCases, AccountUseCases>();
builder.Services.AddSingleton<IAccountEmailDispatcher, AccountEmailDispatcher>();
builder.Services.AddSingleton<IEmailSink>(_ => new SmtpAccountEmailSink(
  builder.Configuration["Email:Smtp:Host"] ?? "", builder.Configuration.GetValue("Email:Smtp:Port", 1025), builder.Configuration["Email:Smtp:Sender"] ?? "",
  new Uri(builder.Configuration["Accounts:PublicBaseUrl"] ?? (builder.Environment.IsDevelopment() ? "http://localhost:5173" : throw new InvalidOperationException("Public application URL is missing"))),
  builder.Configuration.GetValue("Email:Smtp:EnableSsl", !builder.Environment.IsDevelopment()), builder.Configuration["Email:Smtp:Username"], builder.Configuration["Email:Smtp:Password"]));
string BlobConnection() => builder.Configuration["Blob:ConnectionString"] ?? (builder.Environment.IsDevelopment() ? "UseDevelopmentStorage=true" : throw new InvalidOperationException("Blob storage is missing"));
builder.Services.AddSingleton(_ => new DualAccountDeletionLedger(connection, BlobConnection()));
builder.Services.AddSingleton<IAccountDeletionLedger>(sp => sp.GetRequiredService<DualAccountDeletionLedger>());
builder.Services.AddSingleton<IResumeDeletionLedger>(sp => sp.GetRequiredService<DualAccountDeletionLedger>());
builder.Services.AddSingleton(_ => new MongoResumeStore(connection));
builder.Services.AddSingleton<IResumeStore>(sp => sp.GetRequiredService<MongoResumeStore>());
builder.Services.AddSingleton<ISnapshotStore>(sp => sp.GetRequiredService<MongoResumeStore>());
builder.Services.AddSingleton<IIdempotencyStore>(sp => sp.GetRequiredService<MongoResumeStore>());
builder.Services.AddSingleton(_ => new AzurePhotoStorage(BlobConnection()));
builder.Services.AddSingleton<IPhotoStorage>(sp => sp.GetRequiredService<AzurePhotoStorage>());
builder.Services.AddSingleton<IPhotoInventory>(sp => sp.GetRequiredService<AzurePhotoStorage>());
builder.Services.AddSingleton<IPhotoProcessor, SkiaPhotoProcessor>();
builder.Services.AddSingleton<IResumeDiagnostics, ResumeDiagnostics>();
builder.Services.AddSingleton<IResumeLifecycle, ResumeLifecycle>();
builder.Services.AddSingleton<IResumeUseCases, ResumeUseCases>();
// ADR-055, DD-IMP-10: the Anthropic adapter in Production, the recorded stub elsewhere, unless `Imports:Provider` says otherwise.
builder.Services.AddSingleton<IImportStructurer>(_ =>
  (builder.Configuration["Imports:Provider"] ?? (builder.Environment.IsProduction() ? "anthropic" : "stub")) == "anthropic"
    ? new AnthropicImportStructurer(new ImportProviderOptions
    {
      ApiKey = builder.Configuration["Anthropic:ApiKey"],
      PrimaryModel = builder.Configuration["Imports:PrimaryModel"] ?? "claude-haiku-5-5",
      EscalationModel = builder.Configuration["Imports:EscalationModel"] ?? "claude-sonnet-5-5",
    })
    : new StubImportStructurer(builder.Configuration["Imports:StubDirectory"]));
builder.Services.AddSingleton<IImportUseCases, ImportUseCases>();
builder.Services.AddSingleton<ImportRateCounter>();
builder.Services.AddSingleton<IAccountOwnedDataPurger, ResumeAccountPurger>();
builder.Services.AddSingleton<IAccountResumeExportSource, ResumeAccountExportSource>();
builder.Services.AddSingleton<IAccountDeletionProcessor, AccountDeletionProcessor>();
builder.Services.AddSingleton<TrashExpiryJob>();
builder.Services.AddSingleton<RestoreReconciliation>();
builder.Services.AddSingleton<IJobLease>(_ => new MongoJobLease(connection));
// ADR-007, DD-P13-03: each lifecycle job runs under a lease, once per period across replicas. The job is built per run
// (DeferredJob), as the P06/P07 workers resolved theirs per tick, so the host starts without resolving the Blob stores.
void AddJob(string enabledSetting, string name, TimeSpan period, Func<IServiceProvider, IScheduledJob> create)
{
  if (!builder.Configuration.GetValue(enabledSetting, true)) return;
  builder.Services.AddSingleton<IHostedService>(sp => new ScheduledJobWorker(new DeferredJob(name, period, () => create(sp)), sp.GetRequiredService<IJobLease>(),
    sp.GetRequiredService<IClock>(), sp.GetRequiredService<ILogger<ScheduledJobWorker>>()));
}
AddJob("Accounts:DeletionWorker:Enabled", AccountPurgeJob.JobName, AccountPurgeJob.JobPeriod, sp => new AccountPurgeJob(sp.GetRequiredService<IAccountDeletionProcessor>()));
AddJob("Resumes:LifecycleWorker:Enabled", ResumeLifecycleJob.JobName, ResumeLifecycleJob.JobPeriod, sp => new ResumeLifecycleJob(sp.GetRequiredService<IResumeLifecycle>()));
AddJob("Resumes:TrashExpiryWorker:Enabled", TrashExpiryJob.JobName, TrashExpiryJob.JobPeriod, sp => sp.GetRequiredService<TrashExpiryJob>());
if (builder.Configuration.GetValue("Accounts:EmailWorker:Enabled", true)) builder.Services.AddHostedService<AccountEmailWorker>();
builder.Services.AddSingleton<IReadinessProbe>(_ => new MongoReadiness(connection));
builder.Services.AddTransient<IStartupFilter, ExceptionBoundaryFilter>();
builder.Services.AddOpenApi(options => options.AddOperationTransformer((operation, _, _) =>
{
  if (operation.Responses is { } responses && responses.Remove("500", out var response)) responses["default"] = response;
  return Task.CompletedTask;
}));
builder.Services.AddSingleton<IOpenApiDocumentProvider>(services => services.GetRequiredKeyedService<IOpenApiDocumentProvider>("v1"));
builder.Services.AddRateLimiter(options =>
{
  options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
      RateLimitPartition.GetFixedWindowLimiter(context.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions
      {
        PermitLimit = 600,
        Window = TimeSpan.FromMinutes(1),
        QueueLimit = 0,
        AutoReplenishment = true
      }));
  options.OnRejected = async (context, token) =>
  {
    context.HttpContext.Response.Headers.RetryAfter = "60";
    await WriteProblem(context.HttpContext, 429, "Too many requests", "rate_limited", token);
  };
});
var forwarded = new ForwardedHeadersOptions { ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto };
foreach (var proxy in builder.Configuration.GetSection("ReverseProxy:TrustedProxies").GetChildren())
  if (IPAddress.TryParse(proxy.Value, out var address)) forwarded.KnownProxies.Add(address);
// DD-P13-20: the ingress forwards from a range, not one address. Unparsable entries are ignored, so nothing becomes trusted by mistake.
List<System.Net.IPNetwork> trustedNetworks = [];
foreach (var network in builder.Configuration.GetSection("ReverseProxy:TrustedNetworks").GetChildren())
  if (System.Net.IPNetwork.TryParse(network.Value, out var range)) trustedNetworks.Add(range);
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
  options.ForwardedHeaders = forwarded.ForwardedHeaders;
  options.KnownIPNetworks.Clear();
  options.KnownProxies.Clear();
  foreach (var address in forwarded.KnownProxies) options.KnownProxies.Add(address);
  foreach (var range in trustedNetworks) options.KnownIPNetworks.Add(range);
});
// DD-P13-19: TLS ends at the ingress, which redirects HTTP (P15); the application tells browsers to stay on HTTPS.
builder.Services.AddHsts(options => { options.MaxAge = TimeSpan.FromDays(365); options.IncludeSubDomains = true; });
var app = builder.Build();
// DD-P13-04: `reconcile-restore` runs and exits; Kestrel and the hosted workers never start.
if (await OperationsCommand.TryRunAsync(app.Services, args, CancellationToken.None) is { } exitCode)
{
  // Disposing the host flushes the console logger's queue, so the summary line the runbook copies is always written.
  await app.DisposeAsync();
  return exitCode;
}
app.UseForwardedHeaders();
if (app.Environment.IsProduction()) app.UseHsts();
app.UseRateLimiter();
app.UseAuthentication();
app.Use(async (context, next) =>
{
  var start = Stopwatch.GetTimestamp();
  await next(context);
  SafeLogs.Complete(app.Logger, "request_complete", context.Response.StatusCode >= 400 ? "http_error" : "ok", Activity.Current?.Id ?? context.TraceIdentifier, (context.GetEndpoint() as RouteEndpoint)?.RoutePattern.RawText ?? "unknown", context.Response.StatusCode, Stopwatch.GetElapsedTime(start).TotalMilliseconds);
});
app.MapGet("/api/v1/health/live", () => Results.Json(new { status = "ok" }))
    .WithName("getLiveness").WithTags("Health")
    .Produces(200, contentType: "application/json")
    .Produces(429, contentType: "application/problem+json")
    .Produces(500, contentType: "application/problem+json");
app.MapGet("/api/v1/health/ready", async (IReadinessProbe probe, HttpContext context) =>
{
  if (await probe.IsReadyAsync(context.RequestAborted)) return Results.Json(new { status = "ok" });
  await WriteProblem(context, 503, "Service unavailable", "service_unavailable", context.RequestAborted);
  return Results.Empty;
}).WithName("getReadiness").WithTags("Health")
    .Produces(200, contentType: "application/json")
    .Produces(429, contentType: "application/problem+json")
    .Produces(503, contentType: "application/problem+json")
    .Produces(500, contentType: "application/problem+json");
app.MapAccountEndpoints();
app.MapResumeEndpoints();
app.MapClientEventEndpoints();
app.MapImportEndpoints();
app.Run();
return 0;

static async Task WriteProblem(HttpContext context, int status, string title, string code, CancellationToken token)
    => await ProblemWriter.Write(context, status, title, code, token);

public partial class Program;

internal static class ProblemWriter
{
  public static async Task Write(HttpContext context, int status, string title, string code, CancellationToken token)
  {
    context.Response.StatusCode = status;
    await context.Response.WriteAsJsonAsync(new { type = "about:blank", title, status, code, traceId = Activity.Current?.Id ?? context.TraceIdentifier },
        options: new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web), contentType: "application/problem+json", cancellationToken: token);
  }
}

internal sealed class ExceptionBoundaryFilter : IStartupFilter
{
  public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
  {
    app.UseExceptionHandler(error => error.Run(async context =>
      {
        var trace = Activity.Current?.Id ?? context.TraceIdentifier;
        SafeLogs.Failure(context.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("ResumeBuilder.Api"), "request_failed", "internal_error", trace,
              (context.GetEndpoint() as RouteEndpoint)?.RoutePattern.RawText ?? "unknown", 500);
        await ProblemWriter.Write(context, 500, "Internal error", "internal_error", context.RequestAborted);
      }));
    next(app);
  };
}

internal static class SafeLogs
{
  private static readonly Action<ILogger, string, string, string, string, int, Exception?> FailureMessage =
      LoggerMessage.Define<string, string, string, string, int>(LogLevel.Error, new EventId(1), "{EventName} {Code} {TraceId} {RouteTemplate} {Status}");
  private static readonly Action<ILogger, string, string, string, string, int, double, Exception?> CompleteMessage =
      LoggerMessage.Define<string, string, string, string, int, double>(LogLevel.Information, new EventId(2), "{EventName} {Code} {TraceId} {RouteTemplate} {Status} {ElapsedMs}");
  private static readonly Action<ILogger, string, string, string, string, string, Exception?> ClientEventMessage =
      LoggerMessage.Define<string, string, string, string, string>(LogLevel.Information, new EventId(3), "{EventName} {Type} {Code} {ResumeId} {EngineVersion}");
  public static void ClientEvent(ILogger logger, string type, string code, string resumeId, string engineVersion) => ClientEventMessage(logger, "client_event", type, code, resumeId, engineVersion, null);
  private static readonly Action<ILogger, string, string, string, long, long, double, Exception?> CvImportMessage =
      LoggerMessage.Define<string, string, string, long, long, double>(LogLevel.Information, new EventId(4), "{EventName} {Outcome} {Tiers} {InputTokens} {OutputTokens} {ElapsedMs}");
  /// <summary>ADR-055: content-free — never the source text, the prompt or the draft.</summary>
  public static void CvImport(ILogger logger, string outcome, string tiers, long inputTokens, long outputTokens, double elapsedMs) => CvImportMessage(logger, "cv_import", outcome, tiers, inputTokens, outputTokens, elapsedMs, null);
  public static void Failure(ILogger logger, string eventName, string code, string traceId, string route, int status) => FailureMessage(logger, eventName, code, traceId, route, status, null);
  public static void Complete(ILogger logger, string eventName, string code, string traceId, string route, int status, double elapsed) => CompleteMessage(logger, eventName, code, traceId, route, status, elapsed, null);
}
