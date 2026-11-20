# P05 Architecture Plan — Frontend Foundation

- Author: Solution Architect (delegated, ADR-035), 2026-11-03.
- Kickoff: [kickoff.md](../kickoff.md). Decision: [ADR-050](../../../blueprint/decisions/ADR-050-frontend-foundation-routing-and-state.md).

## Context and scope

P03 supplied a placeholder React root and pinned Node/Vite/Vitest/ESLint tooling. P02 froze the OpenAPI 3.1 v1.0.0 contract. P05 builds the product's SPA foundation on that skeleton while P04 builds backend foundation in a separate worktree. No P05 endpoint exists in the contract.

Deliver an independently built React 19 SPA with declarative routes, semantic and responsive shell, central Tailwind 4 design tokens, safe route error recovery, and the contract-generated TypeScript type pipeline plus typed fetch wrapper required by ADR-040. Root/library and editor URLs are structural pages. Save, export, account flows, resume data, page rendering and document edits are later-phase work. No placeholder control may claim those actions work.

## Requirement and acceptance mapping

| Source | P05 slice | Acceptance |
|---|---|---|
| PHASE.md objective and DoD | React/Vite/TS/Tailwind shell; independent build | AC-P05-01, AC-P05-02 |
| FR-EDT-01 and FR-EDT-07 | Regions and narrow-screen panel navigation as layout scaffolding only; complete editor behavior remains P08–P12 | AC-P05-03 |
| NFR-05 | Browser navigation and three-engine smoke; full latest-two-version matrix remains P14 | AC-P05-02, AC-P05-03 |
| NFR-06 | Semantic shell, keyboard focus, accessible error/not-found states, axe and manual QA smoke | AC-P05-04 |
| NFR-09 | Self-hosted assets, no trackers, no sensitive error display/logging | AC-P05-05, AC-P05-06 |
| ADR-003, ADR-008 F-FE-1…3, ADR-040 | Static SPA, dependency direction, generated contract types and typed fetch wrapper | AC-P05-01, AC-P05-06 |
| ADR-042; P05-OBL-P03-02/03 | Web image and security scan; reassess the global minimatch override | AC-P05-07; dependency review |

NFR-02's p95 load threshold belongs to real library/editor pages, so the shell should avoid gratuitous dependencies and route bundles but does not claim a load-time pass. FR-EDT-01 live preview and FR-EDT-07 full phone functionality are not met by this skeleton.

## Component boundaries

- `app/`: root providers, route table and top-level error boundary; owns URL and shell state only.
- `pages/`: library/landing, editor-shell and not-found page composition. No business operation or API call.
- `widgets/`: reusable page chrome and editor panel scaffolding. Every placeholder is inert and clearly labelled.
- `shared/`: central Tailwind token stylesheet, accessible primitives, and `api/` typed fetch wrapper plus generated types. Generated output under `shared/api/generated/` is ignored and regenerated, never edited.
- `features/` and `entities/`: reserved for later phase behavior. P05 need not create empty trees.

Imports follow ADR-008 F-FE-2 (`app → pages → widgets → features → entities → shared`, no upward import). `frontend/` imports no backend source. Only generated API types derive from `contracts/openapi/` (ADR-008 F-FE-1). The shell does not own server or editor document state (ADR-050).

## Routing, UI and failure behavior

Use React Router declarative mode with `/` and `/resumes` showing a library landing shell, `/resumes/:resumeId/edit` showing an editor shell, and `*` showing not-found. Use links/navigation APIs for internal navigation and Vite preview's SPA fallback for direct refresh. Routing does not authorize access, fabricate a resume, or fetch data. A later phase owns auth guards and server authorization.

At 1280 px show distinct Sections, Edit and Preview regions. At <1024 px, use accessible panel tabs or equivalent controls for Sections, Edit, Preview and Design; at 390 px every shell region is reachable without horizontal page overflow. The Design view is a placeholder until template controls are implemented. Use a semantic main landmark and heading, keyboard focus indicators, logical focus order and a skip link. The error boundary surrounds routed content, provides a safe message and recovery, and does not echo exception text. Unknown URLs render a not-found page.

Tailwind 4 uses its official Vite integration and a CSS-first token source, with self-hosted assets only (ADR-003). No remote font, icon CDN, analytics, tracking request or embedded sample resume content. Token names should support later editor surfaces without encoding a template's document styles into the shell.

## API and data impact

The contract stays v1.0.0 and read-only. Regenerate TypeScript types from `contracts/openapi/openapi.yaml` with the single ADR-040 pinned tool installation in `tests/contract/` into ignored `frontend/src/shared/api/generated/` before typecheck, test and build. The frontend package scripts may install that existing lockfile with `npm ci --prefix tests/contract --ignore-scripts --no-audit --no-fund` when the tool is absent; they must not create a second tool version or edit `tests/contract/**`. A thin typed fetch wrapper uses the generated types, same-origin `/api/v1`, JSON requests/responses and typed errors as declared by the contract; it is not invoked by P05 pages. Do not introduce a hand-written DTO, speculative endpoint, mock data store, auth token storage or content-bearing console log. The wrapper must leave credentials and CSRF behavior to the P06 auth integration; if a generic default is needed, use same-origin cookie credentials and no token persistence. The Test Architect verifies type generation and wrapper boundaries, not live endpoint behavior.

## Web image and P03 obligations

Add a frontend-local multi-stage Dockerfile using digest-pinned Node 24 build and minimal non-root static-server bases. It serves the built SPA with a deep-link fallback, no embedded secrets and a non-root runtime. The Test Engineer's P05 suite builds it, verifies runtime identity/deep-link behavior and runs the existing pinned OSV-Scanner in image mode. The Frontend Developer checks the existing `minimatch` override against the expanded dependency graph and ESLint globs; retain it only with documented compatibility evidence or remove it when safe and the unwaived frontend scan passes. Keep the P03 npm script names and strict TS flags.

P03's shared-file follow-up for a Compose `web` service, `images.lock` and CI image scan cannot be completed inside this parallel P05 source slice without overlapping P04's shared files. The coordinator must integrate those files after P04/P05 converge and record the outcome before marking the full P03 obligation complete (DD-P05-06). The P05 developer does not edit them.

## Dependencies and execution order

P02 contract + P03 skeleton → P05 Test Architect plan → Test Engineer's failing shell/type-pipeline tests → Frontend Developer implementation → Code Reviewer → QA. Contract Architect and Backend Developer are not dispatched for P05. The Frontend Developer edits `frontend/**`; the Test Engineer owns `frontend/**/*.test.*` and `tests/e2e/**`. Keep existing tests intact. The coordinator commits and merges only after its handoff and gate checks.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Structural shell mistaken for finished editor or library | Label placeholders and exclude live actions; QA checks accessible names and navigation |
| Error view leaks data from exception | Generic text only, no stack/log payload; forced-error negative test |
| Deep-link refresh works in dev but fails in deployment | Playwright against preview now; P15 verifies production SPA fallback |
| Accessibility automation misses keyboard/zoom behavior | axe smoke plus QA keyboard and 200% zoom pass |
| Generated types drift from contract | Regenerate before checks; ignore output; contract suite remains canonical |
| P04/P05 merge overlap | P05 touches frontend source, P04 backend source; no shared CI/Compose/root files |
| Web image local test passes but CI/Compose wiring is absent | Coordinator integrates shared files after parallel branches converge; P05 reports the follow-up |

## Allowed paths

The phase package `docs/phases/P05/**` is already allowed by PHASE.md. The additional exact scope for this phase is:

- `frontend/src/**`
- `frontend/public/**`
- `frontend/scripts/**`
- `frontend/index.html`
- `frontend/package.json`
- `frontend/package-lock.json`
- `frontend/vite.config.ts`
- `frontend/tsconfig.json`
- `frontend/eslint.config.js`
- `frontend/.gitignore`
- `frontend/.dockerignore`
- `frontend/Dockerfile`
- `frontend/README.md`
- `tests/e2e/**`
- `docs/blueprint/decisions/ADR-050-frontend-foundation-routing-and-state.md`

No backend, contract, root CI, `docs/source/**` or shared blueprint register edit is in this dispatch. The coordinator must update the ADR-003 row in `docs/blueprint/DECISION-REGISTER.md` when permitted; this role's ownership grant excludes it.
