# Solution Architecture Blueprint

Status: aligned with the ADRs accepted in P01 (2026-11-02, delegated under ADR-035). Phase details: `docs/phases/P01/architecture/` (phase plan, domain model, threat model). The decision index is `DECISION-REGISTER.md`.

## 1. Logical view

Monorepo contains three separately governed deliverables:
- Backend API and domain application (`backend/`)
- Browser application (`frontend/`)
- Cross-cutting API contract and integration tests (`contracts/`, `tests/`)

Backend and Frontend may be implemented and tested independently after P02 freezes the first contract baseline. A single repository does not imply shared runtime, shared codebase, or direct imports across the boundary.

## 2. Backend

- .NET 10 LTS / ASP.NET Core HTTP API ([ADR-002](decisions/ADR-002-dotnet-version.md)).
- Modular monolith for v1 with five modules: Accounts, Resumes, Media, Lifecycle, Telemetry intake. One deployable; background jobs run in-process with a Mongo lease ([ADR-007](decisions/ADR-007-modular-monolith.md)).
- Pragmatic Clean Architecture: Domain, Application, Infrastructure, Api, with executable fitness rules F-BE-1…5 ([ADR-008](decisions/ADR-008-clean-architecture-boundaries.md)).
- Domain model follows source logical entities: User, Resume, Header, ContactItem, Section, Entry, ListItem, Photo, LayoutSettings, Rich Text AST (`docs/phases/P01/architecture/domain-model.md`).
- Persistence: **MongoDB 8.x** behind application-facing repository interfaces. One document per resume aggregate; majority write concern; Atlas in the EU with point-in-time recovery in production ([ADR-004](decisions/ADR-004-nosql-provider-mongodb.md)).
- No server-side rendering or export processing: PDF and TXT are produced in the browser ([ADR-010](decisions/ADR-010-shared-layout-engine-and-rendering.md)).
- Object storage is separate from the document database. Photos (re-encoded master plus crop rendition) go in private Azure Blob Storage and are reached only through the API. Exports are not stored ([ADR-009](decisions/ADR-009-object-storage.md)).
- Authentication: first-party, server-side sessions ([ADR-036](decisions/ADR-036-authentication-and-sessions.md)). E-mail: SMTP adapter ([ADR-034](decisions/ADR-034-transactional-email.md)). Rate limiting: [ADR-038](decisions/ADR-038-rate-limiting-and-abuse-protection.md). All three are covered by the P01 threat model.

## 3. Frontend

- React 19 + Vite + TypeScript (strict), static SPA served on the same origin as the API ([ADR-003](decisions/ADR-003-frontend-toolchain.md)).
- Tailwind CSS 4.
- Feature-oriented modules; isolate editor, resume library, account, design controls, preview and export flows. Fitness rules F-FE-1…3 (ADR-008).
- Server state and local editor state must have explicit ownership; do not duplicate canonical resume state in unrelated stores.
- Autosave queue with observable states: Saved / Saving / Offline, changes kept locally in IndexedDB per user ([ADR-037](decisions/ADR-037-concurrency-idempotency-durability.md)). Guest drafts reuse this local layer ([ADR-015](decisions/ADR-015-guest-mode.md)).
- The shared layout engine, preview painter, PDF writer and TXT serializer belong to the frontend (ADR-010).
- Editor must remain keyboard accessible; narrow screens <1024px use tabs for Sections/Edit/Preview/Design; 390px width remains usable.

## 4. Contract-first integration

- Canonical contract: OpenAPI 3.1 in `contracts/openapi/` (format confirmed in P02, ADR-006; tooling ADR-040 decided in P02).
- Contract review includes DTO/schema validation, errors, auth, pagination, concurrency/versioning and examples.
- Generate/validate server and client types from contract; mock data and contract tests derive from same schema.
- Resume updates use an integer version as `ETag` with a required `If-Match` (428/412) and an `Idempotency-Key` ([ADR-037](decisions/ADR-037-concurrency-idempotency-durability.md)). Stale-tab behaviour follows D-17 as decided in [ADR-029](decisions/ADR-029-concurrent-tabs.md).
- API error envelope must be stable and documented; no ad hoc frontend parsing of backend exceptions. Error payloads never echo field values.
- P02 outputs: contract v1.0.0 (`contracts/openapi/openapi.yaml`, 30 operations with `x-phase`), contract suite `tests/contract/` (`docs/phases/P02/tests/suite.cmd`), extension process in `docs/phases/P02/architecture/phase-plan.md`.

## 5. Rendering architecture

Canonical Resume Document AST feeds:
1. Interactive preview layout.
2. PDF layout/rendering.
3. TXT serializer.

Decided in [ADR-010](decisions/ADR-010-shared-layout-engine-and-rendering.md):
- One TypeScript layout engine in the frontend measures text with the bundled fonts (never browser metrics) and produces a single **PageModel**.
- The preview paints the PageModel, and the browser PDF writer writes the same PageModel, which satisfies FR-PRV-02.
- The TXT serializer runs in the browser from the same document.
- The server does not render.
- Output is deterministic for the same version, settings, engine and fonts (NFR-14).
- Pagination rule priority is in ADR-010 §10.
- The library choice (shaping, PDF writer, preview painter) is confirmed by the prototype gate at the start of P10 (ADR-010 §6, criteria G1–G7). Printing HTML is not used as the parity mechanism.

Rendering fixtures include T1, T2, T3; short/long documents; page boundaries; A4/Letter; all size presets; unicode; links; photo; hidden/empty sections; manual page breaks; 1/2-column lists.

## 6. Persistence and reliability

- Resume document version and updated timestamp.
- Autosave with client-side queue and retry/backoff; the server acknowledges a durable version only after `w: majority` (ADR-037).
- Concurrent stale edits follow D-17 as decided in ADR-029: a 412 response, then the stale tab reloads with a notice, and unsynced edits are kept as a conflict copy.
- Idempotency and replay: `Idempotency-Key` with `lastWrite` on the resume and a 24 h key store for creates and uploads (ADR-037).
- Backup/restore and EU residency are release gates. Retention and deletion follow [ADR-039](decisions/ADR-039-data-retention-and-deletion.md): backups expire within 30 days, and every restore re-applies the deletion ledger.
- No acknowledged edit loss; RPO ≤1 minute; daily backups retained 30 days per NFR-10.

## 7. Security and privacy
- Per-user authorization on every resource: owner filter in every repository method; foreign IDs return 404.
- Passwords: framework PBKDF2 hasher, ≥ 210 000 iterations; server-side revocable sessions; hashed single-use tokens (ADR-036).
- Password reset links expire (default 1 h, FR-ACC-02).
- Photo upload: JPEG/PNG/WebP up to 5 MB (FR-PHO-01; the reference product's 4 MB limit is research evidence only); keep the original as a re-encoded master and regenerate the cropped rendition (FR-PHO-05, ADR-009).
- Re-encode image and strip EXIF.
- Account data deletion within 24 h per FR-ACC-03 (ADR-039).
- Data export archive per FR-ACC-04 (ADR-039 §6).
- No resume content in logs.
- EU data storage per NFR-09 / D-20: Azure Germany West Central with its Germany North pair ([ADR-012](decisions/ADR-012-eu-hosting-data-residency.md)).
- Threat model: `docs/phases/P01/architecture/threat-model.md`.

## 8. Observability
Structured logs, correlation/request IDs, metrics for API latency, autosave failures, export duration/failures, preview/PDF mismatch and queue health. Avoid PII and resume content in telemetry. Client-side export errors and mismatches are reported to our own API as content-free events (ADR-010 §8). Logs stay in the EU region for 30 days (ADR-033, ADR-039).

## 9. Technology decisions still open
See `DECISION-REGISTER.md`. After P02 the contract format (ADR-006) and tooling (ADR-040) are decided; only the test tooling confirmation in P03 remains. Product items D-05/D-06 (P07) and D-12, D-14…D-16, D-18, D-19 (P10) remain open for their phases. Hosting and CI are decided in [ADR-033](decisions/ADR-033-hosting-platform-and-ci.md).
