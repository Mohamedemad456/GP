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
import datetime as dt
import hashlib
import json
import logging
import shutil
import sys
from pathlib import Path

import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATH = PROJECT_ROOT / "data" / "data_manifest.json"
TRAINING_ALIAS_PATH = PROJECT_ROOT / "data" / "processed" / "training_data.csv"
TRAINING_VERSIONS_DIR = PROJECT_ROOT / "data" / "processed" / "training_versions"
TRAINING_MANIFEST_PATH = PROJECT_ROOT / "data" / "training_manifest.json"
LOG_DIR = PROJECT_ROOT / "data" / "logs"
RUN_LOG_DIR = LOG_DIR / "runs"

DEDUP_KEY = ["make", "model", "year", "mileage_km", "price_egp"]


def _resolve_path(path_str: str) -> Path:
    """Resolve a manifest path (relative or absolute) to an absolute Path."""
    p = Path(path_str)
    return p if p.is_absolute() else PROJECT_ROOT / p


META_COLS = ["scraping_date", "version_tag", "scraping_num"]
RARE_THRESHOLD = 10

log = logging.getLogger("combine_versions")
_CURRENT_LOG_PATH: Path | None = None
_CURRENT_RUN_ID: str | None = None


def _setup_logging() -> None:
    """Configure console+file logging."""
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    RUN_LOG_DIR.mkdir(parents=True, exist_ok=True)
    ts = pd.Timestamp.now().strftime("%Y%m%d_%H%M%S")
    global _CURRENT_LOG_PATH, _CURRENT_RUN_ID
    _CURRENT_RUN_ID = ts
    _CURRENT_LOG_PATH = LOG_DIR / f"combine_{ts}.log"
    fh = logging.FileHandler(_CURRENT_LOG_PATH, encoding="utf-8")
    fh.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
    sh = logging.StreamHandler(sys.stdout)
    sh.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
    log.setLevel(logging.INFO)
    log.handlers = []
    log.addHandler(fh)
    log.addHandler(sh)


def _rel(path: Path) -> str:
    try:
        return str(path.relative_to(PROJECT_ROOT))
    except ValueError:
        return str(path)


def _load_json(path: Path, default: dict) -> dict:
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def _save_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    tmp.replace(path)


def _fingerprint_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65_536), b""):
            h.update(chunk)
    return f"sha256:{h.hexdigest()}"


def _next_training_tag(manifest: dict) -> str:
    versions = manifest.get("versions", {})
    base = dt.date.today().isoformat()
    seq = 1
    while f"{base}_{seq:03d}" in versions:
        seq += 1
    return f"{base}_{seq:03d}"


def _write_run_summary(summary: dict) -> Path | None:
    if _CURRENT_RUN_ID is None:
        return None
    summary_path = RUN_LOG_DIR / f"combine_{_CURRENT_RUN_ID}.json"
    _save_json(summary_path, summary)
    return summary_path


def load_manifest() -> dict:
    with MANIFEST_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def combine(*, apply: bool, exclude: set[str] | None = None, tag: str | None = None) -> dict:
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
    included_tags: list[str] = []
    for version_tag, meta in sorted(versions.items()):
        if version_tag in exclude:
            log.info("  %s: SKIPPED (excluded)", version_tag)
            continue
        proc_path = _resolve_path(meta["processed_path"])
        if not proc_path.exists():
            log.warning("Processed file missing for %s: %s", version_tag, proc_path)
            continue
        df = pd.read_csv(proc_path)
        raw_rows = len(df)
        frames.append(df)
        included_tags.append(version_tag)
        log.info("  %s: %s rows", version_tag, raw_rows)

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

    training_manifest = _load_json(
        TRAINING_MANIFEST_PATH,
        {"current_training_version": "", "versions": {}},
    )
    training_tag = tag or _next_training_tag(training_manifest)
    versioned_output = TRAINING_VERSIONS_DIR / f"training_{training_tag}.csv"

    if apply:
        TRAINING_VERSIONS_DIR.mkdir(parents=True, exist_ok=True)
        TRAINING_ALIAS_PATH.parent.mkdir(parents=True, exist_ok=True)
        if training_tag in training_manifest["versions"] or versioned_output.exists():
            log.error("Training version tag already exists: %s", training_tag)
            sys.exit(1)

        training.to_csv(versioned_output, index=False)
        shutil.copy2(versioned_output, TRAINING_ALIAS_PATH)

        training_manifest["versions"][training_tag] = {
            "tag": training_tag,
            "created_at": dt.datetime.now().isoformat(timespec="seconds"),
            "path": _rel(versioned_output),
            "rows": len(training),
            "fingerprint": _fingerprint_file(versioned_output),
            "source_processed_tags": included_tags,
            "excluded_tags": sorted(exclude),
            "pre_dedup_rows": pre_dedup,
            "post_dedup_rows": deduped,
            "duplicates_removed": removed_dup,
            "post_rare_filter_rows": len(combined),
            "rare_dropped": dropped_rare,
            "make_model_combos": surviving_combos,
        }
        training_manifest["current_training_version"] = training_tag
        _save_json(TRAINING_MANIFEST_PATH, training_manifest)

        log.info("Wrote %s rows → %s", len(training), versioned_output)
        log.info("Updated latest alias → %s", TRAINING_ALIAS_PATH)
        log.info("Updated training manifest → %s", TRAINING_MANIFEST_PATH)
    else:
        log.info("[DRY-RUN] Would write %s rows → %s", len(training), versioned_output)
        log.info("[DRY-RUN] Would update latest alias → %s", TRAINING_ALIAS_PATH)

    result = {
        "training_tag": training_tag,
        "source_processed_tags": included_tags,
        "excluded_tags": sorted(exclude),
        "pre_dedup": pre_dedup,
        "post_dedup": deduped,
        "duplicates_removed": removed_dup,
        "post_rare_filter": len(combined),
        "rare_dropped": dropped_rare,
        "make_model_combos": surviving_combos,
        "output_cols": list(training.columns),
        "versioned_output_path": str(versioned_output) if apply else None,
        "latest_alias_path": str(TRAINING_ALIAS_PATH) if apply else None,
        "training_manifest_path": str(TRAINING_MANIFEST_PATH) if apply else None,
    }

    summary = {
        "run_id": _CURRENT_RUN_ID,
        "kind": "combine_versions",
        "status": "applied" if apply else "dry_run",
        "created_at": dt.datetime.now().isoformat(timespec="seconds"),
        "log_path": str(_CURRENT_LOG_PATH) if _CURRENT_LOG_PATH else None,
        **result,
    }
    summary_path = _write_run_summary(summary)
    if summary_path is not None:
        log.info("Run summary JSON → %s", summary_path)

    return result


def main():
    parser = argparse.ArgumentParser(description="Combine processed versions into training_data.csv")
    parser.add_argument("--apply", action="store_true", help="Write training_data.csv")
    parser.add_argument(
        "--exclude",
        nargs="+",
        default=[],
        help="Version tags to skip (e.g. --exclude snapshot_one old_backup)",
    )
    parser.add_argument(
        "--tag",
        default=None,
        help="Optional explicit training version tag (default: auto YYYY-MM-DD_NNN)",
    )
    args = parser.parse_args()

    _setup_logging()
    log.info("=== Combine Versions (%s) ===", "APPLY" if args.apply else "DRY-RUN")
    stats = combine(apply=args.apply, exclude=set(args.exclude), tag=args.tag)
    log.info("Done.")


if __name__ == "__main__":
    main()
