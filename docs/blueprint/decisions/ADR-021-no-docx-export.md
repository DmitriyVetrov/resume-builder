# ADR-021 — D-09: no DOCX export in v1

- Status: **Accepted** (`DELEGATED-DEFAULT`, ADR-035 A-4)
- Decider: Solution Architect (delegated, ADR-035)
- Date: 2026-11-02 (P01, decisions.md DD-P01-21)
- Source IDs: D-09 (TECHNICAL-SPEC §12, recommendation "Not in v1"); exclusion X9; conflict SC-11

## Context

X9 excludes DOCX export and is tagged [DECISION D-09].

## Decision

**Not in v1.** The exports are PDF and TXT only (FR-PDF, FR-TXT). X9 stays excluded.

## Alternatives considered

- **DOCX through a library:** DOCX cannot reproduce the shared layout (FR-PRV-02), so it would break principle P3. Rejected.

## Rationale

Precedence step 1: the spec recommendation and the strict exclusion reading (PD-P00-05, Q-2).

## Consequences

The export UI offers exactly two formats.

## Security/privacy impact

None.

## Owner and date

Solution Architect (delegated, ADR-035), 2026-11-02.
