# Dependencies

P00

List external services, packages, tools, phase outputs and owners.

## Phase inputs

| Input | Owner | Status |
|---|---|---|
| P00 gate (`docs/phases/P00/PHASE-STATUS.md`) | Program Coordinator | COMPLETED 2026-11-02 |
| P00 GOV-04 decision-owner register, GOV-05 conflict log, owner answers Q-1…Q-5 | P00 | accepted |
| ADR-035 (autonomous execution, delegation) | owner | Accepted 2026-11-02 |
| TECHNICAL-SPEC "0.1 draft · 2026-10-24" | product owner | baseline (P00 GOV-01) |

## Tools used in P01

- Python 3, standard library only: `scripts/check-blueprint.py`, `scripts/phase-handoff-check.py`, and the P01 check module (kickoff §3).
- No package, framework or service is installed in P01.

## External services decided (on paper; implemented later, go-live owner actions in decisions.md §5)

| Service | Decision | Local stand-in | First used | Owner of setup |
|---|---|---|---|---|
| Azure (Container Apps, ACR, Key Vault, Log Analytics, Blob Storage), Germany West Central | ADR-033, ADR-009, ADR-012 | Docker Compose; Azurite | P03 (local), P15 (cloud) | owner (account), P15 (IaC) |
| MongoDB Atlas on Azure, Germany West Central | ADR-004 | `mongo:8` single-node replica set | P03 | owner (account), P15 |
| Azure Communication Services Email (Europe) or the EU fallback | ADR-034 | Mailpit | P03 / P06 | owner (domain, DNS), P15 |
| GitHub Actions | ADR-033 | the local CI script | P03 | owner (repository) |

## Downstream consumers of P01 outputs

| Phase | Consumes |
|---|---|
| P02 | domain-model, phase-plan §7, ADR-002/003/009/010/013/014/016/019–025/029/036–039; decides ADR-006 and ADR-040 |
| P03 | ADR-002, ADR-003, ADR-004, ADR-009, ADR-012, ADR-033, ADR-034; threat model §7 (P03 row) |
| P04, P05 | ADR-007, ADR-008 fitness rules; threat model §7 |
| P06 | ADR-013, ADR-014, ADR-015, ADR-034, ADR-036, ADR-038 |
| P07, P08 | domain-model; ADR-009, ADR-015, ADR-016, ADR-023, ADR-029, ADR-037 |
| P10, P11, P12 | ADR-010 (prototype gate at the P10 start), ADR-025 |
| P13, P15 | ADR-039, ADR-012, threat model §7–§8, decisions.md §5 |
