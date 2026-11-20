# P05 Kickoff — Frontend Foundation

- Author: Solution Architect (delegated, ADR-035), 2026-11-03.
- Inputs: P02 frozen OpenAPI v1.0.0; P03 frontend and CI skeletons; P05 PHASE.md and acceptance criteria.

## Scope and source IDs

P05 turns the P03 placeholder into an independently built React 19, Vite, strict TypeScript and Tailwind CSS 4 single-page shell. It establishes routes, accessible navigation, design tokens, responsive page chrome, and a recoverable application error boundary. The shell gives later phases places for account, library and editor features; it does not implement those features or claim their actions work.

Source: PROJECT-CHARTER fixed frontend constraints; TECHNICAL-SPEC §§3.1–3.2, 5.3 (FR-EDT-01, FR-EDT-07 as layout direction), 11 (NFR-02, NFR-05, NFR-06, NFR-09); ADR-003, ADR-008 F-FE-1…3, ADR-040 and ADR-041. Full editor behavior, autosave, preview, and exports belong to P07–P12 and retain their source acceptance criteria.

## Roles and sequence

| Step | Role | Assignment |
|---|---|---|
| 1–2 | Solution Architect | Kickoff, architecture, delegated decisions, task boundaries |
| 3 | Test Architect | Test plan within the budget below |
| 4 | Contract Architect | Not needed: P05 does not change an API operation or schema |
| 5 | Test Engineer | Failing shell tests and `tests/suite.cmd` before implementation |
| 6 | Frontend Developer | Implement only the P05 frontend tasks against the red tests |
| 7 | Code Reviewer | Review scope, accessibility, error behavior and privacy |
| 8 | QA / Acceptance | Run the P05 acceptance matrix and browser smoke |

Backend Developer has no P05 assignment. P04 owns `backend/**` in a separate phase worktree. The coordinator owns gate and commits.

## Test budget (ADR-035 B-4: code phase)

Every P05 Must criterion receives a positive and a negative case. Keep the test set to:

- Up to four focused Vitest/React Testing Library files under `frontend/src/**`, covering route matching and unknown paths, shell navigation and keyboard access, error boundary recovery, and responsive tab state or layout semantics. Assertions target roles and behavior, not DOM snapshots or Tailwind class strings.
- One Playwright shell spec under `tests/e2e/**`, run with the existing pinned Chromium, Firefox and WebKit projects. It checks direct deep-link refresh, desktop/390 px navigation, keyboard focus, and an axe WCAG 2.1 A/AA smoke. Axe covers detectable issues; QA does a manual keyboard and 200% zoom pass.
- Existing lint, strict typecheck, unit test and build scripts, plus one P05 `tests/suite.cmd` that calls the frontend and E2E CI jobs and a frontend-local web-image build/runtime/OSV scan check. No new test runner, fixture tree, visual baseline or backend test suite.
- Negative cases include an unknown URL, a thrown route render, no pointer input, and the narrow viewport; they must fail for the intended missing behavior during red, not because the test harness is broken.

The Test Architect may select the smallest cases that cover each criterion. Tests for later account/library/editor behavior are outside this budget.

## Slices and parallelism

P05 has one frontend implementation slice in `frontend/**`; no backend slice or child worktree is needed. P04 and P05 run in parallel on separate phase branches with disjoint source ownership: P04 `backend/**`, P05 `frontend/**`. P05 reads the frozen P02 OpenAPI v1.0.0 but neither phase edits the contract for this slice. ADR-040's generated TypeScript types and typed fetch wrapper are implemented from `contracts/openapi/openapi.yaml` into an ignored frontend folder; no endpoint call is required for the shell.

## Decisions needed

ADR-050 settles router mode, route skeleton, state ownership at the foundation boundary, and error-boundary recovery under ADR-035 A-4. P05 decisions.md records the options and `DELEGATED-DEFAULT` rationale. The fixed ADR-003/ADR-041 toolchain and ADR-008 frontend dependency direction stay in force. D-05/D-06 and template questions are owned by P07/P10 and are not needed to render the foundation shell. No owner question or external account is required.

P03 also assigned a `web` container and an existing `minimatch` override review to P05. The image and scan stay in frontend-local scope. Compose, image-lock and CI wiring require shared files, so DD-P05-06 assigns that integration to the coordinator after the parallel P04/P05 branches converge; the P05 developer must leave those shared files untouched.

## Handoff

Next owner: Test Architect, then Test Engineer. A future phase must replace each explicitly labelled placeholder with tested product behavior; P05 must not present placeholder save/export/account controls as functioning actions.
