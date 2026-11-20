# Phase step protocol

ADR-051 retired the role-handoff pipeline. A phase is executed by one operator session, so there is no task request to write and no next owner to hand to. What the handoff protocol guaranteed is now recorded instead of transmitted:

- `architecture/phase-plan.md` states the phase ID, goal, source requirement IDs, slices, test budget, task list and the allowed file scope.
- `acceptance-criteria.md` states what must be true for the phase to close.
- `tests/test-results.md` records, per step, the exact commands, exit codes, environment and known skips — red state before green state.
- `decisions.md` records every question decided under delegation as `DELEGATED-DEFAULT`, with the options and the reason.
- `review/code-review.md` records the external review findings and verdict; `qa-report.md` records the acceptance verdict.

Rules that still bind:
- Commit after each step of the phase sequence, so a quota or context limit is a pause rather than lost work.
- Never claim a test passed if it did not run.
- Do not auto-start the next phase. A phase closes at its gate and stops there.
- The separate actors are the external reviewer (Codex, run read-only) and, from P10, the optional Codex worker on bounded tasks (ADR-051 Amendment 3). Exact commands are in `docs/blueprint/AGENT-WORKFLOW.md`. A worker owns no phase step; the operator reviews, applies and commits its patch. Subagents are for read-heavy search only, never for a phase step.
