# Resume Genius: research of a resume builder

> Playbook, functional description and input for the specification
> Subject: https://resumegenius.com (builder `/resume-builder/app`, account area `/dashboard/app`)
> Research date: 2026-10-24 · Method: manual and scripted walkthrough with Playwright in a logged-in session
> Test document: `TEST-RG-Research-Alex-Testerson` (docId `84d5b008-8c79-4f05-89bd-3673f5ad987f`), all data is fictional
> Artifacts: `img/` (screenshots), `export/` (3 PDFs and 1 TXT downloaded from the site)

---

## 0. How to read this document

The document is written for a technical product owner. It describes **what the site can do and how it
works**, with numbers measured in the browser and in the downloaded files. It makes no decisions
about the future product. Features are selected in section 13 ("Feature catalogue"): in the
"Decision" column, mark `Take / Skip / Later`.

Sections:

1. Product overview and monetisation
2. Screen map and URLs
3. End-to-end resume creation flow
4. Wizard steps, one by one
5. The final screen (Finalize): the editor workspace
6. Section management: add, rename, move, delete
7. Design: templates, colours, font, size, spacing (with measurements)
8. Preview
9. PDF export and how settings change the PDF
10. TXT export
11. Other features (DOCX, Print, Email, Publish, AI, Score, Spell check)
12. Defects and UX problems found
13. Feature catalogue for selection
14. Draft requirements for the "core feature" of the future site
15. Technical observations (stack, data model, API)

Screenshots are in `img/`; each file name starts with the step number.

---

## 1. Product overview

Resume Genius (operated by Sonaga Tech Limited, Lucerne, Switzerland) is a SaaS builder for resumes
and cover letters. Around the builder there is a large SEO site: templates, examples, a blog, AI generators.

**Pricing** (`/pricing` page, as of 2026-10-24):

| Plan | Price | Resume export |
|---|---|---|
| Free Access | $0 | **TXT only** |
| 14-day Trial | $2.95, then $23.95 every 4 weeks | PDF, Word, TXT |
| Annual | $7.95/month ($95.40 once for 12 months) | PDF, Word, TXT |

Monetisation is built on export: building and viewing a resume is free, but **PDF and DOCX require a
subscription**. TXT is free. The account used for the research had a subscription, so the PDF was
downloaded without a paywall.

Besides the builder the product includes: Cover Letter Builder, Resume Checker (resume scoring),
Resume Review, "Digital Resume" (publishing by link), a job board (US only), and AI generators for
the summary, skills and experience bullets.

---

## 2. Screen map and URLs

### 2.1 Public part (marketing)

| Screen | URL | Contents |
|---|---|---|
| Home | `/` (redirects to `/t3h`) | CTAs "Build My Resume Now", "Upload My Existing Resume", template carousel, examples by profession, blog (`img/01-home.png`) |
| Template gallery | `/resume-templates` | Filters: Design Style, Format, Columns, Experience, File Type, Photo, Color; 12 pages (`img/02-templates-gallery.png`) |
| Pricing | `/pricing` | Plan table (see section 1) |
| Other | `/resume-examples`, `/cover-letter-builder`, `/resume-checker`, `/ai-resume-generator`, `/blog`, `/faq`… | Out of scope |

The "Use This Template" button in the gallery opens the builder with the chosen template and colour:
`/resume-builder/app/how-to-start?templatecd=MLO5&colorcd=333333`.

### 2.2 Account area (Dashboard)

| Screen | URL |
|---|---|
| Dashboard home | `/dashboard/app/home` ("Next Steps" checklist, Resume Score) |
| My documents | `/dashboard/app/resumes` (cards, 6 per page) (`img/03-dashboard-resumes.png`) |
| Download wizard | `/dashboard/app/download?docId=<id>&fileFormat=pdf\|txt\|docx&originatingPath=…` |
| Login | `/dashboard/app/account/login` |

Document card: Email, Unpublish, More (Print, Duplicate, Delete), Edit, Download.
"Create new resume" opens a modal: **use an existing resume as the base** (a copy) or
"Start from scratch" (`img/05-create-new-modal.png`).

### 2.3 Builder

| Step | URL (`/resume-builder/app/…`) |
|---|---|
| How to start | `how-to-start` (`?flow=upload` uploads your own file) |
| Questionnaire | `questionnaire/work_experience` → `questionnaire/highest_education` → `questionnaire/graduation_state` |
| Template choice | `choose-template` |
| Contact | `personalize` |
| Experience | `experience-tips` → `work_experience?fields=company_position` → `work_experience?fields=responsibilities` → `work_experience` (list) |
| Education | `education-tips` → `education?add_school_type=other` → `education` (list) |
| Certifications | `licenses` |
| Skills | `additional_skills` |
| Summary | `professionalsummary` |
| References | `references/should_add_reference` → `references` |
| Additional sections | `add-sections` |
| Final (editor) | `done` |
| Open a document | `?mode=edit&docid=<docId>` (redirects to `done`) |

---

## 3. End-to-end flow (happy path)

```
Dashboard → Create new resume → Start from scratch
  → How would you like to start?  [Upload resume | Build a new resume]
  → Questionnaire (3 questions, affects only template recommendations)
  → Template choice (+ colour)       ← "Choose template later" is possible
  → Contact
  → Experience (one job at a time: form → bullets → job list)
  → Education
  → Certifications and licenses     ← this step is missing from the wizard sidebar
  → Skills
  → Professional Summary
  → References (Yes / Upon Request / No)
  → Additional Sections (Languages, Volunteer, Awards, Websites, Custom)
  → Finalize (`done`): preview + templates + formatting + export
```

The wizard is linear, but any step can be opened at any time from the left sidebar. At the bottom
left there is a mini preview and "Resume progress: N%" (7% after contacts, 100% after additional
sections). Every save goes to the server immediately (PATCH requests); there is no separate
"save document" button.

**Questionnaire** (`img/06…08`): "How much experience do you have?" (No experience / 1-3 / 4-6 / 7-10 / 10+),
"Highest level of education" (High School / College / Other), "Did you graduate?" (Yes / Still Enrolled / No).
The answers only affect the heading and the "Recommended" sorting on the template screen. They
probably also decide whether the Certifications step is shown (not verified).

---

## 4. Wizard steps

Common to all steps:

- On the right, a "… Tips" card with advice on filling the step in.
- On the left, a mini preview; the **Preview** button opens a full-screen preview with the
  Templates and Formatting tabs (`img/21`, `img/22`). So design is available from the very first step.
- A field that passed validation gets a green check mark in its label.
- Buttons at the bottom: Back / Continue (or Save when the step was opened from the final screen:
  then "Back to resume" / "Save").
- Leaving a builder page always triggers the browser's `beforeunload` prompt ("Leave site?"),
  even when everything is saved.

### 4.1 Contact (`personalize`, `img/15–20`)

| Field | Type | Note |
|---|---|---|
| Photo | upload | "Add Photo (Optional)": a modal, "Browse From Your Device", cropping. JPEG/PNG/GIF up to 4 MB. Shown only in templates with a photo |
| First Name, Surname | text | Prefilled from the account |
| Desired Job Title (Optional) | text + autosuggest | Suggestions from a job-title database (`img/18`) |
| Email* | text | The only required field |
| Phone | country flag + number | The number is stored in national format (`611 22 33 44`); the country code does not reach the document |
| Country | searchable dropdown | US, Canada, UK, Australia at the top, then alphabetical |
| City, Province, Postal Code | text | In the preview: "City, Province Zip". **The country is not shown in the resume's address line** |
| "+ Add more details" | chips | Date of Birth (calendar, `MM-DD-YYYY` format), Driver's License, Nationality, LinkedIn, Twitter, Website |

Observations:

- The City field accepts anything (users put "phone • country • status" there), because it is a
  plain string with no validation.
- The DOB calendar (react-calendar) does not zoom out beyond a decade, so reaching the 1990s means
  paging back with the "‹" button.
- After "Save & Continue" a greeting "Nice to meet you, Alex!" appears, followed by the intro to the Experience step.

### 4.2 Experience

**Job form** (`img/24`, `img/25`): Job Title (autosuggest), Company or Organization name,
Country (list), State or Province, City, Start Month, Start Year, End Month, End Year,
the **"I currently work here"** checkbox (hides the end fields; the resume shows "Present").
Months January–December; years as a list 2026…1956 (71 values).

**Bullets (responsibilities)** (`img/26–31`):

- On entry, an AI modal: "We generated bullet points for Lead Backend Engineer. Yes, add them for me /
  Or start from scratch".
- On the left, a rich-text editor (Draft.js). Toolbar: **Bold, Italic, Underline, Undo,
  Redo, Bullet list, Spell Check, Add URL**. Ctrl+B/I/U shortcuts work.
- Paragraphs and a bulleted list can be mixed in one entry (verified: the first paragraph is plain,
  then bullets).
- **Add URL**: the selected text becomes a link (modal with Link Text + Link (URL)). The link is
  clickable in the PDF.
- On the right, "Pre Written Examples" with a search by job title. Clicking a card adds the phrase
  **as a separate bullet at the end**; a second click removes it (a toggle card with a check mark).
  Searching another title (for example, DevOps Engineer) loads a different set of phrases.

**Job list** ("Review your work experience", `img/33–35`): numbered cards, each with
**Edit**, **…** (Edit details / Edit description), **🗑 delete**, **✥ drag**.
"Add another position" opens the same form, where the button is called "Save".

- **The order of entries is fully manual.** There is no automatic sorting by date: if the 2016–2019
  job is dragged to the top, it stays first in the resume (`img/35`).
- Lines without a list bullet are printed in the PDF as plain lines; no bullets are added.

### 4.3 Education (`img/37–40`)

Fields: School Name, School Location, Degree or Program (autosuggest: GED, High School Diploma,
A.A., B.A., B.S., M.A., M.S., MBA, Certification, Diploma, dozens of Doctor of …; free value),
Field of Study, Graduation Month/Year, the **"Remove graduation date from resume"** toggle.
"+ Include education details" opens an editor (as in Experience) and a library of ready phrases by
category: Awards & Recognition (Award or Honor, Honor Roll, Dean's List), Coursework,
Extracurriculars, Scholarships & Grants, Honors Graduation, International Schooling,
Research Projects, GPA & Class Rank. A phrase is inserted **with a placeholder**
(`[Award] Recipient`) that has to be replaced by hand, otherwise it ends up in the PDF as is.
There is a "Skip adding education" link.

### 4.4 Certifications and licenses (`licenses`, `img/41`)

A list of single-line fields "License or Certification #N", "Add another…", a bin on every row.
No dragging. Format tip: "Name, issuing organization, year".
**This step is not in the wizard sidebar**; it only appears while going through the flow.

### 4.5 Skills (`additional_skills`, `img/43–45`)

An AI modal "We generated top skills for …", then an editor (one line = one skill) and ready-made
skills with a search by job title. A counter "Skills: N (Aim for 6–10)".
Choosing "Yes, add them for me" inserted 5 generic skills (PHP, Python…) that did not fit.
The Advanced template shows skills as "pills"; other templates as a list in 1–2 columns.

### 4.6 Professional Summary (`img/47`, `img/48`)

An editor and 24 ready-made variants by job title, plus a "Generate with Sage" (AI) button.
⚠ On the first pass the typed text was not saved (typing probably started before the editor got
focus). Typing again via the sidebar and "Save" worked. An empty section is not shown in the
resume at all.

### 4.7 References (`img/50–53`)

The question "Would you like to include any references?" (Yes / Upon Request / No) with the hint
"We recommend NOT including references…". For Yes: First Name*, Last Name*, Position Title*
(autosuggest), Email*, Phone, Company*, Relationship To You*. The referee's phone is printed in the
resume without "+" and spaces (`34600000000`).

### 4.8 Additional Sections (`add-sections`, `img/54–60`, `img/83`)

An accordion, one item open at a time:

| Section | Input |
|---|---|
| Languages | Quick chips (English, Catalan, French, German), rows "Language (autosuggest) + Proficiency Level", ≡ row dragging, 🗑. Levels: Beginner, Conversational, Intermediate, Advanced, Fluent, Bilingual, Native |
| Volunteer Experience | Editor and 42 ready phrases for "Volunteer Coordinator" |
| Awards & Accomplishments | Single-line fields #1, #2 … |
| Websites & Social Links | URL field and the **"Add to header"** checkbox (show it in the header next to the contacts instead of a separate section) |
| Custom Section | **Section name** (free text) and an editor. "Add another section" adds one more custom section |

There are no other section types: "View more sections" expands the same list of five.

---

## 5. The final screen (Finalize, `done`)

The main workspace (`img/70`). Layout:

- **Top bar:** Email · Print · Publish · Download · **Save & Continue** (goes to the dashboard).
- **Left sidebar:** all document sections (including custom ones) for jumping to editing, the
  **"+ Add new sections"** button (back to `add-sections`), the Resume Score widget.
- **Centre:** the document name with ✎ (rename, up to 150 characters, ✓/✕) and a **full-size live
  preview** of the document.
- **Right:** the **Templates** tab (32 thumbnails rendered with the user's data) and the
  **Formatting** tab (colours, font size, More font settings), with the Spell check toggle below.

**Section tools in the preview** (`img/64`, `img/67`): hovering a section shows a frame and a
floating toolbar **✎ edit** (jumps to the wizard step) · **🗑 delete** · **✥ move**,
and a **"Rename"** link at the heading.

---

## 6. Section management

### 6.1 Adding

- Standard sections appear as the wizard is completed.
- Additional ones (Languages, Volunteer, Awards, Websites, Custom ×N) are added on `add-sections`;
  "Add new sections" leads there from the final screen.
- **An empty section is not rendered in the document** (Summary was not visible until it was filled in).

### 6.2 Renaming

- "Rename" at a section heading in the preview turns the heading into an inline field (maxlength 50)
  with ✓/✕. Enter confirms.
- Verified: Skills → "Tech Stack". The new name appeared in the preview (the template's CSS sets
  the case, here UPPERCASE), in the sidebar, in the PDF and in the TXT.
- A custom section's name is set at creation (Section name) and changed the same way.

### 6.3 Moving up and down

- The ✥ handle on the section toolbar. Both mouse (drag-and-drop) and keyboard (focus the handle,
  Space, ↑/↓ arrows, Space) work: this is react-beautiful-dnd.
- **Sections can only move inside a template "zone".** Each template has its own containers. In
  Advanced (SLO7): header (Name, Contact) · zone 2 (Skills only) · main zone (everything else).
  Trying to drop Skills into the main zone or to lift Education above Skills changes nothing:
  the section stops at the zone boundary.
- Verified moves:
  - `EXPR > EDUC` → Education rose above Experience;
  - Education lifted above Websites;
  - Experience returned to the top of the main zone;
  - Websites dropped to the very bottom (+10 positions, stopped last).
- **The order is stored in the document and survives a template change.** After switching to
  Corporate (two-column) and back, the order was restored. In a two-column template the template
  itself distributes sections across columns: Contact, Skills, Languages, Websites go to the sidebar.

### 6.4 Deleting

- 🗑 on the section toolbar opens the confirmation "Remove this section? Once you delete it, it's
  gone for good. This action can't be undone." (Yes, delete it / Cancel) (`img/68`).
- The **section is deleted together with its data**. It cannot be undone (there is no document-level Undo).

### 6.5 Order of entries inside a section

| Section | How the order changes |
|---|---|
| Experience | drag-and-drop of cards on the list step |
| Languages | ≡ drag-and-drop of rows |
| Skills, Summary, Volunteer, Custom, descriptions | the order of lines in the editor text |
| Certifications, Awards | no dragging: only delete and re-enter |
| Education, References | several entries allowed; dragging not tested |

---

## 7. Design

### 7.1 Templates

- **32 templates** in the builder (`img/10`, `img/11`). Filters: Columns (All / 1 column (13) /
  2 column (19)), Graphics (With (7) / Without (25)), Colors (filter by palette), "PANTONE of the year".
  The first 6 are marked "Recommended" based on the questionnaire answers.
- Template code: `[S|M]L[O|A|X|Y|Z]n`, for example `SLO7` Advanced, `MLO1` Corporate, `MLO9` Clean.
  The S/M letter almost matches 1 and 2 columns, but not always (MLY4, MLY5, MLY8 are single-column).
- Full list (position · code · name):
  1 MLO9 Clean · 2 MLO1 Corporate · 3 SLO4 Milano · 4 SLO7 Advanced · 5 MLY1 Elite · 6 MLO4 Windsor ·
  7 SLA2 Epitome · 8 SLO6 Chicago · 9 MLX5 Aesthetic · 10 MLY4 Opulence · 11 MLZ1 Graduate ·
  12 MLO2 Paramount · 13 SLO8 Pantheon · 14 MLO7 Minimalist · 15 MLO6 Majestic · 16 MLX7 Fashionable ·
  17 MLY3 Solid · 18 SLO1 Professional · 19 SLO5 Modern · 20 MLY2 Timeless · 21 SLO3 Classic ·
  22 MLO8 Taj Mahal · 23 SLO2 Elegant · 24 MLY5 Supreme · 25 MLO3 Magnate · 26 SLA4 Vanguard ·
  27 SLO9 Contemporary · 28 MLY7 Pastel · 29 MLY6 New Age · 30 MLZ2 Picture · 31 MLY8 Connery · 32 MLO5 2026.
- Switching templates on the final screen is instant. Content, colour, section order and font
  settings are kept (`img/76`: Corporate with the same content).
- A template is an HTML/CSS "skin" (`/skinblob/<code>.htm`) applied to the document markup.
  The markup is shared by all templates (sections `data-section-cd`, fields `FIELD_*`); the template
  is responsible only for layout and styles.

### 7.2 Colours

**Palette:** 6 families of 3 shades, 18 colours in total. Plus "PANTONE of the year" and "Reset color".
The template screen shows the families as circles; the final screen as a 6×3 grid (`img/70`).

| Family | Shade 1 | Shade 2 | Shade 3 |
|---|---|---|---|
| Black / grey | Classic Black `#333333` | Gray `#666666` | Light Gray `#999999` |
| Blue | Naval `#335776` | Blue `#2A68A0` | Blue Gray `#799ACC` |
| Blue-cyan | Blue Green `#469FBE` | French Blue `#0077C0` | Crystal Teal `#00637C` |
| Teal | Turquoise `#61C1B1` | Common Teal `#009193` | Teal `#1E666F` |
| Yellow / orange | Dark Yellow `#E0A83A` | Gold `#CAA04C` | Orange `#E18926` |
| Purple | Amethyst 1 `#7851A9` | Amethyst 2 `#AA81D5` | Amethyst 3 `#CAB2E4` |
| Pantone | Cloud Dancer `#F0EFEB` | | |

Mechanics:

- The chosen colour is written into the document as an `sdcl-<HEX>` class on the document root.
  **One accent colour per document.** The template decides which elements use it.
- In Advanced (SLO7) the accent colours: the job title under the name, company and school names,
  the referee's company, language levels, the header divider line. Section headings and body text
  stay black (`#050505`).
- In Corporate (MLO1) the accent **fills the header background** (`img/76`).
- The colour is applied **as is, with no contrast correction**: Amethyst 3 `#CAB2E4` or Light Gray
  `#999999` on white make company names hard to read. The exception is Pantone Cloud Dancer:
  text uses a darkened variant `rgb(117,111,106)`.
- **Reset color** restores the template's default colour (for SLO7 it is `#696969`, which is not in
  the palette).
- A colour chosen on the template screen is saved into the document and carries over to the final screen.

### 7.3 Font

- **Font**: 12 fonts — Arimo, Bodoni MT, Catamaran, Georgia, Hind Madurai, Lora, Manrope,
  Nunito Sans, Open Sans (default in SLO7), Roboto, STIX Two Text, Tahoma (`img/73`).
- **The font changes only the body text.** The name and section headings keep the template font
  (Poppins in SLO7). Verified with Georgia.
- The PDF embeds font subsets (TrueType CID): Poppins Bold/Regular, Open Sans
  Regular/Bold/Italic, Roboto (icons and digits).

### 7.4 Font size (presets)

Three buttons: **Small / Default / Large**. A preset sets the size **and** the Line Spacing slider.

| Preset | Body text | Line height | Line Spacing (slider) | Section heading | Name |
|---|---|---|---|---|---|
| Small | 9 px | 14 px | 3 | 12 px | 27 px |
| Default | 10 px | 14 px | 2 | 12 px | 28 px |
| Large | 14 px | 20 px | 4 | 16 px | 32 px |

(preview px = PDF pt, see 9.2)

### 7.5 Spacing (More font settings)

Three sliders (react-slider, scale 0–20, step 1, keyboard support: arrows, Home, End) (`img/71`).
Measured in the SLO7 template at Default:

| Slider | Code | Default | What it changes | Formula (measured) | Document height in preview at 0 / default / 20 |
|---|---|---|---|---|---|
| Section Spacing | SSPC | 10 | Space above each section | `margin-top = 10 + v` px (0→10, 10→20, 20→30) | 1421 / 1521 / 1621 |
| Paragraph Spacing | PSPC | 10 | Space between entries inside a section (job↔job, school↔school) | `margin-top = v` px (0→0, 20→20) | 1501 / 1521 / 1541 |
| Line Spacing | LNSP | 2 | Line height of all text | `line-height = base + v` px; base 12 px for 10-px text (0→12, 2→14, 20→32), 16 px for Large | 1409 / 1521 / 2571 |

- The space between list bullets (4 px) and the page margins **cannot be adjusted**. The engine has
  `vmargins`, `hmargins`, `pagesize` classes, but the UI does not expose them.
- The values are saved in the document and survive a reload and reopening.
- **Reset font settings** resets, without confirmation, the font, the size (to Default) and the
  sliders (to 10/10/2). It does not touch the colour (Reset color is separate).

### 7.6 Page format

**US Letter only** (612 × 791 pt). There is no A4 option in the UI. PDF margins are about 23 pt
(~8 mm) on the left, right and top, and cannot be adjusted.

---

## 8. Preview

| Where | What it shows | Interaction |
|---|---|---|
| Mini preview in the wizard sidebar | The whole document at ~0.35 scale, updated while typing (before saving) | Preview button |
| Preview (modal from the wizard) | Full-size document, Templates and Formatting tabs | "Continue editing" closes it (`img/21`) |
| Final screen | Full-size document with section tools | Rename, edit, delete, move right in the preview |
| Template thumbnails | All 32 templates with the user's data | A click applies the template |

- **The preview matches the PDF (WYSIWYG).** Fonts, colours, order and line breaks in the PDF are
  the same as on screen (compare `img/66` and `img/84`). The preview and the PDF use the same HTML;
  the PDF is rendered on the server.
- ⚠ **The preview is one continuous canvas without page boundaries.** You cannot see where the first
  page ends or how many pages there will be. The page count is only known from the downloaded PDF.
- A preview 684 px wide corresponds to a 612 pt PDF (scale ≈ 1.12).
- The final screen renders 33 live copies of the document (the main one and 32 thumbnails).
  The page is heavy: Playwright screenshots hung on it, and a CDP capture was needed.

---

## 9. PDF export

### 9.1 Download wizard (`img/77`, `img/78`)

1. A modal "Resume Score: Hold on! Your resume needs attention" (Fix my resume / No thanks) —
   an upsell that appears with a delay of up to several seconds.
2. **Choose Format:** a "Resume Name" field (prefilled with the document name) and PDF / Word (.docx)
   / Plain Text (.txt) radio buttons.
3. **Delivery Method:** checkboxes "Download to your device", "Email your resume to: …",
   "Get a shareable link (New)". ⚠ In this session the DOM showed **all three** checked by default
   (earlier Email was unchecked by default — possibly an A/B test). Before every download
   Email and Shareable link were unchecked.
4. **Finished!** "Your resume is set!", links Edit your resume / Go to dashboard.

The file name is built from the document name **without spaces, hyphens and punctuation**:
`TEST-RG-Research-Alex-Testerson` → `TESTRGResearchAlexTesterson.pdf`.

### 9.2 PDF properties (file `export/A-default-SLO7-naval.pdf`)

| Property | Value |
|---|---|
| Format | Letter 612 × 791.04 pt, PDF 1.4, 76 KB |
| Pages | 2 (at Default) |
| Text | Vector, selectable and copyable (CID fonts with Unicode): ATS-readable |
| Fonts | Embedded as subsets: Poppins, Open Sans, Roboto |
| Images | None (contact icons are vector or font glyphs); a photo, if uploaded, is embedded as an image |
| Links | Clickable: LinkedIn, Website, the Websites section, links from the editor |
| Metadata | Title = candidate name; Creator and Producer empty; an empty AcroForm is present |
| Scale | 1 CSS px = 1 pt: margin 23 px → 23 pt, name 28 px → ~28 pt |

### 9.3 How settings change the PDF (one document, three exports)

| Export | Settings | Pages | What is visible |
|---|---|---|---|
| A (`img/84`) | Default, SSPC 10 / PSPC 10 / LNSP 2, Naval | **2** | The last job is split: title and dates at the bottom of p. 1, bullets on p. 2 |
| B (`img/80`) | Small, 0 / 0 / 0 | **2** (the second ~60% full) | Entries "stick together": the next job starts right under the last bullet of the previous one, with no gap |
| C (`img/81`) | Large, 20 / 20 / 20 | **5** | The "CERTIFICATIONS" heading stayed at the bottom of p. 3 and its content went to p. 4 (an orphaned heading); the Summary is split |

Conclusions for the specification:

- Page breaks are placed by lines. There are no "keep heading with first line" or "do not split a
  job entry" rules.
- There is no "fit to 1 page" hint and no page-count indicator.
- One step of the Line Spacing slider adds +1 px to every line. On a long resume this adds pages
  quickly: going from 2 (default) to 20 increased the document height by ~70% (1521 → 2571 px).

---

## 10. TXT export (file `export/A-default.txt`)

Available on the free plan. Structure:

```
<!-- Feature Functionality Support -
Photo shape support - No
Duration tag - No
PPDT Section - Yes
SGTR section - Yes
PICT support - No
Monogram support - No
-->
Alex Testerson

Senior Software Engineer (Test Persona)

Contact

Email:
alex.testerson@example.com

Phone:
611 22 33 44

Address:
Valencia, Valencia, 46001

LinkedIn: / Twitter: / Website: / Date of Birth: / Driving License: / Nationality:  (each: label on one line, value on the next)

Experience

Lead Backend Engineer
Acme Test Corp, Valencia, Valencia / Jan 2022 - Present

<paragraphs and bullets — each on a new line, without markers>
...
Education
Test State University
Kharkiv, Ukraine
Jun 2016

Master of Science (M.S.)
Computer Science
...
```

Specifics and losses:

| # | Observation |
|---|---|
| T1 | The file starts with a **technical HTML comment** (8 lines) that the user has to delete by hand |
| T2 | **The section order in the TXT does not match the preview and the PDF.** PDF: Tech Stack → Summary → Experience → Education → … → Websites. TXT: Experience → Education → Tech Stack → Certifications → References → Languages → Awards → Open Source Projects → **Professional Summary at the very end** |
| T3 | **The Websites section is lost from the TXT entirely** (the GitHub link is missing) |
| T4 | Bold, italic, underline and list bullets are lost: a bullet is just a line |
| T5 | Links from the editor keep only the text; the URL is lost |
| T6 | Months are abbreviated (`Jan 2022`), although the PDF has them in full (`January 2022`) |
| T7 | Mixed line endings: CRLF and LF in one file, trailing spaces present |
| T8 | Languages: "English, Fluent" with a comma. Referee: "Name, Title, Company" and "phone - email - relationship" |
| T9 | Section renames are respected ("Tech Stack", "Open Source Projects") |

---

## 11. Other features (brief)

| Feature | How it works | Observation |
|---|---|---|
| Word (.docx) | Same download wizard | Not downloaded |
| Print | Generates the same PDF and hands it to the browser for printing | In Playwright the PDF was simply downloaded |
| Email | Sends the resume by email from the builder | Not used: an external action |
| Publish / Unpublish | "Digital resume" at a public link | Not used: publishes externally |
| Upload resume | `how-to-start?flow=upload`: parses your own file into a template | Not tested |
| Duplicate | Dashboard More → Duplicate, plus "Create new resume" based on an existing one | A full copy of the document |
| AI "Sage" | Experience bullets, skills, summary by job title; "Refine with Sage" | Suggestions are generic, not tailored to the candidate's stack |
| Pre-written examples | Phrase library by job title for experience, skills, summary, volunteer, education | A click adds, a second click removes |
| Resume Score | 0–100 widget ("Good foundation" 60 → "Strong base" 70.5 after the summary); tips like "lacks measurable results" | Used as an upsell before download |
| Spell check | A toggle on the final screen, an AB✓ button in editors | No visible effect in the preview on the test data |
| Photo | Upload, crop, stored in the document | Shown only in templates with a photo |
| Autosave | Every action goes to the server immediately | Still asks `beforeunload` when leaving the page |

---

## 12. Defects and UX problems found

| # | Severity | Description | How to reproduce |
|---|---|---|---|
| D1 | High | The section order in the TXT does not match the PDF and the preview; the Summary moves to the end | Reorder sections, download the TXT |
| D2 | High | The Websites section is lost in the TXT | Add Websites & Social Links, download the TXT |
| D3 | Medium | Twitter `@alextest` becomes a broken link `https://alextest/` in the PDF | Contact → Twitter = `@handle`, download the PDF |
| D4 | Medium | No page markers in the preview: the page count is only visible in the PDF | Any resume longer than 1 page |
| D5 | Medium | Page breaks split a job entry and leave orphaned headings | Exports A and C |
| D6 | Medium | Light palette colours (`#CAB2E4`, `#999999`, `#61C1B1`) produce unreadable text: contrast is not checked | Choose Amethyst 3 |
| D7 | Medium | US Letter only, no A4 (important for Europe) | — |
| D8 | Medium | In the download wizard Email and Shareable link are checked by default: risk of accidentally sending or publishing the resume | Download → step 2 |
| D9 | Low | The Certifications step is in the flow but not in the wizard sidebar | Go through the wizard |
| D10 | Low | Template phrases are inserted with `[Award]` placeholders that are easy to forget | Education → Award or Honor |
| D11 | Low | The Summary text was not saved on the first input | Type the summary right after the step loads |
| D12 | Low | The referee's phone is normalised to `34600000000` (no "+" or spaces) | References → Phone `+34 600 000 000` |
| D13 | Low | The country from Contact is not shown in the resume's address line | Contact → Country = Spain |
| D14 | Low | A technical HTML comment at the start of the TXT | Any TXT |
| D15 | Low | The file name loses hyphens and spaces | Any export |
| D16 | Info | `beforeunload` on every page exit, even with no unsaved changes | Any navigation |
| D17 | Info | Promo modals (Meet Sage, AI bullets, AI skills, Resume Score) interrupt the flow 4–5 times per session | Go through the wizard |

---

## 13. Feature catalogue for selection

Legend for the "Relation to the core feature" column: **Core** — directly part of the requested
scope (create a resume, one style, 3 colours, spacing, preview = PDF, TXT export);
**Support** — without it the core is inconvenient or does not work; **Extra** — everything else.

| ID | Feature | How Resume Genius does it | Relation | Decision |
|---|---|---|---|---|
| F01 | Account area with a list of documents | Cards, Edit, Download, More (Print, Duplicate, Delete) | Support | |
| F02 | Several resumes per account and copying a resume | Create new based on an existing one, Duplicate | Extra | |
| F03 | Onboarding questionnaire (experience, education) | 3 questions, affect template recommendations | Extra | |
| F04 | Uploading and parsing your own resume | `flow=upload` | Extra | |
| F05 | Template choice from a gallery with filters | 32 templates, column and graphics filters | Extra (one style in scope) | |
| F06 | Step-by-step wizard with a sidebar and progress | 11 steps, Resume progress % | Support | |
| F07 | Contact: name, job title, email, phone, address | See 4.1 | Core | |
| F08 | Extra contact fields: DOB, licence, nationality, LinkedIn, Twitter, Website | "Add more details" chips | Extra | |
| F09 | Photo | Upload and crop | Extra | |
| F10 | Experience: job form, "I currently work here" | See 4.2 | Core | |
| F11 | Text editor: B / I / U, list, links, undo/redo | Draft.js | Support | |
| F12 | Library of ready phrases by job title | Pre-written examples | Extra | |
| F13 | AI generation of bullets, skills, summary | Sage | Extra | |
| F14 | Manual drag-and-drop order of entries | Experience, Languages | Core (order control) | |
| F15 | Education with details | See 4.3 | Core | |
| F16 | Certifications, Awards (simple lists) | Single-line fields | Support | |
| F17 | Skills | Editor and a 6–10 counter | Core | |
| F18 | Summary | Editor and ready variants | Core | |
| F19 | References | Yes / Upon Request / No | Extra | |
| F20 | Languages with a level | 7 levels | Support | |
| F21 | Volunteer | Editor | Extra | |
| F22 | Websites & Social Links (+ "to header") | URL + checkbox | Support | |
| F23 | Custom sections (free name, N of them) | Custom Section | Core (flexible sections) | |
| F24 | Renaming sections | Inline "Rename", ≤ 50 characters | Core | |
| F25 | Moving sections up and down | ✥ drag and keyboard, within the template zone | Core | |
| F26 | Deleting a section with confirmation | Modal, no undo | Core | |
| F27 | Hiding empty sections | Automatic | Support | |
| F28 | Accent colour palette | 18 colours (6×3) + Pantone + Reset | Core (3 colours in scope) | |
| F29 | Font choice | 12 fonts, body text only | Extra | |
| F30 | Font size, 3 presets | Small / Default / Large | Support | |
| F31 | Section spacing slider | SSPC 0–20 | Core | |
| F32 | Entry spacing slider | PSPC 0–20 | Core | |
| F33 | Line spacing slider | LNSP 0–20 | Core | |
| F34 | Design reset | Reset font settings, Reset color | Support | |
| F35 | Live WYSIWYG preview = PDF | One HTML for screen and PDF | Core | |
| F36 | Section tools right in the preview | ✎ 🗑 ✥ Rename on hover | Support | |
| F37 | Mini preview and Preview from any step | Sidebar and modal | Support | |
| F38 | Template switch without data loss | Instant | Extra | |
| F39 | PDF export (vector text, fonts, links) | Server-side rendering | Core | |
| F40 | TXT export | Free plan | Core | |
| F41 | DOCX export | Subscription | Extra | |
| F42 | Print | PDF to the browser | Extra | |
| F43 | Email from the builder | Delivery step | Extra | |
| F44 | Public link to the resume | Publish | Extra | |
| F45 | Resume Score and tips | 0–100 widget | Extra | |
| F46 | Spell check | Toggle | Extra | |
| F47 | Autosave | Every change | Support | |
| F48 | Renaming the document | ✎ at the title, ≤ 150 characters | Support | |
| F49 | Paywall on PDF and DOCX | Free = TXT only | Extra (business) | |
| F50 | Cover Letter Builder | A separate product | Extra | |

---

## 14. Draft requirements for the "core feature"

These are **proposals** derived from the observations and defects above. They do not replace the
selection in section 13; they show how each item can be phrased in a testable way.

### 14.1 One style

- R1. One single-column template modelled on SLO7 Advanced (`img/66`): name → job title →
  contacts on one line → sections. Rationale: a single zone for all sections removes the
  "move only within a zone" limitation (6.3), and a single-column layout reads better in an ATS.
- R2. Document markup is separated from style (as in RG: shared HTML + a CSS skin). A second
  style can then be added later without reworking the data.

### 14.2 Three colours

- R3. One accent colour per document, chosen from 3 presets. The proposed model is taken from RG
  (family × shade): for example `#333333` (graphite), `#335776` (Naval), `#1E666F` (Teal).
  These are dark shades with contrast against white ≥ 4.5:1, so defect D6 does not apply.
- R4. List explicitly what uses the accent (as in SLO7: job title under the name, company and
  school names, header line, language levels) and what does not (body text, headings).
  The alternative is to colour section headings too; that is a product decision.

### 14.3 Spacing control

- R5. Three sliders as in RG: between sections, between entries, line spacing. A 0–20 scale with
  step 1 and the formulas from 7.5 are a proven starting point.
- R6. A "Reset design" button.
- R7. (Beyond RG) Show the PDF page count next to the sliders and/or a "Fit to 1 page" button.
  Fixes D4.

### 14.4 Preview = PDF

- R8. The preview and the PDF are rendered from the same HTML/CSS (as RG does). Acceptance
  criterion: text, line breaks and page breaks match between the preview and the PDF.
- R9. (Beyond RG) The preview is split into pages of the chosen format with visible boundaries.
- R10. (Beyond RG) Break rules: a section heading is never the last line of a page, and an entry
  header (title, company, dates) is never separated from its first bullet. Fixes D5.
- R11. A4 page format (and Letter if needed). Fixes D7.
- R12. PDF: vector selectable text, embedded fonts, clickable links. Twitter and other "@handle"
  values are not turned into scheme-less URLs. Fixes D3.

### 14.5 Sections

- R13. Sections can be renamed (≤ 50 characters), moved up and down (drag and ↑/↓ buttons for
  accessibility), and deleted with confirmation. (Beyond RG) Undo of the last deletion.
- R14. Empty sections are not rendered in the document.
- R15. Custom sections with a free name.
- R16. Manual drag-and-drop order of entries inside a section.

### 14.6 TXT

- R17. The section order in the TXT = the order in the document. No section is lost. Fixes D1, D2.
- R18. No technical comments; UTF-8; one line-ending scheme. Fixes D14, T7.
- R19. Define the format: bullet marker (for example `- `), date format (the same as in the PDF),
  links as `text (URL)`. Fixes T4–T6.
- R20. A separate "save/export as TXT" action — a button next to "Download PDF", without a
  three-step wizard and without upsells.

---

## 15. Technical observations

### 15.1 Front-end stack (from the DOM)

| Component | Library |
|---|---|
| SPA | React |
| Text editor | Draft.js (`public-DraftEditor-content`) |
| Dropdowns | react-select v1 (`.Select-control`, `.Select-option`) and react-autosuggest |
| Dragging sections and entries | react-beautiful-dnd (`data-react-beautiful-dnd-drag-handle`) |
| Sliders | react-slider (`.example-thumb`, `aria-valuenow`) |
| Calendar | react-calendar |
| Icons | Font Awesome |
| Protection | Cloudflare (a direct `curl` to `/skinblob/*.htm` gets a 403 challenge) |

### 15.2 Document model (section and field codes in the DOM)

| Code | Section | Fields |
|---|---|---|
| NAME | Name | FNAM, LNAM, RTTL (job title) |
| CNTC | Contact | HPHN, EMAI, STRT, CITY, STAT, ZIPC, SOCL (social), DOB1, DRIV, NTLY |
| SUMM | Summary | FRFM (text) |
| HILT | Skills | FRFM (one item = one paragraph) |
| EXPR | Experience | JTIT, COMP, JCIT, JSTA, JSTD (start), EDDT (end), JDES (description) |
| EDUC | Education | SCHO, SCIT, SSTA, DGRE, STUY, GRST, GRYR, GRED, FRFM (details) |
| CERT | Certifications | FRFM |
| REFR | References | FNAM, LNAM, RTIT, RCOM, RELN, CPHN, HPHN, EMAI |
| LNGG | Languages | FRFM (language), RATT (level), ADIF |
| VLTR | Volunteer | JTIT, JDES |
| AWAR | Awards | FRFM |
| ALNK | Websites | LNK1… |
| CUST | Custom (with a GUID) | FRFM, section name |

A document = an ordered list of sections, a section = a list of "paragraphs" (entries), a paragraph =
a set of fields. The template distributes sections across containers (`CONTAINER_0…3`). The
document style is stored as classes on the root: `skn-<code>` (template), `sdcl-<HEX>` (colour) and
the SSPC / PSPC / LNSP, size and font values.

### 15.3 API

Requests go to `/gtwy/<hex string>?fuete=1`: paths are encrypted, so endpoints cannot be told apart
by URL. Changes are sent as PATCH requests right after each action. Templates load as
`/skinblob/<code>.htm`, the config as `cdn.resumegenius.com/assets/blobcontent/rgn/rbg/config/prod.json`.
The API was not explored further (not needed for the specification).

---

## Appendix A. Test data

Persona Alex Testerson, Senior Software Engineer: 3 jobs (one current, one with B/I/U formatting,
a link and a long bullet), a master's degree with details, 3 certifications, 9 skills (section
renamed to "Tech Stack"), a summary, 1 referee, 3 languages, 2 awards, 1 custom section
"Open Source Projects", 1 link in Websites. A Volunteer section was added and then deleted (a
deletion test). Template SLO7, colour Naval.

## Appendix B. Research limitations

- Not tested: uploading and parsing your own resume, photo upload (the mechanics are described from
  earlier work with the site), DOCX, Email, Publish, Cover Letter, the mobile version, guest
  (logged-out) mode and the paywall for a free account.
- All measurements were made in the SLO7 template. Other templates have different base sizes and a
  different role for the accent colour.
- The site runs A/B experiments (`/experiment/gn/…`), so some behaviour (for example, the default
  checkboxes in the download wizard) may differ between users.
