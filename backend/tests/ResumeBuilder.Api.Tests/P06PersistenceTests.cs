using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using MongoDB.Bson;
using MongoDB.Driver;
using Testcontainers.MongoDb;
using Xunit;

namespace ResumeBuilder.Api.Tests;

public sealed class P06PersistenceTests
{
  private const string MongoImage = "mongo:8.0.15@sha256:f4d54619262ae3bc6a0a8efbebcef970b87b8ad70697479a75ce308a6f400158";

  [Fact]
  public async Task P06SignupPersistsOneNormalizedAccountInRealMongo()
  {
    await using var mongo = new MongoDbBuilder().WithImage(MongoImage).WithReplicaSet("rs0").Build();
    await mongo.StartAsync(TestContext.Current.CancellationToken);
    using var host = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
      builder.UseSetting("Mongo:ConnectionString", mongo.GetConnectionString())
        .UseSetting("Accounts:AllowInsecureCookies", "true"));
    using var client = host.CreateClient();
    using var session = await client.GetAsync("/api/v1/session", TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.OK, session.StatusCode);
    var csrf = session.Headers.GetValues("Set-Cookie").Single(value => value.StartsWith("XSRF-TOKEN=", StringComparison.Ordinal)).Split(';')[0].Split('=')[1];
    using var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/sign-up")
    { Content = JsonContent.Create(new { email = "person-a@example.invalid", password = "valid-password-123" }) };
    request.Headers.Add("X-XSRF-TOKEN", csrf);
    using var duplicate = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/sign-up")
    { Content = JsonContent.Create(new { email = "PERSON-A@example.invalid", password = "valid-password-123" }) };
    duplicate.Headers.Add("X-XSRF-TOKEN", csrf);
    var responses = await Task.WhenAll(
      client.SendAsync(request, TestContext.Current.CancellationToken),
      client.SendAsync(duplicate, TestContext.Current.CancellationToken));
    using var response = responses[0];
    using var duplicateResponse = responses[1];
    Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
    Assert.Equal(HttpStatusCode.Accepted, duplicateResponse.StatusCode);
    Assert.Equal(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken),
      await duplicateResponse.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    using var databaseClient = new MongoClient(mongo.GetConnectionString());
    BsonDocument? persisted = null;
    foreach (var databaseName in await databaseClient.ListDatabaseNames(cancellationToken: TestContext.Current.CancellationToken).ToListAsync(TestContext.Current.CancellationToken))
    {
      if (databaseName is "admin" or "config" or "local") continue;
      var database = databaseClient.GetDatabase(databaseName);
      foreach (var collectionName in await database.ListCollectionNames(cancellationToken: TestContext.Current.CancellationToken).ToListAsync(TestContext.Current.CancellationToken))
      {
        var collection = database.GetCollection<BsonDocument>(collectionName);
        var normalized = Builders<BsonDocument>.Filter.Or(
          Builders<BsonDocument>.Filter.Eq("normalizedEmail", "PERSON-A@EXAMPLE.INVALID"),
          Builders<BsonDocument>.Filter.Eq("NormalizedEmail", "PERSON-A@EXAMPLE.INVALID"));
        var matches = await collection.Find(normalized).ToListAsync(TestContext.Current.CancellationToken);
        if (matches.Count == 1) persisted = matches[0];
      }
    }
    Assert.NotNull(persisted);
    var hashField = persisted.Contains("passwordHash") ? "passwordHash" : "PasswordHash";
    Assert.True(persisted.Contains(hashField), "Account hash is missing");
    var hash = persisted[hashField].AsString;
    Assert.DoesNotContain("valid-password-123", hash);
    var bytes = new byte[256];
    Assert.True(Convert.TryFromBase64String(hash, bytes, out var written));
    Assert.True(written >= 13);
    Assert.Equal(1, bytes[0]); // ASP.NET Core Identity V3 format marker.
    Assert.Equal(2, System.Buffers.Binary.BinaryPrimitives.ReadInt32BigEndian(bytes.AsSpan(1, 4))); // HMAC-SHA512.
    Assert.True(System.Buffers.Binary.BinaryPrimitives.ReadInt32BigEndian(bytes.AsSpan(5, 4)) >= 210_000);
  }
}
