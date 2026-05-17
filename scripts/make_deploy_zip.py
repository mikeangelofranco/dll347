from __future__ import annotations

import argparse
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parent.parent

COMMON_EXCLUDES = {
    ".env",
    ".env.local",
    ".env.production",
    ".env.development",
}

TARGET_EXCLUDES: dict[str, set[str]] = {
    "frontend": {
        ".next",
        "node_modules",
        ".git",
    },
    "backend": {
        ".venv",
        "venv",
        "__pycache__",
        ".git",
    },
}

TARGET_SKIP_SUFFIXES: dict[str, tuple[str, ...]] = {
    "frontend": (".log",),
    "backend": (".sqlite3", ".log"),
}


def should_include(path: Path, target: str) -> bool:
    rel_parts = path.relative_to(ROOT / target).parts
    if any(part in COMMON_EXCLUDES for part in rel_parts):
        return False
    if any(part in TARGET_EXCLUDES[target] for part in rel_parts):
        return False
    if path.is_file() and path.name.startswith(".env"):
        return False
    if path.is_file() and path.suffix in TARGET_SKIP_SUFFIXES[target]:
        return False
    return True


def build_zip(target: str, output: Path) -> None:
    source_dir = ROOT / target
    if not source_dir.exists():
        raise SystemExit(f"Target directory does not exist: {source_dir}")

    output.parent.mkdir(parents=True, exist_ok=True)

    with ZipFile(output, "w", compression=ZIP_DEFLATED) as archive:
        for path in source_dir.rglob("*"):
            if not should_include(path, target):
                continue
            if path.is_dir():
                continue
            archive.write(path, path.relative_to(source_dir).as_posix())


def main() -> None:
    parser = argparse.ArgumentParser(description="Create Linux-friendly deployment zip archives.")
    parser.add_argument(
        "--target",
        choices=("frontend", "backend"),
        required=True,
        help="Project target to package.",
    )
    parser.add_argument(
        "--output",
        required=True,
        help="Output zip path.",
    )
    args = parser.parse_args()

    build_zip(args.target, Path(args.output).expanduser().resolve())


if __name__ == "__main__":
    main()
