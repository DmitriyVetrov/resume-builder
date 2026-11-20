# P04 Dependencies

| Dependency | Use in P04 | Owner / status |
|---|---|---|
| P02 OpenAPI v1.0.0, `contracts/openapi/openapi.yaml` | Frozen Health operations, response schemas and drift oracle; no P04 contract edit | Contract Architect / completed P02 |
| P03 `backend/` toolchain and CI | .NET SDK 10.0.3xx, `net10.0`, solution, NuGet central versions/lockfiles, xUnit v3 canary, backend CI script | P03 / completed |
| P03 local infrastructure | Docker Compose MongoDB 8 replica set; Testcontainers canary image and local connection pattern | P03 / completed; Test Engineer uses isolated fixture |
| ADR-008, ADR-038, ADR-040, ADR-041 | Layer fitness, global rate limit, contract drift, test tools | Accepted decisions / P04 applies them |
| ASP.NET Core packages | Web host, health checks, Problem Details, rate limiting, OpenAPI document generation, `WebApplicationFactory` | Backend Developer pins through central package management |
| MongoDB driver and `JsonSchema.Net` | Readiness probe and response schema tests | Backend Developer pins exact versions and lockfiles; Test Engineer owns validation tests |
| `coverlet.collector` | Diagnostic coverage only | Backend Developer pins; Test Engineer may collect; not a gate |

No paid external account, domain, real credential, Blob service or SMTP service is needed for this phase. P04 outputs the host and testable conventions consumed by P06 authentication and P07 persistence. P05 has separate `frontend/` ownership and consumes only the frozen P02 contract.
