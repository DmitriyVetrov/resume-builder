# Frontend Tasks

No tasks assigned yet. Add task IDs, owner, allowed files, contract dependencies and tests.

Written by the Solution Architect, 2026-11-02. **Owner: the Platform Developer (role `backend-developer`) under the explicit cross-boundary grant of DD-P03-02. No Frontend Developer dispatch in P03.** Allowed files: only the skeleton files listed here, under `frontend/**`, plus `scripts/ci/frontend.sh` and `scripts/ci/e2e.sh`. Contract dependency: none. Generated API types are P05. Tests come first from the Test Engineer: the frontend canary `*.test.tsx` and `tests/e2e/**`. Never modify an existing test file. Status values: `TODO` / `DONE`.

## Frontend toolchain skeleton (phase-plan §8.2)

| ID | Task | Files | Acceptance | Status |
|---|---|---|---|---|
| FE-P03-01 | Node pin and package manifest: `.nvmrc` `24`; `package.json` (`private`, `type: module`, `engines.node >=24.18 <25`, exact versions, scripts `lint`, `typecheck`, `test`, `build`, `preview`); committed `package-lock.json` from an `--ignore-scripts` install | `frontend/.nvmrc`, `frontend/package.json`, `frontend/package-lock.json` | AC-P03-05, AC-P03-11, AC-P03-14 | DONE |
| FE-P03-02 | TypeScript: `tsconfig*.json` with `strict`, `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` (ADR-003) | `frontend/tsconfig*.json` | AC-P03-05 | DONE |
| FE-P03-03 | Vite + Vitest config (React plugin; `environment: 'jsdom'`; a setup file that registers `@testing-library/jest-dom`) and ESLint 9 flat config (typescript-eslint, react-hooks) | `frontend/vite.config.ts`, `frontend/src/test/setup.ts` (or an equivalent path), `frontend/eslint.config.js` | AC-P03-05 | DONE |
| FE-P03-04 | `index.html`, `src/main.tsx` and a placeholder root component `App`, a named export of `frontend/src/app/App.tsx` (the folder is the one P05 uses). It renders a `main` landmark with an `h1` "Resumiser", which the canary and the E2E smoke target. No external URLs, fonts, CDNs, analytics or trackers | `frontend/index.html`, `frontend/src/main.tsx`, `frontend/src/app/App.tsx` | AC-P03-05, AC-P03-06, AC-P03-15 | DONE |
| FE-P03-05 | `scripts/ci/frontend.sh` (phase-plan §5.1) | `scripts/ci/frontend.sh` | AC-P03-05, AC-P03-08 | DONE |
| FE-P03-06 | `scripts/ci/e2e.sh`: build the SPA if needed, run `tests/e2e` inside the pinned Playwright image (three browser projects), with reports in an ignored directory | `scripts/ci/e2e.sh` | AC-P03-06 | DONE |
| FE-P03-07 | `frontend/README.md`: skeleton, commands, the script contract P05 keeps | `frontend/README.md` | AC-P03-18 | DONE |

Not in P03: Tailwind CSS 4, router, design tokens, the feature folder structure, error boundaries, the app shell, generated API types, the Prism dev proxy, the Dockerfile (P05, decisions.md §4).

## Obligations for later phases (not P03 tasks)

P05-OBL-P03-01, P05-OBL-P03-02 and the shared-file rule in `decisions.md` §4.

## Platform Developer attempt — 2026-11-03

Frontend skeleton is implemented, but FE-P03 tasks remain TODO until the full P03 suite passes. Exact commands from repository root: `npm ci --prefix frontend --ignore-scripts --no-audit --no-fund` exited 0; `npm run --prefix frontend lint` exited 0; `npm run --prefix frontend typecheck` exited 0; `npm test --prefix frontend` exited 0 (2 tests passed after cleanup was registered in the production test setup); `npm run --prefix frontend build` exited 0. The E2E job did not run, so FE-P03-06 has no green evidence.

## Platform Developer continuation — 2026-11-03

FE-P03-01 and FE-P03-05 production fixes are DONE: Vite 7.3.7 and Vitest 4.1.12 are pinned, minimatch 11.0.1 is overridden in the frontend lockfile, and ESLint ignores generated `dist/**`. Exact commands from repository root: `npm install --prefix frontend --package-lock-only --ignore-scripts --no-audit --no-fund --save-exact --save-dev vite@7.3.7 vitest@4.1.12` exit 0; `npm pkg set 'overrides.minimatch=11.0.1' --prefix frontend` exit 0; `npm install --package-lock-only --ignore-scripts --no-audit --no-fund --prefix frontend` exit 0; `npm ci --ignore-scripts --no-audit --no-fund --prefix frontend` exit 0; `npm run lint --prefix frontend` exit 0; `npm run typecheck --prefix frontend && npm test --prefix frontend && npm run build --prefix frontend` exit 0 (2 tests passed, build succeeded). `bash scripts/ci/security.sh` found no issues in `frontend/package-lock.json`; remaining security findings are in the read-only P02 contract lockfile.

### Review fix evidence (task_5abcc2a850f8, 2026-11-03)

FE-P03-01–FE-P03-07 are marked DONE from the implemented skeleton and review documentation. `bash docs/phases/P03/tests/suite.cmd` exited 1 because of the Test Engineer-owned workflow mutation checker and initially root-owned E2E output; `bash scripts/ci/e2e.sh` subsequently exited 0 with six Playwright tests across three browsers after output cleanup was added. The complete phase suite still needs a green rerun after the checker fix.

- `bash docs/phases/P03/tests/suite.cmd` — rerun exit 0; all five jobs and 38 infrastructure tests passed.
- `python3 scripts/phase-handoff-check.py --phase P03 --role backend-developer --worktree .` — final rerun exit 0, `RESULT PASS`.
