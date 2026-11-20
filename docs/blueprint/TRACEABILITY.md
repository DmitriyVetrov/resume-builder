# Requirement Traceability

The detailed requirement catalog remains authoritative in `docs/source/TECHNICAL-SPEC.md`. This index maps major capability groups to phases. The detailed per-ID matrix is P00 GOV-02 (`docs/phases/P00/governance/requirements-traceability.md`). Architecture decisions per group are in `docs/phases/P01/architecture/phase-plan.md` §4.

| Requirement group | Planned phases | Principal verification |
|---|---|---|
| FR-ACC account flows | P06/P13 (deletion FR-ACC-03: aggregate proof closed in P13, AC-P13-03; data export FR-ACC-04: archive closed in P13, AC-P13-14) | API integration + E2E + security |
| FR-LIB resume library | P07 (FR-LIB-01 first-page thumbnail: closed in P11, DD-P07-15, AC-P11-11; FR-LIB-06 export from list: closed in P12, AC-P12-13) | Domain/application/API/UI tests |
| FR-EDT workspace | P08 (FR-EDT-01 NFR-01 clause and page-accurate FR-EDT-03: closed in P11, DD-P08-01, AC-P11-03, AC-P11-08; Design tab controls: P10; export actions: closed in P12, DD-P08-02, AC-P12-01) | Component + E2E + accessibility |
| FR-HDR header/contact | P07/P08 | Domain/API/component tests |
| FR-PHO photo upload/crop | P07/P08/P13 (upload abuse closed in P13, AC-P13-08) | Upload validation, EXIF stripping, crop/rendition tests |
| FR-SEC sections/order/undo | P07/P08 | Domain invariants + E2E + keyboard |
| FR-TYP section types/entry fields | P07/P08 (FR-TYP-03 export check: closed in P12, AC-P12-12) | Domain invariants + component tests |
| FR-RTE rich text | P09 | AST/parser/serializer/component tests |
| FR-TPL templates | P10 | template fixtures + visual regression |
| FR-CLR colors | P10 | contrast + rendering tests |
| FR-LAY layout controls | P10/P11 (FR-LAY-09 hyphenation clause not delivered, DD-P11-13) | layout unit + rendering tests |
| FR-PRV preview | P10 (prototype gate, ADR-010 §6)/P11 | shared layout contract + visual diff |
| FR-PDF PDF export | P12 | PDF metadata/text/font/link/page tests |
| FR-TXT TXT export | P12 | golden-file tests |
| FR-PER autosave/undo/reliability | P08/P13 | offline/concurrency/recovery tests |
| §8 pagination rules PG-01…PG-09 | P11 (priority in ADR-010 §10) | rendering fixtures at page boundaries |
| §9 TXT format | P12 | golden-file tests (UTF-8 without BOM, LF, no trailing spaces) |
| NFR security/privacy (NFR-08, NFR-09) | P01 (threat model, ADR-012, ADR-036, ADR-039)/P03/P06/P07/P13/P15 | threat model + security tests |
| NFR performance (NFR-01, NFR-02, NFR-03) | P10 (prototype gate G3/G4)/P11/P12/P15 | load/performance tests |
| NFR accessibility (NFR-06) | P05/P08/P10/P15 | automated + manual keyboard audit |
| NFR-04 WYSIWYG fidelity | P11/P12/P14 | ≥ 10 fixtures per template in CI |
| NFR-05 browsers | P05/P14 | browser matrix E2E |
| NFR-07 Unicode | P07/P10/P12 | fixtures with Spanish, Ukrainian, Slovak names; font coverage |
| NFR-10 reliability | P07/P08/P13 (restore drill and reconciliation, majority writes, fault injection: closed in P13, AC-P13-04/05/06/15)/P15 (backup policy applied) | ack/replay tests + restore drill |
| NFR-11 availability | P15 | monitoring + alerting |
| NFR-12 limits | P02/P07 | domain limit tests (positive + negative) |
| NFR-13 observability | P04/P11/P13 (log-scan canary journey and production filters: closed in P13, AC-P13-09/10) | log-scan test (no content) + event tests |
| NFR-14 determinism | P10 (prototype G6)/P11/P12 | byte-identical output tests |
