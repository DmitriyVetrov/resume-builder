# Preview, layout and export

- Preview, PDF and TXT must consume the same canonical resume document model.
- Preview/PDF share a single layout result/algorithm: same page count, page content and line breaks.
- Preserve page size A4/US Letter, typography, margins, pagination and per-template rules.
- PDF text must be selectable/searchable, fonts embedded, links clickable and Unicode correct.
- TXT is UTF-8 without BOM, deterministic, no markup/service comments, and follows `TECHNICAL-SPEC.md` §9.
- Do not use system fonts as an uncontrolled dependency; bundle/version font assets.
- Every renderer change runs fixture-based text/layout tests; visual regression tests where practical.
