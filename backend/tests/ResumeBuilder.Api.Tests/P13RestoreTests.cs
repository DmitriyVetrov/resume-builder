using System.Diagnostics;
using System.Net;
using System.Text.RegularExpressions;
using Azure.Storage.Blobs.Models;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using MongoDB.Bson;
using MongoDB.Driver;
using ResumeBuilder.Api;
using ResumeBuilder.Application.Accounts;
using ResumeBuilder.Application.Resumes;
using ResumeBuilder.Infrastructure;
using Xunit;

namespace ResumeBuilder.Api.Tests;

/// <summary>Aggregate deletion, restore reconciliation, the restore drill and the write concern (AC-P13-03…06).</summary>
[Collection("P13")]
public sealed class P13RestoreTests(P07Containers containers)
{
  private static CancellationToken Ct => TestContext.Current.CancellationToken;
  private static readonly string BackendRoot = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../.."));

  private string InsideUri()
  {
    var url = new MongoUrl(containers.MongoConnection);
    var credentials = string.IsNullOrEmpty(url.Username) ? "" : $"{Uri.EscapeDataString(url.Username)}:{Uri.EscapeDataString(url.Password)}@";
    return $"mongodb://{credentials}127.0.0.1:27017/?authSource=admin&directConnection=true";
  }

  private async Task Exec(params string[] command)
  {
    var result = await containers.Mongo.ExecAsync(command, Ct);
    Assert.True(result.ExitCode == 0, $"{command[0]} exited {result.ExitCode}: {result.Stderr}");
  }

  private Task Dump(string archive) => Exec("mongodump", "--uri", InsideUri(), "--db", "resumebuilder", $"--archive=/tmp/{archive}", "--quiet");
  private Task Restore(string archive) => Exec("mongorestore", "--uri", InsideUri(), "--drop", "--nsInclude=resumebuilder.*", $"--archive=/tmp/{archive}", "--quiet");

  private async Task<List<(string Name, BinaryData Bytes, string Type)>> BackUpPhotos()
  {
    var photos = containers.Photos;
    var copy = new List<(string, BinaryData, string)>();
    await foreach (var blob in photos.GetBlobsAsync(cancellationToken: Ct))
    {
      var content = await photos.GetBlobClient(blob.Name).DownloadContentAsync(Ct);
      copy.Add((blob.Name, content.Value.Content, content.Value.Details.ContentType));
    }
    return copy;
  }

  /// <summary>The photo container goes back to the copy; the ledger container is outside every restore (ADR-039 §4).</summary>
  private async Task RestorePhotos(List<(string Name, BinaryData Bytes, string Type)> copy)
  {
    var photos = containers.Photos;
    await foreach (var blob in photos.GetBlobsAsync(cancellationToken: Ct)) await photos.GetBlobClient(blob.Name).DeleteIfExistsAsync(cancellationToken: Ct);
    foreach (var (name, bytes, type) in copy)
      await photos.GetBlobClient(name).UploadAsync(bytes, new BlobUploadOptions { HttpHeaders = new BlobHttpHeaders { ContentType = type } }, Ct);
  }

  private static Task<ReconciliationSummary> Reconcile(P07Host host) => host.Services.GetRequiredService<RestoreReconciliation>().RunAsync(Ct);

  private async Task<bool> PhotoGone(Guid owner, Guid photo) => !(await containers.PhotoKeys(owner)).Any(key => key.StartsWith($"u/{owner}/p/{photo}/", StringComparison.Ordinal));

  [Fact]
  public async Task D01AnAccountWithEverythingIsGoneFromLiveStoresWithin24Hours()
  {
    P13FlakyPhotos? flaky = null;
    using var host = new P07Host(containers, services =>
    {
      services.RemoveAll<IPhotoStorage>();
      services.AddSingleton<IPhotoStorage>(sp => flaky = new P13FlakyPhotos(sp.GetRequiredService<AzurePhotoStorage>()));
    });
    var alice = await host.SignIn();
    var withPhoto = await alice.WithPhoto();
    Assert.Equal(201, (await alice.Snapshot(withPhoto.Id)).Code);
    var pending = await alice.WithPhoto();
    flaky!.FailDeletes = true;
    Assert.Equal(200, (await alice.RemovePhoto(pending.Id, pending.ETag)).Code);
    flaky.FailDeletes = false;
    var trashed = await alice.WithPhoto();
    Assert.Equal(201, (await alice.Snapshot(trashed.Id)).Code);
    Assert.Equal(200, (await alice.Trash(trashed.Id, trashed.ETag)).Code);
    var bob = await host.SignIn();
    var bobs = await bob.WithPhoto();
    Assert.Equal(201, (await bob.Snapshot(bobs.Id)).Code);
    Assert.Equal(6, (await containers.PhotoKeys(alice.Id)).Length);
    var bobRows = await containers.LiveRows(bob.Id);

    await alice.Reauthenticate();
    Assert.Equal(202, (await alice.Send(HttpMethod.Delete, "/api/v1/account")).Code);
    Assert.NotEqual(HttpStatusCode.OK, await host.Login(alice.Email));

    host.Time.Advance(TimeSpan.FromHours(24));
    await host.Services.GetRequiredService<IAccountDeletionProcessor>().ProcessDueAsync(Ct);

    Assert.Equal(0, await containers.LiveRows(alice.Id));
    Assert.Empty(await containers.PhotoKeys(alice.Id));
    Assert.True(await containers.Ledgered("account", alice.Id));
    Assert.Equal(bobRows, await containers.LiveRows(bob.Id));
    Assert.Equal(2, (await containers.PhotoKeys(bob.Id)).Length);
    Assert.Equal(200, (await bob.Get(bobs.Path)).Code);
  }

  [Fact]
  public async Task D02TheRestoreDrillKeepsEveryDeletionDeletedAndEveryLiveResumeWhole()
  {
    using var host = new P07Host(containers);
    var erased = await host.SignIn();
    await erased.WithPhoto();
    var user = await host.SignIn();
    var deletedEarly = await user.WithPhoto();
    var deletedEarlyTrashed = await user.Trash(deletedEarly.Id, deletedEarly.ETag);
    var expiring = await user.WithPhoto();
    Assert.Equal(200, (await user.Trash(expiring.Id, expiring.ETag)).Code);
    var removing = await user.WithPhoto();
    var replacing = await user.WithPhoto();
    var keptActive = await user.WithPhoto();
    Assert.Equal(201, (await user.Snapshot(keptActive.Id)).Code);
    host.Time.Advance(TimeSpan.FromDays(20));
    user = await user.Relogin();
    erased = await erased.Relogin();
    var keptTrashed = await user.WithPhoto();
    Assert.Equal(200, (await user.Trash(keptTrashed.Id, keptTrashed.ETag)).Code);

    // Backup point.
    var archive = $"drill-{Guid.NewGuid():N}.archive";
    await Dump(archive);
    var photoBackup = await BackUpPhotos();

    // The five deletions of ADR-039 §4.
    await erased.Reauthenticate();
    Assert.Equal(202, (await erased.Send(HttpMethod.Delete, "/api/v1/account")).Code);
    Assert.Equal(204, (await user.Purge(deletedEarly.Id, deletedEarlyTrashed.ETag)).Code);
    Assert.Equal(200, (await user.RemovePhoto(removing.Id, removing.ETag)).Code);
    var replaced = await user.Upload(replacing.Id, P07Images.Png(50, 50), replacing.ETag);
    Assert.Equal(200, replaced.Code);
    host.Time.Advance(TimeSpan.FromDays(10) + TimeSpan.FromMinutes(1));
    await host.Services.GetRequiredService<IAccountDeletionProcessor>().ProcessDueAsync(Ct);
    await host.Services.GetRequiredService<TrashExpiryJob>().PurgeDueAsync(Ct);
    Assert.Null(await containers.Resume(expiring.Id));
    Assert.Equal(0, await containers.LiveRows(erased.Id));

    // Restore the database and the photos to the backup point; the ledger container is not restored.
    await Restore(archive);
    await RestorePhotos(photoBackup);
    Assert.NotNull(await containers.Resume(deletedEarly.Id));
    Assert.NotNull(await containers.Resume(expiring.Id));
    Assert.Equal(1, await containers.Count("accounts", "_id", erased.Id));
    Assert.False(await PhotoGone(user.Id, removing.PhotoId()));
    var ghost = Guid.NewGuid();
    var stray = Guid.NewGuid();
    await containers.Photos.GetBlobClient($"u/{ghost}/p/{Guid.NewGuid()}/master").UploadAsync(BinaryData.FromBytes(P07Images.Png(5, 5)), Ct);
    await containers.Photos.GetBlobClient($"u/{user.Id}/p/{stray}/master").UploadAsync(BinaryData.FromBytes(P07Images.Png(5, 5)), Ct);

    host.Time.Advance(TimeSpan.FromDays(1));
    var summary = await Reconcile(host);

    Assert.Equal(0, await containers.LiveRows(erased.Id));
    Assert.Empty(await containers.PhotoKeys(erased.Id));
    foreach (var gone in new[] { deletedEarly, expiring })
    {
      Assert.Null(await containers.Resume(gone.Id));
      Assert.Equal(0, await containers.Count("resume_snapshots", "resumeId", gone.Id));
      Assert.True(await PhotoGone(user.Id, gone.PhotoId()));
    }
    foreach (var changed in new[] { removing, replacing })
    {
      Assert.True(await PhotoGone(user.Id, changed.PhotoId()));
      Assert.True((await containers.Resume(changed.Id))!["photo"].IsBsonNull, "The restored resume still names a deleted photo");
    }
    Assert.Equal(0, await containers.Count("resume_snapshots", "resumeId", keptActive.Id));
    Assert.Empty(await containers.Blobs("photos").GetBlobsAsync(new GetBlobsOptions { Prefix = $"u/{ghost}/" }, Ct).ToListAsync(Ct));
    Assert.True(await PhotoGone(user.Id, stray));
    foreach (var kept in new[] { keptActive, keptTrashed })
    {
      Assert.NotNull(await containers.Resume(kept.Id));
      Assert.False(await PhotoGone(user.Id, kept.PhotoId()), "Reconciliation deleted a live resume's photo");
    }
    Assert.Equal(4, (await containers.PhotoKeys(user.Id)).Length);
    Assert.True(summary.LedgerEntriesLoaded >= 6, $"Loaded {summary.LedgerEntriesLoaded} ledger entries from the blob copy");
    Assert.True(summary.AccountsErased >= 1 && summary.ResumesPurged >= 2 && summary.PhotosDeleted >= 2 && summary.PhotoReferencesCleared >= 2);
    Assert.True(summary.SnapshotsDeleted >= 1 && summary.OrphanPhotosDeleted >= 1 && summary.OrphanOwnersDeleted >= 1);
  }

  [Fact]
  public async Task D03ReconciliationLoadsTheBlobLedgerAndASecondRunChangesNothing()
  {
    using var host = new P07Host(containers);
    var user = await host.SignIn();
    var resume = await user.WithPhoto();
    var trashed = await user.Trash(resume.Id, resume.ETag);
    Assert.Equal(204, (await user.Purge(resume.Id, trashed.ETag)).Code);
    var entry = $"ledger/resume/{resume.Id:N}";
    // As after a restore to a point before the purge: the collection lacks the entry, the blob copy has it.
    Assert.Equal(1, (await containers.Collection("deletion_ledger").DeleteOneAsync(P07Mongo.Eq("_id", entry), Ct)).DeletedCount);

    var first = await Reconcile(host);
    Assert.True(first.LedgerEntriesLoaded >= 1);
    Assert.Equal(1, await containers.Collection("deletion_ledger").CountDocumentsAsync(P07Mongo.Eq("_id", entry), cancellationToken: Ct));

    var second = await Reconcile(host);
    Assert.True(second.ChangedNothing, $"A second run changed something: {second}");
  }

  [Fact]
  public async Task D04TheCommandRunsReconciliationAndExitsWithoutServing()
  {
    using var host = new P07Host(containers);
    Assert.Null(await OperationsCommand.TryRunAsync(host.Services, [], Ct));
    Assert.Null(await OperationsCommand.TryRunAsync(host.Services, ["--urls=http://127.0.0.1:0"], Ct));
    Assert.Equal(0, await OperationsCommand.TryRunAsync(host.Services, [OperationsCommand.ReconcileRestore], Ct));

    // The real binary, as the runbook runs it: it must exit by itself, so it never served. Five runs, because the operator
    // copies the summary line into the incident (runbook §2): it must be printed every time, not usually (step 7 finding).
    var configuration = new DirectoryInfo(AppContext.BaseDirectory).Parent!.Name;
    var api = Path.Combine(BackendRoot, "src/ResumeBuilder.Api/bin", configuration, "net10.0/ResumeBuilder.Api.dll");
    Assert.True(File.Exists(api), $"The API binary is missing: {api}");
    for (var run = 1; run <= 5; run++) await RunCommandAsync(api, run);
  }

  private async Task RunCommandAsync(string api, int run)
  {
    var start = new ProcessStartInfo("dotnet", [api, OperationsCommand.ReconcileRestore]) { RedirectStandardOutput = true, RedirectStandardError = true };
    start.Environment["ASPNETCORE_ENVIRONMENT"] = "Production";
    start.Environment["Mongo__ConnectionString"] = containers.MongoConnection;
    start.Environment["Blob__ConnectionString"] = containers.BlobConnection;
    start.Environment["Accounts__PublicBaseUrl"] = "https://app.example";
    start.Environment["Accounts__DataProtection__KeyDirectory"] = Directory.CreateTempSubdirectory("p13-keys-").FullName;
    start.Environment["DOTNET_NOLOGO"] = "1";
    using var process = Process.Start(start)!;
    var output = process.StandardOutput.ReadToEndAsync(Ct);
    var errors = process.StandardError.ReadToEndAsync(Ct);
    using var timeout = CancellationTokenSource.CreateLinkedTokenSource(Ct);
    timeout.CancelAfter(TimeSpan.FromSeconds(90));
    try { await process.WaitForExitAsync(timeout.Token); }
    catch (OperationCanceledException) { process.Kill(true); Assert.Fail("reconcile-restore did not exit: it served instead"); }
    Assert.True(process.ExitCode == 0, $"exit {process.ExitCode}: {await errors}");
    Assert.True((await output).Contains("restore_reconciled", StringComparison.Ordinal), $"run {run}: no restore_reconciled summary in the output");
  }

  [Fact]
  public async Task D05EveryWritePathIsAMajorityWrite()
  {
    var defaults = await new MongoClient(containers.MongoConnection).GetDatabase("admin")
      .RunCommandAsync<BsonDocument>(new BsonDocument("getDefaultRWConcern", 1), cancellationToken: Ct);
    Assert.Equal("majority", defaults["defaultWriteConcern"]["w"].ToString());

    var writes = new Regex(@"\.(InsertOne|InsertMany|UpdateOne|UpdateMany|ReplaceOne|DeleteOne|DeleteMany|FindOneAndUpdate|FindOneAndReplace|FindOneAndDelete|BulkWrite)Async\(");
    var sources = Directory.GetFiles(Path.Combine(BackendRoot, "src"), "*.cs", SearchOption.AllDirectories)
      .Where(file => !file.Split(Path.DirectorySeparatorChar).Any(part => part is "obj" or "bin")).ToArray();
    var writers = sources.Where(file => writes.IsMatch(File.ReadAllText(file))).ToArray();
    Assert.NotEmpty(writers);
    foreach (var file in writers)
    {
      var source = File.ReadAllText(file);
      var databases = Regex.Matches(source, @"GetDatabase\([^;]*;");
      Assert.True(databases.Count > 0, $"{Path.GetFileName(file)} writes without its own database handle");
      Assert.All(databases, database => Assert.Matches(@"WithWriteConcern\((WriteConcern\.WMajority|DurableWriteConcern)", database.Value));
    }
    Assert.All(sources, file => Assert.DoesNotMatch(@"WriteConcern\.(W1|W2|W3|Unacknowledged|Acknowledged)\b|new WriteConcern\(|[?&]w=", File.ReadAllText(file)));
  }
}
