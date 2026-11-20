using ResumeBuilder.Application.Accounts;
using Xunit;

namespace ResumeBuilder.Api.Tests;

/// <summary>
/// DD-P06-15: a login that verified the old password must not outlive a concurrent password reset, and a
/// rehash-on-login must not overwrite the hash the reset just wrote. Every schedule below is established with
/// explicit one-shot checkpoints, never with sleeps, delays or polling.
/// </summary>
public sealed class P06LoginResetRaceTests
{
  private const string Email = "person-a@example.invalid";
  private const string Normalized = "PERSON-A@EXAMPLE.INVALID";
  private const string OldPassword = "old-login-secret-4417";
  private const string NewPassword = "fresh-login-secret-8823";
  private const string ResetToken = "reset-token-for-race-tests";

  // ---------- Controls ----------

  [Fact]
  public async Task P06OrdinaryLoginWithoutContentionStillReturnsAnActiveSession()
  {
    var world = World.Create();
    var session = await world.UseCases.LoginAsync(Email, OldPassword, TestContext.Current.CancellationToken);
    Assert.NotNull(session);
    Assert.Equal(world.AccountId, session.AccountId);
    Assert.NotNull(await world.Store.FindActiveAsync(session.Id, world.Clock.UtcNow, TestContext.Current.CancellationToken));
    Assert.Equal(world.InitialHash, world.Account().PasswordHash);
  }

  [Fact]
  public async Task P06RehashOnLoginPersistsTheReplacementThroughCompareExchangeAndKeepsTheSession()
  {
    var world = World.Create();
    world.Hasher.RehashNeeded = true;
    var session = await world.UseCases.LoginAsync(Email, OldPassword, TestContext.Current.CancellationToken);
    Assert.NotNull(session);
    Assert.NotNull(await world.Store.FindActiveAsync(session.Id, world.Clock.UtcNow, TestContext.Current.CancellationToken));
    Assert.NotEqual(world.InitialHash, world.Account().PasswordHash);
    Assert.StartsWith($"hash({OldPassword})#", world.Account().PasswordHash, StringComparison.Ordinal);
    Assert.Equal(1, world.Store.CompareExchangeAttempts);
  }

  [Fact]
  public async Task P06WrongPasswordStillFailsWithoutCreatingOrRevokingAnything()
  {
    var world = World.Create();
    Assert.Null(await world.UseCases.LoginAsync(Email, "not-the-stored-secret-55", TestContext.Current.CancellationToken));
    Assert.Equal(0, world.Store.SessionsCreated);
    Assert.Equal(world.InitialHash, world.Account().PasswordHash);
  }

  // ---------- Reset wins before the candidate session is inserted ----------

  [Fact]
  public async Task P06ResetCompletedBeforeCandidateInsertLeavesNoUsableLoginSession()
  {
    var world = World.Create();
    var other = world.SeedUnrelatedAccountWithSession();

    var parked = World.Checkpoint();
    world.Store.BeforeSessionInsert = parked.Hook;
    var login = world.UseCases.LoginAsync(Email, OldPassword, TestContext.Current.CancellationToken);
    await parked.Reached;

    Assert.True(await world.UseCases.ConfirmPasswordResetAsync(ResetToken, NewPassword, TestContext.Current.CancellationToken));
    parked.Release();

    Assert.Null(await Checkpoint.Finish(login));
    Assert.Empty(world.SessionsOf(world.AccountId));
    Assert.StartsWith($"hash({NewPassword})#", world.Account().PasswordHash, StringComparison.Ordinal);
    Assert.Null(await world.UseCases.LoginAsync(Email, OldPassword, TestContext.Current.CancellationToken));
    Assert.NotNull(await world.UseCases.LoginAsync(Email, NewPassword, TestContext.Current.CancellationToken));
    Assert.NotNull(await world.Store.FindActiveAsync(other, world.Clock.UtcNow, TestContext.Current.CancellationToken));
  }

  // ---------- Reset wins after the candidate session is inserted ----------

  [Theory]
  [InlineData(false)]
  [InlineData(true)]
  public async Task P06ResetCompletedAfterCandidateInsertRevokesThatCandidate(bool rehashNeeded)
  {
    var world = World.Create();
    world.Hasher.RehashNeeded = rehashNeeded;
    var other = world.SeedUnrelatedAccountWithSession();

    var parked = World.Checkpoint();
    world.Store.BeforeAccountRead = parked.Hook;
    var login = world.UseCases.LoginAsync(Email, OldPassword, TestContext.Current.CancellationToken);
    await parked.Reached;
    Assert.Equal(1, world.Store.SessionsCreated);

    Assert.True(await world.UseCases.ConfirmPasswordResetAsync(ResetToken, NewPassword, TestContext.Current.CancellationToken));
    parked.Release();

    Assert.Null(await Checkpoint.Finish(login));
    Assert.Empty(world.SessionsOf(world.AccountId));
    Assert.StartsWith($"hash({NewPassword})#", world.Account().PasswordHash, StringComparison.Ordinal);
    Assert.NotNull(await world.Store.FindActiveAsync(other, world.Clock.UtcNow, TestContext.Current.CancellationToken));
  }

  [Fact]
  public async Task P06LoginThatCompletesBeforeAResetIsRevokedByThatReset()
  {
    var world = World.Create();
    var session = await world.UseCases.LoginAsync(Email, OldPassword, TestContext.Current.CancellationToken);
    Assert.NotNull(session);

    Assert.True(await world.UseCases.ConfirmPasswordResetAsync(ResetToken, NewPassword, TestContext.Current.CancellationToken));

    Assert.Null(await world.Store.FindActiveAsync(session.Id, world.Clock.UtcNow, TestContext.Current.CancellationToken));
  }

  // ---------- Reset versus the rehash compare-and-set ----------

  [Fact]
  public async Task P06ResetThatBeatsTheRehashCompareExchangeFailsTheLoginWithoutCreatingASession()
  {
    var world = World.Create();
    world.Hasher.RehashNeeded = true;

    var parked = World.Checkpoint();
    world.Store.BeforeCompareExchange = parked.Hook;
    var login = world.UseCases.LoginAsync(Email, OldPassword, TestContext.Current.CancellationToken);
    await parked.Reached;

    Assert.True(await world.UseCases.ConfirmPasswordResetAsync(ResetToken, NewPassword, TestContext.Current.CancellationToken));
    var resetHash = world.Account().PasswordHash;
    parked.Release();

    Assert.Null(await Checkpoint.Finish(login));
    Assert.Equal(0, world.Store.SessionsCreated);
    Assert.Equal(resetHash, world.Account().PasswordHash);
    Assert.Null(await world.UseCases.LoginAsync(Email, OldPassword, TestContext.Current.CancellationToken));
    Assert.NotNull(await world.UseCases.LoginAsync(Email, NewPassword, TestContext.Current.CancellationToken));
  }

  [Fact]
  public async Task P06ResetAfterASuccessfulRehashStillRevokesTheCandidateAndKeepsTheResetHash()
  {
    var world = World.Create();
    world.Hasher.RehashNeeded = true;

    var parked = World.Checkpoint();
    world.Store.BeforeSessionInsert = parked.Hook;
    var login = world.UseCases.LoginAsync(Email, OldPassword, TestContext.Current.CancellationToken);
    await parked.Reached;
    var rehashed = world.Account().PasswordHash;
    Assert.NotEqual(world.InitialHash, rehashed);

    Assert.True(await world.UseCases.ConfirmPasswordResetAsync(ResetToken, NewPassword, TestContext.Current.CancellationToken));
    parked.Release();

    Assert.Null(await Checkpoint.Finish(login));
    Assert.Empty(world.SessionsOf(world.AccountId));
    Assert.StartsWith($"hash({NewPassword})#", world.Account().PasswordHash, StringComparison.Ordinal);
  }

  // ---------- The account stops being loginable while the candidate exists ----------

  [Theory]
  [InlineData("deleted")]
  [InlineData("deletion-marked")]
  public async Task P06CandidateIsRevokedWhenTheAccountStopsBeingLoginable(string change)
  {
    var world = World.Create();
    var other = world.SeedUnrelatedAccountWithSession();

    var parked = World.Checkpoint();
    world.Store.BeforeAccountRead = parked.Hook;
    var login = world.UseCases.LoginAsync(Email, OldPassword, TestContext.Current.CancellationToken);
    await parked.Reached;
    Assert.Equal(1, world.Store.SessionsCreated);

    if (change == "deleted") await world.Store.DeleteAsync(world.AccountId, TestContext.Current.CancellationToken);
    else Assert.True(await world.Store.TryMarkDeletionRequestedAsync(world.AccountId, world.Clock.UtcNow, TestContext.Current.CancellationToken));
    parked.Release();

    Assert.Null(await Checkpoint.Finish(login));
    Assert.Empty(world.SessionsOf(world.AccountId));
    Assert.NotNull(await world.Store.FindActiveAsync(other, world.Clock.UtcNow, TestContext.Current.CancellationToken));
  }

  // ---------- Validation itself cannot complete ----------

  [Fact]
  public async Task P06AccountReadFailureAfterInsertIsAFailureAndStillRemovesTheCandidate()
  {
    var world = World.Create();
    world.Store.FailNextAccountRead = true;

    await Assert.ThrowsAsync<IOException>(() => world.UseCases.LoginAsync(Email, OldPassword, TestContext.Current.CancellationToken));

    Assert.Equal(1, world.Store.SessionsCreated);
    Assert.Empty(world.SessionsOf(world.AccountId));
  }

  [Fact]
  public async Task P06CancellationAfterInsertNeverReturnsASessionAndStillRemovesTheCandidate()
  {
    var world = World.Create();
    using var cancellation = new CancellationTokenSource();
    world.Store.BeforeAccountRead = () => { cancellation.Cancel(); return Task.CompletedTask; };

    await Assert.ThrowsAnyAsync<OperationCanceledException>(() => world.UseCases.LoginAsync(Email, OldPassword, cancellation.Token));

    Assert.Equal(1, world.Store.SessionsCreated);
    Assert.Empty(world.SessionsOf(world.AccountId));
  }

  // ---------- Credential lifetime ----------

  /// <summary>
  /// Review m-5: a reset link issued before the owner changed their password must not still work afterwards,
  /// otherwise a compromised mailbox takes the account over again after the owner has regained control.
  /// </summary>
  [Fact]
  public async Task P06PasswordChangeInvalidatesAnOutstandingResetToken()
  {
    var world = World.Create();
    var ct = TestContext.Current.CancellationToken;
    var session = await world.UseCases.LoginAsync(Email, OldPassword, ct);
    Assert.NotNull(session);
    Assert.True(await world.UseCases.ReauthenticateAsync(session.Id, OldPassword, ct));
    Assert.True(await world.UseCases.ChangePasswordAsync(session.Id, NewPassword, ct));

    Assert.False(await world.UseCases.ConfirmPasswordResetAsync(ResetToken, "third-login-secret-9152", ct));
    Assert.StartsWith($"hash({NewPassword})#", world.Account().PasswordHash, StringComparison.Ordinal);
    Assert.NotNull(await world.UseCases.LoginAsync(Email, NewPassword, ct));
  }

  /// <summary>A single-use reset token must stay single use even after the record has been rewritten.</summary>
  [Fact]
  public async Task P06ResetTokenCannotBeRedeemedTwice()
  {
    var world = World.Create();
    var ct = TestContext.Current.CancellationToken;
    Assert.True(await world.UseCases.ConfirmPasswordResetAsync(ResetToken, NewPassword, ct));
    Assert.False(await world.UseCases.ConfirmPasswordResetAsync(ResetToken, "fourth-login-secret-6630", ct));
    Assert.StartsWith($"hash({NewPassword})#", world.Account().PasswordHash, StringComparison.Ordinal);
  }

  // ---------- Compare-and-set semantics on the fake, mirrored by the real-Mongo case ----------

  [Fact]
  public async Task P06CompareExchangeRejectsStaleExpectedHashMissingAccountAndDeletionMarkedAccount()
  {
    var world = World.Create();
    var ct = TestContext.Current.CancellationToken;

    Assert.False(await world.Store.TryCompareExchangePasswordHashAsync(world.AccountId, "hash(not-the-stored-one)#9", "hash(x)#9", ct));
    Assert.Equal(world.InitialHash, world.Account().PasswordHash);

    Assert.False(await world.Store.TryCompareExchangePasswordHashAsync(Guid.NewGuid(), world.InitialHash, "hash(x)#9", ct));

    Assert.True(await world.Store.TryCompareExchangePasswordHashAsync(world.AccountId, world.InitialHash, world.InitialHash, ct));
    Assert.Equal(world.InitialHash, world.Account().PasswordHash);

    Assert.True(await world.Store.TryMarkDeletionRequestedAsync(world.AccountId, world.Clock.UtcNow, ct));
    Assert.False(await world.Store.TryCompareExchangePasswordHashAsync(world.AccountId, world.InitialHash, "hash(x)#9", ct));
    Assert.Equal(world.InitialHash, world.Account().PasswordHash);
  }

  // ---------- Test world ----------

  /// <summary>
  /// A one-shot rendezvous. <see cref="Reached"/> and <see cref="Finish{T}"/> are bounded: a schedule that never
  /// reaches its checkpoint fails the test with a timeout instead of hanging the run.
  /// </summary>
  private sealed class Checkpoint
  {
    private static readonly TimeSpan Limit = TimeSpan.FromSeconds(10);
    private readonly TaskCompletionSource reached = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private readonly TaskCompletionSource released = new(TaskCreationOptions.RunContinuationsAsynchronously);
    public Task Reached => reached.Task.WaitAsync(Limit);
    public void Release() => released.TrySetResult();
    public Task Hook()
    {
      reached.TrySetResult();
      return released.Task;
    }
    public static Task<T> Finish<T>(Task<T> work) => work.WaitAsync(Limit);
  }

  private sealed class World
  {
    public required RaceStore Store { get; init; }
    public required AccountUseCases UseCases { get; init; }
    public required SyntheticHasher Hasher { get; init; }
    public required FixedClock Clock { get; init; }
    public required Guid AccountId { get; init; }
    public required string InitialHash { get; init; }

    public static World Create()
    {
      var clock = new FixedClock(new DateTimeOffset(2026, 11, 4, 12, 0, 0, TimeSpan.Zero));
      var hasher = new SyntheticHasher();
      var store = new RaceStore();
      var accountId = Guid.NewGuid();
      var initialHash = hasher.HashPassword(new AccountRecord(accountId, Email, Normalized, "", clock.UtcNow, null, null), OldPassword);
      store.Seed(new AccountRecord(accountId, Email, Normalized, initialHash, clock.UtcNow.AddDays(-5), clock.UtcNow.AddDays(-5), null));
      store.SeedResetToken(accountId, ResetToken, clock.UtcNow.AddHours(1));
      var useCases = new AccountUseCases(store, store, store, store, clock, hasher);
      return new World { Store = store, UseCases = useCases, Hasher = hasher, Clock = clock, AccountId = accountId, InitialHash = initialHash };
    }

    public static Checkpoint Checkpoint() => new();
    public AccountRecord Account() => Store.Snapshot(AccountId) ?? throw new InvalidOperationException("The account under test is gone.");
    public AccountSessionRecord[] SessionsOf(Guid accountId) => Store.ActiveSessionsOf(accountId, Clock.UtcNow);

    /// <summary>A second account with its own live session, to prove that cleanup only touches the candidate.</summary>
    public Guid SeedUnrelatedAccountWithSession()
    {
      var id = Guid.NewGuid();
      Store.Seed(new AccountRecord(id, "person-b@example.invalid", "PERSON-B@EXAMPLE.INVALID",
        Hasher.HashPassword(new AccountRecord(id, "", "", "", Clock.UtcNow, null, null), "other-account-secret-31"),
        Clock.UtcNow.AddDays(-5), Clock.UtcNow.AddDays(-5), null));
      var sessionId = Guid.NewGuid();
      Store.SeedSession(new AccountSessionRecord(sessionId, id, Clock.UtcNow, Clock.UtcNow,
        Clock.UtcNow.AddDays(14), Clock.UtcNow.AddDays(30), null));
      return sessionId;
    }
  }

  private sealed class FixedClock(DateTimeOffset now) : IClock
  {
    public DateTimeOffset UtcNow => now;
  }

  /// <summary>
  /// Every call to <see cref="HashPassword"/> returns a distinct value, so old, rehashed and reset credentials are
  /// distinguishable, while verification matches on the password the hash was made from.
  /// </summary>
  private sealed class SyntheticHasher : IAccountPasswordHasher
  {
    private int issued;
    public bool RehashNeeded { get; set; }
    public string HashPassword(AccountRecord account, string password) =>
      $"hash({password})#{Interlocked.Increment(ref issued)}";
    public AccountPasswordVerification VerifyPassword(AccountRecord account, string passwordHash, string password) =>
      passwordHash.StartsWith($"hash({password})#", StringComparison.Ordinal)
        ? (RehashNeeded ? AccountPasswordVerification.SuccessRehashNeeded : AccountPasswordVerification.Success)
        : AccountPasswordVerification.Failed;
  }

  /// <summary>
  /// Stateful account/session/token/outbox store with one-shot checkpoints. A hook fires for the first call that
  /// reaches it and is then cleared, so a second operation scheduled against the same store never parks on it.
  /// </summary>
  private sealed class RaceStore : IAccountStore, IAccountTokenStore, ISessionStore, IEmailOutboxStore
  {
    private readonly object gate = new();
    private readonly Dictionary<Guid, AccountRecord> accounts = [];
    private readonly Dictionary<Guid, AccountSessionRecord> sessions = [];
    private readonly Dictionary<Guid, AccountTokenRecord> tokens = [];
    private readonly List<AccountOutboxRecord> outbox = [];
    private int sessionsCreated;
    private int compareExchangeAttempts;

    public Func<Task>? BeforeSessionInsert { get; set; }
    public Func<Task>? BeforeAccountRead { get; set; }
    public Func<Task>? BeforeCompareExchange { get; set; }
    public bool FailNextAccountRead { get; set; }
    public int SessionsCreated => Volatile.Read(ref sessionsCreated);
    public int CompareExchangeAttempts => Volatile.Read(ref compareExchangeAttempts);

    public void Seed(AccountRecord account) { lock (gate) accounts[account.Id] = account; }
    public void SeedSession(AccountSessionRecord session) { lock (gate) sessions[session.Id] = session; }
    public void SeedResetToken(Guid accountId, string token, DateTimeOffset expiresAt)
    {
      var hash = System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(token));
      var record = new AccountTokenRecord(Guid.NewGuid(), accountId, AccountTokenPurpose.PasswordReset, hash, expiresAt, null);
      lock (gate) tokens[record.Id] = record;
    }
    public AccountRecord? Snapshot(Guid id) { lock (gate) return accounts.GetValueOrDefault(id); }
    public AccountSessionRecord[] ActiveSessionsOf(Guid accountId, DateTimeOffset now)
    {
      lock (gate) return sessions.Values.Where(s => s.AccountId == accountId && s.ExpiresAt > now && s.AbsoluteExpiresAt > now).ToArray();
    }

    // IAccountStore
    public Task<bool> TryCreateAsync(AccountRecord account, CancellationToken ct)
    {
      lock (gate)
      {
        if (accounts.Values.Any(a => a.NormalizedEmail == account.NormalizedEmail)) return Task.FromResult(false);
        accounts[account.Id] = account;
        return Task.FromResult(true);
      }
    }
    public Task<AccountRecord?> FindByNormalizedEmailAsync(string email, CancellationToken ct)
    {
      lock (gate) return Task.FromResult(accounts.Values.SingleOrDefault(a => a.NormalizedEmail == email));
    }
    public async Task<AccountRecord?> FindByIdAsync(Guid id, CancellationToken ct)
    {
      var hook = BeforeAccountRead;
      if (hook is not null)
      {
        BeforeAccountRead = null;
        await hook();
      }
      ct.ThrowIfCancellationRequested();
      if (FailNextAccountRead)
      {
        FailNextAccountRead = false;
        throw new IOException("synthetic account-read outage");
      }
      lock (gate) return accounts.GetValueOrDefault(id);
    }
    public Task<bool> TryVerifyEmailAsync(Guid id, DateTimeOffset at, CancellationToken ct)
    {
      lock (gate)
      {
        if (!accounts.TryGetValue(id, out var account) || account.EmailVerifiedAt is not null) return Task.FromResult(false);
        accounts[id] = account with { EmailVerifiedAt = at };
        return Task.FromResult(true);
      }
    }
    public Task<bool> TrySetPasswordHashAsync(Guid id, string hash, CancellationToken ct)
    {
      lock (gate)
      {
        if (!accounts.TryGetValue(id, out var account)) return Task.FromResult(false);
        accounts[id] = account with { PasswordHash = hash };
        return Task.FromResult(true);
      }
    }
    public async Task<bool> TryCompareExchangePasswordHashAsync(Guid id, string expected, string replacement, CancellationToken ct)
    {
      var hook = BeforeCompareExchange;
      if (hook is not null)
      {
        BeforeCompareExchange = null;
        await hook();
      }
      Interlocked.Increment(ref compareExchangeAttempts);
      lock (gate)
      {
        if (!accounts.TryGetValue(id, out var account) || account.DeletionRequestedAt is not null
            || !string.Equals(account.PasswordHash, expected, StringComparison.Ordinal)) return false;
        accounts[id] = account with { PasswordHash = replacement };
        return true;
      }
    }
    public Task<bool> TryMarkDeletionRequestedAsync(Guid id, DateTimeOffset at, CancellationToken ct)
    {
      lock (gate)
      {
        if (!accounts.TryGetValue(id, out var account) || account.DeletionRequestedAt is not null) return Task.FromResult(false);
        accounts[id] = account with { DeletionRequestedAt = at };
        return Task.FromResult(true);
      }
    }
    public Task<IReadOnlyList<AccountRecord>> ListDeletionDueAsync(DateTimeOffset before, int limit, CancellationToken ct)
    {
      lock (gate) return Task.FromResult<IReadOnlyList<AccountRecord>>(accounts.Values.Where(a => a.DeletionRequestedAt <= before).OrderBy(a => a.DeletionRequestedAt).Take(limit).ToArray());
    }
    public Task DeleteAsync(Guid id, CancellationToken ct) { lock (gate) accounts.Remove(id); return Task.CompletedTask; }

    // IAccountTokenStore
    public Task ReplaceActiveAsync(AccountTokenRecord token, CancellationToken ct)
    {
      lock (gate)
      {
        foreach (var key in tokens.Where(t => t.Value.AccountId == token.AccountId && t.Value.Purpose == token.Purpose).Select(t => t.Key).ToArray())
          tokens.Remove(key);
        tokens[token.Id] = token;
      }
      return Task.CompletedTask;
    }
    public Task<Guid?> TryConsumeAsync(byte[] hash, AccountTokenPurpose purpose, DateTimeOffset now, CancellationToken ct)
    {
      lock (gate)
      {
        var match = tokens.Values.SingleOrDefault(t => t.Purpose == purpose && t.UsedAt is null && t.ExpiresAt > now
          && System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(t.TokenHash, hash));
        if (match is null) return Task.FromResult<Guid?>(null);
        tokens[match.Id] = match with { UsedAt = now };
        return Task.FromResult<Guid?>(match.AccountId);
      }
    }

    public Task DeleteForAccountAndPurposeAsync(Guid accountId, AccountTokenPurpose purpose, CancellationToken ct)
    {
      lock (gate)
      {
        foreach (var key in tokens.Values.Where(t => t.AccountId == accountId && t.Purpose == purpose).Select(t => t.Id).ToArray()) tokens.Remove(key);
      }
      return Task.CompletedTask;
    }

    // ISessionStore
    public async Task CreateAsync(AccountSessionRecord session, CancellationToken ct)
    {
      var hook = BeforeSessionInsert;
      if (hook is not null)
      {
        BeforeSessionInsert = null;
        await hook();
      }
      Interlocked.Increment(ref sessionsCreated);
      lock (gate) sessions[session.Id] = session;
    }
    public Task<AccountSessionRecord?> FindActiveAsync(Guid id, DateTimeOffset now, CancellationToken ct)
    {
      lock (gate) return Task.FromResult(sessions.GetValueOrDefault(id) is { } s && s.ExpiresAt > now && s.AbsoluteExpiresAt > now ? s : null);
    }
    public Task<bool> RenewAsync(Guid id, DateTimeOffset seen, DateTimeOffset expires, CancellationToken ct)
    {
      lock (gate)
      {
        if (!sessions.TryGetValue(id, out var session)) return Task.FromResult(false);
        sessions[id] = session with { LastSeenAt = seen, ExpiresAt = expires };
        return Task.FromResult(true);
      }
    }
    public Task<bool> StampReauthenticatedAsync(Guid id, DateTimeOffset at, CancellationToken ct)
    {
      lock (gate)
      {
        if (!sessions.TryGetValue(id, out var session)) return Task.FromResult(false);
        sessions[id] = session with { ReauthenticatedAt = at };
        return Task.FromResult(true);
      }
    }
    public Task RevokeAsync(Guid id, CancellationToken ct) { lock (gate) sessions.Remove(id); return Task.CompletedTask; }
    public Task RevokeAllForAccountAsync(Guid accountId, CancellationToken ct)
    {
      lock (gate)
      {
        foreach (var key in sessions.Values.Where(s => s.AccountId == accountId).Select(s => s.Id).ToArray()) sessions.Remove(key);
      }
      return Task.CompletedTask;
    }

    // IAccountTokenStore + IEmailOutboxStore shared cleanup
    public Task DeleteForAccountAsync(Guid accountId, CancellationToken ct)
    {
      lock (gate)
      {
        foreach (var key in tokens.Values.Where(t => t.AccountId == accountId).Select(t => t.Id).ToArray()) tokens.Remove(key);
        foreach (var key in sessions.Values.Where(s => s.AccountId == accountId).Select(s => s.Id).ToArray()) sessions.Remove(key);
        outbox.RemoveAll(o => o.AccountId == accountId);
      }
      return Task.CompletedTask;
    }

    // IEmailOutboxStore
    public Task EnqueueAsync(AccountOutboxRecord message, CancellationToken ct) { lock (gate) outbox.Add(message); return Task.CompletedTask; }
    public Task<AccountOutboxRecord?> TryClaimNextAsync(DateTimeOffset now, TimeSpan lease, CancellationToken ct) => Task.FromResult<AccountOutboxRecord?>(null);
    public Task MarkSentAndClearBodyAsync(Guid id, DateTimeOffset at, CancellationToken ct) => Task.CompletedTask;
    public Task ReleaseClaimAsync(Guid id, int attempts, DateTimeOffset nextAttemptAt, CancellationToken ct) => Task.CompletedTask;
  }
}
