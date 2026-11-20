# Code Review — P05 Frontend Foundation

- Reviewer: Code Reviewer (Claude Sonnet, Orca worker), 2026-11-03.
- Range: `git diff main...HEAD` (5 commits, 33 files) on `phase/P05`.
- Inputs: PHASE.md, kickoff.md, phase-plan.md, decisions.md, acceptance-criteria.md, frontend-tasks.md, ADR-050, test-results.md, `frontend/**`, `tests/e2e/**`.

Verdict: FAIL

Two defects need a fix before QA. F-01 breaks the web image build on any clean checkout (AC-P05-07). F-02 leaves the app unusable after error recovery, and the boundary logs thrown messages (AC-P05-05). The scope, test-integrity, contract and static-asset checks are clean. This is a one-pass review (ADR-035 B-2). The re-review covers only the files changed after this report.

## Findings (ranked)

### F-01 — Critical — The web image does not build from a clean checkout
- File: `frontend/Dockerfile:3-6`, `frontend/.gitignore`, `frontend/.dockerignore`, `frontend/src/shared/api/client.ts:1`.
- `client.ts` imports `./generated/schema`. The generated folder is git-ignored, and the Docker build context is `frontend/` only, so it cannot reach `contracts/` or `tests/contract/`. The build stage runs `tsc --noEmit` after `COPY . .` without generating the types.
- It only passed for the developer because the ignored `generated/` folder already existed in their working tree and was copied into the context.
- Reproduced: I built `git archive HEAD frontend` in an empty temp dir with `docker build`. It failed at `Dockerfile:6` (`tsc --noEmit`, exit code 2).
- Impact: AC-P05-07 and `image-check.sh` fail in CI or on any fresh clone. The recorded green suite depends on leftover local state. The same problem will hit the shared image wiring (DD-P05-06) later.
- Required fix, within the allowed paths:
  - Make the image build not depend on the ignored folder, for example by adding the generated types to the build context, or by generating the schema in a pipeline step before `docker build`. The pinned generator lives in `tests/contract`, outside the `frontend/` context.
  - Or build the image from the repo root, which is a different `docker build` invocation in `image-check.sh`, so it needs Test Engineer approval.
  - Whichever way, the suite must be re-run from a clean tree: `git clean -fdX frontend` or a fresh archive.
- Escalate to the Solution Architect if the context change conflicts with ADR-050 §5.

### F-02 — Major — After "Go home" recovery the app is stuck on the library page
- File: `frontend/src/app/App.tsx:8-9`.
- `RouteBoundary` sets `recovered: true` and then renders `<Library root />` unconditionally, bypassing `<Routes>`.
- Reproduced in a temp copy: after a forced render error, "Go home", then clicking "Resumes" changes the URL to `/resumes`. The `h1` stays "Resumiser".
- Impact: every link is dead after the first error, until a full reload. This contradicts the AC-P05-05 intent that recovery is a *working* recovery action. No test covers navigation after recovery.
- Required fix: reset the boundary state so routed content renders again. For example, key the boundary by location, clear the `failed` state on recovery and render the normal routes, and perform the navigation through the router (`useNavigate`/`Link`) instead of `history.replaceState`, which the router does not observe.
- Add a regression test. The test files belong to the Test Engineer, so route that part through the coordinator.

### F-03 — Major — The error boundary does not stop the thrown message reaching the console
- File: `frontend/src/app/App.tsx:5-9`, `frontend/src/app/route-error.test.tsx:12`.
- The class has no `componentDidCatch` and no handling for React's default logging. Reproduced: with `console.error` mocked, the call arguments contain the `Error` whose message is the sentinel (`flat.includes(sentinel)` is true).
- In production, React 19 logs caught errors to `console.error`, so the exception text (which may carry resume or contact data) goes to the console. AC-P05-05 says no content is "shown or logged by the boundary". This is a NFR-09 / security rule 03 concern.
- Test integrity: `route-error.test.tsx:12` checks `JSON.stringify(consoleSpy.mock.calls)`. An `Error` serialises to `{}`, so the assertion cannot fail and passes vacuously. This is a Test Engineer weakness, not a developer edit. The test is not weakened by the developer, but it does not prove what it claims.
- Required fix: route caught errors through the root `onCaughtError`/`onUncaughtError` options of `createRoot` in `main.tsx` with a sanitised handler, or document and accept console logging as an exception.
- Follow-up: the Test Engineer should make the sentinel assertion meaningful, for example by checking `error.message` of each argument. That needs a separate approved test-change request.

### F-04 — Major — Editor panels: content hidden on desktop, breakpoints differ from the plan
- File: `frontend/src/app/App.tsx:16-18`, `frontend/src/app/shell.css:20-21`.
- Every panel body has `hidden={active !== name}`. At 1280 px, only the active panel shows content. The other `region` boxes are empty frames, and the tabs hide content on a layout that was meant to be three simultaneous columns. The tablist is also visible at desktop.
- The phase plan says tabs below 1024 px. The CSS switches at `max-width: 600px`. Between 601 and 1023 px a three-column grid is used with tabs that also hide content.
- The e2e check (`getByRole('region').toBeVisible()`) passes on the empty frame, so it does not detect this. AC-P05-03 asks for distinguishable regions, which is only barely met.
- Required fix: at ≥1024 px show all panels and hide the tabs, or hide only below the breakpoint with CSS and not the `hidden` attribute. At <1024 px use tabs.
- The duplicated accessible name (`region` "Sections" containing `tabpanel` "Sections") should also be reduced to one landmark per panel.

### F-05 — Minor — Dockerfile pinning and environment drift
- File: `frontend/Dockerfile:1,7-9`.
- The build base is `node:24.11.1`, while `package.json` engines require `>=24.18 <25` and `.nvmrc` says 24. The npm engines mismatch is silent here (no `engine-strict`).
- `apk upgrade --no-cache` in the runtime stage makes the image content non-reproducible even with a digest-pinned base. That was done to pass OSV; it should be documented or handled by a newer pinned base digest.
- The inline nginx config sets no security headers. Defer to P15 and record it.

### F-06 — Minor — ARIA tabs without arrow-key behavior
- File: `frontend/src/app/App.tsx:15`.
- The `role="tab"` buttons have no roving `tabindex` and no arrow/Home/End handling (ARIA APG tabs pattern). Every tab sits in the Tab order. This is usable by keyboard, and the AC-P05-03 negative case is met, but it is not the full pattern. Either implement it or use plain toggle buttons (`aria-pressed`) instead of the tab roles.

### F-07 — Minor — API client robustness
- File: `frontend/src/shared/api/client.ts:9-12`.
- Spreading `init?.headers` breaks when callers pass a `Headers` instance or an array, because spread drops those entries. `credentials` is forced after `...init`, which cannot be overridden by design.
- `apiRequest` returns `unknown` and uses only the path key, so the response type is not derived from the contract. That is acceptable for a thin, unused wrapper (the plan allows it), but P06 should type responses from `paths[...]`. Use `new Headers(init?.headers)` when finishing this.

### F-08 — Minor — Shell polish and maintainability
- File: `frontend/src/app/App.tsx` (whole file), `frontend/src/app/shell.css`.
- Router, boundary, pages and widgets are all in `App.tsx` as dense one-line components. The plan and ADR-008/ADR-050 describe `app/pages/widgets/shared` modules. Splitting is not enforced by a test, but the next phases will extend this file.
- `shell.css` styles bare `header`/`main` element selectors globally and uses almost no Tailwind utilities. Only four `@theme` tokens exist. That is acceptable for the foundation, but the design-token source is thin.
- The library page links to a hard-coded `/resumes/fixture-id/edit`. This is fictional placeholder data in a product page. It is required by the tests, so the label "preview" is accepted, but it should be removed when P08 introduces real IDs.

### F-09 — Info
- `README` documents routes and the `minimatch` decision; `ADR-050` is present.
- The DD-P05-06 follow-up (Compose `web` service, `images.lock`, CI image scan, ADR-003 register link) is still open for the coordinator.
- Nothing is lost for NFR-05: the three-engine matrix beyond smoke stays in P14.

## Checklist results

| Area | Result |
|---|---|
| Scope vs allowed paths | PASS. Every changed file is under `docs/phases/P05/`, ADR-050, the exact `frontend/` list, or `tests/e2e/**`. No backend, contract, root CI, `docs/source` or `tests/contract` edits. `frontend/dist` and `generated/` are not tracked. |
| TDD order | PASS. The commits run architect → test-architect → test-engineer (red) → developer (green). The red run is recorded in test-results.md. |
| Test integrity | PASS for the developer. The developer commit touches no `*.test.*`, `tests/e2e/**`, `smoke.spec.ts`, `suite.cmd` or `App.test.tsx`. The P03 canaries are unchanged. The F-03 test weakness was in the Test Engineer's own file. |
| Contract alignment | PASS. `contracts/openapi/**` is untouched. The types are generated from the frozen contract with the single pinned tool. There is no hand-written DTO, invented endpoint or API call from pages; e2e asserts zero `/api/` requests. |
| Security / privacy | CONDITIONAL. There are no secrets, trackers, CDN assets or content in the UI. See F-03 for console logging. No `dangerouslySetInnerHTML`. |
| Accessibility | PARTIAL. Skip link, landmarks, one `h1` per page, focus outline and axe-clean routes are present. See F-04 and F-06. 200% zoom is for QA. |
| Performance | PASS. The JS bundle is 233 kB (75 kB gzip) with three runtime dependencies, and there are no route bundles. |
| Dependencies | `react-router-dom` 7.18.5, Tailwind 4.3.4 and `@axe-core/playwright` 4.10.2 are exact pins. The `minimatch` override is retained with documented lint and `npm ls` evidence. |

## Evidence I ran

| Command | Exit | Result |
|---|---:|---|
| `npm run lint` (frontend) | 0 | Clean. |
| `npm test` (frontend) | 0 | 5 files, 9 tests passed. |
| `npm run build` (frontend) | 0 | Built; JS 233 kB. |
| `docker build` of `git archive HEAD frontend` in an empty temp dir | 1 | Failed at `tsc --noEmit` (missing `./generated/schema`). See F-01. |
| Temp-copy probes (not committed, removed afterwards) | n/a | Navigation stuck after recovery (F-02); sentinel reaches `console.error` args (F-03). |

I did not re-run the Playwright or OSV image steps. The existing test-results.md is the evidence for those, and F-01 invalidates the image step on a clean tree.

## Required actions before QA

1. Fix F-01 and re-run the full suite from a clean tree. Owner: Frontend Developer. Escalate to the Solution Architect if the build context changes.
2. Fix F-02, F-03 and F-04. Owner: Frontend Developer. The regression tests and the vacuous assertion (F-03) need a separate test-change request to the Test Engineer; the developer must not edit them.
3. F-05 to F-08 are optional or can be deferred, but record them as known issues if skipped.
4. Next owner: Frontend Developer, then a changed-files re-review, then QA.

## Re-review cycle 1 (delta re-review, 2026-11-03)

Scope: only the files changed since `d8c6cf4` (`P05: code-reviewer — cycle 1 FAIL`) up to `2291a11`: `frontend/Dockerfile`, `frontend/src/app/{App.tsx,error-handlers.ts,shell.css,route-error.test.tsx}`, `frontend/src/main.tsx`, `frontend/src/shared/api/client.ts`, `tests/e2e/shell.spec.ts`, plus phase docs (`decisions.md`, `frontend-tasks.md`, `test-results.md`, `coordinator-log.md`). No other file changed (checked with `git diff --stat d8c6cf4 HEAD`).

### Status of the cycle 1 findings

| Finding | Result | Evidence |
|---|---|---|
| F-01 Critical, image build from a clean checkout | **Fixed** | The Dockerfile build stage now runs only `vite build`. `client.ts` uses `import type` from the ignored `generated/schema`, and nothing in the entry graph imports `client.ts`, so the build no longer needs the ignored folder. I built `git archive HEAD frontend` in an empty temp dir (no `generated/`, no `node_modules`) with `docker build`: exit 0. Type checking stays in `npm run typecheck`/`npm run build` (both regenerate the types first) and in the suite and CI frontend job, so no gate lost the check. |
| F-02 Major, stuck after "Go home" | **Fixed** | The boundary is keyed by `location.key`, recovery clears `failed` and navigates through `useNavigate`, and normal `<Routes>` render again. The new test `restores routing after Go home recovery` clicks Go home and then the Resumes link, then asserts `/resumes` and the `Resumes` h1. It passes. |
| F-03 Major, thrown message reaches the console | **Fixed** (see G-01 for a side note) | `suppressCaughtErrorLogging` is passed as `onCaughtError` to the production root. The test now flattens `console.error` arguments and reads `Error.message`, so the assertion can fail. Test Engineer evidence shows it red without the handler and green with it. The handler never reads or logs its argument. |
| F-04 Major, hidden panels / breakpoints | **Fixed** (landmark-name part not done) | The `hidden` attribute is gone. CSS shows the three-column grid at ≥1024 px with the tablist hidden, and below 1024 px it uses tabs and `display:none` for inactive panels. The e2e test asserts visible `tabpanel` and heading content at 1280 px, hidden tablist, tabs at 800 px, and the 390 px keyboard path. All pass across three engines (21/21 in the recorded run). The duplicated `region` + `tabpanel` name that I asked to reduce is unchanged; it is not an AC failure (see G-03). |
| F-07 `Headers` handling | **Fixed** | `new Headers(init?.headers)` with a default `Accept`. |
| F-05, F-06, F-08 | Deferred, as allowed | The Frontend Developer recorded them in `frontend-tasks.md` as deferred follow-ups. |

### Test integrity

- No test was weakened or removed. The only edits to existing test assertions are in `route-error.test.tsx` (the vacuous `JSON.stringify` check was replaced by a stricter per-argument check) and `shell.spec.ts` (assertions added only). Both were made by the Test Engineer under the documented review request, not by the developer.
- The developer commit `fe44ff7` changed no test file. The P03 canaries, `suite.cmd`, `image-check.sh` and the contract tests are untouched.
- The removal of `tsc --noEmit` from the Dockerfile reduces what `docker build` checks. I accept it because the same check runs in the suite (`npm run typecheck`, `npm run build`) and the image is built from sources already checked there.
- `silentRootOptions` in the test uses `as unknown as` to bridge RTL 16.3.0's `never` typing for `onCaughtError`. It is narrow and commented, so I accept it. Revisit it when RTL fixes the typing.

### Does the DD-P05-07 handler hide errors harmfully?

No, with the caveats below. `suppressCaughtErrorLogging` is only attached to errors that the route boundary already caught and replaced with a generic message, which is the case AC-P05-05 and NFR-09 require not to log. No data is read or forwarded. The boundary UI still reports the failure to the user. P05 has no telemetry, so nothing is lost on that side.

### New findings (none blocking)

- **G-01 — Minor.** `frontend/src/main.tsx` also sets `onUncaughtError: () => {}`. DD-P05-07 names only `onCaughtError`, so this goes slightly beyond the decision. An uncaught render error (outside the route boundary) unmounts the app and leaves a blank page with no console output at all, which makes debugging hard. The same applies to developers who can no longer see caught errors in dev. Suggested follow-up (P06 or the next time `main.tsx` is touched): log a static, content-free message such as `console.error('Unexpected application error')` in both handlers, and add the Architect's note to DD-P05-07. Before any telemetry is added, route errors through a sanitiser that never includes `error.message`.
- **G-02 — Info.** Event-handler and async errors never reach these React root callbacks (they go to `window.onerror`). No code in P05 can throw them from content, so there is nothing to do now. Keep it in mind when forms arrive in P07.
- **G-03 — Info.** The duplicated accessible name (`region "Sections"` containing `tabpanel "Sections"`) and the missing roving tabindex (F-06) remain. They are Minor and should be picked up by the QA accessibility pass or in P08, when the real editor panels replace the placeholders. `.panel-tabs` is declared twice in `shell.css` (display flex, then none); this is harmless but can be tidied.

### Evidence I ran (delta re-review)

| Command | Exit | Result |
|---|---:|---|
| `git archive HEAD frontend` → `docker build` in an empty temp dir | 0 | Image built without `generated/`. Temp dir and image removed afterwards. |
| `npm run lint` (frontend) | 0 | Clean. |
| `npm run typecheck` (frontend) | 0 | Passed after regenerating the types. |
| `npm test` (frontend) | 0 | 5 files, 10 tests passed. |

I did not re-run Playwright or the OSV scan. I rely on `test-results.md` (suite exit 0, e2e 21/21, image runtime and OSV "No issues found") for those. The review did not edit any code or test.

### Verdict

Verdict: PASS

F-01 to F-04 and F-07 are fixed with evidence, tests were strengthened rather than weakened, and the DD-P05-07 handler is safe for the stated purpose. G-01 to G-03 are non-blocking and are recorded for the next owner. Next owner: QA (`qa-acceptance`). Coordinator follow-ups that remain open: the DD-P05-06 shared Compose/CI/image-lock wiring and the ADR-003 register link.
