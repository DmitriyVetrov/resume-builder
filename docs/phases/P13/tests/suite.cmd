#!/usr/bin/env bash
set -euo pipefail
bash scripts/ci/backend.sh
bash scripts/ci/e2e.sh
bash docs/phases/P11/tests/web-image-check.sh
bash docs/phases/P13/tests/web-image-check.sh
npm ci --prefix tests/contract --no-audit --no-fund --prefer-offline
npm test --prefix tests/contract
DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1 dotnet run tests/contract/dotnet/ContractReader.cs -- contracts/openapi/openapi.yaml
python3 -B -m unittest discover -s tests/infrastructure -p 'test_static_policy.py'
