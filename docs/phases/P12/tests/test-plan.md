# P12 Test Plan

Levels: Vitest (pure code in Node, UI in jsdom with the real engine and fonts), xUnit against the real host, poppler checks in Node over PDFs written by the rendering bundle, Playwright against the Vite build in three browsers, and step 7's real-stack spec.

## Acceptance map

| Criterion | Executable checks | Level |
|---|---|---|
| AC-P12-01 | A01, E01, E09 | Vitest, E2E |
| AC-P12-02 | R06, R07, M03 | Rendering, Vitest |
| AC-P12-03 | R08 | Rendering |
| AC-P12-04 | R03, R04, R05 | Rendering |
| AC-P12-05 | R01, R02 | Rendering |
| AC-P12-06 | F01–F08, A01, E01, E02 | Vitest, E2E |
| AC-P12-07 | R11, X05, X06, E07; real stack A02 | Rendering, Vitest, E2E, real stack |
| AC-P12-08 | S01–S07, R09 | Vitest, Rendering |
| AC-P12-09 | R12; benchmark G4-E, recorded | Rendering, bench |
| AC-P12-10 | T01–T05 (P10), T06–T15, R10 | Vitest, Rendering |
| AC-P12-11 | T12, X10, X11, A08, E05, E06 | Vitest, E2E |
| AC-P12-12 | A02, A03, A04, A09, E03, E04 | Vitest, E2E |
| AC-P12-13 | B01–B04, E08 | Vitest, E2E |
| AC-P12-14 | G1, G2, G5, G6, G7 over `CASES`; E01, E02, E08 byte equality | Rendering, E2E |
| AC-P12-15 | X03, X04, X06, X07, E07, CE15; real stack A04 | Vitest, E2E, xUnit, real stack |
| AC-P12-16 | X08, A10, E01; real stack A03 | Vitest, E2E, real stack |
| AC-P12-17 | M01, M02, M04–M09, X13, R13, R14, E11, A07 | Vitest, Rendering, E2E, real stack |
| AC-P12-18 | E10; real stack A01 | E2E, real stack |
| AC-P12-19 | E01, E09 | E2E, plus `git diff` |

## New tests

**File name, `entities/resume/export-name.test.ts`:**
- F01 FR-PDF-06's example, with its dashes.
- F02 Each space becomes `-`, tabs and NBSP too.
- F03 Unicode letters, digits and combining marks stay: `Резюме Лусія`, `Ñáñez`, a decomposed `й`.
- F04 Everything else goes: `/\:*?"<>|`, `(`, `,`, `•`, emoji.
- F05 Leading and trailing dots go: `../../etc/passwd` has no path step and no leading dot.
- F06 An empty, blank or all-punctuation title falls back to `resume`.
- F07 Controls and bidi overrides go (a U+202E title cannot disguise the extension).
- F08 The extension is appended once: a title ending in `.pdf` is not doubled.

**TXT, `entities/layout/txt.test.ts`,** added to P10's T01–T05:
- T06 `reference-cv.json` serializes to §9.4's text, byte for byte, from `tests/fixtures/txt/reference-cv.txt`, which is copied from the spec, not generated.
- T07 All twelve fixtures equal their goldens.
- T08 Contacts: a derived `mailto:`/`tel:` is hidden, a chosen one on other text is printed, a link is printed, `@handle` gets no URL, an unsafe URL is dropped.
- T09 Empty list items, empty entries and whitespace-only paragraphs print nothing.
- T10 A blank section title prints no title line and no leading blank line.
- T11 Three or more newlines collapse to one blank line; `\r` becomes `\n`; a tab becomes a space.
- T12 The `crlf` option turns every line ending into CRLF and leaves no bare LF.
- T13 Typed case on T1, T2 and T3: `Tech Stack` stays, where the layout has `TECH STACK`.
- T14 No section is lost: each visible non-empty section of each fixture appears, in document order.
- T15 Inline, §9.3: a link whose text equals the URL prints once; marks drop.

**Tag plan, `entities/layout/pdf-structure.test.ts`:**
- S01 Header: H1, then P for the headline and for all contact lines together, then a Figure when a photo is placed.
- S02 Sections are in document order on T3, whatever the column.
- S03 A list section gives L, LI, LBody per item. Two-column rows keep item order.
- S04 A long bullet crossing a page stays one LI. A paragraph crossing a page stays one P.
- S05 An entry is a nested Sect with H3, organization P, location and dates in one P, then its description.
- S06 Every line of every page is in exactly one node, on all twelve fixtures and three templates.
- S07 `Line.block` changes no position: a model without it equals the model with it at every coordinate.

**Missing glyphs and coverage, `entities/layout/missing.test.ts`:**
- M01 Reports emoji and CJK once each, by code point, not by UTF-16 unit.
- M02 Covered characters, spaces and default-ignorable ones are not reported; the list is capped at ten plus a count.
- M03 Every Spanish, Ukrainian and Slovak letter on all twelve faces.
- M04 PT Serif's gap in Latin Extended-A and Cyrillic is exactly the DD-P12-08 list on all four faces.
- M05 Roboto and IBM Plex Sans cover Latin-1, Latin Extended-A and basic Cyrillic on all faces.
- M06–M09, added for DD-P12-22 after the external review. M06: on PT Serif those ranges print on every style. M07: only the gap letter takes the fallback, in the same style. M08: the baseline stays the document font's. M09: a character neither font has stays and is reported.
- X13 A PT Serif export loads the fallback. R14 Both fonts embedded, typed text back, no `ActualText`. E11 The real route paints from the fallback, and its PDF equals Node's. A07 The same on the real API.

**Export path, `features/export/export.test.ts`,** with the real engine, PDF writer and fonts:
- X01 Writes from the preview's own model when the preview is of this document.
- X02 Writes from a fresh layout when the preview is behind, with no event.
- X03 A preview with another page count: `export_mismatch`/`page_count.differs`; the fresh layout is written; the outcome says so.
- X04 Same pages, other line text: `line_breaks.differs`.
- X05 The photo is fetched only when the model places one (T2 has none; `showPhoto: false` has none).
- X06 A failed photo fetch: no file, `export_failed`/`photo_load`, a failure the caller can name.
- X07 An engine load failure: no file, `export_failed` with its code.
- X08 A rejected snapshot does not stop the export.
- X09 TXT: the name, `text/plain;charset=utf-8`, no BOM in the Blob's bytes.
- X10 TXT with `crlf`.
- X11 Copy: `writeText` gets the same content; a rejection is a failure the caller sees; no snapshot.
- X12 Download: a Blob URL, the `download` attribute, the URL revoked afterwards.

**Top bar, `features/export/export-actions.test.tsx`:**
- A01 Named and verified: "Export PDF" downloads `<sanitized title>.pdf`, one click, and no dialog.
- A02 Blank or whitespace name: `aria-disabled`, focusable, described by the visible reason; a click does nothing; "Edit header" opens the header form and focuses the name; typing the name enables.
- A03 Unverified: the same, with a "Resend verification" link to `/verify-email`.
- A04 Both missing: both reasons.
- A05 Success: a polite status with the file name.
- A06 Characters outside the font: the status names them.
- A07 A second click while one runs starts nothing.
- A08 Text options: the checkbox persists per user and reaches Export TXT.
- A09 Verified in another tab: a window focus re-reads the session and enables the buttons.
- A10 After an acknowledged write, the next PDF carries that write's `updatedAt`.

**Library, `features/library/library.test.tsx`:**
- B01 Each active card has Export PDF and Export TXT with the title in the name; trash cards have none.
- B02 A resume without a name: no file, and the page names what is missing.
- B03 Unverified: the buttons explain, with the same link.
- B04 A 401 goes to log in; a 404 refreshes the list.

**Retargeted (DD-P12-19):** W01 in `workspace.test.tsx`. The buttons exist and are enabled, with no "not available yet". Its other assertions are unchanged.

**Server, `P11ClientEventTests.cs`:** CE15, a theory over every code the export sends: each is logged as itself, not `other`.

**PDF, `tests/rendering/export-checks.mjs`,** run by `rendering.sh` after `reference.mjs`, over PDFs from the same bundle:
- R01 `pdfinfo`: Title, Author, Creator, with Cyrillic in them; the name alone when there is no headline.
- R02 Catalog `/Lang` for `en`, `es`, `uk`.
- R03 A4 and Letter sizes; with margins 23, 40 and 72, every word's box lies inside them, within 0.5 pt.
- R04 FR-LAY-02 on `pdftotext -bbox`: between v = 0, 10, 20 each section title moves by its index × Δv within ±0.5 pt, and the gap above a title minus the same gap at v = 0 equals v.
- R05 FR-LAY-03: the space between two entries is `v` within ±0.5 pt, at v = 0, 7, 10, 20. (List rows have a fixed §6.6 gap; P10's AC-P10-08 and `entryGap` read "between entries", so entry spacing does not move them.)
- R06 `pdffonts` on all three families: embedded, subset, Unicode map.
- R07 `pdftotext` returns the typed Spanish, Ukrainian and Slovak strings on all three families; `office`, `fi`, `ffl` survive ligatures.
- R08 `pdfinfo -url` lists the contact and rich-text URLs; each annotation `/Rect` covers its words; `@handle` and `javascript:` give no annotation.
- R09 `pdfinfo -struct`: Tagged; H1, H2, H3, L, LI, LBody, Figure, Link on each template, including a bullet across pages.
- R10 Section titles in `pdfinfo -struct-text` order equal the TXT's order, ignoring case, on T1, T2, T3.
- R11 `pdfimages -list`: one JPEG at ≥ 200 ppi on T1 and T3, and its bytes appear unchanged in the file.
- R12 `four-pages` with the 600 px worst-case photo: ≤ 1 MB on each template.
- R13 Emoji and CJK: `pdftotext` returns them through `ActualText`; two different ones do not collapse into one.

**Journeys, `tests/e2e/export.spec.ts`,** on the Vite build in Chromium, Firefox and WebKit:
- E01 Click PDF: file name, `%PDF`; bytes equal the Node writer's for this document, date and photo; one `before_export` snapshot; no dialog; no `pdf-*` chunk before the click; the version unchanged; same bytes on a second click.
- E02 Click TXT: file name, exact bytes equal to Node's; no BOM.
- E03 No name: nothing downloads, the reason shows, typing the name in the form enables and exports.
- E04 Unverified: reason and link, nothing downloads.
- E05 Copy as text, with a stubbed clipboard in all browsers.
- E06 The CRLF option persists over a reload.
- E07 Rendition 500: an alert, no file, the event; the editor still saves; a retry works. Offline without the chunk: an alert, not a crash.
- E08 Library: PDF and TXT equal the editor's bytes for the same version.
- E09 No wizard, DOCX, e-mail or share in the editor or card controls; only same-origin requests, and the only ones from a click are the snapshot and the photo.
- E10 Axe clean with buttons enabled, blocked and with the options open; keyboard only; no page overflow at 390 px.

**Benchmark, `tests/e2e/bench-editor.spec.ts`:** G4-E, 20 runs per browser from the real click to the finished download, with the 4-page fixture and the worst-case photo. Outside the suite, by DD-P11-15's reasoning.

**Real stack, step 7, `tests/e2e/real-stack/export-acceptance.spec.ts`,** with a verified account through Mailpit:
- A01 Exports through the real API, editor and library; axe clean.
- A02 A real upload: the rendition's bytes are in the PDF, quantization tables ≥ quality 85, ≥ 200 dpi.
- A03 The snapshot appears in Version history; the version did not move.
- A04 A blocked rendition: 202 on the event, one log line with `photo_load`, no content.
- A05 An unverified account is blocked, and works after verifying through the mailed link.
- A06 Library export equals the editor's bytes, for a saved resume with a photo.

## Commands

`bash docs/phases/P12/tests/suite.cmd`: backend job, E2E job (frontend job, fixture E2E, rendering gate including `export-checks.mjs`), P11's web image check, contract suite and static policy.
