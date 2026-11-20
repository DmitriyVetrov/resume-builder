# P09 UI and UX Design — Rich Text

- Authority: [UI and UX design planning](../../../blueprint/UI-UX-DESIGN.md), TECHNICAL-SPEC §5.7, NFR-06. Extends [P08's design](../../P08/architecture/ui-ux-design.md).

## Reference map

| Element | Reference and disposition |
|---|---|
| Field and toolbar | [27-responsibilities-editor.png](../../../source/img/27-responsibilities-editor.png), [28-responsibilities-typed.png](../../../source/img/28-responsibilities-typed.png): **adapt** the bordered field with a top toolbar of B, I, U, list and link. **Exclude** the right-hand suggestions panel and Sage (X1, X2), and the in-toolbar undo (the top bar owns it, DD-P08-03). |
| Link dialog | [30-responsibilities-add-url.png](../../../source/img/30-responsibilities-add-url.png): **adapt** title, Link text, Link (URL), Cancel and Apply into the shared `Dialog`. Add "Remove link" when editing. |

## Visual

```text
block variant
┌ B  I  U │ • List │ 🔗 Link ───────────────────────┐  toolbar: accent-soft on pressed, 36 px targets (44 px narrow)
│ Paragraph text with **bold** and a link.           │  field: 1 px #697b8b, radius 8, min-height 96 px
│  • a bullet                                        │  focus-visible: 3 px focus ring on the wrapper
└────────────────────────────────────────────────────┘
line / inline variant: a single-line field; the compact toolbar appears under it while focus is inside
```

Icons are inline SVG or the letters B, I, U with a visible accessible name. Link text uses the accent colour and an underline in the field. Bullets are real list markers. Long or unbroken text wraps.

## Interaction

| Action | Behaviour |
|---|---|
| Keyboard | Ctrl/Cmd+B, I, U, K. Shift+Tab or Tab reaches the toolbar; arrows move within it; Home and End jump. Enter or Space activates, and focus returns to the text. |
| Pointer | Toolbar presses keep the text selection. |
| Enter | `block`: new paragraph or bullet; on an empty bullet leaves the list. `line`: next item. `inline`: nothing. |
| Shift+Enter | Line break, except in `line`. |
| Backspace at the start of a bullet | Turns it into a paragraph. |
| Link dialog | Initial focus URL. Apply disabled until there is a URL. Invalid: a field error, the dialog stays. Close returns focus to the field with the selection restored. |
| Paste | Replaces the selection, is one undo step, and states nothing unless something had to be dropped in a `line` field: then new items appear. |

## Evidence

Screenshots at 1280 and 390 px: `block` field with a mixed document, compact field, link dialog. Axe in three browsers with the toolbar visible and the dialog open.
