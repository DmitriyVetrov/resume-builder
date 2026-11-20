# P07 QA / Acceptance Report — Resume Domain, Library & Persistence

Verdict: PASS

- Run by the operator session on 2026-11-05. Under ADR-051 planning, tests, implementation and acceptance are one actor; the independent check is the external review in `review/code-review.md`.
- This pass exercised the running system, not the tests. Test evidence is in `tests/test-results.md`.

## Environment

| Part | What ran |
|---|---|
| Services | A throwaway Compose project (`docker compose -p resumiser-p07qa up -d --wait`) with the digest-pinned Mongo replica set, Azurite and Mailpit, removed afterwards |
| API | The Release build with `ASPNETCORE_ENVIRONMENT=Production`, real Kestrel, secure cookies, real SkiaSharp native assets, both workers enabled and SMTP to Mailpit |
| Same-origin host | A throwaway proxy on `http://localhost:4190` serving `frontend/dist` and forwarding `/api/v1` with `X-Forwarded-Proto: https`, with `ReverseProxy__TrustedProxies__0=127.0.0.1` |
| API matrix | A script driving real HTTP with real cookies and CSRF, checking Mongo with `mongosh` and Blob through signed REST calls. Output: [qa-evidence/api-acceptance.md](qa-evidence/api-acceptance.md), **114 of 114 checks, then 8 of 8 worker checks** |
| Browser | Real Chromium driven by Playwright against the same host, with the real API behind it and axe-core injected. Screenshots in `qa-evidence/` |

## Acceptance matrix

| ID | Result | Evidence on the running system |
|---|---|---|
| AC-P07-01 | PASS | A mix of all four section types, several of one type, shuffled and hidden, stored JSON-equal and in order. An all-empty document saves. `start > end` saves with `date_range_inverted` at `/sections/0/content/entries/0/end`. Nine closed-schema violations each answered 400 with the exact pointer and code. The contract's own examples round-trip in `P07DocumentTests.D01`. |
| AC-P07-02 | PASS | At the bound 200 and one over 400 for 100 sections, 100 entries, 100 list items, 20 contacts and a 120-emoji name. 50 000 emoji pass, 50 001 fail. A body over 1 MB is 413, depth 65 is `malformed_request`. Six parallel creates at 199 of 200 gave one 201, five `limit_reached` and exactly 200 rows. A trashed resume still counts. |
| AC-P07-03 | PASS with a recorded partial | Summaries only, newest first, `no-store`, paging with no gap or repeat. Bad `limit` and `state`, another user's cursor and another query's cursor are 400 with `location: query`. The browser shows title, placeholder, last modified, loading, empty, and error with retry. **The real first-page thumbnail is P11** (DD-P07-15). Measured on 200 resumes: API p50 5.2 ms, p95 9.6 ms over 60 requests; navigation to 50 painted cards median 92 ms, worst 118 ms over 10 runs. Local measurements, not the P15 p95 target. |
| AC-P07-04 | PASS | In the browser, a blank create stored the FR-SEC-01 set in order, T1, version 1, with Education labels Degree and Institution. A copy has new IDs, version 1 and its own photo ID, and removing the source photo leaves the copy's blobs in place. A trashed source is 409, a foreign one 404. |
| AC-P07-05 | PASS | Rename changes only the title. The UI blocks 151 code points before any request (`F08`) and the API also refuses it. In two real tabs, the stale tab showed "This resume changed elsewhere. Reload and try again.", the list refreshed, and its retry saved. |
| AC-P07-06 | PASS | Trash sets `deletedAt` and `purgeAt` exactly +30 days, version +1. The trash lists it with "30 days left". Restore clears both. Trashed resumes read, all writes answer `resume_trashed`, and the wrong state answers `resume_not_trashed`. |
| AC-P07-07 | PASS | `Open` links to `/resumes/{id}/edit`. `getResume` carries `ETag` and `no-store`, trashed included. Missing and malformed IDs are the same 404. |
| AC-P07-08 | PASS | Missing `If-Match` is 428; `*`, a list, a weak tag and a bare number are 400 with `location: header`. A stale write is 412 with `currentVersion` and `updatedAt` and no content. Eight parallel writers gave one 200 and seven 412, version +1. Mongo's profiler showed `{w: "majority", j: true}` on the insert commands; its update entries do not show the outer write concern, and those go through the same collection objects, with `P07ApiTests.C03` asserting the setting. |
| AC-P07-09 | PASS | Replay answers the same status, `Location` and `ETag`, with one resume. A document replay writes nothing and answers no false 412, and key order does not change the hash. A multipart retry with a new boundary replays. A different body is 422 and nothing changes. Eight parallel creates under one key gave one 201 and seven 409 with `Retry-After`. Keys are owner-scoped. Crash takeover and "effect applied, record open" are covered by `P07ApiTests.I07`, since a crash cannot be timed from outside. |
| AC-P07-10 | PASS | All 15 operations answer 401 anonymously. The 13 with an ID answer 404 for another user, with A's resume, snapshot and blobs unchanged. All 9 unsafe ones answer 403 without CSRF. `ownerId`, `version`, `id` and `photo` in a body are `unknown_property`. |
| AC-P07-11 | PASS | JPEG, PNG and WebP detected from bytes although the part claimed `text/html`; GIF is 415. Undecodable, 8001 px and 40.96 MP are `photo_invalid`. Exactly 5 MB passes and its padding is gone; 5 MB + 1 is 413. **6 MB + 1 and a 7 MB chunked body on real Kestrel are 413 with a problem body.** No EXIF or GPS in master or rendition, orientation 6 applied to the pixels, polyglot bytes gone. Default crop, 600 px rendition, no upscaling, flattened on white. A crop changes the rendition only. `private, no-cache`, a byte `ETag`, `nosniff`, 304, and reads while trashed. |
| AC-P07-12 | PASS | An automatic snapshot on the first write and none within ten minutes. `before_export` 201 then 200, version unchanged, `expiresAt` +30 days; a foreign read is 404. The snapshot at +10 minutes uses the controlled clock in `S01`. |
| AC-P07-13 | PASS | Replacing a photo and purging a resume wrote Mongo and Blob ledger entries with IDs only, then removed the blobs, snapshots and row. A stale purge left no entry. **After the real 15-minute tick:** an account purge removed the account, resumes, snapshots, idempotency records and blobs and left its ledger entry; the worker finished an interrupted photo removal and an interrupted purge. An interrupted purge is hidden from reads at once. The export holds the owner's active and trashed resumes and nothing else. |
| AC-P07-14 | PASS | `git diff main...HEAD -- contracts` is empty. `P07ContractTests.K01` compares the host inventory with the contract's 29 P04, P06 and P07 operations and statuses. Responses are validated by the contract schema throughout `P07*Tests`. |
| AC-P07-15 | PASS | A canary in every document field, a filename and a key name, through success and failure paths, appears in no problem body and in 0 lines of the API log. The stale-write secret, the GPS marker and the test password also appear in 0 lines. Blob keys and ledger entries hold IDs only. `P07SecurityTests.V01` repeats this at every log level. |
| AC-P07-16 | PASS | `doc-write`: 120 pass, then 429 with `Retry-After`; another user is unaffected. `photo-upload`: the 21st attempt in the hour is 429. The window reopening uses the controlled clock in `R01` and `R02`. |
| AC-P07-17 | PASS | Compared with `architecture/ui-ux-design.md`. No horizontal overflow at 1280, 1024, 640 and 390 px. Two columns at 1280 and 1024, one at 640 and 390. Thumbnail 112 × 158 px, targets at least 44 px. Under a CDP metrics override equal to 200% zoom of a 1280 px window (640 CSS px at device scale 2): overflow 0, primary action visible, dialog 480 px and fully inside the viewport. No third-party request, and no excluded term on the page or in the dialog. |
| AC-P07-18 | PASS | By keyboard alone: rename, delete, restore, purge and create. Dialogs keep focus, open on Cancel, and Escape returns focus to the opener. After a success, focus moves to the live status region (`role="status"`, `aria-atomic`). Load more moves focus to the first new card. Axe found no WCAG 2.1 A/AA violation on idle, trash, empty trash, and the create, rename, delete and purge dialogs on the real API; the error state is `E07`. Contrast measured on real surfaces: h1 13.92, card title 14.94, meta 6.02, tabs 6.77, buttons 7.27, thumbnail label 6.02. Reduced motion takes the card transition from 0.15 s to 0 s. |
| AC-P07-19 | PASS | ADR-017 and ADR-018 are Accepted and the register says so. No wizard or sample content. Education carries Degree and Institution as stored in the created document. |
| AC-P07-20 | PASS | Spanish, Ukrainian, Slovak and emoji text round-trips exactly through create, read, summary, snapshot and copy. The browser renamed a resume to `Олександр Núñez Ľubomír 😀` and showed it exactly on the card. |

## Defects found in this pass

None in the product. Each stop in the API matrix was the script's own: binary IDs from its seed, the real 20-per-hour limit reached by one test user, and a client that could not read an early 413 while still sending, which is why the oversize cases use `curl`.

One observation stays open as a note, not a defect: a client that sends a whole oversized body before reading can see a connection reset instead of the 413, because Kestrel closes after answering early. `curl` reads the 413 as a browser should. The P08 upload UI should check the size first.

## Deviations from the design

- `library-zoom200.png` was dropped: Playwright resets the metrics override when it takes a screenshot, so the capture showed the 1280 px layout. The zoom evidence is the DOM measurement above and `library-idle-640.png`.
- Screenshots use the host's system font stack, so a few buttons wrap differently from the container runs. The layout holds either way.

## Deferred, by plan

| Item | Phase |
|---|---|
| Real first-page thumbnail on the card (FR-LIB-01, DD-P07-15) | P11 |
| Hourly purge of expired trash, restore reconciliation and its drill (ADR-016, ADR-039 §4, DD-P07-03) | P13 |
| Editor flows on these operations; the crop, upload and snapshot UI (FR-PER, FR-PHO) | P08 |
| Export from the library list (FR-LIB-06) | P12 |
| NFR-02 p95 target under load | P15 |
