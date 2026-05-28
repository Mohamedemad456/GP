#!/usr/bin/env python3
"""Register an existing processed CSV as a version in the manifest.

Useful for backfilling the manifest with historical processed files
that were created before version management existed.

Usage:
    python scripts/cleaning/register_processed_version.py \
        --processed data/processed/processed_data.csv \
        --raw data/raw/cars_raw_v001.csv \
        --tag snapshot_one \
        --scraping-num 1 \
        --apply
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from scripts.cleaning.version_manager import DataVersion, VersionManager


def _rel(path: Path) -> str:
    """Return a project-root-relative path string (portable across machines)."""
    try:
        return str(path.relative_to(PROJECT_ROOT))
    except ValueError:
        return str(path)


def _extract_scraping_num_from_raw_path(raw_path: Path) -> int | None:
    """Auto-detect scraping_num from filename like cars_raw_v001.csv → 1."""
    name = raw_path.stem  # e.g. 'cars_raw_v001'
    import re
    m = re.search(r"_v0*(\d+)$", name)
    if m:
        return int(m.group(1))
    return None


def register(
    processed_path: Path,
    raw_path: Path,
    tag: str,
    scraping_num: int | None,
    apply: bool,
) -> None:
    vm = VersionManager()

    if not processed_path.exists():
        print(f"ERROR: processed file not found: {processed_path}", file=sys.stderr)
        sys.exit(1)

    if not raw_path.exists():
        print(f"WARNING: raw file not found: {raw_path}", file=sys.stderr)

    auto_sn = _extract_scraping_num_from_raw_path(raw_path)
    effective_sn = scraping_num if scraping_num is not None else auto_sn

    print(f"Tag:          {tag}")
    print(f"Processed:    {processed_path}")
    print(f"Raw:          {raw_path}")
    print(f"Auto scrap#:  {auto_sn}")
    print(f"Effective #:  {effective_sn}")

    import datetime as _dt
    created_at = _dt.datetime.now().isoformat()

    # Build a lightweight version entry (no cleaned/raw snapshot copies)
    version = DataVersion(
        tag=tag,
        created_at=created_at,
        raw_path=_rel(raw_path),
        cleaned_path=_rel(raw_path),  # placeholder — old data has no cleaned step
        processed_path=_rel(processed_path),
    )
    version.raw_fingerprint = vm.fingerprint_file(raw_path) if raw_path.exists() else "unknown"
    version.raw_rows = vm.count_rows(raw_path) if raw_path.exists() else None
    version.cleaned_rows = None
    version.processed_rows = vm.count_rows(processed_path)
    version.scraping_num = effective_sn

    print(f"Processed rows: {version.processed_rows}")

    if not apply:
        print("\nDry run — pass --apply to register.")
        return

    vm.register(version)
    print(f"\nRegistered version '{tag}' in manifest.")


def main() -> int:
    parser = argparse.ArgumentParser(description="Register an existing processed file as a version")
    parser.add_argument("--processed", type=Path, required=True, help="Path to processed CSV")
    parser.add_argument("--raw", type=Path, required=True, help="Path to raw CSV (for fingerprint)")
    parser.add_argument("--tag", required=True, help="Version tag (e.g. snapshot_one)")
    parser.add_argument("--scraping-num", type=int, default=None, help="Override scraping_num")
    parser.add_argument("--apply", action="store_true", help="Register in manifest")
    args = parser.parse_args()
    register(
        processed_path=args.processed,
        raw_path=args.raw,
        tag=args.tag,
        scraping_num=args.scraping_num,
        apply=args.apply,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
