# Dependencies — P00

## 1. Phase dependencies

None. P00 is the first phase (`docs/phases/README.md`: "P00 … dependencies: none").

## 2. Tools and packages

| Dependency | Version / scope | Used for | Owner | Notes |
|---|---|---|---|---|
| `python3` | Python 3, standard library only (observed on the dev machine on 2026-11-01: Python 3.13.5) | P00 executable checks (`docs/phases/P00/tests/`); existing `scripts/check-blueprint.py` | Test Engineer (checks); owner (machine) | Modules expected: `pathlib`, `re`, `hashlib`, `unittest`, `os`. **No third-party packages, no `pip install`** |
| POSIX shell | any | Running commands from the repository root | — | `sha256sum` (coreutils) is optional and only a convenience for the documentation implementer; checks must use `hashlib` |

No external services, network access, containers, databases, package registries or CI are required. CI does not exist before P03,
which may later run the P00 checks as a regression (proposal OOS-05).

## 3. Inputs (read-only)

| Input | Path | Owner | Use in P00 |
|---|---|---|---|
| Technical specification (normative) | `docs/source/TECHNICAL-SPEC.md` | Product owner | FR/NFR/PG/X/D IDs, sections, priorities; baseline version and hash |
| Reference-product research (evidence) | `docs/source/README.md`, `docs/source/img/`, `docs/source/export/` | Product owner | Inventory; spec-vs-research conflicts |
| Reference inputs index and CV | `docs/source/reference/README.md`, `docs/source/reference/SWE-Dmytro-Vietrov.pdf` | Product owner | Inventory; relocated references (K-16); contains personal data (inventory only, never copied) |
| Blueprint | `docs/blueprint/*.md`, `docs/blueprint/decisions/README.md` | Owner / Architect | Decision register statuses, traceability groups, gate policy, workflow and ownership |
| Phase definitions | `docs/phases/README.md`, `docs/phases/P00…P15/PHASE.md` | Architect | Phase IDs, objectives and DoD anchors for traceability and deadlines |
| Project rules | `CLAUDE.md`, `.claude/rules/*.md` | Owner | Scope, TDD, privacy, handoff rules |
| Structure check | `scripts/check-blueprint.py` | Owner | Must keep exiting 0 (AC-P00-21) |

## 4. People and roles

| Role | Responsibility in P00 |
|---|---|
| Product owner (Dmytro Vietrov, per TECHNICAL-SPEC header) | Approves the phase plan; answers Q-1…Q-5; accepts or rejects owner/deadline proposals and the P00 gate |
| Main session (Phase Coordinator) | Runs roles in order, takes SHA-256 scope snapshots, records owner acceptance in `decisions.md` §4 and `PHASE-STATUS.md` |
| Solution Architect | Phase plan and phase artifacts (step 1); documentation implementer for GOV-01…GOV-05 (step 4, separate invocation) |
| Test Architect | `tests/test-plan.md` |
| Test Engineer | Executable checks and fixtures in `docs/phases/P00/tests/`; red evidence |
| Code Reviewer | `review/code-review.md` |
| QA / Acceptance Agent | `qa-report.md` |
| Contract Architect, Backend Developer, Frontend Developer | Not involved (no API, backend or frontend scope in P00) |

## 5. Downstream consumers of P00 outputs

| Output | Consumer |
|---|---|
| GOV-02 traceability matrix | Every phase P01…P15 (scope and source IDs); P14 ("All Must requirements trace to passing test evidence") |
| GOV-03 exclusion register | Every phase's Code Reviewer (guards); P02 contract review; P14 E2E |
| GOV-04 decision-owner register | P01 (ADR drafting), and every phase start check ("open ADR decided?" in `/run-phase` step 2) |
| GOV-05 source-conflict log | P01 and the phases named in each row's Needed-by column |
| GOV-01 source inventory | Re-baseline checks (PD-P00-06) |
