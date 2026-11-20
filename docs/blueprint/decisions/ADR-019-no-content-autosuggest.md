# ADR-019 — D-07: no content autosuggest (principle P1 of TECHNICAL-SPEC §2)

- Status: **Accepted** (`DELEGATED-DEFAULT`, ADR-035 A-4)
- Decider: Solution Architect (delegated, ADR-035)
- Date: 2026-11-02 (P01, decisions.md DD-P01-19)
- Source IDs: D-07 (TECHNICAL-SPEC §12, recommendation "No (P1); country/month pickers only"); exclusion X4; TECHNICAL-SPEC §2 principle P1; §5.6 (date picker); FR-HDR-03; conflicts SC-11, SC-22, SC-26

## Context

X4 excludes content-level autosuggest and is tagged [DECISION D-07]. The recommendation's "P1" means **principle P1 of TECHNICAL-SPEC §2** ("No AI, no content suggestions"), not phase P01 (SC-22). SC-26 asks where a country picker would apply.

## Decision

- **No autosuggest** of any content: job titles, degrees, languages, skills, organisations. X4 stays excluded.
- **Allowed input controls:** the month and year picker for entry dates (§5.6 "picker + typing") and the "Present" checkbox. These choose values; they do not suggest content.
- **No country picker in v1** (SC-26). Entry *Location* (§5.6) and contact items (FR-HDR-03) are free text by principle P2. A picker would constrain them. The recommendation's "country picker" has no field to attach to without changing the model.
- The browser's own form autofill is not disabled for account fields. Resume fields set `autocomplete="off"` so that the browser does not offer content suggestions.

## Alternatives considered

- **A country picker for Location:** contradicts free-text Location (§5.6, P2). Rejected.
- **Dictionary autosuggest:** excluded by X4 and principle P1. Rejected.

## Rationale

Precedence step 1: the spec recommendation and the strict exclusion reading (P00 PD-P00-05, owner-confirmed as Q-2).

## Consequences

P02 has no suggestion endpoints. P08 and P09 implement the date picker only.

## Security/privacy impact

None. No dictionary services and no third-party calls.

## Owner and date

Solution Architect (delegated, ADR-035), 2026-11-02.
