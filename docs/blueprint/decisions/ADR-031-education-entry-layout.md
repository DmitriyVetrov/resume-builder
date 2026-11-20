# ADR-031 — D-19: Education entry layout in T1

- Status: **Accepted** (`DELEGATED-DEFAULT`, ADR-051 S-5)
- Decider: operator (delegated), P10
- Date: 2026-11-05
- Source IDs: D-19 (TECHNICAL-SPEC §12); §6.7 "Education variant"; ADR-018 (Education labels), ADR-023 (labels are form-only).

## Decision

**No variant.** Education uses the same entry block as Experience: Degree is Title, Institution is Organization, printed on the title row in accent colour. As recommended.

## Alternatives considered

- **The §6.7 variant: organization on the meta row, before the location.** Would need the template to know which section is "Education", and sections have only a type and a free title (§2 P2, DD-P10-05). A user-renamed section would lose the rule. Rejected.

## Rationale

One block for all `entries` sections, with no role field, and the §6.7 row's own decision marker asks exactly this question.

## Consequences

The single-entry rule (§6.7: dot, no line) still applies, to any `entries` section with one visible entry, as it did to the reference Education.

## Security/privacy impact

None.

## Owner and date

Operator (delegated), 2026-11-05.
