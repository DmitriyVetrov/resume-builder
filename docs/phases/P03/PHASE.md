# P03 — Infrastructure & DevEx

## Objective
Repo tooling, Docker/Compose, CI, local services, secrets and env conventions.

## Dependencies
P01, P02

## Source basis
Use relevant FR/NFR identifiers and exact sections from `docs/source/TECHNICAL-SPEC.md`; use `docs/source/README.md` only as reference-product evidence, not as target behavior where technical spec differs.

## Roles
Solution Architect → Test Architect → Test Engineer → assigned Developer(s) → Code Reviewer → QA / Acceptance Agent. Add Contract Architect whenever API changes.

## Allowed paths
- `docs/phases/P03/`
- Phase-specific source folders explicitly listed in `architecture/phase-plan.md`.
No other paths without Architect approval.

## Required test strategy
docker compose config/build/up healthchecks; CI build/test; secret scan; reproducible bootstrap.

## Acceptance / Definition of Done
A clean checkout can build/test; backend/frontend jobs independent; integration job runs contract checks.

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
