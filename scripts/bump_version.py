#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DIR = ROOT / "frontend"
PACKAGE_JSON = FRONTEND_DIR / "package.json"
PACKAGE_LOCK_JSON = FRONTEND_DIR / "package-lock.json"
ROOT_VERSION_FILE = ROOT / "VERSION"
PUBLIC_VERSION_FILE = FRONTEND_DIR / "public" / "version.json"


def get_current_version() -> str:
    if PACKAGE_JSON.exists():
        data = json.loads(PACKAGE_JSON.read_text(encoding="utf-8"))
        if "version" in data:
            return data["version"]
    if ROOT_VERSION_FILE.exists():
        return ROOT_VERSION_FILE.read_text(encoding="utf-8").strip()
    return "0.1.0"


def increment_semver(version: str, bump_type: str = "patch") -> str:
    match = re.match(r"^(\d+)\.(\d+)\.(\d+)(.*)$", version.strip())
    if not match:
        raise ValueError(f"Version '{version}' is not in semantic version format X.Y.Z")
    major, minor, patch, suffix = match.groups()
    maj, min_, pat = int(major), int(minor), int(patch)

    if bump_type == "major":
        return f"{maj + 1}.0.0"
    elif bump_type == "minor":
        return f"{maj}.{min_ + 1}.0"
    elif bump_type == "patch":
        return f"{maj}.{min_}.{pat + 1}"
    else:
        raise ValueError(f"Unknown bump type: {bump_type}. Expected major, minor, or patch.")


def bump_version(new_version: str | None = None, bump_type: str = "patch") -> str:
    current = get_current_version()
    target_version = new_version if new_version else increment_semver(current, bump_type)

    # 1. Update frontend/package.json
    if PACKAGE_JSON.exists():
        pkg = json.loads(PACKAGE_JSON.read_text(encoding="utf-8"))
        pkg["version"] = target_version
        PACKAGE_JSON.write_text(json.dumps(pkg, indent=2) + "\n", encoding="utf-8")

    # 2. Update frontend/package-lock.json
    if PACKAGE_LOCK_JSON.exists():
        lock = json.loads(PACKAGE_LOCK_JSON.read_text(encoding="utf-8"))
        lock["version"] = target_version
        if "packages" in lock and "" in lock["packages"]:
            lock["packages"][""]["version"] = target_version
        PACKAGE_LOCK_JSON.write_text(json.dumps(lock, indent=2) + "\n", encoding="utf-8")

    # 3. Update root VERSION file
    ROOT_VERSION_FILE.write_text(f"{target_version}\n", encoding="utf-8")

    # 4. Update frontend/public/version.json
    PUBLIC_VERSION_FILE.parent.mkdir(parents=True, exist_ok=True)
    version_payload = {
        "version": target_version,
        "previous_version": current,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    PUBLIC_VERSION_FILE.write_text(json.dumps(version_payload, indent=2) + "\n", encoding="utf-8")

    print(f"App version bumped: {current} -> {target_version}")
    return target_version


def main() -> None:
    parser = argparse.ArgumentParser(description="Bump app version across package.json, VERSION, and public/version.json.")
    parser.add_argument(
        "--type",
        choices=("patch", "minor", "major"),
        default="patch",
        help="Type of semver bump (default: patch)",
    )
    parser.add_argument(
        "--set-version",
        dest="set_version",
        help="Explicit version string to set instead of bumping",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Print current version and exit",
    )
    args = parser.parse_args()

    if args.check:
        print(f"Current app version: {get_current_version()}")
        return

    bump_version(new_version=args.set_version, bump_type=args.type)


if __name__ == "__main__":
    main()
