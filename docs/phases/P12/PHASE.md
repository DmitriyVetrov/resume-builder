# P12 — PDF & TXT Export

## Objective
One-click PDF, embedded fonts, selectable text, links, deterministic file name; TXT serializer per grammar.

## Dependencies
P11

## Carried in from P11
Recorded in `docs/phases/P11/qa-report.md` and `decisions.md`:
- **The layout result is ready for export.** `usePageModel` holds the one PageModel; `entities/layout/pdf.ts` is not in the barrel, so load it lazily and keep it out of the preview chunk. `writePdf` already draws T2's icons and chips and T3's band. `Run.parts` and `PageModel.hints` are for the preview only: the PDF writes whole runs and no hints.
- **Characters outside the font subset (emoji, CJK).** The browser may substitute a system font in the preview, while the PDF shows the missing glyph; line breaks stay the engine's. Part of this phase's Unicode decisions and the FR-TYP-03 check.
- **Client events.** `reportClientEvent` exists, and the server logs `export_mismatch` and `export_failed`. A new code must join `ClientEventLoggedCodes` in `backend/src/ResumeBuilder.Api/ClientEventEndpoints.cs`, or it logs as `other`. `page_count.differs` and `line_breaks.differs` are already listed.
- **A new `ENGINE_VERSION`** must join `ClientEventLoggedEngines` too.
- **`bash suite.cmd` runs past a failure without `set -euo pipefail`** at its top: P11's first full run hid two failures that way. The gate is not affected.

## Carried in from P10
- **`entities/layout/pdf.ts` and `txt.ts` exist and pass the ADR-010 gate.** Metadata, tagging, Unicode decisions and export UX are this phase's. Keep DD-P10-15: each PDF registers the font file, never the FontBook's parsed font, or a later export loses letters from its ToUnicode map.
- **FR-LAY-02 and FR-LAY-03 measured in the PDF within ±0.5 pt** (AC-P10-08 left this here).

## Carried in from P08
Deferred to this phase by P08's plan (`docs/phases/P08/qa-report.md`, "Deferred, by plan"):
- **Export PDF and Export TXT behind the top bar's disabled buttons** (FR-EDT-06, DD-P08-02), and the **FR-TYP-03 export check** with its explanation of what is missing.

## Carried in from P07
Deferred to this phase by P07's plan (`docs/phases/P07/qa-report.md`, "Deferred, by plan"), also recorded in `TRACEABILITY.md`:
- **Export from the library list** (FR-LIB-06) — the list action, on top of this phase's PDF and TXT export.

## Source basis
Use relevant FR/NFR identifiers and exact sections from `docs/source/TECHNICAL-SPEC.md`; use `docs/source/README.md` only as reference-product evidence, not as target behavior where technical spec differs.

## Execution
Single operator session, ADR-051: one Claude session runs plan -> (contract) -> test plan -> red -> green -> external review (`codex review`) -> acceptance -> gate on branch `phase/<Pxx>`. See `docs/blueprint/AGENT-WORKFLOW.md`.

## Allowed paths
- `docs/phases/P12/`
- Phase-specific source folders explicitly listed in `architecture/phase-plan.md`.
No other paths without a `DELEGATED-DEFAULT` entry in `decisions.md` recording the extension.

## Required test strategy
PDF metadata/font/link/page/text tests, Unicode tests, TXT golden files, p95 performance.

## Acceptance / Definition of Done
FR-PDF and FR-TXT acceptance passes; no wizard, no DOCX, no accidental email/share.

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
