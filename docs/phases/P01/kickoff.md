# P01 Kickoff — Solution Architecture & ADRs

- Phase: P01. Dependency P00 is `COMPLETED` (gate closed 2026-11-02).
- Written by: Solution Architect (Orca worker, task `task_cd82a3ee2df9`), 2026-11-02.
- Mode: autonomous (ADR-035). The Solution Architect decides every question by delegation (ADR-035 A-4) and tags the answer `DELEGATED-DEFAULT` in `decisions.md`.

## 1. Scope summary

P01 turns the Blueprint proposals into accepted architecture decisions, so that P02 can freeze the API contract and P03 can build the toolchain. The DoD in `PHASE.md` lists what P01 must confirm: backend/frontend boundaries, the persistence provider, file storage, auth, the rendering prototype plan and the EU hosting approach.

P01 is a **documents-only phase**. It produces no production code, no contract, no infrastructure and no product tests.

| Deliverable | Content | Source IDs |
|---|---|---|
| ADRs (`docs/blueprint/decisions/`) | One file per decision, status Accepted, Decider "Solution Architect (delegated, ADR-035)" | Register items ADR-002…ADR-034, new ADR-036…ADR-039 |
| Domain model (`architecture/domain-model.md`) | Aggregates, invariants, limits, IDs, storage mapping, client-only state | TECHNICAL-SPEC §4, §5.4–§5.7, §5.14, §5.15, §10, NFR-12 |
| Threat model (`architecture/threat-model.md`) | Assets, trust boundaries, STRIDE per boundary, the four mandatory topics of `.claude/rules/03-security-privacy.md`, GDPR lifecycle | NFR-08, NFR-09, NFR-10, NFR-13, FR-ACC-01…06, FR-PHO-01…05 |
| Phase plan, decisions, acceptance criteria, task files | Plan with `## Allowed paths`; `DELEGATED-DEFAULT` answers; observable criteria | `PHASE.md` DoD |
| Register and Blueprint alignment | `DECISION-REGISTER.md` statuses; OOS-01 (`TRACEABILITY.md`), OOS-02 (register), OOS-03 (`ARCHITECTURE.md`); OOS-07 is already resolved | P00 `decisions.md` §4 (owner approval); coordinator approval 2026-11-02 |

The main requirement groups P01 designs for are FR-ACC, FR-LIB, FR-HDR, FR-SEC, FR-TYP, FR-RTE (the AST only), FR-PRV-02, FR-PDF-02/03/07/09, FR-TXT-02/04, FR-PER-01…05, FR-PHO-01…05, and NFR-01, NFR-03, NFR-08…NFR-14.

## 2. Roles

| Step | Role | Needed | Notes |
|---|---|---|---|
| 1–2 | Solution Architect | yes | Kickoff, plan, ADRs, delegated decisions, task files. Also writes the domain model and the threat model (see §2.1) |
| 3 | Test Architect | yes | Lean `tests/test-plan.md` within the §3 budget |
| 4 | Contract Architect | **no** | P01 changes no API. The contract starts in P02 |
| 5 | Test Engineer | yes | One check module and `tests/suite.cmd` (§3) |
| 6 | Backend / Frontend Developer | **no dispatch** | P01 has no code tasks. The task files list only the downstream obligations that the ADRs create |
| 7 | Code Reviewer | yes | One architecture review pass: ADRs against the spec, consistency, security, scope |
| 8 | QA / Acceptance | yes | Runs the acceptance matrix and the suite |

### 2.1 Why the Architect writes the domain and threat models

Normally an execution role writes the documents that a phase delivers (`.claude/agents/solution-architect.md`, ADR-035 B-3). In P01 the coordinator assigned both models to this step, and two reasons support that:
1. Both models decide architecture: aggregate boundaries, the storage shape, trust boundaries and mitigations. They are not implementation. Several ADRs (ADR-004, ADR-009, ADR-036…ADR-039) depend on them and were written together with them.
2. P01 has no code role that could own them. A separate documentation dispatch would re-read the same inputs, which is the W-2/W-3 cost that ADR-035 removes.

Because the documents already exist when the tests are written, the test step cannot show the usual red state. That exception to the TDD order is recorded as PD-P01-03 in `decisions.md`.

## 3. Test budget (ADR-035 B-4: documents/architecture phase)

- **One** Python 3 module that uses only the standard library: `docs/phases/P01/tests/check_p01.py`. It runs offline and deterministically, has at most about 300 lines, and contains no separate test framework, CLI framework or fixture tree.
- `docs/phases/P01/tests/suite.cmd` holds exactly one command: `python3 -B docs/phases/P01/tests/check_p01.py`.
- The module checks the artifacts for structure and completeness, not for prose quality:
  - ADR completeness. Every ADR listed in phase-plan §8 exists and has Status Accepted, Decider, Date, source IDs, Decision, Alternatives, Consequences and Security/privacy impact.
  - Register consistency. No ID decided in P01 is still `OPEN`, `SOURCE-OPEN` or `PROPOSED`, and every such row links its ADR file.
  - Every decision in `decisions.md` §2 has the `DELEGATED-DEFAULT` tag, options and a reason.
  - The threat-model checklist (threat-model §9 topics are present).
  - The domain model covers every entity in TECHNICAL-SPEC §10.1 and §10.2.
  - `## Allowed paths` exists in the phase plan.
- Negative evidence: a few in-memory negative cases (an ADR missing a heading, a register row still `OPEN`) prove that each check can fail. This replaces the red state, which an architecture phase cannot show (PD-P01-03).
- Architecture review and the "architecture fitness checks" from `PHASE.md` are covered here as follows: the Code Reviewer reviews the architecture once, and P01 *defines* the fitness rules (phase-plan §6). The executable fitness tests belong to P04 (backend layering) and P05 (frontend boundaries). P01 has no code they could run against.

A larger test plan needs a reason recorded in this file (PHASE-GATES "Autonomous gate rules").

## 4. Parallel slices

None. P01 is sequential and documents-only, and there are no Backend ∥ Frontend child worktrees. The first frozen contract slice comes in P02.

## 5. Decisions this phase needs, and how they were decided

All of them were decided by delegation, using the ADR-035 A-4 precedence: TECHNICAL-SPEC first, then reference evidence from `README.md`, then the most conservative, reversible and standard option. Full records are in `decisions.md`. The ADRs are in `docs/blueprint/decisions/`.

| Need (PHASE DoD / P00 GOV-04) | Decision | ADR | Basis |
|---|---|---|---|
| Exact .NET version | .NET 10 LTS (`net10.0`) | ADR-002 | Conservative: the only LTS supported past Nov 2026 |
| Frontend toolchain config | React 19, Vite, TypeScript strict, Node.js 24 LTS, npm, static SPA | ADR-003 | Fixed constraint plus a standard option |
| NoSQL provider | MongoDB 8.x; MongoDB Atlas in an EU region for production; local Docker replica set | ADR-004 | Blueprint proposal; meets RPO, concurrency, EU and portability needs |
| Boundaries | Modular monolith with pragmatic Clean Architecture; frontend owns rendering; contract is the only link | ADR-007, ADR-008 | Blueprint proposals confirmed |
| Object storage | Azure Blob Storage, private, EU region; Azurite locally; API-mediated access; exports not stored | ADR-009 | Conservative and private by default |
| Rendering approach and prototype plan | One TypeScript layout engine in the frontend, producing one page model that is painted to the preview and written to PDF in the browser; TXT serialized in the browser; prototype at the start of P10 with go/no-go criteria | ADR-010 | FR-PRV-02, NFR-01, NFR-14; answers SC-23 |
| EU hosting (D-20) | All personal data stored and processed in the EU/EEA; primary region Germany West Central | ADR-012 (covers ADR-032) | Spec recommendation "EU" |
| Hosting platform, CI | Azure Container Apps (EU region); GitHub Actions calling repo scripts | ADR-033 | Standard and reversible (OCI images, scripts) |
| E-mail | SMTP adapter; Mailpit locally; Azure Communication Services Email (Europe data location) in production, with EU-headquartered fallbacks | ADR-034 | NFR-09 |
| Auth | First-party email and password; PBKDF2 via the framework hasher; server-side sessions in an HttpOnly cookie | ADR-036 | NFR-08; conservative |
| D-01, D-02, D-03 | Login before verification is allowed, and export needs verification; Google sign-in is later; guest mode yes (Could), with claim by normal create | ADR-013, ADR-014, ADR-015 | Spec recommendations |
| D-04, D-07…D-11, D-13, D-17 | Trash 30 days; no autosuggest/import/DOCX/paywall; editable labels; T3 placement per section; stale tab reloads with a notice and a conflict copy | ADR-016, ADR-019…ADR-023, ADR-025, ADR-029 | Spec recommendations; SC-01 reconciled |
| Concurrency, idempotency, rate limits, retention | Version/ETag and `If-Match`; `Idempotency-Key`; majority write concern; token-bucket limits; a deletion and retention schedule | ADR-037, ADR-038, ADR-039 | Unregistered candidates from GOV-04, now registered |

**Not decided in P01** (owner phase as in P00 GOV-04): D-05 and D-06 (P07); D-12, D-14, D-15, D-16, D-18, D-19 and conflict SC-03 (P10); ADR-006 contract format and the new ADR-040 contract tooling (P02); test tooling candidates (P03).

## 6. Follow-ups outside this step

- OOS-04 (`CLAUDE.md` "Commands" and "Current repository state"): `CLAUDE.md` is outside the Architect's paths. The Program Coordinator should record the P01 suite command and replace the "Still open" list with the ADR references when it closes the gate.
- Go-live owner actions (paid accounts, secrets, DNS) are listed in `decisions.md` §5. P15 collects them (ADR-035 §C).
