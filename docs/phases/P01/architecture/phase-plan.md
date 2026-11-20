# P01 Architecture Plan — Solution Architecture & ADRs

- Author: Solution Architect (Orca worker), 2026-11-02. Kickoff: `../kickoff.md`.
- Mode: autonomous (ADR-035). Decisions by delegation (`DELEGATED-DEFAULT`, `../decisions.md`).

## 1. Context

P00 baselined the sources and governance. It left every technology and product decision open, gave the Solution Architect (P01) as preparer for most of them (P00 GOV-04), and listed P01-assigned conflicts (P00 GOV-05: SC-01, 02, 05, 08, 09, 11, 17–23, 26, 29, 30). ADR-035 then delegated all owner decisions to the Solution Architect.

P01 must leave P02 a frozen architecture: boundaries, persistence, storage, auth, the rendering location and the EU hosting approach (PHASE.md DoD).

## 2. Scope

**In scope**
- Accepted ADRs for every register item P01 must close (§8).
- The domain model (`domain-model.md`) and the security threat model (`threat-model.md`).
- `DELEGATED-DEFAULT` decisions and conflict resolutions (`../decisions.md`).
- Updates to the register (`DECISION-REGISTER.md`), plus the owner-approved Blueprint alignment: OOS-01 (`TRACEABILITY.md`), OOS-02 (register), OOS-03 (`ARCHITECTURE.md`). The coordinator approved this on 2026-11-02 (PD-P01-07).
- Acceptance criteria, the test budget, task files listing downstream obligations.

**Out of scope**
- Any code, contract (`contracts/**`), infrastructure, `docker-compose.yml`, `scripts/**`, `.claude/**`, `CLAUDE.md` and `docs/source/**`.
- Decisions owned by later phases: D-05 and D-06 (P07); D-12, D-14, D-15, D-16, D-18, D-19 and SC-03 (P10); ADR-006 and ADR-040 (P02); test-tool confirmation (P03).
- Excluded features X1–X11 (TECHNICAL-SPEC §3.2). They stay excluded; ADR-019…ADR-022 confirm this.

## 3. Inputs

TECHNICAL-SPEC (baseline "0.1 draft · 2026-10-24"), `docs/source/README.md` (evidence only), the Blueprint docs, `DECISION-REGISTER.md`, ADR-035, and the P00 governance artifacts (GOV-04 owner register, GOV-05 conflict log, `decisions.md` §4 owner answers Q-1…Q-5).

## 4. Requirement mapping (what P01 decides for each group)

| Group | P01 architectural answer | ADRs / docs |
|---|---|---|
| FR-ACC-01…06 | First-party auth, server sessions, verification gate on export, guest mode via the normal create, no Google in v1, deletion and export flows | ADR-036, ADR-013, ADR-014, ADR-015, ADR-039 |
| FR-LIB-01…06 | Resume aggregate as one document; library projection; copy semantics; trash 30 days; export from the list is client-side | ADR-004, ADR-016, ADR-010, domain-model |
| FR-EDT, FR-SEC, FR-TYP, FR-HDR | Model fields, invariants, limits, defaults keyed by type; client-only state | domain-model, ADR-023, ADR-025 |
| FR-RTE | Format-neutral AST, URL allow-list, no HTML on the server | domain-model §3.8, threat model T-TA-03, T-ID-11 |
| FR-TPL, FR-CLR, FR-LAY | Templates are data consumed by the engine; per-type defaults; final template data in P10 | ADR-010, ADR-025, domain-model §3.3 |
| FR-PRV, FR-PDF, FR-TXT | One frontend layout engine and PageModel; PDF and TXT generated in the browser; prototype gate at the start of P10 | ADR-010 |
| FR-PER-01…05 | Version/ETag, `If-Match`, `Idempotency-Key`, majority ack, conflict copy, snapshots | ADR-037, ADR-029 |
| FR-PHO-01…05 | Blob storage, re-encoded master and rendition, API-mediated access | ADR-009 |
| NFR-01, NFR-03, NFR-04, NFR-05, NFR-14 | Client-side layout; deterministic PDF and TXT across Node and all browser families; prototype metrics G1–G7 (G7 cross-runtime identity; G4 includes TXT ≤ 1 s) | ADR-010 |
| NFR-02, NFR-05, NFR-11 | Static SPA on its own origin; managed containers in the EU | ADR-003, ADR-033 |
| NFR-06 | No architectural change. Accessibility is verified in P05, P08, P10 and P15 | — |
| NFR-07 | Bundled fonts with Latin Extended and Cyrillic; code-point length rules | ADR-010, domain-model §3 |
| NFR-08 | Hashing, sessions, owner checks, upload re-encoding, HTTPS | ADR-036, ADR-009, threat model |
| NFR-09 | EU residency, no trackers, deletion and export | ADR-012, ADR-039, threat model §6 |
| NFR-10 | Majority ack, request-hash guard on keyed writes, Atlas PITR, daily backups for 30 days, restore reconciliation with a ledger of erased accounts, purged resumes and deleted photos | ADR-004, ADR-037, ADR-039 |
| NFR-12 | Limits in the domain and middleware | domain-model §6, ADR-038 |
| NFR-13 | Content-free logs and client events | ADR-008 F-BE-5, ADR-010 §8 |

## 5. Component boundaries

```
frontend/  (static SPA, ADR-003)                      backend/  (one ASP.NET Core app, ADR-007)
 ├─ app / pages / widgets / features / entities        ├─ Api            (endpoints, auth, limits, errors)
 ├─ editor state, undo, autosave queue (IndexedDB)     ├─ Application    (use cases, ports)
 ├─ layout engine → PageModel (pure TS, ADR-010)       ├─ Domain         (aggregates, AST, invariants)
 │    ├─ preview painter     ├─ PDF writer             └─ Infrastructure (Mongo, Blob, SMTP, images, jobs)
 │    └─ TXT serializer      └─ thumbnails                  modules: Accounts · Resumes · Media · Lifecycle · Telemetry
 └─ generated API client types  ◄──── contracts/openapi (P02) ────►  server contract types / drift check
```

Boundary rules:
1. The OpenAPI contract is the **only** link between frontend and backend. There is no shared code, package or import (`CLAUDE.md`, F-FE-1).
2. **Rendering belongs to the frontend.** The backend never lays out, renders or stores exports (ADR-010, ADR-009).
3. Backend modules own their collections and talk through interfaces. Jobs run in-process with a lease (ADR-007).
4. Photos go through the API only. Storage is private (ADR-009).
5. All environments run the same services. Locally that is Mongo (replica set), Azurite and Mailpit in Compose (ADR-033). Production uses the EU-pinned managed equivalents (ADR-012).

## 6. Architecture fitness rules (defined here, executable in P04/P05)

From ADR-008:
- F-BE-1 Domain has no dependencies.
- F-BE-2 Application does not depend on Infrastructure, Api, ASP.NET or Mongo.
- F-BE-3 Api does not reference Mongo or storage SDK types.
- F-BE-4 No cross-module repository use.
- F-BE-5 Content types are never log properties.
- F-FE-1 No imports across the boundary except generated API types.
- F-FE-2 One-way frontend layering.
- F-FE-3 The layout engine is pure (no React or DOM).

## 7. Data and API impact (input to P02)

P01 creates no endpoints (no speculative contract). P02 must reflect these decisions:

| Area | Contract consequence | Source |
|---|---|---|
| Resume document | Schemas per domain-model §3 (nullable `listColumns` and `placement`, `labels`, `pageBreakBefore`, `showPhoto`, `language`, `dateFormat`); rich-text discriminator; limits as constraints | domain-model |
| Writes | `ETag`, `If-Match` (428/412), `Idempotency-Key` (replay on the same body, 422 `idempotency_key_reused` on a different body, document writes included); full-document replace; create from a blank, a copy or a full document (copy, claim, conflict copy) | ADR-037, ADR-029, ADR-015 |
| Library and trash | list projection; delete to trash; trash list; restore; permanent delete; `limit_reached` | ADR-016 |
| Photos | multipart upload; crop update; rendition and master GET (`private, no-cache` with `ETag`); delete | ADR-009 |
| Accounts | sign-up, verify, resend, login, logout, reset request and confirm, change password, session/me (`emailVerified`), delete account (re-auth), data export (re-auth, verified, `no-store`) | ADR-036, ADR-013, ADR-039 |
| Telemetry | content-free client error event (NFR-13) | ADR-010 §8 |
| Cross-cutting | error envelope (format decided in P02 under ADR-006; RFC 9457 Problem Details recommended) with codes and paths and no values; 401/403/404/409/412/422/428/429 + `Retry-After`; antiforgery header; no PDF/TXT export endpoints | threat model §7, ADR-038 |

## 8. ADRs produced in P01

All have status Accepted under delegation, Decider "Solution Architect (delegated, ADR-035)", date 2026-11-02, in `docs/blueprint/decisions/`.

| ADR | Topic | File | Needed by |
|---|---|---|---|
| ADR-002 | .NET 10 LTS | `ADR-002-dotnet-version.md` | P02, P03, P04 |
| ADR-003 | Frontend toolchain | `ADR-003-frontend-toolchain.md` | P02, P03, P05 |
| ADR-004 | MongoDB | `ADR-004-nosql-provider-mongodb.md` | P03, P04, P07 |
| ADR-007 | Modular monolith | `ADR-007-modular-monolith.md` | P04 |
| ADR-008 | Layers and fitness rules | `ADR-008-clean-architecture-boundaries.md` | P04, P05 |
| ADR-009 | Object storage | `ADR-009-object-storage.md` | P02, P03, P07 |
| ADR-010 | Shared layout engine (frontend) | `ADR-010-shared-layout-engine-and-rendering.md` | P02, P10, P11, P12 |
| ADR-012 | EU hosting (D-20; closes ADR-032) | `ADR-012-eu-hosting-data-residency.md` | P03, P15 |
| ADR-013 | D-01 login before verification | `ADR-013-login-before-verification.md` | P02, P06 |
| ADR-014 | D-02 no Google sign-in in v1 | `ADR-014-google-sign-in.md` | P02, P06 |
| ADR-015 | D-03 guest mode | `ADR-015-guest-mode.md` | P06, P08 |
| ADR-016 | D-04 trash 30 days | `ADR-016-trash-retention.md` | P02, P07 |
| ADR-019 | D-07 no autosuggest | `ADR-019-no-content-autosuggest.md` | P02, P08 |
| ADR-020 | D-08 no import | `ADR-020-no-resume-import.md` | P02 |
| ADR-021 | D-09 no DOCX | `ADR-021-no-docx-export.md` | P02, P12 |
| ADR-022 | D-10 no monetization | `ADR-022-no-monetization.md` | P02 |
| ADR-023 | D-11 editable entry labels | `ADR-023-editable-entry-labels.md` | P02, P08 |
| ADR-025 | D-13 T3 placement per section | `ADR-025-t3-section-placement.md` | P02, P10 |
| ADR-029 | D-17 concurrent tabs | `ADR-029-concurrent-tabs.md` | P02, P08 |
| ADR-033 | Hosting platform and CI | `ADR-033-hosting-platform-and-ci.md` | P03, P15 |
| ADR-034 | Transactional e-mail | `ADR-034-transactional-email.md` | P03, P06 |
| ADR-036 | Authentication and sessions | `ADR-036-authentication-and-sessions.md` | P02, P06 |
| ADR-037 | Concurrency, idempotency, durability | `ADR-037-concurrency-idempotency-durability.md` | P02, P07, P08 |
| ADR-038 | Rate limiting and abuse protection | `ADR-038-rate-limiting-and-abuse-protection.md` | P02, P04, P06 |
| ADR-039 | Data retention and deletion | `ADR-039-data-retention-and-deletion.md` | P02, P07, P13 |

Registered but **not** decided in P01: ADR-040 (contract validation and type-generation tooling), needed by P02 and decided by the P02 Solution Architect.

## 9. Dependency graph

```
P00 (done) ─► P01 ─► P02 (contract, hard gate) ─► P03 ─► P04 ∥ P05 ─► P06 ─► P07 ─► P08 ─► P09 ─► P10 ─► P11 ─► P12 ─► P13 ─► P14 ─► P15
                     ▲ ADR-002/003/009/010/013/014/016/019–025/029/036–039 feed the P02 schemas and semantics
                            ▲ ADR-002/003/004/009/012/033/034 feed Compose, CI, images
                                                                         ▲ ADR-010 §6 prototype gate at P10 start
```

P03 starts after P02, not in parallel (DD-P01-26; SC-30; ADR-035 B-1).

## 10. Risks

| ID | Risk | Impact | Mitigation |
|---|---|---|---|
| R-01 | The rendering prototype misses NFR-01 or parity | P10/P11 rework | Go/no-go at the P10 start; painter and caching fallbacks; Typst-WASM fallback; any server fallback is an additive contract change (ADR-010) |
| R-02 | Delegated product decisions differ from what the owner would choose | later rework | spec recommendations followed wherever they exist; `DELEGATED-DEFAULT` table for the P15 review (ADR-035 A-6) |
| R-03 | Cloud accounts are unavailable until go-live | integration gaps | local equivalents with the same protocols (Mongo, Azurite, SMTP/Mailpit); P15 go-live list |
| R-04 | Frontend bundle size from the engine and fonts | NFR-02 | lazy-loading on editor routes; measured in the P10 prototype |
| R-05 | Full-document writes at maximum size (≈ 50k characters) | bandwidth on autosave | ≤ 1 MB bound; P07 metrics may trigger a patch-based ADR later |
| R-06 | The spec is a draft (0.1) and may change | re-baseline | P00 PD-P00-06 re-baseline rule |

## 11. P01 step plan

| # | Role | Output | Status |
|---|---|---|---|
| 1 | Solution Architect | `kickoff.md` | done (this step) |
| 2 | Solution Architect | this plan, `decisions.md`, `dependencies.md`, `acceptance-criteria.md`, task files, `domain-model.md`, `threat-model.md`, 25 ADRs, register, OOS-01/02/03 | done (this step) |
| 3 | Test Architect | `tests/test-plan.md` within kickoff §3 | next |
| 4 | Contract Architect | — | not needed |
| 5 | Test Engineer | `tests/check_p01.py`, `tests/suite.cmd`, negative evidence in `tests/test-results.md` | |
| 6 | Developers | — | not dispatched (no code tasks; PD-P01-04) |
| 7 | Code Reviewer | `review/code-review.md` (architecture review) | |
| 8 | QA / Acceptance | `qa-report.md` | |
| 9 | Coordinator | gate | |

## 12. Acceptance criteria

See `../acceptance-criteria.md` (AC-P01-01…AC-P01-15).

## Allowed paths

- `docs/phases/P01/`
- `docs/blueprint/decisions/`
- `docs/blueprint/DECISION-REGISTER.md`
- `docs/blueprint/ARCHITECTURE.md`
- `docs/blueprint/TRACEABILITY.md`

Within the phase folder, files belong to roles as in AGENT-WORKFLOW "Artifact ownership". The Test Engineer writes only in the phase tests folder. In P01 no role edits docs/source, contracts, backend, frontend, scripts, .claude or CLAUDE.md. (Plain text on purpose: the handoff check reads every backticked path in this section as an allowed glob.)
