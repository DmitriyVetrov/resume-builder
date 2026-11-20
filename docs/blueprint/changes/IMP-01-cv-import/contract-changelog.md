# IMP-01 — Contract change log (1.1.0 → 1.2.0)

Additive minor version (ADR-006 §5). Every 1.1.0 request and response stays valid.

- New operation `POST /resume-imports/structure` (`structureResumeImport`): tag `Imports`, `x-phase: IMP-01`
  (DD-IMP-02), `x-rate-limit-policy: resume-import`, `sessionCookie` + `csrfHeader`; responses 200 (with
  `Cache-Control: no-store`), 400, 401, 403, 413, 415, 429, 503 `ImportUnavailable`, default.
- New schemas: `ImportStructureRequest` (`sourceText` 1–60,000, `sourceFormat`, `layoutHint`),
  `ImportLayoutHint`, `ImportStructureResult` (`draft`, `escalated`, `warnings`), `ImportWarning`
  (`not_in_source | clamped | over_limit`, JSON Pointer), `ImportDraft`, `ImportDraftContact`,
  `ImportDraftSection`, `ImportDraftEntry`, `ImportDraftDate`, `ImportDraftBlock` (DD-IMP-05). The draft's
  string limits are the document's `LIMITS`.
- New response `ImportUnavailable` and example `ProblemImportUnavailable`; problem code
  `import_unavailable` (503) joins the catalogue; the Limits paragraph names the 256 KB body limit.
- Example `ImportStructureResultExample` (fictional).

oasdiff against `main` (AC-P02-12, `--fail-on ERR`): no error; the suite's check passes (additive only).

Contract test changes in the same commit (approved under delegation): the inventory gains the row
`post /resume-imports/structure structureResumeImport IMP-01 resume-import session+csrf`; `xPhaseSet` gains
`IMP-01` (DD-IMP-02); `excludedTokens` allows `/resume-imports/structure` by name and adds `imports` to the
forbidden tokens, with a new negative check N-IMP-01 (DD-IMP-03); `rootFields` expects `1.2.0` (DD-IMP-16).
