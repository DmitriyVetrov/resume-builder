# Code Review — P10

External reviewer: Codex CLI 0.166.0 (default model), `codex exec --sandbox read-only` with `.claude/review-prompt.md` (ADR-051 S-3, Amendment 2). The operator's text is below the reviewer's verdict and carries no verdict of its own.

The Codex worker and this reviewer are the same vendor and, here, the same default model (ADR-051 Amendment 3, point 8). For commit 5d97e3f (`Codex-Task: P10-CX-01`) the operator's line-by-line review in `codex-tasks/P10-CX-01.md` is treated as the independent one.

## Full review — `git diff main...8db929f`

**Finding**

- **Info** — [test-results.md](/home/dmytro/git/work/resumiser/docs/phases/P10/tests/test-results.md:7): Slices A and B were implemented before their red run; the tests were later run against stubs. That proves the tests fail on missing behavior, but not that they preceded or guided the implementation. Record a pre-implementation red run for future slices; this ordering cannot be repaired retroactively.

No blocker, critical, or major findings. The diff has no contract or backend changes, and the Codex task’s implementation changes are within its three allowed files.

Verdict: PASS

### Operator note

Info (`test-results.md`): recorded, and accurate. The earlier session wrote slices A and B without an observed red run, so the order for those two slices is not provable; `tests/test-results.md` says so. Slices C, D and E have a committed red before their implementation (7f62a31). No fix is possible, and an info finding earns no delta.

## Delta 1 — `git diff 8db929f..371f039 -- frontend tests docs/phases/P10/qa-report.md docs/phases/P10/tests`

Not a fix round: the full review found nothing to fix. This delta covers the work made after it, at the acceptance step, so that the reviewer has seen the final state of the branch.

- **minor** — [engine.test.ts](/home/dmytro/git/work/resumiser/frontend/src/entities/layout/engine.test.ts:179): E22 removes ASCII spaces before checking glyph coverage. If a future font subset lacks U+0020, the test still passes although the required strings cannot render with their spaces. Check the original strings without stripping spaces.

- **info** — [test-results.md](/home/dmytro/git/work/resumiser/docs/phases/P10/tests/test-results.md:140): E22’s recorded run is green only; there’s no recorded red run demonstrating that missing required glyph coverage fails the test. Record a controlled negative run and its exact command, or document why that evidence is not applicable to this test-only addition.

Verdict: PASS

### Operator note

Minor (E22 strips spaces): recorded as a follow-up, carried to P11, which next touches the engine tests. Spaces are in every subset by construction of `build-fonts.py` and G1 would fail without them, so nothing is uncovered today. Per Amendment 2 it earns no delta, and changing the test now would leave the reviewer short of the final state.

Info (no red run for E22): the test carries its own control, asserting that a kana is absent from every face, so the check is shown able to fail in each run. It was added after the implementation because the acceptance walk found the clause unguarded, and `tests/test-results.md` says so.
