# P07 Architecture Plan — Resume Domain, Library & Persistence

- Operator session, ADR-051, 2026-11-04. Tier: Claude Opus, effort `high` (AGENT-WORKFLOW "Model and effort").
- Dependencies: P04, P05, P06 are `COMPLETED`.
- Contract: `contracts/openapi/openapi.yaml` 1.0.0, frozen by P02. **No contract change in P07** (step 2 skipped; P02 phase-plan §9.4 row P07). A gap found while implementing would be a separate step, recorded in `decisions.md`.
- UI: [ui-ux-design.md](ui-ux-design.md). Decisions: [decisions.md](../decisions.md). Acceptance: [acceptance-criteria.md](../acceptance-criteria.md).

## Scope

P07 implements the fifteen `x-phase: P07` operations (Resumes 7, Snapshots 3, Photos 5), the canonical document model behind them, the resume library UI, and the data-lifecycle obligations P06 left for this phase.

| Source | P07 responsibility | Acceptance |
|---|---|---|
| FR-LIB-01 | `listResumes`, library cards, sort, paging. First-page thumbnail is a structural placeholder until the P11 engine exists (DD-P07-15) | AC-P07-03 |
| FR-LIB-02, FR-SEC-01, D-06 | Blank built in the client with the default set; server copy incl. photo | AC-P07-04, 19 |
| FR-LIB-03 | Rename through `replaceResumeDocument` (DD-P02-07) | AC-P07-05 |
| FR-LIB-04, D-04, ADR-016 | Trash, restore, delete permanently; read-only while trashed; hourly expiry job stays P13 | AC-P07-06 |
| FR-LIB-05 | Open link and `getResume`; "last selected section" is P08 client state | AC-P07-07 |
| FR-LIB-06 | Out of scope: P12 | — |
| §10.1, §10.2, FR-HDR-01…06, FR-SEC-02…11, FR-TYP-01…03, FR-RTE-07, FR-PHO-04 | Typed document model and validation (R-2…R-8, R-12…R-14). Editing UI is P08/P09 | AC-P07-01 |
| NFR-12 | Limits validated at boundary, positive and negative | AC-P07-02 |
| FR-PER-03 (server side), NFR-10, ADR-037 | `ETag`/`If-Match`, idempotency, durable ack. Client queue is P08 | AC-P07-08, 09 |
| FR-PER-05 (server side, Should) | Snapshots. UI is P08 | AC-P07-12 |
| FR-PHO-01…05, FR-LIB-02, NFR-08, ADR-009 | Media pipeline, blob storage, copy. UI is P08 | AC-P07-11 |
| NFR-08, threat model T-EP-01/02/03, T-TA-01…04/07, T-ID-02/04/05, T-DS-02/03/05 | Owner filter everywhere, closed schemas, URL allow-list, hostile image fixtures, log privacy, rate limits | AC-P07-10, 15, 16 |
| FR-ACC-03/04, ADR-039 | Extend account purge and export to resume data; ledger entries for purged resumes and removed photos | AC-P07-13 |
| NFR-07 | Unicode round trip with Spanish, Ukrainian, Slovak names | AC-P07-20 |
| NFR-02 | Library load is measured in QA; the p95 target is verified in P15 | AC-P07-03 |

Out of scope: editor UI (P08), rich-text UI (P09), template data beyond T1 blank defaults (P10), thumbnail rendering (P11), export (P12), the hourly trash purge job and restore reconciliation (P13), `reportClientEvents` (P11). Nothing from TECHNICAL-SPEC §3.2 is built.

## Component boundaries

**Domain** (`ResumeBuilder.Domain/Resumes/`, BCL only, ADR-008): typed document records (rich-text AST included), `Resume` aggregate with immutable transitions, `ResumeLimits`, `SafeUrl`, `ResumeDocumentRules` (R-4, R-7, R-12 and limit re-check), `PhotoCrop` rules.

**Application** (`ResumeBuilder.Application/Resumes/`): `ResumeDocumentReader` (strict JSON → typed model + contract issue codes), `ResumeDocumentWriter`, `CanonicalJson` (RFC 8785) and `RequestHash`, `ResumeRepresentation` (response JSON), `ResumeUseCases`, `PhotoUseCases`, the account purger and export source, and the ports `IResumeStore`, `ISnapshotStore`, `IIdempotencyStore`, `IPhotoStorage`, `IPhotoProcessor`, `IResumeDeletionLedger`, `IResumeLifecycle`. Every store method takes `ownerId` (R-1); there is no unscoped read.

**Infrastructure**: `MongoResumeStore` (resumes, snapshots, idempotency keys; `w: majority, j: true`, read concern majority), `AzurePhotoStorage`, `SkiaPhotoProcessor`, `ResumeLifecycle` and its worker, ledger extension of the P06 dual ledger.

**Api**: `ResumeEndpoints` does HTTP only: auth, CSRF, rate limit, size, media type, JSON syntax, schema read, header parsing and problem mapping. Business order lives in the use cases.

**Frontend** (F-FE-2 layering): `entities/resume` (blank document, title rules), `features/library` (API calls, cards, dialogs, trash), route wiring in `app/App.tsx`. Types come from the generated contract types only.

## Key semantics

- **Evaluation order** is the contract's: 401 → 403 → syntax, size and schema (400/413/415) → key present (400) → replay or 422 → exists and owned (404) → trash state (409) → `If-Match` (428/412) → domain rules (400) → write (DD-P07-08).
- **Document write:** one conditional `replaceOne({_id, ownerId, version})` (ADR-037 §2). The losing side of a race re-reads: same key and hash means the twin won, so it replays; otherwise 412.
- **Other keyed operations:** `idempotency_keys` with state, lease and reserved resource ID, so a crash cannot duplicate a create; a failed attempt keeps the hash but is re-evaluated on retry (DD-P07-09).
- **Purge and photo removal are two-phase** (DD-P07-10): the version-checked write marks the intent atomically; ledger entries are written, then blobs and snapshots are deleted, then the marker or document goes. A worker finishes anything a crash interrupted. Deleted-before-ledger is impossible, and a failed version check can never leave a ledger entry for live data.
- **200-resume limit** is enforced in a Mongo transaction that serialises creates per owner (DD-P07-11).
- **Media:** magic bytes at the syntax stage (415); header-only dimension check, decode with timeout, orientation normalised, re-encoded, metadata gone (400 `photo_invalid`). Master keeps the detected format; rendition is JPEG q90, 600 px, never upscaled (DD-P07-05/06).

## Risks

| Risk | Handling |
|---|---|
| Document model drift between reader, writer and contract | Contract examples round-trip byte-equal as JSON; every negative reader case is also checked against the contract JSON Schema; responses validated against schemas |
| Lost update or false ack under concurrency | Barrier tests on real Mongo for parallel writers, duplicate key, parallel creates at the limit |
| Cross-user access | Table-driven test over all 15 operations, plus store API that cannot read without an owner |
| Hostile uploads | Fixture set: wrong magic, truncated, oversize dimensions, polyglot, EXIF GPS |
| SkiaSharp native assets missing at runtime | Real codec exercised in API tests; NativeAssets.Linux pinned |
| P05/P06 tests that encode the placeholder library | Recorded exception DD-P07-16, replaced by stronger tests |

## Slices and test budget

Backend ≤ 130 test cases (theory rows counted), frontend ≤ 30, E2E ≤ 14 scenarios per browser. All tests live in the existing projects with a `P07` prefix or under `features/library`; no new test project and no new framework. A larger plan needs a recorded reason here. **Recorded at step 4:** backend is 135 cases, because the closed-schema reader keeps one pure row per contract rule (24 in D04, 13 in L01/L03). Those rows run in milliseconds and each names a rule; merging them to save five rows would hide which rule broke. **Recorded at step 6:** frontend is 31 cases, one over, because the two review findings each added regression tests.

| # | Slice | Depends on |
|---|---|---|
| 1 | Document model, rules, reader, writer, canonical JSON | — |
| 2 | Resume store, idempotency, CRUD/copy/trash/purge endpoints | 1 |
| 3 | Snapshots | 2 |
| 4 | Media pipeline and photo endpoints | 2 |
| 5 | Lifecycle: ledger, account purge, export, worker | 2, 4 |
| 6 | Library UI, trash UI, design and accessibility | 2 |

## Task list

1. Declarations for test compilation (records, ports, throwing bodies), no behaviour.
2. Backend tests (`P07*`), red; frontend and E2E tests, red; suite and evidence.
3. Implement slices 1–5, then slice 6; narrow tests continuously; full suite.
4. External review, fixes, one delta re-review.
5. Acceptance against the running system (real API, Mongo, Azurite, browser).
6. Gate, status, merge.

Later-phase obligations are recorded in `qa-report.md` "Deferred" at the gate: thumbnails (P11), hourly trash purge and restore drill (P13), editor flows on these operations (P08), export from the list (P12).

## Allowed paths

- `docs/phases/P07/**`
- `backend/src/ResumeBuilder.Domain/**`
- `backend/src/ResumeBuilder.Application/**`
- `backend/src/ResumeBuilder.Infrastructure/**`
- `backend/src/ResumeBuilder.Api/**`
- `backend/tests/ResumeBuilder.Api.Tests/**`
- `backend/Directory.Packages.props`
- `backend/README.md`
- `frontend/src/**`
- `frontend/README.md`
- `tests/e2e/**`
