# TPL-01 contract change log — 1.0.0 → 1.1.0

| Change | Schema | Kind | Compatibility |
|---|---|---|---|
| `templateId` enum gains `T4` | `ResumeDocument` (request and response) | Additive in requests; breaking in responses by oasdiff (§9.3, below) | Every 1.0.0 request stays valid. A 1.0.0 client receiving `T4` in a response sees an unknown enum value; the only client is this repository's frontend, released together with the backend. |
| `templateId` enum gains `T4` | `ResumeSummary` (response) | Breaking in responses by oasdiff (§9.3, below) | As above. |
| `info.version` 1.0.0 → 1.1.0 | — | Minor (ADR-006 §5) | — |

No operation, parameter, security requirement, rate-limit policy or error response changed.

## oasdiff report against `main` (P02 phase-plan §9.3 (b))

`tufin/oasdiff:v1.35.0 breaking base.yaml rev.yaml --fail-on ERR`, run by `types-diff.test.mjs` (AC-P02-12):
`5 changes: 4 error, 1 warning, 0 info`, all `response-property-enum-value-added` — the new `T4` value of
`templateId` in the 200/201 responses of `GET /account/data-export`, `GET /resumes`, `POST /resumes`,
`GET /resumes/{resumeId}` (errors) and `GET /resumes/{resumeId}/snapshots/{snapshotId}` (warning, `allOf`).

oasdiff counts a new response enum value as breaking because a client written against 1.0.0 may not handle
it. Before the P15 release there is no external client; the only one is this repository's frontend, changed in
the same branch. The change is therefore a pre-release breaking change under §9.3: (a) DD-TPL-14, (b) this
report, (c) backend and frontend in TPL-01, (d) minor version 1.1.0 marked `BREAKING (pre-release)` in
`CHANGELOG.md`.

Consequence for the suite: AC-P02-12 compares the working contract with `main`, so on `feat/template-t4` it
fails with exactly this report, by design of the check; after the merge `main` holds 1.1.0 and it passes. The
test is not changed (DD-TPL-14).

Contract tests changed with it (DD-TPL-09): `lint.test.mjs` expects `info.version` `1.1.0`, and
`schemas.test.mjs` expects the `templateId` enum `[T1, T2, T3, T4]`. Both remain exact-value assertions.
