# Code Review — P00 Project Governance & Source Baseline

| | |
|---|---|
| Reviewer role | Code Reviewer (independent), 2026-11-01 |
| Scope | Everything P00 produced: Architect artifacts, `tests/test-plan.md`, the stdlib check suite and fixtures under `docs/phases/P00/tests/`, GOV-01…GOV-05 under `docs/phases/P00/governance/`, `tests/test-results.md`, `coordinator-log.md` |
| Checklists used | `phase-code-review` skill; test-plan §12 (RV-TST, RV-JDG, RV-13, RV-16, RV-04, RV-24) |
| Sources read | `docs/source/TECHNICAL-SPEC.md`, `docs/source/README.md`, `docs/source/reference/README.md`, `docs/blueprint/{PROJECT-CHARTER,DECISION-REGISTER,TRACEABILITY,ARCHITECTURE,AGENT-WORKFLOW}.md`, `docs/phases/P01…P15/PHASE.md` (Objective, test strategy, DoD) |
| Verdict | **PASS** (no blocker, critical or major finding; 5 minor and 8 info findings, all non-blocking; owner gate items open as expected) |

## 1. Commands run by the reviewer (exact, from the repository root)

| # | Command | Exit | Result |
|---|---|---|---|
| 1 | `python3 -B -m unittest discover -s docs/phases/P00/tests -t docs/phases/P00/tests -p 'test_*.py' -v` | 0 | Ran 71, OK, 0 skipped. Prints the designed `reference counts: export=3, img=102, path=2, readme=12` and `NO_QUOTE: ADR-004,ADR-009,ADR-012,ADR-032,D-20` lines |
| 2 | `python3 -B -m unittest discover -s docs/phases/P00/tests -t docs/phases/P00/tests -p 'gate_*.py' -v` | 1 | Ran 2, failures 2 (expected GATE-RED): `GATE_OPEN_BLOCKER SC-12 K-12`; `OWNER_RECORD_MISSING`, `PHASE_STATUS_NOT_COMPLETED` |
| 3 | `python3 -B docs/phases/P00/tests/p00_cli.py --root .` | 0 | `SUMMARY checks=57 failed=0 findings=0` |
| 4 | `python3 -B docs/phases/P00/tests/p00_cli.py --root . --gate` | 1 | `SUMMARY checks=59 failed=2 findings=3` (only the three owner gate findings) |
| 5 | `python3 -B docs/phases/P00/tests/p00_cli.py --root docs/phases/P00/tests/fixtures/minimal-repo` | 0 | `SUMMARY checks=57 failed=0 findings=0` |
| 6 | same plus `--mutation NF-01` | 1 | `SUMMARY checks=57 failed=2 findings=2` (`MISSING_ID FR-AAA-02`, `W_NOT_GUARDED_IN_MATRIX FR-AAA-02`) |
| 7 | `python3 scripts/check-blueprint.py` | 0 | "Checked 220 required files, 9 agents", "Blueprint structure OK" |
| 8 | Determinism on the **real** repo: commands 1 and 4 under (`LC_ALL=C.UTF-8`, `PYTHONHASHSEED=0`) and (`LC_ALL=C`, `PYTHONHASHSEED=1`), timing normalised | 0 / 1 | Outputs identical in both environments (diff empty) |
| 9 | Reviewer mutation run `python3 -B -I rv_mutate.py <scratchpad>` on a scratchpad copy of `docs/`, `CLAUDE.md`, `scripts/` (repo never mutated) | 0 | 46/46 intended-failure mutations caught by the intended code; 5 gap probes (§2.2); copy restored and green afterwards |
| 10 | Scope: SHA-256 of all files vs `baseline.sha`, `baseline-pre-te.sha`, `baseline-pre-impl.sha`, `baseline-pre-review.sha` (session scratchpad) | — | See §4 |
| 11 | `find . -name __pycache__` | — | 0 directories |

## 2. Test integrity (RV-TST, AC-P00-22)

### 2.1 What was verified

- **No hard-coded oracle values.** `p00_checks.py`, `p00_sources.py`, `p00_md.py`, `p00_repo.py` contain no requirement, D, ADR, X, PG, K or SC ID literal and no census number. Every expected set is computed at run time from the spec (`Spec`), the register (`Register.required_set`, `mirrors`, `status_of`), `TRACEABILITY.md`, the PHASE.md anchors and the plan §7 formats. The remaining literals are format constants (vocabularies, deadline regex, guard tokens, forbidden statuses); the plan-derived ones are provenance-checked by TC-P00-S-02 (`FORMAT_CONSTANTS`, `p00_checks.py:1531`).
- **Every AC-P00-22 negative class has a mutation that fails the intended check.** The 13 bold classes of test-plan §8.3 (NF-01…NF-13a) map 1:1 to the 13 AC-22 classes (manual check). TC-P00-22-02 runs all 107 catalogue mutations (111 targets) and asserts the expected code. The valid fixture is clean in all 59 checks (TC-P00-22-01). Fixture plan formats equal the real plan formats (TC-P00-22-03), so the self-tests exercise the same rules as the real run.
- **Independent mutations on real data** (command 9), each producing the intended code with exit 1: missing, invented and duplicate ID; wrong priority; wrong section; invalid phase; primary not in phases; bad deadline grammar; deadline after anchor (ADR-033 moved to P04); deadline after Needed by; changed status (D-05); forbidden status; missing seed; removed seed token; SHA-256 and byte mismatch; placeholder token; synthetic e-mail and synthetic international phone number; missing decision dep (NFR-09/D-20); exclusion status (X9); missing exclusion row; anchor violation (FR-EDT-03 without P08); dropped mirror (D-12/ADR-011); row shape; OWNER-ACCEPTED without record; release blocker on D-20; uncovered normative §9; missing inventory row; summary over 120; missing recommendation prefix; W row without guard; bad citation; hierarchy status on a non-research row; unlogged unresolved spec reference; baseline version; census; K-12 Blocks flag; source drift in the spec (new FR row) and in the register (ADR-029 status).
- **No vacuous pass for the primary tables.** Emptying the Requirements, Files, Register, Log or Exclusions table, or renaming a required heading, fails (`MISSING_ID`, `INVENTORY_MISSING`, `MISSING_SEED`, `MISSING_HEADING`). A missing GOV file yields `MISSING_FILE` in every dependent check, including the gate check (TC-P00-20-03).
- **No skip / xfail**; TC-P00-22-06 enforces it statically (AST), and the gate module is excluded from the `test_*` pattern, so gate items are never counted as passes.
- **Stdlib only, offline, read-only**: verified by TC-P00-22-06/07 and by reading the imports; `subprocess` only in the two allowed test modules.
- **Implementer did not touch tests.** Every file under `docs/phases/P00/tests/` except `test-results.md` is byte-identical to the post-Test-Engineer snapshot (`after-te.sha`).

### 2.2 Gap probes (findings F-01, F-02)

| Probe | Result |
|---|---|
| SC-12 set to `RESOLVED-BY-OWNER` with Evidence `TECHNICAL-SPEC.md header` | Main suite stays green and TC-P00-20-01 passes; only TC-P00-25-01 still blocks (F-01) |
| Empty "Implied exclusions" table | All checks pass (F-02) |
| Empty "Unregistered decision candidates" table, or a candidate Deadline `soon` | All checks pass (F-02) |
| ADR row status changed; em dash in implied-exclusion Guard phases; non-owner Decider in an OPEN conflict row | Caught (`STATUS_CHANGED`, `INVALID_PHASE`, `BAD_DECIDER`) |

## 3. Judgement review (RV-JDG, RV-13, RV-16, RV-04)

### 3.1 GOV-02 phase and primary-phase choices

All 116 rows, 9 PG rows and 29 normative-content rows were read against the P01…P15 Objective/DoD. The flagged judgement calls are sound:

| Row | Choice | Assessment |
|---|---|---|
| FR-LIB-05 | Primary P08 (P07 listed) | Agree: the workspace exists only from P08. The P07 DoD literally says "FR-LIB … pass" (F-03) |
| FR-EDT-03 / FR-EDT-04 | Primary P11 | Agree: scroll-to-preview and click-in-preview need the P11 page model; FR-EDT-04 = FR-PRV-08 (SC-27) |
| FR-ACC-03 / FR-ACC-04 | Primary P13 (P06 listed) | Agree: photos, exports and the latest PDF/TXT exist only from P07/P12; P13 Objective names deletion and data export; SC-18 records the TRACEABILITY.md gap |
| FR-PER-05 | Primary P13 | Defensible (snapshots before export need P12; retention is P13), but no phase Objective owns the version-history restore UI (F-04) |
| FR-TYP-03 | Primary P12 | Agree: the export gate exists from P12 |
| Others spot-checked | FR-LAY-02…04 → P11, FR-SEC-11 → P10, FR-EDT-05 → P10, NFR-02 → P15, NFR-08/09/10/13 → P13, NFR-12 → P07 | Agree; each primary phase is in Phases and matches the owning Objective/DoD |

Decision deps were checked for every spec-tagged D-ID and for plausible extra ADR deps (ADR-009 photo/export storage, ADR-010 renderer, ADR-034 e-mail, ADR-033 CI). Summaries contain no personal data.

### 3.2 GOV-04 deadlines vs anchors and dependencies

- Every schema- or contract-affecting item is due **before the P01 gate** (earlier than its anchor): D-01, D-04, D-07…D-11, D-13, D-17, ADR-002, ADR-003, ADR-010 (layout location), ADR-033, ADR-034, plus the unregistered version-token and idempotency candidates. Items P01 itself depends on (D-02, D-03, D-20, ADR-004, ADR-007, ADR-009) are `before P01 implementation`.
- RV-16: the unquoted `P01/PHASE.md` DoD anchor matches the DoD text ("persistence provider, file storage, … EU hosting approach"); ADR-004, ADR-009 and D-20 are all `before P01 implementation`.
- Template details (D-12, D-14, D-15, D-16, D-18, D-19) are `before P10 implementation`; none changes the P02 schema (T3 placement is D-13, due at the P01 gate). D-05 and D-06 are `before P07 implementation` (I-06).
- Statuses are copied unchanged (TC-P00-17-01 plus my own comparison of `decisions.md` §2.1/§2.2 with the register: 0 mismatches). Only D-20 is a release blocker, as the sources say.

### 3.3 GOV-03 exclusions (RV-13)

- (1) Every guard names a concrete check in a named phase (for example "contract review in P02: no DOCX media type or endpoint"; "component test in P10: the picker shows exactly three templates and no filter control").
- (2) The six required boundaries are correct: X1/FR-RTE-08, X3/FR-PRV-07 (plus FR-TYP-03), X4/D-07 (only the §5.6 "picker + typing" date picker is allowed; the D-07 recommendation is explicitly not adopted, SC-26), X6/FR-TPL-02, X7/FR-ACC-01–02, X11/§3.2 note.
- (3) Every PROJECT-CHARTER "Explicitly excluded" item maps to a row (GOV-03 Notes 2).
- (4) Implied exclusions include FR-RTE-08, FR-PDF-01, FR-EDT-08 and §13 F42.
- X4, X8, X9, X10 are `EXCLUDED-PENDING-DECISION` with D-07…D-10 and their mirror ADRs; D-07…D-10 stay SOURCE-OPEN.

### 3.4 GOV-05 conflicts

- Citations were spot-checked against the sources and are accurate: SC-03 arithmetic (12.5/13.5/17.5/29.5 vs 13/14/18/31) and SC-06 rounding values vs §6.2/§6.9; SC-04 (§6.1 "≈ 31 pt", FR-LAY-06 "per §6.3"); SC-13 (README §4.1 JPEG/PNG/GIF 4 MB); SC-14 (README §6.2 maxlength 50, F24, R13); SC-15 (README §14.1 R1, §14.2 R3); SC-22 (README §10 lists T1…T9); SC-23 (ARCHITECTURE §5 last paragraph); SC-28 (README §7.6 and §9.2: 612 × 791 / 791.04); SC-30 (AGENT-WORKFLOW Parallelism vs `P03/PHASE.md` Dependencies P01, P02).
- No Proposed handling adopts an answer. SC-06 names the 0.5 pt fit and explicitly does not adopt it. The interim rules in SC-11 (PD-P00-05), SC-24 (no sample content) and SC-25 (synthetic data until Q-5) are the strict or privacy-safe readings and are marked as pending the owner.
- RESOLVED rows: SC-13, SC-14, SC-15, SC-28 are spec-vs-research (`RESOLVED-BY-HIERARCHY`, owner confirms at the gate); SC-16 cites the owner's own index `reference/README.md`. No other row is resolved.

### 3.5 No silently decided items

- No D-xx, OPEN, SOURCE-OPEN or PROPOSED item is decided. `decisions.md` §3 says "None"; every GOV-04 Assignment is `PROPOSED`; PD-P00-01…13 are `PROPOSED`.
- Q-1…Q-5 are unanswered (`decisions.md` §4 holds no owner record).
- K-12/SC-12 is `OPEN` with Blocks P00 = `yes` and is the only P00-blocking row.
- No file was added to `docs/blueprint/decisions/` (only `README.md` exists, unchanged since `baseline.sha`).

### 3.6 Personal data (RV-04, AC-P00-23)

- TECHNICAL-SPEC.md, the reference CV and its renders `img/90…93` are `Personal data = yes`; `normative-reference` is used only for the CV and `img/90…93`, which §6 and App. A name as the T1 target. The 74 un-inspected screenshots are conservatively `yes` with a stated reason.
- My own scan of every file under `docs/phases/P00/` (all extensions) found no e-mail address, no international phone number and none of the owner's contact fragments from TECHNICAL-SPEC §9.4/§10.3 (e-mail local part, phone digits, LinkedIn handle). See I-05 for the owner name and legacy path.

## 4. Scope and out-of-scope proposals (RV-24, AC-P00-21, AC-P00-24)

- `docs/source/**`: all 90 files are byte-identical to `baseline.sha`.
- `docs/blueprint/**`: identical to `baseline.sha`.
- Changes since `baseline.sha` outside `docs/phases/P00/`: only `.claude/skills/**`, `.claude/settings.json`, `.claude/hooks/log-usage.py` and `CLAUDE.md`, which the owner confirmed as their own and external to P00 (coordinator log steps 4 and 7).
- Per role: Test Architect changed only `tests/test-plan.md`; Test Engineer changed only `docs/phases/P00/tests/**` (the coordinator log is the main session's); the implementer changed the five GOV files, appended `decisions.md` §5 and `test-results.md`, and changed only Status cells of `governance-tasks.md`. Nothing changed between `baseline-pre-review.sha` and the start of this review.
- OOS-01…OOS-06 are recorded in phase-plan §14 with rationale and "needs owner approval"; none of their targets changed. One needed Blueprint change found by GOV-05 is missing from §14 (F-05).

## 5. Findings

| ID | Severity | File:line | Finding and impact | Required action | Owner |
|---|---|---|---|---|---|
| F-01 | minor | `docs/phases/P00/tests/p00_checks.py:1366-1375` (TC-P00-18-05); rule in `architecture/phase-plan.md` §7.6 | `RESOLVED-BY-OWNER` is accepted with **any** resolvable citation to an owner-authored source file. Setting SC-12 (Blocks P00 = yes) to `RESOLVED-BY-OWNER` with Evidence `TECHNICAL-SPEC.md header` keeps the main suite green and makes the AC-P00-20 gate check (TC-P00-20-01) pass without an owner answer. Only TC-P00-25-01 still blocks, and it checks only that the tokens Q-1…Q-5 occur in §4. Not exploited today (SC-12 is OPEN) | Tighten the rule: a row with Blocks P00 = `yes` (or whose seed is marked blocking) may become `RESOLVED-BY-OWNER` only with Evidence `decisions.md §4` and the owner marker present; add a mutation for it. Until then, QA and the owner verify at the gate that the SC-12 evidence is `decisions.md §4` | Test Architect (rule), Test Engineer (check); QA at gate |
| F-02 | minor | `p00_checks.py:932-956` (TC-P00-12-05); no check for GOV-04 "Unregistered decision candidates" | The "Implied exclusions" and "Unregistered decision candidates" tables pass when empty, and candidate Preparer/Deadline cells are not validated (Deadline `soon` passes). Review covers it today: the four RV-13(4) rows and all nine candidate rows are present and well-formed | Optional hardening: require a non-empty table, the RV-13(4) sources in Implied exclusions, and the §7.1 Preparer/Deadline grammar in the candidates table. Otherwise record it as a known limitation in `test-plan.md` | Test Architect / Test Engineer |
| F-03 | minor | `governance/requirements-traceability.md:49`, `:36-38`, `:13-14`, Notes `:176` ff. | The primary phase moves away from the literal PHASE.md DoD for FR-LIB-05 (P07 DoD "FR-LIB … pass" → P08), FR-LAY-02…04 (P10 DoD "FR-TPL/CLR/LAY approved" → P11) and FR-ACC-03/04 (P06 DoD "deletion/export behavior verified" → P13). The choices are correct and Note 2 states the rule, and FR-LIB-06 and FR-ACC are in SC-18. But no list tells the P06, P07 and P10 gate owners which DoD clauses are deferred, so a later gate may fail on them or waive them silently | Append a GOV-02 Notes item that lists each deferral (requirement, DoD phase, demonstrating phase), or extend SC-18 to name FR-LIB-05 and FR-LAY-02…04 | Architect |
| F-04 | minor | `governance/requirements-traceability.md:65` (FR-PER-05) | No phase Objective names the version-history restore UI. Primary P13 is an operations/hardening phase, so the UI could fall between P08, P12 and P13 | Add a note in the style of the §5.6 date-format row ("no phase Objective names …; the P08 or P12 plan must own the restore UI") | Architect |
| F-05 | minor | `architecture/phase-plan.md:369-380` (§14) vs `governance/source-conflict-log.md:40` (SC-30) | SC-30 finds that `AGENT-WORKFLOW.md` Parallelism contradicts `P03/PHASE.md` Dependencies and `CLAUDE.md`. Whatever the owner answers, one of these Blueprint files needs a wording change, but §14 has no OOS row for it (RV-24 item 3) | Append an OOS-07 row (target `AGENT-WORKFLOW.md` or `P03/PHASE.md`, rationale SC-30, "needs owner approval"). Do not apply it | Architect |
| I-01 | info | `architecture/phase-plan.md:76`, `:313` | The plan says the RG TXT findings are T1…T7, but README §10 lists T1…T9. The implementer recorded this in the SC-22 Evidence | Correct it the next time the plan is edited; the checks are not affected | Architect |
| I-02 | info | `tests/test-results.md:33`, `:40` vs `:122`, `:130` | The red-state C-7c record (`failed=1 findings=1`) is a recording slip, not a test change. The test files are byte-identical to `after-te.sha`, the fixture run does not depend on the real GOV files, and the current output (2 findings, both correct for NF-01) is what the code produces. The green entry already documents this | No change to the append-only record. The Test Engineer may acknowledge it in a later appended entry | Test Engineer |
| I-03 | info | `tests/test-plan.md` §8.1, §6.4 (RR-1, RR-2; PD-P00-11, PD-P00-12) | Wording only. The §8.1 SC-03 example breaks the ordering rule, and §6.4 omits five finding codes. Checks and fixtures are already correct (NF-41/NF-42) | Update `test-plan.md` before the gate, or record the items as accepted documentation debt | Test Architect |
| I-04 | info | `decisions.md:94-100` | §5 after §4 is acceptable. The parser ends §4 at the next H2, so §5 can neither satisfy nor break the gate check. The owner record must go **inside §4** (above the §5 heading). If it is appended at the end of the file, TC-P00-25-01 stays red (fail-safe) | Main session inserts the `- Accepted by owner on …` record under §4 at `/close-phase` | Main session / Owner |
| I-05 | info | `dependencies.md` §3–§4; `governance/source-conflict-log.md:26` (SC-16); `architecture/phase-plan.md:307` | The owner's name and the legacy CV path (which contains a city name) appear in P00 files. AC-P00-05 needs the path. No contact data (e-mail, phone, profile handle) is copied | None | — |
| I-06 | info | `governance/decision-owner-register.md:16` (D-05) | D-05 (guided first run / sample resume) is due `before P07 implementation`. If the answer adds a sample-resume endpoint, it arrives after the P02 contract and relies on the P02 extension process. It also interacts with X2/X11 (SC-24) | Consider moving it into the P01-gate batch when the owner answers Q-1 | Owner (via Q-1) |
| I-07 | info | `tests/test_selftest_checks.py:76`; `tests/test_selftest_determinism.py:69` | The AC-22 class test matches classes to mutations by count, not by name. The subprocess determinism test runs on the fixture only. Both were verified manually (13/13 classes; real-repo determinism, command 8) | Optional hardening | Test Engineer |
| I-08 | info | `PHASE-STATUS.md` | Still `Status: NOT_STARTED` with all roles `unassigned`. The plan has the main session update it at close | Main session at `/close-phase` | Main session |

No blocker, critical or major finding.

## 6. Gate items (owner-dependent, expected open; not a FAIL)

- AC-P00-20 / GATE-20: SC-12 (K-12) stays OPEN until the owner answers **Q-1** (baseline 0.1 draft and phase-relative deadlines). Then SC-12 is updated with Evidence `decisions.md §4` (see F-01).
- AC-P00-25 / GATE-25: the owner record in `decisions.md` §4 with answers to Q-1…Q-5, acceptance or changes of the GOV-04 proposals and of PD-P00-03, PD-P00-04, PD-P00-05 (and PD-P00-11…13). `PHASE-STATUS.md` must read `COMPLETED` or `COMPLETED_WITH_APPROVED_EXCEPTIONS`.
- RV-HIER: the owner confirms SC-13, SC-14, SC-15, SC-28 (`RESOLVED-BY-HIERARCHY`) and the SC-16 relocation.
- Owner approval of the phase plan (Q-4) and the final approval of the test plan.
- OOS-01…OOS-06 (and OOS-07 per F-05) need the owner's approval. None is applied in P00.

## 7. Verdict

**PASS.** The checks derive every expected value from the sources, fail for the intended reason on fixture and real-data
mutations, are deterministic and cannot pass vacuously on the primary tables. The governance deliverables map all 116 FR/NFR
IDs, 9 PG rules, the normative content without IDs, all 13 exclusions and all 52 decision IDs. Every open item keeps its status
and has a proposed owner and a deadline that is at or before its anchor, and earlier where the P02 contract depends on the
answer. Nothing was decided silently, and the scope stayed inside `docs/phases/P00/**`. The minor findings F-01…F-05 are
follow-ups for the Architect, Test Architect and Test Engineer. They do not block QA. Next owner: **QA / Acceptance Agent**.

## Re-review (post owner answers), 2026-11-01

| | |
|---|---|
| Reviewer role | Code Reviewer (independent re-review, `/review-phase P00`), 2026-11-01 |
| Scope | The post-owner-answer state of `docs/phases/P00/`: `decisions.md` §4, GOV-04 Assignment cells, GOV-05 SC-12, `PHASE-STATUS.md`, `coordinator-log.md` step 13. Re-check of F-01…F-05 and I-01…I-08. Scope evidence for the whole phase |
| Checklists used | `phase-code-review` skill; test-plan §12 (RV-TST, RV-JDG, RV-04, RV-24); `PHASE-GATES.md` |
| Verdict | **PASS** (no blocker, critical or major finding; 3 new minor findings F-06…F-08, F-05 updated, 4 new info items I-09…I-12; the only remaining gate item is `PHASE_STATUS_NOT_COMPLETED`, which `/close-phase P00` resolves) |

### R.1 Commands run by the reviewer (exact, from the repository root)

| # | Command | Exit | Result |
|---|---|---|---|
| R1 | `python3 -B -m unittest discover -s docs/phases/P00/tests -t docs/phases/P00/tests -p 'test_*.py' -v` | 0 | Ran 71, OK, 0 skipped (same designed `reference counts` and `NO_QUOTE` lines as command 1) |
| R2 | `python3 -B -m unittest discover -s docs/phases/P00/tests -t docs/phases/P00/tests -p 'gate_*.py' -v` | 1 | Ran 2, failures 1. TC-P00-20-01 **passes**. TC-P00-25-01 fails with exactly one finding: `PHASE_STATUS_NOT_COMPLETED docs/phases/P00/PHASE-STATUS.md`. `OWNER_RECORD_MISSING` and `OWNER_RECORD_INCOMPLETE` are gone |
| R3 | `python3 -B docs/phases/P00/tests/p00_cli.py --root .` | 0 | `SUMMARY checks=57 failed=0 findings=0` |
| R4 | `python3 -B docs/phases/P00/tests/p00_cli.py --root . --gate` | 1 | `SUMMARY checks=59 failed=1 findings=1` (`TC-P00-25-01 PHASE_STATUS_NOT_COMPLETED`) |
| R5 | `python3 -B docs/phases/P00/tests/p00_cli.py --root docs/phases/P00/tests/fixtures/minimal-repo` | 0 | `SUMMARY checks=57 failed=0 findings=0` |
| R6 | `python3 scripts/check-blueprint.py` | 0 | "Checked 220 required files, 9 agents", "Blueprint structure OK" |
| R7 | Command R4 under (`LC_ALL=C`, `PYTHONHASHSEED=1`) and (`LC_ALL=C.UTF-8`, `PYTHONHASHSEED=0`), outputs diffed | 1 / 1 | Identical output |
| R8 | `sha256sum` of every repository file (excluding `.git/`) compared with the main-session snapshots `baseline.sha`, `baseline-pre-te.sha`, `after-te.sha`, `baseline-pre-impl.sha`, `after-qa-coord.sha` and `final.sha` (main-session scratchpad, read only) | — | See R.3 |
| R9 | Cell-level comparison of GOV-04, GOV-05, `decisions.md` and `PHASE-STATUS.md` with the reviewer copy taken at 02:50 (`rvcopy/`, main-session scratchpad) | — | See R.2 |
| R10 | Independent census: FR/NFR IDs in TECHNICAL-SPEC.md vs GOV-02 Requirements rows; PII regex scan over `docs/phases/P00/**/*.md` (fixtures excluded) | — | 116 = 116, no missing, extra or duplicate ID; no e-mail address or international phone number |
| R11 | `find . -name __pycache__` | — | 0 directories |

The re-run of command R1 after this section was appended is recorded in the handoff report to the main session, not here.

### R.2 Post-owner-answer state

- **Owner record.** `decisions.md:100-108` holds the `- Accepted by owner on 2026-11-01` marker inside §4 (above the §5 heading, as I-04 required). It names Q-1…Q-5, PD-P00-03, PD-P00-04 and PD-P00-05, so `OWNER_RECORD_INCOMPLETE` cannot fire. Compared with the 02:50 copy, `decisions.md` only gained lines 100-108; nothing else changed (append-only kept).
- **SC-12 RESOLVED-BY-OWNER.** `governance/source-conflict-log.md:22`. Only two cells differ from the 02:50 copy: Status `OPEN` → `RESOLVED-BY-OWNER` and Evidence → `decisions.md §4`. The Q-1 answer (`decisions.md:101`) covers both parts of the SC-12 question (0.1 draft as baseline; phase-relative deadlines). TC-P00-18-05 accepts it through the `decisions.md §4` + marker branch (`tests/p00_checks.py:1369-1370`), which is the legitimate path. The F-01 loophole was **not** used. No other GOV-05 row has Blocks P00 = `yes`, so AC-P00-20 is met.
- **GOV-04 OWNER-ACCEPTED.** `governance/decision-owner-register.md:12-41`. Reversing the substitution `OWNER-ACCEPTED` → `PROPOSED` reproduces the 02:50 copy byte for byte: only the 30 Assignment cells changed (20 D rows + 10 ADR rows). Status, Decider, Preparer, Needed by, Deadline and Release blocker are unchanged. No D-xx, OPEN, SOURCE-OPEN or PROPOSED item changed its source status. `docs/blueprint/decisions/` still holds only `README.md`.
- **No product or technology decision taken by P00.** The owner accepted owners, deadlines and process decisions. D-01…D-20 and the ADR statuses stay as in the register. Q-3 delegates who decides technical ADRs; it decides none of them (see F-07).
- **PHASE-STATUS.md.** `Status: IN_REVIEW` (a valid `PHASE-GATES.md` value). Roles are filled in, and the owner gate record and follow-ups match `decisions.md` §4 and coordinator-log step 13. The phase is not yet closable by the checks: TC-P00-25-01 requires `COMPLETED` or `COMPLETED_WITH_APPROVED_EXCEPTIONS`, which `/close-phase P00` sets.
- **Test integrity.** `tests/test-plan.md`, `acceptance-criteria.md` and `architecture/phase-plan.md` are byte-identical to `baseline-pre-te.sha`, so neither the plan nor the criteria changed after the red state. Every file under `docs/phases/P00/tests/` except `test-results.md` is byte-identical to `after-te.sha`. The gate became green through data (owner record, SC-12 row), not through any change to the test code. No skip, no xfail, no weakened assertion.
- **Traceability.** GOV-02 and GOV-03 are unchanged since the first review. All 116 FR/NFR IDs, X1…X11 and the two `W` IDs (FR-RTE-07, FR-CLR-04) are mapped (TC-P00-07/12 green; R10 independent census).
- **Contract.** `contracts/openapi/` holds only its pre-existing `README.md`. P00 created no API contract and no endpoint.
- **Security and privacy.** No secrets, no e-mail address or international phone number in any P00 file (R10, TC-P00-23-01/02 green). See I-12 for the effect of the Q-5 answer on later phases.
- **Accessibility, performance.** Not applicable to P00 (documentation and stdlib checks only).

### R.3 Scope (AC-P00-21, RV-24) and the limits of the evidence

- `after-qa-coord.sha` (02:58) → `final.sha` (09:10): exactly five changed paths, all under `docs/phases/P00/`: `coordinator-log.md`, `decisions.md`, `governance/decision-owner-register.md`, `governance/source-conflict-log.md`, `PHASE-STATUS.md`. `final.sha` → now (start of this re-review): no change.
- `baseline.sha` (pre-phase) → now, outside `docs/phases/P00/`: only `.claude/skills/**` (133 added, 11 changed), `.claude/settings.json`, `.claude/hooks/log-usage.py` and `CLAUDE.md`. The owner confirmed all of these as their own and external to P00 (coordinator-log steps 4 and 7). `baseline-pre-impl.sha` → now, outside `docs/phases/P00/`: no change.
- `docs/source/**`, `docs/blueprint/**`, `contracts/**`, `backend/**`, `frontend/**`, `tests/**`, `scripts/**`, `infrastructure/**`, `docker-compose.yml` and `README.md`: byte-identical to `baseline.sha`.
- **Limits.** The repository has no commits, so there is no `git diff`. The evidence is the main session's own SHA-256 snapshots plus mtimes. Those snapshots were written by the same session that coordinates the phase, so they show *what* changed between snapshots, not *who* changed it. The attribution of the `.claude/**` and `CLAUDE.md` changes to the owner rests only on the owner's statements recorded in the coordinator log. A change made and reverted between two snapshots would not be visible. I found no inconsistency between the snapshots, the mtimes and the coordinator log.

### R.4 Status of the earlier findings

| ID | Still accurate? | Current state |
|---|---|---|
| F-01 | Yes | The rule at `tests/p00_checks.py:1366-1375` is unchanged. It was not exploited: SC-12 uses Evidence `decisions.md §4` with the marker present. The weakness remains for any later edit of a Blocks P00 = `yes` row. Follow-up for the Test Architect and Test Engineer, as listed in `PHASE-STATUS.md` |
| F-02 | Yes | Code unchanged (byte-identical to `after-te.sha`). Known limitation, follow-up |
| F-03 | Yes | GOV-02 unchanged. The deferral list for the P06, P07 and P10 gate owners is still missing. It is not covered by any approved OOS. Follow-up for the Architect in P01 |
| F-04 | Yes | GOV-02 unchanged. The version-history restore UI still has no owning phase Objective. Follow-up |
| F-05 | Partly resolved; updated | The owner approved "OOS-07 (Blueprint wording for SC-30)" (`decisions.md:108`). But `architecture/phase-plan.md` §14 (`:369-380`) still has no OOS-07 row, and SC-30 (`governance/source-conflict-log.md:40`) is still `OPEN`. So the approved change has no written target, and its direction (edit `AGENT-WORKFLOW.md` Parallelism, or `P03/PHASE.md` and `CLAUDE.md`) depends on an answer the owner has not given. **Required:** at the start of P01, the Solution Architect writes the OOS-07 definition (target file, wording) and gets the SC-30 answer before applying it. Due before the P01 gate, as SC-30 says. Not P00-blocking |
| I-01, I-02, I-03, I-05, I-07 | Yes | Unchanged follow-ups (I-01 and I-03 are listed in `PHASE-STATUS.md`) |
| I-04 | Resolved | The record is inside §4, and the gate check reads it |
| I-06 | Closed by owner | The owner accepted the GOV-04 deadlines as proposed, including D-05 `before P07 implementation` |
| I-08 | Partly resolved | `IN_REVIEW`, with roles filled in. `COMPLETED` is set at `/close-phase P00` |

### R.5 New findings

| ID | Severity | File:line | Finding and impact | Required action | Owner |
|---|---|---|---|---|---|
| F-06 | minor | `governance/source-conflict-log.md:35` (SC-25); `governance/decision-owner-register.md:55` (Q-5 candidate row); `decisions.md:105` | `decisions.md` §4 says the Q-5 answer "also answers SC-25". But SC-25 is still `OPEN`, and its Proposed handling and the GOV-04 candidate row still say "synthetic data … until then". The answer's scope is also narrower than the conflict: Q-5 allows real reference-CV content in **rendering and TXT fixtures**, while SC-25 also names **P02 mock examples** and logs. A P01 or P02 agent that reads only GOV-05 will see an open question. One that reads only §4 may extend the permission to contract examples. Not P00-blocking (Blocks P00 = `no`) | In P01, set SC-25 to `RESOLVED-BY-OWNER` (Evidence `decisions.md §4`) with the scope written out: rendering and TXT fixtures may use real data; logs and telemetry never may (`.claude/rules/03-security-privacy.md`). Ask the owner whether P02 mock examples are included, and keep them synthetic until the owner says so. Update the GOV-04 candidate row | Solution Architect (P01); owner for the mock-example scope |
| F-07 | minor | `decisions.md:103` (Q-3); `governance/decision-owner-register.md:33-41` (Decider column); `docs/blueprint/AGENT-WORKFLOW.md:48`; `docs/blueprint/DECISION-REGISTER.md` Gate policy | The Q-3 delegation makes the Solution Architect Decider for technical ADRs. (1) The list is open-ended ("e.g. ADR-002, ADR-004, ADR-006…ADR-010, ADR-033, ADR-034"): ADR-003 (TypeScript and frontend configuration) is not named, and ADR-009 includes the storage **region**, which overlaps with D-20/ADR-012, which the owner keeps. (2) GOV-04 still says `Product owner` for these rows. This is acknowledged as a P01 follow-up (test-plan issue I-05), but until then the register and the owner record disagree. (3) `AGENT-WORKFLOW.md:48` says "Solution Architect drafts, owner accepts". That now contradicts the delegation, yet there is no SC or OOS row for it. (4) The Solution Architect would both draft and accept the same ADR, so no independent review step is defined for technical ADRs | In P01: write an exhaustive list of the delegated ADR IDs, and get the owner to confirm ADR-003 and the ADR-009 region aspect (region stays with the owner under D-20). Update the GOV-04 Decider column and the check format (I-05). Log the `AGENT-WORKFLOW.md` contradiction as a new SC row with an OOS proposal for owner approval. Define an independent review of delegated technical ADRs, for example by the Code Reviewer or with an owner notification, in `AGENT-WORKFLOW.md` | Solution Architect (P01); owner approval of the Blueprint wording |
| F-08 | minor | `tests/test-results.md` (last entry, written 02:44) | `test-results.md` has no entry for the post-owner-answer runs: the gate suite now gives failures 1 (only `PHASE_STATUS_NOT_COMPLETED`) instead of 2. `.claude/rules/01-tdd-and-quality.md` item 5 requires exact commands and exit codes in `test-results.md`. Today the evidence exists only in coordinator-log step 13 (with no exit codes) and in this re-review | Append a dated entry with commands R1–R6 and their exit codes. The Test Engineer or the main session appends it at `/close-phase P00`, before `PHASE-STATUS.md` is set to `COMPLETED`, and then re-runs the gate suite (it should be exit 0) | Main session / Test Engineer |
| I-09 | info | `decisions.md:96-98`; `decisions.md:17-26` (Status column); `governance/source-conflict-log.md:46-48` (Notes 2); `governance/source-conflict-log.md:21` (SC-11 Proposed handling); `PHASE-STATUS.md:16` | Text that predates the owner answers is still in place. The §4 lead paragraph says "No owner acceptance has been recorded", directly above the record. The PD-P00-01…10 Status cells still read `PROPOSED`, although §1 defines `ACCEPTED` as "owner acceptance recorded in section 4". GOV-05 Notes 2 and the SC-11 handling are still written in the future tense. `PHASE-STATUS.md:16` still says "Gate suite red only on owner items". This is consistent with the append-only rule, but a reader has to combine §1 with §4 | Optional cleanup in P01: add a one-line note under §1 and §4, or set the PD Status cells to `ACCEPTED` with a reference to §4 |
| I-10 | info | `governance/source-conflict-log.md:22` (SC-12 Evidence) | The previous Evidence text ("Spec header Version and Status cells; DECISION-REGISTER.md Gate policy") was overwritten, not kept. The Sources column still holds both citations, so no substance is lost. GOV-05 Notes 2 named the "documentation implementer" as the editor; the main session made the edit. PD-P00-04 lets the main session set `OWNER-ACCEPTED`, but it does not say who updates SC-12. The two-cell diff was verified (R9) | None required. Future owner-driven row changes can append to Evidence instead of replacing it |
| I-11 | info | `decisions.md:100`; `tests/p00_checks.py:1586-1606` | The owner record is the main session's transcription ("recorded by the main session from the owner's answers"). TC-P00-25-01 checks that the marker and tokens are present, not who wrote them. The only control on the record's accuracy is the owner's own confirmation at `/close-phase P00` | Before confirming `/close-phase P00`, the owner reads `decisions.md:100-108` and checks that it matches their answers, especially the exact Q-3 delegation scope (F-07) and the Q-5 scope (F-06) |
| I-12 | info | `decisions.md:105` (Q-5) | From P10–P12 on, the repository will contain the owner's real contact data in rendering and TXT fixtures (TECHNICAL-SPEC §9.4/§10.3). The owner consents, and P00 copies none of it (R10). Consequences: later PII scans like AC-P00-23 need an explicit allowlist for fixture paths; logs and telemetry must still never contain it; the data becomes exposed if the repository is ever shared or made public | Record in the P10–P12 test plans which fixture paths may hold real data, and keep the PII scan active everywhere else |

No blocker, critical or major finding.

### R.6 Gate items

- AC-P00-20 / TC-P00-20-01: **passes** (SC-12 `RESOLVED-BY-OWNER`, evidence `decisions.md §4`).
- AC-P00-25 / TC-P00-25-01: the owner record is complete. The one remaining finding, `PHASE_STATUS_NOT_COMPLETED`, is resolved by `/close-phase P00` (owner-run, with owner confirmation). After that, the gate suite is expected to exit 0. That run should be recorded (F-08).
- `qa-report.md` (02:58) was written before the owner answers. QA should re-confirm AC-P00-20 and AC-P00-25 against this state before the owner closes the gate.

### R.7 Verdict

**PASS.** The owner answers are recorded inside §4 in the form the gate check expects. SC-12 is resolved through the legitimate owner-evidence path, and the 30 GOV-04 assignments changed only in the Assignment cell. No source status, test, fixture, criterion or plan changed after the red state. All suites behave as expected: the main suite is green, and the gate suite is red only on `PHASE_STATUS_NOT_COMPLETED`. No file outside `docs/phases/P00/` was changed by P00, within the limits stated in R.3. The new minor findings F-06…F-08 and the updated F-05 are P01 or close-phase follow-ups. None of them blocks the gate. Next owner: **QA / Acceptance Agent** (re-confirm AC-P00-20/25), then the **owner** (`/close-phase P00`).
