# ADR-026 — D-14: T1 accent colours

- Status: **Accepted** (`DELEGATED-DEFAULT`, ADR-051 S-5)
- Decider: operator (delegated), P10
- Date: 2026-11-05
- Source IDs: D-14 (TECHNICAL-SPEC §12); FR-CLR-01, 02, 03; §6.2. Research-only palette: SC-15.

## Decision

T1's presets are **Blue `#2A68A0`** (index 0, default), **Navy `#335776`** (1), **Graphite `#333333`** (2), as recommended. `accentPreset` stores the index, so a template switch keeps the index and the colour maps to the same slot (FR-TPL-03). The T1 colour roles are those of §6.2: full name, section titles, entry organization, all bullet markers, contact-line separators, timeline dots, plus links (ADR-030). A test asserts ≥ 4.5:1 against white for each preset.

## Alternatives considered

- **The RG palette (README §14.2).** Research evidence only, and its pale colours are RG defect D6. Rejected.

## Rationale

The spec recommendation; all three pass WCAG AA for text on white (5.86:1, 7.59:1, 12.63:1 by the WCAG formula, and a test computes them).

## Consequences

Colour is a resume setting, not a free value (FR-CLR-04 stays excluded).

## Security/privacy impact

None.

## Owner and date

Operator (delegated), 2026-11-05.
