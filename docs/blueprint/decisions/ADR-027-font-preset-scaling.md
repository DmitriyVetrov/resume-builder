# ADR-027 — D-15: font preset scale factors and rounding

- Status: **Accepted** (`DELEGATED-DEFAULT`, ADR-051 S-5)
- Decider: operator (delegated), P10
- Date: 2026-11-05
- Source IDs: D-15 (TECHNICAL-SPEC §12); FR-LAY-01; §6.9; conflict SC-06.

## Context

FR-LAY-01 gives exact factors, ×0.9 and ×1.2; §6.9 lists rounded sizes without stating the rule (SC-06).

## Decision

- Small ×0.9, Medium ×1.0, Large ×1.2, applied to every text style of every template.
- **Scaled size = the Medium size × factor, rounded to the nearest 0.5 pt**, ties away from zero. Computed in tenths with integer arithmetic so the result cannot depend on floating point.
- This reproduces all of §6.9: 24 → 21.5 / 29; 14 → 12.5 / 17; 11 → 10 / 13; 10 → 9 / 12. SC-06 closes.
- Markers, rules, timeline, chips' padding and radius, photo size and spacing controls do not scale, as recommended.

## Alternatives considered

- **No rounding (21.6, 28.8).** Contradicts §6.9, and fractional sizes add nothing visible. Rejected.
- **Scaling the photo and markers.** RG does not, and it would make spacing feel inconsistent with sizes the user did not ask to change. Rejected per the recommendation.

## Rationale

The one rule that reproduces every value in §6.9 and is simple enough to state.

## Consequences

`resolveDesign` is the only place this is computed. Line heights derive from the rounded size (ADR-028).

## Security/privacy impact

None.

## Owner and date

Operator (delegated), 2026-11-05.
