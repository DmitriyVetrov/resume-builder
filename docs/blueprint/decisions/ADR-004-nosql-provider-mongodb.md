# ADR-004 — NoSQL provider: MongoDB

- Status: **Accepted** (`DELEGATED-DEFAULT`, ADR-035 A-4)
- Decider: Solution Architect (delegated, ADR-035)
- Date: 2026-11-02 (P01, decisions.md DD-P01-03)
- Source IDs: Fixed constraint "NoSQL" (register ADR-004: provider OPEN, MongoDB PROPOSED); TECHNICAL-SPEC §10; FR-LIB-01…05, FR-PER-01…05, NFR-09, NFR-10 (RPO ≤ 1 min, daily backups kept 30 days), NFR-12; P00 GOV-04 (needed by P01)

## Context

The resume is a deeply nested document (header, ordered sections, entries, list items, rich-text AST) that is read and written as a whole (TECHNICAL-SPEC §10). The store must provide:
- atomic single-document conditional updates for optimistic concurrency (ADR-037);
- per-owner queries sorted by `updatedAt` (FR-LIB-01);
- TTL expiry (sessions, tokens, idempotency keys);
- durable acknowledgment;
- point-in-time recovery for RPO ≤ 1 min;
- an EU region;
- a local container for integration tests;
- an official .NET driver.

## Decision

- **MongoDB**, server major **8.x**. The same major is used locally, in CI and in production. P03 pins the exact image tag.
- **Local and CI:** the official `mongo:8` Docker image running as a **single-node replica set**, so transactions and majority write concern behave as in production. Integration tests use this container (Testcontainers is a candidate, confirmed in P03).
- **Production (decided on paper, go-live item):** a **MongoDB Atlas** dedicated cluster on Azure in **Germany West Central** (ADR-012, ADR-033). It has continuous cloud backup with point-in-time restore, which meets the RPO, and daily snapshots kept 30 days (NFR-10). It uses encryption at rest, private networking to the app, and backup storage in the EU.
- **Driver:** the official `MongoDB.Driver` (3.x) behind application-layer repository interfaces (ADR-008). GUIDs use the standard binary representation (subtype 4), configured explicitly.
- **Write concern** `majority` with journaling for every acknowledged user write. Read concern `majority` for document reads after a write.
- **Document shape:** one `resumes` document per resume, holding the whole aggregate. The collections, indexes and limits are in `docs/phases/P01/architecture/domain-model.md` §6.
- **Schema evolution:** every stored document carries `schemaVersion`. Migrations are forward-only, in code, idempotent and run at startup or by a job. They are designed in P07.

## Alternatives considered

- **Azure Cosmos DB for MongoDB (vCore or RU):** a single vendor with Azure, but it differs from real MongoDB in features and behaviour, so tests against the local `mongo` image would be less representative. Kept as a production fallback, because the wire protocol is compatible.
- **Amazon DynamoDB, Azure Cosmos DB NoSQL API:** proprietary query models, emulator-only local testing and vendor lock-in. Rejected as not reversible.
- **RavenDB, Couchbase:** smaller ecosystems, and licensing or operations overhead. Rejected.
- **PostgreSQL JSONB:** violates the fixed NoSQL constraint. Rejected.

## Rationale

The document model maps one-to-one to the aggregate. Conditional `replaceOne` on `{_id, ownerId, version}` gives optimistic concurrency in one round trip. TTL indexes cover sessions and keys. The official driver and Docker image are standard. Atlas offers EU regions and PITR without our own operations. It is the Blueprint's own proposal.

## Consequences

- P02 schemas use JSON types that map cleanly to BSON. The `version` integer becomes the ETag (ADR-037).
- P03 adds `mongo:8` with a replica-set init to `docker-compose.yml`.
- P04 and P07 implement the repositories, the index bootstrap and the migrations.
- P13 implements backup and restore drills and the deletion-ledger re-apply (ADR-039).
- The `mongodb-nosql` skill now applies (this ADR accepts MongoDB).

## Security/privacy impact

- Every resume query filters by `ownerId` in the repository (owner authorization in depth; threat model T-ID-02).
- The local instance uses authentication even in Docker, with credentials from `.env` (placeholders in `.env.example`).
- Production uses TLS, private endpoints, least-privilege database users per service, and EU-only data and backups.
- Resume content is never logged: driver command logging is disabled, and profiler or slow-query logs redact or omit documents.

## Owner and date

Solution Architect (delegated, ADR-035), 2026-11-02.
