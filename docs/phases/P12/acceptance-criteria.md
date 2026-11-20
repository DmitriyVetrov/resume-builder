# P12 Acceptance Criteria

Observable criteria. "Real route" means the Vite build driven in a browser, not the rendering bundle.

| ID | Source | Pass when |
|---|---|---|
| AC-P12-01 | FR-PDF-01, FR-EDT-06 | One click on "Export PDF" in the top bar downloads a PDF. No dialog opens, and no e-mail or share control exists. |
| AC-P12-02 | FR-PDF-02, NFR-07, G5 | `pdffonts` lists every font as an embedded subset with a Unicode map. `pdftotext` returns typed Spanish, Ukrainian and Slovak text, ligatures included, on each of the three families. |
| AC-P12-03 | FR-PDF-03, FR-HDR-04, FR-RTE-03 | Contact items and rich-text links are annotations with the right URL, and each rectangle covers its text. `@handle` gets none. `javascript:` and `data:` never reach an annotation. |
| AC-P12-04 | FR-PDF-04, FR-LAY-02, FR-LAY-03, §8 | Page size is A4 or Letter from the settings. Margins from the settings bound the text. In the PDF, the space above a section title follows `10 + v` and between entries follows `v`, within ±0.5 pt. **Closes AC-P10-08's PDF clause.** |
| AC-P12-05 | FR-PDF-05 | `pdfinfo` shows Title = full name + headline, Author = full name, Creator = Resumiser, in non-Latin text too. The catalog's `/Lang` is the resume language. |
| AC-P12-06 | FR-PDF-06, FR-TXT-01 | "SWE-Dmytro-Vietrov" → `SWE-Dmytro-Vietrov.pdf`. Spaces become `-`. Letters, digits, `-`, `_`, `.` stay, Unicode letters included. Nothing can make a path step or a hidden file. An empty result has a fallback. TXT uses the same name with `.txt`. |
| AC-P12-07 | FR-PDF-07 | Real stack: the rendition's bytes appear unchanged in the PDF, as a JPEG at ≥ 200 dpi for its box, with quantization tables of quality ≥ 85. A failed photo fails the export visibly. |
| AC-P12-08 | FR-PDF-08 (Should) | `pdfinfo` reports `Tagged: yes`. The structure tree holds H1, H2, H3, L/LI/LBody, Figure, Link in document order on each template, across a page boundary. Decoration is not in it. |
| AC-P12-09 | FR-PDF-09, FR-PDF-10, NFR-03 | A 4-page resume with a worst-case 600 px photo is ≤ 1 MB. Through the real route, click to file: PDF p95 ≤ 5 s and TXT p95 ≤ 1 s, in Chromium and WebKit, Firefox reported. **Partial by DD-P12-16: development laptop.** |
| AC-P12-10 | FR-TXT-02…04, FR-TXT-07, §9 | §9.4 reproduces byte for byte from a fixture. All twelve fixtures match goldens. UTF-8 without BOM, LF, no tab, no trailing space, as typed. Section order equals the PDF's tag order, no visible non-empty section is missing, hidden and empty ones are absent. |
| AC-P12-11 | FR-TXT-05, FR-TXT-06 (Should) | The option gives CRLF on every line in the file, and it persists per user. "Copy as text" writes the same content to the clipboard and reports failure. |
| AC-P12-12 | FR-TYP-03, ADR-013 | With no full name, or an unverified address, the buttons stay focusable, produce nothing, and show what is missing, with a way to fix it. Adding the name or verifying enables them, with no reload. |
| AC-P12-13 | FR-LIB-06 (Should) | Each active card exports PDF and TXT, with the same bytes as the editor for the same version. Trash cards do not. |
| AC-P12-14 | FR-PRV-02, NFR-04, NFR-14, ADR-010 §3, §7 | G1, G2, G5, G6, G7 still pass on all cases with the tagged writer. PDF and TXT downloaded through the real route equal Node's bytes in Chromium, Firefox and WebKit. Two clicks give the same bytes. |
| AC-P12-15 | NFR-13, ADR-010 §8 | A differing preview raises `export_mismatch` with `page_count.differs` or `line_breaks.differs`. Failures raise `export_failed` with a listed code. The server logs the code, with no content. |
| AC-P12-16 | FR-PER-05 (Should) | Each file export sends one `createSnapshot` with `before_export`. Its failure does not stop the export. The version does not change. The snapshot shows in Version history. |
| AC-P12-17 | NFR-07, P11 carry-in | Emoji and CJK: the export succeeds, `pdftotext` returns the typed characters, and the status names them. TXT keeps them. On PT Serif, Latin-1, Latin Extended-A and basic Cyrillic all print, through the fallback of DD-P12-22 (changed from "reported" by the external review, a stricter criterion). |
| AC-P12-18 | NFR-05, NFR-06, FR-EDT-07 | Axe is clean with the export controls in each state, in three browsers. Everything works by keyboard. No page overflow at 390 px. |
| AC-P12-19 | §3.2 X7, X9, ADR-010 §5 | No wizard, DOCX, e-mail or share control. The only requests an export makes are the snapshot and the photo, same-origin. The PDFKit chunk is not requested before the first click. `git diff main -- contracts` is empty. |
