namespace ResumeBuilder.Domain.Resumes;

public sealed record PhotoCrop(int X, int Y, int Width, int Height)
{
  /// <summary>The largest centred square of a master of the given size (FR-PHO-01).</summary>
  public static PhotoCrop DefaultFor(int width, int height)
  {
    var side = Math.Min(width, height);
    return new PhotoCrop((width - side) / 2, (height - side) / 2, side, side);
  }

  /// <summary>The issue of an invalid crop for this master, or null when the crop is valid.</summary>
  public DocumentIssue? Violation(int masterWidth, int masterHeight)
  {
    if (Width != Height) return new DocumentIssue("body", "/height", "crop_not_square");
    if (X + Width > masterWidth) return new DocumentIssue("body", "/width", "crop_out_of_bounds");
    if (Y + Height > masterHeight) return new DocumentIssue("body", "/height", "crop_out_of_bounds");
    return null;
  }
}

public sealed record PhotoInfo(Guid Id, string Mime, int Width, int Height, long Bytes, PhotoCrop Crop, DateTimeOffset UpdatedAt);

/// <summary>ADR-037 §3: the last document write, remembered without expiry so a retry replays instead of answering 412.</summary>
public sealed record LastDocumentWrite(Guid Key, string RequestHash, long Version, DateTimeOffset At);

/// <summary>DD-P07-09: stamped in the same atomic write as a versioned non-document effect, so a crash before the idempotency record completes still replays.</summary>
public sealed record LastOperation(Guid Key, string RequestHash, long Version, int Status);

/// <summary>The resume aggregate. Every transition returns a new value and increments the version by exactly 1 (R-8).</summary>
public sealed record ResumeAggregate(
  Guid Id,
  Guid OwnerId,
  long Version,
  DateTimeOffset CreatedAt,
  DateTimeOffset UpdatedAt,
  DateTimeOffset? DeletedAt,
  DateTimeOffset? PurgeAt,
  PhotoInfo? Photo,
  ResumeDocument Document,
  LastDocumentWrite? LastWrite = null,
  LastOperation? LastOperation = null,
  DateTimeOffset? LastAutoSnapshotAt = null,
  DateTimeOffset? PurgeRequestedAt = null,
  IReadOnlyList<Guid>? PendingPhotoRemovals = null)
{
  public IReadOnlyList<Guid> PendingPhotos => PendingPhotoRemovals ?? [];

  public static ResumeAggregate Create(Guid id, Guid ownerId, ResumeDocument document, PhotoInfo? photo, DateTimeOffset now) =>
    new(id, ownerId, 1, now, now, null, null, photo, document);

  /// <summary>DD-P07-12: at the first document write, then when at least ten minutes passed since the last automatic one.</summary>
  public bool IsAutoSnapshotDue(DateTimeOffset now) =>
    LastAutoSnapshotAt is not { } last || now - last >= ResumeLimits.AutoSnapshotInterval;

  public ResumeAggregate ReplaceDocument(ResumeDocument document, Guid key, string requestHash, DateTimeOffset now, bool takeAutoSnapshot) =>
    this with
    {
      Version = Version + 1,
      UpdatedAt = now,
      Document = document,
      LastWrite = new LastDocumentWrite(key, requestHash, Version + 1, now),
      LastAutoSnapshotAt = takeAutoSnapshot ? now : LastAutoSnapshotAt,
    };

  public ResumeAggregate Trash(Guid key, string requestHash, DateTimeOffset now) =>
    Step(key, requestHash, now, 200) with { DeletedAt = now, PurgeAt = now + ResumeLimits.TrashRetention };

  public ResumeAggregate Restore(Guid key, string requestHash, DateTimeOffset now) =>
    Step(key, requestHash, now, 200) with { DeletedAt = null, PurgeAt = null };

  public ResumeAggregate RequestPurge(Guid key, string requestHash, DateTimeOffset now) =>
    Step(key, requestHash, now, 204) with { PurgeRequestedAt = now };

  public ResumeAggregate SetPhoto(PhotoInfo photo, Guid key, string requestHash, DateTimeOffset now) =>
    Step(key, requestHash, now, 200) with { Photo = photo, PendingPhotoRemovals = WithPendingCurrentPhoto() };

  public ResumeAggregate SetCrop(PhotoCrop crop, Guid key, string requestHash, DateTimeOffset now) =>
    Step(key, requestHash, now, 200) with { Photo = Photo! with { Crop = crop, UpdatedAt = now } };

  public ResumeAggregate RemovePhoto(Guid key, string requestHash, DateTimeOffset now) =>
    Step(key, requestHash, now, 200) with { Photo = null, PendingPhotoRemovals = WithPendingCurrentPhoto() };

  private ResumeAggregate Step(Guid key, string requestHash, DateTimeOffset now, int status) =>
    this with { Version = Version + 1, UpdatedAt = now, LastOperation = new LastOperation(key, requestHash, Version + 1, status) };

  private List<Guid> WithPendingCurrentPhoto() => Photo is { } photo ? [.. PendingPhotos, photo.Id] : [.. PendingPhotos];
}
