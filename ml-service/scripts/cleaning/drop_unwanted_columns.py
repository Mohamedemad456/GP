#!/usr/bin/env python3
"""Drop unwanted columns from raw data and lookup CSV files.

Reusable cleaning stage — part of the incremental data pipeline.
Run on every new raw data snapshot to strip columns that should never
enter the training/inference pipeline.

Removes:
  - model_family        : from cars_with_make_model.csv, AI_lookup.fixed.csv,
                          car_specs_lookup_full_cleaned.fixed.csv
  - brand_market_share  : from car_specs_lookup_full_cleaned.fixed.csv

These columns are NOT used in training/inference but their presence creates
confusion and risks accidental feature leakage.

Usage:
    python drop_unwanted_columns.py              # dry-run (report only)
    python drop_unwanted_columns.py --apply      # apply changes in-place with backup
"""

from __future__ import annotations

import argparse
import datetime as dt
import os
import shutil
import sys
from pathlib import Path

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[2]

# Files and columns to drop, in order
COLUMN_DROPS: list[tuple[Path, list[str]]] = [
    (
        PROJECT_ROOT / "data" / "raw" / "cars_with_make_model.csv",
        ["model_family"],
    ),
    (
        PROJECT_ROOT / "data" / "lookups" / "AI_lookup.fixed.csv",
        ["model_family"],
    ),
    (
        PROJECT_ROOT / "data" / "lookups" / "car_specs_lookup_full_cleaned.fixed.csv",
        ["model_family", "brand_market_share"],
    ),
]

# Optional: also clean originals if they exist
OPTIONAL_DROPS: list[tuple[Path, list[str]]] = [
    (
        PROJECT_ROOT / "data" / "lookups" / "AI_lookup.csv",
        ["model_family"],
    ),
    (
        PROJECT_ROOT / "data" / "lookups" / "car_specs_lookup_full_cleaned.csv",
        ["model_family", "brand_market_share"],
    ),
]


def report_file(path: Path, cols_to_drop: list[str]) -> dict:
    if not path.exists():
        return {"file": str(path.name), "status": "not_found"}
    df = pd.read_csv(path, nrows=0)
    present = [c for c in cols_to_drop if c in df.columns]
    return {
        "file": str(path.name),
        "columns_to_drop": cols_to_drop,
        "columns_found": present,
        "columns_missing_already": [c for c in cols_to_drop if c not in present],
        "action_needed": len(present) > 0,
    }


def apply_drop(path: Path, cols_to_drop: list[str]) -> dict:
    if not path.exists():
        return {"file": str(path.name), "status": "not_found"}

    df = pd.read_csv(path)
    present = [c for c in cols_to_drop if c in df.columns]

    if not present:
        return {
            "file": str(path.name),
            "status": "skipped",
            "reason": "columns already absent",
        }

    timestamp = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup = path.with_suffix(path.suffix + f".{timestamp}.bak")
    tmp = path.with_suffix(path.suffix + ".tmp")

    shutil.copy2(path, backup)
    df.drop(columns=present, inplace=True)
    df.to_csv(tmp, index=False)
    os.replace(tmp, path)

    return {
        "file": str(path.name),
        "status": "done",
        "columns_dropped": present,
        "backup": str(backup.name),
        "rows": len(df),
        "remaining_cols": len(df.columns),
    }


def verify_file(path: Path, cols_that_should_be_absent: list[str]) -> dict:
    if not path.exists():
        return {"file": str(path.name), "status": "not_found"}
    df = pd.read_csv(path, nrows=0)
    still_present = [c for c in cols_that_should_be_absent if c in df.columns]
    return {
        "file": str(path.name),
        "status": "OK" if not still_present else "FAIL",
        "still_present": still_present,
    }


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        description="Drop model_family and brand_market_share from CSV files (Step 1.1)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python drop_unwanted_columns.py            # dry-run\n"
            "  python drop_unwanted_columns.py --apply    # apply in-place\n"
            "  python drop_unwanted_columns.py --apply --include-originals\n"
        ),
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply changes in-place with timestamped .bak backup (default: dry-run only)",
    )
    parser.add_argument(
        "--include-originals",
        action="store_true",
        help="Also clean the original (non-.fixed) lookup CSVs",
    )
    args = parser.parse_args(argv)

    targets = list(COLUMN_DROPS)
    if args.include_originals:
        targets.extend(OPTIONAL_DROPS)

    if not args.apply:
        print("=== DRY RUN — pass --apply to make changes ===\n")
        all_ok = True
        for path, cols in targets:
            r = report_file(path, cols)
            status = "needs action" if r.get("action_needed") else "already clean"
            found = r.get("columns_found", [])
            print(f"  [{status}] {r['file']}")
            if found:
                print(f"           columns to drop: {found}")
            elif r.get("status") == "not_found":
                print(f"           WARNING: file not found")
                all_ok = False
        return 0 if all_ok else 1

    print("=== APPLYING column drops ===\n")
    exit_code = 0
    for path, cols in targets:
        r = apply_drop(path, cols)
        if r["status"] == "done":
            print(f"  [done]    {r['file']}: dropped {r['columns_dropped']}, backup={r['backup']}")
        elif r["status"] == "skipped":
            print(f"  [skipped] {r['file']}: {r['reason']}")
        else:
            print(f"  [ERROR]   {r['file']}: {r['status']}", file=sys.stderr)
            exit_code = 1

    print("\n=== Verification ===\n")
    for path, cols in targets:
        r = verify_file(path, cols)
        flag = "✓" if r["status"] == "OK" else "✗"
        print(f"  [{flag}] {r['file']}: {r['status']}", end="")
        if r.get("still_present"):
            print(f" — still has: {r['still_present']}", end="")
        print()

    return exit_code


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
