# ADR-030 — D-18: link styling

- Status: **Accepted** (`DELEGATED-DEFAULT`, ADR-051 S-5)
- Decider: operator (delegated), P10
- Date: 2026-11-05
- Source IDs: D-18 (TECHNICAL-SPEC §12); §6.2; FR-RTE-03; FR-CLR-03; related ADR-024.

## Decision

Links use the **accent colour with no underline**, in the contact line and in rich text, in the preview and in the PDF. This applies to T1 as recommended, and to T2. In T3 it applies outside the band; inside the band links are white, because the band is accent-coloured (ADR-024). A user's explicit underline mark on a run stays, since that is their formatting (FR-RTE-01). Links stay clickable as PDF annotations (FR-RTE-03, FR-PDF), so the affordance in a PDF does not depend on the underline.

## Alternatives considered

- **Reference default, `#0000EE` underlined.** Adds a colour outside the template's roles (against FR-CLR-03) and reads as a web page, not a document. Rejected per the recommendation.
- **Accent plus underline.** The recommendation says no underline; colour already separates links from `#050505` body text at well over 3:1. Rejected.

## Rationale

The spec recommendation, extended to the other templates so that links behave one way everywhere.

## Consequences

A template definition declares its link role. The draft view and the engine both read it.

## Security/privacy impact

None. URL scheme checks stay as in ADR-010 and P09.

## Owner and date

Operator (delegated), 2026-11-05.
