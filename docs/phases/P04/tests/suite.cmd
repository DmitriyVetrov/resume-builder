#!/usr/bin/env bash
set -e
dotnet restore backend/ResumeBuilder.slnx --locked-mode
dotnet restore backend/tests/ResumeBuilder.Architecture.Tests/ResumeBuilder.Architecture.Tests.csproj --locked-mode
dotnet restore backend/tests/ResumeBuilder.Api.Tests/ResumeBuilder.Api.Tests.csproj --locked-mode
dotnet build backend/ResumeBuilder.slnx -c Release --no-restore
dotnet test backend/tests/ResumeBuilder.Architecture.Tests/ResumeBuilder.Architecture.Tests.csproj -c Release --no-restore
if [[ -z "${RESUMISER_MONGO_IMAGE:-}" ]]; then RESUMISER_MONGO_IMAGE=$(sed -n 's/^MONGO=//p' infrastructure/images.lock); fi; if [[ -z "${RESUMISER_MONGO_IMAGE:-}" ]]; then echo 'P04 suite: RESUMISER_MONGO_IMAGE is unset and infrastructure/images.lock has no MONGO image' >&2; exit 1; fi; export RESUMISER_MONGO_IMAGE; dotnet test backend/tests/ResumeBuilder.Api.Tests/ResumeBuilder.Api.Tests.csproj -c Release --no-restore
npm ci --prefix tests/contract --no-audit --no-fund --prefer-offline
npm test --prefix tests/contract
DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1 dotnet run tests/contract/dotnet/ContractReader.cs -- contracts/openapi/openapi.yaml
