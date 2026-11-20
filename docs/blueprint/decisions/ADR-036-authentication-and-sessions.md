# ADR-036 — Authentication and session design

- Status: **Accepted** (`DELEGATED-DEFAULT`, ADR-035 A-4). This is a new register ID for the P00 GOV-04 candidate "Authentication and session design".
- Decider: Solution Architect (delegated, ADR-035)
- Amended: 2026-11-02, P01 review fix loop 1 (code-review m-6: sign-up opens no session; residual RR-6; decisions.md DD-P01-39)
- Date: 2026-11-02 (P01, decisions.md DD-P01-11)
- Source IDs: FR-ACC-01…FR-ACC-06, NFR-08, NFR-09; D-01 (ADR-013), D-02 (ADR-014), D-03 (ADR-015); ARCHITECTURE.md §2, §7; `.claude/rules/03-security-privacy.md`; conflict SC-20

## Context

v1 needs:
- sign-up with e-mail and password;
- e-mail verification;
- login and logout;
- password reset with a 1 h link;
- account deletion with re-confirmation;
- the data archive.

Passwords need a modern adaptive hash, and the rules forbid inventing cryptography. The frontend is a same-origin SPA (ADR-003, ADR-033).

## Decision

1. **First-party accounts** (e-mail plus password) in the Accounts module. There is no external identity provider in v1 (ADR-014). The design keeps `ExternalLogin` addable later.
2. **Password hashing:**
   - ASP.NET Core Identity's `PasswordHasher<TUser>` (package `Microsoft.Extensions.Identity.Core`): PBKDF2-HMAC-SHA512, V3 format;
   - `IterationCount` ≥ **210 000** (the OWASP Password Storage Cheat Sheet value for PBKDF2-HMAC-SHA512);
   - `SuccessRehashNeeded` upgrades the hash on login when the count rises.
   **Password policy:** 10–128 characters, any characters (spaces and Unicode included). Passwords are not truncated, and there are no composition rules. P06 checks new passwords against a bundled list of common passwords; nothing is sent to an external service.
3. **Sessions are server-side and revocable:**
   - ASP.NET Core cookie authentication with a custom `ITicketStore` that keeps the session in the `sessions` collection (TTL index);
   - the cookie carries only an opaque session reference, protected by ASP.NET Core Data Protection;
   - cookie name `__Host-rb_session`, attributes `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/`;
   - lifetime: 14 days sliding, 30 days absolute;
   - the session ID is rotated at login (prevents fixation).
   **Revocation:**
   - logout deletes the session;
   - a password reset or change revokes all of the user's sessions;
   - an account-deletion request revokes all sessions at once.
4. **CSRF:** `SameSite=Strict` plus an antiforgery header token. ASP.NET Core antiforgery issues a readable `XSRF-TOKEN` cookie, and the SPA sends `X-XSRF-TOKEN` on every unsafe method. Unsafe requests also require `Content-Type: application/json` or `multipart/form-data` (photo upload).
5. **Data Protection key ring:** production keeps it in Blob Storage (ADR-009) wrapped by a Key Vault key; locally it uses a file in a Docker volume. Keys rotate every 90 days.
6. **Verification and reset tokens:**
   - 32 random bytes from a cryptographically secure random generator, base64url;
   - only the **SHA-256 hash** is stored (`account_tokens` collection: purpose, userId, expiresAt, usedAt);
   - single use, compared in constant time;
   - lifetimes: verification **24 h**, reset **1 h** (FR-ACC-02);
   - requesting a new token invalidates older tokens of the same purpose;
   - a successful reset also sets `emailVerifiedAt`, because it proves the user owns the address.
7. **Links** carry the token in the URL **fragment** (`/verify-email#t=…`, `/reset-password#t=…`). The SPA posts the token to the API, and those pages send `Referrer-Policy: no-referrer`. A GET request never has a side effect.
8. **Anti-enumeration.** Sign-up, resend-verification and reset-request always return the same response and take roughly the same time. If the address already exists, that address receives an "account already exists" e-mail (ADR-034). Login failures return one generic error. Unknown users are verified against a dummy hash, so timing does not reveal them. **Sign-up never opens a session**, whether or not the address was new: the user logs in explicitly afterwards, so the sign-up response cannot reveal the address. Residual: because login before verification is allowed (§11), someone who signs up with an unregistered address and a password of their choice learns that the address was unregistered when that login succeeds. This is accepted as threat-model RR-6 (low); squatting itself is T-SP-07.
9. **Brute-force defence:** rate limits (ADR-038), plus a per-account failure counter with exponential back-off. After 5 failures in 15 min, the next attempt waits 1, 2, 4… minutes, up to 1 h. This is a delay, not a permanent lock, so it cannot be used to deny service.
10. **Re-authentication.** Account deletion, password change and data export require the current password, at most 5 minutes old.
11. **Unverified accounts (D-01, ADR-013)** may log in and edit. Export and the data archive are gated in the UI until `emailVerifiedAt` is set. The session/profile response exposes `emailVerified`. Export runs client-side (ADR-010), so the gate is a product rule, not a security boundary (threat model T-EP-04).
12. **Guest claim (D-03, ADR-015)** needs no special endpoint. After sign-up or login, the SPA creates the resume from the local draft through the normal create endpoint, with an idempotency key (ADR-037), and uploads the photo through the normal photo endpoint.
13. **Not in v1:** MFA, "log out other sessions" UI, passkeys. All can be added without changing this design.

## Alternatives considered

- **JWT access and refresh tokens in browser storage:** XSS can steal them, and revocation is hard. Rejected.
- **External IdP** (Entra External ID, Auth0, Keycloak): adds a processor with residency checks, cost or operational load, and a redirect-based UX for a simple first-party need. Rejected for v1. The design stays OIDC-ready for D-02 later.
- **Full ASP.NET Core Identity** with `UserManager` and custom Mongo stores: brings many features we would not use, and its default tokens are not single-use. Rejected. We reuse only its hasher and the cookie and antiforgery primitives.
- **Argon2id through a third-party library:** stronger memory hardness, but a non-framework crypto dependency. PBKDF2 at the OWASP iteration count is acceptable and is in-box. Rejected for v1. It can be revisited through the hash-format upgrade path.

## Rationale

The design uses framework primitives only, so nothing is invented. Server-side sessions are revocable, which FR-ACC-03 and password reset need. Strict same-origin cookies give the smallest XSS and CSRF exposure for an SPA. The design is reversible towards OIDC.

## Consequences

- **P02 contract:**
  - endpoints: sign-up, verify, resend-verification, login, logout, reset-request, reset-confirm, change-password, session/me (with `emailVerified`), delete-account, data-export (ADR-010);
  - the 401/403/429 semantics and the antiforgery header.
- P06 implements and tests it: positive and negative cases, token expiry, single use, enumeration timing tolerance, session revocation.
- P13 adds security tests and the key-rotation runbook.

## Security/privacy impact

This ADR is the primary control set for STRIDE spoofing and elevation in the threat model (T-SP-01…05, T-EP-01…04). Stored data is minimised: sessions keep `createdAt`, `lastSeenAt` and `expiresAt`, with no IP address and no user agent. Passwords, tokens and session IDs are never logged.

## Owner and date

Solution Architect (delegated, ADR-035), 2026-11-02.
