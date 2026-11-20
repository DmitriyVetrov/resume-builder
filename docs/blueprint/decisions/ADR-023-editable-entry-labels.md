# ADR-023 — D-11: editable entry field labels per section

- Status: **Accepted** (`DELEGATED-DEFAULT`, ADR-035 A-4)
- Decider: Solution Architect (delegated, ADR-035)
- Date: 2026-11-02 (P01, decisions.md DD-P01-23)
- Source IDs: D-11 (TECHNICAL-SPEC §12, recommendation "Yes (Education: Institution / Degree / Location)"); §5.6 entry form; §10.1 `EntriesContent.labels?`

## Context

One entry schema serves every `entries` section. The spec suggests that each section can rename the form labels (for example Degree, Institution).

## Decision

- **Yes.** `EntriesContent.labels` is optional: `{ title?, organization?, location? }`, each a string of 1–40 characters.
- When a label is absent, the editor shows the default label ("Title", "Organization", "Location").
- Labels change **only the editing form**. They are never printed in the preview, PDF or TXT. Their only effect on output is none.
- They are copied with the section and kept on template switch.
- Default labels for the default "Education" section are a P07 matter (D-06).

## Alternatives considered

- **Fixed labels:** less clear for Education and Projects. Rejected by spec precedence.
- **Printing labels in the output:** not asked for by any template spec, and it would change §9 TXT. Rejected.

## Rationale

Precedence step 1: the spec recommendation. The §10.1 model already has the field.

## Consequences

- P02 schema: an optional `labels` object with length limits.
- P08 editor form uses it.
- The domain model (§3) records the limits.

## Security/privacy impact

None. The labels are user text with the same validation and logging rules as other content.

## Owner and date

Solution Architect (delegated, ADR-035), 2026-11-02.
