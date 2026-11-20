# P05 Frontend Tasks

Owner: Frontend Developer after the Test Engineer's red evidence. Allowed source: the exact `frontend/` paths in phase-plan `## Allowed paths` only. Do not edit the existing or newly written tests, contract, backend, root CI scripts, or source spec. Append exact command/result evidence to `docs/phases/P05/tests/test-results.md` and update task status here. Use the frozen P02 OpenAPI v1.0.0 contract; no new endpoint.

| Task | Status | Work | Acceptance and tests |
|---|---|---|---|
| FE-P05-01 | Done | Extend the P03 app root with React Router declarative routes for `/`, `/resumes`, `/resumes/:resumeId/edit` and `*`; build semantic library landing, editor shell and not-found pages. Internal links, browser back/forward and direct URL refresh must work. | AC-P05-02; Vitest/RTL route tests and Playwright shell spec |
| FE-P05-02 | Done | Build accessible page chrome and editor region scaffolding. At desktop width show Sections/Edit/Preview regions; at narrow width expose Sections/Edit/Preview/Design navigation. Keep later-phase actions inert and clearly labelled. | AC-P05-03/04; keyboard and 390 px tests, axe smoke |
| FE-P05-03 | Done | Add Tailwind 4 with the official Vite plugin and one central CSS-first token source. Use self-hosted assets, responsive spacing, visible focus and 200% zoom support. Keep fixed npm script names, exact pins and strict TS settings. | AC-P05-01/03/04; lint/typecheck/build, QA zoom pass |
| FE-P05-04 | Done | Add an error boundary around routed content with a generic message and working recovery action. Keep unknown URLs in the not-found route. Do not log exception text, resume content, contact data or tokens. | AC-P05-05; forced-error positive/negative RTL tests |
| FE-P05-05 | Done | Wire ADR-040 OpenAPI TypeScript generation into the frontend check/build scripts using the single pinned `tests/contract` installation; output to ignored `src/shared/api/generated/`. Add a thin typed same-origin fetch wrapper, without invoking it from shell pages or inventing DTOs/endpoints. | AC-P05-06; generation/typecheck and static boundary checks from Test Engineer |
| FE-P05-06 | Done | Update `frontend/README.md` with shell routes, local commands, generated-type regeneration, and the boundary between placeholders and later features. Run the P05 suite and record exact results. | AC-P05-01…06; `bash docs/phases/P05/tests/suite.cmd` after Test Engineer creates it |
| FE-P05-07 | Done | Build a frontend-local multi-stage, digest-pinned, non-root web image with SPA deep-link fallback. Run the P05 image build/runtime/OSV scan check. Reassess the existing `minimatch` override with added dependencies and globs; document the decision. Do not edit shared Compose/CI/image-lock files while P04 runs in parallel. | AC-P05-07; P05-OBL-P03-02/03; P05 suite and security evidence |

TDD sequence per task: confirm the specific red test fails for missing behavior, implement the smallest change, run the narrow test and relevant full suite, then record exit codes. A failing or inconsistent test is reported to the coordinator; it is not weakened.

## Review cycle 1 status

F-01 clean-context image build, F-02 route recovery, F-04 desktop/narrow panel layout, and F-07 `Headers` handling are implemented. F-03 is sanitized by an exported no-op handler passed to the production `createRoot`; the committed RTL test creates a distinct root and the Test Engineer will pass the same handler to that root (DD-P05-07). The full suite remains red at that assertion, so this review cycle is pending rather than green. F-05/F-06/F-08 are deferred minor review findings. Exact evidence is in `tests/test-results.md`.

## QA fix — 2026-11-03

FE-P05-03: Done after QA retest. At 390 px with `document.body.style.zoom="2"`, the header's primary navigation extended to x=413 px. The narrow breakpoint now wraps header items; the independent check reports `scrollWidth=390`, `clientWidth=390`, with all four editor panels and not-found recovery keyboard reachable. The full P05 suite passed. A browser regression test for 390 px / 200% zoom is needed; the Test Engineer owns that test, so no test file was edited here. Exact evidence is in `tests/test-results.md`.
