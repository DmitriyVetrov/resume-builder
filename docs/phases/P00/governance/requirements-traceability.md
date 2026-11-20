# Requirement Traceability Matrix — P00 (GOV-02)

Maps every requirement ID of `docs/source/TECHNICAL-SPEC.md` (baseline in GOV-01) to the phases that design, implement or verify
it. Phase choices follow the Objective and DoD of each `docs/phases/Pxx/PHASE.md`. Mapping a requirement to a phase does not
design it; open decisions stay open (GOV-04), and conflicts are logged in GOV-05.

## Requirements

| Req ID | Pri | Spec section | Summary | Phases | Primary phase | Verification | Decision deps | Notes |
|---|---|---|---|---|---|---|---|---|
| FR-ACC-01 | M | §5.1 | Sign-up with e-mail and password plus e-mail verification; AC allows login only after verification | P01, P02, P06, P14 | P06 | unit, integration, contract, e2e, security | D-01, ADR-034 | AC presupposes one answer to D-01 (SC-02). P01 DoD confirms auth; the auth and session design has no register ID (GOV-04 candidates) |
| FR-ACC-02 | M | §5.1 | Log in, log out and password reset by e-mail; the reset link expires (default 1 h) | P01, P02, P06, P14 | P06 | unit, integration, contract, e2e, security | ADR-034 | Token expiry is named in the P06 DoD |
| FR-ACC-03 | M | §5.1 | Delete the account with all data: resumes, photos and exports removed within 24 h of confirmation | P02, P06, P13 | P13 | integration, contract, e2e, security | ADR-009 | P06 builds the deletion flow, but resumes, photos and exports exist only from P07/P12, so P13 (data lifecycle) shows the full AC. Retention of backups, trash and snapshots is open (SC-08) |
| FR-ACC-04 | S | §5.1 | Download all my data as one archive: resume JSON plus the latest PDF and TXT | P02, P06, P12, P13 | P13 | integration, contract, e2e, security | ADR-009 | The latest PDF/TXT exist only from P12; whether exports are stored is open (SC-09) |
| FR-ACC-05 | C | §5.1 | Optional sign-in with Google | P01, P02, P06 | P06 | review, integration, e2e, security | D-02 | Built only if D-02 brings it into v1 (source recommendation: later) |
| FR-ACC-06 | C | §5.1 | Guest mode: build a resume in the browser without an account and claim it after sign-up | P01, P02, P06, P08 | P06 | review, unit, integration, e2e, security | D-03 | Guest-to-account claim needs a threat model in P01. Built only if D-03 brings it into v1 |
| FR-CLR-01 | M | §5.9 | Each template offers exactly three accent colors; one is selected per resume with a check mark | P07, P10 | P10 | unit, component | D-12, D-14 | T1 presets under D-14; T2/T3 presets come with D-12 |
| FR-CLR-02 | M | §5.9 | T1 presets Blue, Navy and Graphite, each with contrast of at least 4.5:1 on white | P10 | P10 | unit, accessibility, rendering | D-14 | README §14.2 palette is research only (SC-15) |
| FR-CLR-03 | M | §5.9 | The accent applies only to the template's color roles; body text stays near-black | P10, P11, P12 | P10 | rendering | D-18 | D-18 decides whether T1 links use the accent |
| FR-CLR-04 | W | §5.9 | Won't: free color picker or custom hex value | P02, P10 | P10 | contract, review, guard | — | Exclusion row in GOV-03 |
| FR-EDT-01 | M | §5.3 | Single workspace with section, editing and preview panels, all visible at 1280 px | P05, P08, P11 | P08 | component, e2e, performance | D-05 | Preview latency (NFR-01) is shown in P11. D-05 (optional guided first run) changes how the workspace is entered |
| FR-EDT-02 | M | §5.3 | Section panel lists the header and all sections in document order with type icon, title and hidden state | P08 | P08 | component, e2e | — | — |
| FR-EDT-03 | M | §5.3 | Clicking a section in the panel opens its form and scrolls the preview to within one line of it | P08, P11 | P11 | component, e2e | — | P08 delivers selection and form; the scroll target needs the P11 page model |
| FR-EDT-04 | S | §5.3 | Clicking a section in the preview selects it and opens its form | P08, P11 | P11 | component, e2e | — | Same behaviour as FR-PRV-08 (M) at priority S (SC-27) |
| FR-EDT-05 | M | §5.3 | Design controls (template, color, layout) live in a Design tab of the preview panel | P08, P10 | P10 | component, e2e | — | P08 provides the tab; the controls arrive in P10 |
| FR-EDT-06 | M | §5.3 | Top bar with editable title, save status, undo, redo, Export PDF and Export TXT | P08, P12 | P08 | component, e2e | — | Save states per FR-PER-02; the export actions are wired in P12 |
| FR-EDT-07 | S | §5.3 | Below 1024 px the panels become tabs; every function is reachable on a 390 px wide phone | P05, P08, P14 | P08 | component, e2e, accessibility | — | Priority S while NFR-05 (M) requires phone usability (SC-10) |
| FR-EDT-08 | M | §5.3 | No leave-page warning when all changes are saved; warn only if unsaved changes exist | P08, P14 | P08 | component, e2e, guard | — | Implied exclusion in GOV-03 (fixes RG D16) |
| FR-HDR-01 | M | §5.4 | Full name: free text up to 120 characters, any characters including separators | P02, P07, P08 | P07 | unit, contract, component | — | — |
| FR-HDR-02 | M | §5.4 | Optional headline up to 200 characters, rendered under the name | P02, P07, P08, P10 | P07 | unit, contract, component, rendering | — | Rendering under the name is a template rule (P10) |
| FR-HDR-03 | M | §5.4 | Ordered contact items of free text plus optional URL; add, edit, reorder (drag or buttons), delete | P02, P07, P08 | P08 | unit, contract, component, e2e, accessibility | — | No fixed contact field set (§2 P2) |
| FR-HDR-04 | M | §5.4 | Auto-link e-mail, phone and URL-like contact items; a social handle is never turned into a URL | P07, P08, P12 | P08 | unit, component, rendering | — | The user can override the URL. TXT form of auto-linked items is open (SC-07) |
| FR-HDR-05 | S | §5.4 | Optional contact item type hint (email, phone, location, link, other) for templates with icons | P02, P07, P08, P10 | P10 | unit, contract, rendering | D-12 | T1 shows no icons; the icon template T2 depends on D-12 |
| FR-HDR-06 | M | §5.4 | Optional photo in the header; the layout without a photo follows the template spec | P07, P10, P11 | P10 | rendering | — | T1 rule in §6.3 |
| FR-LAY-01 | M | §5.10 | Font size preset Small, Medium or Large scales all template font sizes; spacing values stay unchanged | P10, P11 | P10 | unit, rendering | D-15 | Rounding of preset sizes is unstated (SC-06) |
| FR-LAY-02 | M | §5.10 | Section spacing 0 to 20: space above each section title is 10 + v pt, within 0.5 pt in PDF | P10, P11, P12 | P11 | unit, component, rendering | — | The control is P10; the measured AC needs the shared layout result of P11 |
| FR-LAY-03 | M | §5.10 | Entry spacing 0 to 20: space between entries or list item blocks is v pt | P10, P11, P12 | P11 | unit, component, rendering | — | The control is P10; the measured AC needs the shared layout result of P11 |
| FR-LAY-04 | M | §5.10 | Line spacing 0 to 20: line height from the font size plus a per-step increment | P10, P11, P12 | P11 | unit, component, rendering | D-16 | The formula's default disagrees with the §6.2 line heights (SC-03) |
| FR-LAY-05 | M | §5.10 | Page size A4 (default) or US Letter for preview and PDF | P07, P10, P11, P12 | P10 | unit, component, rendering | — | Letter height differs in the research (SC-28) |
| FR-LAY-06 | S | §5.10 | Page margins Narrow, Normal, Wide or custom 10 to 50 pt on all four sides | P07, P10, P11 | P10 | unit, component, rendering | — | Continuation-page top margin is undefined and wrongly cross-referenced (SC-04) |
| FR-LAY-07 | M | §5.10 | Reset design restores layout, list columns and color to template defaults, with undo | P08, P10 | P10 | unit, component | — | — |
| FR-LAY-08 | S | §5.10 | Body font chosen from three fonts per template (T1 default Roboto) | P10, P11, P12 | P10 | component, rendering | — | Fonts are bundled and versioned (NFR-14) |
| FR-LAY-09 | S | §5.10 | Resume language sets month names, the Present label and the hyphenation dictionary | P07, P10, P11, P12 | P10 | unit, rendering | — | — |
| FR-LAY-10 | M | §5.10 | Every layout change reaches the preview within NFR-01 and persists with the resume | P07, P08, P10, P11 | P10 | integration, component, e2e, performance | — | Latency is measured with NFR-01 in P11 |
| FR-LIB-01 | M | §5.2 | Library lists the user's resumes with title, first-page thumbnail and last modified, newest first | P02, P07, P11 | P07 | unit, integration, contract, e2e, performance | ADR-010 | Load time per NFR-02. A first-page thumbnail needs a renderer before the P11 layout engine exists (SC-23) |
| FR-LIB-02 | M | §5.2 | Create a blank resume (default sections, T1, default color and layout) or a full copy of an existing one | P02, P07, P14 | P07 | unit, integration, contract, e2e | D-06 | A copy duplicates content, photo, layout and order (FR-PHO-03) |
| FR-LIB-03 | M | §5.2 | Rename a resume (title up to 150 characters); the title is the default export file name | P02, P07, P12 | P07 | unit, contract, component | — | File-name sanitization is FR-PDF-06 (P12) |
| FR-LIB-04 | M | §5.2 | Delete a resume with confirmation; deleted resumes stay restorable in a 30-day trash | P02, P07, P13 | P07 | unit, integration, contract, e2e | D-04 | Trash purge and its interplay with account deletion are open (SC-08) |
| FR-LIB-05 | M | §5.2 | Opening a resume starts the editor workspace at the last selected section | P02, P07, P08 | P08 | contract, component, e2e | — | The workspace exists from P08. Where the last selected section is kept is open (SC-21) |
| FR-LIB-06 | S | §5.2 | Export PDF or TXT directly from the library with the same output as from the editor | P07, P12 | P12 | integration, e2e | — | Needs the P12 exporters; TRACEABILITY.md lists only P07 (SC-18) |
| FR-PDF-01 | M | §5.12 | One-click PDF export without wizard, modal, e-mail or share link | P02, P12, P14 | P12 | contract, e2e, guard | ADR-010 | Where layout runs shapes the export contract (SC-23) |
| FR-PDF-02 | M | §5.12 | Vector, selectable and searchable text with embedded font subsets, Cyrillic and Spanish included | P11, P12 | P12 | rendering | ADR-010 | — |
| FR-PDF-03 | M | §5.12 | Clickable links for contact items and rich-text links | P12 | P12 | rendering | — | — |
| FR-PDF-04 | M | §5.12 | PDF page size and margins follow the layout settings; pagination per §8 | P11, P12 | P12 | rendering | — | — |
| FR-PDF-05 | M | §5.12 | PDF metadata: title, author, creator and language | P12 | P12 | rendering | — | — |
| FR-PDF-06 | M | §5.12 | File name is the sanitized resume title: letters, digits, dash, underscore, dot; spaces become dashes | P02, P12 | P12 | unit, e2e | — | — |
| FR-PDF-07 | M | §5.12 | Photo embedded at 200 dpi or more for its printed size with JPEG quality 85 or more | P07, P12 | P12 | rendering | ADR-009 | Uses the stored cropped rendition (FR-PHO-05) |
| FR-PDF-08 | S | §5.12 | PDF/UA-style tagging of headings, lists and reading order | P12 | P12 | rendering, accessibility | ADR-010 | Tagging support depends on the renderer |
| FR-PDF-09 | M | §5.12 | PDF size at most 1 MB for a four-page resume with photo | P12 | P12 | rendering | — | — |
| FR-PDF-10 | M | §5.12 | PDF generation time within NFR-03 | P12, P15 | P12 | performance | — | — |
| FR-PER-01 | M | §5.14 | Autosave every change, debounced at most 1 s after the last edit | P02, P07, P08 | P08 | unit, integration, contract, e2e | — | Version token and idempotent replay have no register ID (GOV-04 candidates) |
| FR-PER-02 | M | §5.14 | Offline edits are kept locally and synced on reconnect; the status shows offline | P02, P08, P13 | P08 | unit, component, e2e | — | Queue recovery is a P13 Objective |
| FR-PER-03 | M | §5.14 | The same resume open in two tabs never silently loses edits | P02, P07, P08 | P08 | integration, contract, e2e | D-17 | AC wording and the D-17 recommendation diverge (SC-01) |
| FR-PER-04 | M | §5.14 | Document-level undo/redo of at least 50 steps for content, structure and design changes | P08, P09, P10 | P08 | unit, component, e2e | — | — |
| FR-PER-05 | S | §5.14 | Version history: restore a snapshot from the last 30 days | P02, P07, P08, P12, P13 | P13 | integration, contract, e2e | — | Snapshots before each export need P12; retention is a P13 Objective and is open on account deletion (SC-08) |
| FR-PHO-01 | M | §5.15 | Upload JPEG, PNG or WebP up to 5 MB and crop to the template aspect ratio with zoom and pan | P01, P02, P07, P08, P13 | P08 | unit, integration, contract, component, security | ADR-009 | RG limits are research only (SC-13). Upload abuse tests are a P13 test strategy item |
| FR-PHO-02 | M | §5.15 | Replace and remove the photo; removing re-flows the header | P07, P08, P10 | P08 | integration, component, rendering | — | — |
| FR-PHO-03 | M | §5.15 | The photo is stored per resume and duplicated with the resume | P07 | P07 | unit, integration | ADR-009 | — |
| FR-PHO-04 | S | §5.15 | Show-photo toggle hides the photo without deleting it | P07, P08, P10 | P08 | unit, component, rendering | — | — |
| FR-PHO-05 | M | §5.15 | The original upload is kept; the cropped rendition is regenerated when the crop changes | P07, P13 | P07 | unit, integration | ADR-009 | Re-encoding and EXIF stripping per NFR-08 |
| FR-PRV-01 | M | §5.11 | Preview shows separate pages of the chosen size with gaps and page numbers | P11 | P11 | component, rendering, e2e | — | — |
| FR-PRV-02 | M | §5.11 | WYSIWYG contract: preview and PDF share one layout result with identical pages and line breaks | P01, P11, P12 | P11 | rendering | ADR-010 | Renderer choice and its timing are open (SC-23) |
| FR-PRV-03 | M | §5.11 | Live preview update while typing within NFR-01 | P08, P11 | P11 | component, performance | — | — |
| FR-PRV-04 | M | §5.11 | Page counter next to the spacing controls in the Design tab | P10, P11 | P11 | component, e2e | — | — |
| FR-PRV-05 | S | §5.11 | Fit-to-N-pages helper reduces spacing, then the font preset; it never changes content | P10, P11 | P11 | unit, rendering, component | — | Implied exclusion: never changes content (GOV-03) |
| FR-PRV-06 | M | §5.11 | Zoom: fit width, 75, 100 and 125 percent | P11 | P11 | component, e2e | — | — |
| FR-PRV-07 | S | §5.11 | Overflow hint highlights a section title left alone at the bottom of a page | P11 | P11 | unit, rendering, component | — | Allowed boundary of X3: a layout hint, not a resume score |
| FR-PRV-08 | M | §5.11 | Clicking an element in the preview selects its section or entry in the editor | P08, P11 | P11 | component, e2e | — | Duplicates FR-EDT-04 (S) at priority M (SC-27) |
| FR-RTE-01 | M | §5.7 | Bold, italic and underline with Ctrl/Cmd+B/I/U, rendered identically in preview and PDF | P09, P11, P12 | P09 | unit, component, rendering | — | — |
| FR-RTE-02 | M | §5.7 | One-level bullet list mixed with paragraphs in one field | P09, P11, P12 | P09 | unit, component, rendering | — | — |
| FR-RTE-03 | M | §5.7 | Add, edit and remove links on selected text; clickable in PDF and rendered per §9 in TXT | P09, P12 | P09 | unit, component, rendering | — | TXT form of auto-linked contacts is open (SC-07) |
| FR-RTE-04 | M | §5.7 | Paste from Word, Google Docs or the web keeps only supported formatting; pasted bullets become items | P09 | P09 | unit, component, security | — | Implied exclusion: pasted fonts, colors and sizes are dropped (GOV-03) |
| FR-RTE-05 | M | §5.7 | Undo and redo inside a field and at document level | P08, P09 | P09 | unit, component | — | Document level is FR-PER-04 (P08) |
| FR-RTE-06 | S | §5.7 | Line break inside a paragraph with Shift+Enter | P09 | P09 | unit, component | — | — |
| FR-RTE-07 | W | §5.7 | Won't: numbered or nested lists, headings, colors and font sizes inside text | P02, P09 | P09 | unit, contract, review, guard | — | Exclusion row in GOV-03 |
| FR-RTE-08 | M | §5.7 | Browser-native spell checker enabled in all text fields; no own spell-check service | P08, P09 | P09 | component, guard | — | Implied exclusion in GOV-03; allowed boundary of X1 |
| FR-SEC-01 | M | §5.5 | A new blank resume holds Summary, Experience, Education, Skills and Languages sections, all removable | P02, P07, P08 | P07 | unit, integration, contract | D-06 | Template defaults keyed by section name are open (SC-05) |
| FR-SEC-02 | M | §5.5 | Add a section of any of the four types with any title, without a count limit | P02, P07, P08 | P08 | unit, contract, component, e2e | — | Bounded only by the NFR-12 limits |
| FR-SEC-03 | M | §5.5 | Rename a section inline or in its form (up to 80 characters); the new title appears in every output | P07, P08, P10, P12 | P08 | unit, component, e2e | — | Case stored as typed; templates may display uppercase (P10); PDF and TXT in P12. RG limit 50 is research only (SC-14) |
| FR-SEC-04 | M | §5.5 | Reorder sections by drag-and-drop and keyboard move buttons to any position; same order in every output | P07, P08, P10, P12 | P08 | unit, component, e2e, accessibility | D-13 | No template zone restricts order (FR-TPL-04); D-13 governs the T3 sidebar |
| FR-SEC-05 | M | §5.5 | Hide or show a section without deleting it; hidden sections are not rendered in any output | P07, P08, P11, P12 | P08 | unit, component, e2e, rendering | — | Non-rendering in preview, PDF and TXT is re-verified by P11 and P12 fixtures |
| FR-SEC-06 | M | §5.5 | Delete a section with confirmation; undo restores its content and position | P07, P08 | P08 | unit, component, e2e | — | — |
| FR-SEC-07 | M | §5.5 | Sections without content are not rendered; the panel marks them empty | P08, P11, P12 | P08 | component, rendering | — | The rendering part is re-verified in P11 and P12 |
| FR-SEC-08 | M | §5.5 | Reorder entries and list items by drag-and-drop and up/down; no automatic sorting by date | P07, P08 | P08 | unit, component, e2e, accessibility | — | Implied exclusion: no automatic date sorting (GOV-03) |
| FR-SEC-09 | S | §5.5 | Change a section's type when the conversion is lossless; otherwise disabled with a hint | P07, P08 | P08 | unit, component | — | — |
| FR-SEC-10 | S | §5.5 | Duplicate a section or an entry; the copy is placed right after the original | P07, P08 | P08 | unit, component | — | — |
| FR-SEC-11 | M | §5.5 | Per-section list columns (1 or 2) for bullet lists with template defaults; TXT ignores the option | P07, P08, P10, P11, P12 | P10 | unit, component, rendering | — | P10 owns template defaults (P10 Objective: section list columns). Name-keyed T1 defaults conflict with the type-only model (SC-05) |
| FR-TPL-01 | M | §5.8 | Three templates: T1 Classic Timeline (default), T2 and T3 | P01, P10 | P10 | unit, rendering, review | D-12 | T2/T3 are built only after D-12 (P10 Objective) |
| FR-TPL-02 | M | §5.8 | Design-tab template picker with three thumbnails rendered with the user's own content | P10, P11 | P10 | component, rendering, e2e | D-12, ADR-010 | Thumbnails need a renderer before P11 (SC-23) |
| FR-TPL-03 | M | §5.8 | Switching template keeps content, order, hidden flags, color index and layout; switching back restores | P10, P11 | P10 | unit, rendering, e2e | D-12 | P10 DoD: no content loss on template switch |
| FR-TPL-04 | M | §5.8 | A template never changes section order and never moves sections into other zones | P10, P11 | P10 | unit, rendering, guard | D-13 | D-13 governs the T3 per-section sidebar |
| FR-TPL-05 | M | §5.8 | Templates are data-driven design definitions separate from content | P01, P10 | P10 | unit, review | ADR-010 | The definition format depends on the renderer (ADR-010) |
| FR-TXT-01 | M | §5.13 | One-click TXT export downloads the sanitized title with a .txt extension | P02, P12 | P12 | unit, e2e | — | — |
| FR-TXT-02 | M | §5.13 | TXT content and order identical to the PDF: header, then visible non-empty sections | P12 | P12 | unit, rendering | — | — |
| FR-TXT-03 | M | §5.13 | No section is lost in TXT | P12 | P12 | unit | — | — |
| FR-TXT-04 | M | §5.13 | TXT format per §9: UTF-8 without BOM, LF, no service comments, no trailing spaces | P12 | P12 | unit | — | Implied exclusion: no service comment or BOM (GOV-03) |
| FR-TXT-05 | S | §5.13 | Option for CRLF line endings | P12 | P12 | unit, component | — | — |
| FR-TXT-06 | S | §5.13 | Copy as text to the clipboard with the same content | P12 | P12 | component, e2e | — | — |
| FR-TXT-07 | M | §5.13 | Section titles and texts exactly as typed in TXT, without forced uppercase | P12 | P12 | unit | — | — |
| FR-TYP-01 | M | §5.6 | Four section types (text, list, entries, inline) exist with their editing forms | P02, P07, P08 | P08 | unit, contract, component | D-11 | Entry form fields are in the normative-content table (§5.6) |
| FR-TYP-02 | M | §5.6 | Entry date order (start before end) is a warning, never a block on saving | P02, P07, P08 | P08 | unit, contract, component | — | Implied exclusion: no blocking date validation (GOV-03) |
| FR-TYP-03 | M | §5.6 | No field is mandatory except a full name for export; the export button explains what is missing | P07, P08, P12 | P12 | unit, component, e2e | — | The export gate exists from P12 |
| NFR-01 | M | §11 | Preview update latency p95 of 300 ms or less for a four-page resume | P11, P15 | P11 | performance | — | — |
| NFR-02 | M | §11 | Library and editor load p95 of 2 s or less on a 10 Mbit/s connection | P05, P07, P08, P15 | P15 | performance | — | P15 DoD: NFR targets measured |
| NFR-03 | M | §11 | PDF generation p95 of 5 s or less with photo; TXT within 1 s | P12, P15 | P12 | performance | — | P12 test strategy includes p95 performance. Background export processing is an unregistered candidate (GOV-04) |
| NFR-04 | M | §11 | WYSIWYG fidelity test of FR-PRV-02 runs in CI on at least 10 fixture resumes per template | P03, P11, P12, P14 | P11 | rendering | ADR-010, ADR-033, D-12 | CI from P03; T2/T3 fixtures need D-12; real or synthetic fixture data is open (SC-25) |
| NFR-05 | M | §11 | Latest two versions of Chrome, Edge, Firefox and Safari; desktop first, phone usable | P05, P08, P14, P15 | P14 | e2e | — | P14 Objective: browser matrix. Must vs Should conflict with FR-EDT-07 (SC-10) |
| NFR-06 | M | §11 | Editor meets WCAG 2.1 AA, including keyboard section reordering and sliders | P05, P08, P10, P14, P15 | P14 | accessibility | — | P14 test strategy: WCAG audit |
| NFR-07 | M | §11 | Full Unicode in all fields; fonts cover Latin Extended and Cyrillic | P07, P10, P11, P12 | P12 | unit, rendering | — | P12 test strategy: Unicode tests |
| NFR-08 | M | §11 | HTTPS only, adaptive password hashing, per-user authorization, image re-encoding and metadata stripping | P01, P02, P03, P06, P07, P13, P15 | P13 | security, integration | — | Threat model in P01. Rate limiting has no register ID (GOV-04 candidates) |
| NFR-09 | M | §11 | GDPR: data stored in the EU, account deletion and data export, no third-party trackers in the editor | P01, P03, P06, P13, P15 | P13 | security, review | D-20, ADR-009, ADR-033, ADR-034 | P13 DoD: EU residency proven. EU residency is a release gate (ARCHITECTURE.md §6) |
| NFR-10 | M | §11 | No acknowledged edit lost; RPO of 1 min or less; daily backups kept 30 days | P01, P08, P13, P15 | P13 | integration, e2e | ADR-004 | Backup retention vs account deletion is open (SC-08) |
| NFR-11 | S | §11 | Availability of 99.5 percent per month | P13, P15 | P15 | review | ADR-033 | Measurable only in operation (P15 monitoring) |
| NFR-12 | M | §11 | Limits: 200 resumes per user, 100 sections, 100 entries per section, 50 000 characters per resume | P02, P07, P13 | P07 | unit, integration, contract | — | P07 DoD: limits tested |
| NFR-13 | S | §11 | PDF errors and preview/PDF mismatches are logged with the resume id, never with content | P04, P11, P12, P13 | P13 | integration, security | — | P13 test strategy: log PII scan |
| NFR-14 | M | §11 | The same resume version and settings always give the same PDF layout; fonts are bundled | P01, P11, P12, P13 | P12 | rendering | ADR-010 | — |

## Pagination rules

| Rule ID | Spec section | Summary | Phases | Primary phase | Verification | Notes |
|---|---|---|---|---|---|---|
| PG-01 | §8 | A section title stays with at least the first two lines of its content | P11, P12 | P11 | unit, rendering | — |
| PG-02 | §8 | An entry's title and meta rows stay together with at least two description lines | P11, P12 | P11 | unit, rendering | — |
| PG-03 | §8 | A bullet item of four lines or less is not split; longer items keep two lines on each page | P11, P12 | P11 | unit, rendering | — |
| PG-04 | §8 | Paragraphs keep at least two lines on each side of a break | P11, P12 | P11 | unit, rendering | — |
| PG-05 | §8 | Two-column lists break between rows, never between the two cells of a row | P11, P12 | P11 | unit, rendering | — |
| PG-06 | §8 | The header is never split | P11, P12 | P11 | unit, rendering | — |
| PG-07 | §8 | The T1 timeline line continues on the next page for a split entry without a repeated dot | P10, P11, P12 | P11 | rendering | T1 timeline design is P10 (§6.7) |
| PG-08 | §8 | Per-entry option to start on a new page (manual page break) | P02, P07, P08, P11 | P11 | unit, component, rendering | The row carries a stray priority cell S (SC-19); model field per §10.1 |
| PG-09 | §8 | If a rule cannot be satisfied, break by lines and show the FR-PRV-07 hint | P11 | P11 | unit, rendering, component | — |

## Normative content without requirement IDs

| Spec section | Content | Phases | Primary phase | Verification | Notes |
|---|---|---|---|---|---|
| §2 | §2 P1 No AI and no content suggestions | P02, P08, P09, P14 | P14 | review, guard, e2e | Guarded by X1, X2 and X4 (GOV-03) |
| §2 | §2 P2 The user is not restricted in section names, number, order or content | P07, P08, P10 | P08 | unit, component, e2e | — |
| §2 | §2 P3 Preview is the PDF | P11, P12 | P11 | rendering | Same contract as FR-PRV-02 |
| §2 | §2 P4 Plain text is a first-class export | P12 | P12 | unit | — |
| §2 | §2 P5 No dark patterns | P08, P12, P14 | P14 | review, guard, e2e | Implied exclusion in GOV-03 |
| §3.1 | In-scope list for this release | P01, P14 | P14 | review | Release-scope cross-check against this matrix |
| §4 | Glossary and domain model overview | P01, P02, P07 | P07 | review, unit | Details in §10 |
| §5.3 | Workspace layout sketch and top-bar contents | P08 | P08 | component | See FR-EDT-01 and FR-EDT-06 |
| §5.6 | Entry form fields and limits: title, organization, location, start and end date, date override, description | P02, P07, P08 | P07 | unit, contract, component | Editable labels depend on D-11 |
| §5.6 | Resume-level date display format (four formats) and Present label, the same in preview, PDF and TXT | P02, P07, P08, P10, P11, P12 | P12 | unit, rendering | No phase Objective names the date-format control; the P08 or P10 plan must own it |
| §5.10 | Slider UX: visible value, arrow keys step 1, Home and End, double-click resets to default | P10 | P10 | component, accessibility | — |
| §6.1 | T1 page tokens: page sizes, margins, content width, colors, single column | P10, P11 | P10 | rendering | Continuation-page margin (SC-04); Letter height (SC-28) |
| §6.2 | T1 typography and accent color roles | P10, P11 | P10 | rendering | Link color D-18; line heights vs FR-LAY-04 (SC-03) |
| §6.3 | T1 header with and without photo, rule and contact separators | P10, P11 | P10 | rendering | — |
| §6.4 | T1 section title style and spacing | P10, P11 | P10 | rendering | — |
| §6.5 | T1 text section paragraphs | P10, P11 | P10 | rendering | Summary line height special case (SC-05) |
| §6.6 | T1 list section with one or two columns and square markers | P10, P11 | P10 | rendering | Default column count (SC-05) |
| §6.7 | T1 entries section with timeline, title, meta and description rows | P10, P11 | P10 | rendering | Education variant depends on D-19 |
| §6.8 | T1 inline section | P10, P11 | P10 | rendering | — |
| §6.9 | T1 size presets table | P10, P11 | P10 | rendering | D-15; rounding (SC-06) |
| §7 | T2 Compact and T3 Sidebar proposal | P10, P11 | P10 | review, rendering | Built only after D-12; T3 placement depends on D-13 |
| §9.1 | TXT encoding rules | P12 | P12 | unit | — |
| §9.2 | TXT grammar for header, sections and entries | P12 | P12 | unit | — |
| §9.3 | TXT inline rules for formatting, links, dates and letter case | P12 | P12 | unit | Auto-linked contacts (SC-07) |
| §9.4 | TXT example derived from the reference CV | P12 | P12 | review, unit | Holds the owner's real contact data; fixture use needs Q-5 (SC-25) |
| §10.1 | Logical entities and field constraints | P01, P02, P07 | P07 | unit, contract, review | Export entity and last-selected section are missing (SC-09, SC-21) |
| §10.2 | Rich text stored as a format-neutral tree | P02, P09 | P09 | unit, contract | — |
| §10.3 | Model example derived from the reference CV | P02 | P02 | review | Holds the owner's real contact data; mock examples need Q-5 (SC-25) |
| §13 | Research feature decisions F01 to F50, including F42 Print not needed | P01, P14 | P14 | review, guard | Implied exclusion F42 in GOV-03 |

## Notes

1. **Phases** lists the phases whose plan, tests or implementation touch the requirement. P01 appears where the P01 Objective or
   DoD decides something the requirement needs (auth, file storage, rendering options, EU hosting, domain model, threat model).
   P02 appears where the requirement has an API surface or a schema field. Output phases (P11 preview, P12 PDF and TXT) appear
   where the AC names that output.
2. **Primary phase** is the phase whose gate must demonstrate the AC. When an AC spans outputs built later (for example "not
   rendered in preview, PDF or TXT"), the primary phase is the phase that owns the behaviour, and the output phases re-verify the
   clause in their fixtures. When the AC itself is about a later output (the FR-EDT-03 preview scroll, the FR-LAY-02 PDF
   measurement), the primary phase is that output's phase.
3. **P14** (DoD: "All Must requirements trace to passing test evidence") audits every Must row of this matrix. It is listed in
   Phases only where P14 runs the requirement's own cross-stack E2E or browser-matrix verification.
4. **Phase anchors** of phase-plan §7.3 hold for every row, and every FR row intersects its TRACEABILITY.md group. No
   `deviation:` note is needed. TRACEABILITY.md gaps (missing NFR rows, FR-ACC and FR-LIB-06 later phases) are logged as SC-18.
5. **Decision deps** list every D-ID of the requirement's spec row plus D-xx or ADR-xxx dependencies that are real (for example a
   template-specific clause that needs D-12, or a renderer-dependent clause that needs ADR-010). Mirror ADRs of a D-ID
   (ADR-013…ADR-032) are not repeated; GOV-04 lists them on the D-ID row.
6. **Verification** uses the TEST-STRATEGY.md layers plus `review` and `guard`. Every W row has `guard` and an exclusion row in
   GOV-03. Rows with an implied exclusion also carry `guard` where the absence is part of the AC (FR-EDT-08, FR-RTE-08, FR-TPL-04,
   FR-PDF-01).
7. **Sequencing gaps** that the phase graph does not resolve are logged, not fixed: library and template thumbnails and the
   P02 export contract need rendering decisions before the P11 engine exists (SC-23); P02 tests need tooling choices placed in
   P03/P05 (SC-29).
8. **Pagination rules** have no priority in the spec (SC-19). **Normative content** rows split §2 by principle and §6, §9 and
   §10 by subsection so each can be traced separately. TECHNICAL-SPEC App. A and App. B have no section token; their content is
   covered by the FR rows they cite.
9. Summaries are paraphrases of at most 120 characters. They contain no personal data from the spec examples (§9.4, §10.3).
