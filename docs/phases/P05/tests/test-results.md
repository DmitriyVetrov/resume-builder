# Test Results

No tests executed yet. Record exact commands, environment, exit code, pass/fail counts and artifacts. Never mark tests passed without running them.

## Test Engineer red handoff — 2026-11-03

Environment: Linux, Node 24 toolchain via the existing frontend lockfile, Vitest 4.1.12, Docker Engine 29.6.1, pinned Playwright 1.56.1 Chromium image from `infrastructure/images.lock`; no backend or API service started. The standalone host Playwright command lacked browser binaries, so browser red evidence uses the pinned container. No real resume content, credentials or contact data were used.

| Exact command (repository root) | Exit | Actual result |
|---|---:|---|
| `npm ci --prefix frontend --ignore-scripts --no-audit --no-fund` | 0 | Installed 285 locked packages. |
| `npm test --prefix frontend -- src/app/routes.test.tsx src/widgets/shell-navigation.test.tsx src/widgets/editor-panels.test.tsx src/app/route-error.test.tsx` | 1 | Seven assertions failed across four files: absent route links, editor/not-found headings, skip/navigation controls, panel tabs and error alert. Vitest loaded and ran every test. |
| `npm run typecheck --prefix frontend` | 0 | Test source typechecks after the test-only route child seam is cast to a component accepting children. |
| `npm run lint --prefix frontend` | 0 | ESLint clean. |
| `npm run build --prefix frontend` | 0 | Baseline placeholder builds; this is not shell acceptance. |
| `npm test --prefix tests/e2e -- shell.spec.ts --project=chromium` | 1 | Host browser binaries absent; not counted as behavioral red. |
| `docker run --rm --ipc=host --network host --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD:/work" -w /work/tests/e2e 'mcr.microsoft.com/playwright:v1.56.1-noble@sha256:f1e7e01021efd65dd1a2c56064be399f3e4de00fd021ac561325f2bfbb2b837a' npx playwright test shell.spec.ts --project=chromium` | 1 | Five of five browser cases failed for missing editor link, library/editor/not-found headings and desktop editor regions. Pinned container ran the browser successfully. |
| `bash docs/phases/P05/tests/suite.cmd` | 1 | Frontend job observed seven red unit tests; image Dockerfile is absent. This run preceded addition of `set -e` to stop at the first failed command. |
| `python3 scripts/phase-handoff-check.py --phase P05 --role test-engineer --worktree .` | 0 | Role/phase scope and blueprint passed; red suite commands were recognized. |

The image check is red because `frontend/Dockerfile` does not yet exist; runtime and OSV steps cannot run until the Frontend Developer adds the image. The Playwright axe and deep-link checks reach their later assertions only after route behavior is implemented. The developer must preserve the tests and make the suite green; QA still owns the 200% zoom and full three-engine acceptance run.

Final suite verification after adding `set -e`: `bash docs/phases/P05/tests/suite.cmd` exited 1 at the frontend unit job (four new files red, seven failing assertions; two P03 canaries pass). `git diff --check` exited 0. `python3 scripts/phase-handoff-check.py --phase P05 --role test-engineer --worktree .` exited 0 after the suite layout change; its per-line red audit saw frontend, E2E and image checks each exit 1 for the missing implementation, with no scope error.

## Frontend Developer green handoff — 2026-11-03

Environment: Linux, Node v24.22.2, npm from the Node 24 toolchain, Docker Engine, pinned Playwright 1.56.1 container, and pinned OSV Scanner 2.3.1 image. No backend/API service or real resume data was used. Contract declarations were generated from `contracts/openapi/openapi.yaml` into the ignored frontend folder.

| Exact command (repository root) | Exit | Result |
|---|---:|---|
| `npm test --prefix frontend -- src/app/routes.test.tsx src/widgets/shell-navigation.test.tsx src/widgets/editor-panels.test.tsx src/app/route-error.test.tsx` | 0 | Four files, seven assertions passed after implementation. |
| `npm run generate:api --prefix frontend` | 0 | `openapi-typescript` 7.13.0 generated declarations. |
| `npm run typecheck --prefix frontend` | 0 | Strict TypeScript check passed. |
| `npm run lint --prefix frontend` | 0 | ESLint passed; existing `minimatch` override remained compatible. |
| `npm ls minimatch --prefix frontend --all` | 0 | ESLint and typescript-eslint resolve overridden 11.0.1. |
| `bash docs/phases/P05/tests/suite.cmd` | 1 | Initial implementation: frontend and browser checks passed, but OSV found fixable packages in the pinned runtime image. |
| `bash docs/phases/P05/tests/image-check.sh` | 0 | After runtime `apk upgrade`, non-root image, direct/deep-link HTTP and OSV scan passed; scanner said `No issues found`. |
| `npm test --prefix frontend -- src/app/route-error.test.tsx` | 0 | Recovery change passed its focused test (1/1). |
| `bash docs/phases/P05/tests/suite.cmd` | 0 | Final run: frontend job 9/9, Playwright 21/21 across Chromium/Firefox/WebKit, image build/runtime/deep-link and OSV scan passed with no issues. |
| `git diff --check` | 0 | No whitespace errors. |
| `python3 scripts/phase-handoff-check.py --phase P05 --role frontend-developer --worktree .` | 0 | `RESULT PASS`: role scope, phase scope, blueprint and four suite commands passed. |

The image-check curl loop printed transient connection reset messages during container startup, then succeeded. Shared Compose/CI/image-lock wiring remains the coordinator's integration follow-up under DD-P05-06.

## Review cycle 1 — Test Engineer, 2026-11-03

F-02/F-03/F-04 regression tests were added after the documented code review request. The error test now inspects each console argument (including `Error.message`) instead of JSON serializing `Error`; a second test checks routing after Go home; the browser test checks visible panel content at 1280 px, hidden desktop tabs, and tab behavior at 800 px. All injected strings are fictional sentinels.

| Exact command (repository root) | Exit | Actual result |
|---|---:|---|
| `npm test --prefix frontend -- src/app/route-error.test.tsx` | 1 | Two expected failures: sentinel present in console arguments (F-03); after Go home and Resumes link, heading remains Resumiser (F-02). No unhandled test error in final run. |
| `docker run --rm --ipc=host --network host --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD:/work" -w /work/tests/e2e 'mcr.microsoft.com/playwright:v1.56.1-noble@sha256:f1e7e01021efd65dd1a2c56064be399f3e4de00fd021ac561325f2bfbb2b837a' npx playwright test shell.spec.ts --project=chromium --grep 'editor desktop'` | 1 | Expected F-04 failure: Edit tabpanel is hidden at 1280 px; later breakpoint assertions were not reached. |
| `npm run typecheck --prefix frontend` | 0 | Strict TypeScript check passed. |
| `npm run lint --prefix frontend` | 0 | ESLint passed. |
| `git diff --check` | 0 | No whitespace errors. |

The developer owns the production fixes and the next green run. The existing full suite was not run because these tests are intentionally red at test handoff.

Handoff verification: `python3 scripts/phase-handoff-check.py --phase P05 --role test-engineer --worktree .` exited 0 (`RESULT PASS`); role scope was three owned files, frontend and E2E suite commands remained red, and the image check passed.

## Review cycle 1 — Frontend Developer, 2026-11-03

Environment: Linux, Node 24, Docker Engine, pinned Playwright and OSV images. The clean-context image test used a temporary copy of current `frontend/` excluding `node_modules`, `dist`, and ignored generated types. F-01, F-02, F-04 and F-07 production changes are implemented; F-03 production root callbacks suppress React's caught/uncaught error logging, but the committed RTL test creates a separate root without those callbacks and remains red. The Test Engineer owns that test-harness mismatch; no test was modified.

| Exact command | Exit | Actual result |
|---|---:|---|
| `npm test -- --run src/app/route-error.test.tsx` (from `frontend/`, before fixes) | 1 | Both regression tests failed for F-02 and F-03 as intended. |
| `npm test -- --run src/app/route-error.test.tsx` (from `frontend/`, after recovery fix) | 1 | Recovery routing passed; console logging assertion remained red. |
| `npm run build` (from `frontend/`) | 0 | Contract types regenerated; TypeScript and Vite production build passed. |
| `bash docs/phases/P05/tests/suite.cmd` | 1 | Frontend lint/typecheck passed; Vitest 9/10, F-03 logging assertion failed; suite stopped before E2E/image. |
| `bash scripts/ci/e2e.sh` | 1 | Same frontend Vitest failure stopped the job before Playwright. |
| `docker build -t resumiser-p05-web:clean-check -f <temporary-context>/Dockerfile <temporary-context>` | 0 | Current frontend copied without ignored generated types; clean image build passed. |
| `bash docs/phases/P05/tests/image-check.sh` | 0 | Image build, non-root runtime, direct/deep links and OSV scan passed; no issues found. |
| `docker run --rm --ipc=host --network host --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD:/work" -w /work/tests/e2e "$(sed -n 's/^PLAYWRIGHT=//p' infrastructure/images.lock)" npx playwright test shell.spec.ts --grep 'editor desktop'` | 0 | After rebuilding preview assets, all three browser breakpoint regressions passed. |

The first direct Playwright run before rebuilding preview assets was red (12/15 passed; stale `dist` lacked restored regions); `npm run build` then exited 0, and the focused three-engine rerun passed. F-05, F-06 and F-08 remain review follow-ups. No full green suite is claimed while the F-03 test-harness mismatch remains.

Coordinator resolution DD-P05-07: production `createRoot` now passes the exported no-op `suppressCaughtErrorLogging` handler; the Test Engineer will pass the same handler to the RTL root. `npm run build --prefix frontend` exited 0 after this change (strict typecheck and Vite build). `python3 scripts/phase-handoff-check.py --phase P05 --role frontend-developer --worktree .` exited 1: suite frontend/E2E jobs remain red at the known F-03 RTL assertion, and the concurrent coordinator-owned `docs/phases/P05/decisions.md` edit triggered ROLE_SCOPE. The image check passed within the handoff run.

## DD-P05-07 test update — 2026-11-03

The route error test now passes the exported `suppressCaughtErrorLogging` handler to both RTL renders. Its sentinel console assertion is unchanged. RTL 16.3.0 forwards `onCaughtError` at runtime, but its conditional declaration resolves the option to `never` with the installed React 19 types, so the test uses a narrow option type bridge.

| Exact command (repository root) | Exit | Actual result |
|---|---:|---|
| `npm test --prefix frontend -- src/app/route-error.test.tsx` (before update) | 1 | Expected red: 1/2 passed; sentinel appeared in React's caught-error console arguments. |
| `npm test --prefix frontend -- src/app/route-error.test.tsx` (handler added) | 0 | 2/2 passed; sentinel assertion unchanged. |
| `bash docs/phases/P05/tests/suite.cmd` (before type bridge) | 2 | Frontend typecheck rejected RTL's `onCaughtError` option as `never`; no E2E or image check ran. |
| `bash docs/phases/P05/tests/suite.cmd` (after type bridge) | 0 | Frontend lint, typecheck, 10/10 Vitest tests and build passed; E2E 21/21 passed across three engines; image runtime/deep-link checks and OSV scan passed (`No issues found`). |

The suite's E2E step calls `bash scripts/ci/e2e.sh` and passed, so no E2E failure or production-code fix is pending from this update. The image startup curl loop printed transient connection resets before succeeding.

Handoff verification: `python3 scripts/phase-handoff-check.py --phase P05 --role test-engineer --worktree .` exited 0 (`RESULT PASS`): two role-owned files, blueprint exit 0, and all four suite commands exit 0.

## QA fix — Frontend Developer, 2026-11-03 — GREEN

Environment: Linux, Node 24.22.2, Docker, pinned Playwright Chromium image. The QA reproduction used Vite preview of a fresh production build, a 390 × 844 viewport, and `document.body.style.zoom="2"`. Before the fix, `document.documentElement.scrollWidth/clientWidth` was 413/390; element inspection identified the header navigation as the overflow source. The narrow-width header now wraps.

| Exact command (repository root unless noted) | Exit | Actual result |
|---|---:|---|
| `npm run build --prefix frontend` | 0 | Contract types regenerated; strict typecheck and Vite production build passed. Run before and after the CSS change. |
| `npm run preview --prefix frontend -- --port 4174` | 130 | Preview started successfully; stopped manually after the check. |
| `pw_image="$(sed -n 's/^PLAYWRIGHT=//p' infrastructure/images.lock)"; docker run --rm --ipc=host --network host --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD:/work" -w /work/tests/e2e "$pw_image" node --input-type=module -e 'import { chromium } from "@playwright/test"; const b=await chromium.launch({headless:true}); const p=await b.newPage({viewport:{width:390,height:844}}); await p.goto("http://127.0.0.1:4174/resumes/fixture-id/edit"); await p.evaluate(()=>document.body.style.zoom="2"); for (const name of ["Sections","Edit","Preview","Design"]) {const t=p.getByRole("tab",{name}); await t.focus(); await p.keyboard.press("Enter"); console.log(name,await t.getAttribute("aria-selected"),await p.getByRole("tabpanel",{name}).isVisible());} console.log("overflow",await p.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}))); await p.goto("http://127.0.0.1:4174/missing"); await p.evaluate(()=>document.body.style.zoom="2"); await p.getByRole("link",{name:/home/i}).focus(); await p.keyboard.press("Enter"); console.log("home",new URL(p.url()).pathname); await b.close();'` | 0 | All four tabs selected and panels visible by keyboard; overflow 390/390; not-found home recovery navigated to `/`. |
| `bash docs/phases/P05/tests/suite.cmd` | 0 | Frontend lint/typecheck, 10/10 Vitest, build, 21/21 Playwright across three engines, image build/runtime/deep link, and OSV image scan passed; OSV reported `No issues found`. |

The existing browser suite does not assert 200% zoom overflow. The Test Engineer should add that regression test; this developer did not edit tests. The image check printed transient startup connection resets before its successful retry.
| `git diff --check` | 0 | No whitespace errors. |
| `python3 scripts/phase-handoff-check.py --phase P05 --role frontend-developer --worktree .` | 0 | `RESULT PASS`: three role-owned files, blueprint exit 0, and all four suite commands green. |

## QA fix regression — Test Engineer, 2026-11-03

Added a Playwright assertion for AC-P05-04 to the existing 390 × 844 editor shell case. It applies the QA report's `document.body.style.zoom = '2'` method and requires `document.documentElement.scrollWidth <= document.documentElement.clientWidth`. The red build used a temporary frontend copy under `/tmp`, with `frontend/src/app/shell.css` taken from `1a87e5f^`; production source was untouched. The first temporary build failed because the copy did not yet have the repository-relative contract paths, then succeeded after placing the copy under a temporary `frontend/` directory and linking the read-only contract inputs.

| Exact command (repository root unless noted) | Exit | Actual result |
|---|---:|---|
| `npm run build --prefix "$tmp_root/frontend"` (temporary copy with `git show 1a87e5f^:frontend/src/app/shell.css > "$tmp_root/frontend/src/app/shell.css"`) | 0 | Built the pre-fix shell CSS in `/tmp` after correcting the temporary directory layout. |
| `pw_image=$(sed -n 's/^PLAYWRIGHT=//p' infrastructure/images.lock); docker run --rm --ipc=host --network host --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD:/work" -v "$tmp_root:/old" -w /work/tests/e2e "$pw_image" npx playwright test --config /old/red.config.mjs --grep 'editor desktop'` | 1 | Expected red in Chromium against temporary pre-fix Vite preview on port 4175: assertion received `scrollWidth=413`, expected `<= clientWidth=390`. The temporary config used the same `shell.spec.ts` and base URL port 4175. |
| `npm run build --prefix frontend` | 0 | Current frontend build succeeded. |
| `pw_image=$(sed -n 's/^PLAYWRIGHT=//p' infrastructure/images.lock); docker run --rm --ipc=host --network host --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD:/work" -w /work/tests/e2e "$pw_image" npx playwright test shell.spec.ts --grep 'editor desktop'` | 0 | Green: all three browser projects passed the new assertion with current CSS. |
| `python3 scripts/phase-handoff-check.py --phase P05 --role test-engineer --worktree .` | 0 | `RESULT PASS`; role scope two owned files, blueprint exit 0, frontend/E2E/image suite commands all exit 0. |
| `git diff --check` | 0 | No whitespace errors. |
