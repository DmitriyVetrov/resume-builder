using System.Diagnostics;
using System.Net;
using System.Text.Json;
using Testcontainers.MongoDb;
using Xunit;

namespace ResumeBuilder.Api.Tests;

public sealed class HostTests
{
  private static readonly string Root = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../.."));
  private static readonly string Project = Path.Combine(Root, "src/ResumeBuilder.Api/ResumeBuilder.Api.csproj");
  private static readonly string Dll = Path.Combine(Root, "src/ResumeBuilder.Api/bin/Release/net10.0/ResumeBuilder.Api.dll");

  [Fact]
  public async Task LivenessIsAnonymousAndProcessOnly()
  {
    await using var host = await Host.Start("mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=500");
    using var response = await host.Client.GetAsync("/api/v1/health/live", TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
    Assert.Equal("{\"status\":\"ok\"}", (await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).Replace(" ", ""));
    Assert.True(ContractSchemas.IsValid("HealthStatus", await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)));
  }

  [Fact]
  public async Task RootHealthAliasesAreAbsent()
  {
    await using var host = await Host.Start("mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=500");
    using var live = await host.Client.GetAsync("/health/live", TestContext.Current.CancellationToken);
    using var ready = await host.Client.GetAsync("/health/ready", TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.NotFound, live.StatusCode);
    Assert.Equal(HttpStatusCode.NotFound, ready.StatusCode);
  }

  [Fact]
  public async Task ReadinessFailsWithoutMongoButDoesNotIdentifyDependency()
  {
    await using var host = await Host.Start("mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=500");
    using var response = await host.Client.GetAsync("/api/v1/health/ready", TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
    Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    var content = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
    Assert.True(ContractSchemas.IsValid("Problem", content));
    using var json = JsonDocument.Parse(content);
    Assert.Equal("service_unavailable", json.RootElement.GetProperty("code").GetString());
    Assert.Equal(503, json.RootElement.GetProperty("status").GetInt32());
    var body = json.RootElement.GetRawText();
    Assert.DoesNotContain("mongo", body, StringComparison.OrdinalIgnoreCase);
    Assert.DoesNotContain("127.0.0.1", body);
  }

  [Fact]
  public async Task SharedRateLimitRejectsRequest601WithRetryAfter()
  {
    await using var host = await Host.Start("mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=500");
    // Host.Start asserts the first allowed request; these are permits 2 through 600.
    for (var i = 0; i < 599; i++)
    {
      using var response = await host.Client.GetAsync(i % 2 == 0 ? "/api/v1/health/live" : "/api/v1/health/ready", TestContext.Current.CancellationToken);
      Assert.NotEqual(HttpStatusCode.TooManyRequests, response.StatusCode);
    }
    using var rejected = await host.Client.GetAsync("/api/v1/health/live", TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.TooManyRequests, rejected.StatusCode);
    Assert.True(rejected.Headers.TryGetValues("Retry-After", out var values));
    Assert.True(int.TryParse(values.Single(), out var seconds) && seconds >= 0);
    using var json = JsonDocument.Parse(await rejected.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    Assert.Equal("rate_limited", json.RootElement.GetProperty("code").GetString());
    Assert.True(ContractSchemas.IsValid("Problem", json.RootElement.GetRawText()));
  }

  [Fact]
  public async Task ReadinessSucceedsWhenPinnedMongoResponds()
  {
    Assert.True(File.Exists(Project), "Required Api host project is missing");
    var image = Environment.GetEnvironmentVariable("RESUMISER_MONGO_IMAGE");
    Assert.False(string.IsNullOrWhiteSpace(image), "ENV_MISSING RESUMISER_MONGO_IMAGE");
    Assert.Contains("@sha256:", image);
    await using var mongo = new MongoDbBuilder().WithImage(image).WithReplicaSet("rs0").Build();
    await mongo.StartAsync(TestContext.Current.CancellationToken);
    await using var host = await Host.Start(mongo.GetConnectionString());
    using var response = await host.Client.GetAsync("/api/v1/health/ready", TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
    using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    Assert.Equal("ok", json.RootElement.GetProperty("status").GetString());
    Assert.True(ContractSchemas.IsValid("HealthStatus", json.RootElement.GetRawText()));
  }

  [Fact]
  public async Task UntrustedForwardingCannotEvadeSharedHealthLimit()
  {
    await using var host = await Host.Start("mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=500");
    // Host.Start asserts the first allowed request from this direct peer.
    for (var i = 0; i < 599; i++)
    {
      using var request = new HttpRequestMessage(HttpMethod.Get, i % 2 == 0 ? "/api/v1/health/live" : "/api/v1/health/ready");
      request.Headers.TryAddWithoutValidation("X-Forwarded-For", $"198.51.100.{i % 250 + 1}");
      using var response = await host.Client.SendAsync(request, TestContext.Current.CancellationToken);
      Assert.NotEqual(HttpStatusCode.TooManyRequests, response.StatusCode);
    }
    using var forged = new HttpRequestMessage(HttpMethod.Get, "/api/v1/health/live");
    forged.Headers.TryAddWithoutValidation("X-Forwarded-For", "203.0.113.17");
    using var rejected = await host.Client.SendAsync(forged, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.TooManyRequests, rejected.StatusCode);
  }

  [Fact]
  public async Task ConfiguredTrustedProxyPartitionsForwardedClients()
  {
    await using var host = await Host.Start("mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=500", trustedProxy: "127.0.0.1");
    for (var i = 0; i < 600; i++)
    {
      using var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/health/live");
      request.Headers.TryAddWithoutValidation("X-Forwarded-For", "198.51.100.10");
      using var response = await host.Client.SendAsync(request, TestContext.Current.CancellationToken);
      Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
    using var limited = new HttpRequestMessage(HttpMethod.Get, "/api/v1/health/live");
    limited.Headers.TryAddWithoutValidation("X-Forwarded-For", "198.51.100.10");
    using var rejected = await host.Client.SendAsync(limited, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.TooManyRequests, rejected.StatusCode);
    using var other = new HttpRequestMessage(HttpMethod.Get, "/api/v1/health/live");
    other.Headers.TryAddWithoutValidation("X-Forwarded-For", "198.51.100.11");
    using var allowed = await host.Client.SendAsync(other, TestContext.Current.CancellationToken);
    Assert.Equal(HttpStatusCode.OK, allowed.StatusCode);
  }

  [Fact]
  public async Task MissingMongoConfigurationFailsStartupWithoutPrintingValues()
  {
    Assert.True(File.Exists(Project), "Required Api host project is missing");
    using var process = Host.Launch(null);
    using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(20));
    try { await process.WaitForExitAsync(timeout.Token); }
    catch (OperationCanceledException) { process.Kill(entireProcessTree: true); throw new Xunit.Sdk.XunitException("Host accepted missing required Mongo configuration"); }
    Assert.NotEqual(0, process.ExitCode);
  }

  [Fact]
  public async Task MalformedMongoConfigurationFailsStartupWithoutEchoingValue()
  {
    Assert.True(File.Exists(Project), "Required Api host project is missing");
    const string marker = "invalid-synthetic-connection-marker";
    using var process = Host.Launch(marker);
    var stdout = process.StandardOutput.ReadToEndAsync(TestContext.Current.CancellationToken);
    var stderr = process.StandardError.ReadToEndAsync(TestContext.Current.CancellationToken);
    using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(20));
    try { await process.WaitForExitAsync(timeout.Token); }
    catch (OperationCanceledException) { process.Kill(entireProcessTree: true); throw new Xunit.Sdk.XunitException("Host accepted malformed required Mongo configuration"); }
    Assert.NotEqual(0, process.ExitCode);
    Assert.False((await stdout + await stderr).Contains(marker, StringComparison.Ordinal), "Startup output disclosed a configured value");
  }

  private sealed class Host : IAsyncDisposable
  {
    private readonly Process process;
    public HttpClient Client { get; }
    private Host(Process process, HttpClient client) { this.process = process; Client = client; }
    public static Process Launch(string? mongo, int? port = null, string? trustedProxy = null)
    {
      Assert.True(File.Exists(Dll), "Required built Api host assembly is missing");
      var info = new ProcessStartInfo("dotnet") { UseShellExecute = false, RedirectStandardOutput = true, RedirectStandardError = true, WorkingDirectory = Path.GetDirectoryName(Dll)! };
      info.ArgumentList.Add(Dll);
      if (port is not null) info.Environment["ASPNETCORE_URLS"] = $"http://127.0.0.1:{port}";
      info.Environment.Remove("Mongo__ConnectionString");
      if (mongo is not null) info.Environment["Mongo__ConnectionString"] = mongo;
      if (trustedProxy is not null) info.Environment["ReverseProxy__TrustedProxies__0"] = trustedProxy;
      return Process.Start(info)!;
    }
    public static async Task<Host> Start(string mongo, string? trustedProxy = null)
    {
      Assert.True(File.Exists(Project), "Required Api host project is missing");
      var listener = System.Net.Sockets.TcpListener.Create(0);
      listener.Start();
      var number = ((IPEndPoint)listener.LocalEndpoint).Port;
      listener.Stop();
      var process = Launch(mongo, number, trustedProxy);
      _ = process.StandardOutput.ReadToEndAsync();
      _ = process.StandardError.ReadToEndAsync();
      var client = new HttpClient { BaseAddress = new Uri($"http://127.0.0.1:{number}"), Timeout = TimeSpan.FromSeconds(3) };
      var deadline = Stopwatch.StartNew();
      while (deadline.Elapsed < TimeSpan.FromSeconds(20))
      {
        if (process.HasExited) break;
        try { using var response = await client.GetAsync("/api/v1/health/live", TestContext.Current.CancellationToken); Assert.Equal(HttpStatusCode.OK, response.StatusCode); return new Host(process, client); }
        catch (HttpRequestException) { await Task.Delay(100, TestContext.Current.CancellationToken); }
      }
      process.Kill(entireProcessTree: true);
      throw new Xunit.Sdk.XunitException("Api host did not start");
    }
    public ValueTask DisposeAsync()
    {
      Client.Dispose();
      if (!process.HasExited) process.Kill(entireProcessTree: true);
      process.Dispose();
      return ValueTask.CompletedTask;
    }
  }
}
