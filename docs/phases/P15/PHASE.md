# P15 — Production Readiness & Release

## Objective
Deployment, monitoring/alerts, backups, runbooks, security review, performance and release checklist.

## Dependencies
P14

## Carried in from P13
Recorded in `docs/phases/P13/qa-report.md`, `decisions.md` and `architecture/threat-model-review.md`:
- **T-RE-01 security audit events** (DD-P13-30): user ID, action, timestamp, request ID and IP for login, password change, deletion request and data export, into the 30-day security log. P06 and P13 did not build them; `request_complete` carries trace ID, route, status and duration only.
- **Apply `docs/operations/runbook.md`**: the backup policy (§1), one production restore with `reconcile-restore` against a staging copy (§2), the alert rules for the pending-job and mail events (§4) and for login failure spikes (T-SP-02, DD-P13-29), Key Vault wrapping of the data-protection ring (§5), the residency checks (§6, DD-P13-24), the ingress CIDR in `ReverseProxy__TrustedNetworks__0` (§7), and the replica count behind the per-replica rate limits (§8, DD-P13-10).
- **Review follow-ups (minor):** keep the raw `account-data.json` bytes in the archive and assert byte equality in A01; reach the archive button with Tab in L02 and RS04 instead of `focus()` (`docs/phases/P13/review/code-review.md`).

## Carried in from P07
Deferred to this phase by P07's plan (`docs/phases/P07/qa-report.md`, "Deferred, by plan"):
- **The NFR-02 p95 target under load.** P07 measured locally on 200 resumes (API p95 9.6 ms, 50-card navigation worst 118 ms) and recorded those as local measurements, not as the target met.

## Carried in from P12
Recorded in `docs/phases/P12/qa-report.md`, for the owner's decision table unless noted:
- **NFR-03 on the reference CI runner** (DD-P12-16), with G3, G4 and NFR-01. Not for the table: run it. `bash scripts/ci/rendering.sh bench`.
- **Characters no bundled font has** (emoji, CJK, most of Latin Extended-B) export as boxes, keep their text on copy, and are named to the user (DD-P12-07). The preview may show a system glyph there.
- **A crop under 195 px gives under 200 dpi** (DD-P12-12, DD-P07-06): FR-PDF-07 is not reached for such a photo, because nothing upscales.
- **FR-PDF-08 is tagging without a PDF/UA validator** (DD-P12-09): no conformance claim.
- **Choices worth the owner's eye:** Title's ` — ` separator and Creator "Resumiser" (DD-P12-04), uppercase on copy in T1 and T3 (DD-P12-20), PT Serif's fallback to Roboto (DD-P12-22).

## Carried in from P11
Recorded in `docs/phases/P11/qa-report.md`:
- **G3, G4 and NFR-01 on the reference CI runner, and the rendering job's first run on GitHub** (DD-P11-15, DD-P10-16). They have run only on the development laptop, because no phase may push. The command is `bash scripts/ci/rendering.sh bench`.
- **For the owner's decision table:** the FR-LAY-09 hyphenation clause (a Should) is not delivered, by DD-P11-13, because an inserted hyphen breaks FR-PDF-02's copy and search.

## Source basis
Use relevant FR/NFR identifiers and exact sections from `docs/source/TECHNICAL-SPEC.md`; use `docs/source/README.md` only as reference-product evidence, not as target behavior where technical spec differs.

## Execution
Single operator session, ADR-051: one Claude session runs plan -> (contract) -> test plan -> red -> green -> external review (`codex review`) -> acceptance -> gate on branch `phase/<Pxx>`. See `docs/blueprint/AGENT-WORKFLOW.md`.

## Allowed paths
- `docs/phases/P15/`
- Phase-specific source folders explicitly listed in `architecture/phase-plan.md`.
No other paths without a `DELEGATED-DEFAULT` entry in `decisions.md` recording the extension.

## Required test strategy
CI/CD deployment rehearsal, load tests, restore/rollback drill, vulnerability scan, smoke tests.

## Acceptance / Definition of Done
Release checklist approved; NFR targets measured; rollback and incident procedures documented.

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
