using System.Text.Json;
using Azure;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using MongoDB.Bson;
using MongoDB.Bson.IO;
using MongoDB.Driver;
using ResumeBuilder.Application.Resumes;
using ResumeBuilder.Domain.Resumes;

namespace ResumeBuilder.Infrastructure;

/// <summary>Resumes, snapshots and idempotency records. Every read and write is scoped by owner (R-1).</summary>
public sealed class MongoResumeStore : IResumeStore, ISnapshotStore, IIdempotencyStore, IDisposable
{
  private static readonly TimeSpan Lease = TimeSpan.FromSeconds(60);
  private static readonly TimeSpan KeyRetention = TimeSpan.FromHours(24);
  private static readonly JsonWriterSettings ReadableJson = new() { OutputMode = JsonOutputMode.RelaxedExtendedJson };
  private static readonly FilterDefinitionBuilder<BsonDocument> F = Builders<BsonDocument>.Filter;
  private readonly MongoClient client;
  private readonly IMongoCollection<BsonDocument> resumes;
  private readonly IMongoCollection<BsonDocument> locks;
  private readonly IMongoCollection<BsonDocument> snapshotRows;
  private readonly IMongoCollection<BsonDocument> keys;
  private readonly SemaphoreSlim indexGate = new(1, 1);
  private bool indexesReady;

  public MongoResumeStore(string connection)
  {
    client = new MongoClient(connection);
    var database = client.GetDatabase("resumebuilder").WithWriteConcern(DurableWriteConcern).WithReadConcern(ReadConcern.Majority);
    resumes = database.GetCollection<BsonDocument>("resumes");
    locks = database.GetCollection<BsonDocument>("resume_locks");
    snapshotRows = database.GetCollection<BsonDocument>("resume_snapshots");
    keys = database.GetCollection<BsonDocument>("idempotency_keys");
  }

  /// <summary>ADR-037 §5: a 2xx is sent only after the write is acknowledged with `w: majority, j: true`.</summary>
  public static WriteConcern DurableWriteConcern { get; } = WriteConcern.WMajority.With(journal: true);

  private async Task EnsureIndexesAsync(CancellationToken cancellationToken)
  {
    if (Volatile.Read(ref indexesReady)) return;
    await indexGate.WaitAsync(cancellationToken);
    try
    {
      if (indexesReady) return;
      var keysOf = Builders<BsonDocument>.IndexKeys;
      await resumes.Indexes.CreateManyAsync(
      [
        new CreateIndexModel<BsonDocument>(keysOf.Ascending("ownerId").Ascending("deletedAt").Descending("updatedAt").Ascending("_id")),
        new CreateIndexModel<BsonDocument>(keysOf.Ascending("ownerId").Descending("deletedAt").Ascending("_id")),
        new CreateIndexModel<BsonDocument>(keysOf.Ascending("purgeRequestedAt"), new CreateIndexOptions { Sparse = true }),
        new CreateIndexModel<BsonDocument>(keysOf.Ascending("purgeAt")),
        new CreateIndexModel<BsonDocument>(keysOf.Ascending("pendingPhotoRemovals")),
      ], cancellationToken);
      await snapshotRows.Indexes.CreateManyAsync(
      [
        new CreateIndexModel<BsonDocument>(keysOf.Ascending("resumeId").Ascending("resumeVersion"), new CreateIndexOptions { Unique = true }),
        new CreateIndexModel<BsonDocument>(keysOf.Ascending("expiresAt"), new CreateIndexOptions { ExpireAfter = TimeSpan.Zero }),
        new CreateIndexModel<BsonDocument>(keysOf.Ascending("ownerId").Ascending("resumeId").Descending("createdAt").Ascending("_id")),
      ], cancellationToken);
      await keys.Indexes.CreateManyAsync(
      [
        new CreateIndexModel<BsonDocument>(keysOf.Ascending("expiresAt"), new CreateIndexOptions { ExpireAfter = TimeSpan.Zero }),
        new CreateIndexModel<BsonDocument>(keysOf.Ascending("ownerId")),
      ], cancellationToken);
      Volatile.Write(ref indexesReady, true);
    }
    finally { indexGate.Release(); }
  }

  // ---------------------------------------------------------------- resumes

  private static FilterDefinition<BsonDocument> Owned(Guid ownerId, Guid resumeId) => F.Eq("_id", resumeId.ToString()) & F.Eq("ownerId", ownerId.ToString());
  private static FilterDefinition<BsonDocument> OfOwner(Guid ownerId) => F.Eq("ownerId", ownerId.ToString());
  private static FilterDefinition<BsonDocument> NotPurging => F.Eq("purgeRequestedAt", BsonNull.Value);

  public async Task<ResumeAggregate?> FindAsync(Guid ownerId, Guid resumeId, CancellationToken cancellationToken) =>
    await resumes.Find(Owned(ownerId, resumeId) & NotPurging).FirstOrDefaultAsync(cancellationToken) is { } row ? Decode(row) : null;

  public async Task<ResumeAggregate?> FindIncludingPurgingAsync(Guid ownerId, Guid resumeId, CancellationToken cancellationToken) =>
    await resumes.Find(Owned(ownerId, resumeId)).FirstOrDefaultAsync(cancellationToken) is { } row ? Decode(row) : null;

  public async Task<int> CountAsync(Guid ownerId, CancellationToken cancellationToken) =>
    (int)await resumes.CountDocumentsAsync(OfOwner(ownerId) & NotPurging, cancellationToken: cancellationToken);

  public async Task<ResumeInsertOutcome> InsertWithinLimitAsync(ResumeAggregate aggregate, int limit, CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(aggregate);
    await EnsureIndexesAsync(cancellationToken);
    var owner = aggregate.OwnerId.ToString();
    // The lock document exists before the transaction: two first creates must not race on an upsert inside it.
    try { await locks.UpdateOneAsync(F.Eq("_id", owner), Builders<BsonDocument>.Update.SetOnInsert("creates", 0L), new UpdateOptions { IsUpsert = true }, cancellationToken); }
    catch (MongoWriteException error) when (error.WriteError.Category == ServerErrorCategory.DuplicateKey) { /* It exists, which is all that is needed. */ }

    // DD-P07-11: bumping one per-owner document makes concurrent creates of that owner conflict and retry, so the count is exact.
    using var session = await client.StartSessionAsync(cancellationToken: cancellationToken);
    var options = new TransactionOptions(ReadConcern.Snapshot, writeConcern: DurableWriteConcern);
    return await session.WithTransactionAsync(async (transaction, token) =>
    {
      await locks.UpdateOneAsync(transaction, F.Eq("_id", owner), Builders<BsonDocument>.Update.Inc("creates", 1L), cancellationToken: token);
      if (await resumes.Find(transaction, F.Eq("_id", aggregate.Id.ToString())).AnyAsync(token)) return ResumeInsertOutcome.AlreadyExists;
      if (await resumes.CountDocumentsAsync(transaction, OfOwner(aggregate.OwnerId) & NotPurging, cancellationToken: token) >= limit) return ResumeInsertOutcome.LimitReached;
      await resumes.InsertOneAsync(transaction, Encode(aggregate), cancellationToken: token);
      return ResumeInsertOutcome.Created;
    }, options, cancellationToken);
  }

  public async Task<bool> TryReplaceAsync(ResumeAggregate aggregate, long expectedVersion, CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(aggregate);
    var result = await resumes.ReplaceOneAsync(Owned(aggregate.OwnerId, aggregate.Id) & F.Eq("version", expectedVersion), Encode(aggregate), cancellationToken: cancellationToken);
    return result.MatchedCount == 1;
  }

  public async Task<IReadOnlyList<ResumeSummary>> ListAsync(Guid ownerId, ResumeListState state, int take, ListPosition? after, CancellationToken cancellationToken)
  {
    await EnsureIndexesAsync(cancellationToken);
    var sortField = state == ResumeListState.Active ? "updatedAt" : "deletedAt";
    var filter = OfOwner(ownerId) & NotPurging & (state == ResumeListState.Active ? F.Eq("deletedAt", BsonNull.Value) : F.Type("deletedAt", BsonType.DateTime));
    if (after is not null) filter &= Page(sortField, after);
    var rows = await resumes.Find(filter)
      .Sort(Builders<BsonDocument>.Sort.Descending(sortField).Ascending("_id"))
      .Project(Builders<BsonDocument>.Projection.Include("version").Include("createdAt").Include("updatedAt").Include("deletedAt").Include("purgeAt").Include("document.title").Include("document.templateId"))
      .Limit(take)
      .ToListAsync(cancellationToken);
    return [.. rows.Select(row => new ResumeSummary(Guid.Parse(row["_id"].AsString), row["version"].ToInt64(), row["document"]["title"].AsString, row["document"]["templateId"].AsString,
      Date(row["createdAt"]), Date(row["updatedAt"]), NullableDate(row, "deletedAt"), NullableDate(row, "purgeAt")))];
  }

  private static FilterDefinition<BsonDocument> Page(string sortField, ListPosition after)
  {
    var at = DateTimeOffset.FromUnixTimeMilliseconds(after.SortMillis).UtcDateTime;
    return F.Lt(sortField, at) | (F.Eq(sortField, at) & F.Gt("_id", after.Id.ToString()));
  }

  public async Task<IReadOnlyList<ResumeAggregate>> ListAllForOwnerAsync(Guid ownerId, CancellationToken cancellationToken) =>
    [.. (await resumes.Find(OfOwner(ownerId) & NotPurging).ToListAsync(cancellationToken)).Select(Decode)];

  public async Task<IReadOnlyList<ResumeAggregate>> ListPendingLifecycleAsync(int limit, CancellationToken cancellationToken)
  {
    await EnsureIndexesAsync(cancellationToken);
    var pending = F.Type("purgeRequestedAt", BsonType.DateTime) | F.Type("pendingPhotoRemovals", BsonType.String);
    return [.. (await resumes.Find(pending).Limit(limit).ToListAsync(cancellationToken)).Select(Decode)];
  }

  public Task PullPendingPhotoAsync(Guid ownerId, Guid resumeId, Guid photoId, CancellationToken cancellationToken) =>
    resumes.UpdateOneAsync(Owned(ownerId, resumeId), Builders<BsonDocument>.Update.Pull("pendingPhotoRemovals", photoId.ToString()), cancellationToken: cancellationToken);

  public async Task<IReadOnlyList<ResumeAggregate>> ListTrashDueAsync(DateTimeOffset now, int limit, CancellationToken cancellationToken)
  {
    await EnsureIndexesAsync(cancellationToken);
    var due = F.Type("deletedAt", BsonType.DateTime) & F.Lte("purgeAt", now.UtcDateTime) & NotPurging;
    return [.. (await resumes.Find(due).Sort(Builders<BsonDocument>.Sort.Ascending("purgeAt")).Limit(limit).ToListAsync(cancellationToken)).Select(Decode)];
  }

  /// <summary>DD-P13-06: the blobs are gone already, so no pending removal and no `LastOperation`; the version moves so a stale tab gets 412.</summary>
  public async Task<int> ClearPhotoReferencesAsync(Guid ownerId, Guid photoId, CancellationToken cancellationToken)
  {
    var id = photoId.ToString();
    var cleared = await resumes.UpdateManyAsync(OfOwner(ownerId) & F.Eq("photo.id", id),
      Builders<BsonDocument>.Update.Set("photo", BsonNull.Value).Inc("version", 1L), cancellationToken: cancellationToken);
    await resumes.UpdateManyAsync(OfOwner(ownerId) & F.AnyEq("pendingPhotoRemovals", id),
      Builders<BsonDocument>.Update.Pull("pendingPhotoRemovals", id), cancellationToken: cancellationToken);
    return (int)cleared.ModifiedCount;
  }

  public async Task<IReadOnlySet<Guid>> ListPhotoReferencesAsync(Guid ownerId, CancellationToken cancellationToken)
  {
    var rows = await resumes.Find(OfOwner(ownerId))
      .Project(Builders<BsonDocument>.Projection.Include("photo.id").Include("pendingPhotoRemovals"))
      .ToListAsync(cancellationToken);
    var referenced = new HashSet<Guid>();
    foreach (var row in rows)
    {
      if (row.GetValue("photo", BsonNull.Value) is BsonDocument photo) referenced.Add(Guid.Parse(photo["id"].AsString));
      foreach (var pending in row.GetValue("pendingPhotoRemovals", new BsonArray()).AsBsonArray) referenced.Add(Guid.Parse(pending.AsString));
    }
    return referenced;
  }

  public Task DeleteAsync(Guid ownerId, Guid resumeId, CancellationToken cancellationToken) => resumes.DeleteOneAsync(Owned(ownerId, resumeId), cancellationToken);

  async Task IResumeStore.DeleteForOwnerAsync(Guid ownerId, CancellationToken cancellationToken)
  {
    await resumes.DeleteManyAsync(OfOwner(ownerId), cancellationToken);
    await locks.DeleteOneAsync(F.Eq("_id", ownerId.ToString()), cancellationToken);
  }

  private static BsonDocument Encode(ResumeAggregate resume)
  {
    var row = new BsonDocument
    {
      ["_id"] = resume.Id.ToString(),
      ["ownerId"] = resume.OwnerId.ToString(),
      ["version"] = resume.Version,
      ["createdAt"] = resume.CreatedAt.UtcDateTime,
      ["updatedAt"] = resume.UpdatedAt.UtcDateTime,
      ["deletedAt"] = ToBson(resume.DeletedAt),
      ["purgeAt"] = ToBson(resume.PurgeAt),
      ["photo"] = resume.Photo is { } photo ? EncodePhoto(photo) : BsonNull.Value,
      ["document"] = BsonDocument.Parse(ResumeDocumentWriter.ToJson(resume.Document)),
      ["lastWrite"] = resume.LastWrite is { } write ? new BsonDocument { ["key"] = write.Key.ToString(), ["requestHash"] = write.RequestHash, ["version"] = write.Version, ["at"] = write.At.UtcDateTime } : BsonNull.Value,
      ["lastOperation"] = resume.LastOperation is { } operation ? new BsonDocument { ["key"] = operation.Key.ToString(), ["requestHash"] = operation.RequestHash, ["version"] = operation.Version, ["status"] = operation.Status } : BsonNull.Value,
      ["lastAutoSnapshotAt"] = ToBson(resume.LastAutoSnapshotAt),
      ["pendingPhotoRemovals"] = new BsonArray(resume.PendingPhotos.Select(id => id.ToString())),
    };
    if (resume.PurgeRequestedAt is { } purge) row["purgeRequestedAt"] = purge.UtcDateTime;
    return row;
  }

  private static BsonDocument EncodePhoto(PhotoInfo photo) => new()
  {
    ["id"] = photo.Id.ToString(),
    ["mime"] = photo.Mime,
    ["width"] = photo.Width,
    ["height"] = photo.Height,
    ["bytes"] = photo.Bytes,
    ["crop"] = new BsonDocument { ["x"] = photo.Crop.X, ["y"] = photo.Crop.Y, ["width"] = photo.Crop.Width, ["height"] = photo.Crop.Height },
    ["updatedAt"] = photo.UpdatedAt.UtcDateTime,
  };

  private static ResumeAggregate Decode(BsonDocument row) => new(
    Guid.Parse(row["_id"].AsString),
    Guid.Parse(row["ownerId"].AsString),
    row["version"].ToInt64(),
    Date(row["createdAt"]),
    Date(row["updatedAt"]),
    NullableDate(row, "deletedAt"),
    NullableDate(row, "purgeAt"),
    row["photo"].IsBsonNull ? null : DecodePhoto(row["photo"].AsBsonDocument),
    DecodeDocument(row["document"].AsBsonDocument),
    row["lastWrite"].IsBsonNull ? null : new LastDocumentWrite(Guid.Parse(row["lastWrite"]["key"].AsString), row["lastWrite"]["requestHash"].AsString, row["lastWrite"]["version"].ToInt64(), Date(row["lastWrite"]["at"])),
    row["lastOperation"].IsBsonNull ? null : new LastOperation(Guid.Parse(row["lastOperation"]["key"].AsString), row["lastOperation"]["requestHash"].AsString, row["lastOperation"]["version"].ToInt64(), row["lastOperation"]["status"].ToInt32()),
    NullableDate(row, "lastAutoSnapshotAt"),
    NullableDate(row, "purgeRequestedAt"),
    [.. row["pendingPhotoRemovals"].AsBsonArray.Select(id => Guid.Parse(id.AsString))]);

  private static PhotoInfo DecodePhoto(BsonDocument photo)
  {
    var crop = photo["crop"].AsBsonDocument;
    return new PhotoInfo(Guid.Parse(photo["id"].AsString), photo["mime"].AsString, photo["width"].ToInt32(), photo["height"].ToInt32(), photo["bytes"].ToInt64(),
      new PhotoCrop(crop["x"].ToInt32(), crop["y"].ToInt32(), crop["width"].ToInt32(), crop["height"].ToInt32()), Date(photo["updatedAt"]));
  }

  private static ResumeDocument DecodeDocument(BsonDocument document)
  {
    using var parsed = JsonDocument.Parse(document.ToJson(ReadableJson));
    var read = ResumeDocumentReader.Read(parsed.RootElement);
    return read.Document ?? throw new InvalidOperationException("A stored resume document does not match the schema");
  }

  private static BsonValue ToBson(DateTimeOffset? value) => value is { } set ? new BsonDateTime(set.UtcDateTime) : BsonNull.Value;
  private static DateTimeOffset Date(BsonValue value) => new(value.ToUniversalTime());
  private static DateTimeOffset? NullableDate(BsonDocument row, string name) => row.TryGetValue(name, out var value) && !value.IsBsonNull ? Date(value) : null;

  // ---------------------------------------------------------------- snapshots

  public async Task<(ResumeSnapshot Snapshot, bool Created)> InsertOrGetAsync(ResumeSnapshot snapshot, CancellationToken cancellationToken)
  {
    ArgumentNullException.ThrowIfNull(snapshot);
    await EnsureIndexesAsync(cancellationToken);
    try
    {
      await snapshotRows.InsertOneAsync(EncodeSnapshot(snapshot), cancellationToken: cancellationToken);
      return (snapshot, true);
    }
    catch (MongoWriteException error) when (error.WriteError.Category == ServerErrorCategory.DuplicateKey)
    {
      var filter = OfOwner(snapshot.OwnerId) & F.Eq("resumeId", snapshot.ResumeId.ToString()) & F.Eq("resumeVersion", snapshot.ResumeVersion);
      return (DecodeSnapshot(await snapshotRows.Find(filter).FirstAsync(cancellationToken)), false);
    }
  }

  public async Task<ResumeSnapshot?> FindAsync(Guid ownerId, Guid resumeId, Guid snapshotId, CancellationToken cancellationToken)
  {
    var filter = F.Eq("_id", snapshotId.ToString()) & OfOwner(ownerId) & F.Eq("resumeId", resumeId.ToString());
    return await snapshotRows.Find(filter).FirstOrDefaultAsync(cancellationToken) is { } row ? DecodeSnapshot(row) : null;
  }

  public async Task<IReadOnlyList<ResumeSnapshot>> ListAsync(Guid ownerId, Guid resumeId, int take, ListPosition? after, CancellationToken cancellationToken)
  {
    await EnsureIndexesAsync(cancellationToken);
    var filter = OfOwner(ownerId) & F.Eq("resumeId", resumeId.ToString());
    if (after is not null) filter &= Page("createdAt", after);
    var rows = await snapshotRows.Find(filter)
      .Sort(Builders<BsonDocument>.Sort.Descending("createdAt").Ascending("_id"))
      .Project(Builders<BsonDocument>.Projection.Exclude("document"))
      .Limit(take)
      .ToListAsync(cancellationToken);
    return [.. rows.Select(DecodeSnapshot)];
  }

  public async Task<long> DeleteExpiredAsync(DateTimeOffset now, CancellationToken cancellationToken) =>
    (await snapshotRows.DeleteManyAsync(F.Lte("expiresAt", now.UtcDateTime), cancellationToken)).DeletedCount;

  public Task DeleteForResumeAsync(Guid ownerId, Guid resumeId, CancellationToken cancellationToken) =>
    snapshotRows.DeleteManyAsync(OfOwner(ownerId) & F.Eq("resumeId", resumeId.ToString()), cancellationToken);

  Task ISnapshotStore.DeleteForOwnerAsync(Guid ownerId, CancellationToken cancellationToken) => snapshotRows.DeleteManyAsync(OfOwner(ownerId), cancellationToken);

  private static BsonDocument EncodeSnapshot(ResumeSnapshot snapshot) => new()
  {
    ["_id"] = snapshot.Id.ToString(),
    ["ownerId"] = snapshot.OwnerId.ToString(),
    ["resumeId"] = snapshot.ResumeId.ToString(),
    ["resumeVersion"] = snapshot.ResumeVersion,
    ["reason"] = snapshot.Reason,
    ["createdAt"] = snapshot.CreatedAt.UtcDateTime,
    ["expiresAt"] = snapshot.ExpiresAt.UtcDateTime,
    ["document"] = BsonDocument.Parse(ResumeDocumentWriter.ToJson(snapshot.Document!)),
  };

  private static ResumeSnapshot DecodeSnapshot(BsonDocument row) => new(
    Guid.Parse(row["_id"].AsString), Guid.Parse(row["ownerId"].AsString), Guid.Parse(row["resumeId"].AsString), row["resumeVersion"].ToInt64(), row["reason"].AsString,
    Date(row["createdAt"]), Date(row["expiresAt"]), row.TryGetValue("document", out var document) ? DecodeDocument(document.AsBsonDocument) : null);

  // ---------------------------------------------------------------- idempotency

  private static string KeyId(Guid ownerId, Guid key) => $"{ownerId}:{key}";

  public async Task<IdempotencyBegin> BeginAsync(Guid ownerId, Guid key, string requestHash, Guid proposedResourceId, DateTimeOffset now, CancellationToken cancellationToken)
  {
    await EnsureIndexesAsync(cancellationToken);
    var id = KeyId(ownerId, key);
    var fresh = new BsonDocument
    {
      ["_id"] = id,
      ["ownerId"] = ownerId.ToString(),
      ["key"] = key.ToString(),
      ["requestHash"] = requestHash,
      ["state"] = "in_progress",
      ["leaseUntil"] = (now + Lease).UtcDateTime,
      ["resourceId"] = proposedResourceId.ToString(),
      ["status"] = BsonNull.Value,
      ["version"] = BsonNull.Value,
      ["expiresAt"] = (now + KeyRetention).UtcDateTime,
    };
    try
    {
      await keys.InsertOneAsync(fresh, cancellationToken: cancellationToken);
      return new IdempotencyBegin(IdempotencyBeginKind.Started, proposedResourceId, null, null, 0);
    }
    catch (MongoWriteException error) when (error.WriteError.Category == ServerErrorCategory.DuplicateKey) { /* The key exists: read it below. */ }

    var row = await keys.Find(F.Eq("_id", id)).FirstOrDefaultAsync(cancellationToken);
    if (row is null || Date(row["expiresAt"]) <= now)
    {
      // Past its 24 hours but not yet collected by the TTL monitor: the key is free again.
      await keys.ReplaceOneAsync(F.Eq("_id", id), fresh, new ReplaceOptions { IsUpsert = true }, cancellationToken);
      return new IdempotencyBegin(IdempotencyBeginKind.Started, proposedResourceId, null, null, 0);
    }
    var resource = Guid.Parse(row["resourceId"].AsString);
    if (row["requestHash"].AsString != requestHash) return new IdempotencyBegin(IdempotencyBeginKind.Reused, resource, null, null, 0);
    var state = row["state"].AsString;
    if (state == "completed") return new IdempotencyBegin(IdempotencyBeginKind.Replay, resource, row["status"].ToInt32(), row["version"].IsBsonNull ? null : row["version"].ToInt64(), 0);
    var leaseUntil = Date(row["leaseUntil"]);
    if (state == "in_progress" && leaseUntil > now)
      return new IdempotencyBegin(IdempotencyBeginKind.InFlight, resource, null, null, Math.Max(1, (int)Math.Ceiling((leaseUntil - now).TotalSeconds)));

    var claim = F.Eq("_id", id) & F.Eq("state", state) & F.Eq("leaseUntil", leaseUntil.UtcDateTime);
    var claimed = await keys.UpdateOneAsync(claim, Builders<BsonDocument>.Update.Set("state", "in_progress").Set("leaseUntil", (now + Lease).UtcDateTime), cancellationToken: cancellationToken);
    return claimed.ModifiedCount == 1
      ? new IdempotencyBegin(IdempotencyBeginKind.Started, resource, null, null, 0, state == "in_progress")
      : new IdempotencyBegin(IdempotencyBeginKind.InFlight, resource, null, null, 1);
  }

  public Task CompleteAsync(Guid ownerId, Guid key, int status, Guid resourceId, long? version, CancellationToken cancellationToken)
  {
    BsonValue storedVersion = version is long set ? new BsonInt64(set) : BsonNull.Value;
    return keys.UpdateOneAsync(F.Eq("_id", KeyId(ownerId, key)), Builders<BsonDocument>.Update.Set("state", "completed").Set("status", status).Set("resourceId", resourceId.ToString()).Set("version", storedVersion), cancellationToken: cancellationToken);
  }

  public Task ReleaseAsync(Guid ownerId, Guid key, CancellationToken cancellationToken) =>
    keys.UpdateOneAsync(F.Eq("_id", KeyId(ownerId, key)) & F.Eq("state", "in_progress"), Builders<BsonDocument>.Update.Set("state", "released"), cancellationToken: cancellationToken);

  Task IIdempotencyStore.DeleteForOwnerAsync(Guid ownerId, CancellationToken cancellationToken) => keys.DeleteManyAsync(OfOwner(ownerId), cancellationToken);

  public void Dispose()
  {
    indexGate.Dispose();
    client.Dispose();
  }
}

/// <summary>ADR-009: private blobs, reached only through the API after an owner check. Keys carry IDs and no user text.</summary>
public sealed class AzurePhotoStorage(string connection) : IPhotoStorage, IPhotoInventory, IDisposable
{
  private readonly BlobContainerClient container = new BlobServiceClient(connection, new BlobClientOptions(BlobClientOptions.ServiceVersion.V2024_11_04)).GetBlobContainerClient("photos");
  private readonly SemaphoreSlim containerGate = new(1, 1);
  private bool containerReady;

  private static string Key(Guid ownerId, Guid photoId, PhotoVariant variant) => $"u/{ownerId}/p/{photoId}/{(variant == PhotoVariant.Master ? "master" : "rendition")}";

  private async Task EnsureContainerAsync(CancellationToken cancellationToken)
  {
    if (Volatile.Read(ref containerReady)) return;
    await containerGate.WaitAsync(cancellationToken);
    try
    {
      if (containerReady) return;
      await container.CreateIfNotExistsAsync(PublicAccessType.None, cancellationToken: cancellationToken);
      Volatile.Write(ref containerReady, true);
    }
    finally { containerGate.Release(); }
  }

  public async Task PutAsync(Guid ownerId, Guid photoId, PhotoVariant variant, byte[] bytes, string contentType, CancellationToken cancellationToken)
  {
    await EnsureContainerAsync(cancellationToken);
    using var stream = new MemoryStream(bytes, writable: false);
    await container.GetBlobClient(Key(ownerId, photoId, variant)).UploadAsync(stream, new BlobUploadOptions { HttpHeaders = new BlobHttpHeaders { ContentType = contentType } }, cancellationToken);
  }

  public async Task<byte[]?> GetAsync(Guid ownerId, Guid photoId, PhotoVariant variant, CancellationToken cancellationToken)
  {
    await EnsureContainerAsync(cancellationToken);
    try
    {
      var content = await container.GetBlobClient(Key(ownerId, photoId, variant)).DownloadContentAsync(cancellationToken);
      return content.Value.Content.ToArray();
    }
    catch (RequestFailedException error) when (error.Status == 404) { return null; }
  }

  public async Task CopyAsync(Guid ownerId, Guid sourcePhotoId, Guid targetPhotoId, CancellationToken cancellationToken)
  {
    foreach (var variant in new[] { PhotoVariant.Master, PhotoVariant.Rendition })
    {
      var content = await container.GetBlobClient(Key(ownerId, sourcePhotoId, variant)).DownloadContentAsync(cancellationToken);
      await PutAsync(ownerId, targetPhotoId, variant, content.Value.Content.ToArray(), content.Value.Details.ContentType, cancellationToken);
    }
  }

  public async Task DeleteAsync(Guid ownerId, Guid photoId, CancellationToken cancellationToken)
  {
    await EnsureContainerAsync(cancellationToken);
    await container.GetBlobClient(Key(ownerId, photoId, PhotoVariant.Master)).DeleteIfExistsAsync(cancellationToken: cancellationToken);
    await container.GetBlobClient(Key(ownerId, photoId, PhotoVariant.Rendition)).DeleteIfExistsAsync(cancellationToken: cancellationToken);
  }

  public async Task DeleteOwnerAsync(Guid ownerId, CancellationToken cancellationToken)
  {
    await EnsureContainerAsync(cancellationToken);
    await foreach (var blob in container.GetBlobsAsync(new GetBlobsOptions { Prefix = $"u/{ownerId}/" }, cancellationToken))
      await container.GetBlobClient(blob.Name).DeleteIfExistsAsync(cancellationToken: cancellationToken);
  }

  public Task<IReadOnlyList<Guid>> ListOwnersAsync(CancellationToken cancellationToken) => ListFolders("u/", cancellationToken);

  public Task<IReadOnlyList<Guid>> ListPhotosAsync(Guid ownerId, CancellationToken cancellationToken) => ListFolders($"u/{ownerId}/p/", cancellationToken);

  /// <summary>The GUID-named folders directly under a prefix. Anything else under it is not ours to judge and is left alone.</summary>
  private async Task<IReadOnlyList<Guid>> ListFolders(string prefix, CancellationToken cancellationToken)
  {
    await EnsureContainerAsync(cancellationToken);
    var folders = new List<Guid>();
    await foreach (var item in container.GetBlobsByHierarchyAsync(new GetBlobsByHierarchyOptions { Prefix = prefix, Delimiter = "/" }, cancellationToken))
      if (item.IsPrefix && Guid.TryParse(item.Prefix[prefix.Length..].TrimEnd('/'), out var id)) folders.Add(id);
    return folders;
  }

  public void Dispose() => containerGate.Dispose();
}
