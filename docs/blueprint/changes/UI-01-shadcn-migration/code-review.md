# UI-01 External review

Reviewer: Codex CLI 0.166.0, `codex exec --sandbox read-only` with `.claude/review-prompt.md`
(`docs/blueprint/AGENT-WORKFLOW.md`, "External review"). Findings and verdicts are verbatim.

## R1 — `git diff main...HEAD` at `192858b`

- **major** — [dialog.tsx](/home/dmytro/git/work/resumiser/frontend/src/shared/ui/dialog.tsx:40): Opening any dialog renders a `bg-black/10` overlay, a hard-coded palette color that does not come from the theme tokens. The T-04 scan skips this file, so the violation is hidden. Keep production UI covered by the token check and make the overlay token-driven through an approved customization.
- **minor** — [ThemeSwitch.tsx](/home/dmytro/git/work/resumiser/frontend/src/app/ThemeSwitch.tsx:20): On a narrow viewport, the Light, Dark, and System menu items have a 36 px minimum height, below UI-01’s 44 px target. Give the items a 44 px minimum on narrow screens.

Verdict: FAIL

### Operator notes on R1

- Major (overlay color): fixed test-first. T-04 again scans every component in `shared/ui/` (red:
  `../shared/ui/dialog.tsx:40` the one offender); the overlay is now `bg-(--color-scrim)`, defined in
  `app/shell.css` from the theme's `--shadow-color`. DD-UI-10 revised accordingly.
- Minor (theme menu items 36 px on narrow screens): fixed, `max-lg:min-h-[44px]`.

## R2 (delta) — `git diff 192858b..21d8674 -- frontend tests docs/blueprint/changes`

No findings. The R1 fixes keep `shared/ui` in the token scan, use a theme-derived scrim token, and set theme menu items to 44 px below the `lg` breakpoint. The review evidence records an assertion failure for the restored scan before the fix and passing frontend and E2E runs afterward. No `Codex-Task:` commits were found.

Verdict: PASS
