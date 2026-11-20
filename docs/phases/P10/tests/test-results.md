# P10 Test Results

Environment: Debian 13, Node v24.22.2, Intel i5-8250U, 8 logical CPUs, 23 GB. Browsers from the pinned Playwright image 1.56.1. Commands run from the repository root unless stated.

## Slices A and B: red (2026-11-05)

An earlier session of this phase wrote the tests of slices A and B alongside their implementation and did not record a red run before stopping. So the red state was proved after the fact, not observed in order: production code was replaced by stubs that export the right names (dates and TXT return empty strings, design operations return their input, definitions have the right shape and no values, `layout` returns one empty page), the tests ran, and the code was restored.

```
cd frontend && npx vitest run src/entities/template src/entities/resume/dates.test.ts src/entities/resume/design-operations.test.ts src/entities/layout
exit 1. Test Files 7 failed (7). Tests 59 failed | 18 passed (77).
By error: 53 AssertionError, 6 TypeError (reading a line of the stub's empty page; each is a missing-behaviour failure, not a harness failure).
```

The 18 that pass on the stubs check shape or absence: for example no import of React, and no `Intl`.

**Rendering harness, observed red, in order.** These were real failures of real code during this step, each logged and fixed in code or harness, not by loosening the check, except as DD-P10-14 records:

| Run | Result | Cause | Fix |
|---|---|---|---|
| `bash scripts/ci/rendering.sh` | exit 1: 4 FAIL G1 ("Mentored" extracted as "entored") | Shared fontkit instance poisoned by a composite part | DD-P10-15 |
| same | exit 1: fixtures of 2, 3 and 4 pages where 1, 2 and 4 were needed | Fixture size | Fixtures retuned; a check now asserts size and the crossing entry |
| same | exit 1: FAIL G2, Chromium 5.2%, Firefox 5.0%, WebKit 1.8% | Baseline rounding and antialiasing dominate an exact comparison | DD-P10-14, control added |
| same | exit 1: FAIL G2, Chromium 4.7%, Firefox 1.7%, WebKit 0.4% | Painter used font ascent, which browsers round differently | Strut in `paint.ts` |
| same | exit 1: FAIL G2, Chromium 4.9%, others below 1% | Stacked pages start at fractional device pixels | One page at a time at the origin |
| same | exit 1: FAIL G2, Chromium 4.3% | LCD text fringes against a per-channel comparison | `--disable-lcd-text` for that project |

## Slices A and B: green (2026-11-05)

```
cd frontend && npx vitest run src/entities
exit 1. Test Files 3 failed | 8 passed (11). Tests 10 failed | 126 passed (136).
The 10 are the T2 stub, kept red for pilot task P10-CX-01: X01-X08 (t2.test.ts), D01 (template.test.ts), E16 (engine.test.ts, T2 must differ from T1).

bash scripts/ci/rendering.sh
exit 0. reference: 60 PASS lines, RESULT PASS. Playwright: 48 passed (8 cases of G7 and 8 of the G2 capture, in each of three browsers).
PASS G2 chromium: worst page 0.017% (limit 1%, tolerance 76, one device pixel); control: a 3 px shift gives at least 4.667%
PASS G2 firefox: worst page 0.116%; control at least 4.267%
PASS G2 webkit: worst page 0.281%; control at least 4.248%
RESULT PASS G2

bash scripts/ci/rendering.sh bench
exit 0. 6 passed.
G3 chromium: p95 50.0 ms over 50 runs
G3 firefox:  p95 65.0 ms over 50 runs
G3 webkit:   p95 113.0 ms over 50 runs
G4 chromium: PDF p95 77.9 ms, TXT p95 0.40 ms, 46876 bytes
G4 firefox:  PDF p95 109.0 ms, TXT p95 1.00 ms, 46876 bytes
G4 webkit:   PDF p95 77.0 ms, TXT p95 1.00 ms, 46876 bytes
```

Browser timers are coarsened, so the Firefox and WebKit figures are rounded to about 1 ms. The bench ran on this laptop, not the reference CI runner (recorded in ADR-010's "Technology confirmation").

## Slices C, D and E: red (2026-11-05)

Tests written first, against stubs of `DraftSheet`, `DesignPanel` and `DraftChips`, with `DesignPanel` already wired into `Workspace`.

```
cd frontend && npx vitest run src/features/editor/draft-sheet.test.tsx src/features/editor/design-panel.test.tsx
exit 1. Test Files 2 failed (2). Tests 38 failed | 4 passed (42).
19 failures in each file. Errors: testing-library "unable to find" and matcher failures on the missing controls and attributes;
8 TypeErrors from reading a missing zone or header element of the stub's empty sheet. No import or harness error.
The 4 that pass on the stubs check absence (no colour input, no thumbnail while hidden, no zone in a single-zone template).

cd frontend && npm run build (exit 0), then in the pinned image:
cd tests/e2e && npx playwright test design.spec.ts --project=chromium
exit 1. 10 failed (Y01-Y10), each on a missing control or attribute. The web server and page start.
```

## Slices C and D: green except T2 (2026-11-05)

Two tests of this phase's own red commit were corrected during green. Neither assertion was loosened: C01 read `aria-label ?? value`, which can only ever return the label, and now reads `value` as it meant to; C05 looked for the colour name under one specific parent element, and now looks in the Design region. Their failure on the stubs was unaffected.

```
cd frontend && npx vitest run
exit 1. Test Files 5 failed | 25 passed (30). Tests 19 failed | 355 passed (374).
The 19: X01-X08, D01, E16, V04, V17-V19, C01, C04, C06, C19, C22. All read T2, which is pilot task P10-CX-01's.
Every P08 and P09 test passes, unedited.
```

## Pilot task P10-CX-01 (2026-11-05)

The worker's own run is a claim and is not evidence. The operator's run, after applying the patch and correcting test V18 (see Part B of the task file):

```
cd frontend && npx tsc --noEmit        exit 0
cd frontend && npx eslint .            exit 0
cd frontend && npx vitest run          exit 0. Test Files 30 passed (30). Tests 375 passed (375).
```

## Full suite: green (2026-11-05)

Pinned Playwright image 1.56.1. The owner's two uncommitted edits (`.claude/settings.json`, `frontend/vite.config.ts`) were stashed around the handoff check and restored.

```
python3 scripts/phase-handoff-check.py --phase P10 --step green
exit 0. no pre-existing test edited during green; phase scope 105 files; check-blueprint exit 0; suite green (5 commands); RESULT PASS.

bash scripts/ci/e2e.sh (the same command, again, to keep the counts)
exit 0.
Vitest: Test Files 30 passed (30). Tests 375 passed (375).
Playwright: 268 passed, 2 skipped (3.2m). The skips are Y10 in Firefox and WebKit: baselines are Chromium only (AC-P10-19).
Rendering: RESULT PASS reference; 48 passed; PASS G2 chromium 0.017%, firefox 0.116%, webkit 0.281%, each with its negative control above 4%.

npm test --prefix tests/contract and the contract reader: exit 0 (inside the handoff check).
python3 -B -m unittest discover -s tests/infrastructure -p 'test_*.py': Ran 41 tests. OK.
```

**Corrections to this phase's own E2E tests during green**, none loosening an assertion:
- Y02 assumed a write after T1 to T2 to T3 to T1. The queue merges edits that return to the saved state, which is correct, so no write came. The test now waits for each write and checks each body, which is stricter.
- Y09 read the outline of the native radio, which is transparent over its option. It now reads the option, after a keyboard round trip.
- Y11 is new. It covers a bug found by reading the baselines: a reset rule outranked the paragraph gap.

**Security job.** `bash scripts/ci/security.sh` exit 1 at its first step: gitleaks flags one synthetic test password in `backend/tests/ResumeBuilder.Api.Tests/P06FixtureTests.cs:620`, from P07's commit 3449a05, already on `main` and not in this phase's diff. That file is outside P10's allowed paths; reported to the owner as a follow-up. Because the script stops there, the remaining steps were run directly:

```
osv-scanner frontend/package-lock.json          exit 0, No issues found (401 packages)
osv-scanner tests/rendering/package-lock.json   exit 0, No issues found (32 packages)
osv-scanner tests/e2e/package-lock.json         exit 0, No issues found (6 packages)
shellcheck -e SC1091 scripts/ci/*.sh            exit 0
actionlint .github/workflows/ci.yml             exit 0
gitleaks git --log-opts=main..HEAD              no leaks found
```

Not run in P10 and not needed for this diff: the backend and integration jobs (no backend change), and the DD-P03-22 OSV config for `tests/contract`, whose lockfile did not change.

## Acceptance runs (2026-11-05, step 7)

Real Chromium in the pinned image, against the Release API in `Production`, Mongo, Azurite and Mailpit in a throwaway Compose project, behind `tests/e2e/real-stack/proxy.mjs`. Each spec file ran on its own fresh stack.

| Command | Exit | Result |
|---|---|---|
| First attempt, both spec files on one stack | 1 | 12 of 15 passed. **R07:** real login limit, 429, because two spec files shared one limiter. **D02:** the test read the stored document before the debounced write. **D01:** real 403 on the first sign-up after a cold server start ("Your security check expired"), see `qa-report.md`. |
| `npx playwright test -c playwright.real.config.ts --timeout=120000 editor-acceptance` | 0 | **R01–R10: 10 passed** (P08 and P09 still hold on the real stack) |
| same, `design-acceptance`, fresh stack, D02 corrected to wait for the write | 1 | 4 of 5 passed. D01's `Language` locator also matched the placement select named "Languages" under T3: a test locator, now exact. |
| same, `design-acceptance`, fresh stack | 0 | **D01–D05: 5 passed**, no `http_error` line in the API log |

The server was warmed with three `/session` calls before each of the last runs, so these passes do not cover the cold-start 403. That stays open as a follow-up.

E22 was added at this step, when the acceptance walk found AC-P10-11's coverage clause checked only by hand: `cd frontend && npx vitest run src/entities/layout/engine.test.ts`, exit 0, 22 passed.

## Gate (2026-11-06)

The owner's two uncommitted edits were stashed around the check and restored.

```
python3 scripts/phase-handoff-check.py --phase P10 --gate
exit 0. phase scope: 119 files; check-blueprint exit 0; suite green (5 commands); required artifacts present (8); review verdict PASS; qa verdict PASS. RESULT PASS.
```

The only commits after this run are this record, `PHASE-STATUS.md`, Part B of the pilot's task file and DD-P10-19: documents only.

**Follow-ups:** E22 should check the strings with their spaces (delta minor, P11). See `qa-report.md` for the rest.
