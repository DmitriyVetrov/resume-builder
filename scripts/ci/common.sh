#!/usr/bin/env bash
set -euo pipefail
export DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1 REDOCLY_TELEMETRY=off
export npm_config_ignore_scripts=true
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
image() { sed -n "s/^$1=//p" "$ROOT/infrastructure/images.lock"; }
