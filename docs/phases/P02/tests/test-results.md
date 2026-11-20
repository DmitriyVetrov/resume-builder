# Test Results

No tests executed yet. Record exact commands, environment, exit code, pass/fail counts and artifacts. Never mark tests passed without running them.

## Test Engineer, dispatch `task_27c0c3599082` (2026-11-02)

### Environment and pinned tools

- Worktree: `/home/dmytro/orca/workspaces/resumiser/p02`, Linux; Node `v24.22.2`, npm `11.19.1`, .NET SDK `10.0.301`, Docker `29.6.1`, git `2.47.3`, Python `3.13.5`.
- Direct contract tools, verified with their version commands: Redocly CLI `2.72.1`, openapi-typescript `v7.13.0`, TypeScript `5.9.3`, Prism CLI `5.16.0`; NuGet `Microsoft.OpenApi` and `Microsoft.OpenApi.YamlReader` both `2.12.2`; oasdiff image `tufin/oasdiff:v1.35.0@sha256:82b1840a77335562bb11ce95f77ad31745a0c6f3a770929333ed1c5ef466e400` (locally inspected by digest).
- Child processes use `REDOCLY_TELEMETRY=off`, `.NET` uses `DOTNET_CLI_TELEMETRY_OPTOUT=1`, and the oasdiff container uses `--network none`. The npm install command uses `--no-audit`. No environment prerequisite was missing; no check was skipped.

### Exact commands and observed exits

| Command, from repository root | Exit | Result |
|---|---:|---|
| `npm install --package-lock-only --prefix tests/contract --no-audit --no-fund --prefer-offline` | 0 | Lockfile created. |
| `npm ci --prefix tests/contract --no-audit --no-fund --prefer-offline` | 0 | 239 packages installed; npm reported one unapproved transitive `@scarf/scarf` install script, which npm did not run. |
| `node --test --test-concurrency=1 tests/contract/checks/inventory-security.test.mjs tests/contract/checks/http-semantics.test.mjs tests/contract/checks/schemas.test.mjs tests/contract/checks/lint.test.mjs` | 1 | Early harness run: 43/50 pass; six harness/representation mistakes corrected, one real request-closure mismatch retained. |
| `npm test --prefix tests/contract` | 1 | Final full run: **61 pass, 2 fail, 63 total**. The two failing positive checks are `AC-P02-02 positive root fields` and `AC-P02-04 positive requestClosure`; all negative mutations in the Node suite pass. Output: `/tmp/p02-suite-final.log` (local scratch log, not a tracked artifact). |
| `DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1 dotnet run tests/contract/dotnet/ContractReader.cs -- contracts/openapi/openapi.yaml` | 0 | `spec=OpenApi3_1 paths=26 errors=0 warnings=0`; N-17 rejects `openapi: 9.9.9`; N-18 missing reference produces 4 warnings, 0 errors (pinned reader behavior). |
| `python3 scripts/phase-handoff-check.py --phase P02 --role test-engineer --worktree .` | 0 | `RESULT PASS`: role scope and phase scope pass, blueprint check pass, suite exits `0/1/0` and the check recognizes the expected Test Engineer red state. |

The `suite.cmd` has exactly the three commands in test-plan §7. The Node script uses the Node 24 accepted `checks/*.test.mjs` form. The pinned CLI forms were exercised directly: Redocly bundle/lint, openapi-typescript `-o`, TypeScript `-p`, Prism `mock -h -p`, oasdiff `breaking --fail-on ERR`, and `dotnet run <file>.cs --`.

### Red and green evidence

- N-01 `operation-operationId`; N-02 `no-invalid-media-type-examples`; N-03 extra `/pdf` operation and excluded `pdf` token; N-04 missing `getSnapshot`; N-05 forbidden request `version`; N-06 open `Entry`; N-07 `ValidationIssue.value` echo; N-08 `getResume 404` wrong media; N-09 missing CSRF; N-10 extra anonymous `listResumes` and inventory mismatch; N-11 optional `If-Match`; N-12 missing 422; N-13 bad page limit; N-14 missing `no-store`; N-15 missing `getResume` success example; N-16 dangling `$ref` makes openapi-typescript exit 1; N-17 invalid OpenAPI version rejected; N-18 unresolved ref warns four times; N-19 removed `getResume` makes oasdiff report `api removed without deprecation` and exit 1; N-20 new required request property makes oasdiff exit 1; N-21 invalid `x-phase`; N-22 wrong example `version` makes strict `tsc` fail; N-23 missing `1.0.0` CHANGELOG heading. Each negative targets a cloned contract or temporary file, except N-23, which mutates a string in memory.
- Real-contract tool checks are green: Redocly lint exits 0, TypeScript generation and strict compile exit 0 with **287 direct examples and 4 binary/indirect examples**, Prism returns 200 for the two GET examples and the control PUT, and 422 for the PUT missing `If-Match`; oasdiff self-comparison reports `No changes detected` (exit 0). No `main` contract exists, so the baseline check reports `oasdiff: first version (no baseline on main)`.
- The prescribed pure green state is unavailable because the contract preceded this test step. The negative mutations are the red proof. The full suite is still red on two real-contract/plan mismatches below; no test or contract was changed to hide them.

### Findings requiring Architect/Contract Architect resolution

1. **AC-P02-02 root fields.** Test-plan §3 requires `servers` to equal `[{url: /api/v1}]` exactly. The real contract has `{url: /api/v1, description: "Same-origin API base path."}`; the `rootFields` rule correctly returns `servers`. The Architect should either approve the descriptive field in the test plan or ask the Contract Architect to remove it. The Test Engineer cannot make that contract/plan decision.
2. **AC-P02-04 request closure.** Test-plan §3 requires none of 11 forbidden property names, including `id`, anywhere in a request schema closure. The real `ResumeDocument` request closure contains client-owned `id` properties in `ContactItem`, all four section variants, `ListItem`, and `Entry`, causing 14 violations across `createResume` and `replaceResumeDocument`. Those IDs are required by phase-plan §6.1, so the likely decision is to distinguish client-owned document IDs from server-owned resource IDs in the criterion; this needs Architect approval and a revised plan. The check remains strict as written.

Next owner: Solution Architect for the two criterion/contract conflicts, then Contract Architect if a contract fix is chosen. After resolution, rerun the three `suite.cmd` commands and the handoff check.

## Test Engineer round 2 — test-plan revision 3 (2026-11-02)

Updated `rootFields` to require exactly one `/api/v1` server while allowing its descriptive fields (F-15), and updated `requestClosure` to forbid the 11 server-owned names at any depth while allowing `id` only in the seven DD-P02-28 client-owned schemas as a direct `Uuid` reference. N-24 rejects `ResumeDocument.id`; N-25 rejects a second server. No contract or test-plan content was changed.

Environment: Node.js `v24.22.2`, npm `11.19.1`, .NET SDK `10.0.301`; pinned test tools are `@redocly/cli` 2.72.1, `openapi-typescript` 7.13.0, TypeScript 5.9.3, Prism 5.16.0, oasdiff 1.35.0 (pinned image digest in test plan). The commands below were run from the repository root.

| Exact command | Exit | Result |
|---|---:|---|
| `bash -e docs/phases/P02/tests/suite.cmd` | 1 | First revision-3 run: npm install passed; Node suite 64/65 passed. N-24 detected `ResumeDocument requestClosure invalid id`, but its test expected a literal `ResumeDocument.*id`; corrected that assertion to the actual diagnostic. The final .NET command was not reached. |
| `node --test tests/contract/checks/schemas.test.mjs` | 1 | Narrow reproduction of the N-24 assertion mismatch: 11/12 passed. |
| `bash -e docs/phases/P02/tests/suite.cmd` | 0 | Full rerun: `npm ci` succeeded; Node suite **65/65 pass**, including N-24 and N-25, Redocly lint, strict TypeScript compile, Prism live examples, and oasdiff checks; .NET reader printed `spec=OpenApi3_1 paths=26 errors=0 warnings=0`. Expected negative reader probes: N-17 rejected version 9.9.9; N-18 unresolved reference gave four warnings and reader exit 0 (known Should diagnostic). Full output: `/tmp/p02-rev3-suite.log` (local scratch). |
| `python3 scripts/phase-handoff-check.py --phase P02 --role test-engineer --worktree .` | 0 | `RESULT PASS`; role scope and phase scope passed; blueprint check exit 0; all three suite commands exited 0. Output: `/tmp/p02-rev3-handoff.log` (local scratch). |

The full suite now passes against the real contract. No remaining contract-content failure was found. Next owner: Program Coordinator for the P02 handoff and review.

### Concurrent-scope checkpoint

After the successful handoff check above, Architect-owned files `docs/phases/P02/acceptance-criteria.md`, `docs/phases/P02/architecture/phase-plan.md` and `docs/phases/P02/decisions.md` changed concurrently in this shared worktree. I did not edit them. Re-running the exact command `python3 scripts/phase-handoff-check.py --phase P02 --role test-engineer --worktree .` exited **1** with `FAIL ROLE_SCOPE` for those three files, followed by `RESULT FAIL`; the same run found the suite exits `0/1/0` and the expected red state. This is a shared-worktree scope failure in addition to the two real positive-check findings above. The coordinator was notified through Orca escalation `msg_dc6c1663f5ae`.

## Test Engineer review fix loop 1 — M-2 and m-1 (2026-11-02)

Expanded `exampleEmails` across inline request and response media examples, operation and component parameter examples, and nested schema `example`/`examples`/`default` values. N-26 injects `someone@gmail.com` into the inline `signUp` request example. Added the missing m-1 constraint rows and `ListItem` to `namedSchemas`; no contract or test-plan file was edited. The test plan's negative catalogue ends at N-25, so N-26 needs a Test Architect plan entry outside this role's scope.

| Exact command, repository root | Exit | Result |
|---|---:|---|
| `node --test --test-name-pattern='N-26' tests/contract/checks/mock-examples.test.mjs` | 1 | Red proof before scanner change: `N-26 did not detect signUp/request email gmail.com`; 1 failed. |
| `node --test tests/contract/checks/mock-examples.test.mjs` | 1 | After scanner change but before correcting the negative's expected diagnostic substring: 5 pass, 1 fail; scanner reported `signUp/request/application/json/email email gmail.com`. |
| `node --test tests/contract/checks/mock-examples.test.mjs tests/contract/checks/schemas.test.mjs` | 0 | 18/18 pass, including N-26 and all m-1 data rows. |
| `npm test --prefix tests/contract` | 0 | 66/66 pass, 0 fail, 0 skipped; N-26 detected `gmail.com`, Redocly lint valid, TypeScript conformance 287 direct and 4 indirect/binary examples, Prism GET/control PUT 200 and missing If-Match 422, oasdiff baseline/self and negatives pass. |
| `python3 scripts/phase-handoff-check.py --phase P02 --role test-engineer --worktree .` | 1 | All three suite commands exited 0; `RESULT FAIL` solely on `ROLE_SCOPE` for concurrently modified Contract Architect files `contracts/openapi/CHANGELOG.md`, `contracts/openapi/openapi.yaml`, and `docs/phases/P02/architecture/contract-changelog.md`. Coordinator notified via Orca escalation `msg_e1a65f73b15a`; these files were modified before this task's first edit. |
