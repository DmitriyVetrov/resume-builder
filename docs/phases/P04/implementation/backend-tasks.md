# P04 Backend Tasks

Owner: Backend Developer, after the Test Engineer records meaningful red tests. Work only in the backend paths listed in `architecture/phase-plan.md`; append green evidence to `tests/test-results.md`. Never alter tests, the OpenAPI contract, source specification or acceptance criteria. Each slice ends with its focused tests before the next slice; run the full P04 suite and backend CI job before handoff.

| Task | Allowed source | Contract dependency and work | Acceptance/tests |
|---|---|---|---|
| BE-P04-01 — Four projects | `backend/src/ResumeBuilder.{Domain,Application,Infrastructure,Api}/**`, `backend/ResumeBuilder.slnx`, `backend/Directory.Packages.props`, `backend/Directory.Build.props` | Add `net10.0` projects, central pins and lockfiles; enforce ADR-008 reference direction, no speculative domain model | AC-P04-01; architecture tests F-BE-1…4; locked Release build |
| BE-P04-02 — Host and config | Api/Infrastructure source folders above | Build composition root and validated Mongo options; no connection strings/secrets in output; use runtime environment providers | AC-P04-04; invalid/missing config cases |
| BE-P04-03 — Health | Api/Infrastructure source folders above | Implement only frozen `getLiveness` and `getReadiness` at public URLs `/api/v1/health/live` and `/api/v1/health/ready` (contract server URL plus path keys, DD-P04-05); no root aliases. Keep process-only liveness, bounded Mongo readiness and exact 200/503 contract bodies. | AC-P04-02, AC-P04-06; healthy and unavailable dependency cases |
| BE-P04-04 — HTTP safeguards | Api source folder above | Add generic RFC 9457 exception handling, trace IDs, ADR-038 global rate limit, explicitly trusted proxy handling, content-safe structured logging | AC-P04-03…05; 429, spoofed forwarding header, synthetic sensitive value and error cases |
| BE-P04-05 — Contract and handoff | Api/Infrastructure source folders, `backend/README.md` | Expose internal test-time OpenAPI metadata compatible with ADR-040; document local run/configuration and exact test commands | AC-P04-06; inventory, strict example round-trip and JSON Schema response validation green; P02 contract suite green |

The Test Engineer owns `backend/tests/ResumeBuilder.Architecture.Tests/**`, `backend/tests/ResumeBuilder.Api.Tests/**` and `docs/phases/P04/tests/**`. The Backend Developer may add new tests but must not modify, remove or weaken Test Engineer tests. If a test or contract appears wrong, report a failed outcome with precise evidence for an Architect/Contract Architect decision.

## M-3 correction order — DD-P04-05

The Test Engineer first moves all host HTTP calls, the startup probe and the exception path match from `/health/*` to `/api/v1/health/*` in `HostTests.cs`, `LoggingTests.cs` and `ExceptionTests.cs`; it adds a contract-server-aware public URL assertion to the drift/inventory checks while preserving the OpenAPI path keys `/health/*`, status/security assertions and schema validation. It records a meaningful red failure against the current host. The Backend Developer then changes only the two Api route mappings, updates `backend/README.md`, and records focused, full-suite and backend-CI green evidence; review and QA check that root `/health/*` is not exposed. There is no API-host service or health probe in the current `docker-compose.yml` or `infrastructure/`, so no infrastructure file changes now; any later container/Compose/ingress probe must point at the appropriate `/api/v1/health/*` URL. P05 clients and mocks already derive from the unchanged contract and need no change.

## Backend Developer status — 2026-11-03

BE-P04-01 through BE-P04-04 are implemented provisionally. BE-P04-05 and green handoff are blocked by Test Engineer-owned harness defects: three in-process tests resolve the host assembly from `backend/tests/src` instead of `backend/src`, and `HostTests.Host.Start` obtains port 0 from an unstarted `TcpListener`, so every HTTP client targets port 0. These tests must be corrected by the Test Engineer before a green verdict is possible; no test source was changed by the Backend Developer.

## Continuation status — 2026-11-03

Production fixes: `WriteProblem` writes the correct content type before response start; an outer exception boundary catches startup-filter injected failures and emits safe application logs; in-box OpenAPI provider and default response metadata support contract inventory; forwarded headers trust only explicitly configured proxies; readiness briefly caches the bounded Mongo result so repeated probes do not overload Mongo. Architecture and 16 of 18 API tests are green. BE-P04-05 remains blocked by two Test Engineer rate-limit tests whose host startup probe consumes one of the 600 permits before their loops; see `tests/test-results.md` for exact evidence. Next owner: Test Engineer to correct the two test counts, then Backend Developer for a full green run.

## Review cycle 1 status — 2026-11-03

C-1: framework logging disabled in code, leaving allow-listed Api operational logs; new all-category privacy tests pass. M-1: both P04 test projects are now in `ResumeBuilder.slnx` and Release build succeeds. M-3: only `/api/v1/health/live` and `/api/v1/health/ready` are mapped, with README updated; 19/19 API tests pass. M-2: production source is formatted, but the full-solution verify step still fails in seven Test Engineer-owned test files; coordinator was escalated for a separate Test Engineer formatting step. M-4 test guard changes belong to the Test Engineer.
