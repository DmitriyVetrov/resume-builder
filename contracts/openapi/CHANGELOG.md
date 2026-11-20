# Contract change log

All changes to `openapi.yaml`. Versioning: semver per ADR-006 §5 (minor = additive, patch = descriptions and examples; breaking changes follow `docs/phases/P02/architecture/phase-plan.md` §9.3 and are marked `BREAKING (pre-release)` until the P15 release). Each entry names the phase and links the phase contract change log with the oasdiff report.

## 1.2.0 — 2026-11-15

- Change: IMP-01 (CV import, ADR-055), outside the phase sequence. Details: `docs/blueprint/changes/IMP-01-cv-import/contract-changelog.md`.
- Additive: `POST /resume-imports/structure` (`structureResumeImport`, tag `Imports`, `x-phase: IMP-01`, policy `resume-import`, session and CSRF), schemas `ImportStructureRequest`, `ImportLayoutHint`, `ImportStructureResult`, `ImportWarning`, `ImportDraft`, `ImportDraftContact`, `ImportDraftSection`, `ImportDraftEntry`, `ImportDraftDate`, `ImportDraftBlock`, the response `ImportUnavailable` and the problem code `import_unavailable` (503). No existing schema or operation changes.

## 1.1.0 — 2026-11-15 — BREAKING (pre-release)

- Change: TPL-01 (template T4, ADR-054), outside the phase sequence. Details and breaking-change analysis: `docs/blueprint/changes/TPL-01-template-t4/contract-changelog.md`.
- `ResumeDocument.templateId` and `ResumeSummary.templateId` gain `T4`. Every 1.0.0 request stays valid, but oasdiff reports a new response enum value as breaking (`response-property-enum-value-added`, 4 errors, 1 warning), so this follows phase-plan §9.3: decision DD-TPL-14, the report in the change log, backend and frontend changed together, minor bump.

## 1.0.0 — 2026-11-02

- Phase: P02 (API Contract v1). Author: Contract Architect. Details and breaking-change analysis: `docs/phases/P02/architecture/contract-changelog.md`.
- First version; no baseline on `main`, so there is no breaking-change comparison (oasdiff self-diff: no changes).
- 30 operations (phase-plan §5): Health (2, P04), Session (9, P06), Account (3, P06), Resumes (7, P07), Snapshots (3, P07), Photos (5, P07), Telemetry (1, P11). Every operation carries `x-phase` and `x-rate-limit-policy`; `x-requires-reauth` / `x-requires-verified-email` where relevant.
- Schemas of phase-plan §6: the closed `ResumeDocument` with the rich-text AST, resource and result schemas, closed request schemas, RFC 9457 `Problem`, `ValidationIssue`, `VersionMismatchProblem`.
- Cross-cutting semantics of phase-plan §7: cookie session + `X-XSRF-TOKEN`, re-authentication, strong `ETag` / `If-Match` (428/412/400), `Idempotency-Key` with the request-hash rule, cursor pagination, `no-store` and private photo caching, limits, 429 with `Retry-After`.
- Fictional examples for every success response with a body and every shared error response.
- No server PDF/TXT/DOCX export, import, sharing, AI, payment or template endpoints (TECHNICAL-SPEC §3.2, ADR-010).
- Review fix loop 1 (M-1, description only, version stays 1.0.0): `sessionCookie` description now states `SameSite=Strict`, as ADR-036 §3/§4 and threat model T-SP-03 require; it said `SameSite=Lax` before.
