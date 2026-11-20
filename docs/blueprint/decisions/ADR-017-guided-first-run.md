# ADR-017 — D-05: no guided first run and no seeded sample resume

- Status: **Accepted** (`DELEGATED-DEFAULT`, ADR-051 S-5)
- Decider: operator session (delegated, ADR-051)
- Date: 2026-11-04 (P07, decisions.md DD-P07-01)
- Source IDs: D-05 (TECHNICAL-SPEC §12, recommendation "No for v1; the workspace with a sample resume is enough"); §3.2 X2, X5, X11; §5.3; P1 (no pre-written content); domain-model §10

## Context

§5.3 asks whether to add an optional step-by-step first run. The recommendation answers no, and mentions a sample resume. X2 forbids pre-written example libraries, and §3.2 says help text "must never contain sample resume content to copy". Domain-model §10 flagged the tension for P07.

## Decision

- **No guided first run in v1.** No wizard, questionnaire or tips carousel.
- **No seeded sample resume.** A first-time user sees the empty library with one call to action, and gets the blank resume of ADR-018.
- Short static hints under fields stay allowed; they never contain resume content.

## Alternatives considered

- **Optional wizard:** the reference's wizard is the defect §5.3 removes, and it would need its own flow in P08. Rejected.
- **Sample resume in the library or workspace:** the recommendation's wording, but its text is copyable sample content, which conflicts with X2 and P1 at higher precedence than a recommendation. Rejected.

## Rationale

The "no" is the spec's. Dropping the sample follows the source hierarchy: explicit exclusions and principles over a remark in a recommendation column.

## Consequences

P07 builds the empty state. P08 opens the workspace on the blank resume directly. If first-run confusion shows up after release, a sample with clearly placeholder text is a new product decision.

## Security/privacy impact

None. No content is seeded, so nothing fictional can be mistaken for user data.

## Owner and date

Operator session (delegated, ADR-051), 2026-11-04.
