# P10 Test Plan

Levels: pure unit tests over definitions and resolved numbers, engine tests on the PageModel in Node, component tests of the draft and the controls, a rendering suite over real PDFs and browsers (the ADR-010 gate), three-browser E2E with axe, Chromium visual baselines, and a real-stack spec at step 7. Budget from `architecture/phase-plan.md`.

Exact commands: `tests/suite.cmd`. Narrow: `npm test --prefix frontend -- <file>`, `bash scripts/ci/rendering.sh`.

## Vitest

| ID | File | What it proves | AC |
|---|---|---|---|
| D01–D06 | `entities/template/template.test.ts` | Registry has T1 default, T2, T3; definitions are JSON-serialisable data; a fourth definition resolves with no content change; exactly three accents and three fonts each; no import of React or the document in the module; every font ID exists in the catalogue | 2, 6, 11 |
| D07 | same | Contrast ≥ 4.5:1 on white for every preset; T3 white on band | 6 |
| D08–D11 | same | T1 tokens per §6.1/§6.2 incl. colour roles, link role, T1 presets by hex and default; roles other than accent are not accent | 6, 16 |
| D12–D15 | same | Preset sizes: the whole §6.9 table; markers, photo and spacing unchanged by preset; line height formula incl. each slider end and each preset; section spacing `10 + v`, entry spacing `v` | 7, 8 |
| D16–D18 | same | A4 and Letter geometry and content width; margins; continuation top = margin + 8 for all presets and custom | 9 |
| D19–D21 | same | List columns by type per template, explicit wins; placement by type, explicit wins, ignored in T1 and T2 | 5, 14 |
| D22–D23 | same | Foreign or unknown `bodyFont` resolves to the default without rewriting; font faces resolved | 11 |
| D24 | `entities/template/t3.test.ts` | ADR-024 table for T3 | 2, 15 |
| X01–X08 | `entities/template/t2.test.ts` | ADR-024 table for T2: defaults, fonts, accents and roles, type styles, chips, contact icons, no photo, single zone (**pilot task `P10-CX-01`**) | 2, 15 |
| A01–A09 | `entities/resume/dates.test.ts` | Four formats × three languages; year only under long format; `Present`; override wins; missing parts; no `Intl`, `toLocale*` (source scan) | 12 |
| O01–O10 | `entities/resume/design-operations.test.ts` | Switch changes only `templateId`; T1→T2→T3→T1 deep equal; accent index kept; reset by template, what it leaves alone; each setter immutable; margins all sides; custom bounds | 4, 9, 10, 13 |
| E01–E16 | `entities/layout/engine.test.ts` (node) | Page geometry; first and continuation top; nothing past the margins; line height, section and entry spacing measured in the model; preset sizes; accent roles on runs; link rect and safe URL; no separator at line start; photo rules; timeline line and dot, single-entry no line; 2-col rows atomic; all text present; pure and deterministic, template switch hash | 4, 7, 8, 9, 14, 15, 16 |
| E17 | same | T2 and T3 tokens reach the model (size and accent), proving the definitions fit the engine | 2 |
| E18–E19 | same | Hidden and empty sections not laid out; PG-01, PG-02 keep rules | 4 |
| E20 | same | Engine source imports no React or DOM; no `Intl`, `normalize`, `localeCompare`, transcendental `Math` (F-FE-3, ADR-010 §7) | 1 |
| E21 | same | No application module imports the engine or the painter in P10, so the route bundle stays free of it (DD-P10-01) | 1 |
| E22 | same | All twelve faces cover the Spanish, Slovak and Ukrainian strings, with a control proving the check can fail | 11 |
| T01–T05 | `entities/layout/txt.test.ts` (node) | §9 grammar on a fixture; no BOM, no tabs, no trailing spaces, LF; hidden and empty omitted; ignores list columns; same dates as the layout | 12, 14 |
| V01–V16 | `features/editor/draft-sheet.test.tsx` | Three templates' structure; T1 timeline marker, single-entry no line; no icons in T1 and T3; photo rules; T3 columns keep order within each; document order overall; hidden and empty omitted; variables carry the resolved tokens (accent, sizes, line height, spacing, page width, font); colour roles; a passed definition overrides; thumbnail variant has no `data-section-id` and no focusable element; activation; dates by language; list columns by section type; link role | 3, 4, 5, 12, 14, 15, 16 |
| V17–V20 | same | T2 chips and icons per kind, no text and unsafe URL, list chips, `listColumns` turns chips into bullets (**pilot task**) | 14, 15 |
| C01–C22 | `features/editor/design-panel.test.tsx` | Picker radios and thumbnails with own text; switch and undo; swatches with check, names; T2 shows its own three; font size, body font, page size radios; sliders with visible value, change, double-click default, coalesced undo; margins presets, custom valid and invalid, four-value document; language and dates; placement only under T3; reset and one undo; each control edits through the session and reaches autosave; no colour input or hex field | 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 18 |

## Rendering suite (`tests/rendering/`) — the ADR-010 gate

Fixtures in `tests/fixtures/resumes/`: `one-page.json`, `two-pages.json` (an entry crosses the boundary), `four-pages.json`, all synthetic, Spanish and Ukrainian text, a synthetic photo.

| ID | Check | Tool | AC |
|---|---|---|---|
| G1 | Per-page text and line breaks of the PDF equal the PageModel lines, 3 fixtures × A4 and Letter | `pdftotext -bbox-layout`, Node | 1 |
| G2 | Preview screenshot versus the raster of the reference PDF ≤ 1% pixels at 100 dpi, per browser, one device pixel of tolerance (DD-P10-14). A negative control proves a 3 px shift fails | Playwright, `pdftoppm -r 100`, `raster-diff.mjs` | 1 |
| G3 | One keystroke re-layout plus paint, 4-page fixture, p95 ≤ 300 ms, Chromium and WebKit; Firefox reported; 50 runs | Playwright, benchmark, not in the phase suite | 1 |
| G4 | 4-page with photo: PDF ≤ 5 s p95, TXT ≤ 1 s p95, Chromium and WebKit; PDF ≤ 1 MB; 20 runs | Playwright, benchmark, not in the phase suite | 1 |
| G5 | Fonts embedded as subsets, extraction returns the Cyrillic and diacritics, links listed. Regression inside G1: every Latin letter survives in a PDF written after one holding the Cyrillic homoglyph (shared font instance, DD-P10-15) | `pdffonts`, `pdftotext`, `pdfinfo -url` | 1 |
| G6 | Two runs byte-identical PDF and TXT | Node, hashes | 1 |
| G7 | PageModel hash, PDF bytes and TXT bytes identical in Node, Chromium, Firefox, WebKit | Playwright, hashes against the Node reference | 1 |

G1, G2, G5, G6, G7 run in `tests/suite.cmd`. G3 and G4 are the separate `bench` command (`bash scripts/ci/rendering.sh bench`), because a timing threshold in the phase suite would fail on machine load rather than on code; the measured numbers go in `tests/test-results.md`.

## E2E (`tests/e2e/design.spec.ts`), three browsers

| ID | Scenario | AC |
|---|---|---|
| Y01 | Design tab: three thumbnails with the fixture's own text; arrows change template; draft updates; autosave PUT carries it; reload keeps it | 3, 13 |
| Y02 | T1 → T2 → T3 → T1 by real clicks: draft HTML as before, PUT body equal to the first except `templateId`, order unchanged | 4 |
| Y03 | Swatch: name-colour computed style changes, body colour does not; undo returns | 6, 13 |
| Y04 | Sliders with real keys: arrows, Home, End, double-click; value shown; one undo restores after a burst | 8, 13 |
| Y05 | Page size, margin presets and custom, font size change the sheet's computed style; reset and undo | 7, 9, 10 |
| Y06 | Body font: the computed family changes and the font file loads from our own origin; no request leaves the origin | 11, 18 |
| Y07 | Language and date format change the draft's dates and "Present" | 12 |
| Y08 | T3 placement: Skills in the sidebar by default, override to main moves it; T1 ignores | 5 |
| Y09 | Axe clean on the Design tab for each template, keyboard reach of every control, 390 px and 200% no page overflow | 17 |
| Y10 | Chromium visual baselines of T1, T2, T3 (the other two browsers skip) | 19 |
| Y11 | The draft applies the 6 pt paragraph gap; text is positioned at subpixels, as the painter does | 16 |

Existing P08 and P09 tests stay unedited (AC-P10-18).

## Real-stack (`tests/e2e/real-stack/design-acceptance.spec.ts`), step 7

Real API and real Mongo. D01 design settings survive a reload and a new tab. D02 a snapshot restore and undo. D03 a foreign `bodyFont` written through the API does not break the draft and is not rewritten. D04 three templates with screenshots for `qa-report.md`, axe, 390 px, no outbound request. D05 a placement override survives T3 to T1 and back.

## Red evidence

Tests run against stubs that export the right names and do nothing, so every failure is an assertion on missing behaviour, not an import or harness error. The gate harness's red run proves the harness itself (bundle, static server, three browsers) starts.
