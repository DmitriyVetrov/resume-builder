# P12 Test Results

Environment: Debian 13, Node 24, poppler 25.03.0, the digest-pinned Playwright image, development laptop.

## Red, slices A and B (2026-11-06, before implementation)

Stubs: `exportFileName` returns `''`, `planStructure` returns an empty tree, `missingCharacters` returns nothing, `serializeTxt` ignores its options. The P10 writer and serializer are otherwise unchanged.

```
npx vitest run src/entities/resume/export-name.test.ts src/entities/layout/txt.test.ts src/entities/layout/pdf-structure.test.ts src/entities/layout/missing.test.ts
exit 1: 24 failed
F01–F08 assertion (expected '' to be …)      M01, M02, M04 assertion (expected [] …)
T08–T12 assertion                            S01–S03, S06, S07 assertion; S04, S05 TypeError reading `children` of the empty tree's missing Sect
T07 failed on the absent golden files until they were committed; they are P10's output, read one by one against §9, and pin regressions.
Already green, by design: T01–T06, T13–T15 (P10's serializer reproduces §9.4 byte for byte), M03, M05 (coverage facts).
```

```
node tests/rendering/bundle.mjs && node tests/rendering/export-checks.mjs
exit 1: RESULT FAIL, 61 checks failed on assertions, 62 passed
Failing: R01, R02 metadata; R09, R10 no tags; R13 emoji and CJK lost on copy.
Already green, on P10's writer and P11's engine: R03 size, R04, R05 (first measurement in a PDF: 10 + v and v, within ±0.5 pt), R06, R07, R08, R11, R12.
```

Two checks of mine were wrong at first and were fixed before implementation: A4 is 595 × 842 in the engine, and T2's name overshoots its line box in font metrics, so margins are now measured on printed ink.

## Green, slices A and B (2026-11-06)

```
npx vitest run src/entities           exit 0: 17 files, 211 tests
node tests/rendering/reference.mjs    RESULT PASS reference (G1, G5, G6 on all cases, with the tagged writer)
node tests/rendering/export-checks.mjs RESULT PASS export checks (R01–R13)
```

## Red, slices C, D and E (2026-11-06, before implementation)

Stubs: `exportPdf`, `exportTxt`, `copyText` and `saveFile` do nothing. `Workspace` still has P08's disabled buttons. The library has no export buttons.

```
npx vitest run src/features/export src/features/library/library.test.tsx src/features/editor/workspace.test.tsx
exit 1: 29 failed, 51 passed. X01–X12, A01–A10, B01–B04, W01, on assertions or on absent elements (no such button, no alert, `saved` empty).

docker run --rm --ipc=host --network host --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD:/work" -w /work/tests/e2e "$(sed -n 's/^PLAYWRIGHT=//p' infrastructure/images.lock)" npx playwright test export.spec.ts --project=chromium --timeout=15000
exit 1: 12 of 12 failed: no download event, aria-disabled absent, no "Text options". Harness up: the pages painted.

dotnet test backend/tests/ResumeBuilder.Api.Tests --filter "FullyQualifiedName~Ce15"
exit 1: 3 of 8 failed on Assert.Equal, `photo_load`, `pdf_write`, `txt_write` logged as "other". The 5 reused codes pass.
```

## Green, whole phase (2026-11-06)

```
bash docs/phases/P12/tests/suite.cmd
exit 0, with set -euo pipefail at its top:
scripts/ci/backend.sh     Architecture 11, Toolchain 3, Api 284: all passed, no skips (CE15 included)
scripts/ci/frontend.sh    lint and typecheck clean; Vitest 39 files, 491 tests passed
fixture E2E               346 passed in Chromium, Firefox, WebKit (export.spec.ts: 36)
rendering gate            RESULT PASS reference (G1, G5, G6); RESULT PASS export checks (R01–R13); gate.spec 18 passed
                          G2 worst page: Chromium 0.146%, Firefox 0.388%, WebKit 0.560%, unchanged from P11; controls ≥ 3.708%
web-image-check.sh        passed
contract suite            passed; ContractReader passed; static policy 16 tests passed
```

**Real-route bytes (E01, E02, E08):** in Chromium, Firefox and WebKit, the files downloaded from the Vite build equal Node's writer and serializer byte for byte on T1, T2 and T3, and the library's equal the editor's.

**Real stack:** `npx playwright test -c playwright.real.config.ts export-acceptance` in the pinned image, against the Release API in `Production`, a throwaway Compose stack and `proxy.mjs`: **A01–A06, 6 passed.** Evidence and environment are in `qa-report.md`.

**NFR-03, FR-PDF-09, benchmark:** `npx playwright test -c playwright.bench.config.ts -g "NFR-03"` in the pinned image. Development laptop, from the real click to the finished download, 20 runs per browser, 4-page fixture, worst-case 600 px photo, 398,053 bytes. The first run also loads PDFKit's chunk.

| Browser | PDF p95 | PDF max | TXT p95 |
|---|---|---|---|
| Chromium | 203 ms | 246 ms | 79 ms |
| Firefox | 235 ms | 373 ms | 93 ms |
| WebKit | 246 ms | 1,427 ms | 95 ms |

**Not from the reference runner** (DD-P12-16): the command is `bash scripts/ci/rendering.sh bench`, and P15 owns the CI run.

**Bundle,** `npm run build`: route chunk 588.89 kB (185.73 kB gzip), which has no engine and no PDFKit; engine 374.56 kB plus 16.48 kB (156.58 and 6.85 kB gzip), split because PDFKit's chunk shares fontkit with it; PDFKit 164.96 kB (60.43 kB gzip), first requested on the first export (E01). P11's results give 391 kB for the route and 581 kB for the engine: source maps show the labels there were swapped, since React, the router and ProseMirror live in the 581 kB chunk. So the route grew by 8 kB.

## Red and green, review fix DD-P12-22 (2026-11-06)

Red, before the fallback:
```
npx vitest run src/entities/layout/missing.test.ts src/features/export/export.test.ts
exit 1: M04, M06, M07, X13 failed on assertions, for example expected [ 'Ŵ', 'Ѝ' ] to deeply equal []. M08, M09 green, pinning what must not change.
node tests/rendering/export-checks.mjs
exit 1: 4 R14 checks failed, for example fonts PTSerif-Bold, PTSerif-Regular only.
dotnet test backend/tests/ResumeBuilder.Api.Tests --filter "FullyQualifiedName~Ce16"
exit 1: engine "1.1.0" logged as "other"; "1.0.0" passes.
```
Green, narrow: Vitest 39 files, 496 tests; `export-checks.mjs` RESULT PASS; `reference.mjs` RESULT PASS.

Whole suite after the fix: `bash docs/phases/P12/tests/suite.cmd`, exit 0: backend 11 + 3 + 286; Vitest 39 files, 496 tests; fixture E2E 349; reference and export checks RESULT PASS; G2 unchanged; web image and contract suites passed.

## Benchmarks on the final code (2026-11-06)

`bash scripts/ci/rendering.sh bench`, exit 0, development laptop, DD-P12-16.

| Measure | Chromium | Firefox | WebKit |
|---|---|---|---|
| G3 one keystroke, p95 | 50.0 ms | 67.0 ms | 113.0 ms |
| G4 PDF, p95 (small photo) | 79.1 ms | 115.0 ms | 91.0 ms |
| NFR-01 keystroke, p95 | 66.5 ms | 66.0 ms | 86.0 ms |
| NFR-01 slider, p95 | 73.1 ms | 134.0 ms | 216.0 ms |
| NFR-03 PDF, click to file, p95 (max) | 181 ms (260) | 267 ms (346) | 250 ms (358) |
| NFR-03 TXT, click to file, p95 | 83 ms | 90 ms | 89 ms |

NFR-03's PDF is 398,053 bytes. The benchmark table in the "Green, whole phase" section is the earlier run, before the fix.

## Real stack on the final code (2026-11-06)

Fresh Compose stack and Release API per spec file, in the pinned image: `npx playwright test -c playwright.real.config.ts <spec>`. `export-acceptance` 7 passed (exit 0), `editor-acceptance` 10, `design-acceptance` 5, `preview-acceptance` 6. NFR-02: library p95 1,354 ms, editor p95 1,026 ms. An earlier run on a stale API process is explained in `qa-report.md`.
