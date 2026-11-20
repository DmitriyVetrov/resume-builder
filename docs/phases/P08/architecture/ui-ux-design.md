# P08 UI and UX Design — Editor Workspace

- Authority: [UI and UX design planning](../../../blueprint/UI-UX-DESIGN.md), TECHNICAL-SPEC §5.3–§5.6, §5.14, §5.15, NFR-05/06. Visual system: [P06](../../P06/architecture/ui-ux-design.md) and [P07](../../P07/architecture/ui-ux-design.md), extended here, not replaced. Source screenshots are evidence, not pixel baselines.

## Screen and reference map

| Screen or interaction | Source IDs | Reference and disposition |
|---|---|---|
| Workspace frame | FR-EDT-01 | [70-finalize-formatting-tab.png](../../../source/img/70-finalize-formatting-tab.png): **adapt** the left section rail with round type icons, the white sheet on a soft field, and the tabbed right card. **Exclude** Email, Publish, Print, Resume Score and "Save & Continue" (X3, X7); the single workspace replaces the wizard (§5.3). |
| Top bar | FR-EDT-06 | Same image: **adapt** the top-right action group and the title with a pencil into an always-editable input. Status text is new. |
| Section rows, reorder | FR-EDT-02, FR-SEC-03/04/05 | [64-rearrange-sections.png](../../../source/img/64-rearrange-sections.png), [67-rename-section.png](../../../source/img/67-rename-section.png): **adapt** rows with handles and rename. **Exclude** template zones (FR-SEC-04). |
| Delete section | FR-SEC-06 | [68-delete-section-confirm.png](../../../source/img/68-delete-section-confirm.png): **reuse** the plain confirmation tone; add undo (RG has none). |
| Header and contact form | FR-HDR | [15-contact-step.png](../../../source/img/15-contact-step.png)–[20-contact-dob-picker.png](../../../source/img/20-contact-dob-picker.png): **adapt** field grouping and photo slot. **Exclude** fixed contact fields, autosuggest (X4, FR-HDR-03) and the wizard chrome. |
| Entry and section forms | FR-TYP, §5.6 | [23-*](../../../source/img/) to [60-*](../../../source/img/): **adapt** the two-column field grid and the month and year picker with "Present". **Exclude** phrase libraries and Sage (X1, X2). |
| Version history, conflict and offline notices, crop | FR-PER, FR-PHO | No reference: new, in the same system. |

## Layout

Tokens as in P06 and P07 (`ink`, `surface`, `accent`, `line`, `panel`, `accent-soft`, `muted`, `danger`, `danger-soft`, `focus`), system font stack, 4 px base, 16 px card radius. Editor additions: `--color-sheet:#fff`, `--color-field:#edf1f5`, section icon circles from four accent-family tints with AA contrast on their glyphs.

```text
≥ 1024 px · full width, app header kept, workspace fills the remaining height, panels scroll separately
┌ app header ─────────────────────────────────────────────────────────────────────────┐
│ [title input………………]  ● Saved   [↶ Undo][↷ Redo]  [History]  [Export PDF][Export TXT]│
├ Sections 280 px ─┬ Edit minmax(360,1fr) ─────┬ Preview minmax(420,1.1fr) ───────────┤
│ Your resume      │ Selected section heading  │ (Preview)(Design)                    │
│ ● Header         │ fields…                   │ ┌ soft field ──────────────────────┐ │
│ ⠿ ◍ Summary      │                           │ │  ┌ white sheet ────────────────┐ │ │
│ ⠿ ◍ Experience   │ rows with handle, ↑ ↓,    │ │  │ Name, headline, contacts    │ │ │
│    ↑ ↓ Hide Dup  │ duplicate, delete         │ │  │ SECTION …                    │ │ │
│    Rename Delete │                           │ │  └─────────────────────────────┘ │ │
│ [+ Add section]  │                           │ └──────────────────────────────────┘ │
└──────────────────┴───────────────────────────┴──────────────────────────────────────┘
< 1024 px · top bar wraps; tabs Sections | Edit | Preview | Design; one panel at a time; page scrolls
```

- The selected row has `accent-soft` background and a 3 px accent inset. Its action row is revealed under it; all row actions are native buttons of at least 44 px on narrow screens and 36 px on desktop pointer rows, with text labels.
- Hidden: muted title, "Hidden" badge. Empty: "Empty" badge.
- Drag: handle `⠿`, `touch-action:none`, a 2 px accent line marks the target.
- Preview: white sheet, shadow, max 794 px wide, labelled "Draft view — page layout arrives with the preview engine". Uses the application font; it is not the T1 layout, and it must not be mistaken for one.
- Status: dot and text; green-teal Saved, muted Saving…, amber Offline or Server unavailable, danger Not saved or Session expired; never colour alone.
- Notices: a dismissible strip under the top bar for conflict results and copy failures.

## Interaction

| Surface | Behaviour, states and focus |
|---|---|
| Open | Heading renders at once, skeleton with status text. 401 → `/login?returnTo=…`. 404 → "This resume is no longer available" with a library link. Trashed → read-only notice with Trash link. Network error → alert with Retry. |
| Title | Input, code-point clamp at 150, empty allowed (library shows "Untitled resume"). |
| Row actions | Move keeps focus on the same button, or moves to the other direction when this one becomes disabled. Polite announcement: "Moved Education to position 2 of 5". Rename turns the row title into an input: Enter or blur commits, Escape cancels, focus returns to Rename. |
| Add section | Dialog: radio group of four types with one-line descriptions, title field, Add (primary), Cancel. Focus moves to the new section's title in the form. |
| Delete section | Dialog: Cancel (initial focus), Delete (danger, last). After deletion a notice "Deleted <title>." with Undo; focus moves to the notice. |
| Undo, Redo | Disabled at the ends. Announce "Undid <label>". Selection moves to where the change happened. |
| Entry list | One entry open at a time; a closed entry shows title, organization and dates. Add opens the new entry and focuses Title. |
| Date | Month select (including "No month"), year number input 1900–2100, Present checkbox on end. An invalid year shows a local hint and leaves the date unset. Start after end: a warning under the fields, never blocking. |
| Photo | Button "Upload photo" over a file input; size refused locally with a field message. After upload the crop dialog opens. Photo shows with Adjust, Replace, Remove, Show photo. Remove confirms. Network or offline: message, nothing queued. |
| Crop dialog | Square stage with the master image, sliders Zoom, Horizontal, Vertical, drag on stage. Save crop, Cancel. |
| Version history | Dialog with list, Load more, Restore; empty state. Restore closes it and leaves a notice with Undo. |
| Conflict | Notice text as in ADR-029, link to the copy; on failure "Retry saving as a copy" and "Discard my changes". |
| Leave | `beforeunload` only while edits are unacknowledged. |

## Responsive, zoom and motion

No horizontal page scroll at 1280, 1024, 640 and 390 px. Sheet and form fields shrink; long or unbroken text wraps with `overflow-wrap:anywhere`. Transitions are 150 ms and removed under `prefers-reduced-motion`.

## Evidence

Playwright screenshots with synthetic data at 1280 and 390 px: workspace, entry form, add dialog, delete dialog, conflict notice, offline status, version history, crop dialog. Axe on the same states in three browsers. QA compares with this document and records deviations.
