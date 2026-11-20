# P10 QA / Acceptance Report — Templates & Design Controls

Verdict: PASS

- Run by the operator session on 2026-11-05. Under ADR-051 planning, tests, implementation and acceptance are one actor; the independent check is the external review in `review/code-review.md`.
- This pass exercised the running system. Test evidence with exact commands is in `tests/test-results.md`.

## Environment

| Part | What ran |
|---|---|
| Services | Throwaway Compose project `resumiser-p10qa`: digest-pinned Mongo replica set, Azurite and Mailpit, removed afterwards, fresh for each spec file |
| API | Release build, `ASPNETCORE_ENVIRONMENT=Production`, real Kestrel, secure cookies, SMTP to Mailpit |
| Same-origin host | `tests/e2e/real-stack/proxy.mjs` on `http://localhost:4190`, serving `frontend/dist` and forwarding `/api/v1` |
| Browser | Real Chromium in the pinned Playwright image |
| Result | **D01–D05: 5 of 5**, and **R01–R10: 10 of 10** as the P08 and P09 regression, each on a fresh stack |
| Other browsers | Firefox and WebKit ran `design.spec.ts` (Y01–Y09, Y11) on the built SPA with the strict fixture API. They did not run against the real API |
| Screenshots | [qa-evidence/](qa-evidence/), synthetic data, each template at 1280 and 390 px |

## Acceptance matrix

| ID | Result | Evidence |
|---|---|---|
| AC-P10-01 | PASS with a recorded partial | G1, G5, G6: `reference.mjs` over real PDFs and poppler. G7: identical model, PDF and TXT in Node, Chromium, Firefox, WebKit. G2: 0.017%, 0.116%, 0.281%, with a negative control. G3: p95 50, 65, 113 ms. G4: PDF p95 at most 109 ms, TXT at most 1 ms, 46,876 bytes. ADR-010 carries the "Technology confirmation". **Partial: G3 and G4 ran on the development laptop, not the reference CI runner**, and the rendering job has not yet run on GitHub (DD-P10-16). |
| AC-P10-02 | PASS | Three data definitions (D01–D06, X01–X08, D24). A fourth definition resolves with no content change. |
| AC-P10-03 | PASS | Three thumbnails of the user's own text in the real Design tab (`design-tab-t*-1280.png`); they update after an edit (C02). Selection has a frame and a check, so not colour alone. Arrow keys change template (Y01). |
| AC-P10-04 | PASS | Real clicks T1, T2, T3, T1: identical draft HTML, every PUT equal except `templateId`, same order (Y02). Stored document deep equal through the real API (D05). Identical PageModel hash (E16). T3 keeps order in each column (V05). |
| AC-P10-05 | PASS | Skills in the sidebar by default, an override moves it, T1 ignores and keeps the field (Y08, D05). |
| AC-P10-06 | PASS | Three swatches with a check per template (C05, C06). T1 hex values, and every preset ≥ 4.5:1 (D07). Colour roles only: name changes, body stays (Y03, E09, V09). No picker or hex input (C07). |
| AC-P10-07 | PASS | §6.9 table (D12–D15); every style changes while markers, photo and spacing stay (E08). Real computed font size (Y05). |
| AC-P10-08 | PASS, PDF clause with P12 | Real keys: arrows, Home, End, double-click (Y04). Formulas measured in the model (E04–E06) and in the sheet (V08, C10). **PDF measurement ±0.5 pt: P12**, as the criterion states. |
| AC-P10-09 | PASS | Sheet proportions and padding measured in three browsers (Y05). PageModel geometry and continuation top (E01, E02, D16–D18). Invalid custom text never reaches the document (C16, Y05). |
| AC-P10-10 | PASS | Reset restores the listed settings for the active template and leaves font, language, date format, placement and content (C20, C22). One undo restores all (C21, Y05). |
| AC-P10-11 | PASS | Three fonts per template, loaded from our own origin (Y06). All twelve faces cover the Spanish, Slovak and Ukrainian strings (E22). A foreign `bodyFont` written through the real API renders the default and is not rewritten (D03). Licences beside the fonts. |
| AC-P10-12 | PASS, hyphenation with P11 | Three languages and four formats in draft, engine and TXT from one pure function (A01–A09, T05, V13, Y07, D01). **Hyphenation: P11** (DD-P10-11), as the criterion states. |
| AC-P10-13 | PASS, latency with P11 | Each control reaches the PUT (C04, C09, C14, C18, C19) and survives a reload and a new tab on the real API (D01), a snapshot restore and undo (D02). A burst is one undo step (C12, Y04). **NFR-01 as a release target: P11**. |
| AC-P10-14 | PASS | By type and template, explicit wins (D19, V14, V15). Draft and PageModel apply it (E14). TXT ignores it (T04). |
| AC-P10-15 | PASS | T1 and T3 no icons, T2 one per kind (V03, V17). Photo per template, `showPhoto` untouched in T2 (V04, E12). Seen in `draft-t*-1280.png`. **T2's chips and T3's band in the engine are P11's**, per the plan; the draft view has them. |
| AC-P10-16 | PASS | T1 tokens (D08–D11). Roles, link colour, no underline (E09, V16). Same block for Education (ADR-031, E13). No separator at a line start in the PageModel (E11). Single entry draws no line (E13, V02). Paragraph gap (Y11). |
| AC-P10-17 | PASS | Axe clean on the Design tab for each template in three browsers (Y09) and on the real stack (D04). Every control reached by Tab with a visible ring (Y09). No page overflow at 390 px and at 200% (Y09, D04). Reduced motion removes transitions (Y09). |
| AC-P10-18 | PASS | No excluded feature. No request leaves the origin (Y06, D04). `git diff main -- contracts backend` is empty. No P08 or P09 test edited; of the existing test harness, only `playwright.config.ts` (the new spec) and `proxy.mjs` (TTF content type) changed. |
| AC-P10-19 | PASS | Chromium baselines of T1, T2, T3 in the pinned image from a synthetic fixture with Spanish and Ukrainian text (Y10), compared in the full suite run. |

## Seen on the running system, beyond the tests

- Read every template at both widths: `design-tab-t2-1280.png`, `design-tab-t3-390.png`, `draft-t3-390.png` and the baselines. Reading the first baselines found two defects no test had caught, both fixed: the paragraph gap was lost to a reset rule (now Y11), and small text was unevenly spaced without subpixel positioning.
- Thumbnails at 390 px are small, about 100 px wide, as the design says. They identify the template and its layout; the text in them is not meant to be read.

## Open items, none blocking this phase

| Item | Owner | Note |
|---|---|---|
| **Cold-start 403 on first sign-up.** On the first request after a server start, a new browser got `403` and "Your security check expired. Please try again." The app issues two concurrent `GET /session`, each of which sets an antiforgery cookie, and they appear to race on a slow server. It recovered on retry, and did not recur on a warm server. | P06 area, for P13 hardening | Seen once, in the first acceptance run. Not caused by P10. The diagnosis is from the API log order and is not proven. |
| `scripts/ci/security.sh` fails at gitleaks on a synthetic password in `P06FixtureTests.cs` | `main`, owner (DD-P10-18) | Already on `main`. The job stops there in CI. |
| Web image serves TTF uncompressed | P11 (DD-P10-17) | Decide against NFR-02. |
| G3 and G4 on the reference runner; the rendering job's first run on GitHub | P11, P15 | Commands exist; no remote run was possible in this phase. |
| Real page layout behind the preview, engine rules for T2 and T3, hyphenation | P11 | By plan. |
| PDF metadata, tagging, measured spacing | P12 | By plan. |
