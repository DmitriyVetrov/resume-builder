# Decision Register

Status vocabulary:
- `FIXED`: user constraint.
- `REQUIRED`: mandated by the source spec; only the implementation is open.
- `ACCEPTED`: decided by an Accepted ADR. Since ADR-035 these are decided by the Solution Architect under delegation and tagged `DELEGATED-DEFAULT`.
- `PROPOSED`: recommendation only.
- `OPEN`: must be decided.
- `SOURCE-OPEN`: open in the source spec.

A `FIXED` or `REQUIRED` row whose open aspect has been decided keeps its status and links the ADR that closed the aspect.

ADR files live in `decisions/`. Delegated decisions are listed per phase in `docs/phases/<phase>/decisions.md`. Owners and deadlines of the items still open are in `docs/phases/P00/governance/decision-owner-register.md` (GOV-04), and the "Phase" column below repeats the owning phase.

| ID | Topic | Current status | Blueprint handling |
|---|---|---|---|
| ADR-001 | Monorepo | FIXED | One Git repository; independent backend/frontend ownership |
| ADR-002 | Backend .NET | FIXED | Version decided: **.NET 10 LTS (`net10.0`)**, see [ADR-002](decisions/ADR-002-dotnet-version.md) (P01) |
| ADR-003 | Frontend React 19 + Vite | FIXED | Configuration decided: TypeScript strict, Node.js 24 LTS, npm, static SPA on the same origin, see [ADR-003](decisions/ADR-003-frontend-toolchain.md) (P01); router and state: [ADR-050](decisions/ADR-050-frontend-foundation-routing-and-state.md) (P05) |
| ADR-004 | NoSQL | FIXED | Provider decided: **MongoDB 8.x** (Atlas, EU region, in production), see [ADR-004](decisions/ADR-004-nosql-provider-mongodb.md) (P01) |
| ADR-005 | Tailwind CSS 4 | FIXED | Adopt in frontend foundation |
| ADR-006 | API contract-first | FIXED | Format decided: **OpenAPI 3.1.0**, one file `contracts/openapi/openapi.yaml`, base path `/api/v1`, semver from 1.0.0, RFC 9457 Problem Details with `code`, closed request schemas, `x-phase` per operation, extension process, see [ADR-006](decisions/ADR-006-openapi-contract-format-and-conventions.md) (P02) |
| ADR-007 | Modular Monolith | ACCEPTED | [ADR-007](decisions/ADR-007-modular-monolith.md) (P01) |
| ADR-008 | Clean Architecture boundaries | ACCEPTED | [ADR-008](decisions/ADR-008-clean-architecture-boundaries.md) (P01); fitness rules F-BE-1…5, F-FE-1…3 |
| ADR-009 | Object storage for photos/exports | ACCEPTED | Azure Blob Storage, private, API-mediated, EU; exports not stored; SkiaSharp confirmed in P07, see [ADR-009](decisions/ADR-009-object-storage.md) (P01) |
| ADR-010 | Shared preview/PDF layout engine | REQUIRED | FR-PRV-02. Architecture decided: one frontend layout engine and page model; PDF and TXT generated in the browser, see [ADR-010](decisions/ADR-010-shared-layout-engine-and-rendering.md) (P01). Library confirmation by the prototype gate at the P10 start (G1–G7, G7 = cross-runtime identity) **Technology confirmed by the P10 gate, 2026-11-05:** fontkit, linebreak, PDFKit, DOM painter. |
| ADR-011 | T1/T2/T3 templates | ACCEPTED | D-12; same decision as ADR-024, decided once there and kept for ID stability, see [ADR-024](decisions/ADR-024-t2-t3-template-design.md) (P10) |
| ADR-012 | EU hosting/data residency | ACCEPTED | D-20: EU/EEA storage; Azure Germany West Central with Germany North pair, see [ADR-012](decisions/ADR-012-eu-hosting-data-residency.md) (P01). Go-live verification in P15. **Amendment 1** (owner, 2026-11-15): EU *processing* (§1) and sub-processor residency (§3) suspended for the MVP, so CV import may send text to Anthropic (US); §2, §4, §5 stay |
| ADR-013 | Authentication before verification | ACCEPTED | D-01: login allowed; export and data archive need verification, see [ADR-013](decisions/ADR-013-login-before-verification.md) (P01) |
| ADR-014 | Google sign-in | ACCEPTED | D-02: not in v1, see [ADR-014](decisions/ADR-014-google-sign-in.md) (P01) |
| ADR-015 | Guest mode | ACCEPTED | D-03: yes (Could), local draft plus claim through the normal create, see [ADR-015](decisions/ADR-015-guest-mode.md) (P01) |
| ADR-016 | Trash retention | ACCEPTED | D-04: 30-day trash, see [ADR-016](decisions/ADR-016-trash-retention.md) (P01) |
| ADR-017 | Guided first run | ACCEPTED | D-05: no guided first run and no seeded sample resume, see [ADR-017](decisions/ADR-017-guided-first-run.md) (P07) |
| ADR-018 | Default blank resume sections | ACCEPTED | D-06: FR-SEC-01 set built in the client, Education labels Degree/Institution, see [ADR-018](decisions/ADR-018-default-blank-resume.md) (P07) |
| ADR-019 | Autosuggest scope | ACCEPTED | D-07: no autosuggest (principle P1 of TECHNICAL-SPEC §2); month/year picker only; no country picker, see [ADR-019](decisions/ADR-019-no-content-autosuggest.md) (P01) |
| ADR-020 | Import existing resume | SUPERSEDED | D-08: excluded in v1 (X8), see [ADR-020](decisions/ADR-020-no-resume-import.md) (P01). Superseded by [ADR-055](decisions/ADR-055-cv-import.md) |
| ADR-021 | DOCX export | ACCEPTED | D-09: excluded in v1 (X9), see [ADR-021](decisions/ADR-021-no-docx-export.md) (P01) |
| ADR-022 | Monetization | ACCEPTED | D-10: out of scope (X10), see [ADR-022](decisions/ADR-022-no-monetization.md) (P01) |
| ADR-023 | Editable entry labels | ACCEPTED | D-11: editable per section, form only, see [ADR-023](decisions/ADR-023-editable-entry-labels.md) (P01) |
| ADR-024 | T2/T3 design | ACCEPTED | D-12: the §7 proposal with fixed tokens, see [ADR-024](decisions/ADR-024-t2-t3-template-design.md) (P10). ADR-011 is the same decision. A fourth template T4 is added by [ADR-054](decisions/ADR-054-template-t4-panel.md) |
| ADR-025 | T3 per-section placement | ACCEPTED | D-13: nullable per-section placement, defaults by type, see [ADR-025](decisions/ADR-025-t3-section-placement.md) (P01). Extended to T4's left sidebar by [ADR-054](decisions/ADR-054-template-t4-panel.md) |
| ADR-026 | T1 colors | ACCEPTED | D-14: Blue, Navy, Graphite, see [ADR-026](decisions/ADR-026-t1-accent-colors.md) (P10) |
| ADR-027 | Font scaling | ACCEPTED | D-15: ×0.9 / ×1.0 / ×1.2 rounded to 0.5 pt; markers and photo fixed; closes SC-06, see [ADR-027](decisions/ADR-027-font-preset-scaling.md) (P10) |
| ADR-028 | Line spacing step | ACCEPTED | D-16: 0.5 pt per step; the FR-LAY-04 formula is normative over the §6.2 line heights; closes SC-03, see [ADR-028](decisions/ADR-028-line-spacing.md) (P10) |
| ADR-029 | Concurrent tabs | ACCEPTED | D-17: 412, then reload with a notice and save unsynced edits as a conflict copy, see [ADR-029](decisions/ADR-029-concurrent-tabs.md) (P01) |
| ADR-030 | T1 link styling | ACCEPTED | D-18: accent colour, no underline, see [ADR-030](decisions/ADR-030-link-styling.md) (P10) |
| ADR-031 | Education entry layout | ACCEPTED | D-19: same block as Experience, see [ADR-031](decisions/ADR-031-education-entry-layout.md) (P10) |
| ADR-032 | Hosting region | ACCEPTED | D-20; same decision as ADR-012, kept for ID stability. Decided once in [ADR-012](decisions/ADR-012-eu-hosting-data-residency.md) (P01) |
| ADR-033 | Hosting platform and CI provider | ACCEPTED | Azure Container Apps in the EU region; GitHub Actions calling repo scripts, runnable locally, see [ADR-033](decisions/ADR-033-hosting-platform-and-ci.md) (P01) |
| ADR-034 | Transactional email provider | ACCEPTED | SMTP adapter; Mailpit locally; ACS Email (Europe data location) in production with an EU fallback, see [ADR-034](decisions/ADR-034-transactional-email.md) (P01) |
| ADR-035 | Autonomous phase execution (Orca, Claude + Codex workers) | FIXED | Owner decision 2026-11-02; process only. Delegates owner questions and gates to the agents; see `decisions/ADR-035-agent-orchestration-and-pipeline-economy.md` |
| ADR-036 | Authentication and session design | ACCEPTED | First-party accounts, framework PBKDF2 hasher, server-side sessions in a strict cookie, see [ADR-036](decisions/ADR-036-authentication-and-sessions.md) (P01; P00 GOV-04 candidate) |
| ADR-037 | Optimistic concurrency, idempotency, durable ack | ACCEPTED | Version as ETag, `If-Match`, `Idempotency-Key` bound to one body by a request hash (document writes included), majority write concern, see [ADR-037](decisions/ADR-037-concurrency-idempotency-durability.md) (P01; P00 GOV-04 candidates) |
| ADR-038 | Rate limiting and abuse protection | ACCEPTED | ASP.NET Core rate limiting policies, see [ADR-038](decisions/ADR-038-rate-limiting-and-abuse-protection.md) (P01; P00 GOV-04 candidate) |
| ADR-039 | Data retention and deletion | ACCEPTED | Retention table, ≤ 24 h account purge, backup expiry plus restore reconciliation with a deletion ledger of erased accounts, purged resumes and deleted photos, see [ADR-039](decisions/ADR-039-data-retention-and-deletion.md) (P01) |
| ADR-040 | Contract validation and type-generation tooling | ACCEPTED | Redocly CLI lint, openapi-typescript + TypeScript strict (generated types never committed), Prism mock, oasdiff breaking-change check (image by digest), Microsoft.OpenApi reader; C# DTOs hand-written and verified by drift tests from P04, see [ADR-040](decisions/ADR-040-contract-tooling-and-type-generation.md) (P02) |
| ADR-041 | Test tooling | ACCEPTED | xUnit v3 + xUnit Assert, Testcontainers for .NET, `WebApplicationFactory`; Vitest + jsdom + React Testing Library; Playwright Test in the digest-pinned official image (Chromium, Firefox, WebKit); FluentAssertions and Moq rejected; PDF text extraction and raster diff deferred to the P10 prototype gate, see [ADR-041](decisions/ADR-041-test-tooling.md) (P03; closes "test tooling: confirm in P03") |
| ADR-042 | Local environment, CI pipeline, supply-chain controls | ACCEPTED | Compose with `mongo` 8.0 replica set, Azurite and Mailpit (digest-pinned, loopback only); five CI jobs each calling one `scripts/ci/<job>.sh`, with `scripts/ci/local.sh` as the local command; gitleaks, OSV-Scanner, actionlint, Dependabot; `.env.example` placeholders only, see [ADR-042](decisions/ADR-042-local-environment-ci-and-supply-chain.md) (P03; implements ADR-033) |

| ADR-050 | Frontend foundation routing and state | ACCEPTED | React Router declarative routes, shell-local state only, recoverable route error boundary and structural placeholders; web image shared wiring follows convergence, see [ADR-050](decisions/ADR-050-frontend-foundation-routing-and-state.md) (P05) |
| ADR-052 | Rich text editing engine | ACCEPTED | ProseMirror directly, closed schema equal to the contract AST, engine confined to `features/editor/rich-text/`, see [ADR-052](decisions/ADR-052-rich-text-engine.md) (P09) |
| ADR-053 | Application UI on shadcn/ui, theme tokens and color scheme | ACCEPTED | Theme tokens only, legacy names as aliases, shadcn primitives behind the `shared/ui` API, Radix dialogs, native checkbox/radio/range kept, light/dark/system switch, resume document unthemed (change UI-01, 2026-11-08), see [ADR-053](decisions/ADR-053-shadcn-ui-migration-and-color-scheme.md) |
| ADR-054 | Template T4 "Panel" | ACCEPTED | Owner override of FR-TPL-01, FR-TPL-02 and X6 ("more than three templates" only): a fourth template with a left sidebar panel and a split header, data-driven engine fields, `templateId` gains `T4`, contract 1.1.0 (change TPL-01, 2026-11-15), see [ADR-054](decisions/ADR-054-template-t4-panel.md) |
| ADR-055 | CV import | ACCEPTED | Owner override of X8 and D-08 (supersedes ADR-020); X1 kept and enforced by a server verbatim check: browser extraction with pdf.js, `POST /resume-imports/structure` with Claude Haiku 5.5 and one Sonnet 5.5 escalation, deterministic fallback parser, built through the existing document operations (change IMP-01, 2026-11-15), see [ADR-055](decisions/ADR-055-cv-import.md) |

## Gate policy
Any OPEN/SOURCE-OPEN item affecting a phase must be decided in an ADR before implementation. Record decision, rationale, alternatives, consequences, owner and date. Do not mark this register fully approved until all release-blocking decisions are closed.

Release-blocking decision D-20 (ADR-012/ADR-032) was decided in P01. Its go-live verification (regions, sub-processors) is a P15 release-checklist item.
