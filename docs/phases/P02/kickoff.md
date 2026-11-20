# P02 Kickoff — API Contract v1

- Phase: P02. Dependency P01 is `COMPLETED` (gate closed 2026-11-02, merged to `main`).
- Written by: Solution Architect (Orca worker, task `task_e8c15cd56840`), 2026-11-02.
- Mode: autonomous (ADR-035). The Solution Architect decides every question by delegation (ADR-035 A-4) and tags the answer `DELEGATED-DEFAULT` in `decisions.md`.

## 1. Scope summary

P02 freezes the first canonical HTTP contract: one OpenAPI 3.1 document in `contracts/openapi/` that covers the whole v1 API surface known today, with the cross-cutting semantics (auth, CSRF, error envelope, pagination, concurrency, idempotency, caching, limits, rate limits, versioning), examples, a usable mock and executable contract checks. After the P02 gate, P04 (backend) and P05 (frontend) build against this frozen contract in parallel, and every later API change goes through the extension process in `architecture/phase-plan.md` §9.

P02 is a **contract phase**. It changes no file under `backend/` or `frontend/`. Its implementation artifact is the contract itself; its tests are tool-based checks of the contract.

| Deliverable | Owner | Content | Source IDs |
|---|---|---|---|
| `kickoff.md`, `architecture/phase-plan.md`, `decisions.md`, `dependencies.md`, `acceptance-criteria.md`, task files | Solution Architect | endpoint inventory, semantics, conventions, extension process, `DELEGATED-DEFAULT` answers | PHASE.md DoD |
| ADR-006 (contract format and conventions), ADR-040 (validation and type-generation tooling) | Solution Architect | Accepted under delegation; register updated | DECISION-REGISTER ADR-006, ADR-040 |
| `contracts/openapi/openapi.yaml`, `contracts/openapi/CHANGELOG.md`, `contracts/openapi/README.md`, `architecture/contract-changelog.md` | Contract Architect | the OpenAPI 3.1.0 document v1.0.0 with examples; change log and breaking-change analysis | phase-plan §5–§8 |
| `tests/test-plan.md` | Test Architect | acceptance mapping within the §3 budget | acceptance-criteria.md |
| `tests/contract/**`, `tests/suite.cmd`, red section of `tests/test-results.md` | Test Engineer | the contract check suite (§3) | ADR-040 |

Requirement groups the contract carries: FR-ACC-01…04 and 06 (claim through create), FR-LIB-01…05, FR-HDR-01…06, FR-SEC-01…11, FR-TYP-01…03, FR-RTE-01…03 (the AST shape), FR-TPL-01/03/05, FR-CLR-01, FR-LAY-01…10, FR-PER-01…05, FR-PHO-01…05, NFR-08…NFR-10, NFR-12, NFR-13, TECHNICAL-SPEC §10.1–§10.2. FR-PRV, FR-PDF, FR-TXT and FR-LIB-06 have **no server endpoints** (ADR-010: preview, PDF and TXT are produced in the browser); the contract only serves the data they need.

## 2. Roles

| Step | Role | Needed | Notes |
|---|---|---|---|
| 1–2 | Solution Architect | yes | this kickoff, the plan, ADR-006, ADR-040, delegated decisions, task files |
| 3 | Test Architect | yes | lean `tests/test-plan.md` within §3 |
| 4 | **Contract Architect** | **yes** | the phase creates the API contract. Writes only `contracts/openapi/**` and `docs/phases/P02/architecture/contract-changelog.md` (the role's handoff scope; it does not edit `decisions.md`). Before handoff it self-checks the contract with the pinned tool versions of ADR-040 run through `npx` from a scratch directory outside the repository (PD-P02-06) |
| 5 | Test Engineer | yes | the check suite in `tests/contract/`, `tests/suite.cmd`, red evidence (§3) |
| 6 | Backend / Frontend Developer | **no dispatch** | P02 has no backend or frontend code; P04 and P05 scaffold them. The task files hold the P04+ consumption tasks. If the suite is red against the real contract after step 5, the "green" step is a fix loop by the Contract Architect on `contracts/openapi/**` (same terminal if still live), not a developer dispatch (PD-P02-01) |
| 7 | Code Reviewer | yes | one pass: API compatibility review (rule 02), security semantics, test integrity, scope |
| 8 | QA / Acceptance | yes | runs the acceptance matrix and the suite |

The step order is the ADR-035 B-1 order: test plan → contract → red → (contract fix loop if red) → review → QA → gate.

## 3. Test budget (ADR-035 B-4: contract phase)

P02 is between a documents phase and a code phase: the deliverable is a machine-readable contract, so the checks run real contract tools, but there is no product code. Budget:

- **One Node package** at `tests/contract/` with `package.json` and a committed `package-lock.json`. Exact devDependencies, no others: `@redocly/cli` 2.72.1, `openapi-typescript` 7.13.0, `typescript` 5.9.3, `@stoplight/prism-cli` 5.16.0 (ADR-040). Runtime Node.js 24 LTS (ADR-003; Prism needs ≥ 24.18).
- Checks are plain Node ESM modules run by the **built-in `node:test` runner**. No Jest, Vitest, Mocha, Chai, Ajv-as-direct-dependency or other framework. At most 6 check modules plus 1 shared helper, about 700 lines in total.
- **One** .NET 10 file-based C# app (`dotnet run <file>.cs` with a `#:package` directive for `Microsoft.OpenApi`), at most about 80 lines: it loads the contract with the reader that ASP.NET Core 10 uses and fails on reader errors.
- **oasdiff** 1.35.0 through the official image `tufin/oasdiff:v1.35.0` pinned by digest `sha256:82b1840a77335562bb11ce95f77ad31745a0c6f3a770929333ed1c5ef466e400` (ADR-040). The baseline is the contract on `main`; P02 has none yet (first version).
- **Negative evidence without a fixture tree:** each check proves it can fail through in-memory mutations of the parsed contract (written to a temp file only where a tool needs a file). At most one mutation per defect class; no committed negative contracts.
- Generated outputs (TypeScript types, bundles, reports) go only to git-ignored directories under `tests/contract/` or the OS temp directory. Nothing generated is committed (ADR-040 §5).
- `docs/phases/P02/tests/suite.cmd`: at most 3 commands (install from the lockfile, run the Node checks, run the .NET reader check). The suite runs offline-deterministically after installation; the only network access is package, NuGet and image download.
- Every Must criterion in `acceptance-criteria.md` gets a positive case and a negative case (B-4 for code phases), except the criteria whose "Negative case" column is "—" (AC-P02-01, AC-P02-13, AC-P02-14, AC-P02-15, AC-P02-16): they are review or handoff-check items. The Should criterion AC-P02-17 is tested if it fits the budget.

A larger test plan needs a reason recorded in this file (PHASE-GATES "Autonomous gate rules").

## 4. Parallel slices

- **Within P02:** none. The contract is one file with one writer (Contract Architect), and no Backend ∥ Frontend child worktrees are needed.
- **After P02:** the whole v1.0.0 contract is frozen at the P02 gate. P04 ∥ P05 run in parallel against it (`docs/phases/README.md`). Each operation carries `x-phase` (the phase that implements it in the backend; phase-plan §5), which defines the slices for later parallel Backend ∥ Frontend work: P04 health and cross-cutting behaviour; P06 Session and Account; P07 Resumes, Photos and Snapshots; P11 client events. The frontend works against the Prism mock for any slice the backend has not implemented yet.

## 5. Decisions this phase needs, and how they were decided

All were decided by delegation (ADR-035 A-4 precedence: TECHNICAL-SPEC, then `docs/source/README.md` evidence, then the most conservative, reversible and standard option). Full records with options are in `decisions.md`.

| Need | Decision | Record | Basis |
|---|---|---|---|
| ADR-006 contract format (register: FIXED contract-first, format PROPOSED) | OpenAPI **3.1.0**, one YAML file `contracts/openapi/openapi.yaml`, JSON Schema 2020-12, base path `/api/v1`, semver `info.version` 1.0.0, conventions and extension process | ADR-006, DD-P02-01…04, DD-P02-20 | rule 02; register; conservative |
| ADR-040 tooling (register: OPEN) | Redocly CLI lint, openapi-typescript + TypeScript strict, Prism mock, oasdiff breaking-change check, Microsoft.OpenApi reader; TS types generated and not committed; C# DTOs hand-written and verified by drift tests in P04 | ADR-040, DD-P02-21, DD-P02-22 | P01 constraint (register ADR-040 row); conservative |
| Error envelope (P01 phase-plan §7 left it to P02) | RFC 9457 Problem Details with `code`, `traceId`, `errors[]` of location/pointer/code, never values | ADR-006 §4, DD-P02-03 | threat model T-ID-05 |
| Resource shapes and write paths | Resume = metadata + one `ResumeDocument` shared by read and write; photo metadata at resource level; create from a client-built document or a server-side copy; one document write path | DD-P02-05…08, DD-P02-17 | ADR-037, ADR-015, ADR-029, T-EP-03 |
| Concurrency and idempotency details | strong ETag `"<n>"`; 428/412/400 rules; check order; request-hash input incl. multipart rule; 409 for an in-flight duplicate | DD-P02-09, DD-P02-10 | ADR-037; IETF Idempotency-Key draft |
| Auth details | `GET /session`, CSRF on anonymous auth posts, re-authentication endpoint with a 5-minute window, uniform 202 responses, status codes | DD-P02-11…13 | ADR-036, ADR-013 |
| Pagination | cursor, `limit` 1…200 (default 50), fixed sort per endpoint | DD-P02-14 | rule 02; FR-LIB-01 |
| Photos | multipart upload, square crop update, private no-cache GETs, version-checked writes | DD-P02-15, DD-P02-25 | ADR-009, FR-PHO-01…05 |
| Client events (P01 review i-7) | authenticated, ≤ 20 events and ≤ 16 KB per request, content-free schema | DD-P02-16 | ADR-010 §8, NFR-13 |
| Data export | one streamed JSON response, re-auth and verified, `no-store` | DD-P02-18 | ADR-039 §6, ADR-013, T-ID-12 |

**Open register items that touch P02:** D-05/D-06 (P07) and D-12, D-14, D-15, D-16, D-18, D-19 (P10) stay open for their phases. None changes the contract: blank-resume defaults are built by the client (DD-P02-06), template data lives in the frontend (ADR-010, FR-TPL-05), and the schema already allows any section set, `templateId` T1–T3, `placement` (ADR-025) and editable labels (ADR-023). So no open decision blocks the P02 contract (decisions.md §3).

## 6. Follow-ups outside this step

- `docs/blueprint/ARCHITECTURE.md` §4 and §9, and `CLAUDE.md` ("Still open: … ADR-006/ADR-040 (P02)", "Commands"), become stale once ADR-006 and ADR-040 are Accepted. Both files are outside this task's file scope; the Program Coordinator updates them at the gate (as OOS-04 in P01), including the P02 suite command.
- P03 wires the contract checks into the CI integration job (P03 DoD "integration job runs contract checks"); obligation P03-OBL-01 in phase-plan §12.
- Go-live owner actions: none new in P02.
