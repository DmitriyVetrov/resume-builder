# ADR-034 — Transactional e-mail delivery

- Status: **Accepted** (`DELEGATED-DEFAULT`, ADR-035 A-4)
- Decider: Solution Architect (delegated, ADR-035)
- Date: 2026-11-02 (P01, decisions.md DD-P01-10)
- Source IDs: Register ADR-034 (OPEN, needed by P06, EU processing per NFR-09); FR-ACC-01 (verification), FR-ACC-02 (reset, 1 h expiry), FR-ACC-03; NFR-08, NFR-09; exclusion X7 ("send by email" of resumes); ARCHITECTURE.md §2 ("email delivery requires threat model and ADR")

## Context

Accounts need verification and password-reset e-mails. Resume content must never be e-mailed: X7 excludes sending resumes, and P5 rules out pre-ticked e-mail. Processing must stay in the EU.

## Decision

1. **Scope.** The system sends only **account-transactional** messages, plain and minimal:
   - e-mail verification;
   - password reset;
   - "this address already has an account" (anti-enumeration path, ADR-036);
   - password-changed notice;
   - account-deletion confirmation.
   There are no attachments, no resume content, no marketing and no tracking pixels or click-tracking redirects.
2. **Port and adapter:**
   - an `IEmailSender` port in Application;
   - an **SMTP** adapter in Infrastructure, using a maintained OSI-licensed SMTP client (MailKit, MIT, is the default candidate, confirmed in P06);
   - templates are plain text plus simple HTML, stored in the backend;
   - links use the configured public base URL, never the request `Host` header.
3. **Local and CI:** **Mailpit** in Docker Compose catches all mail. Tests read it through its API.
4. **Production (on paper; go-live owner action):** **Azure Communication Services Email**, using its SMTP relay or SDK behind the same port, with data location **Europe**, a verified custom domain, and SPF, DKIM and DMARC (`p=quarantine` or stricter).
   - Go-live verifies in the product terms that message processing and logs stay in the EU.
   - If it cannot, the fallback is an EU-headquartered provider with EU processing (Brevo or Mailjet) through the same SMTP adapter. Only configuration changes.
5. **Sending** runs out of band from the request. A Mongo-backed outbox with retry and backoff is processed by a hosted job (ADR-007). A failed delivery never blocks sign-up. The user can ask to resend.
6. **Rate limits:** per address and per IP (ADR-038), at most 5 account e-mails per address per hour.

## Alternatives considered

- **SendGrid, Postmark or Amazon SES outside the EU:** US processing. Rejected.
- **Amazon SES eu-central-1:** EU-capable, but adds a second cloud vendor. Rejected for v1.
- **Running our own MTA:** poor deliverability and operational burden. Rejected.
- **The provider's HTTP API instead of SMTP:** more features, but provider lock-in. SMTP keeps the adapter portable. Rejected for v1.

## Rationale

SMTP is a standard, reversible port. Mailpit gives full local fidelity. The ACS Europe data location keeps the processor aligned with ADR-012 and ADR-033, and the EU fallback is ready without code change.

## Consequences

- P03 adds Mailpit to Compose.
- P06 implements the sender, templates, outbox, resend and the anti-enumeration message.
- P13 adds delivery-failure metrics without addresses in logs.
- P15 configures the domain and DNS.

## Security/privacy impact

- Tokens appear in links only as URL **fragments** (`/verify-email#token=…`), so they never reach server logs or `Referer` headers (ADR-036, threat model T-ID-03).
- E-mail addresses are not written to logs; log the user ID and the message type.
- SPF, DKIM and DMARC prevent spoofing of our domain.
- No resume content is ever sent by e-mail (X7).

## Owner and date

Solution Architect (delegated, ADR-035), 2026-11-02.
