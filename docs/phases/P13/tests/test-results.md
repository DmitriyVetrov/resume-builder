# P13 Test Results

Environment: Debian 13 (Linux 6.12), .NET SDK 10, Node 24, Docker with the digest-pinned images of `infrastructure/images.lock` (Mongo 8.0.15 replica set, Azurite, Playwright). Operator session, 2026-11-12.

## Step 4 — red

### Compile scaffolding

So the new tests build and fail on assertions rather than on missing symbols, step 4 adds empty-bodied types: `ScheduledJobs.cs` (`IScheduledJob`, `IJobLease`, `MongoJobLease` that always grants, `ScheduledJobWorker` that runs without a lease, the three job adapters, `TrashExpiryJob` that purges nothing), `RestoreReconciliation.cs` (returns zero counts), `OperationsCommand.cs` (handles nothing), four store port methods returning nothing, `IPhotoInventory` on `AzurePhotoStorage` returning nothing, and their DI registrations. Frontend: `shared/lib/zip.ts` returns an empty blob, `features/account/archive.ts` returns an empty result. `frontend/nginx.conf` is the Dockerfile's former `printf` moved to a file, byte-for-byte the same configuration.

Two test-harness edits outside P13's own files, neither touching an assertion: `P07Containers.Mongo` exposes the container for the drill's `mongodump`/`mongorestore`; and the two provisional P06 tests of the JSON download now expect the archive (DD-P13-26).

### Backend

```bash
dotnet build backend/ResumeBuilder.slnx -c Release -warnaserror        # exit 0, 0 warnings
dotnet test backend/tests/ResumeBuilder.Api.Tests -c Release --no-build --filter "FullyQualifiedName~P13"   # exit 1
dotnet test backend/tests/ResumeBuilder.Architecture.Tests -c Release --no-build                            # exit 0
```

Result: **Api P13: 26 tests, 13 failed, 13 passed** (final red run, after the corrections below). Architecture: 12 passed (AR01 included).

| Test | Red reason (assertion) |
|---|---|
| J01 | `Assert.False` — B acquired a lease A holds (stub grants every lease) |
| J02 | `Assert.False` — the second replica ran the job in the same period |
| J03 | `Assert.Contains` — no ledger call: the expired resume was not purged |
| J04 | `Assert.Null(deletedAt)` — the job never listed due trash, so the race never happened |
| J05 | `Assert.Null` — the passing resume is still stored |
| J06 | `Assert.True(purged ≥ 1)` — nothing purged |
| D02 | `Assert.Null` — the job did not purge the expiring resume before the backup was restored |
| D03 | `Assert.True(loaded ≥ 1)` — reconciliation loaded no ledger entry |
| D04 | `Assert.Equal(0, null)` — the command was not handled |
| S05 | `No HSTS in Production` |
| S06 | `A trusted network's X-Forwarded-Proto was ignored` |
| O01 | `Assert.Contains` — no `restore_reconciled` entry (the journey itself completed) |
| O02 | `IOException: synthetic job failure` thrown out of `ScheduledJobWorker.RunOnceAsync`: the worker does not yet contain a job's failure, which is the behaviour under test |

**Characterisation (green at red, not counted as red evidence):** S01–S04 (the matrix: every contract operation classified, 401 anonymous, 404 cross-owner with nothing changed, no working session after the deletion request), S07 (Mongo paused: probe 503, write 5xx, the same keyed write applies once after), S08 (20 concurrent bootstraps on a fresh key ring, no `csrf_token_invalid`; forged and crossed tokens 403), D01 (aggregate deletion within 24 h), D05 (every write path majority, cluster default majority), U01–U05 (bombs refused from the header within 2 s, truncated PNG and JPEG refused, SVG and HTML refused by their bytes, empty file refused), AR01 (no outbound HTTP client). They pin behaviour P06 and P07 built, and guard the code P13 adds (D05 covers the new lease collection, AR01 the new jobs).

**S08 is evidence for the cold-start diagnosis:** the server handles concurrent first bootstraps on a fresh data-protection key ring without a mismatch, so the 403 of P10 is not a key-ring race. C01 below reproduces the client-side interleaving.

**Test-design corrections made during red, before any implementation:**
- J03, J04, J05 and D02 advanced the fake clock past the 14-day sliding session and then got 401. They now log the same account in again (`Relogin`) after a long advance.
- S07's create body lacked `copyPhotoFromResumeId`, which the closed request schema requires (400). Fixed.
- S07 first probed readiness with the signed-in client and got 500: the session cookie makes authentication read the paused session store before the endpoint runs. The platform's probe carries no cookie, so the test now probes with a cookie-less client. Readiness with a cookie during an outage is not a contract the platform relies on.
- D05 was planned as a profiler check of each write command. The Mongo profiler records update and delete statements without their write concern, so it cannot prove the property. D05 instead asserts the cluster default is majority and, by source scan, that every file that writes obtains its database with `WithWriteConcern(WMajority | DurableWriteConcern)` and that nothing in `backend/src` weakens it. Every store already sets it explicitly, which overrides any connection-string `w`, so the scan is the stronger statement. AC-P13-06 is unchanged in substance.
- S06 observes the forwarded scheme through HSTS and the forwarded client address through `HttpContext.Connection.RemoteIpAddress` from `TestServer.SendAsync`.

### Frontend (Vitest)

```bash
npx vitest run src/shared/lib/zip.test.ts src/features/account src/shared/api/client.csrf.test.ts src/app/security-headers.test.ts   # in frontend/, exit 1
```

Result: **6 files, 60 tests, 18 failed, 42 passed** (the 42 are the existing account tests plus Z03).

| Test | Red reason |
|---|---|
| Z01 | the test's independent reader: `No end of central directory record` |
| Z02 | `expected length 22 but got 0` |
| Z03 | passes vacuously: the stub's empty blobs are equal. It becomes meaningful once Z01 passes |
| A01–A03, A07 | the reader rejects the empty archive / `expected '' to be 'resumiser-data-2026-11-12.zip'` |
| A04, A06 | `promise resolved … instead of rejecting` |
| A05 | `expected [] to deeply equal [[0,2],[1,2],[2,2]]` |
| UI01–UI03b, P06 "unverified … data download" | `Unable to find role="button" and name /download your data/i` |
| C01 | `promise rejected "API request failed" instead of resolving` — **the race reproduced**: the mutation went with pair 1, a late bootstrap installed another pair, the server refused, and the client gave up |
| C02 | `expected length 1 but got 2` — two concurrent mutations started two bootstraps |
| C03 | `expected length 2 but got 1` — no retry |
| C04 | `expected undefined to be "default-src 'self'; …"` — no CSP in `nginx.conf` |

### Fixture E2E

```bash
npm run build --prefix frontend                                         # exit 0
docker run … "$(image PLAYWRIGHT)" npx playwright test data-lifecycle.spec.ts account.spec.ts -g "L0|data download"   # exit 1
```

Result: **12 tests (4 × 3 browsers), 12 failed.** L01, L02 and the P06 data-download test wait for the "Download your data" button that does not exist yet (locator timeouts); L03 fails `expect(received).toBe(POLICY)`: the preview server sends no `Content-Security-Policy`.

The web image check W01 (`docs/phases/P13/tests/web-image-check.sh`) is run at green; its headers do not exist yet.

### Decisions taken in this step

- **DD-P13-23:** P13-CX-01 is not dispatched; see `decisions.md`.
- **DD-P13-26:** the two provisional P06 JSON-download tests now expect the archive; see `decisions.md`.

## Step 5 — green

### Implementation

- **Backend** (commit `255608d`, plus the fix below): `ScheduledJobs.cs` (Mongo lease `job_leases`, `ScheduledJobWorker` that contains a job's failure, the three jobs, `TrashExpiryJob` on the two-phase purge with a conditional first phase), `RestoreReconciliation.cs` (ADR-039 §4 steps 1–6, counts-only summary), `OperationsCommand.cs` (`reconcile-restore`, exit 0/1, no Kestrel), the ledger union with write-back, `AccountDeletionProcessor.EraseAsync`, four store port methods, `IPhotoInventory`, HSTS in Production, `ReverseProxy:TrustedNetworks`, the production log filters (DD-P13-21). The P06 and P07 workers are replaced by the leased jobs.
- **Frontend:** `shared/lib/zip.ts` (store-only ZIP, CRC-32, UTF-8 names), `features/account/archive.ts` (one resume at a time, photo master, PDF through the engine exactly as one-click export, TXT, manifest with missing parts, abort ends everything), the "Download your data" action with re-auth, progress, Cancel and result notice (`Progress` added with `npx shadcn@4.23.0 add progress`), single-flight CSRF bootstrap with one retry after `csrf_token_invalid` (DD-P13-17).
- **Web server:** `frontend/nginx.conf` sends the CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, HSTS, immutable caching for hashed assets and `no-cache` for the shell; `vite preview` sends the same CSP (DD-P13-18).
- **Docs:** `docs/operations/runbook.md`; ADR-039 "P13 amendment".

**Green-step corrections (test side, no assertion weakened):**
- O02's (`P13ObservabilityTests.cs`) failing purger stayed active during the reconciliation it then checks; it has a `Failing` switch, turned off before the reconciliation. The assertion (a job failure is logged as `scheduled_job_failed` with no content, and the next run succeeds) is unchanged.
- UI02 (`frontend/src/features/account/account-archive.test.tsx`) found two "Cancel" buttons while the re-auth dialog was still closing; it now waits for the preparing text and the dialog to close before it takes Cancel.

**Regression found by the full suite and fixed:** the first full run failed 7 of P04's `HostTests` with "Api host did not start". The host tests start the real API without Blob configuration; `AddJob` built each job, and with it `AzurePhotoStorage`, when the host started, so startup threw `Blob storage is missing`. The P06/P07 workers had resolved their processor per tick. `DeferredJob` now builds the job on each run (a failure to build is a failed run, logged by the worker), and each job's name and period are constants, so the worker needs neither to start. The seven host tests were the red; they pass.

**Flakes in earlier phases' E2E tests, fixed under rule 01 §8:**
- E09 (P08, `tests/e2e/editor.spec.ts`, chromium, one failure in 375): read the preview order once, before the debounced repaint. Now `expect.poll` on the same expectation. DD-P13-27.
- E08 (P08, webkit, one failure in 375): ~100 key presses, 22.6–23.6 s alone on `main` and 21.8–22.1 s on this branch, over 30 s under the full parallel run. Now a 60 s budget. DD-P13-28.

**Environment:** the web image's cached `apk upgrade` layer kept `libxslt 1.1.43-r3` (4 OSV findings) and failed the image scan; `docker build --pull --no-cache -t resumiser-p05-web:local -f frontend/Dockerfile frontend` installed `1.1.43-r4`. Not caused by the diff.

### Commands and results

```bash
bash docs/phases/P13/tests/suite.cmd          # exit 0 (final run, after the fixes above)
python3 scripts/phase-handoff-check.py --phase P13 --step green   # exit 0, RESULT PASS (9 suite commands green; TEST_TOUCHED warnings for the two test files named above)
```

| Job | Result |
|---|---|
| `scripts/ci/backend.sh` | format and build clean; Architecture **12/12** (AR01 included); Toolchain **3/3**; Api **312/312** (all 26 P13 tests, all 7 `HostTests`) |
| `scripts/ci/e2e.sh`: frontend | lint, typecheck; Vitest **48 files, 526/526** (Z01–Z03, A01–A07, UI01–UI03b, C01–C04 included); build |
| `scripts/ci/e2e.sh`: OSV image scan | No issues found |
| `scripts/ci/e2e.sh`: fixture E2E, 3 browsers, under the CSP | **373 passed, 2 skipped, 0 failed** (L01–L03 in every browser; the skips are Y10's visual baselines outside chromium, as since P10) |
| `scripts/ci/e2e.sh`: rendering gate | 350 checks PASS, 0 FAIL; G2 PASS; Playwright rendering specs 18/18 |
| P11 web-image check | PASS (gzip and caching) |
| P13 web-image check (W01) | PASS: headers on `/`, `/index.html`, `/resumes/x/edit`; immutable assets |
| Contract (`npm test --prefix tests/contract`) | 66/66 |
| ContractReader | `paths=26 errors=0 warnings=0`; N-17, N-18 as designed |
| Infrastructure static policy | 16 tests OK |

The real-stack spec `tests/e2e/real-stack/reliability-acceptance.spec.ts` (RS01–RS03) runs at step 7 against Compose.

## Step 7 — acceptance findings fixed before the QA verdict

**F-1: the `reconcile-restore` summary line was sometimes not printed.** Against the real stack (Compose Mongo and Azurite, Release API, `Production`), the command exited 0 with **no output** in 3 of 8 runs, then in 1 of 6 (0 bytes on stdout and stderr). The runbook (§2 step 5) has the operator copy that line into the incident. Cause: `Program.cs` returned the exit code without disposing the host, so the console logger's background queue was not always flushed before the process ended.

- Red: the real-stack reproduction above. D04 already asserted the line on one run of the real binary and passed by chance; it now runs the binary five times and requires the summary each time. In the Testcontainers environment the race did not show (D04 passed 3 × 5 runs before the fix), so D04 is the regression guard and the real-stack runs are the red evidence.
- Fix: `await app.DisposeAsync()` before returning the command's exit code.
- Green: 30 of 30 real-stack runs printed `restore_reconciled …`, exit 0; `bash scripts/ci/backend.sh` exit 0 (Architecture 12/12, Toolchain 3/3, Api 312/312).

**RS04 added** (`tests/e2e/real-stack/reliability-acceptance.spec.ts`): AC-P13-18's dark scheme was covered only by the fixture suite's light-scheme L02, so RS04 checks the archive in the dark scheme at 390 px against the real API: keyboard only, axe clean before and after, no horizontal overflow, one download.

## Step 7 — real-stack acceptance commands

Stack: `docs/phases/P13/qa-evidence/qa-stack.sh up` — throwaway Compose project `resumiser-p13qa` (digest-pinned Mongo replica set, Azurite, Mailpit), the Release API in `Production` on 5090 with `ReverseProxy__TrustedProxies__0=127.0.0.1`, `tests/e2e/real-stack/proxy.mjs` on 4190 serving `frontend/dist`. **No warm-up request** (AC-P13-13). Fresh for each block below; `qa-stack.sh down` removes the project and its volumes. Builds: the Release API and `frontend/dist` of the final code.

| What | Command | Exit | Result |
|---|---|---|---|
| RS01–RS04 | `docker run … "$(image PLAYWRIGHT)" npx playwright test -c playwright.real.config.ts reliability-acceptance.spec.ts` with `RESUMISER_QA_EVIDENCE=docs/phases/P13/qa-evidence` | 0 | **4 passed** (RS01 4.4 s, RS02 28.3 s, RS03 27.4 s, RS04 2.3 s); `qa-evidence/reliability-acceptance.txt` |
| API status codes during RS01–RS04 | `grep request_complete api.log` | — | 43 × 200, 3 × 201, 1 × 202, 3 × 204; **no 4xx or 5xx** on a cold host |
| Archive, independent reader | `unzip -t qa-evidence/resumiser-data-2026-11-12.zip` | 0 | "No errors detected"; 9 entries: `account-data.json`, `manifest.json`, three resumes with PDF and TXT, one photo master |
| Reconciliation summary, before F-1's fix | `qa-stack.sh reconcile`, 8 runs, then `env … dotnet ResumeBuilder.Api.dll reconcile-restore`, 6 runs | 0 each | summary missing in 3 of 8 and 1 of 6 runs (0 bytes of output) |
| Reconciliation summary, after the fix | the same `env … dotnet ResumeBuilder.Api.dll reconcile-restore`, 30 runs in a loop | 0 each | **30 of 30** print `restore_reconciled ledger_loaded=… orphan_owners=…` |
| Restore drill on the real stack | `qa-evidence/restore-drill.txt` (round 1 and round 2; `qa-drill.mjs setup`, `mongodump`, `qa-drill.mjs purge`, `mongorestore --drop`, round 2 also drops `deletion_ledger`, `qa-drill.mjs check`, `qa-stack.sh reconcile` twice) | 0 | round 2: purged resume back after the restore (200), `ledger_loaded=4 resumes_purged=1`, 4 ledger rows written back from the blob copy, purged resume 404, kept resume and its photo master 200; second run all zeros |
| HSTS from the real API | `curl -D - -H "Host: resumiser.example" http://127.0.0.1:4190/api/v1/health/live` | 0 | `strict-transport-security: max-age=31536000; includeSubDomains`. With `Host: 127.0.0.1` no header: ASP.NET's default `ExcludedHosts` (loopback), not a defect |
| Credential stuffing (T-SP-02) | `node qa-evidence/qa-stuffing.mjs` | 0 | one account, failures from 7 different client addresses: 401 × 5, then 429 `Retry-After: 60`; the right password from an 8th address during back-off: 429 (no oracle). `qa-evidence/credential-stuffing.txt` |
