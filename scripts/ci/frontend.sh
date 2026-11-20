#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
cd "$ROOT/frontend"
npm ci --ignore-scripts --no-audit --no-fund
npm run generate:api
npm run lint
npm run typecheck
npm test
npm run build
bash "$ROOT/docs/phases/P05/tests/image-check.sh"
