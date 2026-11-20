#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
cd "$ROOT"
"$ROOT/scripts/ci/frontend.sh"
docker run --rm -v "$ROOT:/work" -w /work "$(image PLAYWRIGHT)" rm -rf tests/e2e/test-results
mkdir -p tests/e2e/test-results tests/e2e/playwright-report
npm ci --prefix tests/e2e --ignore-scripts --no-audit --no-fund
# The preview spec compares the real route with the engine run in Node (AC-P11-02).
npm ci --prefix tests/rendering --ignore-scripts --no-audit --no-fund
node tests/rendering/bundle.mjs
docker run --rm --ipc=host --network host --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$ROOT:/work" -w /work/tests/e2e "$(image PLAYWRIGHT)" npx playwright test
# ADR-042 keeps five jobs, so the rendering gate runs in this one (DD-P10-16).
"$ROOT/scripts/ci/rendering.sh"
