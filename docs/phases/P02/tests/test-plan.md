# P02 Test Plan

- Author: Test Architect (Orca worker, task `task_c6e2da2384b9`), 2026-11-02.
- Inputs: `../PHASE.md`, `../kickoff.md` §3 (test budget), `../architecture/phase-plan.md` (§5–§9), `../acceptance-criteria.md` (AC-P02-01…17), `../decisions.md` (PD-P02-02, PD-P02-03, DD-P02-*), ADR-040, `docs/blueprint/AGENT-WORKFLOW.md`, `.claude/rules/*`, skill `api-contract-first`.
- Readers: Contract Architect (step 4: the conventions in §6 are what the checks parse), Test Engineer (step 5: writes `tests/contract/**`, `../tests/suite.cmd` and the red section of `test-results.md` from this plan), Code Reviewer, QA.
- Findings for the Solution Architect: §9 (none blocks the next step; each has a recommended default that this plan already uses).
- Revision 2 (Test Architect, task `task_91adffebf502`, 2026-11-02): aligned with the frozen contract v1.0.0 and `../architecture/contract-changelog.md` (the Contract Architect's phase change log, PD-P02-04) §3 and §6. Changed: the `anonAllowList` rule (AC-P02-06, F-10), the Prism routing and missing-`If-Match` expectation (AC-P02-09, F-11, F-12), the `changelog` rule and its location (AC-P02-13, F-13), negatives N-10 and N-23 (new). The contract was not changed.
- Revision 3 (Test Architect, task `task_6c9bd7a7571a`, 2026-11-02): resolves the two positive-check findings of the Test Engineer step (`test-results.md`, findings 1 and 2). Changed: the AC-P02-04 `requestClosure` rule now uses the DD-P02-28 wording from phase-plan §6.2 (11 forbidden names; `id` allowed only in seven client-owned entity schemas, as `$ref` `Uuid`), with new negative N-24 (F-14); the AC-P02-02 `rootFields` rule on `servers` is relaxed to "exactly one server whose `url` is `/api/v1`; other server fields such as `description` are allowed" (coordinator `DELEGATED-DEFAULT`, F-15), with new negative N-25. The contract was not changed.
- Revision 4 (Test Architect, task `task_35ab5198dc47`, 2026-11-02): review finding M-2. The AC-P02-09 `exampleEmails` rule now states that it covers inline request/response media-type examples, parameter examples and nested schema examples; new negative N-26 (`gmail.com` in the inline `signUp` request example). The contract was not changed.

Required test strategy (PHASE.md): OpenAPI lint/schema validation, breaking-change checks, generated C#/TS type consistency, contract tests.

## 1. Budget and approach (kickoff §3, PD-P02-02, PD-P02-03)

| Item | Value |
|---|---|
| Package | one Node package `tests/contract/`: `package.json` + committed `package-lock.json`; exact devDependencies `@redocly/cli` 2.72.1, `openapi-typescript` 7.13.0, `typescript` 5.9.3, `@stoplight/prism-cli` 5.16.0; **nothing else** |
| Runner | built-in `node:test` + `node:assert/strict`; Node ESM (`.mjs`). No Jest, Vitest, Mocha, Chai, Ajv, js-yaml or other library as a direct dependency, and **no import of transitive dependencies** (they are not pinned by us and may change with any lockfile refresh). Checks import only `node:*` built-ins; tools are run as child processes from `node_modules/.bin` |
| Modules | 6 check modules + 1 shared helper (§2), about 700 lines in total |
| .NET | one file-based app `tests/contract/dotnet/ContractReader.cs` (`dotnet run <file>.cs`, `#:package` directive), ≤ ~80 lines |
| oasdiff | `tufin/oasdiff:v1.35.0@sha256:82b1840a77335562bb11ce95f77ad31745a0c6f3a770929333ed1c5ef466e400`, run through `docker run` from the Node check |
| Negatives | in-memory mutations of the parsed contract (deep clone + one change), written to the OS temp directory only when a tool needs a file. **At most one mutation per defect class; no committed negative contracts or fixture tree** |
| Generated output | only in the git-ignored `tests/contract/.work/` (bundle, generated types, conformance file) or `os.tmpdir()`. Never committed |
| Suite | `../tests/suite.cmd`, exactly 3 commands (§7) |
| Red state | PD-P02-03: the contract (step 4) exists before the checks (step 5). Red evidence is the negative mutation of every check (§4), recorded with its violation messages. A positive check that is red against the real contract goes to the Contract Architect fix loop (PD-P02-01), never to a test change |
| Test levels | **contract-static** (parsed-document rules), **tool-compatibility** (Redocly, openapi-typescript + tsc, Microsoft.OpenApi, oasdiff on the real contract), **mock-integration** (Prism live). Unit, component, E2E, rendering, performance and security-scan levels are **N/A** in P02: there is no product code (kickoff §1). They start in P04/P05 (drift tests, phase-plan §8.1) |

The plan fits the budget. AC-P02-17 (Should) is included in the `types-diff` module. One optional Should item (S-1, §5) is cut first if the line budget is tight. No larger budget is requested.

## 2. Module design (for the Test Engineer)

### 2.1 Layout of `tests/contract/`

```
tests/contract/
  package.json            exact devDependencies (§1); scripts "test" and "mock" (§7)
  package-lock.json       committed; installed only with `npm ci`
  .gitignore              ".work/" (root .gitignore already covers node_modules/)
  redocly.yaml            project lint ruleset (§3, AC-P02-02)
  tsconfig.json           strict compile of .work/*.ts (AC-P02-10, AC-P02-17)
  README.md               mock command, Prefer: code=<status>, mock paths at the root (no /api/v1 prefix, F-11), telemetry switches, prerequisites (§8)
  checks/helpers.mjs      shared helper (~110 lines)
  checks/lint.test.mjs                 AC-P02-02                         (~50)
  checks/inventory-security.test.mjs   AC-P02-03, AC-P02-06, AC-P02-13   (~130; the §5 table is data)
  checks/schemas.test.mjs              AC-P02-04                         (~140; the §6 constraints are data)
  checks/http-semantics.test.mjs       AC-P02-05, AC-P02-07, AC-P02-08   (~100)
  checks/mock-examples.test.mjs        AC-P02-09                         (~100)
  checks/types-diff.test.mjs           AC-P02-10, AC-P02-12, AC-P02-17   (~80)
  dotnet/ContractReader.cs             AC-P02-11                         (~80)
```

The Test Engineer may rename files but not add modules. Changes to the layout beyond this need a reason in `test-results.md` (kickoff §3).

### 2.2 Helper (`checks/helpers.mjs`)

1. **Paths.** Repo root from `import.meta.url` (no dependence on cwd). Contract path `contracts/openapi/openapi.yaml`.
2. **Loading YAML without a YAML library.** Node has no built-in YAML parser and the budget forbids one. The helper runs `redocly bundle <contract> --output .work/openapi.json` once per process (the pinned direct dependency) and `JSON.parse`s the result. All semantic checks read this JSON. The source YAML itself is what Redocly lint, openapi-typescript, Prism, the .NET reader and oasdiff read.
3. **`resolve(doc, node)`** follows local `$ref` (`#/components/...`) until a non-ref node; a missing target throws (this is also a check failure, not a crash of the runner).
4. **`operations(doc)`** yields `{method, path, op, pathItem}` for the eight HTTP methods, sorted by path then method. Path-level `parameters` are merged with operation `parameters`; effective security = `op.security ?? doc.security ?? []`.
5. **`walk(schema)`** visits every schema object reachable through `properties`, `items`, `oneOf`, `anyOf`, `allOf`, `additionalProperties` (object) and `$ref`, with cycle protection by ref name.
6. **`mutate(doc, fn)`** = `structuredClone(doc)` + `fn(clone)`. `fn` **must throw if its target does not exist** (for example the operation `replaceResumeDocument` is missing), so a negative case can never pass vacuously.
7. **`writeTemp(obj)`** writes JSON to a fresh `fs.mkdtempSync(os.tmpdir())` directory; removed in `after()`.
8. **`run(cmd, args, opts)`** = `spawnSync` with `shell: false`, a fixed timeout, and an environment that adds the telemetry switches (§8). Returns `{status, stdout, stderr}`. A missing executable (`ENOENT`) fails the test with `ENV_MISSING: <tool>` (§8). No retries.

### 2.3 Check pattern (every module)

- Every rule is a **pure function** `ruleXx(doc) -> string[]` (violation messages that name the operation, schema or pointer; `[]` = pass).
- Positive test: `assert.deepEqual(ruleXx(contract), [])`.
- Negative test: `const v = ruleXx(mutate(contract, m))`; assert `v.length > 0` **and** that a message names the mutated item. The test logs `v` so the Test Engineer can paste it into `test-results.md` as red evidence.
- Tool checks follow the same shape with exit codes: real contract → exit 0; mutated temp file → exit ≠ 0 and the expected rule/message in the output.
- Tests are named `AC-P02-xx positive|N-xx <short name>` so `test-results.md` and the QA matrix can cite them.

### 2.4 Determinism

- No wall-clock, randomness or ordering dependence: iterate sorted keys; data tables are arrays in plan order.
- Prism: bound to `127.0.0.1` on a free port obtained from `net.createServer().listen(0)`; static examples only (no dynamic generation); readiness poll every 250 ms with a 60 s limit; killed in `after()`. A timeout is a failure, never a skip. Requests go to `http://127.0.0.1:<port>/<path>` (for example `/resumes`): Prism 5.16.0 serves the paths at the root, not under the relative server URL `/api/v1`, which answers 404 `NO_PATH_MATCHED_ERROR` (contract-changelog §6-3, F-11).
- Node tests run with `--test-concurrency=1` (one Prism, one Docker run at a time; stable output order).
- oasdiff runs with `--network none` and read-only mounts.
- The same tree gives the same results twice (QA re-runs the suite once).

## 3. Acceptance mapping (Must first)

"Check" = module and rule. "Positive" is run on the real contract. "N-xx" is the negative mutation (§4). The Test Engineer records both results for every row that has a negative.

| AC | Pri | Level | Check (module → rule) | Positive (real contract) | Negative |
|---|---|---|---|---|---|
| AC-P02-01 | Must | review | QA reads `kickoff.md` | roles (Contract Architect yes, no developer dispatch), budget, slices, decisions present | — (review item) |
| AC-P02-02 | Must | tool | `lint` → `rootFields` (`openapi` = `3.1.0`, `info.version` = `1.0.0`; `servers` has exactly one entry and `servers[0].url` = `/api/v1`; other fields of that entry, such as `description`, are allowed and not checked (F-15)); `redocly lint contracts/openapi/openapi.yaml --config tests/contract/redocly.yaml` | rule `[]`; lint exit 0, 0 errors (warnings allowed, printed) | N-01, N-02, N-25 |
| AC-P02-03 | Must | static | `inventory-security` → `inventory` (30-row table copied from phase-plan §5: method, path, `operationId`, `x-phase`, `x-rate-limit-policy`, auth class → normalized security set, `+reauth`, `+verified`); `excludedTokens` (phase-plan §5.8 token list over every hyphen-separated token of every path segment; only `/account/data-export` may contain `export`) | exact set equality, 30 = 30, no extra operation, no extra method on any path; tokens `[]` | N-03, N-04 |
| AC-P02-04 | Must | static | `schemas` → `namedSchemas` (every name in §6.1–§6.4 exists); `documentClosure` (every object reachable from `ResumeDocument`: `additionalProperties: false` and `required` = all property keys, see F-07); `constraints` (data table: every length, range, enum, `multipleOf`, `maxItems` of §6.1 and §6.3, incl. sections 100, entries 100, list items 100, contacts 20); `discriminators` (`Section`, `EndDate`, `Block`, `Inline`, `CreateResumeRequest`: `oneOf` + `discriminator.propertyName` + `mapping` whose keys equal the variants' `const` values and whose targets are the variants); `inlineSection` (`content.body` `minItems` 1, `maxItems` 1, items → `Paragraph`); `safeUrl` (every `url` property resolves to `SafeUrl` directly or as `oneOf/anyOf [SafeUrl, {type: null}]`; `SafeUrl` has `maxLength` 2048 and the only URL pattern in the contract; the pattern, compiled as `new RegExp(p, "u")`, accepts `https://example.com/a`, `http://example.org`, `mailto:a@example.com`, `tel:+15550100` and rejects `javascript:alert(1)`, `data:text/html,x`, `https://exa mple.com`, a URL with `\u0000`, a 2049-character URL by `maxLength`); `requestClosure` (DD-P02-28, wording of phase-plan §6.2: every object reachable from any `requestBody` schema, multipart included, has `additionalProperties: false` and contains none of the 11 forbidden property names of AC-P02-04 (`ownerId`, `version`, `createdAt`, `updatedAt`, `deletedAt`, `purgeAt`, `lastWrite`, `photo`, `passwordHash`, `emailVerifiedAt`, `schemaVersion`) at any depth. A property named `id` is allowed only in the client-owned entity schemas `ContactItem`, `TextSection`, `InlineSection`, `ListSection`, `EntriesSection`, `ListItem`, `Entry` (matched by `components/schemas` name), where it must resolve to `#/components/schemas/Uuid`; `id` in any other request-closure object, or an `id` in one of the seven schemas that does not resolve to `Uuid`, is a violation; F-14); `neverInContract` (`ownerId`, `lastWrite`, `passwordHash`, `schemaVersion` appear in no schema at all, phase-plan §6.2); `clientEvents` (`ClientEventBatch.events` `minItems` 1 / `maxItems` 20; every string property of `ClientEvent` has `enum`, `pattern` or `format` `uuid`/`date-time`: no free text, DD-P02-16) | all rules `[]` | N-05, N-06, N-24 |
| AC-P02-05 | Must | static | `http-semantics` → `problemResponses` (every `4XX`/`5XX`/explicit 4xx–5xx response, after `$ref` resolution, has exactly one media type `application/problem+json` with schema `Problem`, 412 `VersionMismatchProblem`); `defaultResponse` (every operation has `default` → `Problem`); `rateLimited` (every operation declares 429 with header `Retry-After`, `required: true`, integer schema); `noEcho` (`Problem`, `ValidationIssue` and `VersionMismatchProblem` (incl. `allOf` parts) have no `value`, `input`, `received`, `rejectedValue` or `document` member; `VersionMismatchProblem` requires `currentVersion` and `updatedAt`) | all `[]` | N-07, N-08 |
| AC-P02-06 | Must | static | `inventory-security` → `schemes` (`sessionCookie` = apiKey/cookie/`__Host-rb_session`; `csrfHeader` = apiKey/header/`X-XSRF-TOKEN`); `anonAllowList` (an operation is anonymous when it can be called without a session: its effective security is `[]`, or **at least one security alternative does not contain `sessionCookie`**. For the `anon+csrf` operations (`[{csrfHeader: []}]`) this is "no alternative contains `sessionCookie`" (contract-changelog §6-1); `getSession` (`[{}, {sessionCookie: []}]`) qualifies through its `{}` alternative. The set of anonymous `operationId`s must equal exactly the 9 names of phase-plan §7.1, compared as a set of names, not only a count; F-10); `csrfOnUnsafe` (every POST/PUT/PATCH/DELETE: every security alternative contains `csrfHeader`); `authNeeds401` (every operation outside the allow-list declares 401); `unsafeNeeds403`; `reauth` (`x-requires-reauth: true` on exactly `changePassword`, `requestAccountDeletion`, `exportAccountData`); `verified` (`x-requires-verified-email: true` only on `exportAccountData`, which declares 403) | all `[]` | N-09, N-10 |
| AC-P02-07 | Must | static | `http-semantics` → `ifMatch` (ops 18–21, 25–27: header parameter `If-Match` (name compared case-insensitively), `required: true`; responses 412 and 428); `idempotencyKey` (ops 16, 18–21, 23, 25–27: header `Idempotency-Key`, `required: true`, `format: uuid`; response 422); `etag` (`getResume` 200, `createResume` 201 and the success response of ops 18–20, 25–27 declare response header `ETag`; op 21 is exempt, F-01); `hashRule` (the `Idempotency-Key` parameter description contains `SHA-256` and `8785`; the `uploadPhoto` operation or its `Idempotency-Key` description names the `file` part; F-03) | all `[]` | N-11, N-12 |
| AC-P02-08 | Must | static | `http-semantics` → `pagination` (`listResumes`, `listSnapshots`: query `limit` integer, `minimum` 1, `maximum` 200, `default` 50; query `cursor` string; 200 schema has `items` (array) and `nextCursor` (type includes `null`), both required); `stateParam` (`listResumes` query `state` enum = {`active`, `trashed`}); `noStore` (every 2xx with `application/json` content of ops 3, 7, 14–20, 22–27 declares header `Cache-Control` with value `no-store`, convention §6); `photoCaching` (`getPhotoRendition`, `getPhotoMaster` 200: `Cache-Control` = `private, no-cache`, `ETag`, `X-Content-Type-Options` = `nosniff`; response 304 declared) | all `[]` | N-13, N-14 |
| AC-P02-09 | Must | static + mock | `mock-examples` → `successExamples` (every 2xx response **with content** has `example` or a non-empty `examples`, `$ref`s resolved; bodiless 2xx exempt, F-02); `errorExamples` (every `components/responses` entry used as a 4xx/5xx/default has an example per media type); `exampleEmails` (every string scalar in every `example`, `examples[*].value`, schema `example`/`examples`/`default` that contains `x@y` has domain `example.com`, `example.org` or ending `.invalid`; the scan covers `components/examples`, inline request-body and response media-type `example`/`examples`, operation and component parameter examples, and schema examples at any depth, review M-2); `prism` (start Prism on the contract; every request path is at the root, without `/api/v1` (F-11); `GET /resumes` and `GET /resumes/{id}` with cookie `__Host-rb_session=mock` → 200 and the body is deep-equal to the contract's `listResumes`/`getResume` example, which lint has validated against `ResumePage`/`Resume` (F-04); `PUT /resumes/{id}/document` with cookie, `X-XSRF-TOKEN`, `Idempotency-Key`, a valid example body and **no `If-Match`** → status 400–499 and not 2xx. The check does **not** assert 428: Prism answers request-validation failures with the operation's 422 response (the `idempotency_key_reused` example); 428 is server behaviour, verified from P07 by the drift tests (F-12). Control request: the same `PUT` with `If-Match: "7"` → 200, so the 4xx is caused by the missing header and not by another validation failure) | rules `[]`; Prism assertions hold (`GET`s 200, control `PUT` 200) | N-15, N-26; the missing-`If-Match` request is itself the negative live case (expected 4xx, observed 422 with Prism 5.16.0, recorded in `test-results.md`) |
| AC-P02-10 | Must | tool | `types-diff` → `openapi-typescript contracts/openapi/openapi.yaml -o .work/api.d.ts` exit 0; `tsc -p tests/contract/tsconfig.json` (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noEmit`, `skipLibCheck: false`) exit 0; `gitHygiene` (`git ls-files tests/contract` lists nothing under `.work/`; `git check-ignore -q tests/contract/.work/api.d.ts` exits 0) | exit 0 / 0 / hygiene `[]` | N-16 |
| AC-P02-11 | Must | tool | `ContractReader.cs`: reads the YAML with `Microsoft.OpenApi` at the version `Microsoft.AspNetCore.OpenApi` 10.0.x depends on (exact version pinned in `#:package`, F-05); prints warnings; exit 1 on any reader error. After the positive load it applies the in-memory negative itself (§4 N-17) and exits 1 if the mutated text loads without errors | exit 0, `errors=0` | N-17 (N-18 Should) |
| AC-P02-12 | Must | tool | `types-diff` → `oasdiffBaseline`: `git show main:contracts/openapi/openapi.yaml`; absent → the check prints `oasdiff: first version (no baseline on main)` and passes (F-08); present → `docker run --rm --network none -v <tmp>:/specs:ro <image@digest> breaking /specs/base.yaml /specs/rev.yaml --fail-on ERR` exit 0. `oasdiffSelf`: base = rev = the real contract → exit 0 (proves the Docker path runs green in P02, where no baseline exists) | first-version pass + self-diff exit 0 | N-19 (N-20 Should) |
| AC-P02-13 | Must | review + static | review: ADR-006/ADR-040 headers, register rows, phase-plan §9 (QA checklist §5). Static, `inventory-security` → `changelog` (two files, F-13: the contract-level `contracts/openapi/CHANGELOG.md` has a heading containing `1.0.0` and that entry names the phase change log `docs/phases/P02/architecture/contract-changelog.md`; the phase change log exists at that path, convention §6-7. The rule takes the file texts as input, so the negative needs no file on disk); `xPhaseSet` (every `x-phase` ∈ {P04, P06, P07, P11}) | `[]` | N-21, N-23 |
| AC-P02-14 | Must | review | QA reads `decisions.md` §2/§3 | every row `DELEGATED-DEFAULT`, options, reason, reference | — |
| AC-P02-15 | Must | review | QA reads the contract and P02 docs against TECHNICAL-SPEC §3.2 X1–X11; the path-token part is automated by AC-P02-03 `excludedTokens` | no excluded feature | — (N-03 covers the path tokens) |
| AC-P02-16 | Must | handoff / gate | `python3 scripts/phase-handoff-check.py --phase P02 --role <role> --worktree .` (each step), `--gate` at the gate; `python3 scripts/check-blueprint.py`; every `suite.cmd` line exit 0; `git diff --name-only main...HEAD -- docs/source backend frontend` empty | `RESULT PASS`, exit 0, empty diff | — |
| AC-P02-17 | Should | tool | `types-diff` → `conformance`: for every named example (`components/examples` and media-type `examples`) whose media type schema is a direct `$ref` to `components/schemas/X`, write `export const e<N> = (<example JSON>) satisfies components["schemas"]["X"];` to `.work/conformance.ts` (sorted, deterministic) and compile it with the AC-P02-10 `tsconfig.json`. Examples without a direct schema ref are counted and logged, not skipped silently. `readme` (`tests/contract/README.md` contains `npm run mock`, `Prefer: code=`, `REDOCLY_TELEMETRY`) | tsc exit 0; readme `[]` | N-22 |

## 4. Negative mutation catalogue

One mutation per defect class. Each is applied to a clone of the parsed contract (helper `mutate`, §2.2) and must make the named check fail. "Tool" mutations are written to a temp file. N-23 is the exception: it mutates an in-memory copy of the `CHANGELOG.md` text, not the contract.

| ID | AC | Mutation | Must fail |
|---|---|---|---|
| N-01 | 02 | delete `operationId` of `getResume` | `redocly lint` exit ≠ 0, rule `operation-operationId` in output |
| N-02 | 02 | in the `getResume` 200 example set `document.templateId` to `"T9"` | `redocly lint` exit ≠ 0, rule `no-invalid-media-type-examples` |
| N-03 | 03 | add `POST /resumes/{resumeId}/pdf` (`operationId: exportPdf`, copy of any valid op) | `inventory` (extra op) **and** `excludedTokens` (`pdf`); both asserted separately |
| N-04 | 03 | delete `getSnapshot` | `inventory` (missing op) |
| N-05 | 04 | add `version: {type: integer}` to `ResumeDocument.properties` | `requestClosure` (forbidden `version`) |
| N-06 | 04 | delete `additionalProperties` from `Entry` | `documentClosure` and `requestClosure` name `Entry` |
| N-07 | 05 | add `value: {type: string}` to `ValidationIssue.properties` | `noEcho` |
| N-08 | 05 | change one 404 of `getResume` (after resolving its `$ref`, inline the copy) to media type `application/json` | `problemResponses` names `getResume` 404 |
| N-09 | 06 | remove `csrfHeader` from every security alternative of `replaceResumeDocument` | `csrfOnUnsafe` |
| N-10 | 06 | set `listResumes.security = []` | `anonAllowList` (10 ≠ 9; the message names the extra `listResumes`) and `inventory` (security) |
| N-11 | 07 | set `If-Match` `required: false` on `replaceResumeDocument` (inline the parameter if it is a shared `$ref`) | `ifMatch` |
| N-12 | 07 | delete response 422 from `createResume` | `idempotencyKey` |
| N-13 | 08 | set `limit.maximum` of `listResumes` to 500 | `pagination` |
| N-14 | 08 | delete the `Cache-Control` header from the `getResume` 200 response | `noStore` names `getResume` |
| N-15 | 09 | delete the 200 example(s) of `getResume` | `successExamples` names `getResume` |
| N-16 | 10 | replace one `$ref` in `Resume` with `#/components/schemas/DoesNotExist` | `openapi-typescript` exit ≠ 0 |
| N-17 | 11 | text replace of the `openapi: 3.1.0` line with `openapi: 9.9.9` | reader reports ≥ 1 error, app exits 1 if not |
| N-18 | 11 (Should) | text replace of one `$ref` target with a missing name | record whether the pinned reader reports it as an error; if it only warns, record that (AC-P02-11 is met by N-17, the criterion says "or") |
| N-19 | 12 | base = real contract, revision = clone without `getResume` | oasdiff exit ≠ 0 and `ERR` in output |
| N-20 | 12 (Should) | revision adds a required property to `ReauthenticateRequest` | oasdiff exit ≠ 0 |
| N-21 | 13 | set `x-phase` of `getLiveness` to `P05` | `xPhaseSet` (and `inventory`) |
| N-22 | 17 | in the `getResume` example set `version` to the string `"1"` | conformance `tsc` exit ≠ 0 |
| N-23 | 13 | in-memory copy of the `contracts/openapi/CHANGELOG.md` text with the `1.0.0` heading line removed | `changelog` names `CHANGELOG.md` and `1.0.0` |
| N-24 | 04 | add `id: {$ref: '#/components/schemas/Uuid'}` to `ResumeDocument.properties` (DD-P02-28: `ResumeDocument` is not one of the seven client-owned entity schemas) | `requestClosure` names `ResumeDocument` and `id` |
| N-25 | 02 | append a second server `{url: /api/v2}` to `servers` (the first entry, with its `description`, unchanged) | `rootFields` names `servers` |
| N-26 | 09 | in the inline `signUp` request-body example set the e-mail address to `someone@gmail.com` (review M-2) | `exampleEmails` names `signUp` request and `gmail.com` |

N-05 and N-24 together pin the DD-P02-28 boundary: a forbidden name fails at any depth, and `id` fails outside the seven named schemas. N-25 proves that the relaxed `servers` rule (F-15) still fails; the real contract's `description` is the positive case.

A negative whose mutation target is missing throws (§2.2-6) and fails; it is never counted as a pass. A negative whose check returns `[]` fails the test ("check cannot fail").

## 5. Review items and QA checklist (no executable test in the budget)

| AC | QA verifies | Evidence |
|---|---|---|
| AC-P02-01 | kickoff §2 roles table (Contract Architect yes, no developer dispatch), §3 budget, §4 slices, §5 decisions | quote section headings in `qa-report.md` |
| AC-P02-13 (doc part) | `docs/blueprint/decisions/ADR-006-*.md` and `ADR-040-*.md`: Status Accepted, Decider "Solution Architect (delegated, ADR-035)", Date, Source IDs, template sections; `DECISION-REGISTER.md` ADR-006 `FIXED` + link, ADR-040 `ACCEPTED` + link; phase-plan §9.1–§9.4 rows P04…P14 | `grep -n "Status\|Decider\|Date" docs/blueprint/decisions/ADR-006-*.md docs/blueprint/decisions/ADR-040-*.md`; `grep -n "ADR-006\|ADR-040" docs/blueprint/DECISION-REGISTER.md` |
| AC-P02-14 | `decisions.md` §2 rows DD-P02-01…28 each with `DELEGATED-DEFAULT`, options, reason, ADR/doc; §3 "No OPEN or SOURCE-OPEN item blocks P02" | `grep -c DELEGATED-DEFAULT docs/phases/P02/decisions.md` |
| AC-P02-15 | no operation, schema or description offering X1–X11 or server PDF/TXT/DOCX | `grep -niE "pdf|docx|txt|import|share|publish|suggest|score|payment|template" contracts/openapi/openapi.yaml` and read each hit (hits in descriptions that state the exclusion are fine) |
| AC-P02-16 | handoff check per step and `--gate`; `check-blueprint`; suite green; protected paths unchanged | command outputs in `qa-report.md` |

S-1 (optional Should, phase-plan §8.3, risk R-01): a `schemas` rule that no forbidden 3.1 construct is used (`if`/`then`/`else`, `$dynamicRef`, `patternProperties`, `unevaluatedProperties`, `prefixItems`, `webhooks`, `callbacks`, `links`, `allOf` inside a request closure). Cut first if the line budget is exceeded; no AC depends on it.

## 6. Conventions the checks rely on (input to the Contract Architect)

These are representation choices inside phase-plan §5–§8 that a machine check has to parse. They add no semantics.

1. **Fixed header values** are documented as a response header whose schema has `const: <value>` (a one-value `enum` is also accepted): `Cache-Control` `no-store`, `Cache-Control` `private, no-cache`, `X-Content-Type-Options` `nosniff`. A value only in prose is not detected.
2. **Header names** in parameters and response headers use the canonical spelling `If-Match`, `Idempotency-Key`, `ETag`, `Retry-After`, `Cache-Control`, `X-Content-Type-Options`, `Location`; the checks compare case-insensitively.
3. **Nullable references** use `oneOf: [{$ref: …}, {type: "null"}]` (or `anyOf`); nullable scalars use type arrays (phase-plan §8.3).
4. **Shared parameters and responses** may be `$ref`s to `components/parameters` and `components/responses`; the checks resolve them. A shared `If-Match` or `Idempotency-Key` parameter carries `required: true` itself.
5. **The request-hash rule** (§7.5) is stated in the description of the `Idempotency-Key` parameter (incl. "SHA-256" and "RFC 8785") and the `file`-part rule in the `uploadPhoto` description.
6. **Examples** for `getResume` 200 and `listResumes` 200 exist as media-type `example` or `examples` (Prism returns the first one); the email domain rule applies to every example string.
7. **Two change logs** (PD-P02-04, phase-plan §9.1 step 2). `contracts/openapi/CHANGELOG.md` has a Markdown heading containing `1.0.0` (for example `## 1.0.0 — 2026-11-02`), and that entry names the phase change log. The phase change log with the breaking-change analysis is `docs/phases/P02/architecture/contract-changelog.md` (later phases: `docs/phases/<Pxx>/architecture/contract-changelog.md`). It is not in `decisions.md` or `implementation/`.
8. **Security representation** (phase-plan §5 column key): `none` = `[]`; `optional` (`getSession`) = `[{}, {sessionCookie: []}]`; `anon+csrf` = `[{csrfHeader: []}]`; `session` = `[{sessionCookie: []}]`; `session+csrf` = `[{sessionCookie: [], csrfHeader: []}]`. The order of alternatives does not matter to the checks. "Anonymous" therefore means "not every alternative contains `sessionCookie`" (AC-P02-06 `anonAllowList`). The `anon+csrf` operations are anonymous although their security list is not empty and has no `{}`.

## 7. Commands (`../tests/suite.cmd`, run by the handoff check with `bash -lc` from the repository root)

```
npm ci --prefix tests/contract --no-audit --no-fund --prefer-offline
npm test --prefix tests/contract
DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1 dotnet run tests/contract/dotnet/ContractReader.cs -- contracts/openapi/openapi.yaml
```

- `package.json` script `test` = `node --test --test-concurrency=1 checks/` (the Test Engineer confirms the exact directory/glob form that Node 24 accepts and records it). Script `mock` = `prism mock ../../contracts/openapi/openapi.yaml -h 127.0.0.1 -p 4010` (documented in the README; not part of the suite).
- `--no-audit` keeps the lockfile from being sent to the registry's audit service during the suite (NFR-09 spirit; P03-OBL-02 does dependency scanning in CI).
- Exact forms of the tool CLIs (`redocly bundle --output`, `redocly lint --config`, `openapi-typescript -o`, `prism mock -h -p`, `oasdiff breaking --fail-on`, `dotnet run <file>.cs --`) must be confirmed against the pinned versions' `--help`; a differing flag is adapted and recorded in `test-results.md`, not worked around with another tool.
- Narrow runs during development: `node --test tests/contract/checks/<module>.test.mjs`.

## 8. Environment, offline operation and fallbacks

| Prerequisite | Version | Needed by | Present on the P02 machine (2026-11-02) |
|---|---|---|---|
| Node.js + npm | 24 LTS (≥ 24.18 for Prism, kickoff §3), npm 11 | commands 1–2 | `node v24.22.2`, `npm 11.19.1` |
| .NET SDK | 10.0.x (file-based `dotnet run`) | command 3 | `10.0.301` |
| Docker engine | any current; image pulled by digest | AC-P02-12 | `29.6.1` |
| git with a local `main` ref | — | AC-P02-10 hygiene, AC-P02-12 baseline | `2.47.3` |

Network is needed only for the first `npm ci`, the first NuGet restore of the `#:package` and the first image pull (kickoff §3). After that the suite runs offline:

- **npm:** `--prefer-offline` uses the npm cache; a cold cache without registry access fails command 1 (no fallback install path).
- **NuGet:** the package resolves from `~/.nuget/packages` after one restore.
- **oasdiff:** pre-pull `docker pull tufin/oasdiff@sha256:82b1840a77335562bb11ce95f77ad31745a0c6f3a770929333ed1c5ef466e400`; for an air-gapped machine `docker save`/`docker load` of that digest. The check runs the container with `--network none`, so it cannot reach any service.
- **Telemetry:** the helper's child environment sets `REDOCLY_TELEMETRY=off` (ADR-040) and, if the pinned Redocly version documents it, the update-notice switch; .NET uses `DOTNET_CLI_TELEMETRY_OPTOUT=1`; oasdiff is isolated by `--network none` (its own opt-out, if the pinned version has one, is added and documented, F-09). Prism and openapi-typescript make no network calls with a local file input. The README lists each switch (AC-P02-17).
- **A missing tool is a failure, not a skip.** The test fails with `ENV_MISSING: <tool>`; there is no alternative binary within ADR-040. QA records it as an environment stop (PHASE.md stop conditions); only a documented approved exception from the Solution Architect could change that.

## 9. Findings for the Solution Architect

None blocks step 4 or step 5. Each row states how this plan resolves it; the Solution Architect may confirm the default in `decisions.md` or change the criterion (the Test Engineer then follows the change).

| ID | AC | Finding | Default used by this plan |
|---|---|---|---|
| F-01 | AC-P02-07 | "every versioned write documents an `ETag`" includes `purgeResume` (21), whose success is 204 for a deleted resource (phase-plan §5.4 lists no `ETag` there) | `ETag` required on ops 17 (200), 16 (201), 18–20, 25–27; op 21 exempt |
| F-02 | AC-P02-09 | "every operation has at least one success example" cannot hold for operations whose only success is bodiless (4–6, 8–13, 21, 30); "shared error response" is not defined | requirement applies to every 2xx **with content**; "shared" = entries of `components/responses` |
| F-03 | AC-P02-07 | "the contract describes the request-hash rule" is prose; a check can only see that it is stated | keyword check (§6-5); correctness of the wording is a Code Reviewer item |
| F-04 | AC-P02-09 | Prism bodies "validate against `ResumePage` and `Resume`" needs a JSON Schema validator, which the budget excludes as a direct dependency | body deep-equal to the contract example + lint's `no-invalid-media-type-examples` on that example (transitive validation); direct validation starts with P04 drift test (c) |
| F-05 | AC-P02-11 | In `Microsoft.OpenApi` 2.x (the line ASP.NET Core 10 uses) YAML reading may live in the companion package `Microsoft.OpenApi.YamlReader`; kickoff §3 names one `#:package` | if the pinned version needs it, allow a second `#:package` for `Microsoft.OpenApi.YamlReader` at the **identical** version; the Test Engineer pins both from the `Microsoft.AspNetCore.OpenApi` 10.0.x dependency list and records it |
| F-06 | AC-P02-08 | "documents `Cache-Control: no-store`" has no defined representation | convention §6-1 (`const`) |
| F-07 | AC-P02-04 | "`required` (every `ResumeDocument` property)" is read together with phase-plan §6.1 ("every nested object too … every property is required") | every object in the `ResumeDocument` closure has `required` = all its properties |
| F-08 | AC-P02-12 | "it reports 'first version'": oasdiff itself has no such mode | the check prints the message when `main` has no contract |
| F-09 | ADR-040 security impact | the oasdiff telemetry opt-out is not named in ADR-040 | `--network none` makes it irrelevant; a documented flag is added if the pinned version has one |
| F-10 | AC-P02-06 | Revision 1 defined anonymous as "effective security is `[]` or contains `{}`". With the phase-plan §5 representation of `anon+csrf` (`[{csrfHeader: []}]`) that rule finds only 3 operations, not 9 (contract-changelog §6-1). This was a test-plan error, not a contract defect | anonymous = security `[]` or at least one alternative without `sessionCookie` (§3, §6-8); the result is compared with the 9 names of §7.1 |
| F-11 | AC-P02-09 | Prism 5.16.0 serves the paths at the root; `/api/v1/...` gives 404 `NO_PATH_MATCHED_ERROR` (contract-changelog §6-3). RT-4 left this open in revision 1 | the helper sends mock requests to root paths; the README documents it. `servers` stays one entry with `url` `/api/v1` (AC-P02-02, F-15) |
| F-12 | AC-P02-09 | Prism answers a missing `If-Match` with the operation's 422 example (`idempotency_key_reused`), not the 428 the server returns (contract-changelog §6-2) | the live check asserts 4xx and not 2xx (the AC wording), plus a 200 control request with `If-Match`; 428 is checked by the static `ifMatch` rule (AC-P02-07) and by the P07 drift tests |
| F-13 | AC-P02-13 | the AC names only `contracts/openapi/CHANGELOG.md`; the breaking-change analysis is in `architecture/contract-changelog.md` (PD-P02-04) | `changelog` checks the 1.0.0 entry, its reference to the phase change log, and that this file exists (§3, §6-7) |
| F-14 | AC-P02-04 | Revision 2 forbade `id` at any depth of a request closure. The Test Engineer step found 14 violations: the client-owned `id` of `ContactItem`, `TextSection`, `InlineSection`, `ListSection`, `EntriesSection`, `ListItem`, `Entry`, reached through `createResume` and `replaceResumeDocument` (`test-results.md`, finding 2). These IDs are required by phase-plan §6.1 and domain-model §4. This was a test-plan error, not a contract defect | **Resolved by DD-P02-28** (`DELEGATED-DEFAULT`, Solution Architect; no contract change): the rule in §3 copies the phase-plan §6.2 wording; AC-P02-04 was amended accordingly. Negative N-24 |
| F-15 | AC-P02-02 | Revision 2 required `servers` = `[{url: /api/v1}]` exactly. The contract's single server also has `description: "Same-origin API base path."`, so `rootFields` failed (`test-results.md`, finding 1). AC-P02-02 itself does not forbid a description | **Note: Program Coordinator `DELEGATED-DEFAULT` (2026-11-02, dispatch of plan rev 3), no contract change:** exactly one server, `servers[0].url` = `/api/v1`; a `description` (or any other server-object field) is allowed and not checked. Negative N-25 |

## 10. Risks (tests)

| ID | Risk | Mitigation |
|---|---|---|
| RT-1 | Vacuous negative (mutation target missing, check passes trivially) | `mutate` throws on missing target; each negative asserts a message naming the item |
| RT-2 | Prism start-up flakiness | free port, `127.0.0.1`, readiness poll with 60 s limit, no retries, kill in `after()`; a timeout fails |
| RT-3 | Docker or the image unavailable offline | pre-pull by digest, `docker load` fallback; failure is `ENV_MISSING`, never skipped |
| RT-4 | Tool behaviour differs from this plan (CLI flags, Prism base-path routing, reader diagnostics) | confirm against the pinned versions; record the adapted form in `test-results.md` and `README.md`. Prism routing is settled: paths at the root (F-11); missing `If-Match` gives 422 (F-12). Both are asserted as 4xx/root-path behaviour, so a later Prism change fails a test visibly instead of passing silently |
| RT-5 | Checks drift from the contract on later phases | the §5 inventory and §6 constraint tables are data at the top of their modules; phase-plan §9.1 step 3 moves them with the contract |
| RT-6 | Hidden dependency on transitive packages (js-yaml, ajv) | forbidden (§1); YAML via `redocly bundle` |
| RT-7 | Suite time at every handoff (npm ci + Prism + Docker) | acceptable; `--prefer-offline`, one Prism and two short oasdiff runs per suite |

## 11. Handoff

- Next owner: Test Engineer (step 5). The contract v1.0.0 is frozen (step 4 done; `../architecture/contract-changelog.md`). The Test Engineer implements §2–§4 and §7 and records each positive and negative result in `test-results.md` (red section) with exact commands and exit codes.
- Open questions: F-01…F-13 (defaults applied; none blocking). F-14 and F-15 are resolved (DD-P02-28; coordinator delegated default).
- After revision 3 the Test Engineer updates `rootFields` and `requestClosure` to §3, adds N-24 and N-25 (§4), reruns the three `suite.cmd` commands and records the results. No contract change is needed.
