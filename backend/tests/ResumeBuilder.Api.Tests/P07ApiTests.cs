using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using MongoDB.Bson;
using MongoDB.Driver;
using ResumeBuilder.Application.Resumes;
using ResumeBuilder.Domain.Resumes;
using ResumeBuilder.Infrastructure;
using Xunit;

namespace ResumeBuilder.Api.Tests;

/// <summary>Resume operations over HTTP on real Mongo and Azurite: library, trash, concurrency and idempotency.</summary>
[Collection("P07")]
public sealed class P07ApiTests(P07Containers containers)
{
  private static CancellationToken Ct => TestContext.Current.CancellationToken;

  private static ResumeDocument Typed(JsonNode document)
  {
    using var parsed = JsonDocument.Parse(document.ToJsonString());
    var read = ResumeDocumentReader.Read(parsed.RootElement);
    Assert.NotNull(read.Document);
    return read.Document;
  }

  private static byte[] Canonical(JsonNode node)
  {
    using var parsed = JsonDocument.Parse(node.ToJsonString());
    return CanonicalJson.Serialize(parsed.RootElement);
  }

  // ------------------------------------------------------------ library (AC-P07-03, 04, 05, 07)

  [Fact]
  public async Task A01ListReturnsSummariesNewestFirstWithIdTieBreakAndGaplessPaging()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var ids = new List<Guid>();
    for (var i = 0; i < 5; i++)
    {
      if (i is 1 or 3) host.Time.Advance(TimeSpan.FromSeconds(1)); // i = 1,2 and i = 3,4 share a timestamp.
      ids.Add((await user.Created(P07Docs.Full())).Id);
    }

    var first = await user.Get("/api/v1/resumes?limit=2");
    Assert.Equal(200, first.Code);
    first.AssertValid("ResumePage");
    Assert.Equal("no-store", first.CacheControl);
    var item = first.Json["items"]![0]!.AsObject();
    Assert.False(item.ContainsKey("document"), "A summary must not carry the document");
    Assert.False(item.ContainsKey("ownerId"));
    Assert.Equal("T1", item["templateId"]!.ToString());
    Assert.Equal("Backend engineer (sample)", item["title"]!.ToString());
    Assert.Equal(1, item["version"]!.GetValue<long>());

    var seen = first.Json["items"]!.AsArray().Select(x => Guid.Parse(x!["id"]!.ToString())).ToList();
    var cursor = first.Json["nextCursor"]!.ToString();
    Assert.Matches("^[A-Za-z0-9_-]+$", cursor);
    while (true)
    {
      var page = await user.Get($"/api/v1/resumes?limit=2&cursor={cursor}");
      Assert.Equal(200, page.Code);
      seen.AddRange(page.Json["items"]!.AsArray().Select(x => Guid.Parse(x!["id"]!.ToString())));
      if (page.Json["nextCursor"] is null) break;
      cursor = page.Json["nextCursor"]!.ToString();
    }
    // updatedAt descending; id ascending within one timestamp. UUID strings compare lexicographically.
    string[] expected = [ids[3].ToString(), ids[4].ToString(), ids[1].ToString(), ids[2].ToString(), ids[0].ToString()];
    Array.Sort(expected, 0, 2, StringComparer.Ordinal);
    Array.Sort(expected, 2, 2, StringComparer.Ordinal);
    Assert.Equal(expected, seen.Select(x => x.ToString()));

    Assert.Empty((await user.Get("/api/v1/resumes?state=trashed")).Json["items"]!.AsArray());
    Assert.Equal(5, (await user.Get("/api/v1/resumes")).Json["items"]!.AsArray().Count);
  }

  [Fact]
  public async Task A02BadListParametersAnswer400WithQueryLocation()
  {
    using var host = new P07Host(containers);
    var alice = await host.SignIn();
    var bob = await host.SignIn();
    for (var i = 0; i < 3; i++) await alice.Created();
    await bob.Created();
    await bob.Created();

    (await alice.Get("/api/v1/resumes?limit=0")).AssertIssue("query", "limit", "minimum");
    (await alice.Get("/api/v1/resumes?limit=201")).AssertIssue("query", "limit", "maximum");
    (await alice.Get("/api/v1/resumes?limit=two")).AssertIssue("query", "limit", "type");
    (await alice.Get("/api/v1/resumes?state=deleted")).AssertIssue("query", "state", "enum");
    (await alice.Get("/api/v1/resumes?cursor=not*valid")).AssertIssue("query", "cursor", "pattern");
    (await alice.Get("/api/v1/resumes?cursor=" + new string('a', 513))).AssertIssue("query", "cursor", "max_length");
    (await alice.Get("/api/v1/resumes?cursor=AAAA")).AssertIssue("query", "cursor", "format");

    var aliceCursor = (await alice.Get("/api/v1/resumes?limit=1")).Json["nextCursor"]!.ToString();
    (await bob.Get($"/api/v1/resumes?cursor={aliceCursor}")).AssertIssue("query", "cursor", "format");
    (await alice.Get($"/api/v1/resumes?state=trashed&cursor={aliceCursor}")).AssertIssue("query", "cursor", "format");
    Assert.Equal(200, (await alice.Get($"/api/v1/resumes?limit=1&cursor={aliceCursor}")).Code);
    Assert.Equal(200, (await alice.Get("/api/v1/resumes?limit=200")).Code);
  }

  [Fact]
  public async Task A03CreateFromDocumentStoresItAtVersionOne()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var response = await user.Create(P07Docs.Full());
    Assert.Equal(201, response.Code);
    response.AssertValid("Resume");
    Assert.Equal("\"1\"", response.ETag);
    Assert.Equal("no-store", response.CacheControl);
    var id = response.Json["id"]!.ToString();
    Assert.Equal($"/api/v1/resumes/{id}", response.Location);
    Assert.Equal(7, Guid.Parse(id).Version);
    Assert.Equal(1, response.Version);
    Assert.Null(response.Json["deletedAt"]);
    Assert.Null(response.Json["photo"]);
    Assert.True(P07Docs.SameJson(P07Docs.Full().ToJsonString(), response.Json["document"]!.ToJsonString()));
    Assert.Equal(host.Time.UtcNow, DateTimeOffset.Parse(response.Json["createdAt"]!.ToString(), System.Globalization.CultureInfo.InvariantCulture));
  }

  [Fact]
  public async Task A04CopyDuplicatesDocumentAndOrderWithNewIdentityAtVersionOne()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var source = await user.Created(P07Docs.Full());
    var bumped = await user.Put(source.Id, P07Docs.Full(), source.ETag);
    Assert.Equal(200, bumped.Code);

    var keepTitle = await user.Copy(source.Id, null);
    Assert.Equal(201, keepTitle.Code);
    keepTitle.AssertValid("Resume");
    Assert.NotEqual(source.Id.ToString(), keepTitle.Json["id"]!.ToString());
    Assert.Equal(1, keepTitle.Version);
    Assert.Equal("\"1\"", keepTitle.ETag);
    Assert.True(P07Docs.SameJson(P07Docs.Full().ToJsonString(), keepTitle.Json["document"]!.ToJsonString()));

    var renamed = await user.Copy(source.Id, "New name");
    Assert.Equal("New name", renamed.Json["document"]!["title"]!.ToString());
    var expected = P07Docs.Full();
    expected["title"] = "New name";
    Assert.True(P07Docs.SameJson(expected.ToJsonString(), renamed.Json["document"]!.ToJsonString()));
    Assert.Equal(2, await user.CurrentVersion(source.Id));
  }

  [Fact]
  public async Task A05CopyOfTrashedIs409AndForeignIs404ButATrashedPhotoSourceIsAllowed()
  {
    using var host = new P07Host(containers);
    var alice = await host.SignIn();
    var bob = await host.SignIn();
    var trashed = await alice.WithPhoto();
    var trash = await alice.Trash(trashed.Id, trashed.ETag);
    Assert.Equal(200, trash.Code);
    (await alice.Copy(trashed.Id)).AssertProblem(409, "resume_trashed");
    (await bob.Copy(trashed.Id)).AssertProblem(404, "not_found");
    (await alice.Copy(Guid.NewGuid())).AssertProblem(404, "not_found");
    (await bob.Create(null, null, trashed.Id)).AssertProblem(404, "not_found");

    // DD-P07-18: a conflict copy must not lose its photo because another tab trashed the source.
    var conflictCopy = await alice.Create(null, null, trashed.Id);
    Assert.Equal(201, conflictCopy.Code);
    Assert.NotNull(conflictCopy.Json["photo"]);
    Assert.NotEqual(trashed.Json["photo"]!["id"]!.ToString(), conflictCopy.Json["photo"]!["id"]!.ToString());

    var noPhoto = await alice.Created();
    var withoutPhoto = await alice.Create(null, null, noPhoto.Id);
    Assert.Equal(201, withoutPhoto.Code);
    Assert.Null(withoutPhoto.Json["photo"]);
  }

  [Fact]
  public async Task A06RenameThroughThePutChangesOnlyTheTitle()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var resume = await user.Created(P07Docs.Full());
    host.Time.Advance(TimeSpan.FromSeconds(5));
    var renamed = P07Docs.Full();
    renamed["title"] = "Renamed";
    var saved = await user.Put(resume.Id, renamed, resume.ETag);
    Assert.Equal(200, saved.Code);
    saved.AssertValid("DocumentWriteResult");
    Assert.Equal("\"2\"", saved.ETag);
    Assert.Equal("no-store", saved.CacheControl);
    Assert.Empty(saved.Json["warnings"]!.AsArray());
    var read = await user.Get(resume.Path);
    Assert.True(P07Docs.SameJson(renamed.ToJsonString(), read.Json["document"]!.ToJsonString()));
    Assert.Equal(resume.Json["createdAt"]!.ToString(), read.Json["createdAt"]!.ToString());
    Assert.Equal(saved.Json["updatedAt"]!.ToString(), read.Json["updatedAt"]!.ToString());
  }

  [Fact]
  public async Task A07TrashRestoreAndPurgeMoveThroughTheirStates()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var older = await user.Created();
    var resume = await user.Created();

    host.Time.Advance(TimeSpan.FromMinutes(1));
    var firstTrash = await user.Trash(older.Id, older.ETag);
    Assert.Equal(200, firstTrash.Code);
    host.Time.Advance(TimeSpan.FromMinutes(1));
    var trashed = await user.Trash(resume.Id, resume.ETag);
    Assert.Equal(200, trashed.Code);
    trashed.AssertValid("ResumeState");
    Assert.Equal("\"2\"", trashed.ETag);
    Assert.Equal(2, trashed.Version);
    var deletedAt = DateTimeOffset.Parse(trashed.Json["deletedAt"]!.ToString(), System.Globalization.CultureInfo.InvariantCulture);
    Assert.Equal(host.Time.UtcNow, deletedAt);
    Assert.Equal(deletedAt.AddDays(30), DateTimeOffset.Parse(trashed.Json["purgeAt"]!.ToString(), System.Globalization.CultureInfo.InvariantCulture));

    Assert.Empty((await user.Get("/api/v1/resumes")).Json["items"]!.AsArray());
    var trash = await user.Get("/api/v1/resumes?state=trashed");
    Assert.Equal(new[] { resume.Id.ToString(), older.Id.ToString() }, trash.Json["items"]!.AsArray().Select(x => x!["id"]!.ToString()));
    Assert.NotNull(trash.Json["items"]![0]!["purgeAt"]);

    var restored = await user.Restore(resume.Id, trashed.ETag);
    Assert.Equal(200, restored.Code);
    restored.AssertValid("ResumeState");
    Assert.Equal("\"3\"", restored.ETag);
    Assert.Null(restored.Json["deletedAt"]);
    Assert.Null(restored.Json["purgeAt"]);
    Assert.Single((await user.Get("/api/v1/resumes")).Json["items"]!.AsArray());

    var purged = await user.Purge(older.Id, firstTrash.ETag);
    Assert.Equal(204, purged.Code);
    Assert.Empty(purged.Bytes);
    Assert.Single((await user.Get("/api/v1/resumes")).Json["items"]!.AsArray());
    Assert.Empty((await user.Get("/api/v1/resumes?state=trashed")).Json["items"]!.AsArray());
  }

  [Fact]
  public async Task A08WrongStateAnswers409AndPurgedAnswers404()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var resume = await user.WithPhoto();

    (await user.Restore(resume.Id, resume.ETag)).AssertProblem(409, "resume_not_trashed");
    (await user.Purge(resume.Id, resume.ETag)).AssertProblem(409, "resume_not_trashed");

    var trashed = await user.Trash(resume.Id, resume.ETag);
    var etag = trashed.ETag;
    (await user.Trash(resume.Id, etag)).AssertProblem(409, "resume_trashed");
    (await user.Put(resume.Id, P07Docs.Blank(), etag)).AssertProblem(409, "resume_trashed");
    (await user.Upload(resume.Id, P07Images.Png(10, 10), etag)).AssertProblem(409, "resume_trashed");
    (await user.Crop(resume.Id, 0, 0, 10, 10, etag)).AssertProblem(409, "resume_trashed");
    (await user.RemovePhoto(resume.Id, etag)).AssertProblem(409, "resume_trashed");
    (await user.Snapshot(resume.Id)).AssertProblem(409, "resume_trashed");
    Assert.Equal(200, (await user.Get(resume.Path)).Code);

    Assert.Equal(204, (await user.Purge(resume.Id, etag)).Code);
    (await user.Get(resume.Path)).AssertProblem(404, "not_found");
    (await user.Restore(resume.Id, etag)).AssertProblem(404, "not_found");
    (await user.Purge(resume.Id, etag)).AssertProblem(404, "not_found");
  }

  /// <summary>A09 and A10: a read carries the version and is never cached; a missing or malformed ID is the same 404 (DD-P07-07).</summary>
  [Fact]
  public async Task A09GetCarriesETagAndNoStoreAndAnyUnknownIdIs404()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var resume = await user.Created(P07Docs.Full());
    var read = await user.Get(resume.Path);
    Assert.Equal(200, read.Code);
    read.AssertValid("Resume");
    Assert.Equal("\"1\"", read.ETag);
    Assert.Equal("no-store", read.CacheControl);

    var upper = await user.Get($"/api/v1/resumes/{resume.Id.ToString().ToUpperInvariant()}");
    Assert.Equal(200, upper.Code);
    Assert.Equal(resume.Id.ToString(), upper.Json["id"]!.ToString());

    var trashed = await user.Trash(resume.Id, resume.ETag);
    var readTrashed = await user.Get(resume.Path);
    Assert.Equal(200, readTrashed.Code);
    Assert.Equal(trashed.ETag, readTrashed.ETag);
    Assert.NotNull(readTrashed.Json["deletedAt"]);

    (await user.Get($"/api/v1/resumes/{Guid.NewGuid()}")).AssertProblem(404, "not_found");
    (await user.Get("/api/v1/resumes/not-a-uuid")).AssertProblem(404, "not_found");
    (await user.Put(Guid.Empty, P07Docs.Blank(), "\"1\"")).AssertProblem(404, "not_found");
  }

  // ------------------------------------------------------------ concurrency (AC-P07-08)

  [Fact]
  public async Task C01EveryWriteKindIncrementsTheVersionByExactlyOne()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var resume = await user.Created();
    var etag = resume.ETag;
    async Task Step(Task<P07Response> write, long version)
    {
      var response = await write;
      Assert.Equal(200, response.Code);
      Assert.Equal($"\"{version}\"", response.ETag);
      Assert.Equal(version, response.Version);
      Assert.Equal(version, await user.CurrentVersion(resume.Id));
      etag = response.ETag!;
    }
    await Step(user.Put(resume.Id, P07Docs.Blank("two"), etag), 2);
    await Step(user.Upload(resume.Id, P07Images.Png(20, 20), etag), 3);
    await Step(user.Crop(resume.Id, 0, 0, 10, 10, etag), 4);
    await Step(user.RemovePhoto(resume.Id, etag), 5);
    await Step(user.Trash(resume.Id, etag), 6);
    await Step(user.Restore(resume.Id, etag), 7);
  }

  [Fact]
  public async Task C02ParallelWritersOnOneVersionHaveExactlyOneWinner()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var resume = await user.Created();
    var responses = await Task.WhenAll(Enumerable.Range(0, 8).Select(i => user.Put(resume.Id, P07Docs.Blank($"writer {i}"), resume.ETag)));
    var winner = Assert.Single(responses, response => response.Code == 200);
    Assert.All(responses.Where(response => response != winner), response =>
    {
      response.AssertProblem(412, "version_mismatch");
      Assert.Equal(2, response.Json["currentVersion"]!.GetValue<long>());
    });
    Assert.Equal(2, await user.CurrentVersion(resume.Id));
    var stored = await user.Get(resume.Path);
    Assert.Equal(winner.Json["updatedAt"]!.ToString(), stored.Json["updatedAt"]!.ToString());
  }

  [Fact]
  public void C03WritesUseMajorityAndJournalWriteConcern()
  {
    var concern = MongoResumeStore.DurableWriteConcern;
    Assert.Equal(WriteConcern.WMajority.W, concern.W);
    Assert.True(concern.Journal);
  }

  [Fact]
  public async Task C04IfMatchIsRequiredStrictAndStaleAnswersCarryNoContent()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    const string secret = "P07-STALE-MARKER";
    var resume = await user.Created(P07Docs.Blank(secret));

    (await user.Put(resume.Id, P07Docs.Blank("x"), null)).AssertProblem(428, "precondition_required");
    foreach (var bad in new[] { "*", "\"1\", \"2\"", "W/\"1\"", "1", "\"abc\"", "\"0\"" })
      (await user.Put(resume.Id, P07Docs.Blank("x"), bad)).AssertIssue("header", "If-Match", "pattern");
    Assert.Equal(1, await user.CurrentVersion(resume.Id));

    host.Time.Advance(TimeSpan.FromSeconds(3));
    var saved = await user.Put(resume.Id, P07Docs.Blank(secret), resume.ETag);
    var stale = await user.Put(resume.Id, P07Docs.Blank("x"), resume.ETag);
    stale.AssertProblem(412, "version_mismatch");
    Assert.Equal(2, stale.Json["currentVersion"]!.GetValue<long>());
    Assert.Equal(saved.Json["updatedAt"]!.ToString(), stale.Json["updatedAt"]!.ToString());
    Assert.DoesNotContain(secret, stale.Body, StringComparison.Ordinal);
    Assert.DoesNotContain("document", stale.Body, StringComparison.Ordinal);

    // Each versioned operation applies the same precondition.
    (await user.Trash(resume.Id, null)).AssertProblem(428, "precondition_required");
    (await user.Trash(resume.Id, resume.ETag)).AssertProblem(412, "version_mismatch");
  }

  // ------------------------------------------------------------ idempotency (AC-P07-09)

  [Fact]
  public async Task I01CreateReplayAnswersTheSameAndCreatesOneResume()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var key = P07User.NewKey();
    var first = await user.Create(P07Docs.Full(), key);
    Assert.Equal(201, first.Code);
    var replay = await user.Create(P07Docs.Full(), key);
    Assert.Equal(201, replay.Code);
    Assert.Equal(first.Location, replay.Location);
    Assert.Equal(first.ETag, replay.ETag);
    Assert.Equal(first.Json["id"]!.ToString(), replay.Json["id"]!.ToString());
    Assert.Single((await user.Get("/api/v1/resumes")).Json["items"]!.AsArray());

    // The body of a replay is the current representation; the ETag stays that of the original result.
    var id = Guid.Parse(first.Json["id"]!.ToString());
    Assert.Equal(200, (await user.Put(id, P07Docs.Blank("later"), first.ETag)).Code);
    var late = await user.Create(P07Docs.Full(), key);
    Assert.Equal(201, late.Code);
    Assert.Equal("\"1\"", late.ETag);
    Assert.Equal(2, late.Version);
    Assert.Equal("later", late.Json["document"]!["title"]!.ToString());
  }

  [Fact]
  public async Task I02DocumentReplayReturnsTheStoredVersionAndWarningsAndWritesNothing()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var resume = await user.Created(P07Docs.Full());
    var body = P07Docs.Full();
    var entry = body["sections"]![2]!["content"]!["entries"]![0]!;
    entry["start"] = new JsonObject { ["kind"] = "date", ["year"] = 2024, ["month"] = 5 };
    entry["end"] = new JsonObject { ["kind"] = "date", ["year"] = 2024, ["month"] = 4 };
    var key = P07User.NewKey();
    var first = await user.Put(resume.Id, body, resume.ETag, key);
    Assert.Equal(200, first.Code);
    Assert.Equal("/sections/2/content/entries/0/end", first.Json["warnings"]![0]!["pointer"]!.ToString());
    Assert.Equal("date_range_inverted", first.Json["warnings"]![0]!["code"]!.ToString());

    host.Time.Advance(TimeSpan.FromSeconds(10));
    // A retry repeats the original If-Match, which is now stale: no false 412.
    var replay = await user.Put(resume.Id, body, resume.ETag, key);
    Assert.Equal(200, replay.Code);
    Assert.Equal(first.ETag, replay.ETag);
    Assert.True(JsonNode.DeepEquals(first.Json, replay.Json), "A document replay answers exactly like the original");
    Assert.Equal(2, await user.CurrentVersion(resume.Id));

    // Key order does not change the hash.
    var reordered = new JsonObject();
    foreach (var property in body.AsObject().Reverse()) reordered[property.Key] = property.Value!.DeepClone();
    Assert.Equal(200, (await user.Put(resume.Id, reordered, resume.ETag, key)).Code);
    Assert.Equal(2, await user.CurrentVersion(resume.Id));

    // lastWrite survives a later photo write: the version moved on, the replay still answers the stored one.
    var uploaded = await user.Upload(resume.Id, P07Images.Png(10, 10), first.ETag);
    Assert.Equal("\"3\"", uploaded.ETag);
    var afterPhoto = await user.Put(resume.Id, body, resume.ETag, key);
    Assert.Equal(200, afterPhoto.Code);
    Assert.Equal("\"2\"", afterPhoto.ETag);
    Assert.Equal(2, afterPhoto.Version);
    Assert.Equal(3, await user.CurrentVersion(resume.Id));
  }

  [Fact]
  public async Task I03KeyedOperationsReplayTheirOriginalStatusAndETag()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var resume = await user.WithPhoto(P07Images.Png(30, 30));
    var etag = resume.ETag;

    var cropKey = P07User.NewKey();
    var crop = await user.Crop(resume.Id, 1, 1, 20, 20, etag, cropKey);
    Assert.Equal(200, crop.Code);
    var cropAgain = await user.Crop(resume.Id, 1, 1, 20, 20, etag, cropKey);
    Assert.Equal(200, cropAgain.Code);
    Assert.Equal(crop.ETag, cropAgain.ETag);
    Assert.Equal(3, await user.CurrentVersion(resume.Id));

    var snapshotKey = P07User.NewKey();
    var snapshot = await user.Snapshot(resume.Id, snapshotKey);
    Assert.Equal(201, snapshot.Code);
    var snapshotAgain = await user.Snapshot(resume.Id, snapshotKey);
    Assert.Equal(201, snapshotAgain.Code);
    Assert.Equal(snapshot.Location, snapshotAgain.Location);
    Assert.Equal(snapshot.Json["id"]!.ToString(), snapshotAgain.Json["id"]!.ToString());

    var removeKey = P07User.NewKey();
    var removed = await user.RemovePhoto(resume.Id, crop.ETag, removeKey);
    Assert.Equal(200, removed.Code);
    var removedAgain = await user.RemovePhoto(resume.Id, crop.ETag, removeKey);
    Assert.Equal(200, removedAgain.Code);
    Assert.Equal(removed.ETag, removedAgain.ETag);

    var trashKey = P07User.NewKey();
    var trashed = await user.Trash(resume.Id, removed.ETag, trashKey);
    Assert.Equal(200, trashed.Code);
    var trashedAgain = await user.Trash(resume.Id, removed.ETag, trashKey);
    Assert.Equal(200, trashedAgain.Code);
    Assert.Equal(trashed.ETag, trashedAgain.ETag);

    var restoreKey = P07User.NewKey();
    var restored = await user.Restore(resume.Id, trashed.ETag, restoreKey);
    Assert.Equal(200, restored.Code);
    var restoredAgain = await user.Restore(resume.Id, trashed.ETag, restoreKey);
    Assert.Equal(200, restoredAgain.Code);
    Assert.Equal(restored.ETag, restoredAgain.ETag);

    var again = await user.Trash(resume.Id, restored.ETag);
    var purgeKey = P07User.NewKey();
    Assert.Equal(204, (await user.Purge(resume.Id, again.ETag, purgeKey)).Code);
    Assert.Equal(204, (await user.Purge(resume.Id, again.ETag, purgeKey)).Code);
  }

  [Fact]
  public async Task I06ParallelTwinDocumentWritesBothSucceedWithOneVersionStep()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var resume = await user.Created();
    var key = P07User.NewKey();
    var body = P07Docs.Blank("twin");
    var twins = await Task.WhenAll(Enumerable.Range(0, 4).Select(_ => user.Put(resume.Id, body, resume.ETag, key)));
    Assert.All(twins, twin =>
    {
      Assert.Equal(200, twin.Code);
      Assert.Equal("\"2\"", twin.ETag);
    });
    Assert.Equal(2, await user.CurrentVersion(resume.Id));
  }

  /// <summary>A crash between reserving the key and the effect: the lease expires and the retry uses the reserved ID, so nothing duplicates.</summary>
  [Fact]
  public async Task I07CrashBeforeTheEffectIsTakenOverAfterTheLeaseWithTheReservedId()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var key = Guid.NewGuid();
    var request = new JsonObject { ["source"] = "document", ["document"] = P07Docs.Blank(), ["copyPhotoFromResumeId"] = null };
    var hash = RequestHash.Compute("POST", "/api/v1/resumes", Canonical(request));
    var reserved = Guid.CreateVersion7();
    var begun = await containers.Store.BeginAsync(user.Id, key, hash, reserved, host.Time.UtcNow, Ct);
    Assert.Equal(IdempotencyBeginKind.Started, begun.Kind);

    host.Time.Advance(TimeSpan.FromSeconds(61));
    var retry = await user.Send(HttpMethod.Post, "/api/v1/resumes", P07User.Json(request), key: key.ToString());
    Assert.Equal(201, retry.Code);
    Assert.Equal(reserved.ToString(), retry.Json["id"]!.ToString());
    Assert.Single((await user.Get("/api/v1/resumes")).Json["items"]!.AsArray());
  }

  /// <summary>A crash after the effect, before the record completes: the retry replays instead of duplicating or answering 412.</summary>
  [Fact]
  public async Task I07CrashAfterTheEffectReplaysWithoutApplyingItTwice()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();

    var createKey = Guid.NewGuid();
    var request = new JsonObject { ["source"] = "document", ["document"] = P07Docs.Blank(), ["copyPhotoFromResumeId"] = null };
    var reserved = Guid.CreateVersion7();
    await containers.Store.BeginAsync(user.Id, createKey, RequestHash.Compute("POST", "/api/v1/resumes", Canonical(request)), reserved, host.Time.UtcNow, Ct);
    Assert.Equal(ResumeInsertOutcome.Created, await containers.Store.InsertWithinLimitAsync(ResumeAggregate.Create(reserved, user.Id, Typed(P07Docs.Blank()), null, host.Time.UtcNow), ResumeLimits.ResumesPerUser, Ct));
    host.Time.Advance(TimeSpan.FromSeconds(61));
    var replayed = await user.Send(HttpMethod.Post, "/api/v1/resumes", P07User.Json(request), key: createKey.ToString());
    Assert.Equal(201, replayed.Code);
    Assert.Equal(reserved.ToString(), replayed.Json["id"]!.ToString());
    Assert.Single((await user.Get("/api/v1/resumes")).Json["items"]!.AsArray());

    // A versioned effect is applied and its record reopened, as if the process died before completing it.
    var resume = await user.Created();
    var trashKey = P07User.NewKey();
    var trashed = await user.Trash(resume.Id, resume.ETag, trashKey);
    Assert.Equal(200, trashed.Code);
    await containers.Collection("idempotency_keys").UpdateOneAsync(
      P07Mongo.Eq("ownerId", user.Id.ToString()) & P07Mongo.Eq("key", trashKey),
      Builders<BsonDocument>.Update.Set("state", "in_progress").Set("leaseUntil", host.Time.UtcNow.UtcDateTime), cancellationToken: Ct);
    host.Time.Advance(TimeSpan.FromSeconds(61));
    var retry = await user.Trash(resume.Id, resume.ETag, trashKey);
    Assert.Equal(200, retry.Code);
    Assert.Equal(trashed.ETag, retry.ETag);
    Assert.Equal(2, await user.CurrentVersion(resume.Id));
  }

  [Fact]
  public async Task I08MissingAndMalformedKeysAreRejected()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var resume = await user.Created();
    (await user.Send(HttpMethod.Post, "/api/v1/resumes", P07User.Json(new JsonObject { ["source"] = "document", ["document"] = P07Docs.Blank(), ["copyPhotoFromResumeId"] = null })))
      .AssertProblem(400, "idempotency_key_required");
    (await user.Send(HttpMethod.Put, resume.Path + "/document", P07User.Json(P07Docs.Blank()), resume.ETag)).AssertProblem(400, "idempotency_key_required");
    (await user.Send(HttpMethod.Delete, resume.Path, null, resume.ETag)).AssertProblem(400, "idempotency_key_required");
    (await user.Put(resume.Id, P07Docs.Blank(), resume.ETag, "not-a-uuid")).AssertIssue("header", "Idempotency-Key", "format");
    (await user.Trash(resume.Id, resume.ETag, "not-a-uuid")).AssertIssue("header", "Idempotency-Key", "format");
    Assert.Equal(1, await user.CurrentVersion(resume.Id));
  }

  [Fact]
  public async Task I09SameKeyWithADifferentBodyIs422AndNothingChanges()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var resume = await user.Created();

    var documentKey = P07User.NewKey();
    var saved = await user.Put(resume.Id, P07Docs.Blank("first body"), resume.ETag, documentKey);
    Assert.Equal(200, saved.Code);
    (await user.Put(resume.Id, P07Docs.Blank("second body"), saved.ETag, documentKey)).AssertProblem(422, "idempotency_key_reused");
    var stored = await user.Get(resume.Path);
    Assert.Equal("first body", stored.Json["document"]!["title"]!.ToString());
    Assert.Equal(saved.ETag, stored.ETag);

    var createKey = P07User.NewKey();
    Assert.Equal(201, (await user.Create(P07Docs.Blank("a"), createKey)).Code);
    (await user.Create(P07Docs.Blank("b"), createKey)).AssertProblem(422, "idempotency_key_reused");
    Assert.Equal(2, (await user.Get("/api/v1/resumes")).Json["items"]!.AsArray().Count);

    var photoKey = P07User.NewKey();
    var uploaded = await user.Upload(resume.Id, P07Images.Png(10, 10), saved.ETag, photoKey);
    Assert.Equal(200, uploaded.Code);
    (await user.Upload(resume.Id, P07Images.Png(11, 11), uploaded.ETag, photoKey)).AssertProblem(422, "idempotency_key_reused");
    Assert.Equal(10, (await user.Get(resume.Path)).Json["photo"]!["width"]!.GetValue<int>());

    // DD-P07-09: a failed attempt keeps its hash. The same request is evaluated again; a different one stays 422.
    var failingKey = P07User.NewKey();
    var other = await user.Created();
    (await user.Put(other.Id, P07Docs.Blank("x"), null, failingKey)).AssertProblem(428, "precondition_required");
    Assert.Equal(200, (await user.Put(other.Id, P07Docs.Blank("x"), other.ETag, failingKey)).Code);
    var failedTrashKey = P07User.NewKey();
    (await user.Trash(other.Id, null, failedTrashKey)).AssertProblem(428, "precondition_required");
    (await user.Restore(other.Id, "\"2\"", failedTrashKey)).AssertProblem(422, "idempotency_key_reused");
    Assert.Equal(200, (await user.Trash(other.Id, "\"2\"", failedTrashKey)).Code);
  }

  [Fact]
  public async Task I10InFlightDuplicateOfAKeyedCreateIs409WithRetryAfter()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var key = Guid.NewGuid();
    var request = new JsonObject { ["source"] = "document", ["document"] = P07Docs.Blank(), ["copyPhotoFromResumeId"] = null };
    await containers.Store.BeginAsync(user.Id, key, RequestHash.Compute("POST", "/api/v1/resumes", Canonical(request)), Guid.CreateVersion7(), host.Time.UtcNow, Ct);

    var duplicate = await user.Send(HttpMethod.Post, "/api/v1/resumes", P07User.Json(request), key: key.ToString());
    duplicate.AssertProblem(409, "idempotency_request_in_progress");
    Assert.NotNull(duplicate.Headers.RetryAfter?.Delta);
    Assert.InRange(duplicate.Headers.RetryAfter.Delta.Value.TotalSeconds, 1, 60);
    Assert.Empty((await user.Get("/api/v1/resumes")).Json["items"]!.AsArray());
  }

  [Fact]
  public async Task I11KeysAreOwnerScoped()
  {
    using var host = new P07Host(containers);
    var alice = await host.SignIn();
    var bob = await host.SignIn();
    var key = P07User.NewKey();
    var mine = await alice.Create(P07Docs.Blank("alice"), key);
    var theirs = await bob.Create(P07Docs.Blank("bob"), key);
    Assert.Equal(201, mine.Code);
    Assert.Equal(201, theirs.Code);
    Assert.NotEqual(mine.Json["id"]!.ToString(), theirs.Json["id"]!.ToString());
    Assert.Equal("bob", theirs.Json["document"]!["title"]!.ToString());
  }

  // ------------------------------------------------------------ limits and shapes (AC-P07-01, 02, 20)

  [Fact]
  public async Task L04TheTwoHundredResumeLimitCountsActiveAndTrashed()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var document = Typed(P07Docs.Blank());
    for (var i = 0; i < 199; i++)
      Assert.Equal(ResumeInsertOutcome.Created, await containers.Store.InsertWithinLimitAsync(ResumeAggregate.Create(Guid.CreateVersion7(), user.Id, document, null, host.Time.UtcNow), ResumeLimits.ResumesPerUser, Ct));

    var last = await user.Created();
    var trashed = await user.Trash(last.Id, last.ETag);
    Assert.Equal(200, trashed.Code);
    (await user.Create()).AssertProblem(409, "limit_reached");
    (await user.Create(P07Docs.Blank("over"), P07User.NewKey())).AssertProblem(409, "limit_reached");

    Assert.Equal(204, (await user.Purge(last.Id, trashed.ETag)).Code);
    Assert.Equal(201, (await user.Create()).Code);
    (await user.Create()).AssertProblem(409, "limit_reached");
  }

  [Fact]
  public async Task L04ParallelCreatesAtTheBoundEndAtExactlyTwoHundred()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var document = Typed(P07Docs.Blank());
    for (var i = 0; i < 198; i++)
      await containers.Store.InsertWithinLimitAsync(ResumeAggregate.Create(Guid.CreateVersion7(), user.Id, document, null, host.Time.UtcNow), ResumeLimits.ResumesPerUser, Ct);

    var responses = await Task.WhenAll(Enumerable.Range(0, 6).Select(_ => user.Create()));
    Assert.Equal(2, responses.Count(response => response.Code == 201));
    Assert.All(responses.Where(response => response.Code != 201), response => response.AssertProblem(409, "limit_reached"));
    Assert.Equal(200, await containers.Store.CountAsync(user.Id, Ct));
  }

  /// <summary>L05 at the boundary, and the syntax stage before the key stage: size, media type and JSON syntax win over a missing key.</summary>
  [Fact]
  public async Task L05SizeMediaTypeAndSyntaxAreCheckedBeforeTheKey()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var resume = await user.Created();
    var path = resume.Path + "/document";

    var oversized = P07Docs.Blank();
    oversized["header"]!["headline"] = new string('x', ResumeLimits.MaxJsonBodyBytes + 1);
    (await user.Send(HttpMethod.Put, path, P07User.Json(oversized), resume.ETag)).AssertProblem(413, "payload_too_large");

    using var text = new StringContent(P07Docs.Blank().ToJsonString(), Encoding.UTF8, "text/plain");
    (await user.Send(HttpMethod.Put, path, text, resume.ETag, P07User.NewKey())).AssertProblem(415, "unsupported_media_type");

    (await user.Send(HttpMethod.Put, path, P07User.Json("{"), resume.ETag)).AssertProblem(400, "malformed_request");
    var deep = string.Concat(Enumerable.Repeat("[", 65)) + string.Concat(Enumerable.Repeat("]", 65));
    (await user.Send(HttpMethod.Put, path, P07User.Json(deep), resume.ETag, P07User.NewKey())).AssertProblem(400, "malformed_request");
    (await user.Send(HttpMethod.Put, path, P07User.Json("{\"title\":\"a\",\"title\":\"b\"}"), resume.ETag, P07User.NewKey())).AssertProblem(400, "malformed_request");
    (await user.Send(HttpMethod.Put, path, P07User.Json("{\"title\":\"\\ud83d\"}"), resume.ETag, P07User.NewKey())).AssertProblem(400, "malformed_request");
    (await user.Send(HttpMethod.Put, path, P07User.Json(new JsonObject { ["title"] = 1 }), resume.ETag)).AssertIssue("body", "/title", "type");

    using var byteEnvelope = new ByteArrayContent(Enumerable.Repeat((byte)'x', ResumeLimits.MaxJsonBodyBytes + 1).ToArray());
    byteEnvelope.Headers.ContentType = new MediaTypeHeaderValue("application/json");
    (await user.Send(HttpMethod.Post, "/api/v1/resumes", byteEnvelope, key: P07User.NewKey())).AssertProblem(413, "payload_too_large");
    Assert.Equal(1, await user.CurrentVersion(resume.Id));
  }

  [Fact]
  public async Task D02AnySectionMixPersistsUnchangedAndInOrder()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();

    // All fields empty, no sections at all.
    var empty = P07Docs.Blank("");
    var blank = await user.Created(empty);
    Assert.True(P07Docs.SameJson(empty.ToJsonString(), (await user.Get(blank.Path)).Json["document"]!.ToJsonString()));

    // Several of one type, shuffled order, hidden, listColumns and placement set, and a half-point margin.
    var hidden = P07Docs.ListSection(P07Docs.Item("b"));
    hidden["hidden"] = true;
    hidden["listColumns"] = 2;
    hidden["placement"] = "sidebar";
    var mixed = P07Docs.WithSections(P07Docs.InlineSection(), hidden, P07Docs.TextSection("t1"), P07Docs.EntriesSection(P07Docs.Entry("e")), P07Docs.TextSection("t2"), P07Docs.EntriesSection(), P07Docs.ListSection());
    mixed["layout"]!["margins"]!["top"] = 10.5;
    var saved = await user.Put(blank.Id, mixed, blank.ETag);
    Assert.Equal(200, saved.Code);
    var read = await user.Get(blank.Path);
    read.AssertValid("Resume");
    Assert.True(P07Docs.SameJson(mixed.ToJsonString(), read.Json["document"]!.ToJsonString()));
  }

  [Fact]
  public async Task D03InvertedDatesSaveWithAWarningAtTheRightPointer()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var resume = await user.Created();
    var entry = P07Docs.Entry();
    entry["start"] = new JsonObject { ["kind"] = "date", ["year"] = 2024, ["month"] = 5 };
    entry["end"] = new JsonObject { ["kind"] = "date", ["year"] = 2020, ["month"] = null };
    var saved = await user.Put(resume.Id, P07Docs.WithSections(P07Docs.TextSection("x"), P07Docs.EntriesSection(P07Docs.Entry(), entry)), resume.ETag);
    Assert.Equal(200, saved.Code);
    saved.AssertValid("DocumentWriteResult");
    var warning = Assert.Single(saved.Json["warnings"]!.AsArray());
    Assert.Equal("/sections/1/content/entries/1/end", warning!["pointer"]!.ToString());
    Assert.Equal("date_range_inverted", warning["code"]!.ToString());

    // The rule runs at the domain stage, after If-Match (DD-P07-08).
    var duplicate = P07Docs.WithSections(P07Docs.TextSection("x"));
    duplicate["sections"]!.AsArray().Add(duplicate["sections"]![0]!.DeepClone());
    (await user.Put(resume.Id, duplicate, "\"1\"")).AssertProblem(412, "version_mismatch");
    (await user.Put(resume.Id, duplicate, saved.ETag)).AssertIssue("body", "/sections/1/id", "duplicate_id");
  }

  /// <summary>NFR-07 through create, read, snapshot and copy, with Spanish, Ukrainian, Slovak and emoji text.</summary>
  [Fact]
  public async Task U01UnicodeRoundTripsExactly()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    const string spanish = "Ramón Núñez — señor";
    const string ukrainian = "Олександр Їжак, ґанок";
    const string slovak = "Ľubomír Ďurčo ťažký";
    const string emoji = "\U0001F600\U0001F469\u200D\U0001F4BB";
    var document = P07Docs.WithSections(P07Docs.TextSection(ukrainian, slovak), P07Docs.ListSection(P07Docs.Item(emoji)));
    document["title"] = spanish;
    document["header"]!["fullName"] = ukrainian;
    document["header"]!["headline"] = slovak;
    document["language"] = "uk";

    var created = await user.Created(document);
    Assert.True(P07Docs.SameJson(document.ToJsonString(), created.Json["document"]!.ToJsonString()));
    Assert.Contains(spanish, (await user.Get(created.Path)).Body, StringComparison.Ordinal);
    Assert.Equal(spanish, (await user.Get("/api/v1/resumes")).Json["items"]![0]!["title"]!.ToString());

    var snapshot = await user.Snapshot(created.Id);
    Assert.Equal(201, snapshot.Code);
    var stored = await user.Get(snapshot.Location!);
    Assert.True(P07Docs.SameJson(document.ToJsonString(), stored.Json["document"]!.ToJsonString()));

    var copy = await user.Copy(created.Id);
    Assert.True(P07Docs.SameJson(document.ToJsonString(), copy.Json["document"]!.ToJsonString()));
  }

  /// <summary>The contract's evaluation order, one neighbour at a time, so that a reordering shows up here.</summary>
  [Fact]
  public async Task O01EvaluationOrderIsTheContractsOrder()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var resume = await user.Created();
    var trashed = await user.Created();
    var trash = await user.Trash(trashed.Id, trashed.ETag);

    // Key before existence, replay before existence checks later in the chain.
    (await user.Send(HttpMethod.Put, $"/api/v1/resumes/{Guid.NewGuid()}/document", P07User.Json(P07Docs.Blank()), "\"1\"")).AssertProblem(400, "idempotency_key_required");
    // Existence before trash state and If-Match.
    (await user.Put(Guid.NewGuid(), P07Docs.Blank(), null)).AssertProblem(404, "not_found");
    // Trash state before If-Match.
    (await user.Put(trashed.Id, P07Docs.Blank(), null)).AssertProblem(409, "resume_trashed");
    Assert.Equal(trash.ETag, (await user.Get(trashed.Path)).ETag);
    // If-Match before domain rules.
    var duplicate = P07Docs.WithSections(P07Docs.TextSection("x"));
    duplicate["sections"]!.AsArray().Add(duplicate["sections"]![0]!.DeepClone());
    (await user.Put(resume.Id, duplicate, null)).AssertProblem(428, "precondition_required");
    // Schema before key.
    (await user.Send(HttpMethod.Put, resume.Path + "/document", P07User.Json(new JsonObject { ["title"] = "x" }), null))
      .AssertIssue("body", "/language", "required");
  }
}
