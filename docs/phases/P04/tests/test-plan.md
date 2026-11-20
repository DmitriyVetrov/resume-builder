# P04 Test Plan — Backend Foundation

Owner: Test Architect, 2026-11-03. Inputs: P04 `PHASE.md`, `kickoff.md`, `architecture/phase-plan.md`, `decisions.md`, `acceptance-criteria.md`; frozen OpenAPI v1.0.0; ADR-008, ADR-038, ADR-040 and ADR-041. The Test Engineer owns executable tests, the suite script and red evidence. The Backend Developer implements after meaningful red tests; QA records final acceptance evidence.

## Budget, levels and setup

- Cover every Must criterion below with at least one positive and one negative case. Use xUnit v3, `WebApplicationFactory`, project-reference/reflection checks, the P03 MongoDB Testcontainers canary pattern, `JsonSchema.Net` for JSON Schema 2020-12 and the existing P02 contract suite. `coverlet.collector` is diagnostic, never a pass gate. Add no test framework, new CLI or large fixture tree.
- Put architecture checks in `backend/tests/ResumeBuilder.Architecture.Tests/**` and host, HTTP and contract-drift checks in `backend/tests/ResumeBuilder.Api.Tests/**`. Use a shared in-process factory per scenario, then dispose it so rate-limit state and logging capture cannot leak between cases. Tests use only synthetic values and the contract's published examples; no real connection strings, accounts or resume data.
- A single isolated Mongo fixture starts the P03 pinned MongoDB image, waits for its readiness, and supplies a local connection setting. A stopped/unreachable endpoint with a short bounded timeout supplies the negative readiness case. No Blob, SMTP, paid service or persistent records are needed. Testcontainers cleanup must run even after assertion failure.
- Test-only middleware may throw before an existing health endpoint to exercise the global exception handler; it must not register another HTTP operation. Capture log entries in memory and assert on fields as well as rendered messages. Keep synthetic sensitive markers out of test output and artifacts: assertions report only a field name or a Boolean failure, never the marker or captured payload.
- Use fixed loopback peer addresses and a configured trusted-proxy address for forwarding tests. Fresh hosts isolate IP partitions. Keep the 600-request threshold test within one limiter window without sleep or retries; if wall-clock replenishment makes it nondeterministic, give the limiter a test-controlled clock/replenishment while preserving its production limit and policy. A missing Docker daemon/image is an explicit environment failure, not a passed or silently skipped test.

Levels in scope: architecture/unit for dependency and configuration rules; API integration for health, rate limiting, errors and logs; contract for inventory, examples and live response schemas. Frontend component, browser E2E, rendering, persistence and load testing are outside P04. The 600-request boundary is a policy test, not a performance benchmark.

## Acceptance mapping and case catalogue

| Criterion | Level and positive case | Negative or boundary case | Fixture / oracle |
|---|---|---|---|
| **AC-P04-01** | **A01-P**: locked restore and Release build on `net10.0` include all four projects. Fitness checks assert Domain → BCL only, Application → Domain only, Infrastructure → Application/Domain, and Api → Application with Infrastructure only in composition root; endpoint types contain no Mongo/storage SDK references. | **A01-N**: feed the same reference checker a minimal synthetic graph with Application → Infrastructure and assert the precise forbidden edge is reported. Also reject an endpoint type carrying a Mongo SDK reference. | `*.csproj`/assets and compiled assembly references; a tiny in-memory graph/type sample, not a committed fixture tree. Enforce ADR-008 F-BE-1…4, including cross-module repository-interface ownership when such an interface exists; absence of such interfaces is checked explicitly in P04. |
| **AC-P04-02** | **H02-P**: anonymous `GET /health/live` and `GET /health/ready` each return 200 `application/json`, exactly `{"status":"ok"}` when Mongo ping responds. | **H02-N**: with Mongo unavailable, liveness still returns 200 and readiness returns 503 `application/problem+json`, `code=service_unavailable`, matching the contract schema; body has no dependency name, endpoint or timing. A bounded timeout prevents a hung probe. | `WebApplicationFactory` and one isolated P03 Mongo Testcontainer; inspect actual wire media type, status and body, including anonymous access. |
| **AC-P04-03** | **R03-P**: a fresh host permits 600 requests per minute for one IP across both health routes; the trusted configured proxy can supply a forwarded client IP. | **R03-N**: request 601 for the same IP gets 429 `Problem` with `code=rate_limited` and integer `Retry-After` ≥ 0. Rotate untrusted `X-Forwarded-For` values behind one direct peer and show they cannot evade that limit; configured trusted hops may distinguish clients. No credential or secret marker appears in body or captured logs. | In-process requests with explicit peer/forwarded addresses and isolated limiter state; assert `global` policy and exact 600/minute setting, not just a test-overridden low number. Check both routes are subject to the shared policy. |
| **AC-P04-04** | **E04-P**: a synthetic exception before an existing endpoint yields 500 RFC 9457 `application/problem+json`, `code=internal_error`, generic title/detail and nonempty `traceId` matching a captured failure log. Valid local Mongo configuration starts the host. | **E04-N**: synthetic exception/request/config values do not appear in the response or logs. Missing and malformed required Mongo settings each fail startup predictably with a generic message; the supplied connection value is absent from output. | Test-only throwing middleware, in-memory log provider and local fictional configuration values. Assert actual body against `Problem`; never print secret-shaped test values. |
| **AC-P04-05** | **L05-P**: captured operational logs contain only the agreed scalar allow-list (event name, code, trace ID, route template, status, elapsed time) and a failure carries the response correlation ID. | **L05-N**: a focused logging-call/source guard rejects a minimal synthetic call containing a resume, rich-text, contact or photo typed property; a synthetic marker in request metadata and exception text never appears in captured logs, scopes or rendered messages. | Scan scoped production logging calls plus an in-memory bad sample; capture structured state, not only formatted text. No real content-bearing fixture or payload is persisted. |
| **AC-P04-06** | **C06-P**: the test-time in-box ASP.NET Core OpenAPI document has exactly `GET /health/live` and `GET /health/ready`, their statuses (`200,429,default` and `200,429,503,default`) and anonymous security from `x-phase: P04`. Strict `System.Text.Json` round-trips every P04 example through its C# DTO; `JsonSchema.Net` validates live 200, 429, 503 and forced default/500 responses against resolved contract schemas. The unchanged P02 suite passes. | **C06-N**: the inventory comparator rejects one extra operation or changed status/security entry; strict round-trip rejects an added or missing required example property; schema validator rejects a malformed `HealthStatus` or `Problem` body. | Frozen `contracts/openapi/openapi.yaml` is the oracle. Use `UnmappedMemberHandling.Disallow`, `RespectNullableAnnotations` and `RespectRequiredConstructorParameters`; compare parsed JSON values, not serialization whitespace or property order. No runtime OpenAPI route is introduced. |

For `Problem` responses, assert HTTP status equals body `status`, `code` matches the applicable frozen example, `traceId` is nonempty, and `application/problem+json` is exact apart from permitted charset parameters. The contract leaves response objects open; do not reject additive properties solely because they are extra. Reject actual disclosure of dependency, request or secret values through the privacy cases above. The `Retry-After` header is required for 429 and must parse as nonnegative seconds.

## TDD order and execution

1. Test Engineer writes A01 and C06 inventory/round-trip tests first, runs them and records the intended missing-project/host failures. An A01 assertion that a required project is absent is meaningful red; compiler errors in the test harness are not. Once the test project compiles, each fitness and drift assertion must fail for its intended behavior before implementation.
2. Add H02 and E04 tests against the host contract, then R03 and L05 safeguards; record each focused red result before the corresponding Backend Developer slice. A test infrastructure failure (Docker unavailable, invalid test setup, contract parser error) is not meaningful red evidence; repair the test setup and rerun.
3. Backend Developer runs focused tests after each slice, then the full P04 suite and backend CI sequentially. QA repeats the suite and acceptance checks. Neither role alters or weakens the contract, acceptance criteria or existing tests to obtain green.

The Test Engineer creates `docs/phases/P04/tests/suite.cmd` with commands run from repository root: a locked restore/Release build and focused P04 xUnit tests, followed by the relevant unchanged P02 contract checks. Keep Compose/Docker jobs sequential. Record the **exact commands run, exit codes, environment preconditions and red/green results** in `docs/phases/P04/tests/test-results.md`; no such test result is claimed by this planning artifact. The handoff gate for this role is `python3 scripts/phase-handoff-check.py --phase P04 --role test-architect --worktree .`.

## Risks and remaining ownership

| Risk | Test control / owner |
|---|---|
| Mongo availability or slow startup causes a false readiness result | Isolated pinned container, explicit readiness wait and bounded ping; Test Engineer diagnoses infrastructure failures separately. |
| Per-instance rate limiter or wall-clock window yields a false boundary result | Fresh host and controlled replenishment; Test Engineer asserts production 600/minute configuration and both-route policy. Cross-instance abuse/load testing belongs to P13. |
| An exception, startup validation or structured log leaks content | E04/L05 check response, structured state, scopes and rendered output; Code Reviewer inspects logging call sites. |
| OpenAPI metadata drifts while HTTP behavior appears correct | C06 compares inventory, examples and actual bodies independently; Contract Architect is required for any frozen-contract change. |

No product or architecture decision remains open for this test plan. The next owner is the Test Engineer.

## Test Architect verification

Run from repository root on 2026-11-03:

| Exact command | Exit code | Result |
|---|---:|---|
| `git diff --check` | 0 | No whitespace errors. |
| `python3 scripts/phase-handoff-check.py --phase P04 --role test-architect --worktree .` | 0 | `RESULT PASS`; role scope reports one Test Architect file, phase scope and blueprint check pass. Warning: `suite.cmd` has not yet been created by the Test Engineer. |

No executable P04 application test was run in this planning step; the Test Engineer records red and later green runs in `test-results.md`.
