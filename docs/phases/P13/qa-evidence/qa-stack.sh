#!/usr/bin/env bash
# P13 step 7: throwaway real stack. usage: qa-stack.sh up|reconcile|down (run from the repository; needs the Release API build and frontend/dist)
set -euo pipefail
ROOT=$(git rev-parse --show-toplevel)
S=${P13QA_TMP:-${TMPDIR:-/tmp}/p13qa}; mkdir -p "$S"
P=resumiser-p13qa
API_DIR=$ROOT/backend/src/ResumeBuilder.Api/bin/Release/net10.0

stop_pid() { local f=$1; if [[ -f $f ]]; then local pid; pid=$(cat "$f"); kill "$pid" 2>/dev/null || true; for _ in $(seq 50); do kill -0 "$pid" 2>/dev/null || break; sleep 0.2; done; kill -9 "$pid" 2>/dev/null || true; rm -f "$f"; fi; }
wait_free() { for _ in $(seq 100); do ss -ltn | grep -qE ":$1 " || return 0; sleep 0.2; done; echo "port $1 still busy" >&2; return 1; }

api_env() {
  echo ASPNETCORE_ENVIRONMENT=Production ASPNETCORE_URLS=http://127.0.0.1:5090 \
    "Mongo__ConnectionString=mongodb://127.0.0.1:27017/?replicaSet=rs0&directConnection=true" \
    Blob__ConnectionString=UseDevelopmentStorage=true \
    Email__Smtp__Host=127.0.0.1 Email__Smtp__Port=1025 Email__Smtp__Sender=noreply@resumiser.invalid Email__Smtp__EnableSsl=false \
    Accounts__PublicBaseUrl=http://localhost:4190 Accounts__DataProtection__KeyDirectory=$S/qa-keys \
    ReverseProxy__TrustedProxies__0=127.0.0.1
}

case "${1:-}" in
  up)
    wait_free 5090; wait_free 4190
    docker compose -p $P -f $ROOT/docker-compose.yml up -d --wait mongo azurite mailpit
    rm -rf $S/qa-keys; mkdir -p $S/qa-keys
    cd $API_DIR; env $(api_env) nohup dotnet ResumeBuilder.Api.dll > $S/qa-api.log 2>&1 < /dev/null &
    echo $! > $S/qa-api.pid; cd $ROOT
    for _ in $(seq 150); do curl -fsS http://127.0.0.1:5090/api/v1/health/ready >/dev/null 2>&1 && break; sleep 0.2; done
    if grep -qi "address already in use" $S/qa-api.log; then echo "API did not bind" >&2; exit 1; fi
    curl -fsS http://127.0.0.1:5090/api/v1/health/ready >/dev/null || { echo "API not ready" >&2; tail -20 $S/qa-api.log >&2; exit 1; }
    nohup node tests/e2e/real-stack/proxy.mjs frontend/dist 4190 5090 > $S/qa-proxy.log 2>&1 < /dev/null &
    echo $! > $S/qa-proxy.pid
    for _ in $(seq 50); do curl -fsS http://127.0.0.1:4190/ >/dev/null 2>&1 && break; sleep 0.2; done
    # No warm-up: P13 owns the cold-start 403 (AC-P13-13), so the first browser request meets a fresh key ring.
    echo "stack up: api pid $(cat $S/qa-api.pid), proxy pid $(cat $S/qa-proxy.pid)"
    ;;
  reconcile)
    (cd $API_DIR && env $(api_env) dotnet ResumeBuilder.Api.dll reconcile-restore)
    ;;
  down)
    stop_pid $S/qa-proxy.pid; stop_pid $S/qa-api.pid
    docker compose -p $P -f $ROOT/docker-compose.yml down -v --remove-orphans
    wait_free 5090; wait_free 4190
    echo "stack down"
    ;;
  *) echo "usage: $0 up|reconcile|down" >&2; exit 2 ;;
esac
