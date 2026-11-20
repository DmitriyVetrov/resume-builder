using System.Reflection;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Xunit;

namespace ResumeBuilder.Api.Tests;

public sealed class ExceptionTests
{
  private static readonly string ApiAssembly = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../src/ResumeBuilder.Api/bin/Release/net10.0/ResumeBuilder.Api.dll"));
  private const string Marker = "synthetic-exception-private-marker";
  private const string QueryMarker = "synthetic-query-private-marker";

  [Fact]
  public async Task UnexpectedHealthExceptionUsesContentFreeContractedProblem()
  {
    Assert.True(File.Exists(ApiAssembly), "Required built Api host assembly is missing");
    var program = Assembly.LoadFrom(ApiAssembly).GetTypes().Single(type => type.Name == "Program");
    var factoryType = typeof(WebApplicationFactory<>).MakeGenericType(program);
    using var factory = (IDisposable)Activator.CreateInstance(factoryType)!;
    using var logs = new LoggingTests.CaptureProvider();
    Action<IWebHostBuilder> configure = builder =>
    {
      builder.UseContentRoot(Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../src/ResumeBuilder.Api")));
      builder.UseSetting("Mongo:ConnectionString", "mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=500");
      builder.ConfigureServices(services => services.AddTransient<IStartupFilter, ThrowBeforeHealthEndpoint>());
      builder.ConfigureLogging(logging => logging.AddProvider(logs));
    };
    using var configured = (IDisposable)factoryType.GetMethod("WithWebHostBuilder")!.Invoke(factory, [configure])!;
    using var client = (HttpClient)factoryType.GetMethod("CreateClient", Type.EmptyTypes)!.Invoke(configured, null)!;
    using var request = new HttpRequestMessage(HttpMethod.Get, $"/api/v1/health/ready?probe={QueryMarker}");
    request.Headers.TryAddWithoutValidation("X-Test-Private", Marker);
    using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
    Assert.Equal(500, (int)response.StatusCode);
    Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
    Assert.False(body.Contains(Marker, StringComparison.Ordinal), "Problem disclosed exception/request data");
    Assert.False(body.Contains(QueryMarker, StringComparison.Ordinal), "Problem disclosed query data");
    Assert.True(ContractSchemas.IsValid("Problem", body));
    using var json = JsonDocument.Parse(body);
    Assert.Equal(500, json.RootElement.GetProperty("status").GetInt32());
    Assert.Equal("internal_error", json.RootElement.GetProperty("code").GetString());
    var traceId = json.RootElement.GetProperty("traceId").GetString();
    Assert.False(string.IsNullOrWhiteSpace(traceId));
    var applicationLogs = logs.Entries.Where(x => x.Category.StartsWith("ResumeBuilder", StringComparison.Ordinal)).ToArray();
    Assert.Contains(applicationLogs, entry => entry.Fields.Any(field => field.Key == "TraceId" && field.Value == traceId));
    Assert.All(logs.Entries, entry =>
    {
      foreach (var marker in new[] { Marker, QueryMarker })
      {
        Assert.False(entry.Message.Contains(marker, StringComparison.Ordinal), "Log message disclosed exception/request data");
        Assert.False(entry.Exception.Contains(marker, StringComparison.Ordinal), "Log exception disclosed exception/request data");
        Assert.All(entry.Fields, field => Assert.False(field.Value.Contains(marker, StringComparison.Ordinal), "Structured log disclosed exception/request data"));
      }
    });
  }

  private sealed class ThrowBeforeHealthEndpoint : IStartupFilter
  {
    public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
    {
      app.Use(async (context, following) =>
          {
            if (context.Request.Path == "/api/v1/health/ready") throw new InvalidOperationException(Marker);
            await following(context);
          });
      next(app);
    };
  }
}
