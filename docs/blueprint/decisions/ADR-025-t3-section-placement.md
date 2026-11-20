# ADR-025 — D-13: T3 sidebar placement chosen per section by the user

- Status: **Accepted** (`DELEGATED-DEFAULT`, ADR-035 A-4)
- Decider: Solution Architect (delegated, ADR-035)
- Date: 2026-11-02 (P01, decisions.md DD-P01-24)
- Source IDs: D-13 (TECHNICAL-SPEC §12, recommendation "Yes"); FR-TPL-03, FR-TPL-04; §7 (T3 proposal); §10.1 `Section.placement?`; related D-12 (ADR-024/ADR-011, still open for P10)

## Context

T3 "Sidebar" places sections in two columns. FR-TPL-04 forbids a template from moving sections by itself. The P02 schema needs to know whether a placement field exists.

## Decision

- **Yes.** `Section.placement` is optional, `main` or `sidebar`.
- `null` means the template default **by section type**: `list` and `inline` go to the sidebar; `text` and `entries` go to main. This matches §7: "Skills, Languages → sidebar".
- The user can override placement per section in the Design tab when T3 is active.
- Document order is kept within each column.
- The field is stored whatever the template. T1 and T2 ignore it, and switching templates keeps it (FR-TPL-03).
- The final T2/T3 designs (D-12) remain a P10 decision. This ADR fixes only the data-model hook, so the P02 schema is stable whatever D-12 decides.

## Alternatives considered

- **Template-defined zones:** this repeats the RG defect that FR-TPL-04 forbids. Rejected.
- **No field until D-12:** P10 would then need a schema change after P02. Rejected.

## Rationale

Precedence step 1: the spec recommendation. Defaults keyed by type need no new "role" field (consistent with DD-P01-28).

## Consequences

- P02: a nullable enum on Section.
- P10/P11: placement UI and the two-column layout if T3 ships.

## Security/privacy impact

None.

## Owner and date

Solution Architect (delegated, ADR-035), 2026-11-02.
