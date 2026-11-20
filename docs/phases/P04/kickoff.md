# P04 Kickoff — Backend Foundation

Date: 2026-11-03. Phase type: code. Dependencies: completed P02 API contract and P03 toolchain.

## Scope and source

Build the four ASP.NET Core projects and the common HTTP host foundation: configuration, dependency injection, health probes, content-safe problem responses and structured logging. The phase implements only OpenAPI `getLiveness` and `getReadiness` (`x-phase: P04`); account and resume operations remain for later phases. Source: TECHNICAL-SPEC §§3.2, 10–11, especially NFR-08 (security), NFR-09 (privacy), NFR-10 (reliability) and NFR-13 (content-free observability); ADR-006, ADR-008, ADR-035, ADR-040 and ADR-041.

## Roles and sequence

1. Solution Architect: this kickoff, architecture, decisions and execution tasks.
2. Test Architect: focused test plan and acceptance mapping within the budget below.
3. Test Engineer: executable failing architecture, health, error and contract-drift tests; record the intended red state.
4. Backend Developer: implement against those tests and record green evidence.
5. Code Reviewer: one independent review, with delta review for material fixes.
6. QA / Acceptance Agent: run the acceptance matrix and phase suite.

Contract Architect: **no**, because the P02 contract already defines both P04 operations and their responses. Any required contract change must be reported to the coordinator for a separate Contract Architect step before implementation; neither tests nor developers may edit the contract.

## Test budget (ADR-035 B-4)

For each Must criterion in `acceptance-criteria.md`, the Test Architect defines at least one positive and one negative case. Use xUnit v3, `WebApplicationFactory`, the existing P03 Testcontainers MongoDB canary where a dependency probe needs it, and the P02 contract suite. Architecture fitness rules use reflection/project-reference checks; response schemas use `JsonSchema.Net` as anticipated by ADR-040/041. `coverlet.collector` is diagnostic only. Keep fixtures fictional and minimal, with no new framework, CLI or large fixture tree. A single P04 suite script runs focused backend tests and the relevant contract check; the Test Engineer owns it. Record exact commands, exit codes and red/green evidence in `tests/test-results.md`.

## Slices and parallelism

P04 has one backend execution slice: solution/layers → host/config/health/error/logging → contract-drift checks. Within P04, keep implementation sequential after red tests because host and integration checks share files. P04 and P05 can run in parallel in separate phase worktrees: P04 writes `backend/`, P05 writes `frontend/`; both consume the frozen P02 OpenAPI v1.0.0. There is no frontend task in P04 and no cross-worktree source edit.

## Decisions needed

- Confirm concrete readiness dependencies and the safe public health response while preserving the frozen contract.
- Select the architecture fitness test technique, JSON Schema validator and coverage collector anticipated by ADR-008, ADR-040 and ADR-041.
- Set the narrow configuration and logging boundaries for the foundation without implementing later account, document or storage features.

The Solution Architect resolves these as `DELEGATED-DEFAULT` in `decisions.md` under ADR-035 A-4. No owner question or paid external account is needed.

## Solution Architect verification

- `python3 scripts/phase-handoff-check.py --phase P04 --role solution-architect --worktree .` — exit 0; `RESULT PASS`, role scope and phase scope OK, blueprint check exit 0. It warned that the Test Engineer has not yet created `tests/suite.cmd`.
- `git diff --check` — exit 0; no whitespace errors.

No backend application tests were run in this architecture step; they follow the Test Engineer's red suite and Backend Developer's implementation.
