#!/usr/bin/env bash
# Builds the Hostinger upload package:
#   dist/            the web export (served as the site)
#   dist/.htaccess   Apache routing/caching rules
#   dist/*.apk       the release APK, downloadable from the same domain
#
# Usage: deploy/hostinger/build.sh [path-to-apk]
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root"

# EXPO_PUBLIC_* values are baked into the bundle at build time, so the Supabase
# URL and anon key must be present in .env (or the environment) here.
if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

# The upload retry diagnostics card is a development tool; keep it out of the
# public bundle even when the local .env turns it on.
export EXPO_PUBLIC_ENABLE_UPLOAD_DIAGNOSTICS=0

rm -rf dist
npm run build -- --clear

cp deploy/hostinger/.htaccess dist/.htaccess

apk="${1:-}"
if [ -n "$apk" ] && [ -f "$apk" ]; then
  cp "$apk" "dist/$(basename "$apk")"
else
  echo "No APK copied (pass its path to include it in the upload)."
fi

mkdir -p artifacts/hostinger
name="bamanias-scanner-web-$(node -p "require('./app.json').expo.version")"
rm -f "artifacts/hostinger/$name.zip"
(cd dist && zip -qr "$root/artifacts/hostinger/$name.zip" .)

echo "Upload package: artifacts/hostinger/$name.zip"
du -h "artifacts/hostinger/$name.zip"
