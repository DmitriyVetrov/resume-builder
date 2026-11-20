using Microsoft.AspNetCore.Identity;
using ResumeBuilder.Application.Accounts;

namespace ResumeBuilder.Infrastructure;

public sealed class SystemAccountClock : IClock { public DateTimeOffset UtcNow => DateTimeOffset.UtcNow; }

public sealed class IdentityAccountPasswordHasher : IAccountPasswordHasher
{
  private readonly PasswordHasher<AccountRecord> hasher = new(new Microsoft.Extensions.Options.OptionsWrapper<PasswordHasherOptions>(new PasswordHasherOptions { IterationCount = 210_000 }));
  public string HashPassword(AccountRecord account, string password) => hasher.HashPassword(account, password);
  public AccountPasswordVerification VerifyPassword(AccountRecord account, string passwordHash, string password) =>
    hasher.VerifyHashedPassword(account, passwordHash, password) switch
    {
      PasswordVerificationResult.Success => AccountPasswordVerification.Success,
      PasswordVerificationResult.SuccessRehashNeeded => AccountPasswordVerification.SuccessRehashNeeded,
      _ => AccountPasswordVerification.Failed
    };
}

public sealed class SmtpAccountEmailSink : IEmailSink
{
  private readonly string host;
  private readonly int port;
  private readonly string sender;
  private readonly Uri publicBaseUri;
  private readonly bool enableSsl;
  private readonly System.Net.NetworkCredential? credentials;
  public SmtpAccountEmailSink(string host, int port, string sender, Uri publicBaseUri, bool enableSsl, string? username, string? password)
  {
    this.host = host; this.port = port; this.sender = sender;
    this.publicBaseUri = publicBaseUri; this.enableSsl = enableSsl;
    credentials = string.IsNullOrEmpty(username) ? null : new System.Net.NetworkCredential(username, password);
  }
  public async Task SendAsync(AccountEmail message, CancellationToken cancellationToken)
  {
    if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(sender)) throw new InvalidOperationException("SMTP configuration is missing");
    var body = message.Body.StartsWith('/') ? new Uri(publicBaseUri, message.Body).AbsoluteUri : message.Body;
    using var mail = new System.Net.Mail.MailMessage(sender, message.RecipientAddress, message.Subject, body);
    using var client = new System.Net.Mail.SmtpClient(host, port) { EnableSsl = enableSsl };
    if (credentials is not null) client.Credentials = credentials;
    await client.SendMailAsync(mail, cancellationToken);
  }
}

public sealed class MemoryAccountSecurityCounters : IAccountSecurityCounters
{
  private readonly object gate = new();
  private readonly Dictionary<string, (DateTimeOffset Start, int Count, int Level, DateTimeOffset BlockedUntil, DateTimeOffset ExpiresAt)> logins = new(StringComparer.Ordinal);
  private readonly Dictionary<string, (long Hour, int Count)> emails = new(StringComparer.Ordinal);
  public Task<bool> TryAcquireEmailAsync(string addressKey, DateTimeOffset now, CancellationToken cancellationToken)
  {
    lock (gate)
    {
      var hour = now.ToUnixTimeSeconds() / 3600;
      var count = emails.TryGetValue(addressKey, out var old) && old.Hour == hour ? old.Count + 1 : 1;
      emails[addressKey] = (hour, count);
      return Task.FromResult(count <= 5);
    }
  }
  public Task<TimeSpan?> GetLoginDelayAsync(string accountKey, DateTimeOffset now, CancellationToken cancellationToken)
  {
    lock (gate) return Task.FromResult<TimeSpan?>(logins.TryGetValue(accountKey, out var state) && state.ExpiresAt > now && state.BlockedUntil > now ? state.BlockedUntil - now : null);
  }
  public Task RecordLoginResultAsync(string accountKey, bool succeeded, DateTimeOffset now, CancellationToken cancellationToken)
  {
    lock (gate)
    {
      if (succeeded) logins.Remove(accountKey);
      else
      {
        var active = logins.TryGetValue(accountKey, out var old) && old.ExpiresAt > now;
        var inWindow = active && old.Start.AddMinutes(15) > now;
        var count = inWindow ? old.Count + 1 : 1;
        var previousLevel = active ? old.Level : 0;
        var level = count >= 5 || previousLevel > 0 ? Math.Min(7, previousLevel + 1) : 0;
        var minutes = level == 0 ? 0 : Math.Min(60, Math.Pow(2, level - 1));
        logins[accountKey] = (inWindow ? old.Start : now, count, level, now.AddMinutes(minutes), now.AddHours(2));
      }
    }
    return Task.CompletedTask;
  }
}
