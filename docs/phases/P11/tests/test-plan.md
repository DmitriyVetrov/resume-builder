# P11 Test Plan

Levels: Vitest (engine in Node, UI in jsdom with the real engine and the real font files), xUnit against the real host, the rendering suite (Node reference, poppler, three browsers), Playwright E2E on the built SPA, and the real-stack acceptance spec at step 7. Run one suite at a time.

## Acceptance map

| Criterion | Executable checks | Level |
|---|---|---|
| AC-P11-01 | P01, P02, Q01 | Vitest, E2E |
| AC-P11-02 | G1, G2, G5, G6, G7 over `CASES` (12 fixtures × T1, T2, T3 on A4, plus Letter and Large); Q02 route parity against the Node model | Rendering, E2E |
| AC-P11-03 | P03, Q03; benchmark `bench-editor.spec.ts` (G3-E), G3, G4 recorded | Vitest, E2E, bench |
| AC-P11-04 | C30, Q04 | Vitest, E2E |
| AC-P11-05 | Z01–Z06, C31–C33 | Vitest |
| AC-P11-06 | P04, P05, Q05 | Vitest, E2E |
| AC-P11-07 | N12, N13, P06, Q06 | Vitest, E2E |
| AC-P11-08 | P07–P11, E12 (retargeted), Q07 | Vitest, E2E |
| AC-P11-09 | N01–N14, E19 | Vitest, plus G1 on the boundary fixtures |
| AC-P11-10 | X01–X16, E16, Y08, Y10 baselines | Vitest, E2E |
| AC-P11-11 | K01–K09, C01–C03, Q08; NFR-02 measure in acceptance | Vitest, E2E, real stack |
| AC-P11-12 | E21, Q09, `web-image-check.sh`; NFR-02 measure in acceptance | Vitest, E2E, image, real stack |
| AC-P11-13 | CE01–CE11, H01–H05, Q10 | xUnit, Vitest, real stack |
| AC-P11-14 | E22, DD-P11-13 measurement | Vitest, recorded |
| AC-P11-15 | Q11, Y09 | E2E |
| AC-P11-16 | P12, P13, Q09, Q12, Y06 | Vitest, E2E |

## New tests

**Engine, `entities/layout/pagination.test.ts`**, with synthetic documents built to land on a boundary:
- N01 PG-01: a section title is never last on a page; it moves with two content lines.
- N02 PG-02: title and meta rows stay with two description lines.
- N03 PG-03: a bullet of ≤ 4 lines is not split.
- N04 PG-03: a longer bullet splits with ≥ 2 lines on each side, and only its first part has the marker.
- N05 PG-04: a paragraph keeps ≥ 2 lines each side of a break.
- N06 PG-05: a two-column row is never divided.
- N07 PG-06: the header is never split when it fits a page.
- N08 PG-07: the timeline continues on the next page with no second dot, and starts at the first entry's dot, not at the section title.
- N09 PG-08: `pageBreakBefore` starts a new page; on a section's first entry the title moves with it.
- N10 PG-08 in T3: a manual break moves only that column.
- N11 ADR-010 §10: a manual break outranks keep-with-next.
- N12 PG-09: an item longer than a page breaks by lines, no text is lost, and an `oversized` hint is raised on each page it occupies.
- N13 FR-PRV-07: a title with no placeable content at a page bottom raises `lone-title`; a normal document raises no hint.
- N14 Entry dates wider than the column keep every line (a defect found while planning).

**Engine, `entities/layout/templates.test.ts`**, successors of the draft's V tests:

| New | Proves | Replaces |
|---|---|---|
| X01 | T2 contacts are chips with one icon per kind; text inside the padding | V17, V03 |
| X02 | A contact with no text is left out; an unsafe URL makes no link, on every template | V18 |
| X03 | T2 list items are chips by default and keep rich text, with no marker | V19 |
| X04 | An explicit column count turns chips into bullets | V20 |
| X05 | T2 has an accent rule under the header, no timeline, no photo, `showPhoto` untouched | V02, V04 |
| X06 | T3 band: full bleed, page 1 only, height from padding, white text, links white | ADR-024 |
| X07 | T3 photo is round, 64 pt, inside the band; no photo, text at the margin | V04 |
| X08 | T3 zones: widths per DD-P11-03, type defaults, an override wins, document order per column | V05 |
| X09 | T1 and T2 keep one flow and ignore `placement`, which stays stored | V06 |
| X10 | T3 columns paginate independently and share pages | PG rules |
| X11 | Colour roles per template: only the roles change | V09 |
| X12 | Dates follow language and format; a text override wins | V13 |
| X13 | List columns: explicit wins, null follows type and template | V14 |
| X14 | Entry bullets follow the section value; a text section stays in one column | V15 |
| X15 | A link keeps a user underline and has no default underline | V16 |
| X16 | Icons use only `M L C Z` (DD-P11-16) | — |

V01 → P01, P02. V07 → E18. V08 → C-series on painted values. V10 → C01. V11 → P14. V12 → P07, P09.

**Fit, `entities/layout/fit.test.ts`:** Z01 already fits: no change. Z02 line spacing goes first, by the least. Z03 then entry, then section spacing. Z04 then font preset. Z05 cannot fit: unchanged, with a report. Z06 content deep-equal in all cases.

**Preview, `features/editor/preview-panel.test.tsx`:**
- P01 One labelled group per page, "1 / 2" numbers, `data-template`, no draft label.
- P02 A page has the page size in `pt`, and painted runs carry the model's text.
- P03 An edit reaches the painted text; an unchanged page's element is not repainted.
- P04 The four zoom options scale the sheet; 100% is true size; layout is untouched.
- P05 Fit width follows the panel width.
- P06 An oversized item shows the outline and the text hint.
- P07 Each section has one tab stop, in document order, with Enter and Space; a continuation region is `aria-hidden`.
- P08 The header has a region and selects the header form.
- P09 A click on an entry opens and reveals that entry's form; on a list item it reveals the row.
- P10 The selected section is marked on every page it occupies.
- P11 Selection scrolls to the section's first region at the current zoom.
- P12 A font failure shows an alert with Retry, reports one event, leaves forms working; Retry recovers.
- P13 No `<a>` exists in the preview, also with a link in the document.
- P14 A thumbnail is decoration: no section IDs, nothing focusable, `aria-hidden`.

**Design tab, in `design-panel.test.tsx`:** C30 counter is present and changes with a slider. C31 Fit applies, says so, one undo. C32 Fit that cannot says so and changes nothing. C33 the target list covers 1 to the current count.

**Thumbnails, `features/library/thumbnail.test.tsx`:** K01 A card paints page 1 of the fetched document. K02 A cached row of the same version needs no fetch. K03 A new version re-renders and replaces the row. K04 Another user's row is not used. K05 A failed fetch keeps the placeholder and does not disturb the list. K06 `removeLocalData` clears the rows and `localDataSummary` counts them. K07 A complete active list prunes other rows. K08 A 404 prunes that row. K09 At most 3 fetches run at once. K10 Account deletion clears the rows.

**Client events, `shared/api/client-events.test.ts`:** H01 The body matches the contract's shape, with no free text. H02 One report per kind per page load. H03 A failed report does not throw. H04 The queue reports `idempotency_key_reused` on that 422 and `autosave_failed` on any other 422. H05 Nothing is sent on a 409, a 5xx or offline.

**Backend, `P11ClientEventTests.cs`, against the real host:** CE01 202 with an empty body. CE02 401 with no session. CE03 403 with no CSRF token. CE04 415. CE05 413 over 16 KB. CE06 400 on bad JSON. CE07 400 per schema rule: unknown property, empty and oversized batch, bad enum, bad code pattern, bad UUID, bad engine version, bad timestamp, missing field. CE08 429 past 30 per minute per IP, with `Retry-After`. CE09 The log holds type, code, resume ID and engine version, and none of a body's rejected values. CE10 A null `resumeId` and `engineVersion` are accepted. CE11 Contract drift: the route is present with its frozen responses.

**E2E, `tests/e2e/preview.spec.ts`, each browser:** Q01 Separate pages, gap, numbers. Q02 Painted text and positions from the real route equal the Node reference model, on T1, T2 and T3. Q03 A keystroke reaches the page. Q04 The counter changes on a slider. Q05 Zoom by real clicks; line breaks unchanged. Q06 Hint visible on the oversized fixture. Q07 Click, keyboard and scroll within one line. Q08 Library cards paint and survive a reload from the cache. Q09 A page with no resume loads no engine and no font, and nothing leaves the origin. Q10 A forced 422 sends one contract-valid event. Q11 Axe clean per template, Tab reaches the toolbar and sections with a visible ring, no overflow at 390 px and 200%. Q12 A blocked engine chunk or font shows Retry, and editing still works.

## Rendering fixtures

`tests/rendering/make-fixtures.mjs` adds nine fixtures to the three P10 ones, all synthetic: `minimal`, `title-at-bottom`, `long-paragraph`, `long-bullet`, `many-rows`, `manual-break`, `oversized`, `rich-marks`, `contacts-heavy`. `CASES` runs each on T1, T2 and T3 on A4, the P10 cases on Letter and Large, and `four-pages` on Letter for T2 and T3. The P10 fixture-size checks stay on the T1 Medium cases.

## Retargeted tests (DD-P11-02)

Assertions keep their meaning and move from draft markup to painted output: `workspace.test.tsx` W01, W02, W03, W08-range preview checks; `design-panel.test.tsx` C01–C03 and every `--variable` read, which become run styles, sheet size and positions; `tests/e2e/editor.spec.ts` E12; `rich-text.spec.ts` T01, T02, T-hostile; `design.spec.ts` Y01–Y03, Y05–Y11; both real-stack specs; `library.test.tsx` F01 only if the placeholder markup moves. E21 becomes "only the runtime imports the engine, by `import()`". E22 checks strings with spaces.

## Commands

```bash
bash docs/phases/P11/tests/suite.cmd                          # the phase suite
cd frontend && npx vitest run src/entities/layout             # narrow, engine
dotnet test backend/tests/ResumeBuilder.Api.Tests --filter P11  # narrow, backend
bash scripts/ci/rendering.sh                                  # gate, needs poppler and Docker
bash scripts/ci/rendering.sh bench                            # G3, G4, editor latency; outside the suite on purpose
```

Timing assertions stay in the benchmark: in the suite they would fail on machine load rather than on code. Baselines Y10 are Chromium only, in the pinned image.
