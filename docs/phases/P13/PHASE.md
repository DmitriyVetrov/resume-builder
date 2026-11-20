# P13 — Reliability, Security & Data Lifecycle

## Objective
Backup/restore, retention, deletion, data export, queue recovery, observability, security hardening.

## Dependencies
P06, P07, P08, P12

## Carried in from P12
Recorded in `docs/phases/P12/qa-report.md` and `decisions.md`:
- **FR-ACC-04: PDFs and TXTs in the data archive** (ADR-010 §5). `features/export/export.ts` writes one file per click, with a snapshot. The archive needs the bytes without either: use `runtime.writePdf` (from `loadRuntime`) and `loadTextSerializer` in `features/preview-paint/runtime.ts`.
- **A new client event code or `ENGINE_VERSION`** joins `ClientEventLoggedCodes` or `ClientEventLoggedEngines` in `backend/src/ResumeBuilder.Api/ClientEventEndpoints.cs`, as in P11 and P12.

## Carried in from P10
- **Cold-start 403 on first sign-up** (`docs/phases/P10/qa-report.md`). On the first request after a server start, a new browser got 403 and "Your security check expired". Two concurrent `GET /session` calls appear to race on the antiforgery cookie; that diagnosis is unproven. It recovered on retry.

## Carried in from P07
Deferred to this phase by P07's plan (`docs/phases/P07/qa-report.md`, "Deferred, by plan"):
- **Hourly purge of expired trash, restore reconciliation and the restore drill** (ADR-016, ADR-039 §4, DD-P07-03). P07 built the dual-ledger deletion lifecycle and the manual purge path; the scheduled job and the drill belong here.

## Source basis
Use relevant FR/NFR identifiers and exact sections from `docs/source/TECHNICAL-SPEC.md`; use `docs/source/README.md` only as reference-product evidence, not as target behavior where technical spec differs.

## Execution
Single operator session, ADR-051: one Claude session runs plan -> (contract) -> test plan -> red -> green -> external review (`codex review`) -> acceptance -> gate on branch `phase/<Pxx>`. See `docs/blueprint/AGENT-WORKFLOW.md`.

## Allowed paths
- `docs/phases/P13/`
- Phase-specific source folders explicitly listed in `architecture/phase-plan.md`.
No other paths without a `DELEGATED-DEFAULT` entry in `decisions.md` recording the extension.

## Required test strategy
Restore drill, fault injection, authorization matrix, upload abuse tests, log PII scan, RPO checks.

## Acceptance / Definition of Done
NFR-08…NFR-14 operational requirements verified; EU residency proven.

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
