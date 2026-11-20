# Resume Builder — Claude Code Blueprint

Blueprint version: 1.0.0  
Source documents: `docs/source/README.md` (Resume Genius research) and `docs/source/TECHNICAL-SPEC.md` (target Resume Builder specification).  
Architecture: **Monorepo**. Backend and Frontend are implemented and tested independently and interact through a versioned API contract.

## Quick start

The project is executed by a **single Claude operator session** per phase (ADR-051; the Orca worker pipeline of ADR-035 is retired). Follow `docs/blueprint/AGENT-WORKFLOW.md`:

1. Open the repository root and check the structure: `python3 scripts/check-blueprint.py`.
2. Start a session in this checkout, then run `/blueprint-status` to see where the project stands.
3. Run `/phase Pxx` (or a batch, `/phase P07+P08+P09`). One session takes the phase through plan → contract → test plan → red → green → external review → acceptance → gate on branch `phase/Pxx`.
4. Independent review runs Codex read-only with the checklist in `.claude/review-prompt.md`, once per phase over the phase diff (exact command in `docs/blueprint/AGENT-WORKFLOW.md`). From P10, Codex may also take small bounded tasks whose patches the operator reviews and commits (ADR-051 Amendment 3); it owns no phase step.
5. The gate closes under owner delegation (ADR-051 S-5) once `scripts/phase-handoff-check.py --phase Pxx --gate` passes; `/close-phase Pxx` is for a manual close.
6. Acceptance tests and the approved OpenAPI contract are never changed to get around a failure.

## Structure

- `.claude/agents/` — `phase-coordinator`, a read-only gate checker; the ADR-035 pipeline roles are retired.
- `.claude/skills/` — local project skills with `SKILL.md`; these are project instruction files, not a claim that same-named marketplace skills exist.
- `.claude/rules/` — standing rules; Claude Code loads them automatically.
- `.claude/commands/` — slash commands `/blueprint-status`, `/phase`, `/review-phase`, `/close-phase`.
- `.claude/review-prompt.md` — the external review checklist passed to `codex review`.
- `AGENTS.md` — entry point for Codex, as reviewer and as bounded worker.
- `docs/blueprint/templates/codex-task.md` — the template for a Codex worker task.
- `docs/source/` — source specification and research (owned by the product owner).
- `docs/blueprint/` — architecture, decisions, boundaries, test strategy, phase workflow.
- `docs/phases/` — 16 executable phases with plans, dependencies and DoD.
- `contracts/openapi/` — the approved OpenAPI contract.
- `backend/`, `frontend/`, `tests/`, `infrastructure/` — target Monorepo structure.
- `scripts/check-blueprint.py` — checks the Blueprint structure and phase artifacts.

## Important caveats

The Blueprint follows the attached source documents and separately marks the project decisions the user already fixed: .NET backend, React 19 + Vite, NoSQL, Tailwind CSS 4, Monorepo and independent Backend/Frontend development. The source specification leaves decisions D-01…D-20 partly open. The Blueprint does **not** replace them with silent approval: they are listed in the decision register and must be closed before the phases they affect.

In particular:
- Technology choices (.NET version, NoSQL provider, file storage, hosting/CI, e-mail provider) are recorded as ADRs in `docs/blueprint/decisions/`; see `docs/blueprint/DECISION-REGISTER.md` for their status.
- The source specification does not fix the PDF renderer as a specific library or technology. The architecture requires a shared layout result for Preview/PDF; the implementation choice is an ADR.
- T2/T3 are proposals of the source specification; T1 has the most detailed description.
- Monetization/paywall, AI, import/parse, DOCX, cover letters, publish, resume score and the other exclusions must not slip into v1.
