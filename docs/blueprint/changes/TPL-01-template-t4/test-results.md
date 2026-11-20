# TPL-01 Test results

Environment: Debian 13 (Linux 6.12), Node 24 (host) for Vitest and the rendering reference, .NET 10 SDK with
Testcontainers (Mongo, Azurite) for the backend, Playwright in the pinned `PLAYWRIGHT` image from
`infrastructure/images.lock` against `vite preview` on 127.0.0.1:4173.

## Baseline — 2026-11-15, before any engine edit

| Command | Exit | Result |
|---|---|---|
| `WRITE_LAYOUT_GOLDEN=1 npx vitest run src/entities/layout/templates-golden.test.ts` (in `frontend/`, `src/` identical to `main` per `git diff --quiet main -- src`) | 0 | Wrote `tests/fixtures/layout/t1-t3-hashes.json`: 78 cases (13 fixtures × T1–T3 × {A4 M, Letter L}), sha-256 of model, PDF and TXT plus page count. |
| `npx vitest run src/entities/layout/templates-golden.test.ts` (re-run, no write) | 0 | 1 passed: the golden is deterministic. |
| `node tests/rendering/bundle.mjs && node tests/rendering/reference.mjs` | 0 | `RESULT PASS reference`, 43 cases; `out/reference-hashes.json` kept as `/tmp/main-reference-hashes.json` for R-02. |

## Contract — 2026-11-15

| Command | Exit | Result |
|---|---|---|
| `bash docs/phases/P02/tests/suite.cmd` | 0 (script) | `npm test`: 66 tests, 65 pass, **1 fail: AC-P02-12** — oasdiff against `main`: `5 changes: 4 error, 1 warning`, all `response-property-enum-value-added` for `T4` (report in `contract-changelog.md`). Expected on this branch, DD-TPL-14. All other checks pass, including the updated `rootFields` (1.1.0) and `templateId` enum rows, and the Microsoft.OpenApi reader (`errors=0`). The script does not stop on a failing step, so its own exit code is 0; the `npm test` step failed. |

## Red — 2026-11-15

| Command | Exit | Result |
|---|---|---|
| `npx vitest run src/entities/template/t4.test.ts src/entities/layout/t4-layout.test.ts src/entities/template/template.test.ts src/features/editor/design-panel.test.tsx src/entities/layout/templates-golden.test.ts` (in `frontend/`) | 1 | 24 failed, 1 passed (G-01). Every failure is an `AssertionError` on missing behaviour: the registry is `['T1','T2','T3']` (D01, T-01, C01 three radios, C02 three thumbnails), `zones.side` undefined, no `colors`/`sidebar` on the design, `header.kind` `'plain'`, names uppercased by T1's fallback, the first shape a `timeline` not a `panel`, a 70 pt photo, one header region, no rule under "WORK EXPERIENCE", tag order without the contacts title, the mirror on two pages. L-06/L-07/L-08 first assert the line they read exists (`expect(...).toBeDefined()`), so none fails on a `TypeError`. |
| `dotnet test tests/ResumeBuilder.Api.Tests --filter "FullyQualifiedName~Tpl01\|FullyQualifiedName~Ce16"` (in `backend/`) | 1 | 3 failed (B-01a: reader issues not empty for `T4`, the contract itself already accepts it; B-01b: `POST /resumes` 400 instead of 201; Ce16 `1.2.0`: logged as `"other"`), 2 passed (Ce16 1.0.0, 1.1.0). |
| `npm run build` (in `frontend/`) | 2 | 17 `TS` errors, all in `t4.test.ts` / `t4-layout.test.ts`, naming the API they test (`zones.side`, `zones.panel`, `ResolvedDesign.colors`, shape roles `panel`/`decor`). The production code still compiles; the E2E below ran against the last good build of the same production code. |
| `npx playwright test template-t4.spec.ts design.spec.ts -g "E-0\|Y01\|Y09" --project=chromium` (Playwright image) | 1 | 5 failed: Y01 `toHaveCount` expected 4, received 3; E-01, E-02, E-03 and Y09 time out waiting for the "Panel" radio, which does not exist. |

R-01 (the gate's T4 cases) is a coverage extension and is not red: before T4 exists, `definitionOf('T4')` falls back to T1, so the gate's internal consistency checks hold. It is shown by the green run.

## Green — 2026-11-15

| Command | Exit | Result |
|---|---|---|
| `npx vitest run src/entities/` (in `frontend/`) | 0 | 20 files, 237 passed: T-01…T-06, L-01…L-15, G-01 (T1–T3 golden unchanged), all existing engine tests. |
| Test correction during green, L-08 | — | L-08 asserted `B.Sc., Information Systems, 1999 - 2003` as one line; it is 150.47 pt in a 148.66 pt column and wraps, which the layout rules allow. The assertion now joins that entry's muted lines and expects the same text in the same order; strength unchanged (organisation and dates on the compact line). |
| `npx tsc --noEmit`, `npx eslint .`, `npx vitest run` (in `frontend/`) | 0 | Clean; 51 files, 547 passed. |
| `node tests/rendering/reference.mjs` (first green run) | 1 | G1 failed on `panel-mirror-T4` and `panel-mirror-long-T4` only: expected `Aurora.example ,`, extracted `Aurora.example,` — the check joined touching runs with a space. Fixed in the check (DD-TPL-16), not in the engine. |
| `bash scripts/ci/local.sh backend` | 0 | Architecture 12, Toolchain 3, Api 315 passed (B-01a, B-01b, Ce16 `1.2.0` included). |
| `bash scripts/ci/local.sh e2e` | 1 | Frontend job PASS (547 unit tests, lint, typecheck, build, web image). Playwright: 363 passed, 19 failed, 2 skipped — see the next two rows. |
| Same specs on `main` at `99e4b31` (temporary detached worktree, `--network host`) | 1 | The same 6 Chromium failures occur on `main` without TPL-01: they are not caused by this change. |
| Same specs on `main`, Playwright container **without** `--network host` | 1 | Login P06 (×2) now pass: on the host network the committed `vite.config.ts` proxy (`/api/v1` → `127.0.0.1:5080`, which `vite preview` also applies) sent unrouted fixture calls to a live local API (`ResumeBuilder.Api` listening on 5080, not started by this session), so the library redirected to login. Still failing on `main`: library E04 (a 26 px target, the inline-rename title button) and editor E10 (looks for an entry field labelled "Title", now "Role") — both from the owner's UX commit `1d405e3`. |
| `npx playwright test` (all specs, three browsers; container without `--network host`) | 1 | 370 passed, 2 skipped (Y10 Firefox/WebKit, Chromium-only by design), **12 failed = exactly the pre-existing `main` failures**: library E04 at 1280/1024/390 px × 3 browsers and editor E10 × 3 browsers. All TPL-01 checks pass in all three browsers: E-01…E-03, Y01 (four thumbnails), Y02, Y09 (axe incl. Panel), and Y10 (T1–T3 page baselines matched unchanged). |
| `bash scripts/ci/rendering.sh` | 0 | `RESULT PASS reference` (58 cases, 15 of them T4), `RESULT PASS export checks`, G7 24 passed (four templates × three browsers × 2), `RESULT PASS G2` (worst 0.156 % Chromium / 0.388 % Firefox / 0.560 % WebKit; controls caught). |
| R-02: `out/reference-hashes.json` vs `/tmp/main-reference-hashes.json` | — | All 43 T1–T3 labels equal (model, PDF, TXT, pages); 15 new T4 labels. |
| `python3 scripts/check-blueprint.py` | 0 | Blueprint structure OK. |

Known failures outside TPL-01 (not fixed here, reported to the owner): library E04 and editor E10 on `main` since `1d405e3`.

## External review R1 fix — red, 2026-11-15

Codex R1 (`Verdict: FAIL`, one Major): with 20 long contacts the T4 sidebar header half exceeds a page and `splitOversized` spreads it over pages, against PG-06 and ADR-054. Probe: at the contract maximum the half does break between lines with an `oversized` hint on each page and no line passes the margin — the PG-09 fallback ADR-010 §10 sets for T1–T3 (X20) — but ADR-054 did not state it and no test pinned it. The probe also found the real defect: a half is compared with a continuation page's room (788 pt), not page 1's (796 pt), so a half that fits page 1 is cut into rows and raises a false hint (18 of the probed preset/spacing/count/length combinations).

| Command | Exit | Result |
|---|---|---|
| `npx vitest run src/entities/layout/t4-layout.test.ts` (in `frontend/`) | 1 | 16 passed, 1 failed: **L-17** `AssertionError: S 12 10x170: expected [ Array(1) ] to deeply equal []` (a false oversized header hint). L-16 passes: it pins the existing PG-09 behaviour at the contract maximum. |

## External review R1 fix — green, 2026-11-15

Fix (DD-TPL-19): `paginate.ts` gives a header half that leads its zone page 1's room; ADR-054's header row and the `splitHeader` comment state the PG-09 fallback.

| Command | Exit | Result |
|---|---|---|
| `npx vitest run src/entities/` (in `frontend/`) | 0 | 20 files, 239 passed: L-16, L-17, G-01 (T1–T3 golden unchanged). |
| `npx tsc --noEmit`, `npx eslint src/entities/layout`, `npx vitest run` (in `frontend/`) | 0 | Clean; 51 files, 549 passed. |
| `bash scripts/ci/rendering.sh` | 0 | `RESULT PASS reference`, `RESULT PASS export checks`, G7 24 passed, `RESULT PASS G2` (worst 0.156 % / 0.388 % / 0.560 %). |
| R-02: `out/reference-hashes.json` vs `/tmp/main-reference-hashes.json` | — | All 43 T1–T3 labels equal; 58 labels in total. |
| D1 Minor applied: L-16 also asserts name and headline on page 1 (fixture given both); `npx vitest run src/entities/`, `tsc`, `eslint` | 0 | 20 files, 239 passed; clean. |

## Acceptance — 2026-11-15

| Command | Exit | Result |
|---|---|---|
| `npm run build --prefix frontend`; Playwright `template-t4.spec.ts design.spec.ts`, three browsers, container without `--network host` | 1 | 39 passed, 2 skipped, 1 failed: Firefox **Y09** `Test timeout of 30000ms exceeded` at 30.5 s; no assertion failed. Y09 durations 13.6–30.5 s across browsers and runs since Panel joined its axe loop. |
| Same, after DD-TPL-20 (`test.setTimeout(60_000)` on Y09), run twice | 0, 0 | 40 passed, 2 skipped each time; Y09 28.1/29.1/18.8 s and 27.4/28.9/19.3 s (Chromium/Firefox/WebKit). |

## After the merge — `main` at `8c3c7fb`, 2026-11-15

| Command | Exit | Result |
|---|---|---|
| `bash docs/phases/P02/tests/suite.cmd` | 0 | `npm test`: 66 tests, 66 pass (AC-P02-12 passes on `main`, as DD-TPL-14 expected); Microsoft.OpenApi reader `errors=0`. |
| `python3 scripts/check-blueprint.py` | 0 | Blueprint structure OK. |
