# P06 Code Review — Identity & Accounts

Verdict: FAIL

- Reviewer: Code Reviewer (Claude Sonnet, Orca worker), 2026-11-04. One pass (ADR-035 B-2); a re-review covers only the files changed after this report.
- Target: `git diff main...HEAD` of `phase/P06` at `ac4d928` (52 files, +4638/−50): backend account/auth/session/CSRF/deletion/export/outbox, frontend account UI, backend/frontend/E2E tests, P06 docs.
- Inputs read: `CLAUDE.md`, `.claude/rules/*`, `PHASE.md`, `kickoff.md`, `acceptance-criteria.md`, `decisions.md`, `architecture/phase-plan.md`, `tests/test-results.md`, ADR-036, ADR-039, `contracts/openapi/openapi.yaml`.
- Summary: no blocker or critical finding. The authorization, cookie/CSRF, hashing, token, outbox-encryption, ledger-order and contract controls are implemented as specified. The verdict is FAIL because five **major** findings are open: deletion can be starved by an e-mail failure and fails silently (M-1), unauthenticated token redemption scans a collection (M-2), the common-password control is nominal (M-3), the UI mishandles contract password errors and drops a still-valid reset token (M-4), and the Must "user isolation" criterion has no two-account test (M-5). All five are small, local fixes.

Severity scale: blocker (cannot ship, security/data loss) · critical (must fix before gate) · major (fix or approved exception before gate) · minor (fix in phase or record) · nit.

## Findings

### Major

**M-1 — Account purge is gated on a deletion e-mail and every failure is swallowed** — `backend/src/ResumeBuilder.Infrastructure/AccountDeletion.cs:63`, `:70`, `:87`, `:103`
- Impact: the processor calls `email.SendAsync(...)` between the ledger write and the purge, in the same try block. If SMTP is down or unconfigured (`SmtpAccountEmailSink` throws `SMTP configuration is missing`), `pending = true` and the account is never erased: FR-ACC-03 / ADR-039 §2's 24 h bound and NFR-09 erasure are silently missed. Every 15-minute retry re-sends the e-mail (duplicate notices) once SMTP recovers only partway. Both `catch` blocks (`:70`, `:87`) and the worker (`:87`, `:103`) swallow the exception with no log, metric or alert, so the SLA breach is invisible.
- Required fix: treat the confirmation e-mail as best-effort or route it through the outbox (enqueue before purge, never block erasure on delivery). Emit a content-free log event (event/code/count only, via the existing `SafeLogs` allow-list) when a purge stays pending. Keep ledger-before-purge order. Add a processor test where the sink throws and the account is still purged.

**M-2 — Token redemption filters on an unindexed field on unauthenticated endpoints** — `backend/src/ResumeBuilder.Infrastructure/MongoAccountStore.cs:37-38`, `:99`
- Impact: `TryConsumeAsync` queries `TokenHash`, but the only `account_tokens` indexes are `(AccountId, Purpose)` and the TTL on `ExpiresAt`. `verifyEmail` and `confirmPasswordReset` take no per-endpoint rate limit (only the 600/min/IP global limiter), so each request is a collection scan whose cost grows with the user base — an availability amplifier. The ADR-036 §6 / AC-P06-06 "constant-time comparison" is realised as a database equality match on a SHA-256 digest; that is acceptable for a 256-bit random token only if it is an indexed lookup, and the deviation from the literal wording is not recorded.
- Required fix: add an index on `TokenHash` (unique or sparse), covered by the real-Mongo test. Record the "indexed digest lookup, not in-process constant-time compare" interpretation in `decisions.md`, or compare the stored digest with `CryptographicOperations.FixedTimeEquals` after an indexed fetch.

**M-3 — The "bundled common-password list" has seven entries** — `backend/src/ResumeBuilder.Domain/Accounts/PasswordPolicy.cs:7`
- Impact: ADR-036 §2, FR-ACC-01 and AC-P06-01 require rejecting passwords on a bundled common list. `password123, 1234567890, qwerty12345, letmein123, iloveyou123, admin12345, welcome123` accepts, for example, `password1234`, `1234567890a` and `qwertyuiop`. The control passes its tests but does not do its job (NFR-08).
- Required fix: bundle a real list (e.g. top 10–100k from a public breach corpus, filtered to ≥10 characters, case-insensitive, as an embedded resource with source/licence noted) and keep `PasswordPolicy.Validate` order (`too_short`, `too_long`, `too_common`). Add a test for several non-seed entries.

**M-4 — The UI cannot show contract password errors and discards a valid reset token on a policy error** — `frontend/src/shared/api/client.ts:71-73`, `frontend/src/features/account/Account.tsx:184`
- Impact: the API returns `code: "validation_failed"` with `errors[].code = password_too_short | password_too_long | password_too_common` (correct per OpenAPI; see `AccountEndpoints.cs:65-77`). `problemMessage` switches on the top-level `problem.code` only, so those three branches never match; a common password or any server 400 shows "Something went wrong" instead of the actionable message (AC-P06-13 recoverable errors). On reset-confirm, the server validates the password *before* consuming the token, so a policy error leaves the token valid, but `finally { clear(); }` drops it from component state and the next submit reports "This link is invalid or expired", forcing a new reset e-mail. Existing RTL tests only cover a bare `validation_failed` response, which is why this passes.
- Required fix: map `error.problem.errors[]` codes (and field pointer) to field-level messages; keep the token when the failure is a 400 validation error and clear it only on `token_invalid` or success. Add RTL cases for a `password_too_common` response on sign-up and reset-confirm.

**M-5 — No two-account isolation test (Must criterion without a negative case)** — `backend/tests/ResumeBuilder.Api.Tests/*` (absent); `docs/phases/P06/tests/test-plan.md` L03-N ("B cookie cannot read A data")
- Impact: PHASE.md DoD names "user isolation", and AC-P06-06/09 require non-owner data to be absent. The code is structurally sound (`Current()` derives the account from the session, `AccountEndpoints.cs:110-118`; export keys on `current.Account.Id`, `:258-259`), but no test signs up user B and proves B's cookie cannot reach A's session/export/deletion. A regression, for example taking an account id from the request, would pass the suite. A mandatory negative test is missing.
- Required fix (Test Engineer, separate step per ownership rules): add an A/B fixture test for `getSession`, `exportAccountData`, `requestAccountDeletion` and `changePassword` with two cookie jars; add one with a swapped/replayed session cookie after logout.

### Minor

**m-1 — Sign-up for an existing address sends nothing; creation and no-op paths differ in work** — `AccountUseCases.cs:53`, `:65`, `:91`
ADR-036 §8 / ADR-034 say an existing address receives an "account already exists" e-mail; the implementation silently does nothing, so the address owner is never warned. The new-account path also does two extra Mongo writes (token upsert + outbox insert) that the existing/unknown path skips, a small measurable timing difference on sign-up, resend and reset-request (ADR-036 §8 "roughly the same time"; the test plan left this to reviewer inspection). Per-address and per-IP limits (5/hour, 5/10 min) bound statistical attacks. Fix: enqueue a neutral "account exists / ignore this request" message and/or equalise work; record any accepted gap as a residual risk.

**m-2 — Outbox: head-of-line retry and key-loss fragility** — `AccountEmailDispatcher.cs:22-26`, `MongoAccountStore.cs:159`, `:166`, `Program.cs:25-26`
A failing message releases its claim and rethrows, aborting the loop; with no attempt counter, back-off or dead-letter, a permanently bad recipient is retried forever and delays later mail. `DecodeOutbox` runs `Unprotect` after the claim is taken, so an undecryptable body (key ring lost or rotated) throws from `TryClaimNextAsync` for every pass. `Accounts:DataProtection:KeyDirectory` is optional with no startup guard in Production, so an ephemeral key ring silently invalidates all sessions and pending mail on restart (README acknowledges the deployment dependency). Fix: attempt count + next-attempt time, per-message try/catch, fail startup in Production without a configured key ring or record it as a P15 gate item.

**m-3 — In-process rate counter is per-instance, unbounded and O(n) per call; IP identity depends on proxy configuration** — `AccountEndpoints.cs:263-271`, `Program.cs:92-100`
`AccountRateCounter.Allow` scans the whole dictionary on every call and keys grow with distinct IPs/accounts within the hour. State is not shared across Container Apps replicas, so `auth-login`, `auth-email-ip` and `data-export` limits multiply with the replica count (only per-address e-mail and login back-off counters are in Mongo). `Program.cs` honours `X-Forwarded-For` only for `ReverseProxy:TrustedProxies`; with that unset behind an ingress, every client shares one IP bucket (5 sign-up/reset per 10 min for everyone). Fix: bound/evict by time bucket, document the required proxy configuration for deployment, and consider moving the IP counters to the Mongo counter store.

**m-4 — `Referrer-Policy: no-referrer` is not sent as a header** — `frontend/src/features/account/Account.tsx:100-108`
ADR-036 §7 and the plan require the verification/reset pages to send the header. P06 only injects a `<meta name="referrer">` at runtime and never removes it, so it becomes app-wide after the first visit. The URL fragment is never sent in `Referer`, so exposure is low, but the stated control is absent. Fix: ship the header from the web server/CDN config (outside P06 allowed paths) and record it as a P15/P03 hand-off item.

**m-5 — Password reset/change leave other reset tokens valid and are not atomic** — `AccountUseCases.cs:93-102`, `:117-123`
A reset token requested before a password change (or a second token of the other purpose) stays usable until expiry; a mailbox compromise could still reset after the owner changed their password. The consume → set hash → verify → revoke sequence has no failure handling: if revocation fails after the hash is set, old sessions remain. Fix: delete outstanding tokens for the account when the password changes; run revoke before returning success and retry/propagate its failure.

**m-6 — Insecure-cookie switch applies to every non-Production environment** — `Program.cs:27`, `AccountEndpoints.cs:107`
`Accounts:AllowInsecureCookies=true` disables `Secure` in Staging/QA as well as tests. Browsers reject non-Secure `__Host-` cookies anyway, so it only helps test hosts. Fix: honour it only in `Development`/`Testing` (or fail startup elsewhere).

**m-7 — Deletion worker has no lease and can starve** — `AccountDeletion.cs:56`
`ListDeletionDueAsync` takes 100 accounts unordered. A permanently failing batch (see M-1) can starve later requests, and multiple replicas process the same accounts concurrently. The dual ledger and deletes are idempotent, so this is not data-unsafe, but the 24 h bound is. Fix: order by `DeletionRequestedAt`, add per-account attempt/lease or skip-and-continue with a backlog metric.

**m-8 — A P04 inventory guard was relaxed** — `backend/tests/ResumeBuilder.Api.Tests/InProcessContractTests.cs`
`Assert.Equal(2, actual.Count)` became two `Assert.Contains`, and the "no security" assertion now applies only to `/api/v1/health/*`. The change was necessary once P06 routes exist, was made by the Test Engineer (not a developer) and is recorded in the coordinator log, so it is not a weakening finding. It does leave the host with no assertion that only the 12 approved P06 operations (plus health) are mapped (AC-P06-09 "no extra endpoint"); `P06ContractTests` checks the YAML, not the host route table. Fix: assert the host's operation inventory equals the health subset plus the 12 P06 operations.

**m-9 — Accessibility details for QA to confirm** — `frontend/src/shared/ui/index.tsx:39`, `:47`
`StatusNotice` mounts with its text already present (`role=status`/`alert`), which many screen readers do not announce; use a persistent live region whose content changes. The password reveal control combines `aria-pressed` with a changing label ("Hide characters" while pressed), which announces a double state; pick one. Structure otherwise meets the brief: labelled fields with `aria-invalid`/`aria-describedby`, focus to the first invalid field and to the page `h1`, native modal `<dialog>` with `aria-labelledby`, Escape handling blocked while busy, initial focus on Cancel (no destructive default), opener focus restored, `prefers-reduced-motion` rule and a 3 px `:focus-visible` outline in `shell.css`. Contrast, 200 % zoom and screen-reader behaviour were not exercised here and belong in the QA manual pass.

**m-10 — Test coverage that exists only for code shape, not behaviour** — tests
(a) No test drives the real cookie middleware through sliding renewal or the 30-day absolute limit (ticket-store logic is in `AccountCookieTicketStore.cs:38-46`; only static `AddDays` values appear in unit tests). (b) `MongoAccountSecurityCounters` back-off/Mongo atomicity is not tested against real Mongo; HTTP fixtures swap in `MemoryAccountSecurityCounters`. (c) The purge itself (sessions/tokens/outbox removed, account deleted after ledger) is exercised against in-memory stores and a fake ledger; only the ledger has a real Mongo + Azurite test. (d) E2E (`tests/e2e/account.spec.ts`) mocks `/api/v1/**` with `page.route`; no browser journey runs against the real backend yet (coordinator log lists this for QA). Add the missing real-store cases in QA/Test Engineer follow-up or record them in the gate as evidence gaps.

### Nit

- `AccountEmailDispatcher.cs:13` uses the human `Subject` string as the template discriminator; add a message-kind field. E-mail bodies are bare URLs with no explanatory text.
- `MemoryAccountSecurityCounters` (test double) ships in the production Infrastructure assembly and is loaded by reflection in tests; move it to the test project when convenient.
- `IAccountUseCases.GetAccountForExportAsync` is unused by the export endpoint (it reads the account from the session instead).

## Requested verifications

| Area | Result | Evidence |
|---|---|---|
| Owner authorization on account / delete / export | **Pass.** Account id is derived only from the server session (`Current()`, `AccountEndpoints.cs:110-118`); deleted/pending accounts return null. Delete, changePassword, reauthenticate and export all require a current session; export additionally verified e-mail, ≤5-minute re-auth and the per-user `data-export` limit. Test gap: M-5. | `AccountEndpoints.cs:233-260` |
| No secrets/PII/tokens in logs | **Pass with note.** `Program.cs:17-20` sets minimum level None except the `ResumeBuilder.Api` allow-list (`SafeLogs`: event, code, trace id, route template, status, elapsed). Account code never logs; Problem details carry pointer/code only; a fixture asserts no secret/address in captured logs. The no-logging side is also why M-1 is invisible. | `Program.cs:158-168`, `P06FixtureTests.P06SignupNeverLogsSubmittedSecretsOrAddress` |
| ADR-036 cookie/session | **Pass.** `__Host-rb_session`, `Secure` (Always unless the test switch), `HttpOnly`, `SameSite=Strict`, `Path=/`; 14 d sliding (`ExpireTimeSpan`, ticket `Renew` capped at the 30 d `AbsoluteExpiresAt`); server-side revocable sessions with TTL; session id rotated at login (old session revoked, new one created, CSRF reissued); logout/change/reset/delete revoke. See m-6, m-10(a). | `Program.cs:30-48`, `AccountCookieTicketStore.cs`, `AccountUseCases.cs:68-84` |
| CSRF | **Pass.** Every unsafe operation, anonymous ones included, requires one `X-XSRF-TOKEN` validated by ASP.NET antiforgery (`__Host-rb_csrf` HttpOnly cookie + readable `XSRF-TOKEN`); 403 `csrf_token_invalid`; JSON content type enforced (415); body capped at 16 KB (413); token reissued at login/logout/change. | `AccountEndpoints.cs:45-63` |
| Password hashing | **Pass.** `PasswordHasher<AccountRecord>` V3, PBKDF2-HMAC-SHA512, 210 000 iterations, `SuccessRehashNeeded` upgrades on login; unknown/deleting accounts verify against a dummy hash. Real-Mongo test asserts format marker 1, PRF 2 and ≥210 000. See M-3 for the policy list. | `AccountInfrastructure.cs:11-20`, `P06PersistenceTests` |
| Token hashing / single use | **Pass with M-2.** 32 random bytes base64url, only SHA-256 stored (test asserts no plaintext in `account_tokens`/`account_outbox`), one active token per (account, purpose) replaced on request, atomic `FindOneAndUpdate` consume with expiry and `UsedAt`; a 16-way concurrent test yields exactly one winner; 24 h / 1 h lifetimes; reset also verifies the address and revokes all sessions. | `AccountUseCases.cs:36-46`, `MongoAccountStore.cs:86-105` |
| Outbox encryption | **Pass.** Body protected with Data Protection purpose `account-outbox-v1`, cleared on send, sent rows TTL 7 d, removed on account purge. See m-2 for key-ring operations. | `MongoAccountStore.cs:147-180` |
| Deletion ledger before purge | **Pass.** `RecordAccountAsync` (Mongo `deletion_ledger` upsert, then private Blob create-if-absent) precedes the confirmation e-mail and every destructive step; account row is deleted last, so a restart resumes; ledger holds only id and timestamp, TTL 35 d as ADR-039. Request marks the account, revokes all sessions and blocks login immediately. See M-1, m-7. | `AccountDeletion.cs:19-74` |
| Generic anti-enumeration | **Pass with gaps.** Sign-up, resend and reset-request return the same 202 for any valid address, never open a session, and apply address-keyed limits independent of existence; login failures are one `invalid_credentials`/429 with dummy-hash timing; errors never echo input. Gaps: m-1. | `AccountEndpoints.cs:145-216` |
| Contract conformance | **Pass.** `git diff main...HEAD -- contracts` is empty (OpenAPI 1.0.0 frozen). Exactly the 12 `x-phase: P06` operations at the contract paths/methods, including `PUT /account/password` (204/400/401/403/413/415/429) and `DELETE /account` (202); statuses and Problem codes (`csrf_token_invalid`, `token_invalid`, `invalid_credentials`, `reauthentication_required/failed`, `email_not_verified`, `unauthenticated`) match; export validates against `AccountDataExport` with `Cache-Control: no-store`; no Google/guest/OAuth endpoint. | `AccountEndpoints.cs:19-30`, `P06ContractTests`, contract lines 516-600 |
| Scope vs allowed paths | **Pass.** Every changed file is under the `phase-plan.md` allowed list (checked with a path filter over `git diff main...HEAD --name-only`; zero violations). Developer commits touched no test or contract file except a regenerated `packages.lock.json`; `contracts/`, `docs/source/` and `.claude/` are untouched. | commands below |
| No weakened tests | **Pass.** Post-red test changes were Test Engineer one-shots on escalation (CSRF-first sign-up row 202→403, password codes aligned to the contract catalogue, `SessionInfo.user` contract shape, memory-store fixtures, P04 inventory update — m-8). No assertion was removed from a P06 test, no skip/fixme introduced. | `git diff 3c3a9f1 46ba4cd` |
| Accessibility of forms and dialogs | **Mostly pass; see M-4, m-9.** Labels, error association, focus management, native modal dialog, safe `returnTo` allow-list. | `shared/ui/index.tsx`, `Account.tsx`, `AccountSettings.tsx` |
| Deferred and out-of-scope items | Google sign-in absent (ADR-014); claim UI is a prompt-only seam (`ClaimDraft`, explicit Save/Discard/Later); P07/P13 purge/export obligations are recorded in ADR-039 and the plan. | `Account.tsx:206-216` |

## Commands run

| Command (repo root unless noted) | Exit | Result |
|---|---:|---|
| `git diff main...HEAD --stat` / `--name-only` filtered by the allowed-path regex | 0 | 52 files; zero paths outside the allowed list; `git diff main...HEAD -- contracts` empty. |
| `git status --short` (before and after the runs below) | 0 | Clean; no files changed by this review besides this report. |
| `npm test --prefix frontend -- --run` | 0 | 6 files, 40/40 passed. |
| `npm run lint --prefix frontend` | 0 | ESLint clean. |
| `npm run typecheck --prefix frontend` | 0 | `tsc --noEmit` clean. |
| `dotnet test backend/tests/ResumeBuilder.Api.Tests/ResumeBuilder.Api.Tests.csproj -c Release --filter 'FullyQualifiedName~P06FixtureTests\|FullyQualifiedName~P06UnitTests\|FullyQualifiedName~P06AccountTests\|FullyQualifiedName~P06ContractTests'` | 0 | 37/37 passed (in-memory fixtures; no Docker). |
| Not rerun by the reviewer | — | Docker-backed `P06PersistenceTests`/`P06DeferredPersistenceTests`, the Playwright suite and `phase-handoff-check.py --gate` (heavy, one-at-a-time rule). The coordinator's integrated `bash docs/phases/P06/tests/suite.cmd` exit 0 (Architecture 11/11, Toolchain 3/3, Api 75/75, Frontend 40/40, E2E 120/120, contract suite) in `tests/test-results.md` is taken as recorded evidence, not independently reproduced. |

## Conditions to flip the verdict to PASS

1. Fix M-1…M-4 (Backend Developer: M-1, M-2, M-3; Frontend Developer: M-4) with the stated tests, and M-5 (Test Engineer: add the A/B isolation tests; developers must not edit tests). Alternatively record an approved exception per `PHASE-GATES.md` for any item the coordinator accepts.
2. Re-review scope: `AccountDeletion.cs`, `MongoAccountStore.cs`, `PasswordPolicy.cs`, `client.ts`, `Account.tsx` and the new/changed tests only.
3. Minor findings m-1…m-10 may be fixed in the same loop or listed as residual risks and deferred items in the gate report (m-4 and m-3's proxy configuration belong to P15/P03 owners; m-10(d) belongs to the QA live-backend pass).

Next owner after fixes: Backend Developer / Frontend Developer / Test Engineer via the coordinator, then QA / Acceptance Agent.

---

# P06 Code Review — external pass 2 (ADR-051 S-3)

Verdict: FAIL (superseded by the delta re-review below)

- Reviewer: Codex (`codex exec --sandbox read-only`, different vendor from the implementation), 2026-11-04,
  driven by `.claude/review-prompt.md`. Target: `git diff main...HEAD` of `phase/P06` at `2d6cba6`.
- Note on the documented command: `codex review --base main "<prompt>"` is rejected by Codex CLI 0.166.0
  (`the argument '--base <BRANCH>' cannot be used with '[PROMPT]'`). The review was run as
  `codex exec --sandbox read-only --cd <repo> -` with the project checklist plus the diff range on stdin.
  `docs/blueprint/AGENT-WORKFLOW.md`, `/review-phase` and `/phase` were corrected to the working form.

## Findings

**Major — `AccountEmailDispatcher.cs:22` — a permanently rejected message blocks the mail queue.**
A message the sink rejects released its claim and rethrew, ending the dispatch pass. `TryClaimNextAsync`
claimed without ordering, attempt limits or backoff, so the same message was immediately eligible again and
could keep verification and reset mail behind it from ever being delivered.

*Fixed.* `AccountOutboxRecord` now carries `Attempts` and `NextAttemptAt`; `AccountOutboxPolicy` sets an
exponential backoff and a 30-day quarantine after 5 attempts; `TryClaimNextAsync` claims oldest-first and
skips messages whose backoff has not elapsed; the dispatcher reschedules a failed message and continues
instead of rethrowing, then logs counts only. Red proven first.

**Major — `MongoAccountStore.cs:82` — the deletion backlog was one unordered batch.**
`ListDeletionDueAsync` took 100 due accounts with no ordering, and the processor ran exactly one batch. A
batch that keeps failing a purge step stays due and could be re-selected on every run, so accounts behind it
could miss the FR-ACC-03 24-hour bound.

*Fixed.* The due list is ordered by `DeletionRequestedAt` ascending in both the Mongo adapter and the test
fakes, and the processor pages through the whole backlog in one run, tracking the accounts it has already
attempted, so a failing batch no longer starves the accounts behind it. Red proven first.

**Info — `tests/test-results.md:146` — visual and manual accessibility evidence was missing** for
AC-P06-12/13. *Closed:* the acceptance pass below records it, and `qa-report.md` carries the verdicts.

The reviewer also reported: "Test results document assertion-based red runs followed by green runs with exact
commands. I found no test weakening or skipped P06 tests in the reviewed diff. I did not run tests."

## Operator findings from the acceptance pass (not reported by either reviewer)

**Major — focus was lost to `<body>` after a rejected submit** — `frontend/src/features/account/forms.ts`.
The submit button is disabled while the request runs, so the browser moved focus to `<body>`; on failure
nothing put it back. A keyboard or screen-reader user had to traverse the page again after every rejected
sign-up, login, reset or password change. The design brief requires focus on the first invalid field after a
failed submit, and AC-P06-13 requires visible focus. Client-side validation already did this; only the
server-rejection path was missing it.

*Fixed.* `useSubmission` focuses the field named in the server's `errors[]` pointer, or the announced error
notice when no single field is at fault. The error notice is focusable and has a 3 px focus ring under
`:focus`, because `:focus-visible` does not fire for programmatic focus on a non-interactive element. Red
proven with two RTL cases before the fix.


---

# P06 Code Review — delta re-review (ADR-051 S-3, the one allowed delta)

Verdict: PASS

- Reviewer: Codex (`codex exec --sandbox read-only`), 2026-11-04. Scope: `git diff 2d6cba6..HEAD`, the files
  changed since pass 2, excluding the `qa-evidence/*.png` captures.

The reviewer confirmed: "The two previous majors are fixed in this delta. The deletion processor advances past
failed accounts and terminates when no unattempted due account remains. Mail failures are rescheduled,
allowing later messages to proceed. The Mongo claim filter and decoder also handle documents missing the new
retry fields. The new changes stay within P06's allowed paths; I found no contract or privacy issue."

## Finding

**Minor — `AccountPorts.cs` outbox policy: the code said "quarantine" but implemented a 30-day delay**, and
the new test advanced only ten hours, so it asserted neither the attempt count nor the behaviour at the
deferral boundary and would not have caught a change to the thresholds.

*Fixed, by making the code say what it does rather than the reverse.* A permanently unroutable address should
still be delivered if the outage ends, and P06 has no operator surface for inspecting or releasing a
dead-letter queue, so a long deferral is the right behaviour — the naming and comment were the defect.
`MaxDeliveryAttempts`/`IsQuarantined` became `FastRetryAttempts`/`IsDeferredLong` with `LongDeferral`
exposed, the documentation states that the message is deferred for 30 days and not abandoned, and it records
that a terminal dead-letter state needs the P15 operator surface. The backoff arithmetic was also corrected
to 1, 2, 4, 8, 16 minutes (it previously started at 2 minutes and repeated 16).

Test coverage was extended to exactly what the reviewer asked for: the attempt count after each failure, that
each wait inside the fast-retry window is under an hour, that the fifth failure yields exactly
`LongDeferral`, and that the message is not claimable one minute before the deferral elapses but is one
minute after. A new real-Mongo case writes an outbox row, strips `Attempts` and `NextAttemptAt` to reproduce
a document written before those fields existed, and proves it is still claimed with `Attempts = 0`, that a
deferral written onto it is honoured on both sides of the boundary, and that claiming is oldest-first.

Verdict: PASS
