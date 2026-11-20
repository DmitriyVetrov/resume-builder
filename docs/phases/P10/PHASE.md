# P10 — Templates & Design Controls

## Objective
T1 detailed; T2/T3 only after D-12; colors, font, size, spacing, margins, page size, section list columns.

## Dependencies
P08, P09

## Carried in from P08
Deferred to this phase by P08's plan (`docs/phases/P08/qa-report.md`, "Deferred, by plan"):
- **The Design tab controls** (FR-EDT-05, DD-P08-02). P08 ships the tab with one line saying the controls are not available yet, in `features/editor/Workspace.tsx`. Design edits go through `EditorSession.apply`, so they get undo and autosave (FR-PER-04).
- **`language` and `dateFormat` controls.** Both are in the document and have no UI yet.

## Codex worker pilot
ADR-051 Amendment 3 sets this phase as the pilot: T2 "Compact", after T1, its pattern, the shared controls and ADR-024 (D-12), if the plan finds it separable from design decisions. Otherwise the plan says so and the pilot moves. Step 1 records which.

## Source basis
Use relevant FR/NFR identifiers and exact sections from `docs/source/TECHNICAL-SPEC.md`; use `docs/source/README.md` only as reference-product evidence, not as target behavior where technical spec differs.

## Execution
Single operator session, ADR-051: one Claude session runs plan -> (contract) -> test plan -> red -> green -> external review (`codex review`) -> acceptance -> gate on branch `phase/<Pxx>`. See `docs/blueprint/AGENT-WORKFLOW.md`.

## Allowed paths
- `docs/phases/P10/`
- Phase-specific source folders explicitly listed in `architecture/phase-plan.md`.
No other paths without a `DELEGATED-DEFAULT` entry in `decisions.md` recording the extension.

## Required test strategy
Template fixture tests, control component tests, accessibility/contrast, visual regression.

## Acceptance / Definition of Done
FR-TPL/CLR/LAY approved; no content loss on template switch; template-specific defaults verified.

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
