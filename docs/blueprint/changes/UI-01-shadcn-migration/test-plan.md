# UI-01 Test plan

## Acceptance criteria

| ID | Criterion | Checks |
|---|---|---|
| AC-UI-01 | Application CSS and markup use theme tokens only: no hex, `rgb()`, `hsl()` or Tailwind palette class outside the tweakcn token block and lines marked `document color`. | T-04 |
| AC-UI-02 | A primary action shows the theme: its background is the computed `--primary`, its text `--primary-foreground`. | E-02 |
| AC-UI-03 | The color scheme follows the OS by default; Light, Dark and System are selectable from the header and survive a reload; a broken storage falls back to System. | T-01, T-02, E-01, E-03 |
| AC-UI-04 | Shared primitives are the shadcn components with the same API; dialogs keep initial focus, Escape-unless-busy, no outside-click close, and focus return. | T-03, existing account/library/editor/rich-text dialog tests |
| AC-UI-05 | Axe (WCAG 2.1 A/AA) finds nothing on the login, library and editor screens in the dark scheme, as the existing specs already require in light. | E-04, existing axe specs |
| AC-UI-06 | The resume document is not themed: the page sheet stays white in dark mode and the `design.spec.ts` page screenshots match unchanged. | E-05, `design.spec.ts` |
| AC-UI-07 | No behavior change: the full frontend job and the full E2E job pass with unchanged assertions (selector changes only per DD-UI-04). | `scripts/ci/frontend.sh`, `scripts/ci/e2e.sh` |

## New checks

| ID | Level | File | Cases |
|---|---|---|---|
| T-01 | unit | `frontend/src/shared/lib/theme.test.ts` | default `system`; invalid and throwing storage → `system`; `dark`/`light` set and clear `.dark` and persist; `system` follows `prefers-color-scheme` and its change event; explicit choice ignores the OS change |
| T-02 | unit | `frontend/src/app/theme-switch.test.tsx` | header has a "Theme" button; its menu offers Light, Dark, System as radio items with the current one checked; choosing Dark sets `.dark` and stores it |
| T-03 | unit | `frontend/src/shared/ui/ui.test.tsx` | `Button` is the shadcn button with variant mapping; `TextField` is the shadcn input with its label and description wiring; `Dialog` is labelled, focuses `[data-initial-focus]`, closes on Escape unless busy, ignores an outside pointer, returns focus to the opener |
| T-04 | unit (static) | `frontend/src/app/no-raw-colors.test.ts` | the AC-UI-01 scan over `frontend/src/**/*.{css,tsx}` minus `entities/**` and `features/preview-paint/**` |
| E-01…E-05 | E2E ×3 browsers | `tests/e2e/theme.spec.ts` | E-01 dark OS → `html.dark` on first load; E-02 primary button colors equal tokens; E-03 switch to Light survives reload and overrides a dark OS; E-04 axe clean in dark on login, library and editor; E-05 page sheet white in dark |

## Red expectation

Each new check fails on an assertion: `theme.ts` exists as a no-op stub, the header has no switch,
the primitives are not shadcn, raw colors exist, and the primary button is teal.
