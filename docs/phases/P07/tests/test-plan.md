# P07 Test Plan

Budget from `architecture/phase-plan.md`: backend ≤ 130 cases, frontend ≤ 30, E2E ≤ 14 per browser. Fixtures are synthetic (`.invalid` addresses, invented names). No new test project or framework.

## Levels and harness

| Level | Where | Harness |
|---|---|---|
| Unit | `backend/tests/ResumeBuilder.Api.Tests/P07DocumentTests.cs`, `P07CanonicalJsonTests.cs` | Pure; contract examples and JSON Schema through `ContractSchemas`. Every negative reader case is also asserted invalid by the contract schema, and the positives valid, so the reader cannot drift from the contract unnoticed |
| API + persistence | `P07ApiTests.cs`, `P07SnapshotTests.cs`, `P07PhotoTests.cs`, `P07LifecycleTests.cs`, `P07SecurityTests.cs` | `WebApplicationFactory<Program>` with a controllable clock and memory mail, over **real** Mongo replica set and Azurite (Testcontainers, one collection fixture, digest-pinned). Workers disabled; the lifecycle processor is invoked explicitly |
| Contract | `P07ContractTests.cs` | Route inventory and statuses compared with `openapi.yaml`; `InProcessContractTests` stays an exact list |
| Component | `frontend/src/entities/resume/*.test.ts`, `frontend/src/features/library/library.test.tsx` | Vitest + RTL with contract-typed responses and a stubbed `fetch` |
| E2E | `tests/e2e/library.spec.ts` | Playwright in three browsers on the built SPA, with a stateful same-origin API fixture that enforces `If-Match`, `Idempotency-Key` and CSRF; axe; screenshots; no external traffic |
| Acceptance | `qa-report.md` | Real API, Mongo, Azurite and browser, not the tests |

Red proof: projects compile against declaration-only seams, hosts and containers start, and each test fails on an assertion, on 404 from a missing route, or on an explicit `NotImplementedException` from a declared body. Harness errors are fixed before the red evidence is recorded.

## Acceptance mapping

| AC | Positive checks | Negative checks |
|---|---|---|
| AC-P07-01 | D01 every contract document example round-trips JSON-equal. D02 all-empty document, four section types, several of one type and shuffled order persist unchanged through the API. D03 `start > end` saves with `date_range_inverted` at the right pointer; year-only and `present` are not inverted | D04 reader table with exact pointer and code, each confirmed invalid by the JSON Schema: unknown property, missing required, wrong type, content not matching `type`, inline with 0 or 2 paragraphs, bullet list without items, link without children, empty text run, bad enum, bad date, margin not multiple of 0.5, bad `bodyFont`, null for a non-nullable. D05 URL table: `javascript:`, `data:`, `file:`, uppercase scheme, whitespace, control char, 2049 chars. D06 duplicate IDs in all four collections and across them |
| AC-P07-02 | L01 each limit accepted exactly at the bound through reader and rules. L02 50 000 code points of emoji accepted | L03 each limit one over rejected with `max_items`, `max_length` or `resume_text_limit_exceeded`. L04 200 resumes: active + trashed count, 201st 409, parallel creates at 198 end at exactly 200. L05 body over 1 MB 413, depth 65 and lone surrogate and duplicate key `malformed_request` |
| AC-P07-03 | A01 list shape validated by `ResumePage`, summary only, sort by `updatedAt` desc then `id`, paging across pages with no gap or repeat, trash sorted by `deletedAt`. F01 cards, placeholder, date, Open link, empty title fallback. F02 loading, empty, error + retry. E01 journey and deep link | A02 bad `limit`, `state`, `cursor`, another user's cursor, another query's cursor: 400 `location: query`. F03 401 redirects to login with `returnTo`. F04 unknown `templateId` renders |
| AC-P07-04 | B01 blank builder equals ADR-018, typed by the generated contract type. A03 create `document`: 201, `Location`, `ETag "1"`, `Resume` schema. A04 copy: everything duplicated, new IDs, version 1, title null and override. F05 create blank and copy flows. E02 create journey | A05 copy trashed 409, foreign 404, `copyPhotoFromResumeId` foreign 404. F06 `limit_reached` message links to Trash |
| AC-P07-05 | A06 PUT changes title only. F07 rename flow sends full document with new title and `If-Match`. B02 copy title rule, code-point cut | F08 over 150 code points blocks submit; 412 shows recoverable message and refreshes |
| AC-P07-06 | A07 trash, restore, purge states, `purgeAt` +30 days, version +1, library and trash membership. F09 delete confirm, trash view, days left, restore, purge. E03 journey | A08 wrong-state 409s, all writes on trashed 409, purged resume 404. F10 cancel sends nothing |
| AC-P07-07 | A09 get with `ETag`, `no-store`, trashed readable. F01 Open href | A10 missing and malformed ID 404 |
| AC-P07-08 | C01 version +1 for each write kind, `ETag` matches. C02 parallel writers: one 200, others 412 with `currentVersion`. C03 write concern recorded on the collection | C04 missing 428; `*`, list, weak, garbage 400 `location: header`; stale 412 has no document content |
| AC-P07-09 | I01 create replay same status, `Location`, `ETag`, one resume. I02 document replay same version and warnings, no write, still works after a later photo write. I03 trash, restore, purge, crop, remove, snapshot replay. I04 multipart replay with new boundary. I05 canonical hash: key order and whitespace do not change it; RFC 8785 vectors. I06 parallel twin document writes: both 200, version +1 once. I07 crash simulation: record left `in_progress`, lease expiry takeover creates no duplicate; effect applied but record open replays | I08 missing key 400, malformed key 400. I09 same key, different body 422, stored document, version and `ETag` unchanged, for document, create and multipart. I10 in-flight create 409 with `Retry-After`. I11 same key from another user is independent |
| AC-P07-10 | — | X01 table of all 15 operations: anonymous 401. X02 user B with A's IDs: 404, A's resume, snapshot and photo unchanged. X03 CSRF missing 403 on all 9 unsafe. X04 server-owned fields in a body rejected (`ownerId`, `version`, `id` at root, `photo`). X05 snapshot of A under B's resume 404 |
| AC-P07-11 | P01 JPEG, PNG, WebP upload: `PhotoWriteResult` schema, default crop, version +1, mime from bytes with a lying part type. P02 EXIF with GPS removed from master and rendition. P03 orientation applied. P04 rendition 600 px JPEG; small crop not upscaled; transparency flattened on white. P05 crop regenerates rendition only, master bytes unchanged. P06 GET headers and 304, trashed readable. P07 copy gets independent blobs: removing from the source leaves the copy | P08 wrong magic 415; undecodable, oversize side and over 40 MP 400; 5 MB + 1 and 6 MB + 1 413; missing and extra part 400; wrong media type 415. P09 polyglot trailing bytes gone. P10 crop not square, out of bounds, no photo 404. P11 remove with no photo 404 |
| AC-P07-12 | S01 auto snapshot at first write, none at +5 min, one at +10 min. S02 `before_export` 201, then 200, version unchanged. S03 list order, paging, get document, `expiresAt` +30 days, TTL index exists | S04 trashed create 409, foreign 404, bad cursor 400 |
| AC-P07-13 | M01 purge: ledger in Mongo and Blob seen before blobs and document disappear; snapshots and blobs gone. M02 replace and remove: ledger then blobs gone, no orphan under the owner prefix. M03 account purge removes everything for the owner and nothing of another's. M04 export contains active and trashed, schema-valid, owner only | M05 ledger failure: nothing deleted, purge reports failure, resume hidden; retry and worker finish it. M06 failed post-write photo cleanup keeps the 200 and the worker finishes it. M07 ledger holds IDs only |
| AC-P07-14 | K01 host inventory equals contract `x-phase` P04, P06, P07 with statuses. K02 responses validated by schema throughout the API tests. K03 `InProcessContractTests` exact list | K04 Problem shape: `application/problem+json`, `traceId`, status equals HTTP status, on each error family |
| AC-P07-15 | V01 canary in every field, filename and key name, run through success and failure paths: absent from captured logs and every Problem body | V02 blob keys and ledger contain no user text |
| AC-P07-16 | R01 120 writes pass in a window, a new window passes | R02 121st 429 with `Retry-After`; another user passes; 21st upload in an hour 429 |
| AC-P07-17 | E04 screenshots at 1280, 1024, 390; design measurements (two columns at 1280, one at 390, 44 px targets) | E05 no horizontal overflow at 1280, 1024, 390, 640 proxy; no excluded affordance or sample text; no external request. QA: real 200% zoom |
| AC-P07-18 | E06 keyboard-only create, rename, delete, restore, purge. E07 axe on idle, empty, error, trash and each dialog. F11 labels, live status, focus return, initial focus on safe action, duplicate submit blocked | E08 reduced motion removes transitions. QA: contrast on real surfaces |
| AC-P07-19 | B01 as above; G01 ADR files exist and register rows are `ACCEPTED` (blueprint check, review) | E05 includes no wizard or sample text |
| AC-P07-20 | U01 Spanish, Ukrainian, Slovak and emoji through create, get, snapshot and copy. F12 Unicode title shown exactly in a card | U02 code-point counting, not UTF-16 units |

## Amended existing tests

See DD-P07-16 and DD-P07-17: `frontend/src/app/routes.test.tsx`, `tests/e2e/shell.spec.ts`, `tests/e2e/account.spec.ts` (default landing), `InProcessContractTests.ExpectedOperations`, `P06FixtureTests.Fixture`. Nothing else changes, and each change is listed in `test-results.md`.

## Commands

| Exact command | Use |
|---|---|
| `dotnet test backend/tests/ResumeBuilder.Api.Tests -c Release --filter "FullyQualifiedName~P07"` with `RESUMISER_MONGO_IMAGE` set as in `scripts/ci/backend.sh` | Narrow backend |
| `npm test --prefix frontend -- src/features/library src/entities/resume` | Narrow frontend |
| `npm test --prefix tests/e2e -- library.spec.ts --project=chromium` | Narrow E2E, after a build |
| `bash docs/phases/P07/tests/suite.cmd` | Full phase suite: backend, frontend, E2E in three browsers, contract, contract reader |
| `python3 scripts/phase-handoff-check.py --phase P07 --step red` / `--step green` / `--gate` | Step and gate checks |
