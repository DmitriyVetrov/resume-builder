# P11 QA / Acceptance Report — Shared Layout & Preview Engine

Verdict: PASS

- Run by the operator session on 2026-11-06. Under ADR-051 planning, tests, implementation and acceptance are one actor; the independent check is the external review in `review/code-review.md`.
- This pass exercised the running system. Test evidence with exact commands is in `tests/test-results.md`.

## Environment

| Part | What ran |
|---|---|
| Services | Throwaway Compose project `resumiser-p11qa`: digest-pinned Mongo replica set, Azurite and Mailpit, removed afterwards, fresh for each spec file |
| API | Release build, `ASPNETCORE_ENVIRONMENT=Production`, real Kestrel, secure cookies, SMTP to Mailpit |
| Same-origin host | `tests/e2e/real-stack/proxy.mjs` on `http://localhost:4190`, serving `frontend/dist` with `gzip` as the web image does, and forwarding `/api/v1` |
| Browser | Real Chromium in the pinned Playwright image |
| Result | **A01–A06: 6 of 6**, and **R01–R10** and **D01–D05** as the P08, P09 and P10 regression, each spec file on a fresh stack |
| Other browsers | Firefox and WebKit ran the whole fixture E2E suite and the rendering gate. They did not run against the real API |
| Web image | The real nginx image, built and probed by `web-image-check.sh` |
| Screenshots | [qa-evidence/](qa-evidence/), synthetic data |

## Acceptance matrix

| ID | Result | Evidence |
|---|---|---|
| AC-P11-01 | PASS | Stored four-page resumes on T1, T2, T3 show separate pages and "1 / N" through the real API (A01, `preview-t*-1280.png`). Proportions and a gap of at least 16 px in three browsers (Q01). No draft label (P01, W01). |
| AC-P11-02 | PASS | 48 cases per browser: 12 fixtures × T1, T2, T3 on A4, plus Letter and Large. G1, G5, G6 on Node with poppler. G7: model, PDF, TXT bytes identical in Node and three browsers. G2 worst page 0.146%, 0.388%, 0.560%, controls above 3.7%. The real route's painted text and positions equal the Node model on each template (Q02). |
| AC-P11-03 | PASS with a recorded partial | Keystroke to painted page p95: Chromium 50.1, Firefox 52.0, WebKit 98.0 ms. Slider step p95: 83.6, 134.0, 214.0 ms. 116.4 ms at 4× CPU throttle. Live update through the real API (A01). **Partial, DD-P11-15: measured on the development laptop, which is NFR-01's own reference class, not on the CI runner.** |
| AC-P11-04 | PASS | Counter in the spacing card, changes with a real key on a real slider (C30, Q04, A02). |
| AC-P11-05 | PASS | Order and least change (Z01–Z06). Applies, reports, one undo; or reports it cannot and changes nothing (C31, C32). On real data: stored sections unchanged (A02). |
| AC-P11-06 | PASS | Real clicks: 595, 793.33, 991.67 px, and fit width follows the panel; text unchanged (Q05, P04, P05). |
| AC-P11-07 | PASS | Oversized fixture shows the dashed outline and the text line (Q06, P06). PG-09 and the lone-title net in the model (N12, N13, X20). No hint on ordinary fixtures. |
| AC-P11-08 | PASS | Within one line at 75%, 125% and fit width (Q07). A real click on an entry opens and marks it (Q07, P09). Enter and Space on one tab stop per section (P07, Q07). Header (P08). Selection has an inset bar as well as a tint. |
| AC-P11-09 | PASS | N01–N11, N14 sweep content across the boundary line by line. Found and fixed two P10 defects: the timeline ran through the section title, and dates wider than a column lost text. |
| AC-P11-10 | PASS | X01–X20, E16, Y08, Y10 baselines. Read in `preview-t2-390.png`, `preview-t3-1280.png`. Real photo on the band (A03). |
| AC-P11-11 | PASS | Painted on the real API, cached with no document read on reload, cleared by "Remove and log out" (A05, `library-1280.png`). Per-user and version rules (K01–K10). Picker thumbnails are real pages (C01, A02). **NFR-02, 12 cards, 10 Mbit/s, cold, 10 runs: p95 1,404 ms** (A06). |
| AC-P11-12 | PASS | A page with no resume loads one script and no font (Q09). Real image: `gzip` on JS, CSS, TTF, and `font/ttf` (`web-image-check.sh`). **Editor, four pages, 10 Mbit/s, cold, 10 runs: p95 957 ms** (A06). DD-P11-11 stands: no batched endpoint needed. |
| AC-P11-13 | PASS | CE01–CE12 against the real host. Real API answers 202 and logs one line of parsed fields, with no title text in the log (A04). Client side H01–H05, Q10, Q12. |
| AC-P11-14 | PASS | DD-P11-13 and its measurement in `test-results.md`. E22 checks strings as typed. **The FR-LAY-09 hyphenation clause is not delivered, by decision.** |
| AC-P11-15 | PASS | Axe clean on T1, T2, T3 in three browsers (Q11) and on the real stack (A01). Tab order and ring (Q11). No page overflow at 390 px and 640 px wide, the 200% case (Q11, A01). |
| AC-P11-16 | PASS | No excluded feature. No request leaves the origin (Q09, Y06). No anchor in the preview (P13). Blocked font: Retry, editing still saves, recovery (Q12, P12, P12b). `git diff main -- contracts` is empty. |

## Seen on the running system, beyond the tests

- Read T1, T2, T3 at both widths, the Design tab and the library. Zoom options wrapped onto two rows at 390 px; fixed.
- Thumbnails in library cards are about 112 px wide: they identify the layout, and their text is not meant to be read.
- At 1280 px the Design tab replaces the preview in the right column, as FR-EDT-05 and P10 have it, so the page counter is what the user sees change while moving a slider. FR-PRV-04 asks exactly for that.

## Open items, none blocking this phase

| Item | Owner | Note |
|---|---|---|
| G3, G4, NFR-01 on the reference CI runner; the rendering job's first run on GitHub | P15 | Needs a push. Commands exist (DD-P11-15, DD-P10-16). |
| Characters outside the font subset (emoji, CJK) | P12 | The browser may substitute a system font in the preview, while line breaks stay the engine's. Carried by P12's Unicode decisions and the FR-TYP-03 check. |
| FR-LAY-09 hyphenation clause | Owner, P15 decision table | Not delivered, by DD-P11-13. |
| Client event codes and engine versions | P12 and any engine change | A new code must join `ClientEventLoggedCodes`, and a new `ENGINE_VERSION` must join `ClientEventLoggedEngines`, or they log as `other`. |
| Cold-start 403 on first sign-up | P13 | From P10's report. Not seen in this phase, but the server was warmed first, so this says nothing about it. |
| `scripts/ci/security.sh` fails at gitleaks on a synthetic password | `main`, owner (DD-P10-18) | Already on `main`. Gitleaks over this branch's commits: no leaks. |
