# Test Results

No tests executed yet. Record exact commands, environment, exit code, pass/fail counts and artifacts. Never mark tests passed without running them.

## Test Engineer red run — 2026-11-03 (Europe/Madrid)

Test files and `suite.cmd` were written before P03 production and configuration work. The reference host was Debian GNU/Linux 13; Docker Engine 29.6.1 and Compose v5.3.1 were reachable; SDK 10.0.301, Node v24.22.2, npm 11.19.1 and Python 3.13.5 were installed.

| Exact command (repository root) | Exit | Observed result |
|---|---:|---|
| `npm install --package-lock-only --ignore-scripts --no-audit --no-fund --prefix tests/e2e` | 0 | Generated the exact-version E2E lockfile; no install scripts ran. |
| `python3 -B -m unittest discover -s tests/infrastructure -p 'test_*.py' -v` | 1 | 21 tests, 19 expected failures, 2 passing synthetic controls. The failing cases report `ARTIFACT_MISSING` for `scripts/ci/*`, `infrastructure/images.lock`, `.env.example`, `.gitleaks.toml`, Dependabot and workflow files, or Compose's empty `services: {}`. Scanner sensitivity and live smoke could not run because the pinned images and integration script do not exist yet; these are **not passes**. |
| `bash scripts/ci/local.sh` | 127 | `bash: scripts/ci/local.sh: No such file or directory`, the planned L1 red reason. Backend, frontend, E2E and P02-integration canaries consequently did not run; no result is claimed for them. |
| `python3 scripts/phase-handoff-check.py --phase P03 --role test-engineer --worktree .` | 0 | `RESULT PASS`; role scope 14 owned files, phase scope accepted, both suite commands red. |
| `python3 -m py_compile tests/infrastructure/*.py` | 0 | The Python modules parse; this does not count as test success. |

The `images.lock` SHA-256, OSV advisory date, gitleaks tree/history results, Playwright engine run results and Compose `up --wait` duration are unavailable in this red state because their production launch paths do not exist yet. Red evidence is the missing P03 implementation artifact for every failed test; the synthetic compose and workflow mutation controls passed. The current suite covers core infrastructure structure, CI script failures, scanner configuration and canaries; some case catalogue details in `test-plan.md` still need implementation before the phase can claim full planned coverage.

## Test Engineer completion pass — 2026-11-03

Added Compose mutation cases for digest mismatch, missing host binding, host networking, Docker socket access and credential-bearing URL; added preflight old-Node, manifest/tooling, ignored-output, telemetry, and standalone-MongoDB negatives. The live standalone MongoDB case is launched only by `integration.sh` after the pinned image exists. The smoke module now reports `ENV_MISSING compose project resumiser-ci is not up` if invoked without the CI project.

| Exact command (repository root) | Exit | Observed result |
|---|---:|---|
| `python3 -B -m unittest discover -s tests/infrastructure -p 'test_*.py' -v` | 1 | 24 tests: 21 expected failures, 3 passing synthetic/ignore controls. New red cases report `ARTIFACT_MISSING scripts/ci/preflight.sh` and `ARTIFACT_MISSING backend/Directory.Packages.props`; existing red cases report missing P03 scripts, image lock, workflow and env file, or empty Compose. No import or syntax error. |
| `bash scripts/ci/local.sh` | 127 | `bash: scripts/ci/local.sh: No such file or directory`; CI jobs did not run. |
| `python3 -B -m unittest discover -s tests/infrastructure -p 'smoke_*.py' -v` | 1 | Direct smoke invocation outside integration: four failures for unavailable services or image lock and one error from empty `docker compose ps`. The empty-result error was corrected after this run; it is not claimed as passing. |
| `python3 scripts/phase-handoff-check.py --phase P03 --role test-engineer --worktree .` | 0 | `RESULT PASS`; both suite commands red for missing P03 implementation. |

### AC to executable test mapping

| AC | Positive | Negative or exception |
|---|---|---|
| 01 | `test_compose_structure_and_safety`, `test_services_healthy`, `test_replica_set_and_majority_write`, `test_mailpit_delivery`, `test_azurite_responds`, `test_no_compose_residue` | `test_compose_negative_mutations` (healthcheck), `test_mongo_without_replica_set_fails` |
| 02 | `test_compose_structure_and_safety`, `test_images_lock_and_playwright_version` | `test_compose_negative_mutations` (digest, lock mismatch, host IP, volume, network, privilege, socket, credentials) |
| 03 | `test_environment_and_ignore_rules` | `test_compose_negative_mutations` (credential URL); `.env` mutation from plan not implemented |
| 04 | backend canary through CI, `test_manifest_and_tooling_policy`, `test_backend_lock_and_frontend_typescript_policy` | `test_job_scripts_propagate_failure`; locked restore mutation not implemented |
| 05 | `App.test.tsx` through CI, `test_scripts_and_manifests`, `test_manifest_and_tooling_policy`, `test_backend_lock_and_frontend_typescript_policy` | `test_job_scripts_propagate_failure`, `test_preflight_rejects_old_node` |
| 06 | `smoke.spec.ts` through CI, `test_images_lock_and_playwright_version`, `test_playwright_harness_policy` | E2E guard self-test, `test_job_scripts_propagate_failure` |
| 07 | `test_integration_references_contract_suite_and_cleans_up` | `test_integration_stops_at_failed_contract_line`; missing-main cases not implemented |
| 08 | `test_workflow_policy`, isolated QA runs pending | `test_workflow_negative` synthetic needs mutation |
| 09 | `test_workflow_policy` | `test_workflow_negative` permissions mutation; actionlint mutation not implemented |
| 10 | `test_gitleaks_configuration_extends_defaults`, CI scan | `test_gitleaks_detects_planted_token` |
| 11 | `test_dependency_scan_and_update_config`, CI scan | `test_osv_detects_known_vulnerable_lock` |
| 12 | `test_local_runner_is_cwd_independent_and_reports_each_job` | same test failing job; `test_local_runner_exists_and_rejects_unknown_job` |
| 13 | `test_preflight_reference_machine`; fresh-clone QA pending | `test_preflight_fails_when_dotnet_missing`, `test_preflight_rejects_old_node` |
| 14 | `test_manifest_and_tooling_policy`, `test_docs_and_adrs` | `test_rejected_test_framework_is_detectable` |
| 15 | `test_ci_telemetry_and_upload_policy`, E2E external request guard | same telemetry test synthetic removal |
| 16 | handoff check, `test_generated_paths_are_ignored` | exception: acceptance criteria negative column is “—” |
| 17 | CI shellcheck | `test_shellcheck_detects_unquoted_variable` |
| 18 | `test_docs_and_adrs` | exception: Should criterion has no negative requirement |

**DELEGATED-DEFAULT budget note:** The kickoff caps infrastructure at four modules plus one helper and about 700 lines. The case catalogue requests more distinct temp-repository, lockfile mutation, and static-policy checks than fit comfortably within that cap; unimplemented cases are named above and remain QA/reviewer gaps, not passes. The existing budget and source hierarchy were preserved; a larger suite needs an Architect budget decision.

Final rerun after the additions above: `python3 -B -m unittest discover -s tests/infrastructure -p 'test_*.py' -v > /tmp/p03-completion-unittest.log 2>&1; result=$?; tail -n 5 /tmp/p03-completion-unittest.log; exit "$result"` exited **1**: 29 tests, 25 failures, 4 passes. All failures were missing P03 implementation artifacts, the empty Compose placeholder, or missing CI script directory; there were no import or syntax errors. `python3 scripts/phase-handoff-check.py --phase P03 --role test-engineer --worktree .` exited **0** (`RESULT PASS`, 2 of 2 suite commands red). Infrastructure source is 570 lines across four modules and one helper, within the kickoff budget.

## Defect fixes — 2026-11-03

- `test_local_runner_exists_and_rejects_unknown_job` now invokes the repository script by absolute path while retaining `cwd='/'`; the old relative path addressed `/scripts/ci/local.sh`, so it never exercised the intended unknown-job rejection. The local-runner fixture also includes its required `common.sh` and executable job stubs; these were test setup omissions, and the assertions for run order and failure propagation remain intact.
- Scanner policy checks now assert the actual `$(image NAME)` references and `--lockfile=` calls in `security.sh`. The pinned gitleaks v8.28.0 emits `leaks found: 1`, which the planted-token test now asserts. The pinned OSV-Scanner v2.3.1 exits 128 for an empty lockfile because it discovers zero packages; the clean control now contains benign `is-number@7.0.0` (exit 0), while the negative case still requires a nonzero vulnerability result and names `lodash@4.17.20`.

| Exact command (repository root) | Exit | Observed result |
|---|---:|---|
| `python3 -B -m unittest discover -s tests/infrastructure -p 'test_scanners.py' -v` (before fixes) | 1 | 6 tests: 4 failures from scanner name/output assumptions and empty OSV control. |
| `python3 -B -m unittest discover -s tests/infrastructure -p 'test_*.py' -v` (after fixes) | 1 | 29 tests: 28 pass, 1 fails. `test_preflight_rejects_old_node` sees `scripts/ci/preflight.sh: line 10: v22: unbound variable` instead of the required Node guidance; this is a production script defect, so the assertion was preserved for the Platform Developer. |

The developer's NuGet vulnerability failure remains a production dependency issue and was not changed in this pass. The full CI suite was not run; its backend restore remains blocked by that issue.

### Test Engineer defect fix pass 2 — 2026-11-03

- `ToolchainTests.PinnedMongoReplicaSetAcknowledgesMajorityWrite` now passes `TestContext.Current.CancellationToken` to its four cancellation-capable async calls (`StartAsync`, `RunCommandAsync`, `InsertOneAsync`, and `CountDocumentsAsync`), resolving xUnit1051 without changing assertions or test intent.

| Exact command (repository root) | Exit | Observed result |
|---|---:|---|
| `dotnet test backend/tests/ResumeBuilder.Toolchain.Tests/ResumeBuilder.Toolchain.Tests.csproj --no-restore --filter FullyQualifiedName~RunsOnDotNet10 --verbosity quiet` | 0 | Project built; one filtered test passed, zero failed or skipped. The MongoDB canary was not selected and is not claimed as passing. |
| `dotnet build backend/tests/ResumeBuilder.Toolchain.Tests/ResumeBuilder.Toolchain.Tests.csproj --no-restore --no-incremental -warnaserror:xUnit1051 --verbosity quiet` | 0 | Build succeeded with zero warnings and zero errors, including no xUnit1051 finding. |

## Platform Developer continuation — 2026-11-03

Environment: Debian 13, .NET SDK 10.0.301, Node 24.22.2, npm 11.19.1, Docker 29.6.1/Compose v5.3.1. Commands from repository root unless stated otherwise; no skips were requested.

| Exact command | Exit | Result |
|---|---:|---|
| `cd backend && dotnet restore ResumeBuilder.slnx` | 0 | Restore succeeded after central transitive pins; it rewrote a Test Engineer-owned lockfile, which was restored to its original bytes to respect role scope. |
| `python3 -B -m unittest discover -s tests/infrastructure -p 'test_*.py' -v` | 0 | 29 tests passed, including old-Node negative. |
| `npm ci --ignore-scripts --no-audit --no-fund --prefix frontend` | 0 | Installed exact frontend lockfile. |
| `npm run lint --prefix frontend` | 0 | ESLint passed with generated dist ignored. |
| `npm run typecheck --prefix frontend && npm test --prefix frontend && npm run build --prefix frontend` | 0 | Typecheck, 2 Vitest tests, and Vite build passed. |
| `bash scripts/ci/security.sh` | 1 | Frontend lockfile: no issues. P02 read-only contract lockfile: six OSV findings; gitleaks history cannot access missing source worktree metadata. |
| `bash docs/phases/P03/tests/suite.cmd` | 0 | **Misleading exit status:** `local.sh` printed security FAIL, backend FAIL, frontend FAIL from its earlier pre-update state, e2e PASS, integration PASS. The second command passed 29 tests. The suite file lacks failure propagation and is Test Engineer-owned. |
| `python3 scripts/phase-handoff-check.py --phase P03 --role backend-developer --worktree .` | 130 | Interrupted after `TEST_MODIFIED` was reported for the NuGet lockfile and while it was rerunning the lengthy suite; the lockfile was subsequently restored. No passing handoff claim. |

Open blockers: Test Engineer to correct xUnit1051 calls, regenerate its NuGet lockfile and fix `suite.cmd` failure propagation; P02 contract lockfile advisories need authorized ownership/decision; coordinator to repair source worktree metadata for gitleaks history. The full CI suite is not green.

### Test Engineer defect fix pass 3 — 2026-11-03

- Regenerated `backend/tests/ResumeBuilder.Toolchain.Tests/packages.lock.json` after the central transitive pins. Locked restore now succeeds.
- `suite.cmd` now records each command's failure, runs both commands, and exits nonzero if either failed. A stubbed regression test reproduced the old false success, then passed after the fix.
- Added a DD-P03-22 regression test requiring exactly the six named GHSA waivers, expiry `2026-11-17`, and `--config=/work/osv-scanner.toml` only on the contract lockfile scan. It is red pending the Platform Developer's `osv-scanner.toml` and `scripts/ci/security.sh` changes; those production files are outside this dispatch.

| Exact command (repository root) | Exit | Observed result |
|---|---:|---|
| `python3 -B -m unittest discover -s tests/infrastructure -p 'test_scripts.py' -k phase_suite -v` (before fix) | 1 | Regression failed: suite returned 0 after the stubbed local CI returned 7. |
| `python3 -B -m unittest discover -s tests/infrastructure -p 'test_scanners.py' -k contract_waivers -v` | 1 | One error: `osv-scanner.toml` has no `IgnoredVulns` yet. |
| `dotnet restore backend/ResumeBuilder.slnx --force-evaluate` | 0 | Canary lockfile regenerated. |
| `python3 -B -m unittest discover -s tests/infrastructure -p 'test_scripts.py' -k phase_suite -v` (after fix) | 0 | One regression test passed. |
| `dotnet restore backend/ResumeBuilder.slnx --locked-mode` | 0 | Canary restore succeeded in locked mode. |
| `python3 -B -m unittest discover -s tests/infrastructure -p 'test_*.py' -v` | 1 | 31 tests: 30 passed, one error in the new DD-P03-22 test, pending the production waiver and scan scope implementation. |

The full local CI command was not run in this pass; no full-suite pass is claimed.

### Test Engineer defect fix pass 4 — 2026-11-03

- Applied `dotnet format whitespace` to `ToolchainTests.cs` in the Toolchain test project. The diff changes indentation only; test statements and assertions are unchanged.

| Exact command (repository root) | Exit | Observed result |
|---|---:|---|
| `dotnet format whitespace backend/tests/ResumeBuilder.Toolchain.Tests/ResumeBuilder.Toolchain.Tests.csproj --no-restore --include backend/tests/ResumeBuilder.Toolchain.Tests/ToolchainTests.cs --verbosity quiet` | 0 | Formatter changed indentation in `ToolchainTests.cs` only. |
| `dotnet format whitespace backend/tests/ResumeBuilder.Toolchain.Tests/ResumeBuilder.Toolchain.Tests.csproj --no-restore --include backend/tests/ResumeBuilder.Toolchain.Tests/ToolchainTests.cs --verify-no-changes --verbosity quiet` | 0 | No remaining whitespace changes in the targeted file. |

### Test Engineer MongoDB canary fix — 2026-11-03

- `PinnedMongoReplicaSetAcknowledgesMajorityWrite` now configures Testcontainers MongoDb with `WithReplicaSet("rs0")`. The pinned MongoDB image was previously started as a standalone server, so `replSetGetStatus` failed with `not running with --replSet`. The status assertions and `WriteConcern.WMajority` insert remain in place.

| Exact command (repository root) | Exit | Observed result |
|---|---:|---|
| `bash scripts/ci/backend.sh` | 0 | Restore and Release build succeeded with zero warnings/errors; 3 tests passed, 0 failed, 0 skipped, including the MongoDB canary. |
| `dotnet format whitespace backend/tests/ResumeBuilder.Toolchain.Tests/ResumeBuilder.Toolchain.Tests.csproj --no-restore --include backend/tests/ResumeBuilder.Toolchain.Tests/ToolchainTests.cs --verbosity quiet` | 0 | Formatter completed; no test assertions changed. |

## Defect fixes — suite command isolation — 2026-11-03

- Rewrote `suite.cmd` as one self-contained command line. It runs local CI and infrastructure checks, captures both exit codes, and returns nonzero if either fails when invoked by Bash or by the handoff check's separate-shell runner.

| Exact command (repository root) | Exit | Observed result |
|---|---:|---|
| `python3 -B -m unittest discover -s tests/infrastructure -p 'test_scripts.py' -k phase_suite -v` | 0 | Regression passed; stubbed local CI failure returned nonzero and infrastructure checks still ran. |
| `bash docs/phases/P03/tests/suite.cmd` | 0 | Local CI jobs and 31 infrastructure tests passed. |

## Defect fixes — Compose health smoke — 2026-11-03

- `test_services_healthy` previously read the `Health` field from one `docker compose ps --format json` snapshot. The reported intermittent empty field is consistent with a transient Compose `ps` view after `up --wait`; all three services define healthchecks in `docker-compose.yml`, and the five runs below showed no production healthcheck failure. This is a test observation race rather than evidence of a missing production healthcheck. The smoke now obtains each container's `.State.Health.Status` from `docker inspect` and polls to a fixed 30-second monotonic deadline. It still requires exactly MongoDB, Azurite, and Mailpit, all running and healthy; an absent healthcheck fails explicitly.

| Exact command (repository root) | Exit | Observed result |
|---|---:|---|
| `for run_number in 1 2 3 4 5; do bash scripts/ci/integration.sh > "/tmp/p03-smoke-${run_number}.log" 2>&1; run_status=$?; printf 'run=%s exit=%s\n' "$run_number" "$run_status"; tail -n 8 "/tmp/p03-smoke-${run_number}.log"; done` | 0 | Five consecutive runs: individual exits 0, 0, 0, 0, 0. Each log reports `Ran 5 tests` and `OK`; each run performed Compose teardown. |
| `python3 -B -m unittest discover -s tests/infrastructure -p 'test_*.py' -v` | 0 | 31 tests passed. |

## Review F1/F3/F5/F6 regression pass — 2026-11-03

**DELEGATED-DEFAULT budget deviation (review option b):** F5 Must-case coverage takes priority over the kickoff's approximate 700-line infrastructure budget. The added cases stay in the existing two test modules and use disposable copies; this does not change the four-module-plus-helper count. The remaining AC-03 `.env` mutation and actionlint mutation are still coverage gaps, not passes.

The workflow policy assertions now run on a temporary copy of the real workflow and on four mutated copies: a tag-pinned checkout action, `contents: write`, missing `persist-credentials: false`, and `needs: backend` on `frontend`. The telemetry negative also runs the same checker on a temporary script with the opt-out removed. Integration fixtures cover remote-tracking `origin/main` without a local `main` or fetch, no `main` reference, preserved `PATH`, and no consumption of suite lines as stdin. The security fixture plants two backend lockfiles, checks that each receives a scan call, then removes both and requires a failure; a source check requires backend lockfile enumeration. The locked-restore fixture changes the central xUnit version in a temporary backend copy and requires a lock mismatch error.

| Exact command (repository root) | Exit | Observed result |
|---|---:|---|
| `python3 -B -m unittest discover -s tests/infrastructure -p 'test_static_policy.py' -v` | 1 | 14 tests, one expected failure: `test_workflow_negative` tag-pinned action mutation escaped the current workflow checker. Its three other workflow mutations and the telemetry mutation were detected. |
| `python3 -B -m unittest discover -s tests/infrastructure -p 'test_scripts.py' -v` | 1 | 17 tests, five expected failures: suite stdin was consumed; login shell reset `PATH`; remote-only `origin/main` triggered a fetch and failed; security omitted planted backend lockfiles; source lacked dynamic backend enumeration. The no-main-reference and locked-restore mismatch controls passed. |

**F6 root cause and bound:** The five consecutive smoke runs and their exact command are recorded above. The 30-second monotonic poll only waits for the health status already reached by `docker compose up --wait` to appear in `docker inspect`; it does not restart services or rerun a failed test. If status remains absent or unhealthy at the deadline, the smoke fails. This bounds the transient observation race without accepting a real healthcheck failure.

## Defect fixes — workflow action pin checker — 2026-11-03

- Fixed `assert_workflow_policy` to inspect YAML list entries (`- uses:`) and require at least one action. Previously the regex skipped all real action lines, so the tag-pin mutation escaped detection.
- `python3 -B -m unittest discover -s tests/infrastructure -p test_static_policy.py -v` — exit 0; 14 tests passed. `test_workflow_negative` exercised tag-pinned action, write permission, checkout credentials, and frontend dependency mutations; each raised `AssertionError`. The real workflow passed.

## QA remediation: AC-P03-03 and AC-P03-09 — 2026-11-03

- Added a reusable `.env.example` policy check and disposable mutations for an `AccountKey=` value and a non-placeholder secret-like value. A temporary Git repository proves both `.env` and `.env.local` stop being ignored when their ignore rules are removed; the clean copy is the control.
- Added workflow policy mutations for `pull_request_target` and an actual `secrets.FICTIONAL_TOKEN` expression. A separate scanner test runs the digest-pinned actionlint image on a clean temporary workflow and on a copy with `runs-on` changed to `run-on`; the latter exits nonzero and names `run-on`.
- The scanner fixture sets its temporary parent directory to mode 0755 so the container's unprivileged user can read the file. QA-F3 remains a production-script limitation: `scripts/ci/security.sh` bind-mounts `$ROOT` for actionlint, and a clone under a mode-0700 parent cannot be traversed by the container user. This task did not edit `scripts/ci/**`; the Platform Developer or Solution Architect should decide whether to document the required parent mode or change the invocation.

| Exact command (repository root) | Exit | Observed result |
|---|---:|---|
| `python3 -B -m unittest discover -s tests/infrastructure -p test_static_policy.py -v` | 0 | 15 tests passed, including env and workflow mutation controls. |
| `python3 -B -m unittest discover -s tests/infrastructure -p test_scanners.py -k actionlint -v` | 0 | One actionlint clean/mutant test passed. |
| `python3 -B -m unittest discover -s tests/infrastructure -p 'test_*.py' -v` | 0 | 40 tests passed. |
| `bash docs/phases/P03/tests/suite.cmd > /tmp/p03-qa-remediation-suite.log 2>&1` | 0 | Five local CI jobs and 40 infrastructure tests passed; final log reports `Ran 40 tests` and `OK`. |
