using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Azure;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using MongoDB.Bson;
using MongoDB.Driver;
using ResumeBuilder.Application.Accounts;
using ResumeBuilder.Application.Resumes;

namespace ResumeBuilder.Infrastructure;

public sealed class DualAccountDeletionLedger : IAccountDeletionLedger, IResumeDeletionLedger, IDisposable
{
  private readonly MongoClient client;
  private readonly IMongoCollection<BsonDocument> ledger;
  private readonly BlobContainerClient blob;
  public DualAccountDeletionLedger(string mongoConnection, string blobConnection)
  {
    client = new MongoClient(mongoConnection);
    ledger = client.GetDatabase("resumebuilder").WithWriteConcern(WriteConcern.WMajority).GetCollection<BsonDocument>("deletion_ledger");
    blob = new BlobServiceClient(blobConnection, new BlobClientOptions(BlobClientOptions.ServiceVersion.V2024_11_04)).GetBlobContainerClient("deletion-ledger");
  }
  public async Task RecordAccountAsync(Guid userId, DateTimeOffset recordedAt, CancellationToken cancellationToken)
  {
    var id = "ledger/account/" + userId.ToString("N");
    await ledger.Indexes.CreateOneAsync(new CreateIndexModel<BsonDocument>(Builders<BsonDocument>.IndexKeys.Ascending("RecordedAt"), new CreateIndexOptions { ExpireAfter = TimeSpan.FromDays(35) }), cancellationToken: cancellationToken);
    await ledger.UpdateOneAsync(Builders<BsonDocument>.Filter.Eq("_id", id), Builders<BsonDocument>.Update
      .SetOnInsert("UserId", userId.ToString()).SetOnInsert("RecordedAt", recordedAt.UtcDateTime),
      new UpdateOptions { IsUpsert = true }, cancellationToken);
    await blob.CreateIfNotExistsAsync(cancellationToken: cancellationToken);
    var payload = System.Text.Encoding.UTF8.GetBytes(userId.ToString("N") + "\n" + recordedAt.ToUnixTimeSeconds().ToString(System.Globalization.CultureInfo.InvariantCulture));
    using var stream = new MemoryStream(payload, writable: false);
    try { await blob.GetBlobClient(id).UploadAsync(stream, overwrite: false, cancellationToken); }
    catch (RequestFailedException error) when (error.Status == 409 && error.ErrorCode == "BlobAlreadyExists") { }
  }
  public Task RecordResumeAsync(Guid resumeId, Guid ownerId, DateTimeOffset recordedAt, CancellationToken cancellationToken) =>
    RecordIdsAsync("ledger/resume/" + resumeId.ToString("N"), new BsonDocument { ["ResumeId"] = resumeId.ToString(), ["OwnerId"] = ownerId.ToString() }, recordedAt, cancellationToken);

  public Task RecordPhotoAsync(Guid photoId, Guid ownerId, DateTimeOffset recordedAt, CancellationToken cancellationToken) =>
    RecordIdsAsync("ledger/photo/" + photoId.ToString("N"), new BsonDocument { ["PhotoId"] = photoId.ToString(), ["OwnerId"] = ownerId.ToString(), ["KeyPrefix"] = $"u/{ownerId}/p/{photoId}/" }, recordedAt, cancellationToken);

  /// <summary>ADR-039 §3–§4: both stores hold the entry before anything is deleted. Random IDs and a timestamp, nothing else.</summary>
  private async Task RecordIdsAsync(string id, BsonDocument fields, DateTimeOffset recordedAt, CancellationToken cancellationToken)
  {
    await ledger.Indexes.CreateOneAsync(new CreateIndexModel<BsonDocument>(Builders<BsonDocument>.IndexKeys.Ascending("RecordedAt"), new CreateIndexOptions { ExpireAfter = TimeSpan.FromDays(35) }), cancellationToken: cancellationToken);
    var entry = new BsonDocument("_id", id).AddRange(fields).Add("RecordedAt", recordedAt.UtcDateTime);
    try { await ledger.InsertOneAsync(entry, cancellationToken: cancellationToken); }
    catch (MongoWriteException error) when (error.WriteError.Category == ServerErrorCategory.DuplicateKey) { /* A retry: the first entry stands. */ }
    await blob.CreateIfNotExistsAsync(cancellationToken: cancellationToken);
    var lines = fields.Values.Select(value => value.AsString).Append(recordedAt.ToUnixTimeSeconds().ToString(System.Globalization.CultureInfo.InvariantCulture));
    using var stream = new MemoryStream(System.Text.Encoding.UTF8.GetBytes(string.Join('\n', lines)), writable: false);
    try { await blob.GetBlobClient(id).UploadAsync(stream, overwrite: false, cancellationToken); }
    catch (RequestFailedException error) when (error.Status == 409 && error.ErrorCode == "BlobAlreadyExists") { /* A retry: the first entry stands. */ }
  }

  /// <summary>
  /// ADR-039 §4 step 1: the union of the append-only blob copy and the (possibly restored) collection. Entries only the blob
  /// has are written back to the collection. Returns every entry and how many were loaded.
  /// </summary>
  public async Task<(IReadOnlyList<LedgerEntry> Entries, int Loaded)> LoadAllAsync(CancellationToken cancellationToken)
  {
    var entries = new Dictionary<string, LedgerEntry>(StringComparer.Ordinal);
    foreach (var row in await ledger.Find(FilterDefinition<BsonDocument>.Empty).ToListAsync(cancellationToken))
      if (Parse(row["_id"].AsString, row) is { } entry) entries[row["_id"].AsString] = entry;
    var loaded = 0;
    if (!(await blob.ExistsAsync(cancellationToken)).Value) return ([.. entries.Values], 0);
    await foreach (var item in blob.GetBlobsAsync(new GetBlobsOptions { Prefix = "ledger/" }, cancellationToken))
    {
      if (entries.ContainsKey(item.Name)) continue;
      var content = await blob.GetBlobClient(item.Name).DownloadContentAsync(cancellationToken);
      var lines = content.Value.Content.ToString().Split('\n');
      if (FromBlob(item.Name, lines) is not { } entry) continue;
      var row = new BsonDocument("_id", item.Name).Add("RecordedAt", entry.RecordedAt.UtcDateTime);
      if (entry.Kind == LedgerKind.Account) row.Add("UserId", entry.Id.ToString());
      else row.Add(entry.Kind == LedgerKind.Resume ? "ResumeId" : "PhotoId", entry.Id.ToString()).Add("OwnerId", entry.OwnerId.ToString());
      if (entry.Kind == LedgerKind.Photo) row.Add("KeyPrefix", $"u/{entry.OwnerId}/p/{entry.Id}/");
      try { await ledger.InsertOneAsync(row, cancellationToken: cancellationToken); loaded++; }
      catch (MongoWriteException error) when (error.WriteError.Category == ServerErrorCategory.DuplicateKey) { }
      entries[item.Name] = entry;
    }
    return ([.. entries.Values], loaded);
  }

  private static LedgerEntry? Parse(string id, BsonDocument row)
  {
    var parts = id.Split('/');
    if (parts.Length != 3 || !Guid.TryParseExact(parts[2], "N", out var key)) return null;
    var at = new DateTimeOffset(row["RecordedAt"].ToUniversalTime(), TimeSpan.Zero);
    return parts[1] switch
    {
      "account" => new LedgerEntry(LedgerKind.Account, key, key, at),
      "resume" => new LedgerEntry(LedgerKind.Resume, key, Guid.Parse(row["OwnerId"].AsString), at),
      "photo" => new LedgerEntry(LedgerKind.Photo, key, Guid.Parse(row["OwnerId"].AsString), at),
      _ => null,
    };
  }

  /// <summary>The blob payloads written above: account `id\nunix`; resume `id\nowner\nunix`; photo `id\nowner\nprefix\nunix`.</summary>
  private static LedgerEntry? FromBlob(string name, string[] lines)
  {
    var parts = name.Split('/');
    if (parts.Length != 3 || !Guid.TryParseExact(parts[2], "N", out var key) || !long.TryParse(lines[^1], out var unix)) return null;
    var at = DateTimeOffset.FromUnixTimeSeconds(unix);
    return parts[1] switch
    {
      "account" => new LedgerEntry(LedgerKind.Account, key, key, at),
      "resume" when lines.Length == 3 => new LedgerEntry(LedgerKind.Resume, key, Guid.Parse(lines[1]), at),
      "photo" when lines.Length == 4 => new LedgerEntry(LedgerKind.Photo, key, Guid.Parse(lines[1]), at),
      _ => null,
    };
  }

  public void Dispose() => client.Dispose();
}

public enum LedgerKind { Account, Resume, Photo }

/// <summary>A deletion ledger entry: random IDs and a time, nothing else (ADR-039 §4).</summary>
public sealed record LedgerEntry(LedgerKind Kind, Guid Id, Guid OwnerId, DateTimeOffset RecordedAt);

public sealed class AccountDeletionProcessor : IAccountDeletionProcessor
{
  private readonly IAccountStore accounts;
  private readonly IAccountTokenStore tokens;
  private readonly ISessionStore sessions;
  private readonly IEmailOutboxStore outbox;
  private readonly IAccountDeletionLedger ledger;
  private readonly IEnumerable<IAccountOwnedDataPurger> purgers;
  private readonly IClock clock;
  private readonly IEmailSink email;
  private readonly ILogger logger;
  // The logger is the last parameter and optional so that direct construction in tests keeps working;
  // the host always injects a real one.
  public AccountDeletionProcessor(IAccountStore accounts, IAccountTokenStore tokens, ISessionStore sessions,
      IEmailOutboxStore outbox, IAccountDeletionLedger ledger, IEnumerable<IAccountOwnedDataPurger> purgers, IClock clock, IEmailSink email,
      ILogger<AccountDeletionProcessor>? logger = null)
  {
    this.accounts = accounts; this.tokens = tokens; this.sessions = sessions; this.outbox = outbox;
    this.ledger = ledger; this.purgers = purgers; this.clock = clock; this.email = email;
    this.logger = logger ?? NullLogger<AccountDeletionProcessor>.Instance;
  }
  public async Task ProcessDueAsync(CancellationToken cancellationToken)
  {
    const int batch = 100;
    var pending = 0;
    var total = 0;
    var attempted = new HashSet<Guid>();
    // ListDeletionDueAsync returns oldest request first. A batch that keeps failing stays at the head of
    // that order, so one batch is not enough: page until no unattempted account is left, otherwise the
    // accounts behind a failing batch would never be erased within the FR-ACC-03 24 h bound
    // (external review, major).
    while (true)
    {
      var due = await accounts.ListDeletionDueAsync(clock.UtcNow, batch + attempted.Count, cancellationToken);
      var next = due.Where(account => !attempted.Contains(account.Id)).Take(batch).ToArray();
      if (next.Length == 0) break;
      total += next.Length;
      await PurgeBatchAsync(next, attempted, count => pending += count, cancellationToken);
    }
    if (pending > 0)
    {
      // Counts only: the erasure SLA must be visible without putting an address or any account content in a log.
      DeletionLogs.PurgePending(logger, pending, total);
      throw new InvalidOperationException("Account purge remains pending");
    }
  }

  private async Task PurgeBatchAsync(IReadOnlyList<AccountRecord> due, HashSet<Guid> attempted,
      Action<int> reportPending, CancellationToken cancellationToken)
  {
    var pending = 0;
    foreach (var account in due)
    {
      attempted.Add(account.Id);
      try
      {
        await ledger.RecordAccountAsync(account.Id, account.DeletionRequestedAt!.Value, cancellationToken);
        await NotifyBestEffortAsync(account, cancellationToken);
        await EraseOwnedDataAsync(account.Id, cancellationToken);
      }
      catch (Exception error) when (error is not OperationCanceledException) { pending++; }
    }
    reportPending(pending);
  }

  public async Task<bool> EraseAsync(Guid accountId, CancellationToken cancellationToken)
  {
    var existed = await accounts.FindByIdAsync(accountId, cancellationToken) is not null;
    await EraseOwnedDataAsync(accountId, cancellationToken);
    return existed;
  }

  /// <summary>ADR-039 §2 order: photos and resume data through the purgers, then tokens, sessions, outbox and the user record. Idempotent.</summary>
  private async Task EraseOwnedDataAsync(Guid accountId, CancellationToken cancellationToken)
  {
    foreach (var purger in purgers) await purger.PurgeAsync(accountId, cancellationToken);
    await sessions.DeleteForAccountAsync(accountId, cancellationToken);
    await tokens.DeleteForAccountAsync(accountId, cancellationToken);
    await outbox.DeleteForAccountAsync(accountId, cancellationToken);
    await accounts.DeleteAsync(accountId, cancellationToken);
  }

  /// <summary>
  /// FR-ACC-03 / ADR-039 §2 erasure must never be blocked by mail delivery, so the confirmation notice is
  /// best effort: a failed send is recorded as a content-free event and the purge continues.
  /// </summary>
  private async Task NotifyBestEffortAsync(AccountRecord account, CancellationToken cancellationToken)
  {
    try
    {
      await email.SendAsync(new AccountEmail(account.Email, "Account deletion requested", "Your account deletion was requested."), cancellationToken);
    }
    catch (Exception error) when (error is not OperationCanceledException)
    {
      DeletionLogs.NoticeUndelivered(logger);
    }
  }
}

/// <summary>
/// Content-free deletion telemetry. Only counts are emitted: no address, token or account content may reach a log
/// (`.claude/rules/03-security-privacy.md`). LoggerMessage delegates satisfy CA1848.
/// </summary>
internal static class DeletionLogs
{
  private static readonly Action<ILogger, int, int, Exception?> PurgePendingMessage =
      LoggerMessage.Define<int, int>(LogLevel.Warning, new EventId(10),
        "account_purge_pending {PendingCount} of {DueCount} due account purges did not complete");
  private static readonly Action<ILogger, Exception?> NoticeUndeliveredMessage =
      LoggerMessage.Define(LogLevel.Warning, new EventId(11),
        "account_deletion_notice_undelivered the deletion notice could not be sent; the account purge continues");
  public static void PurgePending(ILogger logger, int pending, int due) => PurgePendingMessage(logger, pending, due, null);
  public static void NoticeUndelivered(ILogger logger) => NoticeUndeliveredMessage(logger, null);
}

public sealed class AccountEmailWorker : BackgroundService
{
  private readonly IServiceProvider services;
  public AccountEmailWorker(IServiceProvider services) => this.services = services;
  protected override async Task ExecuteAsync(CancellationToken stoppingToken)
  {
    using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
    while (await timer.WaitForNextTickAsync(stoppingToken))
    {
      using var scope = services.CreateScope();
      try { await scope.ServiceProvider.GetRequiredService<IAccountEmailDispatcher>().DispatchAvailableAsync(stoppingToken); }
      catch (Exception error) when (error is not OperationCanceledException) { }
    }
  }
}
