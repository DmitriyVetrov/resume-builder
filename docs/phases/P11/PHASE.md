# P11 — Shared Layout & Preview Engine

## Objective
Pagination algorithm, page model, preview pages, zoom, live update, page counter, layout hints.

## Dependencies
P09, P10

## Carried in from P10
Recorded in `docs/phases/P10/qa-report.md` and `decisions.md`:
- **The engine exists and no route imports it** (DD-P10-01): `entities/layout`, `features/preview-paint`, gate harness in `tests/rendering/`. Wire it behind `PreviewPanel` and the thumbnails (DD-P10-02, DD-P10-03), lazy-loaded with fonts.
- **T2's chips and icons, T3's band and zones in the engine** (ADR-024). `DraftSheet` has them; the PageModel does not. E17 only proves their tokens reach it.
- **G3 and G4 on the reference CI runner**, and NFR-01 as a release target. P10 measured them on the development laptop (ADR-010 "Technology confirmation").
- **`gzip` for `font/ttf` and `text/javascript` in the web image** (DD-P10-17), decided against NFR-02.
- **Hyphenation** (DD-P10-11), if greedy output needs it. The `hyphen` package's licence is checked.
- **E22 strips spaces before checking coverage** (review delta, minor): check the strings as they are.
- **No Codex worker task unless the plan shows it costs less** (DD-P10-19). P10's pilot was accepted, and on an estimate was not cheaper.

## Carried in from P08
Deferred to this phase by P08's plan (`docs/phases/P08/qa-report.md`, "Deferred, by plan"):
- **The real preview behind `features/editor/PreviewPanel.tsx`** (DD-P08-01), which today renders an unpaginated "Draft view", with FR-EDT-01's NFR-01 clause and page-accurate FR-EDT-03.
- **`reportClientEvents` for the 422 case** (ADR-037 §4, DD-P08-07). The queue never shows "Saved" on a 422 and retries with a new key, but reports nothing yet.

## Carried in from P07
Deferred to this phase by P07's plan (`docs/phases/P07/qa-report.md`, "Deferred, by plan"), also recorded in `TRACEABILITY.md`:
- **The real first-page thumbnail on the library card** (FR-LIB-01, DD-P07-15). P07 ships a structural page placeholder with the template label because the layout engine is chosen at the P10 gate and built here; this phase replaces it, and the FR-LIB-01 clause closes only then.

## Source basis
Use relevant FR/NFR identifiers and exact sections from `docs/source/TECHNICAL-SPEC.md`; use `docs/source/README.md` only as reference-product evidence, not as target behavior where technical spec differs.

## Execution
Single operator session, ADR-051: one Claude session runs plan -> (contract) -> test plan -> red -> green -> external review (`codex review`) -> acceptance -> gate on branch `phase/<Pxx>`. See `docs/blueprint/AGENT-WORKFLOW.md`.

## Allowed paths
- `docs/phases/P11/`
- Phase-specific source folders explicitly listed in `architecture/phase-plan.md`.
No other paths without a `DELEGATED-DEFAULT` entry in `decisions.md` recording the extension.

## Required test strategy
Deterministic layout unit tests, ≥10 fixtures/template, extracted page text/linebreak parity, visual diff ≤1% target.

## Acceptance / Definition of Done
FR-PRV-01…08 and NFR-01/NFR-04 satisfied or exception approved; Preview/PDF share same layout result.

## Required artifacts
- `architecture/phase-plan.md` (plan, slices, test budget, task list)
- `decisions.md`
- `acceptance-criteria.md`
- `tests/test-plan.md`
- `tests/test-results.md`
- `review/code-review.md`
- `qa-report.md`
- `PHASE-STATUS.md`

## Stop conditions
The six conditions of ADR-051 §C only (the sixth added by Amendment 2: the external review's delta ceiling exhausted with a standing blocker, critical or major finding). Ambiguous requirements and open decisions do not stop the phase: decide them under delegation and record a `DELEGATED-DEFAULT` entry in `decisions.md`. A quota or context limit is a pause, not a stop: commit and resume. Do not auto-start the next phase.
