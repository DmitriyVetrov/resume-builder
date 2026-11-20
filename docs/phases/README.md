# Phase Roadmap

For phases with user-facing frontend work, the Solution Architect must apply [UI and UX design planning](../blueprint/UI-UX-DESIGN.md). Establish the shared Tailwind CSS 4 visual direction in P06 and deliver each screen's visual design and UX with its owning feature phase. P14 consolidates verification across the application.

- [P00 — Project Governance & Source Baseline](./P00/PHASE.md) — dependencies: none
- [P01 — Solution Architecture & ADRs](./P01/PHASE.md) — dependencies: P00
- [P02 — API Contract v1](./P02/PHASE.md) — dependencies: P01
- [P03 — Infrastructure & DevEx](./P03/PHASE.md) — dependencies: P01, P02
- [P04 — Backend Foundation](./P04/PHASE.md) — dependencies: P02, P03
- [P05 — Frontend Foundation](./P05/PHASE.md) — dependencies: P02, P03
- [P06 — Identity & Accounts](./P06/PHASE.md) — dependencies: P04, P05
- [P07 — Resume Domain, Library & Persistence](./P07/PHASE.md) — dependencies: P04, P05, P06
- [P08 — Editor Workspace & Autosave](./P08/PHASE.md) — dependencies: P07
- [P09 — Rich Text Engine](./P09/PHASE.md) — dependencies: P08
- [P10 — Templates & Design Controls](./P10/PHASE.md) — dependencies: P08, P09
- [P11 — Shared Layout & Preview Engine](./P11/PHASE.md) — dependencies: P09, P10
- [P12 — PDF & TXT Export](./P12/PHASE.md) — dependencies: P11
- [P13 — Reliability, Security & Data Lifecycle](./P13/PHASE.md) — dependencies: P06, P07, P08, P12
- [P14 — Cross-stack Integration & E2E](./P14/PHASE.md) — dependencies: P06, P07, P08, P09, P10, P11, P12, P13
- [P15 — Production Readiness & Release](./P15/PHASE.md) — dependencies: P14
