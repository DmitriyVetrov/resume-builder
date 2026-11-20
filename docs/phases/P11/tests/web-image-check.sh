#!/usr/bin/env bash
# DD-P11-12: the real web image answers gzip for scripts, styles and fonts, and the engine chunk really is separate.
set -euo pipefail
cd "$(dirname "$0")/../../../.."
image_tag=resumiser-p11-web:local
docker build --pull -q -t "$image_tag" -f frontend/Dockerfile frontend >/dev/null
container_id="$(docker run -d --rm -p 127.0.0.1::8080 "$image_tag")"
trap 'docker rm -f "$container_id" >/dev/null 2>&1 || true' EXIT
port="$(docker port "$container_id" 8080/tcp | sed 's/.*://')"
base="http://127.0.0.1:$port"
for _ in 1 2 3 4 5 6 7 8 9 10; do curl --fail --silent "$base/" -o /dev/null && break; sleep 1; done
scripts="$(docker exec "$container_id" sh -c 'cd /usr/share/nginx/html/assets && ls *.js')"
[ "$(echo "$scripts" | wc -l)" -ge 2 ] || { echo "FAIL: no separate engine chunk"; exit 1; }
fonts="$(docker exec "$container_id" sh -c 'cd /usr/share/nginx/html/assets && ls *.ttf | head -1')"
styles="$(docker exec "$container_id" sh -c 'cd /usr/share/nginx/html/assets && ls *.css | head -1')"
check() {
  headers="$(curl --fail --silent --show-error -D - -o /dev/null -H 'Accept-Encoding: gzip' "$base/assets/$1")"
  echo "$headers" | tr -d '\r' | grep -qi '^content-encoding: gzip$' || { echo "FAIL: $1 is not gzip"; echo "$headers"; exit 1; }
  case "$1" in *.ttf) echo "$headers" | tr -d '\r' | grep -qi '^content-type: font/ttf$' || { echo "FAIL: $1 is not font/ttf"; echo "$headers"; exit 1; };; esac
  echo "PASS gzip $1"
}
for file in $scripts $fonts $styles; do check "$file"; done
