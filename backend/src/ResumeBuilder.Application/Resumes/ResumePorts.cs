using ResumeBuilder.Domain.Resumes;

namespace ResumeBuilder.Application.Resumes;

public enum ResumeInsertOutcome { Created, LimitReached, AlreadyExists }
public enum ResumeListState { Active, Trashed }

public sealed record ListPosition(long SortMillis, Guid Id);

public sealed record ResumeSummary(Guid Id, long Version, string Title, string TemplateId, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, DateTimeOffset? DeletedAt, DateTimeOffset? PurgeAt);

/// <summary>Every read and write names the owner (R-1). There is no unscoped resume read.</summary>
public interface IResumeStore
{
  /// <summary>The resume, unless it does not exist, belongs to someone else or a purge has started.</summary>
  Task<ResumeAggregate?> FindAsync(Guid ownerId, Guid resumeId, CancellationToken cancellationToken);
  /// <summary>As <see cref="FindAsync"/>, but also returns a resume whose purge has started, so a retry can finish it.</summary>
  Task<ResumeAggregate?> FindIncludingPurgingAsync(Guid ownerId, Guid resumeId, CancellationToken cancellationToken);
  Task<int> CountAsync(Guid ownerId, CancellationToken cancellationToken);
  /// <summary>DD-P07-11: serialised per owner, so the count cannot race.</summary>
  Task<ResumeInsertOutcome> InsertWithinLimitAsync(ResumeAggregate aggregate, int limit, CancellationToken cancellationToken);
  /// <summary>ADR-037 §2: one conditional replace. False means the version is stale or the resume is gone.</summary>
  Task<bool> TryReplaceAsync(ResumeAggregate aggregate, long expectedVersion, CancellationToken cancellationToken);
  Task<IReadOnlyList<ResumeSummary>> ListAsync(Guid ownerId, ResumeListState state, int take, ListPosition? after, CancellationToken cancellationToken);
  Task<IReadOnlyList<ResumeAggregate>> ListAllForOwnerAsync(Guid ownerId, CancellationToken cancellationToken);
  /// <summary>Resumes with an interrupted purge or photo removal. Used only by the lifecycle worker (DD-P07-10).</summary>
  Task<IReadOnlyList<ResumeAggregate>> ListPendingLifecycleAsync(int limit, CancellationToken cancellationToken);
  Task PullPendingPhotoAsync(Guid ownerId, Guid resumeId, Guid photoId, CancellationToken cancellationToken);
  /// <summary>Trashed resumes whose 30 days ended at or before <paramref name="now"/> and whose purge has not started (ADR-016). Lifecycle jobs only.</summary>
  Task<IReadOnlyList<ResumeAggregate>> ListTrashDueAsync(DateTimeOffset now, int limit, CancellationToken cancellationToken);
  /// <summary>ADR-039 §4 step 4: drops a deleted photo from every resume of the owner that still names it. Returns the number of resumes changed.</summary>
  Task<int> ClearPhotoReferencesAsync(Guid ownerId, Guid photoId, CancellationToken cancellationToken);
  /// <summary>ADR-039 §4 step 6, DD-P13-05: photo IDs any resume of the owner references, active or trashed, current or pending removal.</summary>
  Task<IReadOnlySet<Guid>> ListPhotoReferencesAsync(Guid ownerId, CancellationToken cancellationToken);
  Task DeleteAsync(Guid ownerId, Guid resumeId, CancellationToken cancellationToken);
  Task DeleteForOwnerAsync(Guid ownerId, CancellationToken cancellationToken);
}

public sealed record ResumeSnapshot(Guid Id, Guid OwnerId, Guid ResumeId, long ResumeVersion, string Reason, DateTimeOffset CreatedAt, DateTimeOffset ExpiresAt, ResumeDocument? Document);

public interface ISnapshotStore
{
  /// <summary>Unique per resume version: the existing snapshot is returned when that version already has one.</summary>
  Task<(ResumeSnapshot Snapshot, bool Created)> InsertOrGetAsync(ResumeSnapshot snapshot, CancellationToken cancellationToken);
  Task<ResumeSnapshot?> FindAsync(Guid ownerId, Guid resumeId, Guid snapshotId, CancellationToken cancellationToken);
  Task<IReadOnlyList<ResumeSnapshot>> ListAsync(Guid ownerId, Guid resumeId, int take, ListPosition? after, CancellationToken cancellationToken);
  Task DeleteForResumeAsync(Guid ownerId, Guid resumeId, CancellationToken cancellationToken);
  Task DeleteForOwnerAsync(Guid ownerId, CancellationToken cancellationToken);
  /// <summary>ADR-039 §4 step 5: snapshots whose 30 days ended at <paramref name="now"/>, deleted explicitly rather than left to the TTL monitor.</summary>
  Task<long> DeleteExpiredAsync(DateTimeOffset now, CancellationToken cancellationToken);
}

public enum IdempotencyBeginKind { Started, Replay, Reused, InFlight }

/// <param name="ResourceId">The reserved ID while started; the completed resource when replaying.</param>
/// <param name="TakenOver">The attempt inherited an expired lease, so an earlier attempt may have applied the effect.</param>
public sealed record IdempotencyBegin(IdempotencyBeginKind Kind, Guid ResourceId, int? Status, long? Version, int RetryAfterSeconds, bool TakenOver = false);

/// <summary>DD-P07-09: a hash-bound record with state, lease and reserved resource ID. Keys are owner-scoped.</summary>
public interface IIdempotencyStore
{
  Task<IdempotencyBegin> BeginAsync(Guid ownerId, Guid key, string requestHash, Guid proposedResourceId, DateTimeOffset now, CancellationToken cancellationToken);
  Task CompleteAsync(Guid ownerId, Guid key, int status, Guid resourceId, long? version, CancellationToken cancellationToken);
  /// <summary>The attempt wrote nothing. The hash stays bound; a retry of the same request is evaluated again.</summary>
  Task ReleaseAsync(Guid ownerId, Guid key, CancellationToken cancellationToken);
  Task DeleteForOwnerAsync(Guid ownerId, CancellationToken cancellationToken);
}

public enum PhotoVariant { Master, Rendition }
public enum PhotoFormat { Jpeg, Png, Webp }

public sealed record ProcessedMaster(byte[] Bytes, string Mime, int Width, int Height);

/// <summary>ADR-009 §8 and T-TA-04: magic-byte detection, bounded decode, re-encode. Raw upload bytes never leave this port.</summary>
public interface IPhotoProcessor
{
  PhotoFormat? Detect(ReadOnlySpan<byte> upload);
  /// <summary>The metadata-free, orientation-normalised master, or null when the image is `photo_invalid`.</summary>
  Task<ProcessedMaster?> NormalizeAsync(byte[] upload, PhotoFormat format, CancellationToken cancellationToken);
  Task<byte[]> RenderCropAsync(byte[] master, PhotoCrop crop, CancellationToken cancellationToken);
}

/// <summary>Content-free events the use cases report. Implementations log counts and event names only.</summary>
public interface IResumeDiagnostics
{
  void AutomaticSnapshotFailed();
  void PhotoCleanupDeferred();
  void LifecycleWorkPending(int pending, int attempted);
}

/// <summary>ADR-009 §4: keys are `u/{ownerId}/p/{photoId}/master|rendition`, with no user text.</summary>
public interface IPhotoStorage
{
  Task PutAsync(Guid ownerId, Guid photoId, PhotoVariant variant, byte[] bytes, string contentType, CancellationToken cancellationToken);
  Task<byte[]?> GetAsync(Guid ownerId, Guid photoId, PhotoVariant variant, CancellationToken cancellationToken);
  Task CopyAsync(Guid ownerId, Guid sourcePhotoId, Guid targetPhotoId, CancellationToken cancellationToken);
  Task DeleteAsync(Guid ownerId, Guid photoId, CancellationToken cancellationToken);
  Task DeleteOwnerAsync(Guid ownerId, CancellationToken cancellationToken);
}

/// <summary>ADR-039 §3: every entry is written to both stores before anything is deleted. IDs only.</summary>
public interface IResumeDeletionLedger
{
  Task RecordResumeAsync(Guid resumeId, Guid ownerId, DateTimeOffset recordedAt, CancellationToken cancellationToken);
  Task RecordPhotoAsync(Guid photoId, Guid ownerId, DateTimeOffset recordedAt, CancellationToken cancellationToken);
}

/// <summary>The second phase of a purge or photo removal (DD-P07-10). Idempotent, so the worker can finish interrupted work.</summary>
public interface IResumeLifecycle
{
  Task FinishPurgeAsync(ResumeAggregate aggregate, CancellationToken cancellationToken);
  Task FinishPhotoRemovalsAsync(ResumeAggregate aggregate, CancellationToken cancellationToken);
  Task ProcessPendingAsync(CancellationToken cancellationToken);
}
