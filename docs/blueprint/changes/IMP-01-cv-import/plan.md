# IMP-01 — CV import

- Branch: `feat/cv-import` from `main` at `a570443` (after TPL-01); merged with `--no-ff`.
- Decision: [ADR-055](../../decisions/ADR-055-cv-import.md), [ADR-012 Amendment 1](../../decisions/ADR-012-eu-hosting-data-residency.md);
  delegated details in [decisions.md](decisions.md).
- Not a phase: no phase ID, no `TRACEABILITY.md` change. It follows the ADR-051 step order (plan → contract →
  test plan → red → green → external review → acceptance → merge) with its records in this folder, as UI-01
  and TPL-01 did.
- Handoff: owner decisions O-1 to O-6 of 2026-11-14/15 (final).

## Goal

A signed-in user imports an existing CV (a PDF with a text layer, or our own TXT export) from the library,
reviews the structured result with a live preview and an import report, and creates a resume from it. The
browser extracts the text; the server structures it with Claude and proves every string came from the
source; the browser builds the document with the existing operations. The file and the photo stay local.

## Requirements in force

- X8 and D-08 lifted by ADR-055; ADR-020 superseded. X1 in force: no generated, rewritten or summarised
  text, enforced by the server's verbatim check.
- ADR-012 Amendment 1: EU storage stays; EU processing and sub-processor residency suspended (O-3).
- TECHNICAL-SPEC §9 (own TXT format, the Should input), §10 (document model and limits).
- ADR-023 (entry labels), ADR-025 (placement), ADR-054 (T4 for a left sidebar), ADR-036 (session, CSRF),
  ADR-038 (limits, 429), NFR-06 (WCAG 2.1 AA), rule 03 (no content in logs; untrusted uploads).

## Acceptance criteria

| ID | Pri | Criterion |
|---|---|---|
| AC-IMP-01 | Must | Unit tests for extraction and layout analysis on synthetic PDFs: tagged and untagged, one and two columns (left and right sidebar), bullets as glyphs and as drawn markers, links, a photo candidate. |
| AC-IMP-02 | Must | Round trip: a synthetic document exported to PDF with T1, T2, T3 and T4 is extracted, passed through the fallback parser and built; header, section titles, their order and texts are recovered. The extraction layer is asserted deterministically. |
| AC-IMP-03 | Must | Backend, against the stub provider: schema and limit validation, verbatim check (positive and negative), escalation exactly once, refusal/timeout → `503 import_unavailable`, rate limit, authentication and CSRF, **no source text in logs** (asserted); the Anthropic adapter's request carries the configured model, structured output, disabled/`between_tools` thinking and no sampling parameters. |
| AC-IMP-04 | Must | Contract: the new operation and schemas (1.2.0); the contract suite passes; generated types regenerated. |
| AC-IMP-05 | Must | The builder uses only the existing operations. Draft → document tests cover limits and clamping, placement, labels, dates ("Jan – May 2026" → 2026-01 to 2026-05), `present`, and `dateText` for unparseable dates. |
| AC-IMP-06 | Must | E2E: Library → Import CV → review (preview and report) → Create → the editor opens with the document; axe-clean; keyboard reachable. |
| AC-IMP-07 | Must | Images inside sections are dropped and listed in the report (O-5). A PDF without a text layer gets the "no text layer" message. |
| AC-IMP-08 | Must | Manual QA with the owner's key and the reference CV (local only, nothing committed): field-level tally and screenshots in `qa-report.md`. Needs the owner's key; the rest of the package does not wait for it (handoff §8). |
| AC-IMP-09 | Should | A small live eval (~20 synthetic CVs) with the key, field accuracy and cost in `qa-report.md`; not in CI. Needs the owner's key. |
| AC-IMP-10 | Should | Own-TXT (§9) import works end to end. |
| AC-IMP-11 | Could | DOCX import. **Not done** (DD-IMP-14). |

## Allowed paths

- `contracts/openapi/openapi.yaml`, `contracts/openapi/CHANGELOG.md`.
- `tests/contract/checks/inventory-security.test.mjs`, `tests/contract/checks/lint.test.mjs` (inventory row,
  x-phase set, excluded-token allowance, version; DD-IMP-02, DD-IMP-03).
- `backend/src/ResumeBuilder.Application/CvImport/**`, `backend/src/ResumeBuilder.Infrastructure/CvImport/**` (DD-IMP-19),
  `backend/Directory.Packages.props`, `backend/src/ResumeBuilder.Infrastructure/ResumeBuilder.Infrastructure.csproj` and `packages.lock.json`
  files (the SDK package), `backend/src/ResumeBuilder.Api/ImportEndpoints.cs`, `backend/src/ResumeBuilder.Api/Program.cs`
  (wiring), the API's safe-log definitions, `backend/src/ResumeBuilder.Api/appsettings*.json`,
  `backend/tests/ResumeBuilder.Api.Tests/Imp01*.cs`, the P13 security matrix row (DD-IMP-19), `backend/tests/ResumeBuilder.Architecture.Tests/**` (only if a new namespace needs a rule).
- `frontend/src/features/import/**` (new), `frontend/src/features/library/Library.tsx` and its test,
  `frontend/src/app/` route registration and its test, `frontend/src/app/security-headers.test.ts`,
  `frontend/src/shared/api/**` (regenerated types and the import call), `frontend/package.json`,
  `frontend/package-lock.json`, `frontend/vite.config.ts` and `frontend/nginx.conf` (only if the CSP needs it).
- `tests/e2e/import.spec.ts`, `tests/e2e/playwright.config.ts` (test list), `tests/fixtures/imports/**`.
- `.env.example` (placeholder only).
- `docs/blueprint/decisions/ADR-055-*`, `ADR-012-*` (Amendment 1), `ADR-020-*` (status), `docs/blueprint/DECISION-REGISTER.md`,
  `.claude/rules/03-security-privacy.md` (residency bullet), `docs/blueprint/changes/IMP-01-cv-import/**`,
  `CLAUDE.md` (residency wording, repository state line).

## Slices

| # | Slice | Check |
|---|---|---|
| S1 | Contract 1.2.0: `POST /resume-imports/structure`, `ImportStructureRequest`, `ImportStructureResult`, `ImportDraft`, `resume-import` policy, `503 import_unavailable` | P02 contract suite |
| S2 | Backend: port, stub provider, validation (schema, limits, verbatim), escalation, endpoint (auth, CSRF, limits, rate), safe logs | `Imp01*` backend tests, backend job |
| S3 | Anthropic adapter: request shape from configuration, refusal and `max_tokens` handling | adapter test over a captured HTTP request |
| S4 | Browser extraction: pdf.js reader, layout analysis (columns, order, paragraphs, bullets, links, photo candidate), intermediate text | `features/import` unit tests over synthetic PDFs |
| S5 | Fallback parser, own-TXT reader, draft → document builder, report | unit tests; the round trip over T1–T4 exports |
| S6 | UI: Import CV in the library, import page with the notice, review (preview and report), create and photo upload | component tests |
| S7 | E2E: the user journey with a mocked API | `tests/e2e/import.spec.ts`, three browsers |

## Test budget

New: ~6 frontend unit files (~45 cases), ~3 backend test files (~30 cases), 1 E2E file (~4 cases × 3
browsers). Existing: every suite unchanged in assertions except the contract inventory, version and
excluded-token rows (DD-IMP-02, DD-IMP-03).

## Risks

- pdf.js in a worker under the CSP → same-origin worker file, no eval; `security-headers.test.ts` pins it.
- The model invents or rewrites text → the verbatim check rejects it; escalation once; then fallback.
- Source text leaks into logs → safe-log events take only status, model, token counts and duration; a test
  scans the captured log for a marker string from the source.
- Cost runaway → per-user hourly and daily limits; the owner's console spend limit.
- Column detection fails on an unusual layout → the user reviews everything before it is saved; the
  fallback parser keeps the text.

## Codex worker tasks

None planned. The slices share a schema that is still settling at red, and a brief would restate most of
this plan.
