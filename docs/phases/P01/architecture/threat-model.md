# P01 Security Threat Model

- Author: Solution Architect (P01), 2026-11-02. Assigned to this step by the coordinator; the reason is in kickoff §2.1.
- Method: data-flow diagram, assets, trust boundaries, then STRIDE per boundary. Each threat has a mitigation, a decision reference, an owner phase and a verification.
- Sources: NFR-08, NFR-09, NFR-10, NFR-12, NFR-13; FR-ACC-01…06, FR-PHO-01…05, FR-HDR-04, FR-RTE-03/04, FR-PER-01…03; `.claude/rules/03-security-privacy.md`; ADR-009, ADR-010, ADR-012, ADR-013, ADR-015, ADR-029, ADR-033, ADR-034, ADR-036…ADR-039.
- Status: the baseline for P02 (contract security semantics), P03 (pipeline), P06 (auth), P07 (data and media) and P13 (hardening). P13 and P15 re-review it against the built system.

## 1. System context and data flows

```
 [User device: browser]                              EU region (Azure Germany West Central, ADR-012)
  SPA (static, own origin)                        ┌───────────────────────────────────────────────┐
  ├─ layout engine → preview / PDF / TXT (ADR-010)│ Ingress (TLS, HSTS) ── /api/* ──► API (ASP.NET)│
  ├─ IndexedDB: autosave queue, guest draft  ◄─TB-6│        └──────── /*  ──► web (static SPA)     │
  └─ localStorage: last section (IDs only)        │ API ──TB-2──► MongoDB Atlas (PITR backups)     │
        │                                         │ API ──TB-3──► Blob Storage (photos, backups)   │
        └────────── TB-1 (Internet, HTTPS) ──────►│ API ──TB-4──► E-mail provider (EU data loc.)  │
                                                  │ Logs/metrics ─► Log Analytics (30 days)        │
 [CI: GitHub Actions] ──TB-5 (OIDC)──► Registry ─►│ Container Apps                                 │
 [Operators] ────────TB-7 (Azure RBAC, JIT)──────►│ Key Vault, managed identities                  │
                                                  └───────────────────────────────────────────────┘
```

Main flows:
- F1: sign-up, login, verify and reset (TB-1, TB-2, TB-4).
- F2: load and autosave a resume (TB-1, TB-2).
- F3: photo upload, crop and fetch (TB-1, TB-3).
- F4: client-side export (inside the device; the API supplies the photo rendition).
- F5: account data export and deletion (TB-1, TB-2, TB-3, TB-4).
- F6: guest draft and claim (TB-6, then F2).
- F7: deploy (TB-5).
- F8: backup and restore (TB-2, TB-3, TB-7).

## 2. Assets

| ID | Asset | Sensitivity | Where |
|---|---|---|---|
| A-01 | Passwords (transient) and password hashes | critical | request body (transient), `users` |
| A-02 | Session references, verification and reset tokens | critical | cookie, `sessions`, `account_tokens` (hashed) |
| A-03 | Resume content: contact data, career history, free text (may include data the user chooses to share, such as nationality or health) | high (personal data; treated as confidential) | `resumes`, snapshots, browser, backups |
| A-04 | Photos (face images; masters and renditions) | high | Blob Storage, backups |
| A-05 | E-mail addresses | high | `users`, e-mail provider |
| A-06 | Secrets: Data Protection keys, DB credentials, storage identities, SMTP credentials | critical | Key Vault, Blob (key ring), CI OIDC |
| A-07 | Backups (DB PITR and snapshots, blob backups) | high | Atlas, Azure Backup (EU) |
| A-08 | Logs and metrics (IDs, IP addresses, error codes; **never content**) | medium | Log Analytics |
| A-09 | Local device data: guest draft, autosave queue, thumbnail cache | high | the user's browser |
| A-10 | Build pipeline and dependencies (integrity) | high | GitHub Actions, registries |
| A-11 | Service availability (NFR-11) | medium | platform |

## 3. Trust boundaries

| ID | Boundary | Crossing |
|---|---|---|
| TB-1 | Internet: browser ↔ ingress/API | every API call and asset fetch |
| TB-2 | API ↔ MongoDB | private endpoint, TLS, app-scoped DB user |
| TB-3 | API ↔ Blob Storage | managed identity, private, container-scoped role |
| TB-4 | API ↔ e-mail provider | SMTP over TLS, credentials in Key Vault |
| TB-5 | CI ↔ cloud (deploy) | OIDC federation, environment protection |
| TB-6 | Browser storage on a possibly shared device | IndexedDB and localStorage per browser profile |
| TB-7 | Operators ↔ production | Azure RBAC, just-in-time access, audited |

## 4. Threat register (STRIDE)

Columns: ID · STRIDE · boundary · threat · mitigation · decision reference · owner phase · verification.

### 4.1 Spoofing

| ID | TB | Threat | Mitigation | Ref | Phase | Verification |
|---|---|---|---|---|---|---|
| T-SP-01 | TB-1 | Online password guessing against one account | Per-account exponential back-off after 5 failures; per-IP login limit; PBKDF2 at 210k iterations; common-password list at sign-up | ADR-036 §2, §9; ADR-038 | P06 | negative tests: 6th attempt delayed; 429 with Retry-After |
| T-SP-02 | TB-1 | Credential stuffing across many accounts and IPs | Per-account back-off independent of IP; global IP limit; alert on failure-rate spikes; no account enumeration (T-ID-01) | ADR-036, ADR-038 | P06, P13, P15 | load/abuse test (P13); alert rule (P15) |
| T-SP-03 | TB-1 | Session theft or fixation | `__Host-` cookie, `Secure`, `HttpOnly`, `SameSite=Strict`; HSTS; CSP (T-ID-11); session ID rotated on login; server-side revocation on logout, reset, password change and deletion | ADR-036 §3 | P06 | cookie attribute tests; session invalid after logout and after reset |
| T-SP-04 | TB-1, TB-4 | Theft or replay of verification and reset tokens | 256-bit random; only the SHA-256 is stored; single use; 24 h / 1 h expiry; newer tokens invalidate older ones; token in URL **fragment**; `Referrer-Policy: no-referrer`; reset revokes all sessions | ADR-036 §6–§7, ADR-034 | P06 | tests: reuse rejected, expired rejected, older token rejected |
| T-SP-05 | TB-6 | A guest draft or another user's queued edits get saved into the wrong account on a shared device | The claim always needs explicit confirmation that shows the draft title; queue entries are keyed by user ID and never replayed under another user's session; "Discard draft" | ADR-015, ADR-037 §4 | P06, P08 | component/E2E: user B is prompted and A's queue is not sent |
| T-SP-06 | TB-4 | Phishing that imitates our account e-mails | SPF, DKIM, DMARC (`quarantine` or stricter); e-mails contain no credentials and link only to our domain | ADR-034 | P15 | DNS checklist |
| T-SP-07 | TB-1 | Squatting: someone signs up with another person's address | Login before verification is allowed but export is gated; a duplicate sign-up e-mails the real owner; password reset proves ownership, verifies the address and revokes the squatter's sessions | ADR-013, ADR-036 §6, §8 | P06 | test: reset on an unverified account verifies it and revokes its sessions |

### 4.2 Tampering

| ID | TB | Threat | Mitigation | Ref | Phase | Verification |
|---|---|---|---|---|---|---|
| T-TA-01 | TB-1 | Lost update from stale tabs or replayed offline edits | `If-Match`/version; 412 never overwrites; conflict copy | ADR-037, ADR-029 | P07, P08 | contract + E2E stale-tab tests |
| T-TA-02 | TB-1 | Malformed, oversized or hostile documents (deep JSON, invalid AST, injected HTML) | Strict schema plus domain validation; AST only; body ≤ 1 MB, depth ≤ 64; NFR-12 limits; unknown fields rejected (P02 sets `additionalProperties: false` on write schemas) | domain-model §5–§6, ADR-038 | P02, P07 | negative contract tests per rule R-2…R-12 |
| T-TA-03 | TB-1, device | Malicious link schemes (`javascript:`, `data:`, `file:`) in contact items or rich-text links reaching the preview `href` or PDF annotations | Scheme allow-list {https, http, mailto, tel} at write time (backend) **and** at render time (engine); preview links use `rel="noopener noreferrer"` | domain-model R-6, ADR-010 | P07, P09, P11, P12 | unit tests on both stacks with hostile URL fixtures |
| T-TA-04 | TB-1, TB-3 | Hostile image files (polyglots, decompression bombs, parser exploits) | Magic-byte type detection (client MIME ignored); 5 MB; ≤ 8000 px per side and ≤ 40 MP; decode timeout; **re-encode** with a patched library; raw bytes never stored or served; non-root container | ADR-009 §3, §8 | P07, P13 | fixtures: oversize, wrong magic, bomb, polyglot |
| T-TA-05 | TB-1 | CSRF | `SameSite=Strict` session cookie plus antiforgery header (`X-XSRF-TOKEN`) on unsafe methods; JSON or multipart content types only | ADR-036 §4 | P04, P06 | test: unsafe request without the header gets 400/403 |
| T-TA-06 | TB-5 | Supply-chain tampering (npm, NuGet, Actions, base images) | Lockfiles with `npm ci` and NuGet lock files; actions pinned by SHA; base images pinned by digest; dependency and image scanning; minimal dependencies; licence check | ADR-033, ADR-003 | P03 | CI job evidence |
| T-TA-07 | TB-1 | Idempotency-key misuse (replaying another user's stored response; changing the body under the same key, which for a document write would acknowledge edits that were never written) | Keys scoped by owner; a key belongs to one immutable body; request-hash comparison on every keyed write, document writes included (`lastWrite.requestHash`; 422 `idempotency_key_reused` on a different body, nothing written); coalesced edits always get a new key; 24 h TTL for the key store | ADR-037 §3–§4 | P02, P07, P08 | contract test and negative integration test (same key, different body → 422; document, version and ETag unchanged); queue test (coalesced body → new key) |

### 4.3 Repudiation

| ID | TB | Threat | Mitigation | Ref | Phase | Verification |
|---|---|---|---|---|---|---|
| T-RE-01 | TB-1 | A user disputes a security-relevant action (deletion request, password change, data export, login) | Security audit events: user ID, action, timestamp, request ID and IP, in the 30-day security log, with no content | ADR-039 §5 | P06, P13 | log-event tests (fields present, no content) |
| T-RE-02 | TB-1 | Disputed data loss ("my edit vanished") | "Saved" is shown only after a durable ack with a new version; request IDs; snapshots (Should) | ADR-037 §5, §7 | P08, P13 | autosave E2E; ack-after-majority test |

### 4.4 Information disclosure

| ID | TB | Threat | Mitigation | Ref | Phase | Verification |
|---|---|---|---|---|---|---|
| T-ID-01 | TB-1 | Account enumeration through sign-up, login or reset responses and timing | Uniform responses; dummy-hash verification for unknown users; "account exists" e-mail instead of an error | ADR-036 §8 | P06 | tests: identical status and body; timing within tolerance |
| T-ID-02 | TB-1, TB-3 | Cross-user disclosure through IDOR, shared caches or public object URLs | Owner filter in every repository method (none exists without it); a foreign ID returns 404; `Cache-Control: private` (photos) and `no-store` (documents, data export); no public or SAS blob URLs | ADR-004, ADR-009 §2, domain-model R-1 | P04, P07 | per-endpoint negative tests: user B against user A's IDs |
| T-ID-03 | TB-1, TB-4 | Tokens leaked through URLs (server logs, `Referer`, history) | Tokens in fragments only; the SPA POSTs them; `no-referrer` on those routes; query strings never carry secrets | ADR-036 §7, ADR-034 | P06 | test: the verify route makes no request with the token in the URL |
| T-ID-04 | TB-1, TB-3 | EXIF/GPS and other metadata in photos | Full re-encode drops all metadata, and the master is stored re-encoded | ADR-009 §3 | P07, P13 | fixture with GPS: no EXIF in master or rendition |
| T-ID-05 | all | **Resume content, contact data, passwords, tokens or photo bytes in logs, telemetry or error messages** | No request/response body logging; structured logs with allow-listed fields (IDs, codes, durations); validation errors carry paths and codes, never values; Mongo command logging off; client events carry no content; architecture rule F-BE-5 | `.claude/rules/03`, ADR-008 F-BE-5, ADR-010 §8 | P04, P07, P13 | log-scan test: run the fixture suite and assert that no fixture string appears in captured logs |
| T-ID-06 | TB-6 | Local drafts, queues, cached thumbnails and cached photos readable by the next person on a shared device | Data namespaced per user, the thumbnail cache included (`(userId, resumeId, version)`); sign-out offers "remove local data from this device" (with a warning if unsynced), which also clears the thumbnail namespace; photo renditions are served `private, no-cache` with `ETag`, so every use revalidates with the session; the guest draft can be discarded; nothing beyond IDs in localStorage | ADR-015, ADR-037 §4, ADR-009 §2, ADR-010 §9 | P06, P08, P11 | component tests; header test on photo responses |
| T-ID-07 | TB-1 | Third-party trackers, CDNs or fonts leaking usage or personal data | CSP `default-src 'self'` (no third-party script, font, frame or connect sources); self-hosted fonts; no analytics or CAPTCHA services | ADR-012 §4, ADR-003 | P05, P14 | CSP header test; dependency review |
| T-ID-08 | TB-2…TB-4 | Data residency breach (a processor, replica or backup outside the EU) | Region pinning; EU pair; sub-processor list with DPAs; checked before release | ADR-012 | P15 | release checklist |
| T-ID-09 | TB-2, TB-3 | A restore brings back erased accounts, resumes deleted permanently or purged, or removed and replaced photos | Deletion ledger with `account`, `resume` and `photo` entries (IDs only), written before each deletion and mirrored to an append-only blob container outside the restore scope; every restore reconciles before traffic resumes: ledger re-apply, due trash purges, expired snapshots, orphan-blob sweep; backups expire ≤ 30 days, ledger entries after 35 days | ADR-039 §3–§4, ADR-009 §7 | P07, P13 | restore drill test: restore to a point before each deletion (erased account, resume deleted permanently before 30 days, purged resume, removed photo, replaced photo) and assert each stays gone |
| T-ID-10 | TB-5, repo | Secret leakage (repository, images, CI logs) | Key Vault and managed identities; OIDC; `.env.example` with placeholders only; secret scan in the handoff check and in CI | ADR-033, `.claude/rules/03` | P03 | scanner evidence |
| T-ID-11 | TB-1 | XSS leading to content or session theft | Rich text is an AST rendered as React text nodes; no `dangerouslySetInnerHTML` with user data; strict CSP without `unsafe-inline` scripts; HttpOnly cookies | ADR-010, ADR-036 | P05, P09, P11 | lint rule; XSS payload fixtures in rich text and titles |
| T-ID-12 | TB-1 | Interception or caching of the account data export | Re-auth ≤ 5 min; verified address required (server-side for this endpoint); HTTPS; `no-store`; rate limit 3/h; the archive is assembled in the browser | ADR-036 §10, ADR-039 §6, ADR-038 | P06, P13 | tests: no re-auth → 401; unverified → 403 |

### 4.5 Denial of service

| ID | TB | Threat | Mitigation | Ref | Phase | Verification |
|---|---|---|---|---|---|---|
| T-DS-01 | TB-1, TB-4 | Flooding of auth endpoints; e-mail bombing of a victim's address | Per-IP and per-address limits; ≤ 5 account e-mails per address per hour; outbox decouples sending | ADR-038, ADR-034 | P06 | 429 tests |
| T-DS-02 | TB-1, TB-2 | Write flooding or huge documents | `doc-write` 120/min per user; 1 MB body; NFR-12 limits | ADR-038, domain-model §6 | P07 | limit tests |
| T-DS-03 | TB-1, TB-3 | Storage exhaustion through uploads | 20 uploads/h per user; 5 MB; one photo per resume (blobs replaced, old ones deleted); ≤ 200 resumes | ADR-009, ADR-016, ADR-038 | P07, P13 | tests: replaced photo leaves no orphan blobs |
| T-DS-04 | TB-1 | Victim lock-out by repeated failed logins | Time-boxed back-off (max 1 h), not a permanent lock; reset still works | ADR-036 §9 | P06 | test: back-off expires |
| T-DS-05 | TB-1 | Expensive validation (ReDoS, deep recursion) | No backtracking regex on user input (`NonBacktracking` or timeouts); JSON depth limit; iterative AST validation | ADR-038 §3 | P04, P07 | fuzz-ish negative tests |
| T-DS-06 | device | Client freeze on a maximum-size document | NFR-12 limits; layout off the main thread if P10/P11 measurements need it | ADR-010 §6 | P11 | performance fixture at maximum size |

### 4.6 Elevation of privilege

| ID | TB | Threat | Mitigation | Ref | Phase | Verification |
|---|---|---|---|---|---|---|
| T-EP-01 | TB-1 | Broken object-level authorization on resumes, photos, snapshots, trash, restore and copy | Owner taken from the session only, never from the body; repository methods require `ownerId`; 404 for foreign IDs; copying a foreign resume is impossible | domain-model R-1, ADR-008 | P04, P06, P07 | per-endpoint cross-user negative tests (Must) |
| T-EP-02 | TB-1 | Broken function-level authorization (anonymous or unverified access to protected operations) | Fallback policy "authenticated" on every endpoint; explicit anonymous allow-list (sign-up, login, verify, resend, reset, health); `emailVerified` enforced server-side on data export | ADR-036, ADR-013 | P04, P06 | endpoint inventory test (every endpoint declares its policy) |
| T-EP-03 | TB-1 | Mass assignment of server-owned fields (`ownerId`, `version`, `createdAt`, `lastWrite`, `emailVerifiedAt`, storage keys) | Write schemas exclude them; explicit mapping; unknown fields rejected | ADR-037, domain-model §3 | P02, P07 | contract negative tests |
| T-EP-04 | device | Bypassing the client-side export gate for unverified users | **Accepted risk.** Export runs only on the user's own content in their own browser; no server resource or other user's data is involved | ADR-013, ADR-010 | P12 | documented acceptance; re-checked in P12, where the client exports are built (PD-P01-10) |
| T-EP-05 | TB-2, TB-3, TB-7 | A compromised API container reaches beyond its needs | Managed identity scoped to the photo container; DB user scoped to the app database; non-root minimal images; operator access through RBAC and JIT with audit | ADR-033 | P03, P15 | IaC review |
| T-EP-06 | TB-5 | CI compromise deploying malicious code | `permissions: contents: read` by default; OIDC bound to protected environments and branches; pinned actions; required review on deploy | ADR-033 | P03, P15 | workflow review |

## 5. Mandatory topics (`.claude/rules/03-security-privacy.md`)

| Topic | Design summary | Threats |
|---|---|---|
| **Authentication** | First-party e-mail and password; PBKDF2 at 210k; server-side revocable sessions; strict cookie; tokens hashed, single use, in fragments; anti-enumeration; back-off and rate limits | T-SP-01…04, T-SP-06, T-SP-07, T-ID-01, T-ID-03, T-DS-01, T-DS-04, T-EP-02 |
| **Guest-to-account claim** | No guest backend; the claim is a normal create (validated, limited, idempotent) after explicit confirmation; drafts namespaced on the device | T-SP-05, T-ID-06, T-TA-02, T-DS-02 |
| **Object storage access** | Private containers; API-mediated owner-checked access; managed identity; opaque owner-prefixed keys; re-encoded masters; EU-only, with backup expiry and ledger re-apply | T-EP-01, T-ID-02, T-ID-04, T-TA-04, T-DS-03, T-EP-05, T-ID-09 |
| **Export endpoints** | **No server PDF/TXT export endpoint** (ADR-010): no SSRF, no headless browser, no stored exports. The only server "export" is the account data endpoint: re-auth, verified, `no-store`, rate-limited. Client exports use the link scheme allow-list and content-free telemetry | T-ID-12, T-EP-01, T-EP-02, T-TA-03, T-EP-04, T-ID-05, T-ID-07 |

## 6. Privacy (GDPR, NFR-09)

| Data | Purpose | Lawful basis | Location | Retention / deletion |
|---|---|---|---|---|
| Account (e-mail, hash, timestamps) | provide the service | contract (Art. 6(1)(b)) | EU | until account deletion ≤ 24 h (ADR-039) |
| Resume content and photos | provide the service | contract | EU, plus the user's device | user-controlled; trash 30 days; purge on deletion |
| Snapshots (Should) | version history | contract | EU | 30 days |
| Security logs (IDs, IP addresses) | security and abuse prevention | legitimate interest (Art. 6(1)(f)) | EU | 30 days |
| E-mail metadata | account e-mails | contract | EU (provider data location) | outbox 7 days; provider per DPA |

Rights:
- access and portability: FR-ACC-04 archive (ADR-039 §6);
- erasure: FR-ACC-03 (ADR-039 §2);
- rectification: the editor.

No trackers in the editor (T-ID-07). Users are not profiled and no decisions are automated. A DPIA note and the sub-processor list are P15 deliverables.

## 7. Security requirements handed to later phases

| Phase | Must carry |
|---|---|
| P02 | 401/403/404/409/412/422/428/429 semantics; antiforgery header; `ETag`/`If-Match`/`Idempotency-Key`; no echo of values in errors; write schemas without server-owned fields; no export-file endpoints; content-free client events |
| P03 | secret scanning; lockfiles; SHA-pinned actions; image digest pinning; dependency scanning; `.env.example` placeholders |
| P04 | fallback auth policy; endpoint-policy inventory test; logging allow-list (F-BE-5); body and depth limits; forwarded-headers trust; security headers (CSP from the web container, HSTS, `nosniff`, `frame-ancestors 'none'`) |
| P05 | CSP-compatible build (no inline scripts); self-hosted fonts; lint against `dangerouslySetInnerHTML` |
| P06 | everything in ADR-036 and ADR-038 for auth; T-SP-*, T-ID-01/03/12 tests |
| P07 | owner filter and cross-user tests; upload pipeline; URL scheme validation; idempotency store |
| P08 | per-user namespacing of local data; claim confirmation; conflict copy |
| P09, P11, P12 | AST-only rendering; render-time URL allow-list; PDF link annotations limited to allowed schemes |
| P13 | purge jobs, deletion ledger, restore drill, log-scan test, abuse tests, key rotation runbook |
| P15 | DNS (SPF, DKIM, DMARC), region and sub-processor verification, IaC least-privilege review, alerting, DPIA note |

## 8. Residual risks

| ID | Risk | Rating | Handling |
|---|---|---|---|
| RR-1 | US-parented processors (Microsoft, MongoDB Inc.) under SCCs | medium | ADR-012 EU-owned migration path; owner review (ADR-035 A-6) |
| RR-2 | Per-instance rate-limit counters allow N× bursts with N instances | low | global counters for login and e-mail are in Mongo; scale-out is small in v1 |
| RR-3 | Client-side export gate can be bypassed | low (own data only) | accepted (T-EP-04) |
| RR-4 | Shared-device exposure of local drafts | medium | T-ID-06 controls; user guidance in the UI |
| RR-5 | Image decoder vulnerabilities | medium | re-encode, limits, patched library, non-root container (T-TA-04) |
| RR-6 | With login before verification, someone who signs up with an unregistered address and a password of their choice learns from a successful login that the address was unregistered | low (reveals non-existence only; sign-up opens no session) | accepted (ADR-036 §8; squatting is T-SP-07) |

## 9. Threat-model checklist

- [x] Data-flow diagram with trust boundaries (§1, §3)
- [x] Asset inventory (§2)
- [x] STRIDE coverage: Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege (§4.1–§4.6)
- [x] Authentication (§5)
- [x] Guest-to-account claim (§5)
- [x] Object storage access (§5)
- [x] Export endpoints (§5)
- [x] No resume content in logs (T-ID-05)
- [x] Password hashing with a modern adaptive algorithm (T-SP-01, ADR-036)
- [x] Image re-encoding and EXIF stripping (T-TA-04, T-ID-04)
- [x] Owner authorization on every resource (T-EP-01)
- [x] Secrets outside the repository (T-ID-10)
- [x] EU data residency (T-ID-08, ADR-012)
- [x] Account deletion and data export (T-ID-09, T-ID-12, ADR-039)
- [x] No third-party trackers (T-ID-07)
- [x] Rate limiting and abuse (T-DS-01…06, ADR-038)
- [x] Supply chain (T-TA-06, T-EP-06)
- [x] Each threat has a mitigation, a reference, an owner phase and a verification (§4)
