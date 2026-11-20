# Code Review — batch P08+P09

External reviewer: Codex CLI 0.166.0 (default model), `codex exec --sandbox read-only` with `.claude/review-prompt.md` (ADR-051 S-3, Amendment 2). One review covers the batch (ADR-051 S-6), and this file and `docs/phases/P09/review/code-review.md` carry the same record. Every `Verdict:` line below is the reviewer's own output.

## Full review — `git diff main...86959c7`

- **Major — [clipboard.ts](/home/dmytro/git/work/resumiser/frontend/src/features/editor/rich-text/clipboard.ts:130).** When a user pastes HTML containing `<img src="https://…">` or an iframe, `DOMParser` may fetch that resource before the walker drops the element. That sends a third-party request from the editor and can expose that the user pasted the content. [MDN documents that parsed HTML can download iframe and image resources](https://developer.mozilla.org/en-US/docs/Web/API/DOMParser/parseFromString). **Fix:** remove resource-bearing elements before parsing, or use a parsing approach that cannot initiate resource loads; add a test asserting hostile paste makes no external request.

- **Minor — [P09 test results](/home/dmytro/git/work/resumiser/docs/phases/P09/tests/test-results.md:15).** The red-state backend command contains `…`, so the recorded command cannot be reproduced exactly as required by the TDD rules. **Fix:** record the full `dotnet test` command, including project and filter arguments.

- **Info — [P09 phase plan](/home/dmytro/git/work/resumiser/docs/phases/P09/architecture/phase-plan.md:78).** The changed ADR-052 and decision-register files are under `docs/blueprint/**`, which is absent from P09’s Allowed paths. The P09 decisions mention these updates but do not explicitly record a path-scope extension. **Fix:** record the extension in P09 decisions or keep the blueprint changes within the declared scope.

Verdict: FAIL

### Operator note

Major (`clipboard.ts`): fixed test-first. `P02b` was red, then the resource-bearing tags are removed before `DOMParser` sees the HTML. `T08` now asserts that no request reaches a pasted host; it passed in Chromium, Firefox and WebKit before the fix too, so the reported fetch was not observed in any engine and the fix is a barrier that does not rely on that. Details in `docs/phases/P09/tests/test-results.md`.

Minor (`test-results.md`): the full command is recorded. Info (paths): recorded as DD-P09-11.

## Delta 1 — `git diff 86959c7..fc47f36 -- frontend/src/features/editor/rich-text/clipboard.ts frontend/src/features/editor/rich-text/clipboard.test.ts tests/e2e/rich-text.spec.ts`

**Info —** `docs/phases/P09/tests/test-results.md:58`: The review-fix section records the pre-fix results but no post-fix command or green result for the added clipboard and E2E assertions. Add the exact verification command and outcome so the delta’s green state is documented.

Verdict: PASS

### Operator note

Info: the green commands after the fix are recorded in `docs/phases/P09/tests/test-results.md`.

## Delta 2 — `git diff fc47f36..3892ca9 -- frontend/src tests/e2e`

Covers everything changed in code after delta 1: the harness stabilisation, and the fixes from the acceptance pass (`qa-report.md`, "Defects found in this pass").

No findings. The delta stays within the P08/P09 allowed paths, and I found no weakened assertions. The workspace stabilization waits for the relevant listener before interacting; the added real-stack checks align with the acceptance criteria. I did not run tests.

Verdict: PASS

### Operator note

Two deltas of the three allowed. Standing: nothing above info. Reviewer-reported follow-ups: none open. After this delta only records changed (`qa-report.md`, `test-results.md`, READMEs, `TRACEABILITY.md`, status files).

## Delta 3 — `git diff 3892ca9..796a5a5 -- frontend/src tests/e2e`

The first gate run failed on `E17`'s time budget (`docs/phases/P08/tests/test-results.md`).

No findings in the specified delta. The E17 timeout is raised only for the slow accessibility scenario; its assertions and retry settings are unchanged. The README addition is within the phase’s allowed paths.

Verdict: PASS
