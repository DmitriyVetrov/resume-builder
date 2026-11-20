# ADR-014 — D-02: Google sign-in

- Status: **Accepted** (`DELEGATED-DEFAULT`, ADR-035 A-4)
- Decider: Solution Architect (delegated, ADR-035)
- Date: 2026-11-02 (P01, decisions.md DD-P01-16)
- Source IDs: D-02 (TECHNICAL-SPEC §12, recommendation "Later"); FR-ACC-05 (Could)

## Context

FR-ACC-05 is a Could requirement and depends on D-02. An external identity provider changes the auth architecture and threat model.

## Decision

**Not in v1.** No Google or other external sign-in is built. The account model and ADR-036 keep it addable later as an additional login method linked to an existing verified e-mail.

## Alternatives considered

- **Include Google sign-in in v1:** adds Google as a processor (EU residency review), OAuth flows and account-linking edge cases for a Could item. Rejected.

## Rationale

Precedence step 1: the spec recommends "Later". It is also the conservative and reversible option.

## Consequences

FR-ACC-05 is out of v1 scope (traceability marks it "deferred by ADR-014"). P02 defines no external-login endpoints.

## Security/privacy impact

A smaller attack surface, and no third-party identity processor.

## Owner and date

Solution Architect (delegated, ADR-035), 2026-11-02.
