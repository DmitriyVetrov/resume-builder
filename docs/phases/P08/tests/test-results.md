# Test Results

Exact commands, environment, exit codes and counts, red before green. Never mark tests passed without running them.

## Step 4 — Red (2026-11-05)

Environment: Linux 6.12, Node 24.22, Playwright image from `infrastructure/images.lock` (digest-pinned), Chromium for the red proof. Seams are declaration-only: pure modules throw `not implemented`, and the route still shows the P05 placeholder. No editor behaviour exists.

| Command | Exit | Result |
|---|---|---|
| `npx tsc --noEmit` (in `frontend/`) | 0 | clean: tests and seams compile |
| `npx vitest run` (in `frontend/`) | 1 | **91 failed**, 79 passed, of 170 |
| `npm run build` (in `frontend/`) | 0 | SPA built for E2E |
| `npx playwright test editor.spec.ts shell.spec.ts --project=chromium --timeout=8000` (in the pinned container) | 1 | **19 failed**, 1 passed |

Why they fail, all intended; hosts and fixtures started:

- `history`, `crop`, `autosave`, `operations`, `contact-link` (65 cases): the seam's `not implemented`.
- `workspace.test.tsx` (24 cases): `findByRole('textbox', { name: 'Resume title' })` finds nothing on the placeholder.
- `routes.test.tsx` (1): no `open your resumes` link yet. `account.test.tsx` AC-LOGOUT-2 (1): no local-data dialog yet; AC-LOGOUT-1 passes because it pins today's one-click logout, which must stay.
- `editor.spec.ts` (18): `expect(title).toBeVisible()` in `open`; the page renders, the control is missing. `shell.spec.ts` `/` (1): no library link yet; `/missing` still passes.
- `editor-panels` and `shell-navigation` pass at red: the placeholder has the same panel markup, so they guard the markup through the replacement.

`npm run lint` reports only unused `_` parameters of the throwing seams, which go with the implementation.

## Step 5 — Green (2026-11-05)

Same environment. Implementation of slices 1–6, no contract or backend change.

| Command | Exit | Result |
|---|---|---|
| `npx tsc --noEmit`, `npx eslint src` (in `frontend/`) | 0 | clean |
| `npx vitest run` (in `frontend/`) | 0 | **170 passed**, 14 files |
| `npx playwright test` in the pinned container, via `scripts/ci/e2e.sh` | 0 | editor, shell, library, account and smoke specs green in Chromium, Firefox and WebKit, with `retries: 0` |
| `python3 scripts/phase-handoff-check.py --phase P08 --step green` (with `.claude/settings.json` stashed, see below) | 1 | Suite green (5 of 5 commands, exit 0). **Its only FAIL lines are `PHASE_SCOPE` for `docs/phases/P09/**`**, because the single-phase form does not know the batch; the batched form runs at the end of P09's step 5. |

`.claude/settings.json` holds an uncommitted owner edit on `main`, unrelated to this phase, so the scope check counts it. It is stashed around each check and restored unchanged.

Test files changed during green, for the external review. None weakens an assertion:

| File | Change and reason |
|---|---|
| `autosave.test.ts` | Harness: `statuses` is cleared after the opening `start()`, because the status of opening is not an answer to a write (A07, A08 would otherwise see a `saved` from before the write). `named()` shares one base document, because fresh random IDs made "back to the acknowledged document" (A20) a different document. |
| `workspace.test.tsx` | `W07`: a query that matched the app header's `Resumes` link too is scoped to `main`, and now also asserts the `href`. `beforeEach` removes local data, because drafts left by earlier tests were correctly recovered by later ones. |
| `editor.spec.ts` | `dragTo` drops on the upper part of the target; the first version dropped below the middle, which by design means after it. `E09`'s expected order is written out. `E10` uses `exact: true` for `Title` and closes the open entry before dragging, so the drop target is on screen in Firefox. `E13` types with real key presses, since Firefox shows `beforeunload` only after a user gesture. `E15` uses `exact: true`, since the notice has `Undo restore`. `E17`'s Design step became a real assertion plus axe. |

Defects the tests found in the implementation, all fixed: a draft-removal race in the queue; `runExclusive` marking unsent edits acknowledged; the running queue able to write a draft back after sign-out removal; a posted message on a closed `BroadcastChannel`; section list markup failing `aria-required-children`; `Dialog`'s microtask taking focus from the control an effect had just focused; the new-section focus request firing again on later selections.

## A flaky harness, found and fixed (2026-11-05)

`W16` failed once in a full `npx vitest run` that ran while the Codex review loaded the machine. It was not ignored and not retried away.

| Step | Command | Result |
|---|---|---|
| Repeat alone | `npx vitest run`, four times | 255 passed each, so load-dependent |
| Reproduce | six parallel `npx vitest run src/features/editor/workspace.test.tsx` | failures in `W06`, `W15`, `W16` |
| First theory | timeouts | **Wrong:** these are synchronous assertions right after an edit |
| Trace | temporary logging in `session.ts`, removed afterwards | `apply` ran normally: history present, not locked, not disposed. So the store was right and the DOM was stale |
| Cause | | `findBy` can resolve after a commit whose passive effects have not run, and `useSyncExternalStore` subscribes in those effects. An event fired in that gap updates the store; the DOM catches up when React subscribes and finds the snapshot changed. Not a product defect: no edit is lost, and the window is milliseconds after first paint |
| Fix | `workspace.test.tsx`: `open` and `W04` wait until the workspace's window listeners, registered in the same effect flush, exist | no assertion changed |
| Verify | the same six parallel runs, four rounds | **24 of 24 runs, 25 of 25 tests each** |

## Step 7 — Real-stack acceptance run (2026-11-05)

Environment in `qa-report.md`. A fresh stack per run.

| Command | Exit | Result |
|---|---|---|
| `npx playwright test -c playwright.real.config.ts --timeout=120000` in the pinned container, with `RESUMISER_QA_EVIDENCE=/work/docs/phases/P08/qa-evidence` | 0 | **R01–R10: 10 passed** |
| `grep` of the API log for the account, names, canary, entry text and password | — | 0 hits in 310 lines; 0 `fail` or `crit` lines |

Earlier runs of this spec failed and led to the fixes listed in `qa-report.md`. Spec-only corrections on the way: one shared account, because the real `auth-email` limit allows 5 sign-ups per 10 minutes; `R06` tests both the per-field and the total-text refusal, after its first assertion assumed the wrong one.

`workspace.test.tsx` `W02` gained the keyboard-scroll assertion (addition). The full batched suite is recorded by the gate below.

## Gate run 1 failed: `E17` over its time budget (2026-11-05)

`python3 scripts/phase-handoff-check.py --phase P08+P09 --gate` exited 1 with `SUITE_RED`: `scripts/ci/e2e.sh` failed. A direct run of the job gave 236 passed, 1 failed: `E17` in Firefox, `Test timeout of 30000ms exceeded` inside `AxeBuilder.analyze`. Alone, with a 120 s budget, it passed 3 of 3 in 20 to 24 s, and it took 20.9 s and 22.5 s in Chromium and WebKit in the failing run. So the scenario is close to the default limit in every browser, not broken in Firefox. Fix: `test.setTimeout(90_000)` on this scenario only. No assertion changed and no retry was added.

## Step 8 — Gate (2026-11-05)

`python3 scripts/phase-handoff-check.py --phase P08+P09 --gate`, with `.claude/settings.json` stashed around it and restored unchanged. Exit 1 on the first run (`E17`, above), **exit 0 on the second, `RESULT PASS`**: scope 105 files; blueprint OK; suite 7 of 7 commands exit 0, including Vitest 255, Playwright in three browsers with `retries: 0`, contract suite, and the backend job with `ResumeBuilder.Api.Tests` 249 passed; artifacts and verdicts of both phases PASS.

## Amended existing tests (DD-P08-12)

Each is listed for the external review; no assertion was weakened beyond what the entry states.

| File | Change |
|---|---|
| `frontend/src/widgets/editor-panels.test.tsx` | Opens a fixture resume through a stubbed API instead of a route without data. All tab assertions unchanged. |
| `frontend/src/widgets/shell-navigation.test.tsx` | Same. The inert-shell assertion "no save or export button" is removed: the top bar now has them by requirement, and `W01` asserts status and disabled exports. |
| `frontend/src/app/routes.test.tsx` | The landing link now goes to the library, since `/resumes/fixture-id/edit` is no longer a route with content. |
| `tests/e2e/shell.spec.ts` | `/resumes/fixture-id/edit` leaves the no-API list; `editor desktop regions and narrow keyboard panels` moved verbatim to `editor.spec.ts` as `E16`, on a fixture resume, with more overflow checks. Heading and axe checks are in `E16` and `E17`. |
| `tests/e2e/playwright.config.ts` | `editor.spec.ts` added to `testMatch`. |
| `frontend/src/features/account/account.test.tsx` | Additions only. |
