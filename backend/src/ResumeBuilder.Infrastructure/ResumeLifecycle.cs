using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using ResumeBuilder.Application.Accounts;
using ResumeBuilder.Application.Resumes;
using ResumeBuilder.Domain.Resumes;

namespace ResumeBuilder.Infrastructure;

/// <summary>
/// The second phase of a purge or photo removal (DD-P07-10): ledger, then blobs, then rows. Each step is idempotent,
/// so a retry or the worker can finish what a crash interrupted.
/// </summary>
public sealed class ResumeLifecycle(IResumeStore store, ISnapshotStore snapshots, IPhotoStorage photos, IResumeDeletionLedger ledger, IResumeDiagnostics diagnostics, IClock clock) : IResumeLifecycle
{
  private const int Batch = 100;

  public async Task FinishPurgeAsync(ResumeAggregate aggregate, CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(aggregate);
    var now = clock.UtcNow;
    List<Guid> photoIds = [.. aggregate.PendingPhotos];
    if (aggregate.Photo is { } photo) photoIds.Add(photo.Id);
    await ledger.RecordResumeAsync(aggregate.Id, aggregate.OwnerId, now, cancellationToken);
    foreach (var photoId in photoIds) await ledger.RecordPhotoAsync(photoId, aggregate.OwnerId, now, cancellationToken);
    foreach (var photoId in photoIds) await photos.DeleteAsync(aggregate.OwnerId, photoId, cancellationToken);
    await snapshots.DeleteForResumeAsync(aggregate.OwnerId, aggregate.Id, cancellationToken);
    await store.DeleteAsync(aggregate.OwnerId, aggregate.Id, cancellationToken);
  }

  public async Task FinishPhotoRemovalsAsync(ResumeAggregate aggregate, CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(aggregate);
    foreach (var photoId in aggregate.PendingPhotos)
    {
      await ledger.RecordPhotoAsync(photoId, aggregate.OwnerId, clock.UtcNow, cancellationToken);
      await photos.DeleteAsync(aggregate.OwnerId, photoId, cancellationToken);
      await store.PullPendingPhotoAsync(aggregate.OwnerId, aggregate.Id, photoId, cancellationToken);
    }
  }

  public async Task ProcessPendingAsync(CancellationToken cancellationToken)
  {
    var attempted = new HashSet<Guid>();
    var pending = 0;
    while (true)
    {
      // A resume that keeps failing stays in the result, so page past it instead of stopping behind it.
      var due = await store.ListPendingLifecycleAsync(Batch + attempted.Count, cancellationToken);
      var next = due.Where(resume => !attempted.Contains(resume.Id)).Take(Batch).ToArray();
      if (next.Length == 0) break;
      foreach (var resume in next)
      {
        attempted.Add(resume.Id);
        try
        {
          if (resume.PurgeRequestedAt is not null) await FinishPurgeAsync(resume, cancellationToken);
          else await FinishPhotoRemovalsAsync(resume, cancellationToken);
        }
        catch (Exception error) when (error is not OperationCanceledException) { pending++; }
      }
    }
    if (pending > 0) diagnostics.LifecycleWorkPending(pending, attempted.Count);
  }
}

/// <summary>Counts and event names only: no ID, title or any other content reaches a log (rule 03).</summary>
public sealed class ResumeDiagnostics(ILogger<ResumeDiagnostics> logger) : IResumeDiagnostics
{
  private static readonly Action<ILogger, Exception?> SnapshotFailed =
    LoggerMessage.Define(LogLevel.Warning, new EventId(20), "resume_auto_snapshot_failed the save stands without its automatic snapshot");
  private static readonly Action<ILogger, Exception?> CleanupDeferred =
    LoggerMessage.Define(LogLevel.Warning, new EventId(21), "resume_photo_cleanup_deferred the lifecycle worker will finish removing a photo");
  private static readonly Action<ILogger, int, int, Exception?> WorkPending =
    LoggerMessage.Define<int, int>(LogLevel.Warning, new EventId(22), "resume_lifecycle_pending {PendingCount} of {AttemptedCount} attempted resumes did not finish");

  public void AutomaticSnapshotFailed() => SnapshotFailed(logger, null);
  public void PhotoCleanupDeferred() => CleanupDeferred(logger, null);
  public void LifecycleWorkPending(int pending, int attempted) => WorkPending(logger, pending, attempted, null);
}
