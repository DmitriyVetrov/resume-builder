# Frontend

P03 contains the Node pin, exact npm dependencies and lockfile, strict TypeScript, Vite, Vitest and ESLint configuration, and a placeholder React root component. P05 extends this skeleton with the app shell and product UI.

From the repository root, run `bash scripts/ci/frontend.sh` for `npm ci --ignore-scripts`, lint, typecheck, tests and build. `bash scripts/ci/e2e.sh` rebuilds the SPA and runs the three Playwright browsers in the pinned container. P05 keeps the npm script names `lint`, `typecheck`, `test`, `build` and `preview`, exact package versions and the strict TypeScript flags. Do not put secrets in `VITE_*` variables.

## P05 shell

`/` shows the landing; `/resumes/:resumeId/edit` shows a structural editor preview; other paths show a recovery link. The editor's Sections, Edit, Preview and Design panels are placeholders and have no save, export or account behavior. P06 adds session discovery and account routes as described below.

From the repository root, run `bash scripts/ci/frontend.sh` or `bash docs/phases/P05/tests/suite.cmd`. For focused work use `npm test --prefix frontend`, `npm run typecheck --prefix frontend`, and `npm run build --prefix frontend`. The `typecheck`, `test`, and `build` scripts regenerate ignored TypeScript declarations from `contracts/openapi/openapi.yaml` with the single pinned `tests/contract` installation; `npm run generate:api --prefix frontend` runs that step explicitly. The API wrapper now supports same-origin cookie authentication and CSRF for the P06 account slice.

The existing `minimatch` 11.0.1 override remains: `npm ls minimatch --prefix frontend --all` exits 0 and shows ESLint 9.39.1 and typescript-eslint 8.46.4 resolving to that version; `npm run lint --prefix frontend` passes across the expanded globs. The P05 image scan is the security check for this dependency graph.

## Web image

`docker compose --profile app up -d --build web` serves the built SPA on `127.0.0.1:8080` (override the host port with `RESUMISER_WEB_PORT`). The image uses digest-pinned Node and nginx bases, runs as a non-root user, and returns the SPA for direct deep links. `bash docs/phases/P05/tests/image-check.sh` builds, probes and OSV-scans it; `bash scripts/ci/frontend.sh` generates API types explicitly, then runs lint, typecheck, unit tests, build and that image check.


## P06 accounts

Canonical browser routes are `/sign-up`, `/login`, `/verify-email`, `/reset-password`, `/reset-password/confirm`, and `/account`. The five corresponding `/auth/*` legacy routes replace browser history with their canonical route. Verification and reset links accept `#t=` or legacy `#token=`; the UI captures and removes the fragment, applies a no-referrer policy, and never writes tokens or credentials to browser storage.

A single session provider discovers `/api/v1/session` and refreshes after account state changes. Account settings show a loading state until session discovery completes, offer retry on failure, and require a signed-in session. Every unsafe request bootstraps CSRF when the readable `XSRF-TOKEN` cookie is absent and echoes it as `X-XSRF-TOKEN`. A rejected CSRF check refreshes the bootstrap cookie; mutations retry only after an explicit user action. API calls include same-origin cookies and bypass the browser cache.

Sensitive actions confirm the current password. Password changes use the contracted `PUT /api/v1/account/password`; deletion requires a separate final confirmation after re-authentication. The verified account download is labelled JSON; complete archive assembly belongs to P13. `ClaimDraft` is a confirmation component with explicit callbacks; P08 supplies real draft storage and saving.

The preview server and web image serve static files and do not proxy `/api/v1` to the backend. Browser tests provide same-origin API fixtures. Live integration must serve or proxy the backend at that same origin, using the backend's documented local cookie configuration or HTTPS; API proxy configuration belongs to the integration owner.

Focused checks from the repository root are `npm test --prefix frontend -- src/features/account` and, after a frontend build, `npm test --prefix tests/e2e -- account.spec.ts --project=chromium`. Use the complete frontend and E2E CI scripts above for required regression checks. Fixture-backed browser results do not prove live email, token expiry, session revocation, deletion purge, or export isolation; QA exercises those against the real API and local services.

## P07 library

`/resumes` lists the resumes and `/resumes/trash` the trash, both from `listResumes` through `features/library`. `entities/resume` holds what other features will share: the ADR-018 blank document and the title rules. A title's length is counted in Unicode code points, as the contract counts it. The card's page is a labelled placeholder until the P11 layout engine exists (DD-P07-15).

Every write sends `Idempotency-Key`, and every versioned write sends `If-Match` with the version from the list or the read. A key is kept until the outcome is known: after a network failure, a 5xx or an in-flight 409 a retry repeats the same key and body, so it cannot apply the effect twice. The page holds create and copy attempts, so closing and reopening the dialog does not forget one, and an unknown outcome also re-reads the list. Reloading the page forgets them; the list then shows whether the first attempt landed. A 401 goes to `/login?returnTo=...`, and login without a safe return path now lands on `/resumes`.

Focused checks: `npm test --prefix frontend -- src/features/library src/entities/resume` and, after a build, `npm test --prefix tests/e2e -- library.spec.ts --project=chromium`. `tests/e2e/library.spec.ts` uses a stateful same-origin API fixture that enforces CSRF, `If-Match` and `Idempotency-Key`; the real API is exercised in QA.

## Editor (`src/features/editor`)

`EditorSession` owns all editor state; forms render its snapshot. `AutosaveQueue` is the only write path of a resume in a tab: one attempt at a time, retries repeat bytes and key, and a coalesced body gets a new key (ADR-037 §4). Drafts live in IndexedDB per user, resume and tab. Rich text is the contract AST everywhere; ProseMirror stays inside `rich-text/` (ADR-052). To test the queue, inject its dependencies; it needs no React.

## P10 templates and design

`entities/template` holds the three templates as plain data, and `resolveDesign(document, template?)` is the one place a document and a definition become numbers. The layout engine reads it. The Design tab (`features/editor/DesignPanel.tsx`, `design/`) edits only through `EditorSession.apply`, so undo and autosave come with every control.

`entities/layout` is the ADR-010 engine (PageModel, TXT, PDF), and `features/preview-paint` is its DOM painter. `tests/rendering/` runs them. `bash scripts/ci/rendering.sh` needs poppler-utils and Docker and runs G1, G2, G5, G6 and G7; `bash scripts/ci/rendering.sh bench` runs G3 and G4. Generate the gate fixtures with `node tests/rendering/make-fixtures.mjs`.

## P11 preview

`features/preview-paint/runtime.ts` is the only value import of the engine, through `import()`, so a page with no resume loads no engine and no font. `usePageModel` holds the one layout result, read by `PreviewPanel` and the Design tab's counter. Only `entities/layout/{icons,regions,version}` may be imported statically. Library thumbnails are page 1 of a real layout, cached per user in the `resumiser-thumbnails` database, which `removeLocalData` clears. `bash scripts/ci/rendering.sh bench` also measures NFR-01 through the real editor.

`src/assets/fonts` holds the subset fonts with their licences. `scripts/build-fonts.py` records how they were made; it is not part of the build.
