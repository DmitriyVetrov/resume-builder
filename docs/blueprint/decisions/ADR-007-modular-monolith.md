# ADR-007 — Backend deployment shape: modular monolith

- Status: **Accepted** (`DELEGATED-DEFAULT`, ADR-035 A-4)
- Decider: Solution Architect (delegated, ADR-035)
- Date: 2026-11-02 (P01, decisions.md DD-P01-04)
- Source IDs: Register ADR-007 (PROPOSED, "confirm in P01"); ARCHITECTURE.md §1–§2; NFR-02, NFR-03, NFR-10, NFR-11; P00 GOV-04 (needed by P01)

## Context

v1 has one team of agents, a modest load (≤ 200 resumes per user, NFR-12), an availability target of 99.5% (NFR-11), and no rendering on the server (ADR-010). It needs clear module ownership without the cost of distributed systems.

## Decision

The backend is **one deployable ASP.NET Core application** (one container image) with these modules:

| Module | Owns | Phases |
|---|---|---|
| Accounts | users, credentials, sessions, verification and reset tokens, account deletion request, data export assembly | P06, P13 |
| Resumes | the resume aggregate, library, copy, trash, snapshots (FR-PER-05), idempotency records | P07, P08, P13 |
| Media | photo upload, re-encode, crop rendition, photo serving | P07, P13 |
| Lifecycle | scheduled jobs: trash purge, account purge, snapshot expiry, deletion ledger | P13 |
| Telemetry intake | content-free client events (NFR-13) | P11, P13 |

Rules:
- A module exposes application services or interfaces to other modules. It never exposes repositories or Mongo collections.
- Collections belong to exactly one module.
- Cross-module calls go in process, through interfaces.
- No module reads another module's collections.
- **Background jobs** run in the same process as hosted services. A Mongo lease document ensures that only one instance runs each job (multi-instance safe). There is no message broker in v1.
- The frontend is a **separate deliverable** (static SPA, ADR-003). It is not part of the monolith and shares no code with it. The OpenAPI contract is the only link (`CLAUDE.md`).

## Alternatives considered

- **Microservices:** operational and consistency overhead with no scaling need. Rejected.
- **Serverless functions:** cold starts hurt NFR-02, and it is harder to run locally. Rejected.
- **A separate worker process for jobs:** possible later, because jobs are already isolated behind the lease. Not needed in v1.

## Rationale

This is the simplest shape that keeps module boundaries enforceable. It is reversible: a module can be extracted later because its data and interfaces are already isolated.

## Consequences

P04 creates one solution with the four layer projects (ADR-008). Module boundaries are namespaces or folders inside them and are enforced by architecture tests. P13 adds the lease-based job runner.

## Security/privacy impact

There is one attack surface to harden: one ingress, one auth middleware and one logging policy. Jobs that delete data (ADR-039) run with the same least-privilege database credentials and are idempotent.

## Owner and date

Solution Architect (delegated, ADR-035), 2026-11-02.
