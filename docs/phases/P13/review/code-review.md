# Code Review

## Full review — `git diff main...HEAD` at `254e6e0` (merge base `44168c6`)

Reviewer: Codex CLI, `codex exec --sandbox read-only`, prompt `.claude/review-prompt.md` plus "Review the diff of this branch against main: `git diff main...HEAD`. The phase package is `docs/phases/P13/`." (`docs/blueprint/AGENT-WORKFLOW.md` → "External review"). Run 2026-11-12, after the step 5 commit. The reviewer's answer, verbatim:

**Findings**

- **minor** — [archive.ts](/home/dmytro/git/work/resumiser/frontend/src/features/account/archive.ts:104): `account-data.json` is rebuilt with `JSON.stringify` after the API response has been parsed. That changes the response bytes, and a valid integer above JavaScript’s safe-integer limit can be rounded during parsing. Preserve the raw response body for the ZIP entry and assert byte equality in A01.

- **info** — [test-results.md](/home/dmytro/git/work/resumiser/docs/phases/P13/tests/test-results.md:130): RS01–RS03 have no recorded run or result. Run the step 7 real-stack checks and record the exact command and outcome before treating AC-P13-15 as verified.

No files were modified. I did not run tests.

Verdict: PASS

### Operator notes

- **minor (archive.ts:104), follow-up, not fixed in P13.** `account-data.json` is the parsed response written again with `JSON.stringify(data, null, 2)`, not the response bytes. The integers in `AccountDataExport` are resume versions (a server `long` that grows by one per write), photo dimensions bounded by the contract (≤ 8000) and photo byte sizes bounded by the upload limit; none can reach 2^53 in practice, and the editor parses the same values the same way. So no value changes today: the content is the same JSON value, only the formatting differs. The contract bounds `version` below only, so the reviewer's point holds in principle. DD-P13-12's "the API response as received" means the same JSON value, pretty-printed (clarified in `decisions.md`). Follow-up for the next change to the archive: keep the raw body and assert byte equality in A01, which also removes the reliance on the contract's integer sizes. Under ADR-051 Amendment 2 a minor does not earn a delta.
- **info (test-results.md:130).** RS01–RS03 run at step 7 against the real stack; their command and result are recorded in `qa-report.md` and `tests/test-results.md`.

## Delta 1 — `git diff 254e6e0..b183d9c` (step 7 acceptance fix)

Paths: `backend/src/ResumeBuilder.Api/Program.cs`, `backend/tests/ResumeBuilder.Api.Tests/P13RestoreTests.cs`, `tests/e2e/real-stack/reliability-acceptance.spec.ts`, `docs/phases/P13/tests/test-results.md`, `docs/phases/P13/decisions.md`. Prompt: `.claude/review-prompt.md` plus "Review this delta only … It is a fix to a finding from step 7 acceptance of this branch … plus one added real-stack acceptance test (RS04), after an earlier full review of this branch at 254e6e0 that returned PASS." Run 2026-11-13. The reviewer's answer, verbatim:

**Findings**
- **minor** — [reliability-acceptance.spec.ts](/home/dmytro/git/work/resumiser/tests/e2e/real-stack/reliability-acceptance.spec.ts:177): RS04 claims keyboard-only operation, but `start.focus()` sets focus programmatically. If the button were removed from the Tab order (for example, `tabIndex=-1`), the test could still pass. Tab to the button from a known focus position and assert it receives focus before pressing Enter.
- **minor** — [test-results.md](/home/dmytro/git/work/resumiser/docs/phases/P13/tests/test-results.md:139): RS04 is described as added, but its exact run command, exit code and result are not recorded. Record those results; include the exact invocation for the reported 30 real-stack runs as well.
The host-disposal fix matches the recorded missing-output failure, and D04 now checks the real binary repeatedly. I found no blocker, critical or major findings.
Verdict: PASS

### Operator notes

- **minor (RS04 focuses the button programmatically), follow-up.** The archive button is a native `<button>` (`shared/ui` `Button`) with no `tabIndex` override (`AccountSettings.tsx:190`), so it is in the Tab sequence; the headings around it carry `tabIndex={-1}`, which keeps them out of it. No test reaches it with Tab from a known position; L02 and RS04 both start from `focus()`. Follow-up for the next change to the account page: Tab from the "Your data" heading and assert focus. A minor does not earn a delta (ADR-051 Amendment 2).
- **minor (commands not recorded), done in the step 7 commit.** `tests/test-results.md` "Step 7" now records the exact invocations, exit codes and results of RS01–RS04, the 30 reconciliation runs, the restore drill and the credential-stuffing check; the scripts are in `qa-evidence/`.
