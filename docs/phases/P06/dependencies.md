# P06 Dependencies

| Input or service | P06 use | Owner / state |
|---|---|---|
| P02 OpenAPI 1.0.0 and ADR-006/040 | Single HTTP source; generated TS types and backend drift checks | Frozen, read-only; Contract Architect only if compatible change is separately approved |
| P04 backend host and xUnit/WebApplicationFactory suite | Routes, safe Problem/log pipeline, Mongo readiness and global rate limit | Completed; Backend Developer extends it |
| P05 React shell and generated type pipeline | Account routes, accessible navigation, typed same-origin fetch | Completed; Frontend Developer extends it |
| MongoDB 8 replica set (P03 Compose/Testcontainers) | Accounts, sessions, token hashes, outbox, rate counters and deletion ledger with durable writes | Infrastructure adapter; local Compose for integration |
| Mailpit SMTP locally; ACS Email in EU for production (ADR-034) | Verification, reset, deletion confirmation and generic account-exists mail | Backend adapter; production credentials/configuration are P15 go-live work |
| Private Blob/Azurite ledger store; Data Protection key ring (ADR-036/039) | Ledger copy before purge, session cookie protection | Backend adapter; EU production configuration and restore evidence are P13/P15 |
| xUnit v3, Testcontainers, WebApplicationFactory; Vitest/RTL and Playwright (ADR-041) | Domain/application, API and UI tests | Test Architect budgets cases; Test Engineer owns red tests |
| ADR-013…015, ADR-036…039; P01 threat model | D-01…03, password/session/CSRF, abuse and retention controls | Accepted; no new ADR needed |

## Outbound handoffs

- **P07:** `createResume`/`uploadPhoto`, owner-scoped resume/photo stores, and lifecycle integration for account deletion and data export. P07 cannot expose persistent resume creation until its data is included in account purge and export JSON, with ledger records for permanent removals.
- **P08:** IndexedDB guest draft and explicit claim through the normal create/photo calls; bind the P06 claim confirmation UI, retain the draft on failure/limit and clear it only after success.
- **P12:** current-version browser PDF/TXT generation with the verified-email product gate (ADR-013).
- **P13:** one ZIP archive with JSON, photo masters and generated PDF/TXT; progress/cancel/partial manifest; full deletion ledger restore reconciliation and aggregate deletion drill (ADR-039).
- **P15:** EU production email, Blob/Key Vault, key rotation, backup/ledger retention and privacy notice verification.

No paid account or secret is needed to test P06 locally. Root CI and infrastructure changes, if later required, need a separate owner and path grant; developers do not edit outside the P06 plan.
