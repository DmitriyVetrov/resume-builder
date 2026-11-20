# P01 Test Plan

- Author: Test Architect (Orca worker, task `task_23c05676159c`), 2026-11-02.
- Inputs: `../PHASE.md`, `../kickoff.md` §3 (test budget), `../architecture/phase-plan.md`, `../acceptance-criteria.md` (AC-P01-01…16), `docs/blueprint/AGENT-WORKFLOW.md`, `.claude/rules/*`.
- Next owner: Test Engineer (writes `check_p01.py` and `suite.cmd` to this plan).

Required test strategy (PHASE.md): architecture review, ADR completeness, threat-model checklist, architecture fitness checks.

## 1. Budget and approach (kickoff §3, ADR-035 B-4)

| Item | Value |
|---|---|
| Executable artifact | **one** file `docs/phases/P01/tests/check_p01.py`, Python 3 standard library only (`re`, `pathlib`, `sys`, `copy`), ≤ ~300 lines |
| Suite | `docs/phases/P01/tests/suite.cmd` with exactly one line: `python3 -B docs/phases/P01/tests/check_p01.py` |
| Not allowed | pytest/unittest classes as a framework, argparse/CLI, helper modules, fixture files or folders, network, subprocess, git calls, writes to disk |
| What is checked | structure and completeness of the P01 artifacts (headings, required lines, table rows, IDs, keywords). Prose quality, correctness of reasoning and spec fidelity are left to the Code Reviewer (§5) |
| Red state | Not possible: the documents were written before the tests (PD-P01-03). It is replaced by the in-memory negative cases in §4. The Test Engineer records them in `test-results.md` |
| Fitness checks | P01 *defines* F-BE-1…5 and F-FE-1…3 (phase-plan §6). C-02 checks that they are listed; the executable rules belong to P04/P05 |

The plan stays inside the budget. No excess Should items need a larger budget (AC-P01-16 is covered by review).

## 2. Module design (for the Test Engineer)

1. **Root.** Repo root = `Path(__file__).resolve().parents[4]`, so the command works from any cwd. All paths below are repo-relative.
2. **Load once.** `load()` reads every input file in §3 as UTF-8 into a dict `{relpath: text}`. A missing file is a failure of the check that needs it, not a crash.
3. **Pure checks.** Each check is a function `c_xx(docs: dict) -> list[str]` that returns failure messages (empty list = pass). No check reads files itself. That makes the negative cases possible without fixtures.
4. **Section slicing.** Sections are cut with a line-anchored regex (`^## 4\. ` up to the next `^## `), never with `str.split("## 4.")`: `### 4.1` contains `## 4.` as a substring and would cut the threat register at the wrong place.
5. **Tables.** A table row is a line starting with `|`; cells = `line.strip().strip("|").split("|")`, stripped. Rows are matched by their first cell (an ID). Rows whose cell count differs from the header fail.
6. **Keywords.** Keyword oracles (C-03…C-07) are case-insensitive substring matches inside the named ADR file. They prove that the decision is stated, not that it is right.
7. **Negative cases.** `NEGATIVES` is a list of `(name, check, mutate)` tuples. For each: `d = copy.deepcopy(docs)`, `mutate(d)` changes one text in memory, then `check(d)` must return at least one message that names the mutated item. A negative that passes is a failure ("check cannot fail").
8. **Output and exit.** One line per item, in a fixed order: `PASS C-01 kickoff`, `FAIL C-11 register: ADR-029 status OPEN`, `PASS N-01 adr-missing-section`. Last line: `RESULT PASS|FAIL checks=<n> negatives=<m> failures=<k>`. Exit 0 only if every check passes and every negative fails as expected; otherwise exit 1.
9. **Determinism.** No time, randomness, environment variables or dict-order dependence; iterate over lists in the order given in this plan or sorted. Two runs on the same tree give identical output.

## 3. Oracles (inputs read by the module)

| Key | File |
|---|---|
| KICK | `docs/phases/P01/kickoff.md` |
| PLAN | `docs/phases/P01/architecture/phase-plan.md` |
| DEC | `docs/phases/P01/decisions.md` |
| DOM | `docs/phases/P01/architecture/domain-model.md` |
| THR | `docs/phases/P01/architecture/threat-model.md` |
| REG | `docs/blueprint/DECISION-REGISTER.md` |
| ADR | each `docs/blueprint/decisions/<file>` named in PLAN §8 |
| SPEC | `docs/source/TECHNICAL-SPEC.md` (read-only; only §10.1 and §10.2 code blocks) |

Constants taken from `acceptance-criteria.md` (the oracle; never from the documents under test):
- `ADR_LINES` = `Status: **Accepted**`, `Decider: Solution Architect (delegated, ADR-035)`, `Date: 2026-11-02`, `Source IDs:`.
- `ADR_SECTIONS` = `## Context`, `## Decision`, `## Alternatives considered`, `## Rationale`, `## Consequences`, `## Security/privacy impact`, `## Owner and date` (each matched as a whole heading line, so `## Decision` does not match inside `## Decision drivers`).
- `P01_ADRS` = the 25 IDs of AC/phase-plan §8: ADR-002, 003, 004, 007, 008, 009, 010, 012, 013, 014, 015, 016, 019, 020, 021, 022, 023, 025, 029, 033, 034, 036, 037, 038, 039. The module hardcodes this list **and** checks that PLAN §8 lists the same IDs (a drift in either fails C-10).
- `DOM_ENTITIES` = User, Resume, LayoutSettings, Header, ContactItem, Section, TextContent, ListContent, EntriesContent, Entry, Photo (§10.1); Paragraph, BulletList, Text, Link, LineBreak (§10.2).
- `SC_P01` = SC-01, 02, 05, 08, 09, 11, 17, 18, 19, 20, 21, 22, 23, 25, 26, 29, 30 (AC-P01-12 list).
- `STRIDE` = Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege; ID prefixes SP, TA, RE, ID, DS, EP.
- `TOPICS` = Authentication, Guest-to-account claim, Object storage access, Export endpoints.

## 4. Acceptance mapping, checks and negative cases

Every Must criterion has a positive check and, where the module checks it, a negative case. "Review" means the Code Reviewer verifies it in `review/code-review.md` (§5).

| AC | Check | Positive (real artifacts must satisfy) | Negative case (in-memory mutation must make it fail) |
|---|---|---|---|
| AC-P01-01 | C-01 kickoff | KICK exists; has `## 2. Roles` with a table row that has a cell `Contract Architect` and whose "Needed" cell (the next cell) contains `no`; a `## 3.` heading containing `ADR-035 B-4`; a `## 4. Parallel slices` section whose body contains `None`; a `## 5.` heading containing `Decisions` | N-01a: set the Contract Architect "Needed" cell to `yes` → fail. N-01b: delete the `## 4. Parallel slices` section → fail |
| AC-P01-02 | C-02 boundaries | C-10 passes for ADR-007 and ADR-008; PLAN `## 5.` contains `only` and `contract` in boundary rule 1 and `Rendering belongs to the frontend`; each of F-BE-1…F-BE-5 and F-FE-1…F-FE-3 appears in PLAN `## 6.` **and** in ADR-008 | N-02: remove `F-BE-4` from PLAN §6 → fail naming `F-BE-4` |
| AC-P01-03 | C-03 persistence | ADR-004 complete; keywords: `MongoDB`, `8.x`, `replica set`, `Atlas`, `Germany West Central`, `majority`, `RPO`, `backup` | N-03: remove `majority` from ADR-004 → fail naming `majority` |
| AC-P01-04 | C-04 file storage | ADR-009 complete; keywords: `Azure Blob Storage`, `Germany West Central`, `private`, `through the API`, `key`, `re-encod`, `export`, `Azurite` | N-04: replace `private` with `public` in ADR-009 → fail |
| AC-P01-05 | C-05 auth | ADR-036, ADR-013, ADR-014, ADR-015, ADR-038 complete; ADR-036 keywords: `PBKDF2`, `210` (iterations), `session`, `HttpOnly`, `CSRF`, `token`, `enumeration` | N-05: drop the `Status:` line from ADR-038 → fail naming ADR-038 |
| AC-P01-06 | C-06 rendering plan | ADR-010 complete; keywords: `layout engine`, `PageModel`, `PDF`, `TXT`, `Candidate`, `prototype`, `go/no-go`, `parity`, `NFR-01`, `NFR-03`, `fidelity`, `determinis`, `P10`, `fallback`; the go/no-go table has rows `G1`…`G6` | N-06: remove the `G6` row → fail naming `G6` |
| AC-P01-07 | C-07 EU hosting | ADR-012, ADR-033, ADR-034 complete; ADR-012 contains `D-20` and `Germany West Central`; ADR-033 contains `Germany West Central`; ADR-034 contains `Europe`; ADR-004 and ADR-009 contain `Germany West Central` (shared with C-03/C-04) | N-07: remove `Europe` from ADR-034 → fail |
| AC-P01-08 | C-08 domain model | every name in `DOM_ENTITIES` occurs as a whole word in DOM; DOM has headings containing `Invariants`, `Limits`, `Identifiers`, `Persistence mapping`; cross-check: the entity names parsed from SPEC §10.1 (`^([A-Z]\w+)\s+\{` inside the code block) equal the §10.1 part of `DOM_ENTITIES` (guards a spec re-baseline) | N-08: delete every `ContactItem` from DOM → fail naming `ContactItem` |
| AC-P01-09 | C-09 threat model | THR `## 4.` has six `### 4.n` subsections named as in `STRIDE`; each subsection has ≥ 1 row `T-<prefix>-NN` with its own prefix; every threat row has 7 non-empty cells (ID, TB, Threat, Mitigation, Ref, Phase, Verification) and the Phase cell matches `P\d\d`; THR `## 5.` has a row for each of `TOPICS`; `## 6.` exists and mentions `deletion` and `portability`; THR `## 9.` checklist has no unchecked `- [ ]` item and lists each STRIDE name, each topic, `logs` and `Account deletion and data export` | N-09a: delete `### 4.3 Repudiation` and its rows → fail. N-09b: blank the Verification cell of one row → fail naming that ID. N-09c: change one checklist `[x]` to `[ ]` → fail |
| AC-P01-10 | C-10 ADR completeness | PLAN §8 lists exactly `P01_ADRS`; each listed file exists in `docs/blueprint/decisions/`, its H1 starts with its ID, and it contains all `ADR_LINES` and all `ADR_SECTIONS` | N-10a: remove `## Alternatives considered` from ADR-016 → fail naming ADR-016 and the section. N-10b: point one PLAN §8 file name to a non-existent file → fail |
| AC-P01-11 | C-11 register | for each ID in `P01_ADRS` + ADR-032: the REG row exists, its "Current status" cell is exactly `ACCEPTED` or `FIXED`, or `REQUIRED` for ADR-010 only (AC-P01-11 as amended by PD-P01-09; no other ID may be `REQUIRED`), and the row contains a link `decisions/<file>` to its ADR (ADR-032 → the ADR-012 file); rows ADR-036…ADR-040 exist; the items of DEC §4 (ADR-006, ADR-017, ADR-018, ADR-024, ADR-026, ADR-027, ADR-028, ADR-030, ADR-031, ADR-040) have a status in `OPEN`, `SOURCE-OPEN`, `PROPOSED` or, for ADR-006, `FIXED` with `decided in P02` | N-11a: set the ADR-029 status to `OPEN` → fail. N-11b: remove the link from the ADR-033 row → fail. N-11c: set ADR-017 to `ACCEPTED` → fail (an item owned by P07 must stay open). N-11d: set the ADR-029 status to `REQUIRED` → fail naming ADR-029 (the `REQUIRED` exception applies to ADR-010 only) |
| AC-P01-12 | C-12 decisions | every `DD-P01-NN` row of DEC `## 2.` has 7 cells; the Decision cell contains `DELEGATED-DEFAULT`; Options, Reason and ADR/doc cells are non-empty; IDs are unique and consecutive; DEC `## 3.` has a row for each of `SC_P01` with a non-empty resolution | N-12a: remove `DELEGATED-DEFAULT` from DD-P01-05 → fail. N-12b: delete the SC-25 row → fail |
| AC-P01-13 | review | ADR-019…022 keep X4, X8, X9, X10 excluded; no P01 document plans an X1–X11 feature | — (judgement; see §5) |
| AC-P01-14 | handoff check | `python3 scripts/phase-handoff-check.py --phase P01 --role <role> --worktree .` → `RESULT PASS` (role and phase scope from git) | covered by the script; not duplicated in the module (no git calls) |
| AC-P01-15 | handoff check / gate | `python3 scripts/check-blueprint.py` exit 0; `suite.cmd` exit 0 | the module's own exit code is the suite result |
| AC-P01-16 (Should) | review | TRACEABILITY rows and ARCHITECTURE ADR references (OOS-01, OOS-03) | — |

Total: 12 checks (C-01…C-12) and 21 negative cases. The negatives cover every case the acceptance criteria require: missing ADR section (N-10a), register row still `OPEN` (N-11a), §2 row without `DELEGATED-DEFAULT` (N-12a), missing STRIDE category (N-09a), missing §10.1 entity (N-08).

## 5. Review-only items (Code Reviewer, `review/code-review.md`)

The module cannot judge these. The reviewer covers them in one architecture pass:
- AC-P01-02…07: each ADR's decision is consistent with the cited spec sections and with the other ADRs (e.g. region, storage, no server export).
- AC-P01-09: the mitigations are adequate; the four mandatory topics of `.claude/rules/03-security-privacy.md` are actually designed, not only named.
- AC-P01-13: exclusions X1–X11.
- AC-P01-16: OOS-01 and OOS-03 alignment.
- Fitness rules F-BE-1…5 and F-FE-1…3 are testable as written (P04/P05 will implement them).

## 6. Commands

| Purpose | Command | Expected |
|---|---|---|
| Phase suite | `python3 -B docs/phases/P01/tests/check_p01.py` | exit 0, last line `RESULT PASS …` |
| Blueprint | `python3 scripts/check-blueprint.py` | exit 0 |
| Handoff | `python3 scripts/phase-handoff-check.py --phase P01 --role <role> --worktree .` | `RESULT PASS` |
| Gate | `python3 scripts/phase-handoff-check.py --phase P01 --gate --worktree .` | `RESULT PASS` |

The Test Engineer records in `test-results.md`: the commands, exit codes, Python version, the full module output (check and negative lines), and the note that no red state exists (PD-P01-03).

## 7. Findings from a dry run of these checks

Before writing this plan the Test Architect evaluated the C-10, C-11, C-12, C-08 and C-09 rules against the current artifacts with a throwaway script (scratchpad, not in the repo). All passed except two (both since resolved by the Solution Architect, see the notes below):

- **TP-F1 (blocks C-11).** `DECISION-REGISTER.md` row ADR-010 has status `REQUIRED`, but AC-P01-11 accepts only `ACCEPTED` or `FIXED`. `REQUIRED` is a valid register status ("mandated by source spec", FR-PRV-02), so the row is decided, but it does not meet the criterion as written. The Test Architect does not loosen the oracle. C-11 must be implemented as specified and will fail until the **Solution Architect**, who owns both files, does one of these:
  1. (recommended) keep `REQUIRED` and amend AC-P01-11 to "`ACCEPTED`, `FIXED` or `REQUIRED`", because ADR-010 is spec-mandated and the decided architecture is linked; or
  2. change the ADR-010 row status to `ACCEPTED` and keep "REQUIRED by FR-PRV-02" in the handling text.
  If option 1 is chosen, the Test Engineer adds `REQUIRED` to the allowed set of C-11 only for ADR-010, citing the amended criterion.
  **Resolved (PD-P01-09):** option 1, narrowed: AC-P01-11 now allows `REQUIRED` for ADR-010 only; every other P01-decided ID still needs `ACCEPTED` or `FIXED`. C-11 and N-11d in §4 implement this.

- **TP-F2 (blocks C-09).** Threat row `T-EP-04` (accepted risk: bypassing the client-side export gate) has Phase `—`. AC-P01-09 requires a phase on every threat row, so C-09 fails on it. The oracle stays strict. Recommended fix by the **Solution Architect** (owner of `threat-model.md`): set the Phase cell to the phase that records or re-checks the acceptance (`P01`, or `P12` where the export gate is built), keeping "documented acceptance" as the verification.
  **Resolved (PD-P01-10):** T-EP-04 now has Phase `P12`; C-09 is unchanged and passes on that row.

Other observations (no action needed):
- The P00 conflict list in `phase-plan.md` §1 omits SC-25, but AC-P01-12 includes it and `decisions.md` §3 resolves it. C-12 follows the AC.
- `decisions.md` §2 currently has 32 `DD-P01` rows, and the threat register has 40 rows across all six STRIDE categories. The checks do not hardcode these counts.

## 8. Risks

| Risk | Mitigation |
|---|---|
| Keyword checks pass on a document that is wrong | the checks only prove presence; review (§5) proves content |
| Brittle matching on wording changes | keywords are few, case-insensitive and taken from the ACs; a failing keyword names itself, so a fix is a one-line decision by the document owner, not a test change by a developer |
| Spec re-baseline changes §10.1 | C-08 cross-check against SPEC fails loudly instead of passing silently |
| The module grows past the budget | no helper modules; table and section helpers are shared by all checks; ~300 lines is the limit (kickoff §3) |
