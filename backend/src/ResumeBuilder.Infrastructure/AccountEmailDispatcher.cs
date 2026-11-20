using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using ResumeBuilder.Application.Accounts;

namespace ResumeBuilder.Infrastructure;

public sealed class AccountEmailDispatcher : IAccountEmailDispatcher
{
  private readonly IEmailOutboxStore outbox;
  private readonly IEmailSink email;
  private readonly IClock clock;
  private readonly ILogger logger;

  // The logger is last and optional so that direct construction in tests keeps working.
  public AccountEmailDispatcher(IEmailOutboxStore outbox, IEmailSink email, IClock clock,
      ILogger<AccountEmailDispatcher>? logger = null)
  {
    this.outbox = outbox; this.email = email; this.clock = clock;
    this.logger = logger ?? NullLogger<AccountEmailDispatcher>.Instance;
  }

  public async Task DispatchAvailableAsync(CancellationToken cancellationToken)
  {
    var failed = 0;
    var deferredLong = 0;
    // A message the sink rejects is pushed out by its own backoff and the loop moves on, so one bad
    // recipient cannot stop verification or reset mail behind it (external review, major).
    while (await outbox.TryClaimNextAsync(clock.UtcNow, TimeSpan.FromMinutes(2), cancellationToken) is { } message)
    {
      try
      {
        var body = message.Subject switch
        {
          "Verify email" => "/verify-email#t=" + message.Body,
          "Reset password" => "/reset-password/confirm#t=" + message.Body,
          _ => message.Body ?? ""
        };
        await email.SendAsync(new AccountEmail(message.RecipientAddress, message.Subject, body), cancellationToken);
        await outbox.MarkSentAndClearBodyAsync(message.Id, clock.UtcNow, cancellationToken);
      }
      catch (Exception error) when (error is not OperationCanceledException)
      {
        var attempts = message.Attempts + 1;
        failed++;
        if (AccountOutboxPolicy.IsDeferredLong(attempts)) deferredLong++;
        await outbox.ReleaseClaimAsync(message.Id, attempts,
          AccountOutboxPolicy.NextAttemptAt(clock.UtcNow, attempts), CancellationToken.None);
      }
    }
    // Counts only: no address, subject or body may reach a log.
    if (failed > 0) OutboxLogs.DeliveryFailed(logger, failed, deferredLong);
  }
}

/// <summary>Content-free outbox telemetry (`.claude/rules/03-security-privacy.md`), CA1848-compliant.</summary>
internal static class OutboxLogs
{
  private static readonly Action<ILogger, int, int, Exception?> DeliveryFailedMessage =
      LoggerMessage.Define<int, int>(LogLevel.Warning, new EventId(20),
        "account_mail_delivery_failed {FailedCount} messages deferred, {LongDeferralCount} left the fast-retry window");
  public static void DeliveryFailed(ILogger logger, int failed, int deferredLong) =>
      DeliveryFailedMessage(logger, failed, deferredLong, null);
}
