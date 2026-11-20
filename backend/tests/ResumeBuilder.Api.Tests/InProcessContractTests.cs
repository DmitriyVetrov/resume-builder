using System.Collections;
using System.Reflection;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.Hosting;
using Xunit;

namespace ResumeBuilder.Api.Tests;

public sealed class InProcessContractTests
{
  private static readonly string ApiAssembly = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../src/ResumeBuilder.Api/bin/Release/net10.0/ResumeBuilder.Api.dll"));
  private static readonly string[] ExpectedOperations =
  [
    "DELETE /api/v1/account",
    "DELETE /api/v1/resumes/{resumeId}",
    "DELETE /api/v1/resumes/{resumeId}/photo",
    "GET /api/v1/account/data-export",
    "GET /api/v1/health/live",
    "GET /api/v1/health/ready",
    "GET /api/v1/resumes",
    "GET /api/v1/resumes/{resumeId}",
    "GET /api/v1/resumes/{resumeId}/photo/master",
    "GET /api/v1/resumes/{resumeId}/photo/rendition",
    "GET /api/v1/resumes/{resumeId}/snapshots",
    "GET /api/v1/resumes/{resumeId}/snapshots/{snapshotId}",
    "GET /api/v1/session",
    "POST /api/v1/auth/login",
    "POST /api/v1/auth/logout",
    "POST /api/v1/auth/password-reset/confirm",
    "POST /api/v1/auth/password-reset/request",
    "POST /api/v1/auth/reauthenticate",
    "POST /api/v1/auth/resend-verification",
    "POST /api/v1/auth/sign-up",
    "POST /api/v1/auth/verify-email",
    "POST /api/v1/client-events",
    "POST /api/v1/resume-imports/structure",
    "POST /api/v1/resumes",
    "POST /api/v1/resumes/{resumeId}/photo",
    "POST /api/v1/resumes/{resumeId}/purge",
    "POST /api/v1/resumes/{resumeId}/restore",
    "POST /api/v1/resumes/{resumeId}/snapshots",
    "PUT /api/v1/account/password",
    "PUT /api/v1/resumes/{resumeId}/document",
    "PUT /api/v1/resumes/{resumeId}/photo/crop"
  ];

  [Fact]
  public void InBoxOpenApiInventoryMatchesFrozenP04Slice()
  {
    Assert.True(File.Exists(ApiAssembly), "Required built Api host assembly is missing");
    var assembly = Assembly.LoadFrom(ApiAssembly);
    var program = assembly.GetTypes().SingleOrDefault(type => type.Name == "Program");
    Assert.NotNull(program);
    var factoryType = typeof(WebApplicationFactory<>).MakeGenericType(program);
    using var factory = (IDisposable)Activator.CreateInstance(factoryType)!;
    Action<IWebHostBuilder> configure = builder => builder.UseContentRoot(Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../src/ResumeBuilder.Api"))).UseSetting("Mongo:ConnectionString", "mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=500");
    using var configured = (IDisposable)factoryType.GetMethod("WithWebHostBuilder")!.Invoke(factory, [configure])!;
    using var client = (HttpClient)factoryType.GetMethod("CreateClient", Type.EmptyTypes)!.Invoke(configured, null)!;
    var services = (IServiceProvider)factoryType.GetProperty("Services")!.GetValue(configured)!;
    var providerType = Type.GetType("Microsoft.AspNetCore.OpenApi.IOpenApiDocumentProvider, Microsoft.AspNetCore.OpenApi");
    Assert.NotNull(providerType);
    var provider = services.GetService(providerType);
    Assert.NotNull(provider);
    var pending = providerType.GetMethod("GetOpenApiDocumentAsync")!.Invoke(provider, [TestContext.Current.CancellationToken])!;
    var awaiter = pending.GetType().GetMethod("GetAwaiter")!.Invoke(pending, null)!;
    var document = awaiter.GetType().GetMethod("GetResult")!.Invoke(awaiter, null)!;
    var paths = (IEnumerable)document.GetType().GetProperty("Paths")!.GetValue(document)!;
    var actual = new Dictionary<string, string>();
    foreach (var pathEntry in paths)
    {
      var path = (string)pathEntry.GetType().GetProperty("Key")!.GetValue(pathEntry)!;
      var pathItem = pathEntry.GetType().GetProperty("Value")!.GetValue(pathEntry)!;
      var operations = (IEnumerable)pathItem.GetType().GetProperty("Operations")!.GetValue(pathItem)!;
      foreach (var operationEntry in operations)
      {
        var method = operationEntry.GetType().GetProperty("Key")!.GetValue(operationEntry)!.ToString()!.ToUpperInvariant();
        var operation = operationEntry.GetType().GetProperty("Value")!.GetValue(operationEntry)!;
        var responses = (IEnumerable)operation.GetType().GetProperty("Responses")!.GetValue(operation)!;
        var statuses = responses.Cast<object>().Select(entry => entry.GetType().GetProperty("Key")!.GetValue(entry)!.ToString());
        if (path.StartsWith("/api/v1/health/", StringComparison.Ordinal))
        {
          var security = operation.GetType().GetProperty("Security")!.GetValue(operation) as IEnumerable;
          Assert.Empty(security?.Cast<object>() ?? []);
        }
        actual[$"{method} {path}"] = string.Join(',', statuses);
      }
    }
    Assert.Contains("GET /api/v1/health/live", actual.Keys);
    Assert.Contains("GET /api/v1/health/ready", actual.Keys);
    Assert.Equal("200,429,default", actual["GET /api/v1/health/live"]);
    Assert.Equal("200,429,503,default", actual["GET /api/v1/health/ready"]);
    Assert.Equal(ExpectedOperations.Order(StringComparer.Ordinal), actual.Keys.Order(StringComparer.Ordinal));
  }
}
