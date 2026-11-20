# P04 QA / Acceptance Report

Date: 2026-11-03. Role: QA / Acceptance. Environment: Linux worktree `p04`, .NET 10 Release, Node/npm, Docker available; Mongo Testcontainers image resolved from the digest-pinned `MONGO=` entry in `infrastructure/images.lock`. Docker-backed jobs ran sequentially. No source, test, contract or acceptance file was edited.

Verdict: PASS

## Executed commands and results

All commands ran at the repository root. The first two commands were run sequentially; their full output was captured in `/tmp/p04-qa-ci.log` and `/tmp/p04-qa-suite.log` for this local run.

| Command | Exit | Evidence |
|---|---:|---|
| `bash scripts/ci/local.sh backend` | 0 | Locked restore, Release build (0 warnings/errors), format verification and tests passed: Architecture 11/11, Toolchain 3/3, Api 19/19; `backend PASS`. |
| `bash docs/phases/P04/tests/suite.cmd` | 0 | Locked restore and Release build passed; Architecture 11/11 and Api 19/19 passed. P02 npm contract suite passed 66/66; C# reader reported OpenAPI 3.1, 26 paths, 0 errors and 0 warnings on the valid document. The four warnings printed later came from the suite's intentional missing-reference negative fixture. |
| Live host script: `Mongo__ConnectionString='mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=500' ASPNETCORE_URLS='http://127.0.0.1:5997' dotnet backend/src/ResumeBuilder.Api/bin/Release/net10.0/ResumeBuilder.Api.dll` with `curl` requests to `/api/v1/health/live?private=SYNTH-QUERY-MARKER` (Authorization synthetic marker), `/api/v1/health/ready`, `/health/live`, and an unknown synthetic-marker path; then `rg -n 'SYNTH|mongodb://|127\.0\.0\.1:1' /tmp/p04-qa-live.log` | 0 overall; `rg` 1 (no matches) | Live 200 `{"status":"ok"}`; ready 503 generic `service_unavailable` Problem with trace ID; root alias 404. Console log contained only operational request-complete fields; no query, authorization, path, email marker or Mongo URI. Host was stopped after the check. |

## Acceptance matrix

| Criterion | Result | Evidence |
|---|---|---|
| AC-P04-01 | PASS | CI locked restore/Release build all four source projects and runs 11 architecture rules. The negative fitness tests detect forbidden references; endpoint-source and logging source guards inspect production call sites. |
| AC-P04-02 | PASS | Api tests cover anonymous liveness with Mongo unavailable and readiness with unavailable and digest-pinned Testcontainers Mongo. Independent live check gave 200 at `/api/v1/health/live`, 503 at `/api/v1/health/ready`, and no root alias. The 503 body named no dependency or timing. |
| AC-P04-03 | PASS | Api tests exercise 600/minute shared limit, request 601 returning 429 and `Retry-After`, forged untrusted forwarding, and configured trusted-proxy partitioning. Live 503 remained generic. |
| AC-P04-04 | PASS | Api exception test verifies 500 `application/problem+json`, stable `internal_error` code, trace ID, schema validity and no synthetic exception/query disclosure in any captured log category. Config tests cover missing and malformed Mongo setting with no value echo. |
| AC-P04-05 | PASS | Architecture rules reject content-typed log fields and inspect actual `LoggerMessage.Define` and `SafeLogs` call sites. Logging and exception tests check every captured category for synthetic markers. Independent live query/header/unknown-path marker check found no marker or Mongo URI in console output (`rg` exit 1). |
| AC-P04-06 | PASS | Api tests cover in-box versus frozen P04 operation inventory at contract-resolved `/api/v1` URLs, strict response-example round trips, negative drift cases, and JSON Schema validation of live 200/429/503/500 bodies. P02 contract suite passed 66/66 and C# contract reader passed. |

No Must criterion failed or was blocked. The review's remaining minor observations (typed Mongo options, fixed Retry-After, Mongo client lifecycle, stale README wording, and limited rejection logging) remain non-blocking follow-up candidates for their owning roles; this QA step made no waiver or architecture decision. Next owner: Program Coordinator for the P04 gate.

## Handoff verification

`python3 scripts/phase-handoff-check.py --phase P04 --role qa-acceptance --worktree .` — exit 0, `RESULT PASS`: role scope one QA-owned file, phase scope OK, blueprint check exit 0, and all 10 phase-suite commands exit 0. This repeats the Docker-backed phase suite only because the role handoff gate requires it; no test was skipped or retried to change a failure.
