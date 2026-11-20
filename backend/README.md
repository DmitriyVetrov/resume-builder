# Backend toolchain skeleton

P03 contains `global.json` (SDK 10.0.3xx), `ResumeBuilder.slnx`, shared `Directory.Build.props` and `Directory.Packages.props`, `nuget.config`, and the xUnit toolchain canary under `tests/ResumeBuilder.Toolchain.Tests/`. P04 adds the application projects to this solution.

From the repository root, run `bash scripts/ci/backend.sh` for locked NuGet restore, Release build, format verification and tests. Docker is required by the MongoDB Testcontainers canary. New backend projects need committed `packages.lock.json` files; `scripts/ci/security.sh` scans every backend lockfile. Keep the backend job independent of frontend builds.

## P04 host

Set `Mongo__ConnectionString` to a MongoDB connection URI supplied by the environment or secret provider, then run `dotnet run --project backend/src/ResumeBuilder.Api/ResumeBuilder.Api.csproj`. The host exposes `/api/v1/health/live` and `/api/v1/health/ready`. Configure trusted proxy IPs with `ReverseProxy__TrustedProxies__0` (and subsequent indices); only listed peers may supply forwarded client addresses and the HTTPS scheme for cookie/antiforgery handling. The global limit is 600/minute/IP. Use `bash docs/phases/P04/tests/suite.cmd` for the phase suite after the Test Engineer corrects the harness defects recorded in P04 test results.

## P06 accounts

The twelve P06 operations use the frozen `/api/v1` contract. Mongo stores accounts, hashed single-use tokens, revocable sessions, encrypted email outbox bodies and content-free security counters. Writes use majority acknowledgement. Mongo failure does not switch account data to volatile storage.

Cookie authentication uses an `ITicketStore`, a 14-day sliding lifetime and a 30-day absolute limit. Call `GET /api/v1/session` to obtain the readable `XSRF-TOKEN` cookie, then echo it in `X-XSRF-TOKEN` for unsafe requests. Refresh the header after login and logout, which reissue the token. Production cookies always require HTTPS. Isolated HTTP tests may set `Accounts__AllowInsecureCookies=true` in a nonproduction environment and override the application stores; the default remains secure.

Supply settings through the environment or a secret provider:

| Setting | Purpose |
|---|---|
| `Accounts__PublicBaseUrl` | Public application origin used in email links; use HTTPS in deployment. |
| `Email__Smtp__Host`, `Email__Smtp__Port`, `Email__Smtp__Sender` | SMTP delivery configuration. Local Mailpit uses port 1025. |
| `Email__Smtp__EnableSsl` | Defaults to enabled outside Development; disable only for local Mailpit. |
| `Email__Smtp__Username`, `Email__Smtp__Password` | Optional credentials supplied by the secret provider. |
| `Accounts__DataProtection__KeyDirectory` | Persistent local key directory mounted from a private volume; preserve it across restarts so cookies and pending email bodies remain readable. Production Blob/Key Vault key-ring configuration remains a deployment responsibility under ADR-036. |
| `Blob__ConnectionString` | Separate private deletion-ledger Blob store. Development can use Azurite; deployment must provide the store explicitly. |
| `Accounts__DeletionWorker__Enabled` | Defaults to true; the worker retries pending account purges every 15 minutes. Set false in deterministic processor tests. |
| `Accounts__EmailWorker__Enabled` | Defaults to true; the worker dispatches durable outbox entries every minute. Set false in tests and invoke `IAccountEmailDispatcher.DispatchAvailableAsync` explicitly. |

Email endpoints return after queueing and do not wait on SMTP. Delivery failures release the claim for retry; successful delivery clears the encrypted body. No email body or credential is logged. The SMTP adapter builds verification/reset links with URL fragments.

The purge processor writes the account entry to Mongo and the separate Blob ledger, then sends confirmation before erasing the address and live data. Ledger failures keep the account pending; retries are idempotent. Provision the dedicated Blob container with private access, append-only application permissions, a 35-day lifecycle rule and exclusion from photo backups/restores. Mongo ledger entries have a 35-day TTL. P07 must register its idempotent `IAccountOwnedDataPurger` implementations before persisting resume/photo data. P07 can contribute owner-scoped canonical resume JSON through `IAccountResumeExportSource`; P06 exports an empty resume array.

## P07 resumes

The fifteen `x-phase: P07` operations follow the frozen contract's order: authentication, CSRF, rate limit, syntax and schema, `Idempotency-Key`, replay or 422, existence, trash state, `If-Match`, domain rules, write. `Domain/Resumes` holds the typed document, the aggregate and the rules; `Application/Resumes` holds the closed-schema reader, the writer, RFC 8785 canonical JSON and the use cases; `Infrastructure` holds the Mongo, Blob and SkiaSharp adapters; `Api/ResumeEndpoints.cs` does HTTP only.

Mongo collections are `resumes`, `resume_locks`, `resume_snapshots` and `idempotency_keys`, all written with `w: majority, j: true`. The per-owner lock document makes the 200-resume count exact under parallel creates, so a replica set is required, as ADR-004 already says. Photos are private blobs in the `photos` container under `u/{ownerId}/p/{photoId}/master|rendition`, streamed only through the API after an owner check.

Removing data is two-phase: a version-checked write hides the resume or moves the photo to `pendingPhotoRemovals`, then the ledger entry goes to Mongo and Blob, then the blobs and rows are deleted. `ResumeLifecycleWorker` finishes interrupted work every 15 minutes. The hourly job that purges expired trash belongs to P13.

| Setting | Purpose |
|---|---|
| `Blob__ConnectionString` | Now also the photo store; `photos` and `deletion-ledger` are separate containers. Deployment provisions `deletion-ledger` as described above. |
| `Resumes__LifecycleWorker__Enabled` | Defaults to true. Set false in deterministic tests and invoke `IResumeLifecycle.ProcessPendingAsync` explicitly. |

SkiaSharp and its Linux no-dependency native assets are pinned in `Directory.Packages.props`, so the image needs no system image libraries. Narrow tests: `dotnet test backend/tests/ResumeBuilder.Api.Tests -c Release --filter "FullyQualifiedName~P07"`, with `RESUMISER_MONGO_IMAGE` set as in `scripts/ci/backend.sh`. They start one Mongo and one Azurite container for the collection.
