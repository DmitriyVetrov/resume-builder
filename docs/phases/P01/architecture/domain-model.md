# P01 Domain Model

- Author: Solution Architect (P01), 2026-11-02. Assigned to this step by the coordinator; the reason is in kickoff §2.1.
- Sources: TECHNICAL-SPEC §4 (glossary), §5.2–§5.7, §5.10, §5.14, §5.15, §6.7, §8, §10.1, §10.2, NFR-12; ADR-004, ADR-007, ADR-009, ADR-010, ADR-015, ADR-016, ADR-023, ADR-025, ADR-029, ADR-036…ADR-039.
- Status: the baseline for the P02 contract schemas and P07 implementation. Changes after P02 freezes need a contract change request (`.claude/rules/02-api-contract.md`).

The model is technology-neutral where possible. Persistence notes refer to ADR-004 (MongoDB).

## 1. Ownership map

| Model | Owner (bounded context) | Persisted where | Notes |
|---|---|---|---|
| User, Session, AccountToken, EmailOutbox | Backend · Accounts | MongoDB | ADR-036, ADR-034 |
| Resume aggregate (Header, ContactItem, Section, Entry, ListItem, LayoutSettings, rich text) | Backend · Resumes | MongoDB `resumes` (one document per resume) | Canonical document. The API carries it as contract JSON |
| Photo (metadata) | Backend · Media | embedded in the Resume header | Bytes in object storage (ADR-009) |
| Snapshot, IdempotencyRecord | Backend · Resumes | MongoDB | ADR-037 |
| DeletionLedgerEntry, JobLease | Backend · Lifecycle | MongoDB | ADR-039, ADR-007 |
| PageModel, thumbnails | **Frontend** · rendering | not persisted (thumbnails cached in the browser) | ADR-010 |
| Undo/redo history, autosave queue, guest draft, last selected section | **Frontend** · editor | browser (memory, IndexedDB, localStorage) | ADR-037, ADR-015; DD-P01-27 |

The backend and frontend implement their own types from the **contract** (P02). Neither imports the other's code.

## 2. Aggregates and relationships

```
User 1 ── * Resume                       (Resume.ownerId; the only cross-aggregate link)
Resume (aggregate root)
 ├─ Header 1 ── * ContactItem (ordered)
 │    └─ Photo 0..1                     (metadata; blobs master + rendition in object storage)
 ├─ LayoutSettings 1 (value object)
 └─ Section * (ordered)
      ├─ type=text|inline → TextContent { body: RichText }
      ├─ type=list        → ListContent { items: ListItem* (ordered) }
      └─ type=entries     → EntriesContent { labels?: EntryLabels, entries: Entry* (ordered) }
User 1 ── * Session, AccountToken        (Accounts module)
Resume 1 ── * Snapshot                   (FR-PER-05, Should)
```

The Resume is the consistency boundary. Every edit to header, sections, entries, items, layout or design is a whole-document replace with a version check (ADR-037). Photo bytes live outside the document, and changes to them go through Media operations that update `header.photo` in the same versioned write.

## 3. Entity and value catalogue

Lengths are counted in **Unicode code points** (C# `EnumerateRunes`, TypeScript `[...s].length`) so both stacks agree (DD-P01-30). "≤ n" means at most n code points. All strings are stored as typed (no trimming, no case change), except that e-mail addresses are normalised (§3.1).

### 3.1 User (Accounts)

| Field | Type | Rules |
|---|---|---|
| `id` | UUID v7 | server-generated |
| `email` | string ≤ 254 | as entered (display) |
| `normalizedEmail` | string | lowercase invariant, trimmed; **unique** |
| `passwordHash` | string | ADR-036 hasher format; never leaves the backend |
| `emailVerifiedAt?` | timestamp | set by verification or reset (ADR-036 §6) |
| `createdAt` | timestamp | |
| `deletionRequestedAt?` | timestamp | login disabled from this moment (ADR-039) |
| `failedLogin` | `{count, windowStart, nextAllowedAt?}` | back-off (ADR-036 §9) |

The spec's `deletedAt?` (§10.1) is represented by `deletionRequestedAt` followed by a hard delete. No tombstone user record remains; only the deletion ledger does (ADR-039).

### 3.2 Resume (aggregate root)

| Field | Type | Rules / default |
|---|---|---|
| `id` | UUID v7 | server-generated on create |
| `ownerId` | UUID | = the authenticated user; immutable |
| `schemaVersion` | int | storage migration marker (ADR-004); not in the contract |
| `title` | string 0…150 | FR-LIB-03. Default for blank: "Untitled resume" (P07 may refine, D-06). An empty title is stored as typed; the library shows the default as a placeholder (R-8, DD-P01-37) |
| `templateId` | enum `T1`,`T2`,`T3` | default `T1` (FR-LIB-02). T2 and T3 are selectable only when P10 ships them (D-12) |
| `accentPreset` | int 0…2 | default 0 (FR-CLR-01). Kept by index on template switch (FR-TPL-03) |
| `language` | enum `en`,`es`,`uk` (v1) | default `en` (FR-LAY-09). Extending it is additive (P02 versioning rules) |
| `dateFormat` | enum `MonthYearLong`,`MonthYearShort`,`Numeric`,`YearOnly` | default `MonthYearLong` (§5.6) |
| `layout` | LayoutSettings | §3.3 |
| `header` | Header | §3.4 |
| `sections` | Section[0…100] | ordered; IDs unique within the resume |
| `version` | int ≥ 1 | concurrency token (ADR-037) |
| `lastWrite?` | `{key: UUID, requestHash: SHA-256, version: int, at}` | idempotency of document writes (ADR-037 §3): same key and hash → replay; same key and a different hash → 422; not in the contract body |
| `createdAt`, `updatedAt` | timestamp | `updatedAt` drives library sort (FR-LIB-01) and the deterministic PDF dates (ADR-010 §7) |
| `deletedAt?` | timestamp | trash marker (ADR-016) |

### 3.3 LayoutSettings (value object)

| Field | Type | Range | T1 default (source) |
|---|---|---|---|
| `fontPreset` | enum `S`,`M`,`L` | — | `M` (FR-LAY-01) |
| `sectionSpacing` | int | 0…20 | 10 (FR-LAY-02) |
| `entrySpacing` | int | 0…20 | 10 (FR-LAY-03) |
| `lineSpacing` | int | 0…20 | 1 (FR-LAY-04) |
| `pageSize` | enum `A4`,`Letter` | — | `A4` (FR-LAY-05) |
| `margins` | `{top,right,bottom,left}` number (pt) | each 10…50, step 0.5 | 23 on all sides (FR-LAY-06 "Normal") |
| `bodyFont?` | string (font ID from the template's list of 3) | — | absent = template default (FR-LAY-08, Should) |

The margin presets Narrow, Normal and Wide (16, 23, 36 pt) are UI shortcuts. The stored value is always the four numbers. The defaults are template data (FR-TPL-05). The T1 values above come from the spec; T2 and T3 defaults come from P10. Reset design (FR-LAY-07) restores the template defaults, sets every `Section.listColumns` to `null` and sets `accentPreset` to 0.

### 3.4 Header and ContactItem

| Field | Type | Rules |
|---|---|---|
| `header.fullName` | string 0…120 | any characters (FR-HDR-01). **Required non-empty only to export** (FR-TYP-03) |
| `header.headline?` | string ≤ 200 | FR-HDR-02 |
| `header.showPhoto` | bool | default true (FR-PHO-04) |
| `header.photo?` | Photo | §3.7 |
| `header.contacts` | ContactItem[0…20] | ordered (FR-HDR-03) |
| `ContactItem.id` | UUID | client-generated (§4) |
| `ContactItem.text` | string 0…200 | as typed. An empty item is stored and skipped at render time, like an empty section (R-8, DD-P01-37) |
| `ContactItem.url?` | string ≤ 2048 | absolute URL with scheme `https`, `http`, `mailto` or `tel` only (§5 R-6). Absent → auto-link per FR-HDR-04 is computed at render time, not stored |
| `ContactItem.kind` | enum `email`,`phone`,`location`,`link`,`other` | hint for icon templates (FR-HDR-05); default `other` |

### 3.5 Section and contents

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | client-generated, unique in the resume |
| `type` | enum `text`,`list`,`entries`,`inline` | FR-TYP-01. A type change is allowed only for lossless conversions (FR-SEC-09, Should) |
| `title` | string 0…80 | as typed (FR-SEC-03). Templates may display it uppercase; TXT prints it as typed (FR-TXT-07) |
| `hidden` | bool | FR-SEC-05 |
| `listColumns?` | `1` \| `2` \| `null` | `null` = template default **by section type** (DD-P01-28); an explicit value is a user override (FR-SEC-11) |
| `placement?` | `main` \| `sidebar` \| `null` | `null` = T3 default by type (ADR-025); ignored by T1 and T2 |
| `content` | TextContent \| ListContent \| EntriesContent | must match `type` (R-2) |

- `TextContent { body: RichText }` is used by `text` and `inline`. For `inline`, the body must be exactly one Paragraph (R-3).
- `ListContent { items: ListItem[0…100] }`; `ListItem { id: UUID, text: RichTextInline }`.
- `EntriesContent { labels?: EntryLabels, entries: Entry[0…100] }`; `EntryLabels { title?, organization?, location? }`, each 1…40 (ADR-023).

"Empty" (FR-SEC-07) is derived, not stored. A section is empty when its content has no visible text: every Text value is whitespace-only, or there are no items or entries. Empty and hidden sections are skipped by preview, PDF and TXT.

### 3.6 Entry

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | client-generated |
| `title?`, `organization?`, `location?` | string ≤ 150 | §5.6 |
| `start?` | PartialDate `{year, month?}` | year 1900…2100, month 1…12 |
| `end?` | PartialDate \| `"present"` | same ranges |
| `dateText?` | string ≤ 60 | when set, printed instead of computed dates (§5.6) |
| `description?` | RichText | §3.8 |
| `pageBreakBefore` | bool | default false; PG-08 (Should; ADR-010 §10) |

`start > end` is a **warning, never a block** (FR-TYP-02, R-7).

### 3.7 Photo (metadata in Header; Media module)

| Field | Type | Rules |
|---|---|---|
| `id` | UUID v7 | server-generated on upload |
| `originalFileRef` | storage key | `u/{ownerId}/p/{photoId}/master`: the re-encoded, metadata-free master (ADR-009) |
| `croppedFileRef` | storage key | `.../rendition`: regenerated on crop change (FR-PHO-05) |
| `crop` | `{x,y,w,h}` int px in master coordinates | inside the master bounds; aspect ratio per template (T1 square) |
| `mime` | enum `image/jpeg`,`image/png`,`image/webp` | from magic bytes, never from the client |
| `bytes` | int | size of the master; the upload limit is 5 MB (FR-PHO-01) |
| `width`, `height` | int px | master dimensions; ≤ 8000 each, ≤ 40 MP (ADR-009) |

Copying a resume copies the blobs under a new photo ID (ADR-009 §5).

### 3.8 Rich text (TECHNICAL-SPEC §10.2)

```
RichText       := Block[0…]
Block          := Paragraph { inlines: Inline[] } | BulletList { items: Inline[][] (≥ 1 item) }
Inline         := Text { value: string(≥1), bold?, italic?, underline? }
                | Link { url: string, children: Text[] (≥ 1) }
                | LineBreak
RichTextInline := Inline[]          // ListItem.text: no blocks, no lists
```

- A discriminator field (`kind`) is required in the contract (P02 names it). The spec's §10.3 example notation (`{"Paragraph": "…"}`) is illustrative.
- One list level only. No numbered lists, headings, colours or sizes (FR-RTE-07 Won't).
- `Link.url` follows the same scheme allow-list as `ContactItem.url` (R-6). Links do not nest.
- Paste sanitisation (FR-RTE-04) produces this AST in the frontend. The backend validates the AST and **rejects** anything else; it never sanitises HTML, because it never receives HTML.

## 4. Identifiers

| ID | Generated by | Reason |
|---|---|---|
| User, Resume, Photo, Snapshot | server, UUID v7 (`Guid.CreateVersion7()`) | ownership and creation are server decisions; time-ordered IDs keep index locality |
| Section, Entry, ListItem, ContactItem | **client**, UUID v4 or v7 | needed offline and for undo/redo before the server sees them (FR-PER-02, FR-PER-04). The server validates the format and uniqueness within the resume |
| Idempotency-Key | client UUID | ADR-037 |

Copy (FR-LIB-02) and conflict copy (ADR-029) give the resume and photo new server IDs. Nested IDs are kept, because they are unique per resume.

## 5. Invariants and validation rules

| # | Rule | Kind | Source |
|---|---|---|---|
| R-1 | Every resume read or write is filtered by `ownerId` = the current user; a resume of another user is reported as not found (404), never 403 | hard | NFR-08, threat model T-EP-01 |
| R-2 | `Section.content` variant matches `Section.type` | hard (400) | §10.1 |
| R-3 | An `inline` section body is exactly one Paragraph | hard | §5.6, §6.8 |
| R-4 | IDs are unique within their resume; nested IDs are valid UUIDs | hard | §10.1 |
| R-5 | Lengths and enum ranges as in §3; limits as in §6 | hard | §5.4–§5.6, §10.1, NFR-12 |
| R-6 | URLs: absolute, scheme in {`https`,`http`,`mailto`,`tel`}, ≤ 2048, no control characters | hard | FR-HDR-04, FR-RTE-03, threat model T-TA-03 |
| R-7 | `start ≤ end` | **warning only** (returned as a non-blocking validation hint, never a 4xx) | FR-TYP-02 |
| R-8 | No field is mandatory for saving, and no minimum length blocks a save. Export needs a non-empty `header.fullName` (client-side check, explained in the UI). A 400 on an autosave is not retried: the queue keeps the edits locally and shows an error state with the field path (P08) | product rule | FR-TYP-03, DD-P01-37 |
| R-9 | Writes need `If-Match` = current `version`; success increments the version by exactly 1 | hard (428/412) | ADR-037 |
| R-10 | Trashed resumes are read-only except for restore and permanent delete | hard (409) | ADR-016 |
| R-11 | A resume is created at or below the limit: active + trashed ≤ 200 per user | hard (409 `limit_reached`) | NFR-12, ADR-016 |
| R-12 | Total text of a resume ≤ 50 000 code points (all user strings: title, header, contacts, labels, section titles, entry fields, Text values, link URLs) | hard (400) | NFR-12 |
| R-13 | Header ordering is fixed: the header is always first and is not a section | structural | §5.4 |
| R-14 | Section order is the array order; no template, zone or date sorting changes it | structural | FR-SEC-04, FR-SEC-08, FR-TPL-04 |

The validation error envelope **never echoes field values**. It returns paths and codes only (threat model T-ID-05).

## 6. Limits (NFR-12 and derived)

| Item | Limit | Source |
|---|---|---|
| Resumes per user (active + trash) | 200 | NFR-12, ADR-016 |
| Sections per resume | 100 | NFR-12 |
| Entries per section | 100 | NFR-12 |
| List items per list section | 100 | DD-P01-30 (by analogy to entries) |
| Contact items | 20 | DD-P01-30 |
| Characters per resume | 50 000 code points | NFR-12 |
| JSON request body | 1 MB; depth ≤ 64 | ADR-038 |
| Photo upload | 5 MB; ≤ 8000 px per side; ≤ 40 MP | FR-PHO-01, ADR-009 |

## 7. Lifecycles

```
User:    Unverified --verify/reset--> Verified
         (any) --delete request + re-auth--> DeletionRequested --purge job ≤24 h--> [gone; ledger entry]
Resume:  Active --delete--> Trashed --restore--> Active
         Trashed --30 days or "delete permanently"--> [ledger entry; purged with photo blobs and snapshots]
Photo:   none --upload--> Present --crop change--> Present (new rendition) --remove or replace--> none (ledger entry; blobs deleted)
```

## 8. Persistence mapping (MongoDB, ADR-004)

| Collection | Key / indexes | TTL | Module |
|---|---|---|---|
| `users` | `_id`; unique `normalizedEmail` | — | Accounts |
| `sessions` | `_id`; `userId` | `expiresAt` | Accounts |
| `account_tokens` | unique `tokenHash`; `userId`+`purpose` | `expiresAt` | Accounts |
| `email_outbox` | `status`+`nextAttemptAt` | `expireAt` (7 days after sending) | Accounts |
| `resumes` | `_id`; `{ownerId, deletedAt, updatedAt: -1}` (library list, trash list); partial `{deletedAt}` where trashed (purge) | — | Resumes |
| `resume_snapshots` | `{resumeId, createdAt: -1}`; `ownerId` | `createdAt` + 30 days | Resumes |
| `idempotency_keys` | unique `{ownerId, key}` | `createdAt` + 24 h | Resumes / Media |
| `deletion_ledger` | `_id` UUID; unique `{kind, subjectId}`; fields `kind` (`account`, `resume`, `photo`), `subjectId`, `ownerId`, `keyPrefix?` (photo), `recordedAt`; IDs only | `recordedAt` + 35 days | Lifecycle |
| `job_leases` | `_id` = job name | lease expiry | Lifecycle |

- The library list query projects only `id`, `title`, `templateId`, `updatedAt` and `version`. Thumbnails are rendered client-side (ADR-010 §9).
- Every write path uses `w: majority, j: true` (ADR-037).
- Each ledger entry is also appended to a private, append-only blob container outside the restore scope, so a restore cannot roll the ledger back (ADR-039 §4).

## 9. Client-only models (frontend; never sent as such)

| Model | Purpose | Storage |
|---|---|---|
| PageModel | the single layout result for preview, PDF and thumbnails | memory (ADR-010) |
| Undo/redo stack | ≥ 50 steps per session over the whole document (FR-PER-04) | memory |
| Autosave queue | pending full-document writes, keyed by user ID + resume ID | IndexedDB (ADR-037) |
| Guest draft | one local resume before sign-up | IndexedDB (ADR-015) |
| Last selected section | FR-LIB-05 "opens at the last selected section" | localStorage per user + resume, IDs only (DD-P01-27) |
| Thumbnail cache | first page per `(userId, resumeId, version)`, per-user namespace cleared with the local data (T-ID-06) | IndexedDB or Cache API |

## 10. Decisions this model depends on that are not P01's

- **D-06** (P07): the default sections of a blank resume and their default `EntryLabels`. The model supports any set.
- **D-05** (P07): guided first run. Note for the P07 Architect: a "sample resume" must not conflict with X2 (no copyable sample content).
- **D-12, D-14, D-15, D-16, D-18, D-19** (P10): template data (tokens, defaults, colours, factors, line-height rule SC-03, link style, Education layout). These are template **data**, not model fields. Exception: the per-type defaults for `listColumns` and `placement`, whose keying is fixed here.

## 11. Traceability

| Requirement | Where in this model |
|---|---|
| §10.1 User, Resume, LayoutSettings, Header, ContactItem, Section, TextContent, ListContent, EntriesContent, Entry, Photo | §3.1–§3.7 |
| §10.2 RichText, Block, Paragraph, BulletList, Inline, Text, Link, LineBreak, richTextInline | §3.8 |
| FR-LIB-01…05, FR-SEC-01…11, FR-TYP-01…03, FR-HDR-01…06, FR-PHO-01…05 | §3, §5, §7 |
| FR-PER-01…05 | §3.2 `version`/`lastWrite`, §8, §9 |
| NFR-08, NFR-09, NFR-10, NFR-12 | §5, §6, §8 |
