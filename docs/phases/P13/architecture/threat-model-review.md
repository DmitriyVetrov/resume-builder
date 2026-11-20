# P13 Threat-Model Re-Review

Baseline: `docs/phases/P01/architecture/threat-model.md` (§4 register, §7 "P13: purge jobs, deletion ledger, restore drill, log-scan test, abuse tests, key rotation runbook"). Re-reviewed at step 7 against the built system on 2026-11-13 by the operator; the independent check is the external review in `review/code-review.md`. Evidence IDs are P13 tests (`tests/test-plan.md`) and step 7 results (`tests/test-results.md`, `qa-report.md`).

## Threats assigned to P13

| Threat | Mitigation as built | Evidence | Status |
|---|---|---|---|
| T-SP-02 credential stuffing | Per-account back-off keyed by account, stored in MongoDB, independent of client address and replica; per-IP login limit; no enumeration | Real stack: 5 failures from 5 addresses → 429 `Retry-After: 60` on the 6th and 7th, right password refused during back-off (DD-P13-29) | Closed for P13; failure-rate alert is P15 |
| T-TA-04 hostile images | Magic-byte detection, header dimension check before decode, re-encode | U01–U05: 65 000 px bombs refused from the header within 2 s, truncated PNG/JPEG, SVG and HTML as `image/png`, empty file; nothing stored | Closed |
| T-RE-01 disputed security actions | **Not built**: no security audit events with user ID and IP | — | **Open, carried to P15 (DD-P13-30)** |
| T-RE-02 disputed data loss | "Saved" only after a majority ack; replay of a lost ack; local queue through 503 bursts | D05 (every write path majority, cluster default majority); RS01 lost ack replayed with one version; RS02 five 503s then saved; S07 Mongo paused: 503, never 2xx, keyed write applies once after | Closed |
| T-ID-04 photo metadata | Full re-encode | P07 GPS fixture tests, unchanged; U-tests store nothing on refusal | Closed |
| T-ID-05 content in logs | Allow-listed `LoggerMessage` events; production floor `None` with counts-only categories re-enabled (DD-P13-21) | O01 canary journey at Trace, every category, every job and reconciliation: no canary string in any message, state or exception; O02 production filters | Closed |
| T-ID-09 restore resurrects deleted data | Dual ledger; `reconcile-restore` runs ADR-039 §4 steps 1–6 before traffic | D02 drill over all five cases; D03 blob-only entries loaded and written back, second run changes nothing; D04 real binary; real-stack drill: restored resume purged again, 4 entries written back from the blob copy, second run zeros | Closed |
| T-ID-12 export interception | Re-auth, verified address, `no-store`, 3/h, built in the browser, nothing stored | UI01–UI03, L01, L02, RS03, RS04; P06 server tests | Closed |
| T-DS-03 storage exhaustion | Upload limits; replaced and removed photos leave no blobs; orphan sweep | U-tests; D02 replaced and removed photo stay gone; reconciliation step 6 orphan sweep | Closed |
| Key rotation runbook (§7) | Runbook §5: routine and emergency rotation, effects, client CSRF retry | `docs/operations/runbook.md` §5 | Closed (P15 wires Key Vault) |

## Threats P13 touched although assigned elsewhere

| Threat | What changed | Evidence |
|---|---|---|
| T-SP-03 session theft | HSTS from the API in Production (DD-P13-19) and from the web image | S05; real stack: `max-age=31536000; includeSubDomains` for a non-loopback host |
| T-TA-05 CSRF | The client single-flights its bootstrap and retries a mutation **once** after `csrf_token_invalid`. Antiforgery validation runs before any effect, so the retried request had no effect the first time; a forged request without the token is still 403 | S08 (20 concurrent bootstraps on a fresh key ring, forged and crossed tokens 403); C01–C04; real stack cold start: no 403 in 50 requests |
| T-ID-07 third-party leakage, T-ID-11 XSS | CSP `default-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`; styles allow `'unsafe-inline'` only (Radix) | W01 on the web image; L03 in three browsers: no violation, nothing leaves the origin; whole fixture suite (373 tests) runs under it |
| T-EP-01, T-EP-02 authorization | Every contract operation classified; an unclassified one fails the test | S01–S04: anonymous 401, cross-owner 404 with nothing changed, no session after a deletion request |
| T-ID-08 residency | The application reaches only its own origin and configured stores | AR01 (no outbound HTTP client), L03, runbook §6 checks; production evidence is P15 (DD-P13-24) |

## New surface introduced by P13

| Surface | Threat | Mitigation | Residual |
|---|---|---|---|
| `reconcile-restore` command | Runs with the API's secrets; a mistaken run during traffic | No HTTP listener, no hosted job (D04); idempotent: a second run changes nothing (D03, real stack); it only deletes what the ledger or the 30-day rules already deleted | Running it with traffic on is safe but the runbook says traffic off, so restored data is never served before it is deleted again |
| `job_leases` collection | A stuck lease stops a job | A lease lasts one period and is taken over when it expires (J01, J02); runbook §3 says how to force a run | A crashed holder delays a job by at most one period |
| Trash-expiry purge | Purging a resume the user restores at the same moment | Conditional first phase: a restore that lands first wins (J04) | None |
| Browser-built archive | All account data in browser memory and a download | Same-origin fetches only (CSP), re-auth, verified address, no storage, Cancel drops the parts | The file is the user's to protect, as for any export (T-EP-04 accepted risk) |
| `ReverseProxy:TrustedNetworks` | A CIDR wider than the ingress lets clients forge `X-Forwarded-For` and spread one client over many per-IP buckets | Only addresses inside the configured networks are trusted (S06); runbook §7 names the ingress CIDR | Configuration error at P15 would weaken per-IP limits; the per-account back-off still holds |
| nginx headers in the web image | Header drift | W01 checks every header on `/`, `/index.html` and a deep link | None |

## Result

No blocker or critical threat is open. One mitigation from the P01 register is missing, T-RE-01 security audit events, and is carried to P15 with the log workspace that would hold them (DD-P13-30). P15 also owns the alert rules (T-SP-02), the production residency evidence (T-ID-08) and the Key Vault wrapping of the key ring.
