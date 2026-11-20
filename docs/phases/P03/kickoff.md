# P03 Kickoff — Infrastructure & DevEx

- Phase: P03. Dependencies P01 and P02 are `COMPLETED` (gates closed 2026-11-02, merged to `main`).
- Written by: Solution Architect (Orca worker, task `task_c927b0550e5e`), 2026-11-02.
- Mode: autonomous (ADR-035). The Solution Architect decides every question by delegation (ADR-035 A-4) and tags the answer `DELEGATED-DEFAULT` in `decisions.md`.

## 1. Scope summary

P03 builds the repository toolchain that every later phase uses: local dependency services, the CI pipeline and its local equivalent, environment and secret conventions, supply-chain controls, and the confirmed test tooling. It does **not** build product behaviour, endpoints or UI.

DoD (PHASE.md): a clean checkout can build and test; the backend and frontend jobs are independent; the integration job runs the contract checks.

| Deliverable | Content | Source IDs / obligations |
|---|---|---|
| `docker-compose.yml` + `infrastructure/**` | MongoDB 8.0 single-node replica set, Azurite (Blob), Mailpit; digest-pinned images, healthchecks, loopback ports, named volumes, explicit network | ADR-004, ADR-009, ADR-034, ADR-033 "Local development" |
| `.env.example`, `.gitignore`, `.gitattributes`, `.editorconfig` | env and secret conventions, line endings, editor settings | `.claude/rules/03-security-privacy.md`; T-ID-10 |
| `scripts/ci/*.sh` | one script per CI job plus one local command that runs them all | ADR-033 "CI" (scripts-first, runnable locally) |
| `.github/workflows/ci.yml`, `.github/dependabot.yml` | GitHub Actions jobs that only call the scripts; SHA-pinned actions; read-only permissions; update automation | ADR-033; T-TA-06, T-EP-06 |
| Secret scan, dependency scan, workflow lint | gitleaks, OSV-Scanner, actionlint (digest-pinned images) | T-ID-10, T-TA-06; P03-OBL-02 |
| Integration job | runs the P02 contract suite and the oasdiff check against `main`, plus the Compose smoke | P03-OBL-01; PHASE.md DoD |
| Backend toolchain skeleton | `backend/global.json`, `Directory.Build.props`, `Directory.Packages.props`, `nuget.config`, `ResumeBuilder.slnx`, one canary test project | ADR-002; ADR-041 |
| Frontend toolchain skeleton | `frontend/.nvmrc`, `package.json` + lockfile, strict `tsconfig`, Vite + Vitest + ESLint config, a placeholder root component | ADR-003; ADR-041 |
| E2E harness | `tests/e2e/` Playwright package run in the digest-pinned official Playwright image | ADR-041; ADR-010 G3/G7 (pinned browsers) |
| ADR-041 (test tooling), ADR-042 (local environment, CI and supply chain) | Accepted under delegation; register updated | Register "test tooling confirm in P03"; P01 decisions §4 |

Requirement and risk IDs carried: NFR-08 (secure pipeline basis), NFR-09 (EU, no trackers: no telemetry, no third-party service gets repository content), NFR-10 (replica set with majority write concern available locally), threat-model rows T-TA-06, T-ID-10, T-EP-05 (local part), T-EP-06 (workflow part), and the P01 threat-model P03 row (secret scanning, lockfiles, SHA-pinned actions, image digest pinning, dependency scanning, `.env.example` placeholders).

Out of scope: application code (P04/P05), application Dockerfiles and image scanning of our own images (P04/P05, DD-P03-11), deployment workflows and Bicep (P15), PDF text extraction and raster diff tooling (P10 prototype gate, DD-P03-17), real cloud accounts and secrets (go-live, decisions.md §5).

## 2. Roles

| Step | Role | Needed | Notes |
|---|---|---|---|
| 1–2 | Solution Architect | yes | this kickoff, the plan, ADR-041, ADR-042, delegated decisions, task files |
| 3 | Test Architect | yes | `tests/test-plan.md` within §3 |
| 4 | Contract Architect | **no** | the API contract does not change; `contracts/**` and `tests/contract/**` are read-only in P03 |
| 5 | Test Engineer | yes | `tests/infrastructure/**`, the backend canary test project, the frontend canary test, `tests/e2e/**`, `tests/suite.cmd`, red evidence |
| 6 | **Developer: one dispatch** | yes | role `backend-developer` acting as **Platform Developer**, with the explicit cross-boundary grant in phase-plan "Allowed paths". It does every task in `implementation/backend-tasks.md` and `implementation/frontend-tasks.md`. **No separate Frontend Developer dispatch** (DD-P03-02) |
| 7 | Code Reviewer | yes | one pass: supply chain, secrets, workflow hardening, test integrity, scope |
| 8 | QA / Acceptance | yes | runs the acceptance matrix, including the clean-checkout run (AC-P03-13) |

### Developer dispatch and scaffolds (answer to the coordinator's question)

- **Repo tooling, docker-compose, CI workflow, env examples, secret scan, dependency scan:** yes, P03 dispatches a Developer for them.
- **Backend and frontend scaffolds:** P03 creates **toolchain skeletons only**, not the application structure (DD-P03-01). The DoD needs real backend and frontend jobs that build and test something, and the test-tooling confirmation (ADR-041) needs executable evidence on `net10.0`, React 19 and the three browser engines.
  - Backend in P03: SDK pin, shared build properties, central package versions with lock files, NuGet source pinning, the solution file and **one canary test project** (`backend/tests/ResumeBuilder.Toolchain.Tests`). No `src/` projects, no layers, no API. P04 creates the Domain/Application/Infrastructure/Api projects in the same solution and may retire the canary through its Test Engineer.
  - Frontend in P03: Node pin, `package.json` with the npm script contract (`lint`, `typecheck`, `test`, `build`), lockfile, strict `tsconfig`, Vite + Vitest + ESLint config, `index.html` and a placeholder root component. No router, no Tailwind, no design tokens, no generated API types, no app shell. P05 builds the shell on this skeleton.
- **Why one Developer, not two:** `scripts/phase-handoff-check.py` requires the whole phase suite to be green after each developer step. With two developers, the first step is always red because the other half is missing, in sequence and in parallel child worktrees alike, which would trigger the ADR-035 §C-3 stop. One Platform Developer with an explicit grant keeps the check meaningful (DD-P03-02).

## 3. Test budget (ADR-035 B-4: code/infrastructure phase)

P03 is a code phase (scripts, configuration and canaries), so every Must criterion in `acceptance-criteria.md` has a positive and a negative case, except criteria whose negative column says "—" (review or handoff-check items). Budget, nothing beyond it:

- **Infrastructure checks** in `tests/infrastructure/`: Python 3 **standard library only**, run with `python3 -m unittest`. At most 4 test modules plus 1 helper, about 700 lines in total.
  - Structure comes from `docker compose config --format json`. Workflow and Dependabot files use line-based checks, and actionlint validates their syntax. No PyYAML, pytest, Bats, Terratest or `act`.
  - Negative cases use in-memory mutations or mutated copies in a temp directory: at most one per defect class, no committed negative fixtures.
  - The dynamic Compose smoke uses `docker compose exec`, `smtplib` and `urllib` only.
- **Backend canary:** one xUnit v3 project `backend/tests/ResumeBuilder.Toolchain.Tests`, at most 3 tests: xUnit runs on `net10.0`, and Testcontainers starts the pinned MongoDB image as a replica set and performs a `w: majority` write.
- **Frontend canary:** one Vitest + React Testing Library test file, at most 3 tests: it renders the placeholder root and queries it by role.
- **E2E harness:** one npm package `tests/e2e/` with only `@playwright/test` pinned exactly and a committed lockfile. One spec, run in the Chromium, Firefox and WebKit projects inside the digest-pinned Playwright image.
- **`docs/phases/P03/tests/suite.cmd`:** at most 3 commands, for example the local CI command for all jobs plus the infrastructure unit checks. The suite needs Docker and network access for package and image downloads. After the downloads it must be deterministic, with one exception: the dependency scan depends on the advisory database date (DD-P03-09), and that date is recorded in `test-results.md`.
- The clean-checkout run (AC-P03-13) is a QA acceptance item, not a suite line, because it repeats every download. It runs once.
- A larger test plan needs a reason recorded in this file (PHASE-GATES "Autonomous gate rules").

## 4. Parallel slices

- **Within P03:** none. One Platform Developer in the phase worktree (DD-P03-02). No `phase/P03-be` / `phase/P03-fe` child worktrees.
- **After P03:** P04 ∥ P05 run as two phases on the frozen v1.0.0 contract (`docs/phases/README.md`). The P03 skeleton files they both build on are disjoint: P04 only touches `backend/**` and P05 only `frontend/**`. Both may add a line to `.env.example` and a service under a Compose profile, and they must merge cleanly. Shared files edited by both (`.env.example`, `docker-compose.yml`, `.github/workflows/ci.yml`) get **append-only** edits in P04/P05, each in its own clearly marked block (phase-plan §8).

## 5. Decisions this phase needs, and how they were decided

All were decided by delegation (ADR-035 A-4 precedence: TECHNICAL-SPEC, then `docs/source/README.md` evidence, then the most conservative, reversible and standard option). Full records with options are in `decisions.md`.

| Need | Decision | Record | Basis |
|---|---|---|---|
| Scaffold boundary P03 vs P04/P05 | toolchain skeletons plus canaries in P03; application structure in P04/P05 | DD-P03-01 | DoD; ADR-041 evidence |
| Developer dispatch | one `backend-developer` dispatch as Platform Developer with an explicit grant | DD-P03-02 | handoff-check mechanics (ADR-035 B-5, §C-3) |
| Test tooling (register: "confirm in P03") | xUnit v3, Testcontainers for .NET, ASP.NET Core test host, Vitest + RTL + jsdom, Playwright in the official image; FluentAssertions and Moq rejected; PDF and raster tooling deferred to the P10 prototype | ADR-041, DD-P03-03, DD-P03-04, DD-P03-17 | TEST-STRATEGY candidates; licences; ADR-010 |
| Local services | `mongo` 8.0.x replica set `rs0`, Azurite Blob only, Mailpit; digest-pinned; loopback ports; telemetry off | ADR-042 §1, DD-P03-05, DD-P03-06 | ADR-004, ADR-009, ADR-034 |
| CI shape | 5 jobs (`backend`, `frontend`, `e2e`, `integration`, `security`) each calling one `scripts/ci/<job>.sh`; `scripts/ci/local.sh` runs them all | ADR-042 §2, DD-P03-07 | ADR-033 |
| Secret and dependency scanning, workflow lint | gitleaks, OSV-Scanner, actionlint (+ shellcheck as Should); Dependabot for updates; `npm ci --ignore-scripts`; NuGet locked mode | ADR-042 §3, DD-P03-08…10 | T-ID-10, T-TA-06; P02 review i-8 |
| Our own images | Dockerfiles and image scans arrive with the apps in P04/P05 under ADR-042 conventions | DD-P03-11 | no app exists in P03 |
| Env and secret conventions | root `.env.example` with placeholders and loopback stand-ins only; no well-known emulator key in the repo; `VITE_*` never carries secrets | ADR-042 §4, DD-P03-14 | rule 03 |
| Hosted CI before a remote exists | not run; `scripts/ci/local.sh` is the CI evidence (ADR-033); first hosted run is a go-live item | DD-P03-19 | ADR-033, ADR-035 A-5 |

**Open register items that touch P03:** only the test-tooling confirmation, closed by ADR-041. D-05/D-06 (P07) and D-12, D-14, D-15, D-16, D-18, D-19 (P10) do not affect tooling. No open decision blocks P03.

## 6. Follow-ups outside this step

- `CLAUDE.md` "Commands" and "Current repository state" (record the local CI command, the Compose commands and the confirmed test tooling) and `docs/blueprint/TEST-STRATEGY.md` "Candidate tooling" go stale once ADR-041 is Accepted. `CLAUDE.md` is outside every P03 role's scope. The Program Coordinator updates it after the merge, as in P02. TEST-STRATEGY.md is outside this step's file scope: the Program Coordinator or a later Solution Architect step updates it to point at ADR-041.
- Go-live owner actions: decisions.md §5 (new in P03: GitHub repository settings, branch protection with the five required checks, GitHub secret scanning with push protection, Dependabot alerts, the first hosted CI run).
