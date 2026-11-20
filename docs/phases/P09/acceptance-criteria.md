# P09 Acceptance Criteria

Must criteria unless marked (W, explicitly not built). Each is checked against the running system in `qa-report.md`.

| ID | Source | Observable criterion |
|---|---|---|
| AC-P09-01 | FR-RTE-01 | Bold, italic and underline apply and clear by toolbar and by Ctrl/Cmd+B, I, U. Buttons report their state. The saved AST and the preview show them. |
| AC-P09-02 | FR-RTE-02 | A plain first paragraph followed by bullets works in one field and is stored as a paragraph and a one-level `bulletList`. Enter on an empty bullet returns to a paragraph. Toggling converts in both directions. |
| AC-P09-03 | FR-RTE-03, R-6 | Select text, Link, URL creates a link, and it can be edited and removed. `javascript:` and other schemes are refused with a field error. A bare domain gets `https://`. Focus returns to the text. |
| AC-P09-04 | FR-RTE-04 | Paste from Word, Google Docs and web HTML keeps bold, italic, underline, safe links, paragraphs and list items, and drops fonts, colours, sizes, images, tables' structure, scripts and styles. Word's fake lists and Docs lists become bullets. |
| AC-P09-05 | FR-RTE-05 | Ctrl/Cmd+Z in a field undoes the last burst, Ctrl/Cmd+Shift+Z redoes it, the caret stays in the field, and typing continues correctly. Format and link actions are their own steps. The top-bar buttons act on the same stack. |
| AC-P09-06 | FR-RTE-06 | Shift+Enter inserts a line break inside a paragraph, stored as `lineBreak`. |
| AC-P09-07 | FR-RTE-07 (W) | There is no way to enter numbered lists, nested lists, headings, colours or font sizes: the UI has no control, and paste flattens them. |
| AC-P09-08 | FR-RTE-08 | Every text field and editable has native spell check on, and no own service exists. |
| AC-P09-09 | §10.2, R-3, R-5, R-6 | Unit: `docToAst(astToDoc(x)) = normalize(x)` for the corpus and 500 seeded documents; `normalize` is idempotent and keeps plain text; output always satisfies the contract's AST rules. Opening a document causes no write. |
| AC-P09-10 | PHASE.md | The corpus round-trips through the real API as equal JSON, and a document typed in the real browser saves and reloads with its formatting. |
| AC-P09-11 | T-ID-11 | XSS fixtures in rich text and paste do not execute, no `dangerouslySetInnerHTML` exists in `frontend/src`, and the preview renders AST text as text. |
| AC-P09-12 | §5.6, R-3 | `text` and descriptions allow paragraphs and bullets. `inline` stays one paragraph. A `list` item stays one line; Enter adds the next item, and pasted lines become items. |
| AC-P09-13 | NFR-06, NFR-07 | All toolbar actions work by keyboard, Tab leaves the field, the field has a name and `aria-multiline`, and axe finds no violation in three browsers. Spanish, Ukrainian, Slovak and emoji text survives typing, formatting and reload. |
