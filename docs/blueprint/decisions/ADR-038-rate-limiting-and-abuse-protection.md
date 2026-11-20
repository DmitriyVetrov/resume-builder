# ADR-038 — Rate limiting and abuse protection

- Status: **Accepted** (`DELEGATED-DEFAULT`, ADR-035 A-4). This is a new register ID for the P00 GOV-04 candidate "Rate limiting".
- Decider: Solution Architect (delegated, ADR-035)
- Date: 2026-11-02 (P01, decisions.md DD-P01-13)
- Source IDs: NFR-08, NFR-12, FR-ACC-01, FR-ACC-02, FR-PHO-01; ARCHITECTURE.md §2 ("rate limiting requires threat model and ADR"); conflict SC-20

## Context

The authentication endpoints, the e-mail-sending endpoints and uploads are abuse targets: credential stuffing, e-mail bombing and storage exhaustion. NFR-09 forbids third-party trackers, which rules out third-party CAPTCHA in the editor.

## Decision

1. **Mechanism:**
   - ASP.NET Core built-in rate limiting middleware (`Microsoft.AspNetCore.RateLimiting`, in-box in .NET 10) with named policies;
   - partitions by client IP, which the trusted ingress forwards; only the platform's forwarded-header hop is trusted;
   - additionally by user ID for authenticated routes, and by normalised e-mail for account e-mail routes;
   - counters that must hold across instances (login failure back-off, e-mails per address) live in MongoDB; the rest are per instance, an accepted approximation for v1.
2. **Default limits** (P02 documents them as 429 with `Retry-After`; P06 and P13 may tighten them and must record the change):

| Policy | Partition | Limit |
|---|---|---|
| `auth-login` | IP | 10 per minute, burst 10 |
| `auth-login` | account | back-off after 5 failures in 15 min (ADR-036) |
| `auth-email` (sign-up, resend, reset request) | IP | 5 per 10 minutes |
| `auth-email` | e-mail address | 5 messages per hour (ADR-034) |
| `doc-write` | user | 120 per minute (autosave ≤ 1 per second per tab, with headroom for 2 tabs) |
| `photo-upload` | user | 20 per hour |
| `data-export` | user | 3 per hour |
| `client-events` | IP | 30 per minute |
| `global` | IP | 600 per minute |

3. **Size limits:**
   - request body ≤ 1 MB for JSON, ≤ 6 MB for multipart photo upload (5 MB file plus overhead);
   - Kestrel header and body limits are set explicitly;
   - JSON maximum depth 64.
4. **Domain limits** (NFR-12, domain-model §5) are validated in the domain, not only in middleware.
5. **Bots on sign-up:** v1 relies on rate limits and e-mail verification. If abuse appears, a self-hosted, privacy-preserving proof-of-work challenge (no third party) is the escalation, recorded as a P13 or P15 follow-up. No third-party CAPTCHA (NFR-09).

## Alternatives considered

- **Platform-only limits at ingress:** coarse, with no per-account or per-email partitions. Kept as an extra outer layer if Container Apps offers it.
- **Redis for distributed counters:** an extra service for v1 load. Rejected. Mongo covers the counters that must be global.
- **Third-party CAPTCHA (reCAPTCHA, hCaptcha):** trackers, which violates NFR-09. Rejected.

## Rationale

In-box middleware, explicit policies and testable numbers, with no extra infrastructure. Limits are generous for real users (autosave at 1/s) and strict where abuse is cheap (e-mail, login).

## Consequences

- P02 adds 429 responses and `Retry-After` to the affected operations.
- P04 wires the middleware and the forwarded-headers trust.
- P06 adds the account policies and tests.
- P13 adds load and abuse tests.

## Security/privacy impact

This mitigates threat-model T-DS-01…03 and T-SP-02 (credential stuffing). Rate-limit logs record the policy name and partition **type** only; IP addresses go only to the 30-day security log (ADR-039).

## Owner and date

Solution Architect (delegated, ADR-035), 2026-11-02.
