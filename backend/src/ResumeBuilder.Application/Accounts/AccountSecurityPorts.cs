namespace ResumeBuilder.Application.Accounts;

public interface IAccountSecurityCounters
{
  Task<bool> TryAcquireEmailAsync(string addressKey, DateTimeOffset now, CancellationToken cancellationToken);
  Task<TimeSpan?> GetLoginDelayAsync(string accountKey, DateTimeOffset now, CancellationToken cancellationToken);
  Task RecordLoginResultAsync(string accountKey, bool succeeded, DateTimeOffset now, CancellationToken cancellationToken);
}

public interface IAccountResumeExportSource
{
  Task<IReadOnlyList<System.Text.Json.JsonElement>> ReadForOwnerAsync(Guid accountId, CancellationToken cancellationToken);
}

public interface IAccountEmailDispatcher
{
  Task DispatchAvailableAsync(CancellationToken cancellationToken);
}
