# P10 Architecture Plan — Templates & Design Controls

- Operator session, ADR-051, branch `phase/P10`, 2026-11-05. Tier: Claude Opus, effort `high` (AGENT-WORKFLOW "Model and effort").
- Dependencies: P08 and P09 are `COMPLETED`.
- Contract: `contracts/openapi/openapi.yaml` 1.0.0, frozen by P02. **No contract change** (step 2 skipped): `templateId`, `accentPreset`, `language`, `dateFormat`, `LayoutSettings`, `listColumns` and `placement` already exist. Backend: no production change.
- UI: [ui-ux-design.md](ui-ux-design.md). Decisions: [decisions.md](../decisions.md). Acceptance: [acceptance-criteria.md](../acceptance-criteria.md).
- ADRs accepted in this step: [ADR-024](../../../blueprint/decisions/ADR-024-t2-t3-template-design.md) (D-12, also closes ADR-011), [ADR-026](../../../blueprint/decisions/ADR-026-t1-accent-colors.md) (D-14), [ADR-027](../../../blueprint/decisions/ADR-027-font-preset-scaling.md) (D-15, SC-06), [ADR-028](../../../blueprint/decisions/ADR-028-line-spacing.md) (D-16, SC-03), [ADR-030](../../../blueprint/decisions/ADR-030-link-styling.md) (D-18), [ADR-031](../../../blueprint/decisions/ADR-031-education-entry-layout.md) (D-19). ADR-010 gets its "Technology confirmation" amendment when the prototype gate has run (step 5).

## Scope

| Source | P10 responsibility | Acceptance |
|---|---|---|
| ADR-010 §6, ADR-041 | The rendering prototype gate G1–G7, with PDF text extraction and raster diff tooling confirmed | AC-P10-01 |
| FR-TPL-01, 05, D-12 | Three data-only template definitions | AC-P10-02 |
| FR-TPL-02, FR-EDT-05 | Design tab, template picker with three thumbnails of the user's own content | AC-P10-03 |
| FR-TPL-03, 04 | Switch keeps everything; no template moves a section | AC-P10-04 |
| D-13, ADR-025 | T3 placement: type defaults, per-section override in the Design tab | AC-P10-05 |
| FR-CLR-01…04, D-14 | Three swatches per template, contrast, colour roles only, no free picker | AC-P10-06 |
| FR-LAY-01…06, D-15, D-16, SC-03, SC-04, SC-06, §5.10 slider UX | Controls and the numeric rules behind them | AC-P10-07, 08, 09 |
| FR-LAY-07 | Reset design, with undo | AC-P10-10 |
| FR-LAY-08, NFR-07, NFR-14 | Three bundled fonts per template, Latin Extended and Cyrillic coverage | AC-P10-11 |
| FR-LAY-09, §5.6 (carried in from P08) | `language` and `dateFormat` controls; month names and "Present" | AC-P10-12 |
| FR-LAY-10, FR-PER-04 | Applied to the preview at once, autosaved, undoable | AC-P10-13 |
| FR-SEC-11, SC-05 | List column defaults by section type and template | AC-P10-14 |
| FR-HDR-05, 06, §6.3, §7 | Icons in T2, photo rules per template | AC-P10-15 |
| §6.1–§6.9, D-18, D-19 | T1 tokens and rules, in the draft view and in the engine | AC-P10-16 |
| NFR-06 | Keyboard, axe, 200% zoom, 390 px | AC-P10-17 |
| §3.2, NFR-09 | Nothing excluded is built; fonts from our own origin | AC-P10-18 |
| Required test strategy | Visual regression of the three templates | AC-P10-19 |

**Out of scope, with the owning phase.** The real paginated preview behind `PreviewPanel` (P11, carried in, DD-P08-01): P10's preview stays the labelled draft view, made design-aware (DD-P10-02). Page counter FR-PRV-04, Fit to N pages FR-PRV-05, zoom, hints, ≥ 10 fixtures per template, NFR-01 as a release target, T2 and T3 rules in the engine (P11). Production PDF and TXT export, measured FR-LAY-02/03 in the PDF, Unicode decisions (P12). Hyphenation (P11; licence check recorded in DD-P10-11).

## Component boundaries

F-FE-2 layering, F-FE-3 engine purity. Types come only from the generated contract types.

**`entities/template/`** (pure data and pure functions): `types.ts`, `fonts.ts` (font catalogue), `t1.ts`, `t2.ts`, `t3.ts`, `index.ts` (registry and `resolveDesign(document, templateId?)`). `resolveDesign` is the single place where a document and a definition become numbers: scaled sizes (ADR-027), line heights (ADR-028), spacing, page geometry, continuation margin, accent, font faces, list columns and placement per section. Consumed by the draft view and by the engine, so the two cannot disagree on a token.

**`entities/resume/`**: `dates.ts` (FR-LAY-09, §5.6: pure, no `Intl`, shared by draft, engine, TXT), `design-operations.ts` (template switch, reset, and each setting as an immutable edit).

**`entities/layout/`** (the ADR-010 engine, promoted from the prototype; pure, no React, no DOM, F-FE-3):
- `fonts.ts` (fontkit faces from injected bytes), `shape.ts` (cached word shaping), `linebreak.ts` (UAX #14 plus a greedy fitter), `quantize.ts`, `page-model.ts` (types), `engine.ts` (`layout(document, design, fonts, photo, engineVersion) → PageModel`), `txt.ts` (§9), `pdf.ts` (PageModel to PDF), `hash.ts` (canonical serialisation).
- P10 implements the T1 rules the gate needs (§6) and basic pagination with PG-01, 02, 05, 06. T2 and T3 tokens flow through the same code; their rules (chips, band, zones) are P11's.
- Nothing in the application's route bundle imports the engine in P10. It runs in the rendering suite. P11 wires it into the preview, P12 into export.

**`features/preview-paint/`**: `paint.ts`, the DOM painter of ADR-010 §2, used by the gate. P11 owns its integration.

**`features/editor/`**: `DesignPanel.tsx` and `design/*` (controls), `DraftSheet.tsx` (extracted from `PreviewPanel`; used by the preview and by the thumbnails), `draft.css`. The Design tab body in `Workspace.tsx` changes; `session.apply` remains the only write path, so undo and autosave come with it.

**`frontend/src/assets/fonts/`**: subset TTFs with their licence files, one format for the browser and the engine (DD-P10-10). `frontend/scripts/build-fonts.py` records how they were made.

**`tests/rendering/`**: the gate harness (own `package.json`, esbuild bundle, pixelmatch), fixtures in `tests/fixtures/resumes/`. `tests/e2e/design.spec.ts` for the Design tab journey and visual baselines.

## Key semantics

**Template switch** changes `templateId` and nothing else. A stored `bodyFont` that the new template does not offer resolves to that template's default without being rewritten, so T1 → T2 → T1 restores it. T2's "no photo" hides the photo and leaves `showPhoto` alone. That is why FR-TPL-03 holds by construction, and a test proves it on the document, on the draft DOM and on the PageModel hash.

**Reset design** (FR-LAY-07): `fontPreset`, the three spacings, `pageSize`, `margins`, every `listColumns` and `accentPreset` go to the active template's defaults. `bodyFont`, `language`, `dateFormat` and `placement` are not in the FR's list and stay (DD-P10-06). One undo step.

**Sliders** coalesce per control through the existing history key, so a drag or held arrow is one undo step. Double-click resets to the active template's default as its own step.

**Draft view scaling.** Every document length in `draft.css` is `calc(var(--pt) * N)` with `--pt: calc(100cqw / <page width>)`, so one renderer serves the preview and the thumbnails at any width with no JavaScript measuring (DD-P10-03). Thumbnails carry no `data-section-id`, no focusable element and `aria-hidden`.

**Gate harness.** One esbuild bundle of the engine runs in Node and in all three browsers, so a byte difference can only come from the runtime. Node writes the reference PDF, poppler (`pdftotext -bbox-layout`, `pdffonts`, `pdfinfo -url`, `pdftoppm -r 100`) checks it, and pixelmatch compares its raster with Playwright screenshots.

## Risks

| Risk | Handling |
|---|---|
| PDFKit does not bundle for the browser, or its deflate differs between runtimes | Same bundle everywhere; `compress` configurable; fallback order in ADR-010 §6 (engine-owned code, then Typst) |
| fontkit or linebreak uses runtime Unicode data | G7 traces any divergence; `Intl`, `normalize`, `localeCompare` grepped in the bundle |
| G2 pixel diff is dominated by antialiasing | Threshold recorded with the result; a Firefox or WebKit miss switches the painter per ADR-010 §6 |
| G3 and G4 measured on this laptop, not the reference CI runner | Runner details and the limit recorded; the benchmark is a committed command CI can run |
| Draft view and engine diverge on a token | Both read `resolveDesign`; a test compares them on sizes and colours |
| P08 and P09 draft tests encode draft markup | `data-section-id`, labels and roles kept; any change to an existing test is a recorded exception, not a quiet edit |
| Repository growth from fonts | Subset to Latin, Latin Extended, Cyrillic, Greek and punctuation; size recorded |
| Baselines depend on the browser build | Chromium only, in the digest-pinned image |

## Slices and test budget

| # | Slice | Tests |
|---|---|---|
| A | Fonts, template definitions, `resolveDesign`, dates, design operations | Vitest ≤ 45 |
| B | Engine, TXT, PDF, painter, gate harness | Vitest ≤ 20; rendering suite G1, G2, G5, G6, G7, plus benchmarks G3, G4 |
| C | Draft view by template | Vitest ≤ 15 |
| D | Design tab controls | Vitest ≤ 25 |
| E | Journey, accessibility, visual baselines | E2E ≤ 10 scenarios per browser, 3 baselines in Chromium |

Step 7 adds a real-stack acceptance spec against the real API (`tests/e2e/real-stack/`), as in P08.

## Task list

1. Build fonts, add dependencies, record licences.
2. Red: definitions, resolve, dates, operations tests. Green.
3. Red: gate suite with engine stubs. Green: engine, TXT, PDF, painter. Record the gate, amend ADR-010.
4. Red: draft view and Design tab tests. Green. **Codex pilot here** (below).
5. Red: E2E. Green. Baselines.
6. Full suite, external review, acceptance, gate.

## Candidate Codex worker tasks (ADR-051 Amendment 3)

**The pilot runs here: `P10-CX-01`, T2 "Compact".** It is separable because ADR-024 fixes every T2 token and rule, T1 sets the pattern, and the shared controls, `resolveDesign` and the draft renderer are the operator's. Kind `implementation`: the operator commits the failing `t2` definition test and the failing T2 draft test (chips and icons), and Codex changes only `entities/template/t2.ts` and the T2 chip component and its stylesheet. Dispatched after T1, the shared draft renderer and the Design tab are green, inside step 5.

T3 is **not** a candidate in P10: its band and zones change the shape of the shared draft renderer, so the operator keeps it. No other worker tasks. If the pilot is `REJECTED` or `FAILED`, the operator does the task and records it in Part B.

## Allowed paths

- `frontend/src/**`
- `frontend/scripts/**`
- `frontend/package.json`
- `frontend/package-lock.json`
- `frontend/README.md`
- `tests/rendering/**`
- `tests/fixtures/**`
- `tests/e2e/**`
- `scripts/ci/**`
- `.github/workflows/**`
- `tests/infrastructure/**`
- `.gitignore`
- `CLAUDE.md`

`tests/infrastructure/**` and `.github/workflows/**` are listed only for adding the rendering job, if its checks require it (DD-P10-13). `frontend/vite.config.ts` is **not** in scope: it carries an uncommitted owner edit and P10 does not need to change it.
