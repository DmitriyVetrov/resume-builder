---
description: Close a phase after its gate passed (under owner delegation, ADR-051)
argument-hint: <phase-id, e.g. P06>
---
Close phase `$ARGUMENTS` (ADR-051 S-8). The operator session does this at the end of the phase; this command is for a manual or repeated close.

1. Run `python3 scripts/phase-handoff-check.py --phase $ARGUMENTS --gate`. If the result is inconclusive, call the `phase-coordinator` subagent for a read-only READY / NOT_READY second opinion.
2. Close only when all of these hold (see `docs/blueprint/PHASE-GATES.md`):
   - the required artifacts of `PHASE.md` are in place and filled;
   - every Must acceptance criterion is met;
   - `review/code-review.md` records `Verdict: PASS` from the external review — the reviewer's own output verbatim, never a line the operator wrote (ADR-051 Amendment 2) — with no standing blocker, critical or major finding;
   - `qa-report.md` records PASS;
   - `tests/test-results.md` records the real commands, exit codes and red-before-green evidence.
3. If NOT_READY, keep the phase open and list the missing evidence.
4. If READY, update `docs/phases/$ARGUMENTS/PHASE-STATUS.md` to `COMPLETED`, or `COMPLETED_WITH_APPROVED_EXCEPTIONS` with a link to the `DELEGATED-DEFAULT` exceptions. Add the line "Gate accepted by the operator under owner delegation (ADR-051 S-5)". No owner confirmation is needed.
5. Merge `phase/$ARGUMENTS` into `main` (`--no-ff`) if that has not happened yet. Do not start the next phase without the owner's go-ahead.
