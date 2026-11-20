# P09 QA / Acceptance Report — Rich Text Engine

Verdict: PASS

- Run by the operator session on 2026-11-05, in the same pass and on the same running system as [P08's report](../P08/qa-report.md): real API, Mongo and Azurite behind the same-origin proxy, real Chromium. `R01` and `R10` drive rich text; Firefox and WebKit ran `rich-text.spec.ts` on the fixture API.
- Screenshots: [P08 qa-evidence](../P08/qa-evidence/) (`workspace-rich-text-*`, `rich-text-link-dialog-1280.png`, `list-item-compact-toolbar-*`).

## Acceptance matrix

| ID | Result | Evidence on the running system |
|---|---|---|
| AC-P09-01 | PASS | Ctrl+B typed text, stored as `bold: true`, computed weight 700 in field and draft (R01). Toolbar pressed state and all three marks: `T01`. |
| AC-P09-02 | PASS | A paragraph then a bullet stored as `paragraph` and `bulletList` (R01). Enter out of a list and toggling back: `T02`. |
| AC-P09-03 | PASS | `javascript:alert(1)` refused with a field error; `example.invalid/x` stored as `https://example.invalid/x`; focus back in the field (R10). Edit and remove: `T03`. |
| AC-P09-04 | PASS | Word, Google Docs, web and hostile clipboard fixtures through a real `paste` event and the real API: stored JSON equals the expected AST for each (R10). Fonts, colours, images, table structure, scripts and styles gone. |
| AC-P09-05 | PASS | Ctrl+Z removed the line break and kept the link, stored (R10). Bursts, caret and format steps: `T05`. |
| AC-P09-06 | PASS | Shift+Enter stored as `lineBreak` (R10, `T06`). |
| AC-P09-07 | PASS | No control for numbered or nested lists, headings, colours or sizes. `<ol>`, nested `<ul>`, `<h2>` and CSS flattened in the stored result (R10, web fixture). |
| AC-P09-08 | PASS | `spellcheck="true"` on every text input and editable, walked per section (`T09`). No spell service exists. |
| AC-P09-09 | PASS | Unit: corpus and 500 seeded documents in `block`, and 500 in `line` and `inline` (`R01`–`R03`). A reload of a stored document wrote nothing: version unchanged after 1.2 s (R10, `T10`). |
| AC-P09-10 | PASS | Corpus through the real API, equal JSON (`P09RichTextRoundTripTests.T01`, real Mongo). Typed in a real browser and read back (R01, R10). |
| AC-P09-11 | PASS | Hostile paste ran nothing and requested nothing from a pasted host, in three engines (`T08`, R10). `S01`: no raw HTML sink in `frontend/src`. Hostile stored text shows as text in field and draft (`T08`, `V02`). |
| AC-P09-12 | PASS | List Enter adds an item, pasted lines become items, an inline section stays one paragraph (`T07`). The list and inline forms opened on the real stack with no axe violation (R07). |
| AC-P09-13 | PASS | Toolbar by keyboard, Tab leaves, axe with the toolbar and dialog (`T10`). Spanish, Ukrainian, Slovak and emoji stored exactly (R10). **No manual screen-reader pass was run;** P14 owns that audit. |

## Defects found in this pass

The stale-selection text loss recorded in P08's report as defect 1 is in this phase's field. Fixed, `T02b`.

## Deviations from the design

Bold looks regular in the screenshots only, as P08's report explains.

## Deferred, by plan

Rendering of the AST in the real layout and PDF (P11, P12), the TXT serializer (P12), link colour in T1 (P10, D-18).
