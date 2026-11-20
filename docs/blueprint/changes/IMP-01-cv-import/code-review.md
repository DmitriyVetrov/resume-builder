# IMP-01 — External review

Reviewer: Codex (codex-cli 0.166.0), `codex exec --sandbox read-only` with `.claude/review-prompt.md` (AGENT-WORKFLOW step 6).

## R1 — full review, `git diff main...1b55651`

Reviewer output, verbatim:

- **Major — contract violation:** [ImportDraftValidator.cs](/home/dmytro/git/work/resumiser/backend/src/ResumeBuilder.Application/CvImport/ImportDraftValidator.cs:109) appends a warning for every surplus array item, but the response contract caps `warnings` at 500. If the provider returns 1,000 contacts, validation keeps 20 and can return 980 `over_limit` warnings. Bound the warnings or reject the draft so every response conforms to OpenAPI.

- **Major — round-trip test does not prove paragraph recovery:** [round-trip.test.ts](/home/dmytro/git/work/resumiser/frontend/src/features/import/round-trip.test.ts:49) checks each source paragraph against the extracted, serialized PDF text. It never checks that `fallbackDraft` or the built document contains those paragraphs. A regression that drops paragraphs during parsing or building would still pass R-01. Assert recovery from the draft and built document for T1–T4.

- **Minor — E05’s exception is broader than documented:** [library.spec.ts](/home/dmytro/git/work/resumiser/tests/e2e/library.spec.ts:220) removes every exact `Import CV` occurrence from the page text before checking excluded affordances. A second forbidden affordance with that same label would pass. Limit the exception to the intended library link or assert its allowed count and location.

- **Minor — review step is not announced or focused:** [ImportPage.tsx](/home/dmytro/git/work/resumiser/frontend/src/features/import/ImportPage.tsx:123) clears the status message when the review appears, and the review heading is not focused or announced. After choosing a file, screen-reader users may remain on the now-hidden picker without being told the review is ready. Move focus to the review heading or announce completion.

The DD-IMP-22 changes preserve the relevant assertions and correct the test assumptions described. DD-IMP-25 also preserves the guards while adding the expected operation and adapter. DD-IMP-24’s global text replacement weakens E05 as noted above. The recorded test results show an assertion-based red state before green; AC-IMP-08 and AC-IMP-09 were excluded as requested.

Verdict: FAIL

Operator note: all four fixed under DD-IMP-26.
- Major 1: `ImportDraftValidator` returns at most the contract's 500 warnings (the first 500 in draft order); per-item warnings stay as B-12 pins them. B-18 (new: 1,000 contacts → 200, schema-valid, 20 contacts kept, exactly 500 warnings starting at `/contacts/20`) failed red on the schema assertion, then passed.
- Major 2: R-01 now also asserts each paragraph in the fallback draft and in the built document's text. It passed at once on T1–T4; a mutation that drops non-bullet blocks in `fallback.ts` made 4 of 5 round-trip tests fail on the new "fallback draft" assertion (reverted).
- Minor 3: E05 asserts the library link (`href` `/resumes/import`) before the dialog opens and that the page text holds "Import CV" exactly once, then removes that one occurrence only.
- Minor 4: the review heading takes the focus and the status line says "The CV is ready to review." U-08 (new) failed red on `toHaveFocus`, then passed.

## D1 — delta, `git diff 1b55651..936daf7`

Reviewer output, verbatim:

- **Major — warning cap: Resolved.** `Check` now returns at most 500 warnings, matching OpenAPI’s `maxItems: 500`. B-18 exercises 1,000 surplus contacts and validates the response against the schema.
- **Major — round-trip paragraph recovery: Resolved.** R-01 checks each source paragraph in the serialized text, fallback draft, and built document for T1–T4. The recorded mutation test reports failures when fallback drops non-bullet blocks.
- **Minor — E05 exception scope: Resolved.** The test checks the library link’s `href`, requires exactly one “Import CV” occurrence, then removes only that occurrence before checking excluded affordances.
- **Minor — review focus and announcement: Resolved.** When review appears, focus moves to its heading and a status message announces that the CV is ready.

I found no new actionable findings in the delta. The recorded red and green results cover the fixes and report no test assertions removed or weakened.

Verdict: PASS

Operator note: the external review closes at D1 (ADR-051 Amendment 2), one delta of three.
