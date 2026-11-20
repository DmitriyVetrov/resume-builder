# ADR-055 — CV import: browser extraction, LLM structuring with a verbatim check, deterministic fallback

- Status: **Accepted** (owner decision 2026-11-14/15, details `DELEGATED-DEFAULT`)
- Decider: Owner (scope, model and provider, residency, sidebar pairs, dropped images, notice line); Operator (architecture, contract, limits, validation, delegated, ADR-051 S-5)
- Date: 2026-11-15 (change IMP-01, outside the phase sequence, before P14)
- Source IDs: TECHNICAL-SPEC §3.2 X1, X8; §12 D-08; §9 (TXT format); §10 (document model); NFR-09; ADR-012 (amended by its Amendment 1), ADR-020 (superseded), ADR-023 (entry labels), ADR-025 (placement), ADR-036 (session and CSRF), ADR-038 (limits), ADR-054 (T4)
- Supersedes: [ADR-020](ADR-020-no-resume-import.md)
- Work package: `docs/blueprint/changes/IMP-01-cv-import/`

## Context

TECHNICAL-SPEC excludes "Upload and parse an existing resume" (X8, D-08 "Not in v1"), and ADR-020 decided
accordingly. X1 excludes "any AI assistant: generated bullet points, skills, summaries, rewrite, tone change".

On 2026-11-14/15 the owner changed the scope (handoff decisions O-1 to O-6): a user can import an existing
CV, and the structuring of its text uses Claude Haiku 5.5 on the Anthropic first-party API (O-2). The owner
suspended ADR-012's EU processing rule for the MVP (O-3, ADR-012 Amendment 1), decided that sidebar
label/value pairs become `entries` sections placed in the sidebar (O-4), that images inside sections are
dropped with a warning (O-5), and that formal GDPR measures are deferred with one notice line kept (O-6).

TECHNICAL-SPEC outranks ADRs in the source hierarchy, so this ADR records the owner override explicitly
(PROJECT-CHARTER, "Source-of-truth hierarchy").

## Decision

1. **Owner override of the source specification.** X8 and D-08 are lifted: CV import is in scope (PDF with a
   text layer Must, own TXT §9 Should, DOCX Could). ADR-020 is superseded.
2. **X1 stays in force, and import does not breach it.** The LLM only *structures* text the user supplied:
   it assigns the user's own strings to fields. It never generates, rewrites, summarises, translates or
   suggests. This is enforced, not trusted: the server's **verbatim check** (§5) rejects any string that does
   not occur in the submitted source text, and the user reviews the result before anything is saved.
3. **Pipeline.**
   - **Browser:** pdf.js (`pdfjs-dist`, pinned, `isEvalSupported: false`, in a same-origin worker, loaded by
     `import()` only when the user imports) reads text items with position, font size and weight, the
     structure tree when the PDF is tagged, link annotations and images. A layout analysis detects one or two
     columns and the sidebar side, orders lines per column, merges paragraphs and detects bullets (glyphs,
     L/LI tags, hanging indent). It serialises a compact intermediate text, one line per text line with short
     attribute tags. **The file and the photo never leave the browser;** only that text is sent.
   - **Server:** a new operation `POST /resume-imports/structure` (session and CSRF, rate-limit policy
     `resume-import`) sends the text to the provider and returns a validated **import draft** with warnings.
   - **Browser:** the draft becomes a `ResumeDocument` through the existing document operations only
     (`newSection`, `newEntry`, `newListItem`, `newContact`, `clampCodePoints`, `normalizeBlocks`,
     `setPlacement`, `switchTemplate`). A review step shows the live preview and an import report (recognised,
     clamped, dropped, rejected by the verbatim check). "Create resume" stores it with the existing
     `createResume` (`source: document`), then uploads the photo with the existing `uploadPhoto`.
4. **Provider.** The official Anthropic C# SDK behind an Application port, an Infrastructure adapter, and a
   **stub provider** (recorded responses, no network) selected by configuration for development, CI and tests.
   - Primary model `claude-haiku-5-5`, escalation model `claude-sonnet-5-5`, both from configuration.
   - Structured outputs (`output_config.format`, a JSON schema of the draft). The schema is non-recursive and
     carries no length constraints; limits are checked by the server (§5).
   - Haiku: thinking disabled, effort `low`. Sonnet: thinking `between_tools` (Sonnet 5.5 rejects `disabled`),
     effort `low`. No `temperature` or `top_p`. `max_tokens` 16,000. No server-side refusal fallback: a refused
     or failed escalation ends in the deterministic fallback parser, which costs nothing and is reviewed like
     any other draft.
   - The key comes from configuration (`Anthropic:ApiKey`, environment `Anthropic__ApiKey`); `.env.example`
     holds a placeholder only. The operator never creates or changes secrets.
   - The source text goes in the user turn between delimiters, and the system prompt states that anything
     inside them is content, not instructions. Prompt injection can at worst produce a wrong structure, which
     the verbatim check limits to the user's own strings and the user sees in review.
5. **Validation, then escalation once.**
   1. Schema and limit validation against the contract's `ImportDraft` and the document `LIMITS`.
   2. **Verbatim check:** every draft string occurs in the source after normalisation (Unicode NFKC,
      whitespace runs, dash and quote variants, the source's inline tags removed; case-insensitive for
      section titles, so a title may come back in title case). Every link target occurs in the source. Every
      date year and month occurs as digits or as a month name in the source.
   3. A Haiku draft that fails either check, a refusal, `max_tokens` or a timeout → **one retry on Sonnet**.
   4. A Sonnet draft drops the strings that fail the verbatim check and reports each as a warning with its
      JSON pointer; a refusal, a schema failure, a timeout, a missing key or a draft left without a name and
      without sections → `503 import_unavailable`, and the browser runs the **fallback parser**: the largest
      line on page 1 is the name, the next distinct line the headline, contacts by pattern, headings by style,
      bullets to `list`, the rest to `text`, no entry segmentation. The user is told the result is basic.
6. **Limits** (`DELEGATED-DEFAULT`): file ≤ 10 MB and ≤ 5 pages; source text ≤ 60,000 characters; signed-in
   users only; per user 10 imports per hour and 30 per day. A scanned or image-only PDF gets a "no text layer"
   message; there is no OCR.
7. **Template choice:** a left sidebar → T4, a right sidebar → T3, one column → T1. Accent preset 0; language
   and date format detected from the source; the resume title from the name.
8. **Privacy notice** (O-6): the import dialog says "The CV text is processed by Claude (Anthropic). The file
   and photo are not sent."

## Alternatives considered

- **Keep ADR-020 (no import):** the owner's scope decision O-1 overrides it.
- **A deterministic parser only:** no provider and no cost, but entry segmentation (title, organisation,
  dates, description) across arbitrary CV layouts is not reliable enough; it remains the fallback.
- **Send the PDF itself to the model** (document input): simpler, but the file and the photo would leave the
  browser, and the model would read rather than receive exactly the text the verbatim check compares with.
  Rejected.
- **Server-side PDF parsing:** a document parser in the API's attack surface (ADR-020's concern) and the file
  on our servers. Rejected.
- **The server-side refusal fallback on Sonnet:** it would route a refused request to a further model with
  its own price and behaviour, and the request already carries `between_tools`, which only Sonnet 5.5
  accepts. The deterministic fallback parser covers the same case. Rejected.

## Rationale

The owner chose the scope, the model and the provider. Keeping extraction in the browser keeps the file and
the photo local and the server free of document parsers. The verbatim check turns X1 from a prompt
instruction into a property the server enforces. One escalation bounds cost: a typical CV costs about
€0.002–0.003 on Haiku 5.5 and about €0.05 when escalated.

## Consequences

- The contract gains one operation, its schemas and the `resume-import` policy (minor version 1.2.0).
- The backend gains an import port, the Anthropic adapter, the stub provider and the validation.
- The frontend gains a lazily loaded import feature, `pdfjs-dist` as a dependency, and an "Import CV" button
  in the library.
- The CSP stays as it is: the pdf.js worker is same-origin (`script-src 'self'`) and pdf.js runs without eval.
- Follow-up for the owner: TECHNICAL-SPEC §3.2 (X8), §5.8 and §12 (D-08) may be updated to match.

## Security/privacy impact

- The CV text goes to Anthropic (US) under ADR-012 Amendment 1; storage stays in the EU. The file and the
  photo never leave the browser.
- `sourceText`, prompts and responses are never logged: only status, model, token counts and duration.
- pdf.js runs with `isEvalSupported: false` (the CVE-2024-4367 class) in a worker; the PDF is untrusted input.
- Owner authorisation and CSRF as on every write; a per-user rate limit bounds cost; the owner sets a spend
  limit in the Anthropic Console.

## Owner and date

Owner (scope, O-1 to O-6), 2026-11-14/15; operator (details, `DELEGATED-DEFAULT`), 2026-11-15.

## Amendment 1 — entries in the fallback parser (owner, 2026-11-15)

Owner feedback on the editor after a basic import: a work-experience section came in as a `text` section,
and it must come in as an `entries` section with its fields recognised. §5.4's "no entry segmentation" is
replaced: the fallback parser turns a section into `entries` when its first block is an entry row, either
"Title | Dates" or a title with its dates set on the same row. The next short row that does not end a
sentence is the organisation, split into organisation and location when it reads "Organisation · Location".
The remaining blocks are the description. Dates are read as in §4 (start, end, present), or kept verbatim in
`dateText`. A section that does not start with an entry row keeps its text unchanged, and the parser still
only picks and splits the source's own strings. A list glyph set as a separate run of its own ("●", then the
text) now marks a list item and no longer decides the line's weight (§3). Details: IMP-01 DD-IMP-27.
