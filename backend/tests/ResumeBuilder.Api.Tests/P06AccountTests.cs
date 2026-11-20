using System.Net;
using System.Net.Http.Json;
using System.Reflection;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace ResumeBuilder.Api.Tests;

public sealed class P06AccountTests
{
  private static IDisposable Start(out HttpClient client)
  {
    var apiAssembly = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../src/ResumeBuilder.Api/bin/Release/net10.0/ResumeBuilder.Api.dll"));
    var program = Assembly.LoadFrom(apiAssembly).GetTypes().Single(type => type.Name == "Program");
    var factoryType = typeof(WebApplicationFactory<>).MakeGenericType(program);
    var factory = (IDisposable)Activator.CreateInstance(factoryType)!;
    Action<IWebHostBuilder> configure = builder => builder.UseContentRoot(Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../src/ResumeBuilder.Api"))).UseSetting("Mongo:ConnectionString", "mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=500");
    var configured = (IDisposable)factoryType.GetMethod("WithWebHostBuilder")!.Invoke(factory, [configure])!;
    client = (HttpClient)factoryType.GetMethod("CreateClient", Type.EmptyTypes)!.Invoke(configured, null)!;
    client.BaseAddress = new Uri("https://localhost");
    return configured;
  }

  [Theory]
  [InlineData("GET", "/api/v1/session", 200)]
  [InlineData("POST", "/api/v1/auth/sign-up", 403)]
  [InlineData("POST", "/api/v1/auth/verify-email", 403)]
  [InlineData("POST", "/api/v1/auth/resend-verification", 403)]
  [InlineData("POST", "/api/v1/auth/login", 403)]
  [InlineData("POST", "/api/v1/auth/logout", 403)]
  [InlineData("POST", "/api/v1/auth/password-reset/request", 403)]
  [InlineData("POST", "/api/v1/auth/password-reset/confirm", 403)]
  [InlineData("POST", "/api/v1/auth/reauthenticate", 403)]
  [InlineData("PUT", "/api/v1/account/password", 401)]
  [InlineData("DELETE", "/api/v1/account", 401)]
  [InlineData("GET", "/api/v1/account/data-export", 401)]
  public async Task P06ContractOperationRespondsRatherThan404(string method, string path, int status)
  {
    using var host = Start(out var client);
    using (client)
    using (var request = new HttpRequestMessage(new HttpMethod(method), path))
    {
      if (method == "POST") request.Content = JsonContent.Create(new { email = "person-a@example.invalid", password = "correct horse battery staple", token = "invalid" });
      using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
      Assert.Equal((HttpStatusCode)status, response.StatusCode);
    }
  }

  [Fact]
  public async Task P06SessionAnonymousIssuesCsrfAndNoStore()
  {
    using var host = Start(out var client);
    using (client)
    using (var response = await client.GetAsync("/api/v1/session", TestContext.Current.CancellationToken))
    {
      Assert.Equal(HttpStatusCode.OK, response.StatusCode);
      Assert.Contains(response.Headers.GetValues("Set-Cookie"), cookie => cookie.StartsWith("XSRF-TOKEN=", StringComparison.Ordinal));
      Assert.Contains("no-store", response.Headers.CacheControl?.ToString());
      var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
      Assert.True(ContractSchemas.IsValid("SessionInfo", body));
      using var json = JsonDocument.Parse(body);
      Assert.False(json.RootElement.GetProperty("authenticated").GetBoolean());
    }
  }

  [Fact]
  public async Task P06ProductionSessionCookiesAreSecure()
  {
    using var host = Start(out var client);
    using (client)
    using (var response = await client.GetAsync("/api/v1/session", TestContext.Current.CancellationToken))
    {
      Assert.Equal(HttpStatusCode.OK, response.StatusCode);
      var csrf = response.Headers.GetValues("Set-Cookie").Single(cookie => cookie.StartsWith("XSRF-TOKEN=", StringComparison.Ordinal));
      Assert.Contains("Secure", csrf, StringComparison.OrdinalIgnoreCase);
      Assert.Contains("SameSite=Strict", csrf, StringComparison.OrdinalIgnoreCase);
    }
  }

  [Fact]
  public async Task P06AnonymousSignupWithoutCsrfIsRejectedAsSafeProblem()
  {
    using var host = Start(out var client);
    using (client)
    using (var response = await client.PostAsJsonAsync("/api/v1/auth/sign-up", new { email = "person-a@example.invalid", password = "correct horse battery staple" }, TestContext.Current.CancellationToken))
    {
      Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
      Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
      using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
      Assert.Equal("csrf_token_invalid", json.RootElement.GetProperty("code").GetString());
      Assert.Equal(403, json.RootElement.GetProperty("status").GetInt32());
      Assert.True(ContractSchemas.IsValid("Problem", json.RootElement.GetRawText()));
    }
  }
}
