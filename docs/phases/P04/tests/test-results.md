# Test Results

No tests executed yet. Record exact commands, environment, exit code, pass/fail counts and artifacts. Never mark tests passed without running them.

## Test Engineer red evidence — 2026-11-03

Environment: Linux, .NET SDK `10.0.301` / test runtime `.NET 10.0.9`; P04 production projects absent. No Docker-dependent test was run. Tests use only fictional loopback Mongo settings; no resume or contact fixture was written.

| Exact command (repository root) | Exit | Result |
|---|---:|---|
| `dotnet restore backend/tests/ResumeBuilder.Architecture.Tests/ResumeBuilder.Architecture.Tests.csproj && dotnet restore backend/tests/ResumeBuilder.Api.Tests/ResumeBuilder.Api.Tests.csproj && dotnet test backend/tests/ResumeBuilder.Architecture.Tests/ResumeBuilder.Architecture.Tests.csproj --no-restore -c Release --logger 'console;verbosity=normal'` | 1 | Both restores succeeded. Architecture assembly compiled; 1 passed (synthetic forbidden-edge checker), 8 failed at expected missing P04 source/project assertions. |
| `dotnet test backend/tests/ResumeBuilder.Api.Tests/ResumeBuilder.Api.Tests.csproj --no-restore -c Release --logger 'console;verbosity=minimal'` | 1 | Initial harness compile failure `xUnit1051`; corrected test cancellation token use before red claim. |
| `dotnet test backend/tests/ResumeBuilder.Api.Tests/ResumeBuilder.Api.Tests.csproj --no-restore -c Release --logger 'console;verbosity=minimal'` | 1 | Harness compiled; 3 failed at `Required Api host project is missing`, the intended missing-host prerequisite. |
| `bash docs/phases/P04/tests/suite.cmd` | 0 | The shell proceeds through every line; locked restore and Release build passed for the existing P03-only solution, both focused P04 test commands failed as above, P02 contract tests passed 66/66, and the P02 .NET reader completed with its existing diagnostic warnings. Overall shell exit reflects only the last command, so it is not a green P04 verdict. |

Known gap: this dispatch has not implemented the test plan's Mongo-positive readiness, trusted/untrusted forwarding, exception injection, startup configuration, structured log capture, in-box OpenAPI inventory, strict DTO round-trip or JSON Schema checks. The current P04 suite is therefore incomplete despite meaningful initial red tests. Next owner: Test Engineer completion before Backend Developer.

## Test Engineer red completion — 2026-11-03

Environment: Linux, .NET 10.0.301. The four P04 production projects and Api host are absent, so the new host tests stop at an explicit missing-project prerequisite. The Mongo-positive test checks that prerequisite before starting Docker; Docker availability was not assessed in this red run. Only fictional local connection settings and synthetic marker values were used; no marker appears in this report or test failure text.

| Exact command (repository root) | Exit | Result |
|---|---:|---|
| `dotnet restore backend/tests/ResumeBuilder.Api.Tests/ResumeBuilder.Api.Tests.csproj` | 0 | Restored new Testcontainers, WebApplicationFactory, YamlDotNet and JsonSchema.Net test dependencies and updated the test lockfile. |
| `dotnet test backend/tests/ResumeBuilder.Architecture.Tests/ResumeBuilder.Architecture.Tests.csproj --no-restore -c Release --filter 'FullyQualifiedName~LoggingGuardRejectsContentTypedFields' --logger 'console;verbosity=minimal'` | 0 | Synthetic unsafe logging call rejected; 1 passed. |
| `dotnet test backend/tests/ResumeBuilder.Api.Tests/ResumeBuilder.Api.Tests.csproj --no-restore -c Release --filter 'FullyQualifiedName~ContractDriftTests|FullyQualifiedName~ExceptionTests' --logger 'console;verbosity=minimal'` | 1 | Compiled; 7 contract example, inventory comparison and schema tests passed, 1 exception host test failed because the built Api host assembly is missing. |
| `dotnet test backend/tests/ResumeBuilder.Architecture.Tests/ResumeBuilder.Architecture.Tests.csproj --no-restore -c Release --logger 'console;verbosity=minimal'` | 1 | Compiled; 2 synthetic guard tests passed, 9 checks failed on the absent P04 source/projects. |
| `dotnet test backend/tests/ResumeBuilder.Api.Tests/ResumeBuilder.Api.Tests.csproj --no-restore -c Release --logger 'console;verbosity=minimal'` | 1 | Compiled; 7 contract tests passed, 11 host, Mongo, proxy, exception, logging and in-box inventory tests failed on the absent Api project/assembly. No Docker-dependent operation ran. |
| `bash docs/phases/P04/tests/suite.cmd` | 1 | Locked restores and existing P03 solution Release build passed; `set -e` stopped at the expected red architecture suite (9 failed, 2 passed). API and P02 commands were not reached by this direct shell run. |
| `python3 scripts/phase-handoff-check.py --phase P04 --role test-engineer --worktree .` | 0 | `RESULT PASS`; role scope, phase scope and blueprint passed. Its suite parser executed all commands independently: P04 architecture/API each exit 1 as expected; unchanged P02 `npm ci`, `npm test` and .NET contract reader each exit 0. |

The new cases cover a pinned Mongo-positive readiness probe, both trusted and untrusted forwarding, malformed and missing configuration, test middleware exception injection, structured log capture, source logging guards, in-box OpenAPI inventory, strict example round-trips and JSON Schema 2020-12 checks on live health/problem responses. Host-dependent assertions remain red until the Backend Developer adds the P04 projects; the isolated Mongo fixture still needs a Docker-backed green run after that implementation. The suite now returns a nonzero exit at the first failing command while the handoff checker continues each line for red-state evidence.

## Backend Developer implementation evidence — 2026-11-03

Environment: Linux, .NET SDK 10.0.301, .NET runtime 10.0.9; Docker-backed Mongo test used the pinned image from `infrastructure/images.lock`. Commands ran from the repository root, sequentially. No real credentials or resume data were used.

| Exact command | Exit | Result |
|---|---:|---|
| `dotnet restore backend/ResumeBuilder.slnx` | 1 | Initial restore rejected vulnerable transitive `Microsoft.OpenApi` 2.0.0 (NU1903). |
| `dotnet restore backend/ResumeBuilder.slnx` | 0 | Passed after centrally pinning patched 2.12.2; four project lockfiles created. |
| `dotnet build backend/ResumeBuilder.slnx -c Release --no-restore` | 1 | Initial code compile errors; corrected endpoint cast and structured logging delegates. |
| `dotnet build backend/ResumeBuilder.slnx -c Release --no-restore` | 0 | Four projects and toolchain canary built with zero warnings. |
| `RESUMISER_MONGO_IMAGE=$(sed -n 's/^MONGO=//p' infrastructure/images.lock) bash docs/phases/P04/tests/suite.cmd > /tmp/p04-suite.log 2>&1; result=$?; tail -80 /tmp/p04-suite.log; exit "$result"` | 1 | Locked restore and Release build passed; architecture 11/11 passed; API 9 passed, 9 failed. Three failures used an incorrect test assembly path; six host tests could not start because the test harness selected port 0. The suite stopped before P02 commands. |

Green evidence is blocked by the test harness. In `InProcessContractTests`, `LoggingTests` and `ExceptionTests`, `../../../../src` from the test output directory resolves to `backend/tests/src`; it needs one more parent traversal. In `HostTests.Host.Start`, `TcpListener.Create(0)` is never started before `LocalEndpoint.Port` is read, leaving the selected port at 0. Next owner: Test Engineer to correct these harness issues, then redispatch Backend Developer for any implementation failures.
| `python3 scripts/phase-handoff-check.py --phase P04 --role backend-developer --worktree .` | 1 | Role and phase scopes plus blueprint passed; suite check failed only at P04 API tests; architecture 11/11 and P02 commands passed. `RESULT FAIL`, `SUITE_RED` (1 of 10 commands). |

## Test Engineer harness fix — 2026-11-03

Environment: Linux, .NET SDK 10.0.301, Docker-backed Mongo image pinned by `infrastructure/images.lock`. Corrected the three Api assembly paths, started the ephemeral port listener before reading its port, and supplied WebApplicationFactory with the Api dependency manifest and source content root. Existing assertions, contract, and acceptance criteria were not changed.

| Exact command (repository root) | Exit | Result |
|---|---:|---|
| `RESUMISER_MONGO_IMAGE=$(sed -n 's/^MONGO=//p' infrastructure/images.lock) bash docs/phases/P04/tests/suite.cmd > /tmp/p04-harness-suite.log 2>&1; suite_status=$?; tail -100 /tmp/p04-harness-suite.log; exit "$suite_status"` | 1 | Locked restores and Release build passed; architecture 11/11 passed; Api 11 passed and 7 failed. Three in-process tests reached WebApplicationFactory but needed its Api `.deps.json` and content root; four HTTP tests reached the host and exposed response-writing failures. Suite stopped before P02 commands. |
| `RESUMISER_MONGO_IMAGE=$(sed -n 's/^MONGO=//p' infrastructure/images.lock) dotnet test backend/tests/ResumeBuilder.Api.Tests/ResumeBuilder.Api.Tests.csproj -c Release --no-restore --logger 'console;verbosity=minimal' > /tmp/p04-api-harness.log 2>&1; test_status=$?; rg '^  Failed \|^Failed!\|^Passed!\|^  Error Message:\|^   ' /tmp/p04-api-harness.log \| head -75; exit "$test_status"` | 1 | Api 11 passed and 7 failed; the three in-process failures now reached Api startup but WebApplicationFactory used a nonexistent default content root. |
| `dotnet test backend/tests/ResumeBuilder.Api.Tests/ResumeBuilder.Api.Tests.csproj -c Release --no-restore --filter 'FullyQualifiedName~InProcessContractTests\|FullyQualifiedName~ExceptionTests\|FullyQualifiedName~LoggingTests' --logger 'console;verbosity=minimal' > /tmp/p04-inprocess.log 2>&1; test_status=$?; tail -65 /tmp/p04-inprocess.log; exit "$test_status"` | 1 | All three selected tests reached the application. OpenAPI inventory failed because the requested `IOpenApiDocumentProvider` service was null; exception injection escaped the request pipeline; logging test reached the readiness response and exposed a response-headers-already-started exception in `Program.WriteProblem`. |
| `RESUMISER_MONGO_IMAGE=$(sed -n 's/^MONGO=//p' infrastructure/images.lock) bash docs/phases/P04/tests/suite.cmd > /tmp/p04-harness-final.log 2>&1; suite_status=$?; rg 'Passed!\|Failed!\|Failed ResumeBuilder' /tmp/p04-harness-final.log; exit "$suite_status"` | 1 | Locked restores and Release build passed; architecture 11/11 passed; Api 11 passed, 7 failed, 0 skipped. P02 commands were not reached because `set -e` stops at the Api failures. |

Remaining red Api tests: `InProcessContractTests.InBoxOpenApiInventoryMatchesFrozenP04Slice` (OpenAPI provider lookup returns null; assess registration/keyed-service test access), `ExceptionTests.UnexpectedHealthExceptionUsesContentFreeContractedProblem` (synthetic exception from test startup filter escapes middleware; assess injection point), `LoggingTests.CapturedApplicationLogsExcludeSyntheticRequestMetadataAndNonOperationalFields`, `HostTests.ReadinessFailsWithoutMongoButDoesNotIdentifyDependency`, `HostTests.UntrustedForwardingCannotEvadeSharedHealthLimit`, `HostTests.SharedRateLimitRejectsRequest601WithRetryAfter`, and `HostTests.ConfiguredTrustedProxyPartitionsForwardedClients`. The latter five expose the production `Program.WriteProblem` header write after response start (`backend/src/ResumeBuilder.Api/Program.cs:74`); Backend Developer must correct that behavior. The first two need Test Engineer review of their setup before assigning production blame. No resume content or real credentials were used.

| Exact command (repository root) | Exit | Result |
|---|---:|---|
| `python3 scripts/phase-handoff-check.py --phase P04 --role test-engineer --worktree . > /tmp/p04-handoff-harness.log 2>&1; check_status=$?; tail -45 /tmp/p04-handoff-harness.log; exit "$check_status"` | 0 | `RESULT PASS`: role and phase scopes, blueprint, and expected red-state gate passed. Checker ran all suite lines independently: locked restores, build, architecture 11/11, and P02 commands passed; Api command exited 1. |

## Backend Developer continuation — 2026-11-03

Environment: Linux, .NET SDK 10.0.301, pinned Mongo image from `infrastructure/images.lock`. Only production code changed. The P04 suite remains red because two Test Engineer rate-limit cases count one unasserted startup request as if it did not consume a permit.

| Exact command (repository root) | Exit | Result |
|---|---:|---|
| `dotnet build backend/ResumeBuilder.slnx -c Release --no-restore` | 0 | Final build passed with zero warnings and errors. |
| `dotnet test backend/tests/ResumeBuilder.Api.Tests/ResumeBuilder.Api.Tests.csproj -c Release --no-restore --filter 'FullyQualifiedName~InProcessContractTests\|FullyQualifiedName~ExceptionTests\|FullyQualifiedName~LoggingTests' --logger 'console;verbosity=minimal'` | 1 | Before logger category correction: 2 passed, 1 failed. The subsequent full P04 suite passed all three. |
| `RESUMISER_MONGO_IMAGE=$(sed -n 's/^MONGO=//p' infrastructure/images.lock) bash docs/phases/P04/tests/suite.cmd > /tmp/p04-suite-final.log 2>&1; result=$?; rg 'Passed!\|Failed!\|Failed ResumeBuilder\|Build succeeded\|error ' /tmp/p04-suite-final.log \| tail -30; exit "$result"` | 1 | Build and architecture 11/11 passed; Api 16 passed, 2 failed. Suite stopped before P02 commands. |
| `dotnet build backend/ResumeBuilder.slnx -c Release --no-restore > /tmp/p04-build4.log 2>&1 && RESUMISER_MONGO_IMAGE=$(sed -n 's/^MONGO=//p' infrastructure/images.lock) dotnet test backend/tests/ResumeBuilder.Api.Tests/ResumeBuilder.Api.Tests.csproj -c Release --no-restore --filter 'FullyQualifiedName~SharedRateLimitRejectsRequest601WithRetryAfter\|FullyQualifiedName~UntrustedForwardingCannotEvadeSharedHealthLimit' --logger 'console;verbosity=minimal' > /tmp/p04-rate.log 2>&1` | 1 | Build passed; both selected tests failed because a loop request was already 429. |

`HostTests.Host.Start` performs a successful `GET /health/live` to detect readiness before it returns. `SharedRateLimitRejectsRequest601WithRetryAfter` and `UntrustedForwardingCannotEvadeSharedHealthLimit` then expect all 600 loop requests to avoid 429, followed by a 429. The startup request is the first permit on that same host and IP, so the 600th loop request is correctly rejected by the contracted 600-per-minute global limiter. The Test Engineer should account for the startup permit in these two tests; no production change can satisfy their current count without violating the rate limit. Final handoff check result follows below.
| `python3 scripts/phase-handoff-check.py --phase P04 --role backend-developer --worktree . > /tmp/p04-handoff-continuation.log 2>&1; result=$?; tail -18 /tmp/p04-handoff-continuation.log; exit "$result"` | 1 | Role scope, phase scope and blueprint passed; architecture and P02 commands passed; API suite failed on the rate-limit startup-permit mismatch, so checker returned `SUITE_RED`. |

## Rate-limit test fix — Test Engineer, 2026-11-03

`Host.Start` sends and now asserts a successful `GET /health/live` before either rate-limit case begins. Each affected loop sends 599 more requests, so the startup probe plus loop assert all 600 allowed permits, and the following request asserts 429; the existing `Retry-After`, `rate_limited`, schema, and forwarding assertions remain intact.

| Exact command (repository root) | Exit code | Result |
| --- | ---: | --- |
| `RESUMISER_MONGO_IMAGE=$(sed -n 's/^MONGO=//p' infrastructure/images.lock) bash docs/phases/P04/tests/suite.cmd > /tmp/p04-rate-limit-fix-suite.log 2>&1; result=$?; tail -80 /tmp/p04-rate-limit-fix-suite.log; exit "$result"` | 0 | Restore and Release build succeeded; architecture 11/11, API 18/18, P02 contract 66/66 passed; .NET contract reader completed. Docker-backed Mongo test ran as part of the API suite. |

No production-code failure remains in the full P04 suite.

| Exact command (repository root) | Exit code | Result |
| --- | ---: | --- |
| `python3 scripts/phase-handoff-check.py --phase P04 --role test-engineer --worktree . > /tmp/p04-rate-limit-fix-handoff.log 2>&1; result=$?; tail -45 /tmp/p04-rate-limit-fix-handoff.log; exit "$result"` | 0 | `RESULT PASS`; role scope, phase scope, and blueprint checks passed. Its internal suite did not receive `RESUMISER_MONGO_IMAGE`, so the Docker-backed readiness case failed as expected for missing test environment; the checker accepted this Test Engineer red-state run. The separately run full suite above passed with the pinned image supplied. |

## Suite self-containment — Test Engineer, 2026-11-03

The API test command in `suite.cmd` now resolves `RESUMISER_MONGO_IMAGE` from the pinned `MONGO=` entry in `infrastructure/images.lock` when the caller leaves it unset. It preserves a supplied image and exits with an explicit error if no image is available. The handoff checker executes each suite line in a fresh shell, so the resolution is on the API test command line.

| Exact command (repository root) | Exit code | Result |
| --- | ---: | --- |
| `python3 scripts/phase-handoff-check.py --phase P04 --role backend-developer --worktree .` | 1 | All 10 suite commands exited 0: Release build, architecture 11/11, API 18/18 including pinned Docker Mongo readiness, and P02 contract commands passed. Overall `RESULT FAIL` came only from `ROLE_SCOPE` and `TEST_MODIFIED`: this uncommitted Test Engineer-owned `suite.cmd` edit is outside backend-developer ownership. |
| `python3 scripts/phase-handoff-check.py --phase P04 --role test-engineer --worktree .` | 0 | `RESULT PASS`; both changed files are Test Engineer-owned, phase scope and blueprint passed, and all 10 suite commands exited 0. The check emitted its expected role-specific warning that no red suite command remained. |
## Review cycle 1 — Test Engineer, 2026-11-03

Strengthened C-1 assertions across every captured log category, including query and exception markers; strengthened M-4 source guards to inspect all Api `.cs` source outside `obj`/`bin`, including `Program.cs` after the composition-root build boundary, plus `LoggerMessage.Define` templates and `SafeLogs` arguments. Production code was not edited. Environment: Linux, .NET SDK 10.0.301; commands ran from the repository root.

| Exact command | Exit code | Result |
| --- | ---: | --- |
| `dotnet test backend/tests/ResumeBuilder.Architecture.Tests/ResumeBuilder.Architecture.Tests.csproj -c Release --no-restore --filter 'FullyQualifiedName~ArchitectureTests'` | 0 | 11/11 passed after the final guard edit; the source guard reads the current `Program.cs` and its two `LoggerMessage.Define` templates. |
| `dotnet test backend/tests/ResumeBuilder.Api.Tests/ResumeBuilder.Api.Tests.csproj -c Release --no-restore --filter 'FullyQualifiedName~LoggingTests\|FullyQualifiedName~ExceptionTests'` | 1 | 0 passed, 2 failed as intended. `LoggingTests` found the request metadata marker in a framework log message; `ExceptionTests` found the query marker in `Microsoft.AspNetCore.Hosting.Diagnostics` messages and the exception marker in `Microsoft.AspNetCore.Diagnostics.ExceptionHandlerMiddleware` exception data. |

The two API failures are the required red state for C-1. The Backend Developer must suppress these framework disclosures while preserving content-free application events; the M-4 architecture guards should remain green.

| Exact command | Exit code | Result |
| --- | ---: | --- |
| `python3 scripts/phase-handoff-check.py --phase P04 --role test-engineer --worktree .` | 1 | Blueprint passed, architecture 11/11 passed, and API red state was accepted. Overall `ROLE_SCOPE` failed because concurrent Solution Architect edits to `architecture/phase-plan.md`, `decisions.md`, and `implementation/backend-tasks.md` are uncommitted in the shared worktree; these files were not edited by the Test Engineer. |

### DD-P04-05 health URL test update

After the Solution Architect committed DD-P04-05, changed the HTTP test requests and exception-injection path to `/api/v1/health/*`, asserted the contract server `/api/v1` resolves the frozen raw path keys to those public URLs, required the in-box inventory to expose the public URLs, and added a check that root health aliases return 404.

| Exact command | Exit code | Result |
| --- | ---: | --- |
| `dotnet test backend/tests/ResumeBuilder.Api.Tests/ResumeBuilder.Api.Tests.csproj -c Release --no-restore --filter 'FullyQualifiedName~ContractDriftTests\|FullyQualifiedName~InProcessContractTests\|FullyQualifiedName~LoggingTests\|FullyQualifiedName~ExceptionTests\|FullyQualifiedName~RootHealthAliasesAreAbsent'` | 1 | 7 passed, 4 failed against the current root-only host. In-box inventory lacks `GET /api/v1/health/live`; logging test received 404 instead of 503; root-alias test startup received 404 instead of 200; exception test still caught the framework query and exception marker disclosures. |
| `python3 scripts/phase-handoff-check.py --phase P04 --role test-engineer --worktree .` | 0 | `RESULT PASS`: seven Test Engineer-owned changed files, phase scope and blueprint passed; architecture 11/11 passed; API suite remained red as intended; P02 contract commands exited 0. |

## Backend Developer — review cycle 1, 2026-11-03

Production changes: disabled framework log categories while retaining allow-listed `ResumeBuilder.Api` operational events; mapped both health routes under `/api/v1` with no root aliases; added both P04 test projects to the solution; formatted production source with `dotnet format`. Existing Test Engineer test files were left unchanged.

| Exact command | Exit code | Result |
| --- | ---: | --- |
| `bash docs/phases/P04/tests/suite.cmd` (started during source edit) | 1 | Stale build: 11/11 architecture tests passed; 10/19 API tests failed against old routes/logging. Superseded by the clean rerun below. |
| `dotnet format backend/ResumeBuilder.slnx --no-restore` | 0 | Formatted production source and seven Test Engineer-owned test files; restored those seven tests to committed contents immediately to respect ownership. |
| `dotnet format backend/ResumeBuilder.slnx --verify-no-changes --no-restore` | 2 | Remaining whitespace violations are exclusively in seven Test Engineer-owned files; separate Test Engineer formatting step required. |
| `bash docs/phases/P04/tests/suite.cmd` | 0 | Clean rerun: Release build 0 warnings/errors, architecture 11/11, API 19/19, P02 contract 66/66, OpenAPI reader completed. |
| `bash scripts/ci/local.sh backend` | 1 | Docker-backed backend job: locked restore and Release solution build passed with 0 warnings/errors; `dotnet format --verify-no-changes` failed on seven Test Engineer-owned test sources before solution tests could run. No CI green claim. |
| `python3 scripts/phase-handoff-check.py --phase P04 --role backend-developer --worktree .` | 0 | `RESULT PASS`: backend role scope 7 files, phase scope, blueprint and full P04 suite green. |

## Format step — Test Engineer, 2026-11-03

Formatted only seven Test Engineer-owned C# test files. `git diff -w --exit-code -- backend/tests` returned 0, confirming no assertion or logic change; `git diff --check` returned 0. Production files were untouched and the solution format verification passed. Commands ran from the repository root on Linux with Docker and .NET SDK 10.0.301.

| Exact command | Exit code | Result |
| --- | ---: | --- |
| `dotnet format backend/ResumeBuilder.slnx --no-restore` | 0 | Changed only seven files under `backend/tests/`; one indentation case in `ExceptionTests.cs` still failed CI verification and was corrected as whitespace only. |
| `bash scripts/ci/local.sh backend` | 1 | First run: locked restore and Release build passed; format verification reported three remaining whitespace errors in `ExceptionTests.cs`. |
| `dotnet format backend/ResumeBuilder.slnx --verify-no-changes --no-restore` | 0 | Passed after correcting the three indentation lines; no production formatting violations. |
| `bash scripts/ci/local.sh backend` | 0 | Docker-backed rerun passed: build 0 warnings/errors, architecture 11/11, toolchain 3/3, API 19/19. |
| `bash docs/phases/P04/tests/suite.cmd` | 0 | Locked restores and Release build passed; architecture 11/11, API 19/19, P02 contract 66/66, OpenAPI reader completed. |
| `git diff -w --exit-code -- backend/tests` | 0 | No non-whitespace changes in test files. |
| `git diff --check` | 0 | No diff whitespace errors. |
| `python3 scripts/phase-handoff-check.py --phase P04 --role test-engineer --worktree .` | 0 | `RESULT PASS`: eight owned files, phase scope and blueprint passed; all ten suite commands exited 0. |
