# P07 Code Review

External reviewer: Codex CLI 0.166.0 (default model), `codex exec --sandbox read-only` with `.claude/review-prompt.md`, as `docs/blueprint/AGENT-WORKFLOW.md` says. The operator wrote the tests and the code, so the reviewer's first check is test integrity.

## First review (commit `8d13882`, `git diff main...HEAD`)

Findings, verbatim:

```text
- **major — [Library.tsx](/home/dmytro/git/work/resumiser/frontend/src/features/library/Library.tsx:180) and [Library.tsx](/home/dmytro/git/work/resumiser/frontend/src/features/library/Library.tsx:344):** The copy and blank-create flows discard their idempotency key after any `ApiError`, including a 5xx. For example, if the server creates a resume but fails while recording idempotency completion, the request returns 500; retrying generates a new key and can create a duplicate. Preserve the same key and body after errors with an uncertain outcome, such as 5xx responses, and clear it only when the response confirms the operation did not take effect.

The test amendments and recorded red/green evidence show no weakened assertions. I did not run tests during this read-only review.

Verdict: FAIL
```

### Fixed by the operator (commit `ee1deff`)

| Finding | Severity | Fix | Proof |
|---|---|---|---|
| The copy and blank-create flows discard the idempotency key after a 5xx, so a retry could create a duplicate | major | `provesNothingWritten` in `features/library/Library.tsx`: the key and body stay after a network failure, a 5xx or an in-flight 409, and go only when the answer proves nothing was written. The same rule now also covers rename, delete, restore and purge, which the finding did not name but which have the same retry path | Tests first: `F05 keeps the key and body after a 5xx` and `after an in-flight duplicate`, `F05 a card copy keeps its key after a 5xx`, `F09 a retried delete and rename keep their keys after a 5xx` failed red with a differing key, then passed. `F05 uses a new key after a rejection that proves nothing was written` guards the other direction |

The reviewer reported no weakened test and did not run tests in its read-only sandbox. The operator ran them; see `tests/test-results.md`.

## Delta re-review (the one permitted, ADR-051 S-3): the fix in `ee1deff`

Findings, verbatim:

```text
- **major — [Library.tsx](/home/dmytro/git/work/resumiser/frontend/src/features/library/Library.tsx:360):** The key and request body survive an unknown result only while `CreateDialog` stays mounted. If the server creates a resume but returns a 5xx, the user can click **Cancel**, reopen the dialog and submit again; the new dialog generates a new key, so the same create can produce a duplicate. Keep unresolved attempts in state that survives closing and reopening the dialog, or prevent dismissal until the outcome is resolved.

I reviewed only the frontend delta. I did not run tests in this read-only review.

Verdict: FAIL
```

### Fixed by the operator (commit `986fde3`), not yet read by the reviewer

| Finding | Severity | Fix | Proof |
|---|---|---|---|
| The key and body survive an unknown result only while `CreateDialog` stays mounted, so 5xx, Cancel, reopen and submit can duplicate | major | Create and copy attempts now belong to `LibraryPage` through `RetryKeys`, so closing the dialog forgets nothing, and an unknown outcome re-reads the list. Versioned writes (rename, delete, restore, purge) keep their per-dialog key, because `If-Match` already stops a second effect there | Test first: `F05 keeps the key and body when the dialog is closed and reopened after an unknown outcome, and shows the current list` failed red (one list read, expected two), then passed. Frontend 79 of 79 |

## State of the review

**The external reviewer's last verdict is FAIL, and it has not seen the fix above.** The workflow allows one delta and `/close-phase` requires `Verdict: PASS` from the external review, so the operator cannot close this on its own: see DD-P07-29. Known residual, for the reviewer: reloading the page forgets a pending attempt; the list then shows whether the first attempt landed.

## Second delta re-review, authorized by the owner (`git diff 8592ee7..986fde3 -- frontend`)

The owner chose this after the first delta came back FAIL, as a one-off exception to the one-delta cap (DD-P07-30). Findings, verbatim:

```text
No findings. The create attempt’s key and serialized body now live in `LibraryPage`, so closing and reopening the dialog preserves them; unknown outcomes trigger a list refresh. Copy attempts use the same page-owned storage keyed by source resume ID, preserving the same key and body for retries. The delta adds a regression test and does not weaken existing assertions.

I did not run tests. The recorded red/green evidence is in P07’s test results.

Verdict: PASS
```

No finding is open. The two majors above are fixed, and the external reviewer has read both fixes.

Verdict: PASS
