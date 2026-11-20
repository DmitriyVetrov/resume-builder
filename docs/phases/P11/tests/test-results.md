# P11 Test Results

Environment: Debian 13, Node 24, development laptop (Intel i5-8250U, 8 logical CPUs, 23 GB). Browsers in the digest-pinned Playwright image.

## Red, engine slice (2026-11-06)

```
cd frontend && npx vitest run src/entities/layout
Tests 24 failed
```
The seams (`fit.ts`, `regions.ts`, `icons.ts`, empty `hints`, `icons`, `regions`) let every test load, so failures are assertions about missing behaviour, for example:
- N08 `expected 106 to be close to 133.5`: the P10 timeline started beside the section title, a real defect found while planning.
- N14 `expected 'date0 date1 … ' to contain 'date18'`: dates wider than the column lost text, a real defect found while planning.
- N09, N10, N11: manual breaks ignored, or moved both columns.
- X01, X03, X04, X06, X08: no chips, band or zones. X07 read the missing band's `height`, the one `TypeError`.
- Z01–Z05: the stub returns `impossible`. E21: no runtime imports the engine yet.

Green for this slice, with two corrections to tests written in this step: Z03's document was too long to ever fit, and a comment in `icons.ts` tripped E20's text scan.

```
cd frontend && npx vitest run src/entities/layout     Tests 1 failed | 66 passed (E21 waits for the runtime)
node tests/rendering/bundle.mjs && node tests/rendering/reference.mjs     RESULT PASS reference (48 cases: G1, G5, G6)
```

## Red, UI slice (2026-11-06)

```
cd frontend && npx vitest run
Tests 78 failed
```
Every P, K and C test, and the W tests that open the editor, wait on `previewReady()`, which looks for a painted page that does not exist yet, so the test timeout ends them. H01–H03b and K06–K07 fail on assertions against seams. H04 `expected [] to deeply equal [['idempotency_key_reused', …]]`.

Backend red, with the endpoint and its route removed: `dotnet test backend/tests/ResumeBuilder.Api.Tests --filter "FullyQualifiedName~P11ClientEventTests"` → Failed 23, Passed 1, Total 24. The one pass is CE11, which reads the frozen contract only.

## Green (2026-11-06)

**Rendering, 48 cases per browser.**
```
node tests/rendering/reference.mjs      RESULT PASS reference (G1, G5, G6)
playwright test gate.spec.ts            18 passed (G7, G2 screenshots)
node tests/rendering/raster-diff.mjs
PASS G2 chromium: worst page 0.146%, long-bullet-T2 p1
PASS G2 firefox:  worst page 0.388%, long-paragraph-T1 p3
PASS G2 webkit:   worst page 0.560%, long-paragraph-T1 p3
Controls, a 3 px shift: 3.708%, 3.850%, 3.732%
```
The first run failed WebKit at 1.202% on `long-paragraph-T2` p3, with error growing along each line. Scaling large text down was tried and was worse (2.433%, 3.107%, 1.651%). Re-anchoring long runs fixed it (DD-P11-17). The harness printed `RESULT PASS` on that miss because only Chromium was required, so all three are required now.

**Benchmarks**, `bash scripts/ci/rendering.sh bench`, exit 0, development laptop in the pinned image, 50 runs (G4: 20):

| Measure | Chromium | Firefox (reported) | WebKit |
|---|---|---|---|
| NFR-01 keystroke to painted page, real editor, p95 | 50.1 ms | 52.0 ms | 98.0 ms |
| NFR-01 slider step to painted page, real editor, p95 | 83.6 ms | 134.0 ms | 214.0 ms |
| G3 re-layout plus paint, p95 | 49.8 ms | 62.0 ms | 130.0 ms |
| G4 PDF p95, TXT p95 | 71.9 ms, 0.30 ms | 111.0 ms, 1.00 ms | 96.0 ms, 1.00 ms |

PDF 46,866 bytes. Keystroke at 4× CPU throttle, Chromium: 116.4 ms (recorded, not gating). **Partial, DD-P11-15:** this is the laptop NFR-01 names, not the reference CI runner.

**Bundle**, `npm run build`: route chunk 391.49 kB (163.67 kB gzip), engine chunk 581.22 kB (183.10 kB gzip), each face 74–144 kB.

**Hyphenation evidence (DD-P11-13)**, line fill against the widest line of the column:

| Column | Measure | Median fill |
|---|---|---|
| T3 main | 348 pt | 98% |
| T1 two-column description cell | 239 pt | 89% |
| T3 sidebar, explicit two columns (the narrowest possible) | 69 pt | 76% |

Greedy output on ragged-right text reads acceptably without hyphens, even in the narrowest case.

**Defects found by the suite, not by narrow runs.**
- `web-image-check.sh`: nginx has no `.ttf` type, so fonts went as `application/octet-stream` and `gzip_types` missed them. Fixed with `default_type font/ttf`, and the check now also asserts the type.
- `bash suite.cmd` exited 0 past these failures, because a script with no `set -e` exits with its last line. It now starts with `set -euo pipefail`. The gate runs each line on its own, so it was not affected.
- The backend job stopped at `dotnet format` on the new test file. After that fix, three guards named the new operation (DD-P11-18).

**Corrections to tests written in this phase during green,** none loosening a check: Q04 used a fixture that stays on 2 pages at line spacing 20; zoom locators clicked a label's text under its radio; T02's marker count must include the seeded Skills list (6, not 4); Y10 needed a taller viewport so the scroller does not clip the page.

**Pre-existing test files touched:** those listed in DD-P11-02 and DD-P11-18. `library.test.tsx` keeps cards out of view with a stub `IntersectionObserver`, because its tests count list requests.

**Green step check**, owner's two edits stashed: `python3 scripts/phase-handoff-check.py --phase P11 --step green`: every suite command exit 0 (backend 273 + 11 + 3 passed; Vitest 431; E2E 310 passed, 2 skipped; rendering; image; contract), RESULT FAIL only on `PHASE_SCOPE` for the architecture guard, now in the plan's allowed paths (DD-P11-18). The 2 skips are Y10 in Firefox and WebKit: baselines are Chromium only.

**After a read-through of the diff.** P12b was red first (`expected <div class="preview-failed"…> to be null`): a failed font left the alert up after the resume went back to a loaded one. Also fixed: the `lone-title` hint found its page by coordinates, which two pages can share; Fit could throw if pressed while a new font was loading. X20 (oversized T3 header) was added and passed as written.

## Acceptance runs (2026-11-06, step 7)

Each spec file on its own fresh stack, as `qa-report.md` describes.

| Command | Exit | Result |
|---|---|---|
| `npx playwright test -c playwright.real.config.ts --timeout=180000 preview-acceptance` | 0 | **A01–A06: 6 passed.** NFR-02: library p95 1,404 ms, editor p95 957 ms, 10 cold runs each at 10 Mbit/s |
| same, `editor-acceptance` | 0 | **R01–R10: 10 passed** |
| same, `design-acceptance` | 0 | **D01–D05: 5 passed** |

API log, preview spec: `client_event idempotency_key_reused document_write <uuid> -`, no `http_error` lines, no title text.

Review fix: `dotnet test … --filter "FullyQualifiedName~Ce12"` red (`Assert.Contains() Failure: Filter not matched`), then `P11ClientEventTests` 25 passed.

Other checks:
```
gitleaks git --log-opts=main..HEAD                    no leaks found
shellcheck -e SC1091 scripts/ci/e2e.sh scripts/ci/rendering.sh docs/phases/P11/tests/web-image-check.sh   one SC2034, fixed
python3 -B -m unittest discover -s tests/infrastructure -p 'test_*.py'   OK
```

Delta 1 fix, from the repository root:
```
dotnet test backend/tests/ResumeBuilder.Api.Tests --filter "FullyQualifiedName~Ce13|FullyQualifiedName~Ce14"
exit 1. Failed 2, Passed 0. Ce13: the log still held 123.456.789. Ce14: the log still held the stranger's IDs instead of `other`.
dotnet test backend/tests/ResumeBuilder.Api.Tests --filter "FullyQualifiedName~P11ClientEventTests"
exit 0. Passed 27.
```

First gate run: `python3 scripts/phase-handoff-check.py --phase P11 --gate` exit 1, `SUITE_RED`: `ApiLoggingCallsContainOnlyOperationalScalarFields` flagged a local variable named `resume` passed to `SafeLogs.ClientEvent`, in the code added for delta 1. The narrow filter had not run the architecture tests. The guard stands and the variable was renamed: `bash scripts/ci/backend.sh` exit 0, Architecture 11, Toolchain 3, Api 276 passed.

## Gate (2026-11-06)

The owner's two uncommitted edits were stashed around the check and restored.

```
python3 scripts/phase-handoff-check.py --phase P11 --gate
exit 0. phase scope: 129 files; check-blueprint exit 0; suite green (8 commands); required artifacts present (8); review verdict PASS; qa verdict PASS. RESULT PASS.
```

The only commit after this run is this record and `PHASE-STATUS.md`: documents only.
