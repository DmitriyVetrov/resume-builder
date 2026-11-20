# TPL-01 Acceptance

Walked on 2026-11-15 from the automated evidence in `test-results.md` and the AC-TPL-09 side-by-side
comparison (reference CV and the synthetic mirror in T4 at 70 dpi, `/tmp/tpl01-qa/side-by-side.png`, outside the
repository per DD-TPL-12). Branch `feat/template-t4`; the external review closed at D1 (`code-review.md`).

| ID | Result | Evidence |
|---|---|---|
| AC-TPL-01 T4 defined, every field tested | PASS | T-01…T-06, L-01…L-17, updated D01; `npx vitest run` 51 files, 549 passed. |
| AC-TPL-02 T1–T3 byte-identical | PASS | G-01 (golden taken on `main` before any engine edit) green after every engine change, including the R1 fix; R-02: all 43 T1–T3 gate labels (model, PDF, TXT, pages) equal `main`'s; Y10 T1–T3 page screenshots match unchanged. |
| AC-TPL-03 T4 rendering cases | PASS | 15 T4 gate cases including `panel-mirror-T4` (one page) and `panel-mirror-long-T4` (two pages, sidebar continuation, panel on page 2), L-09. |
| AC-TPL-04 preview equals PDF | PASS | `bash scripts/ci/rendering.sh` exit 0 after the R1 fix: reference (G1, G5, G6) and export checks PASS, G7 24 passed (four templates × three browsers), G2 worst 0.560 %. |
| AC-TPL-05 contract and backend | PASS | Contract suite: everything passes except AC-P02-12, whose oasdiff report is exactly the expected pre-release break for `T4` (DD-TPL-14; passes on `main` after the merge). Backend job: Api 315 passed, including B-01a/b and Ce16 `1.2.0`. |
| AC-TPL-06 four thumbnails, lossless switch, placement | PASS | C01/C02, Y01; E-01 (T1 → Panel → Sidebar → T1 restores the painted page), E-02 (placement control under Panel), E-03 and Y09 (axe on Panel, light and dark), in three browsers. |
| AC-TPL-07 contrast | PASS | T-03 over every accent preset, on white and on the panel, plus muted text on every panel. |
| AC-TPL-08 PDF reading order, text, links | PASS | L-12 (header, figure, then sections in document order, T3's rule, DD-TPL-04), L-13 (link rectangles); G1/G5 on the T4 cases (selectable text, embedded fonts). |
| AC-TPL-09 side-by-side (Should) | PASS | Operator verdict: structure, colours, the left panel, the split header, uppercase titles with rules and the entry arrangement match the reference closely. Differences: a larger gap after the headline (the untitled summary still gets section spacing), the date separator (` - ` from the shared date formatter against the reference's en dash), and Roboto's wider set against Helvetica Neue, which DD-TPL-18 compensates. |
| AC-TPL-10 mirror fits one A4 page (Should) | PASS | L-14. |

Verdict: PASS

Known limits:
- A T4 header half longer than page 1 breaks between lines and raises the oversized hint (PG-09 over PG-06, ADR-010 §10, DD-TPL-19). This is the same fallback T1–T3 have.
- Pre-existing failures on `main` since the owner's UX commit `1d405e3`, outside TPL-01 and not fixed here: library E04 (the inline-rename title button is a 26 px target, under 32 px) × 3 browsers × 3 widths, and editor E10 (it looks for an entry field labelled "Title", which is now "Role") × 3 browsers. When the host-network E2E container runs, the committed `vite.config.ts` proxy sends unrouted fixture calls to any live API on `127.0.0.1:5080`, so the login specs fail too. In an isolated network they pass.
