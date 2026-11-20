# ADR-051 — Single-operator phase execution; Orca orchestration retired

- Status: **Accepted** (owner, 2026-11-04). **Supersedes [ADR-035](ADR-035-agent-orchestration-and-pipeline-economy.md)** and its Amendments 1–3.
- Owner: project owner. Drafted by the main session, 2026-11-04.
- Scope: process for P06–P15. No product requirement (`FR-*`, `NFR-*`, `D-*`) changes. The owner's delegation of product questions and gates (ADR-035 A-4) is **kept**, not revoked.

## Context

ADR-035 set up an eight-role pipeline executed by Orca workers, with Codex carrying design, test and implementation work and Claude carrying review. It was adopted to relieve Claude quota pressure and to spare the owner from answering questions across 15 phases. The delegation part worked. The orchestration part did not.

### Measured outcome

Claude usage log (`usage-log.ndjson`, latest row per session, 33 sessions, P00–P05 plus P06 coordination):

| Metric | Value |
|---|---|
| Cache-read input tokens | 147,672,914 |
| Cache-creation input tokens | 4,298,922 |
| Output tokens | 1,007,574 |
| Read-to-output ratio | **146 : 1** (a symptom, not a waste measure — see Amendment 1) |

Codex usage is not in this log and is additional. Product delivered over that spend: the blueprint, the P03 toolchain, a backend skeleton with two health endpoints, a frontend shell, and the unfinished P06.

### P06 as the worked example

`phase/P06` reached 71 commits and ~5,200 changed lines with a first-pass review of 0 blocker, 0 critical, 5 major — then stalled. Its `coordinator-log.md` records 5 pauses on the Codex usage limit, 3 worker deaths (usage limit, `EAI_AGAIN`), a `phase/P06-fe` branch that diverged 69 commits from its parent, and an architecture decision (DD-P06-15) that was never written because the Solution Architect worker died before producing output.

### Causes, in order of cost

1. **Context re-derivation.** Eight cold roles over nine steps means the same spec, contract and repository conventions are re-read from files up to eight times per phase. This is what the 146:1 ratio measures. It is structural, not a tuning problem.
2. **Idle cache burn.** Standing workers report through a blocking `STEP DONE:` ask. While one worker runs, the coordinator and every other standing worker hold warm context and pay for it without producing anything.
3. **Integration overhead with no product.** Three worktrees per phase plus merge chains produced a large share of P06's commits (`coordinator-log` entries, merge commits, WIP pauses) and no behaviour.
4. **Quota as the binding constraint, spent on reading.** Codex quota, not engineering difficulty, decided when P06 progressed. That quota went mostly to re-reading context.
5. **The cross-vendor split forbids the one real remedy.** The fix for (1) is a shared warm context across steps. A Claude/Codex handoff makes that impossible by construction.

ADR-035 §"Token economy" already tried to counter this (paths not content, one review per phase, standing workers). Those measures reduced the constant and left the 146:1 structure intact.

## Decision

**S-1 — Single operator.** One Claude session executes a phase end-to-end in the primary checkout on branch `phase/Pxx`. No Orca workers, no Program Coordinator role, no child worktrees (except the temporary per-task worktree of **Amendment 3**), no standing workers, no `STEP DONE` ask loop.

**S-2 — Roles collapse into the operator.** Planning, decisions, test authoring, implementation, evidence and acceptance are performed by the operator in one continuous context. The eight-role split is retired as an execution mechanism; the *checklists* those roles carried survive in `.claude/rules/` and `.claude/skills/`.

**S-3 — One external reviewer, different vendor, no implementation work.** Independent review is kept, because it is the one thing the role split bought that tests cannot replace: an actor that did not write the code. It runs as `codex review --base main` — the non-interactive Codex CLI, invoked directly, with no Orca involvement — once per phase over the full phase diff, with its findings recorded in `review/code-review.md`. Delta re-reviews after fixes are capped per **Amendment 2** (deltas until PASS, ceiling three; originally "at most one delta re-review after fixes"). Codex is given **no** design, test or implementation work, apart from the bounded worker tasks of **Amendment 3**, and never any design work.

**S-4 — TDD is unchanged.** `.claude/rules/01-tdd-and-quality.md` stays in force in full: tests before production code, a proven red state failing for the intended reason, evidence with exact commands and exit codes in `tests/test-results.md`. In a single context this costs a fraction of what it cost across handoffs. The CLAUDE.md non-negotiables are untouched.

**S-5 — Delegation survives.** ADR-035 A-4 continues to apply: the operator decides product and architecture questions that the phase scope needs and records them as `DELEGATED-DEFAULT` in `decisions.md`. The owner is not asked mid-phase and reviews afterwards. Stop conditions move from ADR-035 §C to §C of this ADR.

**S-6 — Phase identifiers stay; execution is batched.** `docs/phases/README.md`, the phase graph and `TRACEABILITY.md` are not re-cut, so requirement mapping stays intact. The operator may execute 2–3 consecutive phases on one branch with one gate for the batch, when their dependencies are linear and any contract change for the slice is frozen first. Natural batches: P07+P08+P09 (editor), P10+P11+P12 (design, layout and export), P13+P14+P15 (hardening and release). A batch gate verifies every included phase's acceptance criteria separately.

**S-7 — Required phase artifacts reduced.** Required per phase: `PHASE.md`, `PHASE-STATUS.md`, `architecture/phase-plan.md`, `decisions.md`, `acceptance-criteria.md`, `tests/test-plan.md`, `tests/test-results.md`, `review/code-review.md`, `qa-report.md`. No longer required: `kickoff.md` (its test budget and slice list move into `architecture/phase-plan.md`), `dependencies.md` (already in `PHASE.md`), `implementation/backend-tasks.md` and `implementation/frontend-tasks.md` (the task list moves into `architecture/phase-plan.md`), `coordinator-log.md` (no coordinator). Closed phases P00–P05 keep every file they already have; records are preserved, not deleted.

**S-8 — Gate.** `scripts/phase-handoff-check.py --phase Pxx --gate` plus a green `tests/suite.cmd`, review PASS and QA PASS accepts the gate: `PHASE-STATUS.md` = `COMPLETED`, merge to `main`. Per-step role-scope checking is removed from the script — it existed to police untrusted workers wandering outside their allowed paths, and the operator's diff is reviewed as a whole instead. The secrets scan, suite check, blueprint check and gate artifact/verdict checks are kept.

**S-9 — Retired.** `/run-project`, `/run-phase`, `scripts/coordinator-restart.sh`, `docs/blueprint/ORCA-PLAYBOOK.md`, and the `.claude/agents/` role definitions for the pipeline roles. `docs/blueprint/AGENT-WORKFLOW.md` is rewritten as the single-operator workflow. `/blueprint-status`, `/review-phase` and `/close-phase` are kept.

## C. Stop conditions (replaces ADR-035 §C; a sixth added by Amendment 2)

The operator stops and reports to the owner on:

1. A source requirement conflict between files in the source-of-truth hierarchy that cannot be resolved without changing recorded intent.
2. A failing Must acceptance criterion that cannot be fixed without weakening a test, the contract or an acceptance criterion.
3. A security or privacy blocker (cross-user data access, credential or resume-content exposure).
4. A non-deterministic test or renderer output that resists stabilisation.
5. A missing external account, secret or paid service that no local stub can stand in for.
6. The external review's delta ceiling is exhausted with a blocker, critical or major finding still standing, or two consecutive deltas FAIL on the same finding (Amendment 2).

Ambiguous requirements and open decisions do **not** stop the work: they are decided under S-5. Quota exhaustion is not a stop condition, it is a pause: the branch is committed and the work resumes in the next session from the committed state.

## Consequences

**Accepted costs.**
- Fewer independent viewpoints. Separate Test Architect, Reviewer and QA actors are gone; correctness now rests on the tests, the OpenAPI contract, and one external Codex review per phase. If a class of defect escapes all three, nothing else is positioned to catch it before the gate.
- No parallel backend/frontend execution. Work inside a phase is sequential. Given that P06's parallel branches cost more in merges and divergence than they saved, this is expected to be faster in wall-clock terms, but it is a real reduction in theoretical throughput.
- The operator both writes and self-checks the tests, so the ADR-035 guarantee that a different actor authored the tests is weakened. The red-state evidence requirement in S-4 is what remains of it, and the external review is asked to check test integrity explicitly.

**Expected gains.**
- The 146:1 read-to-output ratio should fall by roughly an order of magnitude: context is loaded once per phase and stays warm for the whole phase.
- No idle cache burn, no worker liveness management, no nested-depth constraints, no cross-vendor handoff, no merge chains between sibling worktrees.
- Progress no longer depends on Codex quota timing. Codex is on the critical path once per phase, for a review of a diff, and a failure there delays only the review.

## Amendment 1 — the read-to-output ratio was the wrong success test (operator, 2026-11-04)

The Decision above was adopted with this measurement clause: *"P06's completion under this ADR, and each
later phase, is compared against P04/P05 by the same usage log. If the read-to-output ratio does not improve
materially, the cause is not the orchestration and this ADR should be revisited."*

P06 was then finished under this ADR, and **that test fails**:

| | Pipeline (33 sessions, P00–P05 + stalled P06) | Single operator (P06 finished) |
|---|---|---|
| `cache_read` : `output` | 147 : 1 | **303 : 1** |
| Average prefix re-sent per call | 109,957 | **309,122** |
| `cache_creation` : `output` | 4.3 : 1 | **3.2 : 1** |
| `cache_creation` per session | 130,270 | 492,497 |

The ratio did not improve; it doubled. The clause was wrong, not the decision, and the error is worth
recording because it would otherwise invite reverting a mode that worked.

`cache_read` is approximately *average prefix size × number of calls*. It therefore measures how agentic a
piece of work was, not how wasteful. A single operator holding the spec, the contract, the code and a
5,200-line diff in one context carries the largest possible prefix and re-sends it on every tool call, so
this metric penalises precisely what S-1 does deliberately. The Context section's 146:1 figure is a symptom
of the pipeline, not a measurement of its waste.

**The measurement that does hold.** Re-derivation of context is `cache_creation` per unit of output — how
often context had to be loaded from cold. That improved from 4.3:1 to 3.2:1, about 26%: real, and far smaller
than the Context section implies.

**What the ratio hides, and what actually distinguished waste from work.** The pipeline's two coordinator
sessions ran at 436:1 and 369:1 — 110k tokens of prefix carried on each of 257 and 223 calls to emit a
dispatch message or make a commit. Almost none of that context was needed for what those sessions produced.
The operator session's 303:1 carried more, but carried it to write tests and implementation against the
material in it. A ratio cannot tell the two apart; the question "was the carried context needed for the
output" can.

**The gains that were real, in other units.**
- The phase finished. The pipeline spent 147.7M cache-read on P00–P05 plus an unfinished P06; the operator
  session spent 91.8M and closed P06.
- Quota stops went from five to zero. `coordinator-log.md` records five pauses on the Codex usage limit and
  three worker deaths; tokens spent re-reading are tokens unavailable for work, which is how spend became a
  deadlock.
- Idle burn disappeared with the blocking `STEP DONE` loop, which held warm contexts in waiting workers and
  the coordinator while each waiting turn re-sent a full prefix and produced nothing.
- Sibling-worktree merge chains disappeared.

**Replacement success test for later phases.** Judge this mode on: whether phases close without a
process-caused stop; `cache_creation` per unit of output; the count of quota pauses and dead actors per
phase; and defects found by the external review and the acceptance pass rather than after the gate. Do not
judge it on `cache_read` per unit of output.

## Amendment 2 — what follows a FAIL delta re-review (operator, 2026-11-05)

S-3 says "at most one delta re-review after fixes" and stops there. It does not say what happens when that
delta comes back `Verdict: FAIL` with a finding the operator can fix. P07 hit exactly that case and stalled:
`decisions.md` DD-P07-28 first chose to close on an operator-written verdict line, DD-P07-29 withdrew that
because `/close-phase` step 2 requires a PASS **from the external review**, and the phase sat at
`IN_REVIEW` until the owner authorised a second delta out of band (DD-P07-30). That delta covered one
frontend diff and returned PASS with no findings. The process cost an owner round-trip; the review cost
almost nothing.

The cap was aimed at the wrong quantity. What is expensive is a **full** review of the phase diff; a delta
scoped to the files just changed is cheap, and it is also the only thing that keeps the S-3 guarantee — an
actor that did not write the code has read it — true of the *final* state of the branch rather than of an
intermediate one. Capping deltas at one buys nothing and, when the delta fails, forces a choice between
stalling and closing on unreviewed code.

**S-3 is amended as follows.**

1. **Deltas run until the reviewer returns PASS, with a ceiling of three delta runs per phase.** Each delta
   covers only the files changed since the previous reviewer run (`git diff <previous-review-sha>..HEAD --
   <paths>`), recorded with its diff range in `review/code-review.md`. The "once per phase" limit on the
   **full** review over the whole phase diff is unchanged.
2. **A FAIL delta is not a stop.** Fix blocker, critical and major findings test-first under the normal TDD
   rules, then run the next delta over that fix. Minor and info findings are recorded as follow-ups and do
   not earn a delta.
3. **The operator never writes a `Verdict:` line.** Every verdict in `review/code-review.md` is the external
   reviewer's own output, verbatim. The operator's text goes below it, describing what was fixed. This closes
   the hole DD-P07-28 walked into: the gate script matches the last verdict line by text, so an
   operator-written PASS would satisfy the script and defeat the rule behind it.
4. **Exhausting the ceiling is a sixth stop condition** (added to §C): three deltas run and a blocker,
   critical or major finding still stands, or two consecutive deltas FAIL on the same finding. The operator
   stops, leaves `PHASE-STATUS.md` at `IN_REVIEW`, and reports to the owner with the standing finding and the
   options. Only the owner lifts the ceiling or waives the review requirement.

Retrospectively, P07 is consistent with this amendment: two deltas, the second returning PASS. DD-P07-30
stands as the owner's decision at the time and needs no re-litigation; this amendment makes the same outcome
the default so the next phase does not need one.

## Amendment 3 — Codex as a bounded worker from P10 (owner, 2026-11-05)

The owner allows Codex to take small, self-contained tasks from P10 on, in addition to its reviewer role. This
is a contractor arrangement and does not bring back the pipeline: the ADR-035 costs in the Context section came
from cold actors owning phase steps and from sibling branches, and neither returns here. **S-1 and S-3 are
amended as follows; the rest of this ADR stands.**

1. **The operator stays the only operator.** Codex owns no phase step, no decision and no record. Only a task
   the operator wrote in `docs/blueprint/templates/codex-task.md` form reaches it. Nothing waits on Codex: if it
   fails, times out or hits quota, the operator does the task.
2. **Two task kinds.** `implementation`: the operator has committed the failing tests, and Codex makes them pass
   by changing only the listed files. `additive`: Codex only adds new files (tests, fixtures, scripts, runbook
   drafts); it changes no existing file. S-4 still holds. An `additive` test against existing code has no red
   state to prove, so the operator shows each one can fail.
3. **Never given to Codex:** design and template decisions, ADRs, the contract, generated types, the layout
   engine, the PDF core, golden files, security fixes, fixes for review or acceptance findings, phase records,
   dependency changes, deployments and secrets.
4. **Protocol** (exact commands: `AGENT-WORKFLOW.md`, "Codex worker tasks"). The exception to S-1's "no child
   worktrees" is one temporary detached worktree per task, with no branch, removed after the task:
   1. The operator commits the task file and any red tests on `phase/Pxx`, then creates the worktree at that SHA.
   2. Codex edits files there and leaves them uncommitted. No commits, pushes or secrets.
   3. Mechanical scope check. A moved `HEAD`, or any path outside the task's exact file list, rejects the patch;
      on an `additive` task so does any changed or deleted existing file. A rejected patch is not trimmed.
   4. The operator reads the diff, applies it to `phase/Pxx`, runs the tests itself and commits, with the trailer
      `Codex-Task: <id>` recording Codex as author. Only the operator's run is evidence (`tests/test-results.md`).
5. **Limits.** One task at a time, as a background process with a 45-minute limit, so waiting holds no idle
   context (Context, cause 2). Codex never runs Docker, Compose or a phase suite, because concurrent runs make
   the handoff check flaky; tasks that need the stack (P13 integration tests, P14 real-stack journeys, P15 load
   scripts) are written by Codex and run by the operator.
6. **The review comes first.** Codex quota cannot be read in advance, so the reservation is by position: worker
   tasks run only in steps 4–5, never once the full review has started. A quota hit on a worker task ends worker
   tasks for that phase. P08+P09 shows the reserve is needed: the full review plus all three deltas, with deltas
   2 and 3 covering changes made after the review (`docs/phases/P08/review/code-review.md`).
7. **Records.** Each task is `docs/phases/<Pxx>/codex-tasks/<id>.md`, carrying the brief, the operator's review
   checklist and an `Outcome:` line. Worker output stays out of `review/code-review.md` and `qa-report.md`:
   `verdict()` in `scripts/phase-handoff-check.py` takes the last line mentioning "verdict" with PASS, FAIL or
   BLOCKED, so a pasted summary could change the gate result.
8. **Review independence is the new risk.** Codex reviewing Codex weakens S-3, whose point is an actor that did
   not write the code. For those slices the operator's review of the diff is the independent one and is treated
   as such. The external reviewer is still pointed at those commits by `.claude/review-prompt.md` and told they
   are not vetted. Use a different model from the worker's where one is available; which ids are usable is still
   unverified, so `AGENT-WORKFLOW.md` "Model and effort" still applies.

**Task fit.** A guide, checked against each phase plan. Step 1 of each phase names its candidate tasks, or none.

| Phase | Codex may take | The operator keeps |
|---|---|---|
| P10 | Further templates, after the operator has built T1, its pattern and shared controls, and ADR-024 has settled D-12 | ADR-024, template design, shared controls, the ADR-010 prototype gate |
| P11 | `additive` fixture resume content (inputs, never expected output) | Layout engine, parity tests |
| P12 | Library export action (FR-LIB-06), performance test scripts | PDF core, golden files, Unicode decisions |
| P13 | `additive` adversarial authorization and upload abuse tests | Fixes, restore drill, security decisions |
| P14 | `additive` E2E journeys, cross-browser smoke | Traceability, acceptance verdicts |
| P15 | `additive` load test scripts, runbook drafts | Deployments, secrets, rollback decisions |

P13 and P14 fit best, because Codex tests code it did not write.

**Rollout.** The pilot is T2 "Compact" in P10 (TECHNICAL-SPEC §7: single column, one zone, no photo), then T3
"Sidebar" only if T2 was accepted and the plan finds T3's D-13 placement separable from design decisions. If
ADR-024 or the plan leaves no such task in P10, the pilot moves to the first suitable task in a later phase. No
other worker tasks run until the pilot's first task is recorded.

**Measure.** For each task: the outcome, the operator's rework, and Claude's tokens from dispatch to commit,
taken from the session transcript between the timestamps in Part B (the usage log only snapshots at the end of a
turn, so it cannot isolate a task). The comparison is the nearest equivalent the operator built itself, which is
an estimate, because no true control exists. `cache_creation` counts, as in Amendment 1. Worker tasks continue
only if that cost is lower.

**Return to review-only** if two of the first three patches are `REJECTED`, a Codex-written defect gets past the
operator's review (found by the external review, acceptance or later), or Codex causes a stall, meaning the phase
is held up beyond the fallback. A `FAILED` run alone is not a stall. The operator records the return in
`decisions.md` and below this amendment, and it takes effect at once. Resuming is the owner's decision.
`grep -h '^Outcome:' docs/phases/*/codex-tasks/*.md` is the running count.

**Dry run, 2026-11-05 (Codex CLI 0.166.0, default model, throwaway worktree).** `codex exec --sandbox
workspace-write` edited a tracked file, created a new one and ran a Vitest file, using dependencies the operator
installed first. The documented scope check and `git apply --check` passed on its real output. The same profile
was then probed directly with `codex sandbox -c 'sandbox_mode="workspace-write"'`, with no model involved:

| Probe from a linked worktree | Result |
|---|---|
| Edit inside the worktree | Allowed |
| `git commit` | Blocked (`.git/worktrees` is read-only) |
| Network | Blocked (DNS fails) |
| Docker | Blocked (socket permission denied) |
| Write to the primary checkout or the home directory | Blocked (read-only file system) |
| Write to `/tmp` | **Allowed** |
| Read outside the worktree, including the primary checkout | **Allowed** |

Two limits of this evidence. In the `codex exec` run, the event log holds no command record for the commit, Docker
or outside-write probes, though the final message reported exit codes and error text for them. That text matched
the direct probes, but the gap is unexplained, so a worker's report is never evidence on its own. And usable model
ids are still unverified: neither the event log nor the CLI output named the model.

**Accepted risk: reads are not restricted.** A worker can read credentials in the home directory, and whatever it
reads goes to the model provider. Blocked network and blocked writes do not change that. The repository holds only
`.env.example`, but `~/.azure` and `~/.ssh` exist on the machine that ran the dry run. Only the instruction in
`AGENTS.md` and the task file keeps a worker away from them.

**Owner decision, 2026-11-05: the exposure is accepted for P10–P14.** This holds only while `~/.azure` is not a
login that matters to this project. **No worker task runs in P15, or once a deployment credential is on this
machine, until the owner reviews this decision and records the result below this amendment.** Until then the
operator does those tasks itself; this is the fallback of point 1, not a stop condition.

**Not part of this amendment.** Read-only advisory Codex runs, read-only subagent checks, and an agent-team pilot
on P13–P14 were discussed and not accepted.

## Alternatives considered

- **Keep the pipeline, raise Codex capability (ADR-035 Amendment 3).** Addresses step quality, not the 146:1 structure, and increases cost per token. Superseded before it was ever measured on a phase.
- **Keep the pipeline on Claude only.** Removes the cross-vendor handoff but keeps eight cold contexts per phase and puts all of it on one quota. Rejected.
- **Single operator with no external review.** Fastest, but gives up the only check that reads the code without having written it. Rejected by the owner, 2026-11-04.
- **Re-cut P07–P15 into ~5 larger phases.** Reduces gate ceremony but requires rewriting `docs/phases/README.md`, `TRACEABILITY.md` and the phase folders, putting requirement traceability at risk for a process gain. Rejected in favour of S-6 batching, owner, 2026-11-04.
