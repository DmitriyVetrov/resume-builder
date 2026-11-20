# IMP-01 Acceptance

Walked on 2026-11-15 from the automated evidence in `test-results.md`. Branch `feat/cv-import`; the external
review closed at D1 with PASS (`code-review.md`). All data synthetic; no API key was used.

| ID | Pri | Result | Evidence |
|---|---|---|---|
| AC-IMP-01 extraction and layout on synthetic PDFs | Must | PASS | X-01…X-09 (tagged and untagged, one column, left and right sidebar, glyph bullets, drawn markers, a link, the photo candidate and a dropped banner), A-01…A-09, S-01, S-02. |
| AC-IMP-02 round trip T1–T4 | Must | PASS | R-01 on T1, T2, T3 and T4: name, headline, section titles in reading order, each paragraph in the extracted text, the fallback draft and the built document (strengthened after R1; a mutation proves the new assertions bite); T3 right sidebar, T4 left; R-02 deterministic. |
| AC-IMP-03 backend against the stub | Must | PASS | B-01…B-18, V-01…V-10, P-01…P-03; P13 matrix row (B-17); B-14 asserts the canary never reaches a log; backend job 370 passed. |
| AC-IMP-04 contract 1.2.0 | Must | PASS | P02 suite 67/67, reader `errors=0`; types regenerated; inventory guards extended (DD-IMP-25). |
| AC-IMP-05 builder over existing operations | Must | PASS | D-01…D-12: limits and clamping, placement, ADR-023 labels, "Jan – May 2026" → 2026-01…2026-05, `present`, `dateText`, T4/T3/T1 by layout with the template's design defaults (DD-IMP-18). |
| AC-IMP-06 E2E journey, axe, keyboard | Must | PASS | I-01 (Library → Import CV → painted preview and report → Create → editor with the name; `createResume` received the T4 document) and I-04 (axe clean on picker and review in light and dark; Create reachable by Tab), chromium, firefox and webkit; U-01…U-08, L-01. |
| AC-IMP-07 dropped images; no text layer | Must | PASS | X-07, D-11, U-02 ("1 image was not imported."); U-04 and I-03 (message, nothing sent). |
| AC-IMP-08 manual QA with the owner's key and the reference CV | Must | **OPEN** | Needs the owner's Anthropic key and the reference CV on this machine (handoff §8). Not run. |
| AC-IMP-09 live eval of ~20 synthetic CVs | Should | **OPEN** | Needs the owner's key. Not run. |
| AC-IMP-10 own TXT end to end | Should | PASS | T-01, T-02, I-02 (three browsers). |
| AC-IMP-11 DOCX | Could | NOT DONE | DD-IMP-14. |

Verdict: PASS for every criterion that can run without the owner's key; AC-IMP-08 (Must) and AC-IMP-09 (Should) are open until the key is provided.

Known limits:
- The live model is not exercised by any automated test; the stub provider answers `503 import_unavailable` for any source it has no recording for, so local and CI runs take the fallback path (DD-IMP-10).
- Layout analysis is heuristic (DD-IMP-11, DD-IMP-23). It was tuned on synthetic PDFs and our own T1–T4 exports; unusual foreign layouts may read in a different order. The user reviews everything before it is saved.
- Pre-existing, outside IMP-01: library E04 (26 px rename button) and editor E10 ("Title" now "Role"); webkit E01 flaky on `main` (1 in 10); the login specs fail only when a live API listens on `127.0.0.1:5080` (a `dotnet run` from 2026-11-13 was running and was left alone); gitleaks' P06 fixture hit; OSV `deepmerge` (via `shadcn`) and `fast-xml-parser` (contract tests, lock unchanged here).
