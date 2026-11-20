# P01 QA / Acceptance Report

- Date: 2026-11-02.
- Scope: P01 documents and decisions only; there is no product code or user workflow to execute in this phase (`kickoff.md` §1).
- Environment: Linux, repository root `/home/dmytro/orca/workspaces/resumiser/p01`, Python 3 via `python3`; checks run locally without services.
- Source basis: `PHASE.md`, `acceptance-criteria.md`, `tests/test-plan.md`, `tests/test-results.md`, `review/code-review.md`, `architecture/phase-plan.md`, the accepted P01 ADRs, and `docs/blueprint/PHASE-GATES.md`.

## Commands and results

| Exact command | Exit | Result |
|---|---:|---|
| `python3 -B docs/phases/P01/tests/check_p01.py` | 0 | `RESULT PASS checks=12 negatives=21 failures=0`; C-01…C-12 and all negative cases passed. This is the sole command in `tests/suite.cmd`. |
| `python3 scripts/check-blueprint.py` | 0 | `Checked 221 required files, 9 agents`; `Blueprint structure OK`. |
| `git status --short` | 0 | Clean before this QA report was written. |
| `git diff --name-only main...HEAD` | 0 | 44 committed phase files, all in `architecture/phase-plan.md` § Allowed paths; no `docs/source/**`, `contracts/**`, `backend/**` or `frontend/**` changes. |
| `git diff --name-only main...HEAD \| wc -l` | 0 | 44 files. |
| `git diff --check` | 0 | No whitespace errors in this QA edit. |
| `python3 scripts/phase-handoff-check.py --phase P01 --role qa --worktree .` | 2 | The task's literal role `qa` is rejected by argparse; the accepted QA role is `qa-acceptance`. No checks ran. |
| `python3 scripts/phase-handoff-check.py --phase P01 --role qa-acceptance --worktree .` | 0 | `RESULT PASS`; 1 QA-owned file, 45 changed phase files since main, Blueprint and suite exit 0. |

## Acceptance matrix

| Criterion | Result | Evidence |
|---|---|---|
| AC-P01-01 | PASS | C-01; kickoff §§2–5 names roles, no Contract Architect, test budget, no parallel slices and decisions. |
| AC-P01-02 | PASS | C-02; ADR-007/008 and phase-plan §§5–6 set the contract-only backend/frontend boundary, frontend rendering and F-BE-1…5/F-FE-1…3. |
| AC-P01-03 | PASS | C-03; ADR-004 selects MongoDB 8.x, local replica set, EU Atlas, majority/journal writes, PITR and 30-day backups. |
| AC-P01-04 | PASS | C-04; ADR-009 selects private Azure Blob Storage in Germany West Central, API-mediated owner access, safe keys, re-encoding and no stored exports. |
| AC-P01-05 | PASS | C-05; ADR-036/013/014/015/038 cover PBKDF2 parameters, server sessions, HttpOnly cookie, CSRF, tokens, enumeration and abuse controls. |
| AC-P01-06 | PASS | C-06; ADR-010 uses one frontend PageModel for preview and PDF, a browser TXT serializer, candidate libraries and the P10 G1–G7 prototype gate with measurable parity, speed, fidelity, determinism and fallback. The delta review confirms G7. |
| AC-P01-07 | PASS | C-07; ADR-012/033/034, with ADR-004/009, pin compute, database, blobs, backups and logs to Germany West Central/Germany North, and transactional email to a Europe data location. |
| AC-P01-08 | PASS | C-08; domain-model covers TECHNICAL-SPEC §10.1/§10.2 entities, invariants, limits, IDs and persistence mapping. |
| AC-P01-09 | PASS | C-09; threat-model has six STRIDE categories, the four mandatory boundaries, complete mitigation rows, content-free logging and GDPR deletion/export. Review §4 assessed mitigation adequacy; its major findings were resolved in §9. |
| AC-P01-10 | PASS | C-10; all 25 ADRs in phase-plan §8 exist and meet the required template. |
| AC-P01-11 | PASS | C-11; P01 register entries are decided and linked, including ADR-032 → ADR-012; ADR-010 retains the criterion's documented `REQUIRED` exception. Later-phase items remain open with owners. |
| AC-P01-12 | PASS | C-12; decisions §2 contains tagged, reasoned `DELEGATED-DEFAULT` rows and §3 resolves all assigned P00 conflicts. |
| AC-P01-13 | PASS | Review §5 checks TECHNICAL-SPEC §3.2 exclusions X1–X11; ADR-019…022 explicitly keep X4/X8/X9/X10 out. No P01 design introduces an excluded feature. |
| AC-P01-14 | PASS | `git diff --name-only main...HEAD` shows only allowed paths; the handoff check with its accepted role `qa-acceptance` returned `RESULT PASS`. |
| AC-P01-15 | PASS | Both required commands above exited 0; `tests/suite.cmd` contains only the P01 check command. |
| AC-P01-16 (Should) | PASS | Review §5 confirms OOS-01/OOS-03: required `TRACEABILITY.md` NFR/§8/§9 rows and FR mappings, plus accepted ADR references in `ARCHITECTURE.md`. |

## Phase DoD and findings

The six `PHASE.md` architecture decisions are confirmed by AC-P01-02…07: boundaries (ADR-007/008), persistence (ADR-004), file storage (ADR-009), auth (ADR-036 and companion ADRs), rendering prototype (ADR-010), and EU hosting (ADR-012/033/034). The review's delta verdict is `PASS` (§9.5); M-1, M-2 and M-3 were resolved, with no unresolved blocker or critical finding. The P01 architecture fitness rules are defined here and assigned to executable checks in P04/P05; no production implementation exists to test in P01.

Open downstream follow-up: review m-10 asks P13 to clarify that the ADR-039 orphan sweep retains photo blobs referenced by active **or trashed** resumes, and to add a trashed-resume-with-photo restore drill. It is a minor design ambiguity assigned to P13, not a failing P01 acceptance criterion. Other minor/info follow-ups and later-phase go-live service setup remain with the owners named in `review/code-review.md` and `decisions.md`.

Verdict: PASS

Next owner: Program Coordinator runs the P01 gate and closes the phase if it passes.
