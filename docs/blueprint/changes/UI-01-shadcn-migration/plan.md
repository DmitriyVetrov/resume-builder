# UI-01 — Application UI on shadcn/ui and theme tokens

- Branch: `feat/shadcn-migration` from `main` at `6965f2a`; merged with `--no-ff` before P13 starts.
- Decision: [ADR-053](../../decisions/ADR-053-shadcn-ui-migration-and-color-scheme.md); delegated details in [decisions.md](decisions.md).
- Not a phase: no phase ID, no `TRACEABILITY.md` change. It follows the ADR-051 step order (plan → test plan → red → green → external review → acceptance) with its records in this folder.

## Goal

The tweakcn theme becomes visible on every application screen, in a light and a dark scheme, built
from shadcn/ui components, with no behavior change and no change to the resume document rendering.

## Requirements in force

- NFR-06 (WCAG 2.1 AA): axe-clean, keyboard reachable, visible focus ≥ 3 px, 44 px targets on narrow screens.
- FR-PRV-02 / ADR-010: preview pages, thumbnails and PDF stay identical; the `design.spec.ts` page screenshots must not change.
- CLAUDE.md UI rules: shadcn components from `shared/ui`, theme tokens only, light and dark, lucide icons.

## Allowed paths

`frontend/src/**` (except `entities/layout/**` and `features/preview-paint/**`, which stay untouched),
`frontend/components.json`, `frontend/package.json`, `frontend/package-lock.json` (shadcn CLI only),
`tests/e2e/theme.spec.ts`, `tests/e2e/playwright.config.ts` (test list), dialog selectors in existing
tests (decisions.md DD-UI-04), `docs/blueprint/decisions/ADR-053-*`, `docs/blueprint/DECISION-REGISTER.md`,
`docs/blueprint/changes/UI-01-shadcn-migration/**`, `CLAUDE.md` (repository state line).

## Slices

| # | Slice | Check |
|---|---|---|
| S1 | Token foundation: legacy variables aliased to theme tokens, hex/rgb removed, legacy CSS in `@layer components`, focus rule unlayered | `no-raw-colors.test.ts`, existing focus-width E2E |
| S2 | Color scheme: `shared/lib/theme.ts` (preference, `.dark` class, OS listener), header switch (`dropdown-menu`) | `theme.test.ts`, `theme-switch.test.tsx`, `theme.spec.ts` |
| S3 | Shared primitives on shadcn: Button, TextField/PasswordField (input + label), Surface (card), Badge, LoadingSkeleton (skeleton), Dialog (Radix), native-select | `ui.test.tsx`, all existing unit tests |
| S4 | Screens: auth/account, library/trash, editor shell (top bar, notices, section panel, forms, photo, history), design panel, export actions, landing/not-found | existing unit + E2E suites, axe light and dark |
| S5 | Cleanup: dead legacy CSS removed, `README`/CLAUDE.md state line | build, lint, typecheck |

## Test budget

New: 4 unit files (~20 cases), 1 E2E file (~8 cases × 3 browsers). Existing: the full frontend job
and E2E job, unchanged in assertions.

## Risks

- Radix Dialog differs from native `<dialog>` in focus return timing and portal placement → existing dialog tests in account, library, editor, rich text run unchanged.
- Contrast: `--primary` and `--destructive` as text → axe in both schemes; colored text uses `--accent-foreground`.
- Theme leaking into the document → page screenshots and the white-sheet assertion.

## Codex worker tasks

None: the change is one coherent restyle where each step depends on the previous one.
