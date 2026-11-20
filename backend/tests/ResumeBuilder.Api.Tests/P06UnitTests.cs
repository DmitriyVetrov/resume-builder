using ResumeBuilder.Application.Accounts;
using ResumeBuilder.Domain.Accounts;
using Xunit;

namespace ResumeBuilder.Api.Tests;

public sealed class P06PasswordPolicyTests
{
  [Theory]
  [InlineData("password1234")]
  [InlineData("1234567890a")]
  [InlineData("qwertyuiop")]
  [InlineData("Password1234")]
  [InlineData("QWERTYUIOP")]
  [InlineData("password1234!")]
  public void P06CommonPasswordCorpusRejectsNonSeedEntriesAndCaseSuffixVariants(string password)
  {
    Assert.Equal("password_too_common", PasswordPolicy.Validate(password));
  }

  [Theory]
  [InlineData("123456789", "password_too_short")]
  [InlineData("password", "password_too_short")]
  [InlineData("password123", "password_too_common")]
  [InlineData("a sufficiently unusual passphrase", null)]
  public void P06ValidateReturnsOneContractCode(string password, string? expected)
  {
    string? actual = null;
    var error = Record.Exception(() => actual = PasswordPolicy.Validate(password));
    Assert.Null(error);
    Assert.Equal(expected, actual);
  }

  [Fact]
  public void P06LengthCountsUnicodeCodePointsAtInclusiveBoundaries()
  {
    string? nineCodePoints = null;
    var error = Record.Exception(() => nineCodePoints = PasswordPolicy.Validate(string.Concat(Enumerable.Repeat("🔒", 9))));
    Assert.Null(error);
    Assert.Equal("password_too_short", nineCodePoints);
    Assert.Null(PasswordPolicy.Validate(string.Concat(Enumerable.Repeat("🔒", 10))));
    Assert.Null(PasswordPolicy.Validate(new string('x', 128)));
    Assert.Equal("password_too_long", PasswordPolicy.Validate(new string('x', 129)));
  }
}

public sealed class P06AccountUseCaseTests
{
  private static readonly CancellationToken Cancellation = CancellationToken.None;
  private sealed class Clock : IClock { public DateTimeOffset UtcNow { get; set; } = new(2026, 11, 3, 12, 0, 0, TimeSpan.Zero); }
  private sealed class Hasher : IAccountPasswordHasher
  {
    public string HashPassword(AccountRecord account, string password) => "synthetic-hash";
    public AccountPasswordVerification VerifyPassword(AccountRecord account, string hash, string password) => password == "valid-password-123" ? AccountPasswordVerification.Success : AccountPasswordVerification.Failed;
  }
  private sealed class Accounts : IAccountStore
  {
    public AccountRecord? Saved { get; private set; }
    public bool Verified { get; private set; }
    public void Seed(AccountRecord account) => Saved = account;
    public Task<bool> TryCreateAsync(AccountRecord account, CancellationToken ct) { Saved = account; return Task.FromResult(true); }
    public Task<AccountRecord?> FindByNormalizedEmailAsync(string email, CancellationToken ct) => Task.FromResult(Saved?.NormalizedEmail == email ? Saved : null);
    public Task<AccountRecord?> FindByIdAsync(Guid id, CancellationToken ct) => Task.FromResult(Saved?.Id == id ? Saved : null);
    public Task<bool> TryVerifyEmailAsync(Guid id, DateTimeOffset at, CancellationToken ct) { Verified = Saved?.Id == id; return Task.FromResult(Verified); }
    public Task<bool> TrySetPasswordHashAsync(Guid id, string hash, CancellationToken ct) => Task.FromResult(true);
    public Task<bool> TryCompareExchangePasswordHashAsync(Guid id, string expected, string replacement, CancellationToken ct) { if (Saved is null || Saved.Id != id || Saved.DeletionRequestedAt != null || !string.Equals(Saved.PasswordHash, expected, StringComparison.Ordinal)) return Task.FromResult(false); Saved = Saved with { PasswordHash = replacement }; return Task.FromResult(true); }
    public Task<bool> TryMarkDeletionRequestedAsync(Guid id, DateTimeOffset at, CancellationToken ct) => Task.FromResult(true);
    public Task<IReadOnlyList<AccountRecord>> ListDeletionDueAsync(DateTimeOffset due, int limit, CancellationToken ct) => Task.FromResult<IReadOnlyList<AccountRecord>>([]);
    public Task DeleteAsync(Guid id, CancellationToken ct) => Task.CompletedTask;
  }
  private sealed class Tokens : IAccountTokenStore
  {
    public AccountTokenRecord? Saved { get; private set; }
    public byte[]? LastHash { get; private set; }
    public void Seed(AccountTokenRecord token) => Saved = token;
    public Task ReplaceActiveAsync(AccountTokenRecord token, CancellationToken ct) { Saved = token; return Task.CompletedTask; }
    public Task<Guid?> TryConsumeAsync(byte[] hash, AccountTokenPurpose purpose, DateTimeOffset now, CancellationToken ct)
    {
      LastHash = hash;
      if (Saved is null || Saved.Purpose != purpose || Saved.ExpiresAt <= now || Saved.UsedAt is not null) return Task.FromResult<Guid?>(null);
      var id = Saved.AccountId;
      Saved = Saved with { UsedAt = now };
      return Task.FromResult<Guid?>(id);
    }
    public Task DeleteForAccountAsync(Guid id, CancellationToken ct) => Task.CompletedTask;
    public Task DeleteForAccountAndPurposeAsync(Guid id, AccountTokenPurpose purpose, CancellationToken ct) { if (Saved?.AccountId == id && Saved.Purpose == purpose) Saved = null; return Task.CompletedTask; }
  }
  private sealed class Sessions : ISessionStore
  {
    public AccountSessionRecord? Saved { get; private set; }
    public bool RevokedAll { get; private set; }
    public void Seed(AccountSessionRecord session) => Saved = session;
    public Task CreateAsync(AccountSessionRecord session, CancellationToken ct) { Saved = session; return Task.CompletedTask; }
    public Task<AccountSessionRecord?> FindActiveAsync(Guid id, DateTimeOffset now, CancellationToken ct) => Task.FromResult(Saved?.Id == id ? Saved : null);
    public Task<bool> RenewAsync(Guid id, DateTimeOffset seen, DateTimeOffset expires, CancellationToken ct) => Task.FromResult(true);
    public Task<bool> StampReauthenticatedAsync(Guid id, DateTimeOffset at, CancellationToken ct) => Task.FromResult(true);
    public Task RevokeAsync(Guid id, CancellationToken ct) => Task.CompletedTask;
    public Task RevokeAllForAccountAsync(Guid id, CancellationToken ct) { RevokedAll = true; return Task.CompletedTask; }
    public Task DeleteForAccountAsync(Guid id, CancellationToken ct) => Task.CompletedTask;
  }
  private sealed class Outbox : IEmailOutboxStore
  {
    public AccountOutboxRecord? Saved { get; private set; }
    public Task EnqueueAsync(AccountOutboxRecord message, CancellationToken ct) { Saved = message; return Task.CompletedTask; }
    public Task<AccountOutboxRecord?> TryClaimNextAsync(DateTimeOffset now, TimeSpan lease, CancellationToken ct) => Task.FromResult<AccountOutboxRecord?>(null);
    public Task MarkSentAndClearBodyAsync(Guid id, DateTimeOffset at, CancellationToken ct) => Task.CompletedTask;
    public Task ReleaseClaimAsync(Guid id, int attempts, DateTimeOffset nextAttemptAt, CancellationToken ct) => Task.CompletedTask;
    public Task DeleteForAccountAsync(Guid id, CancellationToken ct) => Task.CompletedTask;
  }
  [Fact]
  public async Task P06SignupPersistsUnverifiedAccountAndVerificationOutbox()
  {
    var accounts = new Accounts(); var tokens = new Tokens(); var outbox = new Outbox();
    var useCases = new AccountUseCases(accounts, tokens, new Sessions(), outbox, new Clock(), new Hasher());
    var error = await Record.ExceptionAsync(() => useCases.SignUpAsync("person-a@example.invalid", "valid-password-123", Cancellation));
    Assert.Null(error);
    Assert.NotNull(accounts.Saved);
    Assert.Null(accounts.Saved.EmailVerifiedAt);
    Assert.Equal("synthetic-hash", accounts.Saved.PasswordHash);
    Assert.Equal(AccountTokenPurpose.Verification, tokens.Saved?.Purpose);
    Assert.NotNull(outbox.Saved);
  }
  [Fact]
  public async Task P06UnknownLoginDoesNotCreateSession()
  {
    var sessions = new Sessions();
    var useCases = new AccountUseCases(new Accounts(), new Tokens(), sessions, new Outbox(), new Clock(), new Hasher());
    AccountSessionRecord? result = null;
    var error = await Record.ExceptionAsync(async () => result = await useCases.LoginAsync("unknown@example.invalid", "valid-password-123", Cancellation));
    Assert.Null(error);
    Assert.Null(result);
    Assert.Null(sessions.Saved);
  }

  [Fact]
  public async Task P06ValidLoginCreatesOpaqueSessionForOwnAccount()
  {
    var now = new Clock().UtcNow;
    var account = new AccountRecord(Guid.NewGuid(), "person-a@example.invalid", "PERSON-A@EXAMPLE.INVALID", "synthetic-hash", now, null, null);
    var accounts = new Accounts(); accounts.Seed(account);
    var sessions = new Sessions();
    var useCases = new AccountUseCases(accounts, new Tokens(), sessions, new Outbox(), new Clock(), new Hasher());
    AccountSessionRecord? result = null;
    var error = await Record.ExceptionAsync(async () => result = await useCases.LoginAsync("person-a@example.invalid", "valid-password-123", Cancellation));
    Assert.Null(error);
    Assert.NotNull(result);
    Assert.Equal(account.Id, result.AccountId);
    Assert.Equal(result.Id, sessions.Saved?.Id);
    Assert.NotEqual(Guid.Empty, result.Id);
  }

  [Fact]
  public async Task P06InvalidVerificationTokenDoesNotVerifyAnAccount()
  {
    var accounts = new Accounts();
    var useCases = new AccountUseCases(accounts, new Tokens(), new Sessions(), new Outbox(), new Clock(), new Hasher());
    bool? result = null;
    var error = await Record.ExceptionAsync(async () => result = await useCases.VerifyEmailAsync("synthetic-invalid-token", Cancellation));
    Assert.Null(error);
    Assert.False(result);
    Assert.Null(accounts.Saved);
  }

  [Fact]
  public async Task P06UnknownResetRequestDoesNotQueueMail()
  {
    var outbox = new Outbox();
    var useCases = new AccountUseCases(new Accounts(), new Tokens(), new Sessions(), outbox, new Clock(), new Hasher());
    var error = await Record.ExceptionAsync(() => useCases.RequestPasswordResetAsync("unknown@example.invalid", Cancellation));
    Assert.Null(error);
    Assert.Null(outbox.Saved);
  }

  [Fact]
  public async Task P06UnknownAccountCannotBeExported()
  {
    var useCases = new AccountUseCases(new Accounts(), new Tokens(), new Sessions(), new Outbox(), new Clock(), new Hasher());
    AccountRecord? result = null;
    var error = await Record.ExceptionAsync(async () => result = await useCases.GetAccountForExportAsync(Guid.NewGuid(), Cancellation));
    Assert.Null(error);
    Assert.Null(result);
  }

  [Fact]
  public async Task P06StaleReauthenticationCannotChangePasswordOrRevokeSessions()
  {
    var now = new Clock().UtcNow;
    var accountId = Guid.NewGuid();
    var sessionId = Guid.NewGuid();
    var accounts = new Accounts();
    accounts.Seed(new AccountRecord(accountId, "person-a@example.invalid", "PERSON-A@EXAMPLE.INVALID", "synthetic-hash", now, now, null));
    var sessions = new Sessions();
    sessions.Seed(new AccountSessionRecord(sessionId, accountId, now.AddHours(-1), now, now.AddHours(1), now.AddDays(1), now.AddMinutes(-6)));
    var useCases = new AccountUseCases(accounts, new Tokens(), sessions, new Outbox(), new Clock(), new Hasher());
    bool? changed = null;
    var error = await Record.ExceptionAsync(async () => changed = await useCases.ChangePasswordAsync(sessionId, "different-valid-password-456", Cancellation));
    Assert.Null(error);
    Assert.False(changed);
    Assert.False(sessions.RevokedAll);
  }

  [Fact]
  public async Task P06FreshDeletionRequestRevokesAccountSessions()
  {
    var now = new Clock().UtcNow;
    var accountId = Guid.NewGuid();
    var sessionId = Guid.NewGuid();
    var accounts = new Accounts();
    accounts.Seed(new AccountRecord(accountId, "person-a@example.invalid", "PERSON-A@EXAMPLE.INVALID", "synthetic-hash", now, now, null));
    var sessions = new Sessions();
    sessions.Seed(new AccountSessionRecord(sessionId, accountId, now.AddHours(-1), now, now.AddHours(1), now.AddDays(1), now.AddMinutes(-1)));
    var useCases = new AccountUseCases(accounts, new Tokens(), sessions, new Outbox(), new Clock(), new Hasher());
    bool? requested = null;
    var error = await Record.ExceptionAsync(async () => requested = await useCases.RequestDeletionAsync(sessionId, Cancellation));
    Assert.Null(error);
    Assert.True(requested);
    Assert.True(sessions.RevokedAll);
  }

  [Fact]
  public async Task P06VerificationIsSingleUseBeforeExpiry()
  {
    var clock = new Clock();
    var account = new AccountRecord(Guid.NewGuid(), "person-a@example.invalid", "PERSON-A@EXAMPLE.INVALID", "synthetic-hash", clock.UtcNow, null, null);
    var accounts = new Accounts(); accounts.Seed(account);
    const string token = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    var tokens = new Tokens();
    tokens.Seed(new AccountTokenRecord(Guid.NewGuid(), account.Id, AccountTokenPurpose.Verification,
      System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(token)), clock.UtcNow.AddHours(24), null));
    var useCases = new AccountUseCases(accounts, tokens, new Sessions(), new Outbox(), clock, new Hasher());
    bool? result = null;
    var error = await Record.ExceptionAsync(async () => result = await useCases.VerifyEmailAsync(token, Cancellation));
    Assert.Null(error);
    Assert.True(result);
    Assert.True(accounts.Verified);
    Assert.Equal(32, tokens.LastHash?.Length);
    Assert.False(await useCases.VerifyEmailAsync(token, Cancellation));
  }

  [Fact]
  public async Task P06VerificationExpiresAtExactly24Hours()
  {
    var clock = new Clock();
    var account = new AccountRecord(Guid.NewGuid(), "person-a@example.invalid", "PERSON-A@EXAMPLE.INVALID", "synthetic-hash", clock.UtcNow, null, null);
    var accounts = new Accounts(); accounts.Seed(account);
    const string token = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    var tokens = new Tokens();
    tokens.Seed(new AccountTokenRecord(Guid.NewGuid(), account.Id, AccountTokenPurpose.Verification,
      System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(token)), clock.UtcNow, null));
    var useCases = new AccountUseCases(accounts, tokens, new Sessions(), new Outbox(), clock, new Hasher());
    bool? result = null;
    var error = await Record.ExceptionAsync(async () => result = await useCases.VerifyEmailAsync(token, Cancellation));
    Assert.Null(error);
    Assert.False(result);
    Assert.False(accounts.Verified);
  }
}
