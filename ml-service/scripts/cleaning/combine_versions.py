#!/usr/bin/env python3
"""Combine all processed versions → deduped training_data.csv.

Reads the data manifest, loads every processed version, deduplicates across
rounds, applies a post-combine rare make+model filter, drops metadata columns,
and writes a single training_data.csv for model notebooks.

Deduplication key: (make, model, year, mileage_km, price_egp)
Rare filter threshold: 10 rows per (make, model) group.

Usage:
    python scripts/cleaning/combine_versions.py                # dry-run (show plan)
    python scripts/cleaning/combine_versions.py --apply          # write training_data.csv
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATH = PROJECT_ROOT / "data" / "data_manifest.json"
TRAINING_PATH = PROJECT_ROOT / "data" / "processed" / "training_data.csv"
LOG_DIR = PROJECT_ROOT / "data" / "logs"

DEDUP_KEY = ["make", "model", "year", "mileage_km", "price_egp"]


def _resolve_path(path_str: str) -> Path:
    """Resolve a manifest path (relative or absolute) to an absolute Path."""
    p = Path(path_str)
    return p if p.is_absolute() else PROJECT_ROOT / p


META_COLS = ["scraping_date", "version_tag", "scraping_num"]
RARE_THRESHOLD = 10

log = logging.getLogger("combine_versions")


def _setup_logging() -> None:
    """Configure console+file logging."""
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    ts = pd.Timestamp.now().strftime("%Y%m%d_%H%M%S")
    fh = logging.FileHandler(LOG_DIR / f"combine_{ts}.log", encoding="utf-8")
    fh.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
    sh = logging.StreamHandler(sys.stdout)
    sh.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
    log.setLevel(logging.INFO)
    log.handlers = []
    log.addHandler(fh)
    log.addHandler(sh)


def load_manifest() -> dict:
    with MANIFEST_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def combine(*, apply: bool, exclude: set[str] | None = None) -> dict:
    manifest = load_manifest()
    versions = manifest.get("versions", {})
    if not versions:
        log.error("Manifest has no versions. Run pipeline first.")
        sys.exit(1)

    exclude = exclude or set()
    log.info("Found %d version(s) in manifest.", len(versions))
    if exclude:
        log.info("Excluding tags: %s", sorted(exclude))

    frames = []
    for tag, meta in sorted(versions.items()):
        if tag in exclude:
            log.info("  %s: SKIPPED (excluded)", tag)
            continue
        proc_path = _resolve_path(meta["processed_path"])
        if not proc_path.exists():
            log.warning("Processed file missing for %s: %s", tag, proc_path)
            continue
        df = pd.read_csv(proc_path)
        raw_rows = len(df)
        frames.append(df)
        log.info("  %s: %s rows", tag, raw_rows)

    if not frames:
        log.error("No processable versions found.")
        sys.exit(1)

    # Concatenate all versions
    combined = pd.concat(frames, ignore_index=True)
    pre_dedup = len(combined)
    log.info("Pre-dedup combined rows: %s", pre_dedup)

    # Deduplicate: same listing scraped in multiple rounds
    # Keep the first occurrence (earlier scraping round)
    combined = combined.drop_duplicates(subset=DEDUP_KEY).reset_index(drop=True)
    deduped = len(combined)
    removed_dup = pre_dedup - deduped
    log.info("Post-dedup rows: %s (dropped %s duplicates = %.1f%%)", deduped, removed_dup, removed_dup / pre_dedup * 100 if pre_dedup else 0)

    # Rare make+model filter (post-combine threshold=10)
    before_rare = len(combined)
    mm_counts = combined.groupby(["make", "model"])["make"].transform("count")
    combined = combined[mm_counts >= RARE_THRESHOLD].reset_index(drop=True)
    dropped_rare = before_rare - len(combined)
    surviving_combos = combined.groupby(["make", "model"]).ngroups
    log.info(
        "Post-rare-filter (threshold=%d): %s rows, dropped %s (%.1f%%), %d make+model combos",
        RARE_THRESHOLD, len(combined), dropped_rare,
        dropped_rare / before_rare * 100 if before_rare else 0,
        surviving_combos,
    )

    # Drop metadata columns before training
    cols_to_drop = [c for c in META_COLS if c in combined.columns]
    training = combined.drop(columns=cols_to_drop)
    log.info("Dropped metadata columns: %s", cols_to_drop)

    # Ensure float dtypes match (avoid int for price columns where None→NaN)
    for col in ["price_egp", "price_egp_log"]:
        if col in training.columns:
            training[col] = training[col].astype(float)

    # Final verification
    for col in DEDUP_KEY:
        assert col in training.columns, f"Missing dedup key column: {col}"
    assert "price_egp_log" in training.columns, "price_egp_log missing"
    assert not training["price_egp_log"].isna().any(), "price_egp_log has NaNs"

    if apply:
        TRAINING_PATH.parent.mkdir(parents=True, exist_ok=True)
        training.to_csv(TRAINING_PATH, index=False)
        log.info("Wrote %s rows → %s", len(training), TRAINING_PATH)
    else:
        log.info("[DRY-RUN] Would write %s rows → %s", len(training), TRAINING_PATH)

    return {
        "pre_dedup": pre_dedup,
        "post_dedup": deduped,
        "duplicates_removed": removed_dup,
        "post_rare_filter": len(combined),
        "rare_dropped": dropped_rare,
        "make_model_combos": surviving_combos,
        "output_cols": list(training.columns),
        "output_path": str(TRAINING_PATH) if apply else None,
    }


def main():
    parser = argparse.ArgumentParser(description="Combine processed versions into training_data.csv")
    parser.add_argument("--apply", action="store_true", help="Write training_data.csv")
    parser.add_argument(
        "--exclude",
        nargs="+",
        default=[],
        help="Version tags to skip (e.g. --exclude snapshot_one old_backup)",
    )
    args = parser.parse_args()

    _setup_logging()
    log.info("=== Combine Versions (%s) ===", "APPLY" if args.apply else "DRY-RUN")
    stats = combine(apply=args.apply, exclude=set(args.exclude))
    log.info("Done.")


if __name__ == "__main__":
    main()
