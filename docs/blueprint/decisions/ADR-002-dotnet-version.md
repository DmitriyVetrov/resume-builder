# ADR-002 — Backend runtime: .NET 10 LTS

- Status: **Accepted** (`DELEGATED-DEFAULT`, ADR-035 A-4)
- Decider: Solution Architect (delegated, ADR-035)
- Date: 2026-11-02 (P01, decisions.md DD-P01-01)
- Source IDs: Fixed constraint ".NET backend" (PROJECT-CHARTER); DECISION-REGISTER ADR-002 "exact SDK/target framework OPEN"; P00 GOV-04 (needed by P02, before the P01 gate); conflict SC-29

## Context

The backend platform is fixed as .NET, but the exact version is open. P02 needs it for type generation and contract-drift tooling, P03 for container images and CI, and P04 for the solution.

Support status on 2026-11-02:
- .NET 8 (LTS) and .NET 9 (STS, with 24-month support) both reach end of support on 2026-11-10.
- .NET 10 is the current LTS (GA November 2025, supported until November 2028).
- .NET 11 (STS) is not yet GA.

## Decision

- Target framework **`net10.0`** (ASP.NET Core 10) and the C# language version that ships with it.
- `backend/global.json` pins a 10.0 SDK feature band with `rollForward: latestPatch`. P04 chooses the exact patch, and patch updates are routine maintenance.
- Container images use the official `mcr.microsoft.com/dotnet/sdk:10.0` and `aspnet:10.0` tags, pinned by digest in P03.
- Upgrade policy: stay on LTS. The move to the next LTS (.NET 12, expected November 2027) is a planned maintenance ADR. STS releases are skipped.

## Alternatives considered

- **.NET 8 LTS or .NET 9 STS:** both end support this month. Rejected.
- **.NET 11 STS:** not GA at decision time, with a shorter support window. Rejected.
- **.NET 10 LTS:** chosen.

## Rationale

It is the only supported LTS for the whole project horizon (P15 and beyond). It has in-box OpenAPI document generation in ASP.NET Core, which helps the contract-drift check (ADR-040, P02), built-in rate limiting (ADR-038), `Guid.CreateVersion7()` (domain model IDs), and the Identity password hasher (ADR-036).

## Consequences

P02 tooling, P03 images and CI, and P04 projects target `net10.0`. NuGet packages must support `net10.0`, and P04 records any exception. The test tooling candidates (xUnit and others) are confirmed in P03 against `net10.0`.

## Security/privacy impact

LTS gives three years of security patches. Base images are pinned by digest and refreshed by dependency automation (P03).

## Owner and date

Solution Architect (delegated, ADR-035), 2026-11-02.
