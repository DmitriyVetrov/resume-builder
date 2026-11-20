# ADR-028 — D-16: line spacing step, and the formula against the §6.2 line heights

- Status: **Accepted** (`DELEGATED-DEFAULT`, ADR-051 S-5)
- Decider: operator (delegated), P10
- Date: 2026-11-05
- Source IDs: D-16 (TECHNICAL-SPEC §12); FR-LAY-04; §6.2; README §7.5; conflict SC-03.

## Context

FR-LAY-04 says line height = `round(font size × 1.2) + v × 0.5` pt, default `v = 1`. At that default it gives 12.5 for 10 pt text, where §6.2 lists 10/13, 11/14, 14/18 and 24/31. SC-03 asks which one defines T1's default.

## Decision

- **The step is 0.5 pt, and the FR-LAY-04 formula is normative for every text style of every template.** §6.2's line heights are read as measurements of the reference product.
- `round` rounds to the nearest integer, ties up, on the rounded font size of ADR-027.
- The default `v = 1` gives 12.5 (10 pt), 13.5 (11 pt), 17.5 (14 pt) and 29.5 (24 pt).

## Alternatives considered

- **§6.2 as the default, the formula only for the difference from `v = 1`.** Reproduces the reference CV's line heights exactly, but needs a per-style table for each preset and template, against FR-TPL-05's simple tokens, and makes the FR's formula false at every value of `v`. The reference is not a target where the spec says otherwise: the spec's own note on FR-LAY-04 says why it left RG's rule. Rejected.
- **A per-style special case for the summary (10/14, §6.5).** Nothing in the model identifies a summary (DD-P10-05). Rejected.

## Rationale

FR-LAY-04 is a numbered Must with an exact formula and an explicit reason for differing from the reference; §6.2 records what the reference measured. D-16 changed the rule on purpose, so the measured values cannot still define it. The visible cost is at most 1.5 pt on the name line.

## Consequences

`resolveDesign` computes line heights by this formula. P11's fixtures assert it. P12 measures it in the PDF. SC-03 closes.

## Security/privacy impact

None.

## Owner and date

Operator (delegated), 2026-11-05.
