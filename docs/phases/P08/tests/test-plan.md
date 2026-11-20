# P08 Test Plan

Levels: pure unit and state-machine tests (Vitest), component tests (Vitest, React Testing Library, stateful `fetch` fixture), browser E2E on the built SPA with a strict stateful fixture API (Playwright, Chromium, Firefox, WebKit), and a real-stack acceptance spec in step 7. Budget from `architecture/phase-plan.md`: Vitest ≤ 70, E2E ≤ 18 per browser.

Fixtures are synthetic. `tests/e2e/editor-fixture.ts` enforces CSRF, `Idempotency-Key` with body hash replay and 422, `If-Match` with 412 and 428, trash and limit answers, and records `violations`, asserted empty after each test (DD-P08-22).

## Vitest

| ID | File | What it proves | AC |
|---|---|---|---|
| H01–H06 | `features/editor/history.test.ts` | Undo and redo; coalescing by key and time; a new edit clears redo; ≥ 50 steps, capped at 100; selection restored | 16 |
| O01–O12 | `entities/resume/operations.test.ts` | Add of each type is schema-shaped; rename; move bounds; hide; delete; duplicate with new deep IDs; entry, item and contact operations; conversion table; empty rule; limits; code-point clamp; inverted dates | 2, 6–11 |
| C01 | `entities/resume/contact-link.test.ts` | FR-HDR-04 table, including `@handle` and scheme normalising | 6 |
| CR01–CR02 | `features/editor/crop.test.ts` | Zoom and pan give an integer square inside the master; a crop maps back to the same controls | 18 |
| A01–A20 | `features/editor/autosave.test.ts` | Every row of the plan's answer table: debounce; one in flight; coalesced new key; retry same bytes and key; unknown outcome resolved first; `online`; 5xx and `Retry-After`; 422 never Saved; 400 no retry with pointer; 401 stop; conflict with and without unsynced edits; copy once; copy failure with retry and discard; trash and gone; draft written before send and removed when clean; recovery replay, stale base and older orphans; other live tab's row untouched; undo back to acked sends nothing; `runExclusive`; broadcast; `unsynced` | 12–15 |
| W01–W22 | `features/editor/workspace.test.tsx` | Panels, top bar, disabled export with reason; rows with badges; form and preview selection; last section; inline rename; add dialog; move with focus and announcement; hide; delete and undo; duplicate; shortcuts; `beforeunload`; entry form and date warning; labels; contacts; clamp; photo size refused with no request; photo remove and crop; four tabs; load states; conflict notice; version history | 1–11, 15–18 |
| AC-LOGOUT | `features/account/account.test.tsx` (addition) | No local data: one-click logout. Local data: dialog, removal on request, warning if unsynced | 19 |

## E2E (`tests/e2e/editor.spec.ts`)

| ID | Scenario | AC |
|---|---|---|
| E01 | Type, write within 1 s of the last keystroke, reload shows it | 12 |
| E02 | Real offline: status, edits accumulate, reconnect syncs once | 13 |
| E03 | Writes blocked, reload: IndexedDB draft recovered and synced | 13 |
| E04 | Response lost after the server applied: same key replays, one version, no conflict | 14 |
| E05 | Newer version elsewhere plus unsynced edits: one conflict copy, latest shown, link works | 15 |
| E06 | Two real tabs: the clean tab reloads with the notice by `BroadcastChannel` | 15 |
| E07 | Conflict copy refused by the limit: retry and discard offered, nothing lost until discard | 15 |
| E08 | Undo and redo 50 steps across content and structure, keyboard and buttons; result autosaved | 16 |
| E09 | Sections reorder by pointer drag and by keyboard; saved order equals panel and preview | 8, 2 |
| E10 | Entries added, filled, reordered by drag; list items by up and down | 8, 11 |
| E11 | Keyboard only: add, rename, hide, delete, undo | 7, 9, 20 |
| E12 | Selecting scrolls the preview within ±1 line; preview click selects; reopen restores the section | 3 |
| E13 | Saved: no `beforeunload` dialog. Unsynced: dialog | 5 |
| E14 | Photo: oversize refused with no request; upload, crop dialog, crop saved; remove | 18 |
| E15 | Version history lists and restores; undo returns | 17 |
| E16 | Regions at 1280, tabs at 800 and 390 by keyboard, no overflow, zoom; moved from `shell.spec.ts` (DD-P08-12) | 1, 4, 20 |
| E17 | Axe on workspace, entry form, dialogs, conflict and offline states; screenshots; no excluded terms; no third-party request; no content in the console or URLs | 20, 21 |
| E18 | Draft and last section namespaced by user; sign-out dialog removes them from IndexedDB and `localStorage` | 19 |

## Real stack (step 7)

`tests/e2e/real-stack/editor-acceptance.spec.ts` drives real Chromium through the throwaway same-origin proxy against the real API, Mongo and Azurite: autosave and reload, real 412 from a second client with a real conflict copy, photo upload, crop and remove with real bytes, version history. AC 12, 13, 15, 17, 18.

## Commands

`docs/phases/P08/tests/suite.cmd` runs `scripts/ci/e2e.sh` (frontend job plus Playwright in the pinned image) and the contract suite. There is no backend production change in P08; P09's suite carries the backend job.

Amended existing tests are listed in `tests/test-results.md` (DD-P08-12).
