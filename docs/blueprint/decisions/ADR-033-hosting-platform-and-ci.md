# ADR-033 — Hosting platform and CI provider

- Status: **Accepted** (`DELEGATED-DEFAULT`, ADR-035 A-4)
- Decider: Solution Architect (delegated, ADR-035)
- Date: 2026-11-02 (P01, decisions.md DD-P01-09)
- Source IDs: Register ADR-033 (OPEN, needed by P03, must satisfy ADR-012); NFR-02, NFR-03, NFR-05, NFR-09, NFR-10, NFR-11; P03/P15 PHASE.md; conflict SC-30

## Context

P03 needs a CI provider and deployment target conventions. P15 needs the production platform. Everything must run locally first: no remote exists yet, and nothing is pushed (ADR-035 A-5).

## Decision

**Production platform (on paper; go-live owner action):**

| Concern | Choice |
|---|---|
| Cloud and region | Microsoft Azure, Germany West Central (ADR-012) |
| Compute | **Azure Container Apps**, one environment with two apps: `api` (ASP.NET Core, ADR-007) and `web` (static SPA served by a minimal non-root static file server image) |
| Ingress | One custom domain. `/api/*` routes to `api` and everything else to `web` (same origin, ADR-003/ADR-036). Managed TLS certificate, HTTPS only, HSTS |
| Database | MongoDB Atlas on Azure in the same region (ADR-004), with private endpoint |
| Object storage | Azure Blob Storage (ADR-009) |
| Secrets | Azure Key Vault plus managed identities. No secrets in images, repository or CI logs |
| Images | Azure Container Registry in the same region |
| Logs and metrics | Azure Monitor / Log Analytics workspace in the same region. Retention 30 days for logs with identifiers (ADR-039) |
| Infrastructure as code | Bicep, under `infrastructure/` (written in P15) |

**CI:**
- **GitHub Actions** is the hosted CI provider. Workflow files live in `.github/workflows/` (P03).
- Every job only calls repository scripts (for example `scripts/ci/*.sh`). The **same pipeline runs locally** with one command, and P03 records that command in `CLAUDE.md`. Until a remote exists, that local run is the CI evidence.
- Actions are pinned by commit SHA.
- Deployment authenticates to Azure through OIDC workload identity federation, with no long-lived cloud secrets.
- CI uses fixture data only (ADR-012 §5).

**Local development:** Docker Compose (`docker-compose.yml`, P03) runs `mongo:8` (replica set), Azurite and Mailpit (ADR-034). The API and the SPA run from their toolchains or as containers.

**Phase order (SC-30):** P03 starts after P02, as `docs/phases/README.md` and ADR-035 B-1 require. The earlier "P03 after the P01 baseline" wording no longer exists in AGENT-WORKFLOW.md, so OOS-07 is resolved.

## Alternatives considered

- **AWS (eu-central-1) with ECS Fargate, S3 and SES:** equivalent capability, but Azure is the natural fit for .NET (managed identity, Container Apps, ACS email) and keeps one processor. Rejected for v1. It is reversible because the images and ports are portable.
- **Azure App Service:** fine for the API, but Container Apps runs both containers with one ingress and scales to zero for non-production. Rejected.
- **Azure Static Web Apps for the SPA:** content is distributed globally at the edge, which conflicts with the EU-only rule of ADR-012 §4. Rejected.
- **Self-managed Kubernetes:** operational burden with no need. Rejected.
- **GitLab CI or Azure DevOps:** equally capable. GitHub Actions is the most widely used and the pipeline logic stays in scripts anyway. Rejected.
- **Terraform or OpenTofu instead of Bicep:** more portable, but we target one cloud and Bicep is first-party with no state backend to secure. Rejected for v1.

## Rationale

Managed, EU-pinned, container-based services reach 99.5% (NFR-11) without our own cluster operations. Scripts-first CI keeps the provider replaceable and lets agents run the same checks offline.

## Consequences

- P03: Compose services, CI workflows, the local CI command, `.env.example` placeholders, dependency scanning.
- P15: Bicep, environments, monitoring and alerts, backup verification, the sub-processor record.
- Owner actions for go-live: Azure subscription, GitHub repository, domain and DNS, Atlas organisation, DPAs (decisions.md §5).

## Security/privacy impact

- HTTPS only with HSTS. Managed identities, no stored cloud keys. Least-privilege CI identity.
- SHA-pinned actions. Container images run as non-root and are scanned.
- All runtime data and logs stay in the EU region.
- No production data in CI.

## Owner and date

Solution Architect (delegated, ADR-035), 2026-11-02.
