# ADR-035 — Autonomous phase execution via Orca with Claude and Codex workers

- Status: **Superseded** by [ADR-051](ADR-051-single-operator-phase-execution.md) (owner, 2026-11-04). Previously Accepted (owner, 2026-11-02), amended 2026-11-03 (Amendment 1: worker providers; Amendment 2: standing workers) and 2026-11-03 (Amendment 3: Codex model/effort tiers, never measured on a phase).
- Still in force from this ADR: **A-4**, the owner's delegation of product questions and gate acceptance, carried forward by ADR-051 S-5. Everything about Orca orchestration, worker launch, standing workers and the eight-role pipeline is retired.
- Owner: project owner. Drafted by the main session, 2026-11-02.
- Scope: process for P01–P15. No product requirement (`FR-*`, `NFR-*`, `D-*`) changes. Product decisions are delegated, not changed (see A-4).

## Context

P00 cost about 39M cache-read and 530k output tokens on Claude, for a phase that changed only documents. The usage hook started after the Architect plan and Test Architect steps, so the real total is higher. Evidence: `usage-log.ndjson`, `docs/phases/P00/coordinator-log.md` and the phase artifacts.

| # | What happened in P00 | Cost / effect |
|---|---|---|
| W-1 | Owner questions were deferred to the gate. After the answers the phase got a full second code review and a full second QA run, although only owner records had changed. | ~3.3M cache-read plus a coordinator session |
| W-2 | The Opus Solution Architect at `xhigh` both designed the phase and wrote the GOV documents. A rate limit interrupted it. | 14.3M cache-read, the largest item |
| W-3 | Test scope was out of proportion for a documents-only phase: an 835-line test plan, then 48 files and 3710 lines of Python. | 6.0M cache-read, 180k output |
| W-4 | No commit existed, so scope checks used SHA-256 snapshots. Owner edits made during the run caused two anomaly stops and two baseline re-takes. | Coordinator turns, two stops |
| W-5 | One coordinator session ran the whole phase and re-ran every suite by hand after each handoff. | ~5M cache-read in the main session |

The owner also cannot answer questions or open and close gates for 15 phases. The owner has a Claude and a ChatGPT/Codex subscription and wants both used.

Smoke tests on 2026-11-02 (Orca 1.4.245, run `run_c71712d76963`):

- A Codex worker started with `--model gpt-6-sol --effort medium` reported `launch.effective` = `gpt-6-sol`/`medium`. It ran commands and reported `worker_done`.
- Orca launches Codex with `--dangerously-bypass-approvals-and-sandbox` and Claude workers with bypass permissions. Workers do not stop on approval prompts.
- In a worker's shell, plain `orca` resolves to the GNOME screen reader (`/usr/bin/orca`), so lifecycle commands fail with "The following are not valid". `/usr/bin/orca-ide` works.
- A worker cannot start its own workers: `nested_worker_depth_exceeded`, "Sub-worker dispatch is not permitted at depth 2 (max 1)".

Claude Agent Teams was considered and rejected. Teammates are full Claude sessions and cost more than subagents. They cannot host Codex.

## Decision

### A. Owner decisions (2026-11-02)

1. **Orchestration through Orca.** One Claude session, the **Program Coordinator**, runs `/run-project`. It dispatches every role as an Orca worker and never does role work itself.
2. **Provider per role** (superseded by Amendment 1, 2026-11-03; kept as the original decision):

   | Role | Worker launch |
   |---|---|
   | Solution Architect, Test Architect, Contract Architect, Code Reviewer | `--agent claude --model opus --effort high`; Solution Architect uses `--effort xhigh` in P01, P02 and P11 only |
   | Test Engineer, Backend Developer, Frontend Developer, QA / Acceptance | `--agent codex --model gpt-6-sol --effort medium` |
   | Program Coordinator | The main Claude session, started by the owner (Sonnet recommended, see the playbook) |

   Every dispatch passes model and effort explicitly. The Codex account default (`gpt-6-luna`/`high`) does not apply to phase work.
3. **Separate worktrees.** Nothing is edited in the `main` worktree except by merges.
   - Each phase runs in its own Orca worktree on branch `phase/Pxx`, created from `main`.
   - Parallel workers that would share files (Backend ∥ Frontend slices) get child worktrees on `phase/Pxx-be` / `phase/Pxx-fe`, created from `phase/Pxx`.
   - P04 and P05 run as two parallel phases, each in its own phase worktree.
4. **Full delegation, nothing reserved to the owner.**
   - Owner questions are answered by the Solution Architect. Precedence: the source spec first, then `docs/source/README.md` reference-product evidence, then the most conservative, reversible, standard option.
   - Each such answer is recorded in the phase `decisions.md` with the tag `DELEGATED-DEFAULT`, the options considered and the reason.
   - OPEN, SOURCE-OPEN and PROPOSED register items are decided by the Solution Architect through an ADR with status Accepted and Decider "Solution Architect (delegated, ADR-035)". This includes product items D-01…D-20 and EU hosting (ADR-012/ADR-032).
   - Gates are accepted by the Program Coordinator when the gate check passes. This replaces the owner step of `/close-phase`.
5. **Commits and merges.**
   - The Program Coordinator commits on `phase/*` branches after each accepted step and merges `phase/Pxx` into `main` after the gate (`--no-ff`).
   - Workers never commit, push, rebase or reset.
   - Nothing is pushed to a remote.
6. **The owner reviews afterwards, not during.** All `DELEGATED-DEFAULT` decisions are collected into one table in the P15 report. The owner can revisit any of them later.

### B. Lean pipeline (fixes W-1…W-5)

**B-1. Phase sequence:**
1. Kickoff (Solution Architect): `docs/phases/Pxx/kickoff.md` with roles, test budget, parallel slices and the decisions this phase needs.
2. Architecture (Solution Architect): plan, ADRs and delegated answers in the same step (fixes W-1).
3. Test plan (Test Architect), within the kickoff budget.
4. Contract (Contract Architect), only when the phase changes the API.
5. Red tests (Test Engineer).
6. Green implementation (Developers). Backend and Frontend run in parallel child worktrees when the slice contract is frozen.
7. Review (Code Reviewer), one pass.
8. QA, one pass.
9. Gate.

**B-2. One review, delta re-review only.**
- Review findings go back to the *same* worker terminal, so it keeps its context.
- A re-review covers only files changed after the review.
- QA runs once, after review findings are closed.
- Edits to records only (decisions, status) never trigger a re-review or QA re-run (fixes W-1).

**B-3. The Architect designs and does not implement.** Documents and code are written by execution roles. Architect effort is `high`, and `xhigh` only in P01, P02 and P11 (fixes W-2). Since Amendment 1 the Architect runs on Codex `high`, with Claude Opus `xhigh` only in P11.

**B-4. Test budget by phase type,** set in the kickoff (fixes W-3):
- documents/architecture phases: checks extend `scripts/check-blueprint.py` or one small module, with no separate test framework;
- code phases: every Must criterion has a positive and a negative case; Should criteria are tested where the risk register asks;
- no test framework, CLI or fixture tree beyond what the budget names.

**B-5. Deterministic handoff check** (fixes W-4, W-5).
- After each worker step the Program Coordinator runs `scripts/phase-handoff-check.py`. It checks phase allowed paths and role ownership against git, `check-blueprint.py` and the phase suite listed in `docs/phases/Pxx/tests/suite.cmd`.
- The coordinator reads only the script output and the worker's `worker_done` summary. It does not re-run suites by hand or reread artifacts.

**B-6. State lives in files and git.**
- each phase's `PHASE-STATUS.md` and `coordinator-log.md` (append-only, Program Coordinator; no central log, so parallel phases P04/P05 do not conflict on merge), and the `phase/*` branches.
- `/run-project` resumes from them after any interruption.

**B-7. Earlier phase suites are close-time evidence.**
- Later phases legitimately change the decision register: delegated ADRs become Accepted. Re-running the P00 `sources`/`real` checks would then report snapshot drift that is expected, not a defect.
- The handoff check runs only `check-blueprint.py` and the current phase suite. P00 tests are not edited.

### C. Autonomous stop conditions

The Program Coordinator stops the program, writes the reason to the phase `coordinator-log.md` and sets the phase to `BLOCKED` only for:
1. a Must test still failing after two fix rounds;
2. a critical security/privacy finding still open after two fix rounds;
3. the handoff check failing twice for the same step;
4. a worker failing twice on the same task (crash, API error, usage limit). Status `PAUSED`; the owner re-runs `/run-project` later.

A need for real external accounts or secrets (hosting, e-mail provider, domain) is *not* a stop. The phase implements against local Docker services or stubs, records the item in its report, and P15 lists it under "owner actions for go-live".

## Amendment 1 — worker providers (owner, 2026-11-03)

**Context.** During P03 the owner's Claude subscription reached 76% of the weekly limit, while Codex was at 8%. Under A-2 every design and review step ran on Claude Opus, so Claude would run out long before P15.

**Decision.** A-2 is replaced by the table below. `docs/blueprint/AGENT-WORKFLOW.md` ("Worker launch table") is the operative copy.

| Role | Worker launch | Codex fallback (used while the Claude fallback switch is on) |
|---|---|---|
| Solution Architect | `--agent codex --model gpt-6-sol --effort high`; P11 only: `--agent claude --model opus --effort xhigh` (renderer decision, ADR-010) | P11: Codex `gpt-6-sol` `high` |
| Test Architect, Contract Architect | `--agent codex --model gpt-6-sol --effort high` | — |
| Code Reviewer | `--agent claude --model sonnet --effort high` | `--agent codex --model gpt-6-luna --effort high` |
| Test Engineer, Backend/Frontend Developer, QA / Acceptance | `--agent codex --model gpt-6-sol --effort medium` (unchanged) | — |
| Program Coordinator | Main Claude session, Sonnet (unchanged) | — |

- Review stays on Claude, so it still runs on a different vendor than the implementation. The Codex fallback uses a different model than the developers.
- Claude limits are per account. The Program Coordinator, the Claude workers and any other Claude session share one quota. When the limit is reached the coordinator stops too, so it cannot react to the limit by itself. The fallback is therefore switched on **before** Claude runs out:
  - the owner tells the coordinator "switch Claude roles to fallback";
  - the coordinator appends `CLAUDE-FALLBACK: on (owner, <date>)` to the current phase's `coordinator-log.md` and from then on dispatches the Code Reviewer and the P11 Solution Architect with their Codex fallback flags;
  - `CLAUDE-FALLBACK: off (owner, <date>)` switches back. The latest entry across all phase logs wins, so the switch survives new coordinator sessions.
- If the Claude limit is reached anyway, ADR-035 §C-4 applies unchanged: the run stops, the phase is `PAUSED`, and the owner re-runs `/run-project` after the reset.
- **One phase per coordinator context.** The coordinator's context grows with every worker message, and P01–P02 showed that the coordinator was the largest Claude consumer. After each phase gate (P04 and P05 count as one unit) `/run-project` starts `scripts/coordinator-restart.sh` detached and ends its turn. The script waits until the coordinator's Orca terminal (`ORCA_TERMINAL_HANDLE`) is idle, types `/clear` and then `/run-project`, so the next phase starts with an empty context in the same session without the owner. Tested 2026-11-03: after the scripted `/clear` the session no longer knew facts from before it. State is restored from git and phase files as before (B-6).
- Steps already committed under A-2 stay valid. The P03 Solution Architect and Test Architect steps ran on Claude Opus before this amendment.
- Codex workers read `AGENTS.md`, which points them to the role files, so no role file changes are needed.

**Consequences.** Design documents and test plans are now produced by the same vendor as the code. The Claude Code Reviewer and the deterministic handoff check remain the independent controls. Claude usage drops to the coordinator, one review per phase and the P11 architecture.

## Amendment 2 — standing workers per phase (owner, 2026-11-03)

**Context.** In the shared P04+P05 run (`run_6d8d594259cb`) the coordinator started 26 workers and reused none of them. In P04 alone the Test Engineer was started four times and the Backend Developer twice, because red/green hand-backs (harness defects, test-count fixes) bounced between the two roles. Every new worker re-reads `AGENTS.md`/`CLAUDE.md`, rules, the role file, the phase plan, the test plan and the code it touches before doing any work, which costs time and tokens on each bounce.

The same-terminal reuse that B-2 and `AGENT-WORKFLOW.md` prescribe for fix loops never worked. Orca starts workers as structured agent sessions (`structworker_*` handles, the owner's default for new agent tabs). Smoke test on 2026-11-03 (run `run_a66c332a6b24`, Codex `gpt-6-luna` `low`):
- `worker-start --task <new> --terminal <handle> --worktree <wt>` on a settled worker fails with `terminal_unsupported_for_agent_session`; `dispatch --inject` fails the same way. The P04/P05 logs recorded this as a "silent" failure.
- `send --to dispatch:<id>` to a settled Dispatch fails with `dispatch_inactive`.
- A worker that does **not** send `worker_done` but blocks in `orchestration ask` after its step works: the coordinator answered with a second instruction, and the worker recalled a word given only in its first instruction, then sent `worker_done` after a `RELEASE` answer.

**Decision.** Execution roles run as *standing workers*: one Dispatch per role per phase (per child worktree in parallel mode), kept alive through the ask loop instead of a fresh worker per hand-back. `docs/blueprint/AGENT-WORKFLOW.md` ("Standing workers") is the operative copy.

1. **Which roles stand.**

   | Role | Lifetime |
   |---|---|
   | Test Engineer, Backend Developer, Frontend Developer | from the first dispatch to the gate |
   | Solution Architect | from kickoff to the end of the green step (answers questions in its own context); released before review |
   | Code Reviewer, QA / Acceptance | **first pass always in a fresh worker** (independence); afterwards standing for delta re-checks until the gate |
   | Test Architect, Contract Architect | one-shot as before; Contract Architect stands only if the phase has a contract fix loop |

2. **Protocol.** After each instruction the worker does not send `worker_done`. It runs `/usr/bin/orca-ide orchestration ask --question "STEP DONE: <3-sentence summary>; files: <csv>" --timeout-ms 1800000` and, on timeout, resumes the same question (`--resume <message_id>`). The coordinator treats a `STEP DONE:` question as the step report: it runs the handoff check, commits, and answers only when that worker has its next instruction (a FAIL from the handoff check, review findings, a QA failure, the next task). The answer `RELEASE` makes the worker send `worker_done` and stop. Any other question from a standing worker is a real question and is routed as before.
3. **Context guard.** A standing worker is replaced by a fresh one (`RELEASE`, then a new dispatch whose spec names the committed artifacts) after 5 instructions, or earlier when it reports that its context was compacted or is near the limit.
4. **Cleanup.** At the gate, at any §C stop and when the coordinator context restarts, every standing worker gets `RELEASE` and is released after its `worker_done`. A coordinator that resumes a run and finds standing workers it did not start in this context releases them rather than adopting them.
5. **Red-step harness proof.** Before its first `STEP DONE`, the Test Engineer proves that the suite fails *only* by assertions on missing behaviour: the test projects build, hosts and fixtures start, and no test fails on harness errors (paths, ports, test counts). The proof is recorded in `tests/test-results.md`. This targets the cause of most P04 bounces; it restates `.claude/rules/01-tdd-and-quality.md` rule 3 as a checked step.

B-2 "findings go back to the same worker terminal" now means: to the same standing worker, via its pending `STEP DONE` question. The rule "Fresh workers per role; the same terminal only for fix loops" in `AGENT-WORKFLOW.md` is replaced.

**Consequences.**
- Saved: re-initialisation and re-exploration on each hand-back; a hand-back becomes one answer to a pending question.
- Cost: every new instruction re-sends the worker's accumulated context. Provider prompt caches make this cheap while warm, but a cache can expire while the worker waits (for example during a long green step), and then the whole context is billed at the full input rate. The context guard (item 3) bounds this. Each ask timeout costs one short resume turn.
- Independence is kept for the first review and the first QA pass; delta re-checks in the same session are acceptable because they verify the reviewer's own findings.
- Not yet measured on a real phase. The coordinator records per step in `coordinator-log.md` whether the worker was standing or fresh, so P06 can be compared with P04.
- If Orca later supports follow-up dispatch into a settled agent session, the ask loop can be replaced without changing the role lifetimes.

## Amendment 3 — raise Codex model/effort to match Claude-role frontmatter (owner, 2026-11-03)

**Context.** Amendment 1 moved design, test and implementation roles to Codex at a flat `gpt-6-sol` (architects at `high` effort, implementers at `medium`), chosen for quota relief rather than matched to each role's intended capability tier. The `.claude/agents/*.md` frontmatter (used when a role runs as a Claude fallback) still states the capability each role was designed for: Opus/high for Solution/Test/Contract Architect, Sonnet/high for Test Engineer and Backend/Frontend Developer, Sonnet/medium for QA/Acceptance.

**Decision.** Codex launch flags are raised to match each role's frontmatter tier, using the owner's Claude→Codex mapping (Opus low→Sol low; Opus medium→Sol xhigh/max or Astra high; Opus high→Astra max; Opus xhigh/max→no direct analog, Astra max slightly below). `docs/blueprint/AGENT-WORKFLOW.md` ("Worker launch table") is the operative copy.

| Role | Old launch | New launch |
|---|---|---|
| Solution Architect (non-P11), Test Architect, Contract Architect | `--agent codex --model gpt-6-sol --effort high` | `--agent codex --model gpt-6-astra --effort max` |
| Solution Architect, P11 Codex fallback | Codex `gpt-6-sol` `high` | Codex `gpt-6-astra` `max` |
| Test Engineer, Backend Developer, Frontend Developer | `--agent codex --model gpt-6-sol --effort medium` | `--agent codex --model gpt-6-sol --effort high` |
| QA / Acceptance | `--agent codex --model gpt-6-sol --effort medium` | unchanged (`gpt-6-sol` `medium` already matches its Sonnet/medium frontmatter) |

- Code Reviewer is untouched: it stays on Claude Sonnet/high, with its Codex fallback staying `gpt-6-luna` `high` (a deliberately distinct model from the architects' and developers' Codex models, to keep the fallback review on a different model than the implementation).
- This amendment is a cost/capability trade-off, not a new quota-relief decision: Amendment 1's reasoning (relieve Claude quota pressure) still holds, this only corrects how much Codex capability each role gets while staying off Claude.

**Consequences.** Architect-tier steps (kickoff, architecture, test plan, contract) cost more per token on Codex than `gpt-6-sol`; implementer-tier steps (test writing, backend/frontend code) cost somewhat more than `medium`. Not yet measured on a real phase; compare P06 token cost against P04/P05 once run.

## Alternatives considered

- **Claude Agent Teams:** Claude only and more tokens. Rejected.
- **Two-level coordination** (a Claude phase coordinator per phase starting its own workers): blocked by Orca's default nested depth of 1. It would need the owner to raise "Nested worker depth" in Orca settings. Not needed: the Program Coordinator keeps only summaries in context.
- **Subagents for the Opus roles inside the coordinator session:** their results would grow the coordinator's context, and P00 shows the cost. Rejected in favour of separate worker sessions.

## Consequences

- Test writing, implementation and QA, the token-heavy part, run on the Codex subscription. Claude covers design, review and coordination.
- Review runs on a different vendor than the implementation, which strengthens independence.
- Claude reads `CLAUDE.md` and Codex reads `AGENTS.md`. `AGENTS.md` only points to the shared rules and does not copy them.
- `log-usage.py` does not see Codex. each phase `coordinator-log.md` records provider and model per step.
- Codex does not run Claude hooks. Enforcement is the handoff check, review and the gate.
- Product decisions may differ from what the owner would have chosen. Mitigation: A-4 precedence, the `DELEGATED-DEFAULT` tag and the P15 decision table.

## Security/privacy impact

Workers get repository source and docs only. There is no real user data before production. Both providers follow `.claude/rules/03-security-privacy.md`: no secrets in the repo and no resume content in logs. Workers run without sandbox (Orca default), so their task specs must name allowed paths, and the handoff check enforces them through git.
