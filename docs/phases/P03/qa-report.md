# P03 QA / Acceptance Report

Date: 2026-11-03. Branch `phase/P03`, HEAD `6af25bdf51ea9659823a69cf2662f0d0a3a88bcd`.

Verdict: PASS

## Environment and commands

Debian 13, Linux 6.12.95; Docker Engine 29.6.1, Compose v5.3.1, .NET SDK 10.0.301, Node v24.22.2, npm 11.19.1, Python 3.13.5. Docker daemon and network available. `infrastructure/images.lock` SHA-256: `3acc5c08d2180b8f41f00b820479489f7b3848a8ffb971afb36945aec1ea1ddc`. Commands ran sequentially; logs are in `/tmp/p03-qa-*.log`.

| Command | Exit | Result |
|---|---:|---|
| `bash docs/phases/P03/tests/suite.cmd` | 0 | All five local jobs PASS, Compose smoke 5/5, infrastructure tests 38/38. Includes locked restore mismatch, scanner controls, workflow mutations and script failure propagation. |
| `bash scripts/ci/e2e.sh` | 0 | Playwright 6/6: two tests each in Chromium, Firefox and WebKit, including the external request guard. |
| Fresh `git clone --branch phase/P03 "$(git rev-parse --path-format=absolute --git-common-dir)" "$D1"` under `$ORCA_CHAT_SCRATCH_DIR/tmp`; in D1, `bash scripts/ci/preflight.sh`, `bash scripts/ci/local.sh` | 0; 0; 1 | Four jobs PASS; security FAIL: actionlint could not read the workflow through the private directory (`permission denied`). Tracked status clean. |
| Same clone/preflight/local commands in fresh `/tmp/p03-qa-full-*` D2 (created by `mktemp -d`) | 0; 0; 1 | Same actionlint permission error; clone parent mode was 0700. |
| `chmod 755 "$D2"`; in D2, `bash scripts/ci/local.sh` | 0; 0 | All five jobs PASS; tracked status clean. Clean-checkout run with container-readable parent. |
| Fresh `/tmp/p03-qa-backend-*` clone, parent mode 0755; `bash scripts/ci/local.sh backend` | 0; 0 | Backend PASS, xUnit 3/3; tracked status clean. |
| Fresh `/tmp/p03-qa-frontend-*` clone, parent mode 0755; `bash scripts/ci/local.sh frontend` | 0; 0 | Frontend PASS, no backend `bin/` or `obj/`; tracked status clean. |
| `python3 scripts/phase-handoff-check.py --phase P03 --role qa-acceptance` | 0 | Role scope, phase scope, Blueprint and embedded phase suite passed; `RESULT PASS`. |

## Acceptance matrix

| Criterion | Result | Evidence and limit |
|---|---|---|
| AC-P03-01 | PASS | Integration smoke: three healthy services, replica-set majority write, SMTP/API and Blob checks, no-replica-set negative; cleanup/residue check. |
| AC-P03-02 | PASS | Static Compose policy and mutation tests; loopback smoke. |
| AC-P03-03 | **FAIL** | Positive env and ignore checks passed. Secret-like `.env.example` mutation and missing-ignore negative are unimplemented; no approved exception. |
| AC-P03-04 | PASS | Backend job and 3/3 xUnit; locked-restore mismatch negative passed. |
| AC-P03-05 | PASS | Frontend job, lint, typecheck, Vitest 2/2 and build; static manifest checks. |
| AC-P03-06 | PASS | Separate E2E run: 6/6 across three browser engines. |
| AC-P03-07 | PASS | Integration job and P02 suite passed; missing-main, remote-main and failing-line tests passed. |
| AC-P03-08 | PASS | Workflow policy and two isolated fresh-clone jobs passed; frontend left backend unbuilt. |
| AC-P03-09 | **FAIL** | Real workflow actionlint and four static mutations passed. Actionlint mutation and specified `pull_request_target`/`secrets.` mutations lack recorded evidence; no approved exception. |
| AC-P03-10 | PASS | Gitleaks tree/history scans and planted-token control passed. |
| AC-P03-11 | PASS | OSV scans and vulnerable-lock control passed; six scoped DD-P03-22 waivers expire 2026-11-17. |
| AC-P03-12 | PASS | Five PASS lines in local runner; unknown-job and failure-propagation controls passed. |
| AC-P03-13 | PASS | Fresh-clone preflight and all five jobs passed with container-readable parent. Default mode-0700 temp directories fail actionlint (above). |
| AC-P03-14 | PASS | ADR/tool manifests and rejected-framework control passed. |
| AC-P03-15 | PASS | Telemetry/upload policy passed; fixtures reviewed as fictional. |
| AC-P03-16 | PASS | QA role handoff check returned `RESULT PASS`; forbidden source/contract paths untouched; clone build outputs untracked. |
| AC-P03-17 | PASS | Shellcheck and unquoted-expansion control passed. |
| AC-P03-18 | PASS | Infrastructure, backend, frontend and E2E READMEs reviewed. |

## Findings and next owner

**QA-F1 (Must):** AC-P03-03 lacks the two specified negative cases. Test Engineer should add temp-copy cases, or Solution Architect should record a specific coverage exception in `decisions.md`.

**QA-F2 (Must):** AC-P03-09 lacks an actionlint mutation and some specified workflow mutation classes. Test Engineer should add them, or Solution Architect should record a specific coverage exception in `decisions.md`.

**QA-F3 (environment):** Containerized actionlint cannot traverse a mode-0700 temporary clone directory. Mode 0755 allowed the same clone to pass. Document the required clone directory mode or adjust scanner invocation.

Next owner: Test Engineer or Solution Architect for QA-F1 and QA-F2, then review and QA gate. No criterion was waived by QA.

## Re-run after remediation

Date: 2026-11-03. Branch `phase/P03`, HEAD `1dff8be4f8a916b9907ea9039e548b25331044bf`. The findings and FAIL above describe the earlier run; this section supersedes that verdict. Commands below ran sequentially, once each; logs are `/tmp/p03-qa-rerun-*.log` on the QA machine.

| Command | Exit | Result |
|---|---:|---|
| `bash docs/phases/P03/tests/suite.cmd` | 0 | Five local jobs PASS, Compose smoke 5/5, infrastructure tests 40/40. AC-P03-03 env and ignore negative mutations, AC-P03-09 workflow mutations, and the actionlint mutation all passed. |
| `bash scripts/ci/e2e.sh` | 0 | Playwright 6/6 in Chromium, Firefox and WebKit. |
| `git clone --quiet --branch phase/P03 "$(git rev-parse --path-format=absolute --git-common-dir)" "$qa_parent/clone"` with `qa_parent=$(mktemp -d /tmp/p03-qa-rerun-private-XXXXXX)` | 0 | Parent `/tmp/p03-qa-rerun-private-fBbkec` had mode 0700; clone HEAD matched phase HEAD. |
| In the clone, `bash scripts/ci/preflight.sh` | 0 | Prerequisites passed. |
| In the clone, `bash scripts/ci/local.sh` | 0 | Security, backend, frontend, E2E and integration PASS; security's containerized actionlint read the workflow under the mode-0700 parent. Tracked status remained clean. |

AC-P03-03: **PASS**. `test_environment_negative_mutations` rejected secret-like `AccountKey` and non-placeholder password values in a temporary `.env.example`, and verified `.env` and `.env.local` cease to be ignored when the ignore rule is removed. The positive policy and ignore checks passed.

AC-P03-09: **PASS**. `test_workflow_negative` rejected tag-pinned actions, write permission, checkout credential persistence, frontend dependency, `pull_request_target`, and a `secrets.` reference. `test_actionlint_rejects_mutated_workflow` confirmed real actionlint rejected a malformed workflow; the unmodified workflow passed security CI.

QA-F3: **RESOLVED**. The security script runs scanner containers as the invoking user, and the clean clone's complete local CI run passed while its parent remained mode 0700. No chmod workaround was used.

All other Must criteria retained their earlier PASS evidence and were covered again by the passing phase suite and clean-checkout local CI. AC-P03-17 and AC-P03-18 remain PASS. The six scoped OSV waivers recorded above still expire on 2026-11-17; they are existing approved waivers, not a QA exception.

Final verdict: **PASS**. Next owner: Program Coordinator for phase gate.
