# Dependencies

P01

List external services, packages, tools, phase outputs and owners.

## Phase inputs

| Input | Owner | Status |
|---|---|---|
| P01 gate (`docs/phases/P01/PHASE-STATUS.md`), merged to `main` | Program Coordinator | COMPLETED 2026-11-02 |
| P01 `architecture/phase-plan.md` §7 (contract consequences), `domain-model.md`, `threat-model.md` §4, §7 | P01 Solution Architect | accepted |
| ADR-002, ADR-003, ADR-009, ADR-010, ADR-013, ADR-015, ADR-016, ADR-023, ADR-025, ADR-029, ADR-036…ADR-039 | P01 Solution Architect | Accepted |
| ADR-035 (autonomous execution, delegation) | owner | Accepted 2026-11-02 |
| TECHNICAL-SPEC "0.1 draft · 2026-10-24" | product owner | baseline (P00 GOV-01) |

## Tools and packages (pinned; ADR-040)

| Tool | Version / pin | Licence | Used by | Source |
|---|---|---|---|---|
| Node.js | 24 LTS (machine: 24.22.2; Prism needs ≥ 24.18) | MIT | contract suite | ADR-003 |
| npm | ships with Node 24; `npm ci` from `tests/contract/package-lock.json` | Artistic-2.0 | contract suite | ADR-003 |
| `@redocly/cli` | 2.72.1 | MIT | lint | npm registry |
| `openapi-typescript` | 7.13.0 (peer `typescript ^5.x`) | MIT | TS generation | npm registry |
| `typescript` | 5.9.3 | Apache-2.0 | strict compile of generated types | npm registry |
| `@stoplight/prism-cli` | 5.16.0 | Apache-2.0 | mock | npm registry |
| oasdiff | 1.35.0, image `tufin/oasdiff:v1.35.0@sha256:82b1840a77335562bb11ce95f77ad31745a0c6f3a770929333ed1c5ef466e400` | Apache-2.0 | breaking-change check | Docker Hub |
| Docker Engine | as installed | Apache-2.0 | runs oasdiff | machine / CI |
| .NET SDK | 10.0.x (machine: 10.0.301), file-based apps | MIT | .NET reader check | ADR-002 |
| `Microsoft.OpenApi` (NuGet) | the version `Microsoft.AspNetCore.OpenApi` 10.0.x depends on; the Test Engineer records the exact number | MIT | .NET reader check | nuget.org |
| Python 3 | stdlib | PSF | `scripts/check-blueprint.py`, `scripts/phase-handoff-check.py` | repo |

Network access is needed only to install packages, the NuGet package and the image. No external service is called while checks run, and the scripts switch off tool telemetry (ADR-040, Security/privacy impact).

## External services

None. P02 adds no runtime service and no go-live owner action.

## Downstream consumers of P02 outputs

| Phase | Consumes |
|---|---|
| P03 | `tests/contract/` suite and the breaking-change check in the CI integration job (P03-OBL-01, P03-OBL-02) |
| P04 | the contract, ADR-006 conventions, ADR-040 §3 drift tests; operations with `x-phase: P04`; `implementation/backend-tasks.md` |
| P05 | the contract, generated TypeScript types, Prism mock; `implementation/frontend-tasks.md` |
| P06 | operations 3–14 (`x-phase: P06`) |
| P07, P08 | operations 15–29 (`x-phase: P07`); idempotency hash rule (phase-plan §7.5) |
| P09, P10, P12 | rich-text AST, document schema, photo rendition, snapshot create, `emailVerified` |
| P11 | operation 30 (`x-phase: P11`); batched documents decision |
| P13, P14 | data export, limits, full contract and drift suites |
| Every phase that changes the API | phase-plan §9 extension process |
