---
name: api-contract-first
description: Contract-first rules for the OpenAPI 3.1 contract in contracts/openapi/. Use when adding or changing an endpoint or schema, generating C#/TypeScript types, writing contract tests or mocks, or reviewing API compatibility.
---

# Api Contract First

Treat contracts/openapi as canonical. Review schemas, nullable semantics, errors, auth, pagination, concurrency and compatibility. Generate types; do not hand-diverge DTOs.

## Upstream guidance

> Upstream: `wshobson/agents` skill `openapi-spec-generation` (MIT), installed with `npx skills add wshobson/agents --skill openapi-spec-generation` on 2026-11-01; supporting files are copied alongside.
> Project rules (`CLAUDE.md`, `.claude/rules/`, `docs/source/TECHNICAL-SPEC.md`, approved ADRs) override this upstream guidance. Defaults stated by upstream do not settle OPEN items in `docs/blueprint/DECISION-REGISTER.md`. This project is contract-first: `contracts/openapi/` changes need Contract Architect approval, and code is generated from the contract. Upstream code-first generation sections do not apply.

Comprehensive patterns for creating, maintaining, and validating OpenAPI 3.1 specifications for RESTful APIs.

### When to Use This Skill

- Creating API documentation from scratch
- Generating OpenAPI specs from existing code
- Designing API contracts (design-first approach)
- Validating API implementations against specs
- Generating client SDKs from specs
- Setting up API documentation portals

### Core Concepts

#### 1. OpenAPI 3.1 Structure

```yaml
openapi: 3.1.0
info:
  title: API Title
  version: 1.0.0
servers:
  - url: https://api.example.com/v1
paths:
  /resources:
    get: ...
components:
  schemas: ...
  securitySchemes: ...
```

#### 2. Design Approaches

| Approach         | Description                  | Best For            |
| ---------------- | ---------------------------- | ------------------- |
| **Design-First** | Write spec before code       | New APIs, contracts |
| **Code-First**   | Generate spec from code      | Existing APIs       |
| **Hybrid**       | Annotate code, generate spec | Evolving APIs       |

### Templates and detailed worked examples

Full template library and detailed worked examples live in `references/details.md`. Read that file when you need the concrete templates.

### Best Practices

#### Do's

- **Use $ref** - Reuse schemas, parameters, responses
- **Add examples** - Real-world values help consumers
- **Document errors** - All possible error codes
- **Version your API** - In URL or header
- **Use semantic versioning** - For spec changes

#### Don'ts

- **Don't use generic descriptions** - Be specific
- **Don't skip security** - Define all schemes
- **Don't forget nullable** - Be explicit about null
- **Don't mix styles** - Consistent naming throughout
- **Don't hardcode URLs** - Use server variables

## Mandatory references
- `CLAUDE.md`
- `.claude/rules/` (loaded automatically)
- `docs/blueprint/PROJECT-CHARTER.md`
- Current phase package under `docs/phases/`
