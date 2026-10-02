#!/usr/bin/env python3
"""
Safe in-place avatar optimizer for DLL347 member photos.
Resizes oversized PNG avatars to max 256x256 px and applies adaptive 8-bit palette
with alpha transparency (FASTOCTREE).
Preserves file names, paths, and transparency with 100% backward compatibility.
"""
from __future__ import annotations

import argparse
import os
import shutil
import sys
import tarfile
from datetime import datetime, timezone
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Error: Pillow is required. Install with: pip install Pillow")
    sys.exit(1)


def create_backup(target_dir: Path, backup_dest: Path) -> Path:
    backup_dest.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    archive_name = backup_dest / f"photos_backup_{timestamp}.tar.gz"
    print(f"Creating backup of {target_dir} -> {archive_name}...")
    with tarfile.open(archive_name, "w:gz") as tar:
        tar.add(target_dir, arcname=target_dir.name)
    print(f"Backup created successfully: {archive_name} ({archive_name.stat().st_size / 1024 / 1024:.2f} MB)")
    return archive_name


def optimize_png(file_path: Path, max_dim: int = 256) -> tuple[int, int, bool]:
    orig_size = file_path.stat().st_size
    temp_path = file_path.with_suffix(".tmp.png")

    try:
        with Image.open(file_path) as im:
            # Only process if image is larger than max_dim or file is larger than 60KB
            w, h = im.size
            if max(w, h) <= max_dim and orig_size <= 60 * 1024:
                return orig_size, orig_size, False

            # Convert to RGBA if not already
            if im.mode != "RGBA":
                im = im.convert("RGBA")

            # Resize keeping aspect ratio
            im.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)

            # Quantize to 256 colors keeping alpha channel
            quantized = im.quantize(colors=256, method=Image.Quantize.FASTOCTREE)
            quantized.save(temp_path, "PNG", optimize=True)

        new_size = temp_path.stat().st_size
        if new_size < orig_size:
            temp_path.replace(file_path)
            return orig_size, new_size, True
        else:
            if temp_path.exists():
                temp_path.unlink()
            return orig_size, orig_size, False

    except Exception as e:
        if temp_path.exists():
            temp_path.unlink()
        print(f"  Warning: Failed to optimize {file_path.name}: {e}")
        return orig_size, orig_size, False


def run_optimization(target_dir: Path, backup_dir: Path | None = None, max_dim: int = 256) -> None:
    if not target_dir.exists():
        print(f"Error: Target directory does not exist: {target_dir}")
        sys.exit(1)

    if backup_dir:
        create_backup(target_dir, backup_dir)

    png_files = sorted(target_dir.glob("*.png"))
    if not png_files:
        print(f"No PNG files found in {target_dir}")
        return

    print(f"\nProcessing {len(png_files)} PNG files in {target_dir}...")
    total_orig = 0
    total_new = 0
    optimized_count = 0

    for idx, path in enumerate(png_files, start=1):
        orig_sz, new_sz, was_opt = optimize_png(path, max_dim)
        total_orig += orig_sz
        total_new += new_sz
        if was_opt:
            optimized_count += 1
            savings = (1 - (new_sz / orig_sz)) * 100
            if idx <= 10 or idx % 25 == 0 or idx == len(png_files):
                print(f"  [{idx}/{len(png_files)}] {path.name}: {orig_sz / 1024:.1f} KB -> {new_sz / 1024:.1f} KB (-{savings:.1f}%)")

    total_savings_pct = (1 - (total_new / total_orig)) * 100 if total_orig > 0 else 0
    print("\n" + "=" * 50)
    print(f"Optimization Summary:")
    print(f"  Total files processed:  {len(png_files)}")
    print(f"  Files optimized:        {optimized_count}")
    print(f"  Original total size:    {total_orig / 1024 / 1024:.2f} MB")
    print(f"  Optimized total size:   {total_new / 1024 / 1024:.2f} MB")
    print(f"  Total bandwidth saved:  {(total_orig - total_new) / 1024 / 1024:.2f} MB (-{total_savings_pct:.1f}%)")
    print("=" * 50)


def main() -> None:
    parser = argparse.ArgumentParser(description="Optimize avatar PNG files for DLL347.")
    parser.add_argument(
        "--dir",
        default="/srv/dll347/backend/uploads/member-default-profile-photos",
        help="Path to folder containing avatars",
    )
    parser.add_argument(
        "--backup-dir",
        default="/srv/dll347/backups",
        help="Path to backup folder",
    )
    parser.add_argument(
        "--no-backup",
        action="store_true",
        help="Skip automatic backup",
    )
    parser.add_argument(
        "--max-dim",
        type=int,
        default=256,
        help="Maximum width/height in px (default: 256)",
    )
    args = parser.parse_args()

    target_path = Path(args.dir).resolve()
    backup_path = None if args.no_backup else Path(args.backup_dir).resolve()
    run_optimization(target_path, backup_path, args.max_dim)


if __name__ == "__main__":
    main()
