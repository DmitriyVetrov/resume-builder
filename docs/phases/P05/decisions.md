# P05 Decisions

All decisions below are `DELEGATED-DEFAULT` under ADR-035 A-4. Precedence: TECHNICAL-SPEC, reference-product evidence where relevant, then the conservative and reversible standard choice. [ADR-050](../../blueprint/decisions/ADR-050-frontend-foundation-routing-and-state.md) is Accepted by the Solution Architect (delegated, ADR-035).

| ID | Question and options | Answer and reason | Source |
|---|---|---|---|
| DD-P05-01 | Router: React Router declarative, Data/Framework mode, or manual History API? | **React Router declarative**. It covers URL matching and navigation without introducing route loaders or another framework; a standard reversible shell choice. | ADR-003; ADR-050 §Decision 1; NFR-05 |
| DD-P05-02 | State library now, later, or shared global editor store? | **No new server/form state library in P05.** The shell has only local navigation/display state. Later phases choose against real API and editor workflows. This avoids duplicate ownership and speculative dependencies. | ADR-008 F-FE-2; ADR-050 §Decision 2; ADR-040 |
| DD-P05-03 | Error handling: blank failure, global crash page, or routed boundary with recovery? | **Routed error boundary with recovery.** Unknown URL gets its own not-found page; caught errors show no data or stack. | ADR-050 §Decision 3; NFR-06/NFR-09 |
| DD-P05-04 | Editor shell: fake working controls or labelled structural placeholders? | **Structural placeholders only.** Later phases implement title, save state, editor actions and preview against their full requirements; P05 must not imply they work. | TECHNICAL-SPEC §§3.2, 5.3; ADR-050 §Decision 4 |
| DD-P05-05 | Accessibility smoke: Playwright axe or manual only? | **Playwright + `@axe-core/playwright` and manual QA keyboard/zoom.** Axe catches common violations; manual checks cover interaction. Pin the package exactly. | ADR-041 P05 candidate; NFR-06; Playwright official accessibility guidance |
| DD-P05-06 | P03 web-container obligation: edit shared root files in parallel, omit the image, or split local image work from shared wiring? | **Build and check the web image in frontend-local scope; coordinator wires shared Compose/CI/image-lock files after P04/P05 converge.** This preserves disjoint source ownership and exposes the integration follow-up before the phase gate. | P05-OBL-P03-02; ADR-042; ADR-050 §Decision 5 |
| DD-P05-07 (`DELEGATED-DEFAULT`) | F-03 caught-error logging: share a React root handler with the RTL root, or mutate global console behavior inside `App`? | **Share a silent root handler.** The Frontend Developer exports `suppressCaughtErrorLogging` from `frontend/src/app/error-handlers.ts` (a no-op that never reads or logs the error) and passes it as `onCaughtError` in `frontend/src/main.tsx`. The Test Engineer passes that export as `onCaughtError` in the `render` options in `frontend/src/app/route-error.test.tsx`, after recording the current sentinel assertion's red result; RTL 16.3.0 forwards this option to its own root. The Test Engineer then verifies green with the same sentinel assertion. No global console mutation in `App`. | F-03; AC-P05-05; `.claude/rules/03-security-privacy.md` |

The fixed P02 OpenAPI v1.0.0 contract is read-only in P05. There is no P05 operation, and no Contract Architect dispatch. D-05/D-06 (P07) and D-12/D-14…D-19 (P10) do not affect this shell. The ADR-003 register row should link ADR-050 after this phase merges; `docs/blueprint/DECISION-REGISTER.md` is outside this dispatch's allowed paths, so the coordinator owns that follow-up. P05-OBL-P03-03 also requires the developer to reassess the existing `minimatch` override as dependencies are added.

## Architect verification and handoff

From the P05 worktree on 2026-11-03:

| Exact command | Exit code | Result |
|---|---:|---|
| `python3 scripts/phase-handoff-check.py --phase P05 --role solution-architect --worktree .` | 0 | `RESULT PASS`; role scope 8 files, phase scope 10 changed files, blueprint check 0; `WARN no suite.cmd yet` because the Test Engineer has not written it |
| `git diff --check` | 0 | No whitespace errors |

No P05 application or acceptance test was run by the Architect; test files and implementation are future steps. Risks: the web image's shared CI/Compose/image-lock wiring and the ADR-003 register link require coordinator work outside this dispatch's file grant. Next owner: Test Architect for `tests/test-plan.md`, then Test Engineer for red tests and `tests/suite.cmd`.

## DD-P05-07 follow-up verification (2026-11-03)

`python3 scripts/phase-handoff-check.py --phase P05 --role solution-architect --worktree .` exited 1: `RESULT FAIL` because five concurrently uncommitted `frontend/**` files owned by the Frontend Developer triggered `ROLE_SCOPE`; the check also reported blueprint exit 0 and two informational red suite steps. This dispatch changed only `docs/phases/P05/decisions.md`; no application test was run by the Architect. The coordinator was notified to resolve the shared-worktree check ordering.

## Integration follow-up (DD-P05-06)

After P04/P05 convergence, the `web` Compose service was added under the `app` profile with a loopback-only port, image build and healthcheck. The Node and nginx base-image digests are recorded in `infrastructure/images.lock`; the frontend CI script now generates API types explicitly, then builds and OSV-scans the image through the P05 image check. ADR-050 is registered and linked from ADR-003; infrastructure and frontend usage notes are updated. No workflow change was required because the existing frontend job calls `scripts/ci/frontend.sh`.

| Exact command | Exit code | Result |
|---|---:|---|
| `python3 -B -m unittest discover -s tests/infrastructure -p 'test_*.py'` (initial) | 1 | Existing static policy expected only Playwright in E2E dependencies; P05 added the approved axe dependency. |
| `python3 -B -m unittest discover -s tests/infrastructure -p 'test_*.py'` (after extending assertion) | 0 | 41 tests passed. |
| `bash scripts/ci/local.sh frontend` (initial) | 1 | Typecheck lacked generated API types because CI disables npm lifecycle scripts. |
| `bash docs/phases/P05/tests/image-check.sh` | 0 | Web image built, direct routes and non-root identity checked, OSV image scan found no issues. |
| `docker compose config >/tmp/resumiser-compose-config.txt` | 0 | Compose resolved. |
| `python3 scripts/check-blueprint.py` | 0 | Blueprint structure OK. |
| `bash scripts/ci/local.sh frontend` (after explicit API generation) | 0 | Lint, typecheck, 10 Vitest cases, build, web runtime and OSV image scan passed. |

The image check briefly received a connection reset while nginx started, then passed within its retry loop. No outstanding implementation change is known for this follow-up; the coordinator owns the integration gate.
