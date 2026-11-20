# P11 Acceptance Criteria

Observable criteria. "Painted" means positioned from the PageModel by `paintPage`; the browser chooses no line break.

| ID | Source | Pass when |
|---|---|---|
| AC-P11-01 | FR-PRV-01, FR-LAY-05 | The preview shows separate pages at the page size's proportions, with a visible gap, each numbered "1 / 3". A4 and Letter both. The "Draft view" label is gone. |
| AC-P11-02 | FR-PRV-02, NFR-04, NFR-14 | For ≥ 10 fixtures per template: PDF text per page and per line equals the PageModel; visual diff ≤ 1% at 100 dpi in Chromium, Firefox and WebKit with a negative control; model, PDF and TXT bytes identical in Node and the three browsers; two runs byte-identical. The text and positions painted by the **real editor route** equal the reference model. |
| AC-P11-03 | FR-PRV-03, FR-EDT-01, FR-LAY-10, NFR-01 | A keystroke and a slider step reach the painted page with p95 ≤ 300 ms on the 4-page fixture in Chromium and WebKit, measured through the real field and recorded. Firefox is reported. **Partial, DD-P11-15:** the reference runner stays with P15. |
| AC-P11-04 | FR-PRV-04 | The spacing card shows "3 pages", and it changes while a slider moves. |
| AC-P11-05 | FR-PRV-05 (Should) | Fit to N lowers line, entry, section spacing, then font preset, in that order, by the least that fits; or reports that it cannot and changes nothing. Content is never changed. One undo restores it. |
| AC-P11-06 | FR-PRV-06 | Fit width, 75%, 100%, 125% change the painted size and not the layout. 100% is true size. Fit width follows the panel. |
| AC-P11-07 | FR-PRV-07, PG-09 | An item longer than a page breaks by lines and shows an outline plus a text hint. A title left alone at a page bottom raises the safety-net hint. |
| AC-P11-08 | FR-PRV-08, FR-EDT-03, FR-EDT-04 | Selecting a section scrolls the preview so its first line lands within ±1 line of the scroller's top, at any zoom. A click selects the section; on an entry or list item it reveals that entry or item in the form; on the header it opens the header form. Enter and Space work on each section's single tab stop. The selection is shown not by colour alone. |
| AC-P11-09 | §8, ADR-010 §10 | Tests at page boundaries prove PG-01 to PG-09 on the engine, on all three templates where they apply, including a manual break on a section's first entry and the timeline start. |
| AC-P11-10 | ADR-024, ADR-025, FR-TPL-03, FR-TPL-04, FR-HDR-05, FR-HDR-06 | T2: contact chips with one icon per kind, item chips by default, columns on explicit choice, accent rule, no photo. T3: full-bleed band on page 1 only, round photo in it, white contacts, zones with placement defaults and overrides, document order per column. T1 → T2 → T1 restores the same model hash. PDF and preview paint all of it. |
| AC-P11-11 | FR-LIB-01, FR-TPL-02, ADR-010 §9, T-ID-06, NFR-02 | Library cards show page 1 of the real layout, for visible cards only, cached per user by version and engine version; a new version re-renders; "remove local data" clears them; another user never sees them. The picker's thumbnails are page 1 under each template. 12 cards load within 2 s p95 at 10 Mbit/s. Any failure keeps the placeholder. |
| AC-P11-12 | NFR-02, DD-P10-17 | A page that shows no resume loads no engine chunk and no font. The real web image answers `gzip` for JS, CSS and TTF. The editor loads within 2 s p95 at 10 Mbit/s. |
| AC-P11-13 | ADR-037 §4, NFR-13, ADR-038, contract | `POST /client-events` answers as frozen: 202, 400, 401, 403, 413, 415, 429. A log line holds only type, code, resume ID and engine version. The client reports the 422 cases and preview failures once per page load, and a failed report is invisible to the user. |
| AC-P11-14 | FR-LAY-09, DD-P10-11 | Hyphenation decision recorded with its evidence (DD-P11-13). E22 checks the strings as typed, spaces included. |
| AC-P11-15 | NFR-06 | Axe is clean on the preview for each template in three browsers. Toolbar and section buttons are reached by Tab with a visible ring. No page overflow at 390 px and at 200%. |
| AC-P11-16 | §3.2, NFR-09, rule 03 | Nothing excluded is built. No request leaves the origin. A link in the preview is not an anchor, so an unsafe URL cannot be followed. Engine or font failure shows a recoverable message, with Retry, and editing still works. `git diff main -- contracts` is empty. |
