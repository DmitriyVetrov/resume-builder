# P04 Code Review — Backend Foundation

Reviewer: Code Reviewer (Claude), 2026-11-03. Scope: `git diff main...HEAD` at `b62273f` (11 commits, 37 files), reviewed once per ADR-035 B-2.

Verdict: FAIL

One critical finding (content leaks into logs, which AC-P04-04/05 and NFR-13 forbid) and four major findings block the gate. The layering, health behaviour, rate-limit arithmetic, error envelope and test-integrity judgements are otherwise sound. Findings are ranked below; "Required fix" names the owner.

## Inputs and method

Read: `CLAUDE.md`, `.claude/rules/*`, `PHASE.md`, `kickoff.md`, `architecture/phase-plan.md`, `decisions.md`, `acceptance-criteria.md`, `tests/test-plan.md`, `tests/test-results.md`, `coordinator-log.md`, `implementation/backend-tasks.md`, the OpenAPI health operations, `Problem`, and ADR-038. Read every changed source and test file. Compared per-commit file lists (`git show --stat`) and the red-to-green test diff (`git diff 2286d81 HEAD -- backend/tests docs/phases/P04/tests/suite.cmd`).

Commands I ran (repository root unless stated):

| Command | Exit | Result |
|---|---:|---|
| `git archive HEAD \| tar -x -C /tmp/p04-clean`, then in the copy: `dotnet restore --locked-mode` for the solution, the Architecture tests and the Api tests; `dotnet build backend/ResumeBuilder.slnx -c Release --no-restore`; `dotnet test` on the Architecture tests | 0 | Clean checkout restores under locked mode and builds with 0 warnings and 0 errors. Architecture tests 11/11 passed. |
| Built Api host started from `bin/Release` with a fictional unreachable Mongo URI; `curl` with a marker in the query string, `Authorization` and `X-Forwarded-For` headers, an unknown route, and 620 requests with rotating `X-Forwarded-For` and no trusted proxy | 0 | `/health/live` returned 200 and the unknown route 404. Exactly 22 requests out of 622 got 429, so forged forwarded headers did not change the rate-limit identity (this passes). Console output contained the query marker (see C-1). |
| `dotnet test backend/tests/ResumeBuilder.Api.Tests/... -c Release --no-restore --filter FullyQualifiedName~ExceptionTests` | 0 | 1 passed. |
| `dotnet ResumeBuilder.Api.Tests.dll -class ResumeBuilder.Api.Tests.ExceptionTests` (in `bin/Release/net10.0`, to see the host console) | 0 | Test passes, yet the host console printed the synthetic exception text and stack trace (see C-1). |
| `dotnet format backend/ResumeBuilder.slnx --verify-no-changes --no-restore` (in `backend/`) | 2 | 75 `WHITESPACE` violations (see M-2). |

I did not re-run the full Docker-backed phase suite. I rely on the recorded evidence in `test-results.md` (architecture 11/11, API 18/18, P02 contract 66/66, all exit 0 per the Test Engineer and handoff check) for the Mongo-positive readiness case. The temporary clean copy and scratch directory were removed; no repository file other than this report was edited.

## Findings

### Critical

**C-1. Framework logging writes request metadata and exception content to the log; the tests cannot see it.**
- Files: `backend/src/ResumeBuilder.Api/Program.cs:11-13`, `Program.cs:93-101` (exception boundary); `backend/tests/ResumeBuilder.Api.Tests/LoggingTests.cs:40` and `ExceptionTests.cs:47` (category filter). No `appsettings*.json` exists, so every category logs at `Information`.
- Evidence (observed, not inferred):
  1. `GET /health/live?secret=SYNTH-QUERY-MARKER` produced `Request starting HTTP/1.1 GET http://127.0.0.1:5987/health/live?secret=SYNTH-QUERY-MARKER` and `Request finished ...` lines from `Microsoft.AspNetCore.Hosting.Diagnostics`. An unknown route logged its full path and query (`/nope/SYNTH-PATH?email=a@b.c`).
  2. Running `ExceptionTests` through the xUnit runner (test passes) printed `fail: Microsoft.AspNetCore.Diagnostics.ExceptionHandlerMiddleware[1] An unhandled exception has occurred ... System.InvalidOperationException: synthetic-exception-private-marker` plus a stack trace. `UseExceptionHandler` always logs the exception before the custom handler runs.
- Impact: Violates AC-P04-04 ("does not expose exception text, request data"), AC-P04-05 ("a synthetic sensitive request/exception value does not appear in captured logs"), the phase plan ("never ... query values, headers ... "), NFR-13 and `.claude/rules/03-security-privacy.md`. In P06/P07 exception messages and query strings can carry email addresses or document content, and this is the foundation they inherit. The tests pass because they assert only on entries whose category starts with `ResumeBuilder`, so they never examine the framework categories that leak. `AC-P04-05` is therefore not met, though the suite is green.
- Required fix:
  - Backend Developer: configure logging in code (there is no appsettings file) so that `Microsoft.AspNetCore.Hosting.Diagnostics`, `Microsoft.AspNetCore.Diagnostics.ExceptionHandlerMiddleware` and other framework categories cannot emit request URLs, queries or exception objects (for example `Warning` or `None` filters for those categories, or a replacement exception handler that does not log the exception). Keep the allow-listed `ResumeBuilder.Api` events as the only request and error logs.
  - Test Engineer (separate step, a strengthening change not a weakening one): assert the markers are absent from all captured categories, not only `ResumeBuilder*`, in `LoggingTests` and `ExceptionTests`. Add the query-string marker to the exception test.

### Major

**M-1. The P04 test projects are not in the solution, so CI never builds or runs them.**
- Files: `backend/ResumeBuilder.slnx` (lists the four `src` projects and only `ResumeBuilder.Toolchain.Tests`); `scripts/ci/backend.sh` builds and tests `ResumeBuilder.slnx` only.
- Impact: `ResumeBuilder.Architecture.Tests` (layering rules, AC-P04-01) and `ResumeBuilder.Api.Tests` (health, rate limit, contract drift) run only via `docs/phases/P04/tests/suite.cmd`. The CI `backend` job, which P03 documented as the same checks as local, would pass without any layering or contract-drift enforcement. Note also that `Api.Tests` hard-codes `bin/Release` paths and needs the Api built first, so adding it needs build-order care.
- Required fix: Backend Developer adds both test projects to `backend/ResumeBuilder.slnx` (allowed path) and makes the Release build order and CI run work (`scripts/ci/backend.sh` is outside P04 scope; if it needs a change, report it to the coordinator). Evidence: `bash scripts/ci/local.sh backend` green.

**M-2. `dotnet format --verify-no-changes` fails; the CI backend job would fail.**
- Files: `backend/src/ResumeBuilder.Api/Program.cs` (50 violations), `backend/src/ResumeBuilder.Infrastructure/MongoReadiness.cs` (24), `backend/src/ResumeBuilder.Application/Foundation.cs` (1). Reproduced: exit 2, all `WHITESPACE`.
- Impact: `scripts/ci/backend.sh` runs this verify step between build and test. The developer evidence in `test-results.md` shows the phase suite but never the CI script, so this went unnoticed. The test projects, once added under M-1, may need the same check.
- Required fix: Backend Developer runs `dotnet format backend/ResumeBuilder.slnx` and records `bash scripts/ci/local.sh backend` (or at least `scripts/ci/backend.sh`) exit codes in `test-results.md`.

**M-3. Health route base path is unresolved against the contract.**
- Files: `contracts/openapi/openapi.yaml:122-123` (`servers: - url: /api/v1`) with paths `/health/live` and `/health/ready` at `:142` and `:164`; `Program.cs:62,64`; `phase-plan.md` ("Health paths are at the server root as contracted").
- Impact: Read literally, OpenAPI resolves the operations to `/api/v1/health/live` and `/api/v1/health/ready`. The host serves them at `/health/*` and every test (and the in-box inventory comparison, which strips server prefixes) agrees with that, so nothing would detect a mismatch. The phase plan asserts "root as contracted", but the contract has no per-path server override or text saying so. P05 frontend clients and mocks generated from the contract will target `/api/v1/health/...`.
- Required fix (decision outside this role): Solution Architect records an explicit `DELEGATED-DEFAULT` decision. My recommended default is to serve under `/api/v1` exactly as contracted (and optionally keep container probes on that path), because the contract is the single source of truth and any root alias would be an undocumented operation. If root is chosen instead, a Contract Architect step must add a path-level `servers` override. Tests and README follow whichever is chosen.

**M-4. Two architecture source guards are vacuous for the production code they are meant to protect.**
- File: `backend/tests/ResumeBuilder.Architecture.Tests/ArchitectureTests.cs`.
- `EndpointSourceDoesNotUsePersistenceSdk` inspects only `.cs` files whose name contains `Endpoint`. All P04 endpoints are in `Program.cs`, so zero files are checked and the test always passes.
- `ApiLoggingCallsContainOnlyOperationalScalarFields` matches `LogInformation(`-style calls. Production logging goes through `LoggerMessage.Define` in `SafeLogs`, so zero calls are matched.
- Impact: Two Must negative cases (AC-P04-01 endpoint isolation, AC-P04-05 source guard) are not actually enforced, although the synthetic checker tests prove the matcher logic works on a hand-made sample. Behavioural log capture (C-1) is the only real defence, and it is also blind (see C-1).
- Required fix: Test Engineer scans all Api source (excluding `obj`/`bin`) for persistence SDK namespaces outside the composition root, and extends the log guard to `LoggerMessage.Define` templates and `SafeLogs` argument names, or asserts that these are the only logging call sites.

### Minor

**m-1. DD-P04-04 asks for typed, validated Mongo options; the host reads `Mongo:ConnectionString` directly** (`Program.cs:14-17`). Startup does fail with a generic message and no value echo (verified by `MalformedMongoConfigurationFailsStartupWithoutEchoingValue`), so the criterion holds, but the recorded decision is not followed. Suggested fix: bind a small options record with `ValidateOnStart`, or record the simplification in `decisions.md`.

**m-2. `Retry-After` is a fixed `"60"`** (`Program.cs:32`) rather than the limiter's remaining window. Valid per contract (integer ≥ 0) but clients wait up to 60 s when 1 s remains. Use `context.Lease.TryGetMetadata(MetadataName.RetryAfter, ...)` with a fallback.

**m-3. `MongoReadiness` creates a new `MongoClient` on every uncached probe and never disposes it** (`MongoReadiness.cs:23-26`). The driver caches clusters by settings so growth is bounded, but the intended pattern is one client. Also, a failed probe produces no log line, so an outage is invisible to operators. Suggested fix: create the client once in the constructor (dispose it in `Dispose`), and emit a content-free `readiness_failed` event with the existing `SafeLogs` shape.

**m-4. Stale text in `backend/README.md:9`** ("after the Test Engineer corrects the harness defects recorded in P04 test results"). The defects are fixed; reword.

**m-5. Rate-limited (429) and failed requests are not covered by the completion log.** The completion middleware sits after `UseRateLimiter`, so rejections leave no allow-listed log and abuse is invisible. Consider logging a `rate_limited` event.

### Info

- **i-1.** Test seam in production: `AddSingleton<IOpenApiDocumentProvider>` (keyed `"v1"` lookup) and `public partial class Program` exist so tests can reach the in-box document. No runtime OpenAPI route is mapped, which keeps the operation inventory exact (good). Acceptable; keep it documented.
- **i-2.** Forwarded headers accept only `X-Forwarded-For` and individual `KnownProxies` IPs; unparsable entries are silently dropped (fail-safe: nothing becomes trusted). Azure Container Apps ingress will likely need CIDR support and `X-Forwarded-Proto` in P13/P14; track it there.
- **i-3.** `Api.Tests` and `LoggingTests` locate `bin/Release/net10.0`, so they fail with "built Api host assembly is missing" under a default Debug `dotnet test`. This is consistent with the suite and CI (both Release), but it is a trap for local runs. Document it in the README.

## Checklist results

| Area | Result |
|---|---|
| Scope vs Allowed paths | PASS. All 37 changed files are under `docs/phases/P04/`, `backend/src/*`, `backend/tests/{Architecture,Api}.Tests`, `backend/ResumeBuilder.slnx`, `backend/Directory.Packages.props` or `backend/README.md`. No `frontend/`, `contracts/`, `docs/source/`, P05 or canary edits. |
| Role ownership | PASS. Backend Developer commits (`0be8e76`, `e4b5ce3`) touch no test files. Test Engineer commits (`9dd3427`, `5dc353f`, `b62273f`) touch no production files. `Directory.Packages.props` change (Microsoft.OpenApi 2.12.2, Microsoft.AspNetCore.OpenApi 10.0.9) is a security pin for NU1903, appropriately recorded. |
| Layering and dependency direction | PASS. Domain has no references or packages; Application references Domain only; Infrastructure references Application (+ Mongo driver); Api references Application and Infrastructure, and only the composition root (`Program.cs`) names `MongoReadiness`. `IReadinessProbe` abstraction lives in Application; no resume model or repository was added. |
| Contract fit | PASS for the P04 operations: statuses `200/429/503/default`, `application/json` and `application/problem+json`, anonymous, `Problem` shape with W3C `traceId` (matches the contract example). Open item: base path, M-3. |
| Readiness and liveness | PASS. Liveness is process-only; readiness is a 2 s bounded ping with a 5 s result cache, generic 503 without dependency name, endpoint or timing. |
| Rate limiting and proxy trust | PASS. Fixed window 600/min per direct peer IP applied globally; forwarded headers are honoured only from configured known proxies. Verified live: rotating forged `X-Forwarded-For` produced exactly 22 rejections in 622 requests, i.e. the identity did not change. Improvement: m-2. |
| Error envelope | PASS. 429, 503 and 500 use `application/problem+json` with `title`, `status`, `code`, `traceId`; no detail echo. |
| Logging and privacy | FAIL. See C-1. The allow-listed `ResumeBuilder.Api` events themselves are clean. |
| Secrets and config | PASS. No secrets in the repo; connection string from environment only; startup failure message is generic. |
| Locked restore and build | PASS (clean checkout, 0 warnings). Formatting fails (M-2). |

## Test integrity judgement

- **Harness fixes (`9dd3427`): accepted.** Changes are the corrected `../../../../../src` path depth (three Api test files), `UseContentRoot`, `listener.Start()` before reading the ephemeral port, and a `Copy` target for `ResumeBuilder.Api.deps.json` in the test project. No assertion was removed or relaxed, no test was skipped, and the contract and acceptance criteria are untouched. These were genuine harness defects (`backend/tests/src` did not exist; an unstarted `TcpListener` reports port 0).
- **Added strictness:** `Host.Start` now asserts the readiness-detection `GET /health/live` is `200`, which also makes the startup permit explicit.
- **Rate-limit count change (`5dc353f`): accepted, consistent with the contracted 600/min limit.** The original loops sent 600 requests after `Host.Start` had already consumed one permit, i.e. 601 allowed requests, which contradicts the contract (ADR-038 `global` = 600 per minute per IP) and could never pass without breaking the limiter. The new test sends 1 asserted startup request + 599 loop requests = exactly 600 allowed, then asserts request 601 gets 429 with `Retry-After`, `code=rate_limited` and a schema-valid `Problem`. The boundary is therefore tight at 600/601 on both sides; the same applies to the untrusted-forwarding case, and `ConfiguredTrustedProxyPartitionsForwardedClients` was not changed. The Backend Developer correctly refused to loosen the limiter and escalated instead.
- **`suite.cmd` self-containment (`b62273f`): accepted.** It resolves `RESUMISER_MONGO_IMAGE` from the pinned `MONGO=` line of `infrastructure/images.lock` when unset, keeps a supplied image, and fails explicitly when none exists. It does not skip or soften any test. The test itself still requires a digest-pinned image.
- **Not accepted as sufficient:** passing the green suite does not prove AC-P04-05 or the endpoint-isolation rule, because the log tests filter on category (C-1) and two source guards match nothing (M-4). These are gaps in the original test design, not in the later fixes.

## Acceptance criteria status (code-review view)

| AC | View |
|---|---|
| AC-P04-01 | Build and layering pass; the endpoint-isolation rule is unenforced (M-4) and CI does not run the rules (M-1). |
| AC-P04-02 | Pass (liveness, readiness 200/503, no dependency leak). Base path to be settled (M-3). |
| AC-P04-03 | Pass (600/min, 429 with `Retry-After`, untrusted forwarding ignored, trusted proxy partitions). |
| AC-P04-04 | Response envelope and startup behaviour pass; the unhandled exception text still reaches the log (C-1). |
| AC-P04-05 | Not met (C-1, M-4). |
| AC-P04-06 | Pass per recorded suite evidence (inventory, strict round-trip, JSON Schema validation of live bodies). |

## Re-review scope

Per ADR-035 B-2, a re-review covers only files changed after this review: `Program.cs` logging configuration and exception handling, `MongoReadiness.cs`, `backend/ResumeBuilder.slnx`, formatting, the updated `LoggingTests`/`ExceptionTests`/`ArchitectureTests`, the M-3 decision record and `test-results.md` entries for the CI script run.

## Report

- Summary: review complete; verdict FAIL (1 critical, 4 major, 5 minor, 3 info).
- Files changed: `docs/phases/P04/review/code-review.md` only.
- Risks: C-1 is a privacy defect that later phases would inherit; M-3 can mislead the P05 client work running in parallel.
- Open question for the Solution Architect: M-3 base path (recommended default `/api/v1`, as contracted).
- Next owner: Backend Developer (C-1, M-1, M-2, m-items), Test Engineer (C-1 tests, M-4), Solution Architect (M-3), then the coordinator redispatches a delta review.

## Re-review cycle 1

Reviewer: Code Reviewer (Claude), 2026-11-03. Delta of `220e39d` (my FAIL commit) to `6671396` (17 files; contracts, `docs/source`, frontend and the P02 suite untouched). Reviewed per ADR-035 B-2 (cycle 1 of max 2); only files changed since the first review were examined.

Verdict: PASS

All one critical and four major findings are closed with direct evidence. The minor and info items from the first review (m-1…m-5, i-1…i-3) were not in the fix scope; they remain non-blocking, and m-4 is now partly addressed (README rewritten for the new URLs, but still says "after the Test Engineer corrects the harness defects").

### Commands run (repository root unless stated)

| Command | Exit | Result |
|---|---:|---|
| `git diff -w 220e39d HEAD -- backend/src backend/ResumeBuilder.slnx backend/README.md` | 0 | Production changes are exactly: logging min level `None` plus one `ResumeBuilder.Api` `Information` filter; the two route strings; the two test projects in the solution; README URLs. `MongoReadiness.cs` and `Foundation.cs` are whitespace-only. |
| `git diff -w 220e39d HEAD -- backend/tests` | 0 | See "Test integrity" below. |
| `dotnet restore ResumeBuilder.slnx --locked-mode`, `dotnet build ... -c Release -warnaserror --no-restore`, `dotnet format ResumeBuilder.slnx --verify-no-changes --no-restore` (in `backend/`) | 0 / 0 / 0 | 0 errors, 0 warnings; the format verify now passes for the full solution (was exit 2 with 75 violations). |
| `bash scripts/ci/local.sh backend` | 0 | `backend PASS`: Architecture 11/11, Toolchain 3/3, Api 19/19, all three test projects discovered through the solution. |
| Built Api host from `bin/Release` on `127.0.0.1:5991` with an unreachable Mongo URI; `curl` with `?secret=SYNTH-QUERY-MARKER`, `Authorization: Bearer SYNTH-AUTH`, an unknown route `/nope/SYNTH-PATH?email=a@b.c`, and `/health/live` at the root | 0 | `/api/v1/health/live` 200, `/api/v1/health/ready` 503, root `/health/live` 404, unknown route 404. Console output holds only four `ResumeBuilder.Api[2] request_complete ...` lines (event, code, trace id, route template, status, elapsed). `grep -c SYNTH` on the log = 0. |
| `dotnet ResumeBuilder.Api.Tests.dll -class ResumeBuilder.Api.Tests.ExceptionTests` (in `bin/Release/net10.0`, host console visible) | 0 | 1 passed. Console shows only `fail: ResumeBuilder.Api[1] request_failed internal_error <trace> unknown 500`; no exception message, no stack trace, no query marker (previously the `ExceptionHandlerMiddleware` text and stack trace printed). |

### Finding status

- **C-1 — CLOSED.** `Program.cs:14-15` sets the minimum level to `None` and re-enables only the `ResumeBuilder.Api` category at `Information`, so `Microsoft.AspNetCore.Hosting.Diagnostics`, `ExceptionHandlerMiddleware` and every other framework category are silent. Verified live for both the request path (query, header, path markers) and the exception path, reproducing the exact scenarios that leaked before. Note for later phases: this also silences framework warnings (for example data-protection or Kestrel errors). That is acceptable as a privacy-first default, but when P13/P14 add telemetry the operational errors need an explicit content-safe route; track it there. A more granular allow-list (`Warning` for non-HTTP framework categories) is an option and not required now.
- **M-1 — CLOSED.** `backend/ResumeBuilder.slnx` lists `ResumeBuilder.Architecture.Tests` and `ResumeBuilder.Api.Tests`; `scripts/ci/local.sh backend` builds and runs both (11 + 19 tests) in Release. `scripts/ci/backend.sh` needed no change.
- **M-2 — CLOSED.** `dotnet format --verify-no-changes` exit 0 for the whole solution; `local.sh backend` exit 0. The separate Test Engineer formatting step (`6671396`) touched only test files and the diff there is whitespace-only (`git diff -w` shows no semantic change beyond the intended strengthening below).
- **M-3 — CLOSED.** `decisions.md` DD-P04-05 (`DELEGATED-DEFAULT`) adopts the contract-resolved `/api/v1/health/*` with no root alias, matching my recommended default. `Program.cs` maps only the two `/api/v1/health/*` routes with unchanged operation IDs, anonymous access, statuses and media types; the contract is unmodified; `phase-plan.md`, `backend-tasks.md` and `backend/README.md` agree. New test `RootHealthAliasesAreAbsent` asserts 404 at the root, and `ContractDriftTests` now derives `/api/v1` from the contract's `servers` block and asserts the resolved public URLs, and `InProcessContractTests` asserts the in-box inventory on the public URLs. Verified live: root returns 404.
- **M-4 — CLOSED.** `EndpointSourceDoesNotUsePersistenceSdk` now scans every Api `.cs` file outside `obj`/`bin`, asserts at least one file was inspected, and for `Program.cs` checks the code after `var app = builder.Build();` (the composition root before it may name `MongoReadiness`; this matches the layering rule). `ApiLoggingCallsContainOnlyOperationalScalarFields` now asserts that production `LoggerMessage.Define<` and `SafeLogs.Complete/Failure(` sites exist and checks them against the operational-field allow-list; the checker self-test gained cases for `LoggerMessage.Define` and `SafeLogs.Failure` arguments. Both guards are therefore non-vacuous and pass against real code.

### Test integrity

`git diff -w` over `backend/tests` shows only strengthening or URL moves; no assertion was weakened, removed or skipped:
- All host calls, the startup probe, rate-limit loops and the exception-injection path match moved to `/api/v1/health/*`; permit accounting (1 startup + 599 loop + 1 rejected) is unchanged.
- `LoggingTests` and `ExceptionTests` now assert the markers are absent from all captured entries (every category), not only `ResumeBuilder*`; the allowed-field assertion is kept for the application entries; a query-string marker was added to the exception test.
- New tests: `RootHealthAliasesAreAbsent`; server-aware public URL assertions; non-empty and call-site-presence assertions in the architecture guards.
- The remaining diff lines are indentation only (file-wide `dotnet format` normalisation).
- Contract (`contracts/openapi/`), acceptance criteria and `tests/contract/` are untouched.

### Acceptance criteria (updated)

AC-P04-01 pass (layering enforced and run by CI; endpoint isolation now enforced). AC-P04-02 pass at the contracted public URLs. AC-P04-03 pass. AC-P04-04 pass (no exception text in response or logs). AC-P04-05 pass (framework categories silenced; all-category capture test plus live reproduction). AC-P04-06 pass (19/19 including contract inventory and schema validation).

### Limits of this re-review

`local.sh backend` ran the Api tests including `ReadinessSucceedsWithTestcontainersMongo` (19/19) with Docker. `scripts/phase-handoff-check.py --phase P04 --role code-reviewer --worktree .` (exit 0, RESULT PASS) also ran the full phase suite `suite.cmd`: 10 commands, all exit 0, including the P02 contract suite (no contract or `tests/contract` change in the delta). Remaining non-blocking items for QA/later phases: m-1…m-5 and i-1…i-3 above, plus the logging-granularity note under C-1.

### Report

- Summary: delta re-review complete; Verdict: PASS (C-1, M-1, M-2, M-3, M-4 closed).
- Files changed: `docs/phases/P04/review/code-review.md` only (appended this section; the first-pass record at the top of this file is preserved unchanged).
- Next owner: QA, then the coordinator gate.
