# P05 — Frontend Foundation

## Objective
React19/Vite/TS/Tailwind4 app shell, routing, design tokens, error boundaries, responsive shell.

## Dependencies
P02, P03

## Source basis
Use relevant FR/NFR identifiers and exact sections from `docs/source/TECHNICAL-SPEC.md`; use `docs/source/README.md` only as reference-product evidence, not as target behavior where technical spec differs.

## Roles
Solution Architect → Test Architect → Test Engineer → assigned Developer(s) → Code Reviewer → QA / Acceptance Agent. Add Contract Architect whenever API changes.

## Allowed paths
- `docs/phases/P05/`
- Phase-specific source folders explicitly listed in `architecture/phase-plan.md`.
No other paths without Architect approval.

## Required test strategy
Vitest/RTL, lint/typecheck/build, accessibility smoke, Playwright shell test.

## Acceptance / Definition of Done
Frontend builds independently; app shell usable; no contract divergence.

## Required artifacts
- `architecture/phase-plan.md`
- `decisions.md`
- `dependencies.md`
- `tests/test-plan.md`
- `tests/test-results.md`
- `acceptance-criteria.md`
- `implementation/backend-tasks.md`
- `implementation/frontend-tasks.md`
- `review/code-review.md`
- `qa-report.md`
- `PHASE-STATUS.md`

## Stop conditions
Stop on ambiguous source requirement, unapproved open decision, failing Must test, scope conflict, contract incompatibility, security/privacy blocker or non-deterministic test. Do not auto-start the next phase.
