using System.Collections.Concurrent;
using System.Reflection;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Logging;
using Xunit;

namespace ResumeBuilder.Api.Tests;

public sealed class LoggingTests
{
  private static readonly string[] AllowedFields = ["EventName", "Code", "TraceId", "RouteTemplate", "Status", "ElapsedMs", "{OriginalFormat}"];
  private static readonly string ApiAssembly = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../src/ResumeBuilder.Api/bin/Release/net10.0/ResumeBuilder.Api.dll"));

  [Fact]
  public async Task CapturedApplicationLogsExcludeSyntheticRequestMetadataAndNonOperationalFields()
  {
    Assert.True(File.Exists(ApiAssembly), "Required built Api host assembly is missing");
    var assembly = Assembly.LoadFrom(ApiAssembly);
    var program = assembly.GetTypes().Single(type => type.Name == "Program");
    var factoryType = typeof(WebApplicationFactory<>).MakeGenericType(program);
    using var factory = (IDisposable)Activator.CreateInstance(factoryType)!;
    using var provider = new CaptureProvider();
    Action<IWebHostBuilder> configure = builder =>
    {
      builder.UseContentRoot(Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../src/ResumeBuilder.Api")));
      builder.UseSetting("Mongo:ConnectionString", "mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=500");
      builder.ConfigureLogging(logging => logging.AddProvider(provider));
    };
    using var configured = (IDisposable)factoryType.GetMethod("WithWebHostBuilder")!.Invoke(factory, [configure])!;
    using var client = (HttpClient)factoryType.GetMethod("CreateClient", Type.EmptyTypes)!.Invoke(configured, null)!;
    const string marker = "synthetic-private-metadata-marker";
    using var request = new HttpRequestMessage(HttpMethod.Get, $"/api/v1/health/ready?probe={marker}");
    request.Headers.TryAddWithoutValidation("X-Private-Metadata", marker);
    using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
    Assert.Equal(503, (int)response.StatusCode);
    var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
    Assert.False(body.Contains(marker, StringComparison.Ordinal), "Response disclosed request metadata");
    var entries = provider.Entries.ToArray();
    var applicationEntries = entries.Where(x => x.Category.StartsWith("ResumeBuilder", StringComparison.Ordinal)).ToArray();
    Assert.NotEmpty(applicationEntries);
    foreach (var entry in entries)
    {
      Assert.False(entry.Message.Contains(marker, StringComparison.Ordinal), "Log message disclosed request metadata");
      Assert.False(entry.Exception.Contains(marker, StringComparison.Ordinal), "Log exception disclosed request metadata");
      Assert.All(entry.Fields, field => Assert.False(field.Value.Contains(marker, StringComparison.Ordinal), "Structured log field disclosed request metadata"));
    }
    Assert.All(applicationEntries, entry => Assert.All(entry.Fields, field => Assert.Contains(field.Key, AllowedFields)));
  }

  internal sealed record Entry(string Category, string Message, string Exception, IReadOnlyList<KeyValuePair<string, string>> Fields);
  internal sealed class CaptureProvider : ILoggerProvider
  {
    public ConcurrentQueue<Entry> Entries { get; } = new();
    public ILogger CreateLogger(string categoryName) => new CaptureLogger(categoryName, Entries);
    public void Dispose() { }
  }
  private sealed class CaptureLogger(string category, ConcurrentQueue<Entry> entries) : ILogger
  {
    public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
    public bool IsEnabled(LogLevel level) => true;
    public void Log<TState>(LogLevel level, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
    {
      var fields = state is IEnumerable<KeyValuePair<string, object?>> values
          ? values.Select(x => new KeyValuePair<string, string>(x.Key, x.Value?.ToString() ?? "")).ToArray()
          : [];
      entries.Enqueue(new Entry(category, formatter(state, exception), exception?.ToString() ?? "", fields));
    }
  }
}
