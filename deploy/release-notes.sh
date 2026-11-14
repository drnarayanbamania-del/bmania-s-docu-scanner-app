#!/usr/bin/env bash
# Drafts the release notes for a version from the commits since the last tag.
#
#   deploy/release-notes.sh 1.0.3                     # notes only
#   deploy/release-notes.sh 1.0.3 artifacts/...apk    # fills in the APK checksum
#
# Printed to stdout so callers can write it wherever they need it. The summary
# above "## Changes" is a placeholder for a human to rewrite.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

version="${1:-}"
apk="${2:-}"
if [ -z "$version" ]; then
  echo "usage: deploy/release-notes.sh <version> [apk-path]" >&2
  exit 2
fi

read -r app_version code <<<"$(node -e "
  const a = require('./app.json').expo;
  console.log(a.version, a.android.versionCode || 1);
")"

# Commits since the previous release tag. Until the first release exists, use
# the whole history so the notes are still complete.
last_tag="$(git describe --tags --abbrev=0 --match 'v*' 2>/dev/null || true)"
# Drafting notes for a version that is already tagged means the interesting
# commits are the ones before that tag.
if [ -n "$last_tag" ] && [ "$last_tag" = "v$version" ]; then
  last_tag="$(git describe --tags --abbrev=0 --match 'v*' "$last_tag^" 2>/dev/null || true)"
fi
if [ -n "$last_tag" ] && git rev-parse -q --verify "refs/tags/$last_tag" >/dev/null; then
  range="$last_tag..HEAD"
else
  range="HEAD"
fi

subjects="$(git log "$range" --no-merges --format='%s')"

user_facing="$(printf '%s\n' "$subjects" | grep -E '^(feat|fix)(\(|:)' || true)"
maintenance="$(printf '%s\n' "$subjects" | grep -E '^(build|docs|chore|refactor|test|perf|style|ci)(\(|:)' || true)"

bullet_list() {
  # Drop the conventional-commit prefix so the lines read like release notes.
  printf '%s\n' "$1" | sed -E 's/^[a-z]+(\([^)]*\))?: //' | sed -E 's/^./\U&/' | grep -v '^$' | sed 's/^/- /'
}

today="$(date +%Y-%m-%d)"

cat <<EOF
# Bamania's Scanner $version

<!-- Drafted by deploy/release-notes.sh on $today from the commits after
     ${last_tag:-the start of the project}. Replace this paragraph with one or
     two sentences on what changed and why, then publish. -->

## Changes
EOF

if [ -n "$user_facing" ]; then
  printf '\n'
  bullet_list "$user_facing"
else
  printf '\n- No user-facing changes.\n'
fi

if [ -n "$maintenance" ]; then
  printf '\n## Under the hood\n\n'
  bullet_list "$maintenance"
fi

printf '\n## Download\n\n'
if [ -n "$apk" ] && [ -f "$apk" ]; then
  size="$(du -h "$apk" | cut -f1 | tr -d ' ')"
  sha="$(sha256sum "$apk" | cut -d' ' -f1)"
  printf '`%s` (%s)\n\n' "$(basename "$apk")" "$size"
else
  printf '`bamanias-scanner-%s.apk` (built by `deploy/release.sh`)\n\n' "$version"
fi

cat <<EOF
| | |
|---|---|
| Package | \`com.bamania.scanner\` |
| Version | $version (versionCode $code) |
| Android | 7.0+ (minSdk 24, targetSdk 36) |
| Architectures | \`arm64-v8a\`, \`armeabi-v7a\` |
EOF

if [ -n "$apk" ] && [ -f "$apk" ]; then
  printf '| SHA-256 | `%s` |\n' "$(sha256sum "$apk" | cut -d' ' -f1)"
fi

cat <<EOF

Signed with the project release key; verify it with
\`apksigner verify --print-certs <apk>\`. It installs over any earlier build that
shares the same signing certificate.

## Notes

- Scans need a network connection to upload page images to Supabase Storage. A
  failed upload keeps the page on the device so nothing is lost.
EOF

if [ "$version" != "$app_version" ]; then
  printf '\n> app.json currently says %s (versionCode %s).\n' "$app_version" "$code"
fi
