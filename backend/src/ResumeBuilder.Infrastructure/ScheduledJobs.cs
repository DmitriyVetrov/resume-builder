using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;
using ResumeBuilder.Application.Accounts;
using ResumeBuilder.Application.Resumes;

namespace ResumeBuilder.Infrastructure;

/// <summary>A periodic, idempotent piece of lifecycle work. The name is a constant and doubles as the lease key.</summary>
public interface IScheduledJob
{
  string Name { get; }
  TimeSpan Period { get; }
  Task RunAsync(CancellationToken cancellationToken);
}

/// <summary>ADR-007, DD-P13-03: one holder per job name until the lease expires.</summary>
public interface IJobLease
{
  Task<bool> TryAcquireAsync(string job, string holder, DateTimeOffset now, TimeSpan duration, CancellationToken cancellationToken);
}

/// <summary>
/// `job_leases`, one row per job name. One conditional upsert: it matches when the lease expired or this holder owns it;
/// otherwise the upsert collides on `_id` and the lease stays with its holder.
/// </summary>
public sealed class MongoJobLease : IJobLease, IDisposable
{
  private readonly MongoClient client;
  private readonly IMongoCollection<BsonDocument> leases;

  public MongoJobLease(string connection)
  {
    client = new MongoClient(connection);
    leases = client.GetDatabase("resumebuilder").WithWriteConcern(WriteConcern.WMajority).GetCollection<BsonDocument>("job_leases");
  }

  public async Task<bool> TryAcquireAsync(string job, string holder, DateTimeOffset now, TimeSpan duration, CancellationToken cancellationToken)
  {
    var f = Builders<BsonDocument>.Filter;
    var free = f.Eq("_id", job) & (f.Lte("expiresAt", now.UtcDateTime) | f.Eq("holder", holder));
    var take = Builders<BsonDocument>.Update.Set("holder", holder).Set("expiresAt", (now + duration).UtcDateTime);
    try
    {
      await leases.UpdateOneAsync(free, take, new UpdateOptions { IsUpsert = true }, cancellationToken);
      return true;
    }
    catch (MongoWriteException error) when (error.WriteError.Category == ServerErrorCategory.DuplicateKey) { return false; }
  }

  public void Dispose() => client.Dispose();
}

public sealed class ScheduledJobWorker(IScheduledJob job, IJobLease lease, IClock clock, ILogger<ScheduledJobWorker> logger, string? holder = null) : BackgroundService
{
  public static readonly string ProcessHolder = $"{Environment.MachineName}/{Environment.ProcessId}/{Guid.NewGuid():N}";
  private readonly string owner = holder ?? ProcessHolder;

  /// <summary>One tick: true when this holder had the lease and ran the job. A failing job is logged by name and never stops the host.</summary>
  public async Task<bool> RunOnceAsync(CancellationToken cancellationToken)
  {
    // The lease lasts one period and is not released, so another replica cannot run the same period again.
    if (!await lease.TryAcquireAsync(job.Name, owner, clock.UtcNow, job.Period, cancellationToken)) return false;
    try { await job.RunAsync(cancellationToken); }
    catch (Exception error) when (error is not OperationCanceledException) { JobLogs.Failed(logger, job.Name); }
    return true;
  }

  protected override async Task ExecuteAsync(CancellationToken stoppingToken)
  {
    using var timer = new PeriodicTimer(job.Period);
    while (await timer.WaitForNextTickAsync(stoppingToken))
    {
      try { await RunOnceAsync(stoppingToken); }
      catch (Exception error) when (error is not OperationCanceledException) { JobLogs.Failed(logger, job.Name); }
    }
  }
}

/// <summary>
/// A job built when it runs, not when the host starts: the stores behind a job need Blob configuration that a host without
/// it (P04's host tests, a probe-only start) must not resolve. A failure to build is a failed run, logged by the worker.
/// </summary>
public sealed class DeferredJob(string name, TimeSpan period, Func<IScheduledJob> create) : IScheduledJob
{
  public string Name => name;
  public TimeSpan Period => period;
  public Task RunAsync(CancellationToken cancellationToken) => create().RunAsync(cancellationToken);
}

public sealed class AccountPurgeJob(IAccountDeletionProcessor processor) : IScheduledJob
{
  public const string JobName = "account-purge";
  public static readonly TimeSpan JobPeriod = TimeSpan.FromMinutes(15);
  public string Name => JobName;
  public TimeSpan Period => JobPeriod;
  public Task RunAsync(CancellationToken cancellationToken) => processor.ProcessDueAsync(cancellationToken);
}

public sealed class ResumeLifecycleJob(IResumeLifecycle lifecycle) : IScheduledJob
{
  public const string JobName = "resume-lifecycle";
  public static readonly TimeSpan JobPeriod = TimeSpan.FromMinutes(15);
  public string Name => JobName;
  public TimeSpan Period => JobPeriod;
  public Task RunAsync(CancellationToken cancellationToken) => lifecycle.ProcessPendingAsync(cancellationToken);
}

/// <summary>ADR-016, DD-P13-02: purges trash older than 30 days through the ledger-first purge.</summary>
public sealed class TrashExpiryJob(IResumeStore store, IResumeLifecycle lifecycle, IClock clock, ILogger<TrashExpiryJob> logger) : IScheduledJob
{
  private const int Batch = 100;
  /// <summary>The request hash of a system purge; no client request has it.</summary>
  private const string SystemRequest = "system:trash-expiry";

  public const string JobName = "trash-expiry";
  public static readonly TimeSpan JobPeriod = TimeSpan.FromHours(1);
  public string Name => JobName;
  public TimeSpan Period => JobPeriod;

  /// <summary>The number of resumes purged.</summary>
  public async Task<int> PurgeDueAsync(CancellationToken cancellationToken)
  {
    var attempted = new HashSet<Guid>();
    var purged = 0;
    var failed = 0;
    while (true)
    {
      var now = clock.UtcNow;
      // A resume that keeps failing stays in the result, so page past it instead of stopping behind it.
      var due = await store.ListTrashDueAsync(now, Batch + attempted.Count, cancellationToken);
      var next = due.Where(resume => !attempted.Contains(resume.Id)).Take(Batch).ToArray();
      if (next.Length == 0) break;
      foreach (var resume in next)
      {
        attempted.Add(resume.Id);
        try
        {
          // The first phase is conditional on the version read, so a restore that landed first wins.
          var purging = resume.RequestPurge(Guid.NewGuid(), SystemRequest, now);
          if (!await store.TryReplaceAsync(purging, resume.Version, cancellationToken)) continue;
          await lifecycle.FinishPurgeAsync(purging, cancellationToken);
          purged++;
        }
        catch (Exception error) when (error is not OperationCanceledException) { failed++; }
      }
    }
    // A resume whose second phase failed is hidden already; the lifecycle worker finishes it.
    if (failed > 0) JobLogs.TrashPending(logger, failed, attempted.Count);
    return purged;
  }

  public Task RunAsync(CancellationToken cancellationToken) => PurgeDueAsync(cancellationToken);
}

/// <summary>Job names and counts only (rule 03). CA1848-compliant.</summary>
internal static class JobLogs
{
  private static readonly Action<ILogger, string, Exception?> FailedMessage =
    LoggerMessage.Define<string>(LogLevel.Warning, new EventId(40), "scheduled_job_failed {Job} the next period retries");
  private static readonly Action<ILogger, int, int, Exception?> TrashPendingMessage =
    LoggerMessage.Define<int, int>(LogLevel.Warning, new EventId(41), "trash_expiry_pending {PendingCount} of {AttemptedCount} expired resumes did not finish; the lifecycle worker retries");
  public static void Failed(ILogger logger, string job) => FailedMessage(logger, job, null);
  public static void TrashPending(ILogger logger, int pending, int attempted) => TrashPendingMessage(logger, pending, attempted, null);
}
