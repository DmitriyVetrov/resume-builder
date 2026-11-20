using System.Security.Cryptography;
using System.Text;
using ResumeBuilder.Domain.Accounts;

namespace ResumeBuilder.Application.Accounts;

public enum AccountPasswordVerification { Failed, Success, SuccessRehashNeeded }
public interface IAccountPasswordHasher
{
  string HashPassword(AccountRecord account, string password);
  AccountPasswordVerification VerifyPassword(AccountRecord account, string passwordHash, string password);
}

public sealed class AccountUseCases : IAccountUseCases
{
  private readonly IAccountStore accounts;
  private readonly IAccountTokenStore tokens;
  private readonly ISessionStore sessions;
  private readonly IEmailOutboxStore outbox;
  private readonly IClock clock;
  private readonly IAccountPasswordHasher passwordHasher;
  private readonly AccountRecord dummyAccount;
  private readonly string dummyHash;

  public AccountUseCases(IAccountStore accounts, IAccountTokenStore tokens, ISessionStore sessions,
      IEmailOutboxStore outbox, IClock clock, IAccountPasswordHasher passwordHasher)
  {
    this.accounts = accounts; this.tokens = tokens; this.sessions = sessions;
    this.outbox = outbox; this.clock = clock; this.passwordHasher = passwordHasher;
    dummyAccount = new AccountRecord(Guid.Empty, "", "", "", DateTimeOffset.UnixEpoch, null, null);
    dummyHash = passwordHasher.HashPassword(dummyAccount, "not-an-account-password-123");
  }

  private static string Normalize(string email) => email.Trim().ToUpperInvariant();
  private static byte[] HashToken(string token) => SHA256.HashData(Encoding.UTF8.GetBytes(token));
  private static string NewToken() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).TrimEnd('=').Replace('+', '-').Replace('/', '_');

  private async Task QueueTokenAsync(AccountRecord account, AccountTokenPurpose purpose, CancellationToken cancellationToken)
  {
    var raw = NewToken();
    await tokens.ReplaceActiveAsync(new AccountTokenRecord(Guid.NewGuid(), account.Id, purpose, HashToken(raw),
      clock.UtcNow.Add(purpose == AccountTokenPurpose.Verification ? TimeSpan.FromHours(24) : TimeSpan.FromHours(1)), null), cancellationToken);
    await outbox.EnqueueAsync(new AccountOutboxRecord(Guid.NewGuid(), account.Id, account.Email,
      purpose == AccountTokenPurpose.Verification ? "Verify email" : "Reset password", raw,
      clock.UtcNow, null, null), cancellationToken);
  }

  public async Task SignUpAsync(string email, string password, CancellationToken cancellationToken)
  {
    if (PasswordPolicy.Validate(password) is string code) throw new ArgumentException(code, nameof(password));
    var account = new AccountRecord(Guid.NewGuid(), email.Trim(), Normalize(email), "", clock.UtcNow, null, null);
    account = account with { PasswordHash = passwordHasher.HashPassword(account, password) };
    if (await accounts.TryCreateAsync(account, cancellationToken)) await QueueTokenAsync(account, AccountTokenPurpose.Verification, cancellationToken);
    else await QueueExistingAccountNoticeAsync(account.NormalizedEmail, cancellationToken);
  }

  /// <summary>
  /// ADR-034 / ADR-036 §8: an address that already has an account is told so, instead of the request vanishing
  /// silently. The notice carries no token and no link, so it cannot be used to take over the address, and the
  /// HTTP response stays the same bodyless 202 as for a new account (anti-enumeration).
  /// </summary>
  private async Task QueueExistingAccountNoticeAsync(string normalizedEmail, CancellationToken cancellationToken)
  {
    if (await accounts.FindByNormalizedEmailAsync(normalizedEmail, cancellationToken) is not { } existing) return;
    await outbox.EnqueueAsync(new AccountOutboxRecord(Guid.NewGuid(), existing.Id, existing.Email,
      "Account already exists",
      "An account for this address already exists, so no new account was created. If you did not try to sign up, you can ignore this message. If you have forgotten your password, request a password reset from the sign-in page.",
      clock.UtcNow, null, null), cancellationToken);
  }

  public async Task<bool> VerifyEmailAsync(string token, CancellationToken cancellationToken)
  {
    var id = await tokens.TryConsumeAsync(HashToken(token), AccountTokenPurpose.Verification, clock.UtcNow, cancellationToken);
    return id is Guid accountId && await accounts.TryVerifyEmailAsync(accountId, clock.UtcNow, cancellationToken);
  }

  public async Task ResendVerificationAsync(string email, CancellationToken cancellationToken)
  {
    var account = await accounts.FindByNormalizedEmailAsync(Normalize(email), cancellationToken);
    if (account is { EmailVerifiedAt: null, DeletionRequestedAt: null }) await QueueTokenAsync(account, AccountTokenPurpose.Verification, cancellationToken);
  }

  public async Task<AccountSessionRecord?> LoginAsync(string email, string password, CancellationToken cancellationToken)
  {
    var account = await accounts.FindByNormalizedEmailAsync(Normalize(email), cancellationToken);
    if (account is null || account.DeletionRequestedAt is not null)
    {
      _ = passwordHasher.VerifyPassword(dummyAccount, dummyHash, password);
      return null;
    }
    var result = passwordHasher.VerifyPassword(account, account.PasswordHash, password);
    if (result == AccountPasswordVerification.Failed) return null;

    // DD-P06-15 steps 1-2: the hash this login actually verified is what the post-create check must still see.
    // A rehash replaces it only if nothing else has written in the meantime, so a concurrent password reset
    // cannot be overwritten by a rehash of the old credential.
    var expectedHash = account.PasswordHash;
    if (result == AccountPasswordVerification.SuccessRehashNeeded)
    {
      var replacement = passwordHasher.HashPassword(account, password);
      if (!await accounts.TryCompareExchangePasswordHashAsync(account.Id, expectedHash, replacement, cancellationToken)) return null;
      expectedHash = replacement;
    }

    var now = clock.UtcNow;
    var candidate = new AccountSessionRecord(Guid.NewGuid(), account.Id, now, now, now.AddDays(14), now.AddDays(30), null);
    await sessions.CreateAsync(candidate, cancellationToken);

    // DD-P06-15 steps 3-4: re-read the account now that the candidate session exists. A reset that revoked all
    // sessions just before the insert would otherwise leave this one behind. Only this candidate is revoked, so a
    // concurrent login with the new password survives, and cleanup runs even when the request was cancelled.
    try
    {
      var current = await accounts.FindByIdAsync(account.Id, cancellationToken);
      if (current is { DeletionRequestedAt: null } && string.Equals(current.PasswordHash, expectedHash, StringComparison.Ordinal))
        return candidate;
    }
    catch
    {
      await sessions.RevokeAsync(candidate.Id, CancellationToken.None);
      throw;
    }
    await sessions.RevokeAsync(candidate.Id, CancellationToken.None);
    return null;
  }

  public Task<AccountSessionRecord?> GetSessionAsync(Guid sessionId, CancellationToken cancellationToken) => sessions.FindActiveAsync(sessionId, clock.UtcNow, cancellationToken);
  public Task LogoutAsync(Guid sessionId, CancellationToken cancellationToken) => sessions.RevokeAsync(sessionId, cancellationToken);
  public async Task RequestPasswordResetAsync(string email, CancellationToken cancellationToken)
  {
    var account = await accounts.FindByNormalizedEmailAsync(Normalize(email), cancellationToken);
    if (account is { DeletionRequestedAt: null }) await QueueTokenAsync(account, AccountTokenPurpose.PasswordReset, cancellationToken);
  }
  public async Task<bool> ConfirmPasswordResetAsync(string token, string newPassword, CancellationToken cancellationToken)
  {
    if (PasswordPolicy.Validate(newPassword) is not null) return false;
    var id = await tokens.TryConsumeAsync(HashToken(token), AccountTokenPurpose.PasswordReset, clock.UtcNow, cancellationToken);
    if (id is not Guid accountId || await accounts.FindByIdAsync(accountId, cancellationToken) is not { } account) return false;
    if (!await accounts.TrySetPasswordHashAsync(accountId, passwordHasher.HashPassword(account, newPassword), cancellationToken)) return false;
    await accounts.TryVerifyEmailAsync(accountId, clock.UtcNow, cancellationToken);
    await sessions.RevokeAllForAccountAsync(accountId, cancellationToken);
    return true;
  }
  public async Task<bool> ReauthenticateAsync(Guid sessionId, string password, CancellationToken cancellationToken)
  {
    var session = await GetSessionAsync(sessionId, cancellationToken);
    if (session is null || await accounts.FindByIdAsync(session.AccountId, cancellationToken) is not { } account) return false;
    if (passwordHasher.VerifyPassword(account, account.PasswordHash, password) == AccountPasswordVerification.Failed) return false;
    return await sessions.StampReauthenticatedAsync(sessionId, clock.UtcNow, cancellationToken);
  }
  private async Task<(AccountSessionRecord, AccountRecord)?> FreshAsync(Guid sessionId, CancellationToken cancellationToken)
  {
    var session = await GetSessionAsync(sessionId, cancellationToken);
    if (session?.ReauthenticatedAt is not DateTimeOffset at || at < clock.UtcNow.AddMinutes(-5) || at > clock.UtcNow) return null;
    var account = await accounts.FindByIdAsync(session.AccountId, cancellationToken);
    return account is { DeletionRequestedAt: null } ? (session, account) : null;
  }
  public async Task<bool> ChangePasswordAsync(Guid sessionId, string newPassword, CancellationToken cancellationToken)
  {
    if (PasswordPolicy.Validate(newPassword) is not null || await FreshAsync(sessionId, cancellationToken) is not { } pair) return false;
    if (!await accounts.TrySetPasswordHashAsync(pair.Item2.Id, passwordHasher.HashPassword(pair.Item2, newPassword), cancellationToken)) return false;
    // Review m-5: a reset link issued before this change must not survive it.
    await tokens.DeleteForAccountAndPurposeAsync(pair.Item2.Id, AccountTokenPurpose.PasswordReset, cancellationToken);
    await sessions.RevokeAllForAccountAsync(pair.Item2.Id, cancellationToken);
    return true;
  }
  public async Task<bool> RequestDeletionAsync(Guid sessionId, CancellationToken cancellationToken)
  {
    if (await FreshAsync(sessionId, cancellationToken) is not { } pair) return false;
    if (!await accounts.TryMarkDeletionRequestedAsync(pair.Item2.Id, clock.UtcNow, cancellationToken)) return false;
    await sessions.RevokeAllForAccountAsync(pair.Item2.Id, cancellationToken);
    return true;
  }
  public Task<AccountRecord?> GetAccountForExportAsync(Guid accountId, CancellationToken cancellationToken) => accounts.FindByIdAsync(accountId, cancellationToken);
}
