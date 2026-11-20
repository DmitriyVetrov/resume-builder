using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using ResumeBuilder.Application.Accounts;
using ResumeBuilder.Infrastructure;
using Xunit;

namespace ResumeBuilder.Api.Tests;

public sealed class P06FixtureTests
{
  private sealed class MemoryAccountStores : IAccountStore, IAccountTokenStore, ISessionStore, IEmailOutboxStore
  {
    private readonly object gate = new();
    private readonly Dictionary<Guid, AccountRecord> accounts = [];
    private readonly Dictionary<Guid, AccountTokenRecord> tokens = [];
    private readonly Dictionary<Guid, AccountSessionRecord> sessions = [];
    private readonly Dictionary<Guid, AccountOutboxRecord> outbox = [];
    public Task<bool> TryCreateAsync(AccountRecord account, CancellationToken ct) { lock (gate) { if (accounts.Values.Any(a => a.NormalizedEmail == account.NormalizedEmail)) return Task.FromResult(false); accounts.Add(account.Id, account); return Task.FromResult(true); } }
    public Task<AccountRecord?> FindByNormalizedEmailAsync(string email, CancellationToken ct) { lock (gate) return Task.FromResult(accounts.Values.SingleOrDefault(a => a.NormalizedEmail == email)); }
    public Task<AccountRecord?> FindByIdAsync(Guid id, CancellationToken ct) { lock (gate) return Task.FromResult(accounts.GetValueOrDefault(id)); }
    public Task<bool> TryVerifyEmailAsync(Guid id, DateTimeOffset at, CancellationToken ct) { lock (gate) { if (!accounts.TryGetValue(id, out var a) || a.EmailVerifiedAt != null) return Task.FromResult(false); accounts[id] = a with { EmailVerifiedAt = at }; return Task.FromResult(true); } }
    public Task<bool> TrySetPasswordHashAsync(Guid id, string hash, CancellationToken ct) { lock (gate) { if (!accounts.TryGetValue(id, out var a)) return Task.FromResult(false); accounts[id] = a with { PasswordHash = hash }; return Task.FromResult(true); } }
    public Task<bool> TryCompareExchangePasswordHashAsync(Guid id, string expected, string replacement, CancellationToken ct) { lock (gate) { if (!accounts.TryGetValue(id, out var a) || a.DeletionRequestedAt != null || !string.Equals(a.PasswordHash, expected, StringComparison.Ordinal)) return Task.FromResult(false); accounts[id] = a with { PasswordHash = replacement }; return Task.FromResult(true); } }
    public Task<bool> TryMarkDeletionRequestedAsync(Guid id, DateTimeOffset at, CancellationToken ct) { lock (gate) { if (!accounts.TryGetValue(id, out var a) || a.DeletionRequestedAt != null) return Task.FromResult(false); accounts[id] = a with { DeletionRequestedAt = at }; return Task.FromResult(true); } }
    public Task<IReadOnlyList<AccountRecord>> ListDeletionDueAsync(DateTimeOffset before, int limit, CancellationToken ct) { lock (gate) return Task.FromResult<IReadOnlyList<AccountRecord>>(accounts.Values.Where(a => a.DeletionRequestedAt <= before).OrderBy(a => a.DeletionRequestedAt).Take(limit).ToArray()); }
    public Task DeleteAsync(Guid id, CancellationToken ct) { lock (gate) accounts.Remove(id); return Task.CompletedTask; }
    public Task ReplaceActiveAsync(AccountTokenRecord token, CancellationToken ct) { lock (gate) { foreach (var id in tokens.Values.Where(t => t.AccountId == token.AccountId && t.Purpose == token.Purpose).Select(t => t.Id).ToArray()) tokens.Remove(id); tokens[token.Id] = token; } return Task.CompletedTask; }
    public Task<Guid?> TryConsumeAsync(byte[] hash, AccountTokenPurpose purpose, DateTimeOffset now, CancellationToken ct) { lock (gate) { var match = tokens.Values.SingleOrDefault(t => t.Purpose == purpose && t.UsedAt == null && t.ExpiresAt > now && System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(t.TokenHash, hash)); if (match == null) return Task.FromResult<Guid?>(null); tokens[match.Id] = match with { UsedAt = now }; return Task.FromResult<Guid?>(match.AccountId); } }
    public Task DeleteForAccountAndPurposeAsync(Guid id, AccountTokenPurpose purpose, CancellationToken ct) { lock (gate) { foreach (var key in tokens.Values.Where(t => t.AccountId == id && t.Purpose == purpose).Select(t => t.Id).ToArray()) tokens.Remove(key); } return Task.CompletedTask; }
    public Task DeleteForAccountAsync(Guid id, CancellationToken ct) { lock (gate) { foreach (var key in tokens.Values.Where(t => t.AccountId == id).Select(t => t.Id).ToArray()) tokens.Remove(key); foreach (var key in sessions.Values.Where(s => s.AccountId == id).Select(s => s.Id).ToArray()) sessions.Remove(key); foreach (var key in outbox.Values.Where(o => o.AccountId == id).Select(o => o.Id).ToArray()) outbox.Remove(key); } return Task.CompletedTask; }
    /// <summary>One-shot checkpoint used by the DD-P06-15 HTTP race case; null for every other test.</summary>
    public Func<Task>? BeforeSessionInsert { get; set; }
    public async Task CreateAsync(AccountSessionRecord session, CancellationToken ct)
    {
      var hook = BeforeSessionInsert;
      if (hook is not null) { BeforeSessionInsert = null; await hook(); }
      lock (gate) sessions[session.Id] = session;
    }
    public Task<AccountSessionRecord?> FindActiveAsync(Guid id, DateTimeOffset now, CancellationToken ct) { lock (gate) return Task.FromResult(sessions.GetValueOrDefault(id) is { } s && s.ExpiresAt > now && s.AbsoluteExpiresAt > now ? s : null); }
    public Task<bool> RenewAsync(Guid id, DateTimeOffset seen, DateTimeOffset expires, CancellationToken ct) { lock (gate) { if (!sessions.TryGetValue(id, out var s)) return Task.FromResult(false); sessions[id] = s with { LastSeenAt = seen, ExpiresAt = expires }; return Task.FromResult(true); } }
    public Task<bool> StampReauthenticatedAsync(Guid id, DateTimeOffset at, CancellationToken ct) { lock (gate) { if (!sessions.TryGetValue(id, out var s)) return Task.FromResult(false); sessions[id] = s with { ReauthenticatedAt = at }; return Task.FromResult(true); } }
    public Task RevokeAsync(Guid id, CancellationToken ct) { lock (gate) sessions.Remove(id); return Task.CompletedTask; }
    public Task RevokeAllForAccountAsync(Guid id, CancellationToken ct) { lock (gate) foreach (var key in sessions.Values.Where(s => s.AccountId == id).Select(s => s.Id).ToArray()) sessions.Remove(key); return Task.CompletedTask; }
    public Task EnqueueAsync(AccountOutboxRecord message, CancellationToken ct) { lock (gate) outbox[message.Id] = message; return Task.CompletedTask; }
    public Task<AccountOutboxRecord?> TryClaimNextAsync(DateTimeOffset now, TimeSpan lease, CancellationToken ct) { lock (gate) { var item = outbox.Values.Where(o => o.SentAt == null && (o.ClaimedUntil == null || o.ClaimedUntil <= now) && (o.NextAttemptAt == null || o.NextAttemptAt <= now)).OrderBy(o => o.CreatedAt).FirstOrDefault(); if (item == null) return Task.FromResult<AccountOutboxRecord?>(null); var claimed = item with { ClaimedUntil = now + lease }; outbox[item.Id] = claimed; return Task.FromResult<AccountOutboxRecord?>(claimed); } }
    public Task MarkSentAndClearBodyAsync(Guid id, DateTimeOffset at, CancellationToken ct) { lock (gate) if (outbox.TryGetValue(id, out var item)) outbox[id] = item with { SentAt = at, Body = null, ClaimedUntil = null }; return Task.CompletedTask; }
    public Task ReleaseClaimAsync(Guid id, int attempts, DateTimeOffset nextAttemptAt, CancellationToken ct) { lock (gate) if (outbox.TryGetValue(id, out var item)) outbox[id] = item with { ClaimedUntil = null, Attempts = attempts, NextAttemptAt = nextAttemptAt }; return Task.CompletedTask; }
  }
  private sealed class Clock : IClock
  {
    public DateTimeOffset UtcNow { get; set; } = new(2026, 11, 3, 12, 0, 0, TimeSpan.Zero);
  }
  private sealed class EmailSink : IEmailSink
  {
    public List<AccountEmail> Messages { get; } = [];
    public bool FailDeletionNotice { get; set; }
    /// <summary>Recipient whose delivery always fails, for the head-of-line blocking case.</summary>
    public string? PermanentlyFailingRecipient { get; set; }
    public Task SendAsync(AccountEmail message, CancellationToken cancellationToken)
    {
      if (FailDeletionNotice && message.Subject == "Account deletion requested") throw new IOException("synthetic mail outage");
      if (PermanentlyFailingRecipient is { } blocked && message.RecipientAddress == blocked) throw new IOException("synthetic permanent rejection");
      Messages.Add(message); return Task.CompletedTask;
    }
  }
  private sealed class Ledger : IAccountDeletionLedger
  {
    public List<Guid> Recorded { get; } = [];
    public bool Fail { get; set; }
    public Task RecordAccountAsync(Guid userId, DateTimeOffset recordedAt, CancellationToken cancellationToken)
    {
      if (Fail) throw new IOException("synthetic ledger failure");
      Recorded.Add(userId);
      return Task.CompletedTask;
    }
  }
  private sealed class Fixture : WebApplicationFactory<Program>
  {
    public Clock Time { get; } = new();
    public EmailSink Email { get; } = new();
    public Ledger DeletionLedger { get; } = new();
    public LoggingTests.CaptureProvider Logs { get; } = new();
    public MemoryAccountStores Stores { get; } = new();
    private MemoryAccountStores stores => Stores;
    protected override void ConfigureWebHost(Microsoft.AspNetCore.Hosting.IWebHostBuilder builder)
    {
      builder.UseSetting("Mongo:ConnectionString", "mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=500");
      builder.UseSetting("Accounts:AllowInsecureCookies", "true");
      builder.UseSetting("Accounts:DeletionWorker:Enabled", "false");
      builder.UseSetting("Accounts:EmailWorker:Enabled", "false");
      builder.ConfigureLogging(logging => logging.AddProvider(Logs));
      builder.ConfigureTestServices(services =>
      {
        services.RemoveAll<IClock>(); services.AddSingleton<IClock>(Time);
        services.RemoveAll<IEmailSink>(); services.AddSingleton<IEmailSink>(Email);
        var counters = typeof(IAccountStore).Assembly.GetType("ResumeBuilder.Application.Accounts.IAccountSecurityCounters");
        var memoryCounters = System.Reflection.Assembly.Load("ResumeBuilder.Infrastructure").GetType("ResumeBuilder.Infrastructure.MemoryAccountSecurityCounters");
        if (counters is not null && memoryCounters is not null) { services.RemoveAll(counters); services.AddSingleton(counters, memoryCounters); }
        services.RemoveAll<IAccountDeletionLedger>(); services.AddSingleton<IAccountDeletionLedger>(DeletionLedger);
        services.RemoveAll<IAccountStore>(); services.AddSingleton<IAccountStore>(stores);
        services.RemoveAll<IAccountTokenStore>(); services.AddSingleton<IAccountTokenStore>(stores);
        services.RemoveAll<ISessionStore>(); services.AddSingleton<ISessionStore>(stores);
        services.RemoveAll<IEmailOutboxStore>(); services.AddSingleton<IEmailOutboxStore>(stores);
        // DD-P07-16: these memory stores hold no resume data, and the real purger would reach the unreachable Mongo address.
        services.RemoveAll<IAccountOwnedDataPurger>();
        services.RemoveAll<IAccountResumeExportSource>();
      });
    }
  }
  private static async Task<string> Csrf(HttpClient client)
  {
    using var response = await client.GetAsync("/api/v1/session", TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    return CsrfCookie(response);
  }
  private static async Task Dispatch(Fixture host)
  {
    var dispatcherType = typeof(IAccountStore).Assembly.GetType("ResumeBuilder.Application.Accounts.IAccountEmailDispatcher");
    Assert.NotNull(dispatcherType);
    var dispatcher = host.Services.GetRequiredService(dispatcherType);
    var operation = dispatcherType.GetMethod("DispatchAvailableAsync");
    Assert.NotNull(operation);
    await (Task)operation.Invoke(dispatcher, [TestContext.Current.CancellationToken])!;
  }
  private static string CsrfCookie(HttpResponseMessage response)
  {
    var cookie = response.Headers.GetValues("Set-Cookie").Single(value => value.StartsWith("XSRF-TOKEN=", StringComparison.Ordinal));
    return cookie.Split(';')[0].Split('=')[1];
  }
  /// <summary>
  /// DD-P06-15 at the HTTP boundary: a login that loses to a concurrent password reset must look exactly like any
  /// other rejected credential -- 401 invalid_credentials, no session cookie, no concurrency-specific error code.
  /// </summary>
  [Fact]
  public async Task P06LoginThatLosesToAConcurrentResetAnswersPlainInvalidCredentials()
  {
    using var host = new Fixture(); using var client = host.CreateClient();
    const string email = "person-a@example.invalid";
    const string password = "valid-password-123";
    const string replacement = "different-valid-password-456";
    var (csrf, _) = await SignUpVerifyAndLogin(host, client, email, password);

    using var resetRequest = Post("/api/v1/auth/password-reset/request", new { email }, csrf);
    using var resetRequested = await client.SendAsync(resetRequest, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.Accepted, resetRequested.StatusCode);
    await Dispatch(host);
    var resetMail = host.Email.Messages.Last(message => message.Subject == "Reset password");
    var resetToken = System.Text.RegularExpressions.Regex.Match(resetMail.Body, @"(?:#t=|#token=)([^\s&]+)").Groups[1].Value;
    Assert.NotEmpty(resetToken);

    var reached = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
    var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
    host.Stores.BeforeSessionInsert = () => { reached.TrySetResult(); return release.Task; };

    var anonymousCsrf = await Csrf(client);
    using var login = Post("/api/v1/auth/login", new { email, password }, anonymousCsrf);
    var loggingIn = client.SendAsync(login, TestContext.Current.CancellationToken);
    await reached.Task.WaitAsync(TimeSpan.FromSeconds(10), TestContext.Current.CancellationToken);

    using var confirm = Post("/api/v1/auth/password-reset/confirm", new { token = resetToken, newPassword = replacement }, anonymousCsrf);
    using var confirmed = await client.SendAsync(confirm, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.NoContent, confirmed.StatusCode);
    release.SetResult();

    using var rejected = await loggingIn.WaitAsync(TimeSpan.FromSeconds(10), TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.Unauthorized, rejected.StatusCode);
    var body = await rejected.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
    Assert.Contains("invalid_credentials", body, StringComparison.Ordinal);
    Assert.DoesNotContain("concurren", body, StringComparison.OrdinalIgnoreCase);
    Assert.DoesNotContain("reset", body, StringComparison.OrdinalIgnoreCase);
    Assert.DoesNotContain("__Host-rb_session=", string.Join(";",
      rejected.Headers.TryGetValues("Set-Cookie", out var cookies) ? cookies : []), StringComparison.Ordinal);
  }

  /// <summary>Reads one outbox row back by claiming it far in the future and releasing it unchanged.</summary>
  private static async Task<AccountOutboxRecord> ClaimableOutbox(Fixture host, Guid messageId)
  {
    var outbox = host.Services.GetRequiredService<IEmailOutboxStore>();
    var probeAt = DateTimeOffset.MaxValue.AddYears(-1);
    var claimed = await outbox.TryClaimNextAsync(probeAt, TimeSpan.Zero, TestContext.Current.CancellationToken);
    Assert.NotNull(claimed);
    Assert.Equal(messageId, claimed.Id);
    await outbox.ReleaseClaimAsync(claimed.Id, claimed.Attempts, claimed.NextAttemptAt ?? probeAt, TestContext.Current.CancellationToken);
    return claimed;
  }

  /// <summary>A purger that fails for a chosen set of accounts, to model a persistently failing batch.</summary>
  private sealed class SelectivelyFailingPurger(ISet<Guid> failing) : IAccountOwnedDataPurger
  {
    public Task PurgeAsync(Guid accountId, CancellationToken cancellationToken) =>
      failing.Contains(accountId) ? throw new IOException("synthetic purge outage") : Task.CompletedTask;
  }

  /// <summary>
  /// External review, major: the deletion run took one unordered batch of 100, so a batch of accounts that
  /// keep failing could be re-selected on every pass and starve everything behind them past the 24 h bound
  /// of FR-ACC-03.
  /// </summary>
  [Fact]
  public async Task P06DeletionBacklogBeyondOneBatchStillPurgesTheAccountsBehindAFailingBatch()
  {
    var stores = new MemoryAccountStores();
    var clock = new Clock();
    var ct = TestContext.Current.CancellationToken;
    var now = clock.UtcNow;
    var ordered = new List<Guid>();
    var failing = new HashSet<Guid>();
    for (var i = 0; i < 150; i++)
    {
      var id = Guid.NewGuid();
      ordered.Add(id);
      Assert.True(await stores.TryCreateAsync(new AccountRecord(id, $"person-{i}@example.invalid",
        $"PERSON-{i}@EXAMPLE.INVALID", "synthetic-hash", now.AddDays(-3), now.AddDays(-3), null), ct));
      // Oldest request first, so the failing accounts are the ones an ordered scan reaches first.
      Assert.True(await stores.TryMarkDeletionRequestedAsync(id, now.AddMinutes(i - 200), ct));
      if (i < 120) failing.Add(id);
    }
    var processor = new AccountDeletionProcessor(stores, stores, stores, stores, new Ledger(),
      [new SelectivelyFailingPurger(failing)], clock, new EmailSink());

    await Assert.ThrowsAsync<InvalidOperationException>(() => processor.ProcessDueAsync(ct));

    foreach (var id in ordered.Skip(120))
      Assert.Null(await stores.FindByIdAsync(id, ct));
    foreach (var id in failing)
      Assert.NotNull(await stores.FindByIdAsync(id, ct));
  }

  [Fact]
  public async Task P06DeletionDueListReturnsTheOldestRequestsFirst()
  {
    var stores = new MemoryAccountStores();
    var clock = new Clock();
    var ct = TestContext.Current.CancellationToken;
    var now = clock.UtcNow;
    var byAge = new List<Guid>();
    foreach (var minutes in new[] { -10, -300, -120, -45 })
    {
      var id = Guid.NewGuid();
      Assert.True(await stores.TryCreateAsync(new AccountRecord(id, $"person{minutes}@example.invalid",
        $"PERSON{minutes}@EXAMPLE.INVALID", "synthetic-hash", now.AddDays(-3), now.AddDays(-3), null), ct));
      Assert.True(await stores.TryMarkDeletionRequestedAsync(id, now.AddMinutes(minutes), ct));
      byAge.Add(id);
    }
    var due = await stores.ListDeletionDueAsync(now, 10, ct);
    Assert.Equal(new[] { byAge[1], byAge[2], byAge[3], byAge[0] }, due.Select(a => a.Id).ToArray());
  }

  /// <summary>
  /// External review, major: a message the sink permanently rejects released its claim and rethrew, ending the
  /// pass. With no attempt counter or backoff it was immediately eligible again and could keep later
  /// verification and reset mail from ever being delivered.
  /// </summary>
  [Fact]
  public async Task P06PermanentlyFailingOutboxMessageDoesNotBlockLaterMail()
  {
    using var host = new Fixture();
    var ct = TestContext.Current.CancellationToken;
    var outbox = host.Services.GetRequiredService<IEmailOutboxStore>();
    host.Email.PermanentlyFailingRecipient = "blocked@example.invalid";
    var blocked = Guid.NewGuid();
    await outbox.EnqueueAsync(new AccountOutboxRecord(blocked, Guid.NewGuid(), "blocked@example.invalid",
      "Verify email", "synthetic-token-1", host.Time.UtcNow.AddMinutes(-5), null, null), ct);
    foreach (var i in new[] { 1, 2 })
      await outbox.EnqueueAsync(new AccountOutboxRecord(Guid.NewGuid(), Guid.NewGuid(), $"person-{i}@example.invalid",
        "Verify email", $"synthetic-token-later-{i}", host.Time.UtcNow.AddMinutes(-4 + i), null, null), ct);

    await Dispatch(host);

    Assert.Equal(2, host.Email.Messages.Count);
    Assert.DoesNotContain(host.Email.Messages, message => message.RecipientAddress == "blocked@example.invalid");
    Assert.Contains(host.Email.Messages, message => message.RecipientAddress == "person-1@example.invalid");
    Assert.Contains(host.Email.Messages, message => message.RecipientAddress == "person-2@example.invalid");

    // One attempt has been made and the message is deferred, not retried in a tight loop.
    var claimed = await ClaimableOutbox(host, blocked);
    Assert.Equal(1, claimed.Attempts);
    Assert.Equal(AccountOutboxPolicy.NextAttemptAt(host.Time.UtcNow, 1), claimed.NextAttemptAt);

    // Each later failure pushes it further out; the fast-retry window is exactly FastRetryAttempts long.
    for (var attempt = 2; attempt <= AccountOutboxPolicy.FastRetryAttempts; attempt++)
    {
      host.Time.UtcNow = host.Time.UtcNow.AddHours(1);
      await Dispatch(host);
      claimed = await ClaimableOutbox(host, blocked);
      Assert.Equal(attempt, claimed.Attempts);
      // Inside the fast-retry window the next attempt is minutes away, not the long deferral.
      var wait = claimed.NextAttemptAt!.Value - host.Time.UtcNow;
      if (attempt < AccountOutboxPolicy.FastRetryAttempts) Assert.True(wait < TimeSpan.FromHours(1), $"attempt {attempt} waited {wait}");
      else Assert.Equal(AccountOutboxPolicy.LongDeferral, wait);
    }
    Assert.True(AccountOutboxPolicy.IsDeferredLong(claimed.Attempts));
    var longDeferralUntil = claimed.NextAttemptAt;
    Assert.Equal(host.Time.UtcNow + AccountOutboxPolicy.LongDeferral, longDeferralUntil);

    // Just inside the deferral it is not claimed again; just past it, it is -- the deferral is long, not terminal.
    host.Time.UtcNow = longDeferralUntil!.Value.AddMinutes(-1);
    await Dispatch(host);
    Assert.Equal(AccountOutboxPolicy.FastRetryAttempts, (await ClaimableOutbox(host, blocked)).Attempts);
    host.Time.UtcNow = longDeferralUntil.Value.AddMinutes(1);
    await Dispatch(host);
    Assert.Equal(AccountOutboxPolicy.FastRetryAttempts + 1, (await ClaimableOutbox(host, blocked)).Attempts);

    Assert.DoesNotContain(host.Email.Messages, message => message.RecipientAddress == "blocked@example.invalid");
    Assert.Equal(2, host.Email.Messages.Count);

    host.Email.PermanentlyFailingRecipient = null;
    host.Time.UtcNow = host.Time.UtcNow.AddHours(1);
    var fresh = Guid.NewGuid();
    await outbox.EnqueueAsync(new AccountOutboxRecord(fresh, Guid.NewGuid(), "person-3@example.invalid",
      "Verify email", "synthetic-token-3", host.Time.UtcNow, null, null), ct);
    await Dispatch(host);
    Assert.Contains(host.Email.Messages, message => message.RecipientAddress == "person-3@example.invalid");
  }

  private static HttpRequestMessage Post(string path, object body, string csrf)
  {
    var request = new HttpRequestMessage(HttpMethod.Post, path) { Content = JsonContent.Create(body) };
    request.Headers.Add("X-XSRF-TOKEN", csrf);
    return request;
  }
  private static async Task<(string Csrf, string SessionCookie)> SignUpVerifyAndLogin(Fixture host, HttpClient client, string email, string password)
  {
    var csrf = await Csrf(client);
    using var signUp = Post("/api/v1/auth/sign-up", new { email, password }, csrf);
    using var signedUp = await client.SendAsync(signUp, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.Accepted, signedUp.StatusCode);
    await Dispatch(host);
    var message = Assert.Single(host.Email.Messages, item => item.RecipientAddress == email && item.Subject == "Verify email");
    var token = System.Text.RegularExpressions.Regex.Match(message.Body, @"(?:#t=|#token=)([^\s&]+)").Groups[1].Value;
    Assert.NotEmpty(token);
    using var verify = Post("/api/v1/auth/verify-email", new { token }, csrf);
    using var verified = await client.SendAsync(verify, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.NoContent, verified.StatusCode);
    using var login = Post("/api/v1/auth/login", new { email, password }, csrf);
    using var loggedIn = await client.SendAsync(login, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.OK, loggedIn.StatusCode);
    return (CsrfCookie(loggedIn), loggedIn.Headers.GetValues("Set-Cookie")
      .Single(value => value.StartsWith("__Host-rb_session=", StringComparison.Ordinal)).Split(';')[0]);
  }
  [Fact]
  public async Task P06SignupWithCsrfQueuesVerificationWithoutSession()
  {
    using var host = new Fixture(); using var client = host.CreateClient();
    var csrf = await Csrf(client);
    using var request = Post("/api/v1/auth/sign-up", new { email = "person-a@example.invalid", password = "correct horse battery staple" }, csrf);
    using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
    await Dispatch(host);
    Assert.Single(host.Email.Messages);
    using var session = await client.GetAsync("/api/v1/session", TestContext.Current.CancellationToken);
    Assert.Contains("\"authenticated\":false", await session.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
  }
  [Fact]
  public async Task P06UnknownSignupIsSameBodylessAcceptance()
  {
    using var host = new Fixture(); using var client = host.CreateClient();
    var csrf = await Csrf(client);
    using var first = Post("/api/v1/auth/sign-up", new { email = "person-a@example.invalid", password = "correct horse battery staple" }, csrf);
    using var firstResponse = await client.SendAsync(first, TestContext.Current.CancellationToken);
    using var repeat = Post("/api/v1/auth/sign-up", new { email = "PERSON-A@example.invalid", password = "correct horse battery staple" }, csrf);
    using var repeatResponse = await client.SendAsync(repeat, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.Accepted, firstResponse.StatusCode);
    Assert.Equal(firstResponse.StatusCode, repeatResponse.StatusCode);
    Assert.Equal(await firstResponse.Content.ReadAsStringAsync(TestContext.Current.CancellationToken), await repeatResponse.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    await Dispatch(host);
    Assert.Equal(2, host.Email.Messages.Count);
    Assert.Single(host.Email.Messages, message => message.Subject == "Verify email");
    var duplicateNotice = Assert.Single(host.Email.Messages, message => message.Subject.Contains("already exists", StringComparison.OrdinalIgnoreCase));
    Assert.Equal("person-a@example.invalid", duplicateNotice.RecipientAddress);
    Assert.DoesNotContain("#t=", duplicateNotice.Body);
    Assert.DoesNotContain("#token=", duplicateNotice.Body);
  }
  [Theory]
  [InlineData("password", "password_too_short")]
  [InlineData("password123", "password_too_common")]
  public async Task P06PasswordPolicyReturnsContractCode(string password, string code)
  {
    using var host = new Fixture(); using var client = host.CreateClient();
    var csrf = await Csrf(client);
    using var request = Post("/api/v1/auth/sign-up", new { email = "person-a@example.invalid", password }, csrf);
    using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    Assert.Contains(code, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    Assert.Empty(host.Email.Messages);
  }

  [Theory]
  [InlineData("/api/v1/auth/verify-email", false, "token_invalid")]
  [InlineData("/api/v1/auth/password-reset/confirm", true, "token_invalid")]
  public async Task P06UnknownTokensReturnSafeProblem(string path, bool needsPassword, string code)
  {
    using var host = new Fixture(); using var client = host.CreateClient();
    var csrf = await Csrf(client);
    using var request = needsPassword
      ? Post(path, new { token = "synthetic-invalid-token", newPassword = "correct horse battery staple" }, csrf)
      : Post(path, new { token = "synthetic-invalid-token" }, csrf);
    using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
    Assert.True(ContractSchemas.IsValid("Problem", body));
    Assert.Contains(code, body);
    Assert.DoesNotContain("synthetic-invalid-token", body);
  }
  [Theory]
  [InlineData("/api/v1/auth/resend-verification")]
  [InlineData("/api/v1/auth/password-reset/request")]
  public async Task P06UnknownEmailActionsAreGenericAccepted(string path)
  {
    using var host = new Fixture(); using var client = host.CreateClient();
    var csrf = await Csrf(client);
    using var request = Post(path, new { email = "unknown@example.invalid" }, csrf);
    using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
    Assert.Empty(host.Email.Messages);
    Assert.Equal(string.Empty, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
  }
  [Fact]
  public async Task P06UnknownLoginUsesGenericInvalidCredentials()
  {
    using var host = new Fixture(); using var client = host.CreateClient();
    var csrf = await Csrf(client);
    using var request = Post("/api/v1/auth/login", new { email = "unknown@example.invalid", password = "synthetic-password" }, csrf);
    using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
    Assert.Contains("invalid_credentials", body);
    Assert.DoesNotContain("unknown@example.invalid", body);
    Assert.DoesNotContain("synthetic-password", body);
  }
  [Fact]
  public async Task P06AnonymousExportReturnsAuthenticationProblem()
  {
    using var host = new Fixture(); using var client = host.CreateClient();
    using var response = await client.GetAsync("/api/v1/account/data-export", TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    Assert.True(ContractSchemas.IsValid("Problem", await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)));
  }

  [Fact]
  public async Task P06WrongCsrfCannotCreateAccount()
  {
    using var host = new Fixture(); using var client = host.CreateClient();
    _ = await Csrf(client);
    using var request = Post("/api/v1/auth/sign-up", new { email = "person-a@example.invalid", password = "valid-password-123" }, "wrong-csrf");
    using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
    Assert.True(ContractSchemas.IsValid("Problem", body));
    Assert.Contains("csrf_token_invalid", body);
    Assert.Empty(host.Email.Messages);
  }

  [Fact]
  public async Task P06VerificationAndResendRespectSingleUseToken()
  {
    using var host = new Fixture(); using var client = host.CreateClient();
    var csrf = await Csrf(client);
    using var signup = Post("/api/v1/auth/sign-up", new { email = "person-a@example.invalid", password = "valid-password-123" }, csrf);
    using var accepted = await client.SendAsync(signup, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.Accepted, accepted.StatusCode);
    await Dispatch(host);
    Assert.Single(host.Email.Messages);
    // The synthetic mail sink is in memory; no token is written to the test report.
    var token = System.Text.RegularExpressions.Regex.Match(host.Email.Messages[0].Body, @"(?:#t=|#token=)([^\s&]+)").Groups[1].Value;
    Assert.NotEmpty(token);
    using var verify = Post("/api/v1/auth/verify-email", new { token }, csrf);
    using var verified = await client.SendAsync(verify, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.NoContent, verified.StatusCode);
    using var reuse = Post("/api/v1/auth/verify-email", new { token }, csrf);
    using var reused = await client.SendAsync(reuse, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.BadRequest, reused.StatusCode);
    Assert.DoesNotContain(token, await reused.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
  }

  [Fact]
  public async Task P06LoginLogoutRevokesCookieAndProtectsExport()
  {
    using var host = new Fixture(); using var client = host.CreateClient();
    var csrf = await Csrf(client);
    using var signup = Post("/api/v1/auth/sign-up", new { email = "person-a@example.invalid", password = "valid-password-123" }, csrf);
    using var accepted = await client.SendAsync(signup, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.Accepted, accepted.StatusCode);
    using var login = Post("/api/v1/auth/login", new { email = "person-a@example.invalid", password = "valid-password-123" }, csrf);
    using var loggedIn = await client.SendAsync(login, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.OK, loggedIn.StatusCode);
    csrf = CsrfCookie(loggedIn);
    Assert.Contains(loggedIn.Headers.GetValues("Set-Cookie"), cookie => cookie.Contains("HttpOnly", StringComparison.OrdinalIgnoreCase) && cookie.Contains("SameSite=Strict", StringComparison.OrdinalIgnoreCase));
    using var export = await client.GetAsync("/api/v1/account/data-export", TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.Forbidden, export.StatusCode);
    Assert.Contains("email_not_verified", await export.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    using var logout = Post("/api/v1/auth/logout", new { }, csrf);
    using var loggedOut = await client.SendAsync(logout, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.NoContent, loggedOut.StatusCode);
    _ = CsrfCookie(loggedOut);
    using var after = await client.GetAsync("/api/v1/account/data-export", TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.Unauthorized, after.StatusCode);
  }

  [Fact]
  public async Task P06ResetChangesPasswordAndRevokesSessions()
  {
    using var host = new Fixture(); using var client = host.CreateClient();
    var csrf = await Csrf(client);
    using var signup = Post("/api/v1/auth/sign-up", new { email = "person-a@example.invalid", password = "valid-password-123" }, csrf);
    using var accepted = await client.SendAsync(signup, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.Accepted, accepted.StatusCode);
    using var reset = Post("/api/v1/auth/password-reset/request", new { email = "person-a@example.invalid" }, csrf);
    using var requested = await client.SendAsync(reset, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.Accepted, requested.StatusCode);
    await Dispatch(host);
    Assert.True(host.Email.Messages.Count >= 2);
    var token = System.Text.RegularExpressions.Regex.Match(host.Email.Messages[^1].Body, @"(?:#t=|#token=)([^\s&]+)").Groups[1].Value;
    Assert.NotEmpty(token);
    using var confirm = Post("/api/v1/auth/password-reset/confirm", new { token, newPassword = "different-valid-password-456" }, csrf);
    using var confirmed = await client.SendAsync(confirm, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.NoContent, confirmed.StatusCode);
    using var oldLogin = Post("/api/v1/auth/login", new { email = "person-a@example.invalid", password = "valid-password-123" }, csrf);
    using var rejected = await client.SendAsync(oldLogin, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.Unauthorized, rejected.StatusCode);
  }

  [Fact]
  public async Task P06DeletionNeedsFreshReauthentication()
  {
    using var host = new Fixture(); using var client = host.CreateClient();
    var csrf = await Csrf(client);
    using var signup = Post("/api/v1/auth/sign-up", new { email = "person-a@example.invalid", password = "valid-password-123" }, csrf);
    using var accepted = await client.SendAsync(signup, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.Accepted, accepted.StatusCode);
    using var login = Post("/api/v1/auth/login", new { email = "person-a@example.invalid", password = "valid-password-123" }, csrf);
    using var loggedIn = await client.SendAsync(login, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.OK, loggedIn.StatusCode);
    csrf = CsrfCookie(loggedIn);
    using var deletion = new HttpRequestMessage(HttpMethod.Delete, "/api/v1/account");
    deletion.Headers.Add("X-XSRF-TOKEN", csrf);
    using var refused = await client.SendAsync(deletion, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.Unauthorized, refused.StatusCode);
    Assert.Empty(host.DeletionLedger.Recorded);
  }

  [Fact]
  public async Task P06WrongMediaReturnsContractProblemWithoutMail()
  {
    using var host = new Fixture(); using var client = host.CreateClient();
    var csrf = await Csrf(client);
    using var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/sign-up") { Content = new StringContent("synthetic-invalid-body", System.Text.Encoding.UTF8, "text/plain") };
    request.Headers.Add("X-XSRF-TOKEN", csrf);
    using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.UnsupportedMediaType, response.StatusCode);
    Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
    Assert.True(ContractSchemas.IsValid("Problem", body));
    Assert.DoesNotContain("synthetic-invalid-body", body);
    Assert.Empty(host.Email.Messages);
  }

  [Fact]
  public async Task P06VerifiedExportUsesOwnerAndNoStore()
  {
    using var host = new Fixture(); using var client = host.CreateClient();
    var csrf = await Csrf(client);
    using var signup = Post("/api/v1/auth/sign-up", new { email = "person-a@example.invalid", password = "valid-password-123" }, csrf);
    using var accepted = await client.SendAsync(signup, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.Accepted, accepted.StatusCode);
    await Dispatch(host);
    var token = System.Text.RegularExpressions.Regex.Match(host.Email.Messages.Single().Body, @"(?:#t=|#token=)([^\s&]+)").Groups[1].Value;
    Assert.NotEmpty(token);
    using var verify = Post("/api/v1/auth/verify-email", new { token }, csrf);
    using var verified = await client.SendAsync(verify, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.NoContent, verified.StatusCode);
    using var login = Post("/api/v1/auth/login", new { email = "person-a@example.invalid", password = "valid-password-123" }, csrf);
    using var loggedIn = await client.SendAsync(login, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.OK, loggedIn.StatusCode);
    csrf = CsrfCookie(loggedIn);
    using var reauth = Post("/api/v1/auth/reauthenticate", new { password = "valid-password-123" }, csrf);
    using var reauthenticated = await client.SendAsync(reauth, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.NoContent, reauthenticated.StatusCode);
    using var export = await client.GetAsync("/api/v1/account/data-export", TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.OK, export.StatusCode);
    Assert.Contains("no-store", export.Headers.CacheControl?.ToString());
    var body = await export.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
    Assert.True(ContractSchemas.IsValid("AccountDataExport", body));
    Assert.Contains("person-a@example.invalid", body);
  }

  [Fact]
  public async Task P06AuthEmailLimitReturnsRetryAfter()
  {
    using var host = new Fixture(); using var client = host.CreateClient();
    var csrf = await Csrf(client);
    for (var attempt = 0; attempt < 5; attempt++)
    {
      using var request = Post("/api/v1/auth/password-reset/request", new { email = "unknown@example.invalid" }, csrf);
      using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
      Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
    }
    using var limitedRequest = Post("/api/v1/auth/password-reset/request", new { email = "unknown@example.invalid" }, csrf);
    using var limited = await client.SendAsync(limitedRequest, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.TooManyRequests, limited.StatusCode);
    Assert.True(limited.Headers.TryGetValues("Retry-After", out var values));
    Assert.True(int.TryParse(values.Single(), out var seconds) && seconds >= 0);
    Assert.Empty(host.Email.Messages);
  }

  [Fact]
  public async Task P06SignupNeverLogsSubmittedSecretsOrAddress()
  {
    using var host = new Fixture(); using var client = host.CreateClient();
    var csrf = await Csrf(client);
    const string email = "person-a@example.invalid";
    const string password = "synthetic-secret-123";
    using var request = Post("/api/v1/auth/sign-up", new { email, password }, csrf);
    using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
    var entries = host.Logs.Entries.ToArray();
    Assert.NotEmpty(entries);
    foreach (var entry in entries)
    {
      Assert.DoesNotContain(email, entry.Message);
      Assert.DoesNotContain(password, entry.Message);
      Assert.DoesNotContain(email, entry.Exception);
      Assert.DoesNotContain(password, entry.Exception);
      Assert.All(entry.Fields, field =>
      {
        Assert.DoesNotContain(email, field.Value);
        Assert.DoesNotContain(password, field.Value);
      });
    }
  }

  [Fact]
  public async Task P06DeletionRetryDoesNotSendDuplicateConfirmation()
  {
    using var host = new Fixture(); using var client = host.CreateClient();
    var csrf = await Csrf(client);
    using var signup = Post("/api/v1/auth/sign-up", new { email = "person-a@example.invalid", password = "valid-password-123" }, csrf);
    using var accepted = await client.SendAsync(signup, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.Accepted, accepted.StatusCode);
    using var login = Post("/api/v1/auth/login", new { email = "person-a@example.invalid", password = "valid-password-123" }, csrf);
    using var loggedIn = await client.SendAsync(login, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.OK, loggedIn.StatusCode);
    csrf = CsrfCookie(loggedIn);
    using var reauth = Post("/api/v1/auth/reauthenticate", new { password = "valid-password-123" }, csrf);
    using var reauthenticated = await client.SendAsync(reauth, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.NoContent, reauthenticated.StatusCode);
    using var deletion = new HttpRequestMessage(HttpMethod.Delete, "/api/v1/account");
    deletion.Headers.Add("X-XSRF-TOKEN", csrf);
    using var deletionResponse = await client.SendAsync(deletion, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.Accepted, deletionResponse.StatusCode);
    host.DeletionLedger.Fail = true;
    var processor = host.Services.GetRequiredService<IAccountDeletionProcessor>();
    await Assert.ThrowsAsync<InvalidOperationException>(() => processor.ProcessDueAsync(TestContext.Current.CancellationToken));
    host.DeletionLedger.Fail = false;
    await processor.ProcessDueAsync(TestContext.Current.CancellationToken);
    Assert.Single(host.Email.Messages, message => message.Subject == "Account deletion requested");
    Assert.Single(host.DeletionLedger.Recorded);
  }

  [Fact]
  public async Task P06DeletionPurgeContinuesWhenConfirmationEmailFails()
  {
    using var host = new Fixture(); using var client = host.CreateClient();
    const string email = "person-a@example.invalid";
    const string password = "valid-password-123";
    var (csrf, _) = await SignUpVerifyAndLogin(host, client, email, password);
    using var reauth = Post("/api/v1/auth/reauthenticate", new { password }, csrf);
    using var reauthenticated = await client.SendAsync(reauth, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.NoContent, reauthenticated.StatusCode);
    using var deletion = new HttpRequestMessage(HttpMethod.Delete, "/api/v1/account");
    deletion.Headers.Add("X-XSRF-TOKEN", csrf);
    using var requested = await client.SendAsync(deletion, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.Accepted, requested.StatusCode);
    host.Email.FailDeletionNotice = true;
    var failure = await Record.ExceptionAsync(() => host.Services.GetRequiredService<IAccountDeletionProcessor>()
      .ProcessDueAsync(TestContext.Current.CancellationToken));
    Assert.Null(failure);
    Assert.Single(host.DeletionLedger.Recorded);
    // The login-issued CSRF token is bound to the authenticated identity, which the purge has removed, so the
    // retry needs an anonymous token; otherwise antiforgery answers 403 before login is ever reached.
    var anonymousCsrf = await Csrf(client);
    using var retry = Post("/api/v1/auth/login", new { email, password }, anonymousCsrf);
    using var rejected = await client.SendAsync(retry, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.Unauthorized, rejected.StatusCode);
    Assert.Null(await host.Services.GetRequiredService<IAccountStore>().FindByNormalizedEmailAsync(email.ToUpperInvariant(), TestContext.Current.CancellationToken));
  }

  [Fact]
  public async Task P06PurgeFailureIsSurfacedAndRetryableWithoutSensitiveLogData()
  {
    using var host = new Fixture(); using var client = host.CreateClient();
    const string email = "person-a@example.invalid";
    const string password = "valid-password-123";
    var (csrf, _) = await SignUpVerifyAndLogin(host, client, email, password);
    using var reauth = Post("/api/v1/auth/reauthenticate", new { password }, csrf);
    using var reauthenticated = await client.SendAsync(reauth, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.NoContent, reauthenticated.StatusCode);
    using var deletion = new HttpRequestMessage(HttpMethod.Delete, "/api/v1/account");
    deletion.Headers.Add("X-XSRF-TOKEN", csrf);
    using var requested = await client.SendAsync(deletion, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.Accepted, requested.StatusCode);
    host.DeletionLedger.Fail = true;
    var processor = host.Services.GetRequiredService<IAccountDeletionProcessor>();
    await Assert.ThrowsAsync<InvalidOperationException>(() => processor.ProcessDueAsync(TestContext.Current.CancellationToken));
    Assert.NotNull(await host.Services.GetRequiredService<IAccountStore>().FindByNormalizedEmailAsync(email.ToUpperInvariant(), TestContext.Current.CancellationToken));
    Assert.Contains(host.Logs.Entries, entry => entry.Category.StartsWith("ResumeBuilder", StringComparison.Ordinal)
      && entry.Message.Contains("purge", StringComparison.OrdinalIgnoreCase)
      && !entry.Message.Contains(email, StringComparison.Ordinal)
      && !entry.Message.Contains(password, StringComparison.Ordinal));
    host.DeletionLedger.Fail = false;
    await processor.ProcessDueAsync(TestContext.Current.CancellationToken);
    Assert.Null(await host.Services.GetRequiredService<IAccountStore>().FindByNormalizedEmailAsync(email.ToUpperInvariant(), TestContext.Current.CancellationToken));
  }

  [Fact]
  public async Task P06TwoCookieJarsKeepSessionExportPasswordAndDeletionOwnerScoped()
  {
    using var host = new Fixture(); using var accountA = host.CreateClient(); using var accountB = host.CreateClient();
    const string emailA = "person-a@example.invalid";
    const string emailB = "person-b@example.invalid";
    const string passwordA = "valid-password-a-123";
    const string passwordB = "valid-password-b-456";
    var (csrfA, _) = await SignUpVerifyAndLogin(host, accountA, emailA, passwordA);
    var (csrfB, _) = await SignUpVerifyAndLogin(host, accountB, emailB, passwordB);
    using var bSession = await accountB.GetAsync("/api/v1/session", TestContext.Current.CancellationToken);
    var bSessionBody = await bSession.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
    Assert.Contains(emailB, bSessionBody);
    Assert.DoesNotContain(emailA, bSessionBody);
    using var bWrongReauth = Post("/api/v1/auth/reauthenticate", new { password = passwordA }, csrfB);
    using var bWrong = await accountB.SendAsync(bWrongReauth, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.Forbidden, bWrong.StatusCode);
    using var bReauth = Post("/api/v1/auth/reauthenticate", new { password = passwordB }, csrfB);
    using var bReauthenticated = await accountB.SendAsync(bReauth, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.NoContent, bReauthenticated.StatusCode);
    using var bExport = await accountB.GetAsync("/api/v1/account/data-export", TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.OK, bExport.StatusCode);
    var bExportBody = await bExport.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
    Assert.Contains(emailB, bExportBody);
    Assert.DoesNotContain(emailA, bExportBody);
    using var bChange = new HttpRequestMessage(HttpMethod.Put, "/api/v1/account/password")
    { Content = JsonContent.Create(new { newPassword = "new-password-b-789" }) };
    bChange.Headers.Add("X-XSRF-TOKEN", csrfB);
    using var bChanged = await accountB.SendAsync(bChange, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.NoContent, bChanged.StatusCode);
    using var aSession = await accountA.GetAsync("/api/v1/session", TestContext.Current.CancellationToken);
    Assert.Contains(emailA, await aSession.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    using var aReauth = Post("/api/v1/auth/reauthenticate", new { password = passwordA }, csrfA);
    using var aReauthenticated = await accountA.SendAsync(aReauth, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.NoContent, aReauthenticated.StatusCode);
    using var aExport = await accountA.GetAsync("/api/v1/account/data-export", TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.OK, aExport.StatusCode);
    var aExportBody = await aExport.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
    Assert.Contains(emailA, aExportBody);
    Assert.DoesNotContain(emailB, aExportBody);
    csrfB = await Csrf(accountB);
    using var bLogin = Post("/api/v1/auth/login", new { email = emailB, password = "new-password-b-789" }, csrfB);
    using var bLoggedIn = await accountB.SendAsync(bLogin, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.OK, bLoggedIn.StatusCode);
    csrfB = CsrfCookie(bLoggedIn);
    using var bReauthForDelete = Post("/api/v1/auth/reauthenticate", new { password = "new-password-b-789" }, csrfB);
    using var bReady = await accountB.SendAsync(bReauthForDelete, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.NoContent, bReady.StatusCode);
    using var bDelete = new HttpRequestMessage(HttpMethod.Delete, "/api/v1/account");
    bDelete.Headers.Add("X-XSRF-TOKEN", csrfB);
    using var bDeleted = await accountB.SendAsync(bDelete, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.Accepted, bDeleted.StatusCode);
    using var aAfter = await accountA.GetAsync("/api/v1/session", TestContext.Current.CancellationToken);
    Assert.Contains(emailA, await aAfter.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    Assert.DoesNotContain(emailB, await aAfter.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
  }

  [Fact]
  public async Task P06LoggedOutSessionCookieCannotBeReplayedAgainstAnotherAccount()
  {
    using var host = new Fixture(); using var accountA = host.CreateClient(); using var accountB = host.CreateClient();
    var (csrfA, oldCookie) = await SignUpVerifyAndLogin(host, accountA, "person-a@example.invalid", "valid-password-a-123");
    _ = await SignUpVerifyAndLogin(host, accountB, "person-b@example.invalid", "valid-password-b-456");
    using var logout = Post("/api/v1/auth/logout", new { }, csrfA);
    using var loggedOut = await accountA.SendAsync(logout, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.NoContent, loggedOut.StatusCode);
    using var replay = host.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });
    using var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/session");
    request.Headers.Add("Cookie", oldCookie);
    using var response = await replay.SendAsync(request, TestContext.Current.CancellationToken);
    Assert.Contains("\"authenticated\":false", await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    using var exportRequest = new HttpRequestMessage(HttpMethod.Get, "/api/v1/account/data-export");
    exportRequest.Headers.Add("Cookie", oldCookie);
    using var export = await replay.SendAsync(exportRequest, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.Unauthorized, export.StatusCode);
    using var bSession = await accountB.GetAsync("/api/v1/session", TestContext.Current.CancellationToken);
    Assert.Contains("person-b@example.invalid", await bSession.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
  }

  [Fact]
  public async Task P06CookieTicketRenewalSlidesButNeverExceedsThirtyDayAbsoluteExpiry()
  {
    var stores = new MemoryAccountStores();
    var clock = new Clock();
    var accountId = Guid.NewGuid();
    Assert.True(await stores.TryCreateAsync(new AccountRecord(accountId, "person-a@example.invalid", "PERSON-A@EXAMPLE.INVALID", "synthetic-hash",
      clock.UtcNow, clock.UtcNow, null), TestContext.Current.CancellationToken));
    var issuedAt = clock.UtcNow;
    var sessionId = Guid.NewGuid();
    await stores.CreateAsync(new AccountSessionRecord(sessionId, accountId, issuedAt, issuedAt, issuedAt.AddDays(14), issuedAt.AddDays(30), null), TestContext.Current.CancellationToken);
    var ticketStore = new AccountCookieTicketStore(stores, stores, clock);
    var ticket = new AuthenticationTicket(AccountCookieTicketStore.Principal(sessionId, accountId), new AuthenticationProperties(), CookieAuthenticationDefaults.AuthenticationScheme);
    clock.UtcNow = issuedAt.AddDays(7);
    await ticketStore.RenewAsync(sessionId.ToString(), ticket, TestContext.Current.CancellationToken);
    Assert.Equal(issuedAt.AddDays(21), (await stores.FindActiveAsync(sessionId, clock.UtcNow, TestContext.Current.CancellationToken))?.ExpiresAt);
    clock.UtcNow = issuedAt.AddDays(20);
    await ticketStore.RenewAsync(sessionId.ToString(), ticket, TestContext.Current.CancellationToken);
    Assert.Equal(issuedAt.AddDays(30), (await stores.FindActiveAsync(sessionId, clock.UtcNow, TestContext.Current.CancellationToken))?.ExpiresAt);
    clock.UtcNow = issuedAt.AddDays(30);
    Assert.Null(await ticketStore.RetrieveAsync(sessionId.ToString(), TestContext.Current.CancellationToken));
  }

}
