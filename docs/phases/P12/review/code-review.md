# P12 External Code Review

Reviewer: Codex CLI 0.166.0, `codex exec --sandbox read-only`, default model (ADR-051 S-3). The findings and verdict lines are the reviewer's, verbatim. The operator's notes follow under their own headings.

## Full review, `git diff main...HEAD` at c3cee6f

- **major** — [pdf.ts](/home/dmytro/git/work/resumiser/frontend/src/entities/layout/pdf.ts:103): With PT Serif selected, text containing a Latin Extended-A character such as `Ŵ` is written using a font that lacks its glyph; `ActualText` preserves it for copy and search, but the PDF displays an empty box. This violates Must NFR-07’s Latin Extended and Cyrillic coverage requirement. DD-P12-08 records the gap as a partial, but does not resolve that requirement. Add deterministic glyph coverage or fallback and test the rendered output, or obtain an approved change to the requirement.

- **info** — [test-results.md](/home/dmytro/git/work/resumiser/docs/phases/P12/tests/test-results.md:43): The E2E red-state command is recorded as `docker run …`, so the reported failure cannot be reproduced from the recorded command. Record the complete invocation, including image and mounts.

Verdict: FAIL

### Operator notes

The major finding is accepted: it overturns DD-P12-08, which recorded a Must as a partial. Fix: DD-P12-22, a deterministic fallback to bundled Roboto. The info finding is fixed in `tests/test-results.md`.


## Delta 1, `git diff c3cee6f..HEAD` at 9d3b8d0 (frontend, backend, tests, ADR-010, decisions, acceptance criteria)

The PT Serif fix resolves the reviewed coverage gap: missing glyphs fall back to Roboto in the layout model, and runtime loading makes that family available to both preview and PDF export. The added tests cover the stated Latin-1, Latin Extended-A, and basic Cyrillic ranges, verify fallback styling and baseline behavior, and compare browser output with Node’s PDF bytes.

I found no standing blocker, critical, or major findings in the requested delta. I did not run tests; this was a read-only review.

Verdict: PASS
