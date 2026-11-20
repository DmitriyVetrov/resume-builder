#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
cd "$ROOT"
export npm_config_ignore_scripts=true
if ! git show-ref --verify --quiet refs/heads/main; then
  if git show-ref --verify --quiet refs/remotes/origin/main; then
    git branch main refs/remotes/origin/main
  else
    git fetch --no-tags origin main:main || { echo 'main reference required' >&2; exit 1; }
  fi
fi
while IFS= read -r line || [[ -n "$line" ]]; do [[ -z "$line" ]] || bash -c "$line" </dev/null; done < docs/phases/P02/tests/suite.cmd
export RESUMISER_MONGO_PORT=0 RESUMISER_AZURITE_BLOB_PORT=0 RESUMISER_MAILPIT_SMTP_PORT=0 RESUMISER_MAILPIT_UI_PORT=0
cleanup() { docker compose -p resumiser-ci down -v; }
trap cleanup EXIT
docker compose -p resumiser-ci pull
docker compose -p resumiser-ci up -d --wait --wait-timeout 120
python3 -B -m unittest discover -s tests/infrastructure -p 'smoke_*.py' -v
