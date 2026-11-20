# ADR-020 — D-08: no import of existing resumes in v1

- Status: **Superseded** by [ADR-055](ADR-055-cv-import.md) (owner decision O-1, 2026-11-15); originally Accepted (`DELEGATED-DEFAULT`, ADR-035 A-4)
- Decider: Solution Architect (delegated, ADR-035)
- Date: 2026-11-02 (P01, decisions.md DD-P01-20)
- Source IDs: D-08 (TECHNICAL-SPEC §12, recommendation "Not in v1; own-TXT import could come in v1.1"); exclusion X8; conflict SC-11

## Context

X8 excludes uploading and parsing an existing resume and is tagged [DECISION D-08].

## Decision

**Not in v1.** No PDF, DOCX or TXT import, and no parser. X8 stays excluded. Own-TXT import (§9 format) is a v1.1 candidate and needs a new ADR that changes the scope.

## Alternatives considered

- **Own-TXT import in v1:** cheap, but it is scope creep beyond the excluded list, and the §9 grammar is lossy (formatting is dropped). Rejected.

## Rationale

Precedence step 1: the spec recommendation and the strict exclusion reading (PD-P00-05, Q-2).

## Consequences

P02 has no import endpoint. The guest claim (ADR-015) is not an import: it creates from our own canonical JSON draft.

## Security/privacy impact

No document parsers in the attack surface.

## Owner and date

Solution Architect (delegated, ADR-035), 2026-11-02.
