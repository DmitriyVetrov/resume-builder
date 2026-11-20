# P09 Test Plan

Levels: AST parser and serializer unit tests, a property test, boundary and hostile fixtures, component tests, three-browser E2E with real typing and clipboard events, an API round trip on real Mongo. Budget from `architecture/phase-plan.md`: Vitest ≤ 60, E2E ≤ 10 per browser, backend ≤ 3.

## Vitest

| ID | File | What it proves | AC |
|---|---|---|---|
| N01–N06 | `entities/resume/rich-text.test.ts` | Normalising: empty runs, merged runs and links, idempotence, plain text kept; code-point length; URL table including `javascript:`, case, bare domain, e-mail and phone | 3, 9 |
| R01–R05 | `features/editor/rich-text/convert.test.ts` | Corpus round trip; **property: 500 seeded documents** in each of two variants satisfy `docToAst(astToDoc(x)) = normalize(x)` and the contract's AST rules; lone empty paragraph; `line` and `inline` documents; link with mixed marks | 9, 12 |
| K01–K10 | `features/editor/rich-text/commands.test.ts` | Mark toggles; bullets on and off, merging neighbours, splitting a list; Enter on an empty bullet; Backspace at a bullet start; link add, edit, remove on `EditorState` | 1–3, 6 |
| P01–P12 | `features/editor/rich-text/clipboard.test.ts` | Word with `mso-list` and conditional comments; Google Docs wrapper and CSS styling; web HTML with fonts and colours; `ol`, nested lists, headings, tables; images, scripts, styles; hostile `href`; plain-text bullets and numbers; line flattening | 4, 7, 11 |
| F01–F08 | `features/editor/rich-text/rich-text-field.test.tsx` | Name, `aria-multiline`, spell check; no emit on mount; an external value change updates text; toolbar pressed state; toolbar roving keys; link dialog validation and focus return; compact variant structure | 1, 3, 8, 12, 13 |
| V01–V02 | `features/editor/rich-text/rich-text-view.test.tsx` | AST rendered as text nodes; hostile text stays text | 11 |
| S01 | `app/no-raw-html.test.ts` | No `dangerouslySetInnerHTML` or `innerHTML =` in `frontend/src` outside the test itself | 11 |

## E2E (`tests/e2e/rich-text.spec.ts`)

| ID | Scenario | AC |
|---|---|---|
| T01 | Type, format by shortcut and by toolbar; saved AST and preview agree | 1 |
| T02 | Paragraph then bullets, Enter out of the list, toggle; saved AST | 2 |
| T03 | Link add, edit, remove; `javascript:` refused; focus returns | 3 |
| T04 | Paste Word and Google Docs and web HTML by a real `paste` event; saved AST | 4, 7 |
| T05 | Undo and redo in a field; typing continues at the caret; format is its own step | 5 |
| T06 | Shift+Enter stored as `lineBreak` | 6 |
| T07 | `list` Enter adds an item, pasted lines become items; `inline` stays one paragraph | 12 |
| T08 | Hostile paste and hostile stored text do not execute | 11 |
| T09 | Spanish, Ukrainian, Slovak and emoji survive typing, formatting and reload; spell check on every field | 8, 13 |
| T10 | Toolbar by keyboard, Tab leaves, axe with toolbar and dialog; opening a stored document writes nothing | 9, 13 |

## Backend

`P09RichTextRoundTripTests` (existing `ResumeBuilder.Api.Tests` project, real Mongo): each corpus document through `replaceResumeDocument` and `getResume`, equal JSON; every link scheme the client can emit is accepted. AC 10.

## Real stack (step 7)

The P08 real-stack spec also types a formatted document in the browser and asserts the stored JSON through the API. AC 10.

## Commands

`docs/phases/P09/tests/suite.cmd` runs `scripts/ci/backend.sh`. The frontend and E2E jobs, which include P09's tests, run in P08's suite on the same tree, so a batched gate does not run them twice.
