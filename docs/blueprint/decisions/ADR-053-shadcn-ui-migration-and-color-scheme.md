# ADR-053 — Application UI on shadcn/ui, theme tokens and color scheme

- Status: **Accepted** (owner decision 2026-11-08, details `DELEGATED-DEFAULT`)
- Decider: Owner (scope, branch, dark mode, snapshot re-baseline); Operator (component mapping, delegated)
- Date: 2026-11-08 (change UI-01, outside the phase sequence, before P13)
- Source IDs: NFR-06 (WCAG 2.1 AA); FR-PRV-02 and ADR-010 (preview equals PDF); ADR-050 §4 (single token stylesheet); `docs/blueprint/UI-UX-DESIGN.md`; CLAUDE.md "UI / Design System"
- Work package: `docs/blueprint/changes/UI-01-shadcn-migration/`

## Context

Commit `af65ebb` installed shadcn/ui 4.23 (Radix base, Nova preset) and a tweakcn theme in
`frontend/src/app/shell.css`, but no page uses either. The application is still built from the
hand-written controls in `frontend/src/shared/ui/index.tsx` and about 380 lines of plain CSS bound
to an older teal palette (`--color-brand: #155e75`, `--color-ink`, `--color-line`, …). The theme
reaches only the body background and the font, so the UI looks unchanged. Unlayered legacy rules
such as `a, button { color: … }` also beat Tailwind utilities, so a shadcn component dropped into a
page would be restyled by them.

The owner decided on 2026-11-08: migrate as a separate task on its own branch before P13; support
the system color scheme and a theme switch in the UI; re-baseline the visual snapshots as an
approved test change.

## Decision

1. **Every application color comes from the theme tokens.** The legacy custom properties remain as
   aliases of tokens so feature CSS keeps its class hooks: `--color-brand` → `--accent-foreground`
   (text, links, selection marks), `--color-brand-soft` → `--accent`, `--color-ink` →
   `--foreground`, `--color-line` → `--border`, `--color-panel` → `--card`, `--color-surface` →
   `--background`, `--color-field` → `--muted`, `--color-muted-text` → `--muted-foreground`,
   `--color-danger` → `--destructive`. No hex, rgb or raw palette class remains in application CSS
   or markup. `--primary` (a light lime) is a fill color only: it fails 4.5:1 as text on the light
   background, so links and colored text use `--accent-foreground`.
2. **Legacy CSS moves into `@layer components`** so Tailwind utilities on shadcn components win
   over it. The one deliberate unlayered rule is the focus indicator: a 3 px outline in
   `--color-focus` (= `--accent-foreground`, ≥ 3:1 against both backgrounds), because the theme ring
   (`--ring` at 50 %) is below the WCAG 1.4.11 contrast for a focus indicator.
3. **shadcn replaces the shared primitives where the mapping keeps behavior.** `shared/ui/index.tsx`
   keeps its exported API (`Button`, `TextField`, `PasswordField`, `Surface`, `Badge`,
   `LoadingSkeleton`, `StatusNotice`, `Dialog`) and builds each on the shadcn component (`button`,
   `input`, `label`, `card`, `badge`, `skeleton`, `dialog`, `native-select`). Variant mapping:
   `primary` → `default`, `secondary` → `outline`, `danger` → `destructive`. Link-styled actions use
   `Button asChild`.
4. **Dialogs move from native `<dialog>` to the shadcn (Radix) Dialog.** Behavior is kept: initial
   focus on `[data-initial-focus]`, Escape closes unless busy, an outside click does not close, focus
   returns to the opener. Code that recognized a dialog by its element (`closest('dialog')`,
   `dialog[open]`) uses `[role="dialog"]`.
5. **Native controls whose shadcn counterpart replaces the element stay native, styled by tokens:**
   checkbox, radio, range, number, file, the editor's role-based panel tabs and the `<details>` export
   options. shadcn's Checkbox, RadioGroup, Slider and Tabs swap the input for a `button`/`span` with
   different events and keyboard model; that is a behavior change outside a styling migration.
   `<select>` uses shadcn `native-select`, which keeps the native element.
6. **Color scheme.** A viewer preference `light | dark | system`, default `system`, kept in
   `localStorage` (`resumiser.theme`, a per-device convenience, never resume data) and applied as the
   `.dark` class on `<html>` before the first render; in `system` mode a `prefers-color-scheme`
   listener follows the OS. The switch is a shadcn `dropdown-menu` with radio items in the app
   header. No inline script, so a future strict CSP is not blocked; the cost is a short light flash
   for a dark preference before the bundle runs.
7. **The resume document is not themed.** Painted pages, thumbnails and the template/accent swatches
   show document colors from the template model (ADR-010, FR-PRV-02). The page sheet stays white in
   dark mode and no theme token reaches `preview-paint` or `entities/layout`.

## Alternatives considered

- **Alias the legacy variables only, keep the hand-written controls:** fastest, but leaves every
  control hand-written against the CLAUDE.md UI rules and keeps hex colors in the CSS. Rejected as the
  end state; it is step 1 of this decision.
- **Full Radix replacement of every native control:** consistent visuals, but changes the semantics
  and keyboard model of the design controls and editor tabs that P08–P11 tests and NFR-06 evidence
  rest on. Rejected for this change; a later phase may revisit control by control.
- **CSS-only dark mode via `@media (prefers-color-scheme)`:** no flash and no script, but the dark
  tokens would be duplicated outside the `.dark` block tweakcn writes, and a manual switch still
  needs a class. Rejected.

## Consequences

- Unit and E2E tests keep their assertions. Selectors that named the `dialog` element are changed to
  the dialog role, and visual snapshots are re-baselined; both are recorded in the work package
  decisions as approved test changes.
- Axe checks gain a dark-scheme pass on the screens they already cover.
- Re-applying a tweakcn theme keeps working: the aliases point at token names, not values.
- ADR-050 §4 (single token stylesheet) still holds: tokens stay in `app/shell.css`.

## Security, privacy and accessibility

No new network access, CDN or font source. The stored preference holds one of three words. Contrast
of every token pair used for text is verified by axe in both schemes; the focus indicator keeps
3 px and ≥ 3:1. Reduced-motion handling stays global.

## Amendment 1 (2026-11-08, owner): the focus indicator is the theme ring

Supersedes the focus rule in §2 and the focus sentence under "Security, privacy and accessibility"
(DD-UI-15, which supersedes DD-UI-06). The owner judged the dark 3 px outline around the lime ring
a defect and chose the tweakcn look. `--color-focus` is `--ring` at 50 %; the `:focus-visible`
outline lives in `@layer base` with no offset, so a shadcn primitive's `outline-none` removes it and
its own `ring-3 ring-ring/50` is the only indicator, while every other focusable element gets a
3 px outline in the same color. The indicator stays 3 px wide but no longer meets the WCAG 1.4.11
3:1 contrast; this is an owner-accepted exception to NFR-06 for the focus indicator only.

## Amendment 2 (2026-11-09, owner): controls as in the tweakcn preview

Supersedes the control sizing and field border of §2 and DD-UI-07 for `<select>` (DD-UI-16 to
DD-UI-19). The shadcn style is new-york, the one the tweakcn preview renders: 36 px buttons and fields,
32 px compact actions, 1 px `border-input` fields with `shadow-xs`, 14 px medium labels, the 6 px radius
scale, and the theme Select (Radix listbox) for every drop-down; resume dates stay a month Select plus a
year field. Below 1024 px controls keep 44 px targets. Owner-accepted exceptions to NFR-06: field
borders below the WCAG 1.4.11 3:1 contrast, and desktop targets of 32–36 px (WCAG 2.5.8 is met).
`danger` stays the outline button with dark red text, because white on the solid `--destructive` is
below 4.5:1.
