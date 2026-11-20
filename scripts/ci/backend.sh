#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
RESUMISER_MONGO_IMAGE="$(image MONGO)"
TESTCONTAINERS_RYUK_CONTAINER_IMAGE="$(image RYUK)"
export RESUMISER_MONGO_IMAGE TESTCONTAINERS_RYUK_CONTAINER_IMAGE
cd "$ROOT/backend"
dotnet restore ResumeBuilder.slnx --locked-mode
dotnet build ResumeBuilder.slnx -c Release -warnaserror --no-restore
dotnet format ResumeBuilder.slnx --verify-no-changes --no-restore
dotnet test ResumeBuilder.slnx -c Release --no-build
