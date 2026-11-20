# Test Results

Exact commands, environment, exit codes and counts, red before green. Never mark tests passed without running them.

## Resume state (2026-11-04, usage limit, paused at a step boundary; resumed 2026-11-05)

Steps 1 and 3 are committed; step 2 is skipped (no contract change). **No P07 code or test exists yet and no P07 test has run, so there is no red or green evidence.** Next step: **4 Red**. Nothing is half-done.

Findings from reading the code, not recorded elsewhere, for step 4:

- Compile seams first: typed Domain records, Application ports and throwing bodies only. No endpoint or DI registration before the red proof.
- Name the store port `IResumeStore`, matching P06's `IAccountStore`. The P04 architecture guard greps Application for the text `IResumeRepository`.
- API test accounts: `auth-email` allows 5 per 10 minutes per IP, so seed with `IAccountUseCases.SignUpAsync`, then log in over HTTP (10 per minute per IP). `AccountRateCounter` lives per host, so use one host per test. Seed the 200-resume case through the store, because `doc-write` allows 120 per minute.
- Azurite fixture: follow the `AZURITE_ACCOUNTS` pattern in `P06DeferredPersistenceTests`, with the digest from `infrastructure/images.lock`.
- `P06FixtureTests.Fixture` must remove `IAccountOwnedDataPurger` once the purger is registered, or its deletion tests hit the unreachable Mongo address (DD-P07-16).
- `route-error.test.tsx` expects h1 `Resumes` synchronously with `fetch` unstubbed, so the heading renders before the list loads and the failed fetch must be caught.

For step 5:

- `AccountEndpoints` helpers `Current`, `CheckCsrf`, `Problem` and `NoStore` must become internal for `ResumeEndpoints`.
- `Program.cs` sets the minimum log level to None, so each new warning category needs its own filter. Set Kestrel `MaxRequestBodySize` explicitly (ADR-038 §3).
- Register `DualAccountDeletionLedger` once and forward both ledger ports.
- SkiaSharp 4.154.0 and its Linux native assets go in `Directory.Packages.props`; regenerate the lock files, since CI restores with `--locked-mode`.

For step 7: `__Host-` cookies with `Secure` need `http://localhost`, and antiforgery needs an HTTPS request, so the throwaway proxy must send `X-Forwarded-Proto: https` with `ReverseProxy:TrustedProxies` set to `127.0.0.1`. The preview server and web image do not proxy `/api/v1`.

## Step 4 — Red (2026-11-05)

Environment: Linux 6.12, .NET SDK 10.0.301, Docker (Mongo and Azurite from `infrastructure/images.lock`, digest-pinned), Node 24, Playwright image from `infrastructure/images.lock`. Seams are declaration-only: Domain records and limits, Application ports, `MongoResumeStore`, `AzurePhotoStorage` and ledger methods with `NotImplementedException` bodies. No endpoint or DI registration exists.

| Command | Exit | Result |
|---|---|---|
| `dotnet build backend/ResumeBuilder.slnx -c Release --no-restore -warnaserror` | 0 | 0 warnings, 0 errors |
| `dotnet format backend/ResumeBuilder.slnx --verify-no-changes --no-restore` | 0 | clean |
| `dotnet test backend/ResumeBuilder.slnx -c Release --no-build` with `RESUMISER_MONGO_IMAGE` and `TESTCONTAINERS_RYUK_CONTAINER_IMAGE` from `images.lock` | 1 | Architecture 11/11, Toolchain 3/3, Api 110 passed, **136 failed** of 246 |
| `npm run typecheck --prefix frontend` | 0 | clean |
| `npx vitest run src/features/library src/entities/resume src/app` (in `frontend/`) | 1 | **25 failed** (21 library, 4 entity); `src/app` passes |
| `npx playwright test library.spec.ts shell.spec.ts account.spec.ts --project=chromium` (in the pinned container, on the built SPA) | 1 | 35 passed, **13 failed** (11 library, 2 amended account) |

Why the backend tests fail, from the TRX file. All 136 are the intended reasons; none is a harness error, and Mongo, Azurite and the hosts all started:

| Count | Reason | Meaning |
|---|---|---|
| 75 | `NotImplementedException` | a declared body: reader, rules, canonical JSON, store, limits |
| 58 | `Assert.Equal() Failure` expected 201, actual 404 | the route does not exist yet |
| 1 | `listResumes answered 404` | X01 expects 401 on a route that does not exist |
| 1 | K01 inventory differs | the host lacks the 15 operations |
| 1 | `InProcessContractTests` inventory differs | the amended list holds the 15 operations |

The 13 E2E failures are assertion timeouts on missing cards, headings and buttons, plus the two amended login-landing assertions. The 25 frontend failures are the entity stubs (`not implemented`) and elements not found.

Harness defect fixed before this evidence: D01 read the `Resume` instead of its `document` for `AccountDataExportExample`.

### Test budget

Backend 135 `P07` cases (recorded reason in `architecture/phase-plan.md`), frontend 25, E2E 11 scenarios per browser.

### Amended existing tests (DD-P07-16, DD-P07-17, for the external review)

| File | Change | Why no assertion is weaker |
|---|---|---|
| `frontend/src/app/routes.test.tsx` | `/resumes` leaves the placeholder table; `/` keeps every assertion | F01, F02 and E01 assert the real library, stronger than a heading and a link |
| `tests/e2e/shell.spec.ts` | `/resumes` leaves the no-API loop; `/` and the rest keep every assertion | E01 (deep link, reload) and E07 (axe) cover it |
| `tests/e2e/account.spec.ts` | default landing is `/resumes` in two tests | an external `returnTo` still lands on the safe default, and a new assertion rejects the external host in the URL |
| `backend/.../InProcessContractTests.cs` | inventory gains the 15 operations | stays an exact match |
| `backend/.../P06FixtureTests.cs` | fixture removes `IAccountOwnedDataPurger` | its memory stores hold no resume data; `P07LifecycleTests` covers the purger on real stores |
| `tests/e2e/playwright.config.ts` | `testMatch` gains `library.spec.ts` | additive |

| `python3 scripts/phase-handoff-check.py --phase P07 --step red` | 0 | `RESULT PASS`; scope and blueprint OK; `backend.sh` and `e2e.sh` exit 1 (`e2e.sh` stops at the frontend tests, so the browser evidence is the Chromium run above); contract suite and reader exit 0 |

## Step 5 — Green (2026-11-05)

Same environment. The Mongo and Azurite containers are digest-pinned, and nothing is skipped or quarantined.

| Command | Exit | Result |
|---|---|---|
| `python3 scripts/phase-handoff-check.py --phase P07 --step green` | 0 | `RESULT PASS`: no pre-existing test edited during green, scope OK (61 files), blueprint OK, suite green (6 commands) |
| `bash scripts/ci/backend.sh` (restore `--locked-mode`, build `-warnaserror`, format, tests) | 0 | Architecture 11/11, Toolchain 3/3, Api 246/246 in 1 m 31 s, of which 135 are `P07` |
| `bash scripts/ci/e2e.sh` (lint, typecheck, Vitest, build, P05 image check, Playwright in three browsers) | 0 | Vitest 73 passed; E2E exit 0 |
| `npx playwright test` in the pinned container, on the built SPA, just before the final copy-key change | 0 | 150 passed in 1.3 m (50 per browser) |
| `npm test --prefix tests/contract` and `dotnet run tests/contract/dotnet/ContractReader.cs -- contracts/openapi/openapi.yaml` | 0 | contract suite passes; the reader's error line is its deliberate negative diagnostic |
| `git diff main...HEAD -- contracts` | 0 | empty: no contract change |

### Test files changed after the red commit, for the external review

All of these went into the part-1 and part-2 commits, so `--step green` sees a clean tree. None removes or loosens an assertion.

| File | Change | Why |
|---|---|---|
| `P07Harness.cs` | `CacheControl` reads the raw header | The parsed form reorders `private, no-cache`, so the old helper could not assert the contract's exact value. Stricter. |
| `P07Harness.cs` | hosts run in environment `Testing` | In `Development` the developer exception page answers first and hides the exception boundary that M05 asserts. |
| `P07PhotoTests.cs` P04 | a no-op colour comparison becomes `Alpha == 0` on the master | The first form compared two zeroed colours and proved nothing. Stronger. |
| `P06FixtureTests.cs` | fixture also removes `IAccountResumeExportSource` | DD-P07-27. |
| `library.test.tsx`, `library.spec.ts` | `Delete <title> permanently` becomes `Delete permanently <title>` | DD-P07-26, WCAG 2.5.3. |
| `library.spec.ts` E06 | `getByText(/restored/i)` becomes the status role with its exact text | The regex also matched `RestoreDelete` in a card's text. Stricter. |

### Mutation spot-check

The tests and the code come from one session, so I checked that the tests can fail. A throwaway script applied one production change at a time, ran the narrow test class and restored the file. **All 16 mutants were killed:**

| Mutant | Test class |
|---|---|
| no owner filter on resume reads | `P07SecurityTests` |
| `If-Match` never compared | `P07ApiTests` |
| conditional replace ignores the version | `P07ApiTests` |
| purge deletes blobs before the ledger | `P07LifecycleTests` |
| upload bytes stored without re-encoding | `P07PhotoTests` |
| orientation not applied | `P07PhotoTests` |
| failed attempt not released | `P07ApiTests` |
| key hash not compared | `P07ApiTests` |
| document replay skipped | `P07ApiTests` |
| effect-applied replay skipped | `P07ApiTests` |
| per-owner lock not bumped in the create transaction | `P07ApiTests` |
| length counted in UTF-16 units | `P07DocumentTests` |
| unknown properties allowed | `P07DocumentTests` |
| purge-hidden flag ignored on reads | `P07LifecycleTests` |
| account purge skips snapshots | `P07LifecycleTests` |
| automatic snapshot on every write | `P07SnapshotTests` |

## Step 6 fixes — red then green (2026-11-05)

| Finding | Red | Green |
|---|---|---|
| First review, major: the key is discarded after a 5xx | `npx vitest run src/features/library` exit 1: 4 of 26 failed, 3 on a differing `Idempotency-Key` and the fourth because its own stub failed twice, which was corrected before the code | exit 0, frontend 78 of 78 |
| Delta review, major: the key is lost on closing the dialog | `npx vitest run src/features/library -t "closed and reopened"` exit 1: expected two list reads, got one | exit 0, frontend 79 of 79 |

## Step 8 — Gate check on the final commit `d27e865` (2026-11-05)

`python3 scripts/phase-handoff-check.py --phase P07 --gate`, exit 1, `RESULT FAIL`:

| Check | Result |
|---|---|
| Phase scope, 78 files | OK |
| `check-blueprint` | OK |
| `bash scripts/ci/backend.sh` | exit 0, Api 246 of 246 |
| `bash scripts/ci/e2e.sh` | exit 0 |
| Contract suite and reader | exit 0 |
| Required artifacts, 8 | OK |
| QA verdict | PASS |
| **Review verdict** | **FAIL: the only failure, and intended.** See below |

## Resume state (2026-11-05, waiting for the owner)

Steps 1–7 are committed on `phase/P07`, which is not merged. **Next: the owner's decision in DD-P07-29.** After a PASS from the external reviewer on `git diff 8592ee7..986fde3 -- frontend`, or an owner waiver, run the gate, set `PHASE-STATUS.md` to `COMPLETED` and merge with `--no-ff`. Nothing is half-done.

## Gate accepted (2026-11-05)

The owner chose a second delta re-review, which returned `Verdict: PASS` (DD-P07-30). This supersedes the waiting state above. `python3 scripts/phase-handoff-check.py --phase P07 --gate` on `5740fe7`: exit 0, `RESULT PASS`; scope OK, blueprint OK, suite green (6 commands, Api 246 of 246), required artifacts present, review PASS, QA PASS.

