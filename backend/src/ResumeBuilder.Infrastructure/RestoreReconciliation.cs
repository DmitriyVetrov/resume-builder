using Microsoft.Extensions.Logging;
using ResumeBuilder.Application.Accounts;
using ResumeBuilder.Application.Resumes;

namespace ResumeBuilder.Infrastructure;

/// <summary>Counts only: what one reconciliation run changed (ADR-039 §4).</summary>
public sealed record ReconciliationSummary(
  int LedgerEntriesLoaded, int AccountsErased, int ResumesPurged, int PhotosDeleted, int PhotoReferencesCleared,
  int TrashPurged, long SnapshotsDeleted, int OrphanPhotosDeleted, int OrphanOwnersDeleted)
{
  public bool ChangedNothing => AccountsErased == 0 && ResumesPurged == 0 && PhotosDeleted == 0 && PhotoReferencesCleared == 0
    && TrashPurged == 0 && SnapshotsDeleted == 0 && OrphanPhotosDeleted == 0 && OrphanOwnersDeleted == 0 && LedgerEntriesLoaded == 0;
}

/// <summary>The blob inventory the orphan sweep needs. Keys are `u/{ownerId}/p/{photoId}/…` (ADR-009 §4).</summary>
public interface IPhotoInventory
{
  Task<IReadOnlyList<Guid>> ListOwnersAsync(CancellationToken cancellationToken);
  Task<IReadOnlyList<Guid>> ListPhotosAsync(Guid ownerId, CancellationToken cancellationToken);
}

/// <summary>ADR-039 §4: run after every restore, before traffic resumes. Idempotent: a second run changes nothing.</summary>
public sealed class RestoreReconciliation(
  DualAccountDeletionLedger ledger, IAccountDeletionProcessor accounts, IAccountStore accountStore, IResumeStore resumes,
  ISnapshotStore snapshots, IPhotoStorage photos, IPhotoInventory inventory, IResumeLifecycle lifecycle, TrashExpiryJob trash,
  IClock clock, ILogger<RestoreReconciliation> logger)
{
  public async Task<ReconciliationSummary> RunAsync(CancellationToken cancellationToken)
  {
    var now = clock.UtcNow;
    // 1. The ledger survives the restore: its blob copy is outside every restore.
    var (entries, loaded) = await ledger.LoadAllAsync(cancellationToken);

    // 2. Erased accounts.
    var accountsErased = 0;
    foreach (var entry in entries.Where(entry => entry.Kind == LedgerKind.Account))
      if (await accounts.EraseAsync(entry.Id, cancellationToken)) accountsErased++;

    // 3. Purged resumes: the resume, its snapshots and the photos it references.
    var resumesPurged = 0;
    foreach (var entry in entries.Where(entry => entry.Kind == LedgerKind.Resume))
    {
      if (await resumes.FindIncludingPurgingAsync(entry.OwnerId, entry.Id, cancellationToken) is { } resume)
      {
        await lifecycle.FinishPurgeAsync(resume, cancellationToken);
        resumesPurged++;
      }
      else await snapshots.DeleteForResumeAsync(entry.OwnerId, entry.Id, cancellationToken);
    }

    // 4. Deleted photos: the blobs, and any restored resume that still names them.
    var photosDeleted = 0;
    var referencesCleared = 0;
    var stored = new Dictionary<Guid, IReadOnlyList<Guid>>();
    foreach (var entry in entries.Where(entry => entry.Kind == LedgerKind.Photo))
    {
      if (!stored.TryGetValue(entry.OwnerId, out var present)) stored[entry.OwnerId] = present = await inventory.ListPhotosAsync(entry.OwnerId, cancellationToken);
      if (present.Contains(entry.Id))
      {
        await photos.DeleteAsync(entry.OwnerId, entry.Id, cancellationToken);
        photosDeleted++;
      }
      referencesCleared += await resumes.ClearPhotoReferencesAsync(entry.OwnerId, entry.Id, cancellationToken);
    }

    // 5. Expiries due by now, applied explicitly rather than left to the TTL monitor.
    var trashPurged = await trash.PurgeDueAsync(cancellationToken);
    var snapshotsDeleted = await snapshots.DeleteExpiredAsync(now, cancellationToken);

    // 6. Orphans: an owner with no account, a photo no resume of the owner references (active or trashed, DD-P13-05).
    var orphanOwners = 0;
    var orphanPhotos = 0;
    foreach (var owner in await inventory.ListOwnersAsync(cancellationToken))
    {
      if (await accountStore.FindByIdAsync(owner, cancellationToken) is null)
      {
        await photos.DeleteOwnerAsync(owner, cancellationToken);
        orphanOwners++;
        continue;
      }
      var referenced = await resumes.ListPhotoReferencesAsync(owner, cancellationToken);
      foreach (var photo in await inventory.ListPhotosAsync(owner, cancellationToken))
      {
        if (referenced.Contains(photo)) continue;
        await photos.DeleteAsync(owner, photo, cancellationToken);
        orphanPhotos++;
      }
    }

    var summary = new ReconciliationSummary(loaded, accountsErased, resumesPurged, photosDeleted, referencesCleared, trashPurged, snapshotsDeleted, orphanPhotos, orphanOwners);
    ReconciliationLogs.Done(logger, summary);
    return summary;
  }
}

/// <summary>Counts only (rule 03). CA1848-compliant.</summary>
internal static class ReconciliationLogs
{
  private static readonly Action<ILogger, string, Exception?> DoneMessage =
    LoggerMessage.Define<string>(LogLevel.Information, new EventId(50), "restore_reconciled {Counts}");

  public static void Done(ILogger logger, ReconciliationSummary summary) => DoneMessage(logger, string.Create(System.Globalization.CultureInfo.InvariantCulture,
    $"ledger_loaded={summary.LedgerEntriesLoaded} accounts_erased={summary.AccountsErased} resumes_purged={summary.ResumesPurged} photos_deleted={summary.PhotosDeleted} photo_references_cleared={summary.PhotoReferencesCleared} trash_purged={summary.TrashPurged} snapshots_deleted={summary.SnapshotsDeleted} orphan_photos={summary.OrphanPhotosDeleted} orphan_owners={summary.OrphanOwnersDeleted}"), null);
}
