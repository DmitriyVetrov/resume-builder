# P12 QA / Acceptance Report — PDF & TXT Export

Verdict: PASS

- Run by the operator session on 2026-11-06. Under ADR-051 planning, tests, implementation and acceptance are one actor; the independent check is the external review in `review/code-review.md`.
- This pass exercised the running system on the final code. Test evidence with exact commands is in `tests/test-results.md`.

## Environment

| Part | What ran |
|---|---|
| Services | Throwaway Compose project `resumiser-p12qa`: digest-pinned Mongo replica set, Azurite and Mailpit, removed afterwards, fresh for each spec file |
| API | Release build, `ASPNETCORE_ENVIRONMENT=Production`, real Kestrel, secure cookies, SMTP to Mailpit |
| Same-origin host | `tests/e2e/real-stack/proxy.mjs` on `http://localhost:4190`, serving `frontend/dist` with `gzip` as the web image does, and forwarding `/api/v1` |
| Browser | Real Chromium in the pinned Playwright image |
| Result | **`export-acceptance`: 7 of 7. Regression: `editor-acceptance` 10 of 10, `design-acceptance` 5 of 5, `preview-acceptance` 6 of 6,** each spec file on a fresh stack |
| Other browsers | Firefox and WebKit ran the whole fixture E2E suite and the rendering gate, including byte equality with Node. They did not run against the real API |
| Evidence | [qa-evidence/](qa-evidence/), synthetic data: screenshots, the PDFs and a TXT from the real route |

**A harness fault during this step, recorded so nobody reads it as a product result.** The first full acceptance run gave failures: 500 on photo upload and sign-up timeouts. The cause was this session's own stack script. An API process from an earlier run still held port 5090, so the new API failed to bind and requests reached a process whose Azurite data had been wiped. The script now waits for the port and stops if the API did not bind, and the results above are from a clean rerun. The server was warmed before each spec, as P11 did, so this run says nothing about P10's cold-start 403, which stays with P13.

## Acceptance matrix

| ID | Result | Evidence |
|---|---|---|
| AC-P12-01 | PASS | One click from the top bar downloads a file through the real API on T1, T2, T3, with no dialog (A01, E01). No e-mail or share control (E09). |
| AC-P12-02 | PASS | `pdffonts` on the real files: every font embedded, subset, with a Unicode map. Typed Spanish, Ukrainian, Slovak back on all three families, ligatures included (R06, R07, `qa-evidence/export-T*.pdf`). All 12 faces hold the three alphabets (M03). |
| AC-P12-03 | PASS | URLs listed, and each rectangle covers its text. `@handle`, `javascript:` and `data:` have no annotation (R08). |
| AC-P12-04 | PASS | A4 595 × 842 and Letter 612 × 792. Ink inside margins 23, 40, 72 (R03). In the PDF, space above a title is `10 + v` and between entries `v`, within ±0.5 pt, at v = 0, 7, 10, 20 (R04, R05). **Closes AC-P10-08's PDF clause.** |
| AC-P12-05 | PASS | Real file: Title "Lucía Ñáñez-Šťastná \| Інженерка — Go • PostgreSQL • Kubernetes • Azure", Author, Creator Resumiser (`pdfinfo`, R01). `/Lang` for `en`, `es`, `uk` (R02). |
| AC-P12-06 | PASS | F01–F08, and real downloads (A01, E01, E02). |
| AC-P12-07 | PASS | Real upload: rendition 600 px, quality 90.1 from its tables, 617 dpi on T1 and 675 dpi on T3, and its bytes appear unchanged in the PDF (A02). `pdfimages`: JPEG, 617 ppi. A failed photo fails the export visibly (A04, `export-failed.png`). **A crop under 195 px stays under 200 dpi, by DD-P07-06 and DD-P12-12: no pixels are invented.** |
| AC-P12-08 | PASS (Should) | `Tagged: yes`. H1, H2, H3, L/LI/LBody, Figure with alternative text, Link with its annotation, on each template, one element across pages, decoration as artifacts (S01–S07, R09). No PDF/UA conformance claim, by DD-P12-09. |
| AC-P12-09 | PASS with a recorded partial | 322,709 bytes with a real 600 px rendition. Worst case 398,590 bytes (R12). Click to file, 20 runs, four pages with a noise photo: PDF p95 Chromium 181, Firefox 267, WebKit 250 ms; TXT p95 83, 90, 89 ms. **Partial, DD-P12-16: measured on the development laptop, not the CI runner.** |
| AC-P12-10 | PASS | §9.4 byte for byte (T06, E02). Twelve goldens (T07). TXT from the real API equals the golden (A01). PDF tags and TXT hold the same text in the same order on T1, T2, T3 (R10). |
| AC-P12-11 | PASS (Should) | CRLF on every line, persisted (T12, A08, E06). The real clipboard read back equals the TXT (A01). |
| AC-P12-12 | PASS | A real unverified account is blocked with a reason, and exports after following the mailed link (A05, `export-unverified.png`). No name: E03, A02. Focus re-reads the session (A09, E04). |
| AC-P12-13 | PASS (Should) | Real resume with a photo: the library's PDF and TXT equal the editor's bytes (A06, `export-library.png`). Trash has no export (B01, E08). |
| AC-P12-14 | PASS | 48 cases per browser still pass G1, G2, G5, G6, G7 with the tagged writer. G2 worst page 0.146%, 0.388%, 0.560%, unchanged. Real-route files equal Node's in three browsers (E01, E02, E08, E11). |
| AC-P12-15 | PASS | X03, X04, X06, X07, E07, CE15. Real API: 202, and one log line `client_event export_failed photo_load <resume id> 1.1.0`. A search of the log for the fixture's names and text finds nothing (A04). |
| AC-P12-16 | PASS (Should) | A real `before_export` snapshot, shown in Version history, version unchanged (A03). A failure does not stop the export (X08). |
| AC-P12-17 | PASS | Emoji and CJK: `pdftotext` returns them, and the status names them (R13, and A06 of `export-actions.test.tsx`). PT Serif's gap letters print from bundled Roboto on real data (A07, `export-pt-serif.png`, `export-pt-serif-gaps.pdf`), and `pdftotext` returns "ŴALES ĲSSELMEER ЍОВО". |
| AC-P12-18 | PASS | Axe clean with buttons enabled, blocked and with options open, in three browsers, and on the real stack. Keyboard. No overflow at 390 px (E10, A01, A05, A06). |
| AC-P12-19 | PASS | No excluded control (E09). A click requests only the snapshot and the photo, same-origin (E09). PDFKit's chunk is absent before the first click (E01). `git diff main -- contracts` is empty. |

## Regression on the running system

NFR-02 stands: 12 library cards, 10 Mbit/s, cold, 10 runs, p95 1,354 ms; editor, four pages, p95 1,026 ms (was 957 ms in P11, under the same 2 s limit). NFR-01: keystroke p95 Chromium 66.5, Firefox 66.0, WebKit 86.0 ms; slider p95 73.1, 134.0, 216.0 ms; 122.6 ms at 4× CPU throttle. G3 and G4 stand on the laptop.

## Seen on the running system, beyond the tests

- Read T1 and T3 of the §9.4 CV as PDFs, and the top bar, blocked state, failure and library cards as screenshots. Layout, band, timeline and photo look right, and the top bar's reason and status lines wrap cleanly under the buttons.
- The two-line name in T1 wraps as the preview does, by construction.
- The empty box for a character no font has is small and plain. The status line is what tells the user about it.

## Open items, none blocking this phase

| Item | Owner | Note |
|---|---|---|
| G3, G4, NFR-01, NFR-03 on the reference CI runner; the rendering job's first run on GitHub | P15 | Needs a push. `bash scripts/ci/rendering.sh bench`. |
| Characters no bundled font has, such as emoji, CJK and most of Latin Extended-B | Owner, P15 decision table | They export as boxes, keep their text on copy, and are named to the user (DD-P12-07). The preview may substitute a system glyph there. |
| A crop under 195 px gives under 200 dpi | Owner, P15 decision table | DD-P12-12, DD-P07-06. |
| FR-PDF-08 is tagging without a PDF/UA validator | Owner, P15 decision table | DD-P12-09. |
| FR-ACC-04: PDFs and TXTs in the data archive | P13 | `exportPdf` writes a file per click; the archive needs the bytes. `runtime.writePdf` and `serializeTxt` are the pieces to use. |
| Cold-start 403 on first sign-up | P13 | From P10's report. The server was warmed here, so this says nothing about it. |
| `scripts/ci/security.sh` fails at gitleaks on a synthetic password | `main`, owner (DD-P10-18) | Already on `main`. Not re-run in this phase, whose suite does not include it. |
