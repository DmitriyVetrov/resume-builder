using System.Text.Json.Nodes;
using MongoDB.Bson;
using MongoDB.Driver;
using Xunit;

namespace ResumeBuilder.Api.Tests;

/// <summary>Snapshots over HTTP (AC-P07-12). Restore is a normal document replace.</summary>
[Collection("P07")]
public sealed class P07SnapshotTests(P07Containers containers)
{
  private static CancellationToken Ct => TestContext.Current.CancellationToken;

  private static async Task<JsonArray> Items(P07User user, P07Created resume) =>
    (await user.Get($"{resume.Path}/snapshots")).Json["items"]!.AsArray();

  [Fact]
  public async Task S01AutomaticSnapshotsAreTakenAtTheFirstWriteThenEveryTenMinutes()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var resume = await user.Created();
    Assert.Empty(await Items(user, resume));

    var first = await user.Put(resume.Id, P07Docs.Blank("first"), resume.ETag);
    var items = await Items(user, resume);
    var auto = Assert.Single(items);
    Assert.Equal("auto", auto!["reason"]!.ToString());
    Assert.Equal(2, auto["resumeVersion"]!.GetValue<long>());
    var stored = await user.Get($"{resume.Path}/snapshots/{auto["id"]}");
    Assert.Equal("first", stored.Json["document"]!["title"]!.ToString());

    host.Time.Advance(TimeSpan.FromMinutes(5));
    var second = await user.Put(resume.Id, P07Docs.Blank("second"), first.ETag);
    Assert.Single(await Items(user, resume));

    host.Time.Advance(TimeSpan.FromMinutes(5));
    var third = await user.Put(resume.Id, P07Docs.Blank("third"), second.ETag);
    Assert.Equal(200, third.Code);
    items = await Items(user, resume);
    Assert.Equal(2, items.Count);
    Assert.Equal(4, items[0]!["resumeVersion"]!.GetValue<long>());
  }

  [Fact]
  public async Task S02BeforeExportCreatesOncePerVersionAndKeepsTheVersion()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var resume = await user.Created();

    var created = await user.Snapshot(resume.Id);
    Assert.Equal(201, created.Code);
    created.AssertValid("SnapshotSummary");
    Assert.Equal("no-store", created.CacheControl);
    Assert.Equal("before_export", created.Json["reason"]!.ToString());
    Assert.Equal(1, created.Json["resumeVersion"]!.GetValue<long>());
    Assert.Equal($"{resume.Path}/snapshots/{created.Json["id"]}", created.Location);
    Assert.Equal(1, await user.CurrentVersion(resume.Id));

    var existing = await user.Snapshot(resume.Id);
    Assert.Equal(200, existing.Code);
    existing.AssertValid("SnapshotSummary");
    Assert.Equal(created.Json["id"]!.ToString(), existing.Json["id"]!.ToString());
    Assert.Null(existing.Location);
    Assert.Single(await Items(user, resume));

    // An automatic snapshot of the current version satisfies the request too.
    var saved = await user.Put(resume.Id, P07Docs.Blank("x"), resume.ETag);
    Assert.Equal(200, saved.Code);
    var ofAutomatic = await user.Snapshot(resume.Id);
    Assert.Equal(200, ofAutomatic.Code);
    Assert.Equal("auto", ofAutomatic.Json["reason"]!.ToString());
  }

  [Fact]
  public async Task S03ListIsOrderedAndPagedAndSnapshotsExpireAfterThirtyDays()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var resume = await user.Created(P07Docs.Full());
    var etag = resume.ETag;
    var ids = new List<string>();
    for (var i = 0; i < 3; i++)
    {
      var snapshot = await user.Snapshot(resume.Id);
      Assert.Equal(i == 0 ? 201 : 200, snapshot.Code);
      ids.Add(snapshot.Json["id"]!.ToString());
      Assert.Equal(host.Time.UtcNow.AddDays(30), DateTimeOffset.Parse(snapshot.Json["expiresAt"]!.ToString(), System.Globalization.CultureInfo.InvariantCulture));
      host.Time.Advance(TimeSpan.FromMinutes(11));
      var saved = await user.Put(resume.Id, P07Docs.Full(), etag);
      etag = saved.ETag!;
    }

    var page = await user.Get($"{resume.Path}/snapshots?limit=2");
    Assert.Equal(200, page.Code);
    page.AssertValid("SnapshotPage");
    Assert.Equal("no-store", page.CacheControl);
    Assert.Equal(2, page.Json["items"]!.AsArray().Count);
    Assert.All(page.Json["items"]!.AsArray(), item => Assert.False(item!.AsObject().ContainsKey("document")));
    var next = await user.Get($"{resume.Path}/snapshots?limit=2&cursor={page.Json["nextCursor"]}");
    var all = page.Json["items"]!.AsArray().Concat(next.Json["items"]!.AsArray()).Select(item => DateTimeOffset.Parse(item!["createdAt"]!.ToString(), System.Globalization.CultureInfo.InvariantCulture)).ToArray();
    Assert.Equal(all.OrderDescending(), all);
    Assert.True(all.Length >= 3);

    var full = await user.Get($"{resume.Path}/snapshots/{ids[0]}");
    Assert.Equal(200, full.Code);
    full.AssertValid("Snapshot");
    Assert.Equal("no-store", full.CacheControl);
    Assert.True(P07Docs.SameJson(P07Docs.Full().ToJsonString(), full.Json["document"]!.ToJsonString()));

    using var cursor = await containers.Collection("resume_snapshots").Indexes.ListAsync(Ct);
    var indexes = await cursor.ToListAsync(Ct);
    Assert.Contains(indexes, index => index["key"].AsBsonDocument.Names.SequenceEqual(["expiresAt"]) && index.Contains("expireAfterSeconds") && index["expireAfterSeconds"].ToInt32() == 0);
    Assert.Contains(indexes, index => index.GetValue("unique", false).ToBoolean() && index["key"].AsBsonDocument.Names.SequenceEqual(["resumeId", "resumeVersion"]));
  }

  [Fact]
  public async Task S04TrashedForeignAndBadCursorAreRejected()
  {
    using var host = new P07Host(containers);
    var alice = await host.SignIn();
    var bob = await host.SignIn();
    var resume = await alice.Created();
    var snapshot = await alice.Snapshot(resume.Id);

    (await bob.Snapshot(resume.Id)).AssertProblem(404, "not_found");
    (await bob.Get($"{resume.Path}/snapshots")).AssertProblem(404, "not_found");
    (await bob.Get(snapshot.Location!)).AssertProblem(404, "not_found");
    (await alice.Get($"{resume.Path}/snapshots/{Guid.NewGuid()}")).AssertProblem(404, "not_found");
    (await alice.Get($"{resume.Path}/snapshots?cursor=AAAA")).AssertIssue("query", "cursor", "format");
    (await alice.Get($"{resume.Path}/snapshots?limit=0")).AssertIssue("query", "limit", "minimum");
    (await alice.Send(HttpMethod.Post, $"{resume.Path}/snapshots", P07User.Json("{\"reason\":\"manual\"}"), key: P07User.NewKey())).AssertIssue("body", "/reason", "const");

    var trashed = await alice.Trash(resume.Id, resume.ETag);
    Assert.Equal(200, trashed.Code);
    (await alice.Snapshot(resume.Id)).AssertProblem(409, "resume_trashed");
    Assert.Equal(200, (await alice.Get($"{resume.Path}/snapshots")).Code);
  }
}
