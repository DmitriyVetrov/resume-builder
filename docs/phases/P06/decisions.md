# P06 Decisions

All answers below are `DELEGATED-DEFAULT` under ADR-035 A-4. Source precedence is TECHNICAL-SPEC, reference-product evidence where relevant, then the conservative, reversible standard option. D-01…03 were already closed by Accepted ADRs in P01 and are reaffirmed here, not reopened.

| ID | Question and options considered | Decision and reason | Authority |
|---|---|---|---|
| DD-P06-01 (`DELEGATED-DEFAULT`) | D-01: require verification before login, allow login before verification with export gate, or remove the gate? | **Allow login and editing before verification; gate PDF/TXT/copy-as-text and account data export until verified.** TECHNICAL-SPEC §12 explicitly recommends this reading of the marked FR-ACC-01 criterion. | ADR-013; TECHNICAL-SPEC §§5.1, 12 |
| DD-P06-02 (`DELEGATED-DEFAULT`) | D-02: Google sign-in in v1 or later? | **Later.** No external identity provider or OAuth endpoint in P06; the Could item is deferred by the accepted decision. | ADR-014; TECHNICAL-SPEC §§5.1, 12 |
| DD-P06-03 (`DELEGATED-DEFAULT`) | D-03: no guest, server anonymous account, or browser-local draft and explicit claim? | **Browser-local draft and explicit claim.** P06 creates the confirmation UI seam; P07/P08 finish the ordinary create/photo call and local persistence. The Could item may be recorded as deferred without blocking the P06 Must gate. | ADR-015; TECHNICAL-SPEC §§5.1, 12 |
| DD-P06-04 (`DELEGATED-DEFAULT`) | Contract: alter P02 OpenAPI, implement existing operations, or invent interim endpoints? | **Implement frozen OpenAPI 1.0.0.** All twelve P06 operations and the later ordinary create/photo claim path exist; no Contract Architect step or version change is needed. A discovered gap needs a separate compatible contract review. | ADR-006/040; P02 phase plan §5; OpenAPI `x-phase` |
| DD-P06-05 (`DELEGATED-DEFAULT`) | Account deletion before P07 data stores: defer the whole flow, claim full future aggregate deletion, or implement a durable extensible P06 purge? | **Implement the request and purge for all P06-owned live data within 24 h, with dual ledger writes before deletion and a lifecycle port that P07 must extend before creating resumes.** P13 proves full aggregate deletion and restore reconciliation. This advances the account-only job from ADR-039's original P13 allocation, so ADR-039 carries a dated amendment. | FR-ACC-03; ADR-039 §§2–4 and P06 amendment; TRACEABILITY `FR-ACC` |
| DD-P06-06 (`DELEGATED-DEFAULT`) | Data export in P06: fake complete ZIP, postpone endpoint, or deliver the contracted JSON source now? | **Deliver owner-scoped, no-store `AccountDataExport` JSON now, with a truthful JSON download label.** P07 adds resume/photo data; P12/P13 generate PDFs/TXT and one archive. This preserves the frozen contract and makes the staged Should requirement explicit. | FR-ACC-04; ADR-039 §6; P02 phase plan §5.3 |
| DD-P06-07 (`DELEGATED-DEFAULT`) | Test Engineer needs deterministic clock/email and restartable deletion storage before behavior exists: test-only reflection/config hacks, test edits to production, or a narrow production compile-time seam scaffold? | **Backend Developer first adds interface and message declarations only, then Test Engineer writes and proves red behavior tests, then Backend Developer implements and wires them.** Interface declarations have no endpoint, adapter, registration or behavior; tests may assert a missing service as the red result, but the host/fixtures must start. Test Engineer owns all `ConfigureTestServices` overrides and container fixtures. This preserves test ownership and avoids brittle reflection or real-time waits. | ADR-035 B-4/Amendment 2 red harness; `.claude/rules/01-tdd.md`; P04 host |
| DD-P06-08 (`DELEGATED-DEFAULT`) | Shared UI kit: adopt a component library/paid theme or build a small Tailwind 4 control set? | **Build a small accessible control set in `frontend/src/shared/ui/**` using native elements and P05 tokens.** No new kit/package: it avoids a parallel design language and bundle/license review for a limited account surface, while keeping P07/P08 reuse possible. Revisit if a later feature shows a concrete gap. | Owner visual direction; P05 shell; TECHNICAL-SPEC NFR-05/06; `architecture/ui-ux-design.md` |
| DD-P06-09 (`DELEGATED-DEFAULT`) | Icon assets: package/CDN, CSS-only indicators, or small authored inline SVG with labels? | **Small authored inline SVG with consistent 2 px strokes, always paired with text for key actions.** No remote request, icon-package dependency or icon-only destructive action. | TECHNICAL-SPEC NFR-06/09; `architecture/ui-ux-design.md` |
| DD-P06-10 (`DELEGATED-DEFAULT`) | App font: remote web font, bundled new font, or platform system stack? | **Platform system stack for P06 application UI.** Strong scale/weight and spacing supply hierarchy without network/font licensing work; P10–P12 own separately bundled and versioned resume-template fonts. | TECHNICAL-SPEC NFR-05/09/14; ADR-010; `architecture/ui-ux-design.md` |
| DD-P06-11 (`DELEGATED-DEFAULT`) | Motion: expressive entrance effects, static interface, or restrained feedback with reduced-motion handling? | **150–180 ms hover/panel feedback only, with nonessential motion removed for `prefers-reduced-motion: reduce`.** This keeps the requested polished feel without delaying interaction or excluding motion-sensitive users. | TECHNICAL-SPEC NFR-06; `architecture/ui-ux-design.md` |
| DD-P06-12 (`DELEGATED-DEFAULT`) | Empty marker ports, test-owned production stubs, or complete declaration-only application contracts before red tests? | **Complete the `ResumeBuilder.Application.Accounts` declarations below in a narrow Backend Developer pre-red step.** The Test Engineer owns test fakes/overrides and writes assertion-red use-case, persistence and API tests after the declarations compile; the Backend Developer then implements behavior. This gives atomic token use, revoke-all, deletion and outbox semantics a testable shape without moving test ownership or adding behavior first. | ADR-035 Amendment 2 red harness; P06 test plan V02/R04/C05/D07; DD-P06-07 |
| DD-P06-13 (`DELEGATED-DEFAULT`) | Browser account paths: use the P06 design's short paths, replace them with the Test Engineer's `/auth/*` paths, or support both? | **Use the short design paths as canonical browser routes and redirect the five existing `/auth/*` browser paths to them with history replacement.** The table below is exhaustive. This preserves existing test entry paths while keeping one URL per account page after navigation. These are SPA routes, not changes to the frozen `/api/v1/auth/*` HTTP contract. | P06 `architecture/ui-ux-design.md` §Screen behavior; existing `frontend/src/features/account/account.test.tsx` and `tests/e2e/account.spec.ts`; DD-P06-04 |
| DD-P06-14 (`DELEGATED-DEFAULT`) | Red unit tests need concrete `PasswordPolicy` and `AccountUseCases` types: let tests invent signatures, implement behavior before red, or add compile-only declarations with fixed signatures? | **Add the exact compile-only class and password-hasher port declarations below before the Test Engineer writes those unit tests.** The Domain policy returns one contract validation issue code or `null`; the Application class implements the existing `IAccountUseCases` methods and takes six explicit dependencies. Throwing `NotImplementedException` bodies make the scaffold compile without implementing behavior or registering a service. | ADR-035 Amendment 2; DD-P06-07/12; P06 test plan A01/V02/R04/C05; ADR-036 |
| DD-P06-15 (`DELEGATED-DEFAULT`) | Login can create a session after a concurrent reset has revoked sessions, and unconditional login rehash can overwrite the reset password: use a pre-create read alone, introduce a transaction/credential-version scheme, or combine atomic hash compare-and-set with a post-create account check? | **Approve the Backend Developer's compare-and-set plus post-create check, with the fail-closed semantics and tests below.** Rehash must match the verified hash atomically; every successful verification must be checked again after session persistence. This closes both reported interleavings while preserving existing signatures, the six-dependency constructor and the frozen HTTP contract. | Solution Architect (delegated, ADR-035 A-4), 2026-11-04; FR-ACC-02/03, NFR-08; ADR-036 §§2–3; AC-P06-03/04/07; DD-P06-12/14 |
| DD-P06-16 (`DELEGATED-DEFAULT`) | Review M-2 asks for the token-comparison interpretation to be recorded or replaced, and M-3 for a bundled breach corpus: weaken the findings, defer them, or close both now? | **Close both now and record what differs from the literal wording.** Token redemption stays an indexed digest match rather than an in-process constant-time compare, and the common-password control ships the upstream SecLists top-100k breach corpus (96,441 entries) plus case, affix and sequence normalisation. | Operator (delegated, ADR-051 S-5), 2026-11-04; FR-ACC-01/02, NFR-08; ADR-036 §§2, 6; AC-P06-01/06; review M-2/M-3 |

### DD-P06-13 canonical browser route table

| Canonical SPA path | Existing alias → canonical path | State and fragment rule |
|---|---|---|
| `/sign-up` | `/auth/sign-up` → `/sign-up` | Sign-up form; successful generic request navigates to `/verify-email` pending view. |
| `/login` | `/auth/login` → `/login` | Login form; preserve only a validated same-origin return destination. |
| `/reset-password` | `/auth/password-reset` → `/reset-password` | Password-reset request form. |
| `/reset-password/confirm#t=…` | `/auth/password-reset/confirm#t=…` → `/reset-password/confirm#t=…` | Reset-link page. Accept legacy `#token=…` on either path; consume and clear the fragment before any interaction or network request. |
| `/verify-email#t=…` | `/auth/verify-email#t=…` → `/verify-email#t=…` | Verification-link page and tokenless pending/resend view. Accept legacy `#token=…` on either path; consume and clear the fragment before any interaction or network request. |
| `/account` | none | Protected account settings, re-auth, JSON export and deletion dialogs. |

The alias redirects use client-side history **replace**, retain a token fragment only until the destination captures it, and never put tokens in a query string. Set `Referrer-Policy: no-referrer` on both link pages. Generated links and in-app navigation use canonical paths and `#t=`; any unlisted `/auth/*` path remains the normal 404. The Test Engineer keeps the existing alias tests and adds canonical-path/redirect and fragment-clearing assertions; no existing test is changed or weakened.

### DD-P06-12 declaration contract

These are the **exact public names and signatures** for `backend/src/ResumeBuilder.Application/Accounts/` in namespace `ResumeBuilder.Application.Accounts`. `IClock`, `IEmailSink`, `AccountEmail`, `IAccountDeletionLedger` and `IAccountDeletionProcessor` already exist and retain their signatures. The Backend Developer adds only the missing records, enum, methods and ports before red tests; no concrete class, route, DI registration, conditional test branch or job behavior is part of that scaffold. `AccountRecord.NormalizedEmail` is the unique lookup key; `AccountTokenRecord.TokenHash` is SHA-256 bytes only; sent outbox entries clear `Body`. No session record contains IP address or user agent.

```csharp
public interface IClock { DateTimeOffset UtcNow { get; } }
public interface IEmailSink
{
    Task SendAsync(AccountEmail message, CancellationToken cancellationToken);
}
public sealed record AccountEmail(string RecipientAddress, string Subject, string Body);
public interface IAccountDeletionLedger
{
    Task RecordAccountAsync(Guid userId, DateTimeOffset recordedAt, CancellationToken cancellationToken);
}
public interface IAccountDeletionProcessor
{
    Task ProcessDueAsync(CancellationToken cancellationToken);
}

public enum AccountTokenPurpose { Verification, PasswordReset }
public sealed record AccountRecord(Guid Id, string Email, string NormalizedEmail,
    string PasswordHash, DateTimeOffset CreatedAt, DateTimeOffset? EmailVerifiedAt,
    DateTimeOffset? DeletionRequestedAt);
public sealed record AccountTokenRecord(Guid Id, Guid AccountId, AccountTokenPurpose Purpose,
    byte[] TokenHash, DateTimeOffset ExpiresAt, DateTimeOffset? UsedAt);
public sealed record AccountSessionRecord(Guid Id, Guid AccountId, DateTimeOffset CreatedAt,
    DateTimeOffset LastSeenAt, DateTimeOffset ExpiresAt, DateTimeOffset AbsoluteExpiresAt,
    DateTimeOffset? ReauthenticatedAt);
public sealed record AccountOutboxRecord(Guid Id, Guid AccountId, string RecipientAddress,
    string Subject, string? Body, DateTimeOffset CreatedAt,
    DateTimeOffset? ClaimedUntil, DateTimeOffset? SentAt);

public interface IAccountUseCases
{
    Task SignUpAsync(string email, string password, CancellationToken cancellationToken);
    Task<bool> VerifyEmailAsync(string token, CancellationToken cancellationToken);
    Task ResendVerificationAsync(string email, CancellationToken cancellationToken);
    Task<AccountSessionRecord?> LoginAsync(string email, string password, CancellationToken cancellationToken);
    Task<AccountSessionRecord?> GetSessionAsync(Guid sessionId, CancellationToken cancellationToken);
    Task LogoutAsync(Guid sessionId, CancellationToken cancellationToken);
    Task RequestPasswordResetAsync(string email, CancellationToken cancellationToken);
    Task<bool> ConfirmPasswordResetAsync(string token, string newPassword, CancellationToken cancellationToken);
    Task<bool> ReauthenticateAsync(Guid sessionId, string password, CancellationToken cancellationToken);
    Task<bool> ChangePasswordAsync(Guid sessionId, string newPassword, CancellationToken cancellationToken);
    Task<bool> RequestDeletionAsync(Guid sessionId, CancellationToken cancellationToken);
    Task<AccountRecord?> GetAccountForExportAsync(Guid accountId, CancellationToken cancellationToken);
}
public interface IAccountStore
{
    Task<bool> TryCreateAsync(AccountRecord account, CancellationToken cancellationToken);
    Task<AccountRecord?> FindByNormalizedEmailAsync(string normalizedEmail, CancellationToken cancellationToken);
    Task<AccountRecord?> FindByIdAsync(Guid accountId, CancellationToken cancellationToken);
    Task<bool> TryVerifyEmailAsync(Guid accountId, DateTimeOffset verifiedAt, CancellationToken cancellationToken);
    Task<bool> TrySetPasswordHashAsync(Guid accountId, string passwordHash, CancellationToken cancellationToken);
    Task<bool> TryMarkDeletionRequestedAsync(Guid accountId, DateTimeOffset requestedAt, CancellationToken cancellationToken);
    Task<IReadOnlyList<AccountRecord>> ListDeletionDueAsync(DateTimeOffset dueAtOrBefore, int limit, CancellationToken cancellationToken);
    Task DeleteAsync(Guid accountId, CancellationToken cancellationToken);
}
public interface IAccountTokenStore
{
    Task ReplaceActiveAsync(AccountTokenRecord token, CancellationToken cancellationToken);
    Task<Guid?> TryConsumeAsync(byte[] tokenHash, AccountTokenPurpose purpose, DateTimeOffset now, CancellationToken cancellationToken);
    Task DeleteForAccountAsync(Guid accountId, CancellationToken cancellationToken);
}
public interface ISessionStore
{
    Task CreateAsync(AccountSessionRecord session, CancellationToken cancellationToken);
    Task<AccountSessionRecord?> FindActiveAsync(Guid sessionId, DateTimeOffset now, CancellationToken cancellationToken);
    Task<bool> RenewAsync(Guid sessionId, DateTimeOffset seenAt, DateTimeOffset expiresAt, CancellationToken cancellationToken);
    Task<bool> StampReauthenticatedAsync(Guid sessionId, DateTimeOffset reauthenticatedAt, CancellationToken cancellationToken);
    Task RevokeAsync(Guid sessionId, CancellationToken cancellationToken);
    Task RevokeAllForAccountAsync(Guid accountId, CancellationToken cancellationToken);
    Task DeleteForAccountAsync(Guid accountId, CancellationToken cancellationToken);
}
public interface IEmailOutboxStore
{
    Task EnqueueAsync(AccountOutboxRecord message, CancellationToken cancellationToken);
    Task<AccountOutboxRecord?> TryClaimNextAsync(DateTimeOffset now, TimeSpan lease, CancellationToken cancellationToken);
    Task MarkSentAndClearBodyAsync(Guid messageId, DateTimeOffset sentAt, CancellationToken cancellationToken);
    Task ReleaseClaimAsync(Guid messageId, CancellationToken cancellationToken);
    Task DeleteForAccountAsync(Guid accountId, CancellationToken cancellationToken);
}
public interface IAccountOwnedDataPurger
{
    Task PurgeAsync(Guid accountId, CancellationToken cancellationToken);
}
```

`ReplaceActiveAsync`, `TryConsumeAsync`, `TryCreateAsync`, `TryMarkDeletionRequestedAsync`, `TryClaimNextAsync` and `RevokeAllForAccountAsync` require atomic/unique persistence behavior when implemented. `TryConsumeAsync` returns an account ID only once and only before expiry; an unknown, used or expired token returns `null` at the exact expiry instant. `ListDeletionDueAsync` uses the request timestamp and a bounded batch; `IAccountDeletionProcessor.ProcessDueAsync` performs dual ledger writes, invokes `IAccountOwnedDataPurger`, sends the confirmation mail before address erasure and then deletes P06 account data. `IAccountOwnedDataPurger` is the P07 extension point for resumes/photos. The application use-case interface does not replace the frozen HTTP contract; it exposes no new API endpoint or DTO. The Test Engineer may compile against these declarations and create fakes, inspect Mongo/Azurite for persistence, and assert a missing implementation/registration as the initial red; startup/fixture errors do not count as red evidence.

### DD-P06-14 exact compile-only declarations

`backend/src/ResumeBuilder.Domain/Accounts/PasswordPolicy.cs` has namespace `ResumeBuilder.Domain.Accounts`. It has no constructor or dependency. `Validate` returns `null` for a valid password, otherwise exactly one of `password_too_short`, `password_too_long`, or `password_too_common`; length is measured in Unicode code points with inclusive 10 and 128 boundaries, and length errors take precedence over common-list membership. It never returns or logs the password. This compile-only skeleton is valid C#; the Backend Developer replaces the throw with tested behavior only after red proof:

```csharp
namespace ResumeBuilder.Domain.Accounts;

public static class PasswordPolicy
{
    public static string? Validate(string password) => throw new NotImplementedException();
}
```

`backend/src/ResumeBuilder.Application/Accounts/AccountUseCases.cs` has namespace `ResumeBuilder.Application.Accounts`. Keep the DD-P06-12 `IAccountUseCases` interface unchanged. The six constructor dependencies, in order, are `IAccountStore`, `IAccountTokenStore`, `ISessionStore`, `IEmailOutboxStore`, `IClock`, and `IAccountPasswordHasher`. The hasher port is an Application declaration; its later Infrastructure adapter wraps ADR-036's configured ASP.NET Core Identity `PasswordHasher<AccountRecord>` and preserves the rehash-needed outcome. Neither the port nor the class is registered before the red tests.

```csharp
namespace ResumeBuilder.Application.Accounts;

public enum AccountPasswordVerification { Failed, Success, SuccessRehashNeeded }
public interface IAccountPasswordHasher
{
    string HashPassword(AccountRecord account, string password);
    AccountPasswordVerification VerifyPassword(AccountRecord account, string passwordHash, string password);
}

public sealed class AccountUseCases : IAccountUseCases
{
    public AccountUseCases(IAccountStore accounts, IAccountTokenStore tokens,
        ISessionStore sessions, IEmailOutboxStore outbox, IClock clock,
        IAccountPasswordHasher passwordHasher)
    {
        _ = accounts; _ = tokens; _ = sessions; _ = outbox; _ = clock; _ = passwordHasher;
    }

    public Task SignUpAsync(string email, string password, CancellationToken cancellationToken) => throw new NotImplementedException();
    public Task<bool> VerifyEmailAsync(string token, CancellationToken cancellationToken) => throw new NotImplementedException();
    public Task ResendVerificationAsync(string email, CancellationToken cancellationToken) => throw new NotImplementedException();
    public Task<AccountSessionRecord?> LoginAsync(string email, string password, CancellationToken cancellationToken) => throw new NotImplementedException();
    public Task<AccountSessionRecord?> GetSessionAsync(Guid sessionId, CancellationToken cancellationToken) => throw new NotImplementedException();
    public Task LogoutAsync(Guid sessionId, CancellationToken cancellationToken) => throw new NotImplementedException();
    public Task RequestPasswordResetAsync(string email, CancellationToken cancellationToken) => throw new NotImplementedException();
    public Task<bool> ConfirmPasswordResetAsync(string token, string newPassword, CancellationToken cancellationToken) => throw new NotImplementedException();
    public Task<bool> ReauthenticateAsync(Guid sessionId, string password, CancellationToken cancellationToken) => throw new NotImplementedException();
    public Task<bool> ChangePasswordAsync(Guid sessionId, string newPassword, CancellationToken cancellationToken) => throw new NotImplementedException();
    public Task<bool> RequestDeletionAsync(Guid sessionId, CancellationToken cancellationToken) => throw new NotImplementedException();
    public Task<AccountRecord?> GetAccountForExportAsync(Guid accountId, CancellationToken cancellationToken) => throw new NotImplementedException();
}
```

The concrete constructor does not take `IEmailSink`, `IAccountDeletionLedger`, or `IAccountDeletionProcessor`: outbox delivery and the ledger-first purge belong to their separate processor paths. Production wiring, hashing adapter, token generation and all method behavior follow the Test Engineer's red proof. A `NotImplementedException` from these deliberately unimplemented methods is a missing-behavior result, never evidence that a production flow passed; tests must still assert the intended return value or state and be rerun after implementation.

**Exact Backend Developer instruction:** “Before the Test Engineer's next red run, add only the DD-P06-14 `PasswordPolicy`, `IAccountPasswordHasher`, `AccountPasswordVerification`, and `AccountUseCases : IAccountUseCases` compile-only declarations with the exact namespaces, constructor order and return types shown here. Keep DD-P06-12 interface signatures unchanged; do not add registration, endpoint, adapter or account behavior yet. Build the backend and report the exact command and exit code.”

**Exact Test Engineer instruction:** “Keep every existing `/auth/*` account test and add canonical browser-route/alias assertions using DD-P06-13, including `/verify-email` and `/reset-password/confirm` fragment capture and history clearing for both `#t=` and legacy `#token=`. After the Backend Developer's DD-P06-14 declarations compile, write Domain tests against `PasswordPolicy.Validate(string)` and Application tests against the specified `AccountUseCases` constructor and `IAccountUseCases` returns; prove red for missing behavior, not build, DI, container or setup errors. Do not edit the frozen OpenAPI contract, existing tests or acceptance criteria.”

No new ADR is required: ADR-013…015 and ADR-036…039 already accept the product and architecture choices; the P06 allocation is recorded as an ADR-039 amendment. The decision register already marks D-01…03 Accepted and still points to ADR-039. P07/P08/P12/P13 handoffs are recorded in `dependencies.md` and must remain visible at their gates.

### DD-P06-15 login/reset concurrency contract (2026-11-04)

**Decision: approved with explicit conflict, cleanup and ordering rules.** The Backend Developer's reported schedules are possible in the current `AccountUseCases.LoginAsync`: verification uses a snapshot, session creation follows revocation, and `TrySetPasswordHashAsync` has no expected-hash condition. A pre-create check alone leaves the same gap between checking and inserting the session. A cross-collection transaction or credential-version/session-schema change is unnecessary for these two races; retain the accepted ports and session model and add this single member to `IAccountStore` in `backend/src/ResumeBuilder.Application/Accounts/AccountPorts.cs`:

```csharp
Task<bool> TryCompareExchangePasswordHashAsync(
    Guid accountId,
    string expectedHash,
    string replacementHash,
    CancellationToken cancellationToken);
```

The existing `TrySetPasswordHashAsync` signature remains available to explicit password reset/change; **login rehash must use the new member exclusively**. All other DD-P06-12 signatures, records, `IAccountUseCases` methods, and DD-P06-14's six constructor dependencies and their order remain unchanged.

#### Atomic store semantics — Backend Developer

- In one atomic operation, match the account ID, an exact case-sensitive/ordinal `PasswordHash == expectedHash`, and `DeletionRequestedAt == null`; set only `PasswordHash = replacementHash`. Both hash arguments are opaque encoded hashes, never plaintext passwords.
- Return `true` when that condition matched and the write was acknowledged, including when the replacement equals the expected value. Return `false` with no mutation when the account is missing, deletion is marked, or the current hash differs. Do not upsert, retry with a newly read hash, or fall back to the unconditional setter. Infrastructure failures and cancellation propagate; they are not successful comparisons.
- `MongoAccountStore` implements this as a **conditional `FindOneAndUpdateAsync`**, with `_id`, `PasswordHash` and null deletion state in the filter, `$set` of `PasswordHash`, `IsUpsert = false`, and `ReturnDocument.After`; a non-null returned document means `true`. Preserve majority write concern and exact string comparison (simple collation), and use the existing `_id` index. Do not implement a separate read followed by an unconditional update or an in-process lock. MongoDB documents the expected-value filter as the mechanism that prevents concurrent lost updates. [MongoDB 8.0 single-document atomicity](https://www.mongodb.com/docs/v8.0/core/write-operations-atomicity/).

#### Login ordering and result — Backend Developer

1. Keep the existing unknown/deleting-account dummy verification and wrong-password failure. After successful verification, retain the exact hash that was verified as the expected hash.
2. For `SuccessRehashNeeded`, generate the replacement and await the new compare-and-set using the original verified hash. On `false`, return `null` **before creating a session**. On `true`, use this login's replacement hash as the expected hash for the later check. Do not compare against the pre-rehash value or accept another writer's new hash. A competing legitimate rehash may therefore cause one login attempt to fail generically; the user may retry normally.
3. For both `Success` and a successful rehash, create and await persistence of the candidate session, then call `FindByIdAsync(account.Id, ...)` afresh. The check must observe current primary-store state, not the earlier object, a cache, a secondary or a transaction snapshot predating session creation. Preserve primary reads in the Mongo adapter; asynchronous secondary replication can otherwise hide a completed reset. [MongoDB read consistency](https://www.mongodb.com/docs/manual/core/read-isolation-consistency-recency/).
4. Return the candidate only if the account still exists, deletion is unmarked and its hash exactly equals the expected hash from steps 1–2. Otherwise await `ISessionStore.RevokeAsync(candidate.Id, ...)` and return `null`. Revoke only this candidate, not every account session: a valid new-password login may have run concurrently. Cleanup is idempotent if reset already removed the candidate. Once creation has completed, an exception/cancellation during validation must also attempt candidate revocation and must never return a successful login; cleanup must not be skipped merely because the request token was cancelled. Do not swallow persistence/cleanup failures as a successful login.

Reset/change must continue to persist the new hash **before** their awaited revoke-all and must not return success before revocation completes. Reasoning for the approved ordering: if the hash changes before the post-create read, login rejects and removes its candidate even when reset's revoke-all happened before that candidate existed; if the hash changes after the read, the candidate already exists for reset's subsequent revoke-all. An overlapping login may finish first and then be revoked; there is no promise that a concurrent login's 200 response outlives a reset. Rehash compare-and-set separately prevents a reset-winning hash from being overwritten. These are guarantees for the stated concurrent operations, not a claim of transactional crash recovery for the multi-step reset sequence; the separate failure-handling concern in review m-5 remains review work, not an approved exception here.

#### Required tests — Test Engineer writes red, Backend Developer implements green

Use the existing xUnit/Application-through-API-test-project and real-Mongo fixtures. Barriers belong only in test fakes/decorators: use `TaskCompletionSource` with asynchronous continuations or equivalent explicit signals, await the named checkpoint, complete reset, then release login. No `Sleep`, timing-based `Task.Delay`, polling or probabilistic loop may establish the race. Bounded waits may fail a hung test but do not schedule it. Execute the real `AccountUseCases` for login and reset; use synthetic stateful hashes that distinguish old, rehashed and reset credentials. Assert persisted account/session state and use-case results, not only calls to a mock.

| Case | Deterministic arrangement and required assertions | Owner |
|---|---|---|
| Ordinary login control | Existing `P06ValidLoginCreatesOpaqueSessionForOwnAccount` remains intact: unchanged, unverified, non-deleting account logs in and its own opaque session is active. Add any needed assertions in a new case; wrong/unknown-password negatives remain intact. | Test Engineer; BE keeps behavior green |
| Rehash control | Hasher reports `SuccessRehashNeeded`; no competing write. Compare-and-set persists the replacement, login succeeds, and the candidate remains active. This catches comparing the post-create read to the old hash and accidental rejection of every rehash. | Test Engineer; BE implements |
| Reset finishes before candidate insert | Pause ordinary (`Success`) login at `ISessionStore.CreateAsync` **before insertion**, after old-hash verification. Run `ConfirmPasswordResetAsync` through hash write and revoke-all to `true`, then allow insertion and the post-create read. Login returns `null`, that candidate is inactive/removed, the reset hash survives, old-password login fails and new-password login succeeds. Preserve an unrelated account's session. | Test Engineer; BE implements |
| Reset finishes after candidate insert | Pause login after insertion but before its account read; reset completes, then release login. Login returns `null`; reset's already-completed revoke plus login's idempotent cleanup leave no candidate session. Run with ordinary success and rehash success. Also retain the inverse-order regression: login completes first, reset completes second, and the previously returned session is inactive. | Test Engineer; BE implements |
| Reset beats rehash compare-and-set | Pause the store call before the rehash compare-and-set executes, with old-hash verification already reporting `SuccessRehashNeeded`. Complete reset, then release compare-and-set. It returns `false`, login returns `null`, no candidate is created, the exact reset hash is unchanged, old credentials fail and new credentials work. | Test Engineer; BE implements |
| Reset follows successful rehash | Let rehash compare-and-set succeed, then pause before candidate insertion. Complete reset and release login. Login returns `null` and removes the candidate; the reset hash is never replaced by the rehash. This proves that compare-and-set alone does not replace the post-create check. | Test Engineer; BE implements |
| Account disappears or deletion is marked | Pause after candidate insertion and before account read; in separate data rows delete the account or mark deletion, then release. Login returns `null` and removes its candidate even if the hash is otherwise unchanged. Check that unrelated sessions are untouched. | Test Engineer; BE implements |
| Validation cannot complete | After candidate insertion, have the account-read decorator throw or cancel in separate rows. Login never returns a session, attempts cleanup even for an already-cancelled request, and the candidate is removed when the store is available; errors remain failures. | Test Engineer; BE implements |
| Real-Mongo compare-and-set | Matching live account updates only the hash and returns `true`; equal replacement also returns `true`; stale hash, missing ID and deletion-marked account return `false` with no mutation/upsert. Two contenders released from a shared barrier with one expected hash and distinct replacements yield exactly one `true`, and the stored hash is the winner's. Exercise the actual `MongoAccountStore`, not a mock of the Mongo driver. | Test Engineer; BE implements |

For the ordinary-login/reset barrier case, add an API fixture assertion using the real use case and the existing test-service overrides: the losing login maps to the existing **401 `invalid_credentials`**, issues no new authentication cookie, and exposes no concurrency-specific error. No new framework or production synchronization hook is authorized.

**Existing fake-store updates belong to the Test Engineer only.** `P06AccountUseCaseTests.Accounts` in `backend/tests/ResumeBuilder.Api.Tests/P06UnitTests.cs` and `P06FixtureTests.MemoryAccountStores` in `backend/tests/ResumeBuilder.Api.Tests/P06FixtureTests.cs` both implement `IAccountStore` and need the added member. Implement real conditional mutation in those fakes (under their state lock for concurrent tests). The unit fake currently returns `true` without changing state from `TrySetPasswordHashAsync`, and its `Sessions.RevokeAsync` is a no-op: the Test Engineer must supply stateful setters/revocation for these race tests, either by repairing the shared fakes or adding dedicated ones. Keep `P06ValidLoginCreatesOpaqueSessionForOwnAccount`, unknown-login, reset, verification and deletion assertions and expected outcomes; no assertion removal, skip or relaxed expectation is approved. There is currently no dedicated rehash-on-login test to preserve; add the positive and race cases above.

**Handoff sequence:** Backend Developer first declares the new `IAccountStore` member in `AccountPorts.cs`; any concrete production member needed solely to compile this scaffold has an explicit `NotImplementedException` body under DD-P06-07/14, never a default implementation that delegates to the unsafe setter. Test Engineer updates test fakes, adds the cases above and records assertion-red proof after the harness compiles. Backend Developer then implements Mongo atomicity and login validation/cleanup, runs the focused cases and full relevant suite, and appends exact commands/exits to `tests/test-results.md`; BE must not edit existing tests. Reviewer checks this delta, then QA verifies the account flow.

**Compatibility and limits:** This is an additive internal Application port amendment to DD-P06-12, not an HTTP change. Frozen OpenAPI 1.0.0 paths, schemas, `LoginAsync` return shape, statuses, cookies and generic error catalogue remain unchanged; Contract Architect work and type regeneration are unnecessary. AC-P06-03/04/07, every existing test assertion and all unrelated review findings remain in force. ADR-034 transactional-mail/outbox behavior is unchanged, and neither a new product feature nor an exception to TECHNICAL-SPEC §3.2 is introduced. No production source, test or contract is edited by this Architect task.

### DD-P06-16 token comparison and common-password corpus (2026-11-04)

**Context.** Review finding M-2 required either recording how token comparison is realised or switching to an
in-process constant-time compare, and M-3 required a real bundled common-password list.

An earlier revision of this record claimed the build environment had no network access and therefore shipped a
hand-curated list of about 590 entries. That claim was wrong: the first fetch failed with HTTP 404 because the
upstream path had changed, not because the host was unreachable. The corpus was then downloaded and the curated
file replaced, so the mitigation below is the real corpus and the P15 regeneration follow-up is withdrawn.

**M-2 — token redemption is an indexed digest match, not an in-process constant-time comparison.** ADR-036 §6 and
AC-P06-06 say "constant-time comparison". The implementation stores only a SHA-256 digest of a 32-byte random
token and redeems it with a single conditional `FindOneAndUpdate` on `(TokenHash, Purpose, ExpiresAt, UsedAt)`,
now backed by a `(TokenHash, Purpose)` index. This is accepted as satisfying the control, and the deviation from
the literal wording is recorded here rather than papered over:

- The secret is a 256-bit value from `RandomNumberGenerator`, so an attacker cannot usefully steer a comparison;
  there is no low-entropy guess space for a timing oracle to narrow.
- Only the digest is ever persisted or compared, so a timing signal would leak digest bytes, not the token.
- With the index in place the lookup time no longer grows with the number of stored tokens, which was the real
  measurable signal M-2 identified; without it, response time varied with collection size on two unauthenticated
  endpoints.
- An in-process `CryptographicOperations.FixedTimeEquals` after an indexed fetch was considered and rejected as
  adding a second round trip and a plaintext-adjacent comparison path without changing the threat picture.

**M-3 — the bundled list is the upstream breach corpus, with normalisation on top.** The embedded resource
`backend/src/ResumeBuilder.Domain/Accounts/common-passwords.txt` holds the SecLists
`xato-net-10-million-passwords-100000` corpus (MIT-licensed repository; the list is public breach data),
lowercased, de-duplicated and filtered to entries of at least 4 characters: **96,441 entries**, retrieved
2026-11-04. The header records the source URL and the exact refresh command.

Entries below the 10-rune password minimum are kept deliberately, because `PasswordPolicy` normalises before
lookup: it lowercases, strips trailing punctuation and digit affixes, applies the common character substitutions
and rejects keyboard, alphabet and digit sequence slices. This is what makes the control effective rather than
nominal — `password` alone rejects `password1234`, `Password1234` and `password1234!`, variants a flat corpus
lookup would miss unless each happened to be listed.

Two false-positive sources were found and removed while validating the corpus against every password the existing
green tests rely on:

- A rule rejecting any password with two or fewer distinct characters contradicted the accepted
  `P06LengthCountsUnicodeCodePointsAtInclusiveBoundaries` test, which requires a 10-code-point repeated character
  and a 128-character run to be valid. The rule was unrequested scope and was removed; the test was not touched.
- Stripping a trailing letter run unconditionally decapitated hyphenated passphrases, so `signup-password` reduced
  to `signup` and `current-password` to `current`, both corpus entries. The rule now applies only when a pure
  digit run remains, which is the case it existed for (`1234567890a`).

Validated against the installed corpus: 0 false positives across the 22 password values the suite requires to be
valid, and 0 misses across the 13 the review and tests require to be rejected.
