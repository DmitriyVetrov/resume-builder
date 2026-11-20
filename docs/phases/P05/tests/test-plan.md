# P05 Test Plan — Frontend Foundation

- Owner: Test Architect, 2026-11-03.
- Basis: [acceptance criteria](../acceptance-criteria.md), [kickoff budget](../kickoff.md), [phase plan](../architecture/phase-plan.md), ADR-040 and ADR-050. P05 proves a structural shell, not a working resume editor or API integration.
- Sequence: Test Engineer writes and observes meaningful red tests before implementation; Frontend Developer makes them green; QA checks browser and manual cases. Record exact commands, exit codes and actual results in `test-results.md`. An import error or unavailable Docker daemon is not a behavioral red or a pass.

## Budget and test assets

Use at most four focused Vitest/React Testing Library files under `frontend/src/**`, one `tests/e2e/shell.spec.ts`, and one `docs/phases/P05/tests/suite.cmd`. Extend the existing Playwright `testMatch` so the P03 smoke spec and P05 shell spec both run, retaining Chromium, Firefox and WebKit. Use the existing lint, strict typecheck, test, build, preview, frontend CI and E2E CI commands. The suite calls those jobs and a frontend-local image build/runtime/OSV check. No new runner, fixture tree, visual baseline, backend service or API mock is needed.

| Proposed file | Level and focused behavior | Expected red before implementation |
|---|---|---|
| `frontend/src/app/routes.test.tsx` | RTL route table: landing, library, editor URL, links, unknown URL and home recovery | Named routes and not-found view are absent |
| `frontend/src/widgets/shell-navigation.test.tsx` | RTL semantic regions, heading, labelled navigation, inert placeholders and keyboard activation | Accessible shell regions and controls are absent |
| `frontend/src/app/route-error.test.tsx` | RTL boundary: injected route error, generic fallback, recovery and normal route | Routed error boundary is absent |
| `frontend/src/widgets/editor-panels.test.tsx` | RTL panel selection, Sections/Edit/Preview/Design state and hidden-panel focus | Narrow-screen panel state is absent |

Test accessible roles and behavior, not DOM snapshots, Tailwind classes or private state. RTL/jsdom cannot prove pixel layout, overflow, browser history or network behavior; Playwright checks those against the production build in Vite preview. Preserve the existing P03 canary and external-request guard.

## Acceptance mapping

| Must criterion | Positive cases and level | Negative/boundary cases and level | Fixture/setup |
|---|---|---|---|
| **AC-P05-01** independent build | CI: locked install, ESLint, strict `tsc`, Vitest and Vite build exit 0. E2E: preview serves `/` without backend. | Confirm an invalid TypeScript import/type makes the check nonzero in a disposable copy, then discard the copy; E2E denies `/api/**` and shell still renders. | Existing lockfile and Node 24; no backend process. |
| **AC-P05-02** routing | RTL: `/`, `/resumes`, `/resumes/fixture-id/edit` render intended shells and internal links. E2E: links, back/forward, direct deep-link refresh in all three engines. | RTL/E2E: unmatched URL renders labelled not-found and working home link, never editor or blank app. | Fictional URL segment `fixture-id`; fresh browser context; no resume data. |
| **AC-P05-03** responsive shell | E2E: at 1280 px Sections, Edit and Preview are distinct and visible; at 390 px four controls reveal Sections/Edit/Preview/Design placeholders, with page `scrollWidth <= clientWidth`. RTL: panel state changes on activation. | E2E: keyboard alone switches all panels; hidden panels contain no tabbable descendants or focus trap. Include the 1024 px breakpoint edge if the case can share setup. | Same editor URL; reset viewport and focus per case. |
| **AC-P05-04** accessibility | RTL: main landmark, page heading, labelled nav/controls, skip target and accessible error fallback. E2E: visible focus; axe WCAG 2.1 A/AA has zero violations on landing, editor and not-found across three engines. QA: keyboard and 200% zoom smoke at 390 px. | RTL: missing label or broken keyboard activation fails role/interaction assertions; keyboard activates error recovery. E2E: not-found home works without pointer; no clipped reachable controls. | Exact-pinned `@axe-core/playwright`; deterministic shell pages. QA records engine and viewport. |
| **AC-P05-05** safe errors | RTL: test-only routed component throws a fictional sentinel; boundary shows generic message and recovery returns to working route. | RTL: sentinel, stack and fictional contact/token strings are absent from rendered output and captured console calls; normal route never shows error view. Never print captured values in results. | Synthetic strings only, no real resume/contact/token data. Restore console spy after test. |
| **AC-P05-06** contract/privacy boundary | CI: types regenerate from `contracts/openapi/openapi.yaml` into ignored `frontend/src/shared/api/generated/` before typecheck/test/build; typed same-origin `/api/v1` wrapper compiles. E2E: shell navigates with `/api/**` denied and zero API calls. | Suite/review: generated folder ignored and untracked; no handwritten DTO, invented endpoint, remote font/CDN/analytics request or operational save/export/account control. Existing external-request guard remains green. | Frozen P02 contract and single pinned `tests/contract` installation; no Prism, credentials or resume body. |
| **AC-P05-07** web image | Suite: build frontend-local multi-stage image from digest-pinned bases; inspect non-root default user, serve root and direct editor deep link, and run pinned OSV image scan with no unwaived finding. | Suite: root runtime or deep-link 404 fails; build or scan nonzero is failure, never a skip/pass. | Local image tag, ephemeral mapped port and disposable container; clean up afterwards. |

The wrapper makes no request during P05. Typechecking confirms its contract-derived signature; live HTTP, CSRF and authentication behavior belongs to P06+. Static checks inspect only relevant source and generated-output metadata. If a forbidden behavior cannot be reliably checked by script, Code Reviewer and QA inspect it explicitly; do not count that inspection as an automated pass.

## Deterministic execution and commands

| Exact command from repository root | Purpose |
|---|---|
| `npm test --prefix frontend -- src/app/routes.test.tsx` | Narrow route red/green; repeat analogously for the other three named files. |
| `bash scripts/ci/frontend.sh` | Locked install, lint, strict typecheck, unit tests and production build; frontend scripts regenerate API types first using ADR-040's existing pinned installation. |
| `npm test --prefix tests/e2e -- shell.spec.ts --project=chromium` | Fast preview-backed browser red/green after `testMatch` update. |
| `bash scripts/ci/e2e.sh` | Existing P03 smoke plus P05 shell spec in three pinned engines. Run after build, sequentially with other Docker jobs. |
| `bash docs/phases/P05/tests/suite.cmd` | Handoff suite: frontend job, E2E job and frontend-local image build/runtime/OSV check in sequence. Record image digest, scanner date and any finding or skip. |

The Test Engineer defines the image check in the one P05 suite script or a frontend-local script it invokes, using the already pinned OSV-Scanner image from `infrastructure/images.lock`. Do not edit root CI, Compose or the lock in this parallel branch. Every intended red must fail because behavior is missing; repair harness errors before handoff. The suite must propagate every nonzero exit.

## Risks and limits

| Risk or limit | Response / owner |
|---|---|
| Three pinned browser engines are not NFR-05's latest-two-version matrix | Record engine results; P14 owns the full matrix. |
| Axe misses keyboard, focus and zoom defects | QA checks keyboard, 390 px and 200% zoom, including not-found and recovery. |
| Structural shell could look functional | Assert placeholders are labelled and inert; later phases test real save, export and account flows. |
| Preview fallback differs from production host | P05 tests Vite preview and local web image deep links; P15 tests production. |
| Generated types or wrapper drift | Regenerate from frozen OpenAPI before checks; no committed generated output or handwritten schema. |
| OSV findings change with advisory publication | Record scanner date, ID and exit; an unwaived finding blocks AC-P05-07. |
| Shared web Compose/CI/image-lock wiring is outside this slice | Coordinator integrates it after P04/P05 converge (DD-P05-06). |
| Finished-editor behavior is unbuilt | NFR-02 p95, FR-EDT-01 live preview, FR-EDT-07 full phone behavior and completed-editor WCAG remain with P07–P14. |

No extra Should tests are proposed within this budget. Next owner: Test Engineer for the four files, Playwright spec, `suite.cmd` and red evidence.

## Test Architect verification

| Exact command | Exit code | Result |
|---|---:|---|
| `git diff --check` | 0 | No whitespace errors in the plan. |
| `python3 scripts/phase-handoff-check.py --phase P05 --role test-architect --worktree .` | 0 | `RESULT PASS`; role scope one file, blueprint check 0. The checker warned that `suite.cmd` is not present yet; the Test Engineer owns it. |

No application or acceptance test was run by the Test Architect; the executable tests are the next step.
