using MongoDB.Bson;
using MongoDB.Driver;
using ResumeBuilder.Application.Accounts;

namespace ResumeBuilder.Infrastructure;

public sealed class MongoAccountSecurityCounters : IAccountSecurityCounters, IDisposable
{
  private readonly MongoClient client;
  private readonly SemaphoreSlim indexGate = new(1, 1);
  private bool indexed;
  private readonly IMongoCollection<BsonDocument> counters;
  public MongoAccountSecurityCounters(string connection)
  {
    client = new MongoClient(connection);
    counters = client.GetDatabase("resumebuilder").WithWriteConcern(WriteConcern.WMajority).GetCollection<BsonDocument>("account_security_counters");
  }
  private async Task EnsureIndexAsync(CancellationToken cancellationToken)
  {
    await indexGate.WaitAsync(cancellationToken);
    try
    {
      if (indexed) return;
      await counters.Indexes.CreateOneAsync(new CreateIndexModel<BsonDocument>(Builders<BsonDocument>.IndexKeys.Ascending("ExpiresAt"), new CreateIndexOptions { ExpireAfter = TimeSpan.Zero }), cancellationToken: cancellationToken);
      indexed = true;
    }
    finally { indexGate.Release(); }
  }
  public async Task<bool> TryAcquireEmailAsync(string addressKey, DateTimeOffset now, CancellationToken cancellationToken)
  {
    await EnsureIndexAsync(cancellationToken);
    var hour = now.ToUnixTimeSeconds() / 3600;
    var id = "email:" + addressKey + ":" + hour.ToString(System.Globalization.CultureInfo.InvariantCulture);
    var filter = Builders<BsonDocument>.Filter.Eq("_id", id);
    var update = Builders<BsonDocument>.Update.Inc("Count", 1).SetOnInsert("ExpiresAt", now.AddHours(2).UtcDateTime);
    BsonDocument result;
    try
    {
      result = await counters.FindOneAndUpdateAsync(filter, update,
        new FindOneAndUpdateOptions<BsonDocument> { IsUpsert = true, ReturnDocument = ReturnDocument.After }, cancellationToken);
    }
    catch (MongoCommandException error) when (error.Code == 11000)
    {
      result = await counters.FindOneAndUpdateAsync(filter, update,
        new FindOneAndUpdateOptions<BsonDocument> { ReturnDocument = ReturnDocument.After }, cancellationToken);
    }
    return result["Count"].AsInt32 <= 5;
  }
  public async Task<TimeSpan?> GetLoginDelayAsync(string accountKey, DateTimeOffset now, CancellationToken cancellationToken)
  {
    var result = await counters.Find(Builders<BsonDocument>.Filter.Eq("_id", "login:" + accountKey)).FirstOrDefaultAsync(cancellationToken);
    if (result is null || result["BlockedUntil"].IsBsonNull) return null;
    var delay = new DateTimeOffset(result["BlockedUntil"].ToUniversalTime()) - now;
    return delay > TimeSpan.Zero ? delay : null;
  }
  public async Task RecordLoginResultAsync(string accountKey, bool succeeded, DateTimeOffset now, CancellationToken cancellationToken)
  {
    await EnsureIndexAsync(cancellationToken);
    var id = "login:" + accountKey;
    var byId = Builders<BsonDocument>.Filter.Eq("_id", id);
    if (succeeded) { await counters.DeleteOneAsync(byId, cancellationToken); return; }
    while (true)
    {
      var old = await counters.Find(byId).FirstOrDefaultAsync(cancellationToken);
      var expired = old is null || new DateTimeOffset(old["ExpiresAt"].ToUniversalTime()) <= now;
      var reset = expired || new DateTimeOffset(old!["StartedAt"].ToUniversalTime()).AddMinutes(15) <= now;
      var count = reset ? 1 : old!["Count"].AsInt32 + 1;
      var revision = old is null ? 0 : old["Revision"].AsInt32;
      var previousLevel = expired ? 0 : old!.GetValue("PenaltyLevel", 0).AsInt32;
      var level = count >= 5 || previousLevel > 0 ? Math.Min(7, previousLevel + 1) : 0;
      var delay = level == 0 ? TimeSpan.Zero : TimeSpan.FromMinutes(Math.Min(60, Math.Pow(2, level - 1)));
      var next = new BsonDocument
      {
        ["_id"] = id,
        ["Revision"] = revision + 1,
        ["Count"] = count,
        ["PenaltyLevel"] = level,
        ["StartedAt"] = reset ? new BsonDateTime(now.UtcDateTime) : old!["StartedAt"],
        ["BlockedUntil"] = delay == TimeSpan.Zero ? BsonNull.Value : new BsonDateTime(now.Add(delay).UtcDateTime),
        ["ExpiresAt"] = now.AddHours(2).UtcDateTime
      };
      if (old is null)
      {
        try { await counters.InsertOneAsync(next, cancellationToken: cancellationToken); return; }
        catch (MongoWriteException error) when (error.WriteError.Category == ServerErrorCategory.DuplicateKey) { }
      }
      else if ((await counters.ReplaceOneAsync(byId & Builders<BsonDocument>.Filter.Eq("Revision", revision), next, cancellationToken: cancellationToken)).ModifiedCount > 0) return;
    }
  }
  public void Dispose() { indexGate.Dispose(); client.Dispose(); }
}
