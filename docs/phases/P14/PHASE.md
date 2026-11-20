# P14 — Cross-stack Integration & E2E

## Objective
Full user journeys, contract drift, browser matrix, responsive and regression.

## Dependencies
P06, P07, P08, P09, P10, P11, P12, P13

## Carried in from P08 and P09
Recorded as limits in `docs/phases/P08/qa-report.md` and `docs/phases/P09/qa-report.md`:
- **A manual screen-reader pass of the editor and rich text field** (NFR-06). Axe and keyboard checks ran; no assistive technology did.
- **The editor journeys against the real API in Firefox and WebKit.** `tests/e2e/real-stack/` ran in Chromium only; those browsers ran the same flows on the fixture API.

## Source basis
Use relevant FR/NFR identifiers and exact sections from `docs/source/TECHNICAL-SPEC.md`; use `docs/source/README.md` only as reference-product evidence, not as target behavior where technical spec differs.

## Execution
Single operator session, ADR-051: one Claude session runs plan -> (contract) -> test plan -> red -> green -> external review (`codex review`) -> acceptance -> gate on branch `phase/<Pxx>`. See `docs/blueprint/AGENT-WORKFLOW.md`.

## Allowed paths
- `docs/phases/P14/`
- Phase-specific source folders explicitly listed in `architecture/phase-plan.md`.
No other paths without a `DELEGATED-DEFAULT` entry in `decisions.md` recording the extension.

## Required test strategy
Playwright full flows, contract suite, rendering fixtures, cross-browser smoke, WCAG audit.

## Acceptance / Definition of Done
All Must requirements trace to passing test evidence; no open critical defects.

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
