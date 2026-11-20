# Phase Gates and Definition of Done

A phase is complete only when:
- Inputs and source requirement IDs are recorded.
- `architecture/phase-plan.md` records the plan, slices, test budget, task list and allowed file scope.
- Test plan maps acceptance criteria to executable checks.
- Tests were authored before production implementation for TDD phases.
- Relevant tests pass; exact commands/results recorded.
- Security/privacy and accessibility impact assessed.
- The external review's last recorded verdict is the reviewer's own `Verdict: PASS`, with no unresolved blocker, critical or major finding. The operator never writes a verdict line (ADR-051 Amendment 2).
- The acceptance matrix passes against the running system, or an exception is recorded as `DELEGATED-DEFAULT`.
- Documentation, ADRs and traceability are updated.
- The gate was accepted: the operator session accepts it when `scripts/phase-handoff-check.py --phase Pxx --gate` passes, under the owner's delegation (ADR-051 S-5). The owner reviews afterwards.
- `PHASE-STATUS.md` says `COMPLETED` or `COMPLETED_WITH_APPROVED_EXCEPTIONS`.

## Statuses
`NOT_STARTED`, `BLOCKED`, `IN_PROGRESS`, `IN_REVIEW`, `COMPLETED`, `COMPLETED_WITH_APPROVED_EXCEPTIONS`.

## No-go conditions
Any Must acceptance criterion failing; data loss; cross-user data access; contract breaking without approval; security/privacy critical issue; nondeterministic PDF layout; changed/disabled test to mask a defect.

## Autonomous gate rules (ADR-051)
- Delegated answers and decisions are tagged `DELEGATED-DEFAULT` in `decisions.md` with options and reason. A phase with an undecided question that its scope needs is not complete.
- One **full** external review and one acceptance pass per phase. A delta re-review covers only the files changed since the previous reviewer run and repeats until the verdict is PASS, at most three times; exhausting that ceiling with a standing blocker, critical or major finding is a stop condition (ADR-051 §C.6, Amendment 2). Edits to records only (decisions, status) need no re-review or re-run.
- Tests stay within the test budget in `architecture/phase-plan.md`. A larger test plan needs a recorded reason there.
- Earlier phase suites are close-time evidence and are not re-run as regression. Each phase's own suite is listed in `tests/suite.cmd`.
- Stop conditions are the six in ADR-051 §C (the sixth added by Amendment 2). A stopped phase is `BLOCKED`, with the reason in `decisions.md`. A quota or context limit is a pause, not a stop: commit and resume.
- A batched gate (ADR-051 S-6) verifies each included phase's acceptance criteria separately and writes each phase's `PHASE-STATUS.md`.
- Every file in `codex-tasks/` has its `Outcome:` line filled, and no worker worktree remains in `git worktree list` (ADR-051 Amendment 3).

## Required phase report
Recorded in `architecture/phase-plan.md` (scope, decisions, risks) and `tests/test-results.md` (commands, results): summary and scope, source FR/NFR IDs, files changed, decisions made and still open, test commands with exit codes, coverage observations, risks and follow-ups, review and acceptance verdict, next permitted phase.
