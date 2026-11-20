using System.Text.Json.Nodes;
using Xunit;

namespace ResumeBuilder.Api.Tests;

/// <summary>Owner isolation, CSRF, log and problem privacy, rate limits (AC-P07-10, 15, 16).</summary>
[Collection("P07")]
public sealed class P07SecurityTests(P07Containers containers)
{
  private sealed record Operation(string Name, HttpMethod Method, string Path, Func<HttpContent?>? Body, bool Versioned, bool Keyed);

  private static readonly JsonObject CreateBody = new() { ["source"] = "document", ["document"] = P07Docs.Blank(), ["copyPhotoFromResumeId"] = null };

  /// <summary>All fifteen `x-phase: P07` operations. The resume, snapshot and bodies are filled in per test.</summary>
  private static Operation[] Operations(Guid resume, Guid snapshot) =>
  [
    new("listResumes", HttpMethod.Get, "/api/v1/resumes", null, false, false),
    new("createResume", HttpMethod.Post, "/api/v1/resumes", () => P07User.Json(CreateBody), false, true),
    new("getResume", HttpMethod.Get, $"/api/v1/resumes/{resume}", null, false, false),
    new("trashResume", HttpMethod.Delete, $"/api/v1/resumes/{resume}", null, true, true),
    new("replaceResumeDocument", HttpMethod.Put, $"/api/v1/resumes/{resume}/document", () => P07User.Json(P07Docs.Blank("intruder")), true, true),
    new("restoreResume", HttpMethod.Post, $"/api/v1/resumes/{resume}/restore", null, true, true),
    new("purgeResume", HttpMethod.Post, $"/api/v1/resumes/{resume}/purge", null, true, true),
    new("listSnapshots", HttpMethod.Get, $"/api/v1/resumes/{resume}/snapshots", null, false, false),
    new("createSnapshot", HttpMethod.Post, $"/api/v1/resumes/{resume}/snapshots", () => P07User.Json("{\"reason\":\"before_export\"}"), false, true),
    new("getSnapshot", HttpMethod.Get, $"/api/v1/resumes/{resume}/snapshots/{snapshot}", null, false, false),
    new("uploadPhoto", HttpMethod.Post, $"/api/v1/resumes/{resume}/photo", () => P07User.PhotoForm(P07Images.Png(10, 10)), true, true),
    new("removePhoto", HttpMethod.Delete, $"/api/v1/resumes/{resume}/photo", null, true, true),
    new("updatePhotoCrop", HttpMethod.Put, $"/api/v1/resumes/{resume}/photo/crop", () => P07User.Json("{\"x\":0,\"y\":0,\"width\":5,\"height\":5}"), true, true),
    new("getPhotoRendition", HttpMethod.Get, $"/api/v1/resumes/{resume}/photo/rendition", null, false, false),
    new("getPhotoMaster", HttpMethod.Get, $"/api/v1/resumes/{resume}/photo/master", null, false, false),
  ];

  [Fact]
  public async Task X01AllFifteenOperationsAnswer401ToAnonymousCallers()
  {
    using var host = new P07Host(containers);
    var anonymous = new P07User(host, host.CreateClient(), "", Guid.Empty, "");
    var operations = Operations(Guid.NewGuid(), Guid.NewGuid());
    Assert.Equal(15, operations.Length);
    foreach (var operation in operations)
    {
      using var body = operation.Body?.Invoke();
      var response = await anonymous.Send(operation.Method, operation.Path, body, operation.Versioned ? "\"1\"" : null, operation.Keyed ? P07User.NewKey() : null, withCsrf: false);
      Assert.True(response.Code == 401, $"{operation.Name} answered {response.Code}");
      response.AssertProblem(401, "unauthenticated");
    }
  }

  [Fact]
  public async Task X02AnotherUsersIdsAnswer404AndChangeNothing()
  {
    using var host = new P07Host(containers);
    var alice = await host.SignIn();
    var bob = await host.SignIn();
    var resume = await alice.WithPhoto(P07Images.Png(30, 30), P07Docs.Blank("alice's"));
    var snapshot = await alice.Snapshot(resume.Id);
    Assert.Equal(201, snapshot.Code);
    var snapshotId = Guid.Parse(snapshot.Json["id"]!.ToString());
    var before = await alice.Get(resume.Path);

    foreach (var operation in Operations(resume.Id, snapshotId).Where(operation => operation.Path.Contains(resume.Id.ToString(), StringComparison.Ordinal)))
    {
      using var body = operation.Body?.Invoke();
      var response = await bob.Send(operation.Method, operation.Path, body, operation.Versioned ? resume.ETag : null, operation.Keyed ? P07User.NewKey() : null);
      Assert.True(response.Code == 404, $"{operation.Name} answered {response.Code}");
      response.AssertProblem(404, "not_found");
    }

    (await bob.Copy(resume.Id)).AssertProblem(404, "not_found");
    Assert.Empty((await bob.Get("/api/v1/resumes")).Json["items"]!.AsArray());
    var after = await alice.Get(resume.Path);
    Assert.Equal(before.Body, after.Body);
    Assert.Equal(before.ETag, after.ETag);
    Assert.Equal(200, (await alice.Get(snapshot.Location!)).Code);
    Assert.Equal(2, (await containers.PhotoKeys(alice.Id)).Length);
  }

  [Fact]
  public async Task X03EveryUnsafeOperationNeedsTheCsrfToken()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var resume = await user.WithPhoto();
    var before = await user.Get(resume.Path);
    var unsafeOperations = Operations(resume.Id, Guid.NewGuid()).Where(operation => operation.Method != HttpMethod.Get).ToArray();
    Assert.Equal(9, unsafeOperations.Length);
    foreach (var operation in unsafeOperations)
    {
      using var body = operation.Body?.Invoke();
      var response = await user.Send(operation.Method, operation.Path, body, operation.Versioned ? resume.ETag : null, operation.Keyed ? P07User.NewKey() : null, withCsrf: false);
      Assert.True(response.Code == 403, $"{operation.Name} answered {response.Code}");
      response.AssertProblem(403, "csrf_token_invalid");
    }
    Assert.Equal(before.Body, (await user.Get(resume.Path)).Body);
    Assert.Single((await user.Get("/api/v1/resumes")).Json["items"]!.AsArray());
  }

  [Fact]
  public async Task X04NoRequestCanSetAServerOwnedField()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var resume = await user.Created();
    foreach (var field in new[] { "ownerId", "version", "id", "photo", "deletedAt" })
    {
      var document = P07Docs.Blank();
      document[field] = "x";
      (await user.Put(resume.Id, document, resume.ETag)).AssertIssue("body", "", "unknown_property");
      (await user.Create(document)).AssertIssue("body", "/document", "unknown_property");
    }
    var copy = new JsonObject { ["source"] = "copy", ["sourceResumeId"] = resume.Id.ToString(), ["title"] = null, ["ownerId"] = Guid.NewGuid().ToString() };
    (await user.Send(HttpMethod.Post, "/api/v1/resumes", P07User.Json(copy), key: P07User.NewKey())).AssertIssue("body", "", "unknown_property");
    Assert.Equal(1, await user.CurrentVersion(resume.Id));
  }

  [Fact]
  public async Task X05ASnapshotIsReachableOnlyUnderItsOwnResume()
  {
    using var host = new P07Host(containers);
    var alice = await host.SignIn();
    var bob = await host.SignIn();
    var aliceResume = await alice.Created();
    var aliceOther = await alice.Created();
    var snapshot = await alice.Snapshot(aliceResume.Id);
    var bobResume = await bob.Created();
    (await bob.Get($"{bobResume.Path}/snapshots/{snapshot.Json["id"]}")).AssertProblem(404, "not_found");
    (await alice.Get($"{aliceOther.Path}/snapshots/{snapshot.Json["id"]}")).AssertProblem(404, "not_found");
  }

  /// <summary>V01: a canary in every document field, a filename and a key name reaches no log line and no problem body.</summary>
  [Fact]
  public async Task V01ACanaryInEveryFieldReachesNoLogAndNoProblem()
  {
    const string canary = "P07CANARYVALUE";
    using var host = new P07Host(containers);
    var user = await host.SignIn();

    var entry = P07Docs.Entry(canary);
    entry["organization"] = canary;
    entry["location"] = canary;
    entry["dateText"] = canary;
    entry["description"] = new JsonArray(new JsonObject { ["kind"] = "paragraph", ["inlines"] = new JsonArray(P07Docs.Run(canary)) });
    var entries = P07Docs.EntriesSection(entry);
    entries["title"] = canary;
    entries["content"]!["labels"] = new JsonObject { ["title"] = canary, ["organization"] = canary, ["location"] = canary };
    var link = new JsonObject { ["kind"] = "link", ["url"] = "https://example.org/" + canary, ["children"] = new JsonArray(P07Docs.Run(canary)) };
    var text = P07Docs.Section("text", canary, new JsonObject { ["body"] = new JsonArray(new JsonObject { ["kind"] = "paragraph", ["inlines"] = new JsonArray(P07Docs.Run(canary), link) }) });
    var document = P07Docs.WithSections(text, entries, P07Docs.ListSection(P07Docs.Item(canary)), P07Docs.InlineSection(canary));
    document["title"] = canary;
    document["header"]!["fullName"] = canary;
    document["header"]!["headline"] = canary;
    var contact = P07Docs.Contact(canary);
    contact["url"] = "https://example.org/" + canary;
    document["header"]!["contacts"] = new JsonArray(contact);

    var problems = new List<P07Response>();
    var created = await user.Created(document);
    var saved = await user.Put(created.Id, document, created.ETag);
    Assert.Equal(200, saved.Code);
    Assert.Equal(200, (await user.Upload(created.Id, P07Images.Png(10, 10), saved.ETag, fileName: canary + ".png", declaredType: "image/png")).Code);

    // Failure paths: a key name, a value over its limit, a bad enum value, a bad URL, a stale write, a reused key.
    var keyName = P07Docs.Blank();
    keyName[canary] = canary;
    problems.Add(await user.Put(created.Id, keyName, "\"3\""));
    var overLimit = P07Docs.Blank(canary + new string('x', 200));
    problems.Add(await user.Put(created.Id, overLimit, "\"3\""));
    var badEnum = P07Docs.Blank();
    badEnum["templateId"] = canary;
    problems.Add(await user.Put(created.Id, badEnum, "\"3\""));
    var badUrl = P07Docs.Blank();
    var badContact = P07Docs.Contact();
    badContact["url"] = "javascript:" + canary;
    badUrl["header"]!["contacts"] = new JsonArray(badContact);
    problems.Add(await user.Put(created.Id, badUrl, "\"3\""));
    problems.Add(await user.Put(created.Id, document, "\"1\""));
    problems.Add(await user.Send(HttpMethod.Put, created.Path + "/document", P07User.Json("{\"" + canary + "\":"), "\"3\"", P07User.NewKey()));
    problems.Add(await user.Upload(created.Id, System.Text.Encoding.ASCII.GetBytes(canary), "\"3\"", fileName: canary + ".exe"));
    problems.Add(await user.Upload(created.Id, [0xFF, 0xD8, 0xFF, .. System.Text.Encoding.ASCII.GetBytes(canary)], "\"3\"", fileName: canary));
    Assert.All(problems, problem =>
    {
      Assert.InRange(problem.Code, 400, 499);
      Assert.DoesNotContain(canary, problem.Body, StringComparison.Ordinal);
    });

    Assert.NotEmpty(host.Logs.Entries);
    foreach (var entryLog in host.Logs.Entries)
    {
      Assert.DoesNotContain(canary, entryLog.Message, StringComparison.Ordinal);
      Assert.DoesNotContain(canary, entryLog.Exception, StringComparison.Ordinal);
      Assert.All(entryLog.Fields, field => Assert.DoesNotContain(canary, field.Value, StringComparison.Ordinal));
    }
  }

  [Fact]
  public async Task R01DocWriteAllows120PerMinutePerUserAndOpensAgain()
  {
    using var host = new P07Host(containers);
    var alice = await host.SignIn();
    var bob = await host.SignIn();
    var resume = await alice.Created();
    var etag = resume.ETag;
    for (var i = 0; i < 119; i++)
    {
      var saved = await alice.Put(resume.Id, P07Docs.Blank($"write {i}"), etag);
      Assert.Equal(200, saved.Code);
      etag = saved.ETag!;
    }

    var limited = await alice.Put(resume.Id, P07Docs.Blank("over"), etag);
    limited.AssertProblem(429, "rate_limited");
    Assert.NotNull(limited.Headers.RetryAfter?.Delta);
    Assert.InRange(limited.Headers.RetryAfter.Delta.Value.TotalSeconds, 1, 60);

    Assert.Equal(201, (await bob.Create()).Code);

    host.Time.Advance(TimeSpan.FromSeconds(61));
    Assert.Equal(200, (await alice.Put(resume.Id, P07Docs.Blank("next window"), etag)).Code);
  }

  [Fact]
  public async Task R02PhotoUploadAllows20PerHourPerUser()
  {
    using var host = new P07Host(containers);
    var alice = await host.SignIn();
    var bob = await host.SignIn();
    var resume = await alice.Created();
    var etag = resume.ETag;
    var image = P07Images.Png(5, 5);
    for (var i = 0; i < 20; i++)
    {
      var uploaded = await alice.Upload(resume.Id, image, etag);
      Assert.Equal(200, uploaded.Code);
      etag = uploaded.ETag!;
    }
    var limited = await alice.Upload(resume.Id, image, etag);
    limited.AssertProblem(429, "rate_limited");
    Assert.NotNull(limited.Headers.RetryAfter?.Delta);

    var other = await bob.Created();
    Assert.Equal(200, (await bob.Upload(other.Id, image, other.ETag)).Code);
    host.Time.Advance(TimeSpan.FromMinutes(61));
    Assert.Equal(200, (await alice.Upload(resume.Id, image, etag)).Code);
  }
}
