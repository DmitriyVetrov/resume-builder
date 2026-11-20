# P06 Kickoff — Identity & Accounts

- Architect: Solution Architect (delegated, ADR-035), 2026-11-03.
- Source: TECHNICAL-SPEC §§3.2, 5.1 (FR-ACC-01…06), 11 (NFR-08/09/10/12), 12 (D-01…03); TRACEABILITY `FR-ACC`; accepted ADR-013…015, ADR-034, ADR-036…039; P02 OpenAPI 1.0.0; P04 and P05 completed foundations.
- Visual direction: [P06 UI and UX design](architecture/ui-ux-design.md) applies the owner's [shared design brief](../../blueprint/UI-UX-DESIGN.md) to these new account screens. Reviewed references are `03-dashboard-resumes.png`, `05-create-new-modal.png`, `15-contact-step.png`, `10-choose-template.png`, `22-preview-formatting-tab.png` and `70-finalize-formatting-tab.png` under `docs/source/img/`; none is an account-screen template.

## Scope and slices

P06 delivers email/password sign-up and verification, session discovery, login/logout, reset and password change, re-authentication, an account deletion request and purge of P06-owned live data, and the account JSON data-export endpoint. A verified account is required for data export. The browser's complete archive assembly, PDF/TXT regeneration, and photo inclusion depend on P07/P12/P13; P06 exposes the contracted data source and a clear staged UI. Guest claim is a Could item: P06 supplies the signed-in confirmation interface, while P07 supplies `createResume` and P08 supplies the durable local draft/claim integration (ADR-015). Google sign-in is deferred by ADR-014.

P06 also finishes the visual design and interaction states of sign-up, verification, login, reset request/confirm, account settings, password change, re-authentication, deletion confirmation and JSON export. It establishes shared Tailwind 4 application tokens and controls for P07/P08. The reference screenshots inform hierarchy, field rhythm and dialogs; their wizard, score, promotion, import, publish and template gallery are excluded. Account pages are new designs because the source has no account screenshots. See `architecture/ui-ux-design.md` for layouts, responsive states and evidence.

Work in slices: (1) session/CSRF and account persistence; (2) sign-up, verification and email outbox; (3) login, logout, reset, password change and revocation; (4) re-auth, deletion and data export; (5) frontend account screens and protected navigation. Implement slices through red tests, then green code. The Test Architect owns the case matrix; the Test Engineer writes executable red tests before either developer implements behavior.

## Roles and contract

Solution Architect → Test Architect → Test Engineer → Backend Developer ∥ Frontend Developer → Code Reviewer → QA / Acceptance Agent. **No Contract Architect dispatch is needed:** frozen P02 OpenAPI 1.0.0 already has every P06 operation (`x-phase: P06` on `getSession`, eight auth operations and three account operations). Guest claim uses the P07 `createResume` and `uploadPhoto` operations; there is no guest endpoint. Any discovered contract gap returns to the Solution Architect and requires a separate compatible Contract Architect step before implementation, never an ad hoc DTO or contract edit by a developer.

Backend and frontend may run in parallel child worktrees after the P02 contract and Test Engineer's red tests are frozen. Their file sets are disjoint. Frontend integration tests use contract-derived fixtures or a mock while the backend is built, then QA runs the real integrated flows. Shared setup, root CI and contract files are outside both developer grants.

## Test budget (ADR-035 B-4: code phase)

Every **Must** criterion has at least one positive and one negative executable case. The Test Architect may group related assertions into one scenario, but must cover token expiry/reuse, session revocation, CSRF, generic anti-enumeration responses, re-auth freshness, account isolation, deletion timing and content-free logs. **Should** FR-ACC-04 gets positive and negative cases because export is sensitive personal data; **Could** guest claim receives a bounded UI/contract seam test, with its end-to-end claim deferred to P08. Use the existing xUnit v3/WebApplicationFactory/Testcontainers stack, Vitest/RTL and Playwright; add no test framework, CLI or fixture tree. Use a controllable clock and local Mailpit or a deterministic email adapter. Keep no real contacts, resume contents, tokens or downloaded bytes in logs or recorded results. Test Architect names exact focused and full commands in `tests/test-plan.md`.

The same budget includes a compact visual/UX matrix from `architecture/ui-ux-design.md`: synthetic login, verification, settings and deletion states at 1280 and 390 px, the 1024 px transition, 200% zoom, keyboard/focus and reduced motion. Automated accessibility checks supplement manual WCAG 2.1 AA review; source screenshots are references rather than pixel-equality baselines. Finished styling belongs to P06, with P14 consolidating cross-phase verification.

## Decisions and gates

D-01 is closed by ADR-013: unverified users may log in and edit; exports require verification. D-02 is closed by ADR-014: no Google sign-in in v1. D-03 is closed by ADR-015: one browser-local guest draft and explicit claim, with P06's prompt integrated in P08. These accepted decisions are restated as `DELEGATED-DEFAULT` in `decisions.md`; no new product ADR or register change is needed now. Architecture resolves the P06/P13 deletion and export staging without changing the source requirement or contract. Paid email and production key/storage settings remain deployment work; local adapters and placeholders suffice for this phase.
