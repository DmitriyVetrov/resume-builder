# Backend Tasks — P00

**No tasks.** P00 has no backend scope.

Rationale:
- P00 is a governance-only phase covering source inventory, traceability, exclusions and decision owners (`PHASE.md` Objective). Its deliverables are documents and stdlib checks under `docs/phases/P00/` (`architecture/phase-plan.md` §6).
- `backend/**` is outside the P00 allowed paths (`PHASE.md` Allowed paths).
- Backend code cannot start before the API contract exists (P02 is a hard gate) and the toolchain exists (P03). The exact .NET version (ADR-002) and the NoSQL provider (ADR-004) are still open. `CLAUDE.md`: "Do not create speculative endpoints before P02."

Documentation tasks for this phase are in `implementation/governance-tasks.md` (GOV-01…GOV-06).
