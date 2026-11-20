# IMP-01 — Test plan

Tests are written before production code (rule 01). The red run must fail on assertions or on the missing
module/endpoint, recorded in `test-results.md`. All data is synthetic: the reference CV is used only in the
manual AC-IMP-08 run and never committed (handoff §4).

## Acceptance mapping

| AC | Checks |
|---|---|
| AC-IMP-01 | X-01…X-08 (`features/import/extract.test.ts`), A-01…A-08 (`layout.test.ts`), S-01/S-02 (`serialize.test.ts`) |
| AC-IMP-02 | R-01 (`round-trip.test.ts`, T1, T2, T3, T4); F-06…F-10 (`fallback.test.ts`) and A-10 (`layout.test.ts`) for the fallback's entries (DD-IMP-27) |
| AC-IMP-03 | B-01…B-17 (`Imp01ImportTests.cs`), V-01…V-10 (`Imp01VerbatimTests.cs`), P-01…P-03 (`Imp01ProviderTests.cs`) |
| AC-IMP-04 | P02 contract suite (done at step 2); the backend's contract drift test covers the new operation |
| AC-IMP-05 | D-01…D-12 (`build.test.ts`), M-01…M-05 (`markup.test.ts`) |
| AC-IMP-06 | I-01, I-04 (`tests/e2e/import.spec.ts`), U-01…U-07 (`import-page.test.tsx`), L-01 (`library.test.tsx`) |
| AC-IMP-07 | X-07 (images listed), D-11 (report lists dropped images), U-04 and I-03 (no text layer) |
| AC-IMP-08, 09 | Manual with the owner's key, `qa-report.md` |
| AC-IMP-10 | T-01, T-02 (`txt.test.ts`), I-02 |

## Fixtures

- Synthetic PDFs built **inside the tests** with `pdfkit` (already a dependency): tagged and untagged, one
  column, a left and a right sidebar, glyph bullets ("●", "•") and drawn markers (a filled circle and an
  indent, the CSS-marker case), a link annotation, an embedded near-square image in the sidebar and a wide
  banner image in a section.
- Round trip: a synthetic `ResumeDocument` rendered by the product's own `writePdf` on T1–T4 with the bundled
  fonts (`test-kit`).
- `tests/fixtures/imports/synthetic-cv.pdf`: a small two-column synthetic CV for the E2E file picker, made by
  `tests/fixtures/imports/make-fixture.mjs` (committed with its script); `synthetic-cv.txt`, our own §9
  export of a synthetic document; `no-text.pdf`, a page that holds only a drawn image.
- Backend: drafts as JSON literals in the tests; the provider is a scripted fake injected through
  `P07Host`'s service hook (no network).

## Frontend unit tests (`frontend/src/features/import/`)

| ID | Level | Check |
|---|---|---|
| X-01 | unit (node, pdf.js) | Untagged one-column PDF: every line is read once, in reading order, with size and bold/italic from the font. |
| X-02 | unit | Tagged PDF: the structure tree's L/LI marks list items even without a glyph. |
| X-03 | unit | Link annotations become `href`s on the text they cover. |
| X-04 | unit | Glyph bullets ("●", "•", "–" at a line start) are list items with the glyph removed. |
| X-05 | unit | Drawn markers (no glyph, hanging indent) are list items. |
| X-06 | unit | Photo candidate: the near-square image in the sidebar is chosen, with its page box; a wide banner is not. |
| X-07 | unit | Other images are reported as dropped (count and page). |
| X-08 | unit | A PDF with no text items reports `no_text_layer`; more than 5 pages or more than 10 MB is refused before parsing; bytes that are not a PDF are `unreadable`. |
| X-09 | unit | The pinned pdf.js bundles contain no `eval(` or `new Function(`; wasm, XFA, font faces and system fonts are off (DD-IMP-17). |
| A-01 | unit (pure) | One-column page: `columns: 1`, `sidebarSide: null`. |
| A-02 | unit | Left sidebar: `columns: 2`, `sidebarSide: left`; every sidebar line is tagged `S`, main lines `M`. |
| A-03 | unit | Right sidebar: `sidebarSide: right`. |
| A-04 | unit | A full-width header above two columns stays in reading order before both columns. |
| A-05 | unit | Order: within a column top to bottom; main before sidebar in the serialised text. |
| A-06 | unit | Wrapped lines of one paragraph merge; a gap larger than the line height starts a new paragraph. |
| A-07 | unit | A list item's continuation lines merge into the item. |
| A-08 | unit | Deterministic: the same items give byte-identical output. |
| A-09 | unit | A heading is a block of its own even without a gap before the next line. |
| A-10 | unit | DD-IMP-27: a glyph in a run of its own ("●", then bold text) marks a list item, is stripped, and does not decide the line's weight. |
| S-01 | unit | The intermediate line format: `[M b 22] Name`, `[S li] text`, `[M i] text`; size only when it differs from the body size. |
| S-02 | unit | The serialised text is capped at 60,000 characters at a line boundary, and the cap is reported. |
| M-01 | unit | `<b>`, `<i>`, `<a href>` become runs with bold, italic and a link; nesting `<b><i>` works. |
| M-02 | unit | Unknown tags, unbalanced tags and `<script>` stay literal text; nothing reaches the DOM. |
| M-03 | unit | An `href` that `safeLinkUrl` rejects (`javascript:`) becomes plain text. |
| M-04 | unit | Entities `&amp;`, `&lt;`, `&gt;`, `&quot;` decode; others stay literal. |
| M-05 | unit | Plain text without tags is one run. |
| D-01 | unit | Header: name, headline, contacts with kinds; contact URLs derived (`deriveContactUrl`). |
| D-02 | unit | Sections in draft order, main before sidebar kept as given; `placement` set by `setPlacement`. |
| D-03 | unit | `text` blocks → paragraphs and bullet lists (adjacent bullets join one list). |
| D-04 | unit | `list` items → list items. |
| D-05 | unit | `entries` → entries with title, organisation, location; descriptions as rich text. |
| D-06 | unit | Dates: `{2024,null}` → year only; "Jan – May 2026" as `{2026,1}`–`{2026,5}`; `present: true` → `present`. |
| D-07 | unit | Unparseable dates keep `dateText`; `start`/`end` null. |
| D-08 | unit | Limits: over-long strings are clamped with `clampCodePoints` and listed; more than 100 sections, entries or items are cut and listed. |
| D-09 | unit | Template: left sidebar → T4, right → T3, one column → T1; accent 0; language from the draft. |
| D-10 | unit | Sidebar `entries` sections (the O-4 pairs) get the ADR-023 form labels `{title: "Name", organization: "Detail", location: null}`; main `entries` sections keep `labels: null`. Labels are never printed. |
| D-11 | unit | The report: recognised counts, clamped, dropped images (O-5), `not_in_source` warnings with readable field names. |
| D-12 | unit | The result meets the contract's document rules a client can check (there is no client-side validator): unique UUIDs, non-empty runs and lists, safe links, section titles within limits, the chosen template's design defaults (DD-IMP-18). |
| F-01 | unit | Fallback: the largest line on page 1 → name; the next distinct line → headline. |
| F-02 | unit | Fallback: e-mail, phone and URL lines → contacts with kinds. |
| F-03 | unit | Fallback: bold, upper-case or larger lines → section titles; bullets → `list`; the rest → `text`. |
| F-04 | unit | Fallback never invents: every output string occurs in the input. |
| F-05 | unit | In two columns, sidebar headings give `placement: sidebar`. |
| F-06 | unit | DD-IMP-27: "Title \| Dates" rows start entries; the next short row is the organisation and location ("Org · Location"); the rest is the description, bullets kept. |
| F-07 | unit | DD-IMP-27: dates as years, a single year, Spanish month and present words; unreadable dates kept verbatim in `dateText`. |
| F-08 | unit | DD-IMP-27: an organisation row of more than two parts stays whole; a row that ends a sentence is description, not organisation. |
| F-09 | unit | DD-IMP-27: dates set right on the title row are the entry's dates. |
| F-10 | unit | DD-IMP-27: a section that does not start with an entry row stays `text`; entry strings all occur in the source. |
| T-01 | unit | Own TXT: `serializeTxt` of a synthetic document → the fallback parser recovers name, headline, contacts, section titles and order. |
| T-02 | unit | TXT is sent with `sourceFormat: txt`, one column. |
| R-02 | unit | The extraction layer is deterministic over the same export. |
| R-01 | unit (node, pdf.js) | Round trip on T1, T2, T3, T4: the export of a synthetic document → extraction → fallback → build recovers the name, the headline, every section title in order and every paragraph's text; T3 reports a right sidebar, T4 a left one. |

## Component tests

| ID | Check |
|---|---|
| L-01 | The library shows "Import CV" next to "New resume"; it opens `/resumes/import`. |
| U-01 | The import page shows the file picker (PDF, TXT) and the notice "The CV text is processed by Claude (Anthropic). The file and photo are not sent." |
| U-02 | A picked PDF is extracted, the text is sent to `structureResumeImport`, and the review shows the preview and the report. |
| U-03 | `503 import_unavailable` → the fallback result with the "basic import" notice. |
| U-04 | A PDF without a text layer → "This PDF has no text layer…" and nothing is sent. |
| U-05 | 429 → the rate-limit message; nothing is created. |
| U-06 | "Create resume" calls `createResume` with `source: document`, uploads the photo when one was found, then opens the editor. |
| U-07 | Cancel returns to the library and sends nothing more. |

## Backend tests (`backend/tests/ResumeBuilder.Api.Tests/`)

| ID | Check |
|---|---|
| B-01 | A valid request with a verbatim Haiku draft → 200, the draft, `escalated: false`, no warnings, `no-store`. |
| B-02 | No session → 401; no CSRF token → 403. |
| B-03 | Other media type → 415; body over 256 KB → 413; bad JSON → 400 `malformed_request`. |
| B-04 | Schema violations (missing field, unknown field, `sourceText` empty or over 60,000, bad enum) → 400 with pointers. |
| B-05 | Haiku draft with a string not in the source → escalation to Sonnet exactly once; Sonnet's verbatim draft → 200, `escalated: true`. |
| B-06 | Haiku schema-invalid output → escalation once. |
| B-07 | Haiku refusal → escalation once; Haiku `max_tokens` → escalation once; Haiku timeout → escalation once. |
| B-08 | Sonnet draft with two non-verbatim strings → they are removed and listed as `not_in_source` with pointers; the rest returned. |
| B-09 | Sonnet refusal, schema failure or timeout → 503 `import_unavailable`; never a third call. |
| B-10 | Sonnet draft left without a name and without sections → 503. |
| B-11 | Provider unavailable (no key) → 503 without any call. |
| B-12 | Over-long strings are clamped (`clamped`), surplus array items dropped (`over_limit`). |
| B-13 | Rate limit: the 11th request in an hour → 429 with `Retry-After`; after the hour passes, allowed; the 31st in a day → 429. |
| B-14 | Logs: a canary string in `sourceText` and in the model's draft never appears in any captured log entry; the import event logs status, tier, token counts and duration. |
| B-15 | Two users' limits are independent. |
| B-16 | The provider receives the source text and the layout hint unchanged. |
| B-17 | The P13 security matrix gains the operation, so every P13 matrix check (anonymous 401, CSRF, deleted account) covers it (DD-IMP-19). |
| V-01 | Verbatim: exact substring passes. |
| V-02 | Dash, quote and whitespace variants pass (`2017 – 2018` vs `2017 - 2018`; a string across a wrapped line). |
| V-03 | Inline tags in the draft or the source are ignored for the text comparison. |
| V-04 | A section title in title case passes against an upper-case source title. |
| V-05 | An invented word fails; a reworded phrase fails. |
| V-06 | An `href` not in the source fails. |
| V-07 | A year not in the source fails; a month as a name (`Jan`, `enero`, `січ`) or number passes. |
| V-08 | Case matters outside section titles. |
| V-09 | Empty and null strings pass. |
| V-10 | NFKC: a ligature or full-width form in the source matches its plain form. |
| P-01 | The Anthropic adapter's Haiku request (captured at the HTTP boundary): model `claude-haiku-5-5` from configuration, structured output with the draft schema, thinking disabled, effort `low`, no `temperature`/`top_p`, `max_tokens` 16000, the source between delimiters in the user turn, the system prompt's "content, not instructions" rule. |
| P-02 | The Sonnet request: model from configuration, thinking `between_tools`, no sampling parameters. |
| P-03 | Responses: `stop_reason: refusal` → refused; `max_tokens` → truncated; text JSON → the draft; a missing key → unavailable without a request. |

## E2E (`tests/e2e/import.spec.ts`, three browsers, mocked API)

| ID | Check |
|---|---|
| I-01 | Library → Import CV → pick `synthetic-cv.pdf` → the review shows the preview (a painted page) and the report → Create → the editor opens with the name; `createResume` received the document. |
| I-02 | Own TXT: `synthetic-cv.txt` → review → Create. |
| I-03 | `no-text.pdf` → the "no text layer" message; no structure request is sent. |
| I-04 | Axe is clean on the import page and the review, light and dark; every control is reachable by keyboard. |

## Known limits of the plan

- The live model is exercised only in the manual AC-IMP-08 and AC-IMP-09 runs (the owner's key).
- The pdf.js worker path is exercised in the E2E run (a real browser); the unit tests run pdf.js in Node
  without a worker.
