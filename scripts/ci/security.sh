#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
cd "$ROOT"
python3 -B -m unittest discover -s tests/infrastructure -p 'test_static_policy.py' -v
# Match the invoking host user so bind mounts remain readable when a clone's
# parent directory is private (for example, mktemp's mode-0700 directory).
scanner_user="$(id -u):$(id -g)"
# Scan the tree and committed history independently.
docker run --rm --user "$scanner_user" -v "$ROOT:/work:ro" -w /work "$(image GITLEAKS)" dir /work --no-banner --config /work/.gitleaks.toml
git_common_dir="$(git -C "$ROOT" rev-parse --path-format=absolute --git-common-dir)"
docker run --rm --user "$scanner_user" -v "$ROOT:/work:ro" -v "$git_common_dir:$git_common_dir:ro" -w /work "$(image GITLEAKS)" git /work --no-banner --config /work/.gitleaks.toml
docker run --rm --user "$scanner_user" -v "$ROOT:/work:ro" -w /work "$(image OSV_SCANNER)" scan --config=/work/osv-scanner.toml --lockfile=/work/tests/contract/package-lock.json
mapfile -d '' backend_locks < <(find backend -type f -name packages.lock.json -print0 | sort -z)
if (( ${#backend_locks[@]} == 0 )); then echo 'No backend packages.lock.json found' >&2; exit 1; fi
for lock in frontend/package-lock.json tests/e2e/package-lock.json tests/rendering/package-lock.json "${backend_locks[@]}"; do
  docker run --rm --user "$scanner_user" -v "$ROOT:/work:ro" -w /work "$(image OSV_SCANNER)" scan --lockfile="/work/$lock"
done
docker run --rm --user "$scanner_user" -v "$ROOT:/work:ro" -w /work "$(image ACTIONLINT)" -color .github/workflows/ci.yml
docker run --rm --user "$scanner_user" -v "$ROOT:/work:ro" -w /work "$(image SHELLCHECK)" -e SC1091 scripts/ci/*.sh
