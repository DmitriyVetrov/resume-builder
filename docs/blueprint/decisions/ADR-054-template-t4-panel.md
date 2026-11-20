# ADR-054 — Template T4 "Panel": a fourth template with a left sidebar panel and a split header

- Status: **Accepted** (owner decision 2026-11-14/15, details `DELEGATED-DEFAULT`)
- Decider: Owner (scope: a fourth template, before P14); Operator (design tokens and engine model, delegated, ADR-051 S-5)
- Date: 2026-11-15 (change TPL-01, outside the phase sequence, before P14)
- Source IDs: FR-TPL-01, FR-TPL-02, FR-TPL-03, FR-TPL-04, FR-TPL-05; FR-CLR-01, FR-CLR-03; TECHNICAL-SPEC §3.2 X6; §7; ADR-010 (one layout engine), ADR-024 (template designs), ADR-025 (placement), ADR-027 (size presets), ADR-028 (line heights)
- Work package: `docs/blueprint/changes/TPL-01-template-t4/`

## Context

TECHNICAL-SPEC fixes the template count at three: FR-TPL-01 ("Three templates: T1, T2, T3"), FR-TPL-02
("three thumbnails") and the exclusion X6 ("Template gallery with filters, more than three templates").
ADR-024 decided the designs of T2 and T3 within that count.

On 2026-11-14/15 the owner changed the scope (handoff decision O-1): build a fourth template, T4, modelled
on the owner's reference CV, a two-column layout with a tinted sidebar panel on the **left**, a split header
(name and headline over the main column; photo and contacts at the top of the sidebar), uppercase section
titles with a thin rule, and entries set as "Title | Dates" over an italic "Organization · Location" line.
It lands before P14, together with CV import (ADR-055), which selects T4 for a CV with a left sidebar.

TECHNICAL-SPEC outranks ADRs in the source hierarchy, so this ADR records the owner override explicitly
rather than reconciling silently (PROJECT-CHARTER, "Source-of-truth hierarchy").

## Decision

1. **Owner override of the source specification.** For this product:
   - FR-TPL-01 reads "four templates: T1 Classic Timeline (default), T2, T3, T4";
   - FR-TPL-02 reads "four thumbnails";
   - X6 is lifted **only** for "more than three templates". The template gallery with filters stays excluded.
   - FR-TPL-03, FR-TPL-04 and FR-TPL-05 apply to T4 unchanged. FR-TPL-05's own acceptance ("adding a fourth
     template later needs no change to the content model") holds: the `ResumeDocument` model is unchanged;
     only the `templateId` enum gains `T4`.
2. **T4 "Panel" tokens** (Medium preset, points; sizes scale by ADR-027, line heights by ADR-028):

| Token | T4 "Panel" |
|---|---|
| Layout | Two zones: **sidebar on the left** 34 % of the content width, gutter 18 pt, main on the right. A filled panel behind the sidebar column, inset by the page margins, on every page; sidebar text has 10 pt inner padding |
| Defaults | Font preset M, section spacing 4, entry spacing 6, line spacing 1, margins 23, A4 |
| Body fonts (first is the default) | Roboto, IBM Plex Sans, PT Serif |
| Accent presets (accent / panel / tint) | Teal `#157A95` / `#F2F6F7` / `#D3E9EF`; Steel `#2E5E8C` / `#F2F5F9` / `#D8E3EF`; Plum `#8A3B5C` / `#F8F2F4` / `#EFD9E2` |
| Fixed colours | Body ink `#2B3440`, headings navy `#1F3446`, muted `#5B6673` |
| Accent roles | Headline, entry dates, sidebar section titles and their rule, bullet and entry markers, links |
| Header | **Split**: name 22 bold navy and headline 13 bold accent at the top of the main column; at the top of the sidebar a round 80 pt photo with two accent-tint circles behind it, then a localised "Contact / Contacto / Контакти" title styled as a sidebar section title, then the contacts as a bulleted list (8.5 regular ink, accent markers in a 6.5 pt slot, 1 pt between items). Neither half splits across pages (PG-06); a half longer than page 1's room breaks between lines and raises the oversized hint, as T1–T3's header does (PG-09 over PG-06, ADR-010 §10) |
| Section title, main | 11 bold uppercase navy, 0.75 pt navy rule below across the column |
| Section title, sidebar | 8.5 bold uppercase accent, 0.75 pt accent rule below across the column |
| Body | 8.5 regular ink in main; muted in the sidebar |
| Entry, main | Accent dot before the title; row 1 **Title** (8.5 bold navy) `\|` **dates** (8.5 bold accent); row 2 *Organization · Location* (8.5 italic muted); then the description |
| Entry, sidebar (compact) | Title 8.5 bold navy; one muted line "Organization, Location, dates"; description muted; no marker; the gap between entries is one third of the entry spacing |
| `list` default | 1 column, accent markers |
| Default placement (ADR-025) | `text`, `entries` → main; `list`, `inline` → sidebar |
| Continuation top | Margin + 8 pt |

   Every accent preset is ≥ 4.5:1 on white and on its own panel; muted is ≥ 4.5:1 on every panel
   (measured 4.94/4.54, 6.78/6.20, 7.34/6.64; muted 5.29–5.37).
3. **The engine stays one data-driven algorithm (ADR-010, FR-TPL-05).** The template model gains only data:
   a zone side (`left | right`, default right), a sidebar panel, sidebar overrides (styles, gaps and entry
   arrangement merged over the main definition), a section-title rule, an entry head arrangement
   (`classic | title-dates | compact`), an entry dot marker, a `split` header kind with photo decoration and a
   localised contacts title, a `list` contacts style, a sidebar entry-gap factor, and the colour roles `heading`, `muted`, `panel` and
   `tint`. There is no `if (id === 'T4')`. Absent fields reproduce today's behaviour, so T1, T2 and T3 render
   byte-identically.
4. **ADR-025 extends to a left sidebar.** Placement is unchanged: per section, nullable, defaults by type,
   document order kept within each column, and the field is stored whatever the template. The Design tab's
   placement control applies to T4 as it does to T3.
5. **Reading order** (FR-PDF-08) is T3's: the header (name, headline, contacts title, contacts), the photo
   figure, then the sections in document order. A screen reader or ATS reads the same order on both two-column
   templates; CV import (ADR-055) orders main sections before sidebar sections, so an imported CV reads header,
   main, sidebar.
6. **Contract.** `templateId` in `ResumeDocument` and in the resume summary gains `T4`; `info.version`
   becomes `1.1.0` (additive minor, ADR-006 §5). The backend accepts and returns `T4`.
7. `ENGINE_VERSION` becomes `1.2.0` (new layout behaviour), and joins the server's logged engine list.

## Alternatives considered

- **T4 as a T3 variant (a "left" accent preset of T3):** one fewer template ID, but FR-TPL-03 maps the
  accent index across templates, and T3's band header and entry arrangement differ from the reference CV
  throughout. Rejected.
- **Template-specific code for T4:** fastest, but breaks FR-TPL-05 and ADR-010's "templates are data".
  Rejected.
- **A new bundled font closer to Helvetica Neue:** closer to the reference, but every golden of every
  template would churn and font licensing would need review. Rejected; Roboto is the closest bundled face.

## Rationale

Owner decision O-1 sets the scope. The tokens are measured from the reference CV (handoff §4) and adjusted
to the 0.5 pt size step of ADR-027 and to WCAG 1.4.3 on both backgrounds.

## Consequences

- TPL-01 adds a T4 definition, engine branches driven by the new fields, a contract minor version, a backend
  enum value, a fourth Design-tab thumbnail, and T4 cases in the rendering gate.
- T1, T2 and T3 goldens, page screenshots and PDF bytes must not change (TPL-01 AC-TPL-02).
- Follow-up for the owner: TECHNICAL-SPEC §3.2 (X6), §5.8 (FR-TPL-01, FR-TPL-02) and §12 (D-12) may be
  updated to match; until then this ADR is the record of the override.

## Security/privacy impact

None. No new network access, font source or stored field; the template is data in the client bundle.

## Owner and date

Owner (scope, 2026-11-14/15); operator (details, delegated), 2026-11-15.
