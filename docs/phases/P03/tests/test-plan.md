# P03 Test Plan

- Author: Test Architect (Orca worker, task `task_7b5d211cb327`), 2026-11-03.
- Inputs: `../PHASE.md`, `../kickoff.md` §3 (test budget), `../architecture/phase-plan.md` (§4–§8, Allowed paths), `../acceptance-criteria.md` (AC-P03-01…18), `../decisions.md` (PD-P03-01…04, DD-P03-01…21), ADR-041, ADR-042, `docs/blueprint/AGENT-WORKFLOW.md`, `.claude/rules/*`, skill `docker-compose`.
- Readers: Test Engineer (step 5: writes `tests/infrastructure/**`, the three canaries, `../tests/suite.cmd` and the red section of `test-results.md` from this plan), Platform Developer (the test interfaces in §3 are what the checks call), Code Reviewer, QA.
- Findings for the Solution Architect: §10. None blocks the next step. Each one has a recommended default, and this plan already uses it.

Required test strategy (PHASE.md): docker compose config/build/up healthchecks; CI build/test; secret scan; reproducible bootstrap.

## 1. Budget and approach (kickoff §3, PD-P03-02)

| Item | Value |
|---|---|
| Infrastructure checks | `tests/infrastructure/`, Python 3 **standard library only**, `unittest`. **4 modules + 1 helper**, about 700 lines in total (§2). No PyYAML, pytest, Bats, Terratest or `act`. Compose structure comes from `docker compose config --format json`. Workflow and Dependabot files get line-based checks plus actionlint |
| Negatives | in-memory mutations of a small **inline synthetic base model** (compose JSON dict, workflow text, Dependabot text, `.env.example` text, manifest dict), or mutated copies in a `tempfile.TemporaryDirectory()`. **At most one mutation per defect class. No committed negative fixtures.** Each table-driven negative group first asserts that the unmutated base passes the checker, so a checker that rejects everything cannot pass |
| Backend canary | `backend/tests/ResumeBuilder.Toolchain.Tests`, xUnit v3, **3 tests** (§6.1) |
| Frontend canary | `frontend/src/app/App.test.tsx`, Vitest + RTL, **2 tests** (§6.2) |
| E2E | `tests/e2e/` package with only `@playwright/test` (exact) and its lockfile, **one spec with 2 tests**, × 3 projects (chromium, firefox, webkit) in the pinned Playwright image (§6.3) |
| Suite | `../tests/suite.cmd`, **2 commands** (§7) |
| Clean-checkout run | QA item, run once (PD-P03-03, §9). Not a suite line |
| Test levels | **static policy** (parsed config), **script behaviour** (real scripts run with stub tools or as temp copies), **scanner sensitivity** (pinned scanners on planted input), **service smoke** (live Compose project), **toolchain canaries** (xUnit/Testcontainers, Vitest/RTL, Playwright × 3 engines). Contract tests are the P02 suite, run unchanged by `integration.sh`. Unit, component and rendering tests of product code, plus performance tests, are **N/A**: P03 has no product code |

The plan fits the budget. The Should items (AC-P03-17, AC-P03-18, and the S-labelled extras in §5) are cut first if the line budget gets tight. No larger budget is requested.

### Rules for every test

- **Missing tool = failure, never a skip.** The helper's `need(tool)` calls `self.fail("ENV_MISSING <tool>: <how to get it>")` when a binary is not on `PATH`, the Docker daemon does not answer, an image cannot be pulled or a required env var is unset. `skipTest`, `@unittest.skip*`, `expectedFailure`, Vitest `.skip`/`.todo`, Playwright `test.skip`/`test.fixme` and `.only` are not used (review item).
- Images come only from `infrastructure/images.lock`. No test runs or pulls an image by a bare tag.
- Credential-shaped strings are **generated at run time** (a seeded `random.Random`, with the rule prefix put together from two parts). No test source, and no line of this plan, holds a literal that matches the handoff-check `SECRET_RE` or a gitleaks default rule, because `security.sh` scans the working tree and its history.
- Fixture data is fictional: `example.test` addresses, the `resumiser_smoke` database, subjects `resumiser-smoke-<nonce>`.
- Temp files go to `tempfile` directories only. Repository files are never written by a test.
- Containers that tests start themselves are removed in `finally`/`tearDown` (`docker rm -f`).

## 2. Module design (for the Test Engineer)

| File | Run by | Content | Docker needed |
|---|---|---|---|
| `tests/infrastructure/infra_helpers.py` | imported | repository root (from `__file__`); `need()`; `run()` (subprocess, text, timeout); `images_lock()` parser; `compose_config(env_file)`; line-based `workflow_jobs(text)` and `dependabot_pairs(text)`; `tsconfig_load()` (strips `//` and `/* */` comments and trailing commas, then `json.loads`); `copy_tree(paths, dst)`; `path_without(tool)` (temp `bin/` with symlinks to every executable on the current `PATH` except `tool`); `stub(dir, name, body)` (writes an executable bash stub); one checker function per rule, returning a list of violations | — |
| `test_static_policy.py` | `security.sh` and suite line 2 | §5.1 checks S-01…S-41 and their in-memory negatives | `docker compose config` only (the CLI, no daemon) |
| `test_scripts.py` | suite line 2 | §5.2 script behaviour D-01…D-15: `local.sh`, `integration.sh` and `preflight.sh` on temp copies with stub jobs; `backend.sh`, `frontend.sh` and `e2e.sh` with stub tools; locked-mode restore on a temp copy; Compose residue check | yes (D-15), `dotnet` (D-14) |
| `test_scanners.py` | suite line 2 | §5.3 pinned gitleaks, OSV-Scanner, shellcheck and actionlint on planted input with a clean control | yes |
| `smoke_compose.py` | `integration.sh` only (pattern `smoke_*.py`, so `discover -p 'test_*.py'` never picks it up) | §5.4 live smoke M-01…M-05 against the running `resumiser-ci` project and negative M-N1 | yes |

Module invocation (all from the repository root):
- `security.sh`: `python3 -B -m unittest discover -s tests/infrastructure -p 'test_static_policy.py'`
- `integration.sh`: `python3 -B -m unittest discover -s tests/infrastructure -p 'smoke_*.py'` while the CI project is up
- suite line 2: `python3 -B -m unittest discover -s tests/infrastructure -p 'test_*.py' -v`

## 3. Test interfaces the implementation must honour

These turn plan wording into something a check can call. They come from phase-plan §4, §5 and §8. F-1, F-2 and F-4 (§10) ask the Solution Architect to confirm the ones that add detail.

| ID | Interface | Used by |
|---|---|---|
| I-1 | `infrastructure/images.lock`: one `NAME=repo:tag@sha256:<64 hex>` per line, `#` comments and blank lines allowed, unique names. Checks find entries by the **last path component of the repository**: `mongo`, `azurite`, `mailpit`, `ryuk`, `playwright`, `gitleaks`, `osv-scanner`, `actionlint`, `shellcheck`, `oasdiff`. Each of these appears exactly once | S-10…S-13, D-*, X-*, M-N1, C-B2/3 |
| I-2 | `scripts/ci/integration.sh` (a) resolves the repository root from its own location; (b) **first** ensures `refs/heads/main` exists (if it is missing and `refs/remotes/origin/main` exists, it creates it with `git fetch --no-tags origin main:main` or an equivalent); if no `main` can be found, it prints a message containing `main` and exits non-zero **before running any suite line**; (c) then reads `docs/phases/P02/tests/suite.cmd` **at run time** and runs its non-blank, non-`#` lines in order from the repository root, stopping at the first failure; (d) exports `npm_config_ignore_scripts=true` before the suite lines (F-1); (e) only then starts the Compose smoke | S-30, D-05…D-07 |
| I-3 | Compose smoke project name is exactly **`resumiser-ci`**. `integration.sh` sets the four `RESUMISER_*_PORT` variables to `0` (Docker picks free loopback ports), runs `docker compose -p resumiser-ci pull`, then `up -d --wait --wait-timeout 120`, then `smoke_compose.py`, and runs `down -v` in a `trap` on `EXIT`. The smoke finds host ports with `docker compose -p resumiser-ci port <service> <port>` (F-3, F-4) | S-30, D-15, M-* |
| I-4 | `scripts/ci/backend.sh` exports `RESUMISER_MONGO_IMAGE` (the `mongo` entry) and `TESTCONTAINERS_RYUK_CONTAINER_IMAGE` (the `ryuk` entry) from `images.lock` before `dotnet test` | C-B2, C-B3 |
| I-5 | `scripts/ci/local.sh` runs `preflight.sh`, then `<job>.sh` from **its own directory**. It prints one result line per job that holds the job name and `PASS` or `FAIL` (for example `local: security FAIL (exit 3)`). An unknown job name makes it exit non-zero and name the job | D-01…D-03 |
| I-6 | `scripts/ci/preflight.sh` names the failing tool in its output. The recommended format is `preflight: ENV_MISSING <tool>` or `preflight: ENV_VERSION <tool> want <x> got <y>` | D-08…D-10 |
| I-7 | Scripts call `docker`, `dotnet`, `node`, `npm`, `git` and `python3` through `PATH`, never through absolute paths, so that stub tools work | D-08…D-13 |
| I-8 | `frontend/package.json` script `test` runs Vitest in run mode (`vitest run`, not watch mode) | S-33 |

## 4. Acceptance mapping

Pri: M = Must, S = Should. "Where" says which suite line or QA step runs the case: L1 = suite line 1 (`local.sh`, all jobs), L2 = suite line 2 (unittest), QA = §9.

| AC | Pri | Positive case(s) | Negative case(s) | Where |
|---|---|---|---|---|
| AC-P03-01 Compose services healthy, replica set, Mailpit, Azurite, `down -v` | M | S-01 (resolves, 3 services, mongo `--replSet rs0`), S-02 (healthcheck on every service), M-01…M-05 (live smoke), D-15 (no `resumiser-ci` containers, volumes or networks left) | N-S02 (one service without a healthcheck); M-N1 (the same replica-set assertion against a MongoDB started without `--replSet` fails) | L1 (integration), L2 |
| AC-P03-02 Compose hygiene | M | S-03…S-09, S-10, S-11 | N-S03 tag without digest; N-S04 digest ≠ lock; N-S05a `0.0.0.0`; N-S05b no host IP; N-S06 bind mount instead of a named volume; N-S07 second network; N-S08a `privileged: true`; N-S08b `network_mode: host`; N-S08c Docker socket mount; N-S09 password-like env value; N-S10 Azurite telemetry flag removed | L1 (security), L2 |
| AC-P03-03 env conventions | M | S-14 (`.env.example` values), S-15 (`git check-ignore`), S-01 (Compose with an empty env file) | N-S14a `AccountKey=` + generated base64; N-S14b non-loopback URL with userinfo; N-S15 temp git repo whose `.gitignore` lacks the `.env` rules | L1, L2 |
| AC-P03-04 `backend.sh` | M | L1 job `backend` exit 0 (locked restore, `-warnaserror` build, `dotnet format --verify-no-changes`, C-B1…C-B3); S-35 (central exact versions, lock files, build props) | D-11 (`dotnet test` fails → script exits non-zero); D-14 (lock `requested` ≠ props → `--locked-mode` restore fails with `NU1004`); N-S35 floating version `1.*` | L1, L2 |
| AC-P03-05 `frontend.sh` | M | L1 job `frontend` exit 0 (C-F1, C-F2); S-33 (exact versions, engines, script contract), S-34 (three TS flags) | D-12 (failing `npm test` → script exits non-zero); N-S33a `^`, N-S33b `~`; N-S34 one flag removed | L1, L2 |
| AC-P03-06 `e2e.sh` | M | L1 job `e2e` exit 0 (C-E1 × 3 engines); S-12 (Playwright package = image version); S-36 (config) | D-13 (Playwright container fails → script exits non-zero); C-E2 (the request guard catches a non-loopback request); N-S12 version mismatch | L1, L2 |
| AC-P03-07 `integration.sh` | M | L1 job `integration` exit 0; S-30 (static); D-06 (clone with no local `main` finds `origin/main`) | D-05 (a failing stand-in for suite line 2 → non-zero, line 3 and the smoke never run); D-07 (no `main` anywhere → non-zero, message names `main`, no suite line ran) | L1, L2 |
| AC-P03-08 jobs independent | M | S-20 (5 jobs, one `run:` each), S-21 (no `needs:` on backend/frontend; no cross-script calls); Q-02, Q-03 (isolated runs) | N-S20 extra inline `run:`; N-S21 `needs: backend` on `frontend` | L2, QA |
| AC-P03-09 workflow hardening | M | S-22…S-27; actionlint in `security.sh` (L1) | N-S22 `contents: write`; N-S23 `pull_request_target`; N-S24 `secrets.X`; N-S25 tag-pinned `uses:`; N-S26 `persist-credentials: false` missing; N-S27 `timeout-minutes` missing | L1, L2 |
| AC-P03-10 secret scan | M | gitleaks tree + history in `security.sh` (L1); handoff check secret rule; S-16 (`.gitleaks.toml` extends defaults, no blanket allowlist) | X-01 (planted generated credential → gitleaks non-zero; clean control → 0); N-S16 blanket path allowlist | L1, L2 |
| AC-P03-11 dependency scan, Dependabot, `--ignore-scripts` | M | OSV-Scanner in `security.sh` (L1); S-17 (`osv-scanner.toml` waivers), S-18 (Dependabot pairs), S-29 (`--ignore-scripts`, I-2(d)), S-31 (all lockfiles covered) | X-02 (lockfile with a known-vulnerable version → exit 1); N-S17 waiver without expiry; N-S18 `/tests/e2e` npm entry removed; N-S29 `npm ci` without `--ignore-scripts` | L1, L2 |
| AC-P03-12 `local.sh` | M | L1 exit 0; D-02 (`local.sh frontend` runs only that job); D-01 runs from `cwd=/` | D-01 (stub `security` fails → non-zero, all 5 result lines, every job ran); D-03 (unknown job → non-zero) | L1, L2 |
| AC-P03-13 clean checkout, preflight | M | Q-01 (fresh `git clone`, `local.sh` exit 0); D-10 (`preflight.sh` exit 0 on the reference machine) | D-08 (`PATH` without `dotnet` → non-zero, names `dotnet`); D-09 (stub `node` reports `v22.11.0` → non-zero, names `node`) | L2, QA |
| AC-P03-14 ADR-041 tools | M | S-37 (no rejected tool, required tools present), S-38 (ADR-041 Accepted, in register) | N-S37 temp manifest with `Moq` (and the boundary: `@testing-library/jest-dom` is **not** flagged as Jest) | L2 |
| AC-P03-15 privacy, telemetry | M | S-28 (each script sets `DOTNET_CLI_TELEMETRY_OPTOUT=1` and `REDOCLY_TELEMETRY=off`, directly or by sourcing a file under `scripts/ci/`), S-10 (Azurite/Mailpit opt-outs), S-27b (only `actions/checkout`, `actions/setup-dotnet`, `actions/setup-node`), S-32 (no upload commands); C-E1 (no third-party request); review of fixtures | N-S28 temp script copy without `DOTNET_CLI_TELEMETRY_OPTOUT` | L1, L2 |
| AC-P03-16 scope, no generated output tracked | M | handoff check RESULT PASS; S-39 (no generated path among `git ls-files -co --exclude-standard`; representative generated paths are ignored) | — | handoff, L2 |
| AC-P03-17 shellcheck | S | shellcheck in `security.sh` (L1) | X-03 (unquoted `$1` → SC2086; quoted control → 0) | L1, L2 |
| AC-P03-18 docs | S | review; S-40 (the four READMEs exist; `infrastructure/README.md` mentions `local.sh`, `docker compose up`, `down -v`, `images.lock` and the four default ports) | — | L2, review |

Every Must criterion has at least one positive and one negative case, except AC-P03-16 (negative "—" in the acceptance criteria).

## 5. Case catalogue

### 5.1 Static policy (`test_static_policy.py`)

Positive cases run on the real files. The `N-` cases run the same checker on the synthetic base with one mutation, and each must report exactly the intended violation.

| ID | Check (oracle) | AC |
|---|---|---|
| S-01 | Run `docker compose --env-file <empty temp file> config --format json` with every `RESUMISER_*` variable removed from the environment. Expect exit 0 and no `variable is not set` in stderr. Project `resumiser`; services exactly `{mongo, azurite, mailpit}` (any other service must have a `profiles` entry); mongo `command` contains `--replSet` and `rs0`; published host ports default to 27017, 10000, 1025 and 8025 | 01, 03 |
| S-02 | Every service has a `healthcheck.test` that is non-empty and not `["NONE"]`, and `disable` is not true | 01 |
| S-03 | Every `image` matches `^[a-z0-9./_-]+:[A-Za-z0-9._-]+@sha256:[0-9a-f]{64}$` | 02 |
| S-04 | Every `image` equals an `images.lock` entry (I-1) | 02 |
| S-05 | Every published port has `host_ip == "127.0.0.1"` | 02 |
| S-06 | `mongo` and `azurite` keep their data in `type: volume` mounts whose source is a top-level named volume. No bind mount of a host path | 02 |
| S-07 | Exactly one top-level network, and every service is attached to it only | 02 |
| S-08 | No `privileged: true`, no `network_mode: host`, no `pid: host`, no volume source containing `docker.sock` | 02 |
| S-09 | No credential-like environment value. A key matching `(?i)pass|secret|token|api_?key|account_?key|credential` fails unless its value is a placeholder (`change-me`, `<set-in-key-vault>`). A value matching `AccountKey=`, `(?i)password=` or URL userinfo (`://user:pw@`) fails | 02 |
| S-10 | Azurite `command` contains `--disableTelemetry`. Mailpit sets `MP_DISABLE_VERSION_CHECK` to true, or its `command` contains `--disable-version-check` | 02, 15 |
| S-11 | `images.lock` is well-formed (I-1): every line matches `NAME=<S-03 pattern>`, names are unique, all 10 repositories are present once; `mongo` tag `8.0.<n>`, Azurite tag `3.<…>`, Mailpit tag `v1.<…>` | 02 |
| S-12 | The Playwright entry's tag starts with `v<X.Y.Z>-` and `X.Y.Z` equals the exact `@playwright/test` version in `tests/e2e/package.json` | 06 |
| S-13 | The `oasdiff` entry equals the image literal in `tests/contract/checks/types-diff.test.mjs` (P03-OBL-02) | 02, 11 |
| S-14 | `.env.example` exists and is not ignored. It defines `RESUMISER_MONGO_PORT`, `RESUMISER_AZURITE_BLOB_PORT`, `RESUMISER_MAILPIT_SMTP_PORT` and `RESUMISER_MAILPIT_UI_PORT`. Every `KEY=VALUE` line (key `[A-Z0-9_]+`) has a value that is one of: an integer 1–65535; a URL or `host:port` whose host is `127.0.0.1`, `localhost` or `[::1]`, without userinfo; `UseDevelopmentStorage=true`; `change-me`; `<set-in-key-vault>`. Comment lines must not contain `AccountKey=`, URL userinfo, a run of 32 or more base64 characters, or a handoff `SECRET_RE` match | 03 |
| S-15 | `git check-ignore -q .env` and `git check-ignore -q .env.local` exit 0; `git check-ignore -q .env.example` exits 1 | 03 |
| S-16 | `.gitleaks.toml` has `[extend]` with `useDefault = true`. Every allowlist entry has a `description`, and no `paths` or `regexes` entry is a blanket (`.*`, `.`, `^.*$`, `**`, empty) | 10 |
| S-17 | `osv-scanner.toml` is absent or empty, or every `[[IgnoredVulns]]` entry has `id`, `reason` and an ISO date `ignoreUntil` | 11 |
| S-18 | `.github/dependabot.yml` (line-based pairs of `package-ecosystem` and `directory`) holds at least `npm` with `/frontend`, `/tests/contract` and `/tests/e2e`; `nuget` with `/backend`; `github-actions` with `/`; `docker-compose` or `docker` with `/` | 11 |
| S-20 | `.github/workflows/ci.yml` jobs are exactly `backend`, `frontend`, `e2e`, `integration` and `security`. Each job has exactly one `run:`, and its value is `scripts/ci/<job>.sh` (an optional `./` prefix is allowed) | 08 |
| S-21 | `backend` and `frontend` have no `needs:`. `scripts/ci/backend.sh` does not mention `frontend`, and `scripts/ci/frontend.sh` mentions neither `backend` nor `dotnet` | 08 |
| S-22 | Top-level `permissions:` is `contents: read`. No `: write` and no `write-all` anywhere | 09 |
| S-23 | No `pull_request_target`. Triggers include `push`, `pull_request` and `workflow_dispatch` | 09 |
| S-24 | No `secrets.` anywhere | 09 |
| S-25 | Every `uses:` matches `<owner>/<repo>[/path]@[0-9a-f]{40}\s+#\s*v\d+(\.\d+){0,2}` | 09 |
| S-26 | In each job, the number of `actions/checkout` uses equals the number of `persist-credentials: false` lines | 09 |
| S-27 | (a) Every job has `timeout-minutes` and `runs-on: ubuntu-24.04`. (b) The only actions used are `actions/checkout`, `actions/setup-dotnet` and `actions/setup-node` (so there is no upload-artifact or reporting action) | 09, 15 |
| S-28 | Each `scripts/ci/*.sh` exports `DOTNET_CLI_TELEMETRY_OPTOUT=1` and `REDOCLY_TELEMETRY=off`, directly or by sourcing a file under `scripts/ci/` that exports them | 15 |
| S-29 | Every `npm ci`, `npm install` and `npm i` in `scripts/ci/*.sh` and `scripts/dev/*.sh` has `--ignore-scripts`. `integration.sh` exports `npm_config_ignore_scripts=true` (I-2(d), F-1) | 11 |
| S-30 | `integration.sh` mentions `docs/phases/P02/tests/suite.cmd` and does not hold the three suite commands inline. Every `docker compose` call in it uses `-p resumiser-ci`. `up` has `--wait` and a `--wait-timeout` ≤ 120. `down -v` is inside a `trap` (I-2, I-3) | 01, 07 |
| S-31 | Every `package-lock.json` and `packages.lock.json` among `git ls-files -co --exclude-standard` (outside `node_modules`) appears literally in `security.sh`, or `security.sh` builds its list with `git ls-files` using those two file names | 11 |
| S-32 | No script under `scripts/ci/` or `scripts/dev/` calls `curl` or `wget` with an upload flag (`-T`, `--upload-file`, `-F`, `-d`, `--data*`, `-X POST`, `-X PUT`), and none mentions `codecov`, `coveralls`, `sonar` or `upload-artifact` | 15 |
| S-33 | `frontend/package.json` and `tests/e2e/package.json`: every `dependencies` and `devDependencies` version is exact (`^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$`). Frontend: `private: true`, `type: module`, `engines.node` `>=24.18 <25`, scripts `lint`, `typecheck`, `test`, `build` and `preview`; `test` contains `vitest run` (I-8). E2E: the only dependency is `@playwright/test` | 05, 06 |
| S-34 | Every `frontend/tsconfig*.json` with an `include` or `files` key has `strict`, `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` set to true, directly or through its `extends` chain inside `frontend/` | 05 |
| S-35 | `backend/global.json`: SDK `10.0.3xx`, `rollForward: latestPatch`. `Directory.Packages.props`: `ManagePackageVersionsCentrally` true, every `PackageVersion` `Version` exact (no `*`, `[`, `(`, `,`). No `PackageReference` has a `Version` attribute. `Directory.Build.props`: `net10.0`, `TreatWarningsAsErrors` true, `RestorePackagesWithLockFile` true. Every `backend/**/*.csproj` has a `packages.lock.json` next to it. `nuget.config` has `<clear />`, only the nuget.org source and `packageSourceMapping` | 04, 11 |
| S-36 | `tests/e2e/playwright.config.ts` (line-based) contains `retries: 0`, `forbidOnly`, the projects `chromium`, `firefox` and `webkit`, and a `webServer` URL on `127.0.0.1` | 06 |
| S-37 | Package names from every `package.json` (frontend, `tests/e2e`, `tests/contract`) and every backend `PackageVersion`/`PackageReference`, compared case-insensitively and **exactly**: none of `FluentAssertions`, `Moq`, `jest`, `@jest/globals`, `ts-jest`, `babel-jest`, `jest-environment-jsdom`, `cypress`. Present: backend `xunit.v3`, `Microsoft.NET.Test.Sdk`, `Testcontainers.MongoDb`; frontend `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`; e2e `@playwright/test` | 14 |
| S-38 | ADR-041 says `Status: **Accepted**`, and `docs/blueprint/DECISION-REGISTER.md` has a row naming ADR-041 with `ACCEPTED` | 14 |
| S-39 | No path among `git ls-files -co --exclude-standard` has a directory component `bin`, `obj`, `dist`, `node_modules`, `TestResults`, `playwright-report`, `test-results`, `.work` or `coverage`, or ends with `.trx`. `git check-ignore -q` exits 0 for `frontend/dist/x`, `frontend/node_modules/x`, `tests/e2e/node_modules/x`, `tests/e2e/test-results/x`, `tests/e2e/playwright-report/x`, and for `bin/x`, `obj/x` and `TestResults/x` under the canary project | 16 |
| S-40 (S) | `infrastructure/README.md`, `backend/README.md`, `frontend/README.md` and `tests/e2e/README.md` exist. `infrastructure/README.md` mentions `scripts/ci/local.sh`, `docker compose up`, `down -v`, `images.lock`, 27017, 10000, 1025 and 8025 | 18 |
| S-41 (S) | Every `scripts/ci/*.sh` starts with a bash shebang, has `set -euo pipefail` in its first 10 lines, has LF line endings only and the executable bit (phase-plan §5.1). No script under `scripts/ci/` holds a literal `@sha256:` image reference (images come from `images.lock`) | 04–07, 12 |

### 5.2 Script behaviour (`test_scripts.py`)

Stub tools are small bash files written into a temp `bin/` that comes first on `PATH`. Each stub appends its arguments to a log file, so the test can prove which step failed.

| ID | Setup → expected | AC |
|---|---|---|
| D-01 | Temp tree `T/scripts/ci/` with a copy of `local.sh` and of every non-job file under `scripts/ci/` (for example a sourced `lib/`). `preflight.sh` and the five job scripts are stubs that log their name; the `security` stub exits 3. Run `bash T/scripts/ci/local.sh` with `cwd=/` → exit ≠ 0; 5 result lines, `security` marked FAIL and the other four PASS; the log shows all five jobs in the order security, backend, frontend, e2e, integration | 12 |
| D-02 | Same tree, all stubs exit 0, run `local.sh frontend` → exit 0; only `preflight` and `frontend` ran; one result line | 12 |
| D-03 | Same tree, run `local.sh nosuchjob` → exit ≠ 0; output names `nosuchjob` | 12 |
| D-05 | Temp git repo (`git init`, one commit, branch `main`) holding copies of `scripts/ci/**` and a stub `docs/phases/P02/tests/suite.cmd` with the lines `true`, `false` and `touch <marker>`; stub `docker` that logs its arguments. Run `integration.sh` → exit ≠ 0; `<marker>` does not exist; the docker log has no `up` | 07 |
| D-06 | Temp origin repo with branch `main`; clone it; in the clone, check out branch `work` and delete local `main`; stub suite line 1 `git rev-parse --verify refs/heads/main > <out>`, line 2 `false`. Run `integration.sh` → `<out>` holds the `origin/main` commit (the baseline was found); exit ≠ 0 comes from the stub line 2. Offline: the origin is a local path | 07 |
| D-07 | Temp origin repo whose only branch is `trunk`; clone it, so neither `main` nor `origin/main` exists; stub suite line 1 `touch <marker>`. Run `integration.sh` → exit ≠ 0; output contains `main`; `<marker>` does not exist | 07 |
| D-08 | `PATH` = `path_without("dotnet")`, `DOTNET_ROOT` unset. Run `scripts/ci/preflight.sh` → exit ≠ 0; output contains `dotnet` | 13 |
| D-09 | Stub `node` that prints `v22.11.0`, first on `PATH`. Run `preflight.sh` → exit ≠ 0; output contains `node` | 13 |
| D-10 | Unmodified environment: `preflight.sh` → exit 0 (reference machine) | 13 |
| D-11 | Stub `dotnet` that exits 1 when its first argument is `test` and 0 otherwise. Run the real `scripts/ci/backend.sh` → exit ≠ 0; the stub log contains `test` | 04 |
| D-12 | Stub `npm` that exits 1 for `test` (or `run test`) and 0 otherwise. Run the real `scripts/ci/frontend.sh` → exit ≠ 0; the stub log contains `test`. The stub never touches `node_modules` | 05 |
| D-13 | Stub `npm` exits 0; stub `docker` exits 1 for `run`. Run the real `scripts/ci/e2e.sh` → exit ≠ 0; the docker log contains `run` and the Playwright image reference from `images.lock` | 06 |
| D-14 | Copy `backend/` (its `git ls-files -co --exclude-standard` files only, so no `bin/` or `obj/`) to a temp directory. In the canary's `packages.lock.json`, change the `requested` value of one direct dependency. Run `dotnet restore --locked-mode <tmp>/backend/ResumeBuilder.slnx` → exit ≠ 0; output contains `NU1004` | 04 |
| D-15 | Residue after the integration job (it runs after suite line 1): `docker ps -a`, `docker volume ls` and `docker network ls`, each with `--filter label=com.docker.compose.project=resumiser-ci`, return nothing | 01 |
| D-16 (S) | Copy `frontend/src` and the tsconfig files to a temp directory with a symlink to the existing `frontend/node_modules` (read-only use; `ENV_MISSING` if it does not exist); add `const xs: string[] = []; const s: string = xs[0];`; run `node_modules/.bin/tsc -p <tmp> --noEmit` → exit ≠ 0 with `TS2322`. This proves that `noUncheckedIndexedAccess` is in effect, not only that it is written down. Cut first if the line budget is tight | 05 |

### 5.3 Scanner sensitivity (`test_scanners.py`)

Each case runs the pinned image from `images.lock` with the temp directory mounted read-only. A clean control proves that the non-zero exit comes from the finding and not from a usage error.

| ID | Planted input → expected | Control | AC |
|---|---|---|---|
| X-01 | `T/config.txt` with a GitHub-token-shaped string (prefix assembled from two parts, 36 characters from `random.Random(20261103)`) → gitleaks (`dir` or `detect --no-git`, matching the pinned version) exits ≠ 0 and reports one finding | same directory without the token → exit 0 | 10 |
| X-02 | `T/package-lock.json` (lockfileVersion 3) with `node_modules/lodash` at `4.17.20` (advisory GHSA-35jh-r3h4-6jhm, CVE-2021-23337) → OSV-Scanner exits exactly **1** (vulnerabilities found), output names `lodash` | exit codes 127/128 (tool error, no packages) are a test failure, not a pass | 11 |
| X-03 (S) | `T/a.sh` with `echo $1` → shellcheck exits ≠ 0, output contains `SC2086` | `echo "$1"` → exit 0 | 17 |
| X-04 (S) | Temp workflow with `runs-on: ubuntu-24.04` misspelled as a job key `run-on:` → actionlint exits ≠ 0 | the real `.github/workflows/ci.yml` → exit 0 | 09 |

### 5.4 Compose smoke (`smoke_compose.py`, run by `integration.sh` with `resumiser-ci` up)

If the project is not running, the module fails with `ENV_MISSING compose project resumiser-ci is not up`; it never skips.

| ID | Check | AC |
|---|---|---|
| M-01 | `docker compose -p resumiser-ci ps --format json`: `mongo`, `azurite` and `mailpit` are `running` and `healthy` | 01 |
| M-02 | `assert_replica_set(exec_prefix)`: `mongosh --quiet --eval` through `docker compose -p resumiser-ci exec -T mongo` returns `rs.status()` with `set == "rs0"`, `myState == 1` and one member; `db.getSiblingDB("resumiser_smoke").smoke.insertOne({fictional: true}, {writeConcern: {w: "majority"}})` is acknowledged | 01 |
| M-03 | `smtplib` sends a message from `smoke@example.test` to `inbox@example.test` with subject `resumiser-smoke-<nonce>` to `127.0.0.1:<smtp port>`; `urllib` GET `http://127.0.0.1:<ui port>/api/v1/messages` lists that subject (poll every 0.5 s, at most 10 s) | 01 |
| M-04 | `urllib` GET `http://127.0.0.1:<blob port>/devstoreaccount1?comp=list`; an HTTP error status counts as an answer; the `Server` response header contains `Azurite-Blob` | 01 |
| M-05 | Every `docker compose -p resumiser-ci port` result is `127.0.0.1:<n>` | 01, 02 |
| M-N1 | `docker run -d --name resumiser-ci-norepl-<pid>` with the `mongo` image from `images.lock`, **without** `--replSet`, no published port; wait until `db.runCommand({ping: 1})` succeeds (at most 30 s); `assert_replica_set(["docker", "exec", name])` must raise `AssertionError`; `docker rm -f` in `finally` | 01 |

## 6. Toolchain canaries (Test Engineer writes them; ADR-041 evidence)

### 6.1 Backend: `backend/tests/ResumeBuilder.Toolchain.Tests` (xUnit v3, `net10.0`)
- **C-B1** `Environment.Version.Major == 10` and `RuntimeInformation.FrameworkDescription` starts with `.NET 10`.
- **C-B2** Reads `RESUMISER_MONGO_IMAGE` (I-4). It fails with `ENV_MISSING` if the variable is unset and asserts that the value contains `@sha256:`. It starts the container with Testcontainers.MongoDb as replica set `rs0`, checks that `replSetGetStatus` gives `myState == 1`, and inserts one fictional document with `WriteConcern.WMajority`; the write must be acknowledged. Docker missing → failure.
- **C-B3** `TESTCONTAINERS_RYUK_CONTAINER_IMAGE` is set and contains `@sha256:` (DD-P03-21, R-5).
- Packages: `xunit.v3`, `xunit.runner.visualstudio`, `Microsoft.NET.Test.Sdk`, `Testcontainers.MongoDb` and `MongoDB.Driver` (canary only), all versioned centrally. Negatives for the backend toolchain are D-11 and D-14.

### 6.2 Frontend: `frontend/src/app/App.test.tsx` (Vitest, jsdom, RTL, jest-dom)
- **C-F1** `render(<App />)`; `screen.getByRole('main')` is in the document.
- **C-F2** `screen.getByRole('heading', { level: 1, name: 'Resumiser' })` is in the document.
- Imports `App` as a named export from `./App` (phase-plan §8.2). The negative is D-12 (with D-16 as a Should).

### 6.3 E2E: `tests/e2e/smoke.spec.ts` (Playwright Test in the pinned image; projects chromium, firefox, webkit)
- Shared helper `trackExternal(page)` records every request whose URL scheme is `http`, `https`, `ws` or `wss` and whose hostname is not `127.0.0.1`. `data:`, `blob:` and `about:` are ignored.
- **C-E1** `page.goto('/')` → `getByRole('main')` and `getByRole('heading', { level: 1, name: 'Resumiser' })` are visible after the network is idle; `trackExternal` lists nothing.
- **C-E2** (guard self-test, the AC-P03-06 negative) `page.route` aborts every non-loopback request, so nothing leaves the machine. `page.setContent('<img src="http://203.0.113.7/x.png">')` (TEST-NET-3, no DNS lookup) → `trackExternal` lists exactly one request, to host `203.0.113.7`. This proves that C-E1 would fail on a third-party request.
- `retries: 0`; `forbidOnly` in CI; reports go to ignored directories (S-36, S-39).

## 7. Suite (`../tests/suite.cmd`, owned by the Test Engineer)

Recommended, 2 lines, run by the handoff check with `bash -lc` from the worktree root:

```text
bash scripts/ci/local.sh
python3 -B -m unittest discover -s tests/infrastructure -p 'test_*.py' -v
```

- Line 1 is the CI evidence (DD-P03-19): preflight plus all five jobs, including the canaries, the P02 suite, the Compose smoke and the scanners.
- Line 2 runs the negatives and the script-behaviour checks. It runs after line 1 because D-14 uses the warm NuGet cache and D-15 checks for leftovers from line 1. Run on its own, D-15 still holds and D-14 needs network access for NuGet.
- Determinism: after downloads, every case is deterministic except OSV-Scanner over the real lockfiles, which depends on the advisory database date (DD-P03-09; `test-results.md` records the date). X-02 uses an advisory published in 2021 and stays stable. Free ports come from Docker (`0` mapping), not from the test.
- Expected duration on a warm cache: about 5 to 10 minutes. The first run pulls the Playwright, MongoDB, scanner and SDK-side images.

### Red state (Test Engineer step, before the Developer)

| Case group | Expected red reason (the **only** acceptable one) |
|---|---|
| L1 | `scripts/ci/local.sh` does not exist (exit 127) |
| S-01…S-41 positives | artifact missing (`docker-compose.yml` has `services: {}`; `images.lock`, the workflow, `.env.example` keys, manifests and scripts are missing) |
| S-/N- negatives on the synthetic base | **green already**: they prove that each checker is sensitive before any artifact exists |
| D-01…D-15 | the script under test is missing (`FileNotFoundError` turned into an assertion message naming the script); D-14 has no `backend/` to copy; D-15 is green (no residue) |
| X-01…X-04 | the `images.lock` entry is missing |
| canaries | no project, package or config yet, so the job scripts that would run them do not exist |

Import errors, syntax errors or a test that fails for any other reason are Test Engineer defects, not red evidence.

## 8. Environment, prerequisites and what cannot run here

Checked on the reference machine (this worktree), 2026-11-03:

| Prerequisite | Reference value | If missing |
|---|---|---|
| Docker Engine + Compose v2 plugin | Engine 29.6.1, Compose v5.3.1, daemon reachable | every Docker-dependent case fails `ENV_MISSING docker`; `preflight.sh` exits non-zero |
| .NET SDK (10.0.3xx band, `global.json`) | 10.0.301 | `ENV_MISSING dotnet` / preflight fails |
| Node 24 (≥ 24.18), npm ≥ 11 | Node 24.22.2, npm 11.19.1 | preflight fails |
| Python ≥ 3.11 | 3.13.5 | the suite cannot start (handoff shows a non-zero exit) |
| git | present | — |
| Network: Docker Hub, mcr.microsoft.com, ghcr.io, registry.npmjs.org, api.nuget.org, api.osv.dev | reachable (api.osv.dev answered 2026-11-03) | pulls, restores and OSV lookups fail; the failing case reports `ENV_MISSING network/<host>`. There is no offline pass mode |
| actionlint, gitleaks, OSV-Scanner, shellcheck **binaries** | not installed on the host, and **not needed**: they run from digest-pinned images (ADR-042 §3) | — |

What cannot run in this environment, and the documented fallback:

| Item | Why | Fallback / evidence |
|---|---|---|
| Hosted GitHub Actions run of `ci.yml` | no remote; pushing is forbidden (ADR-035 A-5) | `local.sh` (L1) is the CI evidence; the workflow is checked by actionlint plus S-20…S-27; the first hosted run is a go-live item (DD-P03-19, decisions.md §5 item 4) |
| Runner parity with `ubuntu-24.04` | the host is Debian 13, kernel 6.12 | versions are pinned by `global.json`, `.nvmrc`, the lockfiles and the image digests; difference risk R-1 stays open until the first hosted run |
| Dependabot updates, GitHub secret scanning with push protection, branch protection | GitHub features | static S-18 only; owner go-live actions (decisions.md §5 items 2–3) |
| Cold-cache clean checkout (empty Docker image, NuGet and npm caches) | purging the developer's shared caches would be destructive | QA runs the clean checkout with warm caches (§9); "clean" means repository state. A cold run is a go-live observation, not a P03 gate item |
| `docker compose build` (PHASE.md strategy) | no build contexts in P03 (DD-P03-11) | N/A in P03; P04/P05 add their Dockerfiles and image scans |
| The "120 s on a warm cache" bound on another machine | depends on the machine | enforced as `--wait-timeout 120` after a separate `pull` (I-3, F-3) |

If a later step finds Docker or the network unavailable, the result is **red with `ENV_MISSING`**. The fallback is to run on the reference machine; there is never a skip or an "accepted as pass". The static checks that need no daemon still run and report.

## 9. QA procedure (AC-P03-13, AC-P03-08 isolated runs)

QA runs after the Developer's work is committed on `phase/P03` (PD-P03-03), so a real clone is possible. Each run uses a **fresh** clone in a new temp directory. Nothing is cleaned in place.

| ID | Steps | Pass |
|---|---|---|
| Q-01 | `git clone --branch phase/P03 "$(git rev-parse --path-format=absolute --git-common-dir)" "$D1"`; in `$D1`: `scripts/ci/preflight.sh`, then `scripts/ci/local.sh` | both exit 0; 5 PASS lines. The clone has `origin/main` but no local `main`, so the run also exercises the AC-P03-07 baseline path |
| Q-02 | fresh clone `$D2`: `scripts/ci/local.sh backend` | exit 0; only `backend` ran |
| Q-03 | fresh clone `$D3`: `scripts/ci/local.sh frontend` | exit 0; only `frontend` ran; `backend/` has no `bin/` or `obj/` afterwards (the frontend job did not build the backend) |
| Q-04 | after Q-01…Q-03: `git -C "$Dn" status --porcelain` | empty in each clone (scripts write only to ignored paths) |
| Q-05 | review: fixtures are fictional (AC-P03-15); no skip or `.only` constructs in tests (§1); README content (AC-P03-18) | reviewer and QA notes |

## 10. Findings for the Solution Architect

| ID | Finding | Recommended default (already used by this plan) | Blocks? |
|---|---|---|---|
| F-1 | AC-P03-07 says `integration.sh` runs the P02 `suite.cmd` lines **unchanged**, but line 1 is `npm ci --prefix tests/contract --no-audit --no-fund --prefer-offline` **without** `--ignore-scripts`. AC-P03-11 and P02 review i-8 require install scripts to be off, and `tests/contract` has a transitive install-time analytics package (`@scarf/scarf`). A literal static check on `scripts/ci/` would pass while the real install runs with scripts on | `integration.sh` exports `npm_config_ignore_scripts=true` before it runs the suite lines (I-2(d), checked by S-29). The command text stays unchanged and install scripts stay off | no |
| F-2 | AC-P03-07 negative "a clone with no `main` reference fails with a clear message": the P02 check (`types-diff.test.mjs`) **passes** without a baseline and only logs "first version (no baseline on main)". The failure must therefore come from `integration.sh` itself, before the suite runs | I-2(b): resolve `main` first and fail before any suite line; tested by D-07. I-2(c) (read `suite.cmd` at run time) also makes "unchanged" true by construction and testable with a stub file (D-05) | no |
| F-3 | AC-P03-01 "healthy within 120 s on a warm cache" is machine-dependent, and an `up` that includes image pulls is not a warm-cache measurement | I-3: `docker compose pull` first, then `up -d --wait --wait-timeout 120`. S-30 checks the bound; L1 proves it on the reference machine | no |
| F-4 | Phase-plan §4 and DD-P03-20 give the CI project name only as "for example `resumiser-ci`" and do not say how the smoke avoids the default host ports. A check needs a fixed name | I-3: name exactly `resumiser-ci`; ports set to `0`, so Docker assigns free loopback ports; the smoke discovers them with `docker compose port` | no |
| F-5 | AC-P03-12 does not say what `local.sh` does when **preflight** fails (run the jobs anyway, or stop) | report a preflight FAIL line and exit non-zero without running the jobs. D-01…D-03 do not depend on this choice | no |
| F-6 | AC-P03-15 "every script sets … `REDOCLY_TELEMETRY=off`" read literally includes scripts that never run Redocly | S-28 accepts both variables exported directly or through one sourced file under `scripts/ci/`, which keeps the rule uniform and cheap | no |
| F-7 | AC-P03-08 "each of `local.sh backend` and `local.sh frontend` passes alone on a clean checkout" and AC-P03-13 can only be shown by fresh checkouts, which the suite does not do (PD-P03-03) | QA Q-01…Q-03 (§9); after the Developer commit, a real `git clone` is used instead of the `ls-files` copy | no |

## 11. Evidence for `test-results.md`

For each run (red, green, QA), record:
- the exact commands with exit codes and durations;
- the environment: OS, Docker Engine and Compose versions, `dotnet --version`, `node --version`, `npm --version`, `python3 --version`;
- the `images.lock` content (or its SHA-256);
- the OSV-Scanner run date, which is the advisory database date (DD-P03-09);
- the gitleaks result for the tree and the history;
- the Playwright version and the three engines;
- the `up --wait` duration;
- for the red run, the per-case reason from §7;
- every `ENV_MISSING`, and any case that did not run, with the reason. A case that did not run is never recorded as passed.
