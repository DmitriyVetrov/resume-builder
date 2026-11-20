# P00 Test Plan — Project Governance & Source Baseline

| | |
|---|---|
| Phase | P00 — Project Governance & Source Baseline |
| Author role | Test Architect |
| Plan status | PROPOSED — needs owner approval (gate evidence "Test plan approved") |
| Date | 2026-11-01 |
| Inputs | `PHASE.md`, `acceptance-criteria.md` (AC-P00-01…25), `architecture/phase-plan.md` (§5–§8, §13–§15), `decisions.md`, `dependencies.md`, `implementation/governance-tasks.md`, `docs/blueprint/TEST-STRATEGY.md`, `docs/blueprint/PHASE-GATES.md`, `.claude/rules/*` |
| Required test strategy (PHASE.md) | "Documents and rules; structure check; decision register review." |
| Next owner | Test Engineer (executable checks, fixtures, red evidence) |

This plan maps every acceptance criterion AC-P00-01…25 to test cases, fixtures, commands and expected exit codes. It does not
change any criterion. Where a criterion is ambiguous, the interpretation used here is listed in §15 "Issues for Architect".

## 1. Scope and test levels

P00 delivers Markdown governance documents (GOV-01…GOV-05) and stdlib-only checks. The TEST-STRATEGY layers apply as follows:

| Layer | P00 use | Where |
|---|---|---|
| Unit | Check functions and source parsers, exercised on synthetic fixtures (positive, negative, boundary) | `test_selftest_*.py` |
| Integration | The same check functions run against the real repository: real sources and real GOV deliverables | `test_real_*.py`, `test_sources_*.py` |
| Security / privacy | PII pattern scan (AC-P00-23); scope and source-integrity snapshot (AC-P00-21) | `test_real_*.py`; procedure §11 |
| Gate | Owner-dependent items (AC-P00-20, AC-P00-25), run separately and never counted as a pass while red | `gate_p00.py`; §10 |
| Review | Judgement items (AC-P00-13, AC-P00-24, phase-choice sensibility) | Code Reviewer and QA checklists, §12 |
| Contract, component, E2E, rendering, performance, accessibility | **Not applicable.** P00 has no API, UI, renderer or runtime. No such test is created | — |
| Concurrency | **Not applicable** to the deliverables. The checks are read-only and keep no shared state, so parallel or repeated runs cannot interfere. Determinism (AC-P00-22) is tested instead, §9 | — |

## 2. Environment and constraints

- Python 3 standard library only, version ≥ 3.10 (needed for `sys.stdlib_module_names`). Observed on the dev machine: Python 3.13.5.
- Offline. No network, no package install, no containers.
- All commands run from the repository root `/home/dmytro/git/work/resumiser`. The checks must not depend on the current directory: for real runs they find the repository root by walking up from their own file to the first ancestor that contains `docs/source/TECHNICAL-SPEC.md`, `scripts/check-blueprint.py` and `.claude/`. Fixture runs receive the fixture root explicitly (`Repo(root=…)`, `--root`); the fixture has no `.claude/` or `scripts/` directory.
- `-B` (no bytecode) is mandatory in every command, so that no `__pycache__/` appears under `docs/phases/P00/tests/`. A `__pycache__/` there is a finding of the scope procedure (§11).
- The checks are read-only on every path. Fixture mutations are applied in memory (§8.3). No temporary file is written inside the repository.

## 3. Commands and expected exit codes

The Architect's proposed command is confirmed with one change: `-B` is added. The file pattern `test_*.py` deliberately excludes
the gate module `gate_p00.py`.

| ID | Command (from the repository root) | Before Test Engineer | Red state (tests written, GOV missing) | Green state (GOV written, before owner answer) | After owner acceptance |
|---|---|---|---|---|---|
| C-1 main suite | `python3 -B -m unittest discover -s docs/phases/P00/tests -t docs/phases/P00/tests -p 'test_*.py' -v` | 5 (`NO TESTS RAN`) | 1 | 0 | 0 |
| C-2 self-tests | `python3 -B -m unittest discover -s docs/phases/P00/tests -t docs/phases/P00/tests -p 'test_selftest_*.py' -v` | 5 | 0 | 0 | 0 |
| C-3 source oracles | `python3 -B -m unittest discover -s docs/phases/P00/tests -t docs/phases/P00/tests -p 'test_sources_*.py' -v` | 5 | 0 | 0 | 0 |
| C-4 real deliverables | `python3 -B -m unittest discover -s docs/phases/P00/tests -t docs/phases/P00/tests -p 'test_real_*.py' -v` | 5 | 1 | 0 | 0 |
| C-5 gate items | `python3 -B -m unittest discover -s docs/phases/P00/tests -t docs/phases/P00/tests -p 'gate_*.py' -v` | 5 | 1 | 1 (expected, §10) | 0 |
| C-5a gate AC-P00-20 only | C-5 plus `-k TC_P00_20` | 5 | 1 | 1 until Q-1 is answered and recorded | 0 |
| C-5b gate AC-P00-25 only | C-5 plus `-k TC_P00_25` | 5 | 1 | 1 | 0 |
| C-6 one criterion | C-1 plus `-k TC_P00_<nn>` (e.g. `-k TC_P00_07`) | 5 | 0 or 1 per §10 table | 0 | 0 |
| C-7 report CLI | `python3 -B docs/phases/P00/tests/p00_cli.py --root .` | 2 (file missing) | 1 | 0 | 0 |
| C-7a report CLI, gate | `python3 -B docs/phases/P00/tests/p00_cli.py --root . --gate` | 2 | 1 | 1 | 0 |
| C-7b report CLI, fixture | `python3 -B docs/phases/P00/tests/p00_cli.py --root docs/phases/P00/tests/fixtures/minimal-repo` | 2 | 0 | 0 | 0 |
| C-7c report CLI, one mutation | C-7b plus `--mutation NF-01` | 2 | 1 | 1 | 1 |
| C-8 Blueprint structure | `python3 scripts/check-blueprint.py` | 0 | 0 | 0 | 0 |
| C-9 double run | procedure DET-01, §9.3 | — | 0 (diff empty) | 0 | 0 |
| C-10 scope snapshot | procedure SCOPE-01…04, §11 | 0 | 0 | 0 | 0 |

Exit codes: unittest returns 0 (all passed), 1 (any failure or error) and 5 (no tests collected, Python ≥ 3.12). The CLI returns 0 (no
finding), 1 (at least one finding) and 2 (usage error, e.g. a missing `p00_cli.py` or a bad argument). "Before Test Engineer" exit 2 for
C-7 means the file does not exist yet; that is the shell/Python error, not a check result.

## 4. Test code layout and conventions (for the Test Engineer)

All files live under `docs/phases/P00/tests/`. Module names carry the prefix `p00_` (helpers) or `test_`/`gate_` (tests), so they
cannot shadow standard-library modules on `sys.path`.

| File | Content |
|---|---|
| `p00_repo.py` | `Repo(root, overrides=None)`: `read_text(rel)` (UTF-8, strict), `read_bytes(rel)`, `exists(rel)`, `list_files(rel_dir)` (recursive, regular files only, no symlink following, POSIX relative paths, sorted by code point). `overrides` maps a relative path to replacement text (or `None` for "deleted"); every read and the SHA-256/size computation honour overrides (bytes = text encoded UTF-8) |
| `p00_md.py` | Markdown helpers: headings, sections (§5.1), named tables (§6.1), cell and list parsing (§6.2), inline-code stripping |
| `p00_sources.py` | Oracle parsers for the sources (§5): spec, register, plan, `decisions.md`, `TRACEABILITY.md`, `PHASE.md` files, file references |
| `p00_checks.py` | One check function per TC of type `auto` in §7: `check(repo) -> list[Finding]`, returned sorted |
| `p00_fixtures.py` | Mutation catalogue NF-01…NF-39 (§8.3): ID, target path, pure text transform, expected check ID, expected finding code |
| `p00_cli.py` | Report CLI (§3 C-7): `--root PATH`, `--gate`, `--mutation NF-xx`. Prints one line per finding `<TC-ID>\t<CODE>\t<location>\t<detail>`, sorted, then `SUMMARY checks=<n> failed=<k> findings=<m>`. No timestamps, no absolute paths in output |
| `test_sources_oracles.py` | Source sanity tests TC-P00-S-01 and the `*-sources` TCs of §7 (green in every state; red = stop condition) |
| `test_selftest_checks.py` | Valid fixture passes; each NF mutation fails its target check (subTest per NF) |
| `test_selftest_determinism.py` | Determinism, stdlib-only, read-only and no-skip tests (TC-P00-22-04…08, TC-P00-20-03) |
| `test_real_common.py` | TC-P00-01-*, TC-P00-21-01, TC-P00-23-* |
| `test_real_gov01_inventory.py` | TC-P00-02…06 |
| `test_real_gov02_traceability.py` | TC-P00-07…11 |
| `test_real_gov03_exclusions.py` | TC-P00-12 |
| `test_real_gov04_decisions.py` | TC-P00-14…17 |
| `test_real_gov05_conflicts.py` | TC-P00-18, TC-P00-19, TC-P00-20-02 |
| `gate_p00.py` | Gate TCs TC-P00-20-01 and TC-P00-25-01 against the real repository |
| `fixtures/README.md` | States that every fixture is synthetic, contains no real or personal data and no copy of real deliverable content |
| `fixtures/minimal-repo/…` | Minimal valid mini-repository (§8.1) |

Conventions:
1. **Test method names** contain the TC ID with underscores, e.g. `test_TC_P00_07_01_requirement_set_equality`, so `-k TC_P00_07` selects one criterion.
2. **Finding model:** `Finding(tc_id, code, location, detail)`. Tests assert on `code` (and on `location` where it matters), never on message wording. Codes are listed in §6.4.
3. **Failure, not error:** a missing or unreadable deliverable yields a `MISSING_FILE` or `BAD_ENCODING` finding and an assertion failure. An uncaught exception (unittest "ERROR") is a defect of the checks. Every red-state run must show `errors=0`.
4. **Failure messages** list the sorted findings, at most 50 lines, then `… and <k> more`. They contain no absolute path, no time and no memory address.
5. **No skips:** `unittest.skip`, `skipIf`, `skipUnless`, `SkipTest` and `expectedFailure` are forbidden in all P00 test files (enforced by TC-P00-22-06).
6. **No hard-coded oracles:** expected ID sets, counts, priorities, sections, digests, sizes and statuses are computed from the sources at run time. The baseline numbers in the plan and the AC (116, 102, 14, 92, 20, 2, 2, 90, 52) must not appear as literals in check code. The only constants allowed are format rules, each with a provenance test that finds the same text in the plan (§5.3).

## 5. Oracles: how expected values are derived from sources

All source files are read as UTF-8. A line is split on `\n` after removing one trailing `\r` only for **source** files (the spec and Blueprint
files are owner-controlled; GOV files must be LF, §6.3).

### 5.1 Sections and headings (generic, any Markdown document)

- **Numbered heading:** `^(#{1,6}) (\d+(?:\.\d+)*)\.?\s`. Its section token is `§` + group 2 (e.g. `## 5. Functional requirements` → `§5`, `### 5.10 Layout controls` → `§5.10`).
- **Appendix heading:** `^## (?:Appendix|Приложение) ([A-Z])\b` → token `App. A`, `App. B`.
- **Other heading:** any other `^#{1,6} ` line; at level 2 it resets the current section token to none.
- **Current section of a line** = token of the nearest preceding numbered or appendix heading. A heading line belongs to the section it opens (e.g. the `[DECISION D-12]` in the heading `## 7. …` belongs to `§7`). Lines before the first numbered heading (header table, table of contents) belong to `header`.
- **Section of a heading text** (used for `### 7.3`, `## 4.` etc.): the lines after the heading up to the next heading of the same or higher level.

### 5.2 TECHNICAL-SPEC.md (`docs/source/TECHNICAL-SPEC.md`)

| Oracle | Rule |
|---|---|
| Header cells | The first Markdown table of the file. Row `\| Version \| <v> \|` and row `\| Status \| <s> \|`; value = raw cell text, trimmed, markup kept. Exactly one of each, else sanity failure |
| Spec digest, size | SHA-256 (lowercase hex) and byte length of the raw file bytes |
| Requirement IDs | Lines matching `^\|\s*(FR-[A-Z]{3}-\d{2}\|NFR-\d{2})\s*\|\s*([A-Z])\s*\|`. Group 1 = ID, group 2 = priority, section = current section (§5.1) |
| Requirement group | `FR-<AAA>` for FR IDs, `NFR` for NFR IDs |
| Requirement decision deps | All `\bD-\d{2}\b` tokens on the ID's defining line |
| W IDs | Requirement IDs with priority `W` |
| X IDs | Lines `^\|\s*(X\d+)\s*\|` whose current section is `§3.2`. Decision tag: all `\[DECISION (D-\d{2})` on that line |
| PG IDs | Lines `^\|\s*(PG-\d{2})\s*\|` whose current section is `§8`. Extra trailing cells (the stray `S` of PG-08) are ignored |
| D IDs | Lines `^\|\s*(D-\d{2})\s*\|` whose current section is `§12` |
| D-ID occurrence sections | For every `\bD-\d{2}\b` anywhere in the file, the current section of its line. Deduplicated per D-ID |
| Section tokens | All section tokens of numbered headings |
| Valid ID universe | FR/NFR IDs ∪ PG IDs ∪ X IDs ∪ D IDs (all from the spec) ∪ ADR IDs (§5.4) ∪ section tokens |
| File references (AC-P00-05) | See §5.7 |

Sanity rules (TC-P00-S-01, green at baseline; a red result is a **stop condition** per plan §13, not a deliverable defect):
each requirement ID is defined exactly once; every priority is one of `M`, `S`, `C`, `W`; every requirement's section is a `§5.x` or
`§11` token; every `\b(FR-[A-Z]{3}-\d{2}|NFR-\d{2})\b` token anywhere in the file is a defined ID (wildcards like `FR-PHO-*` and the
range form `FR-LAY-01…06` do not match this regex because of `\b` and the missing second prefix, and are therefore not IDs); X, PG and D
IDs are unique.

### 5.3 Phase plan (`docs/phases/P00/architecture/phase-plan.md`) — formats and anchors

The plan is the oracle for **formats** and for the **anchor and seed tables**. Every item below is parsed at run time. If a parse
yields nothing, the sources test fails with `PLAN_FORMAT_CHANGED` (stop and ask the Architect).

| Item | Location in plan | Parse rule |
|---|---|---|
| Baseline date | Header table row `Baseline date` | Cell value |
| GOV paths | §6 table, rows `GOV-0n` | Backticked path in the Path cell |
| H2 headings per GOV file | §7.2–§7.6: heading line `^### 7\.[2-6] .*` with backticked `docs/phases/P00/governance/<file>.md`; line starting `Required H2 headings:` | `` `(## [^`]+)` `` in order |
| Named-table headers | Same sections; line `^\*\*(<Name>)\*\* table header:` | First `` `(\|[^`]+\|)` `` on that line, else on the next line. `<Name>` equals the H2 text the table belongs to |
| Verification vocabulary | §7.1 item 5 line | Backticked lowercase words |
| Deadline regex | §7.1 item 6 line | The backticked text starting with `^before` |
| Decider vocabulary | §7.1 item 8 line | Backticked value(s) |
| Preparer roles | §7.1 item 9 line | Backticked values inside `{…}` |
| Owner-acceptance marker | §7.1 item 10 line | The backticked text starting with `^- Accepted` |
| Placeholder tokens | §7.1 item 11 line | Backticked tokens |
| PII regexes | §7.1 item 12 line | The two backticked regexes (e-mail, phone), used verbatim |
| Citation documents | §7.1 item 13 line | Backticked `*.md` names; `Pxx/PHASE.md` means `P(0\d\|1[0-5])/PHASE.md` |
| Vocabularies | Lines containing `∈ {` in §7.2 (Kind, Authority, Personal data), §7.4 (Status), §7.5 (Release blocker), §7.6 (Type, Blocks P00, Status) | Backticked values inside the braces, scoped by the subsection |
| Phase anchors | §7.3 table with header starting `\| Anchor source \|` | Per row: anchor document = backticked `Pxx/PHASE.md` or `TRACEABILITY.md`; quote = text in `"…"`; rule IDs = `` `FR-[A-Z]{3}-\*` `` wildcards, `FR-[A-Z]{3}-\d{2}…FR-[A-Z]{3}-\d{2}` and `NFR-\d{2}…NFR-\d{2}` ranges (U+2026), single IDs; phase = the `\bP(0\d\|1[0-5])\b` token of the Rule cell (exactly one, else `PLAN_FORMAT_CHANGED`). The `TRACEABILITY.md` row has no IDs and selects the rule of §5.6 |
| Normative-content prefixes | §7.3 line containing `At least one row must cover` | Backticked `§…` tokens in order |
| Deadline anchors | §7.5 table with header starting `\| IDs \|` | IDs = every `\b(D-\d{2}\|ADR-\d{3})\b` in the IDs cell; bound = `≤ (P\d\d)` in the Anchor cell; quote = text in `"…"` of the Source cell (may be absent) |
| Seeds | §7.7 table with header starting `\| Seed \|` | Seed ID from cell 1; key tokens = every backticked text in the Key tokens cell; blocking flag = Finding cell contains `Expected Blocks P00 = yes` |

Wildcards expand to every spec requirement ID with that group prefix. A range expands to the spec-defined IDs with the same prefix
whose number lies between the two endpoints inclusive. Both endpoints must be defined IDs, and every expansion must be non-empty
(sources test TC-P00-10-04).

**Provenance tests** (sources, green at baseline):
- Each phase-anchor quote is a case-sensitive substring of the cited `docs/phases/Pxx/PHASE.md`.
- Each deadline-anchor quote is a substring of the cited register row (`DECISION-REGISTER ADR-nnn "…"`) or of the cited `PHASE.md`. A row without a quote (the `P01/PHASE.md` DoD row) is listed as `NO_QUOTE` in the test output and covered by review item RV-16.
- Every deadline-anchor ID is in the required decision set (§5.4).
- Each normative-content prefix is a spec section token.

### 5.4 Decision register (`docs/blueprint/DECISION-REGISTER.md`)

- Rows: first table with header starting `| ID |`; cells ID, Topic, Current status, Blueprint handling. IDs `ADR-\d{3}`, unique.
- Status vocabulary (sanity): `FIXED`, `REQUIRED`, `PROPOSED`, `OPEN`, `SOURCE-OPEN`.
- **Required decision set** = all D IDs of spec §12 ∪ register rows with status ≠ `FIXED` ∪ `FIXED` rows whose handling contains `OPEN`, `PROPOSED`, `recommended` or `confirm` (case-sensitive substring).
- **Mirror map:** for each register row, every `\bD-\d{2}\b` in its handling → that D-ID's mirror list (baseline: D-12 → ADR-011, ADR-024; D-20 → ADR-012, ADR-032).
- **Recorded status:** of an ADR = its register status; of a D-ID = the common status of its mirrors. Sanity: every D-ID has ≥ 1 mirror and all mirrors of a D-ID share one status (else stop condition).
- **Release-blocker set:** register rows whose handling contains `release blocker` (case-insensitive). The GOV-04 row that contains such an ADR, or its D-ID, must have Release blocker `yes`.

### 5.5 `decisions.md` (`docs/phases/P00/decisions.md`)

- **Snapshot set:** section `### 2.1`: every `D-\d{2}`/`ADR-\d{3}` in cells 1–2 of its first table; section `### 2.2`: every such token in cell 1 of its first table.
- **Owner record (§4):** the lines of section `## 4.` (until the next `## `). Accepted when one line matches the marker regex of §5.3.
- **Delegation:** no format is defined yet (Issue I-05). Until the Architect defines one, no delegation is recognised.

### 5.6 TRACEABILITY.md and PHASE.md files

- `docs/blueprint/TRACEABILITY.md`, first table: group = `^(FR-[A-Z]{3})\b` of cell 1 (rows starting `NFR` are skipped, as the plan's rule covers FR groups only); planned phases = every `\bP(0\d|1[0-5])\b` in cell 2 (`P07/P08` → P07, P08).
- `docs/phases/Pxx/PHASE.md`: read only for quote provenance (§5.3).

### 5.7 Source file references in TECHNICAL-SPEC.md (AC-P00-05)

Scan each spec line with these extractors. Every match is one reference; record line number and the raw text.

| Kind | Regex | Expansion and resolution (against GOV-01 Files paths) |
|---|---|---|
| `img/` and `export/` | `(?<![\w/.-])(img\|export)/([^\s`)\]\|,;]*)`, trailing `.` stripped from group 2 | empty rest → directory `docs/source/<dir>/` must contain ≥ 1 inventoried file; `^\d{2}$` → ≥ 1 file named `NN-*`; `^(\d{2})[–-](\d{2})$` → each number in the inclusive range has a file `NN-*`; `(.*?)(\d+)…(\d+)(.*)` → each expanded name exists; other text with `…` or `*` → `…` becomes `*`, fnmatch (case-sensitive) needs ≥ 1 match; else exact file name |
| Research README | `(?<![\w/.-])README\.md` | `docs/source/README.md` |
| Repository-style paths | `(?<![\w/.-])((?:docs\|\.claude)/[\w./-]+)` | The path relative to `docs/source/` must be an inventoried file. At baseline `docs/cv/valencia/SWE-Dmytro-Vietrov.pdf` and `.claude/skills/hunt/resumegenius.md` do not resolve |

Bare file names such as the FR-PDF-06 output example `SWE-Dmytro-Vietrov.pdf` and the pattern `<sanitized title>.txt` are output
examples, not references, and are not extracted. An unresolved reference passes only if a GOV-05 row with Type `missing-reference`
contains the raw reference text verbatim in any cell (Issue I-07).

## 6. Parsing rules for GOV deliverables

### 6.1 Named tables
A named table is the first Markdown table after its H2 heading and before the next H2. Header row = first `|` line; the separator row
(cells of `-`, `:` and spaces only) is skipped; rows continue until the first non-`|` line. Cells: split the trimmed line on `|`, drop the
first and last empty pieces, trim each cell. Header cells must equal the plan header exactly and in order (`BAD_TABLE_HEADER`). Each
row must have exactly the header's cell count (`ROW_SHAPE`), which also catches a `|` inside a cell.

### 6.2 Cells and lists
- `—` (U+2014) alone means "none". In a list cell, `—` may not be combined with other items (`LIST_FORMAT`).
- List cells split on `,`, items trimmed; an empty item is `LIST_FORMAT`; a duplicate item is `LIST_FORMAT`.
- ID and vocabulary cells (ID columns, Pri, Spec section, Phases, Primary phase, Verification, Decision deps, Kind, Authority, Personal data, Status, Type, Blocks P00, Release blocker, Assignment, Decider, Preparer, Needed by, Deadline, Linked IDs, Linked decision, Seed, Affected IDs) contain no backtick and no `*` (`FORMAT_MARKUP`).
- Phase cells in GOV-02, GOV-03 and GOV-04: `^P(0[1-9]|1[0-5])$`. In GOV-05 OPEN rows `P00` is also allowed.
- Section cells: a spec section token (§5.2).

### 6.3 File-level rules (GOV-01…05)
UTF-8 strict, no BOM, no `\r` (`BAD_ENCODING`); first non-empty line starts with `# ` (`MISSING_H1`); the sequence of `## ` headings
equals the plan list exactly and in order (`MISSING_HEADING` for a missing one, `UNEXPECTED_HEADING` for an extra or reordered one).

### 6.4 Finding codes
`MISSING_FILE`, `BAD_ENCODING`, `MISSING_H1`, `MISSING_HEADING`, `UNEXPECTED_HEADING`, `BAD_TABLE_HEADER`, `ROW_SHAPE`, `LIST_FORMAT`,
`FORMAT_MARKUP`, `PLACEHOLDER_TOKEN`, `INVENTORY_MISSING`, `INVENTORY_EXTRA`, `INVENTORY_DUPLICATE`, `BYTES_MISMATCH`,
`BAD_DIGEST_FORMAT`, `SHA256_MISMATCH`, `BAD_VOCAB`, `AUTHORITY_RULE`, `BASELINE_KEY_MISSING`, `BASELINE_MISMATCH`,
`UNRESOLVED_REFERENCE`, `CENSUS_MISMATCH`, `MISSING_ID`, `INVENTED_ID`, `EXTRA_ID`, `DUPLICATE_ID`, `WRONG_PRIORITY`, `WRONG_SECTION`,
`INVALID_SECTION`, `INVALID_PHASE`, `PRIMARY_NOT_IN_PHASES`, `W_WITHOUT_GUARD`, `SUMMARY_LENGTH`, `MISSING_DECISION_DEP`,
`ANCHOR_VIOLATION`, `BAD_DEVIATION_REF`, `UNCOVERED_SECTION`, `EXCLUSION_STATUS`, `MISSING_LINKED_DECISION`, `NO_GUARD_TOKEN`,
`EMPTY_BOUNDARY`, `W_NOT_GUARDED_IN_MATRIX`, `MISSING_SOURCE_SECTION`, `BAD_CITATION`, `SNAPSHOT_MISMATCH`, `BAD_DECIDER`,
`BAD_PREPARER`, `PREPARER_PHASE_MISMATCH`, `BAD_DEADLINE_GRAMMAR`, `DEADLINE_AFTER_NEEDED_BY`, `DEADLINE_AFTER_ANCHOR`,
`RELEASE_BLOCKER_RULE`, `OWNER_ACCEPTANCE_MISSING`, `STATUS_CHANGED`, `FORBIDDEN_STATUS`, `MISSING_RECOMMENDATION_PREFIX`,
`NON_SEQUENTIAL_ID`, `TOO_FEW_CITATIONS`, `EMPTY_AFFECTED`, `HIERARCHY_TYPE_RULE`, `OWNER_EVIDENCE_MISSING`, `MISSING_SEED`,
`DUPLICATE_SEED`, `MISSING_SEED_TOKEN`, `BLOCKER_FLAG_RULE`, `GATE_OPEN_BLOCKER`, `OWNER_RECORD_MISSING`, `OWNER_RECORD_INCOMPLETE`,
`PHASE_STATUS_NOT_COMPLETED`, `PII_EMAIL`, `PII_PHONE`, `PLAN_FORMAT_CHANGED`, `ANCHOR_PROVENANCE` (an anchor quote, range endpoint or expansion
that cannot be found in its cited source; reported by the sources tests TC-P00-10-04 and TC-P00-16-02).

### 6.5 Citations (GOV-04 Source sections, GOV-05 Sources, Evidence)
Split on `;`, trim. Each citation must match `^(<doc>) (<location>)$` where `<doc>` is a citation document (§5.3) and `<location>` is
`§\d+(?:\.\d+)?`, `header`, `App\. [AB]`, or a row ID `ADR-\d{3}|FR-[A-Z]{3}-\d{2}|NFR-\d{2}|PG-\d{2}|X\d{1,2}|D-\d{2}` (`BAD_CITATION`).
Resolution (plan §7.6 "exact sections"): a `§` location must be a numbered heading of that document; `App. X` an appendix heading of
that document; an `ADR-` row ID only with `DECISION-REGISTER.md` and defined there; other row IDs only with `TECHNICAL-SPEC.md` and
defined there; `header` is valid for any document. Document paths: `TECHNICAL-SPEC.md`, `README.md`, `reference/README.md` →
`docs/source/…`; Blueprint names → `docs/blueprint/…`; `CLAUDE.md` → repository root; `Pxx/PHASE.md` → `docs/phases/Pxx/PHASE.md`.

## 7. Test case catalogue

Columns: **Kind** = `real` (real repository, `test_real_*`), `sources` (real sources only, `test_sources_*`), `self` (fixtures,
`test_selftest_*`), `gate` (`gate_p00.py`), `proc` (procedure by main session/QA), `review`. **Case** = P positive, N negative, B boundary.
**Red** = expected result in the red state (tests written, GOV files missing).

### AC-P00-01 Deliverables present

| TC | Kind | Case | Check | Red |
|---|---|---|---|---|
| TC-P00-01-01 | real | P | The seven Architect artifacts named in the AC-P00-01 row (`architecture/phase-plan.md`, `decisions.md`, `dependencies.md`, `acceptance-criteria.md`, `implementation/backend-tasks.md`, `implementation/frontend-tasks.md`, `implementation/governance-tasks.md`, relative to `docs/phases/P00/`) exist, decode as UTF-8, start with an H1 and have ≥ 1 non-heading, non-empty line; no placeholder token **after removing inline code spans** `` `[^`\n]*` `` (Issue I-02, I-03). A provenance assertion checks that each path appears backticked in the AC-P00-01 row | PASS |
| TC-P00-01-02 | real | P/N | GOV-01…05 exist at the §6 paths; file-level rules §6.3; every named table present with its exact header and row shape (§6.1) | FAIL `MISSING_FILE` ×5 |
| TC-P00-01-03 | real | N | No placeholder token in any GOV file, raw text, inline code **not** stripped; tokens are case-sensitive substrings; `TBD`, `TODO`, `FIXME` additionally need word boundaries (`\bTBD\b`) | FAIL `MISSING_FILE` |
| TC-P00-01-04 | sources | P | Plan format parse (§5.3) yields for each of §7.2–§7.6 a path, ≥ 2 H2 headings and ≥ 1 table header, and the paths equal the §6 GOV paths | PASS |
| Self | self | N/B | NF-12a–d, NF-20…NF-24 (§8.3) | PASS |

### AC-P00-02 Inventory completeness

| TC | Kind | Case | Check | Red |
|---|---|---|---|---|
| TC-P00-02-01 | real | P/N | Set of `Path` cells in GOV-01 Files = `Repo.list_files("docs/source")` prefixed `docs/source/`. Codes `INVENTORY_MISSING`, `INVENTORY_EXTRA` (listed but not on disk), `INVENTORY_DUPLICATE` | FAIL `MISSING_FILE` |
| Self | self | N | NF-25a–c | PASS |

### AC-P00-03 Inventory integrity

| TC | Kind | Case | Check | Red |
|---|---|---|---|---|
| TC-P00-03-01 | real | P/N | Per Files row: `Bytes` is `^\d+$` and equals the file size; `SHA-256` matches `^[0-9a-f]{64}$` (`BAD_DIGEST_FORMAT`) and equals the `hashlib.sha256` digest of the bytes (`SHA256_MISMATCH`) | FAIL `MISSING_FILE` |
| Self | self | N/B | NF-11a–c | PASS |

### AC-P00-04 Inventory classification

| TC | Kind | Case | Check | Red |
|---|---|---|---|---|
| TC-P00-04-01 | real | N | Kind, Authority and Personal data values are in the plan §7.2 vocabularies (`BAD_VOCAB`) | FAIL `MISSING_FILE` |
| TC-P00-04-02 | real | N | Exactly one `normative` row and it is `docs/source/TECHNICAL-SPEC.md`; `docs/source/README.md` is `evidence` (`AUTHORITY_RULE`) | FAIL `MISSING_FILE` |
| TC-P00-04-03 | real | P/N | Baseline block: lines `^- (Spec version\|Spec status\|Spec SHA-256\|Baseline date\|File count): (.*)$`, each key exactly once (`BASELINE_KEY_MISSING`); Spec version and Spec status equal the raw header cells (Issue I-08); Spec SHA-256 equals the spec digest; Baseline date equals the plan header value; File count equals the number of files under `docs/source/` (`BASELINE_MISMATCH`) | FAIL `MISSING_FILE` |
| TC-P00-04-04 | sources | P | Spec header has exactly one Version and one Status row | PASS |
| Self | self | N | NF-26a–e | PASS |

### AC-P00-05 Source references resolve

| TC | Kind | Case | Check | Red |
|---|---|---|---|---|
| TC-P00-05-01 | sources | P | The extractors of §5.7 find ≥ 1 reference of each kind (`img/`, `export/`, `README.md`, a `docs/` path, a `.claude/` path); the test prints the count, it does not assert a number | PASS |
| TC-P00-05-02 | real | P/N | Every extracted reference resolves against the GOV-01 paths, or its raw text appears in a GOV-05 row of Type `missing-reference` (`UNRESOLVED_REFERENCE`, location = spec line number) | FAIL `MISSING_FILE` |
| Self | self | N/B | NF-27a–c; the fixture spec contains every reference form (§8.1) | PASS |

### AC-P00-06 ID census

| TC | Kind | Case | Check | Red |
|---|---|---|---|---|
| TC-P00-06-01 | real | P/N | Census table: the Group set equals the computed groups plus `Total`; for each row Count, M, S, C, W are `^\d+$` and equal the recomputed values (`CENSUS_MISMATCH`); the `Total` row equals the column sums of the computed values (not of the table) | FAIL `MISSING_FILE` |
| Self | self | N | NF-28a, NF-28b (source drift) | PASS |

### AC-P00-07 Traceability completeness

| TC | Kind | Case | Check | Red |
|---|---|---|---|---|
| TC-P00-S-01 | sources | P | Spec sanity rules of §5.2 | PASS |
| TC-P00-07-01 | real | P/N | Set of `Req ID` in GOV-02 Requirements = spec requirement IDs; codes `MISSING_ID` (orphan), `INVENTED_ID` (not defined in the spec), `DUPLICATE_ID` | FAIL `MISSING_FILE` |
| Self | self | N | NF-01, NF-02, NF-03, NF-28b | PASS |

### AC-P00-08 Traceability row validity

| TC | Kind | Case | Check | Red |
|---|---|---|---|---|
| TC-P00-08-01 | real | N | Pri equals spec priority (`WRONG_PRIORITY`); Spec section equals the defining section (`WRONG_SECTION`) | FAIL `MISSING_FILE` |
| TC-P00-08-02 | real | N/B | Phases is a non-empty list of `P01`…`P15` (`INVALID_PHASE`, `LIST_FORMAT`); Primary phase is one phase and ∈ Phases (`PRIMARY_NOT_IN_PHASES`) | FAIL `MISSING_FILE` |
| TC-P00-08-03 | real | N | Verification is a non-empty list from the plan vocabulary (`BAD_VOCAB`); rows with spec priority `W` include `guard` (`W_WITHOUT_GUARD`) | FAIL `MISSING_FILE` |
| TC-P00-08-04 | real | B | Summary non-empty and ≤ 120 characters (`len` of the trimmed cell in code points; plan §7.3; Issue I-11) (`SUMMARY_LENGTH`) | FAIL `MISSING_FILE` |
| Self | self | N/B | NF-04, NF-05, NF-06a–e, NF-29a–c | PASS |

### AC-P00-09 Decision dependencies

| TC | Kind | Case | Check | Red |
|---|---|---|---|---|
| TC-P00-09-01 | real | N | For each requirement, every D-ID on its spec defining line is in Decision deps (`MISSING_DECISION_DEP`) | FAIL `MISSING_FILE` |
| TC-P00-09-02 | real | N | Decision deps is `—` or a list of `D-\d{2}`/`ADR-\d{3}` tokens, each defined (spec §12 or register) (`INVENTED_ID`; Issue I-09) | FAIL `MISSING_FILE` |
| Self | self | N | NF-30a–b | PASS |

### AC-P00-10 Phase anchors

| TC | Kind | Case | Check | Red |
|---|---|---|---|---|
| TC-P00-10-01 | real | N/B | For each `PHASE.md` anchor (§5.3), every expanded ID's Phases contains the anchor phase, unless its Notes contain `deviation: (SC-\d{2})` (`ANCHOR_VIOLATION`) | FAIL `MISSING_FILE` |
| TC-P00-10-02 | real | N | For each TRACEABILITY.md FR group row (§5.6), every GOV-02 ID of that group has Phases ∩ planned phases ≠ ∅, same deviation exception (`ANCHOR_VIOLATION`) | FAIL `MISSING_FILE` |
| TC-P00-10-03 | real | N | Every `deviation: SC-nn` names an existing GOV-05 Conflict ID (`BAD_DEVIATION_REF`) | FAIL `MISSING_FILE` |
| TC-P00-10-04 | sources | P | Anchor provenance and expansion sanity (§5.3); TRACEABILITY rows parse with ≥ 1 phase | PASS |
| Self | self | N/B | NF-31a–d | PASS |

### AC-P00-11 Normative content without FR/NFR IDs

| TC | Kind | Case | Check | Red |
|---|---|---|---|---|
| TC-P00-11-01 | real | N | Pagination rules: Rule ID set = spec PG IDs (`MISSING_ID`, `INVENTED_ID`, `DUPLICATE_ID`); Spec section `§8` (`WRONG_SECTION`); Phases, Primary phase, Verification as TC-P00-08-02/03 | FAIL `MISSING_FILE` |
| TC-P00-11-02 | real | N/B | Normative content table: every Spec section cell is a spec section token (`INVALID_SECTION`); each required prefix (§5.3) is covered by ≥ 1 row whose section equals it or starts with it plus `.` (`UNCOVERED_SECTION`; `§5.1` does not cover `§5.10`); row rules as TC-P00-08-02/03 | FAIL `MISSING_FILE` |
| TC-P00-11-03 | sources | P | Each required prefix is a spec section token | PASS |
| Self | self | N/B | NF-32a–d | PASS |

### AC-P00-12 Exclusion register completeness

| TC | Kind | Case | Check | Red |
|---|---|---|---|---|
| TC-P00-12-01 | real | N | Excl ID set = spec X IDs ∪ W IDs, each once (`MISSING_ID`, `INVENTED_ID`, `DUPLICATE_ID`) | FAIL `MISSING_FILE` |
| TC-P00-12-02 | real | N | X rows with a decision tag: Status `EXCLUDED-PENDING-DECISION` and Linked decision contains every tagged D-ID; all other rows `EXCLUDED`, Linked decision `—` or valid D/ADR IDs (`EXCLUSION_STATUS`, `MISSING_LINKED_DECISION`, `INVENTED_ID`, `BAD_VOCAB`) | FAIL `MISSING_FILE` |
| TC-P00-12-03 | real | N/B | Source section `§3.2` for X rows, the defining section for W rows (`WRONG_SECTION`); Guard phases non-empty ⊆ `P01`…`P15` (`INVALID_PHASE`); Guard verification contains `\b(review\|contract\|component\|e2e\|guard)\b` (`NO_GUARD_TOKEN`) and, after removing those tokens and punctuation, ≥ 2 further words (plan §7.4 "plus a concrete description"; `NO_GUARD_TOKEN`); Allowed boundary non-empty and not `—` (`EMPTY_BOUNDARY`; Issue I-04) | FAIL `MISSING_FILE` |
| TC-P00-12-04 | real | N | Every W ID is a GOV-02 row whose Verification includes `guard` (`W_NOT_GUARDED_IN_MATRIX`) | FAIL `MISSING_FILE` |
| TC-P00-12-05 | real | N | Implied exclusions: Source cell contains ≥ 1 valid-universe token, and every token matching the FR/NFR/PG/X/D/ADR patterns is in the universe (`INVENTED_ID`); research codes such as `F42` are not checked; Guard phases valid (`INVALID_PHASE`) | FAIL `MISSING_FILE` |
| Self | self | N/B | NF-33a–g | PASS |

### AC-P00-13 Exclusion guards are meaningful — review

Not automated (judgement). Performed by the **Code Reviewer**, re-checked by **QA**, with written findings in `review/code-review.md`
and `qa-report.md`. Checklist RV-13 in §12. Automated support: TC-P00-12-03 (token and description present).

### AC-P00-14 Decision register completeness

| TC | Kind | Case | Check | Red |
|---|---|---|---|---|
| TC-P00-14-01 | real | N | Multiset of Primary ID ∪ Linked IDs = required set (§5.4), each once: `MISSING_ID`, `DUPLICATE_ID`, `EXTRA_ID` (defined but not required, e.g. ADR-001), `INVENTED_ID` (not defined) | FAIL `MISSING_FILE` |
| TC-P00-14-02 | real | N | Each D-ID is a Primary ID and its mirrors are in that row's Linked IDs (`MISSING_ID` with location of the row). Source sections: valid citations (§6.5, `BAD_CITATION`); D rows include `TECHNICAL-SPEC.md §12` and `TECHNICAL-SPEC.md <s>` for every occurrence section `<s>` of that D-ID (an occurrence in `header` requires `TECHNICAL-SPEC.md header`); each ADR in the row (Primary or Linked) has `DECISION-REGISTER.md <ADR-ID>` (`MISSING_SOURCE_SECTION`) | FAIL `MISSING_FILE` |
| TC-P00-14-03 | sources | P | Required set (§5.4) = `decisions.md` §2 snapshot set (§5.5) (`SNAPSHOT_MISMATCH`) | PASS |
| TC-P00-14-04 | sources | P | Register sanity (§5.4): unique IDs, statuses in vocabulary, every §12 D-ID has mirrors with one common status | PASS |
| Self | self | N | NF-34a–f | PASS |

### AC-P00-15 Every open decision has an owner and a deadline

| TC | Kind | Case | Check | Red |
|---|---|---|---|---|
| TC-P00-15-01 | real | N | Decider = `Product owner` (`BAD_DECIDER`; delegation not recognised, Issue I-05) | FAIL `MISSING_FILE` |
| TC-P00-15-02 | real | N/B | Preparer `^(Solution Architect\|Contract Architect\|Test Architect) \((P(0[1-9]\|1[0-5]))\)$` (role list from the plan) (`BAD_PREPARER`); Preparer phase = Deadline phase (`PREPARER_PHASE_MISMATCH`) | FAIL `MISSING_FILE` |
| TC-P00-15-03 | real | N/B | Needed by `^P(0[1-9]\|1[0-5])$` (`INVALID_PHASE`); Deadline matches the plan regex (`BAD_DEADLINE_GRAMMAR`) and names `P01`…`P15` (`INVALID_PHASE`; Issue I-13); ordering: m ≤ n, and m = n only with `implementation` (`DEADLINE_AFTER_NEEDED_BY`) | FAIL `MISSING_FILE` |
| TC-P00-15-04 | real | N | Release blocker ∈ plan vocabulary (`BAD_VOCAB`); the row containing a release-blocker ADR (§5.4) or its D-ID is `yes` (`RELEASE_BLOCKER_RULE`; Issue I-10) | FAIL `MISSING_FILE` |
| TC-P00-15-05 | real | N | Assignment ∈ {`PROPOSED`, `OWNER-ACCEPTED`} (`BAD_VOCAB`); `OWNER-ACCEPTED` only if `decisions.md` §4 has the marker line (`OWNER_ACCEPTANCE_MISSING`) | FAIL `MISSING_FILE` |
| Self | self | N/B | NF-07a–d, NF-08c–d, NF-35a–h | PASS |

### AC-P00-16 Deadline anchors

| TC | Kind | Case | Check | Red |
|---|---|---|---|---|
| TC-P00-16-01 | real | N/B | For each deadline anchor (§5.3), the GOV-04 row containing any anchor ID has Deadline phase m < bound, or m = bound with `implementation` (`DEADLINE_AFTER_ANCHOR`) | FAIL `MISSING_FILE` |
| TC-P00-16-02 | sources | P | Deadline-anchor provenance (§5.3) | PASS |
| Self | self | N/B | NF-08a–b; valid fixture holds an anchor met exactly at the boundary (`before P01 implementation` for bound P01) | PASS |

### AC-P00-17 No silent closure

| TC | Kind | Case | Check | Red |
|---|---|---|---|---|
| TC-P00-17-01 | real | N | Status equals the recorded status (§5.4) of the row's Primary ID (`STATUS_CHANGED`); Status contains no `\b(ACCEPTED\|DECIDED\|CLOSED\|RESOLVED)\b`, case-insensitive (`FORBIDDEN_STATUS`) | FAIL `MISSING_FILE` |
| TC-P00-17-02 | real | N | Source recommendation starts with `Recommendation only:` (`MISSING_RECOMMENDATION_PREFIX`) | FAIL `MISSING_FILE` |
| TC-P00-17-03 | proc | N | No path under `./docs/blueprint/decisions/` was created or changed relative to the pre-phase snapshot: SCOPE-03 (§11) | PASS (procedure) |
| Self | self | N | NF-09a–b, NF-36 | PASS |

### AC-P00-18 Source-conflict log validity

| TC | Kind | Case | Check | Red |
|---|---|---|---|---|
| TC-P00-18-01 | real | N | Conflict IDs, in table order, are exactly `SC-01`, `SC-02`, … (two digits, no gap, no duplicate) (`NON_SEQUENTIAL_ID`) | FAIL `MISSING_FILE` |
| TC-P00-18-02 | real | N | Type, Status and Blocks P00 in the plan §7.6 vocabularies (`BAD_VOCAB`) | FAIL `MISSING_FILE` |
| TC-P00-18-03 | real | N/B | Sources: ≥ 2 citations (`TOO_FEW_CITATIONS`), each valid and resolvable (§6.5, `BAD_CITATION`) | FAIL `MISSING_FILE` |
| TC-P00-18-04 | real | N | Affected IDs non-empty list (`EMPTY_AFFECTED`), each in the valid ID universe (`INVENTED_ID`) | FAIL `MISSING_FILE` |
| TC-P00-18-05 | real | N | `RESOLVED-BY-HIERARCHY` only with Type `spec-vs-research` (`HIERARCHY_TYPE_RULE`); `RESOLVED-BY-OWNER` needs Evidence that contains `decisions.md §4` (then §4 must hold the marker) or a valid citation of `TECHNICAL-SPEC.md`, `README.md` or `reference/README.md` (`OWNER_EVIDENCE_MISSING`) | FAIL `MISSING_FILE` |
| TC-P00-18-06 | real | N/B | OPEN rows: Decider, Preparer, Needed by and Deadline follow TC-P00-15-01…03 except that `P00` is allowed in Preparer, Needed by and Deadline (`BAD_DECIDER`, `BAD_PREPARER`, `PREPARER_PHASE_MISMATCH`, `INVALID_PHASE`, `BAD_DEADLINE_GRAMMAR`, `DEADLINE_AFTER_NEEDED_BY`). Non-OPEN rows may hold `—` there | FAIL `MISSING_FILE` |
| Self | self | N/B | NF-37a–j | PASS |

### AC-P00-19 Seeded conflicts recorded

| TC | Kind | Case | Check | Red |
|---|---|---|---|---|
| TC-P00-19-01 | real | N | Each seed (§5.3) is the Seed cell of exactly one row (`MISSING_SEED`, `DUPLICATE_SEED`; a Seed cell value that is not a plan seed is `INVENTED_ID`). Key-token match (`MISSING_SEED_TOKEN`), see rule below | FAIL `MISSING_FILE` |
| TC-P00-19-02 | sources | P | Seeds parse as `K-01`…`K-nn` without gap, each with ≥ 1 key token; every key token is an ID or section of the valid universe, a citation-document name, or `<doc> <location>` with a known document | PASS |
| Self | self | N | NF-10a–c | PASS |

Key-token match rule (Issue I-16). Let C = the row's citations (§6.5, whitespace-normalised) and A = its Affected IDs. A key token k matches when any holds:
1. k ∈ A;
2. k ∈ C (exact, e.g. `ARCHITECTURE.md §6` does **not** match `ARCHITECTURE.md §6.1`);
3. k is a bare citation document (e.g. `DECISION-REGISTER.md`, `TRACEABILITY.md`, `reference/README.md`) and some citation in C has that document;
4. k is a bare section token (e.g. `§6.2`) and `TECHNICAL-SPEC.md k` ∈ C;
5. k is a row ID and some citation in C has location k.

### AC-P00-20 No P00-blocking conflict left open — gate

| TC | Kind | Case | Check | Red |
|---|---|---|---|---|
| TC-P00-20-01 | gate | N | No GOV-05 row has Blocks P00 = `yes` and Status `OPEN` (`GATE_OPEN_BLOCKER`, location = Conflict ID). A missing GOV-05 is `MISSING_FILE` (never a vacuous pass) | FAIL `MISSING_FILE`; after GOV-05 is written: FAIL `GATE_OPEN_BLOCKER` for the K-12 row, until Q-1 is answered |
| TC-P00-20-02 | real | N | Anti-bypass: the row of each seed whose plan Finding says `Expected Blocks P00 = yes` (K-12) has Blocks P00 = `yes` (`BLOCKER_FLAG_RULE`). Issue I-06 | FAIL `MISSING_FILE` |
| TC-P00-20-03 | self | P/N | Gate logic on fixtures: valid fixture passes TC-P00-20-01; NF-38a fails it; NF-38b fails TC-P00-20-02. Static check: `gate_p00.py` exists, defines TC-P00-20-01 and TC-P00-25-01, and uses no skip or expected-failure construct | PASS |

Reporting rules: §10.

### AC-P00-21 Scope and baseline integrity

| TC | Kind | Case | Check | Red |
|---|---|---|---|---|
| TC-P00-21-01 | real | P | `subprocess.run([sys.executable, "-B", "scripts/check-blueprint.py"], cwd=<repo root>)` exits 0 and stdout contains `Blueprint structure OK` | PASS |
| SCOPE-01…04 | proc | N | Snapshot comparison by the main session (after each role) and by QA (whole phase), §11 | PASS (procedure) |

### AC-P00-22 Checks are meaningful and deterministic

| TC | Kind | Case | Check | Red |
|---|---|---|---|---|
| TC-P00-22-01 | self | P | The minimal valid fixture (§8.1) gives **zero** findings in every check, gate checks included. This proves the checks do not fail by default | PASS |
| TC-P00-22-02 | self | N | For each mutation NF-xx (§8.3, one `subTest` per NF ID): the target check reports at least one finding with the expected code (and location where given). Every class listed in AC-P00-22 has ≥ 1 NF | PASS |
| TC-P00-22-03 | self | P | Formats parsed from the fixture plan (H2 lists, table headers, vocabularies, regexes, citation documents) equal those parsed from the real plan, so fixtures cannot drift from the real format | PASS |
| TC-P00-22-04 | self | P | In-process determinism: each check run twice on the valid fixture and on every NF mutation returns identical, sorted finding lists | PASS |
| TC-P00-22-05 | self | P | Subprocess determinism: `p00_cli.py --root <fixture>` and `p00_cli.py --root <fixture> --mutation NF-11a`, each run with env (`PYTHONHASHSEED=0`, `LC_ALL=C.UTF-8`) and (`PYTHONHASHSEED=1`, `LC_ALL=C`), `PYTHONIOENCODING=utf-8`, give byte-identical stdout and identical exit codes (0 and 1) | PASS |
| TC-P00-22-06 | self | N | Static `ast` scan of every `*.py` under `docs/phases/P00/tests/`: each imported top-level module is in `sys.stdlib_module_names` or is a local `p00_*` module; forbidden: `socket`, `ssl`, `http`, `urllib`, `ftplib`, `smtplib`, `poplib`, `imaplib`, `xmlrpc`, `asyncio`, `random`, `secrets`, `uuid`, `time`, `datetime`, `zoneinfo`, `locale`; `subprocess` only in `test_selftest_determinism.py` and `test_real_common.py`; no `skip`, `skipIf`, `skipUnless`, `SkipTest`, `expectedFailure` names | PASS |
| TC-P00-22-07 | self | N | Read-only: static scan of `p00_*.py` finds no `open(` with a mode containing `w`, `a`, `x` or `+`, and no `write_text`, `write_bytes`, `mkdir`, `unlink`, `rmdir`, `.rename(`, `os.replace`, `shutil`, `tempfile`. Runtime read-only is proven by DET-02 (§9.3) | PASS |
| TC-P00-22-08 | self | P | Sorting: every check's result equals `sorted(result)`; `Repo.list_files` returns code-point-sorted paths | PASS |
| DET-01, DET-02 | proc | P | Command-level double run and read-only snapshot, §9.3 | PASS (procedure) |

### AC-P00-23 No personal contact data copied

| TC | Kind | Case | Check | Red |
|---|---|---|---|---|
| TC-P00-23-01 | real | N | Every file under `docs/phases/P00/governance/` (recursive, any extension) has no match of the plan e-mail regex (`PII_EMAIL`) or phone regex (`PII_PHONE`). An empty or missing directory is `MISSING_FILE` | FAIL `MISSING_FILE` |
| TC-P00-23-02 | real | N | Supplementary (Issue I-12): every `*.md` under `docs/phases/P00/` has no match of either regex | PASS |
| Self | self | N/B | NF-13a–c | PASS |

### AC-P00-24 Out-of-scope proposals recorded, not applied — review

Not automated. **Code Reviewer** checklist RV-24 (§12) with evidence from SCOPE-01…04. QA re-checks.

### AC-P00-25 Owner gate acceptance recorded — gate

| TC | Kind | Case | Check | Red |
|---|---|---|---|---|
| TC-P00-25-01 | gate | N | `decisions.md` §4 has the marker line (`OWNER_RECORD_MISSING`), mentions each of `Q-1`…`Q-5` and `PD-P00-03`, `PD-P00-04`, `PD-P00-05` (`OWNER_RECORD_INCOMPLETE`; Issue I-14); `PHASE-STATUS.md` has a line `^Status: (COMPLETED\|COMPLETED_WITH_APPROVED_EXCEPTIONS)$` (`PHASE_STATUS_NOT_COMPLETED`) | FAIL `OWNER_RECORD_MISSING`, `PHASE_STATUS_NOT_COMPLETED` |
| GATE-25 | gate | — | **QA and owner** confirm that the record reflects the owner's actual answers and acceptance (judgement; the automated check proves only presence) | — |

## 8. Fixtures

### 8.1 Minimal valid fixture `fixtures/minimal-repo/`

A synthetic mini-repository with the same relative paths as the real one. It is static, is valid for **every** check (including the
gate checks), and is the base for all mutations. It contains no real names, contact data or copied deliverable text. Image and PDF
files are tiny ASCII placeholder files (e.g. 8 bytes `FIXTURE` plus newline); no check reads their content.

| Path (under `minimal-repo/`) | Required content (what it must exercise) |
|---|---|
| `docs/source/TECHNICAL-SPEC.md` | Header table with `Version` (e.g. `9.9 fixture · 2000-01-01`) and a `Status` cell containing `**[DECISION]**` markup; Inputs cell with a link to `README.md`, `img/`, `export/`, a missing `docs/legacy/cv.pdf` and a missing `.claude/skills/fixture/notes.md`. Headings `## 1.`, `## 2.` (principles text), `## 3.`/`### 3.2` with X1 (no tag) and X2 tagged `**[DECISION D-03]**`; `## 5.`/`### 5.1` with FR-AAA-01 (M, tagged `[DECISION D-01]`) and FR-AAA-02 (W); `### 5.2` with FR-BBB-01 (S) and FR-BBB-02 (C); `## 6.`/`### 6.1` with a non-table line containing `[DECISION D-02]`; `## 7.`; `## 8.` with PG-01 and PG-02, where PG-02 has a stray third cell `S`; `## 9.`; `## 10.`; `## 11.` with NFR-01 (M, tagged `[DECISION D-02]`); `## 12.` with D-01…D-03; `## Appendix A.` with `img/02-beta.png`. References in requirement or appendix text covering every §5.7 form: `img/01`, `img/01–03`, `img/03-gamma.png`, `img/09-ref-1…2.png`, `img/09-*`, `img/09-…-2.png`, `export/sample.txt`, `img/`, `export/` |
| `docs/source/README.md` | Mini research text with `## 1.`, `## 2.` and `## Appendix B.` headings |
| `docs/source/img/` | `01-alpha.png`, `02-beta.png`, `03-gamma.png`, `09-ref-1.png`, `09-ref-2.png` |
| `docs/source/export/sample.txt`, `docs/source/reference/README.md`, `docs/source/reference/cv-sample.pdf` | Placeholders; the reference README marks `cv-sample.pdf` as holding (synthetic) personal data |
| `docs/blueprint/DECISION-REGISTER.md` | ADR-001 `FIXED` "One repository" (excluded: no open aspect); ADR-002 `FIXED` "Version OPEN" (included); ADR-003 `PROPOSED` "Confirm in P01"; ADR-004 `SOURCE-OPEN` "D-01; release blocker"; ADR-005 `SOURCE-OPEN` "D-02"; ADR-006 `SOURCE-OPEN` "D-02; same decision as ADR-005" (second mirror); ADR-007 `SOURCE-OPEN` "D-03; excluded v1"; ADR-008 `OPEN` "Needed by P03". Required set = D-01…D-03, ADR-002…ADR-008 |
| `docs/blueprint/TRACEABILITY.md` | Rows `FR-AAA alpha` → `P03`; `FR-BBB beta` → `P04/P05`; `NFR all` → `P05` (skipped by the rule) |
| `docs/phases/P02/PHASE.md`, `P03/PHASE.md`, `P04/PHASE.md` | Contain the quotes used by the fixture anchors (e.g. "D-01 gate", "FR-AAA scope", "FR-BBB-01…02 and NFR-01") |
| `docs/phases/P00/architecture/phase-plan.md` | Header table with `Baseline date`; §6 GOV rows; §7.1 items 5, 6, 8–13 and §7.2–§7.6 format text identical to the real plan (TC-P00-22-03); §7.3 anchors: `P03/PHASE.md` → every `FR-AAA-*` lists P03; `P04/PHASE.md` → FR-BBB-01…FR-BBB-02, NFR-01 list P04; a `TRACEABILITY.md` row; normative prefixes `§2`, `§6`, `§9`. §7.5 anchors: ADR-003 ≤ P01 ("Confirm in P01"); D-01 (ADR-004) ≤ P02 ("D-01 gate"). §7.7 seeds: K-01 with key tokens `FR-AAA-01`, `D-01`, `README.md §2`; K-02 with key tokens `TECHNICAL-SPEC.md header`, `DECISION-REGISTER.md` and Finding text `**Expected Blocks P00 = yes**` |
| `docs/phases/P00/acceptance-criteria.md` | A table row `AC-P00-01` with the seven Architect paths in backticks (for TC-P00-01-01 provenance) |
| `docs/phases/P00/decisions.md`, `architecture/…`, `dependencies.md`, `implementation/*.md` | Short valid Architect artifacts. `decisions.md` has §2.1/§2.2 snapshot tables equal to the required set and a §4 starting with `- Accepted by owner on 2000-01-02` that mentions Q-1…Q-5 and PD-P00-03/04/05 |
| `docs/phases/P00/PHASE-STATUS.md` | `Status: COMPLETED` |
| `docs/phases/P00/governance/source-inventory.md` | Valid GOV-01: one row per fixture source file with real sizes and digests of the fixture files (computed once with `hashlib` and pasted), census of the fixture spec (two FR groups plus NFR; all four priorities) |
| `…/requirements-traceability.md` | Valid GOV-02. NFR-01 lists `P05` but not the anchored `P04`, with Notes `deviation: SC-01` (positive deviation boundary). A Summary of exactly 120 characters (length boundary). FR-AAA-02 (W) has `guard` |
| `…/exclusion-register.md` | Valid GOV-03: X1 `EXCLUDED`, X2 `EXCLUDED-PENDING-DECISION` with D-03, FR-AAA-02 `EXCLUDED`; one implied-exclusion row citing `FR-BBB-01` and one citing `§9 F42`-style text |
| `…/decision-owner-register.md` | Valid GOV-04: rows D-01 (Linked ADR-004, release blocker `yes`, Needed by P02, Deadline `before P02 implementation`, Preparer `Solution Architect (P02)`); D-02 (Linked ADR-005, ADR-006; Source sections include §6.1, §11, §12); D-03 (Linked ADR-007; §3.2, §12); ADR-002; ADR-003 (Deadline `before P01 implementation`, Assignment `OWNER-ACCEPTED`); ADR-008 |
| `…/source-conflict-log.md` | Valid GOV-05: SC-01 (K-01, `spec-vs-research`, `OPEN`, Blocks `no`); SC-02 (K-02, `ambiguity`, `RESOLVED-BY-OWNER`, Blocks `yes`, Evidence `decisions.md §4`); SC-03 (no seed, `missing-reference`, contains `docs/legacy/cv.pdf` and `.claude/skills/fixture/notes.md`, `OPEN`, Preparer `Solution Architect (P00)`, Needed by `P00`, Deadline `before P00 gate`: P00 boundary); SC-04 (`spec-vs-research`, `RESOLVED-BY-HIERARCHY`) |

### 8.2 Fixture rules
- Static files only; never regenerated by a test. If the Test Engineer edits a fixture source file, the fixture GOV-01 digests must be recomputed in the same change, or TC-P00-22-01 fails.
- The fixture contains no e-mail address and no `+` followed by digits. PII mutations are built at run time from parts (for example the strings `jane.roe`, `@` and `example.invalid` joined in code), so no file on disk holds a PII-like string.
- No mutation writes to disk: each NF is a pure function from the fixture text to the mutated text, applied through `Repo(overrides=…)`.

### 8.3 Mutation catalogue (negative and boundary fixtures)

"Target" is the TC whose check must report the code. Rows marked **AC-22** cover the mandatory negative classes of AC-P00-22.
Boundary rows marked "passes" assert **zero** findings for the target check.

| NF | AC-22 class | Mutation (single change to the valid fixture) | Target | Expected |
|---|---|---|---|---|
| NF-01 | **missing ID** | GOV-02: delete the FR-AAA-02 row | TC-P00-07-01 | `MISSING_ID` FR-AAA-02 |
| NF-02 | **invented ID** | GOV-02: copy a row as `FR-ZZZ-99` | TC-P00-07-01 | `INVENTED_ID` FR-ZZZ-99 |
| NF-03 | **duplicate ID** | GOV-02: duplicate the FR-AAA-01 row | TC-P00-07-01 | `DUPLICATE_ID` |
| NF-04 | **wrong priority** | GOV-02: FR-BBB-01 Pri `S` → `M` | TC-P00-08-01 | `WRONG_PRIORITY` |
| NF-05 | **wrong section** | GOV-02: FR-BBB-01 `§5.2` → `§5.1` | TC-P00-08-01 | `WRONG_SECTION` |
| NF-06a | **invalid phase** | GOV-02: a Phases item `P16` | TC-P00-08-02 | `INVALID_PHASE` |
| NF-06b | invalid phase | GOV-02: Phases item `P00` | TC-P00-08-02 | `INVALID_PHASE` |
| NF-06c | invalid phase | GOV-02: Phases item `P3` | TC-P00-08-02 | `INVALID_PHASE` |
| NF-06d | — | GOV-02: Primary phase not in Phases | TC-P00-08-02 | `PRIMARY_NOT_IN_PHASES` |
| NF-06e | — | GOV-02: Phases `P03,,P04` | TC-P00-08-02 | `LIST_FORMAT` |
| NF-07a | **bad deadline grammar** | GOV-04: ADR-008 Deadline `before P03` | TC-P00-15-03 | `BAD_DEADLINE_GRAMMAR` |
| NF-07b | bad deadline grammar | Deadline `Before P03 implementation` (case) | TC-P00-15-03 | `BAD_DEADLINE_GRAMMAR` |
| NF-07c | bad deadline grammar | Deadline `2000-12-01` | TC-P00-15-03 | `BAD_DEADLINE_GRAMMAR` |
| NF-07d | boundary | Deadline `before P00 implementation` in GOV-04 | TC-P00-15-03 | `INVALID_PHASE` |
| NF-08a | **deadline after anchor** | GOV-04: ADR-003 Deadline `before P02 implementation`, Preparer `(P02)`, Needed by `P02` | TC-P00-16-01 | `DEADLINE_AFTER_ANCHOR` |
| NF-08b | deadline after anchor (boundary) | GOV-04: ADR-003 Deadline `before P01 gate` | TC-P00-16-01 | `DEADLINE_AFTER_ANCHOR` |
| NF-08c | — | GOV-04: Needed by `P02`, Deadline `before P03 implementation`, Preparer `(P03)` | TC-P00-15-03 | `DEADLINE_AFTER_NEEDED_BY` |
| NF-08d | — (boundary) | GOV-04: Needed by `P03`, Deadline `before P03 gate`, Preparer `(P03)` | TC-P00-15-03 | `DEADLINE_AFTER_NEEDED_BY` |
| NF-09a | **changed decision status** | GOV-04: D-01 Status `SOURCE-OPEN` → `PROPOSED` | TC-P00-17-01 | `STATUS_CHANGED` |
| NF-09b | changed decision status | GOV-04: D-01 Status → `ACCEPTED` | TC-P00-17-01 | `STATUS_CHANGED` and `FORBIDDEN_STATUS` |
| NF-10a | **missing seed** | GOV-05: SC-01 Seed `K-01` → `—` | TC-P00-19-01 | `MISSING_SEED` K-01 |
| NF-10b | missing seed token | GOV-05: remove `README.md §2` from SC-01 Sources (add another valid citation so ≥ 2 remain) | TC-P00-19-01 | `MISSING_SEED_TOKEN` |
| NF-10c | — | GOV-05: SC-04 Seed → `K-01` | TC-P00-19-01 | `DUPLICATE_SEED` |
| NF-11a | **SHA-256 mismatch** | GOV-01: flip the last hex digit of one digest | TC-P00-03-01 | `SHA256_MISMATCH` |
| NF-11b | SHA-256 format | GOV-01: one digest in upper case | TC-P00-03-01 | `BAD_DIGEST_FORMAT` |
| NF-11c | — | GOV-01: one Bytes value plus 1 | TC-P00-03-01 | `BYTES_MISMATCH` |
| NF-12a | **placeholder token** | GOV-03: Notes `TBD` | TC-P00-01-03 | `PLACEHOLDER_TOKEN` |
| NF-12b | placeholder token | GOV-03: Notes `` `TODO` `` in backticks | TC-P00-01-03 | `PLACEHOLDER_TOKEN` (no code-span exemption in GOV files) |
| NF-12c | boundary, passes | Architect artifact `dependencies.md` gains a line quoting `` `TBD` `` in backticks | TC-P00-01-01 | zero findings |
| NF-12d | boundary | Architect artifact `dependencies.md` gains bare `Pending phase execution` | TC-P00-01-01 | `PLACEHOLDER_TOKEN` |
| NF-13a | **PII pattern** (e-mail) | GOV-01 Notes: synthetic address built at run time | TC-P00-23-01 | `PII_EMAIL` |
| NF-13b | PII pattern (phone) | GOV-05 Summary: `+` followed by 11 digits in groups of 2, 4, 3, 2 separated by spaces, built at run time | TC-P00-23-01 | `PII_PHONE` |
| NF-13c | boundary, passes | GOV-02 Notes: an ISO date, a 64-hex digest and the text `round(10×1.2) + 0.5` | TC-P00-23-01 | zero findings |
| NF-20 | — | Delete GOV-04 (override `None`) | TC-P00-01-02 | `MISSING_FILE` |
| NF-21 | — | GOV-03: rename `## Implied exclusions` to `## Implied` | TC-P00-01-02 | `MISSING_HEADING` |
| NF-22 | — | GOV-02: swap header cells `Phases` and `Primary phase` | TC-P00-01-02 | `BAD_TABLE_HEADER` |
| NF-23 | — | GOV-02: a Summary containing `a \| b` | TC-P00-01-02 | `ROW_SHAPE` |
| NF-24 | — | GOV-05 with CRLF line endings; variant with a UTF-8 BOM | TC-P00-01-02 | `BAD_ENCODING` |
| NF-25a | — | GOV-01: delete the `img/02-beta.png` row | TC-P00-02-01 | `INVENTORY_MISSING` |
| NF-25b | — | GOV-01: add a row for `docs/source/img/99-none.png` | TC-P00-02-01 | `INVENTORY_EXTRA` |
| NF-25c | — | GOV-01: duplicate a row | TC-P00-02-01 | `INVENTORY_DUPLICATE` |
| NF-26a | — | GOV-01: Authority `normative` on README.md | TC-P00-04-02 | `AUTHORITY_RULE` |
| NF-26b | — | GOV-01: Kind `photo` | TC-P00-04-01 | `BAD_VOCAB` |
| NF-26c | — | GOV-01: `Spec version:` with one character changed | TC-P00-04-03 | `BASELINE_MISMATCH` |
| NF-26d | — | GOV-01: `File count:` minus 1 | TC-P00-04-03 | `BASELINE_MISMATCH` |
| NF-26e | — | GOV-01: delete the `Spec status:` line | TC-P00-04-03 | `BASELINE_KEY_MISSING` |
| NF-27a | — | GOV-05: change SC-03 Type to `ambiguity` | TC-P00-05-02 | `UNRESOLVED_REFERENCE` (both missing paths) |
| NF-27b | source drift | Spec: add a line referencing `img/77-new.png` | TC-P00-05-02 | `UNRESOLVED_REFERENCE` |
| NF-27c | boundary | Spec: `img/01–04` (04 does not exist) | TC-P00-05-02 | `UNRESOLVED_REFERENCE` |
| NF-28a | — | GOV-01 census: one M count plus 1 | TC-P00-06-01 | `CENSUS_MISMATCH` |
| NF-28b | source drift | Spec: add requirement row `FR-BBB-03 \| M` in §5.2 (GOV unchanged) | TC-P00-07-01, TC-P00-06-01 | `MISSING_ID` FR-BBB-03; `CENSUS_MISMATCH` |
| NF-29a | — | GOV-02: FR-AAA-02 (W) Verification without `guard` | TC-P00-08-03 | `W_WITHOUT_GUARD` |
| NF-29b | — | GOV-02: Verification token `unit-test` | TC-P00-08-03 | `BAD_VOCAB` |
| NF-29c | boundary | GOV-02: Summary of 121 characters | TC-P00-08-04 | `SUMMARY_LENGTH` |
| NF-30a | — | GOV-02: FR-AAA-01 Decision deps `—` | TC-P00-09-01 | `MISSING_DECISION_DEP` D-01 |
| NF-30b | — | GOV-02: Decision deps add `D-99` | TC-P00-09-02 | `INVENTED_ID` |
| NF-31a | — | GOV-02: FR-AAA-01 Phases without `P03`, no deviation | TC-P00-10-01 | `ANCHOR_VIOLATION` |
| NF-31b | — | GOV-02: NFR-01 Notes `deviation: SC-99` | TC-P00-10-03 and TC-P00-10-01 | `BAD_DEVIATION_REF`; `ANCHOR_VIOLATION` |
| NF-31c | — | GOV-02: FR-BBB-02 Phases `P07` only (no ∩ with `P04/P05`) | TC-P00-10-02 | `ANCHOR_VIOLATION` |
| NF-31d | source drift | Fixture `P03/PHASE.md`: remove the anchor quote | TC-P00-10-04 (fixture run) | `ANCHOR_PROVENANCE` |
| NF-32a | — | GOV-02: delete the PG-02 row | TC-P00-11-01 | `MISSING_ID` |
| NF-32b | — | GOV-02: normative-content row `§9` → `§8` (no row covers §9) | TC-P00-11-02 | `UNCOVERED_SECTION` |
| NF-32c | — | GOV-02: normative-content section `§9.9` | TC-P00-11-02 | `INVALID_SECTION` |
| NF-32d | boundary, passes | GOV-02: the normative-content row for `§6` changes its section to `§6.1` (prefix match: `§6.1` covers `§6`) | TC-P00-11-02 | zero findings |
| NF-33a | — | GOV-03: X2 Status `EXCLUDED` | TC-P00-12-02 | `EXCLUSION_STATUS` |
| NF-33b | — | GOV-03: X2 Linked decision `—` | TC-P00-12-02 | `MISSING_LINKED_DECISION` |
| NF-33c | — | GOV-03: X1 Guard phases `—` | TC-P00-12-03 | `INVALID_PHASE` |
| NF-33d | — | GOV-03: X1 Guard verification `check later` | TC-P00-12-03 | `NO_GUARD_TOKEN` |
| NF-33e | boundary | GOV-03: X1 Guard verification `review` only | TC-P00-12-03 | `NO_GUARD_TOKEN` |
| NF-33f | — | GOV-03: X1 Allowed boundary `—` | TC-P00-12-03 | `EMPTY_BOUNDARY` |
| NF-33g | — | GOV-02: FR-AAA-02 Verification `review` (still valid vocab, no guard) | TC-P00-12-04 | `W_NOT_GUARDED_IN_MATRIX` |
| NF-34a | — | GOV-04: add a row ADR-001 | TC-P00-14-01 | `EXTRA_ID` |
| NF-34b | — | GOV-04: add a row ADR-099 | TC-P00-14-01 | `INVENTED_ID` |
| NF-34c | — | GOV-04: add ADR-004 as its own row (also Linked in D-01) | TC-P00-14-01 | `DUPLICATE_ID` |
| NF-34d | — | GOV-04: D-02 Source sections without `TECHNICAL-SPEC.md §6.1` | TC-P00-14-02 | `MISSING_SOURCE_SECTION` |
| NF-34e | — | GOV-04: ADR-008 Source sections without `DECISION-REGISTER.md ADR-008` | TC-P00-14-02 | `MISSING_SOURCE_SECTION` |
| NF-34f | — | Fixture `decisions.md` §2.2: delete the ADR-008 row | TC-P00-14-03 (fixture run) | `SNAPSHOT_MISMATCH` |
| NF-35a | — | GOV-04: Decider `Solution Architect` | TC-P00-15-01 | `BAD_DECIDER` |
| NF-35b | — | GOV-04: Preparer `Architect (P01)` | TC-P00-15-02 | `BAD_PREPARER` |
| NF-35c | — | GOV-04: ADR-003 Preparer `Solution Architect (P02)` with Deadline P01 | TC-P00-15-02 | `PREPARER_PHASE_MISMATCH` |
| NF-35d | — | GOV-04: Needed by `P00` | TC-P00-15-03 | `INVALID_PHASE` |
| NF-35e | — | GOV-04: Release blocker `maybe` | TC-P00-15-04 | `BAD_VOCAB` |
| NF-35f | — | GOV-04: D-01 Release blocker `no` | TC-P00-15-04 | `RELEASE_BLOCKER_RULE` |
| NF-35g | — | Fixture `decisions.md` §4: delete the marker line (ADR-003 stays `OWNER-ACCEPTED`) | TC-P00-15-05 | `OWNER_ACCEPTANCE_MISSING` |
| NF-35h | — | GOV-04: Assignment `ACCEPTED` | TC-P00-15-05 | `BAD_VOCAB` |
| NF-36 | — | GOV-04: Source recommendation without the `Recommendation only:` prefix | TC-P00-17-02 | `MISSING_RECOMMENDATION_PREFIX` |
| NF-37a | — | GOV-05: renumber SC-03 to SC-05 (gap) | TC-P00-18-01 | `NON_SEQUENTIAL_ID` |
| NF-37b | — | GOV-05: Type `other` | TC-P00-18-02 | `BAD_VOCAB` |
| NF-37c | boundary | GOV-05: SC-04 Sources with exactly 1 citation | TC-P00-18-03 | `TOO_FEW_CITATIONS` |
| NF-37d | — | GOV-05: citation `spec §5` | TC-P00-18-03 | `BAD_CITATION` |
| NF-37e | — | GOV-05: citation `TECHNICAL-SPEC.md §99` | TC-P00-18-03 | `BAD_CITATION` |
| NF-37f | — | GOV-05: Affected IDs `—` | TC-P00-18-04 | `EMPTY_AFFECTED` |
| NF-37g | — | GOV-05: Affected IDs add `FR-ZZZ-01` | TC-P00-18-04 | `INVENTED_ID` |
| NF-37h | — | GOV-05: SC-04 Type `ambiguity` with Status `RESOLVED-BY-HIERARCHY` | TC-P00-18-05 | `HIERARCHY_TYPE_RULE` |
| NF-37i | — | GOV-05: SC-02 Evidence `—` | TC-P00-18-05 | `OWNER_EVIDENCE_MISSING` |
| NF-37j | — | GOV-05: SC-01 (OPEN) Decider `—` | TC-P00-18-06 | `BAD_DECIDER` |
| NF-38a | — | GOV-05: SC-02 Status `OPEN` (Blocks `yes`), with valid OPEN ownership fields | TC-P00-20-01 | `GATE_OPEN_BLOCKER` SC-02 |
| NF-38b | — | GOV-05: SC-02 Blocks P00 `no` | TC-P00-20-02 | `BLOCKER_FLAG_RULE` |
| NF-39a | — | Fixture `decisions.md` §4: delete the marker line | TC-P00-25-01 | `OWNER_RECORD_MISSING` |
| NF-39b | — | Fixture `decisions.md` §4: remove the `Q-3` mention | TC-P00-25-01 | `OWNER_RECORD_INCOMPLETE` |
| NF-39c | — | Fixture `PHASE-STATUS.md`: `Status: IN_REVIEW` | TC-P00-25-01 | `PHASE_STATUS_NOT_COMPLETED` |

The Test Engineer may add mutations. No listed mutation may be removed or weakened without a review request to the Test Architect.

## 9. Determinism

### 9.1 Design rules
- No clock, no randomness, no network and no `locale` module. Python string methods and `sorted()` are locale-independent (code-point order), so they are allowed.
- Every directory listing is sorted; every set is converted to a sorted list before output; findings are sorted by `(tc_id, code, location, detail)`.
- Files are read as bytes and decoded UTF-8 explicitly; output contains repository-relative paths only.
- unittest's discovery order is alphabetical by file and method name and therefore stable.

### 9.2 In-suite tests
TC-P00-22-04 (in-process, twice), TC-P00-22-05 (subprocess with different `PYTHONHASHSEED` and `LC_ALL`), TC-P00-22-08 (sorting).

### 9.3 Procedures

**DET-01 double run (Test Engineer at red, implementer at green, QA at gate).** Output goes outside the repository:
```
OUT=$(mktemp -d)
cd /home/dmytro/git/work/resumiser
LC_ALL=C.UTF-8 PYTHONHASHSEED=0 python3 -B -m unittest discover -s docs/phases/P00/tests -t docs/phases/P00/tests -p 'test_*.py' -v > "$OUT/run1.txt" 2>&1; echo "exit=$?" >> "$OUT/run1.txt"
LC_ALL=C PYTHONHASHSEED=1 python3 -B -m unittest discover -s docs/phases/P00/tests -t docs/phases/P00/tests -p 'test_*.py' -v > "$OUT/run2.txt" 2>&1; echo "exit=$?" >> "$OUT/run2.txt"
for f in run1 run2; do sed -E 's/^Ran ([0-9]+) tests? in [0-9.]+s$/Ran \1 tests in <t>s/' "$OUT/$f.txt" > "$OUT/$f.norm"; done
diff "$OUT/run1.norm" "$OUT/run2.norm"; echo "diff_exit=$?"
```
Pass: `diff_exit=0`. Only the unittest timing line is normalised; any other difference is a determinism defect (stop condition
"non-deterministic test"). Repeat the same for `p00_cli.py --root .` without normalisation (its output has no timing).

**DET-02 read-only run.** Take a snapshot (SCOPE-01 command) immediately before and after C-1; the two snapshots must be identical.

## 10. Red state, green state and gate reporting

### 10.1 Expected red state (recorded by the Test Engineer in `test-results.md`)

| Suite | Expected | Why this is the intended reason |
|---|---|---|
| C-2 self-tests | exit 0 | They test the checker on fixtures; they must pass before the deliverables exist (plan §8, §4 step 3). TC-P00-22-01 (valid → zero findings) and TC-P00-22-02 (each NF → expected code) together prove each check can both pass and fail |
| C-3 source oracles | exit 0 | They check the sources the oracles read (spec, register, plan, `decisions.md` §2, PHASE.md quotes). A failure is a stop condition (plan §13), not a red test |
| C-4 real deliverables | exit 1 | Every TC listed "FAIL `MISSING_FILE`" in §7 fails, with only `MISSING_FILE` findings for paths under `docs/phases/P00/governance/` (at this plan's granularity: 45 TCs). The Test Engineer records the exact failure count and confirms by reading the messages that no other code appears and `errors=0` |
| C-4 tests that pass in red | TC-P00-01-01, TC-P00-21-01, TC-P00-23-02 | They check inputs that already exist (Architect artifacts from step 1, the Blueprint structure, absence of PII in existing P00 Markdown). Passing now is correct: they are regression guards, not deliverable tests |
| C-1 main suite | exit 1 | Union of the above |
| C-5 gate | exit 1 | TC-P00-20-01 `MISSING_FILE`; TC-P00-25-01 `OWNER_RECORD_MISSING` and `PHASE_STATUS_NOT_COMPLETED` |
| C-8 check-blueprint | exit 0 | Structure check of the Blueprint only; P00 must keep it at 0 |
| DET-01 | diff exit 0 | Red output is also deterministic |

Tests that **must fail before implementation**: all `real` TCs with "FAIL" in the Red column of §7 and both gate TCs. If any of them
passes in the red state, the check is vacuous and is a defect of the checks.

### 10.2 Green state (recorded by the documentation implementer, GOV-06)
C-1, C-2, C-3, C-4 exit 0 with `failures=0 errors=0 skipped=0`; C-7 exit 0; C-8 exit 0; DET-01 and DET-02 pass. C-5 is still expected to
exit 1 (see below).

### 10.3 Gate items (AC-P00-20, AC-P00-25)
- They live only in `gate_p00.py`, outside the `test_*.py` pattern, so the main suite can be green while the gate is honestly red. They are never skipped, never marked `expectedFailure` and never counted in a pass total (TC-P00-20-03 enforces the first two).
- Every `test-results.md` entry after the red run has a separate table:

  | Gate TC | AC | Command | Exit | State | Findings | Clears when |
  |---|---|---|---|---|---|---|
  | TC-P00-20-01 | AC-P00-20 | C-5a | 1 | GATE-RED (expected) | `GATE_OPEN_BLOCKER SC-nn` (K-12) | Owner answers Q-1; answer recorded in `decisions.md` §4; GOV-05 row updated by the implementer |
  | TC-P00-25-01 | AC-P00-25 | C-5b | 1 | GATE-RED (expected) | `OWNER_RECORD_MISSING`, `PHASE_STATUS_NOT_COMPLETED` | `/close-phase P00` records acceptance and status |

- Allowed State values: `GATE-RED (expected)`, `GATE-RED (unexpected)` (e.g. a blocker other than K-12), `GATE-GREEN`. A summary line must read like "main suite: N passed, 0 failed; gate: 2 GATE-RED (expected)", never "all passed".
- Order at the gate: (1) owner answers Q-1…Q-5; (2) main session records them in `decisions.md` §4; (3) the implementer updates the K-12 row (e.g. `RESOLVED-BY-OWNER`, Evidence `decisions.md §4`) and reruns C-1 and C-5a, which must now exit 0; (4) the owner accepts the gate; (5) the main session writes `PHASE-STATUS.md`; (6) QA runs C-5b, which must exit 0. QA's verdict must not be PASS while C-5a exits 1.

## 11. Scope and baseline integrity procedure (AC-P00-21, AC-P00-17, AC-P00-24 evidence)

Performed by the **main session** after every P00 role and by **QA** for the whole phase. Snapshots are stored outside the repository.
Pre-phase baseline: `/tmp/claude-1000/-home-dmytro-git-work-resumiser/5956668f-46d3-49ba-8132-6bdf4c9a703b/scratchpad/baseline.sha` (`sha256sum`
format, paths `./…`, `.git/` excluded).

**SCOPE-01 take a snapshot** (same format as the baseline):
```
cd /home/dmytro/git/work/resumiser
find . -path ./.git -prune -o -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum > "$SNAP/after-<role>.sha"
```

**SCOPE-02 compare** (order-independent; `$PREV` is the snapshot before the role, `$CUR` after; script kept outside the repo):
```
python3 -B - "$PREV" "$CUR" <<'EOF'
import sys
def load(p):
    d = {}
    for line in open(p, encoding="utf-8"):
        digest, path = line.rstrip("\n").split("  ", 1)
        d[path] = digest
    return d
a, b = load(sys.argv[1]), load(sys.argv[2])
created = sorted(set(b) - set(a)); deleted = sorted(set(a) - set(b))
changed = sorted(p for p in set(a) & set(b) if a[p] != b[p])
bad = []
for kind, paths in (("created", created), ("deleted", deleted), ("changed", changed)):
    for p in paths:
        print(kind, p)
        if not p.startswith("./docs/phases/P00/") or kind == "deleted" or "/__pycache__/" in p:
            bad.append((kind, p))
for kind, p in bad:
    print("OUT-OF-SCOPE", kind, p)
sys.exit(1 if bad else 0)
EOF
```
Pass: exit 0. Any change outside `./docs/phases/P00/`, any deletion, and any `__pycache__` file are failures.

**SCOPE-03 protected paths** (cumulative, `baseline.sha` vs the latest snapshot): no line for `./docs/source/` differs, and no path under
`./docs/blueprint/decisions/` is created or changed (AC-P00-17). Covered by SCOPE-02 run with `PREV=baseline.sha`. The main session
also runs this order-independent check (expected: no output, exit 0):
```
diff <(grep -E '^\S+  \./docs/(source|blueprint/decisions)/' "$SNAP/baseline.sha" | LC_ALL=C sort) \
     <(grep -E '^\S+  \./docs/(source|blueprint/decisions)/' "$CUR" | LC_ALL=C sort)
```
Both sides must be sorted with `LC_ALL=C`: the pre-phase baseline was sorted in another locale, so an unsorted `diff` reports
order-only differences. SCOPE-02 compares path→digest maps and is not affected by order.

**SCOPE-04 per-role allow list** (main session): the changed/created paths of each role must be within its allowed set:

| Role | Allowed paths |
|---|---|
| Test Architect | `./docs/phases/P00/tests/test-plan.md` |
| Test Engineer | `./docs/phases/P00/tests/**` except `test-plan.md`; `test-results.md` append-only |
| Documentation implementer | `./docs/phases/P00/governance/**`; `implementation/governance-tasks.md` (Status column only, reviewer checks); `tests/test-results.md` append-only |
| Code Reviewer | `./docs/phases/P00/review/code-review.md` |
| QA | `./docs/phases/P00/qa-report.md` |
| Main session (gate) | `./docs/phases/P00/decisions.md` (§4 append only), `./docs/phases/P00/PHASE-STATUS.md`, GOV-05 status update via the implementer |

Append-only check for `test-results.md` and `decisions.md`: the main session keeps a copy of the file before the role and verifies
`cmp -n <old size> old new` exits 0.

Then run C-8 (`python3 scripts/check-blueprint.py`, exit 0). Record every SCOPE result (command, exit code, listed paths) in
`test-results.md` or `qa-report.md`.

## 12. Review and gate checklists (non-automated verification)

| ID | AC | Performed by | Checklist |
|---|---|---|---|
| RV-13 | AC-P00-13 | Code Reviewer; QA re-checks | (1) Each Guard verification names a concrete check and a named phase (e.g. "contract review in P02: no DOCX media type, share or e-mail-sending endpoint"; "component/E2E: no AI or score control"). (2) Allowed boundaries are correct for at least X1/FR-RTE-08, X3/FR-PRV-07, X4/D-07 pickers, X6/FR-TPL-02, X7/FR-ACC-01–02 account e-mail, X11/§3.2 static help text. (3) Every exclusion in `PROJECT-CHARTER.md` "Explicitly excluded" (AI generation, phrase libraries, import/parse of PDF/DOCX, DOCX export, cover letters, public publishing/share, e-mail sending, resume score/review, marketing/job-board features, monetization/paywall) maps to a GOV-03 row. (4) Implied exclusions include FR-RTE-08, FR-PDF-01, FR-EDT-08 and §13 F42 Print. Each unresolved item is a written finding |
| RV-24 | AC-P00-24 | Code Reviewer; QA re-checks | (1) phase-plan §14 lists every Blueprint, CLAUDE, script and source change P00 found necessary, with rationale and "needs owner approval". (2) Every OOS item's target file is unchanged (SCOPE-02/03 evidence). (3) Any change the GOV-05 log or reviewer finds necessary but that is missing from §14 is a finding |
| RV-JDG | AC-P00-08, 10, 15, 18 | Code Reviewer | Judgement the checks cannot see (plan §3.4): sensible Phases/Primary phase per requirement; Needed-by phases earlier than the anchors where an earlier phase depends on the answer (e.g. schema-affecting answers before P02); Proposed handling in GOV-05 adopts no answer; Summaries paraphrase without personal data |
| RV-16 | AC-P00-16 | Code Reviewer | The unquoted anchor (`P01/PHASE.md` DoD: persistence provider, file storage, EU hosting) matches the P01 DoD text |
| RV-04 | AC-P00-04 | Code Reviewer | Personal data `yes` for the reference CV and its renders `img/90…93`; `normative-reference` used only for files the spec names as target design |
| RV-HIER | AC-P00-18 | Owner at gate | Every `RESOLVED-BY-HIERARCHY` row is confirmed by the owner (plan §7.6) |
| GATE-20 | AC-P00-20 | QA and owner | TC-P00-20-01 exits 0 before acceptance (§10.3) |
| GATE-25 | AC-P00-25 | QA and owner | TC-P00-25-01 exits 0 after `/close-phase`, and the record matches the owner's statements |
| RV-TST | AC-P00-22 | Code Reviewer | No hard-coded oracle values in check code (§4 item 6); every AC-22 class has an NF; no NF weakened |

## 13. Acceptance-criterion coverage summary

| AC | Verification type (AC) | Test cases | Performed by |
|---|---|---|---|
| AC-P00-01 | auto | TC-P00-01-01…04; NF-12a–d, NF-20…24 | Test suite |
| AC-P00-02 | auto | TC-P00-02-01; NF-25a–c | Test suite |
| AC-P00-03 | auto | TC-P00-03-01; NF-11a–c | Test suite |
| AC-P00-04 | auto | TC-P00-04-01…04; NF-26a–e; RV-04 | Test suite; Reviewer |
| AC-P00-05 | auto | TC-P00-05-01…02; NF-27a–c | Test suite |
| AC-P00-06 | auto | TC-P00-06-01; NF-28a–b | Test suite |
| AC-P00-07 | auto | TC-P00-S-01, TC-P00-07-01; NF-01…03, NF-28b | Test suite |
| AC-P00-08 | auto | TC-P00-08-01…04; NF-04…06e, NF-29a–c; RV-JDG | Test suite; Reviewer |
| AC-P00-09 | auto | TC-P00-09-01…02; NF-30a–b | Test suite |
| AC-P00-10 | auto | TC-P00-10-01…04; NF-31a–d | Test suite |
| AC-P00-11 | auto | TC-P00-11-01…03; NF-32a–d | Test suite |
| AC-P00-12 | auto | TC-P00-12-01…05; NF-33a–g | Test suite |
| AC-P00-13 | review | RV-13 (support: TC-P00-12-03) | Code Reviewer, QA |
| AC-P00-14 | auto | TC-P00-14-01…04; NF-34a–f | Test suite |
| AC-P00-15 | auto | TC-P00-15-01…05; NF-07a–d, NF-08c–d, NF-35a–h | Test suite |
| AC-P00-16 | auto | TC-P00-16-01…02; NF-08a–b; RV-16 | Test suite; Reviewer |
| AC-P00-17 | auto | TC-P00-17-01…02, TC-P00-17-03 (SCOPE-03); NF-09a–b, NF-36 | Test suite; main session |
| AC-P00-18 | auto | TC-P00-18-01…06; NF-37a–j; RV-HIER | Test suite; owner |
| AC-P00-19 | auto | TC-P00-19-01…02; NF-10a–c | Test suite |
| AC-P00-20 | gate | TC-P00-20-01 (gate), TC-P00-20-02, TC-P00-20-03; NF-38a–b; GATE-20 | Gate suite; QA, owner |
| AC-P00-21 | auto (main session / QA) | TC-P00-21-01; SCOPE-01…04; C-8 | Main session, QA |
| AC-P00-22 | auto | TC-P00-22-01…08; DET-01, DET-02; RV-TST | Test suite; Test Engineer, QA |
| AC-P00-23 | auto | TC-P00-23-01…02; NF-13a–c | Test suite |
| AC-P00-24 | review | RV-24 (evidence: SCOPE-02/03) | Code Reviewer, QA |
| AC-P00-25 | gate | TC-P00-25-01 (gate); NF-39a–c; GATE-25 | Gate suite; QA, owner |

## 14. Risks

| ID | Risk | Mitigation |
|---|---|---|
| TR-01 | Checks pass vacuously (e.g. no rows parsed, missing file treated as empty) | `MISSING_FILE` on absence; TC-P00-22-02 negative mutations; red run must show the listed TCs failing |
| TR-02 | Checks over-fit to the baseline (hard-coded counts) | §4 item 6; source-drift mutations NF-27b, NF-28b, NF-31d; RV-TST |
| TR-03 | Plan text is reformatted and the format parser silently returns less | `PLAN_FORMAT_CHANGED` failures in sources tests; TC-P00-22-03 |
| TR-04 | Strict citation grammar forces awkward citations for unnumbered Blueprint headings | Issue I-01; grammar implemented as one constant |
| TR-05 | Gate red is misreported as a pass, or the gate is bypassed by setting Blocks P00 = no | Separate gate module, §10.3 reporting rules, TC-P00-20-02 anti-bypass, TC-P00-20-03 no-skip scan |
| TR-06 | Bytecode or temp files change the tree and pollute the scope check | `-B` everywhere; read-only scan TC-P00-22-07; DET-02; SCOPE-02 flags `__pycache__` |
| TR-07 | A fixture leaks PII-like strings | Runtime construction of PII strings; TC-P00-23-02 scans all P00 Markdown |
| TR-08 | Python older than 3.10 lacks `sys.stdlib_module_names` | §2 states the minimum; the test fails loudly if the attribute is missing |

## 15. Issues for Architect

None of these blocks the Test Engineer: each has a default (the interpretation used in this plan). Answers that change a default must
come before the Test Engineer finalises the affected check, and I-01 before GOV-05 is written.

| ID | AC / plan ref | Issue | Default used in this plan |
|---|---|---|---|
| I-01 | AC-P00-14, 18, 19; plan §7.1 item 13, §7.6 | The citation location grammar (`§n[.n]`, row ID, `header`, `App. A/B`) has no form for unnumbered headings: `DECISION-REGISTER.md` "Gate policy", `TRACEABILITY.md` group rows, `Pxx/PHASE.md` "Objective"/DoD, `CLAUDE.md` "Non-negotiable", `TEST-STRATEGY.md`, `reference/README.md`. Seeds K-12, K-18 and K-20 have doc-only key tokens, so the implementer can only cite `<doc> header` or an unrelated row ID. Proposal: allow `<doc> "<exact heading text>"` resolved against that document's headings | Strict grammar as written; doc-only key tokens match by document (§7 AC-P00-19 rule 3) |
| I-02 | AC-P00-01 | The AC requires "required H2 headings and named-table header rows (plan §7.2–7.6)" for the Architect artifacts too, but §7.2–7.6 define them only for GOV-01…05 | Architect artifacts: existence, UTF-8, H1, non-empty, placeholder scan |
| I-03 | AC-P00-01; plan §7.1 item 11 | `phase-plan.md` itself quotes the placeholder tokens (in code spans), so a raw scan of Architect artifacts would always fail | Strip inline code spans for Architect artifacts only; GOV files are scanned raw |
| I-04 | AC-P00-12 | "Allowed boundary is not empty": §7.1 item 3 uses `—` for "none". Is `—` allowed? | `—` counts as empty and fails |
| I-05 | AC-P00-15; Q-3 | No format is defined for a Decider delegation in `decisions.md` | No delegation recognised; Decider must be `Product owner`. Proposal: a §4 line `- Delegation: <ID list> -> <Role>` |
| I-06 | AC-P00-20; plan §7.7 K-12 | TC-P00-20-02 (anti-bypass) requires Blocks P00 = `yes` for seeds marked "Expected Blocks P00 = yes". This goes beyond the AC text | Enforced in the main suite. If the Architect rejects it, the test is removed by a review decision, not by the implementer |
| I-07 | AC-P00-05; K-16 | Does a relocation recorded in `reference/README.md` count as "resolves to an inventoried file"? | No: the reference must be resolvable as written or logged in a `missing-reference` row, so the K-16 row (or another row) must have Type `missing-reference` and contain both paths verbatim |
| I-08 | AC-P00-04 | "Spec status equal to the header cell": the Status cell contains `**[DECISION]**` markup | Raw trimmed cell, markup included |
| I-09 | AC-P00-09; plan §7.3 | The AC allows any valid-universe token in Decision deps; the plan says "list of D-xx/ADR-xxx" | Only defined D-xx and ADR-xxx tokens |
| I-10 | AC-P00-15 | The release-blocker row is named by ID in the AC (D-20/ADR-012/ADR-032) | Derived from register rows whose handling says "release blocker" (baseline: ADR-012, in the D-20 row). Same result at baseline |
| I-11 | AC-P00-01, 08, 12 | Some format rules come from plan §7 rather than AC text: Summary ≤ 120 characters, LF/no BOM, no markup in ID cells, "plus a concrete description" in Guard verification, exact citation resolution | Enforced, as AC-P00-01 makes plan §7 formats binding |
| I-12 | AC-P00-23 | TC-P00-23-02 scans all P00 Markdown, not only GOV files | Enforced (passes at baseline) |
| I-13 | AC-P00-15; plan §7.1 items 4, 6 | The deadline regex allows `P00`; item 4 restricts GOV-04 phase cells to P01…P15 | GOV-04 deadlines must name P01…P15; GOV-05 OPEN rows may name P00 |
| I-14 | AC-P00-25 | The §4 owner-record format beyond the marker line is not defined | Gate check requires the marker plus mentions of `Q-1`…`Q-5` and `PD-P00-03`/`04`/`05` |
| I-15 | AC-P00-10 | The TRACEABILITY.md rule is "intersects"; FR-HDR, FR-PHO, FR-SEC, FR-TYP and FR-LAY rows list several phases, so P13-only or P11-only mappings for some IDs still need one of the listed phases | Implemented as written; no change requested |
| I-16 | AC-P00-19 | "Sources ∪ Affected IDs contain all key tokens" is not defined at token level | Matching rules 1–5 in §7 AC-P00-19 |

Stop conditions found: **none**. Every AC is testable under the defaults above.

## 16. Handoff to the Test Engineer

- Create the files of §4 and the fixture of §8.1 under `docs/phases/P00/tests/` only. Do not edit this plan, the AC, the plan or any GOV file.
- Implement every `real`, `sources`, `self` and `gate` TC of §7 and every NF of §8.3.
- Record the red state in `docs/phases/P00/tests/test-results.md` (append): environment (Python version, OS, `LC_ALL`), commands C-1…C-5, C-7b, C-8, DET-01, DET-02 with exact exit codes and `Ran/failures/errors/skipped` counts; the list of failing TCs with their finding codes; the gate table of §10.3.
- Done when: C-2 and C-3 exit 0; C-4 exits 1 with only `MISSING_FILE` findings and `errors=0`; C-5 exits 1 with the codes of §10.1; C-8 exits 0; DET-01 diff is empty; SCOPE-02 for the Test Engineer step shows only allowed paths.
