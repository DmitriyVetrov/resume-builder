# Decisions — P00

This file records the **process decisions** P00 makes (section 1) and a **status snapshot** of every open item (section 2).
P00 does not decide any product or technology question. Every D-01…D-20 item and every OPEN, SOURCE-OPEN or PROPOSED register
item keeps the status recorded in its source. Proposed owners and deadlines for these items go to the decision-owner register
(`governance/decision-owner-register.md`, task GOV-04) and become binding only when the owner accepts the P00 gate.

Rules: do not silently close open source decisions. Preserve recorded decisions and append new records below them.

## 1. P00 process decisions

Status vocabulary: `PROPOSED` (Architect proposal; binding once the owner approves the phase plan or the P00 gate) and
`ACCEPTED` (owner acceptance recorded in section 4).

| ID | Decision | Status | Rationale | Source |
|---|---|---|---|---|
| PD-P00-01 | The governance deliverables GOV-01…GOV-05 live in `docs/phases/P00/governance/` as Markdown with fixed table headers and controlled vocabularies (phase-plan §7) | PROPOSED | Stays inside the P00 allowed path; tables are both human-readable and checkable with the Python standard library | `P00/PHASE.md` Allowed paths; phase-plan §7 |
| PD-P00-02 | P00 executable checks live in `docs/phases/P00/tests/` (fixtures in `docs/phases/P00/tests/fixtures/`), use the Python 3 standard library only, run offline and are deterministic. `tests/**` and `scripts/**` stay untouched | PROPOSED | No new top-level path. `tests/**` belongs to the Test Engineer for product tests, and the toolchain does not exist before P03 | `CLAUDE.md` Current repository state; `REPOSITORY-STRUCTURE.md` Ownership |
| PD-P00-03 | Decision deadlines are phase-relative: `before Pxx implementation` or `before Pxx gate`, with the ordering rule of phase-plan §7.1 items 6–7. There are no calendar dates | PROPOSED, **needs owner confirmation (Q-1, K-12)** | No source gives dates. `DECISION-REGISTER.md` Gate policy requires an ADR "before implementation" of the affecting phase. The spec header asks for [DECISION] choices "before stage 2", so the owner must confirm the deviation | `DECISION-REGISTER.md` Gate policy; `TECHNICAL-SPEC.md` header |
| PD-P00-04 | Owner model: the Decider of every item is the Product owner. The Preparer is the role that drafts the ADR, written `<Role> (Pxx)`. Assignments start as `PROPOSED`, and only the main session sets `OWNER-ACCEPTED` after the gate | PROPOSED, **needs owner confirmation (Q-3)** | `AGENT-WORKFLOW.md`: "Solution Architect drafts, owner accepts". `decisions/README.md` requires an owner per ADR | `AGENT-WORKFLOW.md` Artifact ownership; `docs/blueprint/decisions/README.md` |
| PD-P00-05 | §3.2 exclusions tagged with a decision (X4/D-07, X8/D-08, X9/D-09, X10/D-10) are treated as **excluded** (status `EXCLUDED-PENDING-DECISION`) until an accepted ADR formally changes the scope. D-07…D-10 stay SOURCE-OPEN | PROPOSED, **needs owner confirmation (Q-2, K-11)** | §3.2 is headed "must NOT be built". `PROJECT-CHARTER.md`: "must remain excluded unless scope is formally changed". `CLAUDE.md`: "Do not implement functions excluded by TECHNICAL-SPEC.md" (originally written in Russian). This applies the strictest reading and does not answer the decisions | `TECHNICAL-SPEC.md` §3.2; `PROJECT-CHARTER.md` Explicitly excluded |
| PD-P00-06 | The source baseline is pinned in GOV-01 by spec version string plus SHA-256 of every file under `docs/source/`. Any later change to `docs/source/**` needs an owner-approved re-baseline with a traceability impact note before dependent phases continue | PROPOSED | The spec is "0.1 draft, For review" (R-01). Drift must be visible, not silent | `TECHNICAL-SPEC.md` header; `PROJECT-CHARTER.md` hierarchy |
| PD-P00-07 | Conflict statuses are `OPEN`, `RESOLVED-BY-HIERARCHY` (only for spec-vs-research, where the spec outranks the research; the owner confirms at the gate) and `RESOLVED-BY-OWNER` (only with cited owner evidence). Agents never mark a conflict resolved in any other way | PROPOSED | `PROJECT-CHARTER.md`: "If sources conflict, do not silently reconcile: raise a decision record with exact source sections" | `PROJECT-CHARTER.md` Source-of-truth hierarchy |
| PD-P00-08 | ID hygiene. New P00 IDs use distinct prefixes: `AC-P00-nn`, `PD-P00-nn`, `GOV-nn`, `SC-nn`, `K-nn`, `OOS-nn`, `Q-n` (test IDs are chosen by the Test Architect). Reference-product codes are written `RG D1`, `RG T5`. Spec principles are written `§2 P1`. Phases always have two digits (`P01`) | PROPOSED | Avoids the collisions D-xx/RG D1–D17, T1–T3/RG T1–T7 and P1–P5/P00–P15 (K-22) | `TECHNICAL-SPEC.md` §2, §12; `README.md` §10, §12 |
| PD-P00-09 | P00 artifacts are written in English. The Russian DoD and test-strategy sentences of `PHASE.md` are quoted verbatim | PROPOSED | Matches the Blueprint docs (`CLAUDE.md` Language) | `CLAUDE.md` Language |
| PD-P00-10 | P00 edits no Blueprint, source, `.claude`, `CLAUDE.md` or script file. Needed changes are listed as proposals (phase-plan §14, OOS-01…OOS-06) for the owner to approve | PROPOSED | Handoff scope; `REPOSITORY-STRUCTURE.md` change policy | P00 handoff; `P00/PHASE.md` Allowed paths |

No ADR file is created in P00 (phase-plan §11).

## 2. Status snapshot of open items (baseline 2026-11-01)

The statuses below are copied unchanged from `docs/blueprint/DECISION-REGISTER.md` and TECHNICAL-SPEC §12. "Recommendation" is the
source's own recommendation. It is **not adopted**. P00 handling is the same for every row: the item **remains open**, and GOV-04
proposes a Decider, Preparer, Needed-by phase and Deadline for the owner to accept at the P00 gate.

### 2.1 Source-open product decisions (TECHNICAL-SPEC §12, mirrored in the register)

| Primary ID | Linked IDs | Topic | Status at baseline | Recommendation (not adopted) | Spec sections citing it |
|---|---|---|---|---|---|
| D-01 | ADR-013 | Login before e-mail verification | SOURCE-OPEN | Allow, but require verification before the first export | §5.1, §12 |
| D-02 | ADR-014 | Google sign-in | SOURCE-OPEN | Later | §5.1, §12 |
| D-03 | ADR-015 | Guest mode | SOURCE-OPEN | Yes for first-time users; claim on sign-up | §5.1, §12 |
| D-04 | ADR-016 | Trash for deleted resumes | SOURCE-OPEN | Yes, 30 days | §5.2, §12 |
| D-05 | ADR-017 | Guided first run | SOURCE-OPEN | No for v1 | §5.3, §12, §13 |
| D-06 | ADR-018 | Default sections of a blank resume | SOURCE-OPEN | As in FR-SEC-01 | §5.5, §12 |
| D-07 | ADR-019 | Any autosuggest | SOURCE-OPEN | No (§2 P1); country/month pickers only | §3.2, §12 |
| D-08 | ADR-020 | Import existing resume | SOURCE-OPEN | Not in v1; own-TXT import maybe v1.1 | §3.2, §12, §13 |
| D-09 | ADR-021 | DOCX export | SOURCE-OPEN | Not in v1 | §3.2, §12 |
| D-10 | ADR-022 | Monetization / paywall | SOURCE-OPEN | Out of scope for this specification | §3.2, §12, §13 |
| D-11 | ADR-023 | Editable entry field labels per section | SOURCE-OPEN | Yes | §5.6, §12 |
| D-12 | ADR-024, ADR-011 | T2 and T3 designs | SOURCE-OPEN (both) | §7 proposal | §5.8, §7, §12 |
| D-13 | ADR-025 | T3 per-section sidebar placement | SOURCE-OPEN | Yes | §5.8, §12 |
| D-14 | ADR-026 | T1 colors | SOURCE-OPEN | Blue #2A68A0, Navy #335776, Graphite #333333 | §5.9, §12 |
| D-15 | ADR-027 | Font preset factors; scaling of markers/photo | SOURCE-OPEN | ×0.9 / ×1.0 / ×1.2; markers and photo fixed | §5.10, §6.9, §12 |
| D-16 | ADR-028 | Line spacing step size | SOURCE-OPEN | 0.5 pt per step (see conflict seed K-03) | §5.10, §12 |
| D-17 | ADR-029 | Concurrent edit in two tabs | SOURCE-OPEN | Reload the stale tab with a notice (see K-01) | §5.14, §12 |
| D-18 | ADR-030 | Link color in T1 | SOURCE-OPEN | Accent color, no underline in PDF | §6.2, §12 |
| D-19 | ADR-031 | Education entry layout in T1 | SOURCE-OPEN | Same as Experience | §6.7, §12 |
| D-20 | ADR-032, ADR-012 | Hosting region / EU data residency | SOURCE-OPEN (both); **release blocker** | EU | §11, §12 |

### 2.2 Register items that are open, proposed or have an open aspect

| ID | Topic | Status at baseline | Open aspect (from register "Blueprint handling") |
|---|---|---|---|
| ADR-002 | Backend .NET | FIXED | Exact SDK / target framework OPEN |
| ADR-003 | Frontend React 19 + Vite | FIXED | TypeScript recommended; config to be confirmed in P05 |
| ADR-004 | NoSQL | FIXED | Provider OPEN; MongoDB PROPOSED, not selected |
| ADR-006 | API contract-first | FIXED | OpenAPI 3.1 PROPOSED as canonical format |
| ADR-007 | Modular monolith | PROPOSED | Confirm in P01 |
| ADR-008 | Clean Architecture boundaries | PROPOSED | Pragmatic layers |
| ADR-009 | Object storage for photos/exports | PROPOSED | Provider / region / retention OPEN |
| ADR-010 | Shared preview/PDF layout engine | REQUIRED (FR-PRV-02) | Renderer technology OPEN; options in P01, prototype in P11 |
| ADR-033 | Hosting platform and CI provider | OPEN | Needed by P03; must satisfy ADR-012 (EU) |
| ADR-034 | Transactional e-mail provider | OPEN | Needed by P06; EU processing per NFR-09 |

ADR-001 (Monorepo) and ADR-005 (Tailwind CSS 4) are FIXED with no open aspect, so they are not tracked as open items.
Coverage check: section 2 lists 20 D-IDs and 32 ADR-IDs, which is the 52-ID required set of phase-plan §7.5.

### 2.3 Unregistered proposals observed (no register ID; P00 assigns none)

| Source | Proposal | Status in source |
|---|---|---|
| `ARCHITECTURE.md` §4, §6 | Optimistic-concurrency version token for resume updates | "proposed mechanism" |
| `ARCHITECTURE.md` §2 | Authentication/session design, e-mail delivery, rate limiting ("require threat model and ADR") | Requires ADR |
| `ARCHITECTURE.md` §2 | Background processing for export "only if measurements justify it" | Conditional proposal |
| `TEST-STRATEGY.md` Candidate tooling | xUnit, Vitest, React Testing Library, Playwright, etc. | "Candidate tooling (confirm in P03)" |

These go to the GOV-04 table "Unregistered decision candidates" and to proposal OOS-02 (P01 assigns ADR IDs).

## 3. Decisions taken in P00 on product or technology questions

None. P00 does not decide any D-xx item or any OPEN, SOURCE-OPEN or PROPOSED register item.

## 4. Owner acceptance record

No owner acceptance has been recorded, because the P00 gate has not been held. The main session appends the owner's decisions here
after `/close-phase P00`, with the date and answers to Q-1…Q-5 (phase-plan §15). The record must begin with a line of the form
`- Accepted by owner on YYYY-MM-DD`; checks detect that marker (phase-plan §7.1 item 10).

- Accepted by owner on 2026-11-01 (recorded by the main session from the owner's answers in the P00 session; the gate itself is closed by `/close-phase P00`).
  - **Q-1:** Accepted. TECHNICAL-SPEC "0.1 draft · 2026-10-24" (SHA-256 in GOV-01) is the P00 source baseline. Phase-relative decision deadlines are acceptable (PD-P00-03 accepted). SC-12 is resolved on this basis.
  - **Q-2:** Accepted. PD-P00-05: X4, X8, X9 and X10 stay excluded until an accepted ADR changes the scope. D-07…D-10 remain SOURCE-OPEN.
  - **Q-3:** The owner delegates **technical** ADRs to the Solution Architect as Decider: exact versions, providers, tooling and renderer technology, e.g. ADR-002, ADR-004, ADR-006…ADR-010, ADR-033, ADR-034. The owner remains Decider for product decisions D-01…D-20 and for EU hosting/data residency (ADR-012/ADR-032, D-20). The GOV-04 Decider column still reads "Product owner", because the P00 check format has no delegation value (test-plan issue I-05). Updating it is a P01 follow-up.
  - **Q-4:** Accepted. The `docs/phases/P00/governance/` and `docs/phases/P00/tests/` locations are approved (PD-P00-01, PD-P00-02). The phase plan and test plan are approved.
  - **Q-5:** Accepted. Rendering and TXT fixtures may use the owner's real reference-CV content; the owner states it contains nothing confidential. This also answers SC-25.
  - **Owners and deadlines:** the GOV-04 owner/deadline proposals are accepted (Assignment set to `OWNER-ACCEPTED`), as is PD-P00-04. The process decisions PD-P00-01…10 and PD-P00-11…13 are accepted.
  - **Conflict log:** the owner confirms RESOLVED-BY-HIERARCHY rows SC-13, SC-14, SC-15 and SC-28, and RESOLVED-BY-OWNER row SC-16.
  - **Out-of-scope proposals:** OOS-01…OOS-04 and OOS-07 (Blueprint wording for SC-30, from review finding F-05) are approved, to be applied by the Solution Architect at the start of P01. OOS-05 (governance checks as a CI regression) is approved for P03. OOS-06 (spec typo fixes) is the owner's own edit; agents do not touch `docs/source/**`.

## 5. Architect answers to Test Engineer escalations (implementation step, 2026-11-01)

Appended by the Solution Architect acting as documentation implementer (step 4). The answers interpret existing plan rules for the
escalations E-1…E-3 recorded in `tests/test-results.md`. They change no test, fixture, criterion or format. They sit after §4 on
purpose: the gate check reads only §4, so text here can neither satisfy nor break the owner-record check. Status vocabulary as in §1.

| ID | Escalation | Answer | Status | Rationale | Source |
|---|---|---|---|---|---|
| PD-P00-11 | E-1: fixture SC-03 uses Needed by `P01` with Deadline `before P00 gate`, because test-plan §8.1 (Needed by `P00` with `before P00 gate`) breaks the ordering rule | **Confirmed.** The ordering rule of phase-plan §7.1 item 7 applies to GOV-05 OPEN rows unchanged; §7.6 only widens the phase range to P00. Valid OPEN rows that name P00 are: Needed by `P01`…`P15` with `before P00 gate` (or `before P00 implementation`), or Needed by `P00` with `before P00 implementation`. The real K-12 row (SC-12) uses Needed by `P01`, Deadline `before P00 gate`, Preparer `Solution Architect (P00)`. The test-plan §8.1 text is a documentation slip; NF-41/NF-42 cover both sides correctly | PROPOSED | "Needed by" is the first phase that depends on the answer; for a P00-gate item that is P01, so the fixture reading is also the more accurate one | phase-plan §7.1 items 6–7, §7.6; test-plan §8.1 |
| PD-P00-12 | E-2: finding codes `EMPTY_BODY`, `SPEC_SANITY`, `REGISTER_SANITY`, `NO_REFERENCES`, `SEED_FORMAT` added beyond test-plan §6.4 | **Confirmed, no objection.** `EMPTY_BODY` names the existing TC-P00-01-01 condition "≥ 1 non-heading, non-empty line". The other four report the sources-test conditions of TC-P00-S-01, TC-P00-14-04, TC-P00-05-01 and TC-P00-19-02, whose failure is a stop condition (phase-plan §13), not a deliverable defect. They add detection and weaken nothing. Documentation request for the Test Architect: list them in test-plan §6.4 | PROPOSED | Finding codes are labels for conditions the test plan already defines | test-plan §6.4, §7 (TC-P00-01-01, S-01, 05-01, 14-04, 19-02) |
| PD-P00-13 | E-3: `OWNER_RECORD_INCOMPLETE` is reported only when the `- Accepted by owner on …` marker exists | **Confirmed, no objection.** Without the marker the check reports `OWNER_RECORD_MISSING`, so TC-P00-25-01 fails either way and the gate cannot pass. Checking completeness only once a record exists avoids noise and is not a weakening | PROPOSED | The marker is the record's identity (phase-plan §7.1 item 10); completeness is a property of an existing record | phase-plan §7.1 item 10; test-plan §7 TC-P00-25-01, Issue I-14 |
