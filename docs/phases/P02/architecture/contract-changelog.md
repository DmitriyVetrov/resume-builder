# P02 Contract change log — API contract v1.0.0

- Author: Contract Architect (Orca worker, task `task_ed9ade7cdaff`), 2026-11-02.
- Inputs: `phase-plan.md` §4–§9, `../decisions.md` (DD-P02-01…27, PD-P02-04, PD-P02-06), `../acceptance-criteria.md`, `../tests/test-plan.md` §6 and §9 (F-01…F-09), ADR-006, ADR-036…ADR-040, P01 `domain-model.md`, TECHNICAL-SPEC §3.2, §10.
- Scope of this step (PD-P02-04): `contracts/openapi/openapi.yaml`, `contracts/openapi/CHANGELOG.md`, `contracts/openapi/README.md` and this file. No other file was changed.

## 1. Change summary

| Item | Value |
|---|---|
| Contract | `contracts/openapi/openapi.yaml`, `openapi: 3.1.0`, `info.version: 1.0.0`, `servers: [{url: /api/v1}]` |
| Change class | first version (no baseline on `main`) |
| Operations | 30, exactly the phase-plan §5 inventory (26 path items) |
| `x-phase` values | P04 (1–2), P06 (3–14), P07 (15–29), P11 (30) |
| Schemas | every name of phase-plan §6.1–§6.4, plus helper schemas (§3) |
| Size | about 3 600 lines (ADR-006 revisit threshold: about 4 000) |

## 2. Breaking-change analysis

There is no contract on `main`, so nothing can break: v1.0.0 is the baseline that P04–P14 are compared against. oasdiff 1.35.0 (pinned image) on base = revision = this contract reports `No changes detected`, exit 0. As a sanity check, a copy without `getResume` gives `api removed without deprecation` and exit 1, so the comparison works once a baseline exists.

From P04 on, every change to this file follows phase-plan §9 and adds an entry here (in the phase folder of that phase) with the oasdiff report.

## 3. Representation choices and additions (no semantic deviation)

The contract follows phase-plan §5–§8 and the test-plan §6 conventions. These are representation choices, or constraints derived from limits already decided, that the plan leaves to the Contract Architect:

| # | Element | Choice | Basis |
|---|---|---|---|
| C-1 | Helper schemas | `Uuid`, `Timestamp`, `NullableTimestamp`, `Email`, `BinaryImage`, `Margins`, `SectionTitle`, `ListColumns`, `Placement`, `TextContent`, `InlineContent`, `ListContent`, `EntriesContent`, `PresentDate`, `PhotoUploadRequest`, `EmailToken`, `NewPassword`, `AccountData` | phase-plan §6 ("may add helper schemas") |
| C-2 | Section variants | the common fields are repeated in each variant, not composed with `allOf` (closed request schemas, §8.3) | phase-plan §8.3 |
| C-3 | `Snapshot`, `VersionMismatchProblem` | `allOf` of the base schema plus the extra members (response-only schemas) | phase-plan §6.2, §6.4 ("fields + …") |
| C-4 | Shared components | parameters `ResumeId`, `SnapshotId`, `ResumeListState`, `Limit`, `Cursor`, `IfMatch`, `IdempotencyKey`, `IfNoneMatch`; headers with `const` values; one response per error shape with named examples | test-plan §6-1, §6-4 |
| C-5 | `If-Match` and `ETag` | pattern `^"[1-9][0-9]{0,17}"$` on the `If-Match` parameter and the resume `ETag` header, so `*`, lists and weak tags fail request validation (400, as §7.4 says) | phase-plan §7.4 |
| C-6 | Photo GETs | optional `If-None-Match` parameter; 304 response with `ETag` and `Cache-Control` | phase-plan §7.7 |
| C-7 | 409 on keyed writes | every keyed operation's 409 lists `idempotency_request_in_progress` and has an optional `Retry-After` header, including ops 18, 19, 25–27 whose §5 rows name only `resume_trashed` | phase-plan §7.5 (applies to every keyed operation) |
| C-8 | Bounds derived from decided limits | `PhotoCrop` x/y ≤ 7999 and width/height ≤ 8000; `PhotoInfo` width/height 1…8000; page `items` and `AccountDataExport.resumes` ≤ 200; `ResumeSummary.title` ≤ 150; `Cursor` 1…512 base64url characters | ADR-009 (≤ 8000 px), NFR-12 (200 resumes, `limit` ≤ 200), FR-LIB-03 |
| C-9 | Problem members | `title` ≤ 200, `detail` ≤ 500, `traceId` 1…128, `status` 400…599, `errors` ≤ 100; `ValidationIssue.pointer` and `ValidationWarning.pointer` ≤ 512; issue and warning codes use the problem-code pattern | phase-plan §6.4 (open strings; bounds added) |
| C-10 | `SafeUrl` | pattern `^(?:https?://\|mailto:\|tel:)[^\s\x00-\x1F\x7F-\x9F]+$`, `minLength` 1, `maxLength` 2048. The scheme must be **lower case**: the client normalises the scheme before saving. Checked with `new RegExp(p, "u")` against the test-plan accept/reject list (all as expected) | domain-model R-6; test-plan AC-P02-04 `safeUrl` |
| C-11 | Cookies | `Set-Cookie` behaviour of `getSession`, `login`, `logout`, `changePassword`, `requestAccountDeletion` is stated in descriptions, not as response header objects (Prism would otherwise emit fake cookies) | phase-plan §7.1–§7.2 |
| C-12 | `uploadPhoto` request | no request example (binary multipart); the 200 response has one | test-plan F-02 (success examples are response examples) |
| C-13 | Image responses | `type: string, format: binary`, example string `(binary JPEG bytes)` and similar, so that every 2xx response with content has an example | test-plan F-02 |
| C-14 | `info.license` | `Proprietary (all rights reserved; no license granted)`, identifier `LicenseRef-Proprietary`. The repository has no licence file; this only states the default legal position so that the Redocly `recommended-strict` rules pass. The owner may change it at any time (documentation-only change) | Redocly `info-license` / `info-license-strict` |
| C-15 | Words never in the contract | `ownerId`, `lastWrite`, `passwordHash`, `schemaVersion` do not occur anywhere in the file, descriptions included (the idempotency description says "the last key of the resume") | phase-plan §6.2 |

## 4. Test-plan findings F-01…F-09

All defaults of test-plan §9 are used; no deviation.

| ID | How the contract meets the default |
|---|---|
| F-01 | `ETag` on `getResume` 200, `createResume` 201, ops 18–20 and 25–27; `purgeResume` 204 has none |
| F-02 | every 2xx response **with content** has an example; bodiless 2xx (4–6, 8–13, 21, 30) have none; every `components/responses` entry has at least one example |
| F-03 | the `Idempotency-Key` parameter description contains `SHA-256` and `RFC 8785` and the `file`-part rule; the `uploadPhoto` description repeats the `file`-part rule |
| F-04 | the first example of `listResumes` 200 and `getResume` 200 is what Prism returns; verified deep-equal for `getResume` (§5) |
| F-05 | `Microsoft.AspNetCore.OpenApi` 10.0.14 depends on `Microsoft.OpenApi` `[2.12.2, 3.0.0)`; the contract loads with `Microsoft.OpenApi` 2.12.2 + `Microsoft.OpenApi.YamlReader` 2.12.2 (§5). The Test Engineer pins the exact version |
| F-06 | fixed header values use `const` (`no-store`, `private, no-cache`, `nosniff`) |
| F-07 | every object in the `ResumeDocument` closure has `additionalProperties: false` and `required` = all its properties |
| F-08, F-09 | test-harness items; no contract impact |

## 5. Self-check (PD-P02-06)

Run from a scratch directory outside the repository with the ADR-040 versions (`npm install --save-exact @redocly/cli@2.72.1 openapi-typescript@7.13.0 typescript@5.9.3 @stoplight/prism-cli@5.16.0`); nothing was added to the repository. Environment: Node v24.22.2, .NET SDK 10.0.301, Docker 29.6.1.

| # | Command (paths shortened; `C` = `contracts/openapi/openapi.yaml`) | Exit | Result |
|---|---|---|---|
| 1 | `REDOCLY_TELEMETRY=off redocly lint C --config <scratch>/redocly.yaml` (`extends: [recommended-strict]` + `no-invalid-media-type-examples` with `allowAdditionalProperties: false`, `operation-operationId`, `operation-operationId-unique`, `security-defined`, `operation-4xx-response`, `no-unused-components` at error) | 0 | valid, 0 errors, 0 warnings |
| 2 | same with `extends: [recommended]` | 0 | valid, 0 warnings |
| 3 | lint of a copy with `templateId: T9` in the `getResume` example | 1 | `no-invalid-media-type-examples` (example validation is effective) |
| 4 | `openapi-typescript C -o <scratch>/api.d.ts` | 0 | generated |
| 5 | `tsc -p <scratch>/tsconfig.json` (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `skipLibCheck: false`, `noEmit`) on the generated types plus a conformance file with every media-type example whose schema is a direct `$ref` (`satisfies components["schemas"][X]`; 287 checks, 4 binary image examples not applicable) | 0 | compiles |
| 6 | `prism mock C -h 127.0.0.1 -p 4019` + `curl` with cookie `__Host-rb_session=mock` | — | `GET /resumes` 200 (`ResumePageExample`); `GET /resumes/{id}` 200, body deep-equal to `ResumeExample`, headers `ETag: "7"`, `Cache-Control: no-store`; `PUT /resumes/{id}/document` with a valid body and no `If-Match` → **422**; with `If-Match: "7"` → 200; `GET /resumes` without cookie → 401; `Prefer: code=404` → 404; photo rendition headers `Cache-Control: private, no-cache`, `ETag`, `X-Content-Type-Options: nosniff` |
| 7 | `docker run --rm --network none -v <scratch>:/specs:ro tufin/oasdiff:v1.35.0@sha256:82b1…e400 breaking /specs/base.yaml /specs/rev.yaml --fail-on ERR` (base = rev = contract) | 0 | `No changes detected` |
| 8 | same, revision without `getResume` | 1 | `api removed without deprecation` |
| 9 | `dotnet run Reader.cs -- C` (`#:package Microsoft.OpenApi@2.12.2`, `#:package Microsoft.OpenApi.YamlReader@2.12.2`, `OpenApiDocument.LoadAsync`) | 0 | `spec=OpenApi3_1 paths=26 errors=0 warnings=0` |
| 10 | ad-hoc Node script over the Redocly bundle: §5 inventory (method, path, `operationId`, `x-phase`, policy, security), anonymous set, CSRF on unsafe methods, 401/403, `If-Match`/`Idempotency-Key` + 412/428/422, `ETag`, `no-store`, Problem media types and examples, 429 + `Retry-After`, `default`, document and request closure, forbidden properties, forbidden words, path tokens, example e-mail domains | 0 | no violation |

## 6. Notes for the Test Engineer (step 5)

1. **Anonymous allow-list rule (AC-P02-06).** Test-plan §3 states `anonAllowList` as "effective security is `[]` or contains `{}`". With the phase-plan §5 representation of `anon+csrf` (`[{csrfHeader: []}]`), that rule finds only 3 operations (health ×2, `getSession`), not 9. The contract follows phase-plan §5, which the `inventory` check compares exactly. The rule that gives the 9 of §7.1 is: **no security alternative contains `sessionCookie`**. This is a reading of the test plan, not a contract change; if the Solution Architect prefers another representation, it is a phase-plan §5 change.
2. **Prism and a missing `If-Match`.** Prism answers request-validation failures with the operation's 422 response, so the mock returns the `idempotency_key_reused` example. AC-P02-09 only requires a 4xx; the real server returns 428.
3. **Prism base path.** Prism serves the paths at the root (`/resumes`), not under the relative server URL `/api/v1` (which gives 404 `NO_PATH_MATCHED_ERROR`).
4. **Prism and `ETag` examples.** The shared `ResumeETag` header example is `"7"`, which matches the `getResume` example version; write responses in the mock show the same header value (Prism is stateless).
5. **.NET reader.** Loading YAML with `Microsoft.OpenApi` 2.x needs `Microsoft.OpenApi.YamlReader` at the same version and `settings.AddYamlReader()`. For `openapi: 9.9.9` the 2.12.2 loader throws instead of returning a diagnostic error; the process exits non-zero (134) without a `try`/`catch`.

## 7. Open questions

None. No semantic deviation from phase-plan §5–§8 was needed. Process note: the dispatch named `docs/phases/P02/implementation/` for notes; this file is in `architecture/` because PD-P02-04, the kickoff role table and the handoff-check scope for `contract-architect` (`contracts/**`, `architecture/contract-*.md`) put it there.

## 8. Review fix loop 1 (code review M-1)

- Author: Contract Architect (Orca worker, task `task_fe48b9a672c6`), 2026-11-02.
- Finding M-1 (`review/code-review.md`): `components.securitySchemes.sessionCookie.description` said `SameSite=Lax`, which conflicts with ADR-036 §3 and §4 and threat model T-SP-03 (`SameSite=Strict`). Fix: the description now says `SameSite=Strict`. No other `Lax` or `SameSite` text is in `contracts/**`.
- Change class: description only. `info.version` stays 1.0.0 because there is no baseline on `main` yet. One line was added to `contracts/openapi/CHANGELOG.md`. The contract now matches ADR-036, so the §7 statement "no semantic deviation" holds and no decision record is needed.
