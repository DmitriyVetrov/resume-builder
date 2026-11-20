namespace ResumeBuilder.Application.Accounts;

public interface IClock { DateTimeOffset UtcNow { get; } }
public interface IEmailSink
{
  Task SendAsync(AccountEmail message, CancellationToken cancellationToken);
}
public sealed record AccountEmail(string RecipientAddress, string Subject, string Body);
public interface IAccountDeletionLedger
{
  Task RecordAccountAsync(Guid userId, DateTimeOffset recordedAt, CancellationToken cancellationToken);
}
public interface IAccountDeletionProcessor
{
  Task ProcessDueAsync(CancellationToken cancellationToken);
  /// <summary>ADR-039 §2's erasure without the ledger write or the notice, for restore reconciliation. True when the user record existed.</summary>
  Task<bool> EraseAsync(Guid accountId, CancellationToken cancellationToken);
}

public enum AccountTokenPurpose { Verification, PasswordReset }
public sealed record AccountRecord(Guid Id, string Email, string NormalizedEmail,
    string PasswordHash, DateTimeOffset CreatedAt, DateTimeOffset? EmailVerifiedAt,
    DateTimeOffset? DeletionRequestedAt);
public sealed record AccountTokenRecord(Guid Id, Guid AccountId, AccountTokenPurpose Purpose,
    byte[] TokenHash, DateTimeOffset ExpiresAt, DateTimeOffset? UsedAt);
public sealed record AccountSessionRecord(Guid Id, Guid AccountId, DateTimeOffset CreatedAt,
    DateTimeOffset LastSeenAt, DateTimeOffset ExpiresAt, DateTimeOffset AbsoluteExpiresAt,
    DateTimeOffset? ReauthenticatedAt);
public sealed record AccountOutboxRecord(Guid Id, Guid AccountId, string RecipientAddress,
    string Subject, string? Body, DateTimeOffset CreatedAt,
    DateTimeOffset? ClaimedUntil, DateTimeOffset? SentAt,
    int Attempts = 0, DateTimeOffset? NextAttemptAt = null);

/// <summary>
/// Delivery policy for the mail outbox. A message the sink keeps rejecting must not be retried in a tight
/// loop ahead of everything else, so each failure pushes it further out (external review, major).
/// <para>
/// After <see cref="FastRetryAttempts"/> failures the message is <b>deferred for 30 days, not abandoned</b>:
/// a long outage or a temporarily unroutable address should still be delivered eventually, and nothing in
/// P06 reviews a dead-letter queue. The deferral is long enough that such a message never competes with
/// live mail. A terminal dead-letter state needs an operator surface to inspect and release it, which
/// belongs with the P15 deployment work.
/// </para>
/// </summary>
public static class AccountOutboxPolicy
{
  /// <summary>Failures that still get a short exponential backoff: 1, 2, 4, 8 and 16 minutes.</summary>
  public const int FastRetryAttempts = 5;
  public static readonly TimeSpan LongDeferral = TimeSpan.FromDays(30);

  /// <summary>When the message may be claimed again after <paramref name="attempts"/> failures.</summary>
  public static DateTimeOffset NextAttemptAt(DateTimeOffset now, int attempts) =>
    attempts >= FastRetryAttempts ? now + LongDeferral : now + TimeSpan.FromMinutes(Math.Pow(2, attempts - 1));

  /// <summary>True once the message has left the fast-retry window and is on the long deferral.</summary>
  public static bool IsDeferredLong(int attempts) => attempts >= FastRetryAttempts;
}

public interface IAccountUseCases
{
  Task SignUpAsync(string email, string password, CancellationToken cancellationToken);
  Task<bool> VerifyEmailAsync(string token, CancellationToken cancellationToken);
  Task ResendVerificationAsync(string email, CancellationToken cancellationToken);
  Task<AccountSessionRecord?> LoginAsync(string email, string password, CancellationToken cancellationToken);
  Task<AccountSessionRecord?> GetSessionAsync(Guid sessionId, CancellationToken cancellationToken);
  Task LogoutAsync(Guid sessionId, CancellationToken cancellationToken);
  Task RequestPasswordResetAsync(string email, CancellationToken cancellationToken);
  Task<bool> ConfirmPasswordResetAsync(string token, string newPassword, CancellationToken cancellationToken);
  Task<bool> ReauthenticateAsync(Guid sessionId, string password, CancellationToken cancellationToken);
  Task<bool> ChangePasswordAsync(Guid sessionId, string newPassword, CancellationToken cancellationToken);
  Task<bool> RequestDeletionAsync(Guid sessionId, CancellationToken cancellationToken);
  Task<AccountRecord?> GetAccountForExportAsync(Guid accountId, CancellationToken cancellationToken);
}
public interface IAccountStore
{
  Task<bool> TryCreateAsync(AccountRecord account, CancellationToken cancellationToken);
  Task<AccountRecord?> FindByNormalizedEmailAsync(string normalizedEmail, CancellationToken cancellationToken);
  Task<AccountRecord?> FindByIdAsync(Guid accountId, CancellationToken cancellationToken);
  Task<bool> TryVerifyEmailAsync(Guid accountId, DateTimeOffset verifiedAt, CancellationToken cancellationToken);
  Task<bool> TrySetPasswordHashAsync(Guid accountId, string passwordHash, CancellationToken cancellationToken);
  /// <summary>
  /// Atomically replaces the password hash only when it still equals <paramref name="expectedHash"/> and the
  /// account is not marked for deletion (DD-P06-15). Login rehash must use this instead of the unconditional
  /// setter, so a concurrent password reset cannot be overwritten.
  /// </summary>
  Task<bool> TryCompareExchangePasswordHashAsync(Guid accountId, string expectedHash, string replacementHash, CancellationToken cancellationToken);
  Task<bool> TryMarkDeletionRequestedAsync(Guid accountId, DateTimeOffset requestedAt, CancellationToken cancellationToken);
  Task<IReadOnlyList<AccountRecord>> ListDeletionDueAsync(DateTimeOffset dueAtOrBefore, int limit, CancellationToken cancellationToken);
  Task DeleteAsync(Guid accountId, CancellationToken cancellationToken);
}
public interface IAccountTokenStore
{
  Task ReplaceActiveAsync(AccountTokenRecord token, CancellationToken cancellationToken);
  Task<Guid?> TryConsumeAsync(byte[] tokenHash, AccountTokenPurpose purpose, DateTimeOffset now, CancellationToken cancellationToken);
  /// <summary>
  /// Removes every token of one purpose for an account, so a reset link issued before a password change cannot
  /// still be redeemed afterwards (review m-5). Unlike <c>DeleteForAccountAsync</c> this touches tokens only.
  /// </summary>
  Task DeleteForAccountAndPurposeAsync(Guid accountId, AccountTokenPurpose purpose, CancellationToken cancellationToken);
  Task DeleteForAccountAsync(Guid accountId, CancellationToken cancellationToken);
}
public interface ISessionStore
{
  Task CreateAsync(AccountSessionRecord session, CancellationToken cancellationToken);
  Task<AccountSessionRecord?> FindActiveAsync(Guid sessionId, DateTimeOffset now, CancellationToken cancellationToken);
  Task<bool> RenewAsync(Guid sessionId, DateTimeOffset seenAt, DateTimeOffset expiresAt, CancellationToken cancellationToken);
  Task<bool> StampReauthenticatedAsync(Guid sessionId, DateTimeOffset reauthenticatedAt, CancellationToken cancellationToken);
  Task RevokeAsync(Guid sessionId, CancellationToken cancellationToken);
  Task RevokeAllForAccountAsync(Guid accountId, CancellationToken cancellationToken);
  Task DeleteForAccountAsync(Guid accountId, CancellationToken cancellationToken);
}
public interface IEmailOutboxStore
{
  Task EnqueueAsync(AccountOutboxRecord message, CancellationToken cancellationToken);
  Task<AccountOutboxRecord?> TryClaimNextAsync(DateTimeOffset now, TimeSpan lease, CancellationToken cancellationToken);
  Task MarkSentAndClearBodyAsync(Guid messageId, DateTimeOffset sentAt, CancellationToken cancellationToken);
  /// <summary>
  /// Returns a claimed message to the queue after a failed delivery, recording how many attempts it has had
  /// and the earliest time it may be claimed again.
  /// </summary>
  Task ReleaseClaimAsync(Guid messageId, int attempts, DateTimeOffset nextAttemptAt, CancellationToken cancellationToken);
  Task DeleteForAccountAsync(Guid accountId, CancellationToken cancellationToken);
}
public interface IAccountOwnedDataPurger
{
  Task PurgeAsync(Guid accountId, CancellationToken cancellationToken);
}
