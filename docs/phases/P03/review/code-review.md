# Code Review — P03 Infrastructure & DevEx

- Reviewer: Code Reviewer (Orca worker, task `task_e1f3de50ed82`), 2026-11-03. One pass (ADR-035 B-2).
- Target: `git diff main...HEAD` at `64937a5` (62 files), plus the working tree as found.
- Inputs read: `PHASE.md`, `kickoff.md`, `acceptance-criteria.md`, `architecture/phase-plan.md`, `decisions.md`, `tests/test-results.md`, `implementation/*-tasks.md`, `coordinator-log.md`, ADR-041/042, every production and test file in the diff.

Pass 1 result (superseded by the delta re-review below): FAIL

No blocker or critical finding. The verdict is FAIL because six major findings leave Must criteria (AC-P03-07, AC-P03-11, AC-P03-13) or a required deliverable (PLT-10, BE-P03-05, FE-P03-07) unmet or unproven. Every fix is small. A re-review covers only the files listed in "Required before PASS".

## What I verified (commands run by me)

| Check | Command / method | Result |
|---|---|---|
| Image digests match their tags | `docker buildx imagetools inspect <tag> --format '{{.Manifest.Digest}}'` for all 10 `infrastructure/images.lock` entries | all 10 equal the pinned digest |
| Action SHAs match the comments | `git ls-remote https://github.com/actions/<repo>` | `checkout` v4.2.2 and `setup-node` v4.4.0 match. **`setup-dotnet` does not** (F7) |
| npm lockfiles | grep of `resolved` and `integrity` | 340 `resolved` URLs, all `https://registry.npmjs.org`; 336 of 336 frontend entries carry `integrity`; no git/http/file sources |
| NuGet | `nuget.config` has `<clear/>`, nuget.org only, source mapping; lockfile committed; `--locked-mode` in `backend.sh`; central versions, exact | OK |
| Secrets | `bash scripts/ci/security.sh` (my run) | exit 0: static policy 14/14, gitleaks tree and 48 commits "no leaks found", OSV contract scan filtered exactly 6 waived findings, OSV frontend, e2e and backend locks "No issues found", actionlint and shellcheck clean. Grep of the diff for credential patterns: nothing |
| Scope | file list vs phase-plan "Allowed paths" | every changed file is inside; `contracts/**`, `tests/contract/**`, `.claude/**`, `docs/source/**`, `CLAUDE.md` and governance scripts are untouched |
| Test integrity | `git diff 8cc4989 HEAD -- tests/infrastructure docs/phases/P03/tests/suite.cmd backend/tests` | see "Test integrity" below |
| Not run by me | the full suite, E2E, Compose smoke, `backend.sh`, `frontend.sh` | a prior run is recorded; I make no pass claim for them |

## Test integrity (no weakening found)

All edits to Test Engineer files after the red commit (`8cc4989`) are corrections or strengthening:
- `test_local_runner_exists_and_rejects_unknown_job`: relative path under `cwd='/'` never reached the script; now an absolute path. Assertions kept. Justified.
- Scanner tests: `assertIn('osv-scanner', script)` became `$(image OSV_SCANNER)` and `--lockfile=` (stricter); `'finding'` became `'leaks found: 1'` (stricter); the empty-lockfile OSV control (exit 128) became a benign `is-number@7.0.0` control while the negative case still needs a non-zero exit on `lodash@4.17.20`. Justified.
- New tests: `suite.cmd` failure propagation (red then green, as logged) and the DD-P03-22 waiver test (exact six IDs, expiry, `--config` only on the contract scan). Added, not removed.
- `ToolchainTests.cs`: `CancellationToken` arguments (xUnit1051), `WithReplicaSet("rs0")` (Testcontainers started a standalone server, so the replica-set assertion could not pass), whitespace. Assertions unchanged. Justified.
- `suite.cmd` rewritten to one line because the handoff check runs each line in a separate shell. The semantics (run both, fail if either fails) are kept and covered by a regression test.

The Test Engineer's "Defect fixes" in `test-results.md` are justified. Coverage gaps and an unfinished flake fix remain (F5, F6).

## DD-P03-22 waivers

Accepted as sound. Six `[[IgnoredVulns]]` entries; IDs equal the decision; `ignoreUntil = 2026-11-17` (14 days); each reason names scope and owner. The waiver is applied only through `--config=/work/osv-scanner.toml` on the `tests/contract/package-lock.json` scan; the other three scans have no config. `tests/contract/**` is unchanged. My `security.sh` run printed "Filtered 6 vulnerabilities" and exited 0. Residual issue: F8 (no tracked owner). OSV also prints "has unused ignores" for the same six IDs after filtering them; this looks like scanner noise and does not affect the exit code.

## Findings

### Major

**F1 — `integration.sh:10` runs the P02 suite lines with `bash -lc`, which resets `PATH`.**
- Impact: a login shell sources `/etc/profile`, which sets `PATH` to a fixed list. I confirmed here that an injected `PATH` entry is dropped under `bash -lc`. On a hosted runner this discards the `actions/setup-node` and `actions/setup-dotnet` entries, so the P02 suite (Prism needs Node ≥ 24.18) runs on whatever the image ships. The same happens to nvm-managed tools locally. The loop also leaves stdin attached to `suite.cmd`, so any command that reads stdin would swallow the remaining lines.
- Required fix: `bash -c "$line" </dev/null` (no `-l`). Keep the "stop at the first failing line" behaviour and its test.

**F2 — `integration.sh:9` needs the network and credentials to find the `main` baseline.**
- Impact: when `refs/heads/main` is missing (every pull-request run), the script does `git fetch origin main:main`. The checkout uses `persist-credentials: false`, so a private repository cannot be fetched. `fetch-depth: 0` has already put `refs/remotes/origin/main` in the clone, which is exactly the AC-P03-07 case ("no local `main`, but `origin/main` exists"). That case has no test (the plan marks "missing-main cases not implemented"), so the failure is invisible until the first hosted run.
- Required fix: create the branch from the local remote-tracking ref (`git branch main refs/remotes/origin/main`, or `git update-ref`). Fetch only as a last resort. Fail with the existing "main reference required" message if neither exists. Add the two AC-P03-07 negative/positive cases (see F5).

**F3 — `security.sh:11` hard-codes the lockfile list; AC-P03-11 requires every `backend/**/packages.lock.json`.**
- Impact: only `backend/tests/ResumeBuilder.Toolchain.Tests/packages.lock.json` is scanned. P04 adds projects with their own lockfiles, and nothing forces `security.sh` to change. The obligation table in `decisions.md` §4 tells P04 not to edit `backend.sh`, but says nothing about `security.sh`. New backend dependencies would go unscanned without any failing check, which defeats P03-OBL-02 and T-TA-06.
- Required fix: enumerate with `find backend -name packages.lock.json` (sorted, null-safe); fail if the list is empty. Add a static check that no `packages.lock.json` under `backend/` is missing from the scan.

**F4 — Developer documentation was not written.**
- Impact: `infrastructure/README.md`, `backend/README.md` and `frontend/README.md` are byte-identical to `main` (the P00 stubs: "Scaffolded in P05", "Scaffolded in P04…"). PLT-10, BE-P03-05 and FE-P03-07 are not done. AC-P03-13 says a clean checkout works "with only the prerequisites documented in `infrastructure/README.md`"; AC-P03-18 and DD-P03-18 (the coordinator takes the new commands from that file) depend on it. The image-pin update procedure is also missing, and it matters because Dependabot will bump Compose but not `images.lock` (F9). `test_docs_and_adrs` passes on the stubs because it only checks that the files exist.
- Required fix: write the three READMEs as specified in the task tables (prerequisites and versions, services and ports, start/stop/reset, `scripts/ci/local.sh`, pin update procedure, port-in-use troubleshooting, skeleton layout and the script contract P05 keeps). Mark the PLT/BE/FE task statuses `DONE` with evidence; they all still read `TODO` although the work exists.

**F5 — Must negative cases are missing, and two "negative" tests prove nothing.**
- Impact: `test-results.md` itself lists AC-03 (`.env` mutation), AC-04 (locked-restore mismatch), AC-07 (missing `main`, no `main` at all), AC-08/AC-09 (mutation of the workflow, actionlint mutation) as "not implemented", and AC-13 as QA-pending. `test_workflow_negative` only manipulates its own string literal and never calls a checker, and the telemetry "control" in `test_ci_telemetry_and_upload_policy` is a tautology. The checker for workflow rules (`test_workflow_policy`) therefore has no demonstrated sensitivity. The Test Engineer exceeded the kickoff budget and deferred to "an Architect budget decision", but none is recorded in `decisions.md`. Rule 01 and CLAUDE.md allow dropped coverage only through a documented approved exception.
- No assertion was removed, so this is a coverage gap, not weakening.
- Required fix (choose one and record it): (a) the Solution Architect records a `DELEGATED-DEFAULT` budget exception that names each missing case, or (b) the Test Engineer implements them. For (b), at least: `workflow_policy` run against mutated copies (tag-pinned `uses:`, `contents: write`, missing `persist-credentials`, `needs:` on `frontend`), the two AC-07 `main` cases, and the locked-restore mismatch. Replace the two tautological tests.

**F6 — Intermittent smoke test, with the fix uncommitted and unrecorded.**
- Impact: the Platform Developer logged two failures of `smoke_compose.test_services_healthy` (`'' != 'healthy'` right after `up --wait`). The committed HEAD still has that version. While I was reviewing, `tests/infrastructure/smoke_compose.py` appeared as modified in the working tree (it was clean at the start). The change polls `docker inspect` for up to 30 s. Rule 01 §8 allows a flaky test only if it is fixed or quarantined with an owner, and forbids silent retries. `test-results.md` has no entry for the root cause or the change. `up --wait` already gates on health, so the poll should only absorb `ps --format json` lag. That claim needs recording; otherwise the poll can hide a real start-up problem. I did not run the smoke test.
- Required fix: the Test Engineer commits the change with a `test-results.md` entry (root cause, why the 30 s bound is a wait and not a retry, repeated-run evidence). The handoff check must run on the committed state.

### Minor

**F7 — `ci.yml` `setup-dotnet` pin comment is wrong.** `d4c94342…` is `actions/setup-dotnet` **v5.0.0** (a real upstream commit, Node 24 runtime), not v4.3.1 (`67a3573c9a986a3f9c594539f4ab511d57bb3ce9`). It appears in the `backend` and `integration` jobs. The static check accepts any `v\d` comment, so AC-P03-09 "SHA with version comment" is not actually verified. Fix: use the v4.3.1 SHA or change the comment to v5.0.0, and make the check fail on a comment that disagrees with the pin if feasible.

**F8 — DD-P03-22 has no tracked remediation owner.** After 2026-11-17 the `security` job fails for every later phase until someone updates `tests/contract/package.json`. `decisions.md` §4 has no obligation row for it. Add one (owner: Test Engineer or the first phase that reopens `tests/contract/**`, with the date). Also note that Dependabot's `/tests/contract` entry may open the fixing PR.

**F9 — Dependabot and `images.lock` drift.** The `docker-compose` ecosystem bumps `docker-compose.yml` only; `test_static_policy` then fails on lock equality. Document the manual lock update (F4). The workflow triggers `push:` on all branches and `pull_request:`, so same-repository PRs run twice, and `cancel-in-progress: true` also cancels in-flight runs on `main`. Consider limiting `push` to `main` and the cancel rule to non-`main` refs.

**F10 — `e2e.sh` leaves root-owned files and reuses stale output.** The container runs as root with the repository mounted read-write; `tests/e2e/test-results` is owned by uid 0 here (checked), so cleaning it needs `sudo`. `frontend/dist` is reused if it exists, so a local run can test a stale build. `node_modules` installed on the host is mounted into a Linux container, which breaks for macOS developers. Fix: `--user "$(id -u):$(id -g)"` (with a writable `HOME`) or write reports to a container path; always rebuild `dist` in the script; note the macOS limitation in the README.

**F11 — Replica-set member host is fixed to `127.0.0.1:27017`.** The `mongo` healthcheck initiates the member with that host. If `RESUMISER_MONGO_PORT` is overridden (as `integration.sh` does with `0`), a host client that uses `replicaSet=rs0` will try port 27017 and fail. The `.env.example` comment recommends exactly that URI. Recommend `directConnection=true` in the example and a note in the README. The in-container smoke is unaffected.

**F12 — Global `overrides.minimatch = 11.0.1` in `frontend/package.json` is unexplained.** It forces a major version across consumers that declare `^3.1`/`^9`. Lint, typecheck, tests and build passed, so it works today, but P05 adds ESLint rules and globs that may touch other APIs. Record the rationale (clears the minimatch advisory in the frontend lockfile) and a removal condition in `decisions.md`.

**F13 — Compose hardening nits (optional).** No `restart` policy, resource limits, `no-new-privileges` or read-only root filesystem. Acceptable for loopback-only local services (DD-P03-05/06); record as a conscious choice in the README.

## Required before PASS (re-review scope)

1. `scripts/ci/integration.sh` (F1, F2); `scripts/ci/security.sh` (F3).
2. `infrastructure/README.md`, `backend/README.md`, `frontend/README.md`, task tables in `implementation/*-tasks.md` (F4).
3. Test Engineer: F5 (cases or an Architect-recorded exception) and F6 (commit and evidence); tests for F2 and F3.
4. `.github/workflows/ci.yml` comment or SHA (F7).
5. Minor items F8–F13: fix or log as accepted in `decisions.md`; they do not block the re-review.

## Risks and open questions

- No hosted CI run exists (DD-P03-19). F1, F2 and F10 are the kind of runner-specific differences that the go-live step would otherwise find late.
- The last recorded green suite run predates the uncommitted `smoke_compose.py` change; the QA clean-checkout run (AC-P03-13) must use the committed state.
- Next owner: Platform Developer (F1–F4, F7, F10, F11), Test Engineer (F5, F6), Solution Architect (F5 exception, F8, F12). Then this reviewer for the changed files only, then QA.

---

## Delta re-review (cycle 1 of 2) — 2026-11-03

- Reviewer: Code Reviewer (Orca worker, task `task_bd21bf5f702a`). Scope: `git diff b07b57e HEAD` (15 files: `scripts/ci/{integration,security,e2e}.sh`, `.github/workflows/ci.yml`, `.env.example`, the three READMEs, `decisions.md`, `implementation/*-tasks.md`, `test-results.md`, `tests/infrastructure/{test_scripts,test_static_policy}.py`). The working tree is clean (`git status --short` empty).
- Not run by me: the full suite, Compose smoke, E2E, `security.sh`, `backend.sh`, the locked-restore mismatch test (needs `dotnet restore` and network). I claim nothing for them.

### Commands I ran

| Command | Exit | Result |
|---|---:|---|
| `git ls-remote https://github.com/actions/setup-dotnet 'refs/tags/v5.0.0*' 'refs/tags/v4.3.1*'` | 0 | `d4c94342…` = v5.0.0; v4.3.1 = `67a3573c…` |
| `python3 -B -m unittest -v test_static_policy` (in `tests/infrastructure`) | 0 | 14 tests OK, including `test_workflow_policy` and `test_workflow_negative` |
| `python3 -B -m unittest -v` on six `test_scripts.Scripts` cases: `test_integration_uses_remote_main_without_fetch`, `test_integration_requires_main_reference`, `test_integration_preserves_path_and_detaches_suite_stdin`, `test_integration_does_not_consume_suite_lines_as_stdin`, `test_security_scans_all_backend_lockfiles`, `test_security_source_enumerates_backend_lockfiles` | 0 | 6 tests OK (they use stub `docker`/`git`, no network) |
| `git diff b07b57e HEAD -- tests/infrastructure` | 0 | additions and strengthening only; see "Test integrity" |

### Per-finding status

| ID | Status | Evidence |
|---|---|---|
| F1 | **Resolved** | `integration.sh:13` now `bash -c "$line" </dev/null`. Fixture tests assert that a leading `PATH` entry survives and that suite lines are not consumed as stdin; both pass. |
| F2 | **Resolved** | `integration.sh:6-12` creates `main` from `refs/remotes/origin/main` with `git branch`, and fetches only as a last resort. Otherwise the script fails with `main reference required`. Both AC-P03-07 cases are tested (remote-only: runs with no fetch and creates `refs/heads/main`; none: fails and never runs the suite). Both pass. |
| F3 | **Resolved** | `security.sh:11-12` uses `find backend -type f -name packages.lock.json -print0 \| sort -z` and fails on an empty list. `test_security_scans_all_backend_lockfiles` plants two lockfiles, requires `--lockfile=` for each, then removes them and requires a failure. A source check was added. Both pass. The hard-coded lockfile is gone, and the backend README tells P04 that the script scans every lockfile. |
| F4 | **Resolved** | The three READMEs are rewritten. `infrastructure/README.md` has prerequisites with versions, services and ports, start/stop/reset, `local.sh`, the image-pin update procedure, port-in-use handling, the `--ignore-scripts` exception list ("none"), non-root notes and the hardening note. `backend/README.md` and `frontend/README.md` give layout, commands and the script contract P05 keeps. All PLT, BE-P03 and FE-P03 rows are `DONE`. Residual, non-blocking: `test_docs_and_adrs` still only checks that the files exist. The task rows say `DONE` with no evidence column; the evidence is in `test-results.md`. |
| F5 | **Resolved for the required minimum; two gaps remain, non-blocking** | Option (b) taken. `assert_workflow_policy` / `assert_telemetry_policy` are now real checkers run on temp copies. `test_workflow_negative` mutates the real workflow four ways (tag-pinned action, `contents: write`, missing `persist-credentials`, `needs:` on `frontend`), and each must raise. The telemetry tautology is replaced by a real negative. The two AC-07 `main` cases and the locked-restore mismatch test exist. The Test Engineer's red run found a real checker bug: the `uses:` regex skipped `- uses:` list entries, so the tag-pin mutation escaped. It was fixed in the checker (now also requires at least one action), not in the mutation. This is the sensitivity I asked for. **Still open:** the AC-03 `.env` mutation and the AC-09 actionlint mutation. `test-results.md` records the "budget deviation" as `DELEGATED-DEFAULT`, but it was written by the Test Engineer, not recorded by the Solution Architect in `decisions.md`. I did not list these two in my "at least" set, so I do not block. The coordinator should have the Solution Architect log them as an approved exception, or have QA cover them (see Open items). |
| F6 | **Resolved** | The 30 s monotonic poll is committed (`smoke_compose.py:34,49`, commit `15afd40`); the tree is clean. `test-results.md` records the root cause (`docker inspect` lag after `up --wait`), why it is a bounded wait and not a retry (it never reruns the test or restarts services, and it fails at the deadline), and five consecutive green runs. |
| F7 | **Resolved** | Comments in the `backend` and `integration` jobs changed to `# v5.0.0`, which matches the pinned SHA by `ls-remote`. The check that a comment agrees with its pin was not added; I called it "if feasible", so I accept that. The `uses` regex now also matches `- uses:`. |
| F8 | **Resolved (tracked)** | DD-P03-23 and obligation row `P04-OBL-P03-03` (P04 Test Engineer, by 2026-11-17; the P04 Solution Architect grants `tests/contract/**` scope; Dependabot noted). |
| F9 | **Resolved** | `push` is limited to `main`, and `cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}`. The lock update procedure is in the infrastructure README. DD-P03-24. `test_workflow_policy` still passes. |
| F10 | **Resolved** | `e2e.sh` always runs `frontend.sh` (rebuilds `dist`), removes old `test-results` via a root container, and runs Playwright with `--user "$(id -u):$(id -g)" -e HOME=/tmp`. The README documents the macOS `node_modules` limit; P05 follows up (DD-P03-25). I did not execute `e2e.sh`. A first-run risk is that Playwright's `npx` with `HOME=/tmp` has not been shown to work in the pinned image; the QA E2E run will show it. |
| F11 | **Resolved** | `.env.example` and the README use `directConnection=true` and say to substitute the published port (DD-P03-26). |
| F12 | **Resolved (tracked)** | DD-P03-27 gives the rationale and a removal condition. Obligation `P05-OBL-P03-03`. |
| F13 | **Resolved (accepted)** | DD-P03-28; the choice is recorded in the infrastructure README. |

### Test integrity (delta)

The two modified test files contain additions and strengthening only. No assertion was removed or loosened.
- `test_workflow_policy` was moved verbatim into a helper that takes a path, and the `uses` regex became stricter (it now matches list entries and requires at least one action).
- `test_workflow_negative` went from string-literal self-checks to real mutations of the real workflow.
- The telemetry tautology became a real negative case.
- Seven tests were added in `test_scripts.py`: the six F1/F2/F3 cases above and the locked-restore mismatch test. Existing tests are unchanged.
- `tests/contract/**`, `contracts/**`, `.claude/**`, `docs/source/**` and `CLAUDE.md` are untouched in the delta. Every changed file is inside the P03 allowed paths.

### Open items (none block the verdict)

1. Record the AC-03 `.env` mutation and the AC-09 actionlint mutation as an approved exception in `decisions.md` (Solution Architect), or have QA cover them. Until then they are open coverage gaps, not passes.
2. QA must run `e2e.sh` (non-root Playwright, F10), the clean-checkout run on the committed state (AC-P03-13), and the locked-restore mismatch test, since I did not run them.
3. No hosted CI run exists (DD-P03-19). `setup-dotnet` v5 needs a Node 24 runner; `ubuntu-24.04` hosted runners satisfy this, but it is untested until the go-live run.

Verdict: PASS

Next owner: QA (Acceptance), then the gate.

## Delta re-review 2 — 2026-11-03

Scope: changes since `d8e6e32` (delta re-review PASS) in `tests/infrastructure/test_static_policy.py`, `tests/infrastructure/test_scanners.py`, `scripts/ci/security.sh` and `infrastructure/README.md`. The remaining diffs are logs and reports.

**Tests (AC-P03-03 .env, AC-P03-09 actionlint) — real, not weakened.**
- No existing assertion was removed or loosened. The old `.env.example` checks moved into `assert_env_example_policy` and were tightened: the secret regex now also catches a 32+ character base64-like run, and each value must be an allowed placeholder or a loopback endpoint or port. `test_environment_and_ignore_rules` still calls it on the real file and keeps the `git check-ignore` checks.
- `test_environment_negative_mutations` runs on a temporary copy. It checks a clean control, then an `AccountKey=` value and a non-placeholder value (`real-looking-secret`). Both raise `AssertionError`. It then builds a temporary git repo and checks that `.env` and `.env.local` are ignored with the real `.gitignore` and stop being ignored once the rules are removed, while `.env.example` stays tracked. This proves the ignore check is sensitive.
- `test_workflow_negative` gained `pull_request_target` and `secrets.FICTIONAL_TOKEN` mutations, each guarded by `assertNotEqual(mutated, base)`. I ran both by hand against `assert_workflow_policy`. Each fails on the intended rule (`pull_request_target|secrets\.|...`), not on an unrelated assertion.
- `test_actionlint_rejects_mutated_workflow` runs the digest-pinned actionlint image through `image_for('actionlint')`. The clean workflow must exit 0. After `runs-on` is changed to `run-on`, the exit code must be nonzero and the output must contain `run-on`. The `chmod 0755` on the temporary directory is a fixture detail only. Tooling is unchanged and nothing is skipped.
- Re-run: `test_static_policy.py` 15/15 OK, and the actionlint test OK (exit 0). The recorded 40/40 suite result is consistent.

**`scripts/ci/security.sh` and README — no new risk.**
- Every scanner `docker run` (gitleaks dir and git, osv-scanner for contract, frontend, e2e and backend lockfiles, actionlint, shellcheck) now has `--user "$(id -u):$(id -g)"`. Containers run as the invoking unprivileged user, so this does not add privilege. It is at most a reduction compared with an image-default root user.
- The mounts are still `:ro`, including the git common directory. No `--privileged`, no added capabilities, no docker socket, no network or env additions, and no secrets or tokens. The digest-pinned `$(image …)` references are unchanged.
- Scanner strictness is unchanged. `set -euo pipefail` still makes any finding fail the job. The configs, waivers, lockfile list, `.gitleaks.toml`, `osv-scanner.toml` and the full-history scan are untouched.
- The README note is accurate and contains no sensitive data. It states the clone ownership and read-access requirement, and that the mounts stay read-only and findings still fail.
- The `uid:gid` string is derived from `id` and always quoted, so there is no injection surface.

Findings: none blocking. Minor, no action required: the actionlint test exercises the pinned image directly and does not assert that `security.sh` passes `--user`. The QA-F3 private-parent run covers that behavior end to end.

Verdict: PASS
