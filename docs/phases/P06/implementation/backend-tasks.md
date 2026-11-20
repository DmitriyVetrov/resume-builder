# P06 Backend Tasks

Owner: Backend Developer. Read the frozen OpenAPI 1.0.0, `architecture/phase-plan.md`, ADR-013…015, ADR-034, ADR-036…039 and the Test Architect plan. Wait for the Test Engineer's red tests and harness proof; make them green without editing tests, contract or acceptance criteria. Append exact commands/exits to `tests/test-results.md`.

Allowed production paths: `backend/src/ResumeBuilder.Domain/**`, `backend/src/ResumeBuilder.Application/**`, `backend/src/ResumeBuilder.Infrastructure/**`, `backend/src/ResumeBuilder.Api/**`, `backend/ResumeBuilder.slnx`, `backend/Directory.Packages.props`, `backend/README.md`. Test source and `tests/e2e/**` belong to the Test Engineer. Never log or commit secrets, contact data, password/token/cookie material, resume bodies or archive bytes.

| Task | Deliverable and contract dependency | Red/green evidence |
|---|---|---|
| BE-P06-00 | **Pre-red declarations only:** complete `ResumeBuilder.Application.Accounts` records, enum, interfaces and exact signatures in `decisions.md` DD-P06-12, including atomic token-use, revoke-all, deletion mark/purge and outbox-claim contracts. Also add the DD-P06-14 Domain `PasswordPolicy` and Application `IAccountPasswordHasher`/`AccountPasswordVerification`/`AccountUseCases : IAccountUseCases` compile-only signatures with the exact constructor and return types. Keep existing `IClock`, `IEmailSink`, `AccountEmail`, `IAccountDeletionLedger` and `IAccountDeletionProcessor` signatures. No endpoint, adapter, DI registration, worker, no-op service or account behavior. Coordinator gives this narrow scaffold to Backend Developer before the Test Engineer's red step. | Existing backend build must remain green; Test Engineer then owns compiling red Domain/Application/persistence/API tests and harness proof. |
| BE-P06-01 | Account/domain policy, unique normalized email persistence, hash policy and common-password list; inject clock and use framework hasher. No speculative resume model. | Domain/application positive and negative sign-up/password cases; AC-P06-01, 06. |
| BE-P06-02 | `getSession` bootstrap, revocable cookie session store, Data Protection, CSRF and session lifetime/rotation/revocation. Use P04 safe Problem/log pipeline and exact contract cookie/header semantics. | API host tests for anonymous/authenticated session, CSRF failure, cookie attributes, revocation, expiry; AC-P06-03, 06, 09. |
| BE-P06-03 | `signUp`, `verifyEmail`, `resendVerification`, email outbox/SMTP adapter; SHA-256 token hash, single-use/expiry/supersession and generic 202. Mailpit/local adapter only for tests. | Clocked token and local email integration, duplicate/invalid/reused/expired tests; AC-P06-01, 02, 06. |
| BE-P06-04 | `login`, `logout`, `requestPasswordReset`, `confirmPasswordReset`, `reauthenticate`, `changePassword`; dummy hash for unknown login, back-off, all-session revocation and generic failures. | API and application tests for login, reset, 1 h expiry, 5 min re-auth and old-session denial; AC-P06-03…06. |
| BE-P06-05 | ADR-038 `auth-login`, `auth-email`, `data-export` limits with per-IP/account/email partitions and `Retry-After`. Preserve trusted-forwarder setup; keep count storage content-free. | 429 positive/negative boundary cases and safe-log capture; AC-P06-06, 09. |
| BE-P06-06 | `requestAccountDeletion`: durable deletion mark, immediate session revoke/login denial, confirmation email sent before address erasure, and retryable ≤24 h purge. Before any destructive purge, persist the account ledger entry in Mongo and the separate private append-only Blob store; expose a lifecycle port P07 can extend. | Fake-clock, restart and injected-ledger-failure tests; account records gone after job, no delete before dual write; AC-P06-07. |
| BE-P06-07 | `exportAccountData`: verified/fresh-re-auth, owner-scoped canonical JSON, `no-store`; P06 empty-resume shape, extension port for P07 resume/photo data. | Verified/unverified/stale/anonymous and isolation tests; schema drift test; AC-P06-08, 09. |
| BE-P06-08 | Run focused and full P06 suite, P02 contract validation and backend CI sequentially; document exact exits and known limitations. | Test-results section and reviewer-ready evidence for AC-P06-01…09. |

## BE-P06-00 scaffold status (2026-11-03)

Completed DD-P06-07 declarations under `backend/src/ResumeBuilder.Application/Accounts/AccountPorts.cs`: `IClock`, `IEmailSink`, `AccountEmail`, `IAccountStore`, `IAccountTokenStore`, `ISessionStore`, `IEmailOutboxStore`, `IAccountDeletionLedger`, and `IAccountDeletionProcessor`. The initial four store interfaces had no methods; DD-P06-12 now supersedes that allowance. No implementation or registration was added. Test Engineer owns the next red behavior step.

| Exact command | Exit code | Result |
|---|---:|---|
| `dotnet build backend/ResumeBuilder.slnx --no-restore` | 1 | Transient `MSB3030`: API test copy could not find `ResumeBuilder.Api.deps.json` while projects built concurrently. |
| `dotnet build backend/ResumeBuilder.slnx` | 0 | Build succeeded with 0 warnings and 0 errors. |
| `python3 scripts/phase-handoff-check.py --phase P06 --role backend-developer --worktree .` | 1 | Role and phase scope passed, but suite was red: backend formatting and expected P06 API behavior failures, plus frontend/E2E red tests. Formatting was fixed immediately after this run. |
| `dotnet format backend/ResumeBuilder.slnx whitespace --include backend/src/ResumeBuilder.Application/Accounts/AccountPorts.cs --no-restore` | 0 | Applied repository whitespace style to scaffold. |
| `bash scripts/ci/backend.sh` | 1 | Build and architecture/toolchain tests passed; 14 P06 API tests failed on missing endpoint behavior as expected before green implementation. |
| `python3 scripts/phase-handoff-check.py --phase P06 --role backend-developer --worktree .` (rerun after formatting) | 1 | Scope and blueprint checks passed; `SUITE_RED` remains because backend, frontend and E2E P06 behavior tests fail as expected before implementation. No formatting error remains. |

### DD-P06-12 declaration extension (2026-11-03)

Completed the exact `decisions.md` records, enum, use-case methods and store methods, plus `IAccountOwnedDataPurger`, in `AccountPorts.cs`. Existing clock, email, ledger and processor signatures are retained. This step adds declarations only; no route, adapter, service registration, worker or behavior is present.

| Exact command | Exit code | Result |
|---|---:|---|
| `dotnet format backend/ResumeBuilder.slnx whitespace --include backend/src/ResumeBuilder.Application/Accounts/AccountPorts.cs --no-restore` | 0 | Applied repository whitespace style; workspace loading emitted a nonfatal warning. |
| `dotnet build backend/ResumeBuilder.slnx` | 0 | Build succeeded with 0 warnings and 0 errors. |

### DD-P06-14 next declaration step

**Exact instruction to Backend Developer:** “Before the Test Engineer's next red run, add only the DD-P06-14 `PasswordPolicy`, `IAccountPasswordHasher`, `AccountPasswordVerification`, and `AccountUseCases : IAccountUseCases` compile-only declarations with the exact namespaces, constructor order and return types shown in `decisions.md`. Keep DD-P06-12 interface signatures unchanged; do not add registration, endpoint, adapter or account behavior yet. Build the backend and report the exact command and exit code.” The table above does not claim this follow-up has been implemented.

### DD-P06-14 declaration verification (2026-11-03)

Verified that the exact compile-only declarations are already present in `PasswordPolicy.cs` and `AccountUseCases.cs`. No account behavior or registration was added in this step.

| Exact command | Exit code | Result |
|---|---:|---|
| `dotnet build backend/ResumeBuilder.slnx` | 0 | Build succeeded with 0 warnings and 0 errors. |

Do not add a server PDF/TXT exporter, Google/guest auth endpoint, raw token storage or response-shape change. If a frozen contract response cannot be implemented, report the exact mismatch to the Solution Architect before changing code or tests.

### BE-P06 green work in progress (2026-11-03)

Implemented the Domain password policy and Application account use cases against the Test Engineer's red tests. API, Mongo adapters, and production wiring remain pending. A test expectation conflict needs Test Engineer resolution: `P06AccountTests.P06ContractOperationRespondsRatherThan404` expects `POST /api/v1/auth/sign-up` without CSRF to return 202, whereas `P06AccountTests.P06AnonymousSignupWithoutCsrfIsRejectedAsSafeProblem` expects 403; the architecture and contract require 403.

| Exact command | Exit code | Result |
|---|---:|---|
| `dotnet test backend/ResumeBuilder.slnx -c Release --filter 'FullyQualifiedName~P06PasswordPolicyTests\|FullyQualifiedName~P06AccountUseCaseTests' --no-restore > /tmp/p06-unit-green.out 2>&1; code=$?; tail -25 /tmp/p06-unit-green.out; exit "$code"` | 1 | First implementation build failed CA1725 because implementation parameter names did not match the interface. |
| `dotnet test backend/ResumeBuilder.slnx -c Release --filter 'FullyQualifiedName~P06PasswordPolicyTests\|FullyQualifiedName~P06AccountUseCaseTests' --no-restore > /tmp/p06-unit-green.out 2>&1; code=$?; tail -22 /tmp/p06-unit-green.out; exit "$code"` | 0 | 15 focused P06 Domain/Application tests passed after parameter names were corrected. |

### BE-P06 implementation and hardening checkpoint (2026-11-03)

Implemented the twelve account operations, Domain password policy, framework Identity V3 hashing (210,000 iterations and rehash handling), framework cookie authentication with `ITicketStore`, framework antiforgery, 14-day sliding/30-day absolute sessions, token hashing and atomic consumption/supersession, durable Mongo account/session/token/outbox adapters, asynchronous SMTP dispatch, persistent email/back-off counters, IP/export limits, owner-scoped JSON export and P07 extension ports. Pending email bodies are protected with Data Protection; successful dispatch clears them. Mongo writes use majority acknowledgement, account email has a unique index, and token/session/counter/ledger retention uses TTL indexes. No Mongo failure switches account storage to memory. HTTP test cookies require an explicit nonproduction setting. Configuration and lifecycle requirements are documented in `backend/README.md`.

The deletion processor sends confirmation before erasure and writes both the majority-acknowledged Mongo ledger and the separate private Blob ledger before live data is removed. It retries failed accounts without preventing other accounts from progressing. P07 owned-data purgers and export contributors have explicit Application ports. Deployment still owns the Blob container's append-only permissions/35-day lifecycle and the production Blob/Key Vault Data Protection key ring; P06 supports a persisted local key directory.

The earlier 51/51 green result below predates the final framework/security hardening. **The latest hardened API run is not green:** it requires Test Engineer fixture updates for HTTPS in secure-cookie tests, explicit in-memory security counters, asynchronous outbox dispatch before inspecting captured mail, and operation-specific bodies respecting `additionalProperties: false`. The coordinator received the exact failing expectations and fixture requests through Orca; developer source changes do not modify tests or the frozen contract.

| Exact command from repository root | Exit | Observed result |
|---|---:|---|
| `dotnet build backend/ResumeBuilder.slnx` | 0 | Repeated incremental builds after adapters, workers, cookie/antiforgery, durable counters and request validation compiled with zero warnings/errors. Intermediate attempts reported missing framework/usings and CA1001; those source defects were fixed before these successful builds. |
| `dotnet test backend/ResumeBuilder.slnx -c Release --filter 'FullyQualifiedName~P06' --no-restore > /tmp/p06-api-tests.out 2>&1; code=$?; rg 'Failed \|Passed!\|Failed!\|Error Message:\|error ' /tmp/p06-api-tests.out \| tail -45; exit "$code"` | 1 | Initial API implementation: 31 passed, 20 failed; HTTP transport did not send secure cookies. |
| `dotnet test backend/ResumeBuilder.slnx -c Release --filter 'FullyQualifiedName~P06' --no-restore > /tmp/p06-api-tests2.out 2>&1; code=$?; rg 'Failed \|Passed!\|Failed!' /tmp/p06-api-tests2.out \| tail -30; exit "$code"` | 1 | 46 passed, 5 failed; remaining issues were missing rates/persistence, re-auth ordering and the two escalated inconsistent expectations. |
| `dotnet test backend/ResumeBuilder.slnx -c Release --filter 'FullyQualifiedName~P06' --no-restore > /tmp/p06-api-tests4.out 2>&1; code=$?; rg 'Failed \|Passed!\|Failed!' /tmp/p06-api-tests4.out \| tail -20; exit "$code"` | 1 | 49 passed, 2 failed on the escalated inconsistent expectations. |
| `dotnet test backend/tests/ResumeBuilder.Api.Tests/ResumeBuilder.Api.Tests.csproj -c Release --filter 'FullyQualifiedName~P06PersistenceTests' --no-restore > /tmp/p06-persistence-green.out 2>&1; code=$?; tail -18 /tmp/p06-persistence-green.out; exit "$code"` | 0 | Real Mongo replica-set persistence case passed, including concurrent normalized sign-up uniqueness and Identity V3 hash metadata. |
| `dotnet test backend/ResumeBuilder.slnx -c Release --filter 'FullyQualifiedName~P06' --no-restore > /tmp/p06-final-focused.out 2>&1; code=$?; rg 'Failed \|Passed!\|Failed!\|error ' /tmp/p06-final-focused.out \| tail -15; exit "$code"` | 0 | 51/51 P06 cases passed after the Test Engineer's first expectation corrections, before final hardening. |
| `dotnet test backend/ResumeBuilder.slnx -c Release --no-restore > /tmp/p06-full-backend.out 2>&1; code=$?; rg 'Failed \|Passed!\|Failed!\|error ' /tmp/p06-full-backend.out \| tail -20; exit "$code"` | 1 | All 11 architecture guards passed. Direct run lacked the two pinned-image environment variables required by three toolchain/host checks; an outdated P04 OpenAPI inventory guard and one subsequently fixed password issue-code mapping also failed. |
| `dotnet format backend/ResumeBuilder.slnx --verify-no-changes --no-restore > /tmp/p06-format-verify.out 2>&1; code=$?; tail -20 /tmp/p06-format-verify.out; exit "$code"` | 2 | Source whitespace errors found and then formatted within allowed backend source paths. |
| `dotnet format backend/ResumeBuilder.slnx --verify-no-changes --no-restore > /tmp/p06-format-verify2.out 2>&1; code=$?; tail -8 /tmp/p06-format-verify2.out; exit "$code"` | 0 | No format errors at this checkpoint, before subsequent hardening edits. |
| `bash scripts/ci/backend.sh > /tmp/p06-backend-ci.out 2>&1; code=$?; tail -25 /tmp/p06-backend-ci.out; exit "$code"` | 1 | Locked restore/build/format passed; all 11 architecture and 3 toolchain tests passed; 69/70 API cases passed, with only the stale P04 inventory guard failing. Test Engineer subsequently owns its correction. |
| `dotnet test backend/ResumeBuilder.slnx -c Release --filter 'FullyQualifiedName~P06\|FullyQualifiedName~Architecture' --no-restore > /tmp/p06-hardened-tests.out 2>&1; code=$?; rg 'Failed \|Passed!\|Failed!\|error ' /tmp/p06-hardened-tests.out \| tail -25; exit "$code"` | 1 | Latest hardened run: all 11 architecture guards passed; P06 API 27 passed/25 failed while required fixture corrections were pending. This supersedes the earlier green claim for current code. |
| `bash docs/phases/P02/tests/suite.cmd > /tmp/p06-p02-contract.out 2>&1; code=$?; tail -18 /tmp/p06-p02-contract.out; exit "$code"` | 0 | 66/66 contract checks passed; .NET reader accepted OpenAPI 3.1 (26 paths, zero errors/warnings). Negative reader probes produced their expected diagnostic output. |
| `dotnet format whitespace backend/ResumeBuilder.slnx --no-restore --include backend/src > /tmp/p06-hardened-format.out 2>&1; code=$?; tail -8 /tmp/p06-hardened-format.out; exit "$code"` | 0 | Formatted only production source after the final hardening changes. |

Still owned by Test Engineer: concurrent token replay/supersession, private Blob ledger failure and purge restart/24-hour proof, durable token/session/outbox inspection, cross-instance email/login back-off boundaries, and production configuration/security checks. ADR-034/036's duplicate-address notification also needs an executable red expectation before implementation because the current duplicate-sign-up test expects only one captured message. No restart, Blob deletion, deployment key-ring or complete later resume/photo/archive proof is claimed here.

Additional current-code checks:

| Exact command | Exit | Result |
|---|---:|---|
| `dotnet test backend/ResumeBuilder.slnx -c Release --filter 'FullyQualifiedName~P06PasswordPolicyTests\|FullyQualifiedName~P06AccountUseCaseTests\|FullyQualifiedName~Architecture' --no-restore > /tmp/p06-current-unit-architecture.out 2>&1; code=$?; rg 'Passed!\|Failed!\|error ' /tmp/p06-current-unit-architecture.out; exit "$code"` | 0 | All 15 Domain/Application and all 11 architecture cases passed. |
| `dotnet format backend/ResumeBuilder.slnx --verify-no-changes --no-restore > /tmp/p06-current-format-verify.out 2>&1; code=$?; tail -8 /tmp/p06-current-format-verify.out; exit "$code"` | 2 | Found whitespace in the processor/counter edits; the directory-only include in the preceding formatter invocation had not formatted these files. |
| `dotnet build backend/ResumeBuilder.slnx > /tmp/p06-retention-build.out 2>&1; code=$?; tail -12 /tmp/p06-retention-build.out; exit "$code"` | 1, then 0 | Nullable-flow error in the new back-off retention branch was corrected; rerun built with zero warnings/errors. |
| `dotnet format whitespace backend/ResumeBuilder.slnx --no-restore --include backend/src/ResumeBuilder.Api/AccountEndpoints.cs backend/src/ResumeBuilder.Api/Program.cs backend/src/ResumeBuilder.Application/Accounts/AccountUseCases.cs backend/src/ResumeBuilder.Application/Accounts/AccountSecurityPorts.cs backend/src/ResumeBuilder.Domain/Accounts/PasswordPolicy.cs backend/src/ResumeBuilder.Infrastructure/AccountCookieTicketStore.cs backend/src/ResumeBuilder.Infrastructure/AccountDeletion.cs backend/src/ResumeBuilder.Infrastructure/AccountEmailDispatcher.cs backend/src/ResumeBuilder.Infrastructure/AccountInfrastructure.cs backend/src/ResumeBuilder.Infrastructure/MongoAccountStore.cs backend/src/ResumeBuilder.Infrastructure/MongoAccountSecurityCounters.cs > /tmp/p06-format-explicit.out 2>&1; code=$?; tail -8 /tmp/p06-format-explicit.out; exit "$code"` | 0 | Applied formatting to the explicit owned production source file list. |
| `git diff --check` | 0 | No diff whitespace errors at the checkpoint. |
| `dotnet format backend/ResumeBuilder.slnx --verify-no-changes --no-restore > /tmp/p06-format-final.out 2>&1; code=$?; tail -8 /tmp/p06-format-final.out; exit "$code"` | 0 | Current source and solution format verification passed after explicit file formatting. |

### Test Engineer round 2 follow-up

The coordinator merged the required fixture corrections and three real persistence checks. Concurrent token consumption (16 callers, one success) and inspection proving no plaintext token/email body in Mongo both passed. The new deletion-retry case exposed confirmation being sent before a failed ledger write; production ordering now writes both ledgers first, then sends confirmation, then purges. The retry no longer sends duplicate confirmation after a ledger failure. The Blob client is pinned to service version `2024-11-04`, supported by the emulator. The remaining failure at this checkpoint is the test's separate inspection client still using SDK default `2026-06-06`, unsupported by Azurite; Test Engineer owns that fixture option.

| Exact command | Exit | Result |
|---|---:|---|
| `dotnet build backend/ResumeBuilder.slnx > /tmp/p06-current-build.out 2>&1; code=$?; tail -10 /tmp/p06-current-build.out; exit "$code"` | 0 | Current implementation builds with zero warnings/errors. |
| `dotnet test backend/ResumeBuilder.slnx -c Release --filter 'FullyQualifiedName~P06\|FullyQualifiedName~Architecture' --no-restore > /tmp/p06-round2-tests.out 2>&1; code=$?; rg 'Failed \|Passed!\|Failed!\|error ' /tmp/p06-round2-tests.out \| tail -30; exit "$code"` | 1 | 54/56 P06 cases and all 11 architecture guards passed. Deletion retry duplicated confirmation; Blob ledger call used an API version unsupported by Azurite. |
| `dotnet test backend/ResumeBuilder.slnx -c Release --filter 'FullyQualifiedName~P06\|FullyQualifiedName~Architecture' --no-restore > /tmp/p06-round2-fixed.out 2>&1; code=$?; rg 'Failed \|Passed!\|Failed!\|error ' /tmp/p06-round2-fixed.out \| tail -20; exit "$code"` | 1 | 55/56 P06 cases and all 11 architecture guards passed. Ledger restart/write succeeded; only the test's own direct Blob inspection at line 94 failed on its unsupported default API version. |
| `dotnet format whitespace backend/ResumeBuilder.slnx --no-restore --include backend/src/ResumeBuilder.Api/AccountEndpoints.cs backend/src/ResumeBuilder.Infrastructure/AccountDeletion.cs backend/src/ResumeBuilder.Infrastructure/AccountInfrastructure.cs backend/src/ResumeBuilder.Infrastructure/MongoAccountStore.cs backend/src/ResumeBuilder.Infrastructure/MongoAccountSecurityCounters.cs > /tmp/p06-round2-format.out 2>&1; code=$?; tail -8 /tmp/p06-round2-format.out; exit "$code"` | 0 | Formatted the final production fixes. |

These round 2 results supersede the earlier pending-fixture count. Full purge restart/24-hour aggregate proof, session expiry/revocation storage inspection, cross-instance back-off limits, and ADR-034's already-registered sign-up notification still require the Test Engineer's remaining red cases; the existing duplicate-sign-up case still asserts only one verification message. Production deployment key-ring/Blob lifecycle configuration and future resume/photo/archive coverage remain outside this account-only proof.
| `dotnet build backend/ResumeBuilder.slnx > /tmp/p06-final-clean-build.out 2>&1; code=$?; tail -10 /tmp/p06-final-clean-build.out; exit "$code"` | 1 | Restore detected NU1506 after the test-project merge: `Azure.Storage.Blobs` has both a central and a redundant test-local `PackageVersion Include`. Test Engineer owns removing the redundant test-local declaration; production needs the central version. The unused volatile account-store adapter and registration were removed from production code in this checkpoint. |
| `dotnet build backend/src/ResumeBuilder.Api/ResumeBuilder.Api.csproj -c Release --no-restore > /tmp/p06-production-build.out 2>&1; code=$?; tail -10 /tmp/p06-production-build.out; exit "$code"` | 0 | All four production projects compile in Release with zero warnings/errors, independently of the test-owned restore declaration conflict. |
| `dotnet build backend/src/ResumeBuilder.Api/ResumeBuilder.Api.csproj -c Release --no-restore > /tmp/p06-proxy-build.out 2>&1; code=$?; tail -10 /tmp/p06-proxy-build.out; exit "$code"` | 0 | Release production build passed after enabling HTTPS scheme forwarding from the existing trusted proxy allow-list. Untrusted forwarders remain untrusted; the change supports framework antiforgery behind TLS termination. |

### Current step report after final fixture merge (2026-11-04 local time)

All 56 P06 cases now pass, including the concurrent token, encrypted Mongo storage, private Blob ledger restart and deletion retry cases. The final CI run passed locked restore, Release build, formatting, all 11 architecture guards and all 3 toolchain checks. **The full backend CI command still exits 1:** two existing child-process host checks exceeded their startup deadlines under the full concurrent container load. Both pass in the isolated two-case diagnostic run; this is reported as a nondeterministic harness/gate issue, not silently converted into a green CI claim. Test Engineer owns the process-launch harness; launching the already-built DLL directly instead of `dotnet run --no-build` is the recommended diagnostic/fix while retaining the existing assertions and deadlines.

| Exact command | Exit | Result |
|---|---:|---|
| `bash scripts/ci/backend.sh > /tmp/p06-backend-ci-final.out 2>&1; code=$?; tail -28 /tmp/p06-backend-ci-final.out; exit "$code"` | 1 | Restore/build/format passed; architecture 11/11 and toolchain 3/3 passed; API 73/75 passed. All 56 P06 cases passed. `HostTests.UntrustedForwardingCannotEvadeSharedHealthLimit` did not observe startup within its deadline, and `HostTests.MalformedMongoConfigurationFailsStartupWithoutEchoingValue` did not observe process exit within five seconds. |
| `dotnet test backend/tests/ResumeBuilder.Api.Tests/ResumeBuilder.Api.Tests.csproj -c Release --no-build --no-restore --filter 'FullyQualifiedName~HostTests.UntrustedForwardingCannotEvadeSharedHealthLimit\|FullyQualifiedName~HostTests.MalformedMongoConfigurationFailsStartupWithoutEchoingValue' > /tmp/p06-host-diagnostic.out 2>&1; code=$?; tail -25 /tmp/p06-host-diagnostic.out; exit "$code"` | 0 | Both failing host cases passed in isolation (2/2, five-second test duration). The failed full-suite run remains recorded above. |
| `bash docs/phases/P02/tests/suite.cmd > /tmp/p06-contract-final.out 2>&1; code=$?; tail -18 /tmp/p06-contract-final.out; exit "$code"` | 0 | 66/66 contract checks passed. Frozen OpenAPI reader reported 26 paths, zero errors/warnings; invalid-spec probes emitted their expected diagnostics. |

The coordinator received this gate issue through Orca (`msg_05c7c6d88286`). Frontend/E2E phase integration remains with the coordinator after the parallel merge; no frontend source, test source, acceptance criteria or OpenAPI contract was edited by this developer. Remaining broader acceptance proof and the ADR-034 already-registered sign-up notification dependency are listed above and are not claimed complete by the P06 test count.

Post-step security review finding (awaiting Test Engineer red case): `LoginAsync` can read/verify the old hash, then overlap a reset that changes the hash and revokes sessions, then create a new session from the old verification result. This interleaving needs a deterministic barrier-based test before release. The recommended fix is to re-read the account after session creation and revoke that new session when the expected password hash changed, the account disappeared or deletion was marked; a reset occurring after that final read will revoke the already-created session. Rehash-on-login must track its newly persisted hash for the comparison. The finding was sent to the coordinator as `msg_bfc42d33fa21`; no untested race fix is claimed here.

The rehash-on-login branch also needs an Architect-approved atomic update seam: after a concurrent reset, the existing unconditional `TrySetPasswordHashAsync` can replace the reset hash with a rehash of the old password. The post-create check alone cannot detect that overwrite. Recommended default is an additional store method accepting the expected old hash and replacement hash for an atomic Mongo compare-and-set, followed by the post-create account check; existing port signatures and the six constructor dependencies can remain. This additional decision/red-case dependency was escalated as `msg_4f395ec57008`; no unilateral port change or untested fix was made.

Proposed declaration for Architect review only (not added to the production port):

```csharp
Task<bool> TryReplacePasswordHashAsync(Guid accountId, string expectedPasswordHash,
    string replacementPasswordHash, CancellationToken cancellationToken);
```

Proposed semantics: return true only when one live account with the expected hash is updated atomically; return false for a missing account, deletion mark or changed hash. Mongo would filter by ID, expected hash and null deletion timestamp and use the existing majority write concern. This preserves the existing method signatures and constructor order. Test Engineer should cover the old-hash login/reset interleaving, the rehash/reset overwrite interleaving, and successful ordinary rehash-on-login before green implementation.
