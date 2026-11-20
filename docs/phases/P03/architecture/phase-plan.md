# P03 Architecture Plan — Infrastructure & DevEx

- Author: Solution Architect (delegated, ADR-035), 2026-11-02. Kickoff: `../kickoff.md`.
- Decisions: `../decisions.md` (DD-P03-01…22, PD-P03-01…04), [ADR-041](../../../blueprint/decisions/ADR-041-test-tooling.md), [ADR-042](../../../blueprint/decisions/ADR-042-local-environment-ci-and-supply-chain.md).

## 1. Context

P01 decided the platform (ADR-002 .NET 10, ADR-003 Node 24 + npm + strict TS, ADR-004 MongoDB 8, ADR-009 Azure Blob/Azurite, ADR-033 Container Apps + GitHub Actions with scripts-first CI, ADR-034 SMTP/Mailpit). P02 froze the contract and its suite (`tests/contract/`, ADR-040) and left two obligations for P03:
- P03-OBL-01: the CI integration job runs the P02 suite and the breaking-change check against `main`;
- P03-OBL-02: dependency scanning covers `tests/contract/package-lock.json`, and the oasdiff image stays pinned by digest.

The repository has no build tooling yet: `docker-compose.yml` is `services: {}`, and `backend/` and `frontend/` contain a README only.

## 2. Scope

In scope (tasks in `../implementation/*.md`):
1. Local dependency services in Compose (§4).
2. CI: one script per job, one local command, a GitHub Actions workflow that calls only those scripts (§5).
3. Supply-chain and secret controls: secret scan, dependency scan, workflow lint, update automation, pinning rules (§6).
4. Env and secret conventions (§7).
5. Toolchain skeletons and canaries for backend, frontend and E2E (§3, §8).
6. Developer documentation for the above (`infrastructure/README.md`, `backend/README.md`, `frontend/README.md`, `tests/e2e/README.md`).

Out of scope: product code, layers, endpoints, routing, styling and tokens (P04/P05); our own application images (P04/P05, DD-P03-11); deployment and IaC (P15); rendering test tooling (P10, DD-P03-17); contract changes (none).

## 3. FR/NFR and risk mapping

| Source | P03 handling | Acceptance |
|---|---|---|
| PHASE.md DoD "clean checkout can build/test" | `scripts/ci/local.sh` from a fresh checkout; `scripts/ci/preflight.sh` | AC-P03-12, AC-P03-13 |
| PHASE.md DoD "backend/frontend jobs independent" | separate jobs and scripts, no `needs:` between them, each job runs alone | AC-P03-04, AC-P03-05, AC-P03-08 |
| PHASE.md DoD "integration job runs contract checks" | `scripts/ci/integration.sh` runs the three P02 suite commands and the Compose smoke | AC-P03-07 |
| NFR-08 (security baseline) | hardened workflow, secret scan, pinned supply chain | AC-P03-09…11 |
| NFR-09 (EU, no trackers) | tool telemetry off; no repository content sent to third-party services except package and image registries and the advisory DB (package coordinates only); CI uses fixture data only | AC-P03-15 |
| NFR-10 (durability basis) | local MongoDB is a replica set; `w: majority` works locally and in Testcontainers | AC-P03-01, AC-P03-04 |
| ADR-004 / ADR-009 / ADR-034 | `mongo` 8.0.x replica set, Azurite Blob, Mailpit | AC-P03-01, AC-P03-02 |
| ADR-002 / ADR-003 | `backend/global.json` (10.0.3xx band), `frontend/.nvmrc` (24), strict TS flags | AC-P03-04, AC-P03-05 |
| Register "test tooling confirm in P03" | ADR-041 plus canaries | AC-P03-14 |
| T-TA-06 supply chain | lockfiles, `npm ci --ignore-scripts`, NuGet locked mode, SHA-pinned actions, digest-pinned images, OSV-Scanner, Dependabot | AC-P03-09, AC-P03-11 |
| T-ID-10 secret leakage | `.env*` ignored, placeholders only, gitleaks, handoff-check regex | AC-P03-03, AC-P03-10 |
| T-EP-06 CI compromise | `permissions: contents: read`, no `pull_request_target`, no secrets in CI, `persist-credentials: false` | AC-P03-09 |
| T-EP-05 (local part) | loopback-only ports; non-root images where the upstream image supports it | AC-P03-02 |

## 4. Local dependency services (ADR-042 §1)

`docker-compose.yml` at the repository root, Compose project name `resumiser`, one explicit network `resumiser`, no `version:` key.

| Service | Image (exact tag + `@sha256` digest, chosen by the Developer, recorded in `infrastructure/images.lock`) | Host port (loopback only; overridable) | Healthcheck | Notes |
|---|---|---|---|---|
| `mongo` | `mongo:8.0.<latest patch>` | `127.0.0.1:${RESUMISER_MONGO_PORT:-27017}:27017` | `mongosh` ping that also initiates the replica set once: `rs0`, a single member `127.0.0.1:27017`; healthy only when this node is PRIMARY | `--replSet rs0 --bind_ip_all` inside the container; named volume `mongo-data`; **no auth locally** (DD-P03-06); host connection string `mongodb://127.0.0.1:27017/?replicaSet=rs0` |
| `azurite` | `mcr.microsoft.com/azure-storage/azurite:<3.x latest>` | `127.0.0.1:${RESUMISER_AZURITE_BLOB_PORT:-10000}:10000` | TCP or HTTP probe on 10000 with a tool present in the image | Blob service only (`azurite-blob`), `--disableTelemetry` (or the image's documented opt-out), named volume `azurite-data`; host clients use `UseDevelopmentStorage=true` |
| `mailpit` | `axllent/mailpit:<1.x latest>` | SMTP `127.0.0.1:${RESUMISER_MAILPIT_SMTP_PORT:-1025}:1025`, UI/API `127.0.0.1:${RESUMISER_MAILPIT_UI_PORT:-8025}:8025` | the image's readiness command (`/mailpit readyz`) or an HTTP probe | version check disabled; no persistence needed |

Rules:
- `docker compose up -d --wait` brings all three to healthy within 120 s on a warm image cache. `docker compose down -v` removes containers, network and volumes.
- No credentials, keys or connection strings with secrets appear in Compose. Compose works with **no `.env` file** (all variables have defaults).
- Services run as the non-root user their upstream image provides where it provides one. Exceptions are listed in `infrastructure/README.md`.
- Application services (`api`, `web`) are **not** added in P03. P04/P05 may add them under a Compose profile `app`, so the default `up` keeps starting only the dependencies.
- The Compose smoke in CI uses its own project name (for example `resumiser-ci`) and must neither fail because the default host ports are already in use nor touch the developer's `resumiser` volumes.

## 5. CI pipeline (ADR-042 §2)

### 5.1 Scripts (`scripts/ci/`, bash, `set -euo pipefail`, LF, executable bit)

| Script | Does | Needs |
|---|---|---|
| `preflight.sh` | Checks prerequisites and versions: git; Python ≥ 3.11; Docker Engine + Compose v2; .NET SDK matching `backend/global.json`; Node major 24 (≥ 24.18) and npm ≥ 11. On a missing or wrong tool it prints what is wrong and exits non-zero | — |
| `backend.sh` | `dotnet restore --locked-mode`; `dotnet build -c Release -warnaserror --no-restore`; `dotnet format --verify-no-changes --no-restore`; `dotnet test -c Release --no-build`. Every image that Testcontainers pulls (MongoDB, Ryuk) is passed as a digest-pinned reference taken from `infrastructure/images.lock` | .NET SDK, Docker |
| `frontend.sh` | in `frontend/`: `npm ci --ignore-scripts --no-audit --no-fund`; `npm run lint`; `npm run typecheck`; `npm test`; `npm run build` | Node/npm |
| `e2e.sh` | builds the SPA if `frontend/dist` is missing (through the same npm scripts), then runs `tests/e2e` in the digest-pinned Playwright image (`--ipc=host`, repo mounted read-only except the report directory) with the Chromium, Firefox and WebKit projects | Node/npm, Docker |
| `integration.sh` | ensures a local `main` ref exists (in CI: `git fetch --no-tags origin main:main` when it is missing), runs the three commands of `docs/phases/P02/tests/suite.cmd` unchanged, then the Compose smoke: `up --wait` on the separate project, the Test Engineer's dynamic smoke tests from `tests/infrastructure/` against it, and `down -v` in a trap | Node, .NET SDK, Docker |
| `security.sh` | the Test Engineer's static policy checks from `tests/infrastructure/` (Compose, workflow, Dependabot, env, manifests, scripts); gitleaks over the working tree and the git history; OSV-Scanner over every lockfile; actionlint over `.github/workflows/`; shellcheck over `scripts/ci/*.sh` and `scripts/dev/*.sh` (Should, AC-P03-17) | Docker |
| `local.sh` | `local.sh` runs preflight, then every job in the order `security`, `backend`, `frontend`, `e2e`, `integration`. `local.sh <job>…` runs only the named jobs. It continues after a failed job, prints one result line per job and exits non-zero if any job failed | all of the above |

Common rules:
- Scripts work from any current directory, because they resolve the repository root from their own location.
- They set `DOTNET_CLI_TELEMETRY_OPTOUT=1`, `DOTNET_NOLOGO=1`, `REDOCLY_TELEMETRY=off` and the other tools' documented opt-outs.
- They never print environment variables or secrets.
- Images come from `infrastructure/images.lock` (`NAME=repo:tag@sha256:…`, one per line). It is the single list of pinned images outside the P02 suite. The Compose file repeats the same references literally, and a static check proves that they are equal. The P02 suite keeps its own oasdiff pin, and the lock repeats it for the scan and the equality check.
- Generated outputs (`bin/`, `obj/`, `dist/`, reports, `TestResults/`) are git-ignored and never committed.

### 5.2 Workflow (`.github/workflows/ci.yml`)

- Triggers: `push` and `pull_request`, plus `workflow_dispatch`. Never `pull_request_target`.
- Top level: `permissions: contents: read`. No job widens it, and no job uses `secrets.*`. `concurrency` cancels superseded runs of the same ref.
- Jobs `backend`, `frontend`, `e2e`, `integration`, `security`. Each one:
  - runs on `ubuntu-24.04`, with `timeout-minutes`;
  - uses `actions/checkout` with `persist-credentials: false` (`fetch-depth: 0` for `integration` and `security`);
  - uses `actions/setup-dotnet` (`global-json-file: backend/global.json`) and/or `actions/setup-node` (`node-version-file: frontend/.nvmrc`) as needed;
  - then has exactly **one** `run:` step, `scripts/ci/<job>.sh`.
- **No `needs:`** between `backend` and `frontend`. `e2e` builds the SPA itself and does not need `frontend`. No job reads another job's artifacts.
- Every `uses:` is pinned to a full 40-character commit SHA with a `# vX.Y.Z` comment.
- No deploy job (P15).

### 5.3 Dependabot (`.github/dependabot.yml`)

Weekly version updates for:
- `npm` in `/frontend`, `/tests/contract` and `/tests/e2e`;
- `nuget` in `/backend`;
- `github-actions` in `/`;
- `docker-compose` (or `docker`, whichever ecosystem GitHub supports for the root Compose file) in `/`.

It takes effect only once a GitHub remote exists (go-live, decisions.md §5).

## 6. Supply-chain and secret controls (ADR-042 §3)

| Control | Tool / rule | Where |
|---|---|---|
| Secret scan | **gitleaks** (MIT), official image pinned by digest, default rules plus `.gitleaks.toml` (extends the defaults). Any allowlist entry names a path and a reason; no blanket allowlists. It scans the working tree and the full history | `security.sh` |
| Second net | the existing `SECRET_RE` and `.env` file rule in `scripts/phase-handoff-check.py` (unchanged) | every handoff |
| Dependency scan | **OSV-Scanner** (Apache-2.0), official image pinned by digest, over `frontend/package-lock.json`, `tests/contract/package-lock.json`, `tests/e2e/package-lock.json` and every `backend/**/packages.lock.json`. Any unwaived finding fails the job. The six P02 dev-dependency exceptions in DD-P03-22 go in root `osv-scanner.toml` with ID, reason, Test Engineer owner and 2026-11-17 expiry. `security.sh` passes `--config=/work/osv-scanner.toml` only for the `tests/contract/package-lock.json` scan; every other scan runs without that config, so the exceptions cannot conceal application findings | `security.sh` |
| Workflow lint | **actionlint** (MIT), image pinned by digest | `security.sh` |
| Shell lint (Should) | **shellcheck**, image pinned by digest | `security.sh` |
| Install scripts | `npm ci --ignore-scripts` everywhere (P02 review i-8). A package that genuinely needs its install script is listed in `infrastructure/README.md` with its reason; none is expected | all npm installs |
| NuGet | `nuget.config` with `<clear/>`, nuget.org only, `packageSourceMapping`; Central Package Management with exact versions; `RestorePackagesWithLockFile`; `--locked-mode` in CI | backend |
| Pinning | exact npm versions (no `^`/`~`) in the three packages; digest-pinned images; SHA-pinned actions | static checks |

## 7. Env and secret conventions (ADR-042 §4)

- `.env` and `.env.*` stay git-ignored except `.env.example` (already in `.gitignore`). Only `.env.example` is committed.
- Root `.env.example` lists the Compose variables (`RESUMISER_MONGO_PORT`, `RESUMISER_AZURITE_BLOB_PORT`, `RESUMISER_MAILPIT_SMTP_PORT`, `RESUMISER_MAILPIT_UI_PORT`) and the documented local stand-in endpoints as comments. The only values allowed are:
  - loopback hosts and ports;
  - `UseDevelopmentStorage=true`;
  - placeholders of the form `<set-in-key-vault>` or `change-me`.
  It contains **no** key, password, token or the Azurite well-known account key.
- P04 appends the backend configuration keys (ASP.NET Core `Section__Key` names) in a block marked `# --- P04 backend ---`. P05 adds no secret, because `VITE_*` variables are public by definition and must never carry a secret.
- Production secrets live only in Azure Key Vault (ADR-033); none exist in P03.

## 8. Toolchain skeletons and canaries

### 8.1 Backend (`backend/`)
- `global.json`: SDK `10.0.300`, `rollForward: latestPatch` (10.0.3xx band). P04 may tighten the patch (ADR-002).
- `Directory.Build.props`: `TargetFramework net10.0`, `Nullable enable`, `ImplicitUsings enable`, `TreatWarningsAsErrors true`, `EnforceCodeStyleInBuild true`, `AnalysisLevel latest-recommended`, `Deterministic true`, `ContinuousIntegrationBuild` when `CI=true`, `RestorePackagesWithLockFile true`.
- `Directory.Packages.props`: Central Package Management with exact versions of the ADR-041 backend packages that the canary uses.
- `nuget.config` (see §6).
- `ResumeBuilder.slnx`: the solution, containing the canary project only.
- `tests/ResumeBuilder.Toolchain.Tests/`: written by the Test Engineer (csproj and tests). It contains (a) an xUnit v3 fact that proves the runner on `net10.0` and (b) a Testcontainers test that starts the pinned MongoDB image as a replica set and acknowledges a `w: majority` insert. The MongoDB driver package (`MongoDB.Driver`, Apache-2.0) is allowed in the canary only. P04 owns its use in Infrastructure.
- P04 contract: P04 adds its projects to `ResumeBuilder.slnx`. `backend.sh` builds and tests the whole solution, so P04 does not edit the script. P04's Test Engineer may delete the canary once real test projects exist, keeping a Testcontainers replica-set test elsewhere.

### 8.2 Frontend (`frontend/`)
- `.nvmrc` = `24`; `package.json` with `"private": true`, `"type": "module"`, `engines.node ">=24.18 <25"`, exact versions, and the **script contract** `lint`, `typecheck`, `test`, `build` (and `preview` for E2E). P05 keeps these names.
- `tsconfig*.json`: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noEmit` for typecheck (ADR-003).
- `vite.config.ts` with the React plugin and the Vitest config (`environment: 'jsdom'`, a setup file that registers `@testing-library/jest-dom`). ESLint 9 flat config with `typescript-eslint` and `eslint-plugin-react-hooks`. React 19 and Vite current stable, pinned exactly.
- `index.html` and `src/main.tsx` render the placeholder root component `App`, a named export of `src/app/App.tsx`. It renders a `main` landmark with an `h1` "Resumiser" and has no external URLs, fonts, CDNs or analytics. The Test Engineer's canary `src/app/App.test.tsx` targets it.
- Not in P03: Tailwind, router, tokens, the rest of the `src/{pages,features,entities,shared,widgets}` structure, generated API types and the dev proxy/mock wiring (all P05).

### 8.3 E2E (`tests/e2e/`, Test Engineer)
- npm package with only `@playwright/test`, pinned exactly to the version of the Playwright image in `images.lock`, and its lockfile.
- `playwright.config.ts` with the projects `chromium`, `firefox` and `webkit`, `forbidOnly` in CI, `retries: 0`, and a `webServer` that serves `frontend/dist` on loopback.
- One spec: the page loads, the root heading is visible, and no request leaves `127.0.0.1` (a no-third-party-request check, NFR-09).

### 8.4 Shared files that later phases append to
`.env.example`, `docker-compose.yml`, `.github/workflows/ci.yml`, `.github/dependabot.yml`, `infrastructure/images.lock`: P04/P05 edits are append-only blocks marked with the phase ID, so the parallel P04 ∥ P05 merges stay clean. A change to an existing line goes through the Solution Architect of that phase.

## 9. Data and API impact

None. No contract change, no endpoint, no persistence schema. `contracts/**` and `tests/contract/**` are read-only in P03; the integration job runs them unchanged.

## 10. Dependency graph (within P03)

```text
Kickoff/Plan (SA) ─► Test plan (TA) ─► Red (TE: tests/infrastructure, canaries, tests/e2e, suite.cmd)
   ─► Green (Platform Developer: compose, scripts/ci, workflow, skeletons, docs)
   ─► Review ─► QA (incl. clean-checkout run) ─► Gate
```

## 11. Risks

| ID | Risk | Mitigation |
|---|---|---|
| R-1 | Hosted GitHub runners never run before go-live, so differences appear late | scripts-first CI, `ubuntu-24.04` pinned, tool versions from `global.json`/`.nvmrc`; first hosted run is a go-live item (DD-P03-19) |
| R-2 | Advisory DB changes make the dependency scan go red over time | intended behaviour; scoped waivers with expiry in `osv-scanner.toml` (DD-P03-09, DD-P03-22); the DB date is recorded in `test-results.md` |
| R-3 | Host ports already in use on developer machines | ports overridable by env; the CI smoke uses its own project name and does not depend on free default ports |
| R-4 | Large image pulls (Playwright, SDK) slow the suite | pulls are cached; the clean-checkout run happens once (QA) |
| R-5 | Testcontainers Ryuk image unpinned | the image reference is passed from `images.lock` by `backend.sh` |
| R-6 | `--ignore-scripts` breaks a native package (for example esbuild) | verify in the canary build; list a justified exception in `infrastructure/README.md` if needed |
| R-7 | Cross-boundary grant to one Developer | explicit path table below; the review checks that frontend changes stay within §8.2 |
| R-8 | P04 ∥ P05 conflicting edits on shared files | append-only blocks (§8.4) |
| R-9 | Docker Hub pull rate limits | digest-pinned images are cached locally after the first pull; on hosted runners a handful of anonymous pulls per run stays far below the limits |

## 12. ADRs

| ADR | Topic | Status |
|---|---|---|
| ADR-041 | Test tooling confirmation | Accepted (delegated) |
| ADR-042 | Local environment, CI pipeline and supply-chain controls | Accepted (delegated) |
| ADR-002, ADR-003, ADR-004, ADR-009, ADR-012, ADR-033, ADR-034, ADR-040 | inputs, unchanged | Accepted |

## 13. Acceptance criteria

See `../acceptance-criteria.md` (AC-P03-01…18).

## Allowed paths

Phase scope (in addition to `docs/phases/P03/**`, which is always in scope):

- `docker-compose.yml`
- `infrastructure/**`
- `.github/**`
- `.env.example`
- `.gitignore`
- `.gitattributes`
- `.editorconfig`
- `.gitleaks.toml`
- `osv-scanner.toml`
- `scripts/ci/**`
- `scripts/dev/**`
- `backend/**`
- `frontend/**`
- `tests/infrastructure/**`
- `tests/e2e/**`
- `docs/blueprint/decisions/**`
- `docs/blueprint/DECISION-REGISTER.md`

Per-role paths. The backend-developer row is the explicit cross-boundary grant of DD-P03-02. The other roles keep their defaults from the handoff-check script, intersected with the phase scope above:

| role | paths |
|---|---|
| backend-developer | `backend/**` `frontend/**` `docker-compose.yml` `infrastructure/**` `.github/**` `.env.example` `.gitignore` `.gitattributes` `.editorconfig` `.gitleaks.toml` `osv-scanner.toml` `scripts/ci/**` `scripts/dev/**` `docs/phases/P03/implementation/frontend-tasks.md` |

## Forbidden paths

Everything not listed above, and explicitly: the contract folder and the P02 contract test package (read-only, run unchanged), `docs/source/**`, the governance scripts `scripts/check-blueprint.py` and `scripts/phase-handoff-check.py`, `.claude/**`, `CLAUDE.md`, `AGENTS.md`, the root `README.md`. The Developer must not modify test files written by the Test Engineer (handoff-check `TEST_MODIFIED`).
