using Microsoft.AspNetCore.DataProtection;
using MongoDB.Bson;
using MongoDB.Driver;
using ResumeBuilder.Application.Accounts;

namespace ResumeBuilder.Infrastructure;

public sealed class MongoAccountStore : IAccountStore, IAccountTokenStore, ISessionStore, IEmailOutboxStore, IDisposable
{
  private readonly MongoClient client;
  private readonly IMongoCollection<BsonDocument> collection;
  private readonly IMongoCollection<BsonDocument> tokenCollection;
  private readonly IMongoCollection<BsonDocument> sessionCollection;
  private readonly IMongoCollection<BsonDocument> outboxCollection;
  private readonly Microsoft.AspNetCore.DataProtection.IDataProtector outboxProtector;
  private readonly SemaphoreSlim indexGate = new(1, 1);
  private bool indexesReady;

  public MongoAccountStore(string connection, Microsoft.AspNetCore.DataProtection.IDataProtectionProvider protection)
  {
    client = new MongoClient(connection);
    var db = client.GetDatabase("resumebuilder").WithWriteConcern(WriteConcern.WMajority);
    collection = db.GetCollection<BsonDocument>("accounts");
    tokenCollection = db.GetCollection<BsonDocument>("account_tokens");
    sessionCollection = db.GetCollection<BsonDocument>("account_sessions");
    outboxCollection = db.GetCollection<BsonDocument>("account_outbox");
    outboxProtector = protection.CreateProtector("account-outbox-v1");
  }

  private async Task EnsureIndexesAsync(CancellationToken cancellationToken)
  {
    await indexGate.WaitAsync(cancellationToken);
    try
    {
      if (indexesReady) return;
      await collection.Indexes.CreateOneAsync(new CreateIndexModel<BsonDocument>(Builders<BsonDocument>.IndexKeys.Ascending("NormalizedEmail"), new CreateIndexOptions { Unique = true }), cancellationToken: cancellationToken);
      await tokenCollection.Indexes.CreateOneAsync(new CreateIndexModel<BsonDocument>(Builders<BsonDocument>.IndexKeys.Ascending("AccountId").Ascending("Purpose"), new CreateIndexOptions { Unique = true }), cancellationToken: cancellationToken);
      await tokenCollection.Indexes.CreateOneAsync(new CreateIndexModel<BsonDocument>(Builders<BsonDocument>.IndexKeys.Ascending("TokenHash").Ascending("Purpose")), cancellationToken: cancellationToken);
      await tokenCollection.Indexes.CreateOneAsync(new CreateIndexModel<BsonDocument>(Builders<BsonDocument>.IndexKeys.Ascending("ExpiresAt"), new CreateIndexOptions { ExpireAfter = TimeSpan.Zero }), cancellationToken: cancellationToken);
      await sessionCollection.Indexes.CreateOneAsync(new CreateIndexModel<BsonDocument>(Builders<BsonDocument>.IndexKeys.Ascending("ExpiresAt"), new CreateIndexOptions { ExpireAfter = TimeSpan.Zero }), cancellationToken: cancellationToken);
      await outboxCollection.Indexes.CreateOneAsync(new CreateIndexModel<BsonDocument>(Builders<BsonDocument>.IndexKeys.Ascending("SentAt"), new CreateIndexOptions { ExpireAfter = TimeSpan.FromDays(7) }), cancellationToken: cancellationToken);
      indexesReady = true;
    }
    finally { indexGate.Release(); }
  }
  private static FilterDefinition<BsonDocument> Id(Guid id) => Builders<BsonDocument>.Filter.Eq("_id", id.ToString());
  private static BsonDocument Encode(AccountRecord account) => new()
  {
    ["_id"] = account.Id.ToString(),
    ["Email"] = account.Email,
    ["NormalizedEmail"] = account.NormalizedEmail,
    ["PasswordHash"] = account.PasswordHash,
    ["CreatedAt"] = account.CreatedAt.UtcDateTime,
    ["EmailVerifiedAt"] = account.EmailVerifiedAt is { } verified ? new BsonDateTime(verified.UtcDateTime) : BsonNull.Value,
    ["DeletionRequestedAt"] = account.DeletionRequestedAt is { } deleted ? new BsonDateTime(deleted.UtcDateTime) : BsonNull.Value
  };
  private static AccountRecord Decode(BsonDocument x) => new(Guid.Parse(x["_id"].AsString), x["Email"].AsString,
    x["NormalizedEmail"].AsString, x["PasswordHash"].AsString,
    new DateTimeOffset(x["CreatedAt"].ToUniversalTime()),
    x["EmailVerifiedAt"].IsBsonNull ? null : new DateTimeOffset(x["EmailVerifiedAt"].ToUniversalTime()),
    x["DeletionRequestedAt"].IsBsonNull ? null : new DateTimeOffset(x["DeletionRequestedAt"].ToUniversalTime()));
  public async Task<bool> TryCreateAsync(AccountRecord account, CancellationToken cancellationToken)
  {
    await EnsureIndexesAsync(cancellationToken);
    try { await collection.InsertOneAsync(Encode(account), cancellationToken: cancellationToken); return true; }
    catch (MongoWriteException error) when (error.WriteError.Category == ServerErrorCategory.DuplicateKey) { return false; }
  }
  public async Task<AccountRecord?> FindByNormalizedEmailAsync(string normalizedEmail, CancellationToken cancellationToken) => (await collection.Find(Builders<BsonDocument>.Filter.Eq("NormalizedEmail", normalizedEmail)).FirstOrDefaultAsync(cancellationToken)) is { } x ? Decode(x) : null;
  public async Task<AccountRecord?> FindByIdAsync(Guid accountId, CancellationToken cancellationToken) => (await collection.Find(Id(accountId)).FirstOrDefaultAsync(cancellationToken)) is { } x ? Decode(x) : null;
  public async Task<bool> TryVerifyEmailAsync(Guid accountId, DateTimeOffset verifiedAt, CancellationToken cancellationToken) => (await collection.UpdateOneAsync(Id(accountId), Builders<BsonDocument>.Update.Set("EmailVerifiedAt", verifiedAt.UtcDateTime), cancellationToken: cancellationToken)).MatchedCount > 0;
  public async Task<bool> TrySetPasswordHashAsync(Guid accountId, string passwordHash, CancellationToken cancellationToken) => (await collection.UpdateOneAsync(Id(accountId), Builders<BsonDocument>.Update.Set("PasswordHash", passwordHash), cancellationToken: cancellationToken)).MatchedCount > 0;
  public async Task<bool> TryCompareExchangePasswordHashAsync(Guid accountId, string expectedHash, string replacementHash, CancellationToken cancellationToken)
  {
    // Single-document atomicity: the expected hash sits in the filter, so two contenders cannot both win (DD-P06-15).
    var filter = Id(accountId) & Builders<BsonDocument>.Filter.Eq("PasswordHash", expectedHash) &
      Builders<BsonDocument>.Filter.Eq("DeletionRequestedAt", BsonNull.Value);
    var result = await collection.FindOneAndUpdateAsync(filter, Builders<BsonDocument>.Update.Set("PasswordHash", replacementHash),
      new FindOneAndUpdateOptions<BsonDocument> { IsUpsert = false, ReturnDocument = ReturnDocument.After }, cancellationToken);
    return result is not null;
  }
  public async Task<bool> TryMarkDeletionRequestedAsync(Guid accountId, DateTimeOffset requestedAt, CancellationToken cancellationToken) => (await collection.UpdateOneAsync(Id(accountId) & Builders<BsonDocument>.Filter.Eq("DeletionRequestedAt", BsonNull.Value), Builders<BsonDocument>.Update.Set("DeletionRequestedAt", requestedAt.UtcDateTime), cancellationToken: cancellationToken)).MatchedCount > 0;
  public async Task<IReadOnlyList<AccountRecord>> ListDeletionDueAsync(DateTimeOffset dueAtOrBefore, int limit, CancellationToken cancellationToken) => (await collection.Find(Builders<BsonDocument>.Filter.Type("DeletionRequestedAt", BsonType.DateTime) & Builders<BsonDocument>.Filter.Lte("DeletionRequestedAt", dueAtOrBefore.UtcDateTime)).Sort(Builders<BsonDocument>.Sort.Ascending("DeletionRequestedAt")).Limit(limit).ToListAsync(cancellationToken)).Select(Decode).ToArray();
  public async Task DeleteAsync(Guid accountId, CancellationToken cancellationToken)
  {
    await collection.DeleteOneAsync(Id(accountId), cancellationToken);
  }
  private static BsonDocument EncodeToken(AccountTokenRecord x) => new()
  {
    ["_id"] = x.Id.ToString(),
    ["AccountId"] = x.AccountId.ToString(),
    ["Purpose"] = (int)x.Purpose,
    ["TokenHash"] = new BsonBinaryData(x.TokenHash),
    ["ExpiresAt"] = x.ExpiresAt.UtcDateTime,
    ["UsedAt"] = x.UsedAt is { } used ? new BsonDateTime(used.UtcDateTime) : BsonNull.Value
  };
  public async Task ReplaceActiveAsync(AccountTokenRecord token, CancellationToken cancellationToken)
  {
    await EnsureIndexesAsync(cancellationToken);
    var filter = Builders<BsonDocument>.Filter.Eq("AccountId", token.AccountId.ToString()) & Builders<BsonDocument>.Filter.Eq("Purpose", (int)token.Purpose);
    var update = Builders<BsonDocument>.Update.Set("TokenHash", new BsonBinaryData(token.TokenHash))
      .Set("ExpiresAt", token.ExpiresAt.UtcDateTime).Set("UsedAt", BsonNull.Value)
      .SetOnInsert("_id", token.Id.ToString()).SetOnInsert("AccountId", token.AccountId.ToString()).SetOnInsert("Purpose", (int)token.Purpose);
    try { await tokenCollection.UpdateOneAsync(filter, update, new UpdateOptions { IsUpsert = true }, cancellationToken); }
    catch (MongoWriteException error) when (error.WriteError.Category == ServerErrorCategory.DuplicateKey)
    { await tokenCollection.UpdateOneAsync(filter, update, cancellationToken: cancellationToken); }
  }
  public async Task<Guid?> TryConsumeAsync(byte[] tokenHash, AccountTokenPurpose purpose, DateTimeOffset now, CancellationToken cancellationToken)
  {
    var filter = Builders<BsonDocument>.Filter.Eq("TokenHash", new BsonBinaryData(tokenHash)) &
      Builders<BsonDocument>.Filter.Eq("Purpose", (int)purpose) &
      Builders<BsonDocument>.Filter.Gt("ExpiresAt", now.UtcDateTime) &
      Builders<BsonDocument>.Filter.Eq("UsedAt", BsonNull.Value);
    var result = await tokenCollection.FindOneAndUpdateAsync(filter, Builders<BsonDocument>.Update.Set("UsedAt", now.UtcDateTime), cancellationToken: cancellationToken);
    return result is null ? null : Guid.Parse(result["AccountId"].AsString);
  }
  private static BsonDocument EncodeSession(AccountSessionRecord x) => new()
  {
    ["_id"] = x.Id.ToString(),
    ["AccountId"] = x.AccountId.ToString(),
    ["CreatedAt"] = x.CreatedAt.UtcDateTime,
    ["LastSeenAt"] = x.LastSeenAt.UtcDateTime,
    ["ExpiresAt"] = x.ExpiresAt.UtcDateTime,
    ["AbsoluteExpiresAt"] = x.AbsoluteExpiresAt.UtcDateTime,
    ["ReauthenticatedAt"] = x.ReauthenticatedAt is { } at ? new BsonDateTime(at.UtcDateTime) : BsonNull.Value
  };
  private static AccountSessionRecord DecodeSession(BsonDocument x) => new(Guid.Parse(x["_id"].AsString), Guid.Parse(x["AccountId"].AsString),
    new DateTimeOffset(x["CreatedAt"].ToUniversalTime()), new DateTimeOffset(x["LastSeenAt"].ToUniversalTime()),
    new DateTimeOffset(x["ExpiresAt"].ToUniversalTime()), new DateTimeOffset(x["AbsoluteExpiresAt"].ToUniversalTime()),
    x["ReauthenticatedAt"].IsBsonNull ? null : new DateTimeOffset(x["ReauthenticatedAt"].ToUniversalTime()));
  public async Task CreateAsync(AccountSessionRecord session, CancellationToken cancellationToken)
  {
    await EnsureIndexesAsync(cancellationToken);
    await sessionCollection.InsertOneAsync(EncodeSession(session), cancellationToken: cancellationToken);
  }
  public async Task<AccountSessionRecord?> FindActiveAsync(Guid sessionId, DateTimeOffset now, CancellationToken cancellationToken)
  {
    var filter = Id(sessionId) & Builders<BsonDocument>.Filter.Gt("ExpiresAt", now.UtcDateTime) & Builders<BsonDocument>.Filter.Gt("AbsoluteExpiresAt", now.UtcDateTime);
    var x = await sessionCollection.Find(filter).FirstOrDefaultAsync(cancellationToken);
    return x is null ? null : DecodeSession(x);
  }
  public async Task<bool> RenewAsync(Guid sessionId, DateTimeOffset seenAt, DateTimeOffset expiresAt, CancellationToken cancellationToken)
  {
    return (await sessionCollection.UpdateOneAsync(Id(sessionId), Builders<BsonDocument>.Update.Set("LastSeenAt", seenAt.UtcDateTime).Set("ExpiresAt", expiresAt.UtcDateTime), cancellationToken: cancellationToken)).MatchedCount > 0;
  }
  public async Task<bool> StampReauthenticatedAsync(Guid sessionId, DateTimeOffset reauthenticatedAt, CancellationToken cancellationToken)
  {
    return (await sessionCollection.UpdateOneAsync(Id(sessionId), Builders<BsonDocument>.Update.Set("ReauthenticatedAt", reauthenticatedAt.UtcDateTime), cancellationToken: cancellationToken)).MatchedCount > 0;
  }
  public async Task RevokeAsync(Guid sessionId, CancellationToken cancellationToken)
  {
    await sessionCollection.DeleteOneAsync(Id(sessionId), cancellationToken);
  }
  public async Task RevokeAllForAccountAsync(Guid accountId, CancellationToken cancellationToken)
  {
    await sessionCollection.DeleteManyAsync(Builders<BsonDocument>.Filter.Eq("AccountId", accountId.ToString()), cancellationToken);
  }
  private BsonDocument EncodeOutbox(AccountOutboxRecord x) => new()
  {
    ["_id"] = x.Id.ToString(),
    ["AccountId"] = x.AccountId.ToString(),
    ["RecipientAddress"] = x.RecipientAddress,
    ["Subject"] = x.Subject,
    ["Body"] = x.Body is null ? BsonNull.Value : new BsonString(outboxProtector.Protect(x.Body)),
    ["CreatedAt"] = x.CreatedAt.UtcDateTime,
    ["ClaimedUntil"] = x.ClaimedUntil is { } claim ? new BsonDateTime(claim.UtcDateTime) : BsonNull.Value,
    ["SentAt"] = x.SentAt is { } sent ? new BsonDateTime(sent.UtcDateTime) : BsonNull.Value,
    ["Attempts"] = x.Attempts,
    ["NextAttemptAt"] = x.NextAttemptAt is { } next ? new BsonDateTime(next.UtcDateTime) : BsonNull.Value
  };
  private AccountOutboxRecord DecodeOutbox(BsonDocument x) => new(Guid.Parse(x["_id"].AsString), Guid.Parse(x["AccountId"].AsString),
    x["RecipientAddress"].AsString, x["Subject"].AsString, x["Body"].IsBsonNull ? null : outboxProtector.Unprotect(x["Body"].AsString),
    new DateTimeOffset(x["CreatedAt"].ToUniversalTime()), x["ClaimedUntil"].IsBsonNull ? null : new DateTimeOffset(x["ClaimedUntil"].ToUniversalTime()),
    x["SentAt"].IsBsonNull ? null : new DateTimeOffset(x["SentAt"].ToUniversalTime()),
    x.GetValue("Attempts", 0).ToInt32(),
    x.GetValue("NextAttemptAt", BsonNull.Value) is { IsBsonNull: false } next ? new DateTimeOffset(next.ToUniversalTime()) : null);
  public async Task EnqueueAsync(AccountOutboxRecord message, CancellationToken cancellationToken)
  {
    await outboxCollection.InsertOneAsync(EncodeOutbox(message), cancellationToken: cancellationToken);
  }
  public async Task<AccountOutboxRecord?> TryClaimNextAsync(DateTimeOffset now, TimeSpan lease, CancellationToken cancellationToken)
  {
    // Oldest first, and never a message whose backoff has not elapsed, so one bad recipient cannot
    // hold the head of the queue (external review, major).
    var filter = Builders<BsonDocument>.Filter.Eq("SentAt", BsonNull.Value) &
      (Builders<BsonDocument>.Filter.Eq("ClaimedUntil", BsonNull.Value) | Builders<BsonDocument>.Filter.Lt("ClaimedUntil", now.UtcDateTime)) &
      (Builders<BsonDocument>.Filter.Eq("NextAttemptAt", BsonNull.Value) | Builders<BsonDocument>.Filter.Not(Builders<BsonDocument>.Filter.Exists("NextAttemptAt")) |
       Builders<BsonDocument>.Filter.Lte("NextAttemptAt", now.UtcDateTime));
    var x = await outboxCollection.FindOneAndUpdateAsync(filter, Builders<BsonDocument>.Update.Set("ClaimedUntil", now.Add(lease).UtcDateTime),
      new FindOneAndUpdateOptions<BsonDocument> { Sort = Builders<BsonDocument>.Sort.Ascending("CreatedAt") }, cancellationToken);
    return x is null ? null : DecodeOutbox(x);
  }
  public async Task MarkSentAndClearBodyAsync(Guid messageId, DateTimeOffset sentAt, CancellationToken cancellationToken)
  {
    await outboxCollection.UpdateOneAsync(Id(messageId), Builders<BsonDocument>.Update.Set("Body", BsonNull.Value).Set("SentAt", sentAt.UtcDateTime), cancellationToken: cancellationToken);
  }
  public async Task ReleaseClaimAsync(Guid messageId, int attempts, DateTimeOffset nextAttemptAt, CancellationToken cancellationToken)
  {
    await outboxCollection.UpdateOneAsync(Id(messageId), Builders<BsonDocument>.Update
      .Set("ClaimedUntil", BsonNull.Value).Set("Attempts", attempts).Set("NextAttemptAt", nextAttemptAt.UtcDateTime),
      cancellationToken: cancellationToken);
  }
  public async Task DeleteForAccountAndPurposeAsync(Guid accountId, AccountTokenPurpose purpose, CancellationToken cancellationToken)
  {
    await tokenCollection.DeleteManyAsync(Builders<BsonDocument>.Filter.Eq("AccountId", accountId.ToString()) &
      Builders<BsonDocument>.Filter.Eq("Purpose", (int)purpose), cancellationToken);
  }
  public async Task DeleteForAccountAsync(Guid accountId, CancellationToken cancellationToken)
  {
    var filter = Builders<BsonDocument>.Filter.Eq("AccountId", accountId.ToString());
    await tokenCollection.DeleteManyAsync(filter, cancellationToken);
    await sessionCollection.DeleteManyAsync(filter, cancellationToken);
    await outboxCollection.DeleteManyAsync(filter, cancellationToken);
  }

  public void Dispose() { indexGate.Dispose(); client.Dispose(); }
}
