# Monorepo Structure

```text
repo/
├── .claude/
│   ├── agents/
│   ├── commands/
│   ├── rules/
│   └── skills/
├── contracts/
│   └── openapi/
├── backend/
│   ├── src/
│   │   ├── ResumeBuilder.Domain/
│   │   ├── ResumeBuilder.Application/
│   │   ├── ResumeBuilder.Infrastructure/
│   │   └── ResumeBuilder.Api/
│   └── tests/
│       ├── ResumeBuilder.Domain.Tests/
│       ├── ResumeBuilder.Application.Tests/
│       ├── ResumeBuilder.Infrastructure.Tests/
│       └── ResumeBuilder.Api.Tests/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── pages/
│   │   ├── features/
│   │   ├── entities/
│   │   ├── shared/
│   │   └── widgets/
│   └── tests/
├── tests/
│   ├── contract/
│   ├── e2e/
│   ├── fixtures/
│   └── rendering/
├── infrastructure/
│   ├── docker/
│   ├── compose/
│   └── ci/
├── docs/
│   ├── source/        (spec, research, img/, export/, reference/)
│   ├── blueprint/
│   └── phases/
├── scripts/
├── docker-compose.yml
└── README.md
```

## Ownership

| Area | Primary owner | Change policy |
|---|---|---|
| `backend/**` | Backend Developer | Backend tasks only |
| `frontend/**` | Frontend Developer | Frontend tasks only |
| `contracts/**` | Contract Architect | Approval required |
| `tests/contract/**` | Test Engineer | Developers cannot weaken |
| `tests/e2e/**` | QA/Test Engineer | Changes reviewed |
| `tests/rendering/**`, `tests/fixtures/**` | Test Engineer | Developers cannot weaken; fixture changes reviewed |
| `.claude/**` | Owner / Architect | Controlled change |
| `docs/phases/**` | Operator session | Append reports, preserve decisions; see artifact ownership in `AGENT-WORKFLOW.md` |
| `docs/source/**` | Product owner | Source of truth; agents do not edit |

The folder names are a scaffold, not a requirement to create every project immediately. P03/P04/P05 create the actual toolchain.
