# ADR-022 — D-10: no monetization or paywall

- Status: **Accepted** (`DELEGATED-DEFAULT`, ADR-035 A-4)
- Decider: Solution Architect (delegated, ADR-035)
- Date: 2026-11-02 (P01, decisions.md DD-P01-22)
- Source IDs: D-10 (TECHNICAL-SPEC §12, recommendation "Out of scope for this specification"); exclusion X10; principle P5; conflict SC-11

## Context

X10 excludes the paywall and subscriptions and is tagged [DECISION D-10].

## Decision

**Out of scope.** There is no paywall, subscription, payment processing, entitlement check or upsell (P5, X11). The architecture has no plan or entitlement fields.

## Alternatives considered

- **Entitlement hooks "for later":** speculative design with no requirement. Rejected.

## Rationale

Precedence step 1: the spec recommendation and the strict exclusion reading (PD-P00-05, Q-2).

## Consequences

P02 defines no billing or entitlement schemas.

## Security/privacy impact

No payment data and no PCI scope.

## Owner and date

Solution Architect (delegated, ADR-035), 2026-11-02.
