# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Claude Code Project Instructions

Before any task:
1. Read `docs/blueprint/PROJECT-CHARTER.md`.
2. Follow `.claude/rules/` (Claude Code loads them automatically).
3. For a phase task, read `docs/phases/<phase-id>/PHASE.md`, its dependencies and acceptance criteria.
4. Use the matching skills from `.claude/skills/` (loaded by description).

## Non-negotiable
- Monorepo, but independent backend/frontend bounded contexts.
- The API contract in `contracts/openapi/` is the single source of truth for cross-service interaction.
- Architecture plan and test plan first, then executable tests, then implementation (TDD).
- A developer does not change tests, the contract or acceptance criteria to make tests pass. Such a change is a separate review request.
- Do not weaken a test, remove assertions or skip failing tests without a documented approved exception.
- Do not implement functions excluded by TECHNICAL-SPEC.md.
- Do not treat Blueprint recommendations as approved decisions if the decision register marks them `PROPOSED` or `OPEN`.
- Work only in the files and folders the phase allows.
- Do not push, change secrets or run destructive operations. The operator session commits to the current `phase/*` branch and merges it into `main` at the gate (allowed by ADR-051 S-8). Subagents do not commit.
- Do not report tests as passing unless they actually ran.

## Phase execution
The mode is **single-operator and autonomous** (ADR-051, `docs/blueprint/decisions/ADR-051-single-operator-phase-execution.md`, which supersedes ADR-035). The owner delegated all questions and gates to the executing session.
- **One Claude session executes a whole phase** in this checkout on branch `phase/Pxx`: plan → (contract) → test plan → red → green → external review → acceptance → gate. No Orca orchestration, no coordinator, no worker pipeline, no role handoffs, no child worktrees (except the temporary one for a Codex worker task). Step order, outputs and batching rules: `docs/blueprint/AGENT-WORKFLOW.md`.
- **The external reviewer:** `codex exec --sandbox read-only` with `.claude/review-prompt.md` plus the diff range on stdin (exact command in `docs/blueprint/AGENT-WORKFLOW.md`), run once per phase over the phase diff, recorded in `review/code-review.md`. After fixes, a delta re-review over just those fixes, repeated until the reviewer returns `Verdict: PASS`, at most three (ADR-051 Amendment 2); the operator never writes a verdict line, and a ceiling reached with a standing major finding is the sixth stop condition.
- **The Codex worker, from P10, optional (ADR-051 Amendment 3):** one small task at a time from `docs/blueprint/templates/codex-task.md`, in a temporary worktree, in steps 4–5 only. The operator reviews, applies, tests and commits the patch; only the operator's test run is evidence. Codex gets no design work, owns no phase step and never holds up the phase: if it fails, the operator does the task. Commands: `docs/blueprint/AGENT-WORKFLOW.md`, "Codex worker tasks".
- **TDD is unchanged** (`.claude/rules/01-tdd-and-quality.md`): tests before production code, a proven red state failing on an assertion rather than a harness error, exact commands and exit codes in `tests/test-results.md`.
- The operator decides questions under delegation and tags them `DELEGATED-DEFAULT` in `decisions.md`. The owner is not asked mid-phase.
- Commit after each step, so a quota or context limit is a pause rather than lost work. Resume from the committed state plus the phase artifacts.
- Phase IDs and `TRACEABILITY.md` are never re-cut. 2–3 consecutive phases with linear dependencies may run on one branch with one gate (ADR-051 S-6): P07+P08+P09, P10+P11+P12, P13+P14+P15.
- After each step: `python3 scripts/phase-handoff-check.py --phase Pxx --step red|green`; at the end `--gate`. The next phase starts only after the previous one is `COMPLETED` and merged.
## Commands
- `/blueprint-status` — state of all phases and open decisions (read-only).
- `/phase Pxx` (or `/phase P07+P08+P09`) — execute a phase or batch end-to-end in single-operator mode and close its gate.
- `/review-phase Pxx` — external review plus acceptance check of a phase.
- `/close-phase Pxx` — close a phase after a passed gate (under owner delegation, ADR-051).
## Agents and subagents
The eight-role pipeline is retired (ADR-051 S-2). `.claude/agents/phase-coordinator.md` remains as an optional **read-only** gate second opinion; it never orchestrates or implements. The checklists the old roles carried live in `.claude/rules/` and `.claude/skills/`, applied by the operator at the matching step. `.claude/review-prompt.md` is the external review checklist passed to Codex; `AGENTS.md` is Codex's entry point for both its roles.

Subagents are for **read-heavy fan-out only** — finding every place something appears across many files — never for a pipeline step. A subagent starts cold and re-derives context that the operator already holds, which is exactly the cost ADR-051 exists to remove.
## Current repository state
- Blueprint, governance artifacts, the P03 toolchain, the P04 backend foundation (`backend/ResumeBuilder.slnx`: Domain / Application / Infrastructure / Api layers, `/api/v1/health/live` and `/api/v1/health/ready`, architecture guards) and the P05 frontend shell (`frontend/src`: `app`, `widgets`, `shared`; React Router routes, recoverable error boundary, structural placeholders, ADR-050). Baseline commit on `main` 2026-11-02. Phase work happens on branch `phase/Pxx` in this checkout (ADR-051); the Orca worktrees under `~/orca/workspaces/resumiser/` are gone.
- P00–P05 are `COMPLETED` (P03, P04 and P05 gates closed 2026-11-03 under delegation; P04/P05 integration DD-P05-06 merged). **P06 is `COMPLETED`** (gate accepted 2026-11-04 under delegation, merged into `main`): the twelve frozen account operations, account UI, 24-hour deletion purge with a dual ledger and owner-scoped JSON export. It was the first phase finished under ADR-051. **P07 is `COMPLETED`** (gate accepted 2026-11-05 under delegation, merged into `main`): the fifteen frozen resume, snapshot and photo operations, the typed document model, the media pipeline, the dual-ledger deletion lifecycle, and the library and trash UI. **P08 and P09 are `COMPLETED`** (batch gate accepted 2026-11-05 under delegation, merged into `main`): the single-page editor workspace, the autosave queue with local drafts, the ADR-029 conflict flow, document undo, photo and version-history UI, and the ProseMirror rich text field over the contract AST (ADR-052). **P10 is `COMPLETED`** (gate accepted 2026-11-06 under delegation, merged into `main`): three data-only templates, the design-aware draft view, the Design tab, and the ADR-010 gate passed. **P11 is `COMPLETED`** (gate accepted 2026-11-06 under delegation, merged into `main`): the full layout engine with T2, T3 and the §8 rules, the painted paginated preview with zoom, counter, Fit to pages and hints, first-page thumbnails, and `POST /client-events`. `features/preview-paint/runtime.ts` is the only value import of the engine, by `import()`. **P12 is `COMPLETED`** (gate accepted 2026-11-06 under delegation, merged into `main`): one-click PDF and TXT from the top bar and the library, tagged PDF with FR-PDF-05 metadata, the §9 serializer with goldens, the FR-TYP-03 and ADR-013 gates, and PT Serif's bundled fallback (`ENGINE_VERSION` 1.1.0). **UI-01 is merged** (2026-11-08, outside the phase sequence, ADR-053, `docs/blueprint/changes/UI-01-shadcn-migration/`): every screen uses the tweakcn tokens and the shadcn primitives behind the `shared/ui` API, with a Light/Dark/System switch in the header; the resume document stays unthemed. **P13 is `COMPLETED`** (gate accepted 2026-11-13 under delegation, merged into `main`): leased lifecycle jobs and the hourly trash expiry, restore reconciliation (`dotnet ResumeBuilder.Api.dll reconcile-restore`) with its drill, the browser-built data archive (FR-ACC-04), the CSRF single-flight bootstrap with one retry (P10's cold-start 403), CSP and security headers in the web image, HSTS and trusted networks in the API, and `docs/operations/runbook.md`. **TPL-01 is merged** (2026-11-15, outside the phase sequence, ADR-054, `docs/blueprint/changes/TPL-01-template-t4/`): a fourth template T4 "Panel" (left sidebar panel on every page, split header), built as data on the one engine with T1–T3 byte-identical (golden `tests/fixtures/layout/t1-t3-hashes.json`); contract 1.1.0 (`templateId` gains `T4`), `ENGINE_VERSION` 1.2.0. CV import (IMP-01, ADR-055) comes before P14. Known failures on `main` since `1d405e3`, outside TPL-01: E2E library E04 and editor E10 (TPL-01 `qa-report.md`). P14–P15 are `NOT_STARTED`; **P14 is next**. Start: `docs/blueprint/AGENT-WORKFLOW.md`, then `/phase Pxx`.
- P02 contract suite (run from repo root): `docs/phases/P02/tests/suite.cmd` (`npm ci --prefix tests/contract`, `npm test --prefix tests/contract`, `dotnet run tests/contract/dotnet/ContractReader.cs -- contracts/openapi/openapi.yaml`).
- P01 check suite (docs-only phase): `python3 -B docs/phases/P01/tests/check_p01.py` (exit 0 = OK).
- P03 toolchain (details in `infrastructure/README.md`, `backend/README.md`, `frontend/README.md`): `bash scripts/ci/local.sh [backend|frontend|e2e|integration|security]` runs the same jobs as CI (needs Docker + network); P03 phase suite: `bash docs/phases/P03/tests/suite.cmd`; infrastructure checks: `python3 -B -m unittest discover -s tests/infrastructure -p 'test_*.py'`. Run suites one at a time (concurrent Compose/Docker runs make the handoff check flaky). P04 phase suite: `bash docs/phases/P04/tests/suite.cmd`; P05 phase suite: `bash docs/phases/P05/tests/suite.cmd`; P06 phase suite: `bash docs/phases/P06/tests/suite.cmd` (backend, frontend, E2E and contract jobs; needs Docker). P07 phase suite: `bash docs/phases/P07/tests/suite.cmd` (same jobs). P08 phase suite: `bash docs/phases/P08/tests/suite.cmd` (frontend, E2E and contract jobs); P09 phase suite: `bash docs/phases/P09/tests/suite.cmd` (backend job). P10 phase suite: `bash docs/phases/P10/tests/suite.cmd` (frontend, E2E, rendering and contract jobs). P11 phase suite: `bash docs/phases/P11/tests/suite.cmd` (backend, frontend, E2E, rendering, web image and contract jobs). P12 phase suite: `bash docs/phases/P12/tests/suite.cmd` (same jobs; the rendering gate now includes `tests/rendering/export-checks.mjs`). P13 phase suite: `bash docs/phases/P13/tests/suite.cmd` (backend, E2E with rendering, both web image checks, contract and infrastructure policy); its real-stack acceptance stack is `docs/phases/P13/qa-evidence/qa-stack.sh up|reconcile|down`. Rendering gate: `bash scripts/ci/rendering.sh` (needs poppler-utils and Docker; also runs at the end of `scripts/ci/e2e.sh`), benchmarks G3, G4, and NFR-01 and NFR-03 through the real editor: `bash scripts/ci/rendering.sh bench`. Real-stack acceptance spec: `tests/e2e/real-stack/` (`tests/e2e/README.md`). The web image runs under the Compose `app` profile (`docker compose --profile app up -d --build web`, `127.0.0.1:8080`). DD-P03-22 OSV waivers for `tests/contract/package-lock.json` expire 2026-11-17.
- Runnable checks: `python3 scripts/phase-handoff-check.py --phase Pxx --step red|green|--gate` (step and gate check, ADR-051 S-8) and `python3 scripts/check-blueprint.py`, which verifies the Blueprint files, agents, commands, rules and every phase's required artifacts (exit 0 = OK).
- Token usage is logged by a `SubagentStop`/`Stop` hook (`.claude/settings.json` → `.claude/hooks/log-usage.py`) to `~/.claude/projects/-home-dmytro-git-work-resumiser/usage/usage-log.ndjson`, outside the repo. It stores counts, model names and ids only, never content. Rows are cumulative snapshots: take the latest row per `agent_id` (subagents) or per `session_id` (main session).
- The project skill for reviews is `phase-code-review`; `/code-review` is the built-in Claude Code command.
- `docker-compose.yml` holds the local dependencies filled by P03 (MongoDB replica set, mail catcher, object storage emulator; see `infrastructure/README.md`).

## Source-of-truth hierarchy
Defined in `docs/blueprint/PROJECT-CHARTER.md`, highest first: `docs/source/TECHNICAL-SPEC.md` → `docs/source/README.md` (reference-product research evidence only, not target behavior) → user-confirmed constraints → approved ADRs in `docs/blueprint/decisions/` → implementation details. If sources conflict, open a decision record citing exact sections; do not reconcile silently. Requirement IDs (`FR-*`, `NFR-*`, `D-01…D-20`) live in TECHNICAL-SPEC; `TRACEABILITY.md` maps requirement groups to phases. The exclusion list is TECHNICAL-SPEC §3.2.

## Decision register
`docs/blueprint/DECISION-REGISTER.md` statuses: `FIXED` (user constraint), `REQUIRED` (mandated by source spec), `PROPOSED` (recommendation only), `OPEN`, `SOURCE-OPEN`. Fixed: Monorepo, .NET backend, React 19 + Vite, NoSQL, Tailwind CSS 4, contract-first. **Decided in P01 (ADR-002…ADR-039, DELEGATED-DEFAULT):** .NET 10 LTS, MongoDB 8 (Atlas EU), private Azure Blob object storage, first-party auth (PBKDF2 + server sessions), Azure Germany West Central / Container Apps with EU storage (EU processing suspended for the MVP by ADR-012 Amendment 1, used only by CV import, ADR-055), GitHub Actions CI, SMTP/ACS email, single client-side TypeScript layout engine for preview/PDF/TXT (prototype gate G1–G7 at the start of P10, ADR-010). ADR-006/ADR-040 decided in P02 (OpenAPI 3.1 v1.0.0 frozen). D-05/D-06 decided in P07 (ADR-017, ADR-018). ADR-010's technology was confirmed by the P10 gate; D-12 to D-19 template decisions closed in P10. **Still open:** test tooling confirmation (P03). Any OPEN/SOURCE-OPEN item that affects a phase needs an ADR before implementation.

## Architecture (target, mostly PROPOSED — see decision register)
- **Backend** (`backend/`): ASP.NET Core modular monolith, layers Domain / Application / Infrastructure / Api, with a NoSQL repository adapter behind application abstractions. Photos and generated exports go to separate object storage, not the document DB.
- **Frontend** (`frontend/`): React 19 + Vite + TypeScript + Tailwind 4, feature-oriented modules (`app/pages/features/entities/shared/widgets`). Server state and local editor state need explicit single ownership. Autosave queue exposes Saved / Saving / Offline states and keeps changes locally.
- **Integration boundary:** backend and frontend share no code or imports. The only link is the OpenAPI 3.1 contract in `contracts/openapi/`, created in P02. Server and client types are generated from it; mocks and contract tests derive from the same schema. Do not create speculative endpoints before P02.
- **Rendering:** one canonical Resume Document AST feeds three outputs: interactive preview layout, PDF, and the TXT serializer. Preview and PDF must share **one layout result/algorithm** (FR-PRV-02); printing HTML alone is assumed not to guarantee pagination parity. The renderer technology is chosen by ADR after the P11 prototype. Output must be deterministic.
- **Reliability:** resume updates use an optimistic-concurrency version token (proposed); the server acknowledges the durable version; no acknowledged edit may be lost; queued writes need idempotency/replay design. Resume content must never appear in logs or telemetry.

## Phase graph and gates
Phases are strictly ordered by `docs/phases/README.md`: P00 → P01 → P02 (API contract, **hard gate**) → P03 → P04 ∥ P05 → P06 → P07 → P08 → P09 → P10 → P11 → P12 → P13 → P14 → P15. P04/P05 ran in parallel after P02/P03; under ADR-051 work inside a phase is sequential.

Each `docs/phases/Pxx/` holds `PHASE.md`, `PHASE-STATUS.md`, `acceptance-criteria.md`, `decisions.md`, `qa-report.md`, plus `architecture/phase-plan.md`, `tests/{test-plan,test-results}.md` and `review/code-review.md` (ADR-051 S-7; closed phases P00–P05 also keep `kickoff.md`, `dependencies.md`, `implementation/*-tasks.md` and `coordinator-log.md`, which are preserved records). A phase is done only when `PHASE-STATUS.md` reads `COMPLETED` or `COMPLETED_WITH_APPROVED_EXCEPTIONS` (full DoD and no-go list in `docs/blueprint/PHASE-GATES.md`). Each `PHASE.md` lists its **Allowed paths**; an extension needs a `DELEGATED-DEFAULT` entry in `decisions.md`.

Stop conditions are the six in ADR-051 §C: an unresolvable source conflict, a failing Must criterion that cannot be fixed without weakening a test or the contract, a security/privacy blocker, an unstabilisable non-deterministic test, a missing external account or secret with no local stub, or the external review's delta ceiling exhausted with a standing blocker, critical or major finding (Amendment 2). Never auto-start the next phase.
## Ownership (from `docs/blueprint/REPOSITORY-STRUCTURE.md`)
`contracts/**` needs approval (Contract Architect). `tests/contract/**` is owned by the Test Engineer, and developers cannot weaken it. `.claude/**` and `docs/phases/**` are controlled changes: in phase folders, append reports and preserve recorded decisions. `docs/source/**` belongs to the product owner; agents do not edit it. Agent file scopes are enforced by review and `git diff --name-only`, not by prompts alone.

## Coding behavior guidelines
Adapted from [andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills/blob/main/CLAUDE.md). They bias toward caution over speed; for trivial tasks use judgment. They complement the rules above and never override them: the Non-negotiable list, the autonomous single-operator mode (ADR-051), the phase allowed paths and the TDD rules win on any conflict.

### 1. Think before coding
Don't assume, don't hide confusion, surface tradeoffs.
- State assumptions explicitly. An uncertainty inside the phase scope is decided by the operator under delegation and recorded as `DELEGATED-DEFAULT` in `decisions.md` (the owner is not asked, ADR-051 S-5). Only the six ADR-051 §C conditions reach the owner.
- If multiple interpretations exist, present them; don't pick silently. A conflict between sources is a decision record, not a silent reconciliation.
- If a simpler approach exists, say so and push back when warranted.
- If something is unclear, name what is confusing and decide it under delegation; stop only on an ADR-051 §C condition.

### 2. Simplicity first
Minimum code that solves the problem; nothing speculative.
- No features beyond what the phase asks (and nothing excluded by TECHNICAL-SPEC §3.2).
- No abstractions for single-use code; no unrequested flexibility or configurability.
- No error handling for impossible scenarios (security and negative-path tests required by the rules still apply).
- If 200 lines could be 50, rewrite. Ask: "Would a senior engineer call this overcomplicated?"

### 3. Surgical changes
Touch only what you must; clean up only your own mess.
- Don't "improve" adjacent code, comments or formatting; don't refactor things that aren't broken.
- Match the existing style, even if you would do it differently.
- Mention unrelated dead code instead of deleting it.
- Remove imports/variables/functions that YOUR changes made unused; leave pre-existing dead code.
- Every changed line must trace to the request and stay inside the phase allowed paths.

### 4. Goal-driven execution
Define success criteria and loop until verified.
- "Add validation" → write tests for invalid inputs, then make them pass. "Fix the bug" → write a test that reproduces it, then make it pass. "Refactor X" → tests pass before and after. This is the project TDD flow (`.claude/rules/01-tdd-and-quality.md`); never change tests to make code pass.
- For multi-step work state a brief plan, each step with its check:
  1. [Step] → verify: [check]
  2. [Step] → verify: [check]
- Strong success criteria allow independent looping; weak ones ("make it work") need constant clarification. Report only checks that actually ran.

These guidelines are working if diffs contain fewer unnecessary changes, fewer rewrites come from overcomplication, and clarifying questions come before implementation rather than after mistakes.

## Language
All project instructions and artifacts are in English: `CLAUDE.md`, `AGENTS.md`, `README.md`, `.claude/**`, `docs/blueprint/**`, `docs/phases/**`, code and tests. Write new content in English. `docs/source/**` belongs to the product owner and stays in its original language; quotes from it may keep the original wording. Closed-phase records (P00–P02) may contain verbatim quotes of earlier Russian text.

# UI / Design System
shadcn/ui (Radix + Tailwind) is the only UI component system. All UI work follows these rules.

- Before writing UI, check `frontend/src/shared/ui/`. If a component is missing, add it with `npx shadcn@latest add <name>` (run in `frontend/`). Never hand-write Button, Dialog, Input, Select, Card, Tabs, etc.
- Check a component's API first (shadcn skill or `npx shadcn@latest docs <name>`).
- Don't edit `frontend/src/shared/ui/` for one-off needs; use `className`/variants at the usage site. Change base components only for site-wide changes, and say so.
- Colors, radius, fonts come only from theme tokens in `frontend/src/app/shell.css` (`bg-background`, `text-foreground`, `bg-primary`, `text-muted-foreground`, `border`, `bg-card`…). No hex/rgb, no raw palette classes like `bg-blue-500`.
- Theme comes from tweakcn; change it by re-applying a theme URL via `npx shadcn@latest add`, not by hand. After re-applying, keep font variables pointing to the installed Fontsource family names.
- Must work in light and dark mode. Icons: `lucide-react` only.
- Animated components (Magic UI, Aceternity UI): marketing sections only, installed via shadcn CLI, using theme tokens.
- Legacy plain-Tailwind markup: migrate only the parts you touch; ask before rewriting unrelated code.
- Before finishing: build/typecheck passes, no new hardcoded colors, list shadcn components added/changed.
