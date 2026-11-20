using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Azure.Storage.Blobs;
using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;
using ResumeBuilder.Application.Accounts;
using ResumeBuilder.Application.Resumes;
using ResumeBuilder.Infrastructure;
using Testcontainers.MongoDb;
using Xunit;

namespace ResumeBuilder.Api.Tests;

/// <summary>P13 tests share one Mongo and one Azurite, apart from P07's, because the lifecycle jobs act on every owner.</summary>
[CollectionDefinition("P13")]
public sealed class P13CollectionDefinition : ICollectionFixture<P07Containers>;

/// <summary>Fault injection pauses the database, so it gets containers nobody else uses.</summary>
[CollectionDefinition("P13Faults")]
public sealed class P13FaultsCollectionDefinition : ICollectionFixture<P13FaultContainers>;

public sealed class P13FaultContainers : IAsyncLifetime
{
  private static readonly string Lock = File.ReadAllText(Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../..", "infrastructure/images.lock")));
  private static string Image(string name) => Lock.Split('\n').Single(line => line.StartsWith(name + "=", StringComparison.Ordinal))[(name.Length + 1)..];
  private static readonly string AccountKey = Convert.ToBase64String(Enumerable.Repeat((byte)9, 32).ToArray());
  public MongoDbContainer Mongo { get; } = new MongoDbBuilder().WithImage(Image("MONGO")).WithReplicaSet("rs0").Build();
  private readonly IContainer azurite = new ContainerBuilder().WithImage(Image("AZURITE"))
    .WithCommand("azurite-blob", "--blobHost", "0.0.0.0")
    .WithEnvironment("AZURITE_ACCOUNTS", "p13:" + AccountKey)
    .WithPortBinding(10000, true)
    .WithWaitStrategy(Wait.ForUnixContainer().UntilInternalTcpPortIsAvailable(10000))
    .Build();

  /// <summary>Short timeouts, so a paused database fails a request in seconds rather than after the 30 s default.</summary>
  public string MongoConnection => Mongo.GetConnectionString() + (Mongo.GetConnectionString().Contains('?', StringComparison.Ordinal) ? "&" : "?") +
    "serverSelectionTimeoutMS=3000&connectTimeoutMS=3000&socketTimeoutMS=3000&wtimeoutMS=3000";
  public string BlobConnection => $"DefaultEndpointsProtocol=http;AccountName=p13;AccountKey={AccountKey};BlobEndpoint=http://{azurite.Hostname}:{azurite.GetMappedPublicPort(10000)}/p13;";

  public async ValueTask InitializeAsync() => await Task.WhenAll(Mongo.StartAsync(), azurite.StartAsync());

  public async ValueTask DisposeAsync()
  {
    await Mongo.DisposeAsync();
    await azurite.DisposeAsync();
  }
}

/// <summary>
/// A host for what P07Host fixes: the environment, the production log filters (no test override, only a capture
/// provider) and extra settings. Accounts are seeded through the use cases, as in P07.
/// </summary>
public sealed class P13Host(string mongo, string blob, string environment = "Testing", bool productionLogging = false,
  IReadOnlyDictionary<string, string?>? settings = null, Action<IServiceCollection>? services = null) : WebApplicationFactory<Program>
{
  public P07Clock Time { get; } = new();
  internal LoggingTests.CaptureProvider Logs { get; } = new();

  public P13Host(P07Containers containers, string environment = "Testing", bool productionLogging = false,
    IReadOnlyDictionary<string, string?>? settings = null, Action<IServiceCollection>? services = null)
    : this(containers.MongoConnection, containers.BlobConnection, environment, productionLogging, settings, services) { }

  protected override void ConfigureWebHost(IWebHostBuilder builder)
  {
    builder.UseEnvironment(environment);
    builder.UseSetting("Mongo:ConnectionString", mongo);
    builder.UseSetting("Blob:ConnectionString", blob);
    builder.UseSetting("Accounts:PublicBaseUrl", "https://app.example");
    builder.UseSetting("Accounts:AllowInsecureCookies", "true");
    builder.UseSetting("Accounts:DeletionWorker:Enabled", "false");
    builder.UseSetting("Accounts:EmailWorker:Enabled", "false");
    builder.UseSetting("Resumes:LifecycleWorker:Enabled", "false");
    builder.UseSetting("Resumes:TrashExpiryWorker:Enabled", "false");
    foreach (var (key, value) in settings ?? new Dictionary<string, string?>()) builder.UseSetting(key, value);
    builder.ConfigureLogging(logging =>
    {
      if (!productionLogging)
      {
        logging.SetMinimumLevel(LogLevel.Trace);
        logging.AddFilter(null, LogLevel.Trace);
      }
      logging.AddProvider(Logs);
    });
    builder.ConfigureTestServices(collection =>
    {
      collection.RemoveAll<IClock>(); collection.AddSingleton<IClock>(Time);
      collection.RemoveAll<IEmailSink>(); collection.AddSingleton<IEmailSink, P07QuietEmail>();
      services?.Invoke(collection);
    });
  }
}

/// <summary>Observes the live stores when a ledger entry is written, then writes it for real; can fail one ID on demand.</summary>
internal sealed class P13ObservingLedger(P07Containers containers) : IResumeDeletionLedger, IDisposable
{
  private readonly DualAccountDeletionLedger inner = new(containers.MongoConnection, containers.BlobConnection);
  public void Dispose() => inner.Dispose();
  public HashSet<Guid> FailFor { get; } = [];
  public List<(string Kind, Guid Id, Guid Owner, int BlobsSeen, long DocumentsSeen)> Calls { get; } = [];

  private async Task Observe(string kind, Guid id, Guid owner, Guid failKey)
  {
    if (FailFor.Contains(failKey)) throw new IOException("synthetic ledger failure");
    var blobs = (await containers.PhotoKeys(owner)).Length;
    var documents = await containers.Collection("resumes").CountDocumentsAsync(P07Mongo.Eq("ownerId", owner.ToString()), cancellationToken: TestContext.Current.CancellationToken);
    lock (Calls) Calls.Add((kind, id, owner, blobs, documents));
  }

  public async Task RecordResumeAsync(Guid resumeId, Guid ownerId, DateTimeOffset recordedAt, CancellationToken cancellationToken)
  {
    await Observe("resume", resumeId, ownerId, resumeId);
    await inner.RecordResumeAsync(resumeId, ownerId, recordedAt, cancellationToken);
  }

  public async Task RecordPhotoAsync(Guid photoId, Guid ownerId, DateTimeOffset recordedAt, CancellationToken cancellationToken)
  {
    await Observe("photo", photoId, ownerId, photoId);
    await inner.RecordPhotoAsync(photoId, ownerId, recordedAt, cancellationToken);
  }
}

/// <summary>Fails blob deletes on demand, so a photo removal stays pending (P07 M06).</summary>
internal sealed class P13FlakyPhotos(IPhotoStorage inner) : IPhotoStorage
{
  public bool FailDeletes { get; set; }
  public Task PutAsync(Guid ownerId, Guid photoId, PhotoVariant variant, byte[] bytes, string contentType, CancellationToken cancellationToken) => inner.PutAsync(ownerId, photoId, variant, bytes, contentType, cancellationToken);
  public Task<byte[]?> GetAsync(Guid ownerId, Guid photoId, PhotoVariant variant, CancellationToken cancellationToken) => inner.GetAsync(ownerId, photoId, variant, cancellationToken);
  public Task CopyAsync(Guid ownerId, Guid sourcePhotoId, Guid targetPhotoId, CancellationToken cancellationToken) => inner.CopyAsync(ownerId, sourcePhotoId, targetPhotoId, cancellationToken);
  public Task DeleteAsync(Guid ownerId, Guid photoId, CancellationToken cancellationToken) => FailDeletes ? throw new IOException("synthetic blob failure") : inner.DeleteAsync(ownerId, photoId, cancellationToken);
  public Task DeleteOwnerAsync(Guid ownerId, CancellationToken cancellationToken) => inner.DeleteOwnerAsync(ownerId, cancellationToken);
}

internal static class P13Data
{
  private static CancellationToken Ct => TestContext.Current.CancellationToken;

  public static Task<long> Count(this P07Containers containers, string collection, string field, Guid id) =>
    containers.Collection(collection).CountDocumentsAsync(P07Mongo.Eq(field, id.ToString()), cancellationToken: Ct);

  public static async Task<BsonDocument?> Resume(this P07Containers containers, Guid id) =>
    await containers.Collection("resumes").Find(P07Mongo.Eq("_id", id.ToString())).FirstOrDefaultAsync(Ct);

  public static async Task<bool> Ledgered(this P07Containers containers, string kind, Guid id)
  {
    var entryId = $"ledger/{kind}/{id:N}";
    var row = await containers.Collection("deletion_ledger").CountDocumentsAsync(P07Mongo.Eq("_id", entryId), cancellationToken: Ct);
    return row == 1 && (await containers.LedgerBlobs.GetBlobClient(entryId).ExistsAsync(Ct)).Value;
  }

  public static Guid PhotoId(this P07Created resume) => Guid.Parse(resume.Json["photo"]!["id"]!.ToString());

  /// <summary>Every live store an account's data can be in (ADR-039 §2).</summary>
  public static async Task<long> LiveRows(this P07Containers containers, Guid owner) =>
    await containers.Count("accounts", "_id", owner) +
    await containers.Count("account_tokens", "AccountId", owner) +
    await containers.Count("account_sessions", "AccountId", owner) +
    await containers.Count("account_outbox", "AccountId", owner) +
    await containers.Count("resumes", "ownerId", owner) +
    await containers.Count("resume_snapshots", "ownerId", owner) +
    await containers.Count("idempotency_keys", "ownerId", owner);

  public static async Task<HttpStatusCode> Login(this P07Host host, string email)
  {
    var client = host.CreateClient();
    using var session = await client.GetAsync("/api/v1/session", Ct);
    using var login = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/login") { Content = JsonContent.Create(new { email, password = P07Host.Password }) };
    login.Headers.Add("X-XSRF-TOKEN", P07User.CsrfOf(session));
    using var response = await client.SendAsync(login, Ct);
    return response.StatusCode;
  }

  /// <summary>A fresh session for the same account, for after the fake clock passed the session lifetime (ADR-036).</summary>
  public static async Task<P07User> Relogin(this P07User user)
  {
    var client = user.Host.CreateClient();
    using var session = await client.GetAsync("/api/v1/session", Ct);
    using var login = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/login") { Content = JsonContent.Create(new { email = user.Email, password = P07Host.Password }) };
    login.Headers.Add("X-XSRF-TOKEN", P07User.CsrfOf(session));
    using var response = await client.SendAsync(login, Ct);
    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    return new P07User(user.Host, client, P07User.CsrfOf(response), user.Id, user.Email);
  }

  /// <summary>Snapshot rows keyed to the resume, for an expiry that must not wait for the TTL monitor.</summary>
  public static Task AgeSnapshots(this P07Containers containers, Guid resumeId, DateTimeOffset expiresAt) =>
    containers.Collection("resume_snapshots").UpdateManyAsync(P07Mongo.Eq("resumeId", resumeId.ToString()),
      Builders<BsonDocument>.Update.Set("expiresAt", expiresAt.UtcDateTime), cancellationToken: Ct);

  public static BlobContainerClient Blobs(this P07Containers containers, string name) =>
    new BlobServiceClient(containers.BlobConnection, new BlobClientOptions(BlobClientOptions.ServiceVersion.V2024_11_04)).GetBlobContainerClient(name);

  public static async Task<JsonNode> Json(this HttpResponseMessage response) =>
    JsonNode.Parse(await response.Content.ReadAsStringAsync(Ct))!;
}
