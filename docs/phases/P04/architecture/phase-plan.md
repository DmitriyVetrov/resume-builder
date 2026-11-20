# P04 Architecture Plan — Backend Foundation

## Context and scope

P02 froze OpenAPI 3.1 v1.0.0; P03 supplied the .NET 10 toolchain, xUnit canary, Compose MongoDB and CI scripts. P04 makes the backend a runnable ASP.NET Core host and establishes layer and HTTP conventions before P06 accounts and P07 resume persistence. This phase implements only the contract paths `GET /health/live` and `GET /health/ready`, resolved against the contract server URL `/api/v1` to public URLs `/api/v1/health/live` and `/api/v1/health/ready` (DD-P04-05). Do not build account, resume, photo, export, template or frontend behavior here; TECHNICAL-SPEC §3.2 exclusions remain excluded.

## Requirement and acceptance mapping

| Source | P04 responsibility | Acceptance |
|---|---|---|
| TECHNICAL-SPEC §10; ADR-008 F-BE-1…5 | Domain/Application/Infrastructure/Api project boundaries, with executable dependency and log-safety rules | AC-P04-01, AC-P04-05 |
| NFR-08, NFR-09; ADR-038 | Safe HTTP defaults, explicit forwarded-header trust and global rate limiting | AC-P04-03, AC-P04-04 |
| NFR-10 | Readiness reflects the required MongoDB connection; liveness is process-only | AC-P04-02 |
| NFR-13; ADR-008 F-BE-5 | Correlated, content-free errors and structured log allow-list | AC-P04-03, AC-P04-05 |
| ADR-006/040; OpenAPI `x-phase: P04` | Contract-shaped health responses and three C# drift checks | AC-P04-02, AC-P04-06 |

NFR-08/09/10 remain product-wide requirements; this phase supplies foundations only. Authorization, deletion, backup execution and export logging are later-phase work.

## Components and dependency direction

| Project | P04 content and reference rule |
|---|---|
| `ResumeBuilder.Domain` | Small framework-free domain assembly; BCL only, no speculative resume model or business rules. |
| `ResumeBuilder.Application` | Application boundary and only concrete abstractions needed by foundation; references Domain only. |
| `ResumeBuilder.Infrastructure` | Mongo readiness adapter/configuration; references Application and Domain. No resume repository yet. |
| `ResumeBuilder.Api` | ASP.NET Core host, composition root, health endpoints, rate limit, safe exception handling and logging; references Application, with Infrastructure referenced only for registration. |

The Api host uses a single composition root. Endpoints and middleware never access Mongo or Blob SDK types. Use ASP.NET Core built-ins for health checks, Problem Details, rate limiting, options validation and structured logging; use plain classes and explicit registration rather than a mediator or generic repository. A MongoDB ping with a bounded timeout is the sole readiness dependency in P04. Liveness never probes external services. The public readiness response is either the exact `HealthStatus` success body or the contract's generic 503 `Problem`; it reveals no dependency name, version, endpoint or timing.

## HTTP, config and data impact

- Keep route paths, status codes, media types, 429 `Retry-After`, 503 `Problem`, `traceId` and anonymous security exactly as `contracts/openapi/openapi.yaml` specifies. Its top-level server URL `/api/v1` applies to the health path keys: the host serves `/api/v1/health/live` and `/api/v1/health/ready`, without root aliases (DD-P04-05). Do not expose a runtime OpenAPI route unless it is separately contracted. Generate the ASP.NET Core document inside tests as a drift oracle (ADR-040), not as a second source of truth. The inventory check must account for the contract server URL when comparing public routes.
- Configure MongoDB through typed validated options, using environment/secret providers at runtime. A missing or invalid connection setting fails startup with a generic message and no connection string in logs. Local testing uses P03 Compose/Testcontainers; no paid service or real secret is required.
- Apply ADR-038's `global` IP policy to health operations and return the contracted 429. Trust forwarded headers only from explicitly configured known proxy/network addresses; otherwise use the direct peer address. Do not accept arbitrary client-supplied forwarding headers.
- Map unexpected exceptions to RFC 9457 `application/problem+json` with generic title/detail, stable code and correlation `traceId`. Use safe structured log fields: event name, code, trace ID, route template, status and elapsed time; never request bodies, query values, headers, contact data, tokens, resume/rich-text objects or response bytes. Health payloads are never logged.
- P04 persists no account or resume records and defines no schema or migration. Infrastructure contains only connection/readiness plumbing. Blob and SMTP adapters belong to later phases.

## Test and implementation order

1. Test Architect maps every Must acceptance item to positive/negative cases within `kickoff.md` budget.
2. Test Engineer writes architecture, host, health, error, rate-limit and drift tests and records expected red results in `tests/test-results.md`.
3. Backend Developer adds project references and host code in small red/green slices, then runs the focused P04 suite, P02 contract validation and backend CI script sequentially.
4. Code Reviewer and QA verify scope, privacy, test evidence and acceptance.

The contract drift suite follows ADR-040: compare the in-box ASP.NET OpenAPI inventory with exactly the implemented P04 operations; round-trip every relevant contract example with strict `System.Text.Json` settings; validate actual response bodies against JSON Schema 2020-12. No DTO generator or hand-edited generated artifact is introduced.

## Dependency graph and parallel boundary

`P02 contract + P03 toolchain → P04 red tests → P04 backend host → review → QA → gate`. P04 and P05 run concurrently only because their source ownership is disjoint (`backend/` versus `frontend/`) and both use the frozen P02 contract. P04 does not edit frontend or shared contract files. P06 depends on this host and extends account routes; P07 adds persistence and storage adapters.

## Decisions and risks

`decisions.md` records DD-P04-01…05 as `DELEGATED-DEFAULT`; ADR-006, ADR-008, ADR-038, ADR-040 and ADR-041 remain the approved architecture. No new contract or product ADR is needed. Risks: an accidental runtime OpenAPI endpoint or root health alias violates the operation inventory; a Mongo outage must yield a content-free 503 while liveness remains 200; reverse-proxy headers can spoof rate-limit identity unless trusted hops are explicit; logging middleware can expose sensitive payloads. The tests above directly cover these risks.

## Allowed paths

- `docs/phases/P04/`
- `backend/src/ResumeBuilder.Domain/**`
- `backend/src/ResumeBuilder.Application/**`
- `backend/src/ResumeBuilder.Infrastructure/**`
- `backend/src/ResumeBuilder.Api/**`
- `backend/tests/ResumeBuilder.Architecture.Tests/**`
- `backend/tests/ResumeBuilder.Api.Tests/**`
- `backend/ResumeBuilder.slnx`
- `backend/Directory.Packages.props`
- `backend/Directory.Build.props`
- `backend/README.md`

The Test Engineer owns test source and `docs/phases/P04/tests/**`; the Backend Developer owns application source and may update solution/package configuration and the backend README. The Solution Architect owns only `docs/phases/P04/` and, if a decision requires it, `docs/blueprint/decisions/`. `frontend/`, `contracts/`, `docs/source/`, P05 records and the P03 canary are outside P04 scope. The coordinator may update P04 status and log records only under its role.
