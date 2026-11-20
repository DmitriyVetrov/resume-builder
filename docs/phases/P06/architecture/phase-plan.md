# P06 Architecture Plan — Identity & Accounts

- Author: Solution Architect (delegated, ADR-035), 2026-11-03. Kickoff: [kickoff.md](../kickoff.md).
- Contract: `contracts/openapi/openapi.yaml` 1.0.0, frozen by P02. No P06 contract edit.
- Application design: [ui-ux-design.md](ui-ux-design.md), derived from TECHNICAL-SPEC Appendix A, inspected source screenshots and the owner visual direction in `docs/blueprint/UI-UX-DESIGN.md`.

## Context and scope

P04 supplied a .NET 10 modular host, Mongo readiness, global rate limiting, safe error handling and contract drift checks. P05 supplied the React/Vite shell, routes and contract-generated TypeScript pipeline. P06 adds first-party account behavior on those foundations. The backend implements all twelve `x-phase: P06` operations: `getSession`; `signUp`, `verifyEmail`, `resendVerification`, `login`, `logout`, `requestPasswordReset`, `confirmPasswordReset`, `reauthenticate`; `changePassword`, `requestAccountDeletion`, `exportAccountData`. Public URLs use the contract's `/api/v1` server base. There are no new paths or response DTOs.

FR-ACC-05 Google sign-in is deferred (ADR-014). FR-ACC-06 is a browser-local Could feature (ADR-015): P06 owns the accessible claim confirmation UI seam, P07 implements the ordinary create/photo operations and P08 integrates local draft persistence and claim. No guest backend account or endpoint is introduced. FR-ACC-04's server response is canonical JSON; P13 assembles the complete browser archive with current PDF/TXT and photos after P07/P12. P06 does not claim those later outputs are complete.

## Requirement and acceptance mapping

| Source | P06 responsibility | Acceptance |
|---|---|---|
| FR-ACC-01; D-01, ADR-013 | Sign-up, verification/resend, session `emailVerified`; unverified login allowed | AC-P06-01, 02, 03 |
| FR-ACC-02; ADR-036 | Login/logout, reset email and one-hour single-use token, password change, session revocation | AC-P06-03, 04, 05 |
| FR-ACC-03; ADR-039 | Confirmed request, fresh re-auth, immediate revoke and login denial; durable, retryable purge of P06-owned live data within 24 h | AC-P06-07 |
| FR-ACC-04; ADR-039 §6 | Re-authenticated, verified, owner-scoped no-store JSON export; full browser archive remains P13 | AC-P06-08 |
| FR-ACC-05; D-02, ADR-014 | No external identity provider in v1 | AC-P06-11 |
| FR-ACC-06; D-03, ADR-015 | Claim confirmation UI seam; P07/P08 complete the flow | AC-P06-10 |
| NFR-08, NFR-09; ADR-036/038 | Password hashing, CSRF, secure revocable sessions, anti-enumeration, rate limits, log privacy | AC-P06-06, 09 |
| NFR-10, NFR-12; ADR-039 | Durable deletion request, resumable purge, bounded account operations | AC-P06-07, 09 |
| NFR-05/06 | Account flows usable by keyboard and on narrow screens | AC-P06-10 |

## Component boundaries and data

`Domain` owns account identity, verification/deletion state and password-policy rules without web/Mongo dependencies. `Application` owns use cases and ports for account, token, session, email outbox, deletion ledger/purge and clock; it never handles raw HTTP cookies. `Infrastructure` implements Mongo repositories/indexes and local SMTP/Mailpit and key stores. `Api` configures cookie authentication, Data Protection, antiforgery, rate limits and the twelve contract operations, mapping domain failures to the contract's RFC 9457 Problem codes. Keep P04's safe logging allow-list: event/code/trace/route/status/time only. No request body, address, password, token, cookie, archive or resume content enters logs.

Persist account records with a unique normalized email key, password hash, `emailVerifiedAt` and `deletionRequestedAt`; store only hashed one-use verification/reset tokens with TTL and purpose, revocable sessions with TTL, and an email outbox whose sent bodies are removed. Expose random public IDs. Indexes and write concern must make sign-up uniqueness, token use and deletion requests safe under concurrent requests. Use `PasswordHasher<TUser>` V3 PBKDF2-HMAC-SHA512 with ≥210,000 iterations, rehash-on-login, 10–128 code point policy and a bundled common-password list (ADR-036). No bespoke password crypto.

`Frontend` owns account pages, session bootstrap, auth form state, route navigation and claim confirmation component. DD-P06-13 fixes canonical browser routes `/sign-up`, `/login`, `/reset-password`, `/reset-password/confirm`, `/verify-email`, and `/account`, with explicit history-replacing aliases for the existing `/auth/*` test entry paths. Its `shared/api` client adds same-origin cookies and the readable `XSRF-TOKEN` echo for unsafe methods; it never stores the session or raw token in localStorage. Read `SessionInfo` from the generated contract types, refresh it after verification/login/logout/reset, and treat unknown Problem codes by HTTP status class. Private account data and any downloaded JSON stay out of console/telemetry. Use the P05 route shell and accessible status/errors; no fake completed archive or claim action.

The Frontend Developer also implements the P06 account visual system specified in [ui-ux-design.md](ui-ux-design.md): extend P05's `frontend/src/app/shell.css` Tailwind 4 token source, build reusable `frontend/src/shared/ui/**` controls, and finish P06 account screens in `frontend/src/features/account/**` and route pages. Application typography and decorative CSS never enter the resume-template layout engine. The Test Architect maps its desktop/phone/zoom, validation, dialog and reduced-motion states to tests; the Test Engineer owns visual/interaction tests and local evidence before frontend implementation. P07 and P08 reuse the resulting system, while P14 verifies consistency across phases.

## HTTP and security behavior

- `GET /session` is safe for anonymous callers and bootstraps the CSRF cookie. Every unsafe operation, including anonymous auth POSTs, requires `X-XSRF-TOKEN`; missing/invalid returns `csrf_token_invalid` (403). Cookies are `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/` for `__Host-rb_session`; session ID rotates at login. Local HTTP test transport needs explicit test configuration without weakening production settings.
- Sign-up, resend and reset request answer the same 202 for any syntactically valid address whether registered or not; sign-up opens no session. Unknown login uses a dummy password hash and failures use generic `invalid_credentials`. Per-account back-off and ADR-038 `auth-login`, `auth-email`, `data-export` policies return the contracted 429/`Retry-After`. Do not echo submitted values in Problem details.
- DD-P06-15 in `decisions.md` fixes login/reset concurrency: login rehash uses atomic `IAccountStore.TryCompareExchangePasswordHashAsync(accountId, expectedHash, replacementHash, cancellationToken)` and rejects a lost comparison; after session creation, every successful verification re-reads the account and revokes its candidate before returning failure if the expected hash or live-account state no longer matches. Reset/change retain hash-write-before-revoke-all ordering. The six-dependency constructor and existing signatures stay unchanged. Backend Developer declares the additive port member, Test Engineer owns stateful fake updates and deterministic barrier-based red tests, then Backend Developer implements the behavior. The exact semantics, cleanup rules and test matrix are in DD-P06-15; no HTTP contract or allowed-path expansion is needed.
- Email verification and reset tokens are random 32-byte base64url values with only SHA-256 hashes persisted, constant-time comparison, single use and 24 h/1 h expiry respectively. New token invalidates older same-purpose tokens. Verification/reset pages receive the token in a URL fragment, clear it from browser history after capture and set `Referrer-Policy: no-referrer`. Reset verifies the address and revokes all sessions.
- Re-auth stamps only the current session for at most five minutes. Password change and deletion revoke every session. `exportAccountData` requires current session, fresh re-auth and verified email; `Cache-Control: no-store`. Session/profile response must reflect `emailVerified` accurately.
- Deletion confirmation is explicit in the UI after re-auth. The API durably marks the account for deletion and immediately revokes sessions and blocks login. A retryable P06 job purges account-owned sessions, tokens, outbox and account data within 24 h; it first writes the account entry to both the Mongo deletion ledger and separate private append-only Blob ledger, as ADR-039 requires. A failed ledger write blocks deletion and is retried. Send the confirmation email before erasing its address or outbox entry. The lifecycle port must accept P07 resume/photo/snapshot cleanup without changing the public API. P07 must wire those stores before users can create resumes; P13 adds restore reconciliation, the aggregate deletion drill and later ledger entry types specified by ADR-039. No phase gate may treat P06's account-only fixture as proof that future resume/photo stores were erased.
- `exportAccountData` returns only the contract's `AccountDataExport` JSON for this phase, using the authenticated account ID as the query key. P06 can prove the empty-resume shape and owner isolation. P07 supplies real active/trashed resume records and photo-master reads; P12 supplies PDF/TXT regeneration; P13 creates one downloadable archive with progress and partial-PDF manifest. The P06 UI labels its JSON download accurately until that work lands.

## Execution and dependencies

P02 frozen contract + P04 backend host + P05 frontend shell → Test Architect's matrix → Test Engineer's red tests and harness proof → Backend ∥ Frontend green work in disjoint child worktrees → integrated QA → gate. The Test Engineer should use a fake clock and local deterministic email sink, then an API host with Mongo and Mailpit for integration. Backend and frontend developers cannot edit existing tests, contract or acceptance criteria. The Code Reviewer verifies auth, deletion and data-export boundaries before QA exercises real flows. P07 consumes the account/session owner ID and lifecycle port; P08 consumes the claim UI seam; P12/P13 finish archive and purge/restore obligations.

### Compile-time seams for deterministic red tests (DD-P06-07)

Before the Test Engineer's red step, the Backend Developer adds **declarations only** under `backend/src/ResumeBuilder.Application/Accounts/` in namespace `ResumeBuilder.Application.Accounts` and `backend/src/ResumeBuilder.Domain/Accounts/` in namespace `ResumeBuilder.Domain.Accounts`. DD-P06-12 in `decisions.md` gives the exact records and port methods; DD-P06-14 gives the exact `PasswordPolicy.Validate(string)`, `IAccountPasswordHasher` and `AccountUseCases : IAccountUseCases` compile-only signatures, constructor dependencies and return types. This supersedes DD-P06-07's earlier empty-marker allowance. The scaffold contains only explicit throwing method bodies needed for compilable concrete declarations: **no endpoint, adapter, DI registration, no-op service, worker or conditional production path** may be added before red tests. The coordinator records it as a distinct pre-red step and does not treat it as green implementation.

The Test Engineer owns `WebApplicationFactory<Program>` test overrides via `ConfigureTestServices`: replace `IClock` with a controllable fake and `IEmailSink` with an in-memory capture sink that never logs messages. Use Testcontainers MongoDB and Azurite backed by persistent fixture volumes for the real account/token/session/outbox and dual-ledger paths; preserve the same containers across a host restart. Override `IAccountDeletionLedger` with an injected failure only in the failure-path test. Configure `Accounts:DeletionWorker:Enabled=false` in tests so the background timer cannot race assertions, and invoke `IAccountDeletionProcessor.ProcessDueAsync` explicitly after advancing the fake clock; production defaults to enabled. The developer implements and registers these services only after red proof. An initial 404 or an explicit assertion that a required service is absent is an acceptable missing-behavior red; DI startup exceptions, container connection failures, timeouts and unbuildable tests are harness defects and must be fixed before handoff. Tests targeting the new application/store contracts compile after the declaration-only step and prove missing behavior via assertions, including atomic token consume, revoke-all, outbox claim and deletion order. Never record captured email text, token values, passwords or storage bytes in test results.

## Risks and decisions

The principal risks are account enumeration through response/timing, cookie/CSRF misconfiguration, token replay, stale re-auth, incomplete purge, cross-account export, and accidental content-bearing telemetry. AC-P06-02…09 target these directly. Production ACS Email, EU Key Vault/Blob key ring and restore drill need deployment configuration or P13/P15 evidence; local Mailpit and test keys are sufficient here. `decisions.md` records the accepted D-01…03 answers and phase seam choices as `DELEGATED-DEFAULT`. ADR-039's P06 amendment records the advanced account-only purge allocation; no new ADR/register row is needed because the existing ADR IDs settle the product and architecture choices.

Visual risks are source-image imitation that reintroduces excluded flows, low contrast in soft accents, form/dialog focus loss, and a desktop layout that overflows at 390 px or 200% zoom. The design artifact defines local target states and an explicit reuse/adapt/exclude map. AC-P06-12/13 require representative rendered evidence and WCAG 2.1 AA checks; P14's consolidation does not defer P06 screen finish.

## Allowed paths

- `docs/phases/P06/**`
- `docs/blueprint/decisions/ADR-039-data-retention-and-deletion.md`
- `backend/src/ResumeBuilder.Domain/**`
- `backend/src/ResumeBuilder.Application/**`
- `backend/src/ResumeBuilder.Infrastructure/**`
- `backend/src/ResumeBuilder.Api/**`
- `backend/tests/ResumeBuilder.Domain.Tests/**`
- `backend/tests/ResumeBuilder.Application.Tests/**`
- `backend/tests/ResumeBuilder.Api.Tests/**`
- `backend/tests/ResumeBuilder.Infrastructure.Tests/**`
- `backend/tests/ResumeBuilder.Architecture.Tests/**`
- `backend/ResumeBuilder.slnx`
- `backend/Directory.Packages.props`
- `backend/README.md`
- `frontend/src/**`
- `frontend/src/app/shell.css`
- `frontend/src/shared/ui/**`
- `frontend/src/features/account/**`
- `frontend/src/pages/**`
- `frontend/package.json`
- `frontend/package-lock.json`
- `frontend/README.md`
- `tests/e2e/**`
- `tests/e2e/account*.spec.ts`
- `docs/phases/P06/architecture/ui-ux-design.md`

The Solution Architect edits only `docs/phases/P06/**` and, if an ADR is required, `docs/blueprint/decisions/**`. The Test Architect owns `docs/phases/P06/tests/test-plan.md`; the Test Engineer owns test source, `tests/e2e/**` and P06 `tests/suite.cmd`/`test-results.md`; developers own their respective production trees and may append their own evidence to `test-results.md`. The coordinator owns status/log/gate records. `contracts/**`, `docs/source/**`, shared CI/infrastructure, and other phase records are outside this plan; a contract gap requires a separate Contract Architect assignment and compatible change review.

## Architect verification and handoff

From the P06 worktree on 2026-11-03:

| Exact command | Exit code | Result |
|---|---:|---|
| `git diff --check` | 0 | No whitespace errors. |
| `python3 scripts/phase-handoff-check.py --phase P06 --role solution-architect --worktree .` | 0 | `RESULT PASS`; role scope 8 files, phase scope 10 files since main, blueprint check 0; expected `WARN no suite.cmd yet` before Test Engineer step. |

At the initial handoff, no P06 application or acceptance test was run by the Architect. The next owner was the Test Architect for `tests/test-plan.md`, then the Test Engineer for red tests and `tests/suite.cmd`.

### UI/UX follow-up verification (2026-11-03)

| Exact command | Exit code | Result |
|---|---:|---|
| `python3 scripts/phase-handoff-check.py --phase P06 --role solution-architect --worktree .` | 1 | `ROLE_SCOPE` found concurrently changed Test Engineer files `backend/tests/ResumeBuilder.Api.Tests/P06FixtureTests.cs` and `ResumeBuilder.Api.Tests.csproj`; phase scope 22 files and blueprint check passed. The suite reported three red steps as informational for this role. The coordinator must isolate/commit the other role's files before a clean Architect handoff check. |
| `git diff --check` | 0 | No whitespace errors. |

The screenshot-reference check exited 0; all six exact files exist. Exact command:

```bash
python3 - <<'PY'
from pathlib import Path
import re
s=Path('docs/phases/P06/architecture/ui-ux-design.md').read_text()
refs=sorted(set(re.findall(r'\]\(\.\./\.\./\.\./source/img/([^)]*)\)',s)))
missing=[name for name in refs if not (Path('docs/source/img')/name).is_file()]
assert not missing, missing
print('P06 screenshot references OK:', ', '.join(refs))
PY
```

After the concurrent Test Engineer files were committed, `python3 scripts/phase-handoff-check.py --phase P06 --role solution-architect --worktree .` exited **0**: `WARN no uncommitted changes for role solution-architect`, phase scope 22 files since main, blueprint check 0, and `RESULT PASS`. The suite still reported three red of seven steps as informational for the Architect; this is not an application green claim.

The next owners must pick up AC-P06-12/13: Test Architect adds bounded visual, interaction, responsive and accessibility coverage to `tests/test-plan.md`; Test Engineer writes red tests and synthetic screenshot evidence; Frontend Developer implements the shared tokens/components and finished P06 account surfaces; Reviewer and QA compare the rendered result to `ui-ux-design.md`. No application behavior or test result is claimed by this Architect follow-up.

### DD-P06-12 follow-up verification (2026-11-03)

`git diff --check` exited 0 after the declaration-contract decision. No application test was run for this document-only follow-up. The concurrent Test Architect edit to `tests/test-plan.md` is outside this role, so the coordinator should run the role handoff check after that file is committed or isolated.

### DD-P06-13/14 follow-up verification (2026-11-03)

| Exact command | Exit code | Result |
|---|---:|---|
| `git diff --check` | 0 | No whitespace errors in the four document edits. |
| `python3 scripts/phase-handoff-check.py --phase P06 --role solution-architect --worktree .` | 0 | `RESULT PASS`: role scope 4 files, phase scope 22 changed files since main, blueprint check 0. The runner reported three red suite commands (`bash scripts/ci/backend.sh`, `bash scripts/ci/frontend.sh`, `bash scripts/ci/e2e.sh`) as informational for this Architect role; contract steps exited 0. This is not a green application claim. |

No production source or test was edited in this follow-up. The next owners are the Backend Developer for the DD-P06-14 compile-only declarations and the Test Engineer for the preserved alias tests and new canonical-route, Domain and Application red cases; the Frontend Developer later implements DD-P06-13 after red proof.
