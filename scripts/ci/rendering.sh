#!/usr/bin/env bash
# The ADR-010 gate and every later renderer change (rule 04). `rendering.sh` runs G1, G2, G5, G6, G7; `rendering.sh bench` runs G3, G4.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
cd "$ROOT"
# Five CI jobs with one script each (ADR-042): the runner gets poppler here, not from a workflow step.
if [ -n "${CI:-}" ] && ! command -v pdftotext >/dev/null; then sudo apt-get update -qq && sudo apt-get install -y --no-install-recommends poppler-utils; fi
for tool in pdftotext pdffonts pdfinfo pdftoppm pdfimages; do
  command -v "$tool" >/dev/null || { echo "$tool is required (poppler-utils)"; exit 2; }
done
npm ci --prefix frontend --ignore-scripts --no-audit --no-fund
npm run generate:api --prefix frontend
npm ci --prefix tests/rendering --ignore-scripts --no-audit --no-fund
node tests/rendering/bundle.mjs
pw() { docker run --rm --ipc=host --network host --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$ROOT:/work" -w /work/tests/rendering "$(image PLAYWRIGHT)" npx playwright test "$@"; }
if [ "${1:-}" = "bench" ]; then
  mkdir -p tests/rendering/out
  pw bench.spec.ts
  # NFR-01 through the real editor: outside the suite, since a timing limit there would fail on load, not on code.
  npm run build --prefix frontend
  npm ci --prefix tests/e2e --ignore-scripts --no-audit --no-fund
  docker run --rm --ipc=host --network host --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$ROOT:/work" -w /work/tests/e2e "$(image PLAYWRIGHT)" npx playwright test -c playwright.bench.config.ts
  exit 0
fi
node tests/rendering/reference.mjs
node tests/rendering/export-checks.mjs
pw gate.spec.ts
node tests/rendering/raster-diff.mjs
