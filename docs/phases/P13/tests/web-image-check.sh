#!/usr/bin/env bash
# W01 (AC-P13-11): the real web image sends the security and cache headers of DD-P13-18, and keeps P11's gzip.
set -euo pipefail
cd "$(dirname "$0")/../../../.."
image_tag=resumiser-p13-web:local
docker build --pull -q -t "$image_tag" -f frontend/Dockerfile frontend >/dev/null
container_id="$(docker run -d --rm -p 127.0.0.1::8080 "$image_tag")"
trap 'docker rm -f "$container_id" >/dev/null 2>&1 || true' EXIT
port="$(docker port "$container_id" 8080/tcp | sed 's/.*://')"
base="http://127.0.0.1:$port"
for _ in 1 2 3 4 5 6 7 8 9 10; do curl --fail --silent "$base/" -o /dev/null && break; sleep 1; done
policy="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
fail() { echo "FAIL: $1"; echo "$2"; exit 1; }
headers_of() { curl --fail --silent --show-error -D - -o /dev/null -H 'Accept-Encoding: gzip' "$base$1" | tr -d '\r'; }
has() { echo "$2" | grep -qiF -- "$1" || fail "$3 lacks '$1'" "$2"; }
for path in / /index.html /resumes/x/edit; do
  headers="$(headers_of "$path")"
  has "content-security-policy: $policy" "$headers" "$path"
  has "x-frame-options: DENY" "$headers" "$path"
  has "x-content-type-options: nosniff" "$headers" "$path"
  has "referrer-policy: no-referrer" "$headers" "$path"
  has "permissions-policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()" "$headers" "$path"
  has "strict-transport-security: max-age=31536000; includeSubDomains" "$headers" "$path"
  has "cache-control: no-cache" "$headers" "$path"
  echo "PASS headers $path"
done
script="$(docker exec "$container_id" sh -c 'cd /usr/share/nginx/html/assets && ls *.js | head -1')"
font="$(docker exec "$container_id" sh -c 'cd /usr/share/nginx/html/assets && ls *.ttf | head -1')"
for asset in "$script" "$font"; do
  headers="$(headers_of "/assets/$asset")"
  has "cache-control: public, max-age=31536000, immutable" "$headers" "$asset"
  has "content-encoding: gzip" "$headers" "$asset"
  has "x-content-type-options: nosniff" "$headers" "$asset"
  echo "PASS asset $asset"
done
case "$font" in *.ttf) has "content-type: font/ttf" "$(headers_of "/assets/$font")" "$font";; esac
echo "PASS web image headers"
