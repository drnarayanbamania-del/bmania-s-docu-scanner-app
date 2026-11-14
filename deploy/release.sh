#!/usr/bin/env bash
# One command per release: bumps the version, rebuilds the signed APK and the
# Hostinger upload package, then checks what it produced.
#
# Usage:
#   deploy/release.sh            # 1.0.1 -> 1.0.2, versionCode +1
#   deploy/release.sh minor      # 1.0.1 -> 1.1.0
#   deploy/release.sh major      # 1.0.1 -> 2.0.0
#   deploy/release.sh 2.3.0      # explicit version
#   deploy/release.sh --dry-run  # print the new version and stop
#
# Nothing is committed or uploaded; the script only writes app.json and the
# artifacts under artifacts/.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

bump=""
dry_run=""
for arg in "$@"; do
  case "$arg" in
    --dry-run) dry_run=1 ;;
    *) [ -z "$bump" ] && bump="$arg" ;;
  esac
done
bump="${bump:-patch}"

# ── Work out the next version ────────────────────────────────────────────────
read -r current version code <<<"$(node -e "
  const a = require('./app.json').expo;
  console.log(a.version, a.version, a.android.versionCode || 1);
")"

next="$(node -e "
  const current = '$version';
  const bump = '$bump';
  const parts = current.split('.').map(Number);
  if (/^\d+\.\d+\.\d+$/.test(bump)) {
    console.log(bump);
  } else if (bump === 'major') {
    console.log([parts[0] + 1, 0, 0].join('.'));
  } else if (bump === 'minor') {
    console.log([parts[0], parts[1] + 1, 0].join('.'));
  } else if (bump === 'patch') {
    console.log([parts[0], parts[1], parts[2] + 1].join('.'));
  } else {
    console.error('Unknown bump: ' + bump + ' (use major, minor, patch or X.Y.Z)');
    process.exit(1);
  }
")"
next_code=$((code + 1))

echo "Version $version (code $code) -> $next (code $next_code)"

if [ -n "$dry_run" ]; then
  exit 0
fi

# ── Write app.json, keeping the file's 2-space formatting ────────────────────
node -e "
  const fs = require('fs');
  const app = JSON.parse(fs.readFileSync('app.json', 'utf8'));
  app.expo.version = '$next';
  app.expo.android = { ...app.expo.android, versionCode: $next_code };
  fs.writeFileSync('app.json', JSON.stringify(app, null, 2) + '\n');
"

# ── Regenerate the native project so versionCode reaches Gradle ──────────────
# expo prebuild rewrites the package.json scripts; keep the repo's own versions.
npx expo prebuild --platform android --no-install
git checkout -- package.json 2>/dev/null || true

# ── Build both artifacts ─────────────────────────────────────────────────────
deploy/android/build-apk.sh
apk="artifacts/release/bamanias-scanner-$next.apk"

# Every release needs release notes, so draft them from the commits when the
# file is missing; the summary at the top is meant to be rewritten by hand.
notes="deploy/release-notes/v$next.md"
if [ ! -f "$notes" ]; then
  mkdir -p deploy/release-notes
  deploy/release-notes.sh "$next" "$apk" > "$notes"
  echo "Drafted release notes: $notes (edit the summary before publishing)"
fi

deploy/hostinger/build.sh "$apk"

# ── Report what was produced ─────────────────────────────────────────────────
export JAVA_HOME="${JAVA_HOME:-$HOME/tools/jdk-17.0.21+9}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/android-sdk}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
aapt2="$ANDROID_HOME/build-tools/36.0.0/aapt2"
apksigner="$ANDROID_HOME/build-tools/36.0.0/apksigner"

if [ -x "$aapt2" ]; then
  "$aapt2" dump badging "$apk" 2>/dev/null | grep -E "^package:" || true
fi
if [ -x "$apksigner" ]; then
  echo "Signing certificate (must match the previous release):"
  "$apksigner" verify --print-certs "$apk" 2>&1 | grep -E "SHA-256 digest|does not verify" | head -2 || true
fi

cat <<EOF

Done.
  APK:      $apk
  Notes:    $notes
  Hostinger: artifacts/hostinger/bamanias-scanner-web-$next.zip

Next: upload the zip to Hostinger (public_html), replace the old APK there,
and publish the new APK on Aptoide. Keep the signing key and note that the
certificate fingerprint must match the previous release.
EOF
