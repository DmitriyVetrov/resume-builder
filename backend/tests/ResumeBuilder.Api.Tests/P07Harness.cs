using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json.Nodes;
using Azure.Storage.Blobs;
using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;
using Json.Schema;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;
using ResumeBuilder.Application.Accounts;
using ResumeBuilder.Infrastructure;
using SkiaSharp;
using Testcontainers.MongoDb;
using Xunit;
using YamlDotNet.Serialization;

namespace ResumeBuilder.Api.Tests;

[CollectionDefinition("P07")]
public sealed class P07CollectionDefinition : ICollectionFixture<P07Containers>;

/// <summary>One real Mongo replica set and one Azurite for the whole P07 collection. Tests stay apart by owner ID.</summary>
public sealed class P07Containers : IAsyncLifetime
{
  private static readonly string Lock = File.ReadAllText(Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../..", "infrastructure/images.lock")));
  private static string Image(string name) => Lock.Split('\n').Single(line => line.StartsWith(name + "=", StringComparison.Ordinal))[(name.Length + 1)..];
  private static readonly string AccountKey = Convert.ToBase64String(Enumerable.Repeat((byte)7, 32).ToArray());
  private readonly MongoDbContainer mongo = new MongoDbBuilder().WithImage(Image("MONGO")).WithReplicaSet("rs0").Build();
  private readonly IContainer azurite = new ContainerBuilder().WithImage(Image("AZURITE"))
    .WithCommand("azurite-blob", "--blobHost", "0.0.0.0")
    .WithEnvironment("AZURITE_ACCOUNTS", "p07:" + AccountKey)
    .WithPortBinding(10000, true)
    .WithWaitStrategy(Wait.ForUnixContainer().UntilInternalTcpPortIsAvailable(10000))
    .Build();

  public string MongoConnection => mongo.GetConnectionString();
  /// <summary>The container itself, for P13's restore drill (`mongodump`/`mongorestore` run inside it).</summary>
  public MongoDbContainer Mongo => mongo;
  public string BlobConnection => $"DefaultEndpointsProtocol=http;AccountName=p07;AccountKey={AccountKey};BlobEndpoint=http://{azurite.Hostname}:{azurite.GetMappedPublicPort(10000)}/p07;";
  public MongoClient MongoClient { get; private set; } = null!;
  public MongoResumeStore Store { get; private set; } = null!;
  public IMongoDatabase Database => MongoClient.GetDatabase("resumebuilder");
  public BlobContainerClient Photos => new BlobServiceClient(BlobConnection, new BlobClientOptions(BlobClientOptions.ServiceVersion.V2024_11_04)).GetBlobContainerClient("photos");
  public BlobContainerClient LedgerBlobs => new BlobServiceClient(BlobConnection, new BlobClientOptions(BlobClientOptions.ServiceVersion.V2024_11_04)).GetBlobContainerClient("deletion-ledger");

  public async ValueTask InitializeAsync()
  {
    await Task.WhenAll(mongo.StartAsync(), azurite.StartAsync());
    MongoClient = new MongoClient(MongoConnection);
    Store = new MongoResumeStore(MongoConnection);
  }

  public async ValueTask DisposeAsync()
  {
    Store?.Dispose();
    MongoClient?.Dispose();
    await mongo.DisposeAsync();
    await azurite.DisposeAsync();
  }

  public async Task<string[]> PhotoKeys(Guid ownerId)
  {
    var photos = Photos;
    if (!(await photos.ExistsAsync(TestContext.Current.CancellationToken)).Value) return [];
    var keys = new List<string>();
    await foreach (var blob in photos.GetBlobsAsync(new Azure.Storage.Blobs.Models.GetBlobsOptions { Prefix = $"u/{ownerId}/" }, TestContext.Current.CancellationToken)) keys.Add(blob.Name);
    return [.. keys.Order(StringComparer.Ordinal)];
  }
}

public sealed class P07Clock : IClock
{
  // Close to the wall clock, with millisecond precision: Mongo TTL monitors use real time and dates keep milliseconds.
  public DateTimeOffset UtcNow { get; set; } = DateTimeOffset.FromUnixTimeMilliseconds(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
  public void Advance(TimeSpan by) => UtcNow = UtcNow.Add(by);
}

public sealed class P07QuietEmail : IEmailSink
{
  public Task SendAsync(AccountEmail message, CancellationToken cancellationToken) => Task.CompletedTask;
}

/// <summary>One host per test: rate counters live per host (ADR-038), and accounts are seeded through the use cases to stay under `auth-email`.</summary>
public sealed class P07Host(P07Containers containers, Action<IServiceCollection>? services = null) : WebApplicationFactory<Program>
{
  public const string Password = "valid-password-123";
  public P07Containers Containers { get; } = containers;
  public P07Clock Time { get; } = new();
  internal LoggingTests.CaptureProvider Logs { get; } = new();

  protected override void ConfigureWebHost(IWebHostBuilder builder)
  {
    // Not Development: the developer exception page would hide the exception boundary this phase relies on.
    builder.UseEnvironment("Testing");
    builder.UseSetting("Mongo:ConnectionString", Containers.MongoConnection);
    builder.UseSetting("Blob:ConnectionString", Containers.BlobConnection);
    builder.UseSetting("Accounts:AllowInsecureCookies", "true");
    builder.UseSetting("Accounts:DeletionWorker:Enabled", "false");
    builder.UseSetting("Accounts:EmailWorker:Enabled", "false");
    builder.UseSetting("Resumes:LifecycleWorker:Enabled", "false");
    builder.ConfigureLogging(logging =>
    {
      // Every level of every category, so the canary test sees what a production filter would hide.
      logging.SetMinimumLevel(LogLevel.Trace);
      logging.AddFilter(null, LogLevel.Trace);
      logging.AddProvider(Logs);
    });
    builder.ConfigureTestServices(collection =>
    {
      collection.RemoveAll<IClock>(); collection.AddSingleton<IClock>(Time);
      collection.RemoveAll<IEmailSink>(); collection.AddSingleton<IEmailSink, P07QuietEmail>();
      services?.Invoke(collection);
    });
  }

  public async Task<P07User> SignIn()
  {
    var ct = TestContext.Current.CancellationToken;
    var email = $"p07-{Guid.NewGuid():N}@example.invalid";
    await Services.GetRequiredService<IAccountUseCases>().SignUpAsync(email, Password, ct);
    var client = CreateClient();
    using var session = await client.GetAsync("/api/v1/session", ct);
    Assert.Equal(HttpStatusCode.OK, session.StatusCode);
    using var login = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/login") { Content = JsonContent.Create(new { email, password = Password }) };
    login.Headers.Add("X-XSRF-TOKEN", P07User.CsrfOf(session));
    using var loggedIn = await client.SendAsync(login, ct);
    Assert.Equal(HttpStatusCode.OK, loggedIn.StatusCode);
    var body = JsonNode.Parse(await loggedIn.Content.ReadAsStringAsync(ct))!;
    return new P07User(this, client, P07User.CsrfOf(loggedIn), Guid.Parse(body["user"]!["id"]!.ToString()), email);
  }
}

public sealed record P07Response(HttpStatusCode Status, byte[] Bytes, HttpResponseHeaders Headers, string? ContentType)
{
  public int Code => (int)Status;
  public string Body => Encoding.UTF8.GetString(Bytes);
  public JsonNode Json => JsonNode.Parse(Body)!;
  public string? ETag => Headers.ETag?.ToString();
  public string? Location => Headers.Location?.ToString();
  public string? CacheControl => Headers.NonValidated.TryGetValues("Cache-Control", out var values) ? values.ToString() : null;
  public string? ProblemCode => ContentType == "application/problem+json" ? Json["code"]?.ToString() : null;
  public long Version => Json["version"]!.GetValue<long>();

  /// <summary>AC-P07-14: every error is RFC 9457, carries a trace ID and its body validates against the contract.</summary>
  public void AssertProblem(int status, string code)
  {
    Assert.Equal(status, Code);
    Assert.Equal("application/problem+json", ContentType);
    Assert.Equal(code, ProblemCode);
    Assert.Equal(status, Json["status"]!.GetValue<int>());
    Assert.False(string.IsNullOrEmpty(Json["traceId"]?.ToString()));
    Assert.True(P07Contract.IsValid(status == 412 ? "VersionMismatchProblem" : "Problem", Body), "The problem does not validate against the contract");
  }

  public void AssertIssue(string location, string jsonPointer, string code)
  {
    AssertProblem(400, "validation_failed");
    Assert.Contains(Json["errors"]!.AsArray(), issue =>
      issue!["location"]!.ToString() == location && issue["pointer"]!.ToString() == jsonPointer && issue["code"]!.ToString() == code);
  }

  public void AssertValid(string schema) => Assert.True(P07Contract.IsValid(schema, Body), $"The response does not validate against {schema}");
}

public sealed record P07Created(Guid Id, string ETag, JsonNode Json)
{
  public string Path => $"/api/v1/resumes/{Id}";
}

public sealed class P07User(P07Host host, HttpClient client, string csrf, Guid id, string email)
{
  public Guid Id { get; } = id;
  public string Email { get; } = email;
  public string CsrfToken { get; private set; } = csrf;
  public P07Host Host { get; } = host;

  internal static string CsrfOf(HttpResponseMessage response) =>
    response.Headers.GetValues("Set-Cookie").Single(value => value.StartsWith("XSRF-TOKEN=", StringComparison.Ordinal)).Split(';')[0].Split('=')[1];

  public static string NewKey() => Guid.NewGuid().ToString();

  public async Task<P07Response> Send(HttpMethod method, string path, HttpContent? content = null, string? ifMatch = null, string? key = null, bool withCsrf = true, string? ifNoneMatch = null)
  {
    var ct = TestContext.Current.CancellationToken;
    using var request = new HttpRequestMessage(method, path) { Content = content };
    if (withCsrf) request.Headers.Add("X-XSRF-TOKEN", CsrfToken);
    if (ifMatch is not null) request.Headers.TryAddWithoutValidation("If-Match", ifMatch);
    if (key is not null) request.Headers.TryAddWithoutValidation("Idempotency-Key", key);
    if (ifNoneMatch is not null) request.Headers.TryAddWithoutValidation("If-None-Match", ifNoneMatch);
    using var response = await client.SendAsync(request, ct);
    var bytes = await response.Content.ReadAsByteArrayAsync(ct);
    return new P07Response(response.StatusCode, bytes, response.Headers, response.Content.Headers.ContentType?.MediaType);
  }

  public static StringContent Json(string json) => new(json, Encoding.UTF8, "application/json");
  public static StringContent Json(JsonNode json) => Json(json.ToJsonString());

  public Task<P07Response> Get(string path, string? ifNoneMatch = null) => Send(HttpMethod.Get, path, ifNoneMatch: ifNoneMatch);

  public Task<P07Response> Create(JsonNode? document = null, string? key = null, Guid? copyPhotoFrom = null) =>
    Send(HttpMethod.Post, "/api/v1/resumes", Json(new JsonObject
    {
      ["source"] = "document",
      ["document"] = document?.DeepClone() ?? P07Docs.Blank(),
      ["copyPhotoFromResumeId"] = copyPhotoFrom?.ToString(),
    }), key: key ?? NewKey());

  public Task<P07Response> Copy(Guid source, string? title = null, string? key = null) =>
    Send(HttpMethod.Post, "/api/v1/resumes", Json(new JsonObject { ["source"] = "copy", ["sourceResumeId"] = source.ToString(), ["title"] = title }), key: key ?? NewKey());

  public async Task<P07Created> Created(JsonNode? document = null)
  {
    var response = await Create(document);
    Assert.Equal(201, response.Code);
    return new P07Created(Guid.Parse(response.Json["id"]!.ToString()), response.ETag!, response.Json);
  }

  public Task<P07Response> Put(Guid resume, JsonNode document, string? ifMatch, string? key = null) =>
    Send(HttpMethod.Put, $"/api/v1/resumes/{resume}/document", Json(document), ifMatch, key ?? NewKey());

  public Task<P07Response> Trash(Guid resume, string? ifMatch, string? key = null) => Send(HttpMethod.Delete, $"/api/v1/resumes/{resume}", null, ifMatch, key ?? NewKey());
  public Task<P07Response> Restore(Guid resume, string? ifMatch, string? key = null) => Send(HttpMethod.Post, $"/api/v1/resumes/{resume}/restore", null, ifMatch, key ?? NewKey());
  public Task<P07Response> Purge(Guid resume, string? ifMatch, string? key = null) => Send(HttpMethod.Post, $"/api/v1/resumes/{resume}/purge", null, ifMatch, key ?? NewKey());
  public Task<P07Response> Snapshot(Guid resume, string? key = null) => Send(HttpMethod.Post, $"/api/v1/resumes/{resume}/snapshots", Json("{\"reason\":\"before_export\"}"), key: key ?? NewKey());
  public Task<P07Response> RemovePhoto(Guid resume, string? ifMatch, string? key = null) => Send(HttpMethod.Delete, $"/api/v1/resumes/{resume}/photo", null, ifMatch, key ?? NewKey());
  public Task<P07Response> Crop(Guid resume, int x, int y, int width, int height, string? ifMatch, string? key = null) =>
    Send(HttpMethod.Put, $"/api/v1/resumes/{resume}/photo/crop", Json(new JsonObject { ["x"] = x, ["y"] = y, ["width"] = width, ["height"] = height }), ifMatch, key ?? NewKey());

  public static MultipartFormDataContent PhotoForm(byte[] bytes, string fileName = "photo.bin", string declaredType = "application/octet-stream", string partName = "file")
  {
    var part = new ByteArrayContent(bytes);
    part.Headers.ContentType = new MediaTypeHeaderValue(declaredType);
    return new MultipartFormDataContent { { part, partName, fileName } };
  }

  public Task<P07Response> Upload(Guid resume, byte[] bytes, string? ifMatch, string? key = null, string fileName = "photo.bin", string declaredType = "application/octet-stream") =>
    Send(HttpMethod.Post, $"/api/v1/resumes/{resume}/photo", PhotoForm(bytes, fileName, declaredType), ifMatch, key ?? NewKey());

  /// <summary>A resume with an uploaded photo. Returns the created resume with the ETag after the upload.</summary>
  public async Task<P07Created> WithPhoto(byte[]? image = null, JsonNode? document = null)
  {
    var created = await Created(document);
    var uploaded = await Upload(created.Id, image ?? P07Images.Png(40, 40), created.ETag);
    Assert.Equal(200, uploaded.Code);
    return created with { ETag = uploaded.ETag!, Json = uploaded.Json };
  }

  public async Task<long> CurrentVersion(Guid resume) => (await Get($"/api/v1/resumes/{resume}")).Version;

  /// <summary>Marks the address verified and re-authenticates, as `exportAccountData` and `requestAccountDeletion` require.</summary>
  public async Task Reauthenticate()
  {
    var ct = TestContext.Current.CancellationToken;
    Assert.True(await Host.Services.GetRequiredService<IAccountStore>().TryVerifyEmailAsync(Id, Host.Time.UtcNow, ct));
    var response = await Send(HttpMethod.Post, "/api/v1/auth/reauthenticate", Json(new JsonObject { ["password"] = P07Host.Password }));
    Assert.Equal(204, response.Code);
  }
}

internal static class P07Docs
{
  public static JsonObject Blank(string title = "Untitled resume")
  {
    var document = P07Contract.Example("CreateFromDocumentExample")["document"]!.DeepClone().AsObject();
    document["title"] = title;
    return document;
  }

  public static JsonObject Full() => P07Contract.Example("ResumeDocumentFull").DeepClone().AsObject();

  public static JsonObject Run(string value) => new() { ["kind"] = "text", ["value"] = value, ["bold"] = false, ["italic"] = false, ["underline"] = false };
  public static JsonObject Contact(string text = "x") => new() { ["id"] = Guid.NewGuid().ToString(), ["text"] = text, ["url"] = null, ["kind"] = "other" };
  public static JsonObject Section(string type, string title, JsonNode content) => new()
  {
    ["id"] = Guid.NewGuid().ToString(),
    ["type"] = type,
    ["title"] = title,
    ["hidden"] = false,
    ["listColumns"] = null,
    ["placement"] = null,
    ["content"] = content,
  };
  public static JsonObject TextSection(string value, string title = "Summary") =>
    Section("text", title, new JsonObject { ["body"] = new JsonArray(new JsonObject { ["kind"] = "paragraph", ["inlines"] = new JsonArray(Run(value)) }) });
  public static JsonObject Item(string value = "x") => new() { ["id"] = Guid.NewGuid().ToString(), ["text"] = new JsonArray(Run(value)) };
  public static JsonObject ListSection(params JsonObject[] items) => Section("list", "Skills", new JsonObject { ["items"] = new JsonArray([.. items]) });
  public static JsonObject Entry(string title = "x") => new()
  {
    ["id"] = Guid.NewGuid().ToString(),
    ["title"] = title,
    ["organization"] = "",
    ["location"] = "",
    ["start"] = null,
    ["end"] = null,
    ["dateText"] = "",
    ["description"] = new JsonArray(),
    ["pageBreakBefore"] = false,
  };
  public static JsonObject EntriesSection(params JsonObject[] entries) => Section("entries", "Experience", new JsonObject { ["labels"] = null, ["entries"] = new JsonArray([.. entries]) });
  public static JsonObject InlineSection(string value = "x") =>
    Section("inline", "Languages", new JsonObject { ["body"] = new JsonArray(new JsonObject { ["kind"] = "paragraph", ["inlines"] = new JsonArray(Run(value)) }) });

  public static JsonObject WithSections(params JsonObject[] sections)
  {
    var document = Blank();
    document["sections"] = new JsonArray([.. sections]);
    return document;
  }

  public static bool SameJson(string expected, string actual) => JsonNode.DeepEquals(JsonNode.Parse(expected), JsonNode.Parse(actual));
}

/// <summary>The frozen contract with typed YAML scalars, so examples and schemas keep their numbers, booleans and enum values.</summary>
internal static class P07Contract
{
  private static readonly Lazy<JsonNode> Contract = new(() =>
  {
    var path = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../..", "contracts/openapi/openapi.yaml"));
    var yaml = new DeserializerBuilder().WithAttemptingUnquotedStringTypeDeserialization().Build().Deserialize<object>(File.ReadAllText(path));
    return JsonNode.Parse(new SerializerBuilder().JsonCompatible().Build().Serialize(yaml))!;
  });
  private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, JsonSchema> Schemas = new();
  private static readonly EvaluationOptions Options = new() { RequireFormatValidation = true };

  public static JsonNode Root => Contract.Value;
  public static JsonNode Example(string name) => Root["components"]!["examples"]![name]!["value"]!.DeepClone();

  public static bool IsValid(string schemaName, string json)
  {
    var schema = Schemas.GetOrAdd(schemaName, name =>
    {
      var definitions = Root["components"]!["schemas"]!.DeepClone();
      Assert.NotNull(definitions[name]);
      RewriteReferences(definitions);
      return JsonSchema.FromText(new JsonObject { ["$ref"] = $"#/$defs/{name}", ["$defs"] = definitions }.ToJsonString());
    });
    return schema.Evaluate(JsonNode.Parse(json), Options).IsValid;
  }

  private static void RewriteReferences(JsonNode? node)
  {
    if (node is JsonArray array) { foreach (var item in array) RewriteReferences(item); return; }
    if (node is not JsonObject values) return;
    foreach (var entry in values.ToArray())
    {
      if (entry.Key == "$ref") values[entry.Key] = entry.Value!.ToString().Replace("#/components/schemas/", "#/$defs/", StringComparison.Ordinal);
      else RewriteReferences(entry.Value);
    }
  }
}

/// <summary>Synthetic image fixtures. Encoded at runtime so no binary test asset can carry unknown metadata.</summary>
internal static class P07Images
{
  public static byte[] Encode(SKEncodedImageFormat format, int width, int height, SKColor color, int quality = 90)
  {
    using var bitmap = new SKBitmap(new SKImageInfo(width, height, SKColorType.Rgba8888, format == SKEncodedImageFormat.Jpeg ? SKAlphaType.Opaque : SKAlphaType.Unpremul));
    bitmap.Erase(color);
    using var image = SKImage.FromBitmap(bitmap);
    using var data = image.Encode(format, quality);
    return data.ToArray();
  }

  public static byte[] Png(int width, int height) => Encode(SKEncodedImageFormat.Png, width, height, new SKColor(40, 120, 160));
  public static byte[] Jpeg(int width, int height) => Encode(SKEncodedImageFormat.Jpeg, width, height, new SKColor(40, 120, 160));
  public static byte[] Webp(int width, int height) => Encode(SKEncodedImageFormat.Webp, width, height, new SKColor(40, 120, 160));
  public static byte[] TransparentPng(int width, int height) => Encode(SKEncodedImageFormat.Png, width, height, new SKColor(0, 0, 0, 0));

  /// <summary>A grayscale PNG, so large dimensions stay cheap to build. The API must refuse it from the header alone.</summary>
  public static byte[] GrayPng(int width, int height)
  {
    using var bitmap = new SKBitmap(new SKImageInfo(width, height, SKColorType.Gray8, SKAlphaType.Opaque));
    bitmap.Erase(SKColors.Gray);
    using var image = SKImage.FromBitmap(bitmap);
    using var data = image.Encode(SKEncodedImageFormat.Png, 1);
    return data.ToArray();
  }

  /// <summary>Left half red, right half blue: the sides tell whether an orientation was applied.</summary>
  public static byte[] TwoColourJpeg(int width, int height)
  {
    using var bitmap = new SKBitmap(new SKImageInfo(width, height, SKColorType.Rgba8888, SKAlphaType.Opaque));
    using (var canvas = new SKCanvas(bitmap))
    using (var red = new SKPaint { Color = SKColors.Red })
    using (var blue = new SKPaint { Color = SKColors.Blue })
    {
      canvas.DrawRect(0, 0, width / 2f, height, red);
      canvas.DrawRect(width / 2f, 0, width / 2f, height, blue);
    }
    using var image = SKImage.FromBitmap(bitmap);
    using var data = image.Encode(SKEncodedImageFormat.Jpeg, 95);
    return data.ToArray();
  }

  /// <summary>Splices an APP1 EXIF segment right after the JPEG SOI: orientation, description marker and a GPS IFD.</summary>
  public static byte[] WithExif(byte[] jpeg, ushort orientation = 1)
  {
    var marker = Encoding.ASCII.GetBytes("P07GPSMARKER\0");
    using var tiff = new MemoryStream();
    using var writer = new BinaryWriter(tiff);
    writer.Write("II"u8); writer.Write((ushort)42); writer.Write(8u);
    // IFD0: orientation, description, GPS pointer.
    const uint descriptionOffset = 8 + 2 + 3 * 12 + 4;
    var gpsOffset = descriptionOffset + (uint)marker.Length;
    writer.Write((ushort)3);
    writer.Write((ushort)0x0112); writer.Write((ushort)3); writer.Write(1u); writer.Write((uint)orientation);
    writer.Write((ushort)0x010E); writer.Write((ushort)2); writer.Write((uint)marker.Length); writer.Write(descriptionOffset);
    writer.Write((ushort)0x8825); writer.Write((ushort)4); writer.Write(1u); writer.Write(gpsOffset);
    writer.Write(0u);
    writer.Write(marker);
    // GPS IFD: GPSLatitudeRef only, which is enough to prove the IFD is gone.
    writer.Write((ushort)1);
    writer.Write((ushort)0x0001); writer.Write((ushort)2); writer.Write(2u); writer.Write((uint)'N');
    writer.Write(0u);
    writer.Flush();
    var payload = Encoding.ASCII.GetBytes("Exif\0\0").Concat(tiff.ToArray()).ToArray();
    var length = payload.Length + 2;
    byte[] segment = [0xFF, 0xE1, (byte)(length >> 8), (byte)length, .. payload];
    return [.. jpeg[..2], .. segment, .. jpeg[2..]];
  }

  public static (int Width, int Height) Size(byte[] image)
  {
    using var bitmap = SKBitmap.Decode(image);
    Assert.NotNull(bitmap);
    return (bitmap.Width, bitmap.Height);
  }

  public static SKColor Pixel(byte[] image, int x, int y)
  {
    using var bitmap = SKBitmap.Decode(image);
    Assert.NotNull(bitmap);
    return bitmap.GetPixel(x, y);
  }

  public static bool Contains(byte[] haystack, string needle) => haystack.AsSpan().IndexOf(Encoding.ASCII.GetBytes(needle)) >= 0;
}

internal static class P07Mongo
{
  public static IMongoCollection<BsonDocument> Collection(this P07Containers containers, string name) => containers.Database.GetCollection<BsonDocument>(name);
  public static FilterDefinition<BsonDocument> Eq(string field, string value) => Builders<BsonDocument>.Filter.Eq(field, value);
}
