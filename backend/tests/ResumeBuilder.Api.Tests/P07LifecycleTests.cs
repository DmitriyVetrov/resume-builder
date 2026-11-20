using System.Text.Json.Nodes;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using MongoDB.Bson;
using MongoDB.Driver;
using ResumeBuilder.Application.Accounts;
using ResumeBuilder.Application.Resumes;
using ResumeBuilder.Infrastructure;
using Xunit;

namespace ResumeBuilder.Api.Tests;

/// <summary>Deletion ordering, the dual ledger, account purge and export (AC-P07-13, DD-P07-10).</summary>
[Collection("P07")]
public sealed class P07LifecycleTests(P07Containers containers)
{
  private static CancellationToken Ct => TestContext.Current.CancellationToken;

  /// <summary>Observes the live stores at the moment a ledger entry is written, then writes it for real.</summary>
  private sealed class ObservingLedger(P07Containers containers) : IResumeDeletionLedger, IDisposable
  {
    private readonly DualAccountDeletionLedger inner = new(containers.MongoConnection, containers.BlobConnection);
    public void Dispose() => inner.Dispose();
    public bool Fail { get; set; }
    public List<(string Kind, Guid Id, Guid Owner, int BlobsSeen, long DocumentsSeen)> Calls { get; } = [];

    private async Task Observe(string kind, Guid id, Guid owner)
    {
      if (Fail) throw new IOException("synthetic ledger failure");
      var blobs = (await containers.PhotoKeys(owner)).Length;
      var documents = await containers.Collection("resumes").CountDocumentsAsync(P07Mongo.Eq("ownerId", owner.ToString()), cancellationToken: Ct);
      lock (Calls) Calls.Add((kind, id, owner, blobs, documents));
    }

    public async Task RecordResumeAsync(Guid resumeId, Guid ownerId, DateTimeOffset recordedAt, CancellationToken cancellationToken)
    {
      await Observe("resume", resumeId, ownerId);
      await inner.RecordResumeAsync(resumeId, ownerId, recordedAt, cancellationToken);
    }

    public async Task RecordPhotoAsync(Guid photoId, Guid ownerId, DateTimeOffset recordedAt, CancellationToken cancellationToken)
    {
      await Observe("photo", photoId, ownerId);
      await inner.RecordPhotoAsync(photoId, ownerId, recordedAt, cancellationToken);
    }
  }

  private sealed class FlakyPhotoStorage(IPhotoStorage inner) : IPhotoStorage
  {
    public bool FailDeletes { get; set; }
    public Task PutAsync(Guid ownerId, Guid photoId, PhotoVariant variant, byte[] bytes, string contentType, CancellationToken cancellationToken) => inner.PutAsync(ownerId, photoId, variant, bytes, contentType, cancellationToken);
    public Task<byte[]?> GetAsync(Guid ownerId, Guid photoId, PhotoVariant variant, CancellationToken cancellationToken) => inner.GetAsync(ownerId, photoId, variant, cancellationToken);
    public Task CopyAsync(Guid ownerId, Guid sourcePhotoId, Guid targetPhotoId, CancellationToken cancellationToken) => inner.CopyAsync(ownerId, sourcePhotoId, targetPhotoId, cancellationToken);
    public Task DeleteAsync(Guid ownerId, Guid photoId, CancellationToken cancellationToken) => FailDeletes ? throw new IOException("synthetic blob failure") : inner.DeleteAsync(ownerId, photoId, cancellationToken);
    public Task DeleteOwnerAsync(Guid ownerId, CancellationToken cancellationToken) => inner.DeleteOwnerAsync(ownerId, cancellationToken);
  }

  private P07Host WithLedger(ObservingLedger ledger) => new(containers, services =>
  {
    services.RemoveAll<IResumeDeletionLedger>();
    services.AddSingleton<IResumeDeletionLedger>(ledger);
  });

  private async Task AssertLedgered(string kind, Guid id, Guid owner)
  {
    var entryId = $"ledger/{kind}/{id:N}";
    var entry = await containers.Collection("deletion_ledger").Find(P07Mongo.Eq("_id", entryId)).SingleAsync(Ct);
    Assert.Equal(owner.ToString(), entry["OwnerId"].AsString);
    Assert.True(entry.Contains("RecordedAt"));
    Assert.True((await containers.LedgerBlobs.GetBlobClient(entryId).ExistsAsync(Ct)).Value, "The Blob copy of the ledger entry is missing");
  }

  [Fact]
  public async Task M01PurgeWritesBothLedgerEntriesBeforeAnythingDisappears()
  {
    using var ledger = new ObservingLedger(containers);
    using var host = WithLedger(ledger);
    var user = await host.SignIn();
    var resume = await user.WithPhoto();
    var photoId = Guid.Parse(resume.Json["photo"]!["id"]!.ToString());
    Assert.Equal(201, (await user.Snapshot(resume.Id)).Code);
    var trashed = await user.Trash(resume.Id, resume.ETag);

    Assert.Equal(204, (await user.Purge(resume.Id, trashed.ETag)).Code);

    Assert.Contains(ledger.Calls, call => call.Kind == "resume" && call.Id == resume.Id && call.BlobsSeen == 2 && call.DocumentsSeen == 1);
    Assert.Contains(ledger.Calls, call => call.Kind == "photo" && call.Id == photoId && call.BlobsSeen == 2 && call.DocumentsSeen == 1);
    await AssertLedgered("resume", resume.Id, user.Id);
    await AssertLedgered("photo", photoId, user.Id);
    Assert.Empty(await containers.PhotoKeys(user.Id));
    Assert.Equal(0, await containers.Collection("resumes").CountDocumentsAsync(P07Mongo.Eq("ownerId", user.Id.ToString()), cancellationToken: Ct));
    Assert.Equal(0, await containers.Collection("resume_snapshots").CountDocumentsAsync(P07Mongo.Eq("ownerId", user.Id.ToString()), cancellationToken: Ct));
  }

  [Fact]
  public async Task M02ReplaceAndRemoveLedgerThePhotoBeforeItsBlobsGoAndLeaveNoOrphan()
  {
    using var ledger = new ObservingLedger(containers);
    using var host = WithLedger(ledger);
    var user = await host.SignIn();
    var resume = await user.WithPhoto();
    var first = Guid.Parse(resume.Json["photo"]!["id"]!.ToString());

    var replaced = await user.Upload(resume.Id, P07Images.Png(50, 50), resume.ETag);
    Assert.Equal(200, replaced.Code);
    var second = replaced.Json["photo"]!["id"]!.ToString();
    Assert.NotEqual(first.ToString(), second);
    // Both photos' blobs were still there when the replaced one was ledgered.
    Assert.Contains(ledger.Calls, call => call.Kind == "photo" && call.Id == first && call.BlobsSeen == 4);
    await AssertLedgered("photo", first, user.Id);
    Assert.Equal(new[] { $"u/{user.Id}/p/{second}/master", $"u/{user.Id}/p/{second}/rendition" }, await containers.PhotoKeys(user.Id));

    Assert.Equal(200, (await user.RemovePhoto(resume.Id, replaced.ETag)).Code);
    Assert.Contains(ledger.Calls, call => call.Kind == "photo" && call.Id == Guid.Parse(second) && call.BlobsSeen == 2);
    await AssertLedgered("photo", Guid.Parse(second), user.Id);
    Assert.Empty(await containers.PhotoKeys(user.Id));
    var stored = await containers.Collection("resumes").Find(P07Mongo.Eq("_id", resume.Id.ToString())).SingleAsync(Ct);
    Assert.Empty(stored.GetValue("pendingPhotoRemovals", new BsonArray()).AsBsonArray);
  }

  [Fact]
  public async Task M03AccountPurgeRemovesEverythingOfTheOwnerAndNothingElse()
  {
    using var host = new P07Host(containers);
    var alice = await host.SignIn();
    var bob = await host.SignIn();
    var aliceResume = await alice.WithPhoto();
    var aliceTrashed = await alice.WithPhoto();
    Assert.Equal(200, (await alice.Trash(aliceTrashed.Id, aliceTrashed.ETag)).Code);
    Assert.Equal(201, (await alice.Snapshot(aliceResume.Id)).Code);
    var bobResume = await bob.WithPhoto();
    Assert.Equal(201, (await bob.Snapshot(bobResume.Id)).Code);

    await alice.Reauthenticate();
    Assert.Equal(202, (await alice.Send(HttpMethod.Delete, "/api/v1/account")).Code);
    await host.Services.GetRequiredService<IAccountDeletionProcessor>().ProcessDueAsync(Ct);

    var owner = P07Mongo.Eq("ownerId", alice.Id.ToString());
    foreach (var collection in new[] { "resumes", "resume_snapshots", "idempotency_keys" })
      Assert.Equal(0, await containers.Collection(collection).CountDocumentsAsync(owner, cancellationToken: Ct));
    Assert.Empty(await containers.PhotoKeys(alice.Id));

    Assert.Equal(200, (await bob.Get(bobResume.Path)).Code);
    Assert.Equal(200, (await bob.Get(bobResume.Path + "/photo/master")).Code);
    Assert.Single((await bob.Get(bobResume.Path + "/snapshots")).Json["items"]!.AsArray());
  }

  [Fact]
  public async Task M04ExportContainsTheOwnersActiveAndTrashedResumesOnly()
  {
    using var host = new P07Host(containers);
    var alice = await host.SignIn();
    var bob = await host.SignIn();
    var active = await alice.Created(P07Docs.Full());
    var trashed = await alice.Created(P07Docs.Blank("in the trash"));
    Assert.Equal(200, (await alice.Trash(trashed.Id, trashed.ETag)).Code);
    var foreign = await bob.Created(P07Docs.Blank("P07-FOREIGN-TITLE"));

    await alice.Reauthenticate();
    var export = await alice.Get("/api/v1/account/data-export");
    Assert.Equal(200, export.Code);
    export.AssertValid("AccountDataExport");
    Assert.Equal("no-store", export.CacheControl);
    var resumes = export.Json["resumes"]!.AsArray();
    Assert.Equal(new[] { active.Id.ToString(), trashed.Id.ToString() }.Order(StringComparer.Ordinal), resumes.Select(x => x!["id"]!.ToString()).Order(StringComparer.Ordinal));
    Assert.NotNull(resumes.Single(x => x!["id"]!.ToString() == trashed.Id.ToString())!["deletedAt"]);
    Assert.True(P07Docs.SameJson(P07Docs.Full().ToJsonString(), resumes.Single(x => x!["id"]!.ToString() == active.Id.ToString())!["document"]!.ToJsonString()));
    Assert.DoesNotContain("P07-FOREIGN-TITLE", export.Body, StringComparison.Ordinal);
    Assert.DoesNotContain(foreign.Id.ToString(), export.Body, StringComparison.Ordinal);
  }

  [Fact]
  public async Task M05ALedgerFailureDeletesNothingHidesTheResumeAndARetryOrTheWorkerFinishes()
  {
    using var ledger = new ObservingLedger(containers);
    using var host = WithLedger(ledger);
    var user = await host.SignIn();

    var first = await user.WithPhoto();
    var firstTrashed = await user.Trash(first.Id, first.ETag);
    var second = await user.WithPhoto();
    var secondTrashed = await user.Trash(second.Id, second.ETag);
    Assert.Equal(4, (await containers.PhotoKeys(user.Id)).Length);

    ledger.Fail = true;
    var key = P07User.NewKey();
    (await user.Purge(first.Id, firstTrashed.ETag, key)).AssertProblem(500, "internal_error");
    (await user.Purge(second.Id, secondTrashed.ETag)).AssertProblem(500, "internal_error");
    Assert.Equal(4, (await containers.PhotoKeys(user.Id)).Length);
    Assert.Equal(2, await containers.Collection("resumes").CountDocumentsAsync(P07Mongo.Eq("ownerId", user.Id.ToString()), cancellationToken: Ct));
    Assert.Equal(0, await containers.Collection("deletion_ledger").CountDocumentsAsync(P07Mongo.Eq("_id", $"ledger/resume/{first.Id:N}"), cancellationToken: Ct));
    // The version-checked first phase held, so the resume is gone from every read.
    (await user.Get(first.Path)).AssertProblem(404, "not_found");
    Assert.Empty((await user.Get("/api/v1/resumes?state=trashed")).Json["items"]!.AsArray());

    ledger.Fail = false;
    // A retry of the same request finishes that purge.
    Assert.Equal(204, (await user.Purge(first.Id, firstTrashed.ETag, key)).Code);
    await AssertLedgered("resume", first.Id, user.Id);
    Assert.Equal(1, await containers.Collection("resumes").CountDocumentsAsync(P07Mongo.Eq("ownerId", user.Id.ToString()), cancellationToken: Ct));

    // The worker finishes the other one.
    await host.Services.GetRequiredService<IResumeLifecycle>().ProcessPendingAsync(Ct);
    await AssertLedgered("resume", second.Id, user.Id);
    Assert.Equal(0, await containers.Collection("resumes").CountDocumentsAsync(P07Mongo.Eq("ownerId", user.Id.ToString()), cancellationToken: Ct));
    Assert.Empty(await containers.PhotoKeys(user.Id));
  }

  [Fact]
  public async Task M06AFailedPhotoCleanupKeepsTheSavedWriteAndTheWorkerFinishesIt()
  {
    FlakyPhotoStorage? flaky = null;
    using var host = new P07Host(containers, services =>
    {
      services.RemoveAll<IPhotoStorage>();
      services.AddSingleton<IPhotoStorage>(_ => flaky = new FlakyPhotoStorage(new AzurePhotoStorage(containers.BlobConnection)));
    });
    var user = await host.SignIn();
    var resume = await user.WithPhoto();
    var photoId = resume.Json["photo"]!["id"]!.ToString();
    Assert.NotNull(flaky);

    flaky.FailDeletes = true;
    var removed = await user.RemovePhoto(resume.Id, resume.ETag);
    Assert.Equal(200, removed.Code);
    Assert.Null((await user.Get(resume.Path)).Json["photo"]);
    Assert.Equal(2, (await containers.PhotoKeys(user.Id)).Length);
    var stored = await containers.Collection("resumes").Find(P07Mongo.Eq("_id", resume.Id.ToString())).SingleAsync(Ct);
    Assert.Equal(photoId, Assert.Single(stored["pendingPhotoRemovals"].AsBsonArray).AsString);

    flaky.FailDeletes = false;
    await host.Services.GetRequiredService<IResumeLifecycle>().ProcessPendingAsync(Ct);
    Assert.Empty(await containers.PhotoKeys(user.Id));
    stored = await containers.Collection("resumes").Find(P07Mongo.Eq("_id", resume.Id.ToString())).SingleAsync(Ct);
    Assert.Empty(stored["pendingPhotoRemovals"].AsBsonArray);
    Assert.Equal(2, await user.CurrentVersion(resume.Id) - 1);
  }

  /// <summary>M07 and V02: ledger entries and blob keys carry IDs and timestamps, never user text.</summary>
  [Fact]
  public async Task M07LedgerEntriesAndBlobKeysHoldIdsOnly()
  {
    const string canary = "P07CANARYLEDGER";
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var resume = await user.WithPhoto(P07Images.Png(20, 20), P07Docs.Blank(canary));
    var photoId = Guid.Parse(resume.Json["photo"]!["id"]!.ToString());
    Assert.All(await containers.PhotoKeys(user.Id), key => Assert.Matches($"^u/{user.Id}/p/{photoId}/(master|rendition)$", key));
    var trashed = await user.Trash(resume.Id, resume.ETag);
    Assert.Equal(204, (await user.Purge(resume.Id, trashed.ETag)).Code);

    foreach (var entryId in new[] { $"ledger/resume/{resume.Id:N}", $"ledger/photo/{photoId:N}" })
    {
      var entry = await containers.Collection("deletion_ledger").Find(P07Mongo.Eq("_id", entryId)).SingleAsync(Ct);
      Assert.DoesNotContain(canary, entry.ToJson(), StringComparison.Ordinal);
      Assert.DoesNotContain(user.Email, entry.ToJson(), StringComparison.Ordinal);
      Assert.Equal(entryId.Contains("resume") ? ["_id", "ResumeId", "OwnerId", "RecordedAt"] : ["_id", "PhotoId", "OwnerId", "KeyPrefix", "RecordedAt"], entry.Names);
      using var blob = new MemoryStream();
      await containers.LedgerBlobs.GetBlobClient(entryId).DownloadToAsync(blob, Ct);
      var text = System.Text.Encoding.UTF8.GetString(blob.ToArray());
      Assert.DoesNotContain(canary, text, StringComparison.Ordinal);
      Assert.DoesNotContain(user.Email, text, StringComparison.Ordinal);
    }
    var photoEntry = await containers.Collection("deletion_ledger").Find(P07Mongo.Eq("_id", $"ledger/photo/{photoId:N}")).SingleAsync(Ct);
    Assert.Equal($"u/{user.Id}/p/{photoId}/", photoEntry["KeyPrefix"].AsString);
  }

  /// <summary>A failed version check must never leave a ledger entry for live data (DD-P07-10).</summary>
  [Fact]
  public async Task M08AStalePurgeWritesNoLedgerEntryAndKeepsTheResume()
  {
    using var ledger = new ObservingLedger(containers);
    using var host = WithLedger(ledger);
    var user = await host.SignIn();
    var resume = await user.WithPhoto();
    var trashed = await user.Trash(resume.Id, resume.ETag);
    (await user.Purge(resume.Id, resume.ETag)).AssertProblem(412, "version_mismatch");
    (await user.RemovePhoto(resume.Id, trashed.ETag)).AssertProblem(409, "resume_trashed");
    Assert.Empty(ledger.Calls);
    Assert.Equal(2, (await containers.PhotoKeys(user.Id)).Length);
    Assert.Equal(200, (await user.Restore(resume.Id, trashed.ETag)).Code);
  }
}
