# IMP-01 — Test results

Environment: Debian 13 (Linux 6.12), Node and .NET from the P03 toolchain, Docker for the CI jobs; branch
`feat/cv-import`.

## Contract — 2026-11-15

| Command | Exit | Result |
|---|---|---|
| `bash docs/phases/P02/tests/suite.cmd` (contract 1.2.0, tests unchanged) | 0 (script) | `npm test`: 66 tests, 62 pass, 4 fail — inventory `extra operation post /resume-imports/structure`, `xPhaseSet: structureResumeImport invalid x-phase`, `rootFields` `info.version` (AC-P02-02 and N-25). oasdiff AC-P02-12 passes (additive). Reader `errors=0`. |
| Same, after the contract test changes (DD-IMP-02, DD-IMP-03, DD-IMP-16) | 0 | 67 tests, 67 pass, including the new N-IMP-01; reader `errors=0`. |
| `npm run generate:api`, `npx tsc --noEmit` (in `frontend/`) | 0 | Types regenerated; clean. |

## Red — 2026-11-15

Production modules exist only as signatures that return empty values (`features/import/*.ts`, `CvImport/*.cs`)
so every test compiles and fails on its assertion; the endpoint is not mapped.

| Command | Exit | Result |
|---|---|---|
| `npm install --save-exact pdfjs-dist@6.5.438` (in `frontend/`); `npm audit --omit=dev` | 0 | Installed; audit unchanged (3 low, `deepmerge` via `shadcn`, pre-existing). |
| `npx tsc -b`, `npx eslint src/features/import src/features/library` (in `frontend/`) | 0 | Clean. |
| `npx vitest run src/features/import src/features/library` (in `frontend/`) | 1 | 97 tests: **52 failed**, 45 passed. Failing: X-01…X-08, X-09 (on `PDF_OPTIONS` only; the bundle scan already passes), A-02…A-07, A-09, S-01, S-02, M-01…M-05, D-01…D-11, F-01…F-03, F-05, T-01, R-01 (T1–T4), U-01…U-07, T-02, L-01. Failures are assertions (for example `expected [] to deeply equal [...]`, `Unable to find role="link" and name "Import CV"`); D-05…D-07 fail with a `TypeError` reading a section the empty stub document does not have. Passing vacuously against the empty stubs: A-01, A-08, F-04, D-12, R-02; the other 40 are the existing library tests. |
| `dotnet restore --force-evaluate` (in `backend/`) | 0 | `Anthropic` 13.8.0 (+ `Microsoft.Extensions.AI.Abstractions`) in the lock files. |
| `dotnet build ResumeBuilder.slnx` | 0 | After renaming `Imports` → `CvImport` (CA1716) and `Pointer` → `Field` (CA1720), DD-IMP-19. |
| `dotnet test tests/ResumeBuilder.Api.Tests --no-build --filter "FullyQualifiedName~Imp01\|FullyQualifiedName~P13SecurityTests"` | 1 | 46 tests: **39 failed**, 7 passed. Failing: B-01…B-16 (404 where 200/4xx/503 is expected, `Assert.Single` on an empty capture), P-01…P-03, V-01…V-04, V-06, V-07, V-09, V-10, and P13 S02 and S04 (the new matrix row answers 404, not 401). Passing: P13 S01 (the row is in the matrix), the other P13 checks, and V-05 and V-08, which pass vacuously because the stub answers `false`. |
| `node tests/fixtures/imports/make-fixture.mjs` (twice) | 0 | `synthetic-cv.pdf` and `no-text.pdf` identical SHA-256 across runs; embedded Roboto (DD-IMP-20). |
| `npm run build --prefix frontend`; Playwright `import.spec.ts --project=chromium` (container without `--network host`) | 1 | **4 failed**: I-01…I-04, each timing out on the missing "Import CV" link. |

## Green — 2026-11-15

Backend at `5326421`; frontend logic `5377579`, UI `219db6a`, E2E fixes `744431c`, backend guards `2bf9db4`; `.env.example` with this
record. Test changes made at green are listed in DD-IMP-22, DD-IMP-24 and DD-IMP-25; none removes or weakens an assertion.

| Command | Exit | Result |
|---|---|---|
| `dotnet test tests/ResumeBuilder.Api.Tests --no-build --filter "FullyQualifiedName~Imp01\|FullyQualifiedName~P13SecurityTests"` (in `backend/`, at `5326421`) | 0 | 46 passed: B-01…B-17, V-01…V-10, P-01…P-03 and every P13 matrix check with the new row. |
| `npx vitest run src/features/import src/features/library` (in `frontend/`) | 0 | 97 passed: X-01…X-09, A-01…A-09, S-01, S-02, M-01…M-05, D-01…D-12, F-01…F-05, T-01, T-02, R-01 (T1, T2, T3, T4), R-02, U-01…U-07, L-01 and the existing library tests. |
| `bash scripts/ci/local.sh frontend` | 0 | Lint, typecheck, 58 files / 606 tests, build. pdf.js is a lazy chunk; its worker is a same-origin asset (`pdf.worker.min-*.mjs`). |
| `bash scripts/ci/local.sh backend` (whole job, after DD-IMP-25) | 0 | Architecture 12, Toolchain 3, Api 354 passed. The first whole run failed 4 guards that the step-5 filter had not run (inventory, K01, safe-log fields, outbound caller): DD-IMP-25. |
| `bash docs/phases/P02/tests/suite.cmd` | 0 | 67 tests, 67 pass; reader `errors=0` (the second reader run's `DoesNotExist` warnings are its negative self-check). |
| Playwright `import.spec.ts library.spec.ts`, three browsers (isolated network) | 1 | Import I-01…I-04 pass in chromium, firefox and webkit. Library: E05 passes after DD-IMP-24; E04 × 3 widths × 3 browsers fails — the pre-existing 26 px rename button (TPL-01 `qa-report.md`). |
| `bash scripts/ci/local.sh e2e` (host network) | 0 (script) | Playwright 376 passed, 18 failed, 2 skipped; rendering gate passed. Failures: E04 (9) and E10 (3), both pre-existing on `main`; account P06 "keyboard login" and "external return path" (6), because a `dotnet run` API started on 2026-11-13 outside this work listens on 127.0.0.1:5080 and the dev proxy forwards unrouted fixture calls to it (as TPL-01 recorded). The process was left running. |
| Playwright `account.spec.ts editor.spec.ts`, three browsers (isolated network) | 1 | 149 passed; the login specs pass. E10 × 3 (pre-existing) and webkit E01 once. |
| Playwright `editor.spec.ts --project=webkit -g E01 --repeat-each` — branch ×5, `main` (temporary worktree) ×10 | 1, 1 | 4/5 on the branch, 9/10 on `main`: E01's 1.5 s request window is flaky on webkit before this work; the editor is not in this diff. |
| `bash scripts/ci/local.sh security` | 1 | gitleaks `dir`: one `generic-api-key` in `P06FixtureTests.cs:620`, on `main` since P06. The job stops there, so the rest was run by hand: gitleaks `git --log-opts=main..HEAD` → no leaks; OSV → no finding in any package this branch adds (`pdfjs-dist`, its optional `@napi-rs/canvas`, `Anthropic`); pre-existing findings: `deepmerge` 4.3.1 via `shadcn` in `frontend/package-lock.json` (on `main`), `fast-xml-parser` GHSA-474x-hrwr-fgx4 in `tests/contract/package-lock.json` (lock unchanged here; advisory newer than the DD-P03-22 waivers), and the empty Domain lock (`No package sources found`, exit 128, as on `main`); actionlint 0; shellcheck 0. |
| `python3 -B -m unittest discover -s tests/infrastructure -p 'test_static_policy.py'` | 0 | 16 passed, with the `.env.example` placeholder comment. |

## External review R1 fixes — 2026-11-15

| Command | Exit | Result |
|---|---|---|
| `dotnet test tests/ResumeBuilder.Api.Tests --no-build --filter "FullyQualifiedName~B18"` (before the fix) | 1 | Red: `The response does not validate against ImportStructureResult` (1,000 surplus warnings). |
| `npx vitest run src/features/import/import-page.test.tsx -t U-08` (before the fix) | 1 | Red: `expect(element).toHaveFocus()`. |
| `npx vitest run src/features/import/round-trip.test.ts` with R-01 strengthened; then with a mutation in `fallback.ts` (non-bullet blocks dropped), reverted | 0, 1 | 5 passed; the mutation fails 4 on "fallback draft: expected … to contain 'devops / platform engineer with 8+ ye…'". |
| `dotnet test … --filter "FullyQualifiedName~Imp01"` after the cap | 0 | 40 passed (B-18 included). |
| `npx vitest run` (in `frontend/`) | 0 | 58 files, 607 passed (U-08 included). |
| `bash scripts/ci/local.sh backend` | 0 | Architecture 12, Toolchain 3, Api 355. |
| Playwright `import.spec.ts library.spec.ts`, three browsers (isolated network), then `library.spec.ts -g E05` | 1, 0 | Import I-01…I-04 pass ×3; E05 first failed on its new link check inside the open modal (the link is inert there), moved before the dialog, then 3 passed; E04 × 9 pre-existing. |

## DD-IMP-27 fallback entries (owner feedback) — 2026-11-15

Environment: Debian 13, Node 22, frontend `vitest` 4.1.12; commands from `frontend/`.

| Command | Exit | Result |
|---|---|---|
| `npx vitest run src/features/import/fallback.test.ts src/features/import/layout.test.ts` (before the change) | 1 | Red: 5 failed on assertions (A-10: one block where two were expected; F-06: `type 'text'` where `entries` was expected; F-07, F-08, F-09: no entries); F-10 passed, as text was already the behaviour; 18 passed. |
| Same command after the change | 0 | 23 passed. |
| `npx vitest run src/features/import` | 0 | 7 files, 63 passed (R-01 on T1–T4 included). |
| `npx tsc -b`; `npx eslint src/features/import` | 0, 0 | Clean. |
| `npx vitest run` | 0 | 58 files, 613 passed. |
| The owner's own CV PDF through extraction, layout and the fallback (a temporary local test, deleted after the run, not committed) | 0 | Work experience: one `entries` section with 8 entries, each with title, organisation, dates; location where the row reads "Organisation · Location". The contact block is now a `list`. Unchanged and outside this change: sidebar label/value pairs stay `text` in the fallback, and one bold upper-case skill line is still taken for a heading. |

| `npm run build --prefix frontend`; then in `tests/e2e/`: `npx playwright test import.spec.ts --project=chromium` | 0, 0 | I-01…I-04 passed (I-04's axe check now covers a basic review with an entries section). |

Not run for this change: E2E on firefox and webkit, backend (no backend file changed), external review delta.
