# ADR-016 — D-04: trash for deleted resumes

- Status: **Accepted** (`DELEGATED-DEFAULT`, ADR-035 A-4)
- Decider: Solution Architect (delegated, ADR-035)
- Date: 2026-11-02 (P01, decisions.md DD-P01-18)
- Source IDs: D-04 (TECHNICAL-SPEC §12, recommendation "Yes, 30 days"); FR-LIB-04; NFR-12; ADR-039

## Context

FR-LIB-04 sends deleted resumes to a trash for 30 days and is tagged [DECISION D-04].

## Decision

- **Yes, a 30-day trash.** Deleting sets `deletedAt` and removes the resume from the library. The trash view lists trashed resumes with the remaining days.
- **Restore** clears `deletedAt` (with an `If-Match` version).
- **Delete permanently** purges at once.
- The hourly purge job deletes resumes with `deletedAt` older than 30 days, together with their photo blobs and snapshots (ADR-039).
- **Limit (NFR-12):** "≤ 200 resumes per user" counts active **and** trashed, non-purged resumes. At the limit, create returns `limit_reached`, and the UI suggests emptying the trash.
- Trashed resumes are read-only.

## Alternatives considered

- **Immediate hard delete with undo only:** contradicts FR-LIB-04. Rejected.
- **Not counting trash toward the limit:** lets storage grow without bound through delete cycles. Rejected.

## Rationale

Precedence step 1: the spec recommends "Yes, 30 days". Counting trash in the limit is the strict, abuse-safe reading of NFR-12.

## Consequences

- P02: trash list, restore and permanent-delete operations.
- P07 implements them. P13 implements and tests the purge job.

## Security/privacy impact

Trash is owner-scoped. Account deletion purges trash too (FR-ACC-03, ADR-039).

## Owner and date

Solution Architect (delegated, ADR-035), 2026-11-02.
