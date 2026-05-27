#!/usr/bin/env python3
"""
clean_raw_data_pipeline.py

Master pipeline to apply all cleaning operations to raw listing data.

Pipeline sequence:
  1. Make/model canonicalization + wrong-pair fixes + model_family enrichment
  2. EV fuel/transmission fixes (enforce electric + automatic for pure EV models)
  3. Impossible model-year cleaning (remove data ghosts)

Usage:
    python clean_raw_data_pipeline.py --mode report         # read-only analysis
    python clean_raw_data_pipeline.py --mode apply          # apply all fixes
    python clean_raw_data_pipeline.py --apply               # shorthand for apply mode
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import logging
import os
import shutil
import sys
import unicodedata
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.make_model_canonical import canonicalize_pair, load_rules, norm_key

RAW_DATA_DIR = PROJECT_ROOT / "data" / "raw"
DEFAULT_RULES_PATH = PROJECT_ROOT / "src" / "config" / "canonical_rules.yaml"


def _strip_diacritics(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def norm_text(text: Any) -> str:
    text = _strip_diacritics(str(text))
    return " ".join(text.strip().lower().split())


def configure_logging(log_file: Path | None = None) -> logging.Logger:
    logger = logging.getLogger("clean_raw_data_pipeline")
    logger.setLevel(logging.INFO)
    logger.handlers.clear()
    formatter = logging.Formatter("%(message)s")

    stream = logging.StreamHandler(sys.stdout)
    stream.setFormatter(formatter)
    logger.addHandler(stream)

    if log_file is not None:
        log_file.parent.mkdir(parents=True, exist_ok=True)
        fh = logging.FileHandler(log_file, mode="w", encoding="utf-8")
        fh.setFormatter(formatter)
        logger.addHandler(fh)

    return logger


# ============================================================================
# Stage 1: Make/Model Canonicalization
# ============================================================================

def pair_key(make: Any, model: Any) -> tuple[str, str]:
    """Normalized (make, model) tuple for lookups."""
    return (norm_key(str(make)), norm_key(str(model)))


def build_family_map(rules: dict[str, Any]) -> dict[tuple[str, str], str]:
    """Build (norm_make, norm_model) → family_name mapping."""
    out: dict[tuple[str, str], str] = {}
    for make, model_map in (rules.get("model_family_map") or {}).items():
        if not isinstance(model_map, dict):
            continue
        for model, family in model_map.items():
            out[pair_key(make, model)] = str(family)
    return out


def resolve_model_family(
    make: str,
    model: str,
    family_map: dict[tuple[str, str], str],
) -> str:
    """Return model family name, or model itself if no mapping."""
    return family_map.get(pair_key(make, model), model)


def build_wrong_pair_map(rules: dict[str, Any]) -> dict[tuple[str, str], tuple[str, str]]:
    out: dict[tuple[str, str], tuple[str, str]] = {}
    for item in rules.get("wrong_pair_fixes", []) or []:
        key = pair_key(item["wrong_make"], item["wrong_model"])
        out[key] = (str(item["correct_make"]), str(item["correct_model"]))
    return out


def build_deletion_map(rules: dict[str, Any]) -> dict[tuple[str, str], str]:
    out: dict[tuple[str, str], str] = {}
    for item in rules.get("flag_for_deletion", []) or []:
        out[pair_key(item["make"], item["model"])] = str(
            item.get("reason", "flagged_for_deletion")
        )
    return out


def apply_canonicalization(
    df: pd.DataFrame,
    rules: dict[str, Any],
) -> tuple[pd.DataFrame, list[dict[str, Any]], list[dict[str, Any]], Counter[str]]:
    """
    Apply canonicalization, wrong-pair fixes, and quarantine.
    Returns (cleaned_df, changes_log, quarantine_rows, counts).
    """
    required = {"make", "model"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Raw data is missing required columns: {sorted(missing)}")

    wrong_pair_map = build_wrong_pair_map(rules)
    deletion_map = build_deletion_map(rules)

    rows: list[dict[str, Any]] = []
    changes: list[dict[str, Any]] = []
    quarantine: list[dict[str, Any]] = []
    counts: Counter[str] = Counter()

    for idx, row in df.iterrows():
        current = row.to_dict()
        original_make = str(current.get("make", ""))
        original_model = str(current.get("model", ""))

        # Step 1 — canonicalize
        pair = canonicalize_pair(original_make, original_model, rules)
        current["make"] = pair["canonical_make"]
        current["model"] = pair["canonical_model"]

        if pair["make_changed"]:
            counts["makes_canonicalized"] += 1
        if pair["model_changed"]:
            counts["models_canonicalized"] += 1
        if pair["make_changed"] or pair["model_changed"]:
            changes.append({
                "row_index": idx,
                "change_type": "canonicalize_pair",
                "before_make": original_make,
                "before_model": original_model,
                "after_make": current["make"],
                "after_model": current["model"],
            })

        # Step 2 — wrong-pair fixes
        wrong_fix = wrong_pair_map.get(pair_key(current["make"], current["model"]))
        if wrong_fix is not None:
            before_make, before_model = current["make"], current["model"]
            current["make"], current["model"] = wrong_fix
            counts["wrong_pair_fixes_applied"] += 1
            changes.append({
                "row_index": idx,
                "change_type": "wrong_pair_fix",
                "before_make": before_make,
                "before_model": before_model,
                "after_make": current["make"],
                "after_model": current["model"],
            })

        # Step 3 — quarantine
        delete_key = pair_key(current["make"], current["model"])
        deletion_reason = deletion_map.get(delete_key)
        if deletion_reason is not None:
            counts["rows_quarantined"] += 1
            quarantine.append({
                "row_index": idx,
                "reason": deletion_reason,
                **current,
            })
            continue

        rows.append(current)

    return pd.DataFrame(rows, columns=df.columns), changes, quarantine, counts


def enrich_with_family(
    df: pd.DataFrame,
    family_map: dict[tuple[str, str], str],
) -> tuple[pd.DataFrame, int]:
    """Add model_family column."""
    if "make" not in df.columns or "model" not in df.columns:
        return df, 0

    families: list[str] = []
    explicit_count = 0

    for _, row in df.iterrows():
        key = pair_key(row["make"], row["model"])
        if key in family_map:
            families.append(family_map[key])
            explicit_count += 1
        else:
            families.append(str(row["model"]))

    df = df.copy()
    if "model_family" not in df.columns:
        model_idx = df.columns.get_loc("model")
        df.insert(model_idx + 1, "model_family", families)
    else:
        df["model_family"] = families

    return df, explicit_count


# ============================================================================
# Stage 2: EV Fuel/Transmission Fixes
# ============================================================================

PURE_EV_MODELS: set[tuple[str, str]] = {
    ("Tesla", "Model Y"),
    ("Tesla", "Model 3"),
    ("Tesla", "Cybertruck"),
    ("Volkswagen", "ID4"),
    ("Volkswagen", "ID6"),
    ("Audi", "Q4 E-Tron"),
    ("BMW", "I3"),
    ("BMW", "I7"),
    ("BMW", "IX1"),
    ("BMW", "IX3"),
    ("Mercedes", "EQS450"),
    ("Mercedes", "EQS580"),
    ("Mercedes", "EQE350"),
    ("Mercedes", "EQE500"),
    ("Mercedes", "EQA260"),
    ("GMC", "Hummer EV"),
    ("BAIC", "EU5 Plus"),
    ("MG", "Cyberster"),
    ("MG", "4"),
    ("Avatr", "07"),
    ("Avatr", "11"),
    ("Avatr", "12"),
}


def apply_ev_fixes(df: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    """Fix EV fuel/transmission for confirmed pure EV models."""
    if "make" not in df.columns or "model" not in df.columns:
        return df, 0

    normalized_ev = {(norm_text(m), norm_text(md)) for (m, md) in PURE_EV_MODELS}
    changed = 0
    df = df.copy()

    for idx, row in df.iterrows():
        make = norm_text(row.get("make", ""))
        model = norm_text(row.get("model", ""))
        
        if (make, model) in normalized_ev:
            before_fuel = row.get("fuel", "")
            before_trans = row.get("transmission", "")
            needs = norm_text(before_fuel) != "electric" or norm_text(before_trans) != "automatic"
            
            if needs:
                if "fuel" in df.columns:
                    df.at[idx, "fuel"] = "electric"
                if "transmission" in df.columns:
                    df.at[idx, "transmission"] = "Automatic"
                changed += 1

    return df, changed


# ============================================================================
# Stage 3: Impossible Model-Year Cleaning
# ============================================================================

@dataclass(frozen=True)
class ModelYearRule:
    make: str
    model: str
    min_year: int

    @property
    def key(self) -> tuple[str, str]:
        return (norm_text(self.make), norm_text(self.model))


MIN_MODEL_YEAR: list[ModelYearRule] = [
    ModelYearRule(make="Audi", model="Q4 E-Tron", min_year=2021),
    ModelYearRule(make="Tesla", model="Model Y", min_year=2020),
    ModelYearRule(make="BMW", model="IX1", min_year=2022),
    ModelYearRule(make="BYD", model="Destroyer 05", min_year=2022),
    ModelYearRule(make="MG", model="Cyberster", min_year=2023),
    ModelYearRule(make="Chery", model="Tiggo 8 Pro Max", min_year=2024),
    ModelYearRule(make="Kia", model="Xceed", min_year=2020),
]


def parse_year(value: Any) -> int | None:
    if value is None:
        return None
    s = str(value).strip()
    if s == "":
        return None
    try:
        return int(float(s))
    except ValueError:
        return None


def apply_year_cleaning(df: pd.DataFrame, action: str = "drop") -> tuple[pd.DataFrame, int]:
    """Remove or flag impossible model-year combinations."""
    if "make" not in df.columns or "model" not in df.columns or "year" not in df.columns:
        return df, 0

    rules_map = {r.key: r.min_year for r in MIN_MODEL_YEAR}
    changed = 0
    df = df.copy()
    
    # Track indices to drop
    drop_indices = []

    for idx, row in df.iterrows():
        make = norm_text(row.get("make", ""))
        model = norm_text(row.get("model", ""))
        year = parse_year(row.get("year"))

        min_year = rules_map.get((make, model))
        is_invalid = year is not None and min_year is not None and year < min_year

        if is_invalid:
            changed += 1
            if action == "drop":
                drop_indices.append(idx)
            elif action == "clamp":
                df.at[idx, "year"] = str(min_year)
            elif action == "flag":
                df.at[idx, "is_impossible_year"] = "1"
                df.at[idx, "min_valid_year"] = str(min_year)

    # Drop rows if action is "drop"
    if action == "drop" and drop_indices:
        df = df.drop(drop_indices).reset_index(drop=True)
    elif action == "flag":
        # Add flag columns if they don't exist
        if "is_impossible_year" not in df.columns:
            df["is_impossible_year"] = "0"
        if "min_valid_year" not in df.columns:
            df["min_valid_year"] = ""

    return df, changed


# ============================================================================
# Report Mode
# ============================================================================

def run_report(args: argparse.Namespace) -> int:
    """Read-only analysis."""
    logger = configure_logging(args.log_file)
    
    if not args.input.exists():
        logger.error("Input file not found: %s", args.input)
        return 2

    df = pd.read_csv(args.input)
    initial_rows = len(df)
    
    logger.info("=== Raw Data Pipeline Report ===")
    logger.info("Input: %s", args.input)
    logger.info("Initial rows: %d", initial_rows)
    
    # Stage 1: Canonicalization
    rules = load_rules(args.rules)
    family_map = build_family_map(rules)
    df_canon, canon_changes, canon_quarantine, canon_counts = apply_canonicalization(df, rules)
    df_canon, family_count = enrich_with_family(df_canon, family_map)
    
    logger.info("\nStage 1: Make/Model Canonicalization")
    logger.info("  Makes canonicalized: %d", canon_counts["makes_canonicalized"])
    logger.info("  Models canonicalized: %d", canon_counts["models_canonicalized"])
    logger.info("  Wrong-pair fixes: %d", canon_counts["wrong_pair_fixes_applied"])
    logger.info("  Rows quarantined: %d", canon_counts["rows_quarantined"])
    logger.info("  Model family mappings: %d", family_count)
    
    # Stage 2: EV Fixes
    df_ev, ev_changed = apply_ev_fixes(df_canon)
    logger.info("\nStage 2: EV Fuel/Transmission Fixes")
    logger.info("  Rows fixed: %d", ev_changed)
    
    # Stage 3: Year Cleaning
    df_final, year_cleaned = apply_year_cleaning(df_ev, action="drop")
    logger.info("\nStage 3: Impossible Model-Year Cleaning")
    logger.info("  Rows removed: %d", year_cleaned)
    
    final_rows = len(df_final)
    logger.info("\nSummary:")
    logger.info("  Initial rows: %d", initial_rows)
    logger.info("  Final rows: %d", final_rows)
    logger.info("  Total removed: %d", initial_rows - final_rows)
    logger.info("================================")
    
    return 0


# ============================================================================
# Apply Mode
# ============================================================================

def run_apply(args: argparse.Namespace) -> int:
    """Apply all fixes and write output."""
    timestamp = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = args.input.with_suffix(args.input.suffix + f".{timestamp}.bak")
    tmp_path = args.input.with_suffix(args.input.suffix + ".tmp")
    
    log_file = args.log_file or args.input.parent / f"clean_raw_data_{timestamp}.log"
    logger = configure_logging(log_file)
    
    if not args.input.exists():
        logger.error("Input file not found: %s", args.input)
        return 2

    logger.info("=== Raw Data Pipeline Apply ===")
    logger.info("Input: %s", args.input)
    
    # Backup original
    shutil.copy2(args.input, backup_path)
    logger.info("Backup created: %s", backup_path)
    
    # Read and process
    df = pd.read_csv(args.input)
    initial_rows = len(df)
    logger.info("Initial rows: %d", initial_rows)
    
    # Stage 1: Canonicalization
    rules = load_rules(args.rules)
    family_map = build_family_map(rules)
    df_canon, canon_changes, canon_quarantine, canon_counts = apply_canonicalization(df, rules)
    df_canon, family_count = enrich_with_family(df_canon, family_map)
    
    logger.info("\nStage 1: Make/Model Canonicalization")
    logger.info("  Makes canonicalized: %d", canon_counts["makes_canonicalized"])
    logger.info("  Models canonicalized: %d", canon_counts["models_canonicalized"])
    logger.info("  Wrong-pair fixes: %d", canon_counts["wrong_pair_fixes_applied"])
    logger.info("  Rows quarantined: %d", canon_counts["rows_quarantined"])
    logger.info("  Model family mappings: %d", family_count)
    
    # Stage 2: EV Fixes
    df_ev, ev_changed = apply_ev_fixes(df_canon)
    logger.info("\nStage 2: EV Fuel/Transmission Fixes")
    logger.info("  Rows fixed: %d", ev_changed)
    
    # Stage 3: Year Cleaning
    df_final, year_cleaned = apply_year_cleaning(df_ev, action="drop")
    logger.info("\nStage 3: Impossible Model-Year Cleaning")
    logger.info("  Rows removed: %d", year_cleaned)
    
    # Stage 4: Merge validation — detect row-count inflation risk
    lookup_path = PROJECT_ROOT / "data" / "lookups" / "car_specs_lookup_full_cleaned.fixed.csv"
    if lookup_path.exists():
        lookup_df = pd.read_csv(lookup_path)
        merge_keys = ["make", "model", "year"]
        if all(k in lookup_df.columns for k in merge_keys):
            dup_groups = lookup_df.groupby(merge_keys).size()
            ambiguous = dup_groups[dup_groups > 1]
            n_ambiguous = len(ambiguous)
            total_affected = int(ambiguous.sum())
            logger.info("\nStage 4: Merge Validation (lookup duplicate check)")
            logger.info("  Ambiguous (make,model,year) groups: %d", n_ambiguous)
            logger.info("  Total lookup rows in ambiguous groups: %d", total_affected)
            if n_ambiguous > 0:
                logger.warning(
                    "  WARNING: %d ambiguous lookup groups may cause row inflation "
                    "when raw data is merged with specs. Run fix_car_specs_lookup_full.py "
                    "--in-place to resolve.", n_ambiguous,
                )
        else:
            logger.info("\nStage 4: Skipped (lookup missing required columns)")
    else:
        logger.info("\nStage 4: Skipped (lookup file not found)")
    
    final_rows = len(df_final)
    
    # Write output
    df_final.to_csv(tmp_path, index=False)
    os.replace(tmp_path, args.input)
    
    logger.info("\nSummary:")
    logger.info("  Initial rows: %d", initial_rows)
    logger.info("  Final rows: %d", final_rows)
    logger.info("  Total removed: %d", initial_rows - final_rows)
    logger.info("  Output: %s (replaced in-place)", args.input)
    logger.info("  Backup: %s", backup_path)
    logger.info("  Log: %s", log_file)
    logger.info("===============================")
    
    return 0


# ============================================================================
# CLI
# ============================================================================

def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        description="Clean raw car listing data with canonicalization, EV fixes, and year validation"
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=RAW_DATA_DIR / "cars_with_make_model.csv",
        help="Input CSV (default: data/raw/cars_with_make_model.csv)",
    )
    parser.add_argument(
        "--mode",
        choices=["report", "apply"],
        default="report",
        help="Mode: report (read-only) or apply (write fixes)",
    )
    parser.add_argument("--report", action="store_true", help="Shorthand for --mode report")
    parser.add_argument("--apply", action="store_true", help="Shorthand for --mode apply")
    parser.add_argument(
        "--rules",
        type=Path,
        default=DEFAULT_RULES_PATH,
        help="Path to canonical_rules.yaml",
    )
    parser.add_argument("--log-file", type=Path, help="Log file path")

    args = parser.parse_args(argv)

    # Shorthand flags override --mode
    mode = args.mode
    if args.apply:
        mode = "apply"
    if args.report:
        mode = "report"

    return run_apply(args) if mode == "apply" else run_report(args)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
