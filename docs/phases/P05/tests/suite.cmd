set -e
bash scripts/ci/frontend.sh
bash scripts/ci/e2e.sh
bash docs/phases/P05/tests/image-check.sh
