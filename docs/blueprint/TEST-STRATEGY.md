# Test Strategy

## Layers
- Unit: Domain invariants, application use cases, validators, serializers and pure layout functions.
- Integration: API + database adapter, object storage adapter, auth/email adapters, background processing.
- Contract: OpenAPI schema validation, generated client/server compatibility, request/response/error examples.
- Component: React editor controls, state transitions, autosave states, accessibility semantics.
- E2E: account, create/edit/copy/delete resume, reorder/hide sections, template/design changes, autosave/reload, export.
- Rendering regression: page count, extracted text by page, line breaks and visual diffs.
- Security: authorization isolation, upload validation, token expiry, rate limits, sensitive log checks.
- Performance: NFR p95 targets and realistic fixtures.

## Candidate tooling (confirm in P03)
Backend: xUnit; FluentAssertions and NSubstitute are optional candidates; ASP.NET Core integration test host; testcontainers if selected DB supports reliable containerized tests.
Frontend: Vitest, React Testing Library, Playwright.
Cross-stack: Playwright E2E, OpenAPI validation tooling, PDF text extraction and raster visual diff tooling.

## TDD protocol
1. Convert FR/NFR acceptance criteria into test cases.
2. Create test fixture and executable failing test.
3. Confirm failure is meaningful.
4. Implement minimum production code.
5. Run focused tests; refactor.
6. Run impacted suite and record exact output.
7. QA runs acceptance tests independently.

## Coverage guidance
Coverage is a diagnostic, not the definition of done. Aim ≥90% Domain and ≥85% Application logic once baseline stabilizes, but prioritize branch, negative, authorization, concurrency and rendering cases. Every Must requirement needs automated test evidence or an approved reason why automation is unsuitable.

## Required fixtures
- Empty/default resume; minimal one-page; multi-page; maximum-size boundary.
- T1/T2/T3, A4 and Letter.
- Small/Medium/Large; all three T1 accent colors.
- Spanish/Catalan/Ukrainian/Slovak names and accents; Unicode links.
- Photo with EXIF GPS, oversized/invalid images.
- Empty/hidden sections; duplicate sections; reorder and undo.
- Paragraph + bullet list mixed rich text; links; malformed pasted content.
- Long bullets/paragraphs crossing page boundaries; manual page break.
- Stale concurrent update; offline queue; retry/idempotency.
