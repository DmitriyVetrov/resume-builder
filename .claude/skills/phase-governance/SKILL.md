---
name: phase-governance
description: Phase process rules. Use when starting, executing, reviewing or closing a phase P00–P15, writing phase artifacts or checking a gate.
---

# Phase Governance

Use phase package inputs/outputs, dependencies, file scopes, acceptance criteria, test evidence and gate statuses. Progress between phases through `/phase Pxx` (single-operator autonomous mode, ADR-051): a phase starts when its dependencies are `COMPLETED` and merged. Questions are decided by the operator under delegation and recorded as `DELEGATED-DEFAULT` in `decisions.md`. Gates are accepted by the operator when `scripts/phase-handoff-check.py --phase Pxx --gate` passes.

## Mandatory references
- `CLAUDE.md`
- `.claude/rules/` (loaded automatically)
- `docs/blueprint/PROJECT-CHARTER.md`
- `docs/blueprint/AGENT-WORKFLOW.md` and ADR-051
- Current phase package under `docs/phases/`
