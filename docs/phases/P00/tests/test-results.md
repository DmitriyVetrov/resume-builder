# Test Results

Entries are appended below. Each entry lists the exact commands, environment, exit codes and counts. Nothing is marked as passed unless it was run.

## 2026-11-01: Test Engineer, red state (tests written, GOV-01...GOV-05 not yet written)

### Environment

| Item | Value |
|---|---|
| Python | 3.13.5 (standard library only, offline) |
| OS | Linux 6.12.95+deb13-amd64 |
| LC_ALL | unset (`LANG=en_US.UTF-8`); DET-01 forces `LC_ALL=C.UTF-8` and `LC_ALL=C` |
| Working directory | repository root; every command uses `python3 -B`, so no `__pycache__` exists under `docs/phases/P00/tests/` (checked: 0 directories) |
| Files | 17 Python modules (3710 lines) in `docs/phases/P00/tests/`, 29 fixture files in `docs/phases/P00/tests/fixtures/` (28 under `minimal-repo/`, plus `fixtures/README.md`) |

### Commands, exit codes and counts

Unittest line = `Ran` / failures / errors / skipped. `errors=0` and `skipped=0` in every run (no skip construct exists, TC-P00-22-06).

| ID | Command | Exit | Ran | Failures | Errors | Skipped | Expected (plan 3, 10.1) |
|---|---|---|---|---|---|---|---|
| C-1 | `python3 -B -m unittest discover -s docs/phases/P00/tests -t docs/phases/P00/tests -p 'test_*.py' -v` | 1 | 71 | 45 | 0 | 0 | 1 (union of C-2, C-3, C-4) |
| C-2 | same with `-p 'test_selftest_*.py'` | 0 | 12 | 0 | 0 | 0 | 0 |
| C-3 | same with `-p 'test_sources_*.py'` | 0 | 11 | 0 | 0 | 0 | 0 |
| C-4 | same with `-p 'test_real_*.py'` | 1 | 48 | 45 | 0 | 0 | 1 |
| C-5 | same with `-p 'gate_*.py'` | 1 | 2 | 2 | 0 | 0 | 1 |
| C-5a | C-5 plus `-k TC_P00_20` | 1 | 1 | 1 | 0 | 0 | 1 |
| C-5b | C-5 plus `-k TC_P00_25` | 1 | 1 | 1 | 0 | 0 | 1 |
| C-7 | `python3 -B docs/phases/P00/tests/p00_cli.py --root .` | 1 | `SUMMARY checks=57 failed=45 findings=56` | | | | 1 |
| C-7a | C-7 plus `--gate` | 1 | `SUMMARY checks=59 failed=47 findings=59` | | | | 1 |
| C-7b | `python3 -B docs/phases/P00/tests/p00_cli.py --root docs/phases/P00/tests/fixtures/minimal-repo` | 0 | `SUMMARY checks=57 failed=0 findings=0` | | | | 0 |
| C-7c | C-7b plus `--mutation NF-01` | 1 | `SUMMARY checks=57 failed=1 findings=1` | | | | 1 |
| C-8 | `python3 scripts/check-blueprint.py` | 0 | "Checked 220 required files, 9 agents", "Blueprint structure OK" | | | | 0 |
| C-6 (spot check) | C-4 with `-k TC_P00_07` | 1 | 1 | 1 | 0 | 0 | 1 |
| DET-01 (unittest) | plan 9.3 procedure: C-1 under (`LC_ALL=C.UTF-8`, `PYTHONHASHSEED=0`) and (`LC_ALL=C`, `PYTHONHASHSEED=1`), timing line normalised | `diff_exit=0` | both runs: exit 1, Ran 71, failures 45 | | | | diff empty |
| DET-01 (CLI) | C-7 under the same two environments, no normalisation | `diff_exit=0` | both runs: exit 1 | | | | diff empty |
| DET-02 | SCOPE-01 snapshot (`find ... \| sort \| sha256sum`) immediately before and after DET-01 | `diff_exit=0` | snapshots identical | | | | identical |

Note on C-7c: `--mutation NF-01` on the fixture reports `TC-P00-07-01 MISSING_ID FR-AAA-02`. C-7 counts 57 checks (sources + real); C-7a adds the 2 gate checks.

### C-4 red state: which tests fail and with what

C-4 ran 48 tests: **45 failures**, 3 passes, 0 errors. All 56 findings in the failure messages have the code `MISSING_FILE`
(no other code). Each failing test names a path under `docs/phases/P00/governance/`. The 45 failing tests are exactly the "FAIL `MISSING_FILE`" TCs of test plan section 7:

TC-P00-01-02, 01-03, 02-01, 03-01, 04-01, 04-02, 04-03, 05-02, 06-01, 07-01, 08-01, 08-02, 08-03, 08-04, 09-01, 09-02, 10-01, 10-02, 10-03, 11-01, 11-02, 12-01, 12-02, 12-03, 12-04, 12-05, 14-01, 14-02, 15-01, 15-02, 15-03, 15-04, 15-05, 16-01, 17-01, 17-02, 18-01, 18-02, 18-03, 18-04, 18-05, 18-06, 19-01, 20-02, 23-01.

TC-P00-10-01...10-03 report two `MISSING_FILE` findings each (GOV-02 and GOV-05), TC-P00-01-02 and 01-03 report five each (one per GOV file).

The 3 passes are the expected regression guards: TC-P00-01-01 (Architect artifacts), TC-P00-21-01 (`check-blueprint` exit 0 and "Blueprint structure OK"), TC-P00-23-02 (no e-mail or phone pattern in any P00 Markdown).

C-3 (11 tests, all pass): TC-P00-S-01, S-02, 01-04, 04-04, 05-01, 10-04, 11-03, 14-03, 14-04, 16-02, 19-02. The run prints
`reference counts: export=3, img=102, path=2, readme=12` and `NO_QUOTE: ADR-004,ADR-009,ADR-012,ADR-032,D-20` (the `P01/PHASE.md` DoD anchor has no quote; it is covered by review item RV-16).

C-2 (12 tests, all pass): TC-P00-22-01 (valid fixture: zero findings in all 59 checks, gate checks included), TC-P00-22-02 (one subTest per target of 107 mutations, 111 targets: the 102 catalogue entries for the 101 NF rows of plan 8.3 plus the added NF-40...NF-44, see below; plus coverage of the plan's mutation table and the 13 AC-P00-22 classes), TC-P00-22-03, TC-P00-22-04...22-08, TC-P00-20-03, and one fixture-closure test.

### Gate items (plan 10.3): never counted as passes

| Gate TC | AC | Command | Exit | State | Findings | Clears when |
|---|---|---|---|---|---|---|
| TC-P00-20-01 | AC-P00-20 | C-5a | 1 | GATE-RED (expected) | `MISSING_FILE` (GOV-05 not written). After GOV-05 is written: `GATE_OPEN_BLOCKER SC-nn` (K-12) | Owner answers Q-1; answer recorded in `decisions.md` §4; GOV-05 row updated by the implementer |
| TC-P00-25-01 | AC-P00-25 | C-5b | 1 | GATE-RED (expected) | `OWNER_RECORD_MISSING`, `PHASE_STATUS_NOT_COMPLETED` | `/close-phase P00` records acceptance and status |

Summary line: main suite (C-1): 26 passed, 45 failed (expected red); self-tests and source oracles: 23 passed, 0 failed; gate: 2 GATE-RED (expected).
`OWNER_RECORD_INCOMPLETE` is reported only when the marker line exists, so it does not appear in this red state.

### Evidence that the checks can pass on real data (not a pass of any deliverable)

A throw-away script outside the repository generated in memory (no file written) plausible GOV-01...GOV-05 texts for the real sources
(116 requirements, 9 pagination rules, 11 exclusions + 2 W rows, 52 decision IDs, 22 seeds) and ran all 59 checks on the real repository with these overrides.
All 56 non-gate checks reported zero findings except `TC-P00-18-03 TOO_FEW_CITATIONS` for five generated rows (a limit of the throw-away generator, whose seeds with only ID tokens produced a single citation). Gate checks stayed red as expected.
This shows that the real-source oracles (section tokens, D-ID occurrence sections, citation resolution for README/ARCHITECTURE/TEST-STRATEGY, reference extractors, anchors) do not produce false positives. It is not evidence for the real deliverables, which do not exist yet.

### Mutations and deviations from the plan

- All 101 NF rows of plan 8.3 are implemented (NF-24 as NF-24a CRLF and NF-24b BOM). The test `test_TC_P00_22_02_catalogue_covers_every_plan_mutation` parses the plan's table and fails if one is missing or if an expected code or target TC of a row is not asserted.
- Added by the Test Engineer (no listed mutation weakened): NF-40 (markup in an ID cell, `FORMAT_MARKUP`), NF-41 (OPEN row with Needed by P00 and `before P00 gate` gives `DEADLINE_AFTER_NEEDED_BY`), NF-42 (boundary: Needed by P00 with `before P00 implementation` passes), NF-43 (em dash combined with other items, `LIST_FORMAT`), NF-44 (invented ID in an implied exclusion).
- Finding codes added to the section 6.4 list: `EMPTY_BODY` (TC-P00-01-01), `SPEC_SANITY`, `REGISTER_SANITY`, `NO_REFERENCES`, `SEED_FORMAT` (sources checks).
- TC-P00-S-02 (provenance of format constants) is implemented as `provenance_check` in `test_sources_oracles.py`; it is not part of the fixture runs because the fixture plan holds only the format lines.
- Fixture SC-03 uses Needed by `P01` with Deadline `before P00 gate`. The plan 8.1 text (Needed by `P00` with `before P00 gate`) violates the plan 7.1 item 7 ordering rule (m = n needs `implementation`), so TC-P00-22-01 could not pass with it. NF-41 and NF-42 document both sides. See escalation E-1 in the Test Engineer report.
- Plan 10.1 expects exit 1 for C-5 with `MISSING_FILE` for TC-P00-20-01; this is what the run shows.

### SCOPE-02 (Test Engineer step)

Pre-step baseline: `baseline-pre-te.sha` in the session scratchpad (sha256sum format, `./`-relative paths, `LC_ALL=C` sorted), compared with the plan 11 SCOPE-02 script (order-independent).

- Created under `./docs/phases/P00/tests/`: 17 Python modules, `fixtures/README.md` and 28 fixture files under `fixtures/minimal-repo/`. Changed: `tests/test-results.md` (the placeholder sentence replaced, this entry appended). No deletion, no `__pycache__`.
- `docs/source/**`, `docs/blueprint/**` and `docs/phases/P00/governance/**`: no difference from the baseline (no GOV file was created).
- **Three paths outside `docs/phases/P00/` also differ from the baseline: `./.claude/settings.json` (created), `./.claude/hooks/log-usage.py` (created) and `./CLAUDE.md` (changed).** Their modification times are 01:57, and the Test Engineer wrote none of them (it never opens these paths). `CLAUDE.md` now describes a token-usage hook that uses exactly these two `.claude` files, so the change looks like the owner's or the main session's own work. SCOPE-02 therefore exits 1 for the whole tree. For the Test Engineer's own changes it is clean: every path created or changed by this step is under `./docs/phases/P00/tests/`. The main session must decide how to treat the three external paths (same situation as the earlier `.claude/skills/**` anomaly in `coordinator-log.md`).

## 2026-11-01: Documentation implementer (Solution Architect), green state (GOV-06)

GOV-01…GOV-05 written under `docs/phases/P00/governance/`. Sizes and SHA-256 digests in GOV-01 were computed with `hashlib` by
throw-away generator scripts kept in the session scratchpad (outside the repository); no value was typed by hand. No test, fixture,
helper, `test-plan.md` or `acceptance-criteria.md` was changed.

### Environment

| Item | Value |
|---|---|
| Python | 3.13.5 (standard library only, offline) |
| OS | Linux 6.12.95+deb13-amd64 |
| LC_ALL | unset (`LANG=en_US.UTF-8`); DET-01 forces `LC_ALL=C.UTF-8` and `LC_ALL=C` |
| Working directory | repository root; every command uses `python3 -B`; `__pycache__` directories under `docs/phases/P00/`: 0 |
| Deliverables | GOV-01 90 file rows + 16 census rows + Total; GOV-02 116 requirement rows, 9 pagination rows, 29 normative-content rows; GOV-03 13 exclusion rows (X1…X11, FR-RTE-07, FR-CLR-04), 15 implied exclusions; GOV-04 30 register rows covering the 52 required IDs, 9 unregistered candidates; GOV-05 30 rows (SC-01…SC-22 for seeds K-01…K-22, SC-23…SC-30 new) |

### Commands, exit codes and counts

| ID | Command | Exit | Ran | Failures | Errors | Skipped | Expected (test-plan §3, §10.2) |
|---|---|---|---|---|---|---|---|
| C-1 | `python3 -B -m unittest discover -s docs/phases/P00/tests -t docs/phases/P00/tests -p 'test_*.py' -v` | 0 | 71 | 0 | 0 | 0 | 0 |
| C-2 | same with `-p 'test_selftest_*.py'` | 0 | 12 | 0 | 0 | 0 | 0 |
| C-3 | same with `-p 'test_sources_*.py'` | 0 | 11 | 0 | 0 | 0 | 0 |
| C-4 | same with `-p 'test_real_*.py'` | 0 | 48 | 0 | 0 | 0 | 0 |
| C-5 | same with `-p 'gate_*.py'` | 1 | 2 | 2 | 0 | 0 | 1 (gate, §10.3) |
| C-5a | C-5 plus `-k TC_P00_20` | 1 | 1 | 1 | 0 | 0 | 1 until Q-1 is answered and recorded |
| C-5b | C-5 plus `-k TC_P00_25` | 1 | 1 | 1 | 0 | 0 | 1 |
| C-7 | `python3 -B docs/phases/P00/tests/p00_cli.py --root .` | 0 | `SUMMARY checks=57 failed=0 findings=0` | | | | 0 |
| C-7a | C-7 plus `--gate` | 1 | `SUMMARY checks=59 failed=2 findings=3` | | | | 1 |
| C-7b | `python3 -B docs/phases/P00/tests/p00_cli.py --root docs/phases/P00/tests/fixtures/minimal-repo` | 0 | `SUMMARY checks=57 failed=0 findings=0` | | | | 0 |
| C-7c | C-7b plus `--mutation NF-01` | 1 | `SUMMARY checks=57 failed=2 findings=2` | | | | 1 (see note) |
| C-8 | `python3 scripts/check-blueprint.py` | 0 | "Checked 220 required files, 9 agents", "Blueprint structure OK" | | | | 0 |
| DET-01 (unittest) | test-plan §9.3: C-1 under (`LC_ALL=C.UTF-8`, `PYTHONHASHSEED=0`) and (`LC_ALL=C`, `PYTHONHASHSEED=1`), timing line normalised | `diff_exit=0` | both runs: exit 0, Ran 71, OK | | | | diff empty |
| DET-01 (CLI) | C-7 under the same two environments, no normalisation | `diff_exit=0` | both runs: exit 0 | | | | diff empty |
| DET-02 | SCOPE-01 snapshot immediately before and after DET-01 | `diff_exit=0` | snapshots identical | | | | identical |

C-3 prints `reference counts: export=3, img=102, path=2, readme=12` and `NO_QUOTE: ADR-004,ADR-009,ADR-012,ADR-032,D-20` (review item RV-16).

Note on C-7c: the run reports `TC-P00-07-01 MISSING_ID FR-AAA-02` and `TC-P00-12-04 W_NOT_GUARDED_IN_MATRIX FR-AAA-02`. NF-01 deletes
the fixture's W row FR-AAA-02, so both findings are correct. The red-state entry above recorded `failed=1 findings=1` for the same
command. No file under `docs/phases/P00/tests/` changed after the coordinator's step-6 re-run (modification-time check), so the
difference comes from the red-state record, not from this step. The expected exit code 1 holds.

### Gate items (test-plan §10.3): never counted as passes

| Gate TC | AC | Command | Exit | State | Findings | Clears when |
|---|---|---|---|---|---|---|
| TC-P00-20-01 | AC-P00-20 | C-5a | 1 | GATE-RED (expected) | `GATE_OPEN_BLOCKER SC-12` (K-12) | Owner answers Q-1; answer recorded in `decisions.md` §4; SC-12 updated by the documentation implementer |
| TC-P00-25-01 | AC-P00-25 | C-5b | 1 | GATE-RED (expected) | `OWNER_RECORD_MISSING`, `PHASE_STATUS_NOT_COMPLETED` | `/close-phase P00` records acceptance and status |

Summary line: main suite (C-1): 71 passed, 0 failed; self-tests and source oracles: 23 passed, 0 failed; gate: 2 GATE-RED (expected).
No other GOV-05 row has Blocks P00 = `yes`.

### Scope (SCOPE-02, SCOPE-03, SCOPE-04 for this step)

- SCOPE-02 against `baseline-pre-impl.sha` (coordinator snapshot after the Test Engineer step, session scratchpad), snapshot taken
  before this entry was appended: exit 0. Created: the five files under `./docs/phases/P00/governance/`. Changed:
  `./docs/phases/P00/decisions.md` and `./docs/phases/P00/implementation/governance-tasks.md`. No deletion, no `__pycache__`.
  This entry then changes `./docs/phases/P00/tests/test-results.md` (append only).
- SCOPE-03 (`docs/source/**`, `docs/blueprint/decisions/**` vs the pre-phase `baseline.sha`): diff empty, exit 0.
- Append-only checks: `cmp -n 10613` (old size) of `decisions.md` before and after the step: exit 0 (§5 appended after §4).
  `governance-tasks.md`: only the six Status cells changed (`NOT_STARTED` → `DONE`; verified by reversing the substitution and
  comparing with `cmp`: exit 0).
- PII scan with the AC-P00-23 regexes over every `*.md` under `docs/phases/P00/`: no match (also covered by TC-P00-23-01/02).

Post-append confirmation (after this entry was written, because TC-P00-23-02 also scans this file): C-1 exit 0 (Ran 71, OK);
C-7 exit 0 (`SUMMARY checks=57 failed=0 findings=0`); C-7a exit 1 with the same three gate findings; C-5 exit 1 (failures=2,
GATE-RED expected); C-8 exit 0; `__pycache__` directories: 0.
