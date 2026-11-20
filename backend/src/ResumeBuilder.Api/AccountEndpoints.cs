using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Antiforgery;
using ResumeBuilder.Infrastructure;
using ResumeBuilder.Application.Accounts;
using ResumeBuilder.Domain.Accounts;

namespace ResumeBuilder.Api;

internal static class AccountEndpoints
{
  private const string CsrfCookie = "XSRF-TOKEN";
  private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

  public static void MapAccountEndpoints(this WebApplication app)
  {
    Describe(app.MapGet("/api/v1/session", GetSession), "getSession", "Session", 200, 429);
    Describe(app.MapPost("/api/v1/auth/sign-up", SignUp), "signUp", "Session", 202, 400, 403, 413, 415, 429);
    Describe(app.MapPost("/api/v1/auth/verify-email", VerifyEmail), "verifyEmail", "Session", 204, 400, 403, 413, 415, 429);
    Describe(app.MapPost("/api/v1/auth/resend-verification", Resend), "resendVerification", "Session", 202, 400, 403, 413, 415, 429);
    Describe(app.MapPost("/api/v1/auth/login", Login), "login", "Session", 200, 400, 401, 403, 413, 415, 429);
    Describe(app.MapPost("/api/v1/auth/logout", Logout), "logout", "Session", 204, 401, 403, 429);
    Describe(app.MapPost("/api/v1/auth/password-reset/request", ResetRequest), "requestPasswordReset", "Session", 202, 400, 403, 413, 415, 429);
    Describe(app.MapPost("/api/v1/auth/password-reset/confirm", ResetConfirm), "confirmPasswordReset", "Session", 204, 400, 403, 413, 415, 429);
    Describe(app.MapPost("/api/v1/auth/reauthenticate", Reauthenticate), "reauthenticate", "Session", 204, 400, 401, 403, 413, 415, 429);
    Describe(app.MapPut("/api/v1/account/password", ChangePassword), "changePassword", "Account", 204, 400, 401, 403, 413, 415, 429);
    Describe(app.MapDelete("/api/v1/account", Delete), "requestAccountDeletion", "Account", 202, 401, 403, 429);
    Describe(app.MapGet("/api/v1/account/data-export", Export), "exportAccountData", "Account", 200, 401, 403, 429);
  }

  private static void Describe(RouteHandlerBuilder route, string name, string tag, int success, params int[] errors)
  {
    route.WithName(name).WithTags(tag);
    if (success == 200) route.Produces(success, contentType: "application/json");
    else route.Produces(success);
    foreach (var status in errors) route.Produces(status, contentType: "application/problem+json");
    route.Produces(500, contentType: "application/problem+json");
  }

  private static async Task Problem(HttpContext ctx, int status, string code) => await ProblemWriter.Write(ctx, status,
    status switch { 400 => "Bad request", 401 => "Unauthorized", 403 => "Forbidden", 415 => "Unsupported media type", 429 => "Too many requests", _ => "Error" }, code, ctx.RequestAborted);

  internal static async Task<bool> CheckCsrf(HttpContext ctx)
  {
    if (ctx.Request.Headers["X-XSRF-TOKEN"].Count != 1) { await Problem(ctx, 403, "csrf_token_invalid"); return false; }
    try { await ctx.RequestServices.GetRequiredService<IAntiforgery>().ValidateRequestAsync(ctx); return true; }
    catch (AntiforgeryValidationException) { await Problem(ctx, 403, "csrf_token_invalid"); return false; }
  }

  private static void IssueCsrf(HttpContext ctx)
  {
    var tokens = ctx.RequestServices.GetRequiredService<IAntiforgery>().GetAndStoreTokens(ctx);
    ctx.Response.Cookies.Append(CsrfCookie, tokens.RequestToken!, Cookie(ctx, false));
  }

  private static async Task<bool> CheckPost(HttpContext ctx)
  {
    if (!await CheckCsrf(ctx)) return false;
    if (!ctx.Request.HasJsonContentType()) { await Problem(ctx, 415, "unsupported_media_type"); return false; }
    return true;
  }

  private static async Task ValidationProblem(HttpContext ctx, string pointer, string code)
  {
    ctx.Response.StatusCode = 400;
    await ctx.Response.WriteAsJsonAsync(new
    {
      type = "about:blank",
      title = "Validation failed",
      status = 400,
      code = "validation_failed",
      traceId = System.Diagnostics.Activity.Current?.Id ?? ctx.TraceIdentifier,
      errors = new[] { new { location = "body", pointer, code } }
    }, JsonOptions, "application/problem+json", ctx.RequestAborted);
  }

  private static async Task<JsonElement?> Body(HttpContext ctx, params string[] fields)
  {
    using var stream = new MemoryStream();
    var buffer = new byte[4096];
    int count;
    while ((count = await ctx.Request.Body.ReadAsync(buffer, ctx.RequestAborted)) > 0)
    {
      if (stream.Length + count > 16 * 1024) { await Problem(ctx, 413, "payload_too_large"); return null; }
      stream.Write(buffer, 0, count);
    }
    try
    {
      using var document = JsonDocument.Parse(stream.ToArray());
      var root = document.RootElement;
      if (root.ValueKind != JsonValueKind.Object) { await ValidationProblem(ctx, "", "invalid_type"); return null; }
      var names = new HashSet<string>(StringComparer.Ordinal);
      foreach (var property in root.EnumerateObject())
      {
        if (!names.Add(property.Name) || !fields.Contains(property.Name, StringComparer.Ordinal)) { await ValidationProblem(ctx, "", "unexpected_field"); return null; }
        if (property.Value.ValueKind != JsonValueKind.String) { await ValidationProblem(ctx, "/" + property.Name, "invalid_type"); return null; }
      }
      foreach (var field in fields)
        if (!names.Contains(field)) { await ValidationProblem(ctx, "/" + field, "required"); return null; }
      return root.Clone();
    }
    catch (JsonException) { await Problem(ctx, 400, "malformed_request"); return null; }
  }
  private static string Field(JsonElement? body, string name) => body is { ValueKind: JsonValueKind.Object } value && value.TryGetProperty(name, out var field) && field.ValueKind == JsonValueKind.String ? field.GetString() ?? "" : "";
  private static CookieOptions Cookie(HttpContext ctx, bool httpOnly) => new() { Secure = ctx.RequestServices.GetRequiredService<IHostEnvironment>().IsProduction() || !ctx.RequestServices.GetRequiredService<IConfiguration>().GetValue("Accounts:AllowInsecureCookies", false), HttpOnly = httpOnly, SameSite = SameSiteMode.Strict, Path = "/" };
  internal static void NoStore(HttpContext ctx) => ctx.Response.Headers.CacheControl = "no-store";
  private static Guid? SessionId(HttpContext ctx) => ctx.User.Identity?.IsAuthenticated == true && Guid.TryParse(ctx.User.FindFirst(AccountCookieTicketStore.SessionClaim)?.Value, out var id) ? id : null;
  internal static async Task<(AccountSessionRecord Session, AccountRecord Account)?> Current(HttpContext ctx, IAccountUseCases useCases, IAccountStore accounts)
  {
    var id = SessionId(ctx);
    if (id is null) return null;
    var session = await useCases.GetSessionAsync(id.Value, ctx.RequestAborted);
    if (session is null) return null;
    var account = await accounts.FindByIdAsync(session.AccountId, ctx.RequestAborted);
    return account is { DeletionRequestedAt: null } ? (session, account) : null;
  }
  private static object SessionBody(AccountRecord? account) => new
  {
    authenticated = account is not null,
    user = account is null ? null : new { id = account.Id, email = account.Email, emailVerified = account.EmailVerifiedAt is not null, createdAt = account.CreatedAt }
  };

  private static async Task GetSession(HttpContext ctx, IAccountUseCases useCases, IAccountStore accounts)
  {
    IssueCsrf(ctx);
    NoStore(ctx);
    var current = await Current(ctx, useCases, accounts);
    await ctx.Response.WriteAsJsonAsync(SessionBody(current?.Account), JsonOptions, ctx.RequestAborted);
  }
  private static string AddressKey(string address) => Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(address.Trim().ToUpperInvariant())));

  private static bool ValidEmail(string value) => value.Length <= 254 && System.Net.Mail.MailAddress.TryCreate(value, out var address) && address.Address == value;

  private static async Task<bool> EmailAllowed(HttpContext ctx, AccountRateCounter rates, IAccountSecurityCounters counters, IClock clock, string address)
  {
    var ip = ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    var digest = AddressKey(address);
    var allowedIp = rates.Allow("auth-email-ip:" + ip, clock.UtcNow, 5, TimeSpan.FromMinutes(10));
    var allowedAddress = await counters.TryAcquireEmailAsync(digest, clock.UtcNow, ctx.RequestAborted);
    if (!allowedIp || !allowedAddress) ctx.Response.Headers.RetryAfter = !allowedAddress ? "3600" : "600";
    return allowedIp && allowedAddress;
  }
  private static async Task SignUp(HttpContext ctx, IAccountUseCases useCases, IClock clock, AccountRateCounter rates, IAccountSecurityCounters counters)
  {
    if (!await CheckPost(ctx)) return;
    var body = await Body(ctx, "email", "password"); if (body is null) return;
    var password = Field(body, "password"); var emailAddress = Field(body, "email");
    var validation = PasswordPolicy.Validate(password);
    if (validation is not null) { await ValidationProblem(ctx, "/password", validation); return; }
    if (!ValidEmail(emailAddress)) { await ValidationProblem(ctx, "/email", "invalid_format"); return; }
    if (!await EmailAllowed(ctx, rates, counters, clock, emailAddress)) { await Problem(ctx, 429, "rate_limited"); return; }
    await useCases.SignUpAsync(emailAddress, password, ctx.RequestAborted);
    ctx.Response.StatusCode = 202;
  }
  private static async Task VerifyEmail(HttpContext ctx, IAccountUseCases useCases)
  {
    if (!await CheckPost(ctx)) return;
    var body = await Body(ctx, "token"); if (body is null) return;
    if (!await useCases.VerifyEmailAsync(Field(body, "token"), ctx.RequestAborted)) { await Problem(ctx, 400, "token_invalid"); return; }
    ctx.Response.StatusCode = 204;
  }
  private static async Task Resend(HttpContext ctx, IAccountUseCases useCases, IClock clock, AccountRateCounter rates, IAccountSecurityCounters counters)
  {
    if (!await CheckPost(ctx)) return; var body = await Body(ctx, "email"); if (body is null) return;
    if (!ValidEmail(Field(body, "email"))) { await ValidationProblem(ctx, "/email", "invalid_format"); return; }
    if (!await EmailAllowed(ctx, rates, counters, clock, Field(body, "email"))) { await Problem(ctx, 429, "rate_limited"); return; }
    await useCases.ResendVerificationAsync(Field(body, "email"), ctx.RequestAborted);
    ctx.Response.StatusCode = 202;
  }
  private static async Task Login(HttpContext ctx, IAccountUseCases useCases, IAccountStore accounts, IClock clock, AccountRateCounter rates, IAccountSecurityCounters counters)
  {
    if (!await CheckPost(ctx)) return; var body = await Body(ctx, "email", "password"); if (body is null) return;
    var passwordLength = Field(body, "password").EnumerateRunes().Count();
    if (passwordLength is < 1 or > 128) { await ValidationProblem(ctx, "/password", "invalid_length"); return; }
    if (!ValidEmail(Field(body, "email"))) { await ValidationProblem(ctx, "/email", "invalid_format"); return; }
    if (!rates.Allow("auth-login:" + (ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown"), clock.UtcNow, 10, TimeSpan.FromMinutes(1))) { ctx.Response.Headers.RetryAfter = "60"; await Problem(ctx, 429, "rate_limited"); return; }
    var accountKey = AddressKey(Field(body, "email"));
    if (await counters.GetLoginDelayAsync(accountKey, clock.UtcNow, ctx.RequestAborted) is TimeSpan delay)
    { ctx.Response.Headers.RetryAfter = Math.Ceiling(delay.TotalSeconds).ToString(System.Globalization.CultureInfo.InvariantCulture); await Problem(ctx, 429, "rate_limited"); return; }
    var session = await useCases.LoginAsync(Field(body, "email"), Field(body, "password"), ctx.RequestAborted);
    await counters.RecordLoginResultAsync(accountKey, session is not null, clock.UtcNow, ctx.RequestAborted);
    if (session is null) { await Problem(ctx, 401, "invalid_credentials"); return; }
    if (SessionId(ctx) is Guid oldSession) await useCases.LogoutAsync(oldSession, ctx.RequestAborted);
    var principal = AccountCookieTicketStore.Principal(session.Id, session.AccountId);
    await ctx.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, principal, new AuthenticationProperties
    { IssuedUtc = session.CreatedAt, ExpiresUtc = session.ExpiresAt, IsPersistent = true, AllowRefresh = true });
    ctx.User = principal;
    IssueCsrf(ctx);
    var account = await accounts.FindByIdAsync(session.AccountId, ctx.RequestAborted);
    NoStore(ctx); await ctx.Response.WriteAsJsonAsync(SessionBody(account), JsonOptions, ctx.RequestAborted);
  }
  private static async Task Logout(HttpContext ctx, IAccountUseCases useCases)
  {
    if (!await CheckCsrf(ctx)) return;
    if (SessionId(ctx) is not Guid id) { await Problem(ctx, 401, "unauthenticated"); return; }
    await useCases.LogoutAsync(id, ctx.RequestAborted);
    await ctx.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
    ctx.User = new System.Security.Claims.ClaimsPrincipal(new System.Security.Claims.ClaimsIdentity());
    IssueCsrf(ctx); ctx.Response.StatusCode = 204;
  }
  private static async Task ResetRequest(HttpContext ctx, IAccountUseCases useCases, IClock clock, AccountRateCounter rates, IAccountSecurityCounters counters)
  {
    if (!await CheckPost(ctx)) return; var body = await Body(ctx, "email"); if (body is null) return;
    if (!ValidEmail(Field(body, "email"))) { await ValidationProblem(ctx, "/email", "invalid_format"); return; }
    if (!await EmailAllowed(ctx, rates, counters, clock, Field(body, "email"))) { await Problem(ctx, 429, "rate_limited"); return; }
    await useCases.RequestPasswordResetAsync(Field(body, "email"), ctx.RequestAborted);
    ctx.Response.StatusCode = 202;
  }
  private static async Task ResetConfirm(HttpContext ctx, IAccountUseCases useCases)
  {
    if (!await CheckPost(ctx)) return; var body = await Body(ctx, "token", "newPassword"); if (body is null) return;
    if (PasswordPolicy.Validate(Field(body, "newPassword")) is string policyCode) { await ValidationProblem(ctx, "/newPassword", policyCode); return; }
    if (!await useCases.ConfirmPasswordResetAsync(Field(body, "token"), Field(body, "newPassword"), ctx.RequestAborted)) { await Problem(ctx, 400, "token_invalid"); return; }
    ctx.Response.StatusCode = 204;
  }
  private static async Task Reauthenticate(HttpContext ctx, IAccountUseCases useCases, IAccountStore accounts, IClock clock, AccountRateCounter rates, IAccountSecurityCounters counters)
  {
    if (!await CheckCsrf(ctx)) return;
    if (await Current(ctx, useCases, accounts) is not { } current) { await Problem(ctx, 401, "unauthenticated"); return; }
    if (!await CheckPost(ctx)) return; var body = await Body(ctx, "password"); if (body is null) return;
    var passwordLength = Field(body, "password").EnumerateRunes().Count();
    if (passwordLength is < 1 or > 128) { await ValidationProblem(ctx, "/password", "invalid_length"); return; }
    var key = AddressKey(current.Account.Email);
    if (!rates.Allow("auth-login:" + (ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown"), clock.UtcNow, 10, TimeSpan.FromMinutes(1)) || await counters.GetLoginDelayAsync(key, clock.UtcNow, ctx.RequestAborted) is not null)
    { ctx.Response.Headers.RetryAfter = "60"; await Problem(ctx, 429, "rate_limited"); return; }
    var succeeded = await useCases.ReauthenticateAsync(current.Session.Id, Field(body, "password"), ctx.RequestAborted);
    await counters.RecordLoginResultAsync(key, succeeded, clock.UtcNow, ctx.RequestAborted);
    if (!succeeded) { await Problem(ctx, 403, "reauthentication_failed"); return; }
    ctx.Response.StatusCode = 204;
  }
  private static async Task ChangePassword(HttpContext ctx, IAccountUseCases useCases, IAccountStore accounts)
  {
    if (await Current(ctx, useCases, accounts) is not { } current) { await Problem(ctx, 401, "unauthenticated"); return; }
    if (!await CheckPost(ctx)) return; var body = await Body(ctx, "newPassword"); if (body is null) return;
    if (PasswordPolicy.Validate(Field(body, "newPassword")) is string policyCode) { await ValidationProblem(ctx, "/newPassword", policyCode); return; }
    if (!await useCases.ChangePasswordAsync(current.Session.Id, Field(body, "newPassword"), ctx.RequestAborted)) { await Problem(ctx, 401, "reauthentication_required"); return; }
    await ctx.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
    ctx.User = new System.Security.Claims.ClaimsPrincipal(new System.Security.Claims.ClaimsIdentity());
    IssueCsrf(ctx); ctx.Response.StatusCode = 204;
  }
  private static async Task Delete(HttpContext ctx, IAccountUseCases useCases, IAccountStore accounts, IClock clock)
  {
    if (await Current(ctx, useCases, accounts) is not { } current) { await Problem(ctx, 401, "unauthenticated"); return; }
    if (!await CheckCsrf(ctx)) return;
    if (!await useCases.RequestDeletionAsync(current.Session.Id, ctx.RequestAborted)) { await Problem(ctx, 401, "reauthentication_required"); return; }
    await ctx.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme); ctx.Response.StatusCode = 202;
  }
  private static async Task Export(HttpContext ctx, IAccountUseCases useCases, IAccountStore accounts, IClock clock, AccountRateCounter rates, IAccountSecurityCounters counters)
  {
    if (await Current(ctx, useCases, accounts) is not { } current) { await Problem(ctx, 401, "unauthenticated"); return; }
    if (current.Account.EmailVerifiedAt is null) { await Problem(ctx, 403, "email_not_verified"); return; }
    if (current.Session.ReauthenticatedAt is not DateTimeOffset at || at < clock.UtcNow.AddMinutes(-5) || at > clock.UtcNow) { await Problem(ctx, 401, "reauthentication_required"); return; }
    if (!rates.Allow("data-export:" + current.Account.Id.ToString("N"), clock.UtcNow, 3, TimeSpan.FromHours(1))) { ctx.Response.Headers.RetryAfter = "3600"; await Problem(ctx, 429, "rate_limited"); return; }
    NoStore(ctx);
    var resumes = new List<JsonElement>();
    foreach (var source in ctx.RequestServices.GetServices<IAccountResumeExportSource>()) resumes.AddRange(await source.ReadForOwnerAsync(current.Account.Id, ctx.RequestAborted));
    await ctx.Response.WriteAsJsonAsync(new { exportedAt = clock.UtcNow, account = new { id = current.Account.Id, email = current.Account.Email, createdAt = current.Account.CreatedAt, emailVerifiedAt = current.Account.EmailVerifiedAt }, resumes }, JsonOptions, ctx.RequestAborted);
  }
}

internal sealed class AccountRateCounter
{
  private readonly System.Collections.Concurrent.ConcurrentDictionary<string, (DateTimeOffset Start, int Count)> counts = new();
  public bool Allow(string key, DateTimeOffset now, int limit, TimeSpan window)
  {
    foreach (var pair in counts) if (now - pair.Value.Start > TimeSpan.FromHours(1)) counts.TryRemove(pair.Key, out _);
    var current = counts.AddOrUpdate(key, (now, 1), (_, old) => now - old.Start >= window ? (now, 1) : (old.Start, old.Count + 1));
    return current.Count <= limit;
  }
}
