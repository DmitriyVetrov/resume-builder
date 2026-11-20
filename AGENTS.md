# AGENTS.md — entry point for Codex

Under [ADR-051](docs/blueprint/decisions/ADR-051-single-operator-phase-execution.md) Codex has two possible jobs in this project: **independent external review of a phase diff**, and, from P10, **a single bounded worker task** written by the operator (Amendment 3). A single Claude operator session does the planning, the design and the phase's steps. The Orca worker pipeline of ADR-035 is retired.

Your prompt tells you which job this is. A worker prompt starts with `# Codex task` and is run in a temporary worktree. Anything else is a review. If you were invoked as something other than these two, stop and say so.

## Reviewing

You are normally started with `codex exec --sandbox read-only` with `.claude/review-prompt.md` plus the diff range on stdin (exact command in `docs/blueprint/AGENT-WORKFLOW.md` → "External review"), from a `phase/Pxx` branch. **`.claude/review-prompt.md` is your checklist** — follow it; it names what to read and in which order of priority.

## Hard rules for reviewing

- **Read-only.** Do not edit, create or delete any file. Do not commit, push, rebase, reset or stash. Report findings; the operator applies the fixes.
- Judge the diff against `docs/phases/<Pxx>/acceptance-criteria.md`, `architecture/phase-plan.md` and the OpenAPI contract in `contracts/openapi/` — the contract is the single source of truth for anything crossing the backend/frontend boundary.
- The same session wrote both the tests and the implementation, so **test integrity is your highest-value check**: a weakened, deleted, skipped or narrowed test, or a test that asserts what the code does rather than what the acceptance criteria require, is a finding.
- `docs/source/**` is the product owner's and defines target behaviour; `docs/source/TECHNICAL-SPEC.md` §3.2 lists what must *not* be implemented.
- Never quote resume content, contact data, passwords, tokens or photo bytes in your output. Flag any such value you find in logs or telemetry as a security finding.
- Every finding needs a severity (`blocker` / `critical` / `major` / `minor` / `info`), a file and line, and a concrete input or state that triggers the failure. A finding with no concrete failure path is `info`.
- End with exactly one line: `Verdict: PASS` or `Verdict: FAIL`. FAIL if any blocker, critical or major finding stands.

## Worker

The task file on stdin is your whole assignment; its Part A sets the goal, the tests, the exact files you may change and the commands to run.

- Change only the files under "Allowed files". Any other changed path rejects your entire patch, including new files, moved files and formatting changes.
- Leave your work uncommitted. Do not run `git commit`, `add`, `stash`, `reset`, `rebase` or `push`, and do not create branches. The operator takes the patch from the working tree.
- Never change an existing test to make it pass. Never change the contract, generated types, phase records, dependencies or anything else under "Forbidden paths".
- Make no design decision. If the task needs one, or needs a forbidden path, stop and report it. Do not work around it.
- No Docker, no Compose, no phase suites. Run only the commands the task lists.
- Do not read secrets or files outside your worktree. Never quote resume content, contact data, passwords or tokens in your output.
- Report what changed, each command you ran with its exit code, and what you could not do. Claim nothing you did not run. Do not write a `Verdict:` line: that belongs to the review job.

## Context

- `CLAUDE.md` — project rules: non-negotiables, ownership, source-of-truth hierarchy.
- `.claude/rules/*.md` — boundaries, TDD and quality, API contract, security and privacy, rendering.
- `.claude/skills/<name>/SKILL.md` — conventions for the area under review (`dotnet-backend`, `react-19`, `api-contract-first`, `security-privacy`, `accessibility-wcag`, `rendering-pdf`).
