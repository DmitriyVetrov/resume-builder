# Local infrastructure and CI

Prerequisites: Docker Engine with Compose v2, Git, Python 3.11+, .NET SDK 10.0.3xx, Node 24.18+ and npm 11+. Docker must be running. `scripts/ci/preflight.sh` checks these tools. All commands below run from the repository root; CI scripts also work from another directory.

## Services

`docker compose up -d --wait` starts MongoDB 8 (`127.0.0.1:27017`), Azurite Blob (`127.0.0.1:10000`) and Mailpit SMTP/UI (`127.0.0.1:1025`, `127.0.0.1:8025`). Ports can be overridden with the `RESUMISER_*_PORT` variables in `.env.example`. MongoDB is an `rs0` single-node replica set. Host clients should use `mongodb://127.0.0.1:27017/?replicaSet=rs0&directConnection=true`, especially with a nondefault port; use the actual published port in the URI. `UseDevelopmentStorage=true` is the local Blob stand-in. No real credentials are stored here.

The P05 web image runs under the `app` profile: `docker compose --profile app up -d --build web`. Its static SPA listens only at `127.0.0.1:8080` by default; `RESUMISER_WEB_PORT` changes the host port. The frontend CI job builds the same Dockerfile, verifies a deep link and non-root runtime, and scans the image with OSV-Scanner. The Dockerfile base digests are recorded as `NODE_BUILD` and `NGINX_WEB` in `images.lock`.

`docker compose down` stops services and retains data. `docker compose down -v` resets services and deletes local named volumes. If a port is occupied, change its `RESUMISER_*_PORT` value or stop the other process, then restart Compose. `docker compose config` shows the resolved configuration.

## Local checks

Run `bash scripts/ci/local.sh` for the same backend, frontend, E2E, integration and security jobs as CI. Run one job with `bash scripts/ci/local.sh backend` (or `frontend`, `e2e`, `integration`, `security`). The P03 phase suite is `bash docs/phases/P03/tests/suite.cmd`. The scripts use `npm ci --ignore-scripts`; there are currently no package install-script exceptions. The Playwright container may be unsuitable for host-installed native `node_modules` from macOS; use a Linux host or recreate dependencies in a compatible environment.

Security scanners need read access to the repository and Git history. `security.sh` runs their containers with the invoking user's UID/GID, so a clone inside a mode-0700 parent works when that user owns the clone and its parent directories. Run the checks as the clone owner, with Docker access; if the clone is owned by another user, grant the invoking user traversal and read access to the clone path and Git common directory. The mounts stay read-only, and scanner findings still fail the job.

## Updating pinned images

When Dependabot changes a Compose image tag, resolve the new tag's manifest digest with `docker buildx imagetools inspect <image>:<tag> --format '{{.Manifest.Digest}}'`. Update the matching `infrastructure/images.lock` entry and every reference in `docker-compose.yml` or the scripts together. Review the image provenance and run `bash scripts/ci/security.sh` and the P03 suite. `images.lock` is deliberately a separate review gate; Dependabot does not update it.

These loopback-only local services have no restart policy, resource limits, `no-new-privileges` setting or read-only root filesystem. Revisit those controls when P04/P05 add application containers. There are no non-root exceptions for application containers yet; the P03 Playwright job runs with the invoking user's UID/GID.
