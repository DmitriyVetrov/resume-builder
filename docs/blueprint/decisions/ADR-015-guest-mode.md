# ADR-015 — D-03: guest mode

- Status: **Accepted** (`DELEGATED-DEFAULT`, ADR-035 A-4)
- Decider: Solution Architect (delegated, ADR-035)
- Date: 2026-11-02 (P01, decisions.md DD-P01-17)
- Source IDs: D-03 (TECHNICAL-SPEC §12, recommendation "Yes for first-time users; claim on sign-up"); FR-ACC-06 (Could); FR-PER-02; ADR-013 (export needs a verified account)

## Context

Guest mode lets a first-time visitor build a resume without an account, keeps it in the browser, and claims it after sign-up. P00 rule 03 requires the guest-to-account claim to be threat-modelled.

## Decision

**Yes, as a Could feature in v1, with no guest-specific backend:**
- A guest edits **one local draft**. It is stored only in the browser (IndexedDB) through the same local persistence layer as the offline queue (ADR-037). The server receives nothing.
- Preview works for guests, because layout is client-side (ADR-010). **Export requires a verified account** (ADR-013), so guests are asked to sign up before export.
- **Claim:** after sign-up or login, the SPA asks "Save this draft to your account?" and shows the draft's title.
  - On confirmation it calls the normal create-resume endpoint with the draft document and an `Idempotency-Key` (ADR-037), then uploads the photo through the normal photo endpoint.
  - On success the local draft is deleted. The user can also "Discard draft".
- If the claim would exceed the 200-resume limit (NFR-12), the draft stays local and the user is told why.
- **Delivery:** P08 builds local persistence (shared with the offline queue). P06 builds the claim prompt. If capacity forces it out, it is a recorded exception: it is a Could item, not a release blocker.

## Alternatives considered

- **No guest mode in v1:** simpler, but contradicts the spec recommendation, and the client-side architecture makes it cheap. Rejected.
- **Server-side anonymous accounts:** stores personal data for unidentified users, and needs cleanup and a merge flow. Rejected.

## Rationale

Precedence step 1: the spec recommends "Yes". Reusing the offline persistence layer and the normal create endpoint adds no new server attack surface.

## Consequences

- P02 has no guest endpoints. The create endpoint must accept a full document (it also serves copy, conflict copy and claim).
- The threat model covers local-draft privacy on shared devices (T-ID-06) and claim confirmation (T-SP-05).

## Security/privacy impact

The draft never leaves the device until the user confirms the claim. Drafts are namespaced so they cannot be replayed into another user's account without explicit confirmation. The claim goes through the same validation, limits and owner assignment as any create.

## Owner and date

Solution Architect (delegated, ADR-035), 2026-11-02.
