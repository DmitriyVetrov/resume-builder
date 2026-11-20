# OpenAPI Contract

This directory is the canonical API contract location (ADR-006). Backend and frontend share no code; `openapi.yaml` is the only link between them.

| File | Content |
|---|---|
| `openapi.yaml` | OpenAPI 3.1.0 document, `info.version` 1.0.0, base path `/api/v1` |
| `CHANGELOG.md` | version history; one entry per contract change |

## Rules

- Owner: Contract Architect. Every change follows the extension process in `docs/phases/P02/architecture/phase-plan.md` §9: phase plan names the impact → Contract Architect edits `openapi.yaml`, bumps `info.version`, appends `CHANGELOG.md` and writes the phase `architecture/contract-changelog.md` with the oasdiff report → Test Engineer extends `tests/contract/` → developers regenerate types → reviewer does the compatibility review.
- Do not add endpoints that the phase plan does not list. There are no server export, import, sharing, AI or payment endpoints (TECHNICAL-SPEC §3.2, ADR-010).
- Examples use fictional data only (`example.com`, `example.org`, `.invalid`; invented names).
- Generated code (TypeScript types, bundles, reports) is never committed here or hand-edited; it is regenerated from `openapi.yaml` into git-ignored folders (ADR-040 §6).
- Use only the portable OpenAPI 3.1 subset of phase-plan §8.3 (type arrays for null, `const`, `oneOf` + `discriminator.mapping`; no `if`/`then`/`else`, `$dynamicRef`, `patternProperties`, `unevaluatedProperties`, `prefixItems`, webhooks, links or callbacks; no `allOf` in closed request schemas).

## Conventions in brief

- Nullable references: `oneOf: [{$ref: …}, {type: 'null'}]`; nullable scalars: `type: [X, 'null']`.
- Fixed header values are response headers with `const` (`Cache-Control: no-store`, `Cache-Control: private, no-cache`, `X-Content-Type-Options: nosniff`).
- Shared parameters, headers, responses and examples live under `components/`.
- Anonymous operations: `security: []` (health), `[{}, {sessionCookie: []}]` (`getSession`), `[{csrfHeader: []}]` (anonymous authentication posts). Authenticated operations always include `sessionCookie`.

## Tools (ADR-040)

The checks live in `tests/contract/` (Test Engineer). Pinned tools: Redocly CLI 2.72.1 (lint), openapi-typescript 7.13.0 + TypeScript 5.9.3 (types), Prism 5.16.0 (mock), oasdiff 1.35.0 (breaking changes), Microsoft.OpenApi 2.x (.NET reader). Mock notes: Prism serves the paths at the server root (the relative server URL `/api/v1` is not prefixed), returns the first example of each response, and answers a request-validation failure (for example a missing `If-Match`) with the operation's 422 example, because 422 is the status Prism uses for invalid requests.
