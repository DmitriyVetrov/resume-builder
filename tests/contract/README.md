# P02 contract suite

Prerequisites: Node 24, npm 11, .NET SDK 10, Docker and the digest-pinned oasdiff image. From the repository root run the three lines in `docs/phases/P02/tests/suite.cmd`.

For the local static mock, run `npm run mock --prefix tests/contract`. Prism serves paths at the root, for example `http://127.0.0.1:4010/resumes`; it does not include `/api/v1`. Set `Prefer: code=404` to select a documented error example. The mock is stateless and uses fictional contract examples.

The helper sets `REDOCLY_TELEMETRY=off` and `DOTNET_CLI_TELEMETRY_OPTOUT=1`. oasdiff runs in Docker with `--network none`; no telemetry connection is possible. The suite uses `npm ci --no-audit`. Generated files remain in ignored `.work/` or temporary directories.
