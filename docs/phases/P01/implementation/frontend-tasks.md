# Frontend Tasks

P01 has **no frontend implementation tasks** and the Frontend Developer is not dispatched (PD-P01-04). P01 changes no file under `frontend/`.

## Downstream frontend obligations created by P01 ADRs

This list is for the Solution Architects of later phases. It is not a work order for P01, and each phase plan turns its rows into tasks with tests.

| ID | Phase | Obligation | Source |
|---|---|---|---|
| FE-OBL-01 | P05 | TypeScript strict, Node 24 LTS, npm with lockfile, Vite SPA, Tailwind 4 Vite plugin; `/api` same-origin client; lint rules F-FE-1…F-FE-3 | ADR-003, ADR-008 |
| FE-OBL-02 | P05 | CSP-compatible build (no inline scripts); self-hosted fonts; no third-party scripts, fonts or CDNs; lint against `dangerouslySetInnerHTML` with user data | ADR-012 §4, threat model T-ID-07, T-ID-11 |
| FE-OBL-03 | P06 | Auth screens; fragment-token routes that POST the token (`no-referrer`); export gate on `emailVerified`; guest claim prompt with confirmation; "remove local data" on sign-out | ADR-036, ADR-013, ADR-015 |
| FE-OBL-04 | P08 | Autosave queue in IndexedDB per user: one in-flight write, coalescing (a coalesced body always gets a new `Idempotency-Key`; 422 `idempotency_key_reused` is never shown as Saved), back-off, `If-Match`, `Idempotency-Key`; a 400 is not retried (domain-model R-8); statuses Saved, Saving…, Offline; conflict copy flow; guest local draft; last selected section in localStorage | ADR-037, ADR-029, ADR-015, DD-P01-27 |
| FE-OBL-05 | P09 | Rich-text AST editor; paste sanitisation to the AST; render-time URL scheme allow-list | domain-model §3.8, threat model T-TA-03 |
| FE-OBL-06 | P10 | **Rendering prototype gate first** (ADR-010 §6, G1–G7), then template data (tokens, per-type `listColumns` and `placement` defaults) | ADR-010, ADR-025, DD-P01-28 |
| FE-OBL-07 | P11 | Layout engine → PageModel; preview painter; pagination priority; zoom; page counter; thumbnails per `(userId, resumeId, version)`; mismatch telemetry | ADR-010 §1–§2, §8–§10 |
| FE-OBL-08 | P12 | Browser PDF writer (embedded subset fonts, links with the allowed schemes, metadata, deterministic dates); TXT serializer per §9; client-assembled data archive | ADR-010 §3–§7, ADR-039 §6 |
