using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using ResumeBuilder.Application.Accounts;
using Xunit;

namespace ResumeBuilder.Api.Tests;

/// <summary>Contract-driven authorization matrix and transport hardening (AC-P13-07, AC-P13-11…13).</summary>
[Collection("P13")]
public sealed class P13SecurityTests(P07Containers containers)
{
  private static CancellationToken Ct => TestContext.Current.CancellationToken;

  /// <summary>One request per contract operation. Class comes from the contract's own `security`; scope from `{resumeId}`.</summary>
  private sealed record Op(string Id, HttpMethod Method, string Path, Func<HttpContent?>? Body = null, bool Versioned = false, bool Keyed = false)
  {
    public bool OwnerScoped => Path.Contains("{resumeId}", StringComparison.Ordinal);
    public string For(Guid resume, Guid snapshot) => Path.Replace("{resumeId}", resume.ToString(), StringComparison.Ordinal).Replace("{snapshotId}", snapshot.ToString(), StringComparison.Ordinal);
  }

  private static StringContent Json(string json) => P07User.Json(json);

  private static readonly Op[] Matrix =
  [
    new("getLiveness", HttpMethod.Get, "/api/v1/health/live"),
    new("getReadiness", HttpMethod.Get, "/api/v1/health/ready"),
    new("getSession", HttpMethod.Get, "/api/v1/session"),
    new("signUp", HttpMethod.Post, "/api/v1/auth/sign-up", () => Json("{\"email\":\"matrix@example.invalid\",\"password\":\"matrix-password-1\"}")),
    new("verifyEmail", HttpMethod.Post, "/api/v1/auth/verify-email", () => Json("{\"token\":\"x\"}")),
    new("resendVerification", HttpMethod.Post, "/api/v1/auth/resend-verification", () => Json("{\"email\":\"matrix@example.invalid\"}")),
    new("login", HttpMethod.Post, "/api/v1/auth/login", () => Json("{\"email\":\"matrix@example.invalid\",\"password\":\"matrix-password-1\"}")),
    new("logout", HttpMethod.Post, "/api/v1/auth/logout"),
    new("requestPasswordReset", HttpMethod.Post, "/api/v1/auth/password-reset/request", () => Json("{\"email\":\"matrix@example.invalid\"}")),
    new("confirmPasswordReset", HttpMethod.Post, "/api/v1/auth/password-reset/confirm", () => Json("{\"token\":\"x\",\"newPassword\":\"matrix-password-2\"}")),
    new("reauthenticate", HttpMethod.Post, "/api/v1/auth/reauthenticate", () => Json("{\"password\":\"matrix-password-1\"}")),
    new("changePassword", HttpMethod.Put, "/api/v1/account/password", () => Json("{\"newPassword\":\"matrix-password-2\"}")),
    new("requestAccountDeletion", HttpMethod.Delete, "/api/v1/account"),
    new("exportAccountData", HttpMethod.Get, "/api/v1/account/data-export"),
    new("listResumes", HttpMethod.Get, "/api/v1/resumes"),
    new("createResume", HttpMethod.Post, "/api/v1/resumes", () => Json(new JsonObject { ["source"] = "document", ["document"] = P07Docs.Blank(), ["copyPhotoFromResumeId"] = null }.ToJsonString()), Keyed: true),
    new("getResume", HttpMethod.Get, "/api/v1/resumes/{resumeId}"),
    new("trashResume", HttpMethod.Delete, "/api/v1/resumes/{resumeId}", Versioned: true, Keyed: true),
    new("replaceResumeDocument", HttpMethod.Put, "/api/v1/resumes/{resumeId}/document", () => Json(P07Docs.Blank("other").ToJsonString()), true, true),
    new("restoreResume", HttpMethod.Post, "/api/v1/resumes/{resumeId}/restore", Versioned: true, Keyed: true),
    new("purgeResume", HttpMethod.Post, "/api/v1/resumes/{resumeId}/purge", Versioned: true, Keyed: true),
    new("listSnapshots", HttpMethod.Get, "/api/v1/resumes/{resumeId}/snapshots"),
    new("createSnapshot", HttpMethod.Post, "/api/v1/resumes/{resumeId}/snapshots", () => Json("{\"reason\":\"before_export\"}"), Keyed: true),
    new("getSnapshot", HttpMethod.Get, "/api/v1/resumes/{resumeId}/snapshots/{snapshotId}"),
    new("uploadPhoto", HttpMethod.Post, "/api/v1/resumes/{resumeId}/photo", () => P07User.PhotoForm(P07Images.Png(20, 20)), true, true),
    new("removePhoto", HttpMethod.Delete, "/api/v1/resumes/{resumeId}/photo", Versioned: true, Keyed: true),
    new("updatePhotoCrop", HttpMethod.Put, "/api/v1/resumes/{resumeId}/photo/crop", () => Json("{\"x\":0,\"y\":0,\"width\":10,\"height\":10}"), true, true),
    new("getPhotoRendition", HttpMethod.Get, "/api/v1/resumes/{resumeId}/photo/rendition"),
    new("getPhotoMaster", HttpMethod.Get, "/api/v1/resumes/{resumeId}/photo/master"),
    new("reportClientEvents", HttpMethod.Post, "/api/v1/client-events", () => Json("{\"events\":[{\"type\":\"export_failed\",\"code\":\"pdf_write\",\"resumeId\":null,\"engineVersion\":\"1.1.0\",\"occurredAt\":\"2026-11-12T10:00:00Z\"}]}")),
    // IMP-01 B-17 (DD-IMP-19): the import operation joins the matrix.
    new("structureResumeImport", HttpMethod.Post, "/api/v1/resume-imports/structure", () => Json(Imp01ImportTests.Request().ToJsonString())),
  ];

  /// <summary>Operation ID → whether the contract requires a session for it.</summary>
  private static Dictionary<string, bool> ContractOperations()
  {
    var root = P07Contract.Root;
    var operations = new Dictionary<string, bool>(StringComparer.Ordinal);
    foreach (var (_, item) in root["paths"]!.AsObject())
      foreach (var (method, operation) in item!.AsObject())
      {
        if (method is not ("get" or "post" or "put" or "delete" or "patch")) continue;
        var security = (operation!["security"] ?? root["security"])?.AsArray() ?? [];
        var session = security.Count > 0 && security.All(requirement => requirement!.AsObject().ContainsKey("sessionCookie"));
        operations[operation["operationId"]!.ToString()] = session;
      }
    return operations;
  }

  private static async Task<P07Response> Call(P07User user, Op op, Guid resume, Guid snapshot, string? etag)
  {
    using var body = op.Body?.Invoke();
    return await user.Send(op.Method, op.For(resume, snapshot), body, op.Versioned ? etag ?? "\"1\"" : null, op.Keyed ? P07User.NewKey() : null);
  }

  private static async Task<P07User> Anonymous(P07Host host)
  {
    var client = host.CreateClient();
    using var session = await client.GetAsync("/api/v1/session", Ct);
    return new P07User(host, client, P07User.CsrfOf(session), Guid.Empty, "");
  }

  [Fact]
  public void S01EveryContractOperationIsInTheMatrix()
  {
    var contract = ContractOperations();
    var matrix = Matrix.Select(op => op.Id).ToHashSet(StringComparer.Ordinal);
    Assert.Equal(contract.Keys.Order(StringComparer.Ordinal), matrix.Order(StringComparer.Ordinal));
    Assert.Equal(Matrix.Length, matrix.Count);
    // Every owner-scoped path needs a session in the contract.
    Assert.All(Matrix.Where(op => op.OwnerScoped), op => Assert.True(contract[op.Id], $"{op.Id} is owner-scoped but public"));
  }

  [Fact]
  public async Task S02AnonymousCallersGet401OnEveryNonPublicOperation()
  {
    using var host = new P07Host(containers);
    var anonymous = await Anonymous(host);
    var contract = ContractOperations();
    var guarded = Matrix.Where(op => contract[op.Id]).ToArray();
    Assert.True(guarded.Length >= 20);
    foreach (var op in guarded)
    {
      var response = await Call(anonymous, op, Guid.NewGuid(), Guid.NewGuid(), null);
      Assert.True(response.Code == 401, $"{op.Id} answered {response.Code} to an anonymous caller");
    }
  }

  [Fact]
  public async Task S03AnotherUsersIdsAnswer404OnEveryOwnerOperationAndChangeNothing()
  {
    using var host = new P07Host(containers);
    var alice = await host.SignIn();
    var bob = await host.SignIn();
    var resume = await alice.WithPhoto();
    var snapshot = await alice.Snapshot(resume.Id);
    var snapshotId = Guid.Parse(snapshot.Json["id"]!.ToString());
    var before = (await alice.Get(resume.Path)).Body;
    var snapshotsBefore = (await alice.Get(resume.Path + "/snapshots")).Body;
    var blobsBefore = await containers.PhotoKeys(alice.Id);

    foreach (var op in Matrix.Where(op => op.OwnerScoped))
    {
      var response = await Call(bob, op, resume.Id, snapshotId, resume.ETag);
      Assert.True(response.Code == 404, $"{op.Id} answered {response.Code} to another user");
      response.AssertProblem(404, "not_found");
    }

    Assert.Equal(before, (await alice.Get(resume.Path)).Body);
    Assert.Equal(snapshotsBefore, (await alice.Get(resume.Path + "/snapshots")).Body);
    Assert.Equal(blobsBefore, await containers.PhotoKeys(alice.Id));
  }

  [Fact]
  public async Task S04AnAccountPendingDeletionHasNoWorkingSession()
  {
    using var host = new P07Host(containers);
    var alice = await host.SignIn();
    var resume = await alice.Created();
    await alice.Reauthenticate();
    Assert.Equal(202, (await alice.Send(HttpMethod.Delete, "/api/v1/account")).Code);

    var session = await alice.Get("/api/v1/session");
    Assert.Equal(200, session.Code);
    Assert.False(session.Json["authenticated"]!.GetValue<bool>());
    var contract = ContractOperations();
    foreach (var op in Matrix.Where(op => contract[op.Id] && op.Id != "requestAccountDeletion"))
    {
      var response = await Call(alice, op, resume.Id, Guid.NewGuid(), resume.ETag);
      // 401, or 403 when the antiforgery check runs first: either way nothing is served or changed.
      Assert.True(response.Code is 401 or 403, $"{op.Id} answered {response.Code} after the deletion request");
    }
  }

  [Fact]
  public async Task S05ProductionSendsHstsAndTestingDoesNot()
  {
    using var production = new P13Host(containers, "Production");
    using var https = production.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://app.example") });
    using var answer = await https.GetAsync("/api/v1/health/live", Ct);
    Assert.Equal(HttpStatusCode.OK, answer.StatusCode);
    Assert.True(answer.Headers.TryGetValues("Strict-Transport-Security", out var values), "No HSTS in Production");
    Assert.Equal("max-age=31536000; includeSubDomains", values!.Single());

    using var testing = new P13Host(containers);
    using var plain = testing.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://app.example") });
    using var testAnswer = await plain.GetAsync("/api/v1/health/live", Ct);
    Assert.False(testAnswer.Headers.Contains("Strict-Transport-Security"));
  }

  [Fact]
  public async Task S06ForwardedHeadersAreTrustedOnlyFromConfiguredNetworks()
  {
    using var host = new P13Host(containers, "Production", settings: new Dictionary<string, string?> { ["ReverseProxy:TrustedNetworks:0"] = "10.0.0.0/8" });
    async Task<HttpContext> From(string address) => await host.Server.SendAsync(context =>
    {
      context.Request.Method = "GET";
      context.Request.Scheme = "http";
      context.Request.Host = new HostString("app.example");
      context.Request.Path = "/api/v1/health/live";
      context.Connection.RemoteIpAddress = IPAddress.Parse(address);
      context.Request.Headers["X-Forwarded-For"] = "203.0.113.9";
      context.Request.Headers["X-Forwarded-Proto"] = "https";
    }, Ct);

    // HSTS is sent only on HTTPS, so it shows whether the forwarded scheme was applied.
    var inside = await From("10.1.2.3");
    Assert.Equal(200, inside.Response.StatusCode);
    Assert.True(inside.Response.Headers.ContainsKey("Strict-Transport-Security"), "A trusted network's X-Forwarded-Proto was ignored");
    Assert.Equal("203.0.113.9", inside.Connection.RemoteIpAddress?.ToString());
    var outside = await From("192.0.2.1");
    Assert.False(outside.Response.Headers.ContainsKey("Strict-Transport-Security"), "An untrusted address set the scheme");
    Assert.Equal("192.0.2.1", outside.Connection.RemoteIpAddress?.ToString());
  }

  [Fact]
  public async Task S08AColdHostAnswersConcurrentFirstRequestsWithoutACsrfFailure()
  {
    var keys = Directory.CreateTempSubdirectory("p13-cold-keys-").FullName;
    using var host = new P13Host(containers, settings: new Dictionary<string, string?> { ["Accounts:DataProtection:KeyDirectory"] = keys });
    var jars = Enumerable.Range(0, 20).Select(_ => host.CreateClient()).ToArray();
    var sessions = await Task.WhenAll(jars.Select(async jar =>
    {
      using var response = await jar.GetAsync("/api/v1/session", Ct);
      Assert.Equal(HttpStatusCode.OK, response.StatusCode);
      return P07User.CsrfOf(response);
    }));

    async Task<(HttpStatusCode Status, string? Code)> Login(HttpClient jar, string? csrf)
    {
      using var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/login") { Content = JsonContent.Create(new { email = $"cold-{Guid.NewGuid():N}@example.invalid", password = "cold-password-1" }) };
      if (csrf is not null) request.Headers.Add("X-XSRF-TOKEN", csrf);
      using var response = await jar.SendAsync(request, Ct);
      var code = response.Content.Headers.ContentType?.MediaType == "application/problem+json" ? (await response.Json())["code"]?.ToString() : null;
      return (response.StatusCode, code);
    }

    var answers = await Task.WhenAll(jars.Select((jar, index) => Login(jar, sessions[index])));
    Assert.All(answers, answer => Assert.NotEqual("csrf_token_invalid", answer.Code));
    Assert.Equal((HttpStatusCode.Forbidden, "csrf_token_invalid"), await Login(jars[0], null));
    Assert.Equal((HttpStatusCode.Forbidden, "csrf_token_invalid"), await Login(jars[0], sessions[1]));
    foreach (var jar in jars) jar.Dispose();
  }
}

/// <summary>A real database outage (AC-P13-15, DD-P13-25).</summary>
[Collection("P13Faults")]
public sealed class P13FaultTests(P13FaultContainers faults)
{
  private static CancellationToken Ct => TestContext.Current.CancellationToken;

  private static async Task<HttpResponseMessage> Send(HttpClient client, string csrf, HttpMethod method, string path, HttpContent? content, string? ifMatch, string key)
  {
    using var request = new HttpRequestMessage(method, path) { Content = content };
    request.Headers.Add("X-XSRF-TOKEN", csrf);
    if (ifMatch is not null) request.Headers.TryAddWithoutValidation("If-Match", ifMatch);
    request.Headers.TryAddWithoutValidation("Idempotency-Key", key);
    return await client.SendAsync(request, Ct);
  }

  [Fact]
  public async Task S07WhileTheDatabaseIsDownNothingIsAcknowledgedAndTheSameWriteAppliesOnceAfter()
  {
    using var host = new P13Host(faults.MongoConnection, faults.BlobConnection);
    var email = $"p13-{Guid.NewGuid():N}@example.invalid";
    await host.Services.GetRequiredService<IAccountUseCases>().SignUpAsync(email, P07Host.Password, Ct);
    using var client = host.CreateClient();
    using var session = await client.GetAsync("/api/v1/session", Ct);
    using var login = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/login") { Content = JsonContent.Create(new { email, password = P07Host.Password }) };
    login.Headers.Add("X-XSRF-TOKEN", P07User.CsrfOf(session));
    using var loggedIn = await client.SendAsync(login, Ct);
    Assert.Equal(HttpStatusCode.OK, loggedIn.StatusCode);
    var csrf = P07User.CsrfOf(loggedIn);
    using var created = await Send(client, csrf, HttpMethod.Post, "/api/v1/resumes",
      P07User.Json(new JsonObject { ["source"] = "document", ["document"] = P07Docs.Blank(), ["copyPhotoFromResumeId"] = null }), null, P07User.NewKey());
    Assert.Equal(HttpStatusCode.Created, created.StatusCode);
    var resume = (await created.Json())["id"]!.ToString();
    var etag = created.Headers.ETag!.ToString();
    var key = P07User.NewKey();
    var document = P07Docs.Blank("written during an outage").ToJsonString();

    // The platform's probe carries no cookie, so it does not depend on the session store.
    using var probe = host.CreateClient();
    await faults.Mongo.PauseAsync(Ct);
    try
    {
      using var ready = await probe.GetAsync("/api/v1/health/ready", Ct);
      Assert.Equal(HttpStatusCode.ServiceUnavailable, ready.StatusCode);
      using var during = await Send(client, csrf, HttpMethod.Put, $"/api/v1/resumes/{resume}/document", P07User.Json(document), etag, key);
      Assert.True((int)during.StatusCode >= 500, $"A write was answered {(int)during.StatusCode} while the database was down");
    }
    finally { await faults.Mongo.UnpauseAsync(Ct); }

    var deadline = DateTime.UtcNow.AddSeconds(60);
    while (true)
    {
      using var ready = await probe.GetAsync("/api/v1/health/ready", Ct);
      if (ready.StatusCode == HttpStatusCode.OK) break;
      Assert.True(DateTime.UtcNow < deadline, "The database did not come back");
      await Task.Delay(500, Ct);
    }
    using var after = await Send(client, csrf, HttpMethod.Put, $"/api/v1/resumes/{resume}/document", P07User.Json(document), etag, key);
    Assert.Equal(HttpStatusCode.OK, after.StatusCode);
    Assert.Equal(2, (await after.Json())["version"]!.GetValue<long>());
    using var replay = await Send(client, csrf, HttpMethod.Put, $"/api/v1/resumes/{resume}/document", P07User.Json(document), etag, key);
    Assert.Equal(HttpStatusCode.OK, replay.StatusCode);
    Assert.Equal(after.Headers.ETag, replay.Headers.ETag);
  }
}
