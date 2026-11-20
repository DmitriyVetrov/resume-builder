# P08 QA / Acceptance Report — Editor Workspace & Autosave

Verdict: PASS

- Run by the operator session on 2026-11-05. Under ADR-051 planning, tests, implementation and acceptance are one actor; the independent check is the external review in `review/code-review.md`.
- This pass exercised the running system. Test evidence is in `tests/test-results.md`.

## Environment

| Part | What ran |
|---|---|
| Services | Throwaway Compose project (`docker compose -p resumiser-p08qa up -d --wait mongo azurite mailpit`): digest-pinned Mongo replica set, Azurite and Mailpit, removed afterwards |
| API | Release build, `ASPNETCORE_ENVIRONMENT=Production`, real Kestrel, secure cookies, real SkiaSharp, all workers on, SMTP to Mailpit |
| Same-origin host | `tests/e2e/real-stack/proxy.mjs` on `http://localhost:4190`: serves `frontend/dist`, forwards `/api/v1` with `X-Forwarded-Proto: https`, `ReverseProxy__TrustedProxies__0=127.0.0.1` |
| Browser | Real Chromium in the pinned Playwright image: `npx playwright test -c playwright.real.config.ts --timeout=120000` |
| Result | **R01–R10: 10 of 10 passed** on a fresh stack, with real sign-up, login, cookies and CSRF |
| Other browsers | Firefox and WebKit ran the same flows through `editor.spec.ts` on the built SPA with the strict fixture API (`tests/test-results.md`). They did not run against the real API |
| Screenshots | [qa-evidence/](qa-evidence/), synthetic data |

## Acceptance matrix

| ID | Result | Evidence on the running system |
|---|---|---|
| AC-P08-01 | PASS with a recorded partial | Three panels at 1280 px; Preview and Design tabs; title, status, Undo, Redo, disabled Export PDF and TXT described as not available yet (R07, screenshots). An edit shows in the draft at once (R08). **Export function is P12, Design controls P10, and the NFR-01 clause P11** (DD-P08-01, 02). |
| AC-P08-02 | PASS | Header plus sections in stored order, type icons, Hidden and Empty badges (R01, R08, `workspace-header-1280.png`). A blank resume previews no empty section; the first filled one appears alone (R08). |
| AC-P08-03 | PASS with a recorded partial | Selection opens the form and the reload returns to the same section (R08). Scroll within one line and preview click are `E12`, on the draft renderer; **page-accurate scroll closes with P11's preview.** |
| AC-P08-04 | PASS | At 390 px, four tabs, no overflow, all forms reachable (`E16`, `workspace-header-390.png`, `entry-form-390.png`). Selecting moves to Edit. |
| AC-P08-05 | PASS | Saved: no `beforeunload` cancel. Unsynced: cancelled (R09). A real browser dialog in three browsers is `E13`. |
| AC-P08-06 | PASS | Add, reorder, kind, link override; e-mail shows `mailto:`; `@handle` no link; override normalised to `https://`; stored exactly (R08). `Олександр Núñez \| Ľubomír` stored as typed (R01). |
| AC-P08-07 | PASS | Added a list section named `interests AND More`, case kept; renamed inline; focus on the title field after adding (R08). |
| AC-P08-08 | PASS | Real pointer drag moved Skills to the first position, up and down moved items; stored order equals the panel (R08). Keyboard order with focus and announcement is `E09`. Entry drag is `E10`. |
| AC-P08-09 | PASS | Hide shows Hidden; delete confirmed, Undo delete took focus, restored; duplicate stored with new IDs (R08). |
| AC-P08-10 | PASS | `List columns` 2 stored. `list` → `text` stored; `Entries` disabled in the type list (R08). |
| AC-P08-11 | PASS | Education opened with Degree and Institution labels; dates stored; start after end warned and still saved; a `City` label changed the form and stayed out of the preview (R08). |
| AC-P08-12 | PASS | Each edit saved and read back through `getResume`; reload shows it (R01). A write within 1 s of the last keystroke is `E01`, with a 750 ms debounce. |
| AC-P08-13 | PASS | Real offline shows the exact text, then syncs (R03). A blocked write survived a reload through IndexedDB (R09, `E03`). |
| AC-P08-14 | PASS | A body over a limit: `Not saved: check "Professional Summary"`, then `Not saved: this resume is over 50,000 characters`; version unchanged; undo returns to Saved (R06). Lost response, one version and no conflict: `E04` and `A04`. 422, 401 and in-flight rules are `A07`–`A10`, because a real server cannot be made to give them on demand. |
| AC-P08-15 | PASS | A second client wrote through the real API; the next edit got a real 412; `Mine (conflict copy)` exists on the server with the edits; the tab shows the latest and links to the copy (R02, `conflict-notice-1280.png`). Clean tab and `BroadcastChannel`: `E06`. Retry and discard: `E07`, `W23`. |
| AC-P08-16 | PASS | 50 steps undone by keyboard on the real session down to a disabled Undo, then Saved (R09). Redo and mixed content are `E08`. Design changes use the same path (`H01`) and get controls in P10. |
| AC-P08-17 | PASS | Lists a real snapshot, restores it, stored, undo returns (R05, `version-history-1280.png`). |
| AC-P08-18 | PASS | Real bytes declared as `text/plain` detected as PNG; crop with sliders stored as `{0,100,200,200}`; JPEG rendition served; the next autosave used the new version; remove confirmed and stored (R04). 5 MB + 1 refused with no request, exactly 5 MB sent: `W20`, `E14`. |
| AC-P08-19 | PASS | `localStorage` held only section IDs (R09). Log out offered removal with the unsynced warning; after removal IndexedDB has 0 rows and `localStorage` is empty (R09, `sign-out-local-data-1280.png`). Another user sees no draft: `E18`. |
| AC-P08-20 | PASS with a recorded limit | Axe found no WCAG 2.1 A/AA violation on the real header, all four section types and an open entry (R07), and on the dialogs, offline, conflict and 390 px states in three browsers (`E17`). No overflow at 1280, 1024, 390 px and at 200% zoom by a metrics override (640 CSS px, scale 2). Keyboard only: `E11`. **No manual screen-reader pass was run;** P14 owns that audit (TRACEABILITY NFR-06). |
| AC-P08-21 | PASS | No excluded term on the page (R09). `git diff main...HEAD -- contracts` is empty. No request left the origin (R09). A canary title reached no URL or console. **API log scan:** 310 lines, 0 hits for the account, name, canary, entry text or password, 0 `fail` or `crit`. |

## Defects found in this pass

All fixed, re-run and in delta 2 of the review:

1. **Lost text at machine speed.** Ctrl+A, ArrowRight, Enter replaced the text, because the engine still held the select-all. `T02b` was red 5 of 5, then green. A person is unlikely to hit it, but nothing should depend on that.
2. **Preview not keyboard-scrollable on a blank resume.** Axe `scrollable-region-focusable`, found only because this pass opened a real blank resume.
3. **Editor colour tokens undefined.** `@theme` in `editor.css` is not processed outside the file importing Tailwind, so the status dot and panel field had no colour. Found by looking at the screenshots; no test had caught it, so R01 now asserts the dot's colour.
4. **Misaligned labels** in the entry field grid, from a too-broad `:first-child` rule.

## Deviations from the design

- Screenshots show regular weight where the design has bold: the container's `system-ui` is WenQuanYi Zen Hei, which has no bold face. Computed `font-weight` is 700 (R01). This is the screenshot environment.
- A blank resume's draft sheet is an empty white box. Accepted until P11 replaces it.

## Measured, locally

Reload to visible title 184 ms. JavaScript bundle 172 KB gzipped, up from 85 KB before this batch, including ProseMirror (ADR-052 allowed for up to 90 KB). Local figures; NFR-02's target is verified in P15.

## Deferred, by plan

- **P10:** Design tab controls, `language` and `dateFormat`.
- **P11:** the real paginated preview, FR-EDT-01's NFR-01 clause, page-accurate FR-EDT-03, and `reportClientEvents` for ADR-037 §4's 422 report (DD-P08-07).
- **P12:** Export PDF and TXT behind the disabled buttons, and FR-TYP-03's export check.
- **P13:** recovery and offline replay at scale, per ADR-029's consequences.
- **P14:** manual screen-reader audit.
