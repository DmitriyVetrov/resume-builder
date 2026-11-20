# ADR-039 — Data retention and deletion schedule

- Status: **Accepted** (`DELEGATED-DEFAULT`, ADR-035 A-4). This is a new register ID; it answers P00 conflicts SC-08 and SC-09.
- Decider: Solution Architect (delegated, ADR-035)
- Amended: 2026-11-02, P01 review fix loop 1 (code-review M-2: the ledger covers permanently purged resumes and deleted photos, and survives the restore; m-1: FR-ACC-04 reading; decisions.md DD-P01-34, DD-P01-36); 2026-11-03, P06 phase allocation (DD-P06-05, below)
- Date: 2026-11-02 (P01, decisions.md DD-P01-14)
- Source IDs: FR-ACC-03 (delete within 24 h), FR-ACC-04, FR-LIB-04 (trash, D-04), FR-PER-05 (30-day history), NFR-09 (GDPR), NFR-10 (daily backups kept 30 days), NFR-13; ADR-009, ADR-016

## Context

Several requirements set retention periods that interact: trash 30 days, history 30 days, backups 30 days, and account deletion within 24 h. SC-08 asked how deletion treats backups, trash, snapshots and exports. SC-09 asked whether exports are stored at all; ADR-009 and ADR-010 say they are not.

## Decision

1. **Retention table:**

| Data | Live retention | Deleted by |
|---|---|---|
| Account (user record) | until account deletion | account purge job (≤ 24 h after the confirmed request) |
| Resume (active) | until the user deletes it | user action → trash |
| Resume (trash) | **30 days** (ADR-016) | trash purge job (runs hourly), or "Delete permanently" in the trash |
| Photo blobs | as long as their resume or photo | resume purge, photo removal, account purge |
| Snapshots (FR-PER-05) | **30 days** rolling | TTL index; resume purge; account purge |
| Exports (PDF/TXT) | **not stored** | — |
| Sessions | ≤ 30 days absolute (ADR-036) | TTL; logout; reset; account deletion |
| Verification and reset tokens | until expiry (24 h / 1 h) or use | TTL |
| Idempotency records | 24 h | TTL |
| E-mail outbox | until sent, then 7 days (metadata only, no body after sending) | TTL |
| Application logs and security logs (IDs, IP addresses; never content) | **30 days** | Log workspace retention |
| Deletion ledger (random IDs and timestamps only: erased accounts, permanently purged resumes, deleted photos; §4) | **35 days** (longer than the 30-day backup window) | TTL; lifecycle rule on the blob copy |
| Backups (database and blobs) | **30 days** (NFR-10) | backup policy expiry |

2. **Account deletion flow (FR-ACC-03):**
   - The user re-authenticates and confirms.
   - Sessions are revoked immediately and login is disabled (`deletionRequestedAt`).
   - Within 24 h, the purge job first writes an `account` entry (`userId`, `recordedAt`) to the deletion ledger (§4), then hard-deletes, in order:
     - the photo blob prefix `u/{ownerId}/`;
     - snapshots, resumes (active and trash) and idempotency records;
     - tokens, sessions and outbox entries;
     - the user record.
   - The job is idempotent and resumable, so a crash re-runs safely.
   - A confirmation e-mail is sent before the address is erased.
3. **Trash, permanent deletion and photo removal.** Every action that removes user data from the live stores, other than expiry by time, writes a ledger entry **before** it deletes anything:
   - Trash (ADR-016): restore within 30 days.
   - A resume purge, by the hourly job after 30 days or by "Delete permanently" at any time, writes a `resume` entry (`resumeId`, `ownerId`, `recordedAt`), then deletes the resume, its snapshots and its photo blobs.
   - Removing or replacing a photo (FR-PHO-02) writes a `photo` entry (`photoId`, `ownerId`, key prefix `u/{ownerId}/p/{photoId}/`, `recordedAt`), then deletes the blobs.
   - Snapshot expiry needs no entry, because it depends only on `createdAt` and is re-applied by step 5 below.
4. **Backups:**
   - Deleted data is not edited out of backups. It disappears when the backup expires (≤ 30 days).
   - **The ledger survives the restore it is applied to.** The purge step writes each entry to the `deletion_ledger` collection and appends it to a separate private, append-only blob container (`ledger/`, with its own 35-day lifecycle rule, outside the photo backup and every restore). Both writes succeed before anything is deleted; the step retries until they do. A restore uses the union of the blob copy and, when the old cluster is still reachable, its collection.
   - **Every restore** (PITR or snapshot, of the database or of the photo container) runs this idempotent reconciliation before traffic resumes:
     1. load the ledger as above into the restored database;
     2. `account` entries: run the account purge (§2) for each user ID;
     3. `resume` entries: delete the resume, its snapshots and the photo blobs it references;
     4. `photo` entries: delete the blobs under the prefix, and clear `header.photo` in any restored resume that still references that photo ID;
     5. due expiries: trash purges with `deletedAt` + 30 days ≤ now (each writes its `resume` entry) and snapshots older than 30 days, deleted explicitly rather than left to the TTL monitor;
     6. orphan sweep: delete every blob under `u/{ownerId}/p/{photoId}/` whose photo ID no live resume references, and every `u/{ownerId}/` prefix whose user does not exist. This also covers a database and a photo container restored to different points in time.
   - P13 makes this a runbook step and an automated restore drill. The drill restores to a point before each of these deletions and asserts that each stays gone: an erased account, a resume deleted permanently from the trash before its 30 days, a resume purged by the job, a removed photo and a replaced photo.
   - The privacy notice (P15) states the backup window.
5. **Logs** never contain content (`.claude/rules/03-security-privacy.md`). They contain IDs, error codes and, in security logs, IP addresses. They are kept 30 days in the EU (ADR-012).
6. **Data export (FR-ACC-04):** the API returns the user's account data (e-mail, created and verified timestamps) plus every resume, active and in trash, as canonical JSON with links to photo master files. The browser adds the PDF and TXT of each resume's **current version, regenerated with the current engine and fonts** (DD-P01-36), and zips one archive (ADR-010 §5). P13 builds the archive in batches with progress and cancel; the PDF part may be partial, and missing PDFs are listed in the archive. The response is `Cache-Control: no-store`, and the server keeps nothing.

## Alternatives considered

- **Scrubbing individual users out of backups:** not feasible with managed PITR and error-prone. Expiry plus ledger re-apply is the established GDPR practice. Rejected.
- **Keeping trash after account deletion:** contradicts FR-ACC-03. Rejected.
- **Storing the last export for FR-ACC-04:** stores extra personal data. Regenerating the current version meets FR-ACC-04 (DD-P01-36). It gives the same bytes as an earlier download only while the version, settings, engine and fonts are unchanged (NFR-14). Rejected.

## Rationale

This meets FR-ACC-03's 24 h on live data, keeps NFR-10 backups, and makes restores GDPR-safe. TTL indexes make most of the expiry automatic and testable.

## Consequences

- P02: endpoints for the deletion request, data export, trash list, restore and permanent delete.
- P07: the trash; "Delete permanently" and photo removal or replacement write their ledger entries through the Lifecycle port from the first release.
- P06: the account-deletion request, immediate session revocation/login denial, and retryable purge of all P06-owned account data within 24 h. The account ledger entry is written to both Mongo and the separate private Blob copy before any destructive action (§4). The purge exposes a lifecycle port for later data stores.
- P07: before enabling resume/photo persistence, extend the P06 account purge through that lifecycle port for all owned resumes, trash, snapshots, photos and idempotency data, and record permanent resume/photo removals in both ledger stores.
- P13: full restore reconciliation (§4 steps 1–6), its drill, log retention and aggregate deletion tests (an account with resumes, photos and snapshots is gone from live stores ≤ 24 h). It also builds the complete browser archive (§6). P06's account-only purge test is not aggregate deletion evidence.
- P15: privacy notice text and backup policy configuration.

## Security/privacy impact

This implements GDPR storage limitation and erasure (Art. 5(1)(e), Art. 17) within NFR-09's EU residency. The ledger stores only random IDs (user, resume, photo), key prefixes built from them and timestamps: no content, e-mail addresses or file names. It cannot re-create erased data, and it keeps user-requested erasure (Art. 17) effective across restores within the backup window.

## Owner and date

Solution Architect (delegated, ADR-035), 2026-11-02.

## P06 amendment — phase allocation (2026-11-03)

`DELEGATED-DEFAULT` DD-P06-05 advances the account-only purge job and dual ledger writes from P13 to P06. Alternatives were to leave the P06 delete endpoint as a scheduler without an active worker until P13, or to claim full future aggregate deletion in P06; both would make FR-ACC-03's 24 h promise misleading between phases. The retention periods, deletion order, dual-write-before-delete rule and restore reconciliation design above do not change. P07 extends the active purge before storing resumes/photos; P13 retains the full aggregate and restore proof. Decider: Solution Architect (delegated, ADR-035).

## P13 amendment — reconciliation entry point and "live" (2026-11-12)

`DELEGATED-DEFAULT`, decided under ADR-051 S-5 in P13 (`docs/phases/P13/decisions.md` DD-P13-02 to DD-P13-06). The retention table, the deletion order and the dual-write-before-delete rule do not change.

- **Entry point (DD-P13-04).** Reconciliation runs as `dotnet ResumeBuilder.Api.dll reconcile-restore`: the production image and configuration, no HTTP endpoint, no contract change. It runs §4 steps 1–6, logs a counts-only summary, exits 0 or 1, and never starts Kestrel or a hosted job. The runbook (`docs/operations/runbook.md` §2) runs it with traffic off.
- **Step 1.** The ledger is the union of the blob copy and whatever the restored collection holds; entries only the blob has are written back to the collection.
- **Step 4 (DD-P13-06).** "Clear `header.photo`" means: the resume's `photo` is set to null and its version moves, conditional on the photo ID, with no pending removal (the blobs are gone). A tab holding the old version gets 412 and follows ADR-029.
- **Step 6, "live" (DD-P13-05, closes P01 review m-10).** A live resume is any resume document in the restored database, active or trashed. A photo ID referenced as the current photo or as a pending removal counts as referenced; the lifecycle job finishes pending removals with their own ledger entries.
- **Hourly purge (DD-P13-02, DD-P13-03).** The trash purge runs on the two-phase purge of DD-P07-10 with a conditional first phase, so a restore that lands first wins. It and the other lifecycle jobs run under a MongoDB lease, once per period across replicas.
- **Drill.** The automated drill is `P13RestoreTests.D02`: `mongodump`/`mongorestore` and a photo-container restore over all five cases of §4 plus a trashed resume with a photo.
