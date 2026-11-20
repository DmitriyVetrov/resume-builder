#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
for tool in git python3 docker dotnet node npm; do command -v "$tool" >/dev/null || { echo "Missing $tool" >&2; exit 1; }; done
python3 -c 'import sys; assert sys.version_info >= (3,11), "Python 3.11 required"'
docker info >/dev/null
docker compose version >/dev/null
[[ "$(dotnet --version)" == 10.0.3* ]] || { echo 'dotnet SDK 10.0.3xx required' >&2; exit 1; }
node_version="$(node --version)"
if [[ ! "$node_version" =~ ^v?([0-9]+)\.([0-9]+)\.[0-9]+$ ]] ||
   (( 10#${BASH_REMATCH[1]:-0} != 24 || 10#${BASH_REMATCH[2]:-0} < 18 )); then
  echo 'node 24.18+ required' >&2
  exit 1
fi
[[ "$(npm --version | cut -d. -f1)" -ge 11 ]] || { echo 'npm 11 required' >&2; exit 1; }
