# P06 Test Results — RED in progress

Environment: 2026-11-03, Linux, .NET 10, Node 24, local worktree, no real account data. All addresses in tests use `example.invalid`; test output is summarized without submitted values. These are P06 preimplementation results, not a green claim.

| Exact command from repo root | Exit | Result |
|---|---:|---|
| `npm ci --prefix frontend --no-audit --no-fund --prefer-offline` | 0 | Installed frontend test dependencies. |
| `dotnet build backend/src/ResumeBuilder.Api/ResumeBuilder.Api.csproj -c Release` | 0 | API host compiled, zero warnings/errors. |
| `dotnet test backend/ResumeBuilder.slnx -c Release --filter 'FullyQualifiedName~P06' --no-restore` | 1 | API test project compiled and host started. 14/14 P06 cases failed by `Assert.Equal`: expected account/session response, actual 404; no setup error. Other test projects reported no matching P06 tests. |
| `npm test --prefix frontend -- src/features/account` | 1 | Vitest loaded 6 cases; 5 failed because the account routes render Page not found; 1 Google-absence guard passed. |
| `npm run build --prefix frontend` | 0 | Vite preview artifact built. |
| `npm ci --prefix tests/e2e --no-audit --no-fund --prefer-offline` | 0 | Browser test dependencies installed. |
| `npm test --prefix tests/e2e -- account.spec.ts --project=chromium` | 1 | Preview server and Chromium started. 5/5 failed by assertions: four account route headings missing; verification fragment remains in URL. Browser artifact output is ignored and contains no submitted contact/credential data. |

The initial unprepared runs had environment/build failures and **are not RED evidence**: frontend Vitest was not installed (exit 127), API test target could not copy the unbuilt host deps file (exit 1), and Chromium binary was absent (exit 1). Dependency installation and building the API and frontend resolved these before the assertion runs above. Exact focused reruns are the RED evidence. Backend and browser harnesses start; counts match the currently implemented 14 API, 6 frontend and 5 Chromium cases. The full planned matrix is not yet implemented; deterministic email/clock/Mongo/Blob adapter seams are unavailable in the current P04 host, so A01/V02/R04/C05/D07/E08 persistence and time boundaries are not yet covered.

Additional contract/source guard run after correcting the frozen method for changePassword (`PUT`, not POST): `dotnet test backend/ResumeBuilder.slnx -c Release --filter 'FullyQualifiedName~P06' --no-restore` exited 1; all projects compiled, 16 P06 API tests discovered, 14 failed on missing live behavior and 2 contract/source guards passed. This correction was to the new test expectation, not the frozen contract. The run before correction exited 1 with a test-data mismatch and is not RED evidence.

`python3 scripts/phase-handoff-check.py --phase P06 --role test-engineer --worktree .` exited 0 before the final contract guard addition: role scope passed and suite observed backend/frontend/E2E assertion failures; contract regressions passed. A fresh check remains pending after the final test additions.

Pending on DD-P06-07 interface declarations: API test fixture in `backend/tests/ResumeBuilder.Api.Tests/` for ConfigureTestServices fake clock, captured email, Mongo/Azurite account/token/session/outbox stores, deletion ledger/processor and failure injection; domain/application/infrastructure cases for password policy, token expiry/replay, re-auth freshness, ledger ordering and purge restart. These tests cannot compile against missing interfaces and should be written after the declaration scaffold lands. No RED evidence is claimed for them yet.

Final pre-scaffold verification: `python3 scripts/phase-handoff-check.py --phase P06 --role test-engineer --worktree .` exited 0 (role scope seven owned files; phase scope, blueprint and all suite lines checked; three red commands). `bash docs/phases/P06/tests/suite.cmd` exited 1 at the first sequential backend job, as intended under `set -euo pipefail`: API test project had 14 assertion failures on absent live routes, 21 existing/contract cases passed; backend build and host startup succeeded. The suite stops before frontend/E2E/contract commands by design; those were exercised individually above and by the handoff check.

## DD-P06-07/12 scaffold and visual extension (in progress)

After the declaration-only scaffold landed, `dotnet test backend/ResumeBuilder.slnx -c Release --filter 'FullyQualifiedName~P06' --no-restore` exited 1: all projects compiled, 26 P06 Api tests were discovered, 24 failed by assertion on missing session/account operations and 2 frozen-contract guards passed. The new WebApplicationFactory fixture overrides `IClock`, `IEmailSink` and `IAccountDeletionLedger` via ConfigureTestServices; cases cover CSRF bootstrap, sign-up generic response/mail, password rejection, invalid tokens, unknown address actions, unknown login and anonymous export. Their first failure is an assertion on absent `/api/v1/session` or the relevant operation; no fixture, host, build or test-count error occurred. Further persistence/use-case state assertions remain pending; these cases do not prove them.

`npm test --prefix frontend -- src/features/account` exited 1: 8 cases discovered, 7 failed on missing account headings/controls and one Google-absence guard passed. `npm test --prefix tests/e2e -- account.spec.ts --project=chromium` exited 1: preview server and Chromium started, 9/9 cases failed by assertions on missing headings/controls or retained verification fragment. New design-route cases check login/reset labels, responsive login at 1280/1024/390 px, visible focus, reduced motion and external-request guard; no screenshot or private-data artifact was committed. The existing `/auth/*` test routes and new design `/login`/`/sign-up` routes require an Architect route mapping decision before frontend implementation; no existing assertion was changed.

## DD-P06-13/14 Test Engineer follow-up (2026-11-03)

DD-P06-13 resolves the route mapping: short browser paths are canonical. Existing `/auth/*` cases remain; new tests require history replacement and fragment clearing for both `#t=` and `#token=`. New Domain and Application cases compile against DD-P06-14 and fail on missing behavior. Test adapters use only fictional addresses and synthetic values.

| Exact command from repo root | Exit | Result |
|---|---:|---|
| `dotnet test backend/ResumeBuilder.slnx -c Release --filter 'FullyQualifiedName~P06' --no-restore` | 1 | Initial attempt: stale test package lock after scaffold project references; harness failure, not red evidence. |
| `dotnet restore backend/tests/ResumeBuilder.Api.Tests/ResumeBuilder.Api.Tests.csproj --force-evaluate -p:RestoreLockedMode=false` | 0 | Regenerated test-owned lock file. |
| `dotnet test backend/ResumeBuilder.slnx -c Release --filter 'FullyQualifiedName~P06' --no-restore` | 1 | Intermediate attempt: test analyzer CA1859; fixed the test types, not red evidence. |
| `dotnet test backend/ResumeBuilder.slnx -c Release --filter 'FullyQualifiedName~P06' --no-restore > /tmp/p06-dotnet-final.out 2>&1; code=$?; rg 'Failed!\|error CS\|error CA\|P06AccountUseCaseTests' /tmp/p06-dotnet-final.out \| tail -12; exit "$code"` | 1 | Compiled; 36 P06 cases discovered, 34 failed, 2 passed. New unit failures reach assertions on deliberate NotImplementedException or the unimplemented policy call; API failures remain missing routes. No build, host or count error. |
| `npm test --prefix frontend -- src/features/account` | 1 | 22 cases discovered, 21 failed on missing canonical views, alias replacement or fragment clearing; one Google-absence guard passed. |
| `npm test --prefix tests/e2e -- account.spec.ts --project=chromium > /tmp/p06-e2e.out 2>&1; code=$?; rg 'passed\|failed\|Error\|error\|account.spec.ts:' /tmp/p06-e2e.out \| tail -28; exit "$code"` | 130 | Interrupted after detecting a false-pass suffix URL regex; replaced with exact pathname comparison. Not new alias red evidence. |
| `npm test --prefix tests/e2e -- account.spec.ts --project=chromium --grep 'replaces browser history\|clears .* link fragment\|200 percent' > /tmp/p06-e2e-focused.out 2>&1; code=$?; rg 'passed\|failed\|Error\|error\|account.spec.ts:' /tmp/p06-e2e-focused.out \| tail -30; exit "$code"` | 1 | Chromium and preview started; all 14 new focused cases failed by assertions on canonical path, uncleared synthetic fragment or missing labelled control. |
| `git diff --check` | 0 | No whitespace errors. |

The broader P06 matrix remains unfinished: persistence and processor boundaries, live auth state transitions, comprehensive RTL control/dialog paths, and visual/a11y captures need more red cases. Full phase suite and handoff check were not rerun after these additions.

Post-addition role check: `python3 scripts/phase-handoff-check.py --phase P06 --role test-engineer --worktree .` exited 0 (`RESULT PASS`): five owned files, phase and blueprint scope pass; backend/frontend/E2E phase jobs remain red, contract jobs pass. This check confirms scope and suite execution, not completion of the full P06 case matrix.

## Instruction 2 — remaining red matrix additions (2026-11-03)

Added fake-clock Application cases for valid/unknown login, verification replay and exact 24 h expiry, stale re-auth, deletion revocation and export isolation; added API cases for CSRF, verify/resend, login/logout, reset, deletion, export, invalid media, rate limiting and content-free logs. The Mongo Testcontainer integration case starts the pinned replica set, then checks sign-up persistence by normalized email across non-system databases. RTL adds generic error and deletion/export control checks; Playwright adds keyboard flows, a dialog and reflow checks, axe on named account surfaces, and twelve synthetic capture slots at two widths. All new browser capture assertions execute before saving an image, so no account screenshot was produced while pages are absent.

| Exact command from repo root | Exit | Result |
|---|---:|---|
| `docker info --format '{{.ServerVersion}}'` | 0 | Docker 29.6.1 available. |
| `dotnet test backend/tests/ResumeBuilder.Api.Tests/ResumeBuilder.Api.Tests.csproj -c Release --filter 'FullyQualifiedName~P06Persistence' --no-restore > /tmp/p06-persistence.out 2>&1; code=$?; tail -25 /tmp/p06-persistence.out; exit "$code"` | 1 | Initial test compile failed on xUnit1051 cancellation-token analyzer; repaired test harness, not red evidence. |
| `dotnet test backend/ResumeBuilder.slnx -c Release --filter 'FullyQualifiedName~P06' --no-restore > /tmp/p06-matrix-backend-evidence.out 2>&1; code=$?; rg 'error CS\|error CA\|error xUnit\|Failed!' /tmp/p06-matrix-backend-evidence.out \| tail -8; exit "$code"` | 1 | Final pre-report backend run compiled, started the real Mongo replica set, and discovered 51 P06 tests: 49 assertion failures on missing account behavior and 2 existing contract guards passed. Persistence first assertion expected session 200, got 404; no Docker/setup error. |
| `npm test --prefix frontend -- src/features/account > /tmp/p06-next-frontend.out 2>&1; code=$?; rg 'Test Files\|Tests \|error TS\|×' /tmp/p06-next-frontend.out \| tail -12; exit "$code"` | 1 | 26 RTL tests: 25 failed by missing account headings/controls, 1 Google-absence guard passed. |
| `npm run typecheck --prefix frontend > /tmp/p06-matrix-typecheck.out 2>&1; code=$?; tail -12 /tmp/p06-matrix-typecheck.out; exit "$code"` | 0 | Generated types and TypeScript typecheck passed. |
| `npm test --prefix tests/e2e -- account.spec.ts --project=chromium --grep 'keyboard login\|reset request can\|verified JSON export' > /tmp/p06-keyboard.out 2>&1; code=$?; rg 'failed\|passed\|account.spec.ts:' /tmp/p06-keyboard.out \| tail -8; exit "$code"` | 1 | Harness error: preview port was occupied by a concurrent full Chromium run; not red evidence. |
| `npm test --prefix tests/e2e -- account.spec.ts --project=chromium --workers=4 > /tmp/p06-matrix-e2e-final.out 2>&1; code=$?; rg 'failed\|passed\|account.spec.ts:' /tmp/p06-matrix-e2e-final.out \| tail -14; exit "$code"` | 1 | Chromium/preview started; all 32 account cases failed by assertions on missing named account UI, canonical route or fragment clearing. This run loaded the browser file before the final verification-status assertion was added; that final visual change is being rerun narrowly below. |

The following matrix evidence is intentionally deferred until concrete production seams exist: concurrent token-consumption behavior, private Blob deletion ledger failure/restart and 24 h purge, token/session store inspection, and production rate configuration checks. These cannot currently be red on intended behavior without an implementation or additional compile-only declarations; a missing service/type or unregistered processor would be a harness failure. The real Mongo case now includes concurrent normalized sign-ups, one persisted account, and Identity V3 hash metadata assertions, but execution stops at the missing session endpoint. Twelve visual captures and manual real 200% zoom remain QA evidence after account pages render. The API and browser scenarios encode those later flows where the existing declarations permit them, but currently fail at their first missing route/control assertion.

Final visual assertion rerun: `npm test --prefix tests/e2e -- account.spec.ts --project=chromium --grep 'twelve synthetic visual states' > /tmp/p06-visual-final.out 2>&1; code=$?; rg 'failed\|passed\|account.spec.ts:' /tmp/p06-visual-final.out | tail -8; exit "$code"` exited 1. Both 1280 px and 390 px cases failed at a missing named account UI assertion; no screenshot was saved and the browser/preview harness started.

Final harness correction and role validation:

| Exact command from repo root | Exit | Result |
|---|---:|---|
| `python3 scripts/phase-handoff-check.py --phase P06 --role test-engineer --worktree . > /tmp/p06-matrix-handoff.out 2>&1; code=$?; tail -15 /tmp/p06-matrix-handoff.out; exit "$code"` | 0 | Role scope passed, but backend CI stopped at a test-source whitespace error; not red evidence for that job. |
| `dotnet format whitespace backend/ResumeBuilder.slnx --no-restore --include backend/tests/ResumeBuilder.Api.Tests/P06PersistenceTests.cs backend/tests/ResumeBuilder.Api.Tests/P06FixtureTests.cs backend/tests/ResumeBuilder.Api.Tests/P06UnitTests.cs` | 0 | Formatted test-owned C# files only. |
| `dotnet format backend/ResumeBuilder.slnx --verify-no-changes --no-restore > /tmp/p06-format.out 2>&1; code=$?; tail -8 /tmp/p06-format.out; exit "$code"` | 0 | No backend format errors remain. |
| `npm run lint --prefix frontend > /tmp/p06-lint.out 2>&1; code=$?; tail -20 /tmp/p06-lint.out; exit "$code"` | 1 | Found two errors in newly added RTL test code; corrected them. This is not red evidence. |
| `npm run lint --prefix frontend > /tmp/p06-lint-final.out 2>&1; code=$?; tail -8 /tmp/p06-lint-final.out; exit "$code"` | 0 | Frontend lint passes. |
| `dotnet test backend/ResumeBuilder.slnx -c Release --filter 'FullyQualifiedName~P06' --no-restore > /tmp/p06-final-backend-after-format.out 2>&1; code=$?; rg 'error CS\|error CA\|error xUnit\|Failed!' /tmp/p06-final-backend-after-format.out \| tail -8; exit "$code"` | 1 | 51 P06 cases: 49 behavior assertion failures, 2 contract guards pass; Mongo starts and no compile/format error. |
| `npm test --prefix frontend -- src/features/account > /tmp/p06-frontend-final.out 2>&1; code=$?; rg 'Test Files\|Tests ' /tmp/p06-frontend-final.out \| tail -3; exit "$code"` | 1 | 26 RTL cases: 25 behavior assertion failures, 1 Google-absence guard passes. |
| `python3 scripts/phase-handoff-check.py --phase P06 --role test-engineer --worktree . > /tmp/p06-handoff-postlint.out 2>&1; code=$?; tail -15 /tmp/p06-handoff-postlint.out; exit "$code"` | 0 | `RESULT PASS`: six test-owned files in role scope; phase/blueprint checks pass. Backend, frontend and E2E jobs fail on account behavior assertions; frozen contract jobs pass. E2E CI stops at its frontend prerequisite, so the focused Chromium run above is the actual browser red proof. |
| `git diff --check` | 0 | No whitespace errors. |

No full phase green claim is made. The deferred items above need concrete persistence/processor implementations before their test harness can assert storage state, and QA retains the manual screenshot/zoom review.

## CSRF operation-inventory correction (2026-11-03)

Corrected the sign-up row in `P06ContractOperationRespondsRatherThan404` from 202 to 403: its POST has no `X-XSRF-TOKEN`, matching the frozen contract and the dedicated missing-CSRF problem test. An audit of the other P06 API unsafe requests found that success cases supply CSRF; the unauthenticated protected-operation rows retain 401 for the authentication boundary.

| Exact command from repo root | Exit | Result |
|---|---:|---|
| `dotnet test backend/ResumeBuilder.slnx --filter 'FullyQualifiedName~P06' > /tmp/p06-csrf-fix-test.out 2>&1; result=$?; rg 'error CS\|error CA\|error xUnit\|Failed!\|Passed!\|Failed ResumeBuilder\|Failed P06\|Error Message:\|Expected:\|Actual:' /tmp/p06-csrf-fix-test.out \| tail -65; exit "$result"` | 1 | Compiled; 51 P06 tests discovered, 49 failed by assertions on absent account behavior and 2 passed. Corrected sign-up row expects Forbidden (403) and receives NotFound (404). No compiler, analyzer, Docker, or host error appeared. |
| `git diff --check` | 0 | No whitespace errors. |

## Password validation fixture precedence correction (2026-11-03)

Aligned the P06 API sign-up validation fixture with DD-P06-14 and the frozen OpenAPI code catalogue: `password` (eight code points) expects `password_too_short`, and `password123` (long enough, on the common list per the existing Domain test) expects `password_too_common`. Both negative cases and their status, response-code, and no-email assertions remain. Searched the other P06 backend tests for password validation codes and found no further precedence contradiction.

| Exact command from repo root | Exit | Result |
|---|---:|---|
| `dotnet build backend/tests/ResumeBuilder.Api.Tests/ResumeBuilder.Api.Tests.csproj -c Release --no-restore > /tmp/p06-password-build.out 2>&1; result=$?; tail -18 /tmp/p06-password-build.out; exit "$result"` | 0 | Test project and dependencies compiled; 0 warnings and 0 errors. This is compile evidence, not a behavioral test pass. |
### Test Engineer fixture and contract follow-up (2026-11-03)

The P04 in-process inventory test now asserts the frozen health subset while allowing P06 account operations. HTTP account fixtures use one in-memory store instance for accounts, tokens, sessions and outbox, with HTTP cookies enabled only for those fixtures and the real-Mongo persistence fixture; production configuration has an explicit Secure and SameSite cookie assertion. Account flows read the reissued XSRF cookie after login/logout, and frontend fixtures use the contract-required `SessionInfo.user` field. New red coverage checks settings loading, CSRF bootstrap, PUT password change, session refresh and an external return-path rejection.

| Exact command from repository root | Exit code | Result |
|---|---:|---|
| `dotnet test backend/tests/ResumeBuilder.Api.Tests/ResumeBuilder.Api.Tests.csproj -c Release --no-restore --filter 'FullyQualifiedName~P06FixtureTests'` | 1 | Build succeeded; 19 fixture tests failed because `/api/v1/session` and account endpoints are still 404 in the current backend implementation. This is missing-behavior red, not a harness compilation failure. |
| `npm test --prefix frontend -- src/features/account --run` | 1 | Vitest ran 28 tests: 27 failed on the current placeholder account routes (404 page); one passed. The frontend account implementation is pending. |
| `npm run typecheck --prefix frontend` | 0 | TypeScript typecheck passed after contract type generation. |
| `npm test --prefix tests/e2e -- account.spec.ts --list > /tmp/p06-playwright-list.txt 2>&1` | 0 | Playwright parsed and listed the account spec; no browser assertions were executed. |
| `git diff --check` | 0 | No whitespace errors. |

The focused backend and frontend failures need developer implementation and a subsequent green run. The real-Mongo persistence test and browser suite were not executed in this follow-up.

### Test Engineer round 2: deterministic fixtures and deferred security red (2026-11-03)

Updated HTTP fixtures to replace durable security counters with the in-memory counter seam when present, disable both account workers, and dispatch queued email explicitly before mail assertions. Retained antiforgery and all existing response/security assertions; the unknown-token requests now each use their operation's closed request body, and production-cookie checks use an HTTPS client base address. The first account route RTL matrix now awaits asynchronous settings and provides a contract-shaped signed-in session, while reset-request RTL and Playwright cases bootstrap an anonymous session. Added concrete-store tests for concurrent single-use token consumption, plaintext token/outbox storage inspection, Mongo plus private Blob ledger persistence across restart, and deletion confirmation deduplication after a failed ledger write.

| Exact command from repo root | Exit code | Result |
|---|---:|---|
| `dotnet build backend/tests/ResumeBuilder.Api.Tests/ResumeBuilder.Api.Tests.csproj -c Release --no-restore` | 0 | Final build: 0 warnings, 0 errors. The new test project Azure Blob package was restored in the preceding `dotnet build backend/tests/ResumeBuilder.Api.Tests/ResumeBuilder.Api.Tests.csproj -c Release` command, which first exited 1 on test-source analyzer errors; those errors were corrected. |
| `dotnet format whitespace backend/ResumeBuilder.slnx --no-restore --include backend/tests/ResumeBuilder.Api.Tests/P06DeferredPersistenceTests.cs backend/tests/ResumeBuilder.Api.Tests/P06FixtureTests.cs backend/tests/ResumeBuilder.Api.Tests/P06AccountTests.cs` | 0 | Formatted only owned C# test files. |
| `dotnet test backend/tests/ResumeBuilder.Api.Tests/ResumeBuilder.Api.Tests.csproj -c Release --no-restore --filter 'FullyQualifiedName~P06DeferredPersistenceTests\|FullyQualifiedName~P06DeletionRetryDoesNotSendDuplicateConfirmation' > /tmp/p06-round2-red.out 2>&1; result=$?; rg 'Failed \|Passed \|Error Message:\|Expected:\|Actual:\|Test Run\|error ' /tmp/p06-round2-red.out \| tail -32; exit "$result"` | 1 | Four cases failed by assertions: deletion flow received 404 instead of session 200, and three persistence cases asserted that the currently absent concrete store/ledger types must exist. Mongo containers started for the token/store cases; no test compilation or container startup failure. These are missing-behavior red results, not green evidence. |
| `npm test --prefix frontend -- src/features/account/account.test.tsx --run > /tmp/p06-round2-rtl.out 2>&1; result=$?; rg 'Test Files\|Tests ' /tmp/p06-round2-rtl.out \| tail -4; exit "$result"` | 1 | RTL ran 30 cases: 29 failed on account behavior absent from the current frontend and one passed. |
| `npm run lint --prefix frontend` | 0 | ESLint passed. |
| `npm run typecheck --prefix frontend` | 0 | Generated API types and TypeScript typecheck passed. |
| `npm test --prefix tests/e2e -- account.spec.ts --list` | 0 | Playwright parsed and listed 99 account tests; no browser assertions ran in this command. |
| `git diff --check` | 0 | No whitespace errors. |

The deferred tests require the Backend Developer's concrete implementation to be integrated before behavior can be evaluated. The Blob case currently proves dual ledger persistence and restart idempotency; the account purge retry and duplicate-notification assertions are exercised separately through the deterministic HTTP fixture after implementation.

### Test Engineer P06 Blob harness compatibility follow-up (2026-11-03)

Pinned the test's direct Blob inspection client to service version `V2024_11_04`, matching the production deletion ledger client for Azurite 3.33.0. Removed the test project's duplicate `Azure.Storage.Blobs` `PackageVersion` while preserving its `PackageReference` and all persistence assertions. The existing test `packages.lock.json` already records Azure.Storage.Blobs 12.29.1 as a direct dependency, matching the central version in the Backend Developer worktree, so its contents did not require a change.

| Exact command from repo root | Exit code | Result |
|---|---:|---|
| `dotnet build backend/ResumeBuilder.slnx > /tmp/p06-harness-build.log 2>&1; result=$?; tail -20 /tmp/p06-harness-build.log; exit "$result"` | 1 | Restore failed with NU1010 because this worktree's `backend/Directory.Packages.props` does not yet contain the central Azure.Storage.Blobs version; the Backend Developer worktree has version 12.29.1. No compilation or behavioral test result is claimed. |
| `git diff --check` | 0 | No whitespace errors. |

The coordinator directed that no further build be run in this worktree and will apply the test diff in `p06-be`, where the central package version is present, then verify the build there.

## Integrated green run (coordinator, phase/P06 after merging -be and -fe, 2026-11-04)
- Command: `bash docs/phases/P06/tests/suite.cmd` — exit 0.
- Backend: Architecture 11/11, Toolchain 3/3, Api 75/75 (incl. P06 account, persistence, deferred token/storage/ledger/duplicate-mail tests). Frontend: 6 files, 40/40. E2E (3 browsers): 120/120. Contract suite and ContractReader: pass.
- Note: out-of-process HostTests (5–10 s host-start timeouts) failed intermittently while machine load average was 14–16 (other workloads); passed when rerun at lower load. Not a test change; flakiness is load-induced.
- Not yet run: formal QA manual captures and real browser zoom review (QA step).

## Review fix loop 1 - red (Test Engineer, 2026-11-04)

Added review tests without changing production code or the frozen contract. M-1 asserts that a failed deletion notice cannot block erasure and that a pending purge is surfaced by a content-free application log and succeeds on retry. M-2 inspects the real Mongo `account_tokens` indexes for a leading `TokenHash` key after a token write. M-3 checks six non-seed common passwords and case/suffix variants. M-4 checks contract `errors[].code` messages for sign-up, reset and change, plus reuse of a still-valid reset token after a policy error. M-5 uses separate A/B cookie jars to prove session, re-authentication, export, password and deletion owner isolation and rejects a logged-out cookie replay. The m-8 host inventory guard now asserts exactly the two health and twelve P06 operations. The coordinator follow-up also added m-1 duplicate-signup notice and m-10 real Mongo purge, counter and ticket-renewal cases; the other minors require broader design or production changes or belong to P03/P15/QA per review.

| Exact command from repo root | Exit | Result |
|---|---:|---|
| `dotnet test backend/tests/ResumeBuilder.Api.Tests/ResumeBuilder.Api.Tests.csproj -c Release --no-restore --filter 'FullyQualifiedName~P06CommonPasswordCorpusRejectsNonSeedEntriesAndCaseSuffixVariants\|FullyQualifiedName~P06UnauthenticatedTokenLookupHasTokenHashIndexInRealMongo\|FullyQualifiedName~P06DeletionPurgeContinuesWhenConfirmationEmailFails\|FullyQualifiedName~P06PurgeFailureIsSurfacedAndRetryableWithoutSensitiveLogData\|FullyQualifiedName~P06TwoCookieJarsKeepSessionExportPasswordAndDeletionOwnerScoped\|FullyQualifiedName~P06LoggedOutSessionCookieCannotBeReplayedAgainstAnotherAccount' > /tmp/p06-review-red-backend.log 2>&1; result=$?; rg 'error \|Failed \|Passed \|Expected:\|Actual:\|Test Run\|Total tests:\|Failed:\|Passed:' /tmp/p06-review-red-backend.log \| tail -65; exit "$result"` | 1 | Initial test-source analyzer error xUnit2031 in the new helper; corrected before behavioral evidence. |
| `dotnet test backend/tests/ResumeBuilder.Api.Tests/ResumeBuilder.Api.Tests.csproj -c Release --no-restore --filter 'FullyQualifiedName~P06CommonPasswordCorpusRejectsNonSeedEntriesAndCaseSuffixVariants\|FullyQualifiedName~P06UnauthenticatedTokenLookupHasTokenHashIndexInRealMongo\|FullyQualifiedName~P06DeletionPurgeContinuesWhenConfirmationEmailFails\|FullyQualifiedName~P06PurgeFailureIsSurfacedAndRetryableWithoutSensitiveLogData\|FullyQualifiedName~P06TwoCookieJarsKeepSessionExportPasswordAndDeletionOwnerScoped\|FullyQualifiedName~P06LoggedOutSessionCookieCannotBeReplayedAgainstAnotherAccount' > /tmp/p06-review-red-backend.log 2>&1; result=$?; rg 'error \|Failed \|Passed \|Expected:\|Actual:\|Test Run\|Total tests:\|Failed:\|Passed:' /tmp/p06-review-red-backend.log \| tail -65; exit "$result"` | 1 | 11/11 cases failed; M-3, M-2 and M-1 failures were behavior assertions, while the two M-5 cases exposed test CSRF setup mistakes corrected below. This run is not used as final red proof. |
| `dotnet test backend/tests/ResumeBuilder.Api.Tests/ResumeBuilder.Api.Tests.csproj -c Release --no-restore --filter 'FullyQualifiedName~P06TwoCookieJarsKeepSessionExportPasswordAndDeletionOwnerScoped\|FullyQualifiedName~P06LoggedOutSessionCookieCannotBeReplayedAgainstAnotherAccount' > /tmp/p06-review-isolation.log 2>&1; result=$?; rg 'error \|Failed \|Passed \|Expected:\|Actual:\|Failed:\|Passed:' /tmp/p06-review-isolation.log \| tail -30; exit "$result"` | 0 | M-5 isolation and replay tests passed, 2/2. |
| `npm test --prefix frontend -- src/features/account/account.test.tsx --run -t 'contract password\|reset password policy error' > /tmp/p06-review-red-frontend.log 2>&1; result=$?; rg 'FAIL\|PASS\|Test Files\|Tests \|AssertionError\|expected\|Unable to find\|Found multiple' /tmp/p06-review-red-frontend.log \| tail -75; exit "$result"` | 1 | Initial M-4 run: 3/3 tests failed on the generic message; reset token retry was behind the first assertion. |
| `npm test --prefix frontend -- src/features/account/account.test.tsx --run -t 'contract password\|reset password policy error' > /tmp/p06-review-red-frontend.log 2>&1; result=$?; rg -n -A 6 '^ FAIL\|Test Files\|Tests ' /tmp/p06-review-red-frontend.log \| tail -65; exit "$result"` | 1 | Final M-4 red: 4/4 assertion failures. Sign-up, reset and change display the generic message; reset retry sent only one request instead of two. |
| `dotnet test backend/tests/ResumeBuilder.Api.Tests/ResumeBuilder.Api.Tests.csproj -c Release --no-restore --filter 'FullyQualifiedName~P06CommonPasswordCorpusRejectsNonSeedEntriesAndCaseSuffixVariants\|FullyQualifiedName~P06UnauthenticatedTokenLookupHasTokenHashIndexInRealMongo\|FullyQualifiedName~P06DeletionPurgeContinuesWhenConfirmationEmailFails\|FullyQualifiedName~P06PurgeFailureIsSurfacedAndRetryableWithoutSensitiveLogData\|FullyQualifiedName~P06TwoCookieJarsKeepSessionExportPasswordAndDeletionOwnerScoped\|FullyQualifiedName~P06LoggedOutSessionCookieCannotBeReplayedAgainstAnotherAccount\|FullyQualifiedName~InBoxOpenApiInventoryMatchesFrozenP04Slice' > /tmp/p06-review-red-backend.log 2>&1; result=$?; rg -n -A 5 'Failed \|Passed \|Failed:\|Passed:\|error ' /tmp/p06-review-red-backend.log \| tail -100; exit "$result"` | 1 | Final backend red: 9 assertion failures and 3 passes. M-3 six non-seed entries return null; M-2 lacks the index; M-1 email failure leaves purge pending and ledger failure has no purge log. M-5 two cases and m-8 route inventory pass. Real Mongo container started; no build, host, port or fixture failure. |
| `npm run typecheck --prefix frontend` | 2 then 0 | First run found two new test `string \| undefined` arguments; corrected. Second run passed. |
| `npm run lint --prefix frontend` | 0 | ESLint passed. |
| `git diff --check` | 0 | No whitespace errors. |
| `python3 scripts/phase-handoff-check.py --phase P06 --role test-engineer --worktree /home/dmytro/orca/workspaces/resumiser/p06 > /tmp/p06-review-handoff.log 2>&1; result=$?; tail -35 /tmp/p06-review-handoff.log; exit "$result"` | 0 | Scope and blueprint passed; suite was red as required, but backend CI exited 2 on a whitespace rule in a new test. Fixed with the next command. |
| `dotnet format whitespace backend/ResumeBuilder.slnx --no-restore --include backend/tests/ResumeBuilder.Api.Tests/InProcessContractTests.cs backend/tests/ResumeBuilder.Api.Tests/P06DeferredPersistenceTests.cs backend/tests/ResumeBuilder.Api.Tests/P06FixtureTests.cs backend/tests/ResumeBuilder.Api.Tests/P06UnitTests.cs` | 0 | Formatted only owned C# test files. |
| `bash scripts/ci/backend.sh > /tmp/p06-review-backend-ci.log 2>&1; result=$?; rg 'error WHITESPACE\|error [A-Z]\|Failed!\|Passed!\|Failed:\|Passed:' /tmp/p06-review-backend-ci.log \| tail -25; exit "$result"` | 1 | Build/format passed. Architecture 11/11, Toolchain 3/3; Api 77 pass, 9 expected assertion reds. |

The focused red runs were sequential. The full phase suite is intentionally red until the Backend and Frontend Developers fix M-1–M-4.

### Coordinator follow-up within review fix loop 1

Stabilized the existing out-of-process host harness by launching the built API DLL directly and waiting for readiness for up to 20 seconds, while preserving every response, rate-limit and safe-startup assertion. A duplicate sign-up now has a red assertion for the existing-address notice; the prior bodyless 202 and no-disclosure assertions remain. Added direct real Mongo purge and security-counter tests, plus a session ticket renewal test at the 14-day sliding and 30-day absolute boundaries.

| Exact command from repo root | Exit | Result |
|---|---:|---|
| `dotnet format whitespace backend/ResumeBuilder.slnx --no-restore --include backend/tests/ResumeBuilder.Api.Tests/HostTests.cs backend/tests/ResumeBuilder.Api.Tests/P06DeferredPersistenceTests.cs backend/tests/ResumeBuilder.Api.Tests/P06FixtureTests.cs` | 0 | Formatted only owned C# tests. |
| `dotnet test backend/tests/ResumeBuilder.Api.Tests/ResumeBuilder.Api.Tests.csproj -c Release --no-restore --filter 'FullyQualifiedName~UntrustedForwardingCannotEvadeSharedHealthLimit\|FullyQualifiedName~MalformedMongoConfigurationFailsStartupWithoutEchoingValue\|FullyQualifiedName~P06UnknownSignupIsSameBodylessAcceptance\|FullyQualifiedName~P06RealMongoPurgeRemovesAccountTokenSessionAndOutboxAfterLedger\|FullyQualifiedName~P06RealMongoSecurityCountersEnforceAtomicEmailQuotaAndLoginBackoff\|FullyQualifiedName~P06CookieTicketRenewalSlidesButNeverExceedsThirtyDayAbsoluteExpiry' > /tmp/p06-review-followup.log 2>&1; result=$?; rg -n -A 7 'error \|Failed \|Passed \|Failed:\|Passed:' /tmp/p06-review-followup.log \| tail -90; exit "$result"` | 1 | Six cases compiled and ran: duplicate-signup notice failed by assertion (expected 2 messages, actual 1); two host cases and real Mongo purge, atomic counter/backoff and session-renewal cases passed (5/5). No build, host, port or container error. |
| `bash scripts/ci/backend.sh > /tmp/p06-review-backend-followup-ci.log 2>&1; result=$?; rg 'error WHITESPACE\|error [A-Z]\|Failed!\|Passed!\|Failed:\|Passed:' /tmp/p06-review-backend-followup-ci.log \| tail -30; exit "$result"` | 1 | Full backend job built and passed formatting. Architecture 11/11 and Toolchain 3/3 passed; Api 79 passed, 10 failed by the expected M-1–M-3 and m-1 assertions. Both formerly flaky HostTests passed under suite load. |
| `python3 scripts/phase-handoff-check.py --phase P06 --role test-engineer --worktree /home/dmytro/orca/workspaces/resumiser/p06 > /tmp/p06-review-handoff-final.log 2>&1; result=$?; tail -35 /tmp/p06-review-handoff-final.log; exit "$result"` | 0 | `RESULT PASS`: role scope 7 owned files, phase scope and blueprint pass; backend, frontend and E2E commands are red on the intentional new assertions; contract commands pass. The coordinator's concurrent log line was committed before this run. |

## Review fix loop 1 — green (operator, single-operator mode ADR-051, 2026-11-04)

From here the phase runs under [ADR-051](../../../blueprint/decisions/ADR-051-single-operator-phase-execution.md):
one session plans, writes the tests, implements and records evidence, with Codex as the external reviewer only.
The red state below was produced and verified by that session before any production change.

### Red baseline inherited from the Test Engineer, re-verified before implementing

| Exact command from repo root | Exit | Result |
|---|---:|---|
| `bash scripts/ci/backend.sh` | 1 | Architecture 11/11 and Toolchain 3/3 passed. Api: **79 passed, 10 failed** — six `P06CommonPasswordCorpusRejectsNonSeedEntriesAndCaseSuffixVariants` rows (M-3), `P06UnauthenticatedTokenLookupHasTokenHashIndexInRealMongo` (M-2), `P06DeletionPurgeContinuesWhenConfirmationEmailFails` and `P06PurgeFailureIsSurfacedAndRetryableWithoutSensitiveLogData` (M-1), `P06UnknownSignupIsSameBodylessAcceptance` (m-1). Every failure was an assertion on missing behaviour; the real Mongo container started and no host, port or fixture error occurred. |

### M-1, M-2, M-3 and m-1 green

| Exact command from repo root | Exit | Result |
|---|---:|---|
| `dotnet build backend/src/ResumeBuilder.Domain/ResumeBuilder.Domain.csproj -c Release` | 0 | Bundled common-password resource compiles into the Domain assembly, 0 warnings. |
| `dotnet test backend/tests/ResumeBuilder.Api.Tests/ResumeBuilder.Api.Tests.csproj -c Release --filter 'FullyQualifiedName~P06PasswordPolicyTests\|FullyQualifiedName~P06UnitTests'` | 1 then 0 | First run: 10 passed, 1 failed — the six M-3 rows passed but `P06LengthCountsUnicodeCodePointsAtInclusiveBoundaries` broke, because an added "two or fewer distinct characters" rule rejected the repeated-code-point and 128-character passwords that this accepted test requires to be valid. The rule was unrequested scope and was removed; the test was not touched. Second run: **11/11 passed**. |
| `dotnet build backend/ResumeBuilder.slnx -c Release` | 1 then 0 | CA1848 rejected direct `LogWarning` calls in Infrastructure; replaced with `LoggerMessage.Define` delegates in `DeletionLogs`. Then build succeeded, 0 warnings. |
| `dotnet test ... --filter 'FullyQualifiedName~P06DeletionPurgeContinuesWhenConfirmationEmailFails\|FullyQualifiedName~P06PurgeFailureIsSurfacedAndRetryableWithoutSensitiveLogData'` | 1 then 0 | First run: M-1b passed, M-1a failed with `Expected: Unauthorized / Actual: Forbidden`. Diagnosis: `SignUpVerifyAndLogin` returns the CSRF token reissued **at login**, which ASP.NET antiforgery binds to the authenticated identity; the purge removes that identity, so the retry was answered 403 before login ran. This is a harness gap in the new test, not a product defect — other cases bootstrap a token per flow. Fixed by re-bootstrapping an anonymous token before the retry; **the 401 assertion and every other assertion are unchanged**. Second run: **2/2 passed**. |
| `dotnet test ... --filter 'FullyQualifiedName~P06UnknownSignupIsSameBodylessAcceptance'` | 0 | m-1 duplicate-signup notice: **1/1 passed** (two messages, one "Verify email", one "Account already exists" to the stored address, no `#t=`/`#token=` in the notice body). |
| `dotnet test backend/tests/ResumeBuilder.Api.Tests/ResumeBuilder.Api.Tests.csproj -c Release` | 1 | **88 passed, 1 failed.** All ten review reds are green, including the real-Mongo `TokenHash` index case. The single failure is `HostTests.ReadinessSucceedsWhenPinnedMongoResponds`, the known load-induced out-of-process host-start timeout already recorded in this file; other builds were running concurrently. Re-verified in the full suite run below. |

### DD-P06-15 login/reset concurrency — red before green

Checkpoints are one-shot `TaskCompletionSource` rendezvous with a 10-second bound, so a schedule that never
reaches its checkpoint fails the test instead of hanging the run. No `Sleep`, `Task.Delay`, polling or
probabilistic loop establishes any race. The real `AccountUseCases` runs for both login and reset; the synthetic
hasher returns a distinct value per call so old, rehashed and reset credentials are distinguishable.

| Exact command from repo root | Exit | Result |
|---|---:|---|
| `dotnet test ... --filter 'FullyQualifiedName~P06LoginResetRaceTests'` (first attempt, before bounded waits) | — | Run hung instead of failing: the current `LoginAsync` never reaches the post-create account read, so the checkpoint was never signalled. Stopped and corrected by bounding every rendezvous, as DD-P06-15 requires ("bounded waits may fail a hung test but do not schedule it"). |
| `dotnet test ... --filter 'FullyQualifiedName~P06LoginResetRaceTests'` (red proof) | 1 | **10 failed, 4 passed of 14.** Failures only: `Assert.Null() Failure: Value is not null` (login returns a session that a completed reset must have invalidated), `Assert.Equal() Expected: 1 Actual: 0` (`CompareExchangeAttempts` — login still used the unconditional setter), `Assert.Throws`/`ThrowsAny` "No exception was thrown" (no post-create read exists to fail), and `TimeoutException` on the checkpoints that the missing code path never reaches. The 4 passes are the controls: ordinary login, wrong password, the inverse-order regression and compare-and-set semantics on the fake. No build, host, port or fixture error. |
| `dotnet build backend/ResumeBuilder.slnx -c Release` | 0 | After implementing the compare-and-set port, the Mongo conditional `FindOneAndUpdate` and the login ordering. |
| `dotnet test ... --filter 'FullyQualifiedName~P06LoginResetRaceTests'` (green) | 0 | **14/14 passed** in 121 ms. |
| `dotnet test ... --filter 'FullyQualifiedName~P06LoginThatLosesToAConcurrentResetAnswersPlainInvalidCredentials\|FullyQualifiedName~P06RealMongoCompareExchangePasswordHashIsConditionalAndHasASingleWinner'` | 1 then 0 | First run: the real-Mongo compare-and-set case passed (stale hash, missing id, equal replacement, deletion-marked account and two barrier contenders with a single winner); the HTTP case failed `Expected: NoContent / Actual: BadRequest` because the reset-confirm body field was written as `password` instead of the contract's `newPassword`. Corrected the request, no assertion changed. Second run: **passed** — the losing login answers 401 `invalid_credentials`, with no `__Host-rb_session` cookie and no concurrency-specific wording in the body. |

### m-5 credential lifetime, and the M-3 corpus corrected

| Exact command from repo root | Exit | Result |
|---|---:|---|
| `dotnet build backend/ResumeBuilder.slnx -c Release` (after declaring `IAccountTokenStore.DeleteForAccountAndPurposeAsync`, its Mongo implementation and the three test fakes, with no call site yet) | 0 | Scaffold compiles, so the m-5 red state below is an assertion failure rather than a compile error. |
| `dotnet test ... --filter 'FullyQualifiedName~P06LoginResetRaceTests'` (m-5 red) | 1 | **1 failed, 15 passed of 16.** `P06PasswordChangeInvalidatesAnOutstandingResetToken` failed `Assert.False() Expected: False Actual: True` — a reset link issued before a password change was still redeemable afterwards. `P06ResetTokenCannotBeRedeemedTwice` passed, confirming single use was already correct. |
| `dotnet test ... --filter 'FullyQualifiedName~P06LoginResetRaceTests'` (m-5 green) | 0 | **16/16 passed** after `ChangePasswordAsync` deletes outstanding password-reset tokens between persisting the new hash and the awaited revoke-all, preserving the DD-P06-15 ordering. |

While writing those cases a defect was found in test code written earlier in this session: `RaceStore.SeedResetToken`
stored the token record under a fresh dictionary key instead of the record's own id, so `TryConsumeAsync` would have
written the consumed copy under a second key and left an unconsumed duplicate behind — a fake that could hide a
double-redemption defect. Fixed, and `P06ResetTokenCannotBeRedeemedTwice` now covers the behaviour.

**M-3 corpus corrected.** The first attempt recorded that this environment had no network access and shipped a
hand-curated list of about 590 entries. That was wrong: the initial download failed with HTTP 404 because the
upstream SecLists path had changed, not because the host was unreachable. Verified by fetching the repository
README (200) and the GitHub contents API (200), then listing the directory to find the current filename.

| Exact command | Exit | Result |
|---|---:|---|
| `curl -sSL .../Passwords/Common-Credentials/xato-net-10-million-passwords-100000.txt` | 0 | `http=200 size=781879`, 100,000 lines. Contains `password`, `password1234`, `qwertyuiop`, `1234567890` and `1234567890a`. |
| Normalisation replay over the installed corpus (lowercase, de-duplicate, keep entries of at least 4 characters: 96,441 entries) against every password value the suite uses | 0 | **0 false positives** across the 22 values that must stay valid, **0 misses** across the 13 that must be rejected. The replay first reported 2 false positives, `signup-password` reducing to `signup` and `current-password` to `current`; the trailing-letter rule was narrowed to fire only when a pure digit run remains, which is the `1234567890a` case it existed for. |

### Integrated green run used as gate evidence (operator, 2026-11-04)

| Exact command from repo root | Exit | Result |
|---|---:|---|
| `bash docs/phases/P06/tests/suite.cmd` | **0** | Architecture 11/11, Toolchain 3/3, **Api 107/107**, Frontend 6 files / 44 tests, E2E 120/120 across three browsers, contract suite and `ContractReader` pass. This run built and exercised the installed upstream password corpus and every change in this loop. |

The previous run of the same command, taken before the corpus was corrected, was also exit 0 with Api 105/105; the
two added cases are the m-5 credential-lifetime pair. `HostTests.ReadinessSucceedsWhenPinnedMongoResponds`, which
failed once earlier in this session while other builds ran concurrently, passed in both full-suite runs — the
flakiness is load-induced, as already recorded above, and no test was changed for it.

## Review fix loop 2 — external review majors and the acceptance pass (operator, 2026-11-04)

The external review (`review/code-review.md`, pass 2) returned FAIL with two majors; the acceptance pass found
a third defect that neither reviewer nor any test had caught. All three were proven red before the fix.

| Exact command from repo root | Exit | Result |
|---|---:|---|
| `dotnet test backend/tests/ResumeBuilder.Api.Tests/ResumeBuilder.Api.Tests.csproj -c Release --no-build --filter 'FullyQualifiedName~P06DeletionBacklogBeyondOneBatch\|FullyQualifiedName~P06DeletionDueListReturnsTheOldestRequestsFirst\|FullyQualifiedName~P06PermanentlyFailingOutboxMessageDoesNotBlockLaterMail'` (red) | 1 | **3 failed of 3**, all assertion failures. Ordering: the due list came back in insertion order. Backlog: `person-120@example.invalid`, the first account behind a batch of 120 failing purges, was still present — the starvation the review described. Outbox: the permanently rejected message blocked the pass. |
| `dotnet build backend/ResumeBuilder.slnx -c Release` | 0 | After adding `Attempts`/`NextAttemptAt` to `AccountOutboxRecord`, `AccountOutboxPolicy`, the reschedule-shaped `ReleaseClaimAsync`, oldest-first claiming with a backoff filter, oldest-first due listing and backlog paging in the processor. |
| same filter (green) | 0 | **3/3 passed.** |
| `npm test --prefix frontend -- --run src/features/account/account.test.tsx -t 'keeps keyboard focus'` (red) | 1 | **2 failed**, both `expect(element).toHaveFocus()`. After a rejected sign-up and a rejected login, focus was on `<body>`: the submit button is disabled while the request runs and nothing restored focus on failure. |
| `npm run lint --prefix frontend` | 1 then 0 | **48 `react-hooks/refs` errors** on the first attempt: returning refs (and then callback refs closing over them) from `useSubmission` made every later `submission.busy` read look like a ref access during render. Reworked to locate the focus target in the DOM inside the effect, scoped to the open dialog when there is one, so the hook holds no refs at all. Second run clean, and `npm run typecheck --prefix frontend` clean. |
| `npm test --prefix frontend -- --run` (green) | 0 | **46/46**, then **49/49** after the claim-seam cases below. |
| `node /tmp/p06-qa/focus-check.mjs` (browser, after the fix) | 0 | `/sign-up` rejection focuses `#signup-password` with `aria-invalid="true"` and a 3 px ring; `/login` rejection focuses the announced error notice, also with a 3 px ring after adding `.notice.error:focus` (`:focus-visible` does not fire for programmatic focus on a non-interactive element). |

### Coverage gap closed during the acceptance pass

AC-P06-10 requires a positive and a negative case for the guest claim seam, and `ClaimDraft` had none in RTL
or E2E — it was correct by inspection only. Three cases were added: no claim action without a draft summary,
an explicit Save / Discard / Later choice with initial focus on the non-destructive option and no callback
fired by rendering alone, and the draft title rendered as text rather than markup.

### Acceptance pass commands

| Exact command | Exit | Result |
|---|---:|---|
| `npm run build --prefix frontend` | 0 | Built the bundle the browser pass serves. |
| `node /tmp/p06-qa/acceptance.mjs docs/phases/P06/qa-evidence` | 0 | Layout, state, dialog, keyboard, 200% zoom, contrast, reduced-motion and negative checks, plus the screenshot set. Numbers in `qa-report.md`. |
| `node /tmp/p06-qa/acceptance2.mjs docs/phases/P06/qa-evidence` | 0 | The checks the first script measured imprecisely: real submit-button width (the first `main button` is the password reveal control, not the submit), dialog focus containment judged against interactive page controls rather than `document.body`, focus-ring contrast, the 390 px settings nav, and field-level validation from contract error codes. |

Two faults in the acceptance harness were found and corrected before any product conclusion was drawn: the
synthetic host crashed on a `content-type: undefined` header for 204 responses, and it returned
`application/json` without an issue `location`, which made review finding M-4 look unfixed. The client's
stricter parsing is correct per the contract; the fixture was wrong. The scripts live outside the repository
under `/tmp/p06-qa/`; the commands above record what ran.

The first attempt at this suite run failed at the E2E step with
`http://127.0.0.1:4173 is already used` — the acceptance pass had left a `vite preview` server on the port
Playwright starts for itself. Backend 110/110 and frontend 49/49 passed in that run; the server was stopped
and the suite re-run in full.

### Gate evidence — final integrated run (operator, 2026-11-04)

| Exact command from repo root | Exit | Result |
|---|---:|---|
| `bash docs/phases/P06/tests/suite.cmd` | **0** | Architecture 11/11, Toolchain 3/3, **Api 110/110**, Frontend 6 files / **49 tests**, **E2E 120/120** across Chromium, Firefox and WebKit, contract suite and `ContractReader` pass. |
| `node /tmp/p06-qa/acceptance.mjs` and `acceptance2.mjs`, re-run against this build | 0, 0 | Every acceptance observation in `qa-report.md` reproduced on the shipped bundle: 1120 px auth canvas with a 493 px (44%) decorative region, 480 px form column, 220 px settings nav with a 720 px content column, no horizontal overflow at 1280/1024/390 px or at 200% zoom, submit spanning the form column, native modal dialog with initial focus on Cancel and focus returned to the trigger, no page control outside the dialog ever focused, contrast 6.38–14.94:1 against a 4.5:1 requirement, focus ring 5.02:1 against 3:1, and no non-zero transition under `prefers-reduced-motion: reduce`. The login error now reads the contract-mapped "Invalid credentials. Try again." |

## Delta re-review minor, and the closing gate run (operator, 2026-11-04)

The delta re-review returned PASS with one minor: the outbox policy was named and documented as a quarantine
while implementing a 30-day delay, and the new test advanced only ten hours, asserting neither the attempt
count nor the deferral boundary.

| Exact command from repo root | Exit | Result |
|---|---:|---|
| `dotnet build backend/ResumeBuilder.slnx -c Release` | 0 | `MaxDeliveryAttempts`/`IsQuarantined` renamed to `FastRetryAttempts`/`IsDeferredLong`, `LongDeferral` exposed, backoff corrected to 1, 2, 4, 8, 16 minutes, and the documentation now states that the message is deferred rather than abandoned. |
| `dotnet test ... --filter 'FullyQualifiedName~P06PermanentlyFailingOutboxMessageDoesNotBlockLaterMail'` | 0 | **1/1.** Now asserts the attempt count after each failure, that every wait inside the fast-retry window is under an hour, that the fifth failure yields exactly `LongDeferral`, and that the message is not claimable one minute before the deferral elapses but is one minute after. |
| `dotnet test ... --filter 'FullyQualifiedName~P06RealMongoOutboxClaimsLegacyRowsAndHonoursTheDeferral'` | 0 | **1/1** against a real Mongo replica set: an outbox document with `Attempts` and `NextAttemptAt` stripped — a row written before those fields existed — is still claimed with `Attempts = 0`, a deferral written onto it is honoured on both sides of the boundary, and claiming is oldest-first across rows. |
| `bash docs/phases/P06/tests/suite.cmd` | **0** | Closing run: Architecture 11/11, Toolchain 3/3, **Api 111/111**, Frontend 6 files / 49 tests, **E2E 120/120**, contract suite and `ContractReader` pass. |

While fixing this minor, two mistakes of mine were caught before they reached the gate: an assertion written
so convolutedly that it tested nothing (replaced with the wait-duration check above), and a `sed` that
rewrote a line in an unrelated existing test (restored, and the unrelated test still passes).
