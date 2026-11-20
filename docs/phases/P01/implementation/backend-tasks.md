# Backend Tasks

P01 has **no backend implementation tasks** and the Backend Developer is not dispatched (PD-P01-04). P01 changes no file under `backend/`.

## Downstream backend obligations created by P01 ADRs

This list is for the Solution Architects of later phases. It is not a work order for P01, and each phase plan turns its rows into tasks with tests.

| ID | Phase | Obligation | Source |
|---|---|---|---|
| BE-OBL-01 | P04 | Solution on `net10.0`; `global.json`; four layer projects; architecture tests F-BE-1…F-BE-5 | ADR-002, ADR-008 |
| BE-OBL-02 | P04 | Fallback "authenticated" policy plus an endpoint-policy inventory test; forwarded-headers trust; body, depth and header limits; security headers; logging allow-list (no content) | ADR-036, ADR-038, threat model §7 |
| BE-OBL-03 | P04 | Mongo client with `w: majority, j: true`, GUID representation, index bootstrap, `schemaVersion` migrations skeleton | ADR-004 |
| BE-OBL-04 | P06 | Accounts module: hasher (≥ 210k), server sessions with a `__Host-` strict cookie, antiforgery, hashed single-use fragment tokens (24 h / 1 h), anti-enumeration, back-off, re-auth, `emailVerified`, deletion request, data export endpoint | ADR-036, ADR-013, ADR-039 |
| BE-OBL-05 | P06 | SMTP sender, outbox with retry, templates, Mailpit tests, per-address e-mail cap | ADR-034, ADR-038 |
| BE-OBL-06 | P07 | Resume aggregate and validation R-1…R-14, limits, versioned replace, `lastWrite.requestHash` guard (same key and a different body → 422, nothing written), idempotency store, trash, ledger entries on "Delete permanently" and photo removal or replacement (ADR-039 §3), copy (with blob copy), cross-user negative tests | domain-model, ADR-037, ADR-016, ADR-009 |
| BE-OBL-07 | P07 | Media: magic-byte detection, size and pixel limits, re-encode (SkiaSharp candidate), master + rendition, API-mediated GET with private caching, EXIF/GPS fixture test | ADR-009 |
| BE-OBL-08 | P11/P13 | Content-free client event endpoint (NFR-13) | ADR-010 §8 |
| BE-OBL-09 | P13 | Lease-based jobs: trash purge, account purge ≤ 24 h, deletion ledger (`account`, `resume`, `photo` entries) and its append-only blob copy, restore reconciliation and drill (ADR-039 §4 steps 1–6), log retention, abuse and load tests | ADR-039, ADR-007, ADR-038 |
