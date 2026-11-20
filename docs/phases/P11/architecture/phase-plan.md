# P11 Architecture Plan — Shared Layout & Preview Engine

- Operator session, ADR-051, branch `phase/P11`, 2026-11-06. AGENT-WORKFLOW sets Claude Opus, effort `xhigh`, for this phase.
- Dependencies: P09 and P10 are `COMPLETED`.
- Contract: `contracts/openapi/openapi.yaml` 1.0.0, frozen by P02. **No contract change** (step 2 skipped). `reportClientEvents` is already frozen with `x-phase: P11`; this phase builds its server. No batched documents endpoint (DD-P11-11).
- ADRs: no new ADR. ADR-010 gets a "P11 refinements" amendment at step 5 (page model additions, hints, hyphenation decision). `OPEN`/`SOURCE-OPEN` rows touching this phase: none in `DECISION-REGISTER.md`.
- Decisions: [decisions.md](../decisions.md). Acceptance: [acceptance-criteria.md](../acceptance-criteria.md).

## Scope

| Source | P11 responsibility | Acceptance |
|---|---|---|
| FR-PRV-01, FR-LAY-05 | Painted, separate pages at page size, visible gaps, "1 / 3" | AC-P11-01 |
| FR-PRV-02, NFR-04, NFR-14, ADR-010 §6 | One PageModel to preview and PDF; ≥ 10 fixtures per template; parity and determinism in CI | AC-P11-02 |
| FR-PRV-03, FR-EDT-01, FR-LAY-10, NFR-01 | Live update within 300 ms p95, measured through the real editor | AC-P11-03 |
| FR-PRV-04 | Page counter in the Design tab's spacing card | AC-P11-04 |
| FR-PRV-05 | Fit to N pages | AC-P11-05 |
| FR-PRV-06 | Zoom: fit width, 75, 100, 125% | AC-P11-06 |
| FR-PRV-07, PG-09 | Overflow and lone-title hints | AC-P11-07 |
| FR-PRV-08, FR-EDT-03, FR-EDT-04 | Click and keyboard selection, page-accurate scroll | AC-P11-08 |
| §8 PG-01…PG-09, ADR-010 §10 | Pagination rules at page boundaries | AC-P11-09 |
| ADR-024, ADR-025, FR-TPL-03/04, FR-HDR-05/06, §7 | T2 chips and icons, T3 band and zones in the engine | AC-P11-10 |
| FR-LIB-01, FR-TPL-02, ADR-010 §9, T-ID-06, NFR-02 | First-page thumbnails, per-user cache, library load | AC-P11-11 |
| NFR-02, DD-P10-17, ADR-010 "Risk" | Lazy engine and fonts, `gzip` in the web image | AC-P11-12 |
| ADR-037 §4, DD-P08-07, NFR-13, ADR-038 | `POST /client-events` server, `reportClientEvents` for the 422 case and preview failures | AC-P11-13 |
| FR-LAY-09, DD-P10-11, P10 review delta | Hyphenation decided; E22 checks strings as typed | AC-P11-14 |
| NFR-06 | Keyboard, axe, 200%, 390 px on the preview | AC-P11-15 |
| §3.2, NFR-09, rule 03 | Nothing excluded, nothing off-origin, recoverable failure | AC-P11-16 |

**Out of scope, with the owning phase.** Export buttons, PDF metadata and tagging, measured spacing in the PDF, missing-glyph (Unicode) decisions, the mismatch event at export time (P12). The rendering job's first run on GitHub (P15): this phase cannot push, see DD-P11-15.

## Component boundaries

F-FE-2 layering, F-FE-3 engine purity. Types come only from the generated contract types.

**`entities/layout/`** (pure, no React, no DOM):
- `engine.ts`: T2 chips, T3 band and zones, `dates` overflow fix, regions, hints. New `headers.ts`/`chips.ts` only if `engine.ts` grows past readability.
- `paginate.ts`: placement extracted from `engine.ts`; zones paginate independently (T3) and share pages.
- `page-model.ts`: `Page.icons`, `Page.regions`; `PageModel.hints`.
- `icons.ts`: icon paths using only `M L C Z`, so PDFKit needs no trigonometry (ADR-010 §7).
- `fit.ts`: FR-PRV-05, pure over `layout`.
- `regions.ts`: `anchorAt(page, x, y)` for click-to-select.
- `version.ts`: `ENGINE_VERSION`, part of the thumbnail cache key and the event payload.
- `pdf.ts`: paints icons, photo over the band. Metadata stays P12's.

**`features/preview-paint/`**:
- `paint.ts`: shapes, then images, icons and text. Adds `data-role`.
- `runtime.ts`: the only value import of the engine, through `import()`. Loads faces per font family, registers them with `FontFace` from the same bytes the engine reads.
- `font-source.ts`: `import.meta.glob` URLs to bytes. Replaced in Vitest by disk reads in `src/test/setup.ts`.
- `use-page-model.ts`: one layout owner per mounted document, through `useDeferredValue` plus `useMemo`.
- `PageSheet.tsx`: one painted page at a given scale, repainted only when that page's JSON changes.

**`features/editor/`**: `PreviewPanel.tsx` (toolbar, pages, overlays, scroll, hints), `DesignPanel.tsx` (page counter, Fit to N, painted thumbnails), `Workspace.tsx` (owns the page model). **Removed:** `DraftSheet.tsx`, `DraftChips.tsx`, `draft.css`, `draft-chips.css`, `draft-sheet.test.tsx`, `rich-text/RichTextView.tsx` and its test, whose only consumer was the draft (DD-P11-02).

**`features/library/`**: `LibraryThumbnail.tsx`, lazy per visible card.

**`entities/resume/local-data.ts`**: thumbnail rows in their own IndexedDB database, per user, cleared by `removeLocalData`.

**`shared/api/client-events.ts`**: content-free report, deduplicated per page load, never throws.

**`backend/src/ResumeBuilder.Api/`**: `ClientEventEndpoints.cs`, HTTP only: session, CSRF, IP limit, size, media type, schema, one content-free log line. No storage. Nothing in Domain, Application or Infrastructure.

**`frontend/Dockerfile`**: `gzip` for scripts, styles and `font/ttf` (DD-P11-12).

## Key semantics

**One layout result.** `layout(document, fonts, { photo, engineVersion })` is the single pure function. The Workspace calls it once per deferred document; the preview, the page counter and later the export read that one object.

**Zones.** A cursor walks flows. T1 and T2 have one zone. T3 places the header on page 1 at `y = 0` and then runs two independent cursors from the band's bottom, main first, so a page's reading order is main then sidebar and a section never changes column by itself (FR-TPL-04).

**Oversized flows (PG-09).** A flow taller than a page is split by rows; a shape overlapping several rows is clipped into them, so a band or chip stays behind its text. Each split raises an `oversized` hint. Priority is ADR-010 §10, unchanged.

**Selection.** Each section gets one transparent hit region per page it occupies. The first is the `role="button"` tab stop carrying `data-section-id`; continuation regions are mouse-only and `aria-hidden`, so `[data-section-id]` still lists each section once, in order. A click resolves to an entry or list item through `anchorAt`. The header has its own region.

**Zoom.** 100% is true size: 1 pt = 96/72 CSS px. Fit width is the default and follows the panel through `ResizeObserver`. Scaling is a CSS transform, so zoom never re-lays out, and the line breaks cannot change with it.

## UI

```
┌ Preview ─────────────────────────────────────────┐
│ 3 pages      Zoom [ Fit width | 75% | 100% | 125% ]│
├──────────────────────────────────────────────────┤
│ ⚠ One item is longer than a page and was split.  │  only when a hint exists
│   ┌───────────────┐                              │
│   │  painted page │  white, soft shadow          │
│   └───────────────┘                              │
│         1 / 3                                    │  16 px gap, 12 px muted text
│   ┌───────────────┐                              │
```

Hover tints the section region, selection tints it and adds a 2 px accent inset line, so it is not colour alone. A hint is an amber dashed outline plus the text line above. Spacing card: `3 pages` sits under the sliders, followed by `Fit to [ 2 ▾ ] pages [ Fit ]`. Library cards keep the 112×158 page frame with the painted page inside; the placeholder stays until the page is ready and on any failure.

## Risks

| Risk | Handling |
|---|---|
| Vite does not bundle fontkit's browser build | First red build proves it; `esbuild` already bundled it in P10 |
| Layout blocks typing on long documents | `useDeferredValue` keeps input first; NFR-01 measured through the real field, also at 4× CPU throttle |
| Painted text is exposed line by line to a screen reader | Pages are labelled groups, text stays readable, sections are buttons; the forms remain the editing path (DD-P11-05) |
| Retargeting draft tests hides a weakening | DD-P11-02 lists every file, the mapping is in the test plan, and the external review is told to check it |
| A thumbnail cache keeps text of a deleted resume on the device | Pruned on a complete library list, on a 404, and by "remove local data" and account deletion |
| Client events become a free-text channel | The schema allows none; the server logs only parsed enum, pattern and UUID values |
| Many thumbnails exhaust the API limit | At most 3 concurrent fetches, visible cards only, cached by version |

## Slices and test budget

| # | Slice | Tests |
|---|---|---|
| A | Engine: PG rules, zones, chips, band, icons, hints, regions, fit | Vitest ≤ 40 |
| B | Rendering: 12 fixtures × 3 templates, G1, G2, G5, G6, G7 | Reference plus 18 browser tests |
| C | Preview panel, zoom, counter, Fit, hints, selection | Vitest ≤ 25, plus retargeted P08/P10 tests |
| D | Thumbnails, cache, client events (frontend) | Vitest ≤ 15 |
| E | `POST /client-events` | xUnit ≤ 12 |
| F | Journeys, parity through the real route, accessibility, baselines | E2E ≤ 12 per browser, plus retargeted specs; benchmark outside the suite |
| G | Web image `gzip` | One shell check |

Step 7 extends the real-stack acceptance spec against the real API.

## Task list

1. Fixtures, rendering harness extension, engine tests. Red, then engine and PDF green.
2. Preview, Design and thumbnail tests, retargeted tests. Red, then UI green.
3. Backend and client-event tests. Red, then green.
4. Image check, E2E, baselines, benchmark. Full suite.
5. External review, acceptance, gate.

## Candidate Codex worker tasks (ADR-051 Amendment 3)

**None** (DD-P10-19). No task here is both self-contained and larger than P10's pilot, which was not cheaper. T2's engine rules share `engine.ts` and `paginate.ts` with T3, and the backend slice is under 100 lines.

## Allowed paths

- `frontend/src/**`
- `frontend/Dockerfile`
- `frontend/README.md`
- `backend/src/ResumeBuilder.Api/**`
- `backend/tests/ResumeBuilder.Api.Tests/**`
- `backend/tests/ResumeBuilder.Architecture.Tests/**` (the log guard only, DD-P11-18)
- `tests/rendering/**`
- `tests/fixtures/**`
- `tests/e2e/**`
- `scripts/ci/**`
- `CLAUDE.md`

`frontend/vite.config.ts` is **not** in scope: it carries an uncommitted owner edit and this phase does not need to change it.
