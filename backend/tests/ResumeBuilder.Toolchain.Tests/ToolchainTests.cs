using System.Runtime.InteropServices;
using MongoDB.Bson;
using MongoDB.Driver;
using Testcontainers.MongoDb;
using Xunit;

namespace ResumeBuilder.Toolchain.Tests;

public sealed class ToolchainTests
{
  [Fact]
  public void RunsOnDotNet10()
  {
    Assert.Equal(10, Environment.Version.Major);
    Assert.StartsWith(".NET 10", RuntimeInformation.FrameworkDescription);
  }

  [Fact]
  public void RyukImageIsPinned()
  {
    var image = Environment.GetEnvironmentVariable("TESTCONTAINERS_RYUK_CONTAINER_IMAGE");
    Assert.False(string.IsNullOrWhiteSpace(image), "ENV_MISSING TESTCONTAINERS_RYUK_CONTAINER_IMAGE");
    Assert.Contains("@sha256:", image);
  }

  [Fact]
  public async Task PinnedMongoReplicaSetAcknowledgesMajorityWrite()
  {
    var image = Environment.GetEnvironmentVariable("RESUMISER_MONGO_IMAGE");
    Assert.False(string.IsNullOrWhiteSpace(image), "ENV_MISSING RESUMISER_MONGO_IMAGE");
    Assert.Contains("@sha256:", image);
    await using var mongo = new MongoDbBuilder().WithImage(image).WithReplicaSet("rs0").Build();
    await mongo.StartAsync(TestContext.Current.CancellationToken);
    var client = new MongoClient(mongo.GetConnectionString());
    var admin = client.GetDatabase("admin");
    var status = await admin.RunCommandAsync<BsonDocument>(new BsonDocument("replSetGetStatus", 1), cancellationToken: TestContext.Current.CancellationToken);
    Assert.Equal(1, status["myState"].AsInt32);
    Assert.Equal("rs0", status["set"].AsString);
    var db = client.GetDatabase("resumiser_smoke");
    var collection = db.GetCollection<BsonDocument>("canary").WithWriteConcern(WriteConcern.WMajority);
    await collection.InsertOneAsync(new BsonDocument("fictional", true), cancellationToken: TestContext.Current.CancellationToken);
    Assert.Equal(1, await collection.CountDocumentsAsync(FilterDefinition<BsonDocument>.Empty, cancellationToken: TestContext.Current.CancellationToken));
  }
}
