# Project Charter

## Product
Resume Builder — SaaS web application for creating, editing, previewing and exporting resumes.

## Source-of-truth hierarchy
1. `docs/source/TECHNICAL-SPEC.md` — target functional/non-functional requirements, explicit exclusions, domain model, layout/export rules and open decisions.
2. `docs/source/README.md` — observed reference-product behavior, measured UI/export observations and research evidence.
3. User-confirmed technology/working constraints recorded in this Blueprint.
4. Approved ADRs in `docs/blueprint/decisions/`.
5. Implementation details.

If sources conflict, do not silently reconcile: raise a decision record with exact source sections.

## Confirmed project constraints
- Backend: .NET (exact target version is a decision gate).
- Frontend: React 19 + Vite.
- NoSQL persistence (provider not yet confirmed).
- Tailwind CSS 4.
- Git Monorepo.
- Backend and Frontend are developed independently.
- Their integration boundary is a separately designed, reviewed and versioned API contract.
- Every phase has an architect, test architect/test engineer and developer role; implementation follows prepared tests and continuously runs them.

## Product shape and v1
The target is the editor workspace, resume library, accounts, resume document model, rich text, templates/design controls, page-aware preview, PDF and TXT exports, autosave/reliability and production readiness.

The target editor is a single workspace with editable content and always-visible preview, not the reference product's multi-step wizard.

## Graphic design and UX direction

Owner direction (2026-11-03): deliver a polished, expressive modern application using the already confirmed Tailwind CSS 4 stack. Use `docs/source/img/` and the accompanying research as explicit visual and UX references, adapted to the target specification. The Solution Architect must turn this direction into concrete screen designs, interaction specifications, frontend tasks and observable acceptance criteria in each relevant phase. See [UI and UX design planning](UI-UX-DESIGN.md) for responsibilities, screenshot mapping and delivery phases.

## Explicitly excluded (must remain excluded unless scope is formally changed)
Use `TECHNICAL-SPEC.md` §3.2 as authoritative. Known exclusions include AI generation, pre-written phrase libraries, import/parse of PDF/DOCX, DOCX export, cover letters, public publishing/share, email sending, resume score/review and unrelated marketing/job-board features. Monetization/paywall is out of scope for this specification.

## Quality principles
- Requirements traceability from FR/NFR to tests and implementation.
- Test-first delivery.
- Contract-first parallel development.
- Least privilege for agents and human review at phase gates.
- Deterministic rendering and exports.
- No loss of acknowledged edits.
- Privacy by design and EU residency as required by source specification.
