# UI-01 Test results

Environment: Debian 13 (Linux 6.12), Node 24 (host) for Vitest, Playwright in the pinned
`PLAYWRIGHT` image from `infrastructure/images.lock` against `vite preview` on 127.0.0.1:4173.

## Red — 2026-11-08

| Command | Exit | Result |
|---|---|---|
| `npx vitest run src/shared/lib/theme.test.ts src/app/theme-switch.test.tsx src/shared/ui/ui.test.tsx src/app/no-raw-colors.test.ts` (in `frontend/`) | 1 | 11 failed, 1 passed (12). All failures are assertions: T-01 `expected 'light' to be 'system'` and missing `.dark` (stub `theme.ts`); T-02 no "Theme" button in the banner; T-03 no `data-slot="button"`/`"input"`/`"dialog-content"`; T-04 shell.css lacks the token marker. The one pass is T-03's busy/outside-pointer case, which the native dialog already satisfies. |
| `npm run build` (in `frontend/`), then `npx playwright test theme.spec.ts --project=chromium` in the Playwright image | 1 | 5 failed (5). E-01, E-04, E-05: `html.dark` expected true, received false. E-02: button background `rgb(21, 94, 117)` (legacy teal), expected the `--primary` value `oklch(0.7491 0.1481 126.168)`. E-03: no "Theme" button in the banner (visibility assertion). |

## Green — 2026-11-08

The owner's uncommitted `frontend/vite.config.ts` (an `/api/v1` proxy, which `vite preview` also applies) and `.claude/settings.json` were stashed for every full run, and restored afterwards. The first full run, with the proxy still in place, sent the E2E fixtures' unrouted API calls to 127.0.0.1:5080 and failed six P06 cases on redirects; those failures were the environment, not the change.

| Command | Exit | Result |
|---|---|---|
| `npx vitest run` (in `frontend/`), new checks T-01…T-04 included | 0 | 43 files, 508 passed |
| `bash scripts/ci/e2e.sh` — run 2 | 1 | Frontend job green; E2E 11 failed / 353 passed. Light-scheme `color-contrast` on `--destructive` text (3.51:1 and 3.93:1), on a button whose opacity was still animating after `disabled` cleared (2.89:1), Firefox 43.99999 px target height, and the P06 visual-states `h1` query behind the Radix modal. Fixed by DD-UI-11, DD-UI-14 and DD-UI-13. |
| `bash scripts/ci/e2e.sh` — run 3 | 1 | E2E 1 failed / 363 passed: Firefox E04, a 44 px button measured 43.99999 px. Fixed by the legacy 46 px minimum (DD-UI-14). |
| `npx playwright test library.spec.ts account.spec.ts theme.spec.ts` (all three browsers) | 0 | 147 passed |
| `bash scripts/ci/e2e.sh` — final | 0 | Frontend job: lint, typecheck, 508 unit tests, build. E2E: 364 passed, 2 skipped (Y10 baselines in Firefox and WebKit, Chromium-only by design since P10). `design.spec.ts` page screenshots matched without re-baselining (AC-UI-06; DD-UI-03 not used). Rendering gate: G2 PASS in all three browsers, G7 PASS, 18 passed. |
| `python3 scripts/check-blueprint.py` | 0 | Blueprint structure OK |

No dependency changed: `frontend/package.json` and the lockfile equal `main`; the shadcn components use the installed `radix-ui`, `lucide-react` and `cn`.

## Review R1 fixes — 2026-11-08

| Command | Exit | Result |
|---|---|---|
| `npx vitest run src/app/no-raw-colors.test.ts` after restoring the full scan scope | 1 | Red on the assertion: one offender, `../shared/ui/dialog.tsx:40` (`bg-black/10`). |
| `npx vitest run` after the token overlay | 0 | 43 files, 508 passed |
| `bash scripts/ci/e2e.sh` (owner edits stashed) | 0 | Frontend job green; E2E 364 passed, 2 skipped (Y10, Chromium-only); rendering reference, export checks and G2 PASS. |

## DD-UI-16 to DD-UI-19, controls as in the tweakcn preview — 2026-11-09

Environment: local, Node 24, Playwright image `v1.56.1-noble`; the owner's `frontend/vite.config.ts` was stashed around each E2E run.

| Command | Exit | Result |
|---|---|---|
| `npx vitest run` (frontend), after the new-york components and the theme Select, before the test changes | 1 | 10 failed / 498 passed: T-04 (`text-white` in the new-york destructive variants), T-03 (`danger` variant), and eight tests that drive a native `<select>` (`fireEvent.change`, `option` children). |
| `npx vitest run` after DD-UI-18 and the approved test change (DD-UI-16) | 0 | 43 files, 508 passed |
| `npx eslint src`, `npx tsc --noEmit`, `npm run build` (frontend) | 0 | clean; the build emits `rounded-md` as `calc(var(--radius) - 2px)` and `border-input` as `var(--border)` (DD-UI-17) |
| `npx playwright test --project=chromium editor design library account theme shell rich-text` | 1 | 7 failed / 86 passed: Y08 still read a native value; the focus checks (P06 ×3, Y09) read a ring still fading in (DD-UI-19); P06 keyboard login and return path failed on the owner's vite proxy, which had not been stashed. |
| the same, after DD-UI-19, with the proxy stashed | 0 | 93 passed |
| `npx playwright test` (all specs, three browsers) | 0 | 364 passed, 2 skipped (Y10 baselines, Chromium-only by design). `design.spec.ts` page screenshots matched without re-baselining. |

The rendering gate (`scripts/ci/rendering.sh`) was not rerun: no engine, template or document file changed. No dependency changed: `frontend/package.json` and the lockfile equal `main`.
