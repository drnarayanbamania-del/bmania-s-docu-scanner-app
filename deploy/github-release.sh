#!/usr/bin/env bash
# Publishes the GitHub release for a built version: tag, release notes and the
# signed APK as a downloadable asset.
#
# Usage:
#   deploy/github-release.sh                 # current version from app.json
#   deploy/github-release.sh 1.0.2           # explicit version
#   deploy/github-release.sh --draft         # publish as a draft
#   deploy/github-release.sh --force         # replace an existing release's asset
#   deploy/github-release.sh --dry-run       # show what would happen
#
# Requires the GitHub CLI (`gh`), logged in once: gh auth login
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

version=""
draft=""
force=""
dry_run=""
for arg in "$@"; do
  case "$arg" in
    --draft) draft="--draft" ;;
    --force) force=1 ;;
    --dry-run) dry_run=1 ;;
    --*) echo "Unknown option: $arg" >&2; exit 2 ;;
    *) [ -z "$version" ] && version="$arg" ;;
  esac
done

app_version="$(node -p "require('./app.json').expo.version")"
version="${version:-$app_version}"
tag="v$version"
apk="artifacts/release/bamanias-scanner-$version.apk"
notes="deploy/release-notes/v$version.md"
# Older notes files may lack the "v" prefix; prefer them when present.
if [ ! -f "$notes" ] && [ -f "deploy/release-notes/$version.md" ]; then
  notes="deploy/release-notes/$version.md"
fi
title="Bamania's Scanner $version"

run() {
  if [ -n "$dry_run" ]; then
    echo "would run: $*"
  else
    "$@"
  fi
}

# ── Pre-flight ────────────────────────────────────────────────────────────────
if [ ! -f "$apk" ]; then
  echo "Missing $apk" >&2
  echo "Build it first: deploy/release.sh (or deploy/android/build-apk.sh)" >&2
  exit 1
fi

# The body always comes from a file, so draft one instead of failing when a
# version was released without notes (for example from an older checkout).
if [ ! -f "$notes" ]; then
  echo "No release notes for $version - drafting them from git history." >&2
  if [ -n "$dry_run" ]; then
    echo "would write: $notes (deploy/release-notes.sh $version $apk)"
  else
    notes="deploy/release-notes/v$version.md"
    mkdir -p deploy/release-notes
    deploy/release-notes.sh "$version" "$apk" > "$notes"
    echo "Wrote $notes - edit the summary if you want a richer body." >&2
  fi
fi

if [ "$version" != "$app_version" ]; then
  echo "Warning: app.json says $app_version but you asked for $version." >&2
fi

if [ -z "$dry_run" ]; then
  if ! command -v gh >/dev/null 2>&1; then
    echo "The GitHub CLI is not installed: https://cli.github.com" >&2
    exit 1
  fi
  if ! gh auth status >/dev/null 2>&1; then
    echo "Not logged in to GitHub. Run: gh auth login" >&2
    exit 1
  fi
fi

branch="$(git rev-parse --abbrev-ref HEAD)"
if [ -n "$(git status --porcelain)" ]; then
  echo "Note: the working tree has uncommitted changes; the tag points at HEAD ($(git rev-parse --short HEAD))."
fi

echo "Releasing $title"
echo "  tag:    $tag"
echo "  APK:    $apk ($(du -h "$apk" | cut -f1))"
echo "  sha256: $(sha256sum "$apk" | cut -d' ' -f1)"
echo "  notes:  $notes"

# ── Tag ───────────────────────────────────────────────────────────────────────
if git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then
  echo "Tag $tag already exists locally."
else
  run git tag -a "$tag" -m "$(printf '%s\n\n%s' "$title" "$(head -1 "$notes" | sed 's/^# //')")"
fi

tag_pushed=1
if [ -z "$dry_run" ] && ! git ls-remote --exit-code --tags origin "refs/tags/$tag" >/dev/null 2>&1; then
  if git push origin "refs/tags/$tag"; then
    echo "Pushed $tag."
  else
    echo "Could not push the tag with git; letting gh create it on $branch." >&2
    tag_pushed=0
  fi
fi

# ── Release ───────────────────────────────────────────────────────────────────
if [ -z "$dry_run" ] && gh release view "$tag" >/dev/null 2>&1; then
  if [ -n "$force" ]; then
    echo "Release $tag exists - replacing the APK asset."
    gh release upload "$tag" "$apk" --clobber
    gh release edit "$tag" --title "$title" --notes-file "$notes"
    echo "Done: $(gh release view "$tag" --json url -q .url)"
  else
    echo "Release $tag already exists. Use --force to replace its APK, or bump the version." >&2
    echo "$(gh release view "$tag" --json url -q .url)"
  fi
  exit 0
fi

target=()
if [ "$tag_pushed" = "0" ]; then
  target=(--target "$branch")
fi

run gh release create "$tag" "$apk" \
  --title "$title" \
  --notes-file "$notes" \
  ${draft:+$draft} \
  ${target[@]+"${target[@]}"}

if [ -n "$dry_run" ]; then
  echo "Dry run finished."
else
  echo "Published: $(gh release view "$tag" --json url -q .url)"
fi
