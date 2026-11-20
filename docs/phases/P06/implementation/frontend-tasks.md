# P06 Frontend Tasks

Owner: Frontend Developer. Use the generated TypeScript types from frozen OpenAPI 1.0.0 and P05's route/client structure; do not hand-write competing DTOs. Begin only after the Test Engineer's red tests/harness proof. Keep source ownership disjoint from backend; append exact commands/exits to `tests/test-results.md` without editing existing tests, contract or acceptance criteria.

The visual and interaction target is [ui-ux-design.md](../architecture/ui-ux-design.md), based on the inspected application references [03-dashboard-resumes.png](../../../source/img/03-dashboard-resumes.png), [05-create-new-modal.png](../../../source/img/05-create-new-modal.png), [15-contact-step.png](../../../source/img/15-contact-step.png), [22-preview-formatting-tab.png](../../../source/img/22-preview-formatting-tab.png) and [70-finalize-formatting-tab.png](../../../source/img/70-finalize-formatting-tab.png). These are continuity cues; the account screens are new designs. No source wizard, publish, score or upsell pattern is copied.

Allowed production paths: `frontend/src/**` excluding existing `*.test.*`, `frontend/package.json`, `frontend/package-lock.json`, `frontend/README.md`. Test source and `tests/e2e/**` belong to the Test Engineer. No new third-party tracker, remote assets, secret or browser-stored session token.

| Task | Deliverable and contract dependency | Red/green evidence |
|---|---|---|
| FE-P06-01 | Extend same-origin API client to bootstrap `/session`, echo `XSRF-TOKEN` as `X-XSRF-TOKEN` on unsafe methods, use cookie credentials, decode contracted Problem errors and maintain a single session owner. | Unit/component tests for bootstrap, CSRF, unknown-code fallback and stale state; AC-P06-03, 06, 09. |
| FE-P06-02 | Accessible sign-up, verification/resend, login and logout routes/forms using DD-P06-13's exact canonical route/alias table; verification token from `#t=` or legacy `#token=`, clear fragment after capture, no-referrer policy, session refresh and truthful unverified state. Use history replacement for aliases, including `/auth/verify-email`. | Existing `/auth/*` component/E2E tests and new canonical/redirect tests; success and generic errors, keyboard and narrow view; AC-P06-01…03, 10. |
| FE-P06-03 | Reset request/confirm at `/reset-password` and `/reset-password/confirm`, including `/auth/password-reset` and `/auth/password-reset/confirm` aliases; re-auth and password change UI; clear sensitive form data and session state after completion; show recoverable errors without echoing secrets. | Component/E2E valid, expired, wrong-password and stale-reauth cases; AC-P06-04, 05, 10. |
| FE-P06-04 | Account deletion screen with explicit confirmation after fresh re-auth, then clear local signed-in state and navigate safely. | Component/E2E confirm/cancel and stale re-auth cases; AC-P06-07, 10. |
| FE-P06-05 | Verified/fresh-re-auth download of the P06 `AccountDataExport` JSON response, accurately labelled as JSON. Preserve `no-store` and avoid console/telemetry content. Do not claim the final ZIP/PDF/TXT archive exists. | Component/E2E verified, unverified and denial paths; AC-P06-08, 10. |
| FE-P06-06 | A bounded claim confirmation component accepting a draft summary and explicit Save/Discard callbacks, with no upload unless confirmed. P08 supplies IndexedDB draft and invokes P07 create/photo operations. No fake persistent draft. | Component test for no-draft, Save and Discard; AC-P06-10. |
| FE-P06-07 | Run focused component checks, frontend CI and integrated account E2E sequentially; record exact exits/limits. | Test-results section for AC-P06-01…05, 07, 08, 10. |
| FE-P06-08 | Establish the P06 application visual system in P05's `frontend/src/app/shell.css` Tailwind 4 `@theme`: retain ink/surface/accent/line, add the documented panel/muted/warm/danger/focus roles, system-font scale, spacing, radius, elevation and reduced-motion rules. Build reusable native `AppFrame`, `Surface`, `Button`, `TextField`, `PasswordField`, `FieldError`, `StatusNotice`, `Badge`, `Dialog`, `LoadingSkeleton` in `frontend/src/shared/ui/**`. Keep application tokens separate from document template typography. | Rendered account components show the documented token roles and focus/contrast behavior, with no remote fonts/icons/trackers; AC-P06-12/13. |
| FE-P06-09 | Finish responsive account screen compositions in `frontend/src/features/account/**` and route pages: 1280 px split auth layout, 1024 px transition, 390 px one-column forms, settings section navigation and bounded deletion/re-auth dialogs. Implement documented loading, error, pending, success, disabled, retry and signed-out states. Use [05-create-new-modal.png](../../../source/img/05-create-new-modal.png) only for overlay hierarchy, not its gallery; use [15-contact-step.png](../../../source/img/15-contact-step.png) only for form rhythm, not its stepper or prefilled fields. | Synthetic-state desktop/phone screenshots, 200% zoom, keyboard focus/return and reduced-motion behavior match the design; AC-P06-10, 12, 13. |
| FE-P06-10 | Review rendered P06 screens against `ui-ux-design.md`; record any intentional deviation with reason and updated local evidence. Keep the shared controls usable for P07 library and P08 editor without styling document preview/PDF. | Reviewer and QA can compare representative local screenshots and interaction states to the P06 design; AC-P06-12/13. |

Do not introduce a Google provider, external auth SDK, guest backend endpoint, browser JWT storage or fabricated archive. A contract gap goes to the Solution Architect for a separate Contract Architect step.

## Frontend Developer green evidence — 2026-11-03

Implemented FE-P06-01…09 in the allowed frontend paths: contract-derived session and JSON export types, same-origin CSRF client, canonical routes and aliases, account forms and settings, re-authenticated sensitive actions, claim prompt, and the P06 shared visual controls. FE-P06-10 automated visual review used the synthetic Playwright desktop and phone captures, responsive/axe assertions and reduced-motion cases; reviewer and QA still own manual comparison and real 200% browser zoom. The browser fixtures use synthetic sessions and account data; live backend account journeys remain for integrated QA.

| Exact command (repository root) | Exit | Result |
|---|---:|---|
| `npm ci --prefix frontend --no-audit --no-fund` | 0 | Installed pinned frontend dependencies. |
| `npm ci --prefix tests/e2e --no-audit --no-fund` | 0 | Installed pinned browser-test dependencies after the initial focused run failed at collection because `@axe-core/playwright` was absent. |
| `npm test --prefix frontend -- src/features/account` | 0 | 26/26 P06 account RTL tests passed on the final run. |
| `npm run typecheck --prefix frontend` | 0 | Generated contract types and TypeScript check passed. |
| `npm run build --prefix frontend` | 0 | Production build passed after final fragment/focus fixes. |
| `npm test --prefix tests/e2e -- account.spec.ts --project=chromium` | 0 | 32/32 focused browser tests passed on the final run; earlier red runs exposed duplicate accessible text, focus return, repeated hash navigation and missing local dependencies, all addressed without test edits. |
| `bash scripts/ci/frontend.sh` | 0 | Final frontend CI, including lint, typecheck, Vitest, build and image scan, passed. |
| `bash scripts/ci/e2e.sh` | 0 | Full Chromium, Firefox and WebKit browser suite: 117/117 passed. These are fixture-backed browser checks, not live API integration. |
| `git diff --check` | 0 | No whitespace errors. |

No tests, contract, backend or source specification files were modified. Integrated sign-up, verification, reset, session revocation, deletion purge, and owner-scoped export still require the live P06 backend and QA gate; complete archive/guest-draft persistence remain assigned to later phases.

## Owner-requested frontend follow-up — 2026-11-03 (in progress)

The earlier green results above describe the initial implementation only. Continued review found a real contract defect in password change (POST instead of PUT) and gaps in session bootstrap/loading, field validation and sensitive-action recovery. This follow-up replaces the fixture-specific flat-session fallback with the contracted `SessionInfo.user`, adds one session owner with stale-response protection, enforces contract methods at compile time, bootstraps CSRF for anonymous unsafe requests, refreshes session after mutations, validates and associates field errors, and requires a separate final deletion confirmation after fresh re-authentication. Credentials and consumed link tokens are cleared; external login return targets are rejected. Components are split into readable form/session/settings modules, shared dialog focus restoration is retained, and the README names the same-origin live-integration requirement.

Test Engineer corrections requested through `msg_99bb697b88b5` were merged by the coordinator; no test file was edited by this developer. The remaining original synchronous `/account` RTL route case and reset-request browser bootstrap fixture were reported in `msg_732a62fa3edf`. Current checks below supersede the original full-green claim until those cases are corrected and rerun.

| Exact command (repository root) | Exit | Result |
|---|---:|---|
| `npm run typecheck --prefix frontend` | 2 then 0 | Compile-time method checking exposed the old POST password request; after using PUT and correcting optional field prop types, TypeScript passed. |
| `npm run lint --prefix frontend` | 0 | Follow-up production code passes lint. |
| `npm run build --prefix frontend` | 0 | Latest follow-up production bundle builds. |
| `npm test --prefix frontend` | 1 | Latest run: 38/39 pass; the original synchronous `/account has a named account action` case asserts a private action before the session resolves without providing a session fixture. Newly added asynchronous loading and PUT/CSRF checks pass. |
| `npm test --prefix tests/e2e -- account.spec.ts --project=chromium` | 1 | Latest run: 31/33 pass. Anonymous settings link underline is a genuine axe finding and is corrected in the current CSS; reset request still lacks the required anonymous session-bootstrap fixture. Rerun pending after fixture correction. |
| `node --input-type=module` (inline Playwright probe) | 0 | Supplementary contract-shaped fixtures verified CSRF bootstrap/echo, PUT password, explicit deletion confirmation/cancel, unverified export denial, JSON download, rejected external return, and axe/reflow at 1280/1024/640/390 px. This is supporting review evidence, not a replacement suite pass. |
| `git diff --check` | 0 | No whitespace errors. |

Inspected `/tmp/p06-review-login-1280.png` and the masked `/tmp/p06-review-settings-390.png`: auth split, 480 px form, opaque surfaces, wrapping settings nav, spacing and action hierarchy follow the local design. Temporary review captures also cover 1024/640 widths. Actual browser zoom, integrated backend journeys, and the formal QA comparison remain with QA; no live backend or full archive completion is claimed.

## Frontend follow-up complete — final verification (2026-11-03)

The coordinator merged the Test Engineer's remaining account-route and reset-bootstrap fixture corrections (`msg_34f504654a1b`). All follow-up checks are now green. The full browser regression additionally caught session discovery on P05's API-free placeholder routes; session bootstrap is now activated only for the canonical account routes and their approved aliases. Final screenshot review found and fixed Tailwind's reset of native dialog margins, restoring a centered overlay and a 20 px dialog title. Password fields also clear after a pending request finishes, including characters typed during the request. The header now exposes the account route, and retry loading is handled by an explicit event action.

| Exact command (repository root) | Exit | Final result |
|---|---:|---|
| `npm test --prefix frontend -- src/features/account` | 0 | 30/30 account RTL tests pass, including the new contract-method, CSRF/bootstrap and loading guard checks. |
| `bash scripts/ci/frontend.sh` | 0 | Lint, generated API types/typecheck, all 40 frontend tests, production build and image/security checks pass. |
| `npm test --prefix tests/e2e -- account.spec.ts --project=chromium` | 0 | All 33 account cases pass, including safe external-return rejection and session refresh. |
| `bash scripts/ci/e2e.sh` | 1 then 0 | First broader run: 108 pass, 12 P05 shell assertions fail because global bootstrap made API requests on shell routes. After restricting bootstrap, the suite passes. Latest rerun after the dialog-centering CSS fix: frontend CI prerequisite passes (40/40 unit tests) and all 120 browser tests pass across Chromium, Firefox and WebKit. |
| `npm run lint --prefix frontend` | 1 then 0 | A retry-loading state update inside the bootstrap effect was rejected by the React lint rule; moving it into the explicit retry event resolved the issue. Final CI above verifies lint again. |
| `git diff --check` | 0 | No whitespace errors. |

Reviewed the generated Chromium phone login-error and deletion-dialog captures and desktop verification-success/failure captures under `tests/e2e/test-results/account-P06-twelve-synthet-*/`; together with the earlier inspected login/settings states, these confirm the specified hierarchy, field/error grouping, status colors, wrapping settings nav, centered bounded overlay and action placement. All twelve requested synthetic states are captured at 1280/390 px in each engine by the passing suite. No intentional visual deviation is introduced. Formal reviewer/QA comparison, real browser 200% zoom, and live backend sign-up/verification/reset/revocation/deletion/export journeys remain integration evidence; frontend fixture results do not claim those backend behaviors or the later P13 archive.

## Review fix M-4 — 2026-11-04

Scope: coordinator Instruction #N, based on integrated phase/P06 commit `eb83f03` and the Test Engineer's four new red RTL cases. The API client now interprets the frozen contract's `400 validation_failed` `errors[]` entries: body pointers `/password` and `/newPassword` map `password_too_short`, `password_too_long`, and `password_too_common` to fixed, actionable messages. The submission hook exposes those messages to the corresponding fields, preserving `aria-invalid` and help/error associations on sign-up, reset and password-change forms. It also supplies the announced error summary, ignores unknown issue codes through the existing generic fallback, and never renders submitted values or raw server details.

Reset confirmation clears its in-memory token after successful redemption or `token_invalid`. Password-policy validation leaves the still-valid token available for an explicit retry while the password field is cleared; the URL fragment remains removed and no token is written to browser storage. A successful reset clears the token before session refresh, so a later refresh failure cannot retain a consumed token.

Minor m-4: API fetches now explicitly use `referrerPolicy: 'no-referrer'`, and the token-page document meta policy remains. The **document HTTP response header** still requires the serving web host/reverse proxy to emit `Referrer-Policy: no-referrer`, including direct loads of `/reset-password/confirm` and `/verify-email` and their aliases. This cannot be emitted by the scoped React `frontend/src` code; retain it as the P15 hosting follow-up identified by the reviewer. No response-header completion is claimed here.

Checks were run sequentially, with no edits to tests, contract or backend:

| Exact command (repository root) | Exit | Result |
|---|---:|---|
| `npm test --prefix frontend -- src/features/account` | 1 | Before implementation: 30 pass, four new assertions fail on missing policy messages and lost reset-token retry. |
| `npm test --prefix frontend -- src/features/account` | 0 | After implementation: all 34 account RTL tests pass. |
| `npm test --prefix frontend` | 0 | All 44 frontend tests pass across six files. |
| `npm run lint --prefix frontend` | 0 | No lint errors. |
| `npm run typecheck --prefix frontend` | 0 | Generated contract types and TypeScript check pass. |
| `bash scripts/ci/frontend.sh` | 0 | Frontend CI passes, including all 44 tests, build and image/security check. |
| `bash scripts/ci/e2e.sh` | 0 | Frontend prerequisite passes, followed by all 120 browser tests across Chromium, Firefox and WebKit. |
| `git diff --check` | 0 | No whitespace errors. |

Modified production files: `frontend/src/shared/api/client.ts`, `frontend/src/features/account/forms.ts`, `frontend/src/features/account/Account.tsx`, and `frontend/src/features/account/AccountSettings.tsx`. Next owner: coordinator/reviewer to recheck M-4; P15 hosting owner retains the response-header portion of m-4.
