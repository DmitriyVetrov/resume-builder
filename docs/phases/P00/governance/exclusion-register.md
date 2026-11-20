# Exclusion Register — P00 (GOV-03)

Every feature that TECHNICAL-SPEC §3.2 excludes, plus every requirement with priority W, with the phases whose review, contract
or tests must prove the feature is absent. Rows tagged with a decision stay excluded until an accepted ADR formally changes the
scope (PD-P00-05, proposed; owner question Q-2). No decision is taken here.

## Exclusions

| Excl ID | Source section | Excluded feature | Linked decision | Status | Guard phases | Guard verification | Allowed boundary |
|---|---|---|---|---|---|---|---|
| X1 | §3.2 | Any AI assistant: generated bullets, skills or summaries, refine, rewrite or tone change | — | EXCLUDED | P01, P02, P08, P09, P14 | review of the P01 architecture: no AI or text-generation service or dependency; contract review in P02: no generation, rewrite or suggestion endpoint; component and e2e tests in P08, P09 and P14: no AI, refine or rewrite control in any editor | Browser-native spell checking (FR-RTE-08), paste sanitization (FR-RTE-04) and contact auto-linking (FR-HDR-04) are allowed: they never write or rewrite content |
| X2 | §3.2 | Pre-written example libraries (phrases by job title) for any section | — | EXCLUDED | P02, P07, P08, P14 | review in P07: no phrase or example dataset in the domain or seed data; contract review in P02: no example or phrase endpoint; e2e in P14: no example picker in any section form | Static help text under a field is allowed if it holds no sample resume content (§3.2 note). Whether a sample resume may exist at all is open under D-05 (SC-24) |
| X3 | §3.2 | Resume score, resume checker, needs-attention prompts | — | EXCLUDED | P02, P11, P12, P14 | contract review in P02: no score or check endpoint; component and e2e tests in P11, P12 and P14: no score widget and no needs-attention modal before export | Layout overflow hints (FR-PRV-07, PG-09) and the export explanation of a missing full name (FR-TYP-03) are allowed: they never rate content |
| X4 | §3.2 | Content-level autosuggest from dictionaries (job titles, degrees, languages) | D-07, ADR-019 | EXCLUDED-PENDING-DECISION | P02, P08, P14 | contract review in P02: no dictionary or suggestion endpoint; component test in P08: title, degree and language fields show no suggestion list; e2e in P14 confirms | The month and year date picker plus typing of the §5.6 entry form is allowed. The D-07 recommendation (country and month pickers) is not adopted; a country picker has no target field (SC-26) |
| X5 | §3.2 | Onboarding questionnaire (years of experience, education) | — | EXCLUDED | P05, P06, P14 | review of the P05 routing: no questionnaire route; e2e in P06 and P14: sign-up and first open lead straight to the library or workspace without questions | Sign-up fields of FR-ACC-01 are allowed. An optional guided first run is a separate open decision (D-05) |
| X6 | §3.2 | Template gallery with filters; more than three templates | — | EXCLUDED | P02, P10, P14 | component test in P10: the picker shows exactly three templates and no filter control; contract review in P02: the template identifier allows three values | The Design-tab picker with exactly three thumbnails rendered with the user's content (FR-TPL-02) is required. A data-driven template format that could take a fourth template later (FR-TPL-05) is a design property, not a v1 feature |
| X7 | §3.2 | Cover letters, job board, publish or share link, send by e-mail | — | EXCLUDED | P02, P06, P12, P14 | contract review in P02: no cover-letter, job, publish, share-link or send-resume endpoint; e2e in P12 and P14: export only downloads and offers no e-mail or share option (FR-PDF-01) | Account e-mails for verification and password reset (FR-ACC-01, FR-ACC-02, ADR-034) are allowed; they never carry resume content |
| X8 | §3.2 | Upload and parse an existing resume | D-08, ADR-020 | EXCLUDED-PENDING-DECISION | P02, P07, P14 | contract review in P02: no import or parse endpoint and no import media type; e2e in P14: the library offers no upload-resume flow | Photo upload (FR-PHO-01) is allowed. Own-TXT import (D-08 recommendation for v1.1) is not in v1 unless an accepted ADR changes the scope |
| X9 | §3.2 | DOCX export | D-09, ADR-021 | EXCLUDED-PENDING-DECISION | P02, P12, P14 | contract review in P02: no DOCX media type or endpoint; e2e in P12 and P14: export offers PDF and TXT only | PDF and TXT exports (§5.12, §5.13) and the data-export archive (FR-ACC-04) are allowed |
| X10 | §3.2 | Paywall and subscriptions | D-10, ADR-022 | EXCLUDED-PENDING-DECISION | P01, P02, P06, P12 | review of the P01 architecture: no billing component; contract review in P02: no plan, payment or entitlement field; e2e in P12: export never asks for a subscription | The usage limits of NFR-12 (resume, section, entry and character caps) are allowed; they are not plan tiers |
| X11 | §3.2 | Upsell modals, promo pop-ups, tips carousels inside the flow | — | EXCLUDED | P08, P12, P14 | component and e2e tests in P08, P12 and P14: no modal, pop-up or carousel interrupts editing or export (§2 P5) | Static help text under a field is allowed if it holds no sample resume content (§3.2 note). Confirmation dialogs for destructive actions (FR-SEC-06, FR-LIB-04, FR-ACC-03) are allowed |
| FR-RTE-07 | §5.7 | Numbered lists, nested lists, headings, colors and font sizes inside text (W) | — | EXCLUDED | P02, P09 | contract review in P02: the rich-text schema has only paragraphs, one-level bullet lists, text, links and line breaks (§10.2); unit and component tests in P09: the editor and paste sanitizer produce none of these | Bold, italic, underline, links, one-level bullet lists and Shift+Enter line breaks (FR-RTE-01…06) are allowed |
| FR-CLR-04 | §5.9 | Free color picker or custom hex value (W) | — | EXCLUDED | P02, P10 | contract review in P02: the accent is a preset index with no free color field; component test in P10: no free color input in the Design tab | Choosing one of the three template presets (FR-CLR-01, FR-CLR-02) is allowed |

## Implied exclusions

| Source | Excluded behavior | Guard phases | Notes |
|---|---|---|---|
| FR-RTE-08 | No own spell-check service; only the browser's native checker | P02, P09 | Boundary of X1. RG offers its own service (README §11) |
| FR-PDF-01 | No export wizard, no modal, no e-mail and no share link on PDF export | P02, P12, P14 | Fixes RG D8 and D17 |
| FR-EDT-08 | No leave-page warning when all changes are saved | P08, P14 | Fixes RG D16; §2 P5 |
| §13 F42 | No print feature; the PDF is printed from the viewer | P12, P14 | §13: Print not needed |
| FR-SEC-04, FR-TPL-04 | No template zones restrict section order; no template moves sections between zones | P08, P10 | T3 sidebar placement depends on D-13 |
| FR-SEC-08 | No automatic sorting of entries by date | P07, P08 | — |
| FR-TYP-02 | No blocking validation of entry dates; a warning only | P07, P08 | §2 P2 |
| FR-HDR-04 | A social handle is never turned into a URL | P08, P12 | Fixes RG D3 |
| FR-RTE-04 | Pasted fonts, colors and sizes are not kept | P09 | — |
| FR-LAY-01 | The font preset does not silently change line spacing | P10 | RG behaviour not repeated |
| FR-PRV-05 | The fit-to-pages helper never changes content | P11 | — |
| FR-TXT-04, FR-TXT-07 | No service comment, BOM, trailing spaces or forced uppercase in TXT | P12 | Fixes RG D14 and the TXT findings of README §10 |
| NFR-09 | No third-party trackers in the editor | P05, P08, P13 | GDPR |
| NFR-13 | No resume content in logs or telemetry | P04, P13 | Also .claude/rules/03-security-privacy.md |
| §2 | No dark patterns: no upsell modals, no pre-ticked sharing or e-mail, no needless leave-page warnings (§2 P5) | P08, P12, P14 | Overlaps X7 and X11 |

## Notes

1. **Status.** X4, X8, X9 and X10 carry `[DECISION D-07…D-10]` in §3.2 and are `EXCLUDED-PENDING-DECISION` with the tagged D-ID
   and its mirror ADR as Linked decision. All other rows are `EXCLUDED`. The conflict between "must NOT be built" and the
   decision tags is SC-11; the strict interim reading is PD-P00-05.
2. **PROJECT-CHARTER.md "Explicitly excluded"** maps as follows: AI generation → X1; pre-written phrase libraries → X2;
   import/parse of PDF/DOCX → X8; DOCX export → X9; cover letters → X7; public publishing/share → X7; e-mail sending → X7;
   resume score/review → X3; unrelated marketing/job-board features → X7 (job board) and X11 (promotions);
   monetization/paywall → X10.
3. **Guard phases** name the earliest phase that could introduce the feature (usually the P02 contract review) and the phases
   whose UI or export tests prove its absence. Every phase Code Reviewer checks the rows that touch the phase's scope.
4. **Boundaries checked by AC-P00-13:** X1 vs FR-RTE-08 (browser spell check allowed), X3 vs FR-PRV-07 (layout hint allowed),
   X4 vs the D-07 recommendation (pickers not adopted), X6 vs FR-TPL-02 (three-template picker required), X7 vs FR-ACC-01/02
   (account e-mails allowed), X11 vs the §3.2 note (static help text without sample content allowed).
5. **W rows** FR-RTE-07 and FR-CLR-04 are also GOV-02 rows with `guard` in Verification.
6. **Implied exclusions** cite the requirement or section that states them; no new IDs are created. F42 is a research
   feature code (§13), not a spec ID.
