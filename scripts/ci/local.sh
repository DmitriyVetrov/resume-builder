#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
cd "$ROOT"
valid=(security backend frontend e2e integration)
if (($# == 0)); then set -- "${valid[@]}"; fi
for job in "$@"; do
  case " ${valid[*]} " in *" $job "*) ;; *) echo "Unknown job: $job" >&2; exit 2;; esac
done
if ! "$ROOT/scripts/ci/preflight.sh"; then echo 'preflight FAIL'; exit 1; fi
failed=0
for job in "$@"; do
  if "$ROOT/scripts/ci/$job.sh"; then echo "$job PASS"; else echo "$job FAIL"; failed=1; fi
done
exit "$failed"
