# ADR-010 — Shared layout engine: one page model in the frontend for preview, PDF and TXT

- Status: **Accepted** (`DELEGATED-DEFAULT`, ADR-035 A-4). Technology confirmation follows the prototype gate in §6.
- Decider: Solution Architect (delegated, ADR-035)
- Amended: 2026-11-02, P01 review fix loop 1 (code-review M-3: cross-runtime identity gate G7, G2–G4 references, TXT time; m-1 §5; m-5 §9; m-8 §6; decisions.md DD-P01-35, DD-P01-36, DD-P01-38)
- Date: 2026-11-02 (P01, decisions.md DD-P01-07)
- Source IDs: FR-PRV-01, FR-PRV-02, FR-PRV-03, FR-PRV-07, FR-PDF-01…FR-PDF-10, FR-TXT-01…FR-TXT-07, FR-LAY-05, FR-LAY-09, FR-TPL-02, FR-TPL-05, FR-LIB-01, FR-LIB-06, FR-ACC-04, NFR-01, NFR-03, NFR-04, NFR-07, NFR-13, NFR-14, TECHNICAL-SPEC §2 P3/P4, §8, §9, §10.2; conflict SC-23
- Related: ADR-009 (exports are not stored), ADR-007 (boundaries), ADR-012 (EU)

## Context

FR-PRV-02 requires preview and PDF to use **the same layout result**: same pages, same content per page, same line breaks, and a visual diff of at most 1% at 100 dpi. NFR-01 requires p95 ≤ 300 ms preview latency for a 4-page resume. NFR-14 requires deterministic layout with bundled fonts. FR-PER-02 requires the editor to keep working offline.

The Blueprint warns that printing HTML does not guarantee pagination parity. Different browsers shape and break text differently, and screen CSS is not paginated. `CLAUDE.md` also says that backend and frontend share no code. So one layout algorithm cannot live in both stacks.

P00 conflict SC-23: where layout runs decides the P02 export contract, and P07 and P10 thumbnails need rendering before P11.

## Decision

1. **Where layout runs: in the frontend bounded context (the browser).** One TypeScript layout engine computes a pure function `layout(document, template, settings, fonts, engineVersion) → PageModel`.
   - The PageModel lists pages, and for each page the positioned blocks, line boxes with glyph runs, decorations, link rectangles and source anchors (section, entry, item IDs).
   - It is the *single* layout result.
2. **Preview** paints the PageModel: every line is placed at the computed position, and the browser never chooses a line break. Source anchors serve click-to-select (FR-EDT-04, FR-PRV-08) and scroll-to-section (FR-EDT-03).
3. **PDF** is written **in the browser** from the same PageModel instance by a PDF writer. Text is vector text with embedded subset fonts and a ToUnicode map; links become annotations; metadata follows FR-PDF-05. The download is one click (FR-PDF-01).
4. **TXT** is serialized in the browser from the same canonical document by a pure serializer (§9 grammar). It uses the same date and "Present" formatting code as the layout engine, so FR-TXT-02 order and date parity hold by construction.
5. **The server renders nothing.**
   - There is no export endpoint, no headless browser and no background export job in v1. The "background processing for export" candidate (P00 GOV-04) is therefore closed as not needed.
   - Exports are not stored (ADR-009, ADR-039).
   - FR-ACC-04 (data archive with the latest PDF/TXT): the server returns the account data as JSON plus photo files. The browser adds the PDF and TXT of each resume's **current version, regenerated with the current engine and fonts** (DD-P01-36), and zips them into **one archive**. The result is byte-identical to an earlier download only if the document version, settings, `engineVersion` and font versions are all unchanged (§7); after a later edit or a frontend release it differs. A user at the 200-resume limit can need minutes of PDF generation, so P13 builds the archive in batches with progress and cancel, and the PDF part may be partial (missing PDFs are listed in the archive; FR-ACC-04 is a Should).
6. **Text measurement never uses the browser.** Shaping and advance widths come from the bundled font files through a pure-JS or WASM shaping library, so Node (tests) and every supported browser compute identical metrics.
   - Fonts are bundled and versioned with the frontend (Roboto for T1; Latin Extended and Cyrillic per NFR-07) and served from our own origin. No font CDN is used (NFR-09).
7. **Determinism.** The PDF has a fixed `CreationDate`/`ModDate` taken from the resume's `updatedAt`, a deterministic document ID and object order, and no random values. The same `(document version, settings, engineVersion, font versions)` gives byte-identical PDF and TXT.
   - Determinism holds **across runtimes**, not only across runs: Node and every supported browser family (NFR-05) must produce the same PageModel, PDF and TXT, because the user's browser writes the export.
   - The engine, the PDF writer and the TXT serializer therefore do not use runtime-provided locale or Unicode data (`Intl.*`, `toLocaleString`, `localeCompare`, `String.prototype.normalize`). Line-break, normalisation and hyphenation data are bundled and versioned with the engine.
   - Geometry uses only basic IEEE-754 arithmetic (no transcendental `Math` functions, whose results may differ between JavaScript engines) and is quantised to a fixed precision before comparisons. Numbers in the PDF are written by an engine-owned fixed-precision formatter.
   - Criterion G7 (§6) verifies this.
8. **Mismatch telemetry (NFR-13).** Before writing the PDF, the export path compares the page count and a line-break hash with the preview's PageModel. A mismatch (for example, fonts that were not loaded yet) is reported to our own API as a content-free client event: resume ID, engine version, error code. This event endpoint is a P02 contract item.
9. **Thumbnails** (FR-LIB-01, FR-TPL-02) are rendered client-side from page 1 of the PageModel, lazily for visible cards, and cached in the browser by `(userId, resumeId, version)` in a per-user namespace. The "remove local data from this device" action clears that namespace (threat model T-ID-06). The server stores no thumbnails. Until the engine exists (P11), P07 and P10 show a neutral placeholder.
10. **Pagination rule priority** (SC-19), highest first:
    - (1) PG-06 header never split, and PG-08 manual break (Should; `pageBreakBefore` is in the v1 model);
    - (2) PG-05 2-column rows are atomic;
    - (3) PG-01 and PG-02 keep-with-next;
    - (4) PG-03 and PG-04 widow and orphan control;
    - (5) PG-07 timeline continuation (always satisfiable).
    - If a block cannot be placed, the lowest-priority rule is relaxed first. The fallback is PG-09: break by lines and emit the FR-PRV-07 hint.

### Candidate technology (confirmed by the prototype, §6)

| Concern | Primary candidate | Alternative |
|---|---|---|
| Shaping and metrics | `fontkit` (MIT, pure JS, OpenType GSUB/GPOS, subsetting) | `harfbuzzjs` (MIT, HarfBuzz WASM) |
| Line breaking | UAX #14 break opportunities (`linebreak`, MIT) plus our own greedy fitter; hyphenation (FR-LAY-09, Should) with pattern files whose licence is checked in P10 | Knuth–Plass optimal fit, if greedy output is visibly poor |
| PDF writer | PDFKit (MIT; embedded subset fonts, link annotations, metadata, structure tags for FR-PDF-08) | pdf-lib (MIT; less maintained, no tagging) |
| Preview painter | DOM: one absolutely positioned element per line, using the same WOFF2 font, kerning and ligatures as computed, and `letter-spacing: 0` | SVG text or canvas glyph paths placed from engine positions |
| Whole-engine fallback | — | Typst compiled to WASM (Apache-2.0), with SVG preview and Typst PDF |

## Alternatives considered

- **HTML/CSS preview with headless Chromium print-to-PDF on the server.** Rejected. Each user's browser shapes and breaks text differently from server Chromium, so FR-PRV-02 parity is not guaranteed (Blueprint §5). It also adds a server-side browser, which brings an SSRF and resource-exhaustion surface.
- **Server-side layout in .NET** (for example QuestPDF, a SkiaSharp PDF backend), with the preview fetched as images. Rejected. Every keystroke needs a round trip (NFR-01 risk), there is no preview offline (FR-PER-02), and server CPU grows per keystroke. Licences such as QuestPDF Community have revenue conditions.
- **Layout in the browser and a PDF painter in .NET that consumes a client PageModel.** Rejected. The PageModel would become a large public contract, and the client still needs fonts and metrics. It saves nothing, because the browser writer already runs in the same process as the layout.
- **One engine shared by the frontend and a backend Node service.** Rejected for v1. Sharing code across the boundary breaks the non-negotiable rule in `CLAUDE.md`. A frontend-owned Node renderer remains a reversible option (see Consequences).
- **PDF-first preview** (generate the PDF on every keystroke and show it with pdf.js). Rejected as primary. It risks NFR-01, and click-to-select becomes hard. It is kept as an option inside the Typst fallback.

## Rationale

- Only a layout engine that controls its own metrics can promise identical line breaks in every supported browser and in the PDF (FR-PRV-02, NFR-04, NFR-14).
- Running it where the user types meets NFR-01 and works offline.
- Writing the PDF in the browser removes the whole server export surface (security), removes stored exports (privacy, FR-ACC-03), and keeps the backend free of rendering code (boundary rule).
- All candidates are MIT or Apache-2.0 JavaScript or WASM, and the PageModel is engine-independent. Swapping the shaping library or the PDF writer does not change the API contract.

## Consequences

- **P02 contract:**
  - no PDF or TXT export endpoints;
  - an account data endpoint (JSON plus photo downloads) for FR-ACC-04;
  - a content-free client event endpoint (NFR-13);
  - the photo rendition is served through the API for PDF embedding (ADR-009);
  - an optional "snapshot before export" call for FR-PER-05 (Should).
- **P10 starts with the rendering prototype** (§6). It moved earlier from P11 because template definitions (FR-TPL-05 tokens and layout rules) must fit the engine. P11 builds the full engine, and P12 builds the PDF writer, the TXT serializer and export UX.
- **Fixtures:** `tests/fixtures/` and `tests/rendering/` (Test Engineer) hold canonical resume JSON. Real reference-CV content is allowed (P00 Q-5). The rendering tests extract per-page text and line breaks from the PDF (pdf.js or `pdftotext` in CI) and compare them with the PageModel. Visual diff uses the rasterised reference PDF (written in Node) against Playwright screenshots in Chromium, Firefox and WebKit. A cross-runtime identity test runs the engine, the PDF writer and the TXT serializer in Node, Chromium, Firefox and WebKit and compares the hashes (G7).
- **Reversibility:** if server-side PDF becomes necessary (for example for a public API), the frontend team can deploy the same engine as a Node renderer service that it owns. That adds endpoints (an additive contract change) and keeps backend and frontend code separate.
- **Risk:** the frontend bundle grows by the engine plus fonts. Mitigation: lazy-load the engine and fonts on editor routes. The bundle size is recorded in the P10 prototype report.
- FR-PRV-02's literal test (the PDF equals the preview layout) can be automated without a server, entirely in CI.

## Security/privacy impact

- No server-side rendering of user content. No URL fetching (no SSRF) and no headless browser to sandbox.
- Link URLs are limited to the schemes `https`, `http`, `mailto` and `tel`. The backend enforces this at write time (domain validation) and the engine enforces it again at paint and PDF time, so a `javascript:` or `data:` URI never reaches a preview `href` or a PDF annotation.
- Rich text is an AST (TECHNICAL-SPEC §10.2) and is rendered as text nodes. Raw HTML from the document is never rendered (XSS).
- Export content never leaves the user's browser except as the download. Client events carry no content (`.claude/rules/03-security-privacy.md`).

## §6 Prototype plan (go/no-go, start of P10)

A timeboxed prototype at the start of P10 (throwaway code in `frontend/`, removed or promoted by the P10 plan) with:
- T1 header plus one `entries` section with a timeline and a 2-column bullet list;
- a `list` section and a `text` section;
- A4 and Letter; Medium and Large presets; Spanish and Ukrainian text; one photo.

| # | Criterion | Target | Measured by |
|---|---|---|---|
| G1 | Parity | For 3 fixtures (1 page; 2 pages with an entry across the boundary; 4 pages) × A4/Letter, the per-page text and the line breaks extracted from the PDF equal the PageModel lines | Node test |
| G2 | Visual parity | Diff ≤ 1% pixels at 100 dpi between the preview screenshot in each of Chromium, Firefox and WebKit and the raster of the **reference PDF**, the one written in Node from the same fixture | Playwright plus raster diff |
| G3 | Latency | Re-layout plus paint after one keystroke on the 4-page fixture: p95 ≤ 300 ms in Chromium and in WebKit on the reference runner (NFR-01). Firefox is measured and reported | Benchmark, 50 runs per browser |
| G4 | PDF and TXT time, PDF size | 4-page fixture with photo: PDF ≤ 5 s p95 and TXT ≤ 1 s p95 in Chromium and in WebKit on the reference runner; PDF ≤ 1 MB (NFR-03, FR-PDF-09) | Benchmark, 20 runs per browser |
| G5 | PDF fidelity | Fonts embedded as subsets, text extraction returns the typed Cyrillic and diacritics, links clickable (FR-PDF-02/03) | `pdffonts`, extraction test |
| G6 | Determinism | Two runs give byte-identical PDF and TXT (NFR-14) | Hash test |
| G7 | Cross-runtime identity | For the G1 fixtures × A4/Letter, the PageModel hash (canonical serialisation), the PDF bytes and the TXT bytes are identical in Node, Chromium, Firefox and WebKit (NFR-05, NFR-14, FR-PRV-02, FR-ACC-04) | Playwright runs the engine in each browser; hashes compared with the Node reference |

**Reference runner** (G3, G4): the CI reference runner, a GitHub-hosted standard Linux runner (ADR-033), stands in for the NFR-01 "mid-range laptop". Playwright browser builds are pinned by version. The P10 report records the runner's CPU model, core count and memory, and one manual spot check on a mid-range laptop (4 cores, 8 GB class) for comparison.

**Recorded, not gating:** the P10 report also records the library load with 12 thumbnail cards (NFR-02 p95 ≤ 2 s at 10 Mbit/s throttling), the engine and font bundle size (R-04), and whether a batched documents endpoint is needed. P11 owns the NFR-02 target for the library; a batched endpoint would be an additive contract change.

Go needs G1, G3, G5, G6 and G7, plus G2 in Chromium. A G2 miss in Firefox or WebKit switches the preview painter to SVG glyph placement and re-measures. A G3 miss adds per-section layout caching and re-measures. A G7 miss is traced to the diverging dependency (for example a runtime `Intl` or normalisation call, hyphenation data, floating-point formatting or a transcendental `Math` function), which is replaced by bundled data or engine-owned code, and G7 is re-measured. If any of G1, G3, G5, G6 or G7 still fails, P10 evaluates the Typst-WASM fallback before templates are built. The outcome is recorded as an ADR-010 amendment ("Technology confirmation") by the P10 Solution Architect.

## Technology confirmation (P10, 2026-11-05)

**Go.** The primary candidates stand: `fontkit` 2.0.4, `linebreak` 1.1.0 with the engine's greedy fitter, PDFKit 0.20.2 and the DOM painter. The Typst fallback was not needed. Evidence: `docs/phases/P10/tests/test-results.md`.

| # | Result | Runner |
|---|---|---|
| G1 | PASS: 8 fixture runs, including Large, every model line found on the same page and in the same rectangle | Node 24 |
| G2 | PASS: worst page Chromium 0.017%, Firefox 0.116%, WebKit 0.281% at 100 dpi, with the metric of DD-P10-14 and its negative control | Pinned Playwright image |
| G3 | PASS: p95 Chromium 50 ms, WebKit 113 ms; Firefox reported at 65 ms; 50 runs each | Development laptop, see below |
| G4 | PASS: PDF p95 Chromium 78 ms, WebKit 77 ms, Firefox 109 ms; TXT p95 at most 1 ms; PDF 46,876 bytes; 20 runs each | Development laptop, see below |
| G5 | PASS: fonts embedded as subsets, Cyrillic and diacritics extracted, links listed | poppler |
| G6 | PASS: two runs byte-identical | Node 24 |
| G7 | PASS: PageModel hash, PDF bytes and TXT bytes identical in Node, Chromium, Firefox and WebKit | Pinned Playwright image |

**Not from the reference runner.** G3 and G4 ran on the development laptop (Intel i5-8250U, 8 logical CPUs, 23 GB), which stands close to the NFR-01 mid-range laptop, inside the Playwright container. The reference CI runner has not run them. The command is `bash scripts/ci/rendering.sh bench`, and the margin is a factor of 2.6 in the slower required browser. P11 owns NFR-01 as a release target.

**Recorded, not gating.** Engine bundle 951,450 bytes (256,300 gzipped, including `fontkit`, `linebreak`, PDFKit and their Unicode data). Fonts 1,213,364 bytes for all twelve faces; Roboto 359,576, IBM Plex Sans 547,280, PT Serif 306,508. The route bundle does not import the engine in P10, and P11 lazy-loads it. A single-document library load and the batched documents question stay with P11, because no route renders thumbnails from the engine until then.

**Refinements to the decision above.**
- One font format, TTF, for the browser and the engine (DD-P10-10), not WOFF2.
- The painter places one element per run, with an inline-block strut pinning the baseline, because browsers round ascent differently. The G2 result depends on this.
- The PDF writer registers font files, not the FontBook's parsed fonts (DD-P10-15).
- The prototype is promoted, not thrown away (DD-P10-01).

## P11 refinements (2026-11-06)

Refinements from building the full engine and wiring the preview. The decision above stands. Evidence: `docs/phases/P11/tests/test-results.md`.

- **PageModel additions.** `Page.icons` (vector icons, only `M L C Z` paths, DD-P11-16), `Page.regions` (one box per section per page, for selection), `PageModel.hints` (`lone-title`, `oversized`, DD-P11-07; the PDF ignores them) and `Run.parts` (below).
- **Painter.** A run over 40 characters is re-anchored at model offsets about every 32 characters (DD-P11-17), because WebKit on Linux hints advances at small sizes and a whole-line run drifted 1.202% on dense pages. §6's named fallback, SVG glyph placement, was not needed. Shapes are painted before the photo, since T3's photo sits on its band.
- **G2 covers more.** 12 fixtures on each of T1, T2 and T3, plus Letter and Large: 48 cases per browser. The limit now binds in all three browsers: worst page Chromium 0.146%, Firefox 0.388%, WebKit 0.560%.
- **Hyphenation is not in v1** (DD-P11-13). `hyphen` is not a dependency: an inserted hyphen would break FR-PDF-02's copy and search.
- **G3 and G4 are still from the development laptop.** The reference CI runner stays with P15 (DD-P11-15). NFR-01 is also measured through the real editor.

## P12 refinements (2026-11-06)

Refinements from building the export. The decision above stands. Evidence: `docs/phases/P12/tests/test-results.md`.

- **The tag tree is in document order.** `Line.block` says which paragraph or list item a line belongs to, and `planStructure` builds `H1`, `H2`, `H3`, `P`, `L`/`LI`/`LBody`, `Figure` and `Link` from it. The content stream keeps painting order. `Line.block` is not a position (DD-P12-09, DD-P12-18). This is tagging in the PDF/UA style; nothing here validates or claims PDF/UA conformance.
- **Characters outside the font.** PT Serif falls back per character to bundled Roboto, in `composeLines`, from font data only, so preview and PDF agree and G7 holds (DD-P12-22). `ENGINE_VERSION` is 1.1.0. What neither font has prints as the font's box: the writer marks that run with `ActualText`, so copy returns the typed text, and the status line names the characters once (DD-P12-07). No CJK or emoji font.
- **§3 "the same PageModel instance" and §8.** The export writes the preview's own object when the preview is of the current document and a fresh layout agrees with it. Otherwise it writes the fresh layout, and a disagreement raises the event (DD-P12-01, DD-P12-03).
- **§7's date.** `updatedAt` of the last acknowledged write. An unsaved edit is exported under that date, so the bytes follow the content and never the clock (DD-P12-02).
- **PDFKit has its own lazy chunk.** The route chunk has no engine and no PDFKit. The rendering bundle and the Vite build gave identical bytes in all three browsers (E01).
- **G3 and G4 are still from the development laptop** (DD-P12-16). NFR-03 is also measured through the real route.

## Owner and date

Solution Architect (delegated, ADR-035), 2026-11-02. The owner reviews it after the fact in the P15 decision table (ADR-035 A-6).
