# P13 Test Plan

Each acceptance criterion maps to executable checks before any implementation. Levels: backend integration (xUnit v3, `WebApplicationFactory`, Testcontainers Mongo replica set and Azurite, ADR-041), backend architecture (source scan), frontend unit and component (Vitest, jsdom, RTL), fixture E2E (Playwright, three browsers, mocked API on `vite preview`), web image (shell script against the built image), and real-stack E2E (step 7 only, as in P11 and P12). Time is a fake clock (`P07Clock`) wherever a job or a TTL matters.

## Acceptance map

| AC | Positive | Negative | Level |
|---|---|---|---|
| AC-P13-01 | J03 | J04, J05, J06 | backend |
| AC-P13-02 | J01, J02 | J01 (second holder refused) | backend |
| AC-P13-03 | D01 | D01 (other account, login refused before +24 h) | backend |
| AC-P13-04 | D03, D04 | D03 (second run is empty), D04 (unknown argument not handled) | backend |
| AC-P13-05 | D02 | D02 (survivors keep their blobs) | backend |
| AC-P13-06 | D05 | D05 (any `w` below majority fails) | backend; runbook review |
| AC-P13-07 | S01, S02, S03, S04 | S01 (unclassified operation fails) | backend |
| AC-P13-08 | U01–U05, P07 P02 (GPS) | all are negatives | backend |
| AC-P13-09 | O01 | — (the canary is the negative) | backend |
| AC-P13-10 | O02 | O02 (framework categories silent) | backend |
| AC-P13-11 | S05, W01, L03, C04 | S05 (no HSTS in Testing), L03 (no violation) | backend, web image, E2E, Vitest |
| AC-P13-12 | S06 | S06 (outside the network ignored) | backend |
| AC-P13-13 | C01, C02, S08 | C03 (no retry loop), S08 (forged request still 403) | Vitest, backend |
| AC-P13-14 | Z01–Z03, A01, A05, A07, UI01, L01 | A02, A03, A04, A06, UI02, UI03, L02 | Vitest, E2E, real-stack RS03 |
| AC-P13-15 | RS01, RS02, S07 | S07 (no ack during the outage) | real-stack (step 7), backend |
| AC-P13-16 | L03, AR01, existing "no external request" E2E | AR01 (an `HttpClient` in `src` fails) | E2E, architecture |
| AC-P13-17 | runbook review at step 7 | — | review |
| AC-P13-18 | L02, UI01 | §3.2 check in L02 | E2E, Vitest |

## New tests

### Backend: `backend/tests/ResumeBuilder.Api.Tests/P13JobTests.cs` (collection `P13`, own `P07Containers`)

- **J01** `MongoJobLease`: holder A acquires `trash-expiry` for 1 h; B is refused at +59 min; A re-acquires its own; B acquires at +61 min.
- **J02** Two `ScheduledJobWorker` instances (holders A, B) over one lease and a counting job: `RunOnceAsync` on both runs the job once; after the period, once more.
- **J03** Owner U has resume X trashed at t0 with a photo and a snapshot, and Y trashed at t0 + 2 d. At t0 + 30 d + 1 min `TrashExpiryJob.RunAsync` purges X only: the `resume` and `photo` ledger entries exist in the collection and the blob container, recorded before the blobs and rows went (the order-recording ledger of P07 M01); X's snapshots and photo blobs are gone; Y and an active resume are untouched.
- **J04** X is due, but the user restores it (new version) between the job's read and its write: the conditional replace loses, X stays active with its photo, and no ledger entry is written.
- **J05** Two due resumes; the ledger fails for the first. The second is purged; the first stays hidden (purge requested) for the lifecycle worker; `trash_expiry_pending 1 of 2` is logged with no ID.
- **J06** Running the job twice leaves one ledger entry per ID and no error.

### Backend: `P13RestoreTests.cs` (collection `P13`)

- **D01** Aggregate deletion through the API: user A with two active resumes (one with a photo, one with a removed photo still pending), one trashed resume with a photo, two snapshots and idempotency records; re-authenticate, `DELETE /account` → 202; login refused at once; at +24 h the deletion job (through `ScheduledJobWorker.RunOnceAsync`) leaves no row for A in `users`, `sessions`, `account_tokens`, `email_outbox`, `resumes`, `snapshots`, `idempotency` and no blob under `u/{A}/`; the `account` entry is in both ledger stores. User B's resume, snapshot and photo are untouched.
- **D02** The restore drill (DD-P13-07): seed E (an account with a photo resume), U with R1 (trashed, later deleted permanently), R2 (trashed at t0, later purged by the job), R3 (photo P1, later removed), R4 (photo P2, later replaced by P3), R5 (trashed, photo P4), R6 (active, photo P5), and a snapshot of R6. **Backup**: `mongodump --archive` of `resumebuilder` inside the Mongo container, and a copy of every blob in `photos`. **Deletions**: erase E (API plus job at +24 h), delete R1 permanently, run the trash job at t0 + 30 d + 1 min for R2, remove P1, replace P2. **Restore**: `mongorestore --drop`, wipe and re-upload `photos`; `deletion-ledger` is not touched. Plant an orphan blob for a user that does not exist and one unreferenced photo under U. **Reconcile** at t0 + 31 d. **Assert**: E's user row and blobs gone; R1 and R2 rows, snapshots and blobs gone; P1 and P2 blobs gone, and R3 and R4 have no `photo`; R6's snapshot older than 30 days at `now` gone; both planted orphans gone; R5 with P4 and R6 with P5 keep their rows and blobs.
- **D03** Reconciliation loads ledger entries from the blob copy into a `deletion_ledger` collection that lacks them; a second run reports zero for every count and changes no row or blob.
- **D04** `OperationsCommand.TryRunAsync(app, ["reconcile-restore"])` returns 0 and logs the summary; with no argument or another argument it returns `null` (not handled); no `IHostedService` was started.
- **D05** RPO, application half: Mongo profiler level 2 on `resumebuilder`, then sign-up, verify, login, create, document write, photo upload, crop, snapshot, trash, restore, purge, data export, delete account, every job and the reconciliation. Every `insert`, `update`, `delete` and `findAndModify` in `system.profile` has `writeConcern.w = "majority"` or no `writeConcern`; `getDefaultRWConcern` reports `w: majority`.

### Backend: `P13SecurityTests.cs` (collection `P13`, plus collection `P13Faults` with its own containers for S07)

- **S01** The matrix lists every `operationId` in `contracts/openapi/openapi.yaml` with a class (`public`, `session`, `owner`). A set difference in either direction fails, so a new operation must be classified.
- **S02** Anonymous: every non-public operation answers 401 (CSRF-exempt safe methods and unsafe methods with a valid anonymous CSRF pair).
- **S03** Another user's IDs: every `owner` operation answers 404 `not_found`, and the owner's resume, snapshot list and blobs are byte-identical before and after.
- **S04** After `DELETE /account`, the old session cookie answers 401 on `getSession`'s authenticated view and on every `owner` and `session` operation.
- **S05** HSTS: a host in `Production` answers `Strict-Transport-Security: max-age=31536000; includeSubDomains`; a host in `Testing` sends none.
- **S06** `ReverseProxy:TrustedNetworks=10.0.0.0/8`: a request from 10.1.2.3 with `X-Forwarded-For: 203.0.113.9` and `X-Forwarded-Proto: https` is seen with that client address and scheme; from 192.0.2.1 the headers are ignored. Observed through a test endpoint registered by the test host only.
- **S07** (`P13Faults`) Mongo paused: `/health/ready` answers 503 within 10 s and a keyed document write answers 5xx, never 2xx; after unpause the same request (same key, same body) answers 200 with version + 1, and a repeat replays the same version.
- **S08** Cold host: a host with a fresh, empty data-protection key directory receives 20 concurrent `GET /session` from 20 cookie jars, then each jar posts `/auth/login` with its own pair: none answers 403 `csrf_token_invalid`. A post with no header, and one with another jar's header, answer 403.

### Backend: `P13UploadAbuseTests.cs` (collection `P13`; candidate P13-CX-01)

- **U01** A 200-byte PNG whose IHDR claims 65 000 × 65 000 → 400 `photo_invalid` within 2 s; no blob under the owner; version unchanged.
- **U02** A JPEG whose SOF0 claims 65 000 × 65 000 → the same.
- **U03** A PNG and a JPEG truncated to half their bytes → 400 `photo_invalid`.
- **U04** An SVG and an HTML document sent as `image/png` → 415 `unsupported_media_type`.
- **U05** An empty file part → the contract's 4xx (no 2xx, no blob).

### Backend: `P13ObservabilityTests.cs` (collection `P13`)

- **O01** The canary journey of AC-P13-09 at Trace level for every category, using distinct canaries (`canary-mail-…@example.invalid`, password, document text, title, file name, a byte marker in the photo, the verification and reset tokens read from the outbox). No canary appears in any formatted message, any structured state value or any exception string.
- **O02** A host with the production filters (no test override of logging; a capture provider added after them): a failing e-mail sink, a failing purge, a failing lifecycle step, a failing trash expiry and a reconciliation each produce their event with counts only; no `Microsoft.*` or `System.*` category produces a line.

### Backend: `backend/tests/ResumeBuilder.Architecture.Tests/ArchitectureTests.cs`

- **AR01** No source file under `backend/src` mentions `HttpClient`, `IHttpClientFactory`, `AddHttpClient`, `WebRequest` or `HttpWebRequest`.

### Frontend: Vitest

- `src/shared/lib/zip.test.ts`
  - **Z01** Three entries (one UTF-8 Cyrillic name, one empty, one 70 KB) parsed by an independent reader in the test (offsets per APPNOTE, CRC by Node's `zlib.crc32`): signatures, flags (bit 11 set), method 0, sizes, CRCs, central directory count and offset, end record.
  - **Z02** No entries → a valid 22-byte end record.
  - **Z03** Same entries and date → identical bytes.
- `src/features/account/archive.test.ts` (engine and serializer mocked at the `preview-paint/runtime` seam)
  - **A01** Two resumes (active with a photo, trashed with a photo): entries `account-data.json` (bytes as received), `manifest.json`, `resumes/<id>/<name>.pdf`, `.txt`, `photo-master.jpg|png`; the PDF writer gets the rendition bytes and the stored `updatedAt`.
  - **A02** A nameless resume: no PDF or TXT; manifest `no_full_name` for both.
  - **A03** The PDF writer throws for one resume: the manifest lists it with `pdf_write`, one content-free `export_failed` event is reported, the other resume is complete.
  - **A04** Abort after the first resume: the promise rejects with `AbortError`, no further fetch starts, no archive is returned.
  - **A05** `onProgress` is called with (0, N) and then (n, N) after each resume.
  - **A06** `/account/data-export` fails: the promise rejects with the `ApiError`; no photo fetch.
  - **A07** A photo master that fails to load is listed as `photo_load`; the PDF still uses the rendition when that loads.
- `src/features/account/account-archive.test.tsx`
  - **UI01** Verified user: "Download your data" → password → re-auth → status "Preparing your archive: 1 of 2 resumes" → `saveFile` with `resumiser-data-YYYY-MM-DD.zip` and `application/zip` → "Downloaded …".
  - **UI02** Cancel while preparing: focus is on Cancel; after it, "Archive cancelled. Nothing was downloaded." and `saveFile` is never called.
  - **UI03** Partial: "1 PDF could not be created and is listed in manifest.json."; unverified: the button is disabled with its reason.
- `src/shared/api/client.csrf.test.ts`
  - **C01** Reproduction: a mutation is sent with pair 1; a slower bootstrap response then installs pair 2; the server answers 403 `csrf_token_invalid`. The call resolves with the retried response, sent with pair 2. (Red: it throws today.)
  - **C02** Two concurrent unsafe requests with no CSRF cookie start one `GET /session`.
  - **C03** A second `csrf_token_invalid` is thrown to the caller; exactly two attempts.
- `src/app/security-headers.test.ts`
  - **C04** The CSP in `frontend/nginx.conf` and in `vite.config.ts` `preview.headers` are the same string, equal to DD-P13-18.

### Fixture E2E: `tests/e2e/data-lifecycle.spec.ts` (added to `testMatch`)

- **L01** Mocked API with three resumes (active with a photo, trashed with a photo, nameless): Download your data → re-auth → one download; the ZIP is parsed in Node with `zlib.crc32`; the PDF of the active resume equals the bytes the library's Export PDF gives for it; the manifest lists `no_full_name` twice.
- **L02** Cancel downloads nothing; axe has no violation in the idle, preparing and done states; no horizontal overflow at 390 px; keyboard only (Tab to the button, Enter, type, Enter, Tab to Cancel); no "e-mail" or "share" control.
- **L03** `/` is served with the DD-P13-18 CSP; a `securitypolicyviolation` listener installed before load sees none through library, editor, preview, PDF export and archive; no request leaves `127.0.0.1`.

### Web image: `docs/phases/P13/tests/web-image-check.sh`

- **W01** Build the image; `/` and `/index.html` carry the CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, HSTS and `Cache-Control: no-cache`; `/assets/<hash>.js` carries `Cache-Control: public, max-age=31536000, immutable` and still gzip; a deep link (`/resumes/x`) falls back to `index.html` with the same headers.

### Real-stack E2E: `tests/e2e/real-stack/reliability-acceptance.spec.ts` (step 7)

- **RS01** Type in the editor; the first document `PUT` is forwarded to the real API with `route.fetch()` and its response is dropped; the client retries with the same `Idempotency-Key`; the status reaches Saved without a conflict notice and the server's version rose by exactly one for that edit.
- **RS02** Five 503 answers in a row for the document `PUT`, then pass-through: the status never shows Saved during the burst, the edit is kept, and after recovery the stored document has it.
- **RS03** Download your data against the real API with a real photo: `unzip -t` passes, the master equals `getPhotoMaster`'s bytes, and `pdftotext` of the PDF holds the full name.

## Characterisation

Some checks pin behaviour that already exists (S02, S03, U03, U04, U05, AR01, parts of D01). They are written red-first like the rest; where one is green at step 4, `test-results.md` records it as characterisation with the reason, and it is not counted as red evidence.

## Commands

```bash
# Narrow, from the repository root
dotnet test backend/tests/ResumeBuilder.Api.Tests -c Release --filter "FullyQualifiedName~P13"
dotnet test backend/tests/ResumeBuilder.Architecture.Tests -c Release
npm test --prefix frontend -- src/shared/lib/zip.test.ts src/features/account src/shared/api/client.csrf.test.ts src/app/security-headers.test.ts
bash docs/phases/P13/tests/web-image-check.sh

# Phase suite (backend, frontend, fixture E2E with rendering, web image, contract, infrastructure policy)
bash docs/phases/P13/tests/suite.cmd

# Step 7 only
npx playwright test -c playwright.real.config.ts reliability-acceptance.spec.ts   # in the pinned image, see tests/e2e/README.md
```
