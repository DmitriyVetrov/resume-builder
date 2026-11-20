# P13 Architecture Plan — Reliability, Security & Data Lifecycle

- Operator session, ADR-051, branch `phase/P13`, 2026-11-12. AGENT-WORKFLOW sets Claude Opus, effort `high`, for this phase.
- Dependencies: P06, P07, P08 and P12 are `COMPLETED`.
- Contract: `contracts/openapi/openapi.yaml` 1.0.0, frozen by P02. **No contract change** (step 2 skipped, DD-P13-01). The archive is assembled in the browser from `exportAccountData`, `getPhotoMaster` and `getPhotoRendition` (ADR-039 §6, ADR-010 §5). The jobs and the reconciliation are server-internal.
- ADRs: no new ADR. ADR-039 gets a dated "P13 amendment" (DD-P13-04, DD-P13-05). No `OPEN` or `SOURCE-OPEN` register row touches this phase.
- Decisions: [decisions.md](../decisions.md). Acceptance: [acceptance-criteria.md](../acceptance-criteria.md). Threat-model re-review: [threat-model-review.md](threat-model-review.md) (written at step 7).

## Scope

| Source | P13 responsibility | Acceptance |
|---|---|---|
| FR-LIB-04, D-04, ADR-016, ADR-039 §3, DD-P07-03 | Hourly purge of expired trash on the two-phase purge path | AC-P13-01 |
| ADR-007 ("P13 adds the lease-based job runner") | Scheduled jobs run under a Mongo lease: one run per period across replicas | AC-P13-02 |
| FR-ACC-03, ADR-039 §2 and Consequences | Aggregate deletion: an account with resumes, trash, photos, snapshots and keys is gone from live stores ≤ 24 h | AC-P13-03 |
| ADR-039 §4 steps 1–6, DD-P01-34, T-ID-09, P01 m-10 | Restore reconciliation with one entry point, idempotent | AC-P13-04 |
| NFR-10, ADR-039 §4, ADR-004 | Automated restore drill over the five deletion cases plus the trashed-resume-with-photo case | AC-P13-05 |
| NFR-10 (RPO ≤ 1 min, daily backups 30 days), ADR-037 | Application half of RPO: every acknowledged write is a majority write; backup policy in the runbook for P15 | AC-P13-06 |
| NFR-08, T-EP-*, T-SP-* | Contract-driven authorization matrix over every operation | AC-P13-07 |
| NFR-08, T-TA-04, T-ID-04, T-DS-03, ADR-009 §8 | Upload abuse: bombs, truncation, disguised types, oversize, time bound, metadata | AC-P13-08 |
| NFR-13, T-ID-05, F-BE-5 | Log PII scan over a canary journey through every endpoint and job | AC-P13-09 |
| NFR-13, ADR-034 ("delivery-failure metrics") | Production log filters let the content-free operational events through | AC-P13-10 |
| NFR-08, NFR-09, DD-P11-12 | HTTPS-only signals and web image hardening: CSP, framing, sniffing, referrer, HSTS, asset caching | AC-P13-11 |
| P04 review i-2 | Trusted proxy networks (CIDR) for the ingress | AC-P13-12 |
| P10 carry-in | Cold-start 403 on first sign-up: reproduce, fix | AC-P13-13 |
| FR-ACC-04, ADR-039 §6, DD-P01-36, P12 carry-in | The complete data archive: JSON, photo masters, PDF and TXT, batches, progress, cancel, partial manifest | AC-P13-14 |
| NFR-10, ADR-037 ("P13 tests recovery, replay"), ADR-029, P08 carry-in | Fault injection against the real API and a real Mongo outage | AC-P13-15 |
| NFR-09, D-20, ADR-012 | EU residency: no third-party origin reachable, no outbound processor in code, residency checks in the runbook | AC-P13-16 |
| ADR-039 §4, ADR-036 (key rotation), ADR-012, ADR-042 | Operations runbook: restore and reconciliation, key rotation, residency, backup and log retention | AC-P13-17 |
| NFR-06, FR-EDT-07, §3.2 | The archive UI is accessible; nothing excluded is built | AC-P13-18 |

**Out of scope, with the owner.** Production backup policy, ingress HTTPS redirect, Log Analytics retention, Key Vault key ring and go-live residency evidence (P15, ADR-012 register row). Shared rate counters across replicas (P15, DD-P13-10). Cross-browser real-stack journeys (P14). Load tests at production scale (P15, NFR-11).

## Component boundaries

**Backend, Infrastructure.**
- `MongoJobLease` (`job_leases` collection, `_id` = job name): `TryAcquireAsync(name, holder, now, duration)` is one `findOneAndUpdate` that succeeds when no lease exists, the lease expired, or the holder already owns it. The lease is not released after a run, so it also spaces runs across replicas (DD-P13-03).
- `ScheduledJobWorker` (one hosted service per job): tick → lease → run the job in a scope → swallow and count failures. Replaces the bodies of `AccountDeletionWorker` and `ResumeLifecycleWorker`; adds `trash-expiry` (hourly). `AccountEmailWorker` keeps its per-message claims (they already lease).
- `TrashExpiryJob`: `IResumeStore.ListTrashDueAsync(now, limit)` → per resume `RequestPurge` with a fresh key (conditional replace on the version) → `IResumeLifecycle.FinishPurgeAsync`. A lost race (the user restored it) skips the resume. Pages past failing resumes like the other jobs.
- `RestoreReconciliation`: ADR-039 §4 steps 1–6, reading the ledger from the blob copy (`IDeletionLedgerSource`), reusing the account purgers and `IResumeLifecycle`, plus three store additions: list resumes referencing a photo ID and clear that photo, delete snapshots expired at `now`, list resume photo references for the sweep; and `IPhotoStorage.ListOwnersAsync`/`ListPhotosAsync` for the sweep. Returns counts.
- `OperationsCommand.TryRunAsync(app, args)`: `reconcile-restore` runs the reconciliation, writes a counts-only summary, exits 0 or 1, and never starts the hosted workers (DD-P13-04).

**Backend, Api.** Log filters for the operational categories (DD-P13-21). HSTS in Production (DD-P13-19). `ReverseProxy:TrustedNetworks` CIDR list (DD-P13-20). The command dispatch before `app.Run()`.

**Frontend.**
- `shared/lib/zip.ts`: a store-only ZIP writer (CRC-32, local headers, central directory, UTF-8 names), returning a `Blob` (DD-P13-11).
- `features/account/archive.ts`: `buildArchive({ signal, onProgress })` → `{ blob, fileName, manifest }`. Reads `/account/data-export`, then per resume, one at a time: photo master and rendition, layout with `loadRuntime`, `runtime.writePdf`, `loadTextSerializer`. Failures go to the manifest with a code and a content-free `export_failed` event with an existing code (no allow-list change).
- `AccountSettings.tsx`: "Download your data" replaces "Export account data (JSON)": re-authenticate, then a progress region with "Preparing n of N" and Cancel; the status names the file and any missing PDF.
- `shared/api/client.ts`: a single in-flight CSRF bootstrap shared with the session provider, and one automatic retry of a mutation that the server rejected with `csrf_token_invalid` (DD-P13-17).

**Web image.** `frontend/nginx.conf` replaces the `printf` in the Dockerfile; it adds the security headers and the cache headers. `frontend/vite.config.ts` gets `preview.headers` with the same CSP, so every fixture E2E test runs under it (DD-P13-18). The owner's `server.proxy` block stays as is.

**Docs.** `docs/operations/runbook.md` (new). ADR-039 P13 amendment.

## Key semantics

- **Trash expiry** is due when `purgeAt ≤ now`, `purgeRequestedAt` is absent. It writes the `resume` and `photo` ledger entries in both stores before any blob or row goes (existing `FinishPurgeAsync`).
- **Reconciliation order** is ADR-039 §4: load ledger → accounts → resumes → photos → due expiries → orphan sweep. "Live" means any resume in the restored database, active or trashed; a photo in `pendingPhotoRemovals` counts as referenced, so the lifecycle worker finishes it with its own ledger entries (DD-P13-05). A second run finds nothing to do.
- **Archive bytes**: the PDF of a resume equals the one-click export of the same version, settings, engine and fonts (ADR-010 §7), with the stored `updatedAt`. No snapshot is taken (DD-P13-16).
- **Leases** are owned by `<machine>/<process id>/<random>`, last one period, and are taken over after expiry.

## UI

"Your data" in Account settings: one secondary button "Download your data", disabled with the existing reason when the address is unverified. After re-authentication the dialog closes and the section shows a `role="status"` region: "Preparing your archive: 3 of 12 resumes", a determinate progress bar, and a Cancel button that receives focus. On finish: "Downloaded resumiser-data-2026-11-12.zip." plus "2 PDFs could not be created and are listed in manifest.json." when partial. On cancel: "Archive cancelled. Nothing was downloaded." Theme tokens and `shared/ui` primitives only; `Progress` is added through the shadcn CLI if missing.

## Risks

| Risk | Mitigation |
|---|---|
| The trash job purges a resume the user just restored | Conditional replace on the read version; a lost race skips (L03) |
| Reconciliation deletes photos of trashed resumes | "Live" includes trashed; the drill has a trashed resume with a photo (D02) |
| The drill passes against a mock, not a restore | Real `mongodump`/`mongorestore` inside the Mongo container, real blob re-upload, ledger container left out of the restore |
| CSP breaks a browser feature (fonts, blobs, PDFKit) | `vite preview` serves the same policy, so all three browsers run the fixture suite under it; a CSP-violation listener fails the test |
| The CSRF diagnosis is wrong | Reproduce first (red) with a deterministic interleaving; if it does not reproduce, record that and keep only the bootstrap single-flight |
| A 1 GB archive in memory | One resume at a time; parts are `Blob`s, which browsers spill to disk; the 200-resume worst case is ≈ 1.2 GB < 4 GB, so no ZIP64 |
| Job tests flaky on real time | Fake clock everywhere; TTL monitor races avoided by timestamps ahead of real time |

## Slices and test budget

| Slice | Contents | Tests (approx.) |
|---|---|---|
| S1 Jobs | lease, worker, trash expiry | backend 6 |
| S2 Deletion and restore | aggregate deletion, reconciliation, command, drill, RPO profiler check | backend 7 |
| S3 Observability | log filters, canary journey | backend 3 |
| S4 Security | authorization matrix, upload abuse, HSTS, trusted networks, Mongo outage | backend 8 |
| S5 CSRF | client single-flight and retry, cold host concurrency | frontend 3, backend 1 |
| S6 Archive | zip writer, archive builder, UI | frontend 10, fixture E2E 3 |
| S7 Web hardening | nginx headers, CSP under E2E | web image check 1 script, fixture E2E 1 |
| S8 Real-stack fault injection | lost ack, 5xx burst, archive against the real API | real-stack E2E 3 |

## Task list

1. Step 1 artifacts (this file, decisions, acceptance criteria). Step 2 skipped.
2. Step 3: test plan.
3. Step 4: `P13JobTests.cs`, `P13RestoreTests.cs`, `P13SecurityTests.cs`, `P13ObservabilityTests.cs`; `zip.test.ts`, `archive.test.ts`, `account-archive.test.tsx`, `client.csrf.test.ts`; `tests/e2e/data-lifecycle.spec.ts`; `tests/e2e/real-stack/reliability-acceptance.spec.ts`; `docs/phases/P13/tests/web-image-check.sh`; `suite.cmd`. Red evidence.
4. Step 5: S1 → S2 → S3 → S4 → S5 → S6 → S7, narrow runs after each; the full suite at the end. Runbook and ADR-039 amendment.
5. Steps 6–8 per AGENT-WORKFLOW.

## Candidate Codex worker tasks (ADR-051 Amendment 3)

One candidate, the kind the amendment names for P13: **P13-CX-01, additive upload abuse tests** (AC-P13-08) in a new `P13UploadAbuseTests.cs`, against the existing P07 harness. It is additive and needs no design. Whether it is dispatched is decided at step 4 and recorded in `decisions.md` (DD-P13-23); if not, the operator writes it.

## Allowed paths

- `docs/phases/P13/**`
- `docs/operations/**`
- `docs/blueprint/decisions/ADR-039-data-retention-and-deletion.md`
- `backend/src/ResumeBuilder.Api/**`
- `backend/src/ResumeBuilder.Application/**`
- `backend/src/ResumeBuilder.Infrastructure/**`
- `backend/tests/ResumeBuilder.Api.Tests/**`
- `backend/tests/ResumeBuilder.Architecture.Tests/**`
- `frontend/src/**`
- `frontend/Dockerfile`
- `frontend/nginx.conf`
- `frontend/vite.config.ts`
- `frontend/README.md`
- `frontend/package.json`
- `frontend/package-lock.json`
- `tests/e2e/**`

`frontend/package.json` and its lock are listed only for a shadcn component the CLI may add; no new runtime dependency is planned (DD-P13-11). `frontend/vite.config.ts` is extended with `preview.headers` only; the owner's `server.proxy` block is kept (DD-P13-18).
