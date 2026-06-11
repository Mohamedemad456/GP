#!/usr/bin/env python3
"""Check which (make, model) pairs in a raw/cleaned snapshot are missing from the lookup.

Reads a raw or cleaned CSV, applies make/model canonicalization, then compares
every unique (make, model) pair against the car_specs lookup CSV.

Any pair NOT found in the lookup is printed to stdout (grouped by make, sorted)
so it can be reviewed and added to the lookup files manually.

Also compares against the current processed_data.csv and training_data.csv to
flag pairs that are completely new vs. ones already seen in earlier rounds.

Exit codes:
  0  All (make, model) pairs are covered by the lookup
  1  Gaps found — review the printed list

Usage:
    python scripts/cleaning/check_lookup_coverage.py --input data/raw/cars_raw_v008.csv
    python scripts/cleaning/check_lookup_coverage.py --input data/cleaned/cars_cleaned_<tag>.csv
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from scripts.data.make_model_canonical import canonicalize_pair, load_rules, norm_key

LOOKUP_PATH = PROJECT_ROOT / "data" / "lookups" / "car_specs_lookup_full_cleaned.fixed.csv"
PROCESSED_PATH = PROJECT_ROOT / "data" / "processed" / "processed_data.csv"
TRAINING_PATH = PROJECT_ROOT / "data" / "processed" / "training_data.csv"


# ── Helpers ────────────────────────────────────────────────────────────────────

def _load_input(path: Path) -> pd.DataFrame:
    if not path.exists():
        print(f"ERROR: input file not found: {path}", file=sys.stderr)
        sys.exit(2)
    suffix = path.suffix.lower()
    if suffix == ".parquet":
        return pd.read_parquet(path)
    return pd.read_csv(path, low_memory=False)


def _canonicalize_df(df: pd.DataFrame) -> pd.DataFrame:
    """Ensure 'make' and 'model' columns exist and apply canonicalization."""
    if "make" not in df.columns or "model" not in df.columns:
        print("ERROR: input CSV must have 'make' and 'model' columns.", file=sys.stderr)
        print("  Hint: run data_loader.py first (it parses make/model from title).", file=sys.stderr)
        sys.exit(2)

    rules = load_rules()
    rows = df[["make", "model"]].dropna().apply(
        lambda r: canonicalize_pair(r["make"], r["model"], rules), axis=1
    )
    result = df.copy()
    result["make"] = rows.apply(lambda r: r["canonical_make"])
    result["model"] = rows.apply(lambda r: r["canonical_model"])
    return result


def _make_model_set(df: pd.DataFrame) -> set[tuple[str, str]]:
    """Return a set of normalised (make, model) tuples."""
    return {
        (norm_key(make), norm_key(model))
        for make, model in zip(df["make"].fillna(""), df["model"].fillna(""))
        if make and model
    }


def _readable_pairs(df: pd.DataFrame) -> dict[tuple[str, str], tuple[str, str]]:
    """Map normalised key → (canonical_make, canonical_model) for display."""
    out: dict[tuple[str, str], tuple[str, str]] = {}
    for make, model in zip(df["make"].fillna(""), df["model"].fillna("")):
        if make and model:
            out[(norm_key(make), norm_key(model))] = (str(make), str(model))
    return out


# ── Main ───────────────────────────────────────────────────────────────────────

def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        description="Report (make, model) pairs missing from the lookup CSV.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python scripts/cleaning/check_lookup_coverage.py "
            "--input data/raw/cars_raw_v008.csv\n"
            "  python scripts/cleaning/check_lookup_coverage.py "
            "--input data/cleaned/cars_cleaned_2026-06-03_001.csv\n"
        ),
    )
    parser.add_argument(
        "--input", "-i",
        type=Path,
        required=True,
        help="Raw or cleaned CSV (must have make + model columns)",
    )
    parser.add_argument(
        "--lookup",
        type=Path,
        default=LOOKUP_PATH,
        help=f"Lookup CSV to check against (default: {LOOKUP_PATH})",
    )
    args = parser.parse_args(argv)

    # ── Load & canonicalize input ──────────────────────────────────────────────
    print(f"\nLoading input:  {args.input}")
    df_input = _load_input(args.input)
    df_input = _canonicalize_df(df_input)
    input_pairs = _make_model_set(df_input)
    display_map = _readable_pairs(df_input)
    print(f"  {len(df_input):,} rows  |  {len(input_pairs):,} unique (make, model) pairs")

    # ── Load lookup ────────────────────────────────────────────────────────────
    if not args.lookup.exists():
        print(f"ERROR: lookup file not found: {args.lookup}", file=sys.stderr)
        sys.exit(2)
    print(f"\nLoading lookup: {args.lookup}")
    df_lookup = pd.read_csv(args.lookup, low_memory=False)
    if "make" not in df_lookup.columns or "model" not in df_lookup.columns:
        print("ERROR: lookup CSV must have 'make' and 'model' columns.", file=sys.stderr)
        sys.exit(2)
    lookup_pairs = _make_model_set(df_lookup)
    print(f"  {len(df_lookup):,} rows  |  {len(lookup_pairs):,} unique (make, model) pairs")

    # ── Load existing processed / training data (for context) ─────────────────
    existing_pairs: set[tuple[str, str]] = set()
    for ref_path in (PROCESSED_PATH, TRAINING_PATH):
        if ref_path.exists():
            try:
                df_ref = pd.read_csv(ref_path, usecols=["make", "model"], low_memory=False)
                existing_pairs |= _make_model_set(df_ref)
            except Exception:
                pass
    if existing_pairs:
        print(f"\nLoaded existing processed/training data: {len(existing_pairs):,} known pairs")

    # ── Gap analysis ───────────────────────────────────────────────────────────
    missing_from_lookup = input_pairs - lookup_pairs

    print(f"\n{'=' * 64}")
    print(f"  Coverage report: {args.input.name}")
    print(f"{'=' * 64}")
    print(f"  Input pairs       : {len(input_pairs):,}")
    print(f"  Covered by lookup : {len(input_pairs) - len(missing_from_lookup):,}")
    print(f"  Missing from lookup: {len(missing_from_lookup):,}")

    if not missing_from_lookup:
        print("\n  ✓ All (make, model) pairs are covered by the lookup.")
        print(f"{'=' * 64}\n")
        return 0

    # ── Group missing pairs by make, sorted ───────────────────────────────────
    by_make: dict[str, list[str]] = {}
    for norm_m, norm_mod in sorted(missing_from_lookup):
        canonical_make, canonical_model = display_map.get(
            (norm_m, norm_mod), (norm_m, norm_mod)
        )
        by_make.setdefault(canonical_make, []).append(canonical_model)

    print(f"\n  ✗ (make, model) pairs MISSING from lookup")
    print(f"  {'─' * 60}")
    print(f"  {'MAKE':<25}  {'MODEL'}")
    print(f"  {'─' * 60}")

    brand_new_count = 0
    for make in sorted(by_make):
        for model in sorted(by_make[make]):
            norm_key_pair = (norm_key(make), norm_key(model))
            tag = ""
            if norm_key_pair not in existing_pairs:
                tag = "  ← NEW (not in processed/training either)"
                brand_new_count += 1
            print(f"  {make:<25}  {model}{tag}")

    print(f"  {'─' * 60}")
    print(f"  Total missing from lookup : {len(missing_from_lookup)}")
    if existing_pairs:
        print(f"  Completely new pairs      : {brand_new_count}  (← mark these for lookup addition)")
    print(f"{'=' * 64}\n")

    return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
