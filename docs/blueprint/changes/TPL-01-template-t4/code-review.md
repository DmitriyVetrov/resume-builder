# TPL-01 — External review

Reviewer: Codex, `codex exec --sandbox read-only` with `.claude/review-prompt.md` (AGENT-WORKFLOW step 6).

## R1 — full review, `git diff main...dc9b004`

Reviewer output, verbatim:

- **Major** — [paginate.ts](/home/dmytro/git/work/resumiser/frontend/src/entities/layout/paginate.ts:69). With a valid T4 resume containing 20 long contacts, the sidebar header can exceed one page. `splitOversized` then places some header rows on page 1 and the rest on page 2, violating PG-06 and ADR-054’s requirement that each header half stay together. Keep split-header halves intact and define an explicit oversized-header behavior; add a boundary test using the contract’s maximum contact count and length.

Verdict: FAIL

Operator note: fixed test-first under DD-TPL-19. L-16 pins the PG-09 fallback (ADR-010 §10) at the contract maximum, and ADR-054 now states it. The probe for that test also found that a header half was given a continuation page's room instead of page 1's, so a half that fit page 1 was cut into rows and got a false hint. L-17 covers that and `paginate.ts` fixes it. Red `e9b1152`, green `1b3f580`.

## D1 — delta, `git diff dc9b004..5a4fe4a` (frontend, ADR-054, package)

Reviewer output, verbatim:

- **Minor** — [t4-layout.test.ts](/home/dmytro/git/work/resumiser/frontend/src/entities/layout/t4-layout.test.ts:282). With 20 contacts of 200 characters at Large spacing, L-16 checks that the name and headline do not appear on later pages, but never checks that they appear on page 1. A regression that drops either header line in this boundary case could pass. Assert that both lines are present on page 1.

The R1 fix uses page 1’s remaining room for a leading header half and applies the documented PG-09 fallback when it exceeds that room. The contract limits match L-16’s contact count and length. The recorded red run fails on L-17’s assertion, and the green results report the frontend and rendering checks passing. I found no blocker, critical, or major finding. I did not rerun tests.

Verdict: PASS

Operator note: I applied the Minor finding after the verdict. It is test-only and makes the test stricter. L-16 now also asserts that the name and headline are on page 1, and its fixture gets a name and a headline, because `documentOf` has none. `npx vitest run src/entities/` gives 20 files, 239 passed; `tsc` and `eslint` are clean. Minor findings do not earn a delta (AGENT-WORKFLOW step 6), so the external review closes at D1.
