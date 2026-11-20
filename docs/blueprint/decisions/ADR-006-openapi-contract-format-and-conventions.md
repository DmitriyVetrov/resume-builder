# ADR-006 — API contract: OpenAPI 3.1 format, conventions, error envelope and versioning

- Status: **Accepted** (`DELEGATED-DEFAULT`, ADR-035 A-4). Contract-first itself is a fixed owner constraint (register ADR-006 `FIXED`); this ADR closes its open aspect, the canonical format and conventions ("OpenAPI 3.1 PROPOSED canonical format; decided in P02").
- Decider: Solution Architect (delegated, ADR-035)
- Date: 2026-11-02 (P02, decisions.md DD-P02-01…DD-P02-04, DD-P02-20)
- Source IDs: PROJECT-CHARTER fixed constraint "contract-first"; `.claude/rules/02-api-contract.md`; `CLAUDE.md` (integration boundary); TECHNICAL-SPEC §10.1, §10.2, NFR-08, NFR-10, NFR-12, FR-PER-01…03; ADR-010, ADR-036, ADR-037, ADR-038; P01 phase-plan §7; threat model T-ID-05, T-TA-02, T-EP-03; P00 conflict SC-29

## Context

Backend and frontend share no code. The only link is the HTTP contract in `contracts/openapi/` (`CLAUDE.md`). Rule 02 proposes OpenAPI 3.1 and asks for schemas, null semantics, validation, an error envelope, auth, pagination, sorting, concurrency, examples and a breaking-change policy. P01 left the format and the error envelope to P02 and recommended RFC 9457 Problem Details. P04 and P05 start in parallel after P02, so the conventions must be fixed before either stack writes code.

## Decision

1. **Format.** OpenAPI **3.1.0** with the default JSON Schema 2020-12 dialect, in **one YAML file** `contracts/openapi/openapi.yaml`. One file keeps every tool (lint, generators, mock, diff) on the same input without a bundling step. History is in `contracts/openapi/CHANGELOG.md`.
2. **Surface.** The file describes the whole v1 surface known at P02 (`docs/phases/P02/architecture/phase-plan.md` §5, 30 operations). Every operation carries:
   - `x-phase`: the phase that implements it in the backend. The backend inventory test checks only the operations of phases already implemented, and the frontend mocks the rest;
   - `x-rate-limit-policy`: the ADR-038 policy name, or `global`;
   - where relevant, `x-requires-reauth: true` and `x-requires-verified-email: true`.
3. **Conventions.**
   - Base path `/api/v1` on the same origin (ADR-003). Property names are camelCase, and enum literals follow TECHNICAL-SPEC §10.1. IDs are UUID strings. Timestamps are RFC 3339 UTC.
   - Lengths are JSON Schema `maxLength`, which counts code points (DD-P01-30).
   - In the resume document every property is required. "Not set" is `null` for non-text values and `""` for free text.
   - Unions are discriminated objects with `const` values and an explicit `discriminator.mapping`. There are no string-or-object unions.
   - Request schemas are closed (`additionalProperties: false`). Response-only schemas stay open.
   - Server-owned values (IDs, `version`, timestamps, photo metadata) appear only in responses.
   - The contract uses a portable subset of 3.1 that every pinned consumer supports (phase-plan §8.3).
4. **Error envelope.** Every 4xx and 5xx response is RFC 9457 Problem Details (`application/problem+json`) with these members:
   - required `title`, `status`, `code` and `traceId`;
   - optional `type`, `detail` and `errors[]`, where each item has only `location`, `pointer` and `code`;
   - for 412, `currentVersion` and `updatedAt`.
   `code` is the machine-readable key. Codes are open strings with a catalogue in the contract, and clients handle an unknown code by its status class. Problems **never echo submitted values** or document content (T-ID-05). Every operation declares 429 with `Retry-After` and a `default` Problem response.
5. **Versioning.** `info.version` uses semver, starting at **1.0.0** at the P02 gate:
   - minor for additive changes;
   - patch for descriptions and examples;
   - breaking changes, as reported by oasdiff, follow phase-plan §9.3. Before the P15 release they need a recorded decision, the oasdiff report and both stacks changed in the same phase, and they stay on `/api/v1`. After the release they need `/api/v2`, an ADR and a migration.
   - Post-1.0 additions to the resume document are optional in requests, and an absent property means "keep the stored value", so an older frontend cannot erase it with a full replace.
6. **Semantics fixed in the contract** (details in phase-plan §7):
   - cookie session plus the `X-XSRF-TOKEN` header on every unsafe method;
   - 404 for resources of other users;
   - strong ETag `"<version>"` with `If-Match` (428 missing, 400 malformed, 412 stale);
   - `Idempotency-Key` with a request hash over method, path and canonical body (file bytes for photo uploads), returning a replay, 422 or 409 in flight;
   - cursor pagination (`limit` 1…200, default 50) with a fixed sort;
   - `no-store` on personal JSON and `private, no-cache` plus ETag on photos;
   - 413 and 415 limits;
   - no server export endpoints (ADR-010).
7. **Extension process.** Every later API change follows phase-plan §9. The phase Architect records the impact, the Contract Architect edits the contract, the change log and the oasdiff report, the Test Engineer extends the checks first, the developers regenerate or update their types, and the reviewer does the compatibility review.

## Alternatives considered

- **OpenAPI 3.0.3:** wider legacy tool support, but `nullable` instead of JSON Schema types, and no `const`. Rule 02 proposes 3.1, and all pinned tools support 3.1. Rejected.
- **OpenAPI 3.2.0:** newer, but support in generators and in the .NET reader is incomplete at decision time. Rejected for v1. Moving to it later changes no wire behaviour.
- **Split files with `$ref` plus a bundle step:** smaller diffs, but every tool would need the bundle, and bundles are generated artifacts that must not be edited. Rejected for v1. It can be revisited if the file grows past about 4000 lines.
- **Custom error envelope** or **closed enum of error codes:** a custom shape duplicates RFC 9457. A closed enum makes every new code a breaking change for generated clients. Rejected.
- **Header or media-type versioning:** less visible and harder to route at the ingress. Rejected in favour of a URL major version.
- **Optional properties with "absent means unchanged" in v1:** ambiguous with full-document replace, and awkward under `exactOptionalPropertyTypes`. Rejected for v1.0. It is used only for post-1.0 additions (Decision 5).

## Rationale

OpenAPI 3.1 is the rule-02 proposal and the de-facto standard. Both stacks can consume it, generate or verify types from it and mock it. RFC 9457 is standard and is produced by ASP.NET Core's ProblemDetails. A single file, closed request schemas, explicit null semantics and discriminated unions give the strictest typing and the least room for divergent DTOs. The pre-release breaking-change rule keeps P04–P14 able to correct the contract cheaply while a defect is still visible in review.

## Consequences

- The P02 Contract Architect writes `contracts/openapi/openapi.yaml` 1.0.0 following phase-plan §5–§8, plus `CHANGELOG.md`.
- P02 tests enforce the conventions (ADR-040 tools).
- P04 maps errors to the Problem schema and wires security, CSRF, limits and 429. P04 also adds the inventory and drift tests.
- P05 generates the TypeScript types and the typed client.
- Every later phase that changes the API uses phase-plan §9.
- `docs/blueprint/ARCHITECTURE.md` §4 and §9 now refer to an accepted decision. The Program Coordinator updates that text at the P02 gate.

## Security/privacy impact

- The contract encodes the security controls of ADR-036 and the threat model, so both stacks and the contract tests share one definition:
  - cookie and CSRF schemes, and the anonymous allow-list;
  - re-authentication and the verified-address gate;
  - owner-scoped 404s;
  - closed write schemas without server-owned fields (T-EP-03, T-TA-02);
  - the link-scheme allow-list (T-TA-03);
  - content-free errors and events (T-ID-05);
  - `no-store` and private caching (T-ID-02, T-ID-06).
- Examples use fictional data only.

## Owner and date

Solution Architect (delegated, ADR-035), 2026-11-02. The owner reviews it after the fact in the P15 decision table (ADR-035 A-6).
