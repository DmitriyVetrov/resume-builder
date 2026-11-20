# QA Report — P00 Project Governance & Source Baseline

| | |
|---|---|
| Role | QA / Acceptance (independent), 2026-11-01 |
| Environment | Linux 6.12.95+deb13-amd64, Python 3.13.5 (stdlib only, offline), bash; repo `/home/dmytro/git/work/resumiser`, git `main` without commits; all runs with `python3 -B` (0 `__pycache__` directories after the runs) |
| **Verdict** | **PASS (pre-gate).** Every criterion that can be met before the owner's gate decision is met. AC-P00-20 and AC-P00-25 are correctly red and are **GATE-PENDING (owner)**. They are not passed, and the phase is not closed by this report |

## 1. Commands (from the repository root)

| # | Command | Exit | Result |
|---|---|---|---|
| 1 | `python3 -B -m unittest discover -s docs/phases/P00/tests -t docs/phases/P00/tests -p 'test_*.py' -v` | 0 | Ran 71, OK, 0 skipped |
| 2 | same, `-p 'test_selftest_*.py'` | 0 | Ran 12, OK |
| 3 | same, `-p 'test_sources_*.py'` | 0 | Ran 11, OK (`reference counts: export=3, img=102, path=2, readme=12`) |
| 4 | same, `-p 'test_real_*.py'` | 0 | Ran 48, OK |
| 5 | same, `-p 'gate_*.py' -v` | 1 | Ran 2, failures 2 (expected GATE-RED): `TC-P00-20-01 GATE_OPEN_BLOCKER SC-12 K-12`; `TC-P00-25-01 OWNER_RECORD_MISSING`, `PHASE_STATUS_NOT_COMPLETED` |
| 6 | `python3 -B docs/phases/P00/tests/p00_cli.py --root .` | 0 | `SUMMARY checks=57 failed=0 findings=0` |
| 7 | `python3 -B docs/phases/P00/tests/p00_cli.py --root . --gate` | 1 | `SUMMARY checks=59 failed=2 findings=3` (only SC-12, OWNER_RECORD_MISSING, PHASE_STATUS_NOT_COMPLETED) |
| 8 | `python3 scripts/check-blueprint.py` | 0 | "Checked 220 required files, 9 agents", "Blueprint structure OK" |
| 9 | DET-01: commands 1 and 7 run twice under (`LC_ALL=C.UTF-8`, `PYTHONHASHSEED=0`) and twice under (`LC_ALL=C`, `PYTHONHASHSEED=1`), timing stripped | 0 / 1 | Output identical within each setting and across both settings; exit codes stable |
| 10 | `find . -name __pycache__` (outside .git) | — | 0 |

## 2. Scope and baseline (AC-P00-21)

Method: fresh snapshot (`find . -path ./.git -prune -o -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum`) saved to the scratchpad as `qa-now.sha`, compared order-independently with `baseline.sha` (pre-phase) and `baseline-pre-qa.sha`.

- vs `baseline-pre-qa.sha`: **no difference**. The QA step began from the reviewed state.
- vs `baseline.sha`: paths outside `docs/phases/P00/` that changed are only `CLAUDE.md`, `.claude/settings.json`, `.claude/hooks/log-usage.py` and 144 files under `.claude/skills/**` (accessibility-wcag, api-contract-first, docker-compose, dotnet-backend, frontend-testing, mongodb-nosql, playwright-e2e, react-19, security-privacy, tailwind-css-4, tdd-workflow). The owner confirmed all of these as their own external changes (coordinator-log steps 4 and 7), so they are accepted as outside P00 scope.
- Real `docs/source/**` (90 files): byte-identical to baseline. The only `docs/source` paths in the diff are the synthetic fixture copies under `docs/phases/P00/tests/fixtures/minimal-repo/`.
- `docs/blueprint/**` identical to baseline. `docs/blueprint/decisions/` holds only `README.md` (AC-P00-17: no ADR file added).

## 3. Independent spot checks (not just re-running the tests)

| Check | Method | Result |
|---|---|---|
| GOV-02 vs spec (≥10 IDs) | Seeded random sample (seed 7) of 12 IDs: FR-PDF-02, FR-HDR-02, FR-PER-01, FR-SEC-08, FR-CLR-01, FR-CLR-04, FR-RTE-01, FR-EDT-03, FR-PDF-07, FR-RTE-07, FR-CLR-02, FR-PRV-05. GOV-02 priority, section, summary, decision deps compared with the spec row. 102 FR rows were parsed from GOV-02 | 12/12 consistent. Summaries are faithful. Priorities are correct, including both `W` rows with `guard`. D-14 on FR-CLR-02 is present. Primary phases agree with PHASE.md Objectives |
| Exclusion rows (RV-13) | Read X1, X3, X4, X6, X7, X9, X11, FR-RTE-07 and FR-CLR-04 in GOV-03 | Each guard names a concrete check in a named phase. Allowed boundaries are correct (X1 native spell check, X3 overflow hints and FR-TYP-03, X4 month picker only with the D-07 recommendation not adopted, X6 three-thumbnail picker, X7 account e-mails, X11 static help text). X4, X8, X9, X10 are `EXCLUDED-PENDING-DECISION` with D-07…D-10; the others are `EXCLUDED` |
| D-01…D-20 owner and deadline (GOV-04) | Read all 20 D rows | All 20 have Decider `Product owner`, a Preparer `<Role> (Pxx)`, a Needed by phase, a phase-grammar Deadline, Release blocker (only D-20 = yes, as ADR-012/032 require) and Assignment `PROPOSED`. Every recommendation starts with "Recommendation only:". Deadlines are at or before the anchors (for example D-01/D-04 `before P01 gate`, D-02/D-03/D-20 `before P01 implementation`, D-12/D-14 `before P10 implementation`) |
| GOV-05 citations vs sources | SC-03/SC-04 against TECHNICAL-SPEC.md §6.1, §6.2 (10/13, 24/31, ≈31 pt continuation margin) and FR-LAY-04 (`round(font × 1.2) + v × 0.5`); SC-12 against the spec header; SC-13 against README.md line 156 (JPEG/PNG/GIF to 4 MB); SC-14 against README maxlength 50 (line 286) | 5/5 accurate. Sources and quoted values match |
| Personal data (AC-P00-23) | Regex scan of all `docs/phases/P00/` files (governance, decisions, plan, review, tests markdown and python) for e-mail addresses and international phone numbers | 0 matches. Only the owner's name and the legacy CV path appear (info I-05 in the review; AC-P00-05 needs the path) |
| Out-of-scope proposals (AC-P00-24) | phase-plan §14 lists OOS-01…OOS-06 with "needs owner approval"; none of the target files changed (see §2) | Met. The missing OOS-07 row (F-05) is a documentation follow-up (D-3 below) |

## 4. Acceptance matrix

| AC | Method | Evidence | Result |
|---|---|---|---|
| 01 Deliverables present | auto | `test_real_gov01…05`, cmd 4/6 (`TC-P00-01-*`, findings=0); 7 Architect files and GOV-01…05 exist | PASS |
| 02 Inventory completeness | auto | cmd 4/6; GOV-01 lists the 90 real files, with no extra or duplicate path (File count equals the real count) | PASS |
| 03 Inventory integrity | auto | cmd 4/6 recomputes Bytes and SHA-256 for every row; findings=0 | PASS |
| 04 Inventory classification | auto | cmd 4/6; single `normative` row (TECHNICAL-SPEC.md), README.md `evidence`; Baseline block 0.1 draft / For review matches the spec header | PASS |
| 05 Source references resolve | auto | cmd 3/4/6; `reference counts: export=3, img=102, path=2, readme=12`; unresolved references are logged as `missing-reference` in GOV-05 | PASS |
| 06 ID census | auto | cmd 4/6; recomputed from the spec (116 = 102 FR + 14 NFR) | PASS |
| 07 Traceability completeness | auto + manual | cmd 4/6; 102 FR rows parsed independently; spot check §3 | PASS |
| 08 Row validity | auto + manual | cmd 4/6; spot check §3 (12 rows) | PASS |
| 09 Decision dependencies | auto | cmd 4/6; FR-CLR-01/02 D-12/D-14 and other spec D-tags verified | PASS |
| 10 Phase anchors | auto | cmd 4/6 | PASS |
| 11 Normative content without IDs | auto | cmd 4/6 (PG-01…PG-09, §2/§5.6/§5.10/§6/§7/§9/§10) | PASS |
| 12 Exclusion completeness | auto | cmd 4/6; X1…X11 plus FR-RTE-07 and FR-CLR-04, statuses per rule | PASS |
| 13 Exclusion guards meaningful | review (RV-13 re-checked by QA) | §3 above; the review's RV-13 finding (code-review §3.3) agrees; no unresolved finding | PASS |
| 14 Decision register completeness | auto | cmd 4/6; 52 IDs, equal to the `decisions.md` §2 snapshot | PASS |
| 15 Owner and deadline | auto + manual | cmd 4/6; §3 (20 D rows); OWNER-ACCEPTED is absent, as no §4 owner record exists | PASS |
| 16 Deadline anchors | auto | cmd 4/6 | PASS |
| 17 No silent closure | auto | cmd 4/6; statuses equal the register; no new file in `docs/blueprint/decisions/` | PASS |
| 18 Conflict log validity | auto | cmd 4/6 | PASS |
| 19 Seeded conflicts | auto | cmd 4/6; K-01…K-22 each map to exactly one row | PASS |
| **20 No P00-blocking conflict open** | gate | cmd 5/7: `GATE_OPEN_BLOCKER SC-12 K-12`. SC-12 is `OPEN`, Blocks P00 = `yes`, Evidence is the spec header and the register (preparer-side sources, no owner answer) | **GATE-PENDING (owner: Q-1)** |
| 21 Scope and baseline | auto (QA) | §2 and cmd 8 (exit 0) | PASS |
| 22 Meaningful, deterministic checks | auto + review | cmd 1-2 (selftest, 12 tests incl. the 107-mutation catalogue and the valid fixture), cmd 9 determinism; the review's 46/46 independent mutations; stdlib only and no skip statically enforced | PASS |
| 23 No personal contact data | auto + manual | cmd 4/6; independent scan §3 (0 matches) | PASS |
| 24 Out-of-scope proposals | review | §3; phase-plan §14 | PASS (follow-up D-3) |
| **25 Owner gate acceptance** | gate | cmd 5/7: `OWNER_RECORD_MISSING` (`decisions.md` §4 says "No owner acceptance has been recorded"); `PHASE_STATUS_NOT_COMPLETED` (`PHASE-STATUS.md` is `NOT_STARTED`) | **GATE-PENDING (owner)** |

Totals: 23 PASS, 2 GATE-PENDING (20, 25), 0 FAIL, 0 BLOCKED.

## 5. Defects and observations

No blocker, critical, major or QA-new defect.

| ID | Severity | Item | Action / owner |
|---|---|---|---|
| D-1 (= review F-01) | minor, gate risk | `RESOLVED-BY-OWNER` can be set for SC-12 with any owner-authored source as Evidence (for example the spec header), which would turn TC-P00-20-01 green without an owner answer. **QA assessment:** today SC-12 is `OPEN`, Blocks P00 = `yes`, Status/Decider/Preparer unchanged, and its only Evidence is the spec header and register citation. It has **not** been cleared by any citation, and GATE-20 correctly fails. The risk is not triggered | At the gate, QA and owner must verify that SC-12 becomes `RESOLVED-BY-OWNER` only with Evidence `decisions.md §4` that holds the Q-1 answer. Optional hardening by the Test Architect and Test Engineer |
| D-2 (= F-02, F-03, F-04, I-01, I-03, I-07) | minor/info | Check-coverage gaps (empty Implied exclusions and Unregistered candidates tables), undocumented DoD deferrals (FR-LIB-05, FR-LAY-02…04, FR-ACC-03/04), no phase owns the FR-PER-05 restore UI, wording debt in the plan and test plan | Non-blocking follow-ups for the Architect and Test Architect. The owner may accept them as documentation debt at the gate |
| D-3 (= F-05) | minor | OOS-07 (SC-30, AGENT-WORKFLOW Parallelism vs `P03/PHASE.md`) is missing in phase-plan §14. QA confirms OOS-01…06 are in place and unapplied | Architect appends the row (not applied). Alternatively it goes to the gate as an exception |
| I-04 | info | The owner record must be inserted **inside §4** of `decisions.md`, starting with `- Accepted by owner on YYYY-MM-DD`. Appending it after §5 keeps TC-P00-25-01 red (fail-safe) | Main session at `/close-phase` |

## 6. Gate items for the owner

1. **GATE-20 / AC-P00-20.** Answer **Q-1**: accept or reject spec 0.1 draft (SHA-256 in GOV-01) as the P00 baseline, together with the phase-relative GOV-04 deadlines. If rejected, provide a new baseline or an earlier decision batch. Then update SC-12 (K-12) to `RESOLVED-BY-OWNER` with Evidence `decisions.md §4` (see D-1) and re-run `p00_cli.py --root . --gate`.
2. **GATE-25 / AC-P00-25.** In `decisions.md` §4 (above §5) record `- Accepted by owner on YYYY-MM-DD` with: answers to Q-1…Q-5; acceptance or changes of the GOV-04 owner/deadline proposals and of PD-P00-03, -04, -05 (and PD-P00-11…13). Set `PHASE-STATUS.md` to `COMPLETED` or `COMPLETED_WITH_APPROVED_EXCEPTIONS` (the current `NOT_STARTED` and `unassigned` roles also need updating, I-08).
3. Owner confirms the `RESOLVED-BY-HIERARCHY` rows (SC-13, SC-14, SC-15, SC-28) and the SC-16 relocation; approves the phase plan (Q-4) and the final test plan; decides on OOS-01…OOS-06 (and OOS-07). None is applied in P00.
4. After these, QA re-runs commands 5 and 7 (expected exit 0) before the main session runs `/close-phase`.

## 7. Verdict

**PASS (pre-gate).** All checks that do not depend on the owner are green and deterministic. Scope is clean, and the owner-confirmed external changes are excluded as agreed. Spot checks agree with the automated results. GATE-20 and GATE-25 are red as designed and are listed above. This report does not close the phase and waives no criterion.

---

## QA re-check (post owner answers), 2026-11-01

Role: QA / Acceptance (independent re-check for `/review-phase P00`). The sections above are unchanged. This section replaces the status of AC-P00-20 and AC-P00-25 only; all other rows are re-verified against the current repository.

### R1. Environment and commands

Linux 6.12, Python 3 (stdlib only), offline, repo root `/home/dmytro/git/work/resumiser`. All runs with `python3 -B`. `find . -name __pycache__` after the runs returned nothing (no residue).

| # | Command | Exit | Result |
|---|---|---|---|
| 1 | `python3 -B -m unittest discover -s docs/phases/P00/tests -t docs/phases/P00/tests -p 'test_*.py' -v` | 0 | Ran 71 tests, OK, no skips |
| 2 | same with `-p 'gate_*.py' -v` | 1 | Ran 2, failures=1. TC-P00-20-01 ok. TC-P00-25-01 FAIL with exactly one finding, `PHASE_STATUS_NOT_COMPLETED docs/phases/P00/PHASE-STATUS.md` |
| 3 | `python3 -B docs/phases/P00/tests/p00_cli.py --root .` | 0 | `SUMMARY checks=57 failed=0 findings=0` |
| 4 | `python3 -B docs/phases/P00/tests/p00_cli.py --root . --gate` | 1 | `SUMMARY checks=59 failed=1 findings=1`; the one finding is `TC-P00-25-01 PHASE_STATUS_NOT_COMPLETED`. (A first attempt with `--gate` alone exited 2, usage error: `--root` is required. Not a defect; rerun as shown.) |
| 5 | `python3 scripts/check-blueprint.py` | 0 | 220 required files, 9 agents, "Blueprint structure OK" |

The reviewer's expectation is **confirmed**: the gate suite is red only on `PHASE_STATUS_NOT_COMPLETED`.

### R2. Re-verified evidence beyond the suites

- SC-12 (K-12) is now `RESOLVED-BY-OWNER` with Evidence `decisions.md §4` (`governance/source-conflict-log.md:22`). Only the Status and Evidence cells changed; Blocks P00 stays `yes`. This is the legitimate evidence path required by D-1 of section 5 above.
- `decisions.md` §4 holds `- Accepted by owner on 2026-11-01` inside §4, with Q-1…Q-5 answers (lines ~100-108). The Q-3 delegation and the Q-5 scope are recorded.
- `decision-owner-register.md`: 30 cells read `OWNER-ACCEPTED` (checked by TC-P00-15), 3 other lines still contain `| PROPOSED |` (count includes non-GOV-04-assignment tables; the suite accepts this and passes).
- Scope (AC-P00-21): git has no commits, so the evidence is the main session's SHA-256 snapshots (`coordinator-log.md` steps 1, 3, 4, 7). Two out-of-P00 change batches (`.claude/skills/**` at 01:31; `.claude/settings.json`, `.claude/hooks/log-usage.py`, `CLAUDE.md` at 01:57) are recorded in the log as the owner's own external changes, confirmed by the owner, and excluded from P00 scope evidence. No other file outside `docs/phases/P00/` has an mtime after P00's artifacts began. `docs/source/**` content equals the GOV-01 digests (TC-P00-03 green; 90 files). Observation: `docs/source/reference/*` has mtime 00:57:50, earlier than any P00 deliverable and consistent with the byte-equality result.
- `docs/blueprint/decisions/` unchanged (TC-P00-17 green). OOS-01…06 are listed in phase-plan §14 and not applied; the owner approved them for later phases (`decisions.md` §4).

### R3. Acceptance matrix (AC-P00-01…25)

| AC | Type | Evidence | Result |
|---|---|---|---|
| 01 Deliverables | auto | cmd 3 (57 checks, 0 findings) | PASS |
| 02 Inventory completeness | auto | cmd 3; 90 files under `docs/source/` | PASS |
| 03 Inventory integrity | auto | cmd 3; sizes and SHA-256 match | PASS |
| 04 Classification | auto | cmd 3 | PASS |
| 05 Source references | auto | cmd 3; reference counts export=3, img=102, path=2, readme=12 | PASS |
| 06 ID census | auto | cmd 3 (116 = 102 FR + 14 NFR) | PASS |
| 07 Traceability completeness | auto | cmd 3 | PASS |
| 08 Row validity | auto | cmd 3 | PASS |
| 09 Decision dependencies | auto | cmd 3 | PASS |
| 10 Phase anchors | auto | cmd 3 | PASS |
| 11 Normative content w/o IDs | auto | cmd 3 | PASS |
| 12 Exclusion completeness | auto | cmd 3 | PASS |
| 13 Exclusion guards meaningful | review | unchanged files since section 3; code-review R-section agrees | PASS |
| 14 Decision register completeness | auto | cmd 3; 52 IDs | PASS |
| 15 Owner and deadline | auto | cmd 3; OWNER-ACCEPTED now present and backed by the §4 record | PASS |
| 16 Deadline anchors | auto | cmd 3 | PASS |
| 17 No silent closure | auto | cmd 3 | PASS |
| 18 Conflict log validity | auto | cmd 3; SC-12 `RESOLVED-BY-OWNER` has owner Evidence | PASS |
| 19 Seeded conflicts | auto | cmd 3 | PASS |
| 20 No P00-blocking conflict open | gate | cmd 2: TC-P00-20-01 ok; cmd 4 reports no `GATE_OPEN_BLOCKER` | **PASS** (was GATE-PENDING). Owner answer Q-1 recorded; SC-12 resolved via `decisions.md §4` |
| 21 Scope and baseline | auto/QA | R2; cmd 5 exit 0 | PASS |
| 22 Meaningful, deterministic checks | auto | cmd 1 (selftest incl. mutation catalogue, in-process and subprocess determinism, stdlib/offline/no-skip, read-only); two consecutive CLI runs gave identical summaries | PASS |
| 23 No personal contact data | auto | cmd 3 | PASS |
| 24 Out-of-scope proposals | review | phase-plan §14 OOS-01…06 present, unapplied. OOS-07 has no §14 row (see F-05 below) | PASS (with follow-up) |
| 25 Owner gate acceptance | gate | Part 1 (owner record, Q-1…Q-5, PD-P00-03/04/05 acceptance): satisfied, no `OWNER_RECORD_MISSING`. Part 2 (`PHASE-STATUS.md` reads `COMPLETED` or `COMPLETED_WITH_APPROVED_EXCEPTIONS`): not satisfied, `PHASE_STATUS_NOT_COMPLETED` | **GATE-PENDING (owner / `/close-phase P00`)** |

Totals: 24 PASS, 1 GATE-PENDING (25), 0 FAIL, 0 BLOCKED.

AC-P00-25 can go green only when `/close-phase P00` sets the status. QA did not edit `PHASE-STATUS.md` and the phase is **not** closed.

### R4. PHASE-GATES DoD check

Architecture plan, test plan, tests-first (red recorded), implementation, suites, review PASS, ADR/traceability docs, no blocker or critical issue: all present in `PHASE-STATUS.md` with evidence above. Open for the gate: status `COMPLETED*` (owner) and the F-08 test-results entry.

### R5. Agreement with code review

I agree with the re-review verdict PASS and with F-05…F-08 and I-09…I-12. Independent confirmations: F-05 (OOS-07 has no §14 row, SC-30 still OPEN); F-06 (SC-25 is still OPEN in GOV-05 though §4 says Q-5 answers it); F-07 (GOV-04 Decider still `Product owner` for delegated technical ADRs); F-08 (no `test-results.md` entry for the post-answer runs; this report's R1 now holds the exact commands and exit codes, but the Test Engineer or main session should still append them). No disagreement. One small addition: `PHASE-STATUS.md` role line "QA: qa-acceptance (verdict PASS, pre-gate)" and the "23/25" evidence line are stale after this re-check (now 24/25). Not a blocker; update at close.

### R6. Risks and owner questions

- Risk: `/close-phase` must not be run before the owner reads `decisions.md:100-108` (I-11, transcription by the main session), especially the Q-3 delegation scope.
- Risk: F-06/F-07 leave GOV-05 and GOV-04 disagreeing with the owner record until P01. Agents reading only the registers may act on stale data.
- Owner questions: (1) Do you confirm the §4 record matches your answers? (2) Does Q-5 include P02 mock examples (keep synthetic until stated)? (3) Is ADR-003 delegated, and does region selection under ADR-009 stay with you under D-20?

### R7. Verdict

**PASS (pre-close).** 24 of 25 criteria PASS; AC-P00-25 is GATE-PENDING only on the owner-run status change, which is the single remaining red check. No blocker, critical, major or new QA defect. This report does not close the phase and waives no criterion. Next owner: product owner / main session for `/close-phase P00`.
