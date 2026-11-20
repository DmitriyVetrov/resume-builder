# Execution Workflow

Process decision: [ADR-051](decisions/ADR-051-single-operator-phase-execution.md), which supersedes ADR-035. Phases P06–P15 are executed by a **single operator session** in the primary checkout. There is no Orca orchestration, no coordinator, no worker pipeline and no role handoffs. From P10, Codex may also take small bounded tasks ("Codex worker tasks" below, ADR-051 Amendment 3).

(The file keeps its historical name because closed-phase records P00–P05 link to it. Those records describe the retired ADR-035 pipeline and are left as written.)

## Actors

| Actor | What it does |
|---|---|
| **Operator** | One Claude session. Plans the phase, decides open questions under delegation, writes the tests, implements, records evidence, runs acceptance, accepts the gate and merges. Works on branch `phase/Pxx` in the primary checkout. |
| **External reviewer** | Codex, started by the operator as a plain local process in a read-only sandbox (`codex exec --sandbox read-only`, see "External review"), once per phase over the phase diff, plus a delta after each round of fixes until it returns PASS (ceiling three deltas, ADR-051 Amendment 2). Reads code it did not write, writes nothing, returns findings and a verdict on stdout. |
| **Codex worker** | From P10, optional. Codex run on one task the operator wrote, in a temporary worktree, producing an uncommitted patch the operator reviews, applies and commits (ADR-051 Amendment 3). Owns no phase step, no decision and no record. No design work, and nothing waits on it. |

The eight ADR-035 roles are retired as an execution mechanism. What they carried — layer rules, security checks, accessibility checks, test levels, review checklist — lives in `.claude/rules/` and `.claude/skills/` and is applied by the operator at the matching step.

## Model and effort

ADR-051 retired the per-role launch table of ADR-035 without replacing it, so the operator's tier was
unspecified until this section. In single-operator mode one session both designs and implements, so the
effort cannot be switched part-way through a phase: **pick the tier the hardest work in the phase needs,
which is the design, not the typing.**

| Phase | Operator | Why |
|---|---|---|
| P07, P08+P09 | **Claude Opus, effort `high`** | P07 fixes the canonical Resume Document model that P09–P12 all consume, plus the optimistic-concurrency version token and idempotent queued writes; P08 adds the autosave queue with Saved/Saving/Offline and stale-tab behaviour, and P09 a format-neutral AST with paste sanitisation and undo/redo. Concurrency and shared-model design are where a cheaper tier produces subtly wrong code that tests written by the same session may not catch. |
| P10, P12, P13, P14, P15 | **Claude Opus, effort `high`** unless the phase plan argues otherwise in `decisions.md` | Default. Drop a tier only with a recorded reason. |
| P11 | **Claude Opus, effort `xhigh`** | The one layout algorithm feeding preview and PDF (FR-PRV-02), chosen after the prototype gate. ADR-035 already reserved the highest tier for this phase and that judgement still holds. |

Measured precedent: P06 was finished under this mode on `claude-opus-5` at `high` — 290 calls, 308k output
tokens — including the DD-P06-15 interleaving analysis and its barrier tests.

Cost is not the reason to go lower. Amendment 1 of ADR-051 shows the pipeline's waste was cold starts and
idle burn, not model tier, and a wrong document model in P07 is paid for again in P08 through P12.

**The external reviewer's model is not pinned.** P06 ran on the Codex CLI default. `codex exec` accepts
`-c model="<id>"`, and ADR-035 deliberately kept the reviewer on a different model from the implementation,
which is worth restoring — but only once the available Codex model ids are checked against the installed
CLI, so this does not become another command that does not run (see "External review").

## Phase sequence

Branch: `git checkout -b phase/Pxx` from `main` in `/home/dmytro/git/work/resumiser`. Commit after each step below, so a quota pause never loses work.

| # | Step | Output |
|---|---|---|
| 1 | **Plan.** Read `PHASE.md`, its source FR/NFR sections, the frozen contract, and the dependencies. Decide the slices, the test budget and every open question the scope needs. From P10, name the candidate Codex worker tasks, or say there are none. | `architecture/phase-plan.md` (plan, slices, test budget, task list, candidate worker tasks), `decisions.md` (`DELEGATED-DEFAULT` entries), `acceptance-criteria.md`, ADRs if a decision is architectural |
| 2 | **Contract.** Only if the API surface changes: update `contracts/openapi/**` first and regenerate types. The contract is frozen before any code against it. | `contracts/openapi/**`, regenerated types |
| 3 | **Test plan.** Map each acceptance criterion to executable checks and levels. | `tests/test-plan.md` |
| 4 | **Red.** Write the tests. Prove each fails on an assertion about missing behaviour, not on a harness error: projects build, hosts and fixtures start, counts match the plan. | tests, `tests/suite.cmd`, red evidence in `tests/test-results.md` |
| 5 | **Green.** Implement the minimum that passes. Run narrow tests continuously, the full phase suite before step 6. | implementation, green evidence in `tests/test-results.md` |
| 6 | **External review.** `codex review --base main` over the phase diff (see below). Fix blocker, critical and major findings; record minor and info as follow-ups. Then a delta re-review over just those fixes, repeated until the reviewer returns PASS, at most three deltas (ADR-051 Amendment 2 — see "A FAIL verdict" below). | `review/code-review.md` |
| 7 | **Acceptance.** Walk the acceptance matrix from step 1 against the running system, not against the tests. | `qa-report.md` with PASS / FAIL / BLOCKED |
| 8 | **Gate.** `python3 scripts/phase-handoff-check.py --phase Pxx --gate`, then `PHASE-STATUS.md` = `COMPLETED`, then merge `phase/Pxx` into `main` with `--no-ff`. | `PHASE-STATUS.md`, merge commit |

Steps 1–3 are documents; steps 4–5 are the TDD cycle of `.claude/rules/01-tdd-and-quality.md` and are not reordered.

### Batched phases (ADR-051 S-6)

Phase IDs and `TRACEABILITY.md` are never re-cut. When 2–3 consecutive phases have linear dependencies, the operator may run them on one branch with one gate: steps 1–3 produce the artifacts of each included phase separately, steps 4–5 run per phase in dependency order, and steps 6–8 run once for the batch. The gate verifies each included phase's acceptance criteria on its own. Natural batches: P07+P08+P09, P10+P11+P12, P13+P14+P15. A phase whose contract changes mid-batch is split out instead.

`scripts/phase-handoff-check.py` takes the batch form directly — `--phase P07+P08+P09 --gate` — and then unions the phase scopes and allowed paths, runs every included phase's `tests/suite.cmd`, and checks each phase's required artifacts and review/QA verdicts separately. Each included phase therefore needs its own filled `review/code-review.md` and `qa-report.md`, even when one review pass covered the whole batch.

## External review

```bash
cd /home/dmytro/git/work/resumiser          # on branch phase/Pxx, work committed
codex exec --sandbox read-only --cd "$(pwd)" - <<EOF
$(cat .claude/review-prompt.md)

Review the diff of this branch against main: \`git diff main...HEAD\`.
The phase package is \`docs/phases/<Pxx>/\`.
EOF
```

`codex review --base main "<prompt>"` does **not** work: Codex CLI 0.166.0 rejects a custom prompt together
with `--base` (verified 2026-11-04), and `codex review --base main` alone would use Codex's own checklist
instead of this project's. `codex exec --sandbox read-only` keeps the review read-only and carries the
project checklist.

The prompt file carries the project review checklist (scope, behaviour, contract conformance, test integrity, security and privacy, accessibility, maintainability) and asks explicitly for severity per finding. Findings go into `review/code-review.md` verbatim with a verdict line `Verdict: PASS` or `Verdict: FAIL`, followed by what the operator fixed.

A review that cannot run (Codex quota, network) pauses step 6; it does not license skipping it. The phase does not reach the gate without a recorded review verdict.

### A FAIL verdict, and the deltas (ADR-051 Amendment 2)

A `Verdict: FAIL` is the normal case, not an exception, and it does not stop the phase.

1. Fix the blocker, critical and major findings test-first, under the usual TDD rules. Record minor and info
   findings as follow-ups; they do not earn a delta.
2. Note the SHA the reviewer last saw, then run a **delta** over only what changed since:

```bash
codex exec --sandbox read-only --cd "$(pwd)" - <<EOF
$(cat .claude/review-prompt.md)

Review this delta only: \`git diff <last-reviewed-sha>..HEAD -- <paths>\`.
It is a fix to findings from an earlier review of this branch. The phase package is \`docs/phases/<Pxx>/\`.
EOF
```

3. Append the delta to `review/code-review.md` under its own heading naming the diff range, with the
   reviewer's findings and verdict **verbatim**. A FAIL delta sends you back to 1.
4. **Never write a `Verdict:` line yourself.** The gate script matches the last verdict line by text, so an
   operator-written PASS would pass the gate and defeat the rule it encodes. The operator's prose goes below
   the reviewer's verdict, describing what was fixed.
5. The ceiling is **three deltas** per phase. If it is reached with a blocker, critical or major finding still
   standing, or two consecutive deltas FAIL on the same finding, stop: leave `PHASE-STATUS.md` at
   `IN_REVIEW`, record the standing finding, and report to the owner. That is ADR-051 §C.6 — only the owner
   lifts the ceiling or waives the review.

The full review over the whole phase diff still runs exactly once. The deltas are cheap because they are
scoped to the fix; the point of them is that the reviewer has seen the *final* state of the branch, not an
intermediate one. P07 is the worked example of the alternative: the one-delta cap turned a one-line frontend
fix into an owner round-trip and left the phase at `IN_REVIEW` (`docs/phases/P07/decisions.md`
DD-P07-28…DD-P07-30).

## Codex worker tasks (ADR-051 Amendment 3)

Terms, task fit, rollout and the return-to-review-only rules are in the amendment. Worker tasks run only in steps 4–5, one at a time, and never once the full review has started. Fixes for review or acceptance findings are the operator's.

**Credential exposure is accepted for P10–P14 only.** The sandbox does not restrict reads (Amendment 3, "Accepted risk"). In P15, or once a deployment credential is on this machine, the operator does the task itself until the owner has recorded a new decision below the amendment.

These commands ran on 2026-11-05 in a dry run. In `workspace-write` from a linked worktree, edits and `/tmp` writes work. Commits, network, Docker and writes elsewhere are blocked, so a task's commands must work offline with dependencies the operator installed.

Copy `docs/blueprint/templates/codex-task.md` to `docs/phases/<Pxx>/codex-tasks/<Pxx>-CX-<NN>.md`, fill Part A, and commit it with any red tests. List only paths already inside the phase's "Allowed paths". Then:

```bash
T=docs/phases/<Pxx>/codex-tasks/<Pxx>-CX-<NN>.md
BASE=$(git rev-parse HEAD)
OUT=$(mktemp -d)                                  # outside the repository
W="$OUT/wt"
git worktree add --detach "$W" "$BASE"

# The operator installs what the task's commands need, because the sandbox has no network:
npm ci --prefix "$W/frontend" && npm run generate:api --prefix "$W/frontend"

# Run in the background and do not poll; the session is notified when it exits.
timeout 45m codex exec --sandbox workspace-write --ephemeral --cd "$W" --json \
  -o "$OUT/last-message.md" - < "$T" > "$OUT/events.jsonl"
```

`events.jsonl` records commands and token usage (`turn.completed`). Compare the worker's claims with it, but it is not complete: in the dry run it held no record of four probes the final message reported.

When it exits, run the scope check. Each of these rejects the whole patch:

```bash
git -C "$W" add -N .
sed -n '/^### Allowed files/,/^### Forbidden/p' "$T" | grep -oP '^- `\K[^`]+' > "$OUT/allowed.txt"

[ "$(git -C "$W" rev-parse HEAD)" = "$BASE" ] || echo "REJECT: the worker moved HEAD"
git -C "$W" diff --no-renames --name-only "$BASE" | grep -vxFf "$OUT/allowed.txt"   # any output: REJECT
git -C "$W" diff --no-renames --name-status "$BASE" | grep -v '^A'                  # additive task, any output: REJECT
```

`--no-renames` matters: without it, moving a forbidden test onto an allowed path shows only the allowed path. Diffing against `$BASE` rather than `HEAD` matters too: after a worker commit, a diff against `HEAD` is empty.

Then the operator takes over:

```bash
git -C "$W" diff --binary "$BASE" > "$OUT/patch"  # read all of it against Part B's checklist
git apply --check "$OUT/patch" && git apply "$OUT/patch"
# run the task's tests here, with the same commands, and record them in tests/test-results.md
git worktree remove --force "$W"
```

Commit with the trailer `Codex-Task: <Pxx>-CX-<NN>` and fill Part B, including the `Outcome:` line. The worker's final message is a claim, not evidence. The operator may keep working during the run, but not on the task's listed files; `git apply --check` catches a conflict.

`REJECTED` or `FAILED`: the operator does the task itself, and says so in Part B. There is no second dispatch of the same task.

Worker output never goes into `review/code-review.md` or `qa-report.md` (Amendment 3, point 7).

## Artifact ownership

All paths inside `docs/phases/<phase-id>/`. The operator writes all of them except `review/code-review.md`, whose findings come from the external reviewer. Part A of a `codex-tasks/` file is the operator's brief and Part B its record; Codex writes neither.

Required at the gate: `PHASE.md`, `PHASE-STATUS.md`, `architecture/phase-plan.md`, `decisions.md`, `acceptance-criteria.md`, `tests/test-plan.md`, `tests/test-results.md`, `review/code-review.md`, `qa-report.md`.

Retired as required artifacts (ADR-051 S-7): `kickoff.md`, `dependencies.md`, `implementation/backend-tasks.md`, `implementation/frontend-tasks.md`, `coordinator-log.md`. Closed phases keep the copies they already have.

Contract changes go to `contracts/openapi/`. ADRs go to `docs/blueprint/decisions/`, Accepted under delegation.

## Decisions

The operator decides product and architecture questions that the phase scope needs, under ADR-051 S-5 (carrying ADR-035 A-4 forward), and records each as `DELEGATED-DEFAULT` in `decisions.md` with the options considered and the reason. The owner is not asked mid-phase. Only the five stop conditions in ADR-051 §C reach the owner.

## Token economy

The point of this mode is that context is loaded once per phase and stays warm. Accordingly:
- Read a source file once, in step 1, and work from what the plan records — do not re-read the spec at each step.
- Keep the phase on one branch in the primary checkout. No sibling branches, no merge chains, and no worktrees except the temporary detached one for a Codex worker task, which is never merged: its work arrives as a patch.
- Commit after each step. A pause resumes from the committed state plus the phase artifacts, not from a re-read of the whole phase.
- Subagents are for read-heavy fan-out only (finding every place something appears), never for a pipeline step.
