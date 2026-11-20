# ADR-037 — Optimistic concurrency, idempotent writes and durable acknowledgment

- Status: **Accepted** (`DELEGATED-DEFAULT`, ADR-035 A-4). This is a new register ID for two P00 GOV-04 candidates: the concurrency token (ARCHITECTURE.md §4) and idempotency and replay (ARCHITECTURE.md §6).
- Decider: Solution Architect (delegated, ADR-035)
- Amended: 2026-11-02, P01 review fix loop 1 (code-review M-1: request-hash guard for document writes; decisions.md DD-P01-33)
- Date: 2026-11-02 (P01, decisions.md DD-P01-12)
- Source IDs: FR-PER-01, FR-PER-02, FR-PER-03, FR-PER-05, NFR-10 ("no acknowledged edit is lost", RPO ≤ 1 min); D-17 (ADR-029); TECHNICAL-SPEC §10.1 `version`; conflicts SC-01, SC-20

## Context

- Autosave sends edits at most 1 s after the last change (FR-PER-01).
- Edits made offline are queued and replayed later (FR-PER-02).
- Two tabs must not silently lose edits (FR-PER-03).
- A server acknowledgment must mean durable (NFR-10).
- Retries after lost responses must not create duplicates or false conflicts.

## Decision

1. **Write model: whole-document replace.** The client sends the full resume document (≤ 1 MB request body; NFR-12 bounds the content) with `PUT /resumes/{id}/document` (the path is fixed in P02). JSON Patch or operational transforms are not used in v1, because full replace is simpler to validate and replay. The P07 metrics can revisit this.
2. **Concurrency token:**
   - every resume has an integer `version`, starting at 1 and incremented by every successful write;
   - the API exposes it as a strong `ETag: "<version>"`;
   - writes **must** send `If-Match`. A missing header returns **428** Precondition Required. A stale version returns **412** Precondition Failed, with an error envelope that carries the current `version` and `updatedAt` but no content;
   - Mongo applies the write as one conditional `replaceOne({_id, ownerId, version: n}, doc with version n+1)`. A matched count of 0 means the version is stale or the resume does not exist. The server tells the two apart with a second, ID-only owner-filtered read.
3. **Idempotency:**
   - every unsafe resume or photo request carries `Idempotency-Key` (a client UUID, one per logical save attempt, reused only on retries of the **same body**);
   - **a key belongs to exactly one immutable request body**, for every keyed request including document writes. The server enforces this with a request hash: the SHA-256 of the request body in canonical JSON form (RFC 8785 JCS), so key order and whitespace do not change it;
   - **document writes:** the resume stores `lastWrite: {key, requestHash, version, at}`. The idempotency comparison runs **before** the `If-Match` check:
     - same key and same hash → **200** with the stored version and ETag. No second write happens and no false 412 appears;
     - same key and a different hash → **422** `idempotency_key_reused`. Nothing is written, and the response is never an acknowledgment, so the client must not mark the edits "Saved" (NFR-10);
     - any other key → a normal conditional write (412 if `If-Match` is stale);
   - **creates and copies** (`POST`), photo uploads and deletes: the server stores `{ownerId, key, requestHash, response status, resource id}` in `idempotency_keys` with a **24 h TTL**. The same key with the same request hash replays the stored response. The same key with a different hash returns **422** `idempotency_key_reused`.
4. **Client queue (P08):**
   - one in-flight write per resume per tab;
   - later edits coalesce into the next full document. A coalesced document is a new body and therefore always gets a **new** `Idempotency-Key`; a retry resends the stored body byte-for-byte with its original key;
   - a 422 `idempotency_key_reused` is a client defect: the queue keeps the edits locally, shows an error state instead of "Saved", sends the next attempt with a new key, and reports a content-free client event (NFR-13);
   - retries use exponential back-off with jitter;
   - queued state is kept in IndexedDB, namespaced by user ID (threat model T-ID-06);
   - the status shows Saved, Saving… or "Offline, changes kept locally" (FR-EDT-06).
5. **Durable acknowledgment:** a 2xx response is sent only after the write is acknowledged with `w: majority, j: true` (ADR-004). The client marks an edit "Saved" only on that 2xx and the new ETag. Atlas continuous backup supplies RPO ≤ 1 min for server data.
6. **Conflict handling** is defined by ADR-029 (D-17). A 412 never overwrites, and the stale tab's unsynced edits are kept as a conflict copy.
7. **Snapshots** (FR-PER-05, Should): the server creates a snapshot at most every 10 minutes of writes and on an explicit "before export" call. Snapshots are kept 30 days (ADR-039).

## Alternatives considered

- **Last-writer-wins without a token:** silently loses edits, which violates FR-PER-03. Rejected.
- **JSON Patch with a version:** smaller payloads but more complex validation and replay. Deferred, not needed at ≤ 50 000 characters.
- **CRDT or real-time merge:** far beyond v1, and D-17 does not ask for merge. Rejected.
- **`updatedAt` timestamp as the token:** clock skew and ambiguity. Rejected in favour of an integer version.

## Rationale

These are standard HTTP semantics (RFC 9110 conditional requests and the IETF Idempotency-Key draft) that P02 can specify, both stacks can test, and contract tests can verify. One conditional replace is atomic in MongoDB.

## Consequences

- **P02** specifies `ETag`, `If-Match`, `Idempotency-Key`, the 412/428/422 responses and the error codes, and adds a contract test: a document write that reuses a key with a different body returns 422 `idempotency_key_reused`.
- **P07** implements versioned writes, `lastWrite.requestHash` and the idempotency store, with a negative integration test: same key and a different body → 422, and the stored document, `version` and `ETag` are unchanged.
- **P08** implements the queue and the status states, with a test that a coalesced body always carries a new key and that a 422 never shows "Saved".
- **P13** tests recovery, replay and the acknowledgment path: stale update, offline queue, retry and idempotency, the fixtures listed in TEST-STRATEGY.

## Security/privacy impact

- Idempotency records are owner-scoped, so one user's key cannot replay another user's response.
- The stored request hash is a SHA-256 digest, never the body.
- 412 responses carry no document content.
- Local queues are per user and are cleared on explicit sign-out after the user confirms (threat model T-ID-06).

## Owner and date

Solution Architect (delegated, ADR-035), 2026-11-02.
