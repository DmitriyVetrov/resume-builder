# ADR-008 — Pragmatic Clean Architecture layers and fitness rules

- Status: **Accepted** (`DELEGATED-DEFAULT`, ADR-035 A-4)
- Decider: Solution Architect (delegated, ADR-035)
- Date: 2026-11-02 (P01, decisions.md DD-P01-05)
- Source IDs: Register ADR-008 (PROPOSED, "pragmatic layers, avoid over-abstraction"); REPOSITORY-STRUCTURE.md; `.claude/skills/clean-architecture-solid`; P00 GOV-04 (needed by P04)

## Context

The Blueprint proposes four layers (Domain, Application, Infrastructure, Api) and warns against over-abstraction. P04 needs dependency rules it can enforce with tests. PHASE.md for P01 asks for "architecture fitness checks".

## Decision

**Backend projects** (as in `REPOSITORY-STRUCTURE.md`):

| Project | May reference | Contains |
|---|---|---|
| `ResumeBuilder.Domain` | nothing (BCL only) | aggregates, value objects, invariants, domain errors; rich-text AST types and validation |
| `ResumeBuilder.Application` | Domain | use cases (one class per command or query), ports (repositories, object storage, email, clock, ID generator, password hasher), DTO mapping to contract types |
| `ResumeBuilder.Infrastructure` | Application, Domain | Mongo repositories, Blob or Azurite storage, SMTP sender, image processing, job lease |
| `ResumeBuilder.Api` | Application; Infrastructure **only in the composition root** | endpoints, auth middleware, rate limiting, error envelope, OpenAPI exposure |

**Fitness rules.** P04 makes these executable as architecture tests; the backend developer chooses NetArchTest or plain reflection tests.
- **F-BE-1:** Domain references no other project and no NuGet package except BCL abstractions.
- **F-BE-2:** Application does not reference Infrastructure, Api, ASP.NET Core or `MongoDB.*`.
- **F-BE-3:** Api endpoint code does not reference `MongoDB.*` or the storage SDK types.
- **F-BE-4:** No type in module A uses a repository interface of module B (ADR-007).
- **F-BE-5:** Logging calls never take a resume, a rich-text, a contact or a photo type as a structured property. Only allow-listed scalar IDs and codes are logged (threat model T-ID-05).

**Frontend fitness rules.** P05 makes them executable, for example with ESLint import rules.
- **F-FE-1:** `frontend/` imports nothing from `backend/` or `contracts/` except generated API types.
- **F-FE-2:** the layering is `app → pages → widgets → features → entities → shared`, with no upward imports.
- **F-FE-3:** the layout engine (ADR-010) is a pure module with no React or DOM imports, so it runs in Node tests.

**Not mandated:** MediatR or any mediator, AutoMapper, generic repositories or a CQRS split. A use case is a plain class with explicit dependencies.

## Alternatives considered

- **A project per module per layer:** too many projects for v1. Rejected.
- **Vertical slices without layers:** weaker isolation of domain rules from Mongo. Rejected.
- **Mediator and mapper libraries:** indirection without benefit, and the licensing of some popular packages has changed. Rejected.

## Rationale

These are the minimal layers that keep the domain testable without infrastructure (Domain ≥ 90% coverage guidance), and the rules are checkable by tests rather than by review alone.

## Consequences

P04 adds the architecture-test project. P05 adds the lint rules. A violation is a failing test, not a review comment.

## Security/privacy impact

F-BE-5 makes "no resume content in logs" testable. Keeping authorization in Application use cases and repository filters makes owner checks unavoidable (threat model T-EP-01).

## Owner and date

Solution Architect (delegated, ADR-035), 2026-11-02.
