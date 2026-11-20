# Decisions — P01

Record decision IDs, status, rationale and source sections. Do not silently close open source decisions.

All decisions below were taken by the Solution Architect under the owner's delegation (ADR-035 A-4), with this precedence: (1) TECHNICAL-SPEC, (2) `docs/source/README.md` reference evidence, (3) the most conservative, reversible and standard option that keeps EU residency and the security rules. Each one is tagged `DELEGATED-DEFAULT`. The owner reviews them after the fact in the P15 decision table (ADR-035 A-6).

Rules: preserve recorded decisions and append new records below them.

## 1. P01 process decisions

| ID | Decision | Tag | Rationale | Source |
|---|---|---|---|---|
| PD-P01-01 | The Solution Architect writes `architecture/domain-model.md` and `architecture/threat-model.md` in the architecture step | DELEGATED-DEFAULT | They are architecture decisions, not implementation; the ADRs depend on them; P01 has no code role (kickoff §2.1) | Coordinator task spec; `.claude/agents/solution-architect.md` |
| PD-P01-02 | Test budget: one stdlib module `tests/check_p01.py` plus a one-line `tests/suite.cmd`; no framework or fixture tree | DELEGATED-DEFAULT | ADR-035 B-4 for documents phases | kickoff §3 |
| PD-P01-03 | TDD-order exception: the documents exist before the tests. In-memory negative cases in the check module replace the red state | DELEGATED-DEFAULT | ADR-035 B-1 puts the ADRs in the architecture step; a check written afterwards cannot be red against finished documents | ADR-035 B-1, B-4 |
| PD-P01-04 | No Backend or Frontend Developer dispatch in P01. The task files only list downstream obligations | DELEGATED-DEFAULT | No code in P01 | PHASE.md; kickoff §2 |
| PD-P01-05 | The register gains the status `ACCEPTED` ("decided by an Accepted ADR under delegation"). FIXED rows keep `FIXED`; their former open aspect now links the ADR | DELEGATED-DEFAULT | The existing vocabulary has no value for "decided"; P00 noted the same gap for owner delegation (I-05) | P00 decisions.md §4 Q-3 |
| PD-P01-06 | New register IDs for the P00 GOV-04 unregistered candidates: ADR-036 (auth/session), ADR-037 (concurrency + idempotency), ADR-038 (rate limiting), ADR-039 (retention/deletion), ADR-040 (contract tooling, open for P02). E-mail delivery stays inside ADR-034. Background export is closed inside ADR-010 (not needed). Test tooling stays "confirm in P03" without an ID | DELEGATED-DEFAULT | OOS-02 / SC-20, as approved by the owner | P00 GOV-04 secondary table |
| PD-P01-07 | Scope: the Architect also edits `docs/blueprint/ARCHITECTURE.md` (OOS-03) and `docs/blueprint/TRACEABILITY.md` (OOS-01) | DELEGATED-DEFAULT | Approved by the owner (P00 decisions.md §4) and by the coordinator in reply to this step's question (2026-11-02). OOS-02 is applied to the register. OOS-07 is already resolved (DD-P01-26). OOS-04 (`CLAUDE.md`) is left to the coordinator | Coordinator answer; P00 decisions.md §4 |
| PD-P01-08 | ADR-010 is split: the architecture (layout location, page model, PDF/TXT in the browser) is decided now; the library confirmation comes from the prototype gate at the P10 start | DELEGATED-DEFAULT | SC-23 option "split + move the prototype earlier"; the P02 contract needs only the location | ADR-010 §6 |
| PD-P01-09 | TP-F1: AC-P01-11 is amended so that ADR-010 may keep the register status `REQUIRED`; every other P01-decided ID still needs `ACCEPTED` or `FIXED`. The ADR-010 row is not changed | DELEGATED-DEFAULT | Options: (1) amend the AC, (2) change the row to `ACCEPTED`. Option 2 would break the register's own rule that a `FIXED` or `REQUIRED` row whose open aspect is decided keeps its status and links the ADR; option 1 keeps the oracle strict for every other row | test-plan §7 TP-F1; `DECISION-REGISTER.md` status vocabulary |
| PD-P01-10 | TP-F2: threat row T-EP-04 (accepted risk, client-side export gate) gets Phase `P12` | DELEGATED-DEFAULT | Options: P01 (where the acceptance is recorded) or P12 (where the client exports and their gate are built). P12 is the phase that can re-check that the risk stays limited to the user's own data | test-plan §7 TP-F2; threat-model RR-3 |

## 2. Delegated decisions (DELEGATED-DEFAULT)

Reason column: "Spec" means precedence step 1 (TECHNICAL-SPEC text or the §12 recommendation); "Conservative" means step 3.

| ID | Question | Options considered | Decision | Reason | ADR | Needed by |
|---|---|---|---|---|---|---|
| DD-P01-01 | Exact .NET version (ADR-002) | .NET 8 LTS; .NET 9 STS; .NET 10 LTS; .NET 11 STS | `DELEGATED-DEFAULT`: **.NET 10 LTS**, `net10.0` | Conservative: 8 and 9 reach end of support on 2026-11-10; 11 is not GA | ADR-002 | P02 |
| DD-P01-02 | Frontend toolchain configuration (ADR-003) | TS strict vs JS; Node 22/24; npm/pnpm/Yarn; SPA vs SSR | `DELEGATED-DEFAULT`: TS strict, Node 24 LTS, npm, static SPA on the same origin | Conservative and standard; fixed React 19 + Vite + Tailwind 4 | ADR-003 | P02 |
| DD-P01-03 | NoSQL provider (ADR-004) | MongoDB/Atlas; Cosmos DB (Mongo API); DynamoDB; RavenDB; Couchbase | `DELEGATED-DEFAULT`: **MongoDB 8.x**; Atlas (Azure, Germany West Central) in production; Docker replica set locally | Blueprint proposal; meets RPO/PITR, conditional updates, EU and portability | ADR-004 | P01 |
| DD-P01-04 | Modular monolith (ADR-007) | monolith with modules; microservices; serverless | `DELEGATED-DEFAULT`: modular monolith, 5 modules, in-process jobs with a lease | Blueprint proposal; conservative | ADR-007 | P01 |
| DD-P01-05 | Clean Architecture boundaries (ADR-008) | 4 layers; per-module projects; vertical slices | `DELEGATED-DEFAULT`: 4 projects, module folders, fitness rules F-BE-1…5 and F-FE-1…3 | Blueprint proposal; testable rules | ADR-008 | P04 |
| DD-P01-06 | Object storage provider, region, retention (ADR-009; SC-09) | Azure Blob; S3; GridFS; public or SAS URLs; stored exports | `DELEGATED-DEFAULT`: **Azure Blob**, private, API-mediated, Azurite locally; re-encoded master + rendition; **exports not stored** | Conservative; privacy; one vendor with ADR-033 | ADR-009 | P01 |
| DD-P01-07 | Renderer approach and prototype plan (ADR-010; SC-23) | server Chromium print; .NET server layout; client layout + .NET painter; shared engine across stacks; PDF-first preview; frontend engine | `DELEGATED-DEFAULT`: **one TypeScript layout engine in the frontend → PageModel → preview painter + browser PDF writer; TXT in the browser; no server rendering; prototype gate at the P10 start (G1–G6)** | Spec FR-PRV-02/NFR-01/NFR-14 plus the no-shared-code rule | ADR-010 | P02 |
| DD-P01-08 | EU hosting region (D-20; ADR-012/ADR-032) | EU (several regions); any region with SCCs; EU-owned cloud only | `DELEGATED-DEFAULT`: **EU/EEA only**; Azure Germany West Central with its Germany North pair; no trackers or CDNs | Spec §12 recommendation "EU" | ADR-012 | P01 |
| DD-P01-09 | Hosting platform and CI (ADR-033; SC-30) | Azure Container Apps; App Service; AWS ECS; Kubernetes; Static Web Apps; GitHub Actions/GitLab/Azure DevOps | `DELEGATED-DEFAULT`: **Azure Container Apps** (api + web, one origin), ACR, Key Vault, Log Analytics, Bicep; **GitHub Actions** calling repo scripts, runnable locally | Conservative and reversible (OCI + scripts) | ADR-033 | P03 |
| DD-P01-10 | Transactional e-mail provider (ADR-034) | ACS Email; SES; SendGrid/Postmark; Brevo/Mailjet; own MTA | `DELEGATED-DEFAULT`: **SMTP adapter**, Mailpit locally, **ACS Email (Europe data location)** in production with Brevo/Mailjet as the EU fallback | NFR-09; conservative (SMTP is portable) | ADR-034 | P06 |
| DD-P01-11 | Authentication and session design (ADR-036) | cookie + server sessions; JWT; external IdP; full Identity with Mongo stores | `DELEGATED-DEFAULT`: first-party, PBKDF2 (framework hasher, ≥ 210k), server sessions in a `__Host-` strict cookie, hashed single-use fragment tokens | NFR-08; conservative; no invented crypto | ADR-036 | P01 |
| DD-P01-12 | Concurrency token and idempotency (ARCHITECTURE §4, §6) | version/ETag; timestamp; LWW; JSON Patch; CRDT | `DELEGATED-DEFAULT`: integer version as ETag, `If-Match` (428/412), `Idempotency-Key`, full-document replace, `w: majority` ack | Spec FR-PER-01…03, NFR-10; standard HTTP | ADR-037 | P02 |
| DD-P01-13 | Rate limiting | in-box middleware; ingress only; Redis; CAPTCHA | `DELEGATED-DEFAULT`: ASP.NET Core rate limiting with the default policy table; global counters for login and e-mail in Mongo; no third-party CAPTCHA | NFR-08, NFR-09 | ADR-038 | P02 |
| DD-P01-14 | Retention and deletion of backups, trash, snapshots and exports (SC-08) | scrub backups; expiry + ledger; keep the last export | `DELEGATED-DEFAULT`: retention table; account purge ≤ 24 h; backups expire ≤ 30 days with ledger re-apply on restore; exports never stored | Spec FR-ACC-03, NFR-10; GDPR practice | ADR-039 | P02 |
| DD-P01-15 | D-01 login before verification (SC-02) | strict; allow + gate export; no gate | `DELEGATED-DEFAULT`: **allow login; export and data archive need verification** | Spec §12 recommendation | ADR-013 | P02 |
| DD-P01-16 | D-02 Google sign-in | v1; later | `DELEGATED-DEFAULT`: **not in v1** | Spec §12 "Later" | ADR-014 | P01 |
| DD-P01-17 | D-03 guest mode | none; local draft + claim; server anonymous accounts | `DELEGATED-DEFAULT`: **yes (Could)**, a local draft, claimed through the normal create after confirmation; no guest backend | Spec §12 "Yes … claim on sign-up" | ADR-015 | P01 |
| DD-P01-18 | D-04 trash | trash 30 days; hard delete | `DELEGATED-DEFAULT`: **30-day trash**; the 200-resume limit counts trash | Spec §12 "Yes, 30 days"; strict NFR-12 reading | ADR-016 | P02 |
| DD-P01-19 | D-07 autosuggest and country picker (SC-11, SC-22, SC-26) | dictionaries; pickers; none | `DELEGATED-DEFAULT`: **no autosuggest; month/year picker only; no country picker** (Location is free text); "P1" = principle P1 of §2 | Spec §12, §2 P1/P2, X4 | ADR-019 | P02 |
| DD-P01-20 | D-08 import (SC-11) | v1; v1.1 | `DELEGATED-DEFAULT`: **not in v1**; X8 stays | Spec §12 | ADR-020 | P02 |
| DD-P01-21 | D-09 DOCX (SC-11) | v1; never | `DELEGATED-DEFAULT`: **not in v1**; X9 stays | Spec §12 | ADR-021 | P02 |
| DD-P01-22 | D-10 monetization (SC-11) | paywall; none | `DELEGATED-DEFAULT`: **out of scope**; X10 stays | Spec §12 | ADR-022 | P02 |
| DD-P01-23 | D-11 editable entry labels | fixed; editable (form only); printed | `DELEGATED-DEFAULT`: **editable per section, form only, 1–40 chars, never printed** | Spec §12 "Yes" | ADR-023 | P02 |
| DD-P01-24 | D-13 T3 placement | template zones; per-section choice; none until D-12 | `DELEGATED-DEFAULT`: **nullable `placement` per section, defaults by type** | Spec §12 "Yes"; FR-TPL-04 | ADR-025 | P02 |
| DD-P01-25 | D-17 concurrent tabs (SC-01) | merge; reload and discard; reload + conflict copy; LWW | `DELEGATED-DEFAULT`: **412 → reload with a notice; unsynced edits saved as a conflict copy** (keeps both versions) | Spec §12 recommendation + FR-PER-03 AC | ADR-029 | P02 |
| DD-P01-26 | SC-30: may P03 run in parallel with P02? OOS-07 wording | parallel; sequential | `DELEGATED-DEFAULT`: **sequential, P03 after P02**. The current AGENT-WORKFLOW.md (ADR-035) no longer has the conflicting sentence, so OOS-07 needs no edit | `docs/phases/README.md`; ADR-035 B-1 | ADR-033 | P03 |
| DD-P01-27 | SC-21: where is the "last selected section" (FR-LIB-05) kept? | server field; client storage | `DELEGATED-DEFAULT`: **client localStorage per user and resume (IDs only)**; no contract field. Cross-device continuity is not required; adding it later is an additive change | Conservative (data minimisation) | domain-model §9 | P02 |
| DD-P01-28 | SC-05: what are template list-column defaults keyed on? | section type; a new "role" field; the D-06 set | `DELEGATED-DEFAULT`: **section type**. `Section.listColumns` is nullable (`null` = template default for the type; explicit = override; Reset sets `null`). No role field (principle P2: every section is custom). P10 fills the per-template table | Spec FR-SEC-11, FR-LAY-07, §2 P2 | domain-model §3.5 | P02 |
| DD-P01-29 | SC-19: pagination rule priority; PG-08 model field | — | `DELEGATED-DEFAULT`: priority PG-06/PG-08 > PG-05 > PG-01/PG-02 > PG-03/PG-04 > PG-07, then the PG-09 fallback; PG-08 is Should with `Entry.pageBreakBefore` in the v1 schema | Spec §8, §10.1 | ADR-010 §10 | P02 |
| DD-P01-30 | Unspecified limits and counting | — | `DELEGATED-DEFAULT`: lengths in Unicode code points; list items ≤ 100 per section; contacts ≤ 20; URL ≤ 2048; labels ≤ 40; years 1900–2100; margins 10–50 pt | Conservative bounds by analogy to NFR-12 | domain-model §3, §6 | P02 |
| DD-P01-31 | ID strategy | server-only IDs; client nested IDs | `DELEGATED-DEFAULT`: server UUID v7 for user, resume, photo and snapshot; client UUIDs for section, entry, item and contact | FR-PER-02 (offline), FR-PER-04 | domain-model §4 | P02 |
| DD-P01-32 | SC-23 thumbnails before the engine exists (FR-LIB-01, FR-TPL-02) | server thumbnails; placeholder until the engine | `DELEGATED-DEFAULT`: **neutral placeholder in P07 and P10**; client-rendered thumbnails once the engine exists (P11), cached per version; none stored on the server | Conservative; ADR-010 | ADR-010 §9 | P07 |
| DD-P01-33 | Code-review M-1: a document write that reuses an `Idempotency-Key` with a different body is acknowledged without being applied (NFR-10) | add a request hash to `lastWrite`; never reuse keys (client rule only); move document writes to the 24 h key store | `DELEGATED-DEFAULT`: **`lastWrite: {key, requestHash, version, at}`**; SHA-256 over RFC 8785 canonical JSON; the comparison runs before `If-Match`: same key and hash → 200 replay, same key and a different hash → **422 `idempotency_key_reused`**, nothing written; a key belongs to one immutable body and coalesced edits always get a new key; P02 contract test, P07 negative integration test, P08 queue test | Spec NFR-10 "no acknowledged edit is lost"; the same guard ADR-037 already uses for creates; a client-only rule would leave the server acknowledging unapplied edits | ADR-037 §3–§4, threat model T-TA-07 | P02 |
| DD-P01-34 | Code-review M-2: a restore can bring back resumes deleted permanently and removed photos; the ledger lists only accounts | extend the ledger to resumes and photos; orphan-blob sweep only; both | `DELEGATED-DEFAULT`: **both.** Ledger entries `account`, `resume`, `photo` (IDs, owner ID, key prefix, timestamp; 35-day TTL), written before every non-expiry deletion and mirrored to an append-only blob container outside the restore scope; every restore runs the reconciliation of ADR-039 §4 (ledger re-apply, due trash purges, expired snapshots, orphan-blob sweep) before traffic; the P13 drill covers an erased account, a resume deleted permanently before 30 days, a purged resume, a removed photo and a replaced photo | Spec FR-ACC-03, NFR-09 (GDPR Art. 17), NFR-10; conservative: the ledger alone is rolled back by a database PITR unless it is kept outside the restore, and the sweep alone misses restored resume documents | ADR-039 §1, §3–§4; ADR-009 §7; threat model T-ID-09; domain-model §7–§8 | P07 |
| DD-P01-35 | Code-review M-3: the ADR-010 gate does not prove that the PageModel, PDF and TXT are identical across browsers; NFR-03 TXT time unmeasured | add a cross-runtime gate; rely on design argument only; server-side reference export | `DELEGATED-DEFAULT`: **new G7** (PageModel hash, PDF bytes, TXT bytes identical in Node, Chromium, Firefox and WebKit for the G1 fixtures × A4/Letter) **required for Go**; G2 compares every browser's preview with the Node reference PDF; G3 and G4 run in Chromium and WebKit on the named CI reference runner (GitHub-hosted standard Linux runner, pinned browser builds, plus one laptop spot check); G4 adds TXT ≤ 1 s p95; ADR-010 §7 forbids runtime locale/Unicode APIs and transcendental `Math` in the engine | Spec NFR-05, NFR-14, NFR-03, FR-PRV-02; the client-side export design depends on cross-runtime identity, so the gate must test it | ADR-010 §6–§7 | P10 |
| DD-P01-36 | Code-review m-1: what FR-ACC-04 "latest PDF/TXT" means when exports are not stored; archive cost at 200 resumes | store the last export; regenerate the current version; JSON only | `DELEGATED-DEFAULT`: **PDF and TXT of each resume's current version, regenerated with the current engine and fonts**; byte identity with an earlier download only for an unchanged version, settings, engine and fonts; P13 builds the archive in batches with progress and cancel, and the PDF part may be partial (missing PDFs are listed) | Spec FR-ACC-04 is a Should; storing exports adds personal data (ADR-009); conservative | ADR-010 §5, ADR-009 §6, ADR-039 §6 | P13 |
| DD-P01-37 | Code-review m-3: `Resume.title` 1…150 and `ContactItem.text` 1…200 contradict R-8 "no field is mandatory for saving" | allow length 0; client normalisation before save | `DELEGATED-DEFAULT`: **minimum length 0** for both; an empty title shows the default as a library placeholder; empty contacts are skipped at render time; a 400 on an autosave is not retried and shows an error state with the field path | Spec FR-TYP-03; the server stays the single validation authority (no hidden client rewriting) | domain-model §3.2, §3.4, R-8 | P02 |
| DD-P01-38 | Code-review m-5: cached thumbnails and photos on shared devices are not covered by T-ID-06 | per-user thumbnail namespace + `no-cache` photos; `no-store` photos; leave as is | `DELEGATED-DEFAULT`: thumbnail cache keyed `(userId, resumeId, version)` in a per-user namespace cleared by "remove local data from this device"; photo renditions and masters served `Cache-Control: private, no-cache` with `ETag` (304 revalidation) | Conservative privacy default with low bandwidth cost; `no-store` would refetch every photo on every render | ADR-009 §2, ADR-010 §9, threat model T-ID-06, domain-model §9 | P08 |
| DD-P01-39 | Code-review m-6: does sign-up open a session, and is the login-before-verification enumeration residual accepted? | sign-up opens a session for new addresses; never opens one; strict verify-before-login | `DELEGATED-DEFAULT`: **sign-up never opens a session**; the user logs in explicitly; the residual (a successful login with a self-chosen password shows that the address was unregistered) is accepted as RR-6, low | D-01 / ADR-013 keep login before verification (spec §12); a session only for new addresses would itself reveal the address | ADR-036 §8, threat model §8 RR-6 | P06 |

## 3. P01-assigned P00 conflicts (GOV-05): resolution

| SC | Topic | Resolution |
|---|---|---|
| SC-01 | FR-PER-03 AC vs the D-17 recommendation | DD-P01-25 / ADR-029 (both satisfied by the conflict copy) |
| SC-02 | FR-ACC-01 AC vs D-01 | DD-P01-15 / ADR-013 |
| SC-05 | list-column default keying | DD-P01-28 |
| SC-08 | retention on account deletion | DD-P01-14 / ADR-039 |
| SC-09 | exports stored or regenerated | DD-P01-06 / ADR-009 §6 (not stored) |
| SC-11 | D-07…D-10 vs exclusions | DD-P01-19…22 / ADR-019…ADR-022 (all stay excluded) |
| SC-17 | ADR-011 ↔ ADR-024 duplicate (D-12) | register annotated (OOS-02); D-12 stays open for P10 |
| SC-18 | traceability gaps | `TRACEABILITY.md` rows added (OOS-01) |
| SC-19 | pagination priority, PG-08 field | DD-P01-29 / ADR-010 §10 |
| SC-20 | unregistered candidates | PD-P01-06 (ADR-036…ADR-040) |
| SC-21 | last selected section | DD-P01-27 |
| SC-22 | "P1" in ADR-019 | register reworded "principle P1 (§2)" (OOS-02); ADR-019 title |
| SC-23 | ADR-010 sequencing | PD-P01-08, DD-P01-07, DD-P01-32 |
| SC-25 | real vs synthetic fixture data | already answered by the owner (P00 Q-5): real reference-CV content allowed |
| SC-26 | country picker | DD-P01-19 (none in v1) |
| SC-29 | versions before P02 | DD-P01-01, DD-P01-02 (decided now); ADR-006 and ADR-040 in P02 |
| SC-30 | P03 parallel to P02 | DD-P01-26 (sequential) |

## 4. Still open (owner phase, decided by that phase's Solution Architect)

| Item | Topic | Phase | Note |
|---|---|---|---|
| D-05 / ADR-017 | Guided first run | P07 | The recommended "sample resume" must not conflict with X2 (no copyable sample content) |
| D-06 / ADR-018 | Default sections of a blank resume | P07 | The model supports any set; default `EntryLabels` for Education decided there |
| D-12 / ADR-024 (= ADR-011) | T2 and T3 designs | P10 | `placement` hook fixed by ADR-025 |
| D-14, D-15, D-16, D-18, D-19 | T1 colours, scaling, line spacing step, link colour, Education layout | P10 | template data; SC-03 (line-height formula vs §6.2) decided with D-16 |
| ADR-006 | OpenAPI 3.1 as the canonical format | P02 | the contract format; RFC 9457 error envelope recommended (phase-plan §7) |
| ADR-040 | Contract validation and type-generation tooling | P02 | constraint: generated TS types (strict); C# DTOs generated or verified by a drift test against the in-box ASP.NET Core OpenAPI document |
| Test tooling | xUnit, Vitest, RTL, Playwright, PDF text extraction, raster diff | P03 | Blueprint: "confirm in P03" |

## 5. Owner actions for go-live (no stop; ADR-035 §C)

Implementation uses local Docker services and stubs until then. P15 collects these:
1. Azure subscription; resource group in Germany West Central; Key Vault; Container Apps; ACR; Log Analytics (ADR-033).
2. MongoDB Atlas organisation and a dedicated cluster on Azure in Germany West Central with continuous backup (ADR-004).
3. Azure Communication Services Email resource (data location Europe) and a verified sending domain with SPF, DKIM and DMARC; confirm EU processing in the terms, otherwise switch to Brevo or Mailjet (ADR-034).
4. GitHub repository and protected environments for CI/CD with OIDC to Azure (ADR-033).
5. Domain name and DNS; TLS through managed certificates.
6. DPAs with every sub-processor; privacy notice; DPIA note (ADR-012, ADR-039).

## 6. Code review fix loop 1 (`review/code-review.md`)

Appended 2026-11-02 by the Solution Architect (ADR-035 B-2). Recorded decisions above are unchanged except where a new row amends them; DD-P01-07, DD-P01-12 and DD-P01-14 now read together with DD-P01-35, DD-P01-33 and DD-P01-34.

| Finding | Handling | Files |
|---|---|---|
| M-1 | fixed: DD-P01-33 | ADR-037, threat-model T-TA-07, domain-model §3.2, phase-plan §7, backend-tasks BE-OBL-06, frontend-tasks FE-OBL-04, register ADR-037 row |
| M-2 | fixed: DD-P01-34 | ADR-039, ADR-009 §7, threat-model T-ID-09, domain-model §7–§8, phase-plan §4, backend-tasks BE-OBL-06/09, register ADR-039 row |
| M-3 | fixed: DD-P01-35 | ADR-010 §6–§7, phase-plan §4, frontend-tasks FE-OBL-06, register ADR-010 row |
| m-1 | fixed: DD-P01-36 | ADR-010 §5, ADR-009 §6, ADR-039 §6 |
| m-2 | routed to P06 (Solution Architect): decide whether the JSON data export (Art. 15/20) is allowed with re-authentication regardless of verification, or record the anti-abuse reason for the gate in ADR-013 and threat model §6 | — |
| m-3 | fixed: DD-P01-37 | domain-model §3.2, §3.4, R-8 |
| m-4 | routed to P07/P08: keep the last N write keys in `lastWrite`, or compare the body hash with the server version before creating a conflict copy (no data loss today, only a spurious copy) | — |
| m-5 | fixed: DD-P01-38 | ADR-009 §2, ADR-010 §9, threat-model T-ID-06, domain-model §9, frontend-tasks FE-OBL-07 |
| m-6 | fixed: DD-P01-39 | ADR-036 §8, threat-model §8 RR-6 |
| m-7 | routed to P13: retention for never-verified accounts (expiry after N days without verification and activity, with notice, or an explicit acceptance) | — |
| m-8 | partly fixed: ADR-010 §6 records the library load with thumbnails (not gating); P11 owns the NFR-02 target and the batched-documents decision | ADR-010 §6 |
| m-9 | Test Engineer (optional); not changed by the Architect | — |
| i-1…i-9 | no action in P01; i-7 (client-event auth and size caps) goes to P02 | — |

Not edited by this step (outside the task's file scope): `docs/blueprint/ARCHITECTURE.md` §Rendering still says "criteria G1–G6" and should read "G1–G7"; owner: Program Coordinator or the next Architect step.
