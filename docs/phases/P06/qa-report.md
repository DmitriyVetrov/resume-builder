# P06 QA / Acceptance Report — Identity & Accounts

Verdict: PASS

- Run by the operator session (ADR-051: planning, tests, implementation and acceptance are one actor; the
  independent check is the external Codex review in `review/code-review.md`), 2026-11-04.
- Branch `phase/P06`. Backend, contract and component evidence come from `tests/suite.cmd`; the visual,
  keyboard and accessibility observations come from a real browser run described under "Environment".

## Environment

| Part | What ran |
|---|---|
| Suite | `bash docs/phases/P06/tests/suite.cmd` from the repo root — backend CI (Architecture, Toolchain, Api incl. real Mongo and Azurite containers), frontend (lint, typecheck, Vitest), Playwright E2E across Chromium/Firefox/WebKit, the contract suite and `ContractReader`. Exit codes in `tests/test-results.md`. |
| Browser pass | The built frontend (`npm run build --prefix frontend`) served together with synthetic, contract-shaped API fixtures from a throwaway host on `127.0.0.1:4180`, driven by Playwright (Chromium 141) from scripts kept outside the repository. AC-P06-12 specifies local synthetic-state evidence, so fixtures rather than a live backend are the specified method. |
| Screenshots | `qa-evidence/` — login idle at 1280/1024/390, sign-up at 1280/1024/390, settings at 1280/1024/390, login error, sign-up password error, verification success and failure, delete dialog at 1280 and 390, settings at 200% zoom. No real contact data, token fragment or export body appears in any capture. |

The synthetic host returns RFC 9457 `application/problem+json` with the contract's issue shape
(`location`, `pointer`, `code`). An earlier run of this pass used `application/json` without `location` and
made the UI look as if review finding M-4 had not been fixed; that was a fault in the fixture, not the
product, and the client's stricter parsing is correct per the contract.

## Acceptance matrix

| ID | Verdict | Evidence |
|---|---|---|
| AC-P06-01 | PASS | Api suite: sign-up returns a bodyless 202 for a new and for an existing address with identical bodies, creates one unverified account, queues verification mail and opens no session; an existing address now also receives a neutral "account already exists" notice with no token or link. Password bounds and the common-password list return contract codes without echoing input; the list is the upstream breach corpus (96,441 entries) with case/affix/sequence normalisation (DD-P06-16). |
| AC-P06-02 | PASS | Api suite: single-use verification within 24 h, `GET /session` then reports `emailVerified: true`; invalid, expired, reused and superseded tokens give 400 `token_invalid` with no account change; resend is a generic 202. Browser: `/verify-email#t=…` clears the fragment (observed `location.hash` empty) and shows "Email verified. You can log in."; an invalid token shows a recoverable message with a resend path. |
| AC-P06-03 | PASS | Api suite: unverified login succeeds with a rotated opaque cookie, own-session read and logout; the protected request afterwards is 401. Unknown address, wrong password and backed-off login share generic semantics; unverified export is 403 `email_not_verified`; anonymous `GET /session` is 200 with `authenticated: false`. |
| AC-P06-04 | PASS | Api suite: one-hour reset token through the local sink, generic 202, confirm changes the password, verifies the address and revokes every session; wrong/expired/reused tokens give `token_invalid`; old credentials and sessions fail. A reset token issued before a password change is now invalidated by that change (review m-5). |
| AC-P06-05 | PASS | Api suite: re-authentication then `changePassword` within five minutes succeeds, clears the cookie and revokes all sessions; wrong password gives 403 `reauthentication_failed`, missing or stale re-auth gives 401 `reauthentication_required`. Browser: both sensitive actions open a native modal re-auth dialog ("Re-authenticate to change password", "Re-authenticate to export") with initial focus on Cancel and focus returned to the trigger on Escape. |
| AC-P06-06 | PASS with a recorded interpretation | Api suite: CSRF required on unsafe requests including anonymous POSTs (403 otherwise), cookie attributes, `no-store` on session and export, 429 with `Retry-After`, PBKDF2-HMAC-SHA512 at 210,000 iterations, digest-only token persistence, and a fixture asserting no password, token or address in captured logs. Token comparison is an indexed digest match rather than an in-process constant-time compare; that deviation from the literal ADR-036 §6 wording is recorded and argued in DD-P06-16, and the missing `TokenHash` index that made lookup time grow with the collection is fixed. |
| AC-P06-07 | PASS | Api suite: deletion with fresh re-auth returns 202, blocks login and revokes sessions at once; a controlled clock run purges account, token, session and outbox data with Mongo and private Blob ledger entries written before any destructive step; a failed ledger write prevents deletion and a restarted run resumes. Erasure is no longer blocked by a failing confirmation e-mail (M-1), a pending purge is reported through content-free counters, the due list is ordered oldest-first and the processor pages through the whole backlog so a failing batch cannot starve later accounts (external review, major). P07/P13 aggregate purge and restore obligations are listed under "Deferred" below. |
| AC-P06-08 | PASS | Api suite: one owner-scoped `AccountDataExport` with `Cache-Control: no-store` containing only the caller's account fields and the contracted empty resume list; anonymous, unverified and stale re-auth callers get the contracted 401/403; the A/B isolation tests prove another account's data never appears. Browser: the control is labelled "Export account data (JSON)" and is disabled with an explanatory message plus a resend link while the address is unverified. |
| AC-P06-09 | PASS | Contract suite and `P06ContractTests`: exactly the twelve `x-phase: P06` operations at the contracted paths and methods, with the contracted statuses, media types, Problem codes and security metadata; `git diff main...HEAD -- contracts` is empty. The host route inventory asserts the two health plus twelve P06 operations and nothing else. Authentication precedes every owner-scoped read. |
| AC-P06-10 | PASS | Browser at 390 px: no horizontal page overflow on `/login`, `/sign-up` or `/account` (`scrollWidth == clientWidth == 390`), 16 px main padding, 16 px body text, single column, primary submit spanning the form column. Keyboard-only tab order on `/login`: email → password → reveal → Log in → Forgot your login? → Create account → skip link → brand → nav. Every form field has a programmatic label; errors are announced and recoverable. The claim prompt renders only with a draft summary, offers Save / Discard / Later with no silent upload, and shows no claim action without a draft. |
| AC-P06-11 | PASS | Browser negative scan of `/login`, `/sign-up` and `/account`: none of "google", "sign in with", "oauth", "captcha" appears; no external stylesheet, script or image is requested; the font stack is `system-ui, sans-serif`. ADR-014 and the deferred scope are recorded in `decisions.md` (DD-P06-02). |
| AC-P06-12 | PASS | Browser measurements against `architecture/ui-ux-design.md`: at 1280 px the auth canvas is 1120 px with the decorative region at 493 px (44%) and the form column capped at 480 px; settings uses a 220 px section nav and a 720 px content column, both exact. At 1024 px two auth columns are retained with a 555 px form region, above the 400 px floor the brief sets. At 390 px the decorative region is hidden, the settings nav becomes a wrapping semantic list with `aria-current="location"` on the active item, and the delete dialog is 352 px wide inside a 390 px viewport. At 200% zoom on a 1280 px viewport there is no horizontal overflow and all four account actions stay visible inside the viewport. Negative checks as for AC-P06-11: no wizard, score, publish, import or paywall affordance. One cosmetic deviation is listed below. |
| AC-P06-13 | PASS | Contrast measured on the actual rendered surfaces: h1 13.92:1, body text 14.94:1, primary button 7.27:1, danger button 6.75:1, section nav item 6.38:1, badge 13.13:1 — all above the 4.5:1 requirement; the 3 px focus ring is 5.02:1 against its adjacent surface, above 3:1. The delete dialog is a native modal: initial focus on Cancel, the destructive action last with nothing preselected, no control outside the dialog ever receives focus across twelve Tab presses, programmatic focus of an outside control is refused by the modal, and Escape returns focus to the trigger. Under `prefers-reduced-motion: reduce` no non-zero transition or animation duration remains (150 ms button transitions otherwise). Validation is announced through a live region and identified by `aria-invalid` plus `aria-describedby`, not colour alone. A focus-loss defect found in this pass is listed below and was fixed. |

## Defects found in this pass

**Fixed — focus was lost to `<body>` after a rejected submit** (major; would have failed AC-P06-13). The
submit button is disabled while the request runs, so the browser moved focus to `<body>`, and nothing put it
back when the server rejected the submission. Client-side validation already focused the first invalid field;
only the server-rejection path was missing it. Keyboard and screen-reader users had to traverse the page again
after every rejected sign-up, login, reset or password change. Fixed in `features/account/forms.ts`: after a
rejection focus moves to the field named by the server's `errors[].pointer`, or to the announced error notice
when no single field is at fault, scoped to the open dialog when there is one. The notice carries a 3 px ring
under `:focus`, because `:focus-visible` does not fire for programmatic focus on a non-interactive element.
Two RTL cases were proven red first; re-verified in the browser.

**Cosmetic deviation, accepted** — the delete dialog is 352 px wide in a 390 px viewport where
`architecture/ui-ux-design.md` specifies `min(100% - 32px, 480px)` = 358 px. It is 6 px narrower than the
brief, inside the viewport with no overflow and with its actions visible, so it does not affect any
acceptance criterion. Recorded rather than changed, to avoid an unreviewed late style edit.

## Deferred, with owners

| Item | Why it is not P06 | Owner |
|---|---|---|
| Browser journeys against a live backend (review m-10(d)) | No `/api/v1` proxy exists anywhere in the repository: the frontend has only ever run against mocked routes, and the serving layer that would proxy it (`frontend/vite.config.ts`, the web image) is outside the P06 allowed paths. AC-P06-12 specifies local synthetic-state evidence, which this pass provides. Wiring the proxy is deployment configuration. | P15 |
| `Referrer-Policy: no-referrer` as a response header (review m-4) | P06 injects the `<meta>` equivalent; the header belongs to the web server or CDN configuration. | P15 / P03 |
| Trusted-proxy configuration for IP-keyed rate limits (review m-3) | Deployment configuration; without it every client shares one bucket behind an ingress. | P15 |
| In-process rate counters are per-replica (review m-3) | Shared counters need the deployment topology decided. Per-address e-mail and login back-off counters are already in Mongo. | P13 / P15 |
| Data Protection key ring required in Production (review m-2) | A startup guard belongs with the deployment configuration that supplies the key directory. | P15 |
| Full cross-store purge and restore reconciliation (FR-ACC-03), one archive export (FR-ACC-04) | P06 owns the account slice only; the aggregate obligations are recorded in ADR-039 and DD-P06-05/06. | P07 / P13 |
| Remaining review minors m-8 (host inventory wording), m-9 (live-region and `aria-pressed` details), m-10(a)(b)(c) (real-store coverage for sliding renewal, counter atomicity and purge internals) | Recorded as residual risk; none affects a Must criterion. m-8's inventory assertion and m-10's real-Mongo purge, counter and ticket-renewal cases were in fact added during the phase. | P14 |

## No-go check

None of the `docs/blueprint/PHASE-GATES.md` no-go conditions applies: no Must criterion fails, no data loss,
no cross-user data access (proven by the A/B isolation and cookie-replay tests), no unapproved contract
change (`git diff main...HEAD -- contracts` is empty), no security or privacy critical issue, no PDF layout
work in this phase, and no test was changed or disabled to mask a defect — the two test edits in this phase
were a missing CSRF bootstrap step and a wrong request field name, both recorded in `tests/test-results.md`
with every assertion preserved.
