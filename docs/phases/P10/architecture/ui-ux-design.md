# P10 UI and UX Design — Design Tab and Templates

- Authority: [UI and UX design planning](../../../blueprint/UI-UX-DESIGN.md), TECHNICAL-SPEC §5.8–§5.10, §6, §7, NFR-06. Visual system: [P06](../../P06/architecture/ui-ux-design.md), [P07](../../P07/architecture/ui-ux-design.md), [P08](../../P08/architecture/ui-ux-design.md), extended here, not replaced. Application tokens stay separate from document tokens. Source screenshots are evidence, not pixel baselines.

## Screen and reference map

| Screen or interaction | Source IDs | Reference and disposition |
|---|---|---|
| Design tab frame | FR-EDT-05 | [70-finalize-formatting-tab.png](../../../source/img/70-finalize-formatting-tab.png), [22-preview-formatting-tab.png](../../../source/img/22-preview-formatting-tab.png): **adapt** stacked cards in the right column. RG's two tabs (Templates, Formatting) become one scrolling panel, because FR-EDT-05 names one Design tab. |
| Template picker | FR-TPL-02 | [76-template-mlo1-corporate.png](../../../source/img/76-template-mlo1-corporate.png) (right), [10-choose-template.png](../../../source/img/10-choose-template.png)–[14-after-select-template.png](../../../source/img/14-after-select-template.png): **adapt** the live thumbnails of the user's content, with a clear selected frame. **Exclude** the long gallery: exactly three (FR-TPL-01). |
| Colour swatches | FR-CLR-01, 02 | [70-finalize-formatting-tab.png](../../../source/img/70-finalize-formatting-tab.png): **adapt** round swatches with a check mark. **Exclude** "PANTONE of the year", the free palette and pale colours (FR-CLR-04, RG D6). |
| Font size | FR-LAY-01 | Same image: **adapt** the three "A" tiles as a segmented radio group. |
| Spacing sliders | FR-LAY-02…04, §5.10 | [71-more-font-settings.png](../../../source/img/71-more-font-settings.png): **adapt** the sliders. They are always visible rather than collapsed, and show their value (§5.10). |
| Body font | FR-LAY-08 | [71-more-font-settings.png](../../../source/img/71-more-font-settings.png), [73-font-list.png](../../../source/img/73-font-list.png): **adapt** one select with three options. **Exclude** the twelve-font list. |
| Page size, margins, language, date format, placement, reset | FR-LAY-05, 06, 07, 09, §5.6, D-13 | No reference: new, in the same system. |
| T1 | §6 | `90-template-T1-reference-1.png` (not published), `91`–`93`: **reuse** the rules of §6, except the fixes the spec names (no stray separator, accent links per ADR-030). |
| T2 Compact | §7, ADR-024 | [66-preview-after-move-educ.png](../../../source/img/66-preview-after-move-educ.png): **adapt** chips with icons and compact rows. **Exclude** RG's fixed contact fields. |
| T3 Sidebar | §7, ADR-024, ADR-025 | [76-template-mlo1-corporate.png](../../../source/img/76-template-mlo1-corporate.png): **adapt** the band and two columns. **Exclude** the template moving sections (RG behaviour, FR-TPL-04). |

Excluded everywhere: Resume Score, spell-check toggle (FR-RTE-08 keeps the native one), Email, Print, Publish (§3.2).

## Layout of the Design tab

```
┌ Design ───────────────────────────────┐
│ Template                              │
│ ┌─────┐  ┌─────┐  ┌─────┐             │  live thumbnails, page aspect
│ │ T1  │  │ T2  │  │ T3  │             │  selected: 2px accent frame + check
│ └─────┘  └─────┘  └─────┘             │
│ Classic   Compact  Sidebar            │
│ Timeline                              │
├───────────────────────────────────────┤
│ Accent colour   ●✓  ●  ●   Blue       │
├───────────────────────────────────────┤
│ Font size   [ A Small | A Medium | A Large ] │
│ Body font   [ Roboto            ▾ ]   │
├───────────────────────────────────────┤
│ Section spacing   ──●───────  10      │
│ Entry spacing     ──●───────  10      │
│ Line spacing      ●─────────   1      │
├───────────────────────────────────────┤
│ Page size   [ A4 | US Letter ]        │
│ Margins     [ Narrow | Normal | Wide | Custom ]  [ 23 ] pt │
├───────────────────────────────────────┤
│ Language [ English ▾ ]  Dates [ October 2025 ▾ ] │
├───────────────────────────────────────┤
│ Column for each section (T3 only)     │
│ Summary        [ Main ▾ ]             │
│ Skills         [ Sidebar (default) ▾ ]│
├───────────────────────────────────────┤
│ [ Reset design ]                      │
└───────────────────────────────────────┘
```

P11 adds the page counter (FR-PRV-04) to the spacing card.

## Visual specification

Cards: `--color-panel` on the panel background, 1 px `--color-line`, radius 12 px, 16 px padding, 12 px between cards. Group labels 13 px, weight 650, `--color-ink`. Values in sliders are right-aligned tabular numbers, weight 650.

Selected thumbnail: 2 px `--color-accent` frame, 2 px offset, and a 20 px check badge at the top right; unselected 1 px `--color-line`, hover 1 px `--color-accent`. Thumbnails sit on `--color-field`, each one the page's aspect ratio, showing the top of page 1 scaled to width. Swatches: 36 px circles, 44 px hit target, white check with a dark outline on the selected one, 2 px ring. Segmented groups: a track in `--color-field`, the selected segment `--color-panel` with `--color-accent` text and a 1 px frame, so selection is not colour alone.

Document tokens (fonts, colours, sizes) are in the template definitions and never leak into application chrome. The thumbnails and the sheet are the only surfaces using them.

## Shared components and tokens

No UI kit. `DesignCard`, `Segmented`, `Slider` and `SwatchGroup` live in `features/editor/design/`; `Slider` and `Segmented` move to `shared/ui` if another feature needs them (none does yet). Native `input[type=range]`, `input[type=radio]`, `select` and `input[type=number]`, so keyboard and screen-reader behaviour come from the platform.

## Interaction specification

| Control | Keyboard and semantics | Edit |
|---|---|---|
| Template | Radio group, arrows move and apply; each radio's name is the template name; thumbnail `aria-hidden` | `template change`, undoable |
| Accent colour | Radio group; names "Blue", "Navy", "Graphite"; the name is also shown as text | `colour change` |
| Font size, page size, margins | Radio groups | One step each |
| Custom margin | `Custom` reveals a number field 10–50, step 0.5; out-of-range text shows an inline error and does not reach the document | One step per commit (blur or Enter) |
| Sliders | Native range, arrows ±1, Home and End to min and max (§5.10); double-click resets to the template default; `aria-valuetext` carries the number; label and value visible | Coalesced per control |
| Body font, language, date format, placement | Native select | One step each |
| Reset design | Button; announces "Design reset. Undo is available." through the existing live region; focus stays on the button | One step, Undo restores all of it |

Focus never moves on a design edit. All controls live under the workspace's `inert` while a conflict is unresolved, as other forms do. There is no dialog, so no focus return. Undo works from the top bar and by shortcut, as for every other edit.

Thumbnails re-render with a deferred value, so typing elsewhere is unaffected, and only while the Design tab is visible.

## Responsive behaviour

At ≥ 1024 px the Design tab fills the right column under its tabs; the Preview stays one click away, as P08 set out. Below 1024 px Design is its own panel tab (FR-EDT-07). At 390 px the three thumbnails stay in one row (each ≥ 96 px wide), segmented groups wrap, and slider rows keep label and value on one line above the track. At 200% zoom nothing clips: cards are `min-width:0` and wrap. The panel scrolls, and the page does not gain a horizontal scrollbar.

## Motion

Only the 120 ms frame and colour transition on thumbnails and segments, removed by `prefers-reduced-motion`. The document never animates.

## Acceptance and evidence

Screenshots at 1280 px and 390 px of the Design tab for each template, in `qa-report.md`. Visual baselines of the draft sheet per template in Chromium (AC-P10-19). Keyboard walk, 200% zoom and axe on the Design tab (AC-P10-17). Intentionally different from the references: one panel rather than two tabs, three templates, three colours, no score or publish actions.
