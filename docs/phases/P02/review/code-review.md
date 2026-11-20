# Code Review — P02 API Contract v1

- Reviewer: Code Reviewer (Orca worker, task `task_3f350b40f8b9`, dispatch `ctx_94e868a86ddf`), 2026-11-02. One pass (ADR-035 B-2).
- Target: `phase/P02` against `main` (commits `62ec606`…`64675b4`), 33 changed files.
- Inputs read: `PHASE.md`, `kickoff.md`, `architecture/phase-plan.md`, `architecture/contract-changelog.md`, `decisions.md` (PD-P02-01…06, DD-P02-01…28), `acceptance-criteria.md`, `tests/test-plan.md` (rev 3), `tests/test-results.md`, `contracts/openapi/{openapi.yaml,CHANGELOG.md,README.md}`, `tests/contract/**`, ADR-006, ADR-036, ADR-037, ADR-038, ADR-040, `DECISION-REGISTER.md` diff, TECHNICAL-SPEC §3–§5, §10–§12, `.claude/rules/*`, skills `phase-code-review` and `api-contract-first`.

Verdict: PASS

There are no blocker or critical findings. Two major findings need an owner and a decision before the gate (M-1 is a one-line, documentation-only contract fix); the rest are minor or informational follow-ups.

## 1. Suite evidence (run by the reviewer)

The three commands of `docs/phases/P02/tests/suite.cmd` were run from the repository root, one after another, each with its own log:

| # | Command | Exit | Observed |
|---|---|---:|---|
| 1 | `npm ci --prefix tests/contract --no-audit --no-fund --prefer-offline` | 0 | installed from the lockfile; npm warns about the transitive `@scarf/scarf` postinstall script, which npm did **not** run (see i-8) |
| 2 | `npm test --prefix tests/contract` | 0 | `tests 65, pass 65, fail 0, cancelled 0, skipped 0, todo 0`; Redocly lint valid; `TypeScript conformance: 287 direct examples, 4 indirect/binary`; `Prism: GETs 200, missing If-Match 422, control PUT 200`; `oasdiff: first version (no baseline on main)`, self-diff `No changes detected`; N-16 exit 1, N-19 `api removed without deprecation`, N-20 exit 1 |
| 3 | `DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1 dotnet run tests/contract/dotnet/ContractReader.cs -- contracts/openapi/openapi.yaml` | 0 | `spec=OpenApi3_1 paths=26 errors=0 warnings=0`; N-17 `OpenAPI specification version '9.9.9' is not supported`; N-18 4 warnings, exit 0 (Should, recorded) |

Also run: `REDOCLY_TELEMETRY=off tests/contract/node_modules/.bin/redocly lint contracts/openapi/openapi.yaml --config tests/contract/redocly.yaml` gave "Your API description is valid" with `recommended-strict`, so there are no warnings either. Environment: the P02 worktree on Linux with the toolchain recorded in `test-results.md` (Node 24.22.2, .NET SDK 10.0.301, Docker with the digest-pinned oasdiff image). The working tree was clean before and after (`git status --short` empty; `.work/` is ignored).

Reviewer probes (scratch scripts in `/tmp/p02rev/`, not committed): (a) counted inline request-body examples in the bundled contract: 11, four of them with e-mail addresses, all `example.com`; (b) re-ran the suite's `exampleEmails` function on a copy whose `signUp` request example uses `someone@gmail.com`: it found **no** violation (finding M-2).

## 2. Scope

`git diff --name-only main...HEAD` lists only paths under the phase-plan `## Allowed paths`: `docs/phases/P02/`, `docs/blueprint/decisions/` (ADR-006, ADR-040), `docs/blueprint/DECISION-REGISTER.md`, `contracts/openapi/`, `tests/contract/`. Nothing changed in `docs/source/**`, `backend/**`, `frontend/**`, `scripts/`, `.claude/`, `CLAUDE.md` or `docker-compose.yml`. No generated file is tracked (`git ls-files tests/contract/.work` is empty; the hygiene check passes). The register diff changes only the ADR-006 and ADR-040 rows, with links. Scope is clean.

## 3. Findings

Severity scale: blocker / critical (block the gate) · major (fix or explicitly accept before the gate, or route with an owner) · minor (follow-up) · info.

### Major

| ID | File / line | Finding | Impact | Required action | Owner |
|---|---|---|---|---|---|
| M-1 | `contracts/openapi/openapi.yaml:1448` (`components.securitySchemes.sessionCookie.description`) | The canonical contract states the session cookie is `SameSite=Lax` and cites ADR-036. ADR-036 §3 and §4, threat model T-SP-03 and T-TA-05, and ADR-003 all say **`SameSite=Strict`**. The contract change log (§3, §7 "no semantic deviation") does not record a deviation, and no decision changes the ADR. This is an unrecorded conflict between the contract and an accepted ADR on a security control (CLAUDE.md: "do not reconcile silently"). | CSRF defence in depth. The `X-XSRF-TOKEN` header still guards every unsafe method, so this is not exploitable on its own. But P04/P06 developers read the contract as the source of truth, and Lax would also send the cookie on cross-site top-level GET navigations (for example `exportAccountData`). | Change the description to `SameSite=Strict`. This is a documentation-only edit; v1.0.0 has no baseline yet, so it stays 1.0.0 with a CHANGELOG line. The alternative is a recorded `DELEGATED-DEFAULT` that amends ADR-036 with a reason. Preferred: a Contract Architect fix before the gate; the re-review then covers only that line. If deferred, add it as an obligation of P06 (BE-P02-09 / BE-P02-06 already cite ADR-036 §3). | Contract Architect (or Solution Architect if Lax is wanted) |
| M-2 | `tests/contract/checks/mock-examples.test.mjs` (`exampleEmails`) | AC-P02-09 requires that **all** e-mail examples use `example.com`, `example.org` or `.invalid`. The check scans `components/examples`, response media-type examples and top-level schema `examples`/`default`. It does **not** scan inline request-body examples (`requestBody.content.*.example`; 11 of them, 4 with addresses: `signUp`, `resendVerification`, `login`, `requestPasswordReset`), parameter examples or nested property `examples`. Probe (b): a `gmail.com` address in the `signUp` request example passes the check. | The real contract complies today: the reviewer checked every address by grep, and all are `example.com`. But the automated part of a Must criterion, which guards DD-P02-23 data minimisation, is narrower than the criterion, so a regression in a request example would not be caught. | Extend `exampleEmails` to request-body and parameter examples, and to schema `examples` at any depth (via `walk`). Add one negative mutation: a `gmail.com` address in the `signUp` request example. Within budget, this is about three lines. Do it now or in the first P04 contract-suite step; record the choice. | Test Engineer |

### Minor

| ID | File / line | Finding | Required action | Owner |
|---|---|---|---|---|
| m-1 | `tests/contract/checks/schemas.test.mjs` (`names`, `constraintRows`) | The data tables do not cover every §6.1/§6.3 constraint that AC-P02-04 names ("lengths, ranges, enums"). Missing: `ContactItem.kind` enum, `ListColumns` `[1,2,null]`, `Placement` `[main,sidebar,null]`, `LayoutSettings.bodyFont` pattern, `CreateSnapshotRequest.reason` const, `PhotoInfo.mime` and `SnapshotSummary.reason` enums. `namedSchemas` omits `ListItem`, which is covered only indirectly through `requestClosure`. The reviewer checked each value in the contract by hand, and all match phase-plan §6. | Add the rows. It is data only, with no new module. | Test Engineer (next contract-suite step, latest P04) |
| m-2 | `contracts/openapi/openapi.yaml` `RichText`, `RichTextInline`, `Paragraph.inlines`, `BulletList.items`, `Link.children` | The rich-text arrays have no `maxItems`. Only the 1 MB body, nesting depth 64 and R-12 (≤ 50 000 code points of text) bound them. `LineBreak` objects and empty paragraphs or bullets carry no text, so R-12 does not count them: a 1 MB document can hold tens of thousands of them. The risk is limited to the owner (owner-scoped data), but the layout engine and the server validator have to handle it. Adding `maxItems` later counts as a "tightened request constraint", which §9.2 classes as **breaking**. | Decide in P07 (domain validation) or P09 (rich text): either a server-side structural rule documented in the `ResumeDocument` description (non-breaking), or array caps added through the pre-release breaking procedure of §9.3. | Solution Architect P07/P09 |
| m-3 | `docs/phases/P02/tests/test-results.md` | Line 3 still holds the template text "No tests executed yet". The "Concurrent-scope checkpoint" subsection (round 1, handoff `RESULT FAIL`) comes after the round-2 table, which reports `RESULT PASS`, and it does not say it was superseded. A reader may take the last handoff result as the current one. | Append a one-line note that the checkpoint belongs to round 1 and was superseded by the round-2 handoff PASS. Do not rewrite recorded evidence. The template line can stay or be struck through. | Test Engineer or QA (records only) |
| m-4 | ADR-037 "Consequences" (line 57) vs. P02 suite | ADR-037 says "P02 … adds a contract test: a document write that reuses a key with a different body returns 422". P02 checks this only declaratively: 422 must be declared (N-12), and the hash rule must be described (`hashRule`). That is the most a stateless mock allows (Prism, F-12). The behavioural test is P07's (ADR-037 line 58, BE-P02-11). The narrower reading is not recorded. | Record it in the QA report or `decisions.md`: the P02 contract test is static and the behavioural 422 test is P07 BE-P02-11. Records only. | QA / Solution Architect |
| m-5 | `docs/phases/P02/implementation/frontend-tasks.md` FE-P02-07, FE-P02-08 | Photo writes (upload, crop, remove), trash and restore increment the same resume `version` as document writes (§7.4). The autosave task says "one in flight" only for `replaceResumeDocument`. If a photo write runs while an autosave PUT holds the old ETag, the user's own tab gets a 412 and a needless conflict copy. | P08 plan: every versioned write of one resume goes through one serial per-resume queue, and the held ETag is updated from `PhotoWriteResult.version` / `ResumeState.version`. Add a test for "photo upload during autosave → no 412". | Solution Architect P08 |

### Info

| ID | Note |
|---|---|
| i-1 | `lint.test.mjs` logs `lint: exit 0` because its summary regex does not match the Redocly 2.72.1 output ("Your API description is valid"). This is cosmetic. With `recommended-strict`, every rule is an error, so no warning can be hidden. |
| i-2 | `hashRule` is a keyword check (`SHA-256`, `8785`, `file`), as test-plan F-03 intends. It cannot verify semantics; BE-P02-11 in P07 tests the behaviour, including the multipart new-boundary replay. |
| i-3 | The pinned `Microsoft.OpenApi` 2.12.2 reader only warns on a dangling `$ref` (N-18). Dangling references are still caught by Redocly lint and openapi-typescript (N-16), so AC-P02-11 is met through N-17. The reader does not compile the `pattern` regexes; .NET compatibility of the patterns (phase-plan §8.3) is first exercised by the P04 response-validation helper (BE-P02-04). |
| i-4 | The 401 responses do not declare `WWW-Authenticate` (RFC 9110 says a 401 must carry it). This is common for cookie-session SPAs. P04 may emit a fixed value; documenting it would be an additive header. |
| i-5 | The example persona "Alex Sample" (`alex.sample@example.com`, "Example Corp", "Sample Labs") is invented. It shares only a first name with the fictional reference persona "Alex Testerson", and none of the reference CV text is reused. DD-P02-23 is satisfied. |
| i-6 | `ClientEvent.code` (`^[a-z0-9_.-]{1,64}$`) is constrained but could still carry encoded data from a malicious client. The endpoint is authenticated and rate-limited, and the data would be the caller's own. P11 should log only allow-listed codes. |
| i-7 | `createSnapshot` has no `If-Match`, so the snapshot is of the server's *current* version. In P12 the client should compare `SnapshotSummary.resumeVersion` with the version it exported. |
| i-8 | `@scarf/scarf` is an install-time analytics package. npm 11 did not run its postinstall script. P03 dependency scanning (P03-OBL-02) and CI should keep install scripts disabled and not approve this package. |
| i-9 | The coordinator gate TODO is still open (PD-P02-05, kickoff §6): update `CLAUDE.md` ("Still open … ADR-006/ADR-040 (P02)", "Commands" with the P02 suite command) and `docs/blueprint/ARCHITECTURE.md` §4/§9. These files are outside the reviewer's scope. |

## 4. Review checklist results

### 4.1 Contract completeness vs TECHNICAL-SPEC

I checked every FR group in TECHNICAL-SPEC §5 against the contract:

- **FR-ACC.**
  - 01/02: sign-up, verify, resend, login, logout, reset request/confirm, with `getSession.emailVerified` for the D-01 export gate.
  - 03: `requestAccountDeletion`, re-auth, 202, purge ≤ 24 h.
  - 04: `exportAccountData`, plus photo masters through `getPhotoMaster`; the browser adds PDF/TXT (ADR-039 §6).
  - 05: Google is excluded by ADR-014.
  - 06: guest claim through `createResume` + `uploadPhoto` (ADR-015).
- **FR-LIB.**
  - 01: `listResumes`, `updatedAt` desc, cursor. Thumbnails are client-side; a batched endpoint is routed to P11.
  - 02: blank (client-built) and copy, photo included.
  - 03: title ≤ 150 through the single write path.
  - 04: trash, restore, purge, `state=trashed`, `purgeAt`.
  - 05: `getResume`.
  - 06: client-side.
- **FR-EDT-06:** durable 2xx + `ETag`.
- **FR-HDR-01…06:** `Header`, `ContactItem` with `url` null = auto-link, `kind`, `showPhoto`.
- **FR-SEC-01…11:** any section set, order = array order, `hidden`, `listColumns`, `placement`. Duplicate is client-side.
- **FR-TYP-01…03:** four types, `PartialDate`/`EndDate`, inverted ranges reported as warnings.
- **FR-RTE-01…03, 06:** the AST with marks, one list level, links, `lineBreak`. FR-RTE-07 (won't) is correctly absent.
- **FR-TPL-01/03/05, FR-CLR-01, FR-LAY-01…10:** `templateId` T1–T3, `accentPreset` 0–2, `LayoutSettings` with the FR-LAY-06 margins 10–50 pt, `bodyFont`, `language`, `dateFormat`.
- **FR-PER-01…03, 05:** If-Match/ETag/Idempotency-Key, conflict copy, snapshots with `expiresAt`. FR-PER-04 is client-only.
- **FR-PHO-01…05:** upload, replace, remove, square crop on the kept master, rendition, copy with the resume, `showPhoto`.
- **FR-PRV, FR-PDF, FR-TXT:** no endpoint, per ADR-010.
- **NFR-08/09/10/12/13:** covered. NFR-12: sections 100, entries 100, 200 resumes → 409, R-12 50 000.

All 30 operations of phase-plan §5 exist with the specified method, path, `operationId`, `x-phase`, policy and security; the `inventory` check gives exact equality. Deviations from §10.1 (photo on `Resume`, required-nullable fields, discriminated `end`, inline body = one paragraph) are recorded decisions (DD-P02-04, DD-P02-05, §7.9, domain-model R-3).

Result: no missing resource or operation.

### 4.2 Exclusions

- The path tokens are automated (N-03).
- A grep of the contract for `pdf|docx|txt|import|share|publish|suggest|score|payment|template|ai|google|guest` finds only exclusion statements, template-default notes and the guest-claim description.
- No server export, import, sharing, AI, score, payment, template catalogue, cover-letter or Google endpoint exists.

AC-P02-15 is met.

### 4.3 Auth, CSRF and ownership

- `sessionCookie` and `csrfHeader` are defined as specified.
- The anonymous set is exactly the 9 operations of §7.1.
- CSRF is required on every unsafe method, anonymous auth posts included, which closes login CSRF.
- Every protected operation declares 401, and every unsafe operation declares 403.
- Re-authentication with a 5-minute window applies to the three sensitive operations (ADR-036 §10). `email_not_verified` is enforced on export.
- Anti-enumeration: uniform 202 responses and one `invalid_credentials`.
- Ownership: 404 for other users' resources, the owner never taken from a body, and `copyPhotoFromResumeId`/`sourceResumeId` owner-scoped.

The only defect is the cookie attribute text (M-1).

### 4.4 Error envelope

- Every 4xx/5xx is `application/problem+json`, with `VersionMismatchProblem` on 412.
- Every operation has a `default` Problem response, and 429 has a required integer `Retry-After`.
- The code catalogue matches phase-plan §7.3.
- `Problem`, `ValidationIssue` and `VersionMismatchProblem` have no value or echo members, and 412 carries only `currentVersion`/`updatedAt`.
- Every shared error response has examples.

### 4.5 Concurrency and idempotency

- The strong ETag `"<n>"` has a pattern that rejects `*`, lists and weak tags (400).
- 428/412 are declared on operations 18–21 and 25–27.
- `Idempotency-Key` (uuid, required) and 422 are declared on 16, 18–21, 23 and 25–27.
- The 409 `idempotency_request_in_progress` with optional `Retry-After` is declared on **every** keyed operation (C-7). This is better than the §5 rows, which list it on fewer operations.
- The evaluation order puts replay before `If-Match`, as ADR-037 §3 requires (no false 412 on a retry).
- The hash rule (method + path + JCS body; `file` part for multipart) is a recorded refinement of ADR-037 (DD-P02-10).
- Replay semantics match ADR-037: the document write returns the stored version, and other keyed operations keep keys for 24 h.

Consumer follow-up: m-5.

### 4.6 Privacy

- All examples are fictional, with addresses only at `example.com`.
- No resume content appears in Problems, warnings or the 412 body.
- Client events are content-free by schema (enums, uuid, date-time, constrained codes).
- The words `ownerId`, `lastWrite`, `passwordHash` and `schemaVersion` appear nowhere in the contract.
- Passwords and tokens are `writeOnly`.
- `no-store` is set on every personal-data JSON response; photo GETs use `private, no-cache` + `nosniff`.
- The suite disables telemetry (Redocly, .NET), runs oasdiff with `--network none` and passes `--no-audit` to npm.

The automated check has a gap: M-2.

### 4.7 Breaking-change and extension process

- ADR-006 and ADR-040 have Status Accepted, Decider, Date, Source IDs and all template sections; the register rows link them.
- `CHANGELOG.md` has a 1.0.0 entry that names the phase change log.
- Phase-plan §9 defines the procedure, the change classes, the pre- and post-release breaking rules and the planned surfaces for P03–P14.
- oasdiff by digest is wired to the `main` baseline, with first-version handling, and is shown to fail on a removed operation and on a new required property.
- The rule that post-1.0 `ResumeDocument` additions are optional ("keep stored value") protects older tabs.

The DoD item "all P04–P14 API surfaces have planned extension process" is met.

### 4.8 Test quality

- The suite stays within the kickoff §3 budget: 6 modules + 1 helper, `node:test` only, only built-in imports, 4 pinned tools, one .NET file app, `suite.cmd` with 3 lines.
- Every Must criterion with a negative case has one. N-01…N-25 each mutate a clone and assert that the named item is reported, and a missing mutation target throws, so a negative cannot pass vacuously.
- The rev-3 relaxations (DD-P02-28 `id` allow-list, F-15 `servers`) are narrow and each is pinned by a new negative (N-24, N-25). The forbidden-name set was not reduced.
- I found no weakened assertion, skipped test or retry.
- Prism uses a free port, a bounded readiness wait and a control request. oasdiff is offline. The output is deterministic.

Gaps: M-2 and m-1 (coverage narrower than the criterion; the contract itself is correct).

### 4.9 Decisions

- `decisions.md` §2 rows DD-P02-01…28 each carry `DELEGATED-DEFAULT`, options, reason and reference.
- §3 shows that no OPEN or SOURCE-OPEN item blocks the contract.
- No PROPOSED item is treated as approved.

AC-P02-14 holds; the details are for QA to confirm.

## 5. Risks

- M-1 left open would put a weaker cookie attribute into the frozen v1 text that P04/P06 implement against.
- m-2: retrofitting caps on rich-text arrays later is a breaking change.
- R-02 (C# DTO drift) remains, by design, until the P04 drift tests (BE-P02-02…04) exist.

## 6. Next owner

Program Coordinator. Route M-1 to the Contract Architect (one-line doc fix before the gate, re-review limited to that line) or record the deferral. Route M-2 and m-1 to the Test Engineer (now or as a P04 obligation), and m-3/m-4 to QA. Then the QA / Acceptance step.

## 7. Delta re-review — fix loop 1 (cycle 1 of 2)

- Reviewer: Code Reviewer (Orca worker, task `task_36883e3ec501`, dispatch `ctx_e8deaf81e00b`), 2026-11-02. Per ADR-035 B-2 this covers only `git diff 8004341 HEAD` (commits `5b14a7f`, `dcba270`, `ce0380e`; 8 files).
- Files in the delta: `contracts/openapi/{openapi.yaml,CHANGELOG.md}`, `docs/phases/P02/architecture/contract-changelog.md`, `docs/phases/P02/coordinator-log.md`, `docs/phases/P02/tests/{test-plan.md,test-results.md}`, `tests/contract/checks/{mock-examples,schemas}.test.mjs`. All are inside the phase-plan `## Allowed paths`, and each commit stays within its role's scope (CA: `contracts/**` + `architecture/contract-changelog.md`; TE: `tests/contract/**` + `tests/test-results.md`; TA: `tests/test-plan.md`).

### 7.1 Suite evidence

| Command (repository root) | Exit | Observed |
|---|---:|---|
| `npm test --prefix tests/contract` | 0 | `tests 66, pass 66, fail 0, cancelled 0, skipped 0, todo 0`; `N-26: signUp/request/application/json/email email gmail.com`; `Prism: GETs 200, missing If-Match 422, control PUT 200`; `TypeScript conformance: 287 direct examples, 4 indirect/binary`; `oasdiff: first version (no baseline on main)`, self `No changes detected`; N-19/N-20 still fail as expected |
| `grep -rn "Lax\|SameSite" contracts/` | 0 | only `openapi.yaml:1448` (`SameSite=Strict`) and the `CHANGELOG.md:14` fix line, which names the old value |

Reviewer probes (scratch `/tmp/p02rev-delta/`, not committed): I loaded the committed `exampleEmails` function from the test file and ran it on clones of the contract with `a@gmail.com` planted in different places. It caught the address in the inline `login` request example, a nested component-schema property `examples`, a parameter `example` and a `components/examples` value. It missed the address in the `examples` of an inline schema declared directly under a media type and under a parameter (see m-6). On the real contract the function returns `[]`.

### 7.2 Status of the major findings

| ID | Status | Evidence |
|---|---|---|
| M-1 | **RESOLVED** | `openapi.yaml:1448` `sessionCookie.description` now says `SameSite=Strict`, matching ADR-036 §3/§4 and T-SP-03. No other `Lax` text remains in `contracts/**`. The change is description-only and `info.version` stays 1.0.0 (still no baseline on `main`). It is recorded in `contracts/openapi/CHANGELOG.md:14` and `architecture/contract-changelog.md` §8. The contract now matches the ADR, so no decision record is needed. Lint, TS conformance, the .NET reader path (unchanged schema) and the oasdiff self-diff stay green. |
| M-2 | **RESOLVED** | `exampleEmails` (`mock-examples.test.mjs`) now scans: `components/examples`; inline request-body media `example`/`examples`; response media `example`/`examples`; operation-level and path-level parameter examples (via `ops().parameters`); `components/parameters`; and `example`/`examples`/`default` at every depth of every component schema (via `walk`). The new negative N-26 (`someone@gmail.com` in the inline `signUp` request example, using `need` so the target cannot vanish silently) fails red before the scanner change (`test-results.md`, red proof row) and is detected after it. Test plan rev 4 adds the AC-P02-09 rule text and the N-26 row. The probes above confirm the four example locations the original finding listed. |

Bonus: m-1 is also **RESOLVED**. `constraintRows` now covers `ContactItem.kind`, `ListColumns`, `Placement`, `LayoutSettings.bodyFont`, `CreateSnapshotRequest.reason`, `PhotoInfo.mime` and `SnapshotSummary.reason`, and `namedSchemas` includes `ListItem`. These are data rows only, with no new module, and they pass against the contract. m-2…m-5 are untouched and keep their owners from §3.

### 7.3 New findings in the delta

There are no new blocker, critical or major findings.

| ID | Severity | File / line | Finding | Required action | Owner |
|---|---|---|---|---|---|
| m-6 | minor | `tests/contract/checks/mock-examples.test.mjs` (`exampleEmails`) | The schema walk starts only from `components.schemas`. It skips schemas declared inline under a parameter (`parameters[].schema`) or a media type (`content.*.schema`) when they are not a `$ref`. Probe: an address planted in such a schema's `examples` is missed. Also, `walk` does not descend into `prefixItems`, `not` or `if/then/else`. Today the real contract has 3 example/default nodes in inline schemas, none of which contains `@`, so AC-P02-09 is met and test plan rev 4's "schema examples at any depth" is met for component schemas. | Also call `walk` on each non-`$ref` `p.schema` and `media.schema` inside the existing loops (two lines), and add a negative if wanted. This can wait for the first P04 contract-suite step; record it as a P04 obligation. | Test Engineer |
| i-10 | info | `docs/phases/P02/tests/test-results.md` (fix-loop section) | The TE handoff row records `RESULT FAIL` only on `ROLE_SCOPE`, caused by the parallel Contract Architect edits in the shared worktree (escalation `msg_e1a65f73b15a`). Those edits are now committed separately (`5b14a7f`), so the FAIL is a concurrency artefact and not a defect. This is the same reading as m-3. | QA may note it next to m-3. Records only. | QA |

### 7.4 Re-review verdict

M-1 and M-2 are resolved, the suite passes 66/66 with exit 0, and the delta introduces no blocker, critical or major finding. Next owner: Program Coordinator, then the QA / Acceptance step. Route m-6 to the Test Engineer as a P04 obligation, together with the open m-2…m-5.

Verdict: PASS
