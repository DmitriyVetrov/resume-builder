using ResumeBuilder.Application.Accounts;
using ResumeBuilder.Domain.Resumes;

namespace ResumeBuilder.Application.Resumes;

public abstract record CreateResumeCommand;
public sealed record CreateFromDocument(ResumeDocument Document, Guid? CopyPhotoFromResumeId) : CreateResumeCommand;
public sealed record CreateCopy(Guid SourceResumeId, string? Title) : CreateResumeCommand;

public enum IfMatchKind { Missing, Malformed, Version }
public readonly record struct IfMatchValue(IfMatchKind Kind, long Version);

public sealed record KeyedRequest(Guid OwnerId, Guid Key, string Hash);

public enum ResumeFailureKind { NotFound, Trashed, NotTrashed, LimitReached, KeyReused, InProgress, PreconditionRequired, IfMatchMalformed, VersionMismatch, Validation, PhotoInvalid }

public sealed record ResumeFailure(ResumeFailureKind Kind, IReadOnlyList<DocumentIssue>? Issues = null, int RetryAfterSeconds = 0, long CurrentVersion = 0, DateTimeOffset UpdatedAt = default);

public sealed record DocumentWriteOutcome(Guid Id, long Version, DateTimeOffset UpdatedAt, IReadOnlyList<DocumentWarning> Warnings);

/// <summary>What one operation answered. `Resume` and `Snapshot` are the current representation; `ETagVersion` is the original result's.</summary>
public sealed record ResumeResult(int Status, ResumeFailure? Failure = null, ResumeAggregate? Resume = null, long? ETagVersion = null, ResumeSnapshot? Snapshot = null, DocumentWriteOutcome? Write = null);

public sealed record ResumeListPage(IReadOnlyList<ResumeSummary> Items, string? NextCursor);
public sealed record SnapshotListPage(IReadOnlyList<ResumeSnapshot> Items, string? NextCursor);
public sealed record PhotoImage(byte[] Bytes, string Mime);

public interface IResumeUseCases
{
  Task<ResumeListPage> ListAsync(Guid ownerId, ResumeListState state, int limit, ListPosition? after, CancellationToken cancellationToken);
  Task<ResumeAggregate?> GetAsync(Guid ownerId, Guid resumeId, CancellationToken cancellationToken);
  Task<ResumeResult> CreateAsync(KeyedRequest request, CreateResumeCommand command, CancellationToken cancellationToken);
  Task<ResumeResult> ReplaceDocumentAsync(KeyedRequest request, Guid resumeId, ResumeDocument document, IfMatchValue ifMatch, CancellationToken cancellationToken);
  Task<ResumeResult> TrashAsync(KeyedRequest request, Guid resumeId, IfMatchValue ifMatch, CancellationToken cancellationToken);
  Task<ResumeResult> RestoreAsync(KeyedRequest request, Guid resumeId, IfMatchValue ifMatch, CancellationToken cancellationToken);
  Task<ResumeResult> PurgeAsync(KeyedRequest request, Guid resumeId, IfMatchValue ifMatch, CancellationToken cancellationToken);
  Task<SnapshotListPage?> ListSnapshotsAsync(Guid ownerId, Guid resumeId, int limit, ListPosition? after, CancellationToken cancellationToken);
  Task<ResumeSnapshot?> GetSnapshotAsync(Guid ownerId, Guid resumeId, Guid snapshotId, CancellationToken cancellationToken);
  Task<ResumeResult> CreateSnapshotAsync(KeyedRequest request, Guid resumeId, CancellationToken cancellationToken);
  Task<ResumeResult> UploadPhotoAsync(KeyedRequest request, Guid resumeId, byte[] file, PhotoFormat format, IfMatchValue ifMatch, CancellationToken cancellationToken);
  Task<ResumeResult> UpdateCropAsync(KeyedRequest request, Guid resumeId, PhotoCrop crop, IfMatchValue ifMatch, CancellationToken cancellationToken);
  Task<ResumeResult> RemovePhotoAsync(KeyedRequest request, Guid resumeId, IfMatchValue ifMatch, CancellationToken cancellationToken);
  Task<PhotoImage?> GetPhotoAsync(Guid ownerId, Guid resumeId, PhotoVariant variant, CancellationToken cancellationToken);
}

/// <summary>The business order of every operation: replay or 422, then existence, trash state, If-Match, domain rules, write (DD-P07-08).</summary>
public sealed class ResumeUseCases(
  IResumeStore store,
  ISnapshotStore snapshots,
  IIdempotencyStore keys,
  IPhotoStorage photos,
  IPhotoProcessor processor,
  IResumeLifecycle lifecycle,
  IResumeDiagnostics diagnostics,
  IClock clock) : IResumeUseCases
{
  private static ResumeResult Fail(ResumeFailureKind kind) => new(0, new ResumeFailure(kind));
  private static ResumeResult Invalid(IReadOnlyList<DocumentIssue> issues) => new(0, new ResumeFailure(ResumeFailureKind.Validation, issues));

  // ---------------------------------------------------------------- reads

  public static string ResumeListQuery(ResumeListState state) => state == ResumeListState.Active ? "resumes:active" : "resumes:trashed";
  public static string SnapshotListQuery(Guid resumeId) => $"snapshots:{resumeId}";

  public async Task<ResumeListPage> ListAsync(Guid ownerId, ResumeListState state, int limit, ListPosition? after, CancellationToken cancellationToken)
  {
    var items = await store.ListAsync(ownerId, state, limit + 1, after, cancellationToken);
    if (items.Count <= limit) return new ResumeListPage(items, null);
    var page = items.Take(limit).ToArray();
    var last = page[^1];
    var sort = state == ResumeListState.Active ? last.UpdatedAt : last.DeletedAt!.Value;
    return new ResumeListPage(page, PageCursor.Encode(ownerId, ResumeListQuery(state), sort.ToUnixTimeMilliseconds(), last.Id));
  }

  public Task<ResumeAggregate?> GetAsync(Guid ownerId, Guid resumeId, CancellationToken cancellationToken) => store.FindAsync(ownerId, resumeId, cancellationToken);

  public async Task<SnapshotListPage?> ListSnapshotsAsync(Guid ownerId, Guid resumeId, int limit, ListPosition? after, CancellationToken cancellationToken)
  {
    if (await store.FindAsync(ownerId, resumeId, cancellationToken) is null) return null;
    var items = await snapshots.ListAsync(ownerId, resumeId, limit + 1, after, cancellationToken);
    if (items.Count <= limit) return new SnapshotListPage(items, null);
    var page = items.Take(limit).ToArray();
    return new SnapshotListPage(page, PageCursor.Encode(ownerId, SnapshotListQuery(resumeId), page[^1].CreatedAt.ToUnixTimeMilliseconds(), page[^1].Id));
  }

  public async Task<ResumeSnapshot?> GetSnapshotAsync(Guid ownerId, Guid resumeId, Guid snapshotId, CancellationToken cancellationToken)
  {
    if (await store.FindAsync(ownerId, resumeId, cancellationToken) is null) return null;
    return await snapshots.FindAsync(ownerId, resumeId, snapshotId, cancellationToken);
  }

  public async Task<PhotoImage?> GetPhotoAsync(Guid ownerId, Guid resumeId, PhotoVariant variant, CancellationToken cancellationToken)
  {
    if (await store.FindAsync(ownerId, resumeId, cancellationToken) is not { Photo: { } photo }) return null;
    var bytes = await photos.GetAsync(ownerId, photo.Id, variant, cancellationToken);
    return bytes is null ? null : new PhotoImage(bytes, variant == PhotoVariant.Master ? photo.Mime : "image/jpeg");
  }

  // ---------------------------------------------------------------- the keyed frame

  /// <summary>
  /// DD-P07-09. `work` runs only with the lease held; a failure answer wrote nothing and is released, so its retry
  /// is evaluated again while a different body stays 422.
  /// </summary>
  private async Task<ResumeResult> Keyed(KeyedRequest request, Func<IdempotencyBegin, Task<ResumeResult>> work, Func<IdempotencyBegin, Task<ResumeResult>> replay, Func<ResumeResult, Guid> resourceOf, CancellationToken cancellationToken)
  {
    var begin = await keys.BeginAsync(request.OwnerId, request.Key, request.Hash, Guid.CreateVersion7(clock.UtcNow), clock.UtcNow, cancellationToken);
    switch (begin.Kind)
    {
      case IdempotencyBeginKind.Replay: return await replay(begin);
      case IdempotencyBeginKind.Reused: return Fail(ResumeFailureKind.KeyReused);
      case IdempotencyBeginKind.InFlight: return new ResumeResult(0, new ResumeFailure(ResumeFailureKind.InProgress, RetryAfterSeconds: begin.RetryAfterSeconds));
    }
    ResumeResult result;
    try { result = await work(begin); }
    catch (Exception error) when (error is not OperationCanceledException)
    {
      await keys.ReleaseAsync(request.OwnerId, request.Key, CancellationToken.None);
      throw;
    }
    if (result.Failure is null) await keys.CompleteAsync(request.OwnerId, request.Key, result.Status, resourceOf(result), result.ETagVersion, cancellationToken);
    else await keys.ReleaseAsync(request.OwnerId, request.Key, cancellationToken);
    return result;
  }

  /// <summary>Existence, photo, trash state and If-Match, in the contract's order. An effect this request already applied short-circuits to its replay.</summary>
  private async Task<(ResumeAggregate? Resume, ResumeResult? Answer)> Gate(KeyedRequest request, Guid resumeId, IfMatchValue ifMatch, bool mustBeTrashed, bool needsPhoto, CancellationToken cancellationToken)
  {
    var resume = await store.FindIncludingPurgingAsync(request.OwnerId, resumeId, cancellationToken);
    if (resume is null) return (null, Fail(ResumeFailureKind.NotFound));
    if (AppliedBy(resume, request) is { } applied) return (resume, applied);
    if (resume.PurgeRequestedAt is not null) return (null, Fail(ResumeFailureKind.NotFound));
    if (needsPhoto && resume.Photo is null) return (null, Fail(ResumeFailureKind.NotFound));
    if (mustBeTrashed && resume.DeletedAt is null) return (null, Fail(ResumeFailureKind.NotTrashed));
    if (!mustBeTrashed && resume.DeletedAt is not null) return (null, Fail(ResumeFailureKind.Trashed));
    return Precondition(resume, ifMatch) is { } failure ? (null, failure) : (resume, null);
  }

  private static ResumeResult? AppliedBy(ResumeAggregate resume, KeyedRequest request) =>
    resume.LastOperation is { } last && last.Key == request.Key && last.RequestHash == request.Hash
      ? new ResumeResult(last.Status, Resume: resume, ETagVersion: last.Version)
      : null;

  private static ResumeResult? Precondition(ResumeAggregate resume, IfMatchValue ifMatch) => ifMatch.Kind switch
  {
    IfMatchKind.Missing => Fail(ResumeFailureKind.PreconditionRequired),
    IfMatchKind.Malformed => Fail(ResumeFailureKind.IfMatchMalformed),
    _ when ifMatch.Version != resume.Version => Stale(resume),
    _ => null,
  };

  private static ResumeResult Stale(ResumeAggregate resume) =>
    new(0, new ResumeFailure(ResumeFailureKind.VersionMismatch, CurrentVersion: resume.Version, UpdatedAt: resume.UpdatedAt));

  /// <summary>The conditional write lost a race: the twin's replay when it carried this key, otherwise 404 or 412.</summary>
  private async Task<ResumeResult> AfterLostRace(KeyedRequest request, Guid resumeId, CancellationToken cancellationToken)
  {
    var current = await store.FindIncludingPurgingAsync(request.OwnerId, resumeId, cancellationToken);
    if (current is null) return Fail(ResumeFailureKind.NotFound);
    return AppliedBy(current, request) ?? (current.PurgeRequestedAt is not null ? Fail(ResumeFailureKind.NotFound) : Stale(current));
  }

  private async Task<ResumeResult> ReplayState(KeyedRequest request, Guid resumeId, IdempotencyBegin begin, CancellationToken cancellationToken)
  {
    var resume = await store.FindAsync(request.OwnerId, resumeId, cancellationToken);
    return resume is null ? Fail(ResumeFailureKind.NotFound) : new ResumeResult(begin.Status!.Value, Resume: resume, ETagVersion: begin.Version);
  }

  // ---------------------------------------------------------------- create

  public Task<ResumeResult> CreateAsync(KeyedRequest request, CreateResumeCommand command, CancellationToken cancellationToken) => Keyed(
    request,
    begin => CreateCoreAsync(request, command, begin.ResourceId, cancellationToken),
    begin => ReplayState(request, begin.ResourceId, begin, cancellationToken),
    result => result.Resume!.Id,
    cancellationToken);

  private async Task<ResumeResult> CreateCoreAsync(KeyedRequest request, CreateResumeCommand command, Guid reservedId, CancellationToken cancellationToken)
  {
    // A crash after the insert, before the record completed: the reserved ID makes the effect visible (DD-P07-09).
    if (await store.FindAsync(request.OwnerId, reservedId, cancellationToken) is { } existing)
      return new ResumeResult(201, Resume: existing, ETagVersion: 1);

    ResumeDocument document;
    PhotoInfo? sourcePhoto = null;
    switch (command)
    {
      case CreateCopy copy:
        var source = await store.FindAsync(request.OwnerId, copy.SourceResumeId, cancellationToken);
        if (source is null) return Fail(ResumeFailureKind.NotFound);
        if (source.DeletedAt is not null) return Fail(ResumeFailureKind.Trashed);
        document = copy.Title is null ? source.Document : source.Document with { Title = copy.Title };
        sourcePhoto = source.Photo;
        break;
      case CreateFromDocument fromDocument:
        document = fromDocument.Document;
        if (fromDocument.CopyPhotoFromResumeId is Guid photoSource)
        {
          // DD-P07-18: a trashed photo source is allowed, a conflict copy must not lose its photo.
          var owner = await store.FindAsync(request.OwnerId, photoSource, cancellationToken);
          if (owner is null) return Fail(ResumeFailureKind.NotFound);
          sourcePhoto = owner.Photo;
        }
        break;
      default:
        throw new ArgumentOutOfRangeException(nameof(command));
    }

    var issues = ResumeDocumentRules.Validate(document, command is CreateFromDocument ? "/document" : "");
    if (issues.Count > 0) return Invalid(issues);
    if (await store.CountAsync(request.OwnerId, cancellationToken) >= ResumeLimits.ResumesPerUser) return Fail(ResumeFailureKind.LimitReached);

    var now = clock.UtcNow;
    PhotoInfo? photo = null;
    if (sourcePhoto is not null)
    {
      // The reserved ID doubles as the photo ID, so a retry overwrites its own blobs and leaves no orphan.
      await photos.CopyAsync(request.OwnerId, sourcePhoto.Id, reservedId, cancellationToken);
      photo = sourcePhoto with { Id = reservedId, UpdatedAt = now };
    }
    var resume = ResumeAggregate.Create(reservedId, request.OwnerId, document, photo, now);
    var outcome = await store.InsertWithinLimitAsync(resume, ResumeLimits.ResumesPerUser, cancellationToken);
    if (outcome == ResumeInsertOutcome.LimitReached)
    {
      if (photo is not null) await photos.DeleteAsync(request.OwnerId, photo.Id, cancellationToken);
      return Fail(ResumeFailureKind.LimitReached);
    }
    return new ResumeResult(201, Resume: resume, ETagVersion: resume.Version);
  }

  // ---------------------------------------------------------------- document

  public async Task<ResumeResult> ReplaceDocumentAsync(KeyedRequest request, Guid resumeId, ResumeDocument document, IfMatchValue ifMatch, CancellationToken cancellationToken)
  {
    var warnings = ResumeDocumentRules.Warnings(document);
    var resume = await store.FindAsync(request.OwnerId, resumeId, cancellationToken);
    if (resume is null) return Fail(ResumeFailureKind.NotFound);
    if (DocumentReplay(resume, request, warnings) is { } replay) return replay;
    if (resume.DeletedAt is not null) return Fail(ResumeFailureKind.Trashed);
    if (Precondition(resume, ifMatch) is { } failure) return failure;
    var issues = ResumeDocumentRules.Validate(document);
    if (issues.Count > 0) return Invalid(issues);

    var now = clock.UtcNow;
    var takeSnapshot = resume.IsAutoSnapshotDue(now);
    var updated = resume.ReplaceDocument(document, request.Key, request.Hash, now, takeSnapshot);
    if (!await store.TryReplaceAsync(updated, resume.Version, cancellationToken))
    {
      // ADR-037 and DD-P07-09: the loser of a race re-reads. The same key and hash means its twin won.
      var current = await store.FindAsync(request.OwnerId, resumeId, cancellationToken);
      if (current is null) return Fail(ResumeFailureKind.NotFound);
      return DocumentReplay(current, request, warnings) ?? Stale(current);
    }
    if (takeSnapshot) await TakeAutomaticSnapshotAsync(updated, now, cancellationToken);
    return new ResumeResult(200, Resume: updated, ETagVersion: updated.Version, Write: new DocumentWriteOutcome(updated.Id, updated.Version, now, warnings));
  }

  private static ResumeResult? DocumentReplay(ResumeAggregate resume, KeyedRequest request, IReadOnlyList<DocumentWarning> warnings)
  {
    if (resume.LastWrite is not { } last || last.Key != request.Key) return null;
    if (last.RequestHash != request.Hash) return Fail(ResumeFailureKind.KeyReused);
    return new ResumeResult(200, Resume: resume, ETagVersion: last.Version, Write: new DocumentWriteOutcome(resume.Id, last.Version, last.At, warnings));
  }

  /// <summary>DD-P07-12: a failed automatic snapshot never fails the acknowledged save.</summary>
  private async Task TakeAutomaticSnapshotAsync(ResumeAggregate resume, DateTimeOffset now, CancellationToken cancellationToken)
  {
    try
    {
      await snapshots.InsertOrGetAsync(new ResumeSnapshot(Guid.CreateVersion7(now), resume.OwnerId, resume.Id, resume.Version, "auto", now, now + ResumeLimits.SnapshotRetention, resume.Document), cancellationToken);
    }
    catch (Exception error) when (error is not OperationCanceledException) { diagnostics.AutomaticSnapshotFailed(); }
  }

  // ---------------------------------------------------------------- trash, restore, purge

  public Task<ResumeResult> TrashAsync(KeyedRequest request, Guid resumeId, IfMatchValue ifMatch, CancellationToken cancellationToken) =>
    Transition(request, resumeId, ifMatch, false, (resume, now) => resume.Trash(request.Key, request.Hash, now), cancellationToken);

  public Task<ResumeResult> RestoreAsync(KeyedRequest request, Guid resumeId, IfMatchValue ifMatch, CancellationToken cancellationToken) =>
    Transition(request, resumeId, ifMatch, true, (resume, now) => resume.Restore(request.Key, request.Hash, now), cancellationToken);

  private Task<ResumeResult> Transition(KeyedRequest request, Guid resumeId, IfMatchValue ifMatch, bool mustBeTrashed, Func<ResumeAggregate, DateTimeOffset, ResumeAggregate> step, CancellationToken cancellationToken) => Keyed(
    request,
    async _ =>
    {
      var (resume, answer) = await Gate(request, resumeId, ifMatch, mustBeTrashed, false, cancellationToken);
      if (answer is not null) return answer;
      var updated = step(resume!, clock.UtcNow);
      return await store.TryReplaceAsync(updated, resume!.Version, cancellationToken)
        ? new ResumeResult(200, Resume: updated, ETagVersion: updated.Version)
        : await AfterLostRace(request, resumeId, cancellationToken);
    },
    begin => ReplayState(request, resumeId, begin, cancellationToken),
    _ => resumeId,
    cancellationToken);

  public Task<ResumeResult> PurgeAsync(KeyedRequest request, Guid resumeId, IfMatchValue ifMatch, CancellationToken cancellationToken) => Keyed(
    request,
    async begin =>
    {
      var (resume, answer) = await Gate(request, resumeId, ifMatch, true, false, cancellationToken);
      // The earlier attempt may have finished everything and died before completing the record.
      if (answer?.Failure is { Kind: ResumeFailureKind.NotFound } && begin.TakenOver) return new ResumeResult(204);
      if (answer is { Failure: not null }) return answer;
      // A first phase this request already applied is resumed (DD-P07-10).
      var purging = answer?.Resume ?? resume!;
      if (answer is null)
      {
        purging = resume!.RequestPurge(request.Key, request.Hash, clock.UtcNow);
        if (!await store.TryReplaceAsync(purging, resume.Version, cancellationToken)) return await AfterLostRace(request, resumeId, cancellationToken);
      }
      await lifecycle.FinishPurgeAsync(purging, cancellationToken);
      return new ResumeResult(204);
    },
    _ => Task.FromResult(new ResumeResult(204)),
    _ => resumeId,
    cancellationToken);

  // ---------------------------------------------------------------- snapshots

  public Task<ResumeResult> CreateSnapshotAsync(KeyedRequest request, Guid resumeId, CancellationToken cancellationToken) => Keyed(
    request,
    async begin =>
    {
      var resume = await store.FindAsync(request.OwnerId, resumeId, cancellationToken);
      if (resume is null) return Fail(ResumeFailureKind.NotFound);
      if (resume.DeletedAt is not null) return Fail(ResumeFailureKind.Trashed);
      var now = clock.UtcNow;
      var (snapshot, created) = await snapshots.InsertOrGetAsync(new ResumeSnapshot(begin.ResourceId, request.OwnerId, resumeId, resume.Version, "before_export", now, now + ResumeLimits.SnapshotRetention, resume.Document), cancellationToken);
      return new ResumeResult(created || snapshot.Id == begin.ResourceId ? 201 : 200, Snapshot: snapshot);
    },
    async begin =>
    {
      var snapshot = await snapshots.FindAsync(request.OwnerId, resumeId, begin.ResourceId, cancellationToken);
      return snapshot is null ? Fail(ResumeFailureKind.NotFound) : new ResumeResult(begin.Status!.Value, Snapshot: snapshot);
    },
    result => result.Snapshot!.Id,
    cancellationToken);

  // ---------------------------------------------------------------- photos

  public Task<ResumeResult> UploadPhotoAsync(KeyedRequest request, Guid resumeId, byte[] file, PhotoFormat format, IfMatchValue ifMatch, CancellationToken cancellationToken) => Keyed(
    request,
    async begin =>
    {
      var (resume, answer) = await Gate(request, resumeId, ifMatch, false, false, cancellationToken);
      if (answer is not null) return answer;
      var master = await processor.NormalizeAsync(file, format, cancellationToken);
      if (master is null) return Fail(ResumeFailureKind.PhotoInvalid);
      var now = clock.UtcNow;
      var crop = PhotoCrop.DefaultFor(master.Width, master.Height);
      var rendition = await processor.RenderCropAsync(master.Bytes, crop, cancellationToken);
      // The reserved ID is the photo ID, so a retry overwrites these blobs rather than orphaning them.
      var photoId = begin.ResourceId;
      await photos.PutAsync(request.OwnerId, photoId, PhotoVariant.Master, master.Bytes, master.Mime, cancellationToken);
      await photos.PutAsync(request.OwnerId, photoId, PhotoVariant.Rendition, rendition, "image/jpeg", cancellationToken);
      var updated = resume!.SetPhoto(new PhotoInfo(photoId, master.Mime, master.Width, master.Height, master.Bytes.Length, crop, now), request.Key, request.Hash, now);
      if (!await store.TryReplaceAsync(updated, resume.Version, cancellationToken))
      {
        await photos.DeleteAsync(request.OwnerId, photoId, cancellationToken);
        return await AfterLostRace(request, resumeId, cancellationToken);
      }
      await CleanUpPhotosAsync(updated, cancellationToken);
      return new ResumeResult(200, Resume: updated, ETagVersion: updated.Version);
    },
    begin => ReplayPhoto(request, resumeId, begin, cancellationToken),
    _ => resumeId,
    cancellationToken);

  public Task<ResumeResult> UpdateCropAsync(KeyedRequest request, Guid resumeId, PhotoCrop crop, IfMatchValue ifMatch, CancellationToken cancellationToken) => Keyed(
    request,
    async _ =>
    {
      var (resume, answer) = await Gate(request, resumeId, ifMatch, false, true, cancellationToken);
      if (answer is not null) return answer;
      var photo = resume!.Photo!;
      if (crop.Violation(photo.Width, photo.Height) is { } issue) return Invalid([issue]);
      await RenderAsync(request.OwnerId, photo.Id, crop, cancellationToken);
      var updated = resume.SetCrop(crop, request.Key, request.Hash, clock.UtcNow);
      if (await store.TryReplaceAsync(updated, resume.Version, cancellationToken)) return new ResumeResult(200, Resume: updated, ETagVersion: updated.Version);
      // The rendition belongs to the document that won the race, not to this lost crop.
      var afterRace = await AfterLostRace(request, resumeId, cancellationToken);
      if (await store.FindAsync(request.OwnerId, resumeId, cancellationToken) is { Photo: { } winner } && winner.Id == photo.Id)
        await RenderAsync(request.OwnerId, winner.Id, winner.Crop, cancellationToken);
      return afterRace;
    },
    begin => ReplayPhoto(request, resumeId, begin, cancellationToken),
    _ => resumeId,
    cancellationToken);

  private async Task RenderAsync(Guid ownerId, Guid photoId, PhotoCrop crop, CancellationToken cancellationToken)
  {
    var master = await photos.GetAsync(ownerId, photoId, PhotoVariant.Master, cancellationToken) ?? throw new InvalidOperationException("The photo master is missing");
    var rendition = await processor.RenderCropAsync(master, crop, cancellationToken);
    await photos.PutAsync(ownerId, photoId, PhotoVariant.Rendition, rendition, "image/jpeg", cancellationToken);
  }

  public Task<ResumeResult> RemovePhotoAsync(KeyedRequest request, Guid resumeId, IfMatchValue ifMatch, CancellationToken cancellationToken) => Keyed(
    request,
    async _ =>
    {
      var (resume, answer) = await Gate(request, resumeId, ifMatch, false, true, cancellationToken);
      if (answer is not null) return answer;
      var updated = resume!.RemovePhoto(request.Key, request.Hash, clock.UtcNow);
      if (!await store.TryReplaceAsync(updated, resume.Version, cancellationToken)) return await AfterLostRace(request, resumeId, cancellationToken);
      await CleanUpPhotosAsync(updated, cancellationToken);
      return new ResumeResult(200, Resume: updated, ETagVersion: updated.Version);
    },
    begin => ReplayState(request, resumeId, begin, cancellationToken),
    _ => resumeId,
    cancellationToken);

  /// <summary>A photo replay whose photo has since gone has no representation left, so it answers 404.</summary>
  private async Task<ResumeResult> ReplayPhoto(KeyedRequest request, Guid resumeId, IdempotencyBegin begin, CancellationToken cancellationToken)
  {
    var replay = await ReplayState(request, resumeId, begin, cancellationToken);
    return replay.Resume is { Photo: null } ? Fail(ResumeFailureKind.NotFound) : replay;
  }

  /// <summary>DD-P07-10: the write is already durable, so a failed cleanup keeps the 200 and the worker finishes it.</summary>
  private async Task CleanUpPhotosAsync(ResumeAggregate resume, CancellationToken cancellationToken)
  {
    try { await lifecycle.FinishPhotoRemovalsAsync(resume, cancellationToken); }
    catch (Exception error) when (error is not OperationCanceledException) { diagnostics.PhotoCleanupDeferred(); }
  }
}

/// <summary>ADR-039 §2: blobs first, then snapshots, resumes and idempotency records. Idempotent.</summary>
public sealed class ResumeAccountPurger(IResumeStore store, ISnapshotStore snapshots, IIdempotencyStore keys, IPhotoStorage photos) : IAccountOwnedDataPurger
{
  public async Task PurgeAsync(Guid accountId, CancellationToken cancellationToken)
  {
    await photos.DeleteOwnerAsync(accountId, cancellationToken);
    await snapshots.DeleteForOwnerAsync(accountId, cancellationToken);
    await store.DeleteForOwnerAsync(accountId, cancellationToken);
    await keys.DeleteForOwnerAsync(accountId, cancellationToken);
  }
}

/// <summary>FR-ACC-04: every resume of the owner, active and trashed, in the contract's `Resume` shape.</summary>
public sealed class ResumeAccountExportSource(IResumeStore store) : IAccountResumeExportSource
{
  public async Task<IReadOnlyList<System.Text.Json.JsonElement>> ReadForOwnerAsync(Guid accountId, CancellationToken cancellationToken)
  {
    var resumes = await store.ListAllForOwnerAsync(accountId, cancellationToken);
    return [.. resumes.Select(resume =>
    {
      using var document = System.Text.Json.JsonDocument.Parse(ResumeRepresentation.Resume(resume));
      return document.RootElement.Clone();
    })];
  }
}
