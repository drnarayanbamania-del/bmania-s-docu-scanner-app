# Release checklist

Everything below assumes you are at the repository root.

## 0. Before you start

- [ ] `.env` has the live `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`
      (they are compiled into both the web bundle and the APK at build time).
- [ ] `deploy/android/bamania-release.keystore` **and** `deploy/android/keystore.properties`
      exist and are backed up somewhere private. Losing them means no future update
      can be installed over the published app — the certificate must stay identical.
- [ ] `npm install --legacy-peer-deps` has been run on this machine (the native build
      reads `node_modules`).
- [ ] JDK 17 and the Android SDK are present: platform 36, build-tools 36.0.0,
      NDK 27.1.12297006, cmake 3.22.1 (`JAVA_HOME` / `ANDROID_HOME` if not default).
- [ ] `npm run typecheck` passes.

## 1. Version

- [ ] Bump both values: `app.json` → `expo.version` **and** `expo.android.versionCode`
      (increment by one). Android only installs an update when `versionCode` goes up.
      `deploy/release.sh` does both for you.
- [ ] Risk area changed since the last release? Re-test that flow on a real phone.

## 2. Build

```bash
deploy/release.sh            # patch bump (1.0.1 -> 1.0.2)
deploy/release.sh minor      # 1.0.1 -> 1.1.0
deploy/release.sh 2.0.0      # explicit
deploy/release.sh --dry-run  # show the next version only
```

This regenerates the native project, builds the signed APK and produces the
Hostinger zip in one go (about 10 minutes on 2 cores).

Outputs:

- `artifacts/release/bamanias-scanner-<version>.apk`
- `artifacts/hostinger/bamanias-scanner-web-<version>.zip`

If the build fails, `app.json` is already bumped — revert it with
`git checkout -- app.json` before retrying.

The script also drafts `deploy/release-notes/v<version>.md` from the commits
since the previous tag when that file does not exist yet. The generated summary
is a placeholder — rewrite the paragraph above `## Changes` before publishing.

## 3. Verify the artifacts

- [ ] `aapt2 dump badging artifacts/release/bamanias-scanner-<version>.apk | head -1`
      shows the expected `versionCode` and `versionName`, package `com.bamania.scanner`.
- [ ] `apksigner verify --print-certs <apk>` reports
      `SHA-256 digest: b01deb4274927733f6eababfb21de34d8e51b9cd0dd983061419fe731cf473a8`
      — a different digest means the APK will not update an installed copy.
- [ ] Install on a real device: the app opens, login works, a scan saves.
- [ ] Zip contains `index.html`, `.htaccess` and the APK.

## 4. Publish

Hostinger:

- [ ] File Manager → `public_html` → upload the zip → Extract → delete the zip.
- [ ] Delete the previous `bamanias-scanner-<old>.apk` so no stale download stays live.
- [ ] Open the site, sign in, save one scan; open the APK URL and check it downloads.
- [ ] Keep SSL active and "Force HTTPS" on.

Aptoide:

- [ ] Upload the new APK; the higher `versionCode` updates the existing listing.
- [ ] Bump the store listing's "What's new" text.

GitHub (optional, one command once `gh auth login` has been run):

```bash
deploy/github-release.sh          # tag + release + APK asset
```

The release body comes from `deploy/release-notes/v<version>.md`, so write that
file as part of the release. Use `--draft` to stage it first, or `--force` to
replace the asset on an existing release.

## 5. After publishing

- [ ] Supabase → Authentication → URL Configuration: *Site URL* and *Redirect URLs*
      point at the live domain (password-reset mails use them).
- [ ] Storage: the `scanned-pages` bucket is private, and the app still shows a page
      image in a second browser/device (proves uploads, not inline fallback).
- [ ] Keep the previous APK artifact until the new one is confirmed working.
