# ADR-052 — Rich text editing engine

- Status: **Accepted** (`DELEGATED-DEFAULT`, ADR-051 S-5)
- Decider: Operator (delegated, ADR-051)
- Date: 2026-11-05 (P09, decisions.md DD-P09-01)
- Source IDs: FR-RTE-01…08; TECHNICAL-SPEC §10.2; NFR-05, NFR-06, NFR-07; T-ID-11; ADR-003; ADR-010

## Context

§10.2 stores rich text as a closed, format-neutral tree, not HTML. The editor needs selection-aware formatting, one-level lists mixed with paragraphs, links, paste that keeps only supported formatting, native spell check and keyboard accessibility in Chrome, Edge, Firefox and Safari. Browser `contentEditable` alone produces different DOM per browser, and `document.execCommand` is deprecated.

## Decision

1. Use **ProseMirror directly**: `prosemirror-model`, `prosemirror-state`, `prosemirror-view`, `prosemirror-commands`, `prosemirror-keymap`, pinned to exact versions in `frontend/package.json` and bundled, never from a CDN.
2. The **schema is closed and equals the AST**: nodes `paragraph`, `bullet_list`, `list_item` (inline content only), `hard_break`, `text`; marks `bold`, `italic`, `underline`, `link`. Nothing else can exist in the editor state.
3. **The engine stays inside `features/editor/rich-text/`.** The document model, the stored form and every consumer (preview, layout, PDF, TXT) use only the contract AST. `convert.ts` is the one bridge, so the engine can be replaced without touching stored data or other phases.
4. **No engine history plugin.** Undo lives on the document stack (DD-P08-03).
5. The engine renders in the application stylesheet. It is an input surface only and has no part in the preview/PDF layout (ADR-010).

## Alternatives considered

- **Hand-written `contentEditable`:** no dependency, but caret, IME, selection across marks and browser differences become this project's code and defects. Rejected.
- **Tiptap:** a convenience layer over ProseMirror with its own extension model. It would add a second abstraction over a schema this small. Rejected.
- **Lexical:** capable, but its model is its own node classes and its list support assumes nesting; a closed one-level schema takes more fighting. Rejected.
- **Slate:** no stable 1.0 and known cross-browser input issues. Rejected.

## Rationale

The closed schema gives FR-RTE-04 and FR-RTE-07 by construction: what is not in the schema cannot enter. ProseMirror is MIT-licensed and long maintained, its model maps directly to §10.2, and it keeps native spell check on a real `contenteditable`.

## Consequences

- Five runtime dependencies, about 90 KB minified and gzipped together at most, loaded with the editor route's bundle. Measured at P09 acceptance.
- `tests` keep commands pure over `EditorState`, and real typing is checked in three browsers because jsdom cannot exercise caret behaviour.
- The security job's OSV scan covers the new packages.

## Security/privacy impact

The clipboard reader parses HTML only in an inert `DOMParser` document, and only allow-listed structure reaches the editor. Link URLs obey `SafeUrl` (R-6). The editor adds no network access and no telemetry. T-ID-11 holds: outside the engine's own surface, rich text is rendered as React text nodes.

## Owner and date

Operator (delegated, ADR-051), 2026-11-05.
