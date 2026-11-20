npm ci --prefix tests/contract --no-audit --no-fund --prefer-offline
npm test --prefix tests/contract
DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1 dotnet run tests/contract/dotnet/ContractReader.cs -- contracts/openapi/openapi.yaml
