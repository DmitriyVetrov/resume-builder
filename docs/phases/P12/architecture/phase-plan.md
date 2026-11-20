# P12 Architecture Plan — PDF & TXT Export

- Operator session, ADR-051, branch `phase/P12`, 2026-11-06. AGENT-WORKFLOW sets Claude Opus, effort `high`, for this phase.
- Dependency: P11 is `COMPLETED`.
- Contract: `contracts/openapi/openapi.yaml` 1.0.0, frozen by P02. **No contract change** (step 2 skipped). ADR-010 places PDF and TXT in the browser. `createSnapshot` and `reportClientEvents` already exist.
- ADRs: no new ADR. ADR-010 gets a "P12 refinements" section at step 5. No `OPEN` or `SOURCE-OPEN` register row touches this phase.
- Decisions: [decisions.md](../decisions.md). Acceptance: [acceptance-criteria.md](../acceptance-criteria.md).

## Scope

| Source | P12 responsibility | Acceptance |
|---|---|---|
| FR-PDF-01, FR-EDT-06, D8, D17 | One click on the top bar downloads a PDF, with no modal | AC-P12-01 |
| FR-PDF-02, NFR-07, G5 | Embedded subsets; typed characters on copy, in Spanish, Ukrainian and Slovak | AC-P12-02 |
| FR-PDF-03, FR-HDR-04, FR-RTE-03, ADR-010 | Link annotations over the text; unsafe schemes never reach them | AC-P12-03 |
| FR-PDF-04, FR-LAY-02, FR-LAY-03, §8 | Page size and margins; spacing measured in the PDF within ±0.5 pt | AC-P12-04 |
| FR-PDF-05 | Title, Author, Creator, Language | AC-P12-05 |
| FR-PDF-06, FR-TXT-01, D15 | Sanitized file names | AC-P12-06 |
| FR-PDF-07 | The rendition embedded as is, at ≥ 200 dpi, JPEG quality ≥ 85 | AC-P12-07 |
| FR-PDF-08 (Should) | Tagged PDF: headings, lists, reading order | AC-P12-08 |
| FR-PDF-09, FR-PDF-10, NFR-03 | ≤ 1 MB; PDF p95 ≤ 5 s and TXT ≤ 1 s, through the real route | AC-P12-09 |
| FR-TXT-01…04, FR-TXT-07, §9, D1, D2, D14 | §9 grammar, golden files, no section lost | AC-P12-10 |
| FR-TXT-05, FR-TXT-06 (Should) | CRLF option; copy as text | AC-P12-11 |
| FR-TYP-03, D-01, ADR-013 | Export explains what is missing: a full name, a verified address | AC-P12-12 |
| FR-LIB-06 (Should), P07 carry-in | Export from the list, same bytes as from the editor | AC-P12-13 |
| FR-PRV-02, NFR-04, NFR-14, ADR-010 §3 and §7 | The real route's bytes equal Node's in three browsers | AC-P12-14 |
| NFR-13, ADR-010 §8 | Mismatch and failure events, content-free | AC-P12-15 |
| FR-PER-05 (Should) | A `before_export` snapshot on each export | AC-P12-16 |
| NFR-07, P11 carry-in | Characters outside the font: typed text kept on copy, the user told | AC-P12-17 |
| NFR-05, NFR-06, FR-EDT-07 | Keyboard, axe, three browsers, 390 px | AC-P12-18 |
| §3.2 X7, X9, ADR-010 §5 | No wizard, DOCX, e-mail, share, or export endpoint; PDFKit out of the preview chunk | AC-P12-19 |

**Out of scope, with the owning phase.** The data archive with PDFs and TXTs (FR-ACC-04: P13). G3, G4 and NFR-03 on the reference CI runner (P15, DD-P11-15). A PDF/UA conformance claim (DD-P12-09).

## Component boundaries

F-FE-2 layering, F-FE-3 engine purity. Types come only from the generated contract types.

**`entities/layout/`** (pure, no React, no DOM):
- `page-model.ts`: `Line.block`, what a line belongs to in the document, for the PDF's tags only.
- `engine.ts`: fills `Line.block`; positions and line breaks do not change.
- `pdf-structure.ts` (new): `planStructure(model, document)`, the tag tree in document order. Pure, tested without PDFKit.
- `pdf.ts`: tagged, metadata per FR-PDF-05, `ActualText` where the font has no glyph.
- `missing.ts` (new): `missingCharacters(model, fonts)`.
- `txt.ts`: the §9 corrections of DD-P12-13 and the `crlf` option.
- `compose.ts`: the PT Serif coverage fallback of DD-P12-22, added after the external review.

**`entities/resume/`**: `export-name.ts` (new), the FR-PDF-06 rule. `local-data.ts`: the per-user line-ending preference, cleared with the rest of the local data.

**`features/preview-paint/runtime.ts`**: stays the only value import of the engine. Adds `writePdf`, lazily importing `entities/layout/pdf`, plus `missing` and `loadTextSerializer`.

**`features/export/`** (new):
- `export.ts`: `exportPdf`, `exportTxt`, `copyText`. One path for the editor and the library. Reports failures.
- `download.ts`: Blob plus anchor, no BOM.
- `gate.ts`: `useExportGate`, what is missing (FR-TYP-03, ADR-013).
- `ExportActions.tsx`: the top bar's buttons, reason line, status line and "Text options".

**`features/editor/`**: `Workspace.tsx` (renders `ExportActions`, replaces the disabled buttons), `session.ts` (knows `updatedAt`, offers `snapshotBeforeExport`), `api.ts` (`createSnapshot`, `updatedAt` on a write).

**`features/library/Library.tsx`**: Export PDF and Export TXT on each active card.

**`backend/src/ResumeBuilder.Api/ClientEventEndpoints.cs`**: new codes join `ClientEventLoggedCodes`. Nothing else changes on the server.

## Key semantics

**One click.** Check the gate, flush the autosave debounce, fire the snapshot, lay out the current local document, compare with the preview, fetch the photo if the model places one, write, download. No modal, and no wait on the network except for the photo.

**Which bytes.** ADR-010 §7 fixes the dates to `updatedAt`. The session keeps the `updatedAt` of the last acknowledged write, so a saved document gives the same bytes from the editor and the library, and two clicks on the same content give the same bytes while offline too (DD-P12-02).

**Tag tree.** `Document` → header (`H1`, `P`, `Figure`) → one `Sect` per visible section in document order → `H2`, `P`, `L`/`LI`/`LBody`, and for entries a nested `Sect` with `H3`. Shapes and icons are `Artifact`. The tree holds document order; the content stream keeps painting order (DD-P12-09, DD-P12-10).

**Missing glyphs.** The PDF prints the font's empty box at the model's position. Its marked content carries the typed text as `ActualText`, so copy and search still return it, and the status line names the characters (DD-P12-07).

## UI

```
┌ top bar ─────────────────────────────────────────────────────────────────┐
│ Title  ● Saved     Undo Redo Version history [Export PDF] [Export TXT]   │
│                                               Text options ▾             │
├──────────────────────────────────────────────────────────────────────────┤
│ Add your full name to export. [Edit header]            only when blocked │
│ Verify your e-mail address to export. Resend verification                │
│ Exported SWE-Dmytro-Vietrov.pdf.                       status, polite    │
└──────────────────────────────────────────────────────────────────────────┘
```

Blocked buttons stay focusable with `aria-disabled` and point to the visible reason through `aria-describedby`. "Text options" is a native `<details>` with the line-ending checkbox and "Copy as text". Library cards gain "Export PDF" and "Export TXT", which wrap at 390 px as the card's other actions do.

## Risks

| Risk | Handling |
|---|---|
| Vite bundles PDFKit differently from the rendering bundle, so the shipped bytes differ from the tested ones | E2E compares the downloaded bytes with Node's in three browsers (AC-P12-14) |
| Tagging disturbs determinism or G1 extraction | G1, G6 and G7 stay on the whole `CASES` matrix |
| PDFKit's chunk slips into the preview | E2E: no `pdf-*` chunk request before the first click |
| A wrong TXT golden is committed because it was generated | `reference-cv` is §9.4 copied from the spec, not generated. Other goldens are read at creation and pinned as regressions |
| A silent PDF with a hole instead of the photo | A failed photo fails the export and says so (DD-P12-12) |
| An export changes or leaks content | The only requests are the snapshot and the photo; a test asserts the request list and that the version does not change |

## Slices and test budget

| # | Slice | Tests |
|---|---|---|
| A | File name, TXT corrections, goldens | Vitest ≤ 20 |
| B | Tag plan, metadata, missing glyphs | Vitest ≤ 12; poppler checks in `export-checks.mjs` |
| C | Export path, gate, top bar, library | Vitest ≤ 25, plus W01 retargeted (DD-P12-19) |
| D | Client event codes | xUnit: 1 theory |
| E | Journeys, real-route bytes, accessibility | E2E ≤ 10 per browser; NFR-03 benchmark outside the suite |

Step 7 adds `real-stack/export-acceptance.spec.ts` against the real API.

## Task list

1. Fixtures, goldens and tests for slices A and B. Red. Then TXT, file name, tag plan and writer. Green.
2. Tests for slices C and D, then E2E. Red. Then export path and UI. Green.
3. Benchmark, full suite, ADR-010 refinements.
4. External review, acceptance, gate.

## Candidate Codex worker tasks (ADR-051 Amendment 3)

**None** (DD-P10-19). The writer, tag plan and export path share one small design, and the remaining pieces are smaller than writing a task brief for them.

## Allowed paths

- `frontend/src/**`
- `frontend/README.md`
- `backend/src/ResumeBuilder.Api/**`
- `backend/tests/ResumeBuilder.Api.Tests/**`
- `tests/rendering/**`
- `tests/fixtures/**`
- `tests/e2e/**`
- `scripts/ci/rendering.sh`
- `docs/blueprint/decisions/ADR-010-shared-layout-engine-and-rendering.md`

`frontend/vite.config.ts` is **not** in scope: it carries an uncommitted owner edit, and this phase must not need to change it.
