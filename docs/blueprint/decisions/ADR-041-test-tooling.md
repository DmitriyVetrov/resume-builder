# ADR-041 — Test tooling confirmation

- Status: **Accepted** (`DELEGATED-DEFAULT`, ADR-035 A-4). New register ID from P03. It closes the item "Test tooling: confirm in P03" (P01 decisions.md §4, PD-P01-06; P02 decisions.md).
- Decider: Solution Architect (delegated, ADR-035)
- Date: 2026-11-02 (P03, decisions.md DD-P03-03, DD-P03-04, DD-P03-17)
- Source IDs: `docs/blueprint/TEST-STRATEGY.md` "Candidate tooling (confirm in P03)"; `.claude/rules/01-tdd-and-quality.md`; ADR-002 ("test tooling candidates confirmed in P03 against `net10.0`"); ADR-003 ("Left to P03: Vitest, React Testing Library, Playwright"); ADR-004 ("Testcontainers is a candidate, confirmed in P03"); ADR-010 §6 (G3/G7 pinned browsers); ADR-040 (contract tooling, unchanged); NFR-09

## Context

TEST-STRATEGY names candidates: xUnit, optionally FluentAssertions and NSubstitute, the ASP.NET Core integration test host and Testcontainers for the backend; Vitest, React Testing Library and Playwright for the frontend; PDF text extraction and raster diff for rendering. P04 and P05 start in parallel after P03 and need a fixed toolset. Every tool must:
- be OSI-licensed and pinnable;
- run locally and in GitHub Actions through repository scripts (ADR-033);
- send no project data to a third-party service (NFR-09).

## Decision

| Layer | Tool | Licence | Notes |
|---|---|---|---|
| Backend unit/integration runner | **xUnit v3** (`xunit.v3`, `xunit.runner.visualstudio`, `Microsoft.NET.Test.Sdk`) on `net10.0`, run by `dotnet test` | Apache-2.0 / MIT | Versions in `backend/Directory.Packages.props` (Central Package Management) with lock files. Moving to the Microsoft.Testing.Platform runner later is an ordinary change |
| Backend assertions | **xUnit `Assert`** | — | no assertion library in v1 |
| Backend test doubles | hand-written fakes first; **NSubstitute** (BSD-3-Clause) allowed when a fake is impractical | BSD-3-Clause | not added in P03 |
| ASP.NET Core in-process host | **`Microsoft.AspNetCore.Mvc.Testing`** (`WebApplicationFactory`) | MIT | P04 |
| Containerised dependencies | **Testcontainers for .NET** (`Testcontainers`, `Testcontainers.MongoDb`; `Testcontainers.Azurite` from P07) with the same digest-pinned images as Compose, MongoDB as a replica set | MIT | confirmed by the P03 canary |
| Contract drift (P04) | as ADR-040 §3; the JSON Schema validator candidate `JsonSchema.Net` is confirmed by P04 | MIT | unchanged |
| Coverage (diagnostic only) | `coverlet.collector` candidate, chosen in P04 | MIT | coverage is not a gate (TEST-STRATEGY) |
| Architecture rules (F-BE-1…5) | chosen in P04 (candidates NetArchTest.eNhancedEdition, ArchUnitNET) | MIT / Apache-2.0 | ADR-008 |
| Frontend unit/component | **Vitest** with **jsdom**; **React Testing Library** (`@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`) | MIT | configured in P03 `frontend/vite.config.ts`; P05 extends |
| API mocking in component tests | P05 option (MSW built from contract examples, ADR-040 alternatives) | MIT | not in P03 |
| E2E and browser-level checks | **Playwright Test** (`@playwright/test`) in the **official Playwright container image pinned by digest**, projects Chromium, Firefox and WebKit, locally and in CI | Apache-2.0 | `tests/e2e/`; the image pins the browser builds that ADR-010 G3/G7 need |
| Accessibility smoke | `@axe-core/playwright` candidate for P05 | MPL-2.0 | P05 confirms |
| Infrastructure checks (P03) | Python 3 standard library `unittest` | PSF | `tests/infrastructure/` |
| PDF text extraction, raster visual diff | **deferred to the ADR-010 prototype gate at the P10 start** (candidates `pdfjs-dist`, Apache-2.0; Playwright `toHaveScreenshot` or `pixelmatch`, ISC) | — | the renderer library is not chosen yet, so choosing its test oracle now would be premature |

Rules:
- Every tool is pinned exactly (npm exact versions + lockfile; NuGet Central Package Management + lock files; images by digest).
- Retries are off by default (`retries: 0` in Playwright). A flaky test is fixed or quarantined with owner, issue and expiry (rule 01).

## Alternatives considered

- **FluentAssertions:** version 8 moved to a commercial licence (Xceed). Rejected. The pre-v8 versions are frozen and would be a dead end.
- **Shouldly / AwesomeAssertions:** OSI-licensed, but they add a dependency without a need. Rejected for v1, and reversible.
- **Moq:** the 2023 SponsorLink incident is a supply-chain trust concern. Rejected in favour of fakes or NSubstitute.
- **NUnit / MSTest:** equally capable. xUnit is the TEST-STRATEGY candidate and the most common choice for ASP.NET Core. Rejected.
- **Jest:** needs separate transform configuration with Vite. Vitest reuses the Vite config. Rejected.
- **happy-dom instead of jsdom:** faster, but less complete. jsdom is the conservative default. Rejected for v1.
- **Cypress:** no WebKit support, and its cloud features are optional third-party services. Rejected.
- **Playwright with browsers downloaded on the host:** browser builds and system libraries vary by host. The pinned official image keeps Chromium, Firefox and WebKit identical locally and in CI (needed for ADR-010 G7). Rejected.
- **A local MongoDB service instead of Testcontainers for integration tests:** shared state between test runs. Rejected for tests. Compose is for development.

## Rationale

These are the mainstream, OSI-licensed tools for each layer, and all of them run from pinned versions with no service dependency. The P03 canaries prove each one on the exact runtimes (`net10.0`, Node 24, React 19 and the three browser engines) before P04 and P05 depend on them.

## Consequences

- P03 adds the canaries: an xUnit v3 project with a Testcontainers MongoDB replica-set test, a Vitest + RTL test, and a Playwright smoke in three browsers.
- P04 uses xUnit v3, `WebApplicationFactory` and Testcontainers, and confirms `JsonSchema.Net`, the coverage collector and the architecture-test library.
- P05 uses Vitest + RTL, confirms axe and decides MSW.
- P10 decides PDF text extraction and raster diff with the prototype gate.
- `TEST-STRATEGY.md` "Candidate tooling" should point to this ADR (follow-up, kickoff §6).

## Security/privacy impact

Tests use fictional fixture data only, and no tool sends results or code to a service. Pinned versions and images reduce supply-chain risk (T-TA-06). Playwright's report stays local, and CI uploads no artifacts in P03.

## Owner and date

Solution Architect (delegated, ADR-035), 2026-11-02. The owner reviews it after the fact in the P15 decision table (ADR-035 A-6).
