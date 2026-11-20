# Code Review — P11

External reviewer: Codex CLI 0.166.0 (default model), `codex exec --sandbox read-only` with `.claude/review-prompt.md` (ADR-051 S-3, Amendment 2). No Codex worker wrote code in this phase. The operator's notes are below each reviewer's text, and the operator writes no verdict line.

## Full review — `git diff main...2b7e501`

- **major — Privacy:** [ClientEventEndpoints.cs](/home/dmytro/git/work/resumiser/backend/src/ResumeBuilder.Api/ClientEventEndpoints.cs:24), [line 54](/home/dmytro/git/work/resumiser/backend/src/ResumeBuilder.Api/ClientEventEndpoints.cs:54). A signed-in client can submit resume text in `code` or `engineVersion` using characters their permissive patterns accept; the endpoint then writes those values to logs. This violates the no-resume-content-in-logs rule. Restrict logged values to approved machine codes and canonical engine versions, or otherwise sanitize them before logging.

- **minor — Test integrity:** [client-events.test.ts](/home/dmytro/git/work/resumiser/frontend/src/shared/api/client-events.test.ts:29). H02 claims one report per kind, but sends the same `preview_failed` type with a different code and expects a second report. The implementation deduplicates by type, code, and resume ID, so repeated failures of one type with varying codes can send multiple reports per page load. Deduplicate by event type and update the test to check that a different type still sends.

Verdict: FAIL

**Operator's notes.** Major fixed test-first: Ce12 was red, and it now holds. The contract's patterns stay, so an event with an unlisted code is still accepted with a 202. It logs `other` for any code outside the list of codes this product sends, and for any engine version that is not three numbers. DD-P11-14 said a forged event cannot carry content, which this finding disproved, so that entry is corrected.

Minor (H02), recorded as a follow-up with no change: a kind here is type plus code, and that is deliberate. A font failure and a later layout failure are different faults and both are worth one line. The codes are a short fixed list on the client, so the volume stays bounded, and the server limit of 30 per minute holds regardless.

## Delta 1 — `git diff 2b7e501..2a2ff87`, excluding `qa-evidence`

- **major — Privacy:** [ClientEventEndpoints.cs](/home/dmytro/git/work/resumiser/backend/src/ResumeBuilder.Api/ClientEventEndpoints.cs:64). A signed-in client can submit `engineVersion: "123.456.789"`; it passes `ClientEventLoggedEngine` and is written to the log unchanged. If that value is resume content, it reaches telemetry despite the no-content-in-logs rule. Log only a known engine version (or map unrecognized versions to `other`), and add a test for a numeric value that matches the pattern.

Verdict: FAIL

**Operator's notes.** Fixed test-first, and the class rather than the instance. Ce13 and Ce14 were red. An engine version now logs only if it is on a closed list of shipped versions. The same reasoning applies to the resume ID, since a well-formed UUID can hold 16 chosen bytes, so it logs only if the caller owns that resume. The ownership check costs one read per event, under the 30 per minute limit.

## Delta 2 — `git diff 2a2ff87..2c54775`

- **info — Test evidence:** [test-results.md](/home/dmytro/git/work/resumiser/docs/phases/P11/tests/test-results.md:106). The Delta 1 red record gives only a `--filter` fragment and pass/fail counts, without the full command or exit code. A reviewer rerunning from the repo cannot reproduce or confirm that the new tests failed on the intended assertions. Record the exact `dotnet test` command, exit code, and failure reason.

I found no blocker, critical, or major issue in the requested delta. No `Codex-Task:` commits were present. `git diff --check` passed; I did not run tests.

Verdict: PASS

**Operator's notes.** Info: the exact commands are now in `tests/test-results.md`. No code changed after this review; only records did.

## Delta 3 — `git diff 2c54775..98d0339`

No findings in the requested delta. The code change only renames a local variable to satisfy the architecture guard; the records add the exact commands and outcomes requested by the prior review. No `Codex-Task:` commits were present. `git diff --check` passed.

Verdict: PASS

**Operator's notes.** The first gate run found the guard failure this delta fixes. No code changed after this review, and three deltas is the ceiling (ADR-051 Amendment 2).
