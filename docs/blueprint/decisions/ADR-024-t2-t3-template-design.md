# ADR-024 — D-12: T2 "Compact" and T3 "Sidebar" designs

- Status: **Accepted** (`DELEGATED-DEFAULT`, ADR-051 S-5)
- Decider: operator (delegated), P10
- Date: 2026-11-05
- Source IDs: D-12 (TECHNICAL-SPEC §12, recommendation "§7 proposal"); FR-TPL-01, 02, 04, 05; FR-CLR-01, 03; FR-HDR-05, 06; FR-SEC-11; §7. Also closes ADR-011 (the same decision, kept for ID stability). Related: ADR-025 (D-13), ADR-026, ADR-027, ADR-028, ADR-030.

## Context

FR-TPL-01 requires three templates. §7 proposes T2 and T3 at the level of layout and accent roles, and leaves tokens open. A template is a data definition (FR-TPL-05), so the tokens must be fixed before anyone writes one.

## Decision

Accept the §7 proposal, with the tokens below. All sizes are the Medium preset, in points, and scale by ADR-027. Line heights come from ADR-028. Markers, rules and the photo do not scale.

| Token | T2 "Compact" | T3 "Sidebar" |
|---|---|---|
| Layout | Single column, one zone | Full-bleed accent band on page 1, then two zones: main 64%, sidebar 36% of the content width, gutter 16 pt |
| Defaults | Font preset M, section spacing 6, entry spacing 6, line spacing 1, margins 23, A4 | Font preset M, section spacing 10, entry spacing 10, line spacing 1, margins 23, A4 |
| Body fonts (first is the default) | IBM Plex Sans, Roboto, PT Serif | Roboto, IBM Plex Sans, PT Serif |
| Accent presets | Teal `#0F6A5B`, Slate `#335776`, Plum `#6A4A9C` | Navy `#2F4F6F`, Forest `#22584D`, Burgundy `#7A2E3A` |
| Accent roles | Headline, entry organization, entry dates, header rule, links | Band background, section titles, links outside the band |
| Name | 22 bold, as typed, ink | 24 regular, uppercase, white on the band |
| Headline | 11 regular, as typed, accent | 11 bold, uppercase, white on the band |
| Contacts | Chips: 9 regular ink on `#E9EDF1`, radius 4, padding 3×6, gap 4, an accent icon per `kind` (FR-HDR-05) | One wrapping line in the band, 9.5 regular white, separated by `•`; links white with no underline |
| Header rule | 1 pt accent under the header block | None |
| Photo | None: never drawn, `showPhoto` untouched | Round, 64 pt, at the left inside the band |
| Section title | 11 bold, uppercase, ink; 6 pt to its content | 12 bold, uppercase, accent; 6 pt to its content |
| Body, `inline` | 9.5 regular ink | 10 regular ink |
| `list` default | Chips: 9 regular ink on `#E9EDF1`, radius 4, padding 3×6, gap 4; `listColumns` 1 or 2 turns them into bullets (DD-P10-08) | 1 column, 10 regular, bullet markers in ink |
| `entries` bullets default | 1 column | 1 column |
| Entry title | 9.5 bold, uppercase, ink | 11 bold, as typed, ink |
| Entry organization | 9.5 regular, accent, on the title row | 10 regular, ink, on the title row |
| Entry location | 9.5 regular ink, meta row left | 10 regular ink, meta row left |
| Entry dates | 9.5 regular accent, meta row right | 10 italic ink, meta row right |
| Entry marker | None | None |
| Continuation top | Margin + 8 pt | Margin + 8 pt |

Ink is `#050505`, as §6.1. Every preset is ≥ 4.5:1 against white (FR-CLR-02's rule applied to all templates), and in T3 that same contrast applies to white text on the band.

Placement follows ADR-025: `list` and `inline` to the sidebar, `text` and `entries` to main, document order within each column. T1 and T2 ignore `placement`.

T3's header band is the header, so PG-06 applies to it. Continuation pages have no band. The contact line sits in the band, because contacts are header content, not a section, and FR-TPL-04 speaks about sections.

## Alternatives considered

- **Contacts at the top of the T3 sidebar (RG MLO1, `img/76`).** The reference does this, but it would put header content in a column that the user's sections flow through, and a long contact list would change where the first sidebar section starts. Rejected.
- **A sidebar background tint.** The reference has one. It adds a colour role §7 does not list, and a tinted column across pages raises FR-PRV-02 parity questions for no content gain. Rejected.
- **T2 with no chips, for ATS friendliness.** §7 proposes chips and text in chips is still selectable. Rejected; the user can pick columns per section (DD-P10-08).

## Rationale

Precedence step 1: the spec recommendation. Tokens are chosen to make T2 denser than T1 and to keep T3 legible in its narrower columns; the contrast rule keeps the RG D6 fix for all three templates.

## Consequences

- `entities/template/t2.ts` and `t3.ts` are plain data against these tables.
- P11 implements chips, band and zones in the engine; P10 implements them in the draft view.
- ADR-010 §9's thumbnail rule still applies from P11.

## Security/privacy impact

None. Icons are inline SVG, not fetched.

## Owner and date

Operator (delegated), 2026-11-05. The owner reviews it after the fact in the P15 decision table.
