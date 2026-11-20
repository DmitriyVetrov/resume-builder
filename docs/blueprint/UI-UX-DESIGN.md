# UI and UX Design Planning

## Owner direction and scope

Recorded from the owner on 2026-11-03: the screenshots in `docs/source/img/` must inform the application's graphic design and UX, and this implementation must be explicitly planned. The requested direction is a polished, expressive modern interface ("fancy") using Tailwind CSS, already fixed at version 4 by the project constraints.

This direction applies to application pages, forms, navigation, panels, dialogs and feedback as well as template/design controls. It is a planning requirement for forthcoming phases. It does not select a UI component library, exact palette or paid theme. The Solution Architect must choose and document a concrete, coherent visual system under the existing delegated decision process.

## Source interpretation

Read TECHNICAL-SPEC, its Appendix A screenshot index, the relevant research in `docs/source/README.md`, and inspect the actual referenced images. Cite exact filenames in the phase design artifact. Follow the source hierarchy in PROJECT-CHARTER and record conflicts or adaptations in the phase decisions.

Reference-product screens provide evidence for visual hierarchy, controls and interactions. Adapt them to the specified single workspace with section, editing and preview panels. Excluded product features remain excluded, including AI/content suggestions, import, publishing, scoring and monetization. The reference's wizard, download wizard and marketing pages do not become target journeys just because they appear in an image.

Document whether each reference element is reused, adapted or excluded, with a source requirement or decision explaining the choice. A screen with no matching screenshot, such as an account screen, must be designed in the shared application style and identified as a new design.

## Phase ownership and reference map

The following map is a starting point for the Solution Architect's inspection and phase-specific traceability; the technical specification defines the required behavior.

| Phase | Design and UX to deliver with the feature | Initial references in `docs/source/img/` |
|---|---|---|
| P06 | Establish the shared application visual system; design signup, verification, login and password recovery, including validation and recovery states | No dedicated account screenshots; use the application references for visual continuity and FR-ACC for behavior |
| P07 | Resume library cards, empty/loading/error states, create/copy, rename, delete/trash and related dialogs | `03-dashboard-resumes.png`, `05-create-new-modal.png` |
| P08 | Finished editor workspace, top bar, section navigation, content forms, reorder/hide/delete/undo, save/offline feedback and narrow-screen panel navigation | `70-finalize-formatting-tab.png`, `15-contact-step.png` through `20-contact-dob-picker.png`, relevant entry/section forms in `23-*` through `60-*`, `64-rearrange-sections.png`, `67-rename-section.png`, `68-delete-section-confirm.png` |
| P09 | Rich-text toolbar, text selection, links, list editing and keyboard/focus behavior within the workspace | `27-responsibilities-editor.png`, `28-responsibilities-typed.png`, `30-responsibilities-add-url.png`; exclude the reference's pre-written suggestions |
| P10 | Template picker, thumbnails, color choices and typography/spacing/layout controls using the shared application components; document design remains governed by T1 and approved T2/T3 decisions | `10-choose-template.png` through `14-after-select-template.png`, `22-preview-formatting-tab.png`, `70-finalize-formatting-tab.png`, `71-more-font-settings.png`, `73-font-list.png`, `76-template-mlo1-corporate.png`; T1 details in `90-*` through `93-*` |
| P11 | Paginated live preview, zoom, page counter, selection feedback and layout hints | `21-contact-preview-modal.png`, `66-preview-after-move-educ.png`, `79-preview-compact.png`, `80-pdf-B-compact-pages.png`, `81-pdf-C-spacious-pages.png`, `84-pdf-A-default-pages.png`; correct the documented reference pagination defects |
| P12 | Clear one-click PDF/TXT actions, export progress, failure and retry feedback in editor and library | `78-download-step1-format.png` for format-choice evidence, adapted to the target one-click export requirements |
| P13 | Consistent recovery, destructive confirmation and data-lifecycle feedback for the flows owned by this phase | Reuse the established application design and the relevant account/editor states; derive behavior from FR-ACC/FR-PER and reliability requirements |
| P14 | Consolidate visual consistency, complete journeys, responsive behavior, browser coverage and accessibility verification across all finished screens | Phase design artifacts and agreed local visual baselines from P06–P13 |
| P15 | Release verification of the delivered interface and resolution of remaining release-blocking findings | P14 evidence and release requirements |

P05 remains the completed structural foundation. Establish the concrete application visual direction at P06 kickoff and implement it with the P06 screens, then extend the same system in P07/P08. Deliver each feature's finished visual design in its own phase; P14 is the integration and regression check. Existing phase statuses and closed gate evidence are historical records.

## Required Solution Architect deliverable

For every phase with user-facing frontend work, create `docs/phases/<phase>/architecture/ui-ux-design.md` and link it from kickoff and the architecture plan. Specify:

1. **Screen and requirement map:** source IDs, exact screenshot links, applicable interactions, deliberate adaptations and exclusions.
2. **Visual specification:** concrete hierarchy, typography, color roles, surfaces, borders, spacing, radii, elevation, icons and any motion. Include layout sketches or local mockups so the implementation step has a defined target and the external review can compare against it.
3. **Shared component and token plan:** extend the existing central Tailwind CSS 4 token source and reusable controls; identify ownership and allowed paths. Evaluate any added UI kit against accessibility, license, bundle cost, self-hosting and existing project boundaries; record the decision before adoption.
4. **Interaction specification:** routes and navigation, primary/secondary actions, forms and validation, dialogs, focus transitions, keyboard alternatives, destructive-action recovery, and relevant loading/empty/error/disabled/saving/offline states.
5. **Responsive behavior:** concrete desktop and narrow-screen layouts, including the specified three panels at 1280 px, reachable panel tabs at 390 px, and behavior around the 1024 px transition. Specify overflow and scrolling so the editor and document preview remain usable.
6. **Acceptance and evidence:** observable criteria, viewports, representative states and review artifacts for visual comparison, keyboard/focus, 200% zoom and WCAG 2.1 AA. Honor reduced-motion preferences when introducing animation. Specify what must match the local approved design and what is intentionally different from a source screenshot.

Use decorative effects to support hierarchy, readability and interaction feedback. Keep resume content and the preview legible. Bundle and version assets as required by the project, and keep application typography and tokens separate from the canonical document layout that drives preview and PDF.

## Delivery and verification responsibilities

- **Solution Architect:** own the design artifact, concrete visual decisions and requirement/reference mapping; translate these into scoped frontend tasks and acceptance criteria before implementation. Record delegated choices in the phase decisions and ADRs where required.
- **Test Architect:** use the design artifact to plan visual, interaction, responsive and accessibility coverage within the phase test budget.
- **Test Engineer:** create meaningful checks before implementation using deterministic synthetic fixtures and the agreed local design. Source screenshots illustrate research behavior; they are not automatic pixel-equality baselines for the adapted product.
- **Frontend Developer:** implement the planned visuals and UX with the feature, using shared tokens and components; report deviations to the architect.
- **Reviewer and QA:** compare the delivered pages with the phase design, inspect representative desktop/phone states, and report concrete visual or interaction defects. Automated accessibility checks supplement manual keyboard, focus and zoom review.

## Adoption

Every phase plan that touches UI must read this brief before writing its design artifact (ADR-051 step 1). Under single-operator execution there is no separate worker to re-brief: the operator reads this file at planning time and records the resulting design decisions in the phase's `architecture/phase-plan.md` and `decisions.md`.

P06 was already in progress when this brief was written. Its remaining UI work and its gate report must be checked against this brief, and any gap that is not fixed in P06 is recorded as a follow-up for the phase that owns it (P08 for the editor workspace, P10 for templates and design controls). Existing tests and recorded decisions are preserved, never rewritten to match the brief.
