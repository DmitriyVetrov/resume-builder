# TPL-01 Test plan

Acceptance criteria are in [plan.md](plan.md). Levels: unit (Vitest, node and jsdom), backend (xUnit), contract
(P02 suite), rendering gate (Node reference + Playwright G2/G7), E2E (Playwright, three browsers).

## Mapping

| AC | Checks |
|---|---|
| AC-TPL-01 | T-01…T-06 (`template/t4.test.ts`), L-01…L-14 (`layout/t4-layout.test.ts`), updated D01 |
| AC-TPL-02 | G-01 (`layout/templates-golden.test.ts`, golden from `main`), R-02 (gate hashes for T1–T3 equal `main`'s), `design.spec.ts` Y10 unchanged |
| AC-TPL-03 | R-01 (`shared.mjs`: T4 over every fixture plus `panel-mirror` and `panel-mirror-long`), L-09 |
| AC-TPL-04 | R-01: G1 (every model line in its PDF rectangle), G2 (raster ≤ 1 % in three browsers), G5, G6, G7 over the T4 cases |
| AC-TPL-05 | P02 contract suite (enum `[T1…T4]`, version 1.1.0); B-01 backend: a `T4` document is created, read and listed |
| AC-TPL-06 | updated C01/C02 (four thumbnails), E-01…E-03 (`template-t4.spec.ts`), updated Y01 (four thumbnails), Y09 (axe on Panel) |
| AC-TPL-07 | T-03 |
| AC-TPL-08 | L-12 (structure plan), L-13 (links); G1/G5 on T4 cases (selectable text, embedded fonts) |
| AC-TPL-09 | Manual, `qa-report.md` |
| AC-TPL-10 | L-14 (the mirror fixture is one A4 page at Medium) |

## New checks

| ID | Level | File | Cases |
|---|---|---|---|
| T-01 | unit | `frontend/src/entities/template/t4.test.ts` | registry: `TEMPLATES` is T1–T4, `definitionOf('T4')` is "Panel"; plain data |
| T-02 | unit | same | zones: left side, panel padding, default placement by type (`text`/`entries` main, `list`/`inline` sidebar) |
| T-03 | unit | same | contrast: every accent ≥ 4.5:1 on white and on its panel; muted ≥ 4.5:1 on every panel; heading and ink ≥ 4.5:1 on white and panel |
| T-04 | unit | same | colour roles: `heading`, `muted`, `panel`, `tint` resolve, panel and tint follow the accent preset |
| T-05 | unit | same | sidebar overrides: the resolved sidebar design merges styles and entry arrangement; T3 has none, so its sidebar design is its main design |
| T-06 | unit | same | fonts Roboto/IBM Plex Sans/PT Serif; contacts title per language |
| L-01 | unit | `frontend/src/entities/layout/t4-layout.test.ts` | left zones: sidebar text at margin + padding; main at margin + sidebar + gutter |
| L-02 | unit | same | panel: the first shape on every page, from the top to the bottom margin, panel colour of the preset |
| L-03 | unit | same | split header: name and headline at the top of the main column; contacts title (localised, uppercase, accent) and contacts with accent markers at the top of the sidebar; no title without contacts |
| L-04 | unit | same | photo: 80 pt, centred in the sidebar, two `decor` shapes behind it; no photo → no image and no decor |
| L-05 | unit | same | section rule: 0.75 pt under each title across the column, navy in main, accent in the sidebar |
| L-06 | unit | same | main entry: accent dot, title and `\| dates` on one row with one baseline, `Organization · Location` italic muted below |
| L-07 | unit | same | a long title pushes the dates line to the next row |
| L-08 | unit | same | compact sidebar entry: no dot; `Organization, Location, dates` muted; description muted |
| L-09 | unit | same | the long mirror: two pages, sidebar continues on page 2 at the continuation top in its column, panel on page 2 |
| L-10 | unit | same | regions: the two header halves are two regions; `anchorAt` on a contact and on the name gives the header |
| L-11 | unit | same | placement override: a `list` set to main sits in main; an `entries` section set to sidebar is compact |
| L-12 | unit | same | PDF structure: header (H1 name, P headline, P contacts title, P contacts), Figure, then sections in document order |
| L-13 | unit | same | links: contact and description links are link rectangles on the page |
| L-14 | unit | same | the mirror fixture is one A4 page at Medium; FR-TPL-03 T1 → T4 → T3 → T1 restores the hash; determinism |
| L-16 | unit | same | R1 review: at the contract maximum (20 contacts × 200 characters, L, spacing 20) the sidebar half breaks between lines, every line stays in the sidebar column above the bottom margin, the oversized header hint is on exactly the pages holding contacts (PG-09 over PG-06, ADR-010 §10); name and headline stay on page 1 |
| L-17 | unit | same | R1 review: a sidebar half taller than a continuation page's room but within page 1's stays whole on page 1 with no hint (PG-06) |
| G-01 | unit | `frontend/src/entities/layout/templates-golden.test.ts` | model, PDF and TXT sha-256 of 13 fixtures × T1–T3 × {A4 M, Letter L} equal `tests/fixtures/layout/t1-t3-hashes.json`, written on `main` before the change |
| B-01 | backend | `backend/tests/ResumeBuilder.Api.Tests/` | `POST /resumes` with a `T4` document succeeds and `GET` returns `T4`; `T9` stays a 422 |
| R-01 | rendering | `tests/rendering/shared.mjs` | T4 joins `TEMPLATES`, every fixture on T4 A4 plus `panel-mirror`, `panel-mirror-long` and `four-pages` Letter on T4 |
| R-02 | rendering (evidence) | `out/reference-hashes.json` | every T1–T3 label equal to the copy taken on `main` (`/tmp/main-reference-hashes.json`) |
| E-01 | E2E | `tests/e2e/template-t4.spec.ts` | T1 → Panel → Sidebar → Classic Timeline by clicks: the stored document differs only in `templateId` at each step and the painted page returns |
| E-02 | E2E | same | under Panel the placement control is shown; Skills defaults to the sidebar, left of Summary; overriding to main moves it |
| E-03 | E2E | same | axe clean with Panel selected, light and dark |

## Changed checks (approved test changes, DD-TPL-09, DD-TPL-15)

- `template.test.ts` D01: the registry is `['T1','T2','T3','T4']` with names including "Panel".
- `design-panel.test.tsx` C01, C02: four radios and four thumbnails.
- `design.spec.ts` Y01: four thumbnails; Y09: axe also with "Panel" selected.
- `lint.test.mjs` `rootFields`: `1.1.0`; `schemas.test.mjs`: enum `[T1, T2, T3, T4]` (done in step 2).

## Red expectation

Every new or changed check fails on an assertion: `TEMPLATES` has three entries, `definitionOf('T4')` falls back
to T1 (so geometry, panel, header and entry assertions fail on values), the backend rejects `T4` with 422, and the
Design tab shows three thumbnails. G-01 is green on the red commit and must stay green.
