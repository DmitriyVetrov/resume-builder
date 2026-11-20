# ADR-018 — D-06: default sections and values of a blank resume

- Status: **Accepted** (`DELEGATED-DEFAULT`, ADR-051 S-5)
- Decider: operator session (delegated, ADR-051)
- Date: 2026-11-04 (P07, decisions.md DD-P07-02)
- Source IDs: D-06 (TECHNICAL-SPEC §12, recommendation "As in FR-SEC-01"); FR-LIB-02, FR-SEC-01; D-11 and ADR-023; D-19; domain-model §3.2, §3.3; P02 DD-P02-06

## Context

FR-SEC-01 proposes five sections, marked [DECISION D-06]. ADR-023 left the default labels of the Education section to this decision. The contract has no server "blank" operation: the client builds the document and creates it with `source: document`.

## Decision

A blank resume is built in the frontend (`entities/resume`) with these values:

| Field | Value |
|---|---|
| `title` | `Untitled resume` |
| `templateId`, `accentPreset` | `T1`, `0` |
| `language`, `dateFormat` | `en`, `MonthYearLong` |
| `layout` | `M`, spacing 10 / 10 / 1, `A4`, margins 23 on all sides, `bodyFont: null` |
| `header` | empty `fullName` and `headline`, `showPhoto: true`, no contacts |

Sections, in this order, all visible, editable and removable, with `listColumns: null` and `placement: null`:

1. `Professional Summary` — `text`, empty body
2. `Professional Experience` — `entries`, no entries, `labels: null`
3. `Education` — `entries`, no entries, `labels: {title: "Degree", organization: "Institution", location: null}`
4. `Skills` — `list`, no items
5. `Languages` — `inline`, one empty paragraph

Empty sections are not rendered (FR-SEC-07), so a blank resume exports nothing but the header once it has a name. Section titles are English. Nested IDs are client-generated UUIDs. Nothing here seeds resume content (ADR-017).

## Alternatives considered

- **Smaller default set:** contradicts the recommendation with no evidence for it. Rejected.
- **Server-owned blank:** a new endpoint and template data on the server, against DD-P02-06 and FR-TPL-05. Rejected.
- **Labels on Experience too:** the template labels already read correctly there. Rejected.

## Rationale

The spec's own set. D-19 makes the Degree-as-Title, Institution-as-Organization mapping explicit, so the form labels must say so or users will type them into the wrong fields.

## Consequences

P07 implements and tests the builder against the generated contract type and the real API. P08 edits the result. P10 owns T1's data defaults; if it changes them it updates this builder and this ADR.

## Security/privacy impact

None.

## Owner and date

Operator session (delegated, ADR-051), 2026-11-04.
