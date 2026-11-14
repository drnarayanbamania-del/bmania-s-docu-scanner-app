#!/usr/bin/env bash
# Health-checks a deployed Hostinger site.
#
#   deploy/hostinger/verify.sh https://your-domain.com
#   deploy/hostinger/verify.sh https://domain.com/scanner
#
# Checks the shell, the JS bundle it references, the APK download, the SPA
# fallback that .htaccess provides, and caching on hashed assets. Exits non-zero
# if anything fails.
set -uo pipefail

base="${1:-}"
if [ -z "$base" ]; then
  echo "usage: deploy/hostinger/verify.sh https://your-domain.com" >&2
  exit 2
fi
base="${base%/}"
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root"

version="$(node -p "require('./app.json').expo.version" 2>/dev/null || echo unknown)"
apk="bamanias-scanner-$version.apk"
local_apk="artifacts/release/$apk"
body="/tmp/verify-body.$$"
fails=0

say() { printf '%s\n' "$*"; }
pass() { say "PASS  $*"; }
fail() { say "FAIL  $*"; fails=$((fails + 1)); }

# status<TAB>content-type<TAB>bytes, or "000" when the request did not complete
probe() {
  local out
  out="$(curl -sS -m 25 -o "$body" -w '%{http_code}\t%{content_type}\t%{size_download}' "$1" 2>/dev/null)"
  if [ -z "$out" ]; then
    printf '000\t-\t0'
  else
    printf '%s' "$out"
  fi
}

say "Checking $base (app $version)"
say ""

# 1. The app shell.
read -r code ctype size <<<"$(probe "$base/")"
case "$code" in
  200) pass "index: HTTP 200, ${ctype%%,*}, ${size}B" ;;
  000) fail "index: no response (DNS, TLS or server error)" ;;
  *) fail "index: HTTP $code (expected 200)" ;;
esac

if grep -q '<div id="root"' "$body" 2>/dev/null; then
  pass "index: contains the app root element"
else
  fail "index: does not look like the exported app shell (placeholder page still live?)"
fi

# 2. The JS bundle referenced by the shell, so a wrong base path shows up.
bundles="$(grep -oE '/_expo/static/js/web/[A-Za-z0-9._-]+\.js' "$body" 2>/dev/null | sort -u)"
bundle="$(printf '%s\n' "$bundles" | head -1)"
if [ -z "$bundle" ]; then
  fail "bundle: no /_expo/... script referenced in index.html"
else
  # The shell loads several chunks; every one of them has to load.
  bad=""
  total=0
  for js in $bundles; do
    read -r bcode _ bsize <<<"$(probe "$base$js")"
    [ "$bcode" = "200" ] || bad="$js HTTP $bcode"
    total=$((total + bsize))
  done
  count="$(printf '%s\n' "$bundles" | wc -l | tr -d ' ')"
  if [ -z "$bad" ] && [ "$total" -gt 50000 ]; then
    pass "bundle: $count chunk(s) load, ${total}B total"
  else
    fail "bundle: ${bad:-only ${total}B of chunks loaded} (expected every chunk, >50KB)"
  fi
fi

# 3. The APK download.
if [ -f "$local_apk" ]; then
  expect="$(stat -c%s "$local_apk")"
  read -r acode atype asize <<<"$(probe "$base/$apk")"
  if [ "$acode" = "200" ] && [ "$asize" = "$expect" ]; then
    pass "apk: $apk HTTP 200, $asize bytes (matches the local artifact)"
  elif [ "$acode" = "200" ]; then
    fail "apk: $apk served $asize bytes, local build is $expect"
  else
    fail "apk: $apk HTTP $acode (not uploaded, or an older version is still there)"
  fi
else
  read -r acode _ _ <<<"$(probe "$base/$apk")"
  [ "$acode" = "200" ] && pass "apk: $apk HTTP 200" || fail "apk: $apk HTTP $acode"
fi

# 4. SPA fallback: a deep route must return the shell, not a 404.
read -r dcode dtype dsize <<<"$(probe "$base/dashboard")"
if [ "$dcode" = "200" ] && grep -q '<div id="root"' "$body" 2>/dev/null; then
  pass "spa fallback: /dashboard returns the app shell"
else
  fail "spa fallback: /dashboard HTTP $dcode (missing .htaccess, or it sits in a subfolder)"
fi

# 5. Caching on immutable, hashed assets.
cache="$(curl -sSI -m 20 "$base${bundle:-/index.html}" 2>/dev/null | tr -d '\r' | grep -i '^cache-control:' | head -1)"
if printf '%s' "$cache" | grep -qiE 'max-age=[1-9]'; then
  pass "caching: ${cache#*: }"
else
  fail "caching: no max-age header on hashed assets"
fi

# 6. HTTPS enforcement.
if [ "${base#https://}" != "$base" ]; then
  plain="http://${base#https://}"
  redirect="$(curl -sS -m 20 -o /dev/null -w '%{http_code} %{redirect_url}' "$plain/" 2>/dev/null)"
  case "$redirect" in
    30[1278]*https://*) pass "https: $plain redirects to https" ;;
    *) fail "https: $plain did not redirect ($redirect) - enable Force HTTPS" ;;
  esac
fi

rm -f "$body"
say ""
if [ "$fails" -eq 0 ]; then
  say "All checks passed."
  exit 0
fi
say "$fails check(s) failed."
exit 1
