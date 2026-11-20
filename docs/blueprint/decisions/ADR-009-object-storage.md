# ADR-009 — Object storage for photos; exports are not stored

- Status: **Accepted** (`DELEGATED-DEFAULT`, ADR-035 A-4)
- Decider: Solution Architect (delegated, ADR-035)
- Amended: 2026-11-02, P01 review fix loop 1 (code-review M-2 §7, m-1 §6, m-5 §2; decisions.md DD-P01-34, DD-P01-36, DD-P01-38)
- Date: 2026-11-02 (P01, decisions.md DD-P01-06)
- Source IDs: Register ADR-009 (PROPOSED; provider, region and retention OPEN); FR-PHO-01…05, FR-LIB-02, FR-PDF-07, FR-ACC-03, FR-ACC-04, NFR-08, NFR-09, NFR-10; conflicts SC-08, SC-09; P00 GOV-04 (needed by P01)

## Context

Photos must not live in the document database (Blueprint §2). FR-PHO-05 keeps the original upload and regenerates the crop rendition. NFR-08 requires every upload to be re-encoded and stripped of metadata. FR-ACC-03 deletes "all resumes, photos and exports" within 24 h.

SC-09 asked whether exports are stored or regenerated. ADR-010 moves PDF and TXT generation into the browser.

## Decision

1. **Provider:**
   - production: **Azure Blob Storage**, one general-purpose v2 account in **Germany West Central**, with zone-redundant storage and geo-redundancy only to the paired EU region Germany North (ADR-012);
   - local and CI: **Azurite** (the official Microsoft emulator) in Docker Compose.
2. **Access model.** Containers are private, and anonymous or public access is disabled at the account level. The browser never receives blob URLs or SAS tokens. Photo bytes are streamed **through the API** after an owner check, with `Cache-Control: private, no-cache`, `ETag` and `X-Content-Type-Options: nosniff`. Every use revalidates with the session (304 when unchanged), so the next person on a shared device cannot get a photo from the browser cache without being signed in as the owner (threat model T-ID-06). The API reaches storage with a managed identity in production (no account keys) and with the emulator's well-known development key locally.
3. **What is stored.** Per photo:
   - `master`: the upload decoded, orientation-normalised, **re-encoded** and stripped of all metadata, at full resolution. This is the "original" of FR-PHO-05. Raw upload bytes are never persisted.
   - `rendition`: the crop at the template aspect ratio, JPEG quality 90, sized for at least 200 dpi at the largest printed size (FR-PDF-07). The default is 600×600 px for the square T1 crop. P07 fixes the final pixel size.
4. **Keys** are opaque and owner-prefixed: `u/{ownerId}/p/{photoId}/master` and `.../rendition`. IDs are server-generated UUIDs. No file names or user text appear in keys. The owner prefix lets account deletion delete everything under the prefix (ADR-039).
5. **Copy semantics** (FR-PHO-03, FR-LIB-02): copying a resume copies its photo blobs under a new `photoId`, so lifecycles stay independent and there is no reference counting.
6. **Exports are not stored** (answers SC-09). PDF and TXT are generated in the browser (ADR-010). FR-ACC-04's "latest PDF/TXT" means the PDF and TXT of each resume's current version, regenerated with the current engine when the archive is built (DD-P01-36, ADR-010 §5). FR-ACC-03 therefore has no export objects to delete.
7. **Retention and backup** follow ADR-039: blobs live as long as their photo or resume, and trash purge and account purge delete them.
   - Blob soft delete is on with a **1-day** retention, a safety net against a faulty purge job.
   - An Azure Backup vaulted daily backup of the photo container is kept 30 days in the same EU region (NFR-10).
   - Removing or replacing a photo, purging a resume and purging an account each write a deletion-ledger entry before the blobs are deleted (ADR-039 §3).
   - Deleted photos leave backups by expiry. Every restore of the database or of this container re-applies the ledger and then runs the orphan-blob sweep (ADR-039 §4 steps 4 and 6), so a restore cannot bring back a removed photo.
8. **Upload rules** (enforced in Media, P07; hardened in P13):
   - JPEG, PNG or WebP, detected from **magic bytes** (the client MIME type is ignored);
   - ≤ 5 MB request body;
   - decoded size ≤ 40 megapixels and each side ≤ 8000 px (decompression-bomb guard);
   - decoding with a timeout;
   - re-encoding only through a maintained OSI-licensed library. SkiaSharp (MIT) is the default candidate, confirmed in P07.

## Alternatives considered

- **Store photos in MongoDB (GridFS or BSON):** against the Blueprint, and it inflates database backups. Rejected.
- **Public or SAS URLs to the browser:** links can leak, and the owner check moves outside our code. Rejected for v1.
- **AWS S3 or another S3-compatible store:** viable, but splits vendors from ADR-033, and local S3 emulators have licensing churn. Rejected for v1. The `IObjectStorage` port keeps it reversible.
- **Persisting exports:** stores extra personal data and creates deletion work, with no requirement that needs it. Rejected.

## Rationale

This is private by default with a single enforcement point (the API owner check). EU-only replication. An official emulator gives local fidelity. Not storing exports is data minimisation (GDPR Art. 5(1)(c)).

## Consequences

- P02 defines the photo endpoints: upload (multipart), crop update, rendition GET, master GET (for re-cropping), delete. There are no export-file endpoints.
- P03 adds Azurite to Compose.
- P07 implements Media and the copy semantics. P13 implements the purge jobs and EXIF/GPS tests (fixture with GPS, per TEST-STRATEGY).

## Security/privacy impact

There is no public object access, and owner checks happen per request. Metadata (EXIF GPS) is removed by re-encoding, never by a metadata editor. Keys contain no personal data. Storage is EU-only. The bytes of photos and documents are never logged.

## Owner and date

Solution Architect (delegated, ADR-035), 2026-11-02.

## P07 confirmation (2026-11-04)

`DELEGATED-DEFAULT` DD-P07-05 and DD-P07-06 settle what §3 and §8 left to P07. The library is **SkiaSharp** with its Linux no-dependency native assets (MIT). The rendition is JPEG quality 90 at 600 px square, flattened on white; a crop under 600 px keeps its size rather than being upscaled. The master keeps the detected format: JPEG quality 92, lossless PNG, WebP quality 90. Nothing else in this ADR changes. Decider: operator session (delegated, ADR-051).
