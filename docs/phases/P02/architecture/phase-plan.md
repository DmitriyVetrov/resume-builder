# P02 Architecture Plan — API Contract v1

- Author: Solution Architect (Orca worker), 2026-11-02. Kickoff: `../kickoff.md`.
- Mode: autonomous (ADR-035). Decisions by delegation (`DELEGATED-DEFAULT`, `../decisions.md`). Accepted ADRs of this step: ADR-006, ADR-040.
- This plan is the design input of the Contract Architect (step 4) and the Test Architect (step 3). Section numbers are referenced by the acceptance criteria and the task files; keep them stable.

## 1. Context

P01 froze the architecture: modular monolith on .NET 10 (ADR-002, ADR-007), MongoDB (ADR-004), private Azure Blob for photos (ADR-009), a frontend-only layout engine with PDF and TXT in the browser and **no server export endpoints** (ADR-010), first-party auth with server sessions (ADR-036), version/ETag concurrency with idempotent writes (ADR-037), rate limits (ADR-038), retention (ADR-039) and the domain model (`../../P01/architecture/domain-model.md`). P01 phase-plan §7 listed the contract consequences and left two items to P02: the contract format and envelope (ADR-006) and the tooling (ADR-040).

P02 turns this into one OpenAPI document that both stacks implement independently (`CLAUDE.md`: the contract is the only link). The P02 gate is a hard gate: P04 and P05 start only after it.

## 2. Scope

**In scope**
- `contracts/openapi/openapi.yaml` v1.0.0: all 30 operations of §5 with schemas (§6), cross-cutting semantics (§7), examples and mock behaviour (§8).
- ADR-006 and ADR-040 (Accepted under delegation); register update.
- The contract check suite in `tests/contract/` within the kickoff §3 budget.
- The extension process and the planned API surfaces of P04–P14 (§9).
- Task files with the P04+ consumption tasks (no P02 developer dispatch).

**Out of scope**
- Any code in `backend/` or `frontend/`, CI workflows (P03), `docker-compose.yml`, `infrastructure/`, `scripts/`, `.claude/`, `CLAUDE.md`, `docs/source/`.
- Server PDF/TXT/DOCX export, import, sharing, e-mail sending of resumes, AI, scores, payments, template galleries (TECHNICAL-SPEC §3.2 X1–X11; ADR-010, ADR-019…ADR-022). No endpoint for any of them.
- Product decisions owned by later phases: D-05/D-06 (P07), D-12, D-14, D-15, D-16, D-18, D-19 (P10). The contract does not depend on them (decisions.md §3).

## 3. Inputs

TECHNICAL-SPEC (baseline "0.1 draft · 2026-10-24") §3–§5, §10, §11; P01 `architecture/phase-plan.md` §7, `domain-model.md`, `threat-model.md` §4 and §7; ADR-009, ADR-010, ADR-013, ADR-015, ADR-016, ADR-023, ADR-025, ADR-029, ADR-036…ADR-039; P01 `decisions.md` (DD-P01-27…39 and the routed review items m-2, m-4, i-7); `.claude/rules/02-api-contract.md`, `03-security-privacy.md`; skill `api-contract-first`.

## 4. Requirement mapping

| Requirement | Contract element | Section |
|---|---|---|
| FR-ACC-01, 02 (sign-up, verification, login, logout, reset) | `signUp`, `verifyEmail`, `resendVerification`, `login`, `logout`, `requestPasswordReset`, `confirmPasswordReset`, `getSession.emailVerified` | §5.2 |
| FR-ACC-03 (delete account) | `requestAccountDeletion` (re-auth, 202) | §5.3 |
| FR-ACC-04 (data archive) | `exportAccountData` (re-auth, verified, no-store) + photo master GET; PDF/TXT added by the browser | §5.3 |
| FR-ACC-05 (Google) | none (ADR-014) | — |
| FR-ACC-06 (guest claim) | `createResume` with `source: document` + `uploadPhoto` (ADR-015) | §5.4 |
| FR-LIB-01 | `listResumes` (summary projection, `updatedAt` desc, cursor) | §5.4 |
| FR-LIB-02 | `createResume` (`document` = blank built by the client; `copy` = server copy incl. photo) | §5.4, DD-P02-06 |
| FR-LIB-03 | `ResumeDocument.title` ≤ 150, written through `replaceResumeDocument` | §6, DD-P02-07 |
| FR-LIB-04 (trash, D-04) | `trashResume`, `listResumes?state=trashed`, `restoreResume`, `purgeResume` | §5.4 |
| FR-LIB-05 | `getResume`; last selected section stays client-side (DD-P01-27) | §5.4 |
| FR-LIB-06, FR-PRV-*, FR-PDF-*, FR-TXT-* | no endpoint; client-side from `getResume` + `getPhotoRendition` (ADR-010) | — |
| FR-EDT-06 (save status) | durable 2xx + `ETag` only after majority ack (ADR-037 §5) | §7.4 |
| FR-HDR-01…06 | `Header`, `ContactItem` (`url` null = auto-link at render), `showPhoto` | §6 |
| FR-SEC-01…11 | `Section` variants, `hidden`, `listColumns` (null = template default by type), `placement` (ADR-025), order = array order | §6 |
| FR-TYP-01…03 | four section types; `Entry`; dates as discriminated objects; start > end is a warning; no field mandatory to save | §6, §7.9 |
| FR-RTE-01…03, 07 | rich-text AST with `kind` discriminators, one list level, link scheme allow-list | §6 |
| FR-TPL-01, 03, 05; FR-CLR-01; FR-LAY-01…10 | `templateId` T1–T3, `accentPreset` 0–2, `LayoutSettings`, `language`, `dateFormat`; template data stays in the frontend | §6 |
| FR-PER-01…03 | `ETag`, `If-Match` (428/412), `Idempotency-Key` (replay, 422), full-document replace | §7.4–§7.5 |
| FR-PER-04 | client-only (undo stack) | — |
| FR-PER-05 (Should) | `listSnapshots`, `getSnapshot`, `createSnapshot`; restore = client PUT | §5.5 |
| FR-PHO-01…05 | `uploadPhoto` (multipart), `updatePhotoCrop`, `removePhoto`, `getPhotoRendition`, `getPhotoMaster` | §5.6 |
| NFR-08 | cookie session + CSRF header, owner scoping (404), no-store / private caching, upload limits | §7.1–§7.3, §7.7 |
| NFR-09 | content-free errors and events; no third-party anything in the contract | §7.3, §5.7 |
| NFR-10 | durable acknowledgment semantics, idempotent replay | §7.4–§7.5 |
| NFR-12 | `maxItems`, `maxLength` (code points), 1 MB body, 200-resume limit (409 `limit_reached`), 50 000-character rule (server-side) | §6, §7.8 |
| NFR-13 | `reportClientEvents` (content-free) | §5.7 |

## 5. Endpoint inventory (by resource)

Base: `servers: [{url: /api/v1}]`; paths below are relative to it. **Exactly these 30 operations** exist in v1.0.0; the contract check compares method, path, `operationId`, `x-phase`, `x-rate-limit-policy` and security with this table (AC-P02-03).

Column key:
- **Auth**: `none` = `security: []`; `optional` = session optional (`[{}, {sessionCookie: []}]`); `anon+csrf` = `[{csrfHeader: []}]`; `session` = `[{sessionCookie: []}]`; `session+csrf` = `[{sessionCookie: [], csrfHeader: []}]`. Suffix `+reauth` = `x-requires-reauth: true` (§7.2); `+verified` = `x-requires-verified-email: true`.
- **Pre**: `IM` = required `If-Match` header; `IK` = required `Idempotency-Key` header.
- **Policy** = `x-rate-limit-policy` (ADR-038 names; `global` when only the global limit applies).
- Every operation additionally declares 429 (with `Retry-After`) and a `default` Problem response (§7.3). The "errors" column lists the other documented error statuses.

### 5.1 Health (tag `Health`)

| # | Method | Path | operationId | Auth | x-phase | Policy | Pre | Success | Errors |
|---|---|---|---|---|---|---|---|---|---|
| 1 | GET | `/health/live` | `getLiveness` | none | P04 | global | — | 200 `HealthStatus` | — |
| 2 | GET | `/health/ready` | `getReadiness` | none | P04 | global | — | 200 `HealthStatus` | 503 `Problem` (`service_unavailable`) |

The 200 body carries `status: ok` only; the 503 body is a plain `Problem` with code `service_unavailable`. Neither names dependencies, versions or timings.

### 5.2 Session and authentication (tag `Session`)

| # | Method | Path | operationId | Auth | x-phase | Policy | Pre | Success | Errors |
|---|---|---|---|---|---|---|---|---|---|
| 3 | GET | `/session` | `getSession` | optional | P06 | global | — | 200 `SessionInfo` | — |
| 4 | POST | `/auth/sign-up` | `signUp` | anon+csrf | P06 | auth-email | — | 202 (no body) | 400, 403, 413, 415 |
| 5 | POST | `/auth/verify-email` | `verifyEmail` | anon+csrf | P06 | global | — | 204 | 400 `token_invalid`, 403, 413, 415 |
| 6 | POST | `/auth/resend-verification` | `resendVerification` | anon+csrf | P06 | auth-email | — | 202 | 400, 403, 413, 415 |
| 7 | POST | `/auth/login` | `login` | anon+csrf | P06 | auth-login | — | 200 `SessionInfo` | 400, 401 `invalid_credentials`, 403, 413, 415 |
| 8 | POST | `/auth/logout` | `logout` | session+csrf | P06 | global | — | 204 | 401, 403 |
| 9 | POST | `/auth/password-reset/request` | `requestPasswordReset` | anon+csrf | P06 | auth-email | — | 202 | 400, 403, 413, 415 |
| 10 | POST | `/auth/password-reset/confirm` | `confirmPasswordReset` | anon+csrf | P06 | global | — | 204 | 400 `token_invalid` / password policy, 403, 413, 415 |
| 11 | POST | `/auth/reauthenticate` | `reauthenticate` | session+csrf | P06 | auth-login | — | 204 | 400, 401, 403 `reauthentication_failed` / `csrf_token_invalid`, 413, 415 |

### 5.3 Account (tag `Account`)

| # | Method | Path | operationId | Auth | x-phase | Policy | Pre | Success | Errors |
|---|---|---|---|---|---|---|---|---|---|
| 12 | PUT | `/account/password` | `changePassword` | session+csrf+reauth | P06 | global | — | 204 (all sessions revoked, cookie cleared) | 400 password policy, 401 `unauthenticated` / `reauthentication_required`, 403, 413, 415 |
| 13 | DELETE | `/account` | `requestAccountDeletion` | session+csrf+reauth | P06 | global | — | 202 (sessions revoked, cookie cleared; purge ≤ 24 h) | 401 (both codes), 403 |
| 14 | GET | `/account/data-export` | `exportAccountData` | session+reauth+verified | P06 | data-export | — | 200 `AccountDataExport`, `Cache-Control: no-store` | 401 (both codes), 403 `email_not_verified` |

### 5.4 Resumes (tag `Resumes`)

| # | Method | Path | operationId | Auth | x-phase | Policy | Pre | Success | Errors |
|---|---|---|---|---|---|---|---|---|---|
| 15 | GET | `/resumes` | `listResumes` | session | P07 | global | — | 200 `ResumePage` | 400 (bad `limit`/`cursor`/`state`), 401 |
| 16 | POST | `/resumes` | `createResume` | session+csrf | P07 | doc-write | IK | 201 `Resume` + `Location` + `ETag` | 400, 401, 403, 404 (copy or photo source), 409 `limit_reached` / `resume_trashed` / `idempotency_request_in_progress`, 413, 415, 422 |
| 17 | GET | `/resumes/{resumeId}` | `getResume` | session | P07 | global | — | 200 `Resume` + `ETag` | 401, 404 |
| 18 | PUT | `/resumes/{resumeId}/document` | `replaceResumeDocument` | session+csrf | P07 | doc-write | IM, IK | 200 `DocumentWriteResult` + `ETag` | 400, 401, 403, 404, 409 `resume_trashed`, 412, 413, 415, 422, 428 |
| 19 | DELETE | `/resumes/{resumeId}` | `trashResume` | session+csrf | P07 | doc-write | IM, IK | 200 `ResumeState` + `ETag` | 400, 401, 403, 404, 409 `resume_trashed`, 412, 422, 428 |
| 20 | POST | `/resumes/{resumeId}/restore` | `restoreResume` | session+csrf | P07 | doc-write | IM, IK | 200 `ResumeState` + `ETag` | 400, 401, 403, 404, 409 `resume_not_trashed`, 412, 422, 428 |
| 21 | POST | `/resumes/{resumeId}/purge` | `purgeResume` | session+csrf | P07 | doc-write | IM, IK | 204 | 400, 401, 403, 404, 409 `resume_not_trashed`, 412, 422, 428 |

`listResumes` query: `state` = `active` (default) | `trashed`; `limit`; `cursor` (§7.6). Bodiless keyed operations (19–21) declare no request body.

### 5.5 Snapshots (tag `Snapshots`; FR-PER-05, Should)

| # | Method | Path | operationId | Auth | x-phase | Policy | Pre | Success | Errors |
|---|---|---|---|---|---|---|---|---|---|
| 22 | GET | `/resumes/{resumeId}/snapshots` | `listSnapshots` | session | P07 | global | — | 200 `SnapshotPage` | 400, 401, 404 |
| 23 | POST | `/resumes/{resumeId}/snapshots` | `createSnapshot` | session+csrf | P07 | doc-write | IK | 201 `SnapshotSummary` + `Location`; 200 `SnapshotSummary` when a snapshot of the current version already exists | 400, 401, 403, 404, 409 `resume_trashed` / `idempotency_request_in_progress`, 413, 415, 422 |
| 24 | GET | `/resumes/{resumeId}/snapshots/{snapshotId}` | `getSnapshot` | session | P07 | global | — | 200 `Snapshot` | 401, 404 |

Restoring a snapshot is a normal `replaceResumeDocument` with the snapshot's `document` (DD-P02-07). Automatic snapshots (at most one per 10 minutes of writes) are created by the server inside the document write path.

### 5.6 Photos (tag `Photos`; one photo per resume)

| # | Method | Path | operationId | Auth | x-phase | Policy | Pre | Success | Errors |
|---|---|---|---|---|---|---|---|---|---|
| 25 | POST | `/resumes/{resumeId}/photo` | `uploadPhoto` | session+csrf | P07 | photo-upload | IM, IK | 200 `PhotoWriteResult` + `ETag` | 400 `photo_invalid`, 401, 403, 404, 409 `resume_trashed` / `idempotency_request_in_progress`, 412, 413, 415, 422, 428 |
| 26 | PUT | `/resumes/{resumeId}/photo/crop` | `updatePhotoCrop` | session+csrf | P07 | doc-write | IM, IK | 200 `PhotoWriteResult` + `ETag` | 400, 401, 403, 404 (no resume or no photo), 409 `resume_trashed`, 412, 413, 415, 422, 428 |
| 27 | DELETE | `/resumes/{resumeId}/photo` | `removePhoto` | session+csrf | P07 | doc-write | IM, IK | 200 `ResumeState` + `ETag` | 400, 401, 403, 404, 409 `resume_trashed`, 412, 422, 428 |
| 28 | GET | `/resumes/{resumeId}/photo/rendition` | `getPhotoRendition` | session | P07 | global | — | 200 `image/jpeg` binary; 304 | 401, 404 |
| 29 | GET | `/resumes/{resumeId}/photo/master` | `getPhotoMaster` | session | P07 | global | — | 200 `image/jpeg`, `image/png` or `image/webp` binary; 304 | 401, 404 |

`uploadPhoto` body: `multipart/form-data` with one required part `file` (binary, ≤ 5 MB). The server detects the type from magic bytes, re-encodes, strips metadata and sets a default crop: the largest centred square. Photo GETs work for trashed resumes (read-only access, data export).

### 5.7 Telemetry (tag `Telemetry`)

| # | Method | Path | operationId | Auth | x-phase | Policy | Pre | Success | Errors |
|---|---|---|---|---|---|---|---|---|---|
| 30 | POST | `/client-events` | `reportClientEvents` | session+csrf | P11 | client-events | — | 202 | 400, 401, 403, 413, 415 |

### 5.8 What the contract deliberately does not contain

- No PDF, TXT, DOCX or thumbnail endpoint, no export job, no stored export (ADR-010 §5, ADR-009 §6, ADR-021).
- No import or parse endpoint (ADR-020), no share/publish/e-mail-a-resume endpoint (X7), no AI, phrase library, autosuggest or score (X1–X4, ADR-019), no payment (ADR-022), no template catalogue (templates are frontend data, FR-TPL-05).
- No guest, Google or anonymous-account endpoint (ADR-014, ADR-015).
- No rename, PATCH or JSON Patch endpoint (DD-P02-07), no server "blank resume" (DD-P02-06), no "last selected section" field (DD-P01-27).

The contract check fails when any hyphen-separated token of any path segment equals `pdf`, `txt`, `docx`, `export` (the only exception is `/account/data-export`), `import`, `share`, `publish`, `ai`, `suggest`, `suggestions`, `score`, `payment`, `template` or `templates` (AC-P02-03).

## 6. Schema catalogue

Names are fixed where checks or tasks reference them; the Contract Architect may add helper schemas. Constraints come from domain-model §3 and §6. "s(a…b)" = string with `minLength` a, `maxLength` b (code points, JSON Schema semantics, matching DD-P01-30). All schemas live under `components/schemas`.

### 6.1 Resume document (request and response; closed)

`ResumeDocument` is used unchanged by `getResume`, `replaceResumeDocument`, `createResume`, snapshots and data export. It is **closed** (`additionalProperties: false`, every nested object too) and every property is **required** (DD-P02-04).

| Schema | Properties |
|---|---|
| `ResumeDocument` | `title` s(0…150); `templateId` enum `T1`,`T2`,`T3`; `accentPreset` int 0…2; `language` enum `en`,`es`,`uk`; `dateFormat` enum `MonthYearLong`,`MonthYearShort`,`Numeric`,`YearOnly`; `layout` `LayoutSettings`; `header` `Header`; `sections` `Section`[0…100] |
| `LayoutSettings` | `fontPreset` enum `S`,`M`,`L`; `sectionSpacing`, `entrySpacing`, `lineSpacing` int 0…20; `pageSize` enum `A4`,`Letter`; `margins` {`top`,`right`,`bottom`,`left`: number 10…50, `multipleOf` 0.5}; `bodyFont` string `^[a-z0-9-]{1,40}$` or null (null = template default) |
| `Header` | `fullName` s(0…120); `headline` s(0…200); `showPhoto` bool; `contacts` `ContactItem`[0…20] |
| `ContactItem` | `id` uuid; `text` s(0…200); `url` `SafeUrl` or null (null = auto-link at render, FR-HDR-04); `kind` enum `email`,`phone`,`location`,`link`,`other` |
| `Section` | `oneOf` `TextSection`, `InlineSection`, `ListSection`, `EntriesSection` with `discriminator.propertyName: type` and an explicit `mapping` |
| common section fields | `id` uuid; `type` (`const` per variant: `text`, `inline`, `list`, `entries`); `title` s(0…80); `hidden` bool; `listColumns` int enum 1, 2 or null (null = template default by type, DD-P01-28); `placement` enum `main`,`sidebar` or null (ADR-025) |
| `TextSection.content` | `{body: RichText}` |
| `InlineSection.content` | `{body: Paragraph[1…1]}` (exactly one paragraph, R-3) |
| `ListSection.content` | `{items: ListItem[0…100]}`; `ListItem` = {`id` uuid, `text` `RichTextInline`} |
| `EntriesSection.content` | `{labels: EntryLabels or null, entries: Entry[0…100]}`; `EntryLabels` = {`title`, `organization`, `location`: each s(1…40) or null} (ADR-023) |
| `Entry` | `id` uuid; `title`, `organization`, `location` s(0…150); `start` `PartialDate` or null; `end` `EndDate` or null; `dateText` s(0…60) (empty = computed dates); `description` `RichText`; `pageBreakBefore` bool |
| `PartialDate` | {`kind` const `date`, `year` int 1900…2100, `month` int 1…12 or null} |
| `EndDate` | `oneOf` `PartialDate` or `PresentDate` {`kind` const `present`}, discriminator `kind` |
| `RichText` | `Block`[] |
| `Block` | `oneOf` `Paragraph` {`kind` const `paragraph`, `inlines` `Inline`[]} or `BulletList` {`kind` const `bulletList`, `items` `Inline`[][] with `minItems` 1}, discriminator `kind` |
| `RichTextInline` | `Inline`[] |
| `Inline` | `oneOf` `TextRun` {`kind` const `text`, `value` s(1…50000), `bold`, `italic`, `underline` bool}, `Link` {`kind` const `link`, `url` `SafeUrl`, `children` `TextRun`[1…]}, `LineBreak` {`kind` const `lineBreak`}, discriminator `kind` |
| `SafeUrl` | string ≤ 2048; scheme `https`, `http`, `mailto` or `tel`; no control characters or whitespace (R-6). One pattern, reused everywhere |

Server-only rules, stated in the schema `description` because JSON Schema cannot express them: R-4 (IDs unique within the resume → 400 code `duplicate_id`), R-12 (≤ 50 000 code points of user text → 400 code `resume_text_limit_exceeded`), R-7 (start after end → `warnings[]`, never an error).

### 6.2 Resource and result schemas (responses; open)

| Schema | Properties (all required unless marked) |
|---|---|
| `Resume` | `id` uuid; `version` int ≥ 1; `createdAt`, `updatedAt` date-time; `deletedAt`, `purgeAt` date-time or null; `photo` `PhotoInfo` or null; `document` `ResumeDocument` |
| `ResumeSummary` | `id`, `version`, `title`, `templateId`, `createdAt`, `updatedAt`, `deletedAt`, `purgeAt` |
| `ResumePage` | `items` `ResumeSummary`[]; `nextCursor` string or null |
| `ResumeState` | `id`, `version`, `updatedAt`, `deletedAt`, `purgeAt` |
| `DocumentWriteResult` | `id`, `version`, `updatedAt`, `warnings` `ValidationWarning`[] |
| `ValidationWarning` | `pointer` (JSON Pointer into the request body), `code` (open string, e.g. `date_range_inverted`) |
| `PhotoInfo` | `id` uuid; `mime` enum `image/jpeg`,`image/png`,`image/webp` (master); `width`, `height` int (master px); `bytes` int; `crop` `PhotoCrop`; `updatedAt` |
| `PhotoCrop` | `x`, `y` int ≥ 0; `width`, `height` int ≥ 1; master coordinates; `width` = `height` in v1 (DD-P02-25) |
| `PhotoWriteResult` | `id` (resume), `version`, `updatedAt`, `photo` `PhotoInfo` |
| `SnapshotSummary` | `id` uuid; `resumeId`; `resumeVersion` int; `reason` enum `auto`,`before_export`; `createdAt`; `expiresAt` |
| `Snapshot` | `SnapshotSummary` fields + `document` `ResumeDocument` |
| `SnapshotPage` | `items` `SnapshotSummary`[]; `nextCursor` |
| `SessionInfo` | `authenticated` bool; `user` `CurrentUser` or null |
| `CurrentUser` | `id` uuid; `email`; `emailVerified` bool; `createdAt` |
| `AccountDataExport` | `exportedAt`; `account` {`id`, `email`, `createdAt`, `emailVerifiedAt` date-time or null}; `resumes` `Resume`[] (active and trashed) |
| `HealthStatus` | `status` const `ok` |

Server-owned values (the resource `id` of a resume, photo, snapshot or user, `version`, timestamps, `photo`, owner, `lastWrite`, storage keys, hashes) appear **only** in response schemas or in the path, never in request schemas (T-EP-03). `ownerId`, `lastWrite`, `passwordHash`, storage keys and `schemaVersion` never appear in the contract at all.

Client-owned entity IDs are not server-owned (domain-model §4, ADR-037 §4, DD-P02-28): the `id` of `ContactItem`, `TextSection`, `InlineSection`, `ListSection`, `EntriesSection`, `ListItem` and `Entry` is generated by the client, is part of `ResumeDocument` and is sent in request bodies. Corrected `requestClosure` rule for the test plan (AC-P02-04):

> `requestClosure`: every object reachable from any `requestBody` schema, multipart included, has `additionalProperties: false` and contains none of the 11 forbidden property names of AC-P02-04 (`ownerId`, `version`, `createdAt`, `updatedAt`, `deletedAt`, `purgeAt`, `lastWrite`, `photo`, `passwordHash`, `emailVerifiedAt`, `schemaVersion`) at any depth. A property named `id` is allowed only in the client-owned entity schemas `ContactItem`, `TextSection`, `InlineSection`, `ListSection`, `EntriesSection`, `ListItem`, `Entry` (matched by `components/schemas` name), where it must resolve to `#/components/schemas/Uuid`; `id` in any other request-closure object is a violation (DD-P02-28). Negative: add `id: {$ref: '#/components/schemas/Uuid'}` to `ResumeDocument.properties` → `requestClosure` names `ResumeDocument` and `id`.

### 6.3 Request schemas (closed)

| Schema | Properties |
|---|---|
| `CreateResumeRequest` | `oneOf` `CreateFromDocument` {`source` const `document`, `document` `ResumeDocument`, `copyPhotoFromResumeId` uuid or null} or `CreateCopy` {`source` const `copy`, `sourceResumeId` uuid, `title` s(0…150) or null (null = keep the source title)}, discriminator `source` |
| `PhotoCrop` | as §6.2 (request body of `updatePhotoCrop`) |
| `CreateSnapshotRequest` | `reason` const `before_export` |
| `SignUpRequest`, `LoginRequest` | `email` (format `email`, ≤ 254), `password` s(1…128) for login; s(10…128) for sign-up |
| `VerifyEmailRequest` | `token` string `^[A-Za-z0-9_-]{43}$` (32 bytes, base64url) |
| `ResendVerificationRequest`, `PasswordResetRequest` | `email` |
| `PasswordResetConfirmRequest` | `token`, `newPassword` s(10…128) |
| `ReauthenticateRequest` | `password` s(1…128) |
| `ChangePasswordRequest` | `newPassword` s(10…128) |
| `ClientEventBatch` | `events` `ClientEvent`[1…20] |
| `ClientEvent` | `type` enum `export_mismatch`,`export_failed`,`preview_failed`,`autosave_failed`,`idempotency_key_reused`,`unexpected_error`; `code` `^[a-z0-9_.-]{1,64}$`; `resumeId` uuid or null; `engineVersion` `^[0-9A-Za-z.+-]{1,32}$` or null; `occurredAt` date-time. No free-text field (content-free by schema) |

Password and token properties are `writeOnly: true` and their examples are fictional.

### 6.4 Problem schemas (§7.3)

| Schema | Properties |
|---|---|
| `Problem` | required `title` (generic, never user data), `status` int, `code` (open string `^[a-z][a-z0-9_]{1,63}$`), `traceId`; optional `type` (uri-reference), `detail` (generic text), `errors` `ValidationIssue`[] |
| `ValidationIssue` | `location` enum `body`,`query`,`header`,`path`; `pointer` (JSON Pointer for `body`, parameter or header name otherwise); `code` (open string). **No value, input or echo member** |
| `VersionMismatchProblem` | `Problem` + required `currentVersion` int and `updatedAt` date-time (412 only; no document content) |

## 7. Cross-cutting semantics

### 7.1 Authentication and CSRF (ADR-036)
- `components/securitySchemes`: `sessionCookie` = `apiKey` in `cookie`, name `__Host-rb_session`; `csrfHeader` = `apiKey` in `header`, name `X-XSRF-TOKEN`.
- `getSession` (anonymous allowed) returns `SessionInfo` and (re)issues the readable `XSRF-TOKEN` cookie; `login` and `logout` re-issue it. The SPA echoes it in `X-XSRF-TOKEN` on **every** unsafe method, anonymous auth posts included (login CSRF).
- Missing or invalid CSRF token → **403** `csrf_token_invalid`. Missing or expired session on a protected operation → **401** `unauthenticated`.
- Anonymous allow-list (exactly): `getLiveness`, `getReadiness`, `getSession`, `signUp`, `verifyEmail`, `resendVerification`, `login`, `requestPasswordReset`, `confirmPasswordReset`. Every other operation requires `sessionCookie` (T-EP-02).
- Owner scoping: a resource of another user is **404** `not_found`, never 403 (R-1). Owner is never taken from a request body.

### 7.2 Re-authentication and verification
- `reauthenticate` checks the password and stamps the current server session with a re-authentication time. `changePassword`, `requestAccountDeletion` and `exportAccountData` require a stamp at most **5 minutes** old (ADR-036 §10); otherwise **401** `reauthentication_required`. A wrong password on `reauthenticate` is **403** `reauthentication_failed` (the session stays valid; a 401 would read as "logged out"). Back-off and `auth-login` limits apply.
- `exportAccountData` also requires a verified address: **403** `email_not_verified` (ADR-013, T-ID-12). P06 may relax it under P01 review item m-2; removing that response is non-breaking.
- Uniform anti-enumeration responses: `signUp`, `resendVerification` and `requestPasswordReset` always return **202** with no body for any syntactically valid address. `login` failures return **401** `invalid_credentials` only. Sign-up and verification never open a session (ADR-036 §8). Invalid, expired or used tokens all return **400** `token_invalid`.
- `confirmPasswordReset` sets the address verified and revokes all sessions; `changePassword` revokes all sessions including the current one and clears the cookie; `requestAccountDeletion` revokes all sessions, clears the cookie and returns **202** (purge ≤ 24 h, ADR-039 §2).
- Password policy failures: **400** `validation_failed` with `errors[].code` `password_too_short`, `password_too_long` or `password_too_common`.

### 7.3 Error envelope (ADR-006 §4)
- Every 4xx and 5xx response uses media type `application/problem+json` and the `Problem` schema (412: `VersionMismatchProblem`). Every operation has a `default` response with `Problem` for unexpected 5xx.
- Clients branch on `code`; an unknown `code` is handled by its HTTP status class. Codes are open strings with a catalogue in the contract (`info.description` or a dedicated tag description).
- Initial code catalogue: `validation_failed` 400, `malformed_request` 400 (unparseable JSON, depth > 64), `idempotency_key_required` 400, `token_invalid` 400, `photo_invalid` 400, `unauthenticated` 401, `invalid_credentials` 401, `reauthentication_required` 401, `csrf_token_invalid` 403, `reauthentication_failed` 403, `email_not_verified` 403, `not_found` 404, `resume_trashed` 409, `resume_not_trashed` 409, `limit_reached` 409, `idempotency_request_in_progress` 409, `version_mismatch` 412, `payload_too_large` 413, `unsupported_media_type` 415, `idempotency_key_reused` 422, `precondition_required` 428, `rate_limited` 429, `internal_error` 500, `service_unavailable` 503.
- Initial `ValidationIssue.code` catalogue: schema rules `required`, `type`, `const`, `enum`, `format`, `pattern`, `min_length`, `max_length`, `minimum`, `maximum`, `multiple_of`, `min_items`, `max_items`, `unknown_property`; domain rules `duplicate_id`, `resume_text_limit_exceeded`, `crop_not_square`, `crop_out_of_bounds`, `password_too_short`, `password_too_long`, `password_too_common` (the password length bounds of §6.3 are reported with the password codes, not `min_length`/`max_length`). The list is open in the same way as problem codes.
- Problems **never echo field values** or document content (T-ID-05): validation errors carry `location`, `pointer` and `code` only; 412 carries `currentVersion` and `updatedAt` only.

### 7.4 Concurrency (ADR-037 §2, ADR-029)
- Every resume-level write (operations 18–21, 25–27) requires `If-Match`. The resume version is exposed as a strong ETag `"<version>"` on `getResume`, `createResume` and every write response.
- Missing `If-Match` → **428** `precondition_required`. A value that is not exactly one strong entity tag of the form `"<integer>"` (for example `*`, a list, or `W/"3"`) → **400** `validation_failed` with `location: header`. A well-formed stale value → **412** `version_mismatch` with `currentVersion` and `updatedAt`.
- Every successful write increments `version` by exactly 1, photo writes and trash/restore included. A 2xx is sent only after the write is durable (`w: majority, j: true`, ADR-037 §5); the client shows "Saved" only on that 2xx.
- Evaluation order for a keyed, versioned write: authentication (401) → CSRF (403) → request syntax and size (400/413/415) → `Idempotency-Key` present (400) → **idempotency replay or 422** → resume exists and is owned (404) → trash state (409) → `If-Match` (428/412) → domain validation (400) → write. Contract tests use single-fault requests only, so they do not depend on the order of the syntax checks.

### 7.5 Idempotency (ADR-037 §3–§4)
- `Idempotency-Key` (UUID) is required on operations 16, 18–21, 23 and 25–27; missing → **400** `idempotency_key_required`. Keys are scoped to the owner.
- **Request hash** (DD-P02-10): SHA-256 over the UTF-8 string `<METHOD> <request path without query>\n` followed by the body digest input: the RFC 8785 canonical JSON of a JSON body; for `uploadPhoto`, the raw bytes of the `file` part (never the multipart envelope, whose boundary changes on every retry); nothing for bodiless operations.
- Same key and same hash → **replay**: the original status with the `ETag` and `Location` of the original result; the body is the current representation of the resource that the original request created or changed (ADR-037 stores the status and the resource ID, not response bodies; a replayed document write returns the `lastWrite` version and the warnings of the identical body). Same key and a different hash → **422** `idempotency_key_reused`, nothing written. A second request with the same key while the first is still in flight → **409** `idempotency_request_in_progress` with `Retry-After`.
- Document writes keep the last key in `lastWrite` (no expiry); other keyed operations keep keys for 24 h. A coalesced document is a new body and always gets a new key (ADR-037 §4).

### 7.6 Pagination and sorting (DD-P02-14)
- `listResumes` and `listSnapshots`: query `limit` int 1…200 (default 50) and `cursor` (opaque string from the previous page). Response `{items, nextCursor}`; `nextCursor` is null on the last page. A cursor is valid only for the same query and user; an invalid cursor → **400** `validation_failed` (`location: query`).
- Fixed order, no `sort` parameter in v1: active library `updatedAt` desc, then `id`; trash (`state=trashed`) `deletedAt` desc, then `id`; snapshots `createdAt` desc, then `id`.

### 7.7 Caching and content types
- `Cache-Control: no-store` on every success response with a JSON body that carries account or resume data: operations 3, 7, 14–20 and 22–27 (operation 21 returns 204 without a body).
- Photo GETs: `Cache-Control: private, no-cache`, a strong `ETag` for the image bytes (not the resume version), `X-Content-Type-Options: nosniff`; `If-None-Match` → **304** (ADR-009 §2, DD-P01-38).
- Unsafe requests accept only `application/json` (or `multipart/form-data` for `uploadPhoto`); others → **415** `unsupported_media_type`.

### 7.8 Limits (NFR-12, ADR-038)
- JSON body ≤ 1 MB; `uploadPhoto` body ≤ 6 MB with a `file` part ≤ 5 MB; `reportClientEvents` body ≤ 16 KB → **413** `payload_too_large`.
- 200 resumes per user, active plus trashed → `createResume` **409** `limit_reached` (ADR-016).
- Photo: JPEG, PNG or WebP by magic bytes (else 415); ≤ 8000 px per side and ≤ 40 MP, decodable (else 400 `photo_invalid`).
- Rate limits: every operation names its ADR-038 policy in `x-rate-limit-policy`; every operation documents **429** `rate_limited` with an integer `Retry-After` header. The numbers live in ADR-038 and are not repeated in the schema (P06/P13 may tune them).

### 7.9 JSON conventions (DD-P02-04, DD-P02-24)
- Property names camelCase; enum literals exactly as TECHNICAL-SPEC §10.1 (`T1`, `MonthYearLong`, `S`, `A4`); new string enums snake_case.
- IDs are UUID strings (`format: uuid`); server IDs UUID v7, nested IDs client-generated (DD-P01-31). Timestamps are RFC 3339 UTC `date-time`.
- In `ResumeDocument` every property is required. "Not set" is `null` for non-text values and `""` for free text. No field is mandatory for saving (R-8); export needs a non-empty `fullName`, checked in the client.
- Unions are discriminated objects (`kind`, `type`, `source`) with `const` values and an explicit `discriminator.mapping`; no string-or-object unions (C# and TS both bind them without custom converters).
- Request schemas are closed (`additionalProperties: false` on every object, nested ones included); response-only schemas stay open for tolerant readers.
- Validation warnings (R-7, FR-TYP-02) are returned in `DocumentWriteResult.warnings`, never as errors.

### 7.10 Versioning (ADR-006 §5)
- `openapi: 3.1.0`, `info.version: 1.0.0` (semver), base path `/api/v1`. Minor for additive changes, patch for descriptions and examples only.
- Breaking changes (oasdiff `ERR` level) need the pre-release or post-release procedure of §9.3.

## 8. Generated types, mocks and examples

### 8.1 Generated-types policy (ADR-040)
- **TypeScript:** generated by `openapi-typescript` 7.13.0 from `contracts/openapi/openapi.yaml`. In P02 the check generates into a git-ignored directory and compiles the result with TypeScript 5.9.3 under `strict`, `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` (ADR-003). From P05 the frontend generates into `frontend/src/shared/api/generated/` (git-ignored) before every typecheck, build and test. Generated files are **never committed and never hand-edited**.
- **C#:** no generator. Backend DTOs are hand-written records verified by drift tests from P04: (a) the operation inventory of the in-box `Microsoft.AspNetCore.OpenApi` document equals the contract's operations whose `x-phase` is already implemented, with no undocumented endpoint; (b) every contract example deserializes into its DTO with strict `System.Text.Json` options and re-serializes JSON-equal; (c) API integration tests validate response bodies against the contract schemas (JSON Schema 2020-12). In P02, the .NET reader check proves the contract loads with `Microsoft.OpenApi`.
- **Mocks and fixtures** derive from the contract: Prism serves the contract examples; frontend component-test mocks (P05) use the generated types and examples loaded from the contract. No hand-written payload that the contract does not validate.

### 8.2 Examples and mock behaviour
- Every operation has at least one success example. Every shared error response has an example. All examples validate against their schema (lint rule `no-invalid-media-type-examples`).
- Examples use **fictional data only** (`example.com` / `.invalid` addresses, invented names), never the reference CV or other real personal data (DD-P02-23). One full `ResumeDocument` example exercises all four section types, an entry with `start`/`end: present`, a bullet list, a link and a line break.
- The mock is Prism 5.16.0 on the contract (`tests/contract` script `mock`, documented in `tests/contract/README.md`). It returns the examples, validates requests (a request without a required `If-Match` or with an invalid body gets a 4xx), and lets clients pick an error example with `Prefer: code=<status>`. Prism is stateless; stateful flows (autosave, conflicts) are mocked in frontend tests (P05/P08) from the same examples.

### 8.3 Portable OpenAPI 3.1 subset (tool compatibility)
The contract uses only constructs supported by all four pinned consumers (Redocly, openapi-typescript, Prism, Microsoft.OpenApi): `type` arrays for null (`[X, "null"]`), `const`, `enum`, `oneOf` + `discriminator.mapping`, `format`, `pattern`, `minLength`/`maxLength`, `minimum`/`maximum`, `multipleOf`, `minItems`/`maxItems`, `additionalProperties: false`. It does **not** use `allOf` on closed request schemas, `if`/`then`/`else`, `$dynamicRef`, `patternProperties`, `unevaluatedProperties`, `prefixItems`, webhooks, `links` or callbacks. Regular expressions are ECMA-262 and .NET compatible, linear-time (no backreferences or lookbehind), and anchored.

## 9. Extension process for P04–P14

### 9.1 Change procedure (every phase that touches the API)
1. **Solution Architect** of the phase lists the contract impact in its phase plan ("Contract impact": operations or schemas added, changed or removed, with FR/NFR IDs) and puts `contracts/openapi/` and `tests/contract/` in its `## Allowed paths`. No impact → the Contract Architect step is skipped.
2. **Contract Architect** (AGENT-WORKFLOW step 4) edits `contracts/openapi/openapi.yaml`, bumps `info.version`, appends `contracts/openapi/CHANGELOG.md` and writes `docs/phases/<Pxx>/architecture/contract-changelog.md` with the oasdiff report against `main` and the change class (§9.2).
3. **Test Engineer** extends `tests/contract/` (the inventory table moves with the contract; new negative mutations for new rules) and the phase's consumer tests (backend drift tests, frontend type checks) before implementation (red).
4. **Developers** regenerate TypeScript types and update hand-written C# DTOs; they never edit `contracts/**` or `tests/contract/**` to make tests pass (rule 00, rule 02).
5. **Code Reviewer** performs the API compatibility review (rule 02) on the contract diff. The gate requires the contract suite green.

Backend ∥ Frontend child worktrees for a slice start only after step 2 is committed (the slice is frozen). A phase that needs a contract change discovered during implementation stops that task and reports it (outcome failed); the coordinator routes it to the Solution Architect, then to the Contract Architect.

### 9.2 Change classes
| Class | Examples | Version | Gate requirement |
|---|---|---|---|
| Additive | new operation; new optional request property; new response property; new error `code`; new value in a request-only enum | minor | oasdiff shows no `ERR`; change log entry |
| Additive with rollout note | new value in a response enum (`templateId`, `language`, `reason`…) | minor | oasdiff `WARN` accepted in the change log; the frontend falls back safely on unknown values; backend accepts the value only once the frontend renders it |
| Breaking | removed or renamed operation, property or enum value; new required request property; tightened request constraint; changed type or status code | §9.3 | §9.3 |
| Documentation | descriptions, examples | patch | lint green |

Post-1.0 properties added to `ResumeDocument` are **optional** in requests and mean "keep the stored value" when absent, so a browser tab running an older frontend cannot erase them with a full-document replace (DD-P02-04). Deployment order for additive changes: backend first, then frontend.

### 9.3 Breaking changes
- **Before the P15 release** (no external consumers): allowed only with (a) a `DELEGATED-DEFAULT` decision in the phase `decisions.md` that cites the requirement, (b) the oasdiff report in the phase contract change log, (c) backend and frontend updated in the same phase, (d) a minor version bump marked `BREAKING (pre-release)` in the CHANGELOG. The base path stays `/api/v1`.
- **After release:** a new major version under `/api/v2`, an ADR, a migration and compatibility tests; `/api/v1` stays until its consumers are gone.

### 9.4 Planned API surfaces per phase
| Phase | Planned contract work | Operations (`x-phase`) |
|---|---|---|
| P03 | none; CI runs the contract suite (P03-OBL-01) | — |
| P04 | implements health and the cross-cutting behaviour: Problem mapping, security schemes and fallback policy, CSRF, limits, 429 + `Retry-After`; contract loading, inventory and example round-trip harness | 1–2 |
| P05 | none on the contract; generated client types, typed client wrapper, Prism-based dev mock | — |
| P06 | implements Session and Account; may relax `email_not_verified` on data export (m-2, non-breaking); may tune rate limits (description change) | 3–14 |
| P07 | implements Resumes, Snapshots, Photos; D-06 defaults are client data (no contract change); P01 m-4 stays internal | 15–29 |
| P08 | consumes P07 operations (autosave queue, conflict copy via `createResume`); no contract change expected | — |
| P09 | consumes the rich-text AST; an AST change (e.g. a new inline kind) is a contract change through §9.1 | — |
| P10 | template data in the frontend; T2/T3 already in `templateId`; `bodyFont` is a constrained string; no contract change expected | — |
| P11 | implements `reportClientEvents`; decides a batched documents endpoint for thumbnails (additive, ADR-010 §6) | 30 |
| P12 | consumes `getResume`, `getPhotoRendition`, `createSnapshot(before_export)`, `getSession.emailVerified`; no new operation | — |
| P13 | consumes `exportAccountData`; may add data-export pagination as a new operation if P13 measurements need it (additive); tightens limits (description change) | — |
| P14 | runs the full contract and drift suites; no new operation | — |

## 10. Component boundaries and artifact ownership

```
contracts/openapi/openapi.yaml  ── canonical, Contract Architect ──┐
        │                                                          │
        ├─► tests/contract/ (Test Engineer): lint · semantic rules · TS generation + strict compile
        │                                    · Prism mock · oasdiff vs main · .NET reader
        ├─► frontend/src/shared/api/generated/ (P05+, generated, git-ignored, never edited)
        └─► backend DTOs (P04+, hand-written) ◄── drift tests: inventory · example round-trip · response validation
```

- Backend and frontend share no code; the contract is the only link (ADR-008 F-FE-1).
- `contracts/**` changes need the Contract Architect step; `tests/contract/**` belongs to the Test Engineer (`REPOSITORY-STRUCTURE.md`).

## 11. Step plan

| # | Role | Output | Status |
|---|---|---|---|
| 1 | Solution Architect | `kickoff.md` | done (this step) |
| 2 | Solution Architect | this plan, `decisions.md`, `dependencies.md`, `acceptance-criteria.md`, task files, ADR-006, ADR-040, register | done (this step) |
| 3 | Test Architect | `tests/test-plan.md` within kickoff §3 | next |
| 4 | Contract Architect | `contracts/openapi/openapi.yaml`, `CHANGELOG.md`, `README.md`, `architecture/contract-changelog.md` | |
| 5 | Test Engineer | `tests/contract/**`, `tests/suite.cmd`, red evidence | |
| 6 | Contract Architect (fix loop, only if the suite is red) | contract fixes | |
| 7 | Code Reviewer | `review/code-review.md` | |
| 8 | QA / Acceptance | `qa-report.md` | |
| 9 | Coordinator | gate | |

## 12. Downstream obligations

| ID | Phase | Obligation |
|---|---|---|
| P03-OBL-01 | P03 | CI integration job runs the P02 suite (`tests/contract`, Node 24, .NET 10 SDK, Docker for oasdiff) and the breaking-change check of the branch contract against `main`; the local CI command includes it |
| P03-OBL-02 | P03 | dependency scanning covers `tests/contract/package-lock.json`; the oasdiff image stays pinned by digest |
| BE / FE | P04–P14 | `../implementation/backend-tasks.md`, `../implementation/frontend-tasks.md` |

## 13. Risks

| ID | Risk | Impact | Mitigation |
|---|---|---|---|
| R-01 | A pinned tool mis-handles a 3.1 construct (Prism, Microsoft.OpenApi, openapi-typescript) | red suite, rework | portable subset (§8.3); the Contract Architect self-checks with the pinned versions before handoff (PD-P02-06) |
| R-02 | Hand-written C# DTOs drift from the contract | silent incompatibility | three drift tests from P04 (§8.1); contract tests in P07 |
| R-03 | One large YAML file causes merge conflicts | rework | phases change the contract sequentially; P04 ∥ P05 do not edit it; the coordinator serialises contract steps |
| R-04 | Prism is stateless | weak mock for P08 flows | typed in-memory mocks in frontend tests built from contract examples (FE-P02-03) |
| R-05 | Data export as one response is large at 200 resumes | memory or timeouts | streamed response; P13 measures and may add a paginated operation (additive, §9.4) |
| R-06 | The suite needs registry access on first install | blocked offline run | lockfile, npm cache, image pinned by digest |
| R-07 | Delegated API design choices differ from what the owner would choose | later change | `DELEGATED-DEFAULT` records; the extension process keeps changes cheap until release |

## 14. ADRs

| ADR | Topic | File | Needed by |
|---|---|---|---|
| ADR-006 | OpenAPI 3.1 contract: format, conventions, error envelope, versioning, extension process | `docs/blueprint/decisions/ADR-006-openapi-contract-format-and-conventions.md` | P02–P14 |
| ADR-040 | Contract validation, mock, breaking-change and type-generation tooling | `docs/blueprint/decisions/ADR-040-contract-tooling-and-type-generation.md` | P02–P05, P14 |

## 15. Acceptance criteria

See `../acceptance-criteria.md` (AC-P02-01…AC-P02-17; AC-P02-17 is Should).

## Allowed paths

- `docs/phases/P02/`
- `docs/blueprint/decisions/`
- `docs/blueprint/DECISION-REGISTER.md`
- `contracts/openapi/`
- `tests/contract/`

| role | paths |
|---|---|
| contract-architect | `contracts/openapi/` |
| test-engineer | `tests/contract/` |

Role paths inside the phase folder follow AGENT-WORKFLOW "Artifact ownership"; the Contract Architect also writes architecture/contract-changelog.md in the phase folder, and the Test Engineer writes the phase tests folder. Generated-types policy for this phase: no generated file is committed; TypeScript output, bundles and reports go only to git-ignored directories under the contract test folder or to the OS temp directory; the backend and frontend folders stay unchanged in P02. No role edits docs/source, backend, frontend, scripts, infrastructure, .claude, CLAUDE.md or docker-compose.yml in P02. (Plain text on purpose: the handoff check reads every backticked path in this section as an allowed glob.)
