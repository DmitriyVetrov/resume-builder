# Codex task <Pxx>-CX-<NN>

<!-- Template: ADR-051 Amendment 3. Copy to docs/phases/<Pxx>/codex-tasks/<Pxx>-CX-<NN>.md, fill Part A,
     delete this comment, and commit it with any red tests before dispatch. Commands:
     docs/blueprint/AGENT-WORKFLOW.md, "Codex worker tasks". The whole file goes to Codex on stdin. -->

You are a bounded Codex worker under ADR-051 Amendment 3. Follow `AGENTS.md`, section "Worker", and Part A. Part B belongs to the operator; ignore it.

## Part A — the task

- **Phase:** `<Pxx>`
- **Kind:** `implementation` | `additive`
- **Requirements:** `<FR-*, NFR-*>`
- **Acceptance criteria:** `<IDs from acceptance-criteria.md>`
- **Base:** the commit this worktree is checked out at.

### Goal

<!-- One or two sentences of behaviour. Link the code or pattern to follow by path. No design choices left open. -->

### Tests

<!-- implementation: the committed failing tests to turn green, and the exact assertion each fails on now.
     additive: the behaviour the new tests must attack. They assert the acceptance criterion, not current behaviour. -->

### Allowed files

<!-- Exact repo-relative paths, one per line in this exact form. No globs. A path not listed here is rejected,
     including new files. additive tasks: every path must be new. -->
- `<repo-relative path>`

### Forbidden paths

Never change these, even if the task looks impossible without it. Stop and report instead.

- Existing tests and fixtures, on every task. On an `implementation` task, no new tests either.
- `contracts/**`, and generated types (`frontend/src/shared/api/generated/`, or wherever the generator writes). Regenerating them for your own test run is fine; never edit them by hand.
- `docs/**`, including phase records, unless the exact file is listed under Allowed files. `docs/source/**` is never listed.
- `CLAUDE.md`, `AGENTS.md`, `.claude/**`, `.github/**`, `scripts/**`, `infrastructure/**`, `docker-compose.yml`.
- Dependency manifests and lockfiles (`package.json`, `package-lock.json`, `*.csproj`, `Directory.*.props`).
- `.env*`, keys and any secret.

### Commands

<!-- Exact commands, from the worktree root. Narrow, no Docker, no Compose, no phase suite. -->
```bash
<exact test command>
```

### Done when

- The commands above exit 0 (`additive`: or fail only on a defect you name in your report).
- Only Allowed files changed.
- Your final message says what changed, what you ran with each exit code, and anything you could not do. It claims nothing you did not run.

### Rules of this worktree

- Temporary and detached. Leave your work uncommitted: no `git commit`, `add`, `stash`, `reset`, `rebase`, `push` or branch.
- Nothing here is final. The operator reads the diff, runs the tests again and decides.
- No Docker or Compose, and no network. Do not read secrets or anything outside this worktree; the sandbox does not stop you, so this rule is what does.
- Stuck, or the task needs a forbidden path or a design decision: stop and report. Do not work around it.

---

## Part B — operator record

Filled in by the operator after the run. Worker output stays in this file and never goes into `review/code-review.md` or `qa-report.md`, whose verdicts the gate reads by text.

- **Dispatched / returned (UTC):** `<ISO time>` / `<ISO time>`
- **Base SHA:** `<sha>`
- **Codex CLI and model:** `<version>`, `<model, or "default">`
- **Scope check:** HEAD unmoved `<yes/no>`; outside list `<none/paths>`; additive only `<yes/no/n.a.>`

### Operator review of the diff

- [ ] Read every changed line. Nothing was accepted on the worker's summary.
- [ ] It meets the requirement, not only the tests: failure paths, boundaries, no hard-coded test values.
- [ ] Matches the existing pattern; nothing speculative; nothing excluded by TECHNICAL-SPEC §3.2.
- [ ] Security and privacy rules hold: owner checks, no resume content in logs, nothing dangerous added.
- [ ] New UI meets `accessibility-wcag`.
- [ ] `additive` tests: each one shown able to fail (its failing run, or a temporary break of the behaviour it guards, reverted afterwards).
- [ ] The operator's own test run after applying, recorded in `tests/test-results.md` with exact commands and exit codes.

### Result

Outcome: `ACCEPTED` | `ACCEPTED_WITH_REWORK` | `REJECTED` | `FAILED`

<!-- REJECTED: out of scope, moved HEAD, tests still red, or the diff fails review. A rejected patch is not trimmed.
     FAILED: Codex crashed, timed out or hit quota. Both: the operator does the task itself and says so here. -->

- **Reason:** `<why, in one or two lines>`
- **Rework:** `<lines the operator changed afterwards, and why>`
- **Commit:** `<sha>`, with the trailer `Codex-Task: <Pxx>-CX-<NN>`
- **Claude tokens, dispatch to commit:** `<output / cache_creation / cache_read, from the session transcript>`
- **Codex tokens:** `<input / cached / output, from turn.completed in events.jsonl>`
- **Fallback used:** `<no / yes, what the operator did>`
