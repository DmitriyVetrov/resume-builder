# Acceptance Criteria

Confirmed: backend/frontend boundaries, persistence provider, file storage, auth, rendering prototype plan, EU hosting approach.

List requirement IDs and observable pass/fail criteria.

## P01 criteria

Paths are relative to the repository root. "ADR complete" means the file has the lines `Status: **Accepted**`, `Decider: Solution Architect (delegated, ADR-035)`, `Date: 2026-11-02` and `Source IDs:`, plus the sections `## Context`, `## Decision`, `## Alternatives considered`, `## Rationale`, `## Consequences`, `## Security/privacy impact` and `## Owner and date` (template in `docs/blueprint/decisions/README.md`).

| ID | Pri | Criterion (observable) | Requirement / DoD | Verification |
|---|---|---|---|---|
| AC-P01-01 | Must | `docs/phases/P01/kickoff.md` exists and names the roles (Contract Architect: no), the test budget under ADR-035 B-4, the parallel slices (none) and the decisions needed | PHASE-GATES DoD; ADR-035 B-1 | check module + review |
| AC-P01-02 | Must | **Backend/frontend boundaries confirmed:** ADR-007 and ADR-008 are complete; phase-plan §5 states that the contract is the only link and that rendering is in the frontend; fitness rules F-BE-1…5 and F-FE-1…3 are listed | DoD "boundaries"; ARCHITECTURE §1 | check module + review |
| AC-P01-03 | Must | **Persistence provider confirmed:** ADR-004 is complete and names the provider, the major version, local setup, the production service, the region, the write concern and the backup/RPO approach | DoD "persistence provider"; NFR-10 | check module + review |
| AC-P01-04 | Must | **File storage confirmed:** ADR-009 is complete and names the provider, region, access model (private, API-mediated), key scheme, re-encode rule and export storage policy | DoD "file storage"; FR-PHO-01…05; NFR-08 | check module + review |
| AC-P01-05 | Must | **Auth confirmed:** ADR-036, ADR-013, ADR-014, ADR-015 and ADR-038 are complete; ADR-036 names the hashing algorithm and parameters, the session mechanism, CSRF defence, token handling and anti-enumeration | DoD "auth"; FR-ACC-01…06; NFR-08 | check module + review |
| AC-P01-06 | Must | **Rendering prototype plan confirmed:** ADR-010 is complete and states the layout location, the single page model, where PDF and TXT are produced, the candidate libraries, and a prototype plan with measurable go/no-go criteria (parity, NFR-01, NFR-03, fidelity, determinism), a phase and a fallback | DoD "rendering prototype plan"; FR-PRV-02; NFR-01; NFR-03; NFR-14 | check module + review |
| AC-P01-07 | Must | **EU hosting approach confirmed:** ADR-012 (D-20), ADR-033 and ADR-034 are complete; every service in the personal-data path is pinned to an EU region or EU data location | DoD "EU hosting approach"; NFR-09; D-20 | check module + review |
| AC-P01-08 | Must | `architecture/domain-model.md` covers every entity of TECHNICAL-SPEC §10.1 (User, Resume, LayoutSettings, Header, ContactItem, Section, TextContent, ListContent, EntriesContent, Entry, Photo) and §10.2 (Paragraph, BulletList, Text, Link, LineBreak), with invariants, limits (NFR-12), IDs and the persistence mapping | §10; NFR-12 | check module |
| AC-P01-09 | Must | `architecture/threat-model.md` covers all six STRIDE categories and the four mandatory topics (authentication, guest-to-account claim, object storage access, export endpoints), plus no-content logging and GDPR deletion/export; every threat row has a mitigation, a reference, a phase and a verification | `.claude/rules/03`; NFR-08; NFR-09 | check module + review |
| AC-P01-10 | Must | Every ADR listed in phase-plan §8 exists in `docs/blueprint/decisions/` and is complete | `decisions/README.md` template | check module |
| AC-P01-11 | Must | `DECISION-REGISTER.md`: every ID decided in P01 (phase-plan §8, plus ADR-032, which links the ADR-012 file) has status `ACCEPTED` or `FIXED` and links its ADR file; the one exception is ADR-010, which keeps `REQUIRED` (spec-mandated by FR-PRV-02; per the register vocabulary a `REQUIRED` row whose open aspect is decided keeps its status and links the ADR) (PD-P01-09); none of them is `OPEN`, `SOURCE-OPEN` or `PROPOSED`; ADR-036…ADR-040 are registered; the items in decisions.md §4 keep an open status with their phase | ADR-035 A-4; OOS-02 | check module |
| AC-P01-12 | Must | `decisions.md` §2: every row carries `DELEGATED-DEFAULT`, the options considered, a reason and an ADR or document reference; §3 resolves every P01-assigned P00 conflict (SC-01, 02, 05, 08, 09, 11, 17–23, 25, 26, 29, 30) | ADR-035 A-4; P00 GOV-05 | check module |
| AC-P01-13 | Must | No excluded feature is introduced: ADR-019…ADR-022 keep X4, X8, X9 and X10 excluded; no P01 document plans an X1–X11 feature | TECHNICAL-SPEC §3.2 | review |
| AC-P01-14 | Must | Scope: the files changed since `main` are only those under phase-plan "Allowed paths"; `docs/source/**`, `contracts/**`, `backend/**` and `frontend/**` are unchanged | PHASE.md Allowed paths | `python3 scripts/phase-handoff-check.py --phase P01 --role <role> --worktree .` → `RESULT PASS` |
| AC-P01-15 | Must | `python3 scripts/check-blueprint.py` exits 0, and every command in `docs/phases/P01/tests/suite.cmd` exits 0 | ADR-035 B-5 | handoff check / gate |
| AC-P01-16 | Should | `TRACEABILITY.md` has rows for NFR-04, NFR-05, NFR-07, NFR-10…NFR-14, §8 and §9; FR-ACC includes P13; FR-LIB-06 includes P12 (OOS-01). `ARCHITECTURE.md` §2, §4, §5 and §6 reference the accepted ADRs (OOS-03) | P00 OOS-01, OOS-03 | review |

Negative cases (the check module must show that each can fail): an ADR missing a required section; a register row for a P01-decided ID still `OPEN`; a `decisions.md` §2 row without `DELEGATED-DEFAULT`; a threat model without one STRIDE category; a domain model without one §10.1 entity.
