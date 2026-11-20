# ADR-012 — EU hosting and data residency (D-20; also closes ADR-032)

- Status: **Accepted** (`DELEGATED-DEFAULT`, ADR-035 A-4). It was a release blocker and is now decided.
- Decider: Solution Architect (delegated, ADR-035)
- Date: 2026-11-02 (P01, decisions.md DD-P01-08)
- Source IDs: D-20 (TECHNICAL-SPEC §12, recommendation "EU"); NFR-09 (data stored in the EU, no third-party trackers in the editor), NFR-10, FR-ACC-03, FR-ACC-04; register ADR-012 and its duplicate ADR-032 (same decision, kept for ID stability)

## Context

NFR-09 requires EU data storage and marks it [DECISION D-20]. The spec recommends "EU". P00 classified D-20 as a release blocker, needed by P01.

## Decision

1. **Residency rule.** All personal data is **stored and processed in the EU/EEA**:
   - accounts, resumes, photos, sessions and tokens;
   - backups, logs and metrics that contain identifiers;
   - email processing data.
   This includes data at rest, backups, replicas and support access paths.
2. **Primary region:** Azure **Germany West Central** (Frankfurt). Geo-redundant copies go only to its paired region **Germany North**. Every managed service (ADR-004 Atlas cluster, ADR-009 storage, ADR-033 compute, registry and logs, ADR-034 email) is pinned to these regions or to its provider's "Europe" data location.
3. **Sub-processors.** A service may sit in the personal-data path only if it:
   - offers EU data residency;
   - has a GDPR Data Processing Agreement, with Standard Contractual Clauses where the parent company is outside the EEA;
   - is listed in the go-live record of sub-processors (P15).
4. **No third-party trackers or CDNs in the editor:**
   - no analytics SDKs, tag managers, font CDNs or third-party CAPTCHA;
   - static frontend assets are served from our EU origin;
   - CSP enforces this (threat model T-ID-07).
5. **Development and CI** use only synthetic or fixture data (owner-approved reference-CV content, P00 Q-5). Production data never leaves production, and production is not used for testing.
6. **Implementation before go-live** uses local Docker services (ADR-035 §C). The paid accounts and region pinning are go-live owner actions (decisions.md §5).

## Alternatives considered

- **Any region, relying on SCCs only:** contradicts NFR-09 "stored in the EU". Rejected.
- **An EU-headquartered cloud only** (for example Hetzner, OVHcloud, Scaleway): removes non-EU parent-company exposure, but has fewer managed services (managed MongoDB with PITR, email, managed identity), so we would carry more operations. It is a reversible alternative: everything is OCI containers, the MongoDB protocol, and SMTP. Not chosen for v1. It is recorded as the migration path if the owner later requires EU-owned providers.
- **West Europe (Netherlands) or Sweden Central:** equally compliant. Germany West Central was chosen because its pair stays inside one EU member state.

## Rationale

This follows the spec recommendation literally ("EU"). One region with an in-country pair keeps the residency audit simple. Managed services with EU pinning meet NFR-10 (PITR, backups) without our own operations.

## Consequences

- ADR-004, ADR-009, ADR-033 and ADR-034 reference this region.
- P13 adds residency checks to the operations runbook.
- P15 verifies the region of every resource and the sub-processor list before release.
- The register item D-20 / ADR-012 / ADR-032 is no longer a release blocker at the decision level. The go-live verification is a P15 checklist item.

## Security/privacy impact

This satisfies the GDPR residency requirement in NFR-09. Remaining exposure: Microsoft and MongoDB Inc. are US-parented processors under SCCs and the EU Data Boundary commitments. It is recorded in the P15 DPIA note. The EU-owned migration path above is the mitigation if that is not acceptable.

## Owner and date

Solution Architect (delegated, ADR-035), 2026-11-02. The owner reviews it after the fact (ADR-035 A-6).

## Amendment 1 — EU processing suspended for the MVP/demo (owner, 2026-11-15)

Owner decision O-3 (handoff of 2026-11-14/15, change IMP-01): the project is a learning project without
official status, and a demo that impresses potential users matters more now than GDPR formalities.

- **§1 is suspended for processing.** Personal data is still **stored** in the EU/EEA, but it may be
  **processed** outside it. The case that needs this is CV import (ADR-055): the extracted CV text is sent to
  Claude on the Anthropic first-party API, which processes it in the US.
- **§3 is suspended.** A sub-processor need not offer EU data residency. Anthropic is such a sub-processor for
  CV import only.
- **§2 stays as built** (Azure Germany West Central, paired with Germany North). **§4** (no trackers or CDNs
  in the editor, CSP) and **§5** (synthetic data only in development and CI) **stay**.
- ADR-033 needs no change. NFR-09 ("data stored in the EU") still holds, because storage does not move.
- Formal GDPR measures (consent flow, DPA) are deferred (O-6). The import dialog carries one notice line:
  "The CV text is processed by Claude (Anthropic). The file and photo are not sent."
- The P15 sub-processor list gains Anthropic, and the P15 DPIA note records this suspension.
