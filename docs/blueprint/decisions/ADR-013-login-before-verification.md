# ADR-013 — D-01: login before e-mail verification

- Status: **Accepted** (`DELEGATED-DEFAULT`, ADR-035 A-4)
- Decider: Solution Architect (delegated, ADR-035)
- Date: 2026-11-02 (P01, decisions.md DD-P01-15)
- Source IDs: D-01 (TECHNICAL-SPEC §12, recommendation "Allow, but require verification before the first export"); FR-ACC-01 (AC text "can log in only after verification [DECISION D-01]"); conflict SC-02

## Context

The FR-ACC-01 acceptance criterion presupposes strict verification, while the D-01 recommendation allows login first. The decision marker on the AC shows that the AC depends on D-01 (SC-02).

## Decision

Follow the spec recommendation:
- A newly signed-up user **may log in and edit** before verifying the e-mail address.
- **Export (PDF, TXT, copy as text) and the account data archive require a verified address.** The export buttons explain what is missing and offer "resend verification" (FR-TYP-03 style).
- The FR-ACC-01 AC is read as: "receives a verification e-mail, can log in, and can export only after verification".

## Alternatives considered

- **Strict: no login before verification** (the literal FR-ACC-01 AC text). It loses the first session's work when the e-mail is delayed. Rejected by spec precedence: the §12 recommendation answers the decision the AC defers to.
- **No verification gate at all:** account recovery would rely on unverified addresses. Rejected.

## Rationale

Precedence step 1: TECHNICAL-SPEC §12 gives the answer. Gating export keeps the incentive to verify without blocking editing.

## Consequences

- P02: session/me exposes `emailVerified`.
- P06 implements and tests the verified/unverified paths.
- P12: the export UI checks `emailVerified`.
- Because export is client-side (ADR-010), the gate is a product rule. The threat model records that bypassing it exposes only the user's own content (T-EP-04).

## Security/privacy impact

None negative. Unverified accounts hold only their own data. Password reset proves ownership of the address and verifies it (ADR-036 §6), which lets the real owner of an address take over a squatted unverified account.

## Owner and date

Solution Architect (delegated, ADR-035), 2026-11-02.
