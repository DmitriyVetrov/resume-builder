# P00 Architecture Plan (fixture)

|  |  |
|---|---|
| Phase | Fixture phase |
| Baseline date | 2000-01-03 |

## 6. Deliverables

| ID | Deliverable | Path | Writer | When |
|---|---|---|---|---|
| GOV-01 | Source inventory | `docs/phases/P00/governance/source-inventory.md` | Fixture | Step 4 |
| GOV-02 | Traceability | `docs/phases/P00/governance/requirements-traceability.md` | Fixture | Step 4 |
| GOV-03 | Exclusions | `docs/phases/P00/governance/exclusion-register.md` | Fixture | Step 4 |
| GOV-04 | Decision owners | `docs/phases/P00/governance/decision-owner-register.md` | Fixture | Step 4 |
| GOV-05 | Conflict log | `docs/phases/P00/governance/source-conflict-log.md` | Fixture | Step 4 |

## 7. Deliverable specifications

### 7.1 Common conventions

5. **Verification vocabulary** (lowercase): `unit`, `integration`, `contract`, `component`, `e2e`, `rendering`, `security`, `performance`, `accessibility`, `review`, `guard` (an absence check for an excluded or won't-have feature). These are the layers in `TEST-STRATEGY.md`, plus `review` and `guard`.
6. **Deadline grammar:** `before Pxx implementation` (the ADR or owner decision is accepted before Pxx's Test Engineer or Developer steps start, i.e. at Pxx architecture-plan approval) or `before Pxx gate` (the decision is a deliverable of Pxx and must be accepted at Pxx's gate). Regex: `^before P(0[0-9]|1[0-5]) (implementation|gate)$`. No calendar dates, because no source provides them (PD-P00-03).
8. **Decider vocabulary:** `Product owner`. Per `AGENT-WORKFLOW.md` and `decisions/README.md`, only the owner accepts decisions. Any other value needs a recorded owner delegation in `decisions.md`.
9. **Preparer format:** `<Role> (Pxx)`, where Role ∈ {`Solution Architect`, `Contract Architect`, `Test Architect`} and Pxx is the phase in which the ADR is drafted. Rule: the Preparer phase equals the Deadline phase.
10. **Assignment vocabulary:** `PROPOSED` (written by agents) or `OWNER-ACCEPTED` (set only by the main session after the owner accepts the P00 gate). `OWNER-ACCEPTED` is valid only if `decisions.md` §4 contains a line matching `^- Accepted by owner on \d{4}-\d{2}-\d{2}`.
11. **No placeholder tokens:** `TBD`, `TODO`, `FIXME`, `Pending phase execution`, `No tasks assigned yet`, `<fill>` (case-sensitive).
12. **No personal contact data:** GOV files must not contain e-mail addresses (`[\w.+-]+@[\w-]+\.[\w.-]+`) or international phone numbers (`\+\d[\d \-]{7,}\d`), because the source contains the owner's real contact data (see this plan's §9). The leading `+` is required so that ISO dates such as `2026-10-24` and digests do not match.
13. **Citation format** (GOV-04 Source sections, GOV-05 Sources): `<doc> <location>`. `<doc>` is one of `TECHNICAL-SPEC.md`, `README.md` (meaning `docs/source/README.md`), `reference/README.md` (meaning `docs/source/reference/README.md`), a Blueprint file name (`PROJECT-CHARTER.md`, `DECISION-REGISTER.md`, `ARCHITECTURE.md`, `AGENT-WORKFLOW.md`, `PHASE-GATES.md`, `REPOSITORY-STRUCTURE.md`, `TEST-STRATEGY.md`, `TRACEABILITY.md`), `CLAUDE.md`, or `Pxx/PHASE.md`. `<location>` is `§<n>[.<n>]`, a row ID (`ADR-029`, `FR-PER-03`), `header`, `App. A` or `App. B`. Separate multiple citations with `;`.

### 7.2 GOV-01 Source inventory — `docs/phases/P00/governance/source-inventory.md`

Required H2 headings: `## Baseline`, `## Files`, `## Requirement ID census`, `## Notes`.

**Files** table header:
`| Path | Kind | Authority | Bytes | SHA-256 | Cited by | Personal data | Notes |`

- Kind ∈ {`spec`, `research`, `screenshot`, `export-sample`, `reference-cv`, `index`}.

- Authority ∈ {`normative`, `normative-reference`, `evidence`, `index`}. `docs/source/TECHNICAL-SPEC.md` is the **only** `normative` row. `docs/source/README.md` is `evidence`. Files the spec names as the target design (Appendix A "Target template T1"; §6 reference renders; the reference CV) may be `normative-reference`. All other screenshots and export samples are `evidence` (PROJECT-CHARTER hierarchy; TECHNICAL-SPEC App. A: "reference material, not as the target design, unless a requirement says so").

- Personal data ∈ {`yes`, `no`}. The reference CV and its renders hold the owner's real data (`reference/README.md`); the research persona is fictitious (README header).

**Requirement ID census** table header: `| Group | Count | M | S | C | W |`. One row per group as in §3.1 (`FR-ACC` … `FR-PHO`, `NFR`) plus a final `Total` row. All numbers must equal values recomputed from the spec.

### 7.3 GOV-02 Requirement traceability matrix — `docs/phases/P00/governance/requirements-traceability.md`

Required H2 headings: `## Requirements`, `## Pagination rules`, `## Normative content without requirement IDs`, `## Notes`.

**Requirements** table header:
`| Req ID | Pri | Spec section | Summary | Phases | Primary phase | Verification | Decision deps | Notes |`

**Pagination rules** table header: `| Rule ID | Spec section | Summary | Phases | Primary phase | Verification | Notes |`.

**Normative content without requirement IDs** table header: `| Spec section | Content | Phases | Primary phase | Verification | Notes |`.

**Phase anchors**:

| Anchor source | Rule |
|---|---|
| `P03/PHASE.md` Objective "FR-AAA scope" | every `FR-AAA-*` lists P03 |
| `P04/PHASE.md` DoD "FR-BBB-01…02 and NFR-01" | FR-BBB-01…FR-BBB-02, NFR-01 list P04 |
| `TRACEABILITY.md` group rows | for each FR group row, each ID's Phases intersects that row's planned phases |

At least one row must cover each of these spec sections: `§2` (principles), `§6` (design), `§9` (output format). A row covers prefix `§n` if its section equals `§n` or starts with `§n.`.

### 7.4 GOV-03 Exclusion register — `docs/phases/P00/governance/exclusion-register.md`

Required H2 headings: `## Exclusions`, `## Implied exclusions`, `## Notes`.

**Exclusions** table header:
`| Excl ID | Source section | Excluded feature | Linked decision | Status | Guard phases | Guard verification | Allowed boundary |`

- Status ∈ {`EXCLUDED`, `EXCLUDED-PENDING-DECISION`}. **Rule:** a §3.2 row whose spec text contains `[DECISION D-xx]` (baseline: X4, X8, X9, X10) is `EXCLUDED-PENDING-DECISION`, and its Linked decision includes that D-xx. All other rows are `EXCLUDED`, with Linked decision `—` or valid IDs (PD-P00-05).

**Implied exclusions** table header: `| Source | Excluded behavior | Guard phases | Notes |`. These are behaviors excluded by requirement text rather than §3.2, e.g. FR-RTE-08 "No own spell-check service", FR-PDF-01 "no modal, no e-mail, no share link", FR-EDT-08 leave-page warnings, §13 F42 Print. Source cells cite the requirement ID. No new IDs are created.

### 7.5 GOV-04 Decision-owner register — `docs/phases/P00/governance/decision-owner-register.md`

Required H2 headings: `## Register`, `## Unregistered decision candidates`, `## Notes`.

**Register** table header:
`| Primary ID | Linked IDs | Topic | Source sections | Status | Open aspect | Source recommendation | Decider | Preparer | Needed by | Deadline | Release blocker | Assignment | Notes |`

- Release blocker ∈ {`yes`, `no`}. The row that contains D-20/ADR-012/ADR-032 must be `yes` (DECISION-REGISTER ADR-012 "release blocker").

**Unregistered decision candidates** table header: `| Source | Candidate decision | Proposed handling | Preparer | Deadline | Notes |`.

**Deadline anchors**:

| IDs | Anchor | Source |
|---|---|---|
| ADR-003 | ≤ P01 | DECISION-REGISTER ADR-003 "Confirm in P01" |
| D-01 (ADR-004) | ≤ P02 | `P02/PHASE.md` Objective "D-01 gate" |

### 7.6 GOV-05 Source-conflict log — `docs/phases/P00/governance/source-conflict-log.md`

Required H2 headings: `## Log`, `## Notes`.

**Log** table header:
`| Conflict ID | Seed | Type | Sources | Summary | Affected IDs | Blocks P00 | Proposed handling | Status | Decider | Preparer | Needed by | Deadline | Evidence |`

- Type ∈ {`spec-internal`, `spec-vs-research`, `spec-vs-blueprint`, `blueprint-internal`, `blueprint-gap`, `missing-reference`, `ambiguity`}.

- Blocks P00 ∈ {`yes`, `no`}. `yes` means the owner must resolve it before the P00 gate can be accepted (AC-P00-20).

- Status ∈ {`OPEN`, `RESOLVED-BY-HIERARCHY`, `RESOLVED-BY-OWNER`} (PD-P00-07):

### 7.7 Seeds

| Seed | Topic | Key tokens | Finding |
|---|---|---|---|
| K-01 | Synthetic conflict | `FR-AAA-01`, `D-01`, `README.md §2` | Synthetic finding |
| K-02 | Synthetic blocker | `TECHNICAL-SPEC.md header`, `DECISION-REGISTER.md` | Synthetic finding. **Expected Blocks P00 = yes** |
