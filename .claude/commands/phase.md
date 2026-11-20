---
description: Execute one phase (or a batch of consecutive phases) end-to-end in single-operator mode (ADR-051)
argument-hint: <phase-id or batch, e.g. P07 or P07+P08+P09>
---
Execute `$ARGUMENTS` as the operator, at the tier `docs/blueprint/AGENT-WORKFLOW.md` → "Model and effort" sets for this phase (Opus/`high` for P07–P10 and P12–P15, Opus/`xhigh` for P11), per [ADR-051](../../docs/blueprint/decisions/ADR-051-single-operator-phase-execution.md) and `docs/blueprint/AGENT-WORKFLOW.md`. No Orca workers, no role handoffs, no worktrees apart from a Codex worker task's temporary one: one session, one branch, in this checkout.

**Starting or resuming.** If `phase/<Pxx>` does not exist, verify every dependency in `docs/phases/README.md` is `COMPLETED` (or `COMPLETED_WITH_APPROVED_EXCEPTIONS`) and create it from `main`: `git checkout -b phase/<Pxx>`.

If the branch already exists, this is a **resumed run** — a quota or context limit is a pause, not a restart. Do not re-plan and do not re-do completed steps. Check out the branch, merge `main` into it if `main` has moved, then establish where the phase stands and continue from the next step:

```bash
git checkout phase/<Pxx>
git log --oneline main..HEAD          # the last committed step
git status --short                     # anything left uncommitted mid-step
```

The committed artifacts are the handoff: `architecture/phase-plan.md` and `decisions.md` carry the plan and the decisions already taken, `tests/test-plan.md` the intended coverage, `tests/test-results.md` the red and green evidence recorded so far, and `review/code-review.md` any findings still to fix. Read those before touching code; they exist so a resumed run does not re-derive what an earlier one decided.

Also check `docs/blueprint/DECISION-REGISTER.md` for `OPEN` or `SOURCE-OPEN` rows that this phase's scope touches. Those need an **accepted ADR in `docs/blueprint/decisions/`** before the implementation that depends on them, not only a `DELEGATED-DEFAULT` row in `decisions.md` (charter rule). For P07 that means ADR-017 (D-05, guided first run) and ADR-018 (D-06, default blank resume sections).

Run the eight steps of `AGENT-WORKFLOW.md` → "Phase sequence", committing after each:

1. Plan → `architecture/phase-plan.md`, `decisions.md`, `acceptance-criteria.md`, ADRs. From P10, the plan names candidate Codex worker tasks or says there are none (ADR-051 Amendment 3, which also sets the P10 pilot and the return-to-review-only rules).
2. Contract (only if the API surface changes) → `contracts/openapi/**`, regenerated types, frozen before any code.
3. Test plan → `tests/test-plan.md`.
4. Red → tests, `tests/suite.cmd`, red evidence proving assertion failures rather than harness errors.
5. Green → implementation plus green evidence in `tests/test-results.md`. Planned Codex worker tasks run in steps 4–5 only, per `AGENT-WORKFLOW.md` → "Codex worker tasks"; none starts once the full review has.
6. External review → `codex exec --sandbox read-only` with `.claude/review-prompt.md` plus the diff range on stdin (exact command in `docs/blueprint/AGENT-WORKFLOW.md` → "External review") → `review/code-review.md`; fix blocker/critical/major, then a delta re-review over the fixes, repeated until `Verdict: PASS`, at most three (ADR-051 Amendment 2). Never write a verdict line yourself; a ceiling reached with a standing major is ADR-051 §C.6 and stops the phase at `IN_REVIEW`.
7. Acceptance → `qa-report.md` against the running system.
8. Gate → `python3 scripts/phase-handoff-check.py --phase <Pxx> --gate` (for a batch pass the batch form, `--phase P07+P08+P09`: it unions the phase scopes, runs every phase's `suite.cmd` and checks each phase's artifacts and verdicts separately), then `PHASE-STATUS.md` = `COMPLETED` for each included phase, then merge into `main` with `--no-ff`.

Decide open questions under delegation (ADR-051 S-5) and record them as `DELEGATED-DEFAULT` in `decisions.md`; do not ask the owner. Stop and report only on the five conditions in ADR-051 §C. A quota or context limit is a pause, not a stop: commit and resume from the committed state.

For a batch (`P07+P08+P09`), produce steps 1–3 per phase, run steps 4–5 per phase in dependency order, and run steps 6–8 once for the batch, verifying each phase's acceptance criteria separately. Each included phase needs its own filled artifact set, including a `review/code-review.md` and a `qa-report.md` carrying its verdict — the gate check requires them per phase. Do not start a phase outside `$ARGUMENTS`.

Keep the work committed after each step. Anything that is not this phase's product work — a correction to a governance document, a fix to a shared script — belongs on `main` in its own commit, not in the phase diff; the scope check will flag it.

**Where to stop, if a limit is approaching.** Not all step boundaries cost the same to resume from. Steps 1–3 produce documents that *are* the handoff, so a pause after any of them is nearly free. A pause after step 5, with the suite green, is also cheap: the state is in the code and `tests/test-results.md`. A pause **inside** step 4 or 5 is the expensive one, because the session is holding reasoning that is not written down yet — why a test is red, what the implementation still needs. If a limit is close, drive to the next step boundary, commit, and append a short "resume state" note to `tests/test-results.md` naming the next step and anything half-done. A full phase will usually not fit one session window; plan the stopping point rather than hoping to avoid one.
