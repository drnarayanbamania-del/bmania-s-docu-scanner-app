#!/usr/bin/env python3
"""Uploads the built Hostinger package to public_html over FTP/FTPS.

Usage:
  deploy/hostinger/upload.py --dry-run          # show what would be sent
  deploy/hostinger/upload.py                    # upload dist/ to public_html
  deploy/hostinger/upload.py --dir artifacts/... # upload an extracted zip

Credentials come from deploy/hostinger/ftp.env (gitignored), created from
ftp.env.example. Files whose size already matches on the server are skipped, so
re-running after a small change only sends what changed.
"""

from __future__ import annotations

import argparse
import ftplib
import posixpath
import ssl
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_ENV = ROOT / "deploy" / "hostinger" / "ftp.env"


def load_env(path: Path) -> dict[str, str]:
    if not path.exists():
        sys.exit(
            f"Missing {path.relative_to(ROOT)}.\n"
            "Copy deploy/hostinger/ftp.env.example to that name and fill in the\n"
            "FTP account from Hostinger hPanel -> Files -> FTP Accounts."
        )
    values: dict[str, str] = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip("'\"")
    return values


def connect(env: dict[str, str]) -> ftplib.FTP:
    host = env.get("HOSTINGER_FTP_HOST", "")
    user = env.get("HOSTINGER_FTP_USER", "")
    password = env.get("HOSTINGER_FTP_PASS", "")
    port = int(env.get("HOSTINGER_FTP_PORT", "21"))
    use_tls = env.get("HOSTINGER_FTP_TLS", "1") not in ("0", "false", "no")

    missing = [k for k, v in (
        ("HOSTINGER_FTP_HOST", host),
        ("HOSTINGER_FTP_USER", user),
        ("HOSTINGER_FTP_PASS", password),
    ) if not v]
    if missing:
        sys.exit(f"ftp.env is missing: {', '.join(missing)}")

    if use_tls:
        ftp: ftplib.FTP = ftplib.FTP_TLS(context=ssl.create_default_context())
    else:
        ftp = ftplib.FTP()
    ftp.connect(host, port, timeout=90)
    ftp.login(user, password)
    if isinstance(ftp, ftplib.FTP_TLS):
        ftp.prot_p()
    return ftp


def ensure_dir(ftp: ftplib.FTP, remote: str) -> None:
    """mkdir -p for FTP: build the path one segment at a time."""
    parts = [p for p in remote.strip("/").split("/") if p]
    ftp.cwd("/")
    for part in parts:
        try:
            ftp.cwd(part)
        except ftplib.error_perm:
            ftp.mkd(part)
            ftp.cwd(part)


def remote_size(ftp: ftplib.FTP, path: str) -> int | None:
    try:
        # Some servers only answer SIZE in binary mode.
        ftp.voidcmd("TYPE I")
        return ftp.size(path)
    except ftplib.all_errors:
        return None


def main() -> int:
    parser = argparse.ArgumentParser(description="Upload the Hostinger package.")
    parser.add_argument("--dir", default="dist", help="local folder to upload (default: dist)")
    parser.add_argument("--env", default=str(DEFAULT_ENV), help="path to ftp.env")
    parser.add_argument("--dry-run", action="store_true", help="list files without connecting")
    args = parser.parse_args()

    source = (ROOT / args.dir).resolve()
    if not source.is_dir():
        sys.exit(f"{args.dir} does not exist. Build it first: deploy/hostinger/build.sh")

    files = sorted(p for p in source.rglob("*") if p.is_file())
    if not files:
        sys.exit(f"{args.dir} is empty.")
    total = sum(p.stat().st_size for p in files)
    try:
        shown = source.relative_to(ROOT)
    except ValueError:
        shown = source
    print(f"{len(files)} files, {total / 1e6:.1f} MB from {shown}")

    if args.dry_run:
        for path in files:
            print(f"  {path.relative_to(source)}")
        print("Dry run: nothing uploaded.")
        return 0

    env = load_env(Path(args.env))
    remote_root = env.get("HOSTINGER_FTP_DIR", "public_html")
    print(f"Connecting to {env.get('HOSTINGER_FTP_HOST')} ...")
    ftp = connect(env)

    uploaded = skipped = 0
    try:
        ensure_dir(ftp, remote_root)
        for path in files:
            rel = path.relative_to(source).as_posix()
            remote_dir = posixpath.join(remote_root, posixpath.dirname(rel))
            remote_path = posixpath.join(remote_root, rel)
            ensure_dir(ftp, remote_dir)

            # SIZE resolves against the current directory, which ensure_dir just
            # changed, so ask for the path from the FTP root.
            if remote_size(ftp, "/" + remote_path) == path.stat().st_size:
                skipped += 1
                continue

            with path.open("rb") as handle:
                ftp.storbinary(f"STOR {posixpath.basename(rel)}", handle)
            uploaded += 1
            print(f"  sent {rel}")
    finally:
        try:
            ftp.quit()
        except ftplib.all_errors:
            ftp.close()

    print(f"Done: {uploaded} uploaded, {skipped} unchanged.")
    print(
        "Check the site, and delete any older bamanias-scanner-*.apk from\n"
        f"{remote_root}/ so stale downloads stop working."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
