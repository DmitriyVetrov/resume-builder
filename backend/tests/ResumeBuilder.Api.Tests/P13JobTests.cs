using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging.Abstractions;
using ResumeBuilder.Application.Resumes;
using ResumeBuilder.Domain.Resumes;
using ResumeBuilder.Infrastructure;
using Xunit;

namespace ResumeBuilder.Api.Tests;

/// <summary>Leased jobs and the hourly trash expiry (AC-P13-01, AC-P13-02).</summary>
[Collection("P13")]
public sealed class P13JobTests(P07Containers containers)
{
  private static CancellationToken Ct => TestContext.Current.CancellationToken;
  private static readonly TimeSpan PastRetention = ResumeLimits.TrashRetention + TimeSpan.FromMinutes(1);

  private sealed class CountingJob(string name) : IScheduledJob
  {
    public int Runs { get; private set; }
    public string Name => name;
    public TimeSpan Period => TimeSpan.FromMinutes(15);
    public Task RunAsync(CancellationToken cancellationToken) { Runs++; return Task.CompletedTask; }
  }

  /// <summary>Lets the test change a resume between the job's read and its write.</summary>
  private sealed class RacingStore(IResumeStore inner) : IResumeStore
  {
    public Func<Task>? AfterTrashListed { get; set; }
    public async Task<IReadOnlyList<ResumeAggregate>> ListTrashDueAsync(DateTimeOffset now, int limit, CancellationToken cancellationToken)
    {
      var due = await inner.ListTrashDueAsync(now, limit, cancellationToken);
      if (AfterTrashListed is { } act) { AfterTrashListed = null; await act(); }
      return due;
    }
    public Task<ResumeAggregate?> FindAsync(Guid ownerId, Guid resumeId, CancellationToken cancellationToken) => inner.FindAsync(ownerId, resumeId, cancellationToken);
    public Task<ResumeAggregate?> FindIncludingPurgingAsync(Guid ownerId, Guid resumeId, CancellationToken cancellationToken) => inner.FindIncludingPurgingAsync(ownerId, resumeId, cancellationToken);
    public Task<int> CountAsync(Guid ownerId, CancellationToken cancellationToken) => inner.CountAsync(ownerId, cancellationToken);
    public Task<ResumeInsertOutcome> InsertWithinLimitAsync(ResumeAggregate aggregate, int limit, CancellationToken cancellationToken) => inner.InsertWithinLimitAsync(aggregate, limit, cancellationToken);
    public Task<bool> TryReplaceAsync(ResumeAggregate aggregate, long expectedVersion, CancellationToken cancellationToken) => inner.TryReplaceAsync(aggregate, expectedVersion, cancellationToken);
    public Task<IReadOnlyList<ResumeSummary>> ListAsync(Guid ownerId, ResumeListState state, int take, ListPosition? after, CancellationToken cancellationToken) => inner.ListAsync(ownerId, state, take, after, cancellationToken);
    public Task<IReadOnlyList<ResumeAggregate>> ListAllForOwnerAsync(Guid ownerId, CancellationToken cancellationToken) => inner.ListAllForOwnerAsync(ownerId, cancellationToken);
    public Task<IReadOnlyList<ResumeAggregate>> ListPendingLifecycleAsync(int limit, CancellationToken cancellationToken) => inner.ListPendingLifecycleAsync(limit, cancellationToken);
    public Task PullPendingPhotoAsync(Guid ownerId, Guid resumeId, Guid photoId, CancellationToken cancellationToken) => inner.PullPendingPhotoAsync(ownerId, resumeId, photoId, cancellationToken);
    public Task<int> ClearPhotoReferencesAsync(Guid ownerId, Guid photoId, CancellationToken cancellationToken) => inner.ClearPhotoReferencesAsync(ownerId, photoId, cancellationToken);
    public Task<IReadOnlySet<Guid>> ListPhotoReferencesAsync(Guid ownerId, CancellationToken cancellationToken) => inner.ListPhotoReferencesAsync(ownerId, cancellationToken);
    public Task DeleteAsync(Guid ownerId, Guid resumeId, CancellationToken cancellationToken) => inner.DeleteAsync(ownerId, resumeId, cancellationToken);
    public Task DeleteForOwnerAsync(Guid ownerId, CancellationToken cancellationToken) => inner.DeleteForOwnerAsync(ownerId, cancellationToken);
  }

  private P07Host WithLedger(P13ObservingLedger ledger, Action<IServiceCollection>? more = null) => new(containers, services =>
  {
    services.RemoveAll<IResumeDeletionLedger>();
    services.AddSingleton<IResumeDeletionLedger>(ledger);
    more?.Invoke(services);
  });

  private static Task<int> Expire(P07Host host) => host.Services.GetRequiredService<TrashExpiryJob>().PurgeDueAsync(Ct);

  [Fact]
  public async Task J01ALeaseHasOneHolderUntilItExpires()
  {
    using var lease = new MongoJobLease(containers.MongoConnection);
    var job = "j01-" + Guid.NewGuid().ToString("N");
    var t0 = DateTimeOffset.UtcNow;
    var hour = TimeSpan.FromHours(1);

    Assert.True(await lease.TryAcquireAsync(job, "A", t0, hour, Ct));
    Assert.False(await lease.TryAcquireAsync(job, "B", t0.AddMinutes(59), hour, Ct));
    // The holder renews its own lease.
    Assert.True(await lease.TryAcquireAsync(job, "A", t0.AddMinutes(30), hour, Ct));
    Assert.False(await lease.TryAcquireAsync(job, "B", t0.AddMinutes(89), hour, Ct));
    Assert.True(await lease.TryAcquireAsync(job, "B", t0.AddMinutes(91), hour, Ct));
    Assert.False(await lease.TryAcquireAsync(job, "A", t0.AddMinutes(92), hour, Ct));
    // Leases are per job name.
    Assert.True(await lease.TryAcquireAsync(job + "-other", "A", t0.AddMinutes(92), hour, Ct));
  }

  [Fact]
  public async Task J02TwoReplicasRunAJobOncePerPeriod()
  {
    using var lease = new MongoJobLease(containers.MongoConnection);
    var job = new CountingJob("j02-" + Guid.NewGuid().ToString("N"));
    var clock = new P07Clock();
    using var a = new ScheduledJobWorker(job, lease, clock, NullLogger<ScheduledJobWorker>.Instance, "replica-a");
    using var b = new ScheduledJobWorker(job, lease, clock, NullLogger<ScheduledJobWorker>.Instance, "replica-b");

    Assert.True(await a.RunOnceAsync(Ct));
    Assert.False(await b.RunOnceAsync(Ct));
    Assert.Equal(1, job.Runs);

    clock.Advance(job.Period + TimeSpan.FromSeconds(1));
    Assert.True(await b.RunOnceAsync(Ct));
    Assert.False(await a.RunOnceAsync(Ct));
    Assert.Equal(2, job.Runs);
  }

  [Fact]
  public async Task J03ExpiredTrashIsPurgedLedgerFirstAndNothingElseIs()
  {
    using var ledger = new P13ObservingLedger(containers);
    using var host = WithLedger(ledger);
    var user = await host.SignIn();
    var active = await user.WithPhoto();
    var expired = await user.WithPhoto();
    var photo = expired.PhotoId();
    Assert.Equal(201, (await user.Snapshot(expired.Id)).Code);
    Assert.Equal(200, (await user.Trash(expired.Id, (await user.Get(expired.Path)).ETag)).Code);
    host.Time.Advance(TimeSpan.FromDays(2));
    var recent = await user.Created();
    Assert.Equal(200, (await user.Trash(recent.Id, recent.ETag)).Code);

    host.Time.Advance(PastRetention - TimeSpan.FromDays(2));
    await Expire(host);

    Assert.Contains(ledger.Calls, call => call.Kind == "resume" && call.Id == expired.Id && call.BlobsSeen == 4 && call.DocumentsSeen == 3);
    Assert.Contains(ledger.Calls, call => call.Kind == "photo" && call.Id == photo && call.BlobsSeen == 4);
    Assert.True(await containers.Ledgered("resume", expired.Id));
    Assert.True(await containers.Ledgered("photo", photo));
    Assert.Null(await containers.Resume(expired.Id));
    Assert.Equal(0, await containers.Count("resume_snapshots", "resumeId", expired.Id));
    Assert.Equal(new[] { $"u/{user.Id}/p/{active.PhotoId()}/master", $"u/{user.Id}/p/{active.PhotoId()}/rendition" }, await containers.PhotoKeys(user.Id));
    // Inside its 30 days, and active: untouched.
    Assert.NotNull(await containers.Resume(recent.Id));
    user = await user.Relogin();
    Assert.Equal(200, (await user.Get(active.Path)).Code);
    Assert.DoesNotContain(ledger.Calls, call => call.Id == recent.Id || call.Id == active.Id);
  }

  [Fact]
  public async Task J04ARestoreBeforeOrDuringTheRunKeepsTheResume()
  {
    using var ledger = new P13ObservingLedger(containers);
    RacingStore? racing = null;
    using var host = WithLedger(ledger, services =>
    {
      services.RemoveAll<IResumeStore>();
      services.AddSingleton<IResumeStore>(sp => racing = new RacingStore(sp.GetRequiredService<MongoResumeStore>()));
    });
    var user = await host.SignIn();
    var before = await user.WithPhoto();
    var during = await user.WithPhoto();
    var trashedBefore = await user.Trash(before.Id, before.ETag);
    var trashedDuring = await user.Trash(during.Id, during.ETag);
    host.Time.Advance(PastRetention);
    user = await user.Relogin();

    Assert.Equal(200, (await user.Restore(before.Id, trashedBefore.ETag)).Code);
    _ = host.Services.GetRequiredService<IResumeStore>();
    racing!.AfterTrashListed = async () => Assert.Equal(200, (await user.Restore(during.Id, trashedDuring.ETag)).Code);
    await Expire(host);

    foreach (var resume in new[] { before, during })
    {
      var stored = await user.Get(resume.Path);
      Assert.Equal(200, stored.Code);
      Assert.Null(stored.Json["deletedAt"]?.GetValue<string>());
      Assert.Equal(resume.PhotoId().ToString(), stored.Json["photo"]!["id"]!.ToString());
      Assert.DoesNotContain(ledger.Calls, call => call.Id == resume.Id);
    }
    Assert.Equal(4, (await containers.PhotoKeys(user.Id)).Length);
    Assert.True(racing.AfterTrashListed is null, "The job never listed due trash");
  }

  [Fact]
  public async Task J05AFailingResumeDoesNotStopTheOthersAndIsFinishedLater()
  {
    using var ledger = new P13ObservingLedger(containers);
    using var host = WithLedger(ledger);
    var user = await host.SignIn();
    var failing = await user.Created();
    var passing = await user.Created();
    Assert.Equal(200, (await user.Trash(failing.Id, failing.ETag)).Code);
    Assert.Equal(200, (await user.Trash(passing.Id, passing.ETag)).Code);
    host.Time.Advance(PastRetention);
    ledger.FailFor.Add(failing.Id);

    await Expire(host);

    Assert.Null(await containers.Resume(passing.Id));
    Assert.True(await containers.Ledgered("resume", passing.Id));
    user = await user.Relogin();
    // Hidden at once, kept for the lifecycle worker.
    Assert.Equal(404, (await user.Get(failing.Path)).Code);
    Assert.NotNull(await containers.Resume(failing.Id));
    var pending = host.Logs.Entries.Where(entry => entry.Message.StartsWith("trash_expiry_pending", StringComparison.Ordinal)).ToArray();
    Assert.NotEmpty(pending);
    Assert.All(pending, entry => Assert.DoesNotContain(failing.Id.ToString(), entry.Message + string.Join(' ', entry.Fields.Select(field => field.Value)), StringComparison.OrdinalIgnoreCase));

    ledger.FailFor.Clear();
    await host.Services.GetRequiredService<IResumeLifecycle>().ProcessPendingAsync(Ct);
    Assert.Null(await containers.Resume(failing.Id));
    Assert.True(await containers.Ledgered("resume", failing.Id));
  }

  [Fact]
  public async Task J06ARepeatedRunIsHarmless()
  {
    using var ledger = new P13ObservingLedger(containers);
    using var host = WithLedger(ledger);
    var user = await host.SignIn();
    var resume = await user.WithPhoto();
    Assert.Equal(200, (await user.Trash(resume.Id, resume.ETag)).Code);
    host.Time.Advance(PastRetention);

    Assert.True(await Expire(host) >= 1);
    var calls = ledger.Calls.Count;
    await Expire(host);

    Assert.Null(await containers.Resume(resume.Id));
    Assert.Equal(calls, ledger.Calls.Count);
    Assert.Equal(1, await containers.Collection("deletion_ledger").CountDocumentsAsync(P07Mongo.Eq("_id", $"ledger/resume/{resume.Id:N}"), cancellationToken: Ct));
  }
}
