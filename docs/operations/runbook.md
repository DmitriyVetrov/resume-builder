# Operations Runbook

Owner: operations. Started in P13 (AC-P13-17); P15 fills in the production names and applies the settings marked **P15**. Every procedure here keeps to `.claude/rules/03-security-privacy.md`: no resume content, contact data, password, token or photo bytes in a log, ticket or chat.

Sources: NFR-08…NFR-14, ADR-009, ADR-012, ADR-016, ADR-033, ADR-036, ADR-038, ADR-039 (and its P13 amendment), `docs/phases/P13/decisions.md`.

## 1. Backup policy (NFR-10)

| Store | Setting | Value | Why |
|---|---|---|---|
| MongoDB Atlas cluster | Continuous cloud backup (point-in-time restore) | on; restore window **7 days** | RPO ≤ 1 min: the oplog is shipped continuously |
| MongoDB Atlas cluster | Snapshot schedule | daily, retained **30 days**; no longer retention tier | "Daily backups kept 30 days"; ADR-039 §4 needs every backup gone within 30 days |
| MongoDB Atlas cluster | Region and snapshot copies | Azure Germany West Central; copies only to Germany North | ADR-012 |
| Storage account, container `photos` | Blob versioning, soft delete, point-in-time restore | versioning on; soft delete **30 days**; point-in-time restore **29 days** (must be below soft delete) | Blob side of NFR-10 |
| Storage account | Replication | GRS paired Germany West Central → Germany North | ADR-012 |
| Container `deletion-ledger` | Outside every restore; lifecycle rule deletes after **35 days**; time-based immutability (append-only) **35 days** | ADR-039 §4: the ledger survives the restore it is applied to |

The application side of RPO is already enforced: every write is acknowledged with `w: majority` (resume writes also `j: true`), and nothing in the code can weaken it (P13 test D05). A connection string must not carry a `w=` option; the stores override it anyway.

**P15** applies the table, then records the effective values (Atlas backup policy export, `az storage account blob-service-properties show`) in its go-live evidence.

## 2. Restore and reconciliation (ADR-039 §4)

A restore brings back data users deleted. Reconciliation deletes it again **before traffic resumes**. Never skip step 5.

1. Open an incident. Record the target time and the reason. No user data in the record.
2. Stop traffic and the jobs: set the web and API ingress to zero traffic (or scale both apps to 0 replicas). The jobs run inside the API replicas, so scaling the API to 0 stops them too.
3. Restore the database: Atlas point-in-time restore of the cluster to the target time (same cluster, or a new one that the API then points to).
4. Restore the photos: `az storage blob restore` for the storage account with `--blob-range photos/` only, to the nearest time not after the database's. **Never include `deletion-ledger`.** If the two times differ, step 6 of the reconciliation removes blobs the database no longer knows.
5. Reconcile: run the API image once as a Container Apps job, with the API's configuration and secrets:
   ```bash
   dotnet ResumeBuilder.Api.dll reconcile-restore
   ```
   It builds the host, runs ADR-039 §4 steps 1–6, logs one line, and exits without starting Kestrel or any job:
   ```text
   restore_reconciled ledger_loaded=… accounts_erased=… resumes_purged=… photos_deleted=… photo_references_cleared=… trash_purged=… snapshots_deleted=… orphan_photos=… orphan_owners=…
   ```
   Exit 0: done. Exit 1 (`restore_reconciliation_failed`): fix the cause (usually store connectivity) and run it again. It is idempotent; a second run after a successful one reports zeros.
6. Restore traffic. Record the counts from step 5 in the incident, nothing else.

What reconciliation does, in order: load the ledger's blob copy into the restored `deletion_ledger` collection; erase every ledgered account; delete every ledgered resume with its snapshots and photos; delete every ledgered photo's blobs and clear it from any restored resume (its version moves, so open tabs get the ADR-029 notice); purge trash older than 30 days and snapshots older than 30 days; delete blobs of owners that do not exist and photos no resume references. A resume in the trash is live: its photo is kept (DD-P13-05).

**Drill.** The automated drill is `P13RestoreTests.D02` (`dotnet test backend/tests/ResumeBuilder.Api.Tests --filter D02`): a real `mongodump`/`mongorestore` and a photo-container restore over an erased account, a resume deleted from the trash, a resume purged by the job, a removed photo and a replaced photo. Run it after any change to the lifecycle code. **P15** runs the production procedure once against a staging copy before go-live.

## 3. Lifecycle jobs

| Job (lease name) | Period | Does | Disable on a replica |
|---|---|---|---|
| `account-purge` | 15 min | Erases accounts whose deletion was requested (FR-ACC-03, ≤ 24 h) | `Accounts__DeletionWorker__Enabled=false` |
| `resume-lifecycle` | 15 min | Finishes interrupted purges and photo removals | `Resumes__LifecycleWorker__Enabled=false` |
| `trash-expiry` | 1 h | Purges resumes trashed more than 30 days ago (ADR-016) | `Resumes__TrashExpiryWorker__Enabled=false` |

Each job runs under a lease in the `job_leases` collection (DD-P13-03): one replica runs a given period; a lease lasts one period and is taken over when it expires, so a crashed replica delays a job by at most one period. To force a run, delete the job's row from `job_leases`; the next tick of any replica takes it. The e-mail outbox worker (1 min) claims each message on its own and needs no lease.

## 4. Operational events

All are counts or fixed names, never content (P13 tests O01, O02). Log Analytics keeps them **30 days** in the EU (**P15**: workspace retention 30 days, Germany West Central).

| Event | Level | Meaning | Action |
|---|---|---|---|
| `account_purge_pending {PendingCount} of {DueCount}` | Warning | Some due erasures failed this run | Alert if it repeats for 4 runs (1 h): the 24 h bound is at risk |
| `account_deletion_notice_undelivered` | Warning | The deletion notice could not be sent; the erasure went on | None per event; watch the mail provider |
| `account_mail_delivery_failed {FailedCount} … {LongDeferralCount}` | Warning | Verification or reset mail is being retried | Alert when `LongDeferralCount` > 0 |
| `resume_lifecycle_pending {PendingCount} of {AttemptedCount}` | Warning | Purges or photo removals did not finish | Alert if it repeats for 4 runs |
| `trash_expiry_pending {PendingCount} of {AttemptedCount}` | Warning | Expired resumes are hidden but not yet deleted | The lifecycle job retries; alert if it repeats |
| `scheduled_job_failed {Job}` | Warning | A job threw | Check store connectivity |
| `restore_reconciled {Counts}` | Information | Section 2, step 5 | Copy the counts into the incident |
| `client_event {Type} {Code} {ResumeId} {EngineVersion}` | Information | Browser-reported PDF failures and preview/PDF mismatches (NFR-13) | Track the rate per `EngineVersion` after a release |
| `request_failed internal_error …` | Error | Unhandled request failure, trace ID only | Investigate by trace ID |

Framework categories are silent by design (P04 C-1). Readiness (`/api/v1/health/ready`) answers 503 while MongoDB is unreachable; the platform's probe sends no cookie.

## 5. Data-protection keys (ADR-036)

The key ring protects session tickets, antiforgery tokens and the bodies of unsent mail. Keys live 90 days; a new key is created before the old one expires, and old keys stay in the ring to read what they protected.

- **P15** persists the ring in Blob Storage, wrapped by a Key Vault key (`PersistKeysToAzureBlobStorage` + `ProtectKeysWithAzureKeyVault`), both in Germany West Central. Locally, `Accounts__DataProtection__KeyDirectory` points at a Docker volume.
- **Routine rotation** is automatic. Check quarterly that a key newer than 90 days exists in the ring.
- **Emergency rotation** (a key may be exposed): revoke every key in the ring (key manager `RevokeAllKeys`, with a reason), restart the API replicas. Effects: every session ends (users log in again), every open form needs a fresh CSRF token (the client retries once by itself, DD-P13-17), and pending verification or reset mail can no longer be read: ask affected users to request it again. No user data is lost. Rotate the Key Vault wrapping key too.

## 6. EU residency checks (ADR-012, NFR-09)

Run before go-live (**P15**) and after any infrastructure change. Every answer must be an EU region.

```bash
az resource list --resource-group <rg> --query "[].{name:name, type:type, location:location}" -o table   # germanywestcentral or germanynorth only
az storage account show -n <account> --query "{primary:primaryLocation, secondary:secondaryLocation}"
az monitor log-analytics workspace show -g <rg> -n <workspace> --query "{location:location, retention:retentionInDays}"
atlas clusters describe <cluster> --output json | jq '.replicationSpecs[].regionConfigs[] | {providerName, regionName}'   # AZURE / GERMANY_WEST_CENTRAL
az communication email domain show … # ACS Email data location: Europe (ADR-034)
curl -sI https://<host>/ | grep -i content-security-policy   # connect-src 'self': the browser can reach no other origin
```

The application side is tested: the browser can reach only its own origin (CSP, DD-P13-18, and the E2E network audits), and the backend has no outbound HTTP client (architecture test AR01); its only peers are the configured MongoDB, Blob and SMTP endpoints.

## 7. Transport and edge

- Ingress: HTTPS only, HTTP redirected (`allowInsecure: false`, **P15**). The API and the web image send HSTS (`max-age=31536000; includeSubDomains`); `__Host-` cookies are `Secure`.
- Trusted proxies: set `ReverseProxy__TrustedNetworks__0=<ingress CIDR>` (or `ReverseProxy__TrustedProxies__N` for single addresses). Without it, client addresses in rate limits and security logs are the ingress's.
- The web image sends the CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer` and a restrictive `Permissions-Policy`; hashed assets are cached for a year, `index.html` is revalidated.

## 8. Rate limits (ADR-038)

The limits of ADR-038 §2 apply per replica for the in-process counters (`global`, `auth-login` per IP, `auth-email` per IP, `doc-write`, `photo-upload`, `data-export`, `client-events`). With N replicas the effective limit is up to N × the table. Login back-off per account and mail per address are in MongoDB and hold across replicas (DD-P13-10). **P15** records N.

## 9. Retention decisions

- Accounts that never verify are not expired automatically in v1 (DD-P13-09): they can hold resumes (ADR-013), and the user can delete the account. Revisit if sign-up abuse appears in the `auth-email` counters.
- Exports are never stored (ADR-039). The data archive is built in the browser (FR-ACC-04).
