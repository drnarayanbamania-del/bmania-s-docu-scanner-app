# Hostinger deployment

`build.sh` produces `artifacts/hostinger/bamanias-scanner-web-<version>.zip`, which
contains everything the site needs:

```
index.html          the app shell
_expo/, assets/     the JS bundle, fonts and images
.htaccess           SPA fallback, caching and MIME rules for Apache/LiteSpeed
bamanias-scanner.apk  the signed Android app, downloadable from the same domain
```

## Upload

1. hPanel → **Websites → Manage → Files → File Manager**.
2. Open `public_html` and delete Hostinger's default `default.php` / placeholder page.
3. Upload the zip and **Extract** it inside `public_html`, then delete the zip.
   The files must sit directly in `public_html`, not in a subfolder — the bundle
   references `/_expo/...` and `/assets/...` from the domain root.
4. hPanel → **Security → SSL** → install the free certificate, then enable
   **Force HTTPS**.

Open `https://your-domain.com` — the app loads at the domain root, and the APK is
at `https://your-domain.com/bamanias-scanner-<version>.apk` (currently 1.0.1).

## Also required once per domain

- **Supabase → Authentication → URL Configuration**: set *Site URL* to your
  Hostinger domain and add it to *Redirect URLs*. Password-reset emails use this
  value, so without it the reset link points at the old URL.
- The Supabase URL and anon key are compiled into the bundle at build time, so the
  site talks to the same backend as the mobile app. Rotating the anon key requires
  a rebuild.

## Rebuild after code changes

```bash
deploy/hostinger/build.sh artifacts/release/bamanias-scanner-1.0.1.apk
```

Without an argument the script still builds the site, just without the APK.
It always builds with `EXPO_PUBLIC_ENABLE_UPLOAD_DIAGNOSTICS=0` so the
development-only diagnostics card never reaches the public site.
