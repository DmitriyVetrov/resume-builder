# P00 Architecture Plan — Project Governance & Source Baseline

| | |
|---|---|
| Phase | P00 — Project Governance & Source Baseline |
| Author role | Solution Architect |
| Plan status | PROPOSED — needs owner approval of the plan (gate evidence "Architecture plan approved") |
| Baseline date | 2026-11-01 |
| Source baseline | `docs/source/TECHNICAL-SPEC.md` Version "0.1 draft · 2026-10-24", Status "For review", SHA-256 `cc411318efb4ccc2ebc3411b5df484bf0e724bd4a8f28dc9a1cecd560787ae45` |
| Definition of Done (PHASE.md) | "Cannot be closed until FR/NFR and exclusions are mapped; open decisions have an owner/deadline." |
| Required test strategy (PHASE.md) | "Documents and rules; structure check; decision register review." |

## 1. Context

P00 is the first phase and has no dependencies. The repository is a Blueprint-only scaffold: there is no
code, no toolchain and no git history. Before P01 makes architecture decisions, P00 must give the project:

1. a pinned **source baseline**, so every later phase knows which version of the spec it implements;
2. a **requirement → phase traceability matrix** covering every `FR-*` and `NFR-*` ID;
3. an **exclusion register** covering every item of TECHNICAL-SPEC §3.2 (plus "won't" requirements), each with a guard;
4. a **decision-owner register**: every open decision (D-01…D-20, every OPEN/SOURCE-OPEN/PROPOSED register item) with a proposed decider, preparer and deadline;
5. a **source-conflict log** that records conflicts and ambiguities without resolving them.

P00 changes no product behavior. It produces governance documents and executable structure checks only.

## 2. Scope and non-scope

### 2.1 In scope
- The governance deliverables GOV-01…GOV-05 (§7), as implementation tasks in `implementation/governance-tasks.md`.
- P00 process decisions (`decisions.md`) and a status snapshot of every open item. All open items stay open.
- Stdlib-only executable checks under `docs/phases/P00/tests/`, written by the Test Engineer (§8).
- Proposals for Blueprint changes, listed in §14 and not applied.

### 2.2 Non-scope (explicit)
- Deciding any D-01…D-20 item or any OPEN/SOURCE-OPEN/PROPOSED register item. P00 only proposes owners and deadlines, and the owner accepts them at the P00 gate.
- Writing ADR files in `docs/blueprint/decisions/`. P00 makes process decisions only; product and technology ADRs start in P01 (see §11).
- Editing `docs/source/**`, `docs/blueprint/**`, `CLAUDE.md`, `.claude/**`, `contracts/**`, `backend/**`, `frontend/**`, `tests/**`, `scripts/**` or other phase folders.
- Any code, toolchain, contract or endpoint. Mapping a requirement to a phase does not mean designing it.
- Picking test case IDs and test design. That belongs to the Test Architect.

## 3. Source basis and coverage approach

### 3.1 Requirement ID census at baseline (computed from the pinned spec)

Requirement IDs are rows of the form `| FR-<AAA>-<nn> | <Pri> |` or `| NFR-<nn> | <Pri> |` in TECHNICAL-SPEC.md.
At baseline the spec contains **116 distinct IDs: 102 FR + 14 NFR**. Every ID is defined exactly once. No malformed or
referenced-but-undefined ID exists (wildcards such as `FR-PHO-*` and ranges such as `FR-LAY-01…06` are references, not IDs).

| Group | Spec section | Count | Group | Spec section | Count |
|---|---|---|---|---|---|
| FR-ACC | §5.1 | 6 | FR-TPL | §5.8 | 5 |
| FR-LIB | §5.2 | 6 | FR-CLR | §5.9 | 4 |
| FR-EDT | §5.3 | 8 | FR-LAY | §5.10 | 10 |
| FR-HDR | §5.4 | 6 | FR-PRV | §5.11 | 8 |
| FR-SEC | §5.5 | 11 | FR-PDF | §5.12 | 10 |
| FR-TYP | §5.6 | 3 | FR-TXT | §5.13 | 7 |
| FR-RTE | §5.7 | 8 | FR-PER | §5.14 | 5 |
| FR-PHO | §5.15 | 5 | NFR | §11 | 14 |

Priorities: M = 92, S = 20, C = 2 (FR-ACC-05, FR-ACC-06), W = 2 (FR-RTE-07, FR-CLR-04).

The checks must **compute** these numbers from the spec file and must not hard-code them. The numbers above document
the baseline only. If the owner changes the spec, the checks must follow the new spec.

### 3.2 Other ID families in scope
| Family | Source | Count | P00 treatment |
|---|---|---|---|
| `PG-01…PG-09` pagination rules | TECHNICAL-SPEC §8 | 9 | Mapped to phases in a secondary table of GOV-02 |
| `X1…X11` exclusions | TECHNICAL-SPEC §3.2 | 11 | GOV-03 |
| `D-01…D-20` open decisions | TECHNICAL-SPEC §12 | 20 | GOV-04; status unchanged |
| `ADR-001…ADR-034` | `docs/blueprint/DECISION-REGISTER.md` | 34 | GOV-04 for every non-FIXED row and every FIXED row with an open aspect (§7.5) |
| Principles `P1…P5` | TECHNICAL-SPEC §2 | 5 | Normative content without IDs (GOV-02 secondary table) |

### 3.3 ID namespace hazards (handled by PD-P00-08)
- `D-01…D-20` (spec §12 open decisions) vs `D1…D17` (reference-product defects, README §12). P00 artifacts write the latter as `RG D1`.
- Templates `T1…T3` vs reference-product TXT defects `T1…T7` (README §10). P00 artifacts write the latter as `RG T5`.
- Principles `P1…P5` vs phases `P00…P15`. Phases always have two digits; principles are written `§2 P1`. DECISION-REGISTER ADR-019 says "no autosuggest in P1", meaning principle P1 (seed K-22).

### 3.4 Coverage approach
- **Completeness is checked automatically:** set equality between spec IDs and matrix rows, exclusion rows and decision rows.
- **Consistency is checked automatically** against anchors that are already written in the sources: phase objectives and DoD in each `PHASE.md`, phase groups in `TRACEABILITY.md`, "Needed by"/"Confirm in" notes in `DECISION-REGISTER.md`, and `[DECISION D-xx]` markers in spec rows. The checks never encode the expected answer for a requirement beyond these cited anchors.
- **Correctness of judgement** (whether a phase choice is sensible, whether a guard is meaningful) is checked by the Code Reviewer and QA, not by scripts.

## 4. Role sequence for P00

| Step | Role | Output | Notes |
|---|---|---|---|
| 1 | Solution Architect (this step) | `architecture/phase-plan.md`, `decisions.md`, `dependencies.md`, `acceptance-criteria.md`, `implementation/{backend,frontend,governance}-tasks.md` | No governance content authored yet |
| 2 | Test Architect | `tests/test-plan.md` mapping AC-P00-01…25 to test cases, fixtures and commands | Must define positive and negative synthetic fixtures (§8) |
| — | Contract Architect | — | **Not required**: P00 has no API surface |
| 3 | Test Engineer | stdlib checks + fixtures under `docs/phases/P00/tests/`; red evidence in `tests/test-results.md` | Red state = deliverables missing **and** checker self-tests pass on fixtures |
| 4 | Documentation implementer (Solution Architect, separate invocation) | GOV-01…GOV-05 under `docs/phases/P00/governance/`; task status in `implementation/governance-tasks.md`; green evidence appended to `tests/test-results.md` | `docs/phases/**` is Architect-owned, so no Developer role applies |
| 5 | Code Reviewer | `review/code-review.md` | Scope, judgement quality, no silent closure, PII |
| 6 | QA / Acceptance Agent | `qa-report.md` | Runs checks independently; checks AC-P00-20 and AC-P00-25 for gate readiness |
| 7 | Owner + main session | Owner acceptance (`/close-phase P00`); main session writes `PHASE-STATUS.md` and the owner-acceptance record in `decisions.md` | P01 must not start before this |

## 5. Allowed and forbidden paths

**Allowed (P00):**
- `docs/phases/P00/**`, specifically:
  - `docs/phases/P00/architecture/phase-plan.md`, `decisions.md`, `dependencies.md`, `acceptance-criteria.md` (Solution Architect)
  - `docs/phases/P00/implementation/backend-tasks.md`, `frontend-tasks.md`, `governance-tasks.md` (Solution Architect; the implementer updates task status)
  - `docs/phases/P00/governance/` (new; GOV-01…GOV-05; documentation implementer)
  - `docs/phases/P00/tests/test-plan.md` (Test Architect)
  - `docs/phases/P00/tests/` executable checks and `docs/phases/P00/tests/fixtures/` (new; Test Engineer)
  - `docs/phases/P00/tests/test-results.md` (append only: Test Engineer red, implementer green)
  - `docs/phases/P00/review/code-review.md` (Code Reviewer), `docs/phases/P00/qa-report.md` (QA)
  - `docs/phases/P00/PHASE-STATUS.md` (main session, after owner acceptance)

**Read-only inputs:** `docs/source/**`, `docs/blueprint/**`, `docs/phases/*/PHASE.md`, `docs/phases/README.md`, `CLAUDE.md`,
`.claude/**`, `scripts/check-blueprint.py`.

**Forbidden:** everything else. No new top-level paths are needed.

**Enforcement:** the repository has no commits, so `git diff --name-only` is not available. The main session takes a
SHA-256 snapshot of all files before each role and compares it afterwards. AC-P00-21 makes this a gate check.

## 6. Deliverables

| ID | Deliverable | Path | Writer | When |
|---|---|---|---|---|
| A-1 | Phase plan | `docs/phases/P00/architecture/phase-plan.md` | Solution Architect | Step 1 |
| A-2 | Decisions | `docs/phases/P00/decisions.md` | Solution Architect | Step 1 (owner-acceptance record added in step 7) |
| A-3 | Dependencies | `docs/phases/P00/dependencies.md` | Solution Architect | Step 1 |
| A-4 | Acceptance criteria | `docs/phases/P00/acceptance-criteria.md` | Solution Architect | Step 1 |
| A-5 | Backend / frontend tasks ("no tasks") | `docs/phases/P00/implementation/backend-tasks.md`, `frontend-tasks.md` | Solution Architect | Step 1 |
| A-6 | Governance tasks | `docs/phases/P00/implementation/governance-tasks.md` | Solution Architect | Step 1 |
| GOV-01 | Source inventory | `docs/phases/P00/governance/source-inventory.md` | Documentation implementer | Step 4 |
| GOV-02 | Requirement traceability matrix | `docs/phases/P00/governance/requirements-traceability.md` | Documentation implementer | Step 4 |
| GOV-03 | Exclusion register | `docs/phases/P00/governance/exclusion-register.md` | Documentation implementer | Step 4 |
| GOV-04 | Decision-owner register | `docs/phases/P00/governance/decision-owner-register.md` | Documentation implementer | Step 4 |
| GOV-05 | Source-conflict log | `docs/phases/P00/governance/source-conflict-log.md` | Documentation implementer | Step 4 |
| T-1 | Test plan | `docs/phases/P00/tests/test-plan.md` | Test Architect | Step 2 |
| T-2 | Executable checks + fixtures | `docs/phases/P00/tests/` | Test Engineer | Step 3 |

## 7. Deliverable specifications (machine-checkable formats)

### 7.1 Common conventions (all GOV files)
1. UTF-8 Markdown, LF line endings, written in English.
2. Each file starts with an H1 title and the exact H2 headings listed for it. A **named table** is the first Markdown table after its H2 heading. Its header row must match the given column names exactly, in order.
3. Cells are trimmed. ID cells and vocabulary cells contain plain text with no backticks or emphasis. A cell with "none" holds an em dash `—`. A list cell is comma-separated (`P07, P08`). Cells contain no `|` characters, so do not quote spec text that contains pipes.
4. **Phase IDs:** `P00`…`P15`. In the matrix, the exclusion register and the decision register, phase cells may use only `P01`…`P15`, because P00 maps requirements and delivers none of them.
5. **Verification vocabulary** (lowercase): `unit`, `integration`, `contract`, `component`, `e2e`, `rendering`, `security`, `performance`, `accessibility`, `review`, `guard` (an absence check for an excluded or won't-have feature). These are the layers in `TEST-STRATEGY.md`, plus `review` and `guard`.
6. **Deadline grammar:** `before Pxx implementation` (the ADR or owner decision is accepted before Pxx's Test Engineer or Developer steps start, i.e. at Pxx architecture-plan approval) or `before Pxx gate` (the decision is a deliverable of Pxx and must be accepted at Pxx's gate). Regex: `^before P(0[0-9]|1[0-5]) (implementation|gate)$`. No calendar dates, because no source provides them (PD-P00-03).
7. **Deadline ordering rule:** for a row with `Needed by = Pn` and `Deadline = before Pm <milestone>`: m ≤ n, and if m = n the milestone must be `implementation`.
8. **Decider vocabulary:** `Product owner`. Per `AGENT-WORKFLOW.md` and `decisions/README.md`, only the owner accepts decisions. Any other value needs a recorded owner delegation in `decisions.md`.
9. **Preparer format:** `<Role> (Pxx)`, where Role ∈ {`Solution Architect`, `Contract Architect`, `Test Architect`} and Pxx is the phase in which the ADR is drafted. Rule: the Preparer phase equals the Deadline phase.
10. **Assignment vocabulary:** `PROPOSED` (written by agents) or `OWNER-ACCEPTED` (set only by the main session after the owner accepts the P00 gate). `OWNER-ACCEPTED` is valid only if `decisions.md` §4 contains a line matching `^- Accepted by owner on \d{4}-\d{2}-\d{2}`.
11. **No placeholder tokens:** `TBD`, `TODO`, `FIXME`, `Pending phase execution`, `No tasks assigned yet`, `<fill>` (case-sensitive).
12. **No personal contact data:** GOV files must not contain e-mail addresses (`[\w.+-]+@[\w-]+\.[\w.-]+`) or international phone numbers (`\+\d[\d \-]{7,}\d`), because the source contains the owner's real contact data (see this plan's §9). The leading `+` is required so that ISO dates such as `2026-10-24` and digests do not match.
13. **Citation format** (GOV-04 Source sections, GOV-05 Sources): `<doc> <location>`. `<doc>` is one of `TECHNICAL-SPEC.md`, `README.md` (meaning `docs/source/README.md`), `reference/README.md` (meaning `docs/source/reference/README.md`), a Blueprint file name (`PROJECT-CHARTER.md`, `DECISION-REGISTER.md`, `ARCHITECTURE.md`, `AGENT-WORKFLOW.md`, `PHASE-GATES.md`, `REPOSITORY-STRUCTURE.md`, `TEST-STRATEGY.md`, `TRACEABILITY.md`), `CLAUDE.md`, or `Pxx/PHASE.md`. `<location>` is `§<n>[.<n>]`, a row ID (`ADR-029`, `FR-PER-03`), `header`, `App. A` or `App. B`. Separate multiple citations with `;`.
14. **Valid ID universe** for cross-references: FR/NFR, PG, X and D IDs as defined in TECHNICAL-SPEC.md; ADR IDs as defined in DECISION-REGISTER.md; spec section tokens `§<n>[.<n>]` that exist as numbered headings in TECHNICAL-SPEC.md. Any other token is an invented ID and fails.

### 7.2 GOV-01 Source inventory — `docs/phases/P00/governance/source-inventory.md`

Required H2 headings: `## Baseline`, `## Files`, `## Requirement ID census`, `## Notes`.

**Baseline**: a list of `- Key: value` lines with these keys:
- `Spec version:` must equal the "Version" cell of the TECHNICAL-SPEC header table exactly (baseline: `0.1 draft · 2026-10-24`).
- `Spec status:` must equal the "Status" cell exactly.
- `Spec SHA-256:` the 64-hex digest of TECHNICAL-SPEC.md.
- `Baseline date:` `2026-11-01`.
- `File count:` must equal the number of files under `docs/source/` (baseline: 90).

**Files** table header:
`| Path | Kind | Authority | Bytes | SHA-256 | Cited by | Personal data | Notes |`
- Path: repo-relative (`docs/source/img/01-home.png`). Every file under `docs/source/` appears exactly once; no other paths.
- Kind ∈ {`spec`, `research`, `screenshot`, `export-sample`, `reference-cv`, `index`}.
- Authority ∈ {`normative`, `normative-reference`, `evidence`, `index`}. `docs/source/TECHNICAL-SPEC.md` is the **only** `normative` row. `docs/source/README.md` is `evidence`. Files the spec names as the target design (Appendix A "Target template T1"; §6 reference renders; the reference CV) may be `normative-reference`. All other screenshots and export samples are `evidence` (PROJECT-CHARTER hierarchy; TECHNICAL-SPEC App. A: "reference material, not as the target design, unless a requirement says so").
- Bytes: integer equal to the file size. SHA-256: lowercase 64-hex digest equal to the file's digest.
- Cited by: where the spec or the research cites the file (`TECHNICAL-SPEC.md §6; README.md §9.2`) or `—`.
- Personal data ∈ {`yes`, `no`}. The reference CV and its renders hold the owner's real data (`reference/README.md`); the research persona is fictitious (README header).

**Requirement ID census** table header: `| Group | Count | M | S | C | W |`. One row per group as in §3.1 (`FR-ACC` … `FR-PHO`, `NFR`) plus a final `Total` row. All numbers must equal values recomputed from the spec.

**Notes**: free text, e.g. the README header claims "75 screenshots" while 82 are on disk (82 = 75 + 7 T1 renders, `img/90…93`).

### 7.3 GOV-02 Requirement traceability matrix — `docs/phases/P00/governance/requirements-traceability.md`

Required H2 headings: `## Requirements`, `## Pagination rules`, `## Normative content without requirement IDs`, `## Notes`.

**Requirements** table header:
`| Req ID | Pri | Spec section | Summary | Phases | Primary phase | Verification | Decision deps | Notes |`
- Exactly one row per FR/NFR ID defined in the spec: set equality, no duplicates, no invented IDs.
- Pri equals the spec priority. Spec section equals the numbered heading under which the ID is defined (`§5.1` … `§5.15`, `§11`).
- Summary: short paraphrase of at most 120 characters, with no pipes and no personal data.
- Phases: non-empty list ⊆ `P01…P15`, meaning the phases that design, implement or verify the requirement. Primary phase: one of Phases, the phase whose gate must demonstrate the requirement's acceptance criteria.
- Verification: non-empty list from the verification vocabulary. Rows with Pri `W` must include `guard`.
- Decision deps: list of D-xx/ADR-xxx, or `—`. **Rule:** every `D-xx` that appears in the requirement's spec row must be listed. Every listed token must be in the valid ID universe.
- Notes: free text. A deviation from a phase anchor (below) must be written `deviation: SC-nn`, citing a GOV-05 row.

**Phase anchors** (derived from cited Blueprint text; the Phases column must contain the anchored phase unless the Notes column has a `deviation:`):

| Anchor source | Rule |
|---|---|
| `P06/PHASE.md` Objective/DoD "FR-ACC scope" | every `FR-ACC-*` lists P06 |
| `P07/PHASE.md` DoD "FR-LIB" | every `FR-LIB-*` lists P07 |
| `P08/PHASE.md` DoD "FR-EDT/FR-SEC/FR-PER" | every `FR-EDT-*`, `FR-SEC-*`, `FR-PER-*` lists P08 |
| `P09/PHASE.md` DoD "FR-RTE" | every `FR-RTE-*` lists P09 |
| `P10/PHASE.md` DoD "FR-TPL/CLR/LAY" | every `FR-TPL-*`, `FR-CLR-*`, `FR-LAY-*` lists P10 |
| `P11/PHASE.md` DoD "FR-PRV-01…08 and NFR-01/NFR-04" | FR-PRV-01…FR-PRV-08, NFR-01, NFR-04 list P11 |
| `P12/PHASE.md` DoD "FR-PDF and FR-TXT" | every `FR-PDF-*`, `FR-TXT-*` lists P12 |
| `P13/PHASE.md` DoD "NFR-08…NFR-14" | NFR-08…NFR-14 list P13 |
| `TRACEABILITY.md` group rows | for each FR group row, each ID's Phases intersects that row's planned phases |

**Pagination rules** table header: `| Rule ID | Spec section | Summary | Phases | Primary phase | Verification | Notes |`.
It has exactly the rows PG-01…PG-09 (computed from §8). Spec section is `§8`, and the other cells follow the Requirements rules.

**Normative content without requirement IDs** table header: `| Spec section | Content | Phases | Primary phase | Verification | Notes |`.
At least one row must cover each of these spec sections: `§2` (principles P1–P5), `§5.6` (entry form fields and date display format), `§5.10` (slider UX paragraph), `§6` (T1 design specification), `§7` (T2/T3 proposal), `§9` (TXT format), `§10` (logical data model). A row covers prefix `§n` if its section equals `§n` or starts with `§n.`.

### 7.4 GOV-03 Exclusion register — `docs/phases/P00/governance/exclusion-register.md`

Required H2 headings: `## Exclusions`, `## Implied exclusions`, `## Notes`.

**Exclusions** table header:
`| Excl ID | Source section | Excluded feature | Linked decision | Status | Guard phases | Guard verification | Allowed boundary |`
- The rows are exactly X1…X11 (from §3.2) plus every requirement with priority `W` (baseline: FR-RTE-07, FR-CLR-04). Both sets are computed.
- Source section: `§3.2` for X rows, or the defining section for W rows.
- Status ∈ {`EXCLUDED`, `EXCLUDED-PENDING-DECISION`}. **Rule:** a §3.2 row whose spec text contains `[DECISION D-xx]` (baseline: X4, X8, X9, X10) is `EXCLUDED-PENDING-DECISION`, and its Linked decision includes that D-xx. All other rows are `EXCLUDED`, with Linked decision `—` or valid IDs (PD-P00-05).
- Guard phases: non-empty list ⊆ `P01…P15`. These are the phases whose review, contract or tests must prove the feature is absent.
- Guard verification: must contain at least one of `review`, `contract`, `component`, `e2e`, `guard`, plus a concrete description (e.g. "contract: no DOCX media type or endpoint in OpenAPI").
- Allowed boundary: what is **not** excluded. At minimum, the Code Reviewer checks (AC-P00-13) these boundaries: X1 vs FR-RTE-08 (browser-native spell check allowed); X3 vs FR-PRV-07 (layout overflow hints allowed); X4 vs D-07 recommendation (country/month pickers); X6 vs FR-TPL-02 (picker with exactly three templates); X7 vs FR-ACC-01/02 (account e-mails allowed); X11 vs §3.2 note (static help text without sample content).

**Implied exclusions** table header: `| Source | Excluded behavior | Guard phases | Notes |`. These are behaviors excluded by requirement text rather than §3.2, e.g. FR-RTE-08 "No own spell-check service", FR-PDF-01 "no modal, no e-mail, no share link", FR-EDT-08 leave-page warnings, §13 F42 Print. Source cells cite the requirement ID. No new IDs are created.

### 7.5 GOV-04 Decision-owner register — `docs/phases/P00/governance/decision-owner-register.md`

Required H2 headings: `## Register`, `## Unregistered decision candidates`, `## Notes`.

**Register** table header:
`| Primary ID | Linked IDs | Topic | Source sections | Status | Open aspect | Source recommendation | Decider | Preparer | Needed by | Deadline | Release blocker | Assignment | Notes |`

**Required ID set** (computed): all `D-xx` of spec §12, plus every DECISION-REGISTER row whose status is not `FIXED`, plus every `FIXED` row whose "Blueprint handling" contains `OPEN`, `PROPOSED`, `recommended` or `confirm` (case-sensitive substring match). At baseline this gives D-01…D-20, ADR-007…ADR-034, and ADR-002, ADR-003, ADR-004, ADR-006 (52 IDs). ADR-001 and ADR-005 are excluded.
- Each required ID appears **exactly once** across `Primary ID` ∪ `Linked IDs`, and no other IDs appear. A D-xx is the Primary ID of its row, and its mirror ADR(s) go in Linked IDs: D-12 → ADR-024, ADR-011; D-20 → ADR-032, ADR-012; D-nn → ADR-(nn+12) otherwise, as the register lists them.
- Source sections: must include `TECHNICAL-SPEC.md §12` for D rows and `DECISION-REGISTER.md <ADR-ID>` for each ADR. For D rows it must also include every TECHNICAL-SPEC section in which that D-ID appears (computed). "Section" means the nearest preceding numbered heading: baseline examples are D-15 → §5.10, §6.9, §12 and D-05 → §5.3, §12, §13.
- **Status must equal the recorded status:** the DECISION-REGISTER status of the ADR, or of the mirror ADR for D rows (baseline: `SOURCE-OPEN`). P00 does not change statuses. No row may say `ACCEPTED`, `DECIDED`, `CLOSED` or `RESOLVED`.
- Open aspect: what is still undecided (e.g. ADR-004 "NoSQL provider; MongoDB only PROPOSED").
- Source recommendation: the §12 or register recommendation, prefixed `Recommendation only:`. It is not adopted.
- Decider, Preparer, Needed by, Deadline and Assignment follow §7.1 items 6–10. Needed by is the earliest phase whose plan, tests or implementation depend on the answer.
- Release blocker ∈ {`yes`, `no`}. The row that contains D-20/ADR-012/ADR-032 must be `yes` (DECISION-REGISTER ADR-012 "release blocker").

**Deadline anchors** (derived from cited Blueprint text; "≤ Pn" means the deadline phase index ≤ n, and if equal, milestone `implementation`):

| IDs | Anchor | Source |
|---|---|---|
| ADR-007 | ≤ P01 | DECISION-REGISTER ADR-007 "Confirm in P01" |
| ADR-004, ADR-009, D-20 (ADR-012, ADR-032) | ≤ P01 | `P01/PHASE.md` DoD: persistence provider, file storage, EU hosting approach confirmed |
| ADR-006 | ≤ P02 | `P02/PHASE.md` Objective "OpenAPI 3.1 baseline" |
| ADR-033 | ≤ P03 | DECISION-REGISTER ADR-033 "Needed by P03" |
| ADR-003 | ≤ P05 | DECISION-REGISTER ADR-003 "confirm config in P05" |
| ADR-034 | ≤ P06 | DECISION-REGISTER ADR-034 "Needed by P06" |
| D-01, D-02, D-03 | ≤ P06 | `P06/PHASE.md` Objective "D-01/D-02/D-03 gate" |
| D-04, D-06, D-11 | ≤ P07 | `P07/PHASE.md` Objective "D-04/D-06/D-11 gate" |
| D-17 | ≤ P08 | `P08/PHASE.md` Objective "stale-tab behavior" |
| D-12 (ADR-011, ADR-024) | ≤ P10 | `P10/PHASE.md` Objective "T2/T3 only after D-12" |
| ADR-010 | ≤ P11 | DECISION-REGISTER ADR-010 "prototype in P11" |

The anchors are upper bounds. The implementer must choose an earlier deadline wherever an earlier phase depends on the answer
(e.g. any decision that changes the P02 contract schema). The checks enforce only the anchors and the ordering rule.

**Unregistered decision candidates** table header: `| Source | Candidate decision | Proposed handling | Preparer | Deadline | Notes |`.
These are Blueprint proposals that have no register ID, for example: ARCHITECTURE §4 optimistic-concurrency version token; ARCHITECTURE §2
authentication/session design, rate limiting and background export processing ("require threat model and ADR"); TEST-STRATEGY "Candidate tooling (confirm in P03)". P00 does not create ADR IDs for them; P01 assigns IDs (§14 OOS-02).

### 7.6 GOV-05 Source-conflict log — `docs/phases/P00/governance/source-conflict-log.md`

Required H2 headings: `## Log`, `## Notes`.

**Log** table header:
`| Conflict ID | Seed | Type | Sources | Summary | Affected IDs | Blocks P00 | Proposed handling | Status | Decider | Preparer | Needed by | Deadline | Evidence |`
- Conflict ID: `SC-nn`, unique and sequential from SC-01.
- Seed: `K-nn` from §7.7, or `—`. Each seed K-01…K-22 appears in exactly one row, and that row's Sources ∪ Affected IDs contain all of the seed's key tokens.
- Type ∈ {`spec-internal`, `spec-vs-research`, `spec-vs-blueprint`, `blueprint-internal`, `blueprint-gap`, `missing-reference`, `ambiguity`}.
- Sources: at least 2 citations in the §7.1 item 13 format, with exact sections.
- Affected IDs: non-empty list from the valid ID universe (§7.1 item 14).
- Blocks P00 ∈ {`yes`, `no`}. `yes` means the owner must resolve it before the P00 gate can be accepted (AC-P00-20).
- Status ∈ {`OPEN`, `RESOLVED-BY-HIERARCHY`, `RESOLVED-BY-OWNER`} (PD-P00-07):
  - `RESOLVED-BY-HIERARCHY` is allowed only for Type `spec-vs-research`: the spec outranks the research per PROJECT-CHARTER. It still needs the owner's confirmation at the gate.
  - `RESOLVED-BY-OWNER` requires Evidence that cites an owner-authored source (`docs/source/**`, or an owner statement recorded in `decisions.md`).
  - `OPEN` rows need Decider, Preparer, Needed by and Deadline as in §7.1. Unlike the other registers, they **may name P00** (e.g. `before P00 gate` for K-12). Other rows may use `—` in those cells.
- Proposed handling must not adopt an answer. It states who decides and what options exist, and refers to D-xx or ADR-xxx where one already exists.

### 7.7 Seed conflicts identified during planning (minimum content of GOV-05)

These are conflicts and ambiguities the Architect found while reading the sources. None blocks P00 *work*. K-12 is expected to
block the P00 *gate* until the owner answers it. The implementer must verify each seed, write it up and may add more rows.
Key tokens are the strings the check looks for in the row's Sources ∪ Affected IDs.

| Seed | Topic | Key tokens | Finding (to be verified and written up by GOV-05) |
|---|---|---|---|
| K-01 | Concurrent-tab conflict behavior | `FR-PER-03`, `D-17`, `ARCHITECTURE.md §6` | FR-PER-03 AC: "shows a notice and keeps both versions". §12 D-17 recommendation: "reload the stale tab with a notice". ARCHITECTURE §6 already states reload as the design. The Blueprint presents a SOURCE-OPEN recommendation as decided. This affects the P02 conflict response and P08 |
| K-02 | Login before verification | `FR-ACC-01`, `D-01` | FR-ACC-01 AC: "can log in only after verification". D-01 recommendation: allow login and require verification before the first export. The AC presupposes one answer to an open decision |
| K-03 | Line-height formula vs measured T1 | `FR-LAY-04`, `D-16`, `§6.2` | FR-LAY-04 at the default v = 1 gives round(10×1.2) + 0.5 = 12.5 pt, but §6.2 specifies body 10/13, list 11/14 and titles 14/18, which match the RG +1-per-step formula. Adopting the D-16 recommendation changes the T1 default rendering away from the reference CV |
| K-04 | Continuation-page top margin | `FR-LAY-06`, `§6.1` | FR-LAY-06 cites "§6.3", but the rule is in §6.1 ("≈ 31 pt", approximate). It is undefined for the Narrow, Wide and custom margins. This blocks exact rendering fixtures (P10/P11) |
| K-05 | Name-keyed template defaults vs type-only model | `FR-SEC-11`, `§6.6`, `§10.1` | FR-SEC-11 sets T1 defaults by section *name* ("Experience description and Skills lists = 2, others = 1"). §6.6 says list sections default to 2 columns, while the reference "Technical Skills" uses 1. §6.2 gives "summary 10/14". §10.1 Section has only a type and a free title (§2 P2), so no field identifies Skills or Summary. This affects the model and contract (P01/P02) and FR-SEC-01/D-06 |
| K-06 | Font-preset rounding | `FR-LAY-01`, `§6.9` | FR-LAY-01 gives exact factors ×0.9/×1.2. The §6.9 values are rounded (24×0.9 = 21.6 → 21.5; 14×1.2 = 16.8 → 17), and the rounding rule is unstated (D-15 open) |
| K-07 | TXT rendering of auto-linked contacts | `FR-HDR-04`, `§9.3`, `§9.4` | Under §9.3, "Link with text ≠ URL → text (url)" combined with FR-HDR-04 (an e-mail gets `mailto:`) implies `e-mail (mailto:…)`. The §9.4 example prints the e-mail without a URL. Golden TXT files (P12) need one exact answer |
| K-08 | Retention vs deletion | `FR-ACC-03`, `NFR-10` | FR-ACC-03 requires deleting all data within 24 h. NFR-10 keeps backups for 30 days, FR-LIB-04/D-04 keeps a 30-day trash and FR-PER-05 keeps 30-day snapshots. Whether backups, trash and snapshots are purged on account deletion is unspecified (GDPR, NFR-09) |
| K-09 | Export persistence | `FR-ACC-04`, `§10.1` | FR-ACC-03 ("exports of the user are deleted") and FR-ACC-04 ("latest PDF/TXT") imply stored exports, and ARCHITECTURE §2 stores exports in object storage, but §10.1 has no Export entity. Whether exports are persisted or regenerated is open (ADR-009, P02/P12/P13) |
| K-10 | Must vs Should for phone usability | `NFR-05`, `FR-EDT-07` | NFR-05 (M) says "phone usable (FR-EDT-07)", but FR-EDT-07 is S. ARCHITECTURE §3 states narrow-screen tabs unconditionally |
| K-11 | Exclusions tagged as decisions | `X4`, `X8`, `X9`, `X10`, `D-07`, `D-08`, `D-09`, `D-10` | §3.2 says "must NOT be built", yet these rows carry `[DECISION D-07…D-10]`. ADR-019…ADR-022 are SOURCE-OPEN with handling "excluded v1". Proposed interim handling: PD-P00-05 |
| K-12 | Spec maturity and decision timing | `TECHNICAL-SPEC.md header`, `DECISION-REGISTER.md` | The spec header says "Version 0.1 draft", "Status: For review", and that [DECISION] items need a product-owner choice "before stage 2". The Blueprint (stage 2) proceeds with D-01…D-20 SOURCE-OPEN and decides them per phase (DECISION-REGISTER gate policy). The owner must confirm the baseline and the phase-relative deadlines (PD-P00-03). **Expected Blocks P00 = yes** |
| K-13 | Photo upload limits | `FR-PHO-01`, `README.md §4.1` | Research: RG accepts JPEG/PNG/GIF up to 4 MB, and the photo flow was not re-tested (README App. B). Spec: JPEG/PNG/WebP up to 5 MB. ARCHITECTURE §7 already applies the spec. Candidate RESOLVED-BY-HIERARCHY |
| K-14 | Section title length | `FR-SEC-03`, `README.md §6.2` | Research: RG maxlength is 50 (also README F24, §14.5 R13). Spec: 80. Candidate RESOLVED-BY-HIERARCHY |
| K-15 | Research proposals superseded | `FR-TPL-01`, `FR-CLR-02`, `README.md §14` | README §14.1 R1 proposes one SLO7-based style, and §14.2 R3 proposes the palette Graphite/Naval/Teal. The spec has three templates with T1 based on SLO3, and FR-CLR-02 has Blue/Navy/Graphite (D-14 open) |
| K-16 | Relocated or missing source references | `TECHNICAL-SPEC.md §5.15`, `reference/README.md` | The spec header Inputs cite `docs/cv/valencia/SWE-Dmytro-Vietrov.pdf` (now `docs/source/reference/`), and §5.15 cites `.claude/skills/hunt/resumegenius.md`, which was not copied. The owner index `reference/README.md` records both. Candidate RESOLVED-BY-OWNER for the relocation. The photo flow then rests on README §4.1 alone |
| K-17 | Register duplicates | `ADR-011`, `ADR-024`, `D-12` | D-12 maps to both ADR-011 and ADR-024, and this is not annotated, while the D-20 duplicate (ADR-012/ADR-032) is. Handling: §14 OOS-02 |
| K-18 | Blueprint traceability gaps | `TRACEABILITY.md`, `NFR-14` | TRACEABILITY.md has no rows for NFR-04, NFR-05, NFR-07, NFR-10…NFR-14, §8 or §9. It maps FR-ACC only to P06, but P13 covers deletion and export. FR-LIB-06 needs P12. Handling: §14 OOS-01 |
| K-19 | Pagination-rule priority | `PG-08`, `§8` | The §8 table has no priority column, yet the PG-08 row carries a stray "S". The MoSCoW priority of PG-01…PG-09 is undefined (P11) |
| K-20 | Unregistered architecture proposals | `ARCHITECTURE.md §4`, `TEST-STRATEGY.md` | The concurrency token, auth/session design, rate limiting, background export and test tooling are PROPOSED or candidate items with no register ID (GOV-04 secondary table; OOS-02) |
| K-21 | "Last selected section" state | `FR-LIB-05`, `§10.1` | FR-LIB-05 opens the editor "at the last selected section", but §10.1 has no field for it. Server-side or client-side state is unspecified (P02 contract) |
| K-22 | ID namespace collisions | `ADR-019`, `README.md §10`, `README.md §12` | D-xx vs RG D1–D17, templates T1–T3 vs RG TXT defects T1–T7, principles P1–P5 vs phases. The "P1" in ADR-019 is ambiguous. Handling: PD-P00-08 and OOS-02 |

## 8. Executable checks (location and constraints)

- **Location:** `docs/phases/P00/tests/` (code) and `docs/phases/P00/tests/fixtures/` (synthetic fixtures). No new top-level path is needed. `tests/**` and `scripts/**` stay untouched (PD-P00-02).
- **Constraints:** Python 3 standard library only (e.g. `pathlib`, `re`, `hashlib`, `unittest`). Offline. Deterministic: no clock, randomness or network, with sorted iteration. Read-only on every path outside `docs/phases/P00/tests/`. Runs from the repository root.
- **Proposed entry command** (the Test Architect confirms it in `test-plan.md`):
  `python3 -m unittest discover -s docs/phases/P00/tests -t docs/phases/P00/tests -p 'test_*.py' -v`.
  Exit code 0 means pass.
- **Design guidance:** check functions take the spec, register and deliverable paths as parameters. This lets the same checks run against (a) the real deliverables and (b) small synthetic fixtures: a mini-spec with a few IDs and good or bad mini-deliverables. Self-tests on fixtures prove that each check rejects its negative case (AC-P00-22). Do **not** copy real deliverable content into fixtures.
- **Expected red state (Test Engineer):** the checks against real deliverables fail because the GOV files are missing. The fixture self-tests pass. Both are recorded with exact commands and exit codes in `tests/test-results.md`.
- **Gate-only check:** AC-P00-20 (no OPEN row with Blocks P00 = yes) is expected to fail until the owner answers. The Test Architect implements it as a separately invoked or clearly labelled gate check. It must not be skipped silently or count as a pass.
- `python3 scripts/check-blueprint.py` must keep exiting 0 (baseline run on 2026-11-01: exit 0, "Checked 220 required files, 9 agents").

## 9. Data, API, security, privacy and accessibility impact

- **Data model / persistence:** none.
- **API / contract:** none. No `contracts/**` change, and P00 adds no endpoint (CLAUDE.md: "Do not create speculative endpoints before P02").
- **Backend / frontend:** none (see `implementation/backend-tasks.md`, `frontend-tasks.md`).
- **Security / privacy:** the source holds the owner's real personal data: the reference CV (`reference/README.md`: "Contains the owner's personal contact data"), its renders `img/90…93`, and the contact details in TECHNICAL-SPEC §9.4 and §10.3. P00 artifacts record the presence of that data (inventory column `Personal data`) and never copy it (§7.1 item 12, AC-P00-23). Later rendering and TXT fixtures derived from the reference CV need an owner decision on synthetic vs real data (GOV-05 may add a row, and P11/P12 must address it).
- **Accessibility:** not applicable to P00 artifacts.

## 10. Dependencies

None on other phases. Tooling: `python3` with the standard library only. Details: `docs/phases/P00/dependencies.md`.

## 11. ADRs

No ADR files are drafted in P00. P00 makes only **process** decisions (PD-P00-01…10 in `decisions.md`), and these are phase-local.
Every product or technology decision stays with its owner. The decision-owner register (GOV-04) names the phase where each ADR
will be drafted, usually P01. Writing ADR drafts now would pre-empt P01 and could look like deciding open items.

## 12. Risks

| ID | Risk | Impact | Mitigation |
|---|---|---|---|
| R-01 | The spec is a "0.1 draft, For review" and may change after the baseline | Traceability goes stale | Pin by SHA-256 (PD-P00-06); the checks fail on drift; re-baselining is an owner-approved task |
| R-02 | The owner rejects phase-relative deadlines (spec header: decide "before stage 2") | All D-xx deadlines move to P00/P01, so a larger decision batch is needed now | Raised as K-12 and owner question Q-1; the formats support any deadline |
| R-03 | Judgement errors in the phase mapping pass automated checks | A requirement surfaces late or in the wrong phase | Anchors derived from PHASE.md/TRACEABILITY.md; Reviewer and QA check judgement (AC-P00-13, review of GOV-02) |
| R-04 | Checks over-fit, i.e. the expected answers are hard-coded | Tests become the deliverable and stop detecting errors | Checks derive their oracles from the sources and seeds only (§3.4); negative fixtures (AC-P00-22) |
| R-05 | Manual errors in large tables (116 + 9 + 90 rows) | Wrong hashes or IDs | The checks recompute everything; the implementer may generate hashes with `sha256sum` or Python and paste them |
| R-06 | Owner personal data leaks into new artifacts or later fixtures | Privacy breach (03-security-privacy) | PII pattern check (AC-P00-23); owner question Q-5 on fixtures |
| R-07 | Namespace collisions (D-xx/RG D1, T1/RG T1, P1/P01) | Misread decisions | PD-P00-08 and K-22 |
| R-08 | No git history, so scope enforcement relies on the snapshot | Undetected edits outside the allowed paths | The main session compares SHA-256 snapshots per role; AC-P00-21 |
| R-09 | Blueprint text stays inconsistent (K-01, K-17, K-18) because P00 may not edit it | Later phases read stale Blueprint guidance | §14 proposals; the P00 matrix and registers become the detailed reference once accepted |

## 13. Stop conditions

Stop and report to the main session if:
- the FR/NFR ID set cannot be determined unambiguously (duplicate, malformed or referenced-but-undefined IDs). This was checked at baseline and is **not triggered**;
- an exclusion directly contradicts an in-scope requirement in a way that makes mapping impossible. This was **not triggered**: the apparent overlaps are boundaries (§7.4);
- an artifact would require deciding a D-xx item or an OPEN/SOURCE-OPEN/PROPOSED item;
- the owner rejects the baseline (K-12/Q-1), which requires a new baseline;
- a change is needed outside `docs/phases/P00/**`;
- the standard stop conditions in `PHASE.md` apply.

## 14. Proposed out-of-scope changes (needs owner approval)

None of these is applied in P00. Each needs the owner's explicit approval and an assigned role and phase.

| ID | Target (forbidden in P00) | Proposed change | Rationale |
|---|---|---|---|
| OOS-01 | `docs/blueprint/TRACEABILITY.md` | After the P00 gate, add rows for NFR-04, NFR-05, NFR-07, NFR-10…NFR-14, §8 PG rules and §9; add P13 to FR-ACC (deletion/export) and P12 to FR-LIB-06; declare the P00 matrix the detailed catalog | K-18 |
| OOS-02 | `docs/blueprint/DECISION-REGISTER.md` | Annotate the ADR-011 ↔ ADR-024 duplicate (D-12) like ADR-032; reword ADR-019 "P1" as "principle P1 (§2)"; add owner and deadline columns or reference GOV-04; have P01 assign IDs to the unregistered candidates (GOV-04 secondary table) | K-17, K-20, K-22 |
| OOS-03 | `docs/blueprint/ARCHITECTURE.md` §6 (and §4) | Reword "stale tab reloads with notice" to "per D-17 (SOURCE-OPEN); FR-PER-03 AC currently says keep both versions" | K-01: no recommendation should be presented as decided |
| OOS-04 | `CLAUDE.md` "Commands" | Record the P00 check command once it is green (CLAUDE.md: "once a phase adds them, record them here") | Discoverability |
| OOS-05 | `scripts/check-blueprint.py` or P03 CI | Optionally run the P00 governance checks as a regression in CI (P03) | Detects source drift (R-01) |
| OOS-06 | `docs/source/TECHNICAL-SPEC.md` (product owner only) | Owner's option: fix FR-LAY-06 "§6.3" → "§6.1", the stray "S" in PG-08, and the Inputs path | K-04, K-16, K-19 |

## 15. Questions for the owner

- **Q-1 (needed before the P00 gate; K-12):** Is TECHNICAL-SPEC "0.1 draft · 2026-10-24" (SHA-256 above) accepted as the P00 source baseline? Are phase-relative decision deadlines (PD-P00-03) acceptable, given that the spec header asks for [DECISION] choices "before stage 2"?
- **Q-2 (P00 gate):** Do you accept PD-P00-05, which treats X4, X8, X9 and X10 as excluded until an accepted ADR changes the scope? D-07…D-10 remain open.
- **Q-3 (P00 gate):** Are you the sole Decider for all items, or do you delegate technical ADRs (e.g. exact .NET version) to the Solution Architect?
- **Q-4 (plan approval):** Do you approve the `docs/phases/P00/governance/` and `docs/phases/P00/tests/` locations (PD-P00-01, PD-P00-02)?
- **Q-5 (before P11):** May rendering and TXT fixtures use the real reference-CV content, or must fixtures be synthetic?

## 16. Acceptance criteria

See `docs/phases/P00/acceptance-criteria.md` (AC-P00-01…AC-P00-25). Tasks: `docs/phases/P00/implementation/governance-tasks.md`.
