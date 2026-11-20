# Dependencies

P01, P02

List external services, packages, tools, phase outputs and owners.

Written by the Solution Architect, 2026-11-02.

## Phase outputs consumed

| From | Output | Used for |
|---|---|---|
| P01 | ADR-002 (.NET 10), ADR-003 (Node 24, npm, strict TS), ADR-004 (MongoDB 8 replica set), ADR-009 (Azure Blob / Azurite), ADR-012 (EU), ADR-033 (GitHub Actions, scripts-first, Compose), ADR-034 (SMTP / Mailpit) | services, runtimes, CI shape |
| P01 | threat model rows T-TA-06, T-ID-10, T-EP-05, T-EP-06 and the P03 row | supply-chain and secret controls |
| P02 | `tests/contract/` suite and `docs/phases/P02/tests/suite.cmd` (read-only), oasdiff digest pin (ADR-040) | integration job (P03-OBL-01), dependency scan (P03-OBL-02) |
| P02 | review i-8 (`@scarf/scarf` install-time analytics) | `npm ci --ignore-scripts` everywhere |

## Host prerequisites (reference machine, 2026-11-02)

| Tool | Version seen | Required |
|---|---|---|
| Docker Engine | 29.6.1 | any current Engine with Compose v2 |
| Docker Compose | v5.3.1 | v2 CLI plugin (`docker compose`) |
| .NET SDK | 10.0.301 | 10.0.3xx (`backend/global.json`) |
| Node.js / npm | 24.22.2 / 11.19.1 | Node 24 ≥ 24.18, npm ≥ 11 |
| Python | 3 (system) | ≥ 3.11, stdlib only |
| git | system | any current |

## Container images (all pinned `tag@sha256:digest` in `infrastructure/images.lock`; exact tags chosen by the Platform Developer)

| Image | Purpose | Licence | Owner |
|---|---|---|---|
| `mongo:8.0.x` | local DB and Testcontainers | SSPL (server, used locally only, not redistributed) | Platform Developer |
| `mcr.microsoft.com/azure-storage/azurite:3.x` | Blob emulator | MIT | Platform Developer |
| `axllent/mailpit:1.x` | SMTP catcher | MIT | Platform Developer |
| `testcontainers/ryuk` | Testcontainers cleanup | MIT | Platform Developer |
| `mcr.microsoft.com/playwright:v1.x-noble` | E2E browsers | Apache-2.0 | Platform Developer (image), Test Engineer (package version) |
| gitleaks official image | secret scan | MIT | Platform Developer |
| OSV-Scanner official image | dependency scan | Apache-2.0 | Platform Developer |
| `rhysd/actionlint` | workflow lint | MIT | Platform Developer |
| `koalaman/shellcheck` | shell lint (Should) | GPL-3.0 (tool only, not linked) | Platform Developer |
| `tufin/oasdiff:v1.35.0@sha256:82b1…e400` | breaking-change check (P02, unchanged) | Apache-2.0 | P02 Test Engineer |

## Packages (exact versions in lockfiles; chosen at implementation, current stable)

- Backend (`backend/Directory.Packages.props`): `xunit.v3`, `xunit.runner.visualstudio`, `Microsoft.NET.Test.Sdk`, `Testcontainers.MongoDb`, `MongoDB.Driver` (canary only).
- Frontend (`frontend/package.json`): `react`, `react-dom` (19.x), `vite`, `@vitejs/plugin-react`, `typescript`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`, `@types/react`, `@types/react-dom`.
- E2E (`tests/e2e/package.json`): `@playwright/test` only.

## GitHub Actions (SHA-pinned, used only once a remote exists)

`actions/checkout`, `actions/setup-dotnet`, `actions/setup-node`. Nothing else.

## External services

- Package registries (npmjs.org, nuget.org), container registries (Docker Hub, MCR, GHCR) and the OSV.dev advisory API, for package coordinates only. No other service.
- No cloud account, no secret and no GitHub remote is needed in P03. Go-live items are in `decisions.md` §5.

## Downstream consumers

P04 and P05 (skeletons, scripts, conventions; `decisions.md` §4), P07 (Azurite via Testcontainers), P10 (rendering test tooling), P13 (pipeline re-review), P14 (cross-stack run through `scripts/ci/local.sh`), P15 (deployment, go-live actions).
