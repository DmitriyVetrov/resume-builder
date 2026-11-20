# ADR-029 — D-17: concurrent edits in two tabs

- Status: **Accepted** (`DELEGATED-DEFAULT`, ADR-035 A-4)
- Decider: Solution Architect (delegated, ADR-035)
- Date: 2026-11-02 (P01, decisions.md DD-P01-25)
- Source IDs: D-17 (TECHNICAL-SPEC §12, recommendation "Reload the stale tab with a notice"); FR-PER-03 (AC "Last-writer conflict shows a notice and keeps both versions"); FR-PER-02; NFR-10; ARCHITECTURE.md §6; conflict SC-01; ADR-037

## Context

SC-01: the FR-PER-03 AC says "shows a notice and keeps both versions", and the §12 recommendation says "reload the stale tab with a notice". Both must hold without silent loss (NFR-10).

## Decision

This reconciles the two texts. No merge in v1.
1. A write with a stale `If-Match` gets **412** (ADR-037). The server never overwrites the newer version.
2. If the stale tab has **no unsynced edits**, it reloads the latest version and shows a notice: "This resume was changed in another tab or device. Showing the latest version."
3. If the stale tab **has unsynced edits**, it:
   - first saves them as a **conflict copy**, a new resume titled `<title> (conflict copy)` created through the normal create endpoint with an `Idempotency-Key`;
   - then reloads the latest version;
   - shows a notice that links to the copy: "Your unsaved changes were kept in '<title> (conflict copy)'."
   Both versions are kept: FR-PER-03 AC and the D-17 recommendation hold together.
4. If the conflict copy cannot be created (the 200-resume limit, or offline), the unsynced edits stay in the local queue. The notice offers "Retry saving as a copy" or "Discard my changes". Nothing is dropped without explicit user action.
5. The same flow applies to offline edits replayed on reconnect (FR-PER-02) against a newer server version.
6. Tabs of the same browser may also use a `BroadcastChannel` to tell each other about new versions, so conflicts are rarer. This is an optimisation, not a guarantee.

## Alternatives considered

- **Automatic three-way merge:** complex, needs per-field merge rules, and D-17 does not require it. Rejected for v1.
- **Reload and discard the stale tab's edits:** silent loss, which violates FR-PER-03 and NFR-10. Rejected.
- **Last writer wins:** violates FR-PER-03. Rejected.

## Rationale

Precedence step 1: the recommendation (reload with a notice) is adopted, and the AC's "keeps both versions" is satisfied by the conflict copy. This needs no new API beyond create.

## Consequences

- P02: the 412 error code and payload.
- P08: the conflict flow and notices.
- P13/P14: stale-tab and offline-replay E2E tests.
- `ARCHITECTURE.md` §6 is updated to reference this ADR (OOS-03).

## Security/privacy impact

The conflict copy is created under the same owner with the same validation. No content goes into error payloads or logs.

## Owner and date

Solution Architect (delegated, ADR-035), 2026-11-02.
