#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../../.."
image_tag=resumiser-p05-web:local
scanner_image="$(sed -n 's/^OSV_SCANNER=//p' infrastructure/images.lock)"
docker build --pull -t "$image_tag" -f frontend/Dockerfile frontend
runtime_user="$(docker image inspect "$image_tag" --format '{{.Config.User}}')"
if [[ -z "$runtime_user" || "$runtime_user" == root || "$runtime_user" == 0 || "$runtime_user" == 0:0 ]]; then
  echo 'web image has root default user' >&2
  exit 1
fi
container_id="$(docker run -d --rm -p 127.0.0.1::8080 "$image_tag")"
archive_dir="$(mktemp -d)"
cleanup() { docker rm -f "$container_id" >/dev/null 2>&1 || true; rm -rf "$archive_dir"; }
trap cleanup EXIT
port="$(docker port "$container_id" 8080/tcp | sed 's/.*://')"
for route in / /resumes/fixture-id/edit; do
  success=0
  for attempt in 1 2 3 4 5 6 7 8 9 10; do
    if curl --fail --silent --show-error "http://127.0.0.1:$port$route" -o "$archive_dir/page.html"; then success=1; break; fi
    sleep 1
  done
  [[ "$success" == 1 ]]
  grep -qi '<div id="root"' "$archive_dir/page.html"
done
docker save "$image_tag" -o "$archive_dir/web.tar"
docker run --rm -v "$archive_dir:/scan:ro" "$scanner_image" scan image --archive /scan/web.tar
