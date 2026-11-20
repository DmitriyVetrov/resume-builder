---
description: Independent review and acceptance check of a phase with a PASS/FAIL/BLOCKED verdict
argument-hint: <phase-id, e.g. P06>
---
Independently check phase `$ARGUMENTS` against `PHASE.md`, its `acceptance-criteria.md` and `docs/blueprint/PHASE-GATES.md` (ADR-051 S-3).

1. External review — from the phase branch, with the work committed:
   `codex exec --sandbox read-only --cd "$(pwd)" -` with `.claude/review-prompt.md` plus the diff range on stdin (see `docs/blueprint/AGENT-WORKFLOW.md` → "External review"; `codex review --base` cannot take a custom prompt).
   Record the findings verbatim in `docs/phases/$ARGUMENTS/review/code-review.md`, each with severity, file/line and required fix, and end the file with `Verdict: PASS` or `Verdict: FAIL`.
2. Acceptance — walk the acceptance matrix against the running system, not against the tests; record PASS / FAIL / BLOCKED per criterion in `qa-report.md`.
3. Do not silently fix code during the review. Report the main findings, then fix blocker, critical and major items and re-review only the changed files (one delta pass).
