# ADR-042 — Local environment, CI pipeline and supply-chain controls

- Status: **Accepted** (`DELEGATED-DEFAULT`, ADR-035 A-4). New register ID from P03. It implements ADR-033 "CI" and "Local development" and does not change ADR-033.
- Decider: Solution Architect (delegated, ADR-035)
- Date: 2026-11-02 (P03, decisions.md DD-P03-05…16, DD-P03-19)
- Source IDs: P03 PHASE.md (objective, required test strategy, DoD); ADR-002, ADR-003, ADR-004, ADR-009, ADR-012, ADR-033, ADR-034, ADR-040; P02 obligations P03-OBL-01/02 and review i-8; threat model T-TA-06, T-ID-10, T-EP-05, T-EP-06 and the P03 row; `.claude/rules/03-security-privacy.md`; NFR-08, NFR-09, NFR-10

## Context

ADR-033 decided GitHub Actions with scripts-first jobs that also run locally, and Compose with MongoDB, Azurite and Mailpit. No remote exists and nothing is pushed (ADR-035 A-5). P03 must turn this into concrete conventions that P04…P15 inherit: services, jobs, scanners, pinning and env rules. Production accounts and secrets do not exist and are not needed for any of it.

## Decision

### 1. Local dependency services (Compose)
- Root `docker-compose.yml`, project `resumiser`, one explicit network, named volumes, healthchecks on every service, ports published on **127.0.0.1 only** and overridable through `RESUMISER_*_PORT` variables. Compose works without a `.env` file.
- `mongo:8.0.<patch>`: single-node replica set `rs0` (member `127.0.0.1:27017`), initiated by the healthcheck and healthy only when PRIMARY. **No authentication locally** (loopback only, no data beyond fixtures). Production uses Atlas with TLS, authentication and a private endpoint (ADR-004).
- `azurite` (Blob only), telemetry off. Host clients use `UseDevelopmentStorage=true`, so the publicly documented emulator key never appears in the repository.
- `mailpit` (SMTP 1025, UI/API 8025), version check off.
- Image references are `repo:tag@sha256:digest`, listed once in `infrastructure/images.lock` and repeated literally in Compose, with a static equality check. Application services join later under a Compose profile `app` (P04/P05).

### 2. CI pipeline
- One bash script per job under `scripts/ci/`: `backend.sh`, `frontend.sh`, `e2e.sh`, `integration.sh`, `security.sh`, plus `preflight.sh`, and **`local.sh`, the single local command** (all jobs, or the named ones; one result line per job; non-zero if any job failed). Until a remote exists, a green `local.sh` run is the CI evidence (ADR-033).
- `.github/workflows/ci.yml`:
  - jobs `backend`, `frontend`, `e2e`, `integration`, `security`, each with exactly one `run:` step calling its script;
  - **no `needs:` between backend and frontend**; `ubuntu-24.04` runners; `timeout-minutes` on every job;
  - top-level `permissions: contents: read`; no `secrets.*`; no `pull_request_target`; `persist-credentials: false`;
  - every action pinned by full commit SHA with a version comment.
- The **integration job** runs the P02 contract suite unchanged (`docs/phases/P02/tests/suite.cmd`), including oasdiff against `main` (P03-OBL-01), and the Compose smoke.
- Tool telemetry is switched off in every script: .NET CLI, Redocly, Azurite, Mailpit and any other tool with an opt-out.
- No deployment workflow before P15. Deployment later authenticates with OIDC to protected environments (ADR-033).

### 3. Supply-chain and secret controls
- **Secret scan:** gitleaks (official image, digest-pinned), default rules plus `.gitleaks.toml`, over the working tree and the full history. Allowlist entries name a path and a reason. The handoff-check regex stays as a second net. GitHub secret scanning with push protection is enabled at go-live.
- **Dependency scan:** OSV-Scanner (official image, digest-pinned) over every npm and NuGet lockfile. Any finding fails the job. Waivers go in `osv-scanner.toml` with ID, reason and expiry. Only package coordinates (name, version, ecosystem) are sent to the OSV.dev API: no repository content and no personal data.
- **Update automation:** Dependabot version updates for npm (`/frontend`, `/tests/contract`, `/tests/e2e`), NuGet (`/backend`), GitHub Actions and the Compose images. It is effective once a GitHub remote exists.
- **Workflow and shell lint:** actionlint (Must) and shellcheck (Should), both from digest-pinned images.
- **Installs:**
  - npm: `npm ci --ignore-scripts --no-audit --no-fund` with exact versions;
  - NuGet: `nuget.config` with `<clear/>`, nuget.org only and package source mapping, Central Package Management, lock files and `--locked-mode`.
- **Our own images** (api, web) arrive with the apps in P04/P05:
  - multi-stage builds;
  - base images pinned by digest (`mcr.microsoft.com/dotnet/sdk:10.0`, `aspnet:10.0`; a Node 24 build stage and a minimal non-root static server for `web`);
  - non-root runtime;
  - scanned with OSV-Scanner's image mode in the owning job.

### 4. Env and secret conventions
- Only `.env.example` is committed. `.env` and `.env.*` are git-ignored.
- `.env.example` holds only loopback endpoints, `UseDevelopmentStorage=true` and placeholders (`change-me`, `<set-in-key-vault>`).
- Later phases append their keys in a marked block. `VITE_*` variables are public and never carry secrets.
- Production secrets live only in Key Vault with managed identities (ADR-033).

## Alternatives considered

- **Local MongoDB with authentication:** a replica set with auth needs a keyfile and a root password, so that is more setup and more secret-like material in the repository, with no local benefit behind a loopback binding. Rejected for local use. Production keeps auth.
- **MongoDB 8.2 minor release:** newer, but 8.0 is the long-supported release of the major ADR-004 chose, and Atlas offers it. 8.0 chosen. Upgrading is a pin change.
- **Fixed host ports without overrides:** they collide with other local projects. Rejected.
- **Azurite well-known key in `.env.example`:** it is public, but it trains people to keep keys in env files and trips secret scanners. Rejected in favour of `UseDevelopmentStorage=true`.
- **Workflow logic in YAML (inline commands, marketplace actions):** not runnable locally, and ties the pipeline to one provider. Rejected (ADR-033).
- **`act` to run the workflow locally:** an extra tool, and its emulation is not exact. Rejected. The scripts are the unit that runs locally.
- **TruffleHog** (AGPL-3.0) for secrets: capable, but the licence is heavier and some verification modes call third-party services. Rejected. gitleaks chosen.
- **`npm audit` / `dotnet list package --vulnerable`:** two ecosystem-specific tools, and `npm audit` sends the whole lockfile to the registry. Rejected in favour of one scanner for all lockfiles and images.
- **Trivy:** capable, but a second scanner adds nothing over OSV-Scanner, which already covers lockfiles and images with one advisory source. Rejected for v1. It is reversible.
- **Renovate:** more flexible, but needs a hosted app or a self-hosted runner. Rejected. Dependabot is built into GitHub.
- **Running CI jobs inside SDK containers:** maximal reproducibility, but nested Docker for Testcontainers and oasdiff. Rejected. Versions are pinned by `global.json`/`.nvmrc`, and `preflight.sh` checks them. Playwright alone runs in its image (ADR-041).

## Rationale

Standard, provider-neutral and fully local: every control runs with Docker, the .NET SDK, Node and Python, from pinned versions. Hosted CI later runs the same scripts. The choices follow the threat-model mitigations for P03 one-to-one and keep secrets out of the repository by construction.

## Consequences

- P03 implements all of this, with canaries for the backend, frontend and E2E toolchains (ADR-041).
- P04/P05 append to `.env.example`, Compose (profile `app`), `images.lock`, the workflow and Dependabot in marked blocks. They add their Dockerfiles and image scans, and they keep the npm script names and the solution file that the CI scripts call.
- P13 re-reviews the pipeline against the threat model. P15 adds deployment with OIDC, Bicep and environment protection.
- Owner actions for go-live: P03 decisions.md §5.

## Security/privacy impact

The pipeline is read-only by default and holds no secrets. The supply chain is pinned at every layer (lockfiles, digests, SHAs) and scanned. Local services listen on loopback only. No telemetry is sent, and no repository content or personal data reaches a third-party service. The advisory lookups send package coordinates only. CI uses fixture data only (ADR-012 §5).

## Owner and date

Solution Architect (delegated, ADR-035), 2026-11-02. The owner reviews it after the fact in the P15 decision table (ADR-035 A-6).
