# Governance Tasks — P00

These tasks fill the P00 governance deliverables. They run in **step 4** of the P00 role sequence
(`architecture/phase-plan.md` §4), after the Test Architect's plan and the Test Engineer's red checks exist. They are performed by
the Solution Architect acting as documentation implementer, in a separate invocation, because `docs/phases/**` is Architect-owned.

The content of GOV-01…GOV-05 is **intentionally not written yet** (TDD order: checks first, red; then content, green).

Common rules for every task:
- Formats: phase-plan §7.1 (conventions) plus the task's own section of phase-plan §7.
- Allowed files: only the task's target file. The implementer may additionally update the Status column below and **append** green evidence to `tests/test-results.md`.
- Forbidden: everything outside `docs/phases/P00/`. Within P00, do not change the tests, fixtures, `tests/test-plan.md` or `acceptance-criteria.md`. A check that seems wrong goes to the main session as a review request (CLAUDE.md Non-negotiable).
- Never decide a D-xx or OPEN, SOURCE-OPEN or PROPOSED item. Owners and deadlines are `PROPOSED` (PD-P00-04).
- Never copy personal contact data from `docs/source/` (AC-P00-23).
- Stop condition: if a check cannot pass without deciding an open item or changing a source, stop and report.

Status vocabulary: `NOT_STARTED`, `IN_PROGRESS`, `DONE`, `BLOCKED`.

| Task | Deliverable | Target file | Format | Inputs | Acceptance criteria | Depends on | Status |
|---|---|---|---|---|---|---|---|
| GOV-01 | Source inventory | `docs/phases/P00/governance/source-inventory.md` | phase-plan §7.2 | all files under `docs/source/`; TECHNICAL-SPEC header and requirement tables | AC-P00-01…06, 23 | Test Engineer red checks | DONE |
| GOV-02 | Requirement traceability matrix | `docs/phases/P00/governance/requirements-traceability.md` | phase-plan §7.3 | TECHNICAL-SPEC §2, §5, §6–§11; `docs/phases/P01…P15/PHASE.md`; `TRACEABILITY.md`; `TEST-STRATEGY.md` | AC-P00-01, 07…11, 23 | GOV-05 (for `deviation: SC-nn` references) | DONE |
| GOV-03 | Exclusion register | `docs/phases/P00/governance/exclusion-register.md` | phase-plan §7.4 | TECHNICAL-SPEC §3.2, W-priority rows, §13; `PROJECT-CHARTER.md` Explicitly excluded; PD-P00-05 | AC-P00-01, 12, 13, 23 | GOV-02 (W rows must match) | DONE |
| GOV-04 | Decision-owner register | `docs/phases/P00/governance/decision-owner-register.md` | phase-plan §7.5 | TECHNICAL-SPEC §12 and D-ID citations; `DECISION-REGISTER.md`; `decisions.md` §2; PHASE.md objectives; `ARCHITECTURE.md`; `TEST-STRATEGY.md` | AC-P00-01, 14…17, 23 | — | DONE |
| GOV-05 | Source-conflict log | `docs/phases/P00/governance/source-conflict-log.md` | phase-plan §7.6, seeds §7.7 | TECHNICAL-SPEC; `docs/source/README.md`; `docs/source/reference/README.md`; Blueprint docs | AC-P00-01, 05, 18, 19, 20, 23 | — | DONE |
| GOV-06 | Close-out | `docs/phases/P00/tests/test-results.md` (append), this file (Status column) | `.claude/rules/01-tdd-and-quality.md` item 5 | output of the P00 checks and `python3 scripts/check-blueprint.py` | AC-P00-21, 22 (evidence) | GOV-01…GOV-05 | DONE |

## Task details

### GOV-01 Source inventory
- List every file under `docs/source/` (90 at baseline) with Kind, Authority, Bytes, SHA-256, Cited by and Personal data. Compute sizes and hashes; do not type them by hand.
- Copy the Baseline values exactly from the spec header table. Write the census table by recomputing the counts from the spec.
- Notes: record observations such as the README's "75 screenshots" vs 82 on disk, and where the photo-flow reference stands (K-16).
- Done when: AC-P00-02…06 checks pass.

### GOV-02 Requirement traceability matrix
- One row per FR/NFR ID (116 at baseline). Choose Phases and Primary phase from the phase objectives and DoD in `docs/phases/Pxx/PHASE.md`, and Verification from the plan §7.1 vocabulary.
- List every decision a requirement depends on, at least the D-IDs in its spec row. Add further D-xx or ADR-xxx where the dependency is real (e.g. FR-PRV-02 → ADR-010).
- Fill the Pagination rules table (PG-01…PG-09) and the "Normative content without requirement IDs" table (§2, §5.6, §5.10, §6, §7, §9, §10).
- Any departure from a plan §7.3 anchor needs `deviation: SC-nn` plus a GOV-05 row explaining it.
- Done when: AC-P00-07…11 checks pass, and the reviewer agrees with the phase choices.

### GOV-03 Exclusion register
- Rows X1…X11 plus W rows (FR-RTE-07, FR-CLR-04). Each row gets status per PD-P00-05, guard phases, a concrete guard verification and the allowed boundary.
- Implied exclusions table: exclusions stated inside requirements (e.g. FR-RTE-08, FR-PDF-01, FR-EDT-08, §13 F42), keyed by the source requirement ID.
- Done when: the AC-P00-12 check passes and AC-P00-13 review has no open finding.

### GOV-04 Decision-owner register
- One row per decision item, covering the 52-ID required set exactly once (D rows carry their mirror ADRs in Linked IDs).
- Copy Status unchanged from the register. Prefix Source recommendation with `Recommendation only:`.
- Propose Decider, Preparer, Needed by (the earliest dependent phase), Deadline (within the plan §7.5 anchors; earlier where a prior phase depends on the answer, e.g. a schema-affecting answer before P02), Release blocker. Set Assignment = `PROPOSED`.
- Fill the "Unregistered decision candidates" table from `decisions.md` §2.3.
- Done when: AC-P00-14…17 checks pass.

### GOV-05 Source-conflict log
- One row per seed K-01…K-22 (phase-plan §7.7), each verified against the cited sections. Add any further conflicts found. Never adopt an answer; status per PD-P00-07.
- Set Blocks P00 = `yes` only where the owner must answer before the P00 gate (expected: K-12).
- Done when: AC-P00-05, 18, 19 checks pass. AC-P00-20 is a gate item and is expected to stay red until the owner answers Q-1.

### GOV-06 Close-out
- Run the P00 checks (command from `tests/test-plan.md`) and `python3 scripts/check-blueprint.py`. Append the exact commands, environment, exit codes and pass/fail counts to `tests/test-results.md`, including the expected red state of the AC-P00-20 gate check.
- Update the Status column above.
