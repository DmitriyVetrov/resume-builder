# TPL-01 — Template T4 "Panel"

- Branch: `feat/template-t4` from `main` at `99e4b31`; merged with `--no-ff` before IMP-01 starts.
- Decision: [ADR-054](../../decisions/ADR-054-template-t4-panel.md); delegated details in [decisions.md](decisions.md).
- Not a phase: no phase ID, no `TRACEABILITY.md` change. It follows the ADR-051 step order (plan → contract →
  test plan → red → green → external review → acceptance → merge) with its records in this folder, as UI-01 did.
- Handoff: owner decisions O-1 to O-6 of 2026-11-14/15 (scope only O-1 applies here).

## Goal

A fourth template, T4 "Panel", modelled on the owner's reference CV: a tinted sidebar panel on the left on
every page, a split header (name and headline over the main column; photo, decoration and contacts at the top
of the sidebar), uppercase section titles with a rule, "Title | Dates" entries over an italic
"Organization · Location" line, and compact sidebar entries. Built as data on the one layout engine, with T1,
T2 and T3 unchanged to the byte.

## Requirements in force

- FR-TPL-01 and FR-TPL-02 as overridden by ADR-054 (four templates, four thumbnails); FR-TPL-03 (lossless
  switch), FR-TPL-04 (no automatic zone moves), FR-TPL-05 (templates are data).
- FR-CLR-01, FR-CLR-03; WCAG 1.4.3 (≥ 4.5:1) for the accent on white and on the panel, muted on the panel.
- FR-PRV-02 / ADR-010: preview equals PDF; the rendering gate G1, G2, G5, G6, G7 covers T4.
- FR-PDF-08: tagged reading order; selectable text; clickable links.
- ADR-025: per-section placement, extended to a left sidebar.
- Rule 04: bundled fonts only; fixture-based layout tests for every renderer change.

## Acceptance criteria

| ID | Pri | Criterion |
|---|---|---|
| AC-TPL-01 | Must | `TEMPLATES` has T4; `definitionOf('T4')` returns it; unit tests cover every new definition field and the engine branch for each. |
| AC-TPL-02 | Must | T1, T2 and T3 rendering is byte-identical to before: model and TXT hashes of every fixture equal goldens taken on `main` before the change, the rendering gate's PDF hashes for T1–T3 equal those of `main`, and the `design.spec.ts` page screenshots are unchanged. |
| AC-TPL-03 | Must | New rendering cases for T4 from the synthetic mirror fixture: one page, and a long variant that runs to two pages, showing sidebar continuation and the panel on page 2. |
| AC-TPL-04 | Must | Preview equals PDF for T4: same pages, lines and breaks. `bash scripts/ci/rendering.sh` passes with the T4 cases. |
| AC-TPL-05 | Must | The contract accepts `T4` (version 1.1.0); the backend stores and returns it; the contract suite passes. |
| AC-TPL-06 | Must | The Design tab shows four thumbnails; switching T1 → T4 → T3 → T1 is lossless (FR-TPL-03) in an E2E test; the placement control applies to T4. |
| AC-TPL-07 | Must | Every T4 accent preset passes ≥ 4.5:1 on white and on its panel; muted text passes on every panel. |
| AC-TPL-08 | Must | Tagged PDF reading order is T3's (DD-TPL-04): header (name, headline, contacts title, contacts), figure, then the sections in document order; text is selectable and links are clickable. |
| AC-TPL-09 | Should | Side-by-side screenshot of the reference CV next to the synthetic mirror in T4, kept **outside the repository** (the reference CV is personal data, DD-TPL-12), with the operator's visual verdict in `qa-report.md`. |
| AC-TPL-10 | Should | The synthetic mirror fits one A4 page at Medium. |

## Allowed paths

- `frontend/src/entities/template/**`, `frontend/src/entities/layout/**`, `frontend/src/features/preview-paint/**`
  (only if a new shape needs painting), `frontend/src/features/editor/DesignPanel.tsx` and its tests,
  `frontend/src/features/editor/design/design.css` (picker grid, DD-TPL-17).
- `contracts/openapi/openapi.yaml`, `contracts/openapi/CHANGELOG.md`.
- `tests/contract/checks/schemas.test.mjs`, `tests/contract/checks/lint.test.mjs` (version and enum only,
  DD-TPL-09).
- `backend/src/ResumeBuilder.Application/Resumes/ResumeDocumentReader.cs`,
  `backend/src/ResumeBuilder.Api/ClientEventEndpoints.cs`, `backend/tests/**` (new T4 cases).
- `tests/rendering/shared.mjs`, `tests/rendering/make-fixtures.mjs`, `tests/rendering/reference.mjs` (G1 run join, DD-TPL-16), `tests/fixtures/resumes/panel-*.json`,
  `tests/fixtures/txt/panel-*.txt`, `tests/fixtures/layout/**` (golden hashes).
- `tests/e2e/design.spec.ts`, `tests/e2e/template-t4.spec.ts`, `tests/e2e/playwright.config.ts` (test list).
- `docs/blueprint/decisions/ADR-054-*`, `docs/blueprint/DECISION-REGISTER.md`,
  `docs/blueprint/changes/TPL-01-template-t4/**`, `CLAUDE.md` (repository state line).

## Slices

| # | Slice | Check |
|---|---|---|
| S0 | T1–T3 identity goldens taken on `main` before any engine change | `templates-golden.test.ts` (green on `main`, must stay green) |
| S1 | Contract 1.1.0 (`T4` in both enums), regenerated types, backend enum, logged engine `1.2.0` | P02 contract suite, backend job |
| S2 | Template model: zone side, panel, sidebar overrides, section rule, entry heads, dot marker, split header, `list` contacts, colour roles | `t4.test.ts`, `template.test.ts` |
| S3 | Engine: left zones and panel on every page; split header as the first flow of each zone; section rule; `title-dates` and `compact` entry heads; dot marker | `t4-layout.test.ts`, `pagination` sweep over T4 |
| S4 | Design tab: four thumbnails, placement control for T4 | `design-panel` unit test, `template-t4.spec.ts` |
| S5 | Rendering gate: T4 over every fixture plus the two mirror fixtures | `scripts/ci/rendering.sh` |

## Test budget

New: 3 unit files (~30 cases), 1 golden JSON, 2 fixtures, 1 E2E file (~3 cases × 3 browsers), ~30 rendering
cases. Existing: frontend, backend and E2E jobs and the contract suite unchanged in assertions except the
version and enum values of DD-TPL-09.

## Risks

- A shared engine path changes T1–T3 by a rounding step → S0 goldens are taken before the first engine edit and
  checked on every run; PDF hashes are compared against `main`'s gate output.
- Two header parts in two columns break selection regions (one region per section) → regions keyed by section
  and column; unit test on `anchorAt` for both halves.
- Teal on its panel is 4.54:1, close to the limit → contrast is a unit test over every preset.

## Codex worker tasks

None. Each slice depends on the previous one's model change, and the slices are small enough that a brief
would be longer than the work.
