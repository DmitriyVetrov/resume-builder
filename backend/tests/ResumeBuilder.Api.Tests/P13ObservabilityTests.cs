using System.Text;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;
using ResumeBuilder.Application.Accounts;
using ResumeBuilder.Application.Resumes;
using ResumeBuilder.Domain.Resumes;
using ResumeBuilder.Infrastructure;
using Xunit;

namespace ResumeBuilder.Api.Tests;

/// <summary>No content in any log (AC-P13-09) and the operational events under production filters (AC-P13-10).</summary>
[Collection("P13")]
public sealed partial class P13ObservabilityTests(P07Containers containers)
{
  private static CancellationToken Ct => TestContext.Current.CancellationToken;

  private sealed class CapturingEmail : IEmailSink
  {
    public List<AccountEmail> Sent { get; } = [];
    public Task SendAsync(AccountEmail message, CancellationToken cancellationToken) { lock (Sent) Sent.Add(message); return Task.CompletedTask; }
  }

  private sealed class FailingEmail : IEmailSink
  {
    public Task SendAsync(AccountEmail message, CancellationToken cancellationToken) => throw new IOException("synthetic smtp failure");
  }

  private sealed class FailingPurger : IAccountOwnedDataPurger
  {
    public bool Failing { get; set; } = true;
    public Task PurgeAsync(Guid accountId, CancellationToken cancellationToken) => Failing ? throw new IOException("synthetic purge failure") : Task.CompletedTask;
  }

  private sealed class FailingJob : IScheduledJob
  {
    public string Name => "o02-failing";
    public TimeSpan Period => TimeSpan.FromMinutes(1);
    public Task RunAsync(CancellationToken cancellationToken) => throw new IOException("synthetic job failure");
  }

  [GeneratedRegex("#t=([^\\s&]+)")]
  private static partial Regex TokenPattern();

  private static string TokenFrom(CapturingEmail mail, string address, string path)
  {
    lock (mail.Sent)
    {
      var message = mail.Sent.Last(sent => sent.RecipientAddress == address && sent.Body.Contains(path, StringComparison.Ordinal));
      return Uri.UnescapeDataString(TokenPattern().Match(message.Body).Groups[1].Value);
    }
  }

  [Fact]
  public async Task O01ACanaryJourneyThroughEveryEndpointAndJobLeavesNoContentInAnyLog()
  {
    var mail = new CapturingEmail();
    using var host = new P07Host(containers, services => { services.RemoveAll<IEmailSink>(); services.AddSingleton<IEmailSink>(mail); });
    var tag = Guid.NewGuid().ToString("N")[..12];
    var email = $"canary-mail-{tag}@example.invalid";
    var password = $"canary-pass-{tag}";
    var newPassword = $"canary-newpass-{tag}";
    var title = $"canary-title-{tag}";
    var text = $"canary-text-{tag}";
    var fileName = $"canary-file-{tag}.png";
    var marker = $"canary-bytes-{tag}";
    var dispatcher = host.Services.GetRequiredService<IAccountEmailDispatcher>();

    var anonymous = host.CreateClient();
    using var bootstrap = await anonymous.GetAsync("/api/v1/session", Ct);
    var visitor = new P07User(host, anonymous, P07User.CsrfOf(bootstrap), Guid.Empty, email);
    Assert.Equal(202, (await visitor.Send(HttpMethod.Post, "/api/v1/auth/sign-up", P07User.Json(new JsonObject { ["email"] = email, ["password"] = password }))).Code);
    await dispatcher.DispatchAvailableAsync(Ct);
    var verifyToken = TokenFrom(mail, email, "/verify-email");
    Assert.Equal(204, (await visitor.Send(HttpMethod.Post, "/api/v1/auth/verify-email", P07User.Json(new JsonObject { ["token"] = verifyToken }))).Code);
    Assert.Equal(401, (await visitor.Send(HttpMethod.Post, "/api/v1/auth/login", P07User.Json(new JsonObject { ["email"] = email, ["password"] = password + "-wrong" }))).Code);
    Assert.Equal(202, (await visitor.Send(HttpMethod.Post, "/api/v1/auth/password-reset/request", P07User.Json(new JsonObject { ["email"] = email }))).Code);
    await dispatcher.DispatchAvailableAsync(Ct);
    var resetToken = TokenFrom(mail, email, "/reset-password/confirm");
    Assert.Equal(204, (await visitor.Send(HttpMethod.Post, "/api/v1/auth/password-reset/confirm", P07User.Json(new JsonObject { ["token"] = resetToken, ["newPassword"] = newPassword }))).Code);

    var login = await visitor.Send(HttpMethod.Post, "/api/v1/auth/login", P07User.Json(new JsonObject { ["email"] = email, ["password"] = newPassword }));
    Assert.Equal(200, login.Code);
    var user = new P07User(host, anonymous, CsrfFrom(login), Guid.Parse(login.Json["user"]!["id"]!.ToString()), email);
    Assert.Equal(204, (await user.Send(HttpMethod.Post, "/api/v1/auth/reauthenticate", P07User.Json(new JsonObject { ["password"] = newPassword }))).Code);

    var document = P07Docs.WithSections(P07Docs.TextSection(text));
    document["title"] = title;
    var resume = await user.Created(document);
    document["sections"]!.AsArray().Add(P07Docs.TextSection(text + "-second"));
    var written = await user.Put(resume.Id, document, resume.ETag);
    Assert.Equal(200, written.Code);
    var invalid = document.DeepClone();
    invalid["title"] = new string('x', 5000) + text;
    Assert.Equal(400, (await user.Put(resume.Id, invalid, written.ETag)).Code);
    var photo = P07Images.Png(30, 30).Concat(Encoding.UTF8.GetBytes(marker)).ToArray();
    var uploaded = await user.Upload(resume.Id, photo, written.ETag, fileName: fileName, declaredType: "image/png");
    Assert.Equal(200, uploaded.Code);
    Assert.Equal(201, (await user.Snapshot(resume.Id)).Code);
    var trashed = await user.Trash(resume.Id, uploaded.ETag);
    var restored = await user.Restore(resume.Id, trashed.ETag);
    Assert.Equal(200, restored.Code);
    var second = await user.Created(P07Docs.WithSections(P07Docs.TextSection(text + "-other")));
    var secondTrashed = await user.Trash(second.Id, second.ETag);
    Assert.Equal(204, (await user.Purge(second.Id, secondTrashed.ETag)).Code);
    var stale = await user.Trash(resume.Id, restored.ETag);
    Assert.Equal(200, stale.Code);
    Assert.Equal(200, (await user.Get("/api/v1/account/data-export")).Code);
    var events = new JsonObject { ["events"] = new JsonArray(new JsonObject { ["type"] = "export_failed", ["code"] = "pdf_write", ["resumeId"] = resume.Id.ToString(), ["engineVersion"] = "1.1.0", ["occurredAt"] = "2026-11-12T10:00:00Z" }) };
    Assert.True((await user.Send(HttpMethod.Post, "/api/v1/client-events", P07User.Json(events))).Code is 202 or 204);
    Assert.Equal(204, (await user.Send(HttpMethod.Post, "/api/v1/auth/reauthenticate", P07User.Json(new JsonObject { ["password"] = newPassword }))).Code);
    Assert.Equal(202, (await user.Send(HttpMethod.Delete, "/api/v1/account")).Code);

    host.Time.Advance(TimeSpan.FromDays(31));
    await host.Services.GetRequiredService<IAccountDeletionProcessor>().ProcessDueAsync(Ct);
    await host.Services.GetRequiredService<IResumeLifecycle>().ProcessPendingAsync(Ct);
    await host.Services.GetRequiredService<TrashExpiryJob>().PurgeDueAsync(Ct);
    await host.Services.GetRequiredService<RestoreReconciliation>().RunAsync(Ct);

    var canaries = new[] { email, $"canary-mail-{tag}", password, newPassword, title, text, fileName, marker, verifyToken, resetToken };
    var entries = host.Logs.Entries.ToArray();
    Assert.NotEmpty(entries);
    Assert.Contains(entries, entry => entry.Message.StartsWith("restore_reconciled", StringComparison.Ordinal));
    foreach (var entry in entries)
      foreach (var canary in canaries)
      {
        var where = $"{entry.Category}: {entry.Message}";
        Assert.False(entry.Message.Contains(canary, StringComparison.OrdinalIgnoreCase), $"A message carries a canary: {where}");
        Assert.False(entry.Exception.Contains(canary, StringComparison.OrdinalIgnoreCase), $"An exception carries a canary: {where}");
        Assert.All(entry.Fields, field => Assert.False(field.Value.Contains(canary, StringComparison.OrdinalIgnoreCase), $"A field carries a canary: {where}"));
      }
  }

  private static string CsrfFrom(P07Response response) =>
    response.Headers.GetValues("Set-Cookie").Single(value => value.StartsWith("XSRF-TOKEN=", StringComparison.Ordinal)).Split(';')[0].Split('=')[1];

  [Fact]
  public async Task O02ProductionFiltersLetTheOperationalCountsThroughAndNothingElse()
  {
    var failingPurger = new FailingPurger();
    using var host = new P13Host(containers, productionLogging: true, services: services =>
    {
      services.AddSingleton<IAccountOwnedDataPurger>(failingPurger);
    });
    var clock = host.Services.GetRequiredService<IClock>();

    // Mail delivery: one undeliverable message.
    var email = $"o02-{Guid.NewGuid():N}@example.invalid";
    await host.Services.GetRequiredService<IAccountUseCases>().SignUpAsync(email, P07Host.Password, Ct);
    var dispatcher = new AccountEmailDispatcher(host.Services.GetRequiredService<IEmailOutboxStore>(), new FailingEmail(), clock,
      host.Services.GetRequiredService<ILogger<AccountEmailDispatcher>>());
    await dispatcher.DispatchAvailableAsync(Ct);

    // Account purge: due, and a purger fails.
    var account = await host.Services.GetRequiredService<IAccountStore>().FindByNormalizedEmailAsync(email.ToUpperInvariant(), Ct);
    Assert.NotNull(account);
    Assert.True(await host.Services.GetRequiredService<IAccountStore>().TryMarkDeletionRequestedAsync(account.Id, clock.UtcNow.AddDays(-2), Ct));
    await Assert.ThrowsAnyAsync<InvalidOperationException>(() => host.Services.GetRequiredService<IAccountDeletionProcessor>().ProcessDueAsync(Ct));
    // Reconciliation must fail on a failing erase, so the purger recovers before it runs.
    failingPurger.Failing = false;

    // Resume lifecycle, trash expiry, a failing scheduled job and a reconciliation.
    host.Services.GetRequiredService<IResumeDiagnostics>().LifecycleWorkPending(1, 2);
    var trashOwner = Guid.NewGuid();
    var due = ResumeAggregate.Create(Guid.NewGuid(), trashOwner, ResumeDocumentFixtures.Blank(), null, clock.UtcNow.AddDays(-40))
      .Trash(Guid.NewGuid(), "h", clock.UtcNow.AddDays(-40));
    var trash = new TrashExpiryJob(new OneDueResume(due), new ThrowingLifecycle(), clock, host.Services.GetRequiredService<ILogger<TrashExpiryJob>>());
    await trash.PurgeDueAsync(Ct);
    using var worker = new ScheduledJobWorker(new FailingJob(), new AlwaysLease(), clock, host.Services.GetRequiredService<ILogger<ScheduledJobWorker>>(), "o02");
    await worker.RunOnceAsync(Ct);
    await host.Services.GetRequiredService<RestoreReconciliation>().RunAsync(Ct);

    var entries = host.Logs.Entries.ToArray();
    foreach (var name in new[] { "account_mail_delivery_failed", "account_purge_pending", "resume_lifecycle_pending", "trash_expiry_pending", "scheduled_job_failed", "restore_reconciled" })
      Assert.True(entries.Any(entry => entry.Message.StartsWith(name, StringComparison.Ordinal)), $"{name} did not reach the production log");
    Assert.DoesNotContain(entries, entry => entry.Category.StartsWith("Microsoft.", StringComparison.Ordinal) || entry.Category.StartsWith("System.", StringComparison.Ordinal));
    Assert.All(entries.Where(entry => !entry.Category.StartsWith("ResumeBuilder.Api", StringComparison.Ordinal)), entry =>
    {
      Assert.DoesNotContain(email, entry.Message, StringComparison.OrdinalIgnoreCase);
      Assert.DoesNotContain(due.Id.ToString(), entry.Message, StringComparison.OrdinalIgnoreCase);
      Assert.DoesNotContain(trashOwner.ToString(), entry.Message, StringComparison.OrdinalIgnoreCase);
      Assert.Empty(entry.Exception);
    });
  }

  private sealed class AlwaysLease : IJobLease
  {
    public Task<bool> TryAcquireAsync(string job, string holder, DateTimeOffset now, TimeSpan duration, CancellationToken cancellationToken) => Task.FromResult(true);
  }

  private sealed class ThrowingLifecycle : IResumeLifecycle
  {
    public Task FinishPurgeAsync(ResumeAggregate aggregate, CancellationToken cancellationToken) => throw new IOException("synthetic lifecycle failure");
    public Task FinishPhotoRemovalsAsync(ResumeAggregate aggregate, CancellationToken cancellationToken) => throw new IOException("synthetic lifecycle failure");
    public Task ProcessPendingAsync(CancellationToken cancellationToken) => Task.CompletedTask;
  }

  /// <summary>Lists one due resume and accepts its purge request, so the job reaches the failing second phase.</summary>
  private sealed class OneDueResume(ResumeAggregate due) : IResumeStore
  {
    public Task<IReadOnlyList<ResumeAggregate>> ListTrashDueAsync(DateTimeOffset now, int limit, CancellationToken cancellationToken) =>
      Task.FromResult<IReadOnlyList<ResumeAggregate>>(limit > 0 ? [due] : []);
    public Task<bool> TryReplaceAsync(ResumeAggregate aggregate, long expectedVersion, CancellationToken cancellationToken) => Task.FromResult(true);
    public Task<ResumeAggregate?> FindAsync(Guid ownerId, Guid resumeId, CancellationToken cancellationToken) => Task.FromResult<ResumeAggregate?>(null);
    public Task<ResumeAggregate?> FindIncludingPurgingAsync(Guid ownerId, Guid resumeId, CancellationToken cancellationToken) => Task.FromResult<ResumeAggregate?>(null);
    public Task<int> CountAsync(Guid ownerId, CancellationToken cancellationToken) => Task.FromResult(0);
    public Task<ResumeInsertOutcome> InsertWithinLimitAsync(ResumeAggregate aggregate, int limit, CancellationToken cancellationToken) => Task.FromResult(ResumeInsertOutcome.Created);
    public Task<IReadOnlyList<ResumeSummary>> ListAsync(Guid ownerId, ResumeListState state, int take, ListPosition? after, CancellationToken cancellationToken) => Task.FromResult<IReadOnlyList<ResumeSummary>>([]);
    public Task<IReadOnlyList<ResumeAggregate>> ListAllForOwnerAsync(Guid ownerId, CancellationToken cancellationToken) => Task.FromResult<IReadOnlyList<ResumeAggregate>>([]);
    public Task<IReadOnlyList<ResumeAggregate>> ListPendingLifecycleAsync(int limit, CancellationToken cancellationToken) => Task.FromResult<IReadOnlyList<ResumeAggregate>>([]);
    public Task PullPendingPhotoAsync(Guid ownerId, Guid resumeId, Guid photoId, CancellationToken cancellationToken) => Task.CompletedTask;
    public Task<int> ClearPhotoReferencesAsync(Guid ownerId, Guid photoId, CancellationToken cancellationToken) => Task.FromResult(0);
    public Task<IReadOnlySet<Guid>> ListPhotoReferencesAsync(Guid ownerId, CancellationToken cancellationToken) => Task.FromResult<IReadOnlySet<Guid>>(new HashSet<Guid>());
    public Task DeleteAsync(Guid ownerId, Guid resumeId, CancellationToken cancellationToken) => Task.CompletedTask;
    public Task DeleteForOwnerAsync(Guid ownerId, CancellationToken cancellationToken) => Task.CompletedTask;
  }
}

internal static class ResumeDocumentFixtures
{
  /// <summary>The contract's blank example, read through the production reader so the aggregate is a real one.</summary>
  public static ResumeDocument Blank()
  {
    using var json = System.Text.Json.JsonDocument.Parse(P07Docs.Blank().ToJsonString());
    var read = ResumeDocumentReader.Read(json.RootElement);
    return read.Document ?? throw new InvalidOperationException("The contract's blank example does not read");
  }
}
