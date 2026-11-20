# P13 QA / Acceptance Report — Reliability, Security & Data Lifecycle

Verdict: PASS

- Run by the operator session on 2026-11-12/13. Under ADR-051 planning, tests, implementation and acceptance are one actor; the independent check is the external review in `review/code-review.md` (full review PASS, delta 1 PASS).
- This pass exercised the running system on the final code. Exact commands and exit codes are in `tests/test-results.md` ("Step 5 — green", "Step 7").

## Environment

| Part | What ran |
|---|---|
| Services | Throwaway Compose project `resumiser-p13qa`: digest-pinned Mongo 8.0.15 replica set, Azurite, Mailpit; removed with its volumes after each block (`qa-evidence/qa-stack.sh`) |
| API | Release build, `ASPNETCORE_ENVIRONMENT=Production`, real Kestrel, production log filters, SMTP to Mailpit, `ReverseProxy__TrustedProxies__0=127.0.0.1` |
| Same-origin host | `tests/e2e/real-stack/proxy.mjs` on `http://localhost:4190`, serving `frontend/dist` and forwarding `/api/v1` with `X-Forwarded-Proto: https` |
| Browser | Real Chromium in the pinned Playwright image, against the real API. Chromium, Firefox and WebKit ran the whole fixture suite under the CSP (373 passed) |
| Web image | `resumiser-p05-web:local` rebuilt with `--pull --no-cache`, checked by W01 and the P11 image check |
| Cold start | **No warm-up request** before the browser specs, unlike P11 and P12, because P13 owns the P10 cold-start 403 |
| Result | **`reliability-acceptance`: RS01–RS04, 4 of 4**; real-stack restore drill, reconciliation runs, HSTS and credential-stuffing checks as below |
| Evidence | [qa-evidence/](qa-evidence/), synthetic data only: screenshots, the downloaded archive, transcripts of the drill and the stuffing check, the scripts that produced them |

## Acceptance matrix

| ID | Result | Evidence |
|---|---|---|
| AC-P13-01 | PASS | J03 (ledger entries in both stores before the resume, snapshots and photo blobs go; a restored, an in-window and another owner's resume untouched), J05 (one failing resume does not stop the others, pending count logged without IDs), J06 (second run harmless), J04 (a restore that lands first wins). |
| AC-P13-02 | PASS | J01 (B cannot take A's lease until it expires), J02 (two replicas run one period's job once). Runbook §3. |
| AC-P13-03 | PASS | D01: an account with active and trashed resumes, photos (one pending removal), snapshots and idempotency records is gone from every live collection and blob prefix after the job at +24 h; `account` entry in both ledger stores; another account untouched; login refused before +24 h. |
| AC-P13-04 | PASS | D03 (blob-only entries loaded and written back, steps in order, counts only, second run changes nothing); D04 (no listener, no job; the real binary five times, summary each time). **Real stack:** `ledger_loaded=4`, 4 rows written back from the blob copy into a restored database without the collection, second run all zeros; summary printed in 30 of 30 runs after fix F-1. |
| AC-P13-05 | PASS | D02 drill: `mongodump`/`mongorestore` and a photo-container restore over an erased account, a permanent delete from the trash, a job purge, a removed and a replaced photo; each stays gone, the restored resume no longer references the removed photo, expired snapshots and orphan blobs go, a trashed and an active resume keep their photos. **Real stack** (`qa-evidence/restore-drill.txt`): a resume deleted permanently through the API came back with the database restore (200), reconciliation removed it again (404), the kept resume and its photo master stayed (200). |
| AC-P13-06 | PASS | D05: cluster default write concern is majority, and every file under `backend/src` that writes gets its database with `WMajority` or the durable concern, with nothing weakening it (the profiler cannot show an update's write concern; the source scan is the stronger statement, recorded at step 4). Runbook §1: continuous backup with PITR, daily snapshots kept 30 days, blob PITR and soft delete, EU regions, for P15. |
| AC-P13-07 | PASS | S01–S04: every contract operation classified (an unclassified one fails the test), anonymous 401, cross-owner 404 with nothing changed, no working session after a deletion request. |
| AC-P13-08 | PASS | U01–U05: 65 000 × 65 000 px PNG and JPEG refused from the header within 2 s, truncated PNG and JPEG, SVG and HTML as `image/png`, empty file, each with the contract code and nothing stored. GPS: P07's `P02ExifAndGpsAreAbsentFromMasterAndRendition`. |
| AC-P13-09 | PASS | O01 canary journey at Trace for every category, every job and reconciliation: no canary string in any message, state value or exception. |
| AC-P13-10 | PASS (Should) | O02 under the production filters: the pending events and the reconciliation summary with counts only, framework categories silent. **Real stack:** the summary line from the Production binary (`restore_reconciled ledger_loaded=… orphan_owners=…`). |
| AC-P13-11 | PASS | S05 (API HSTS in Production, not in Testing); W01 on the web image (CSP, XFO DENY, nosniff, no-referrer, Permissions-Policy, HSTS; hashed assets immutable for a year, `index.html` no-cache); L03 in three browsers: no violation; the whole fixture suite runs under the CSP. **Real stack:** `strict-transport-security: max-age=31536000; includeSubDomains` for a non-loopback host. |
| AC-P13-12 | PASS (Should) | S06: forwarded scheme and client address from inside a trusted network applied, from outside ignored. |
| AC-P13-13 | PASS | C01 reproduced the race before the fix; C02–C04 after it; S08: 20 concurrent bootstraps on a fresh key ring, no mismatch; forged and crossed tokens 403. **Real stack, cold host with no warm-up:** sign-up, verification, login and every write through RS01–RS04, 50 requests, no 403 and no other 4xx or 5xx. |
| AC-P13-14 | PASS (Should) | A01–A07, Z01–Z03, L01 (PDF and TXT equal to Node's for the same version; nameless resume listed `no_full_name`), L02 (Cancel downloads nothing), UI01–UI03 (progress "n of N", unverified cannot start). **Real stack** RS03: one ZIP, `unzip -t` clean, real photo master byte-equal, PDF and TXT of the current version. |
| AC-P13-15 | PASS | **Real stack:** RS01 lost response after the server applied it, replayed with the same key: Saved, no conflict, one version step; RS02 five 503s, edit kept and saved after recovery. S07 with Mongo paused: readiness 503, write never acknowledged, the same keyed write applies once after. |
| AC-P13-16 | PASS | L03 and the network audits of the fixture suite: nothing leaves the origin; AR01: no outbound HTTP client; runbook §6 residency check per store. Production evidence is P15 (DD-P13-24). |
| AC-P13-17 | PASS | `docs/operations/runbook.md`: §2 restore and `reconcile-restore` with traffic off, §5 key rotation, §6 residency, §1 backup and §4 log retention values, §3 jobs and leases, §8 effective rate limits. The commands in §2 were run as written in step 7. |
| AC-P13-18 | PASS | L02: keyboard only, progress in a status region, axe clean in idle, preparing and cancelled states, no overflow at 390 px, no e-mail or share control. **Real stack** RS04: dark scheme at 390 px, axe clean before and after, one download (`qa-evidence/rs04-archive-dark-390.png`). Nothing from §3.2 built. |

## Defects found in this step

| ID | Severity | What | Status |
|---|---|---|---|
| F-1 | Major for operations | `reconcile-restore` exited 0 with no output in 4 of 14 real-stack runs: the host was not disposed, so the console logger's queue was not flushed, and the runbook has the operator copy that line | **Fixed** (`b183d9c`), D04 strengthened, 30 of 30 runs after; delta review 1 PASS |

Found and fixed earlier in step 5, recorded for completeness: new hosted jobs resolved the Blob stores at host start and broke P04's `HostTests` (fixed with `DeferredJob`); two timing flakes in P08 E2E tests (DD-P13-27, DD-P13-28).

## Not a defect

- **No HSTS for `Host: 127.0.0.1`.** ASP.NET's `HstsOptions.ExcludedHosts` excludes loopback names by default; the header is sent for a real host name.
- **`fetch` refuses port 4190** (ManageSieve is on the fetch "bad ports" list). Browsers in the pinned image reach it; the step 7 Node scripts talk to the API on 5090 with the proxy's forwarded headers instead.

## Carried out of P13

- **T-RE-01 security audit events → P15** (DD-P13-30): user ID, action, timestamp, request ID and IP for login, password change, deletion request and data export, into the 30-day security log P15 configures.
- **Review follow-ups (minor):** keep the raw `account-data.json` bytes in the archive and assert byte equality in A01; reach the archive button with Tab in L02/RS04 instead of `focus()`.
- **P15, already planned:** applying the runbook's backup policy and residency checks, the failure-rate and pending-job alert rules, Key Vault wrapping of the key ring, the replica count behind the per-replica rate limits (DD-P13-10), and one production restore against a staging copy.
