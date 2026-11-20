# Backend Tasks

No tasks assigned yet. Add task IDs, owner, allowed files, contract dependencies and tests.

Written by the Solution Architect, 2026-11-02. **Owner of every task in this file and in `frontend-tasks.md`: one Platform Developer dispatch (role `backend-developer`, DD-P03-02).** Allowed files: phase-plan "Allowed paths" (backend-developer row). Contract dependency: none. The contract and `tests/contract/**` are read-only. Tests: written first by the Test Engineer (`tests/infrastructure/**`, `backend/tests/ResumeBuilder.Toolchain.Tests/**`, frontend canary, `tests/e2e/**`). Never modify an existing test file. Status values: `TODO` / `DONE` (the Developer updates them, with evidence in `tests/test-results.md`).

## Platform tasks

| ID | Task | Files | Acceptance | Status |
|---|---|---|---|---|
| PLT-01 | Pinned image list: choose current exact tags for mongo 8.0.x, Azurite 3.x, Mailpit 1.x, Ryuk, the Playwright image (same version as `tests/e2e`), gitleaks, OSV-Scanner, actionlint and shellcheck; resolve the digests; repeat the P02 oasdiff pin | `infrastructure/images.lock` | AC-P03-02 | DONE |
| PLT-02 | Compose: services, healthchecks (MongoDB replica-set init via healthcheck, PRIMARY only), loopback ports with `RESUMISER_*_PORT` defaults, named volumes, network, telemetry/version-check opt-outs, no credentials; works without `.env` | `docker-compose.yml`, `infrastructure/docker/**` (only if an init script is unavoidable) | AC-P03-01, AC-P03-02 | DONE |
| PLT-03 | Env and repository hygiene: root `.env.example` (phase-plan §7); `.gitignore` additions (`TestResults/`, `*.trx`, `.work/`, `frontend/dist`, Playwright output); `.gitattributes` (LF, `*.sh` LF); `.editorconfig` (C#, TS, YAML, MD) | `.env.example`, `.gitignore`, `.gitattributes`, `.editorconfig` | AC-P03-03, AC-P03-16 | DONE |
| PLT-04 | `scripts/ci/preflight.sh` (version checks, clear messages, non-zero on failure) | `scripts/ci/preflight.sh` | AC-P03-13 | DONE |
| PLT-05 | `scripts/ci/backend.sh` (phase-plan §5.1), passing the pinned MongoDB and Ryuk image references to Testcontainers | `scripts/ci/backend.sh` | AC-P03-04 | DONE |
| PLT-06 | `scripts/ci/integration.sh`: `main` baseline handling, the three P02 `suite.cmd` commands unchanged, then the Compose smoke on a separate project with `down -v` in a trap (DD-P03-20) | `scripts/ci/integration.sh`, optional `scripts/dev/*.sh` helpers | AC-P03-01, AC-P03-07 | DONE |
| PLT-07 | `scripts/ci/security.sh`: gitleaks (tree + history) with `.gitleaks.toml`, OSV-Scanner over all lockfiles with `osv-scanner.toml`, actionlint, shellcheck | `scripts/ci/security.sh`, `.gitleaks.toml`, `osv-scanner.toml` | AC-P03-10, AC-P03-11, AC-P03-17 | DONE |
| PLT-08 | `scripts/ci/local.sh [job…]`: preflight, then the jobs in order; continues after failures; one result line per job; non-zero if any failed; runs from any current directory | `scripts/ci/local.sh` | AC-P03-12 | DONE |
| PLT-09 | Workflow `.github/workflows/ci.yml` (phase-plan §5.2: five jobs, one `run:` each, SHA-pinned actions, read-only permissions, `persist-credentials: false`, timeouts, no `needs:` between `backend` and `frontend`) and `.github/dependabot.yml` (§5.3) | `.github/**` | AC-P03-08, AC-P03-09, AC-P03-11 | DONE |
| PLT-10 | Documentation: prerequisites, services and ports, start/stop/reset, the local CI command, the image pin update procedure, the `--ignore-scripts` exception list (expected empty), non-root exceptions, troubleshooting | `infrastructure/README.md` | AC-P03-18 | DONE |
| PLT-11 | Telemetry opt-outs in every script and service; no artifact upload | `scripts/ci/**`, `docker-compose.yml` | AC-P03-15 | DONE |

## Backend toolchain skeleton (phase-plan §8.1)

| ID | Task | Files | Acceptance | Status |
|---|---|---|---|---|
| BE-P03-01 | `backend/global.json` (SDK `10.0.300`, `rollForward: latestPatch`) | `backend/global.json` | AC-P03-04, AC-P03-13 | DONE |
| BE-P03-02 | `Directory.Build.props` (net10.0, nullable, warnings as errors, analyzers, deterministic, CI build flag, lock files) and `Directory.Packages.props` (Central Package Management, exact versions of the ADR-041 packages the canary uses) | `backend/Directory.Build.props`, `backend/Directory.Packages.props` | AC-P03-04, AC-P03-14 | DONE |
| BE-P03-03 | `nuget.config` (`<clear/>`, nuget.org, package source mapping) | `backend/nuget.config` | AC-P03-11 | DONE |
| BE-P03-04 | `ResumeBuilder.slnx` including the Test Engineer's canary project; committed `packages.lock.json` files from a locked restore | `backend/ResumeBuilder.slnx`, `backend/**/packages.lock.json` | AC-P03-04 | DONE |
| BE-P03-05 | `backend/README.md`: skeleton layout, commands, what P04 adds | `backend/README.md` | AC-P03-18 | DONE |

Not in P03: `backend/src/**` projects, layers, health endpoint, OpenAPI integration, Dockerfile (P04, decisions.md §4).

## Obligations for later phases (not P03 tasks)

P04-OBL-P03-01, P04-OBL-P03-02 and the shared-file rule in `decisions.md` §4.

## Platform Developer attempt — 2026-11-03

Partial implementation produced the backend/frontend skeletons, Compose and image lock, CI scripts and workflow. No task is marked DONE because the full P03 suite is not green. Exact commands from repository root: `npm install --package-lock-only --ignore-scripts --no-audit --no-fund --prefix frontend` exited 0; `cd backend && dotnet restore ResumeBuilder.slnx` exited 1 on NU1902/NU1903 vulnerable transitive packages (SharpCompress 0.30.1, Snappier 1.0.0, SSH.NET 2024.2.0); `docker compose config --format json` exited 0 after YAML correction; `python3 -B -m unittest discover -s tests/infrastructure -p 'test_static_policy.py' -v` exited 0 (14 tests); `python3 -B -m unittest discover -s tests/infrastructure -p 'test_*.py' -v` exited 1 (29 tests, 6 failures, 1 error). The full suite did not run and no green claim is made. The current infrastructure test invokes a relative script path under `cwd='/'`, which resolves to `/scripts/ci/local.sh` and cannot reach the repository; scanner sensitivity tests also disagree with the actual pinned scanner CLI output. The Test Engineer must correct those tests; developers cannot edit them.

## Platform Developer continuation — 2026-11-03

PLT-04 production preflight correction is DONE: the Node version check now parses `node --version`, and the old-Node negative test passes. BE-P03-02 production dependency correction is DONE: Central Package Management pins SharpCompress 0.50.7, Snappier 1.3.1 and SSH.NET 2026.0.0 with transitive pinning enabled; `cd backend && dotnet restore ResumeBuilder.slnx` exited 0. BE-P03-04 remains TODO because the restored lockfile is an existing Test Engineer-owned test file; handoff reported `TEST_MODIFIED` when it changed, so its original bytes were restored. The backend canary still fails four xUnit1051 analyzer errors in `ToolchainTests.cs` lines 33, 36, 41, 42; the Test Engineer must correct the test and regenerate its lockfile. Security still reports OSV findings in the read-only P02 contract lockfile, and gitleaks history cannot read the missing source worktree metadata.

## Platform Developer final continuation — 2026-11-03

Implemented six DD-P03-22 waivers expiring 2026-11-17, scoped to the contract lockfile scan, and mounted the worktree git common directory read-only for gitleaks history. Corrected shellcheck warnings in CI scripts. Environment: Debian 13, .NET 10.0.301, Node 24.22.2, npm 11.19.1, Docker 29.6.1/Compose v5.3.1; no skips requested.

| Exact command from repository root | Exit | Result |
|---|---:|---|
| `python3 -B -m unittest discover -s tests/infrastructure -p 'test_scanners.py' -k contract_waivers -v` | 0 | Waiver scope and expiry regression passed. |
| `docker run --rm -v "$PWD:/work:ro" -w /work "$(sed -n 's/^SHELLCHECK=//p' infrastructure/images.lock)" -e SC1091 scripts/ci/*.sh` | 0 | No shellcheck findings. |
| `bash docs/phases/P03/tests/suite.cmd` | 1 | Security cleared contract findings; E2E 6/6 across three browsers, Compose smoke 5/5, infrastructure 31/31. Backend failed on Test Engineer canary formatting; shellcheck warnings were subsequently corrected. No skips. |
| `bash scripts/ci/backend.sh` | 1 | Build and format passed after concurrent Test Engineer correction; Mongo canary failed `replSetGetStatus: not running with --replSet` at `ToolchainTests.cs:36` (1 failed, 2 passed). |
| `python3 scripts/phase-handoff-check.py --phase P03 --role backend-developer --worktree .` | 1 | First handoff: suite commands passed individually except final `exit "$status"`, which failed because the checker executes each line in a separate shell; concurrent Test Engineer canary edit also triggered `TEST_MODIFIED`. Test Engineer corrected `suite.cmd`; coordinator committed the concurrent canary changes. |
| `bash docs/phases/P03/tests/suite.cmd` | 2 | Second run passed jobs but read `suite.cmd` while the Test Engineer rewrote it, producing a malformed final command; not a stable-run result. |
| `bash docs/phases/P03/tests/suite.cmd` | 0 | Stable final run: security, backend including MongoDB canary (3/3), frontend, three-browser E2E (6/6), integration Compose smoke (5/5), and infrastructure tests (31/31) passed. No skips. |
| `python3 scripts/phase-handoff-check.py --phase P03 --role backend-developer --worktree .` | 1 | After Test Engineer suite correction was committed, role scope and blueprint passed, but embedded suite exited 1 on intermittent `smoke_compose.ComposeSmoke.test_services_healthy`: one Compose `Health` field was empty after `up --wait`. |
| `bash scripts/ci/local.sh` | 1 | Reproduced intermittent integration smoke failure: `test_services_healthy` asserted `'' != 'healthy'` after four other Compose smoke tests passed; other jobs passed. No skips. |

### Review fix evidence (task_5abcc2a850f8, 2026-11-03)

F1/F2: `integration.sh` preserves PATH and stdin isolation and uses the local `origin/main` ref before a fetch. F3: `security.sh` scans every sorted backend lockfile and fails if none exist. F4/F7/F9/F10/F11: READMEs, workflow pin comments and triggers, E2E runner and MongoDB example updated. PLT-01–PLT-11 and BE-P03-01–BE-P03-05 are marked DONE based on their existing implementation and the review fixes; see the P03 suite outcome below for remaining verification limits.

- `bash -n scripts/ci/{integration,security,e2e}.sh` — exit 0, shell syntax valid.
- `bash docs/phases/P03/tests/suite.cmd` — exit 1. Backend, frontend and integration jobs passed; E2E failed because a prior root-owned ignored Playwright result prevented the non-root container from replacing `.last-run.json`; security and the infrastructure checks failed `test_workflow_negative` for the tag-pinned action mutation. The failing test helper is Test Engineer-owned; escalation sent to the coordinator. This run is not green.
- `python3 scripts/phase-handoff-check.py --phase P03 --role backend-developer --worktree .` — interrupted, exit 130, after reporting `FAIL ROLE_SCOPE docs/phases/P03/decisions.md not owned by backend-developer`. The command also started a second suite run, so it was stopped to obey the serial-suite requirement. The explicit dispatch grants decisions.md, but the handoff checker does not; escalation sent to the coordinator.
- `bash scripts/ci/e2e.sh` — first targeted run exit 7 from an `npm ci` race with the handoff check's suite; second targeted run exit 0, six Playwright tests passed across Chromium, Firefox and WebKit after the script cleaned old generated results. No concurrent run remained for the successful run.

- `bash docs/phases/P03/tests/suite.cmd` — rerun exit 0 after the Test Engineer fixed the workflow action checker; security, backend, frontend, E2E and integration jobs passed, and all 38 infrastructure tests passed.

### Architect follow-up for minor review findings

The handoff checker excludes `docs/phases/P03/decisions.md` from the backend-developer role, so the accepted-minor record must be added by the Solution Architect after this step (draft at `/tmp/p03-minor-decisions-20261103.md`). F8: Test Engineer owns DD-P03-22 remediation by 2026-11-17; Dependabot may open the fixing PR. F9: CI push and cancellation rules and manual image-lock update are addressed. F10: E2E refreshes the build and output; macOS dependency limitation is documented. F11: host MongoDB URI uses `directConnection=true`. F12: frontend `minimatch` 11.0.1 override clears the advisory; P05 should reassess it when adding ESLint rules/globs and remove it when upstream supplies a compatible safe version. F13: local loopback-only service hardening gaps are accepted and recorded in the infrastructure README.

- `python3 scripts/phase-handoff-check.py --phase P03 --role backend-developer --worktree .` — final rerun exit 0: role scope 10 files, phase scope 66 files, blueprint exit 0, phase suite exit 0, `RESULT PASS`. The Test Engineer's workflow checker fix had been committed by the coordinator before this rerun.

### QA-F3 scanner access fix (task_8ae27baeb8ea, 2026-11-03)

`scripts/ci/security.sh` now runs each digest-pinned scanner with the invoking user's UID/GID. This lets the read-only bind mounts reach a clone beneath a mode-0700 parent owned by that user; the Git common directory remains mounted read-only for the full-history gitleaks scan. `infrastructure/README.md` documents the clone ownership and path-read requirements. No scanner, lockfile, waiver, or finding policy was removed or relaxed. Environment: Debian 13, Docker Engine 29.6.1/Compose v5.3.1; no skips.

| Exact command from repository root | Exit | Result |
|---|---:|---|
| `bash docs/phases/P03/tests/suite.cmd > /tmp/p03-qa-f3-suite.log 2>&1` | 0 | All five local CI jobs passed; infrastructure tests 40/40 passed. One standalone suite run, with no concurrent suite. |
| `private_parent=$(mktemp -d /tmp/p03-private-XXXXXX); git clone -q --shared . "$private_parent/clone"; cp scripts/ci/security.sh "$private_parent/clone/scripts/ci/security.sh"; (cd "$private_parent/clone" && bash scripts/ci/security.sh) > /tmp/p03-qa-f3-private.log 2>&1` | 0 | Security job passed in `/tmp/p03-private-pHqtEi/clone`; parent mode was 0700. Clone used the updated, uncommitted script. |
| `python3 scripts/phase-handoff-check.py --phase P03 --role backend-developer --worktree . > /tmp/p03-qa-f3-handoff.log 2>&1` | 0 | Role scope passed (2 code/doc files at check time), phase scope passed, Blueprint passed, embedded suite exited 0; `RESULT PASS`. Embedded suite ran after the standalone suite completed. |

No unresolved issue in this fix. Next owner: coordinator for review and QA gate.
