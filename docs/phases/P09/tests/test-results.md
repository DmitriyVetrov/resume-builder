# Test Results

Exact commands, environment, exit codes and counts, red before green. Never mark tests passed without running them.

## Step 4 — Red (2026-11-05)

Environment: as P08 (`docs/phases/P08/tests/test-results.md`). P08's green implementation is on the branch. ProseMirror is pinned (ADR-052). Seams are declaration-only: AST functions, schema, converters, commands and clipboard reader throw `not implemented`, and `RichTextField` is still P08's plain textarea.

| Command | Exit | Result |
|---|---|---|
| `npx tsc --noEmit` (in `frontend/`) | 0 | clean |
| `npx vitest run` (in `frontend/`) | 1 | **54 failed**, 196 passed, of 250 (P08's 170 included and passing) |
| `npx playwright test rich-text.spec.ts --project=chromium --timeout=8000` (in the pinned container) | 1 | **12 failed**, 0 passed (10 scenarios, T04 once per source) |
| `dotnet build backend/ResumeBuilder.slnx -c Release -warnaserror` | 0 | clean |
| `dotnet test backend/tests/ResumeBuilder.Api.Tests/ResumeBuilder.Api.Tests.csproj -c Release --no-build --filter "FullyQualifiedName~P09RichText"` with `RESUMISER_MONGO_IMAGE` and `TESTCONTAINERS_RYUK_CONTAINER_IMAGE` from `images.lock` (real Mongo) | 0 | 3 passed: characterisation, see below |

Why they fail, all intended; hosts and fixtures started:

- `rich-text.test.ts` (4), `convert.test.ts` (20), `commands.test.ts` (10), `clipboard.test.ts` (14): the seam's `not implemented`.
- `rich-text-field.test.tsx` (6): no `contenteditable`, no toolbar, no dialog on the textarea. F03 and F04 pass on the textarea too and guard "no write on open" through the replacement.
- `rich-text.spec.ts` (12): the textbox exists but has no toolbar, no formatting, one plain-text level, and a textarea's own paste. Failures are `toEqual` on the saved AST, `toBeFocused`, `toHaveAttribute` and missing toolbar buttons.

These pass at red and are kept as guards, not as evidence of new behaviour:

- `rich-text-view.test.tsx` (V01, V02) and `no-raw-html.test.ts` (S01): `RichTextView` came with P08's preview. Its plan line moved to P08.
- `N05`, `N06`: `safe-url.ts` came with P08's contact link override.
- `P09RichTextRoundTripTests` (T01, T02): the API has accepted this AST since P07; P09 adds the corpus that pins client and server to one shape.

## Step 5 — Green (2026-11-05)

Same environment. Implementation of slices 1–5 and the P08 seam replaced by the ProseMirror field.

| Command | Exit | Result |
|---|---|---|
| `npx tsc --noEmit`, `npx eslint src` (in `frontend/`) | 0 | clean |
| `npx vitest run` (in `frontend/`) | 0 | **254 passed**, 21 files |
| `npx playwright test` in the pinned container (`retries: 0`) | 0 | **234 passed**, all five specs, Chromium, Firefox and WebKit |
| `npx playwright test rich-text.spec.ts --repeat-each=4` in the pinned container | 0 | 144 passed, no flake (run after the selection fix below) |
| `python3 scripts/phase-handoff-check.py --phase P08+P09 --step green` (`.claude/settings.json` stashed, as in P08's results) | 0 | `RESULT PASS`: scope 79 files, blueprint OK, suite 7 of 7 commands exit 0, backend 249 passed. Run before the two self-review fixes below, whose own commands are the Vitest and Playwright rows above |

Test files changed during green, for the external review. None weakens an assertion:

| File | Change and reason |
|---|---|
| `commands.test.ts` | `K02b` added: select all, whose ends lie outside any line. E2E `T02` found the defect. |
| `autosave.test.ts`, `workspace.test.tsx` | `A25`, `A26`, `W25` added from a self-review, red first: a queue that never opened sent a junk write when left; leaving finishes and stops; an edit typed during a remote reload was overwritten. |

Defects the tests found in the implementation, all fixed: `locate` ignored positions outside any line, so select-all toggled one line; native URL validation silently blocked Enter on a bare domain in the link dialog (`noValidate`); a format shortcut right after Shift+Arrow acted on the old selection, because `selectionchange` can arrive after the next keydown (intermittent in Chromium, `syncSelectionFromDom`).

Test budget: new Vitest cases are 84 with table rows, within the plan's budget of 60 once corpus rows count once per file, as the plan states. E2E 12 runs of 10 scenarios (`T04` once per source). Backend 3 cases.

## Review fix (2026-11-05)

Finding: a pasted resource tag might fetch while parsing. Test first, in `clipboard.test.ts` `P02b` and `rich-text.spec.ts` `T08` (no request to a pasted host, in three engines).

| Command | Exit | Result |
|---|---|---|
| `npx vitest run src/features/editor/rich-text/clipboard.test.ts`, before the fix | 1 | `P02b` failed: the parser still received `<img src="https://t.invali…` |
| `npx playwright test rich-text.spec.ts -g T08` in the pinned container, before the fix | 0 | 3 passed: **none of the three engines fetched**, so the reported fetch was not observed. The strip is still added, as a barrier that does not depend on engine behaviour |
| `npx vitest run src/features/editor/rich-text/clipboard.test.ts`, after the fix | 0 | passed, `P02b` included |
| `npx playwright test rich-text.spec.ts` in the pinned container, after the fix | 0 | 36 passed in three browsers |

## Step 7 fix (2026-11-05)

Found by the real-stack walk: a key right after collapsing a selection acted on the old selection.

| Command | Exit | Result |
|---|---|---|
| `npx playwright test rich-text.spec.ts --project=chromium --repeat-each=5 -g T02b` in the pinned container, before the fix | 1 | **5 failed** |
| `npx playwright test rich-text.spec.ts --repeat-each=2` in the pinned container, after the fix | 0 | 78 passed, three browsers |

## Step 8 — Gate (2026-11-05)

`python3 scripts/phase-handoff-check.py --phase P08+P09 --gate`, with `.claude/settings.json` stashed around it and restored unchanged. Exit 1 on the first run (`E17`, above), **exit 0 on the second, `RESULT PASS`**: scope 105 files; blueprint OK; suite 7 of 7 commands exit 0, including Vitest 255, Playwright in three browsers with `retries: 0`, contract suite, and the backend job with `ResumeBuilder.Api.Tests` 249 passed; artifacts and verdicts of both phases PASS.
