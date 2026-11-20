# P09 Architecture Plan — Rich Text Engine

- Operator session, ADR-051, batch P08+P09 on branch `phase/P08+P09`, 2026-11-05. Tier: Claude Opus, effort `high`.
- Dependencies: P08, in this batch; its steps 4–5 run first.
- Contract: 1.0.0 unchanged. The AST is `RichText`, `Block`, `Paragraph`, `BulletList`, `RichTextInline`, `Inline`, `TextRun`, `Link`, `LineBreak` (TECHNICAL-SPEC §10.2). P02 §9.4: an AST change would be a contract change, and none is needed.
- UI: [ui-ux-design.md](ui-ux-design.md). Decisions: [decisions.md](../decisions.md). Engine: [ADR-052](../../../blueprint/decisions/ADR-052-rich-text-engine.md).

## Scope

| Source | P09 responsibility | Acceptance |
|---|---|---|
| FR-RTE-01 | Bold, italic, underline, shortcuts | AC-P09-01 |
| FR-RTE-02 | One-level bullets mixed with paragraphs | AC-P09-02 |
| FR-RTE-03, R-6 | Link dialog: add, edit, remove; URL allow-list | AC-P09-03 |
| FR-RTE-04 | Paste from Word, Google Docs and the web keeps only what the AST can hold | AC-P09-04 |
| FR-RTE-05, DD-P08-03 | Undo and redo in the field through the document stack | AC-P09-05 |
| FR-RTE-06 | Shift+Enter | AC-P09-06 |
| FR-RTE-07 (W) | Nothing else can enter the document | AC-P09-07 |
| FR-RTE-08 | Native spell check in all text fields | AC-P09-08 |
| §10.2, R-3, R-5, R-6 | Canonical AST, parser and serializer | AC-P09-09, 10 |
| T-ID-11 | Rich text is never HTML outside the editor; XSS fixtures | AC-P09-11 |
| §5.6 | `text`, `inline`, `list` and entry description field variants | AC-P09-12 |
| NFR-06, NFR-07 | Toolbar and field keyboard behaviour, Unicode | AC-P09-13 |

Out of scope: layout and PDF rendering of the AST (P11, P12), the TXT serializer (P12), link colour in T1 (P10, D-18).

## Component boundaries

**`entities/resume/rich-text.ts`** — pure and DOM-free (P11 and P12 import it, F-FE-3): AST type aliases, `normalizeBlocks`, `normalizeInlines`, `plainText`, `codePointLength`. **`entities/resume/safe-url.ts`:** `normalizeUrl`, `isSafeUrl`.

**`features/editor/rich-text/`**:
- `schema.ts` — the ProseMirror schema: `block` and `inline` documents, marks `bold`, `italic`, `underline`, `link`; nodes `paragraph`, `bullet_list`, `list_item` (inline content), `hard_break`.
- `convert.ts` — `astToDoc`, `docToAst`. The only bridge between AST and engine.
- `commands.ts` — `toggleBullets`, `enterKey`, `backspaceKey`, link commands. Pure over `EditorState`.
- `clipboard.ts` — `htmlToBlocks`, `plainTextToBlocks`: read clipboard content in an inert document and build the AST through an allow-list walker.
- `RichTextField.tsx` — controlled by `value` and `onChange`. Owns the `EditorView`. Toolbar, link dialog. An external value change is applied as a minimal replace found with `findDiffStart` and `findDiffEnd`, which keeps the caret sensible after undo.

**P08 seam replaced:** the plain `textarea` field used by P08's forms until this phase. The preview's `RichTextView` (React text nodes) and `safe-url.ts` came with P08, which needed them first; their tests are here.

**Backend:** no production change. One test feeds the shared corpus through the real API.

## Key semantics

- **Canonical form.** No empty runs; adjacent runs with equal marks merged; adjacent links with an equal URL merged; a lone empty paragraph in a `text` or description field equals `[]`. `docToAst(astToDoc(x)) = normalize(x)`, `normalize` is idempotent, and it never changes the plain text.
- **No write on load.** The field only emits on a transaction that changed the document, so opening a document never bumps its version, even if it was stored non-canonically.
- **Variants.** `block`: paragraphs and bullets, used by `text` and descriptions. `inline`: one paragraph, Enter does nothing, Shift+Enter breaks a line, used by `inline`. `line`: one line in a `list` item; Enter adds the next item, Shift+Enter does nothing, and a multi-line paste becomes several items (FR-RTE-04).
- **Paste.** `handlePaste` reads `text/html`, else `text/plain`, through the allow-list walker. It handles Word's `mso-list` paragraphs and conditional comments, Google Docs' `font-weight:normal` `<b>` wrapper and CSS-only styling, nested lists (flattened), ordered lists (bullets), headings and tables (paragraphs), and scripts, styles and images (dropped). A link with a scheme outside the allow-list keeps its text and loses the link.
- **Undo.** No engine history plugin; every change goes to the document stack (DD-P08-03). Bursts coalesce per field; a format, link, paste or structure action is its own step.

## Risks

| Risk | Handling |
|---|---|
| An engine round trip loses or reorders content | Shared corpus plus a seeded property test over generated ASTs, in unit tests; the same corpus through the real API |
| Paste differs by source | Real captured-shape fixtures for Word, Google Docs and the web; hostile fixtures |
| jsdom cannot exercise caret or composition | Commands are tested on `EditorState`; typing, IME-free caret, shortcuts and paste run in three real browsers |
| Undo moves the caret badly | Minimal diff on the external value change; E2E continues typing after undo |
| New dependency surface | ADR-052: pinned exact versions, OSV scan via the security job, MIT, no CDN |

## Slices and test budget

Vitest ≤ 60 cases (corpus rows counted once per file), E2E ≤ 10 scenarios per browser in `tests/e2e/rich-text.spec.ts`, backend ≤ 3 cases in `P09RichTextRoundTripTests`. The property test is one case over 500 seeded documents.

| # | Slice | Depends on |
|---|---|---|
| 1 | AST functions, URL rules | — |
| 2 | Schema, converters, commands | 1 |
| 3 | Clipboard reader | 1 |
| 4 | `RichTextField`, toolbar, link dialog, three variants wired into P08's forms | 2, 3 |
| 5 | API round trip | 1 |

## Task list

1. Add the pinned engine dependency; declaration seams; tests; red evidence.
2. Implement slices 1–5; narrow tests continuously; `docs/phases/P09/tests/suite.cmd`.
3. Steps 6–8 run once for the batch with P08.

## Allowed paths

- `docs/phases/P09/**`
- `frontend/src/**`
- `frontend/package.json`
- `frontend/package-lock.json`
- `frontend/README.md`
- `tests/e2e/**`
- `tests/fixtures/rich-text/**`
- `backend/tests/ResumeBuilder.Api.Tests/**`
