using System.Security.Cryptography;
using Azure.Storage.Blobs;
using Microsoft.AspNetCore.DataProtection;
using MongoDB.Bson;
using MongoDB.Driver;
using ResumeBuilder.Application.Accounts;
using ResumeBuilder.Infrastructure;
using Testcontainers.MongoDb;
using DotNet.Testcontainers.Builders;
using Xunit;

namespace ResumeBuilder.Api.Tests;

public sealed class P06DeferredPersistenceTests
{
  private const string MongoImage = "mongo:8.0.15@sha256:f4d54619262ae3bc6a0a8efbebcef970b87b8ad70697479a75ce308a6f400158";
  private sealed class FixedClock(DateTimeOffset now) : IClock { public DateTimeOffset UtcNow { get; } = now; }
  private sealed class QuietEmail : IEmailSink { public Task SendAsync(AccountEmail message, CancellationToken cancellationToken) => Task.CompletedTask; }
  private sealed class ObservingLedger(IAccountStore accounts) : IAccountDeletionLedger
  {
    public bool AccountWasPresent { get; private set; }
    public async Task RecordAccountAsync(Guid userId, DateTimeOffset recordedAt, CancellationToken cancellationToken) =>
      AccountWasPresent = await accounts.FindByIdAsync(userId, cancellationToken) is not null;
  }

  /// <summary>
  /// DD-P06-15 compare-and-set, against the real adapter: the expected hash lives in the filter, so two
  /// contenders released from one barrier cannot both win and the stored hash is the winner's.
  /// </summary>
  [Fact]
  public async Task P06RealMongoCompareExchangePasswordHashIsConditionalAndHasASingleWinner()
  {
    await using var mongo = new MongoDbBuilder().WithImage(MongoImage).WithReplicaSet("rs0").Build();
    await mongo.StartAsync(TestContext.Current.CancellationToken);
    using var store = (MongoAccountStore)CreateTokenStore(mongo.GetConnectionString());
    var ct = TestContext.Current.CancellationToken;
    var now = new DateTimeOffset(2026, 11, 4, 12, 0, 0, TimeSpan.Zero);
    var accounts = store;
    var id = Guid.NewGuid();
    const string original = "hash-original";
    Assert.True(await accounts.TryCreateAsync(new AccountRecord(id, "cas-a@example.invalid", "CAS-A@EXAMPLE.INVALID", original, now, now, null), ct));

    Assert.False(await accounts.TryCompareExchangePasswordHashAsync(id, "hash-stale", "hash-rejected", ct));
    Assert.Equal(original, (await accounts.FindByIdAsync(id, ct))!.PasswordHash);

    Assert.False(await accounts.TryCompareExchangePasswordHashAsync(Guid.NewGuid(), original, "hash-rejected", ct));
    Assert.Null(await accounts.FindByIdAsync(Guid.NewGuid(), ct));

    Assert.True(await accounts.TryCompareExchangePasswordHashAsync(id, original, original, ct));
    Assert.Equal(original, (await accounts.FindByIdAsync(id, ct))!.PasswordHash);

    Assert.True(await accounts.TryCompareExchangePasswordHashAsync(id, original, "hash-second", ct));
    Assert.Equal("hash-second", (await accounts.FindByIdAsync(id, ct))!.PasswordHash);

    // Two contenders, one expected hash, distinct replacements: exactly one must win.
    var start = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
    async Task<bool> Contend(string replacement)
    {
      await start.Task;
      return await accounts.TryCompareExchangePasswordHashAsync(id, "hash-second", replacement, ct);
    }
    var first = Contend("hash-winner-a");
    var second = Contend("hash-winner-b");
    start.SetResult();
    var outcomes = await Task.WhenAll(first, second);
    Assert.Single(outcomes, won => won);
    var stored = (await accounts.FindByIdAsync(id, ct))!.PasswordHash;
    Assert.Equal(await first ? "hash-winner-a" : "hash-winner-b", stored);

    var deleting = Guid.NewGuid();
    Assert.True(await accounts.TryCreateAsync(new AccountRecord(deleting, "cas-b@example.invalid", "CAS-B@EXAMPLE.INVALID", original, now, now, null), ct));
    Assert.True(await accounts.TryMarkDeletionRequestedAsync(deleting, now, ct));
    Assert.False(await accounts.TryCompareExchangePasswordHashAsync(deleting, original, "hash-rejected", ct));
    Assert.Equal(original, (await accounts.FindByIdAsync(deleting, ct))!.PasswordHash);
  }

  /// <summary>
  /// Delta re-review, minor: the retry fields were added after the first outbox rows were written, so a
  /// document with no `Attempts`/`NextAttemptAt` must still be claimable, and a deferred one must not be.
  /// </summary>
  [Fact]
  public async Task P06RealMongoOutboxClaimsLegacyRowsAndHonoursTheDeferral()
  {
    await using var mongo = new MongoDbBuilder().WithImage(MongoImage).WithReplicaSet("rs0").Build();
    await mongo.StartAsync(TestContext.Current.CancellationToken);
    using var store = (MongoAccountStore)CreateTokenStore(mongo.GetConnectionString());
    var ct = TestContext.Current.CancellationToken;
    var now = new DateTimeOffset(2026, 11, 4, 12, 0, 0, TimeSpan.Zero);
    var outbox = store;

    // A row written before the retry fields existed: insert it, then strip the new fields.
    var legacyId = Guid.NewGuid();
    await outbox.EnqueueAsync(new AccountOutboxRecord(legacyId, Guid.NewGuid(), "legacy@example.invalid",
      "Verify email", "synthetic-token-legacy", now.AddMinutes(-10), null, null), ct);
    var collection = new MongoClient(mongo.GetConnectionString()).GetDatabase("resumebuilder").GetCollection<BsonDocument>("account_outbox");
    await collection.UpdateOneAsync(Builders<BsonDocument>.Filter.Eq("_id", legacyId.ToString()),
      Builders<BsonDocument>.Update.Unset("Attempts").Unset("NextAttemptAt"), cancellationToken: ct);
    var stored = await collection.Find(Builders<BsonDocument>.Filter.Eq("_id", legacyId.ToString())).SingleAsync(ct);
    Assert.False(stored.Contains("Attempts"));
    Assert.False(stored.Contains("NextAttemptAt"));

    var legacy = await outbox.TryClaimNextAsync(now, TimeSpan.FromMinutes(2), ct);
    Assert.NotNull(legacy);
    Assert.Equal(legacyId, legacy.Id);
    Assert.Equal(0, legacy.Attempts);
    Assert.Null(legacy.NextAttemptAt);

    // Defer it: it must not come back before the deferral elapses, and must come back after.
    var deferUntil = AccountOutboxPolicy.NextAttemptAt(now, 1);
    await outbox.ReleaseClaimAsync(legacyId, 1, deferUntil, ct);
    Assert.Null(await outbox.TryClaimNextAsync(deferUntil.AddSeconds(-1), TimeSpan.FromMinutes(2), ct));
    var again = await outbox.TryClaimNextAsync(deferUntil.AddSeconds(1), TimeSpan.FromMinutes(2), ct);
    Assert.NotNull(again);
    Assert.Equal(1, again.Attempts);
    Assert.Equal(deferUntil, again.NextAttemptAt);

    // Oldest-first ordering across rows.
    await outbox.ReleaseClaimAsync(legacyId, 1, deferUntil, ct);
    var olderId = Guid.NewGuid();
    await outbox.EnqueueAsync(new AccountOutboxRecord(olderId, Guid.NewGuid(), "older@example.invalid",
      "Verify email", "synthetic-token-older", now.AddHours(-5), null, null), ct);
    var first = await outbox.TryClaimNextAsync(deferUntil.AddSeconds(1), TimeSpan.FromMinutes(2), ct);
    Assert.NotNull(first);
    Assert.Equal(olderId, first.Id);
  }

  private static IAccountTokenStore CreateTokenStore(string connection)
  {
    var type = System.Reflection.Assembly.Load("ResumeBuilder.Infrastructure").GetType("ResumeBuilder.Infrastructure.MongoAccountStore");
    Assert.NotNull(type);
    var store = Activator.CreateInstance(type, connection, DataProtectionProvider.Create("p06-test"));
    Assert.IsAssignableFrom<IAccountTokenStore>(store);
    return (IAccountTokenStore)store!;
  }

  [Fact]
  public async Task P06UnauthenticatedTokenLookupHasTokenHashIndexInRealMongo()
  {
    await using var mongo = new MongoDbBuilder().WithImage(MongoImage).WithReplicaSet("rs0").Build();
    await mongo.StartAsync(TestContext.Current.CancellationToken);
    using var store = (IDisposable)CreateTokenStore(mongo.GetConnectionString());
    var hash = SHA256.HashData(System.Text.Encoding.UTF8.GetBytes("synthetic-index-token"));
    await ((IAccountTokenStore)store).ReplaceActiveAsync(new AccountTokenRecord(Guid.NewGuid(), Guid.NewGuid(), AccountTokenPurpose.Verification,
      hash, new DateTimeOffset(2026, 11, 4, 12, 0, 0, TimeSpan.Zero).AddHours(24), null), TestContext.Current.CancellationToken);
    var collection = new MongoClient(mongo.GetConnectionString()).GetDatabase("resumebuilder").GetCollection<BsonDocument>("account_tokens");
    using var cursor = await collection.Indexes.ListAsync(TestContext.Current.CancellationToken);
    var indexes = await cursor.ToListAsync(TestContext.Current.CancellationToken);
    Assert.Contains(indexes, index => index["key"].AsBsonDocument.Names.FirstOrDefault() == "TokenHash");
  }

  [Fact]
  public async Task P06RealMongoPurgeRemovesAccountTokenSessionAndOutboxAfterLedger()
  {
    await using var mongo = new MongoDbBuilder().WithImage(MongoImage).WithReplicaSet("rs0").Build();
    await mongo.StartAsync(TestContext.Current.CancellationToken);
    using var store = (MongoAccountStore)CreateTokenStore(mongo.GetConnectionString());
    var now = new DateTimeOffset(2026, 11, 4, 12, 0, 0, TimeSpan.Zero);
    var id = Guid.NewGuid();
    Assert.True(await store.TryCreateAsync(new AccountRecord(id, "person-a@example.invalid", "PERSON-A@EXAMPLE.INVALID", "synthetic-hash", now.AddDays(-1), now.AddDays(-1), null), TestContext.Current.CancellationToken));
    await store.ReplaceActiveAsync(new AccountTokenRecord(Guid.NewGuid(), id, AccountTokenPurpose.PasswordReset,
      SHA256.HashData(System.Text.Encoding.UTF8.GetBytes("synthetic-purge-token")), now.AddHours(1), null), TestContext.Current.CancellationToken);
    await store.CreateAsync(new AccountSessionRecord(Guid.NewGuid(), id, now.AddDays(-1), now, now.AddDays(14), now.AddDays(30), null), TestContext.Current.CancellationToken);
    await store.EnqueueAsync(new AccountOutboxRecord(Guid.NewGuid(), id, "person-a@example.invalid", "Synthetic notice", "synthetic mail body", now, null, null), TestContext.Current.CancellationToken);
    Assert.True(await store.TryMarkDeletionRequestedAsync(id, now, TestContext.Current.CancellationToken));
    var ledger = new ObservingLedger(store);
    var processor = new AccountDeletionProcessor(store, store, store, store, ledger, [], new FixedClock(now), new QuietEmail());
    await processor.ProcessDueAsync(TestContext.Current.CancellationToken);
    Assert.True(ledger.AccountWasPresent);
    Assert.Null(await store.FindByIdAsync(id, TestContext.Current.CancellationToken));
    var database = new MongoClient(mongo.GetConnectionString()).GetDatabase("resumebuilder");
    foreach (var name in new[] { "account_tokens", "account_sessions", "account_outbox" })
    {
      var rows = await database.GetCollection<BsonDocument>(name).CountDocumentsAsync(Builders<BsonDocument>.Filter.Eq("AccountId", id.ToString()), cancellationToken: TestContext.Current.CancellationToken);
      Assert.Equal(0, rows);
    }
  }

  [Fact]
  public async Task P06RealMongoSecurityCountersEnforceAtomicEmailQuotaAndLoginBackoff()
  {
    await using var mongo = new MongoDbBuilder().WithImage(MongoImage).WithReplicaSet("rs0").Build();
    await mongo.StartAsync(TestContext.Current.CancellationToken);
    using var counters = new MongoAccountSecurityCounters(mongo.GetConnectionString());
    var now = new DateTimeOffset(2026, 11, 4, 12, 0, 0, TimeSpan.Zero);
    var permits = await Task.WhenAll(Enumerable.Range(0, 16).Select(_ => counters.TryAcquireEmailAsync("synthetic-address-key", now, TestContext.Current.CancellationToken)));
    Assert.Equal(5, permits.Count(allowed => allowed));
    for (var attempt = 0; attempt < 5; attempt++) await counters.RecordLoginResultAsync("synthetic-account-key", false, now, TestContext.Current.CancellationToken);
    Assert.Equal(TimeSpan.FromMinutes(1), await counters.GetLoginDelayAsync("synthetic-account-key", now, TestContext.Current.CancellationToken));
    await counters.RecordLoginResultAsync("synthetic-account-key", true, now, TestContext.Current.CancellationToken);
    Assert.Null(await counters.GetLoginDelayAsync("synthetic-account-key", now, TestContext.Current.CancellationToken));
  }

  [Fact]
  public async Task P06VerificationTokenCanBeConsumedByOnlyOneConcurrentCaller()
  {
    await using var mongo = new MongoDbBuilder().WithImage(MongoImage).WithReplicaSet("rs0").Build();
    await mongo.StartAsync(TestContext.Current.CancellationToken);
    using var store = (IDisposable)CreateTokenStore(mongo.GetConnectionString());
    var tokens = (IAccountTokenStore)store;
    var now = new DateTimeOffset(2026, 11, 3, 12, 0, 0, TimeSpan.Zero);
    var accountId = Guid.NewGuid();
    var plaintext = "synthetic-token-not-for-storage";
    var hash = SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(plaintext));
    await tokens.ReplaceActiveAsync(new AccountTokenRecord(Guid.NewGuid(), accountId, AccountTokenPurpose.Verification, hash, now.AddHours(24), null), TestContext.Current.CancellationToken);
    var claims = await Task.WhenAll(Enumerable.Range(0, 16).Select(_ => tokens.TryConsumeAsync(hash, AccountTokenPurpose.Verification, now, TestContext.Current.CancellationToken)));
    Assert.Single(claims, id => id == accountId);
    Assert.All(claims.Where(id => id != accountId), id => Assert.Null(id));
  }

  [Fact]
  public async Task P06MongoTokenAndOutboxDocumentsContainNoPlaintextSecrets()
  {
    await using var mongo = new MongoDbBuilder().WithImage(MongoImage).WithReplicaSet("rs0").Build();
    await mongo.StartAsync(TestContext.Current.CancellationToken);
    using var store = (IDisposable)CreateTokenStore(mongo.GetConnectionString());
    var tokens = (IAccountTokenStore)store;
    var outbox = (IEmailOutboxStore)store;
    var now = new DateTimeOffset(2026, 11, 3, 12, 0, 0, TimeSpan.Zero);
    var accountId = Guid.NewGuid();
    const string token = "synthetic-sensitive-token";
    const string body = "synthetic-sensitive-mail-body";
    await tokens.ReplaceActiveAsync(new AccountTokenRecord(Guid.NewGuid(), accountId, AccountTokenPurpose.Verification, SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(token)), now.AddHours(24), null), TestContext.Current.CancellationToken);
    await outbox.EnqueueAsync(new AccountOutboxRecord(Guid.NewGuid(), accountId, "person-a@example.invalid", "Verify email", body, now, null, null), TestContext.Current.CancellationToken);
    var database = new MongoClient(mongo.GetConnectionString()).GetDatabase("resumebuilder");
    foreach (var name in new[] { "account_tokens", "account_outbox" })
    {
      var documents = await database.GetCollection<BsonDocument>(name).Find(FilterDefinition<BsonDocument>.Empty).ToListAsync(TestContext.Current.CancellationToken);
      Assert.NotEmpty(documents);
      foreach (var document in documents)
      {
        var raw = document.ToJson();
        Assert.DoesNotContain(token, raw);
        Assert.DoesNotContain(body, raw);
      }
    }
  }

  [Fact]
  public async Task P06DeletionLedgerSurvivesRestartInMongoAndPrivateBlobCopy()
  {
    var ledgerType = System.Reflection.Assembly.Load("ResumeBuilder.Infrastructure").GetType("ResumeBuilder.Infrastructure.DualAccountDeletionLedger");
    Assert.NotNull(ledgerType);
    var key = Convert.ToBase64String(Enumerable.Repeat((byte)7, 32).ToArray());
    await using var azurite = new ContainerBuilder().WithImage("mcr.microsoft.com/azure-storage/azurite:3.33.0")
      .WithCommand("azurite-blob", "--blobHost", "0.0.0.0")
      .WithEnvironment("AZURITE_ACCOUNTS", "p06:" + key)
      .WithPortBinding(10000, true).Build();
    await using var mongo = new MongoDbBuilder().WithImage(MongoImage).WithReplicaSet("rs0").Build();
    await Task.WhenAll(azurite.StartAsync(TestContext.Current.CancellationToken), mongo.StartAsync(TestContext.Current.CancellationToken));
    var blobConnection = $"DefaultEndpointsProtocol=http;AccountName=p06;AccountKey={key};BlobEndpoint=http://{azurite.Hostname}:{azurite.GetMappedPublicPort(10000)}/p06;";
    var id = Guid.NewGuid();
    var at = new DateTimeOffset(2026, 11, 3, 12, 0, 0, TimeSpan.Zero);
    for (var restart = 0; restart < 2; restart++)
    {
      using var ledger = (IDisposable)Activator.CreateInstance(ledgerType, mongo.GetConnectionString(), blobConnection)!;
      await ((IAccountDeletionLedger)ledger).RecordAccountAsync(id, at, TestContext.Current.CancellationToken);
    }
    var collection = new MongoClient(mongo.GetConnectionString()).GetDatabase("resumebuilder").GetCollection<BsonDocument>("deletion_ledger");
    Assert.Equal(1, await collection.CountDocumentsAsync(Builders<BsonDocument>.Filter.Eq("_id", "ledger/account/" + id.ToString("N")), cancellationToken: TestContext.Current.CancellationToken));
    var blob = new BlobServiceClient(blobConnection, new BlobClientOptions(BlobClientOptions.ServiceVersion.V2024_11_04)).GetBlobContainerClient("deletion-ledger").GetBlobClient("ledger/account/" + id.ToString("N"));
    Assert.True((await blob.ExistsAsync(TestContext.Current.CancellationToken)).Value);
    var properties = await blob.GetPropertiesAsync(cancellationToken: TestContext.Current.CancellationToken);
    Assert.True(properties.Value.ContentLength > 0);
  }
}
