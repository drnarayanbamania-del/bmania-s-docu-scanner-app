#!/usr/bin/env bash
# Builds a signed release APK for Bamania's Scanner.
#
# Requirements: JDK 17, the Android SDK (platform 36, build-tools 36.0.0,
# NDK 27.1.12297006, cmake 3.22.1) and node_modules installed.
# Set JAVA_HOME and ANDROID_HOME if they are not in the default locations.
#
# Output: artifacts/release/bamanias-scanner-<version>.apk
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root"

: "${JAVA_HOME:=$HOME/tools/jdk-17.0.21+9}"
: "${ANDROID_HOME:=$HOME/android-sdk}"
export JAVA_HOME ANDROID_HOME
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"

if [ ! -f deploy/android/keystore.properties ]; then
  echo "deploy/android/keystore.properties is missing - the release key is needed to sign the APK." >&2
  exit 1
fi

# EXPO_PUBLIC_* values are baked into the JS bundle, so the Supabase URL and
# anon key must be available while Gradle bundles the app.
if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi
# Keep the development-only diagnostics card out of the shipped app.
export EXPO_PUBLIC_ENABLE_UPLOAD_DIAGNOSTICS=0

if [ ! -d android ]; then
  npx expo prebuild --platform android --no-install
  # prebuild rewrites these scripts; keep the repo's own versions.
  git checkout -- package.json 2>/dev/null || true
fi

echo "sdk.dir=$ANDROID_HOME" > android/local.properties

node deploy/android/apply-signing.js

version="$(node -p "require('./app.json').expo.version")"
apk="android/app/build/outputs/apk/release/app-release.apk"

# Phones are the target, so the two ARM ABIs are enough; building the x86
# variants only adds emulator support and doubles the native compile time.
: "${ANDROID_ABIS:=arm64-v8a,armeabi-v7a}"

(cd android && ./gradlew assembleRelease --no-daemon --max-workers=2 \
  "-PreactNativeArchitectures=$ANDROID_ABIS")

mkdir -p artifacts/release
cp "$apk" "artifacts/release/bamanias-scanner-$version.apk"
echo "APK: artifacts/release/bamanias-scanner-$version.apk"
ls -lh "artifacts/release/bamanias-scanner-$version.apk"
