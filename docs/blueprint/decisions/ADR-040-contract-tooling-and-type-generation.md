# ADR-040 — Contract validation, mock, breaking-change and type-generation tooling

- Status: **Accepted** (`DELEGATED-DEFAULT`, ADR-035 A-4). New register ID from P01 (PD-P01-06), registered `OPEN` for P02.
- Decider: Solution Architect (delegated, ADR-035)
- Date: 2026-11-02 (P02, decisions.md DD-P02-21, DD-P02-22)
- Source IDs: `.claude/rules/02-api-contract.md` ("generate or validate C# and TypeScript types from the same contract"; "mock server/fixtures must derive from the canonical contract"; "breaking changes require … compatibility tests"); `.claude/rules/00-project-boundaries.md` (generated code is never hand-edited); P02 PHASE.md required test strategy; register ADR-040 constraint from P01 (strict generated TypeScript types; C# DTOs generated or verified by a contract-drift test against the in-box ASP.NET Core OpenAPI document); ADR-002, ADR-003, ADR-006, ADR-033

## Context

P02 needs these checks on the contract: lint and schema validation, breaking-change detection, generated C# and TypeScript type consistency, and a usable mock (PHASE.md). Every tool must:
- support OpenAPI 3.1;
- be OSI-licensed and pinnable;
- run locally and in GitHub Actions through repository scripts (ADR-033);
- avoid any third-party service (NFR-09).

The machine and CI have Node.js 24 (ADR-003), the .NET 10 SDK (ADR-002) and Docker. There is no Java.

## Decision

1. **Lint and schema validation:** **Redocly CLI 2.72.1** (MIT), `redocly lint` with a project ruleset in `tests/contract/`. The ruleset is the `recommended` set at error level plus:
   - `no-invalid-media-type-examples` (every example validates against its schema);
   - operation IDs present and unique;
   - security defined on every operation;
   - 4xx responses declared.
   Rules that Redocly cannot express are checked by a Node script over the parsed contract with the built-in `node:test` runner:
   - the phase-plan §5 inventory;
   - the anonymous allow-list;
   - `If-Match` and `Idempotency-Key` on the keyed operations;
   - Problem responses and 429 with `Retry-After`;
   - closed request schemas without server-owned fields;
   - no excluded endpoints;
   - content-free problem and event schemas.
2. **TypeScript types:** **openapi-typescript 7.13.0** (MIT) generates the types. They are compiled with **TypeScript 5.9.3** under `strict`, `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` (ADR-003). openapi-typescript 7 declares `typescript ^5.x`, so 5.9.3 is the pinned compiler for generated types until a release supports a newer major. P05 chooses the frontend's own compiler version within that constraint. The typed fetch wrapper (candidate openapi-fetch, MIT) is a P05 choice.
3. **C# types:** **no code generator.** No maintained OSI generator produces ASP.NET Core server DTOs with full 3.1 support (type arrays for null, discriminators, `const`). Backend DTOs are hand-written records, **verified** from P04 onwards by three tests:
   - (a) **Inventory drift.** The in-box `Microsoft.AspNetCore.OpenApi` document, generated at test time, has exactly the contract's operations (method, path template, status codes, security) for every `x-phase` already implemented, and nothing undocumented.
   - (b) **Example round-trip.** Every contract example deserializes into its DTO with strict `System.Text.Json` options (`UnmappedMemberHandling.Disallow`, `RespectNullableAnnotations`, `RespectRequiredConstructorParameters`) and re-serializes JSON-equal.
   - (c) **Response validation.** API integration tests validate response bodies against the contract schemas with a JSON Schema 2020-12 validator (candidate `JsonSchema.Net`, MIT; P04 confirms).
   In P02, a .NET 10 file-based app (`dotnet run <file>.cs`) loads the contract with **Microsoft.OpenApi**, in the version that `Microsoft.AspNetCore.OpenApi` 10.0.x depends on, and fails on reader errors.
4. **Mock:** **Prism CLI 5.16.0** (`@stoplight/prism-cli`, Apache-2.0), static examples, request validation on. It is started by a `tests/contract` npm script and is the frontend's dev mock from P05.
5. **Breaking-change check:** **oasdiff 1.35.0** (Apache-2.0), run as the official image `tufin/oasdiff:v1.35.0` pinned by digest `sha256:82b1840a77335562bb11ce95f77ad31745a0c6f3a770929333ed1c5ef466e400`. It runs `breaking` with `--fail-on ERR` against the contract on `main` (`git show main:contracts/openapi/openapi.yaml`). With no baseline, which is the case in P02, the check reports "first version" and passes. `WARN` findings are listed in the phase contract change log (ADR-006, phase-plan §9.2).
6. **Generated artifacts are never committed and never hand-edited.**
   - TypeScript output goes to git-ignored directories: `tests/contract/` working folders in P02, and `frontend/src/shared/api/generated/` from P05, regenerated before typecheck, build and test.
   - Bundles and reports are build outputs as well.
7. **Placement and pinning:**
   - the tools live in one Node package `tests/contract/` (Test Engineer) with exact versions and a committed `package-lock.json`, installed with `npm ci`;
   - the oasdiff image is pinned by digest;
   - P03 runs the same scripts in the CI integration job (P03-OBL-01), and dependency scanning covers the lockfile (P03-OBL-02);
   - version upgrades are ordinary changes with the suite green.

## Alternatives considered

- **Spectral** (Apache-2.0) for lint: equally capable. Redocly also validates examples and bundles, so one tool covers more. Rejected as a second linter.
- **NSwag** for C# DTOs: OpenAPI 3.1 support is incomplete (type arrays for null, `const`). Rejected. **Kiota:** generates client SDK models, not server DTOs. Rejected. **openapi-generator** `aspnetcore`: needs Java, and its 3.1 support is beta. Rejected.
- **Generating the contract from C# code (code-first):** contradicts contract-first (ADR-006, `CLAUDE.md`). Rejected. The in-box document is used only as a drift oracle.
- **Committed generated TypeScript types with a "regenerate and diff" check:** reviewable diffs, but the files can be hand-edited and get out of date. Rejected. Not committing them makes the contract the only editable source.
- **openapi-diff (Atlassian, npm):** OpenAPI 3.0 only. **Optic:** project archived. Rejected in favour of oasdiff.
- **MSW-only mocking:** frontend-specific and stateful, and it needs hand-written handlers. It is kept as a P05 option for component tests built from the contract examples, not as the contract mock.

## Rationale

Each tool is the mainstream OSI option for its job with full 3.1 support, and all of them run from pinned versions with no service dependency. Verifying hand-written C# DTOs with three independent drift tests is more reliable than a partial generator and meets the P01 constraint as written. Keeping generated output out of git removes any path to hand-editing it.

## Consequences

- The P02 Test Engineer builds the suite in `tests/contract/` within the P02 kickoff §3 budget and lists it in `docs/phases/P02/tests/suite.cmd`.
- The P02 Contract Architect self-checks with the same pinned versions before handoff.
- P03: CI job, lockfile scanning.
- P04: the three drift tests. P05: type generation and the client wrapper.
- P14: the full contract and drift suites in the cross-stack run.
- `CLAUDE.md` "Commands" gets the suite command at the P02 gate (Program Coordinator).

## Security/privacy impact

- Every tool runs locally or in CI on the contract and fictional examples only. No contract or data goes to a third-party service: Redocly lint runs offline, with no Redocly cloud login. The scripts switch off the usage telemetry of every tool that has it (Redocly: `REDOCLY_TELEMETRY=off`; oasdiff: its documented opt-out flag or variable), and the Test Engineer records the switches in `tests/contract/README.md`.
- The lockfile, exact versions and the digest-pinned image reduce supply-chain risk (T-TA-06).
- Type and drift checks make the contract's security semantics executable on both stacks.

## Owner and date

Solution Architect (delegated, ADR-035), 2026-11-02. The owner reviews it after the fact in the P15 decision table (ADR-035 A-6).
