# P08 — Editor Workspace & Autosave

## Objective
Single-page workspace, section panel, inline editing, reorder/hide/delete/undo, autosave queue, stale-tab behavior.

## Dependencies
P07

## Carried in from P07
Deferred to this phase by P07's plan (`docs/phases/P07/qa-report.md`, "Deferred, by plan"); each needs an acceptance criterion in step 1:
- **Editor flows over the fifteen P07 operations, including the crop, upload and snapshot UI** (FR-PER, FR-PHO). P07 delivered the API and the library/trash UI only.
- **Client-side photo size check before upload.** P07's acceptance note records that a client sending a whole oversized body before reading the response can see a connection reset instead of the API's 413, because Kestrel closes after answering early (`qa-report.md` "Defects found in this pass", the closing note). The limits are already fixed by DD-P07-06: 1 MB, 5 MB and 6 MB at 1 048 576 bytes per MB. The upload UI checks the size first and reports it locally; the server-side 413 stays as the authority.

## Source basis
Use relevant FR/NFR identifiers and exact sections from `docs/source/TECHNICAL-SPEC.md`; use `docs/source/README.md` only as reference-product evidence, not as target behavior where technical spec differs.

## Execution
Single operator session, ADR-051: one Claude session runs plan -> (contract) -> test plan -> red -> green -> external review (`codex review`) -> acceptance -> gate on branch `phase/<Pxx>`. See `docs/blueprint/AGENT-WORKFLOW.md`.

## Allowed paths
- `docs/phases/P08/`
- Phase-specific source folders explicitly listed in `architecture/phase-plan.md`.
No other paths without a `DELEGATED-DEFAULT` entry in `decisions.md` recording the extension.

## Required test strategy
Component tests, state-machine tests, API integration, offline/retry/concurrency E2E, keyboard tests.

## Acceptance / Definition of Done
FR-EDT/FR-SEC/FR-PER core criteria pass; no acknowledged edit loss.

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
