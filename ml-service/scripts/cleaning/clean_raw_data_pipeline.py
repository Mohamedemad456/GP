#!/usr/bin/env python3
"""
clean_raw_data_pipeline.py

Master pipeline to apply all cleaning operations to raw listing data.
Reusable — run on every new raw data snapshot from Supabase.

Pipeline sequence:
  1. Make/model canonicalization + wrong-pair fixes
  2. EV/hybrid fuel/transmission fixes (enforce correct fuel+transmission)
  3. Impossible model-year cleaning (min/max year + conditional drops)
  4. Deduplication (exact duplicate listings within-round)
  5. Merge validation (lookup duplicate check)

This pipeline is idempotent: running it on already-cleaned data produces
no changes (0 rows modified). Safe to re-run after adding new rules.

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

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from scripts.data.make_model_canonical import canonicalize_pair, load_rules, norm_key

RAW_DATA_DIR = PROJECT_ROOT / "data" / "raw"
DEFAULT_RULES_PATH = PROJECT_ROOT / "scripts" / "config" / "canonical_rules.yaml"


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


# ============================================================================
# Stage 2: EV / Hybrid Fuel/Transmission Fixes
# ============================================================================

PURE_EV_MODELS: set[tuple[str, str]] = {
    # Tesla
    ("Tesla", "Model Y"),
    ("Tesla", "Model 3"),
    ("Tesla", "Model S"),
    ("Tesla", "Model X"),
    ("Tesla", "Cybertruck"),
    # Volkswagen
    ("Volkswagen", "ID4"),
    ("Volkswagen", "ID6"),
    # Audi
    ("Audi", "Q4 E-Tron"),
    # BMW — electric-only models
    ("BMW", "I3"),
    ("BMW", "I4"),
    ("BMW", "I7"),
    ("BMW", "IX"),
    ("BMW", "IX1"),
    ("BMW", "IX3"),
    # Mercedes EQ series
    ("Mercedes", "EQS"),
    ("Mercedes", "EQS450"),
    ("Mercedes", "EQS580"),
    ("Mercedes", "EQE"),
    ("Mercedes", "EQE350"),
    ("Mercedes", "EQE500"),
    ("Mercedes", "EQA"),
    ("Mercedes", "EQA260"),
    ("Mercedes", "EQB"),
    ("Mercedes", "EQC"),
    # BYD pure EV models
    ("BYD", "Seal"),
    ("BYD", "Han"),
    ("BYD", "Dolphin"),
    ("BYD", "Atto 3"),
    ("BYD", "Seagull"),
    ("BYD", "Ocean"),
    # Porsche
    ("Porsche", "Taycan"),
    # GMC
    ("GMC", "Hummer EV"),
    # BAIC
    ("BAIC", "EU5 Plus"),
    # MG electric
    ("MG", "Cyberster"),
    ("MG", "4"),
    ("MG", "Marvel R"),
    # Avatr
    ("Avatr", "07"),
    ("Avatr", "11"),
    ("Avatr", "12"),
    # Hyundai / Kia electric
    ("Hyundai", "Ioniq 5"),
    ("Hyundai", "Ioniq 6"),
    ("Kia", "EV6"),
    ("Kia", "EV9"),
}

# Hybrid models: enforce hybrid fuel + Automatic (fuel != electric)
HYBRID_MODELS: set[tuple[str, str]] = {
    ("BYD", "Song Plus DM-i"),
    ("BYD", "Han DM-i"),
    ("BYD", "Tang DM-i"),
    ("BYD", "Song Pro DM-i"),
}


def apply_ev_fixes(df: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    """Fix fuel/transmission for confirmed pure EV and hybrid models."""
    if "make" not in df.columns or "model" not in df.columns:
        return df, 0

    normalized_ev = {(norm_text(m), norm_text(md)) for (m, md) in PURE_EV_MODELS}
    normalized_hybrid = {(norm_text(m), norm_text(md)) for (m, md) in HYBRID_MODELS}
    changed = 0
    df = df.copy()

    for idx, row in df.iterrows():
        make = norm_text(str(row.get("make", "")))
        model = norm_text(str(row.get("model", "")))

        if (make, model) in normalized_ev:
            needs = (
                norm_text(str(row.get("fuel", ""))) != "electric"
                or norm_text(str(row.get("transmission", ""))) != "automatic"
            )
            if needs:
                if "fuel" in df.columns:
                    df.at[idx, "fuel"] = "electric"
                if "transmission" in df.columns:
                    df.at[idx, "transmission"] = "Automatic"
                changed += 1

        elif (make, model) in normalized_hybrid:
            needs = (
                norm_text(str(row.get("fuel", ""))) != "hybrid"
                or norm_text(str(row.get("transmission", ""))) != "automatic"
            )
            if needs:
                if "fuel" in df.columns:
                    df.at[idx, "fuel"] = "hybrid"
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
    min_year: int | None = None
    max_year: int | None = None

    @property
    def key(self) -> tuple[str, str]:
        return (norm_text(self.make), norm_text(self.model))


@dataclass(frozen=True)
class ConditionalDropRule:
    """Drop a row when make/model match AND fuel or transmission matches."""
    make: str
    model: str
    fuel: str | None = None
    transmission: str | None = None

    def matches(self, make_norm: str, model_norm: str, row: Any) -> bool:
        if norm_text(self.make) != make_norm or norm_text(self.model) != model_norm:
            return False
        if self.fuel is not None:
            row_fuel = norm_text(str(row.get("fuel", "") if hasattr(row, "get") else getattr(row, "fuel", "")))
            if row_fuel != norm_text(self.fuel):
                return False
        if self.transmission is not None:
            row_trans = norm_text(str(row.get("transmission", "") if hasattr(row, "get") else getattr(row, "transmission", "")))
            if row_trans != norm_text(self.transmission):
                return False
        return True


def _is_year_invalid(year: int | None, rule: "ModelYearRule | None") -> bool:
    """Return True if year violates the rule's min/max bounds."""
    if year is None or rule is None:
        return False
    if rule.min_year is not None and year < rule.min_year:
        return True
    if rule.max_year is not None and year > rule.max_year:
        return True
    return False


MIN_MODEL_YEAR: list[ModelYearRule] = [
    # Original rules
    ModelYearRule(make="Audi", model="Q4 E-Tron", min_year=2021),
    ModelYearRule(make="Tesla", model="Model Y", min_year=2020),
    ModelYearRule(make="BMW", model="IX1", min_year=2022),
    ModelYearRule(make="BYD", model="Destroyer 05", min_year=2022),
    ModelYearRule(make="MG", model="Cyberster", min_year=2023),
    ModelYearRule(make="Chery", model="Tiggo 8 Pro Max", min_year=2024),
    ModelYearRule(make="Kia", model="Xceed", min_year=2020),

    # Priority 1 — Confirmed 100% dirty (MAPE > 50%)
    ModelYearRule(make="Chevrolet", model="Avalanche", min_year=2002, max_year=2013),
    ModelYearRule(make="Ford", model="Bronco Raptor", min_year=2021),
    ModelYearRule(make="Hyundai", model="Excel", max_year=1994),
    ModelYearRule(make="Fiat", model="127", max_year=1983),
    ModelYearRule(make="Fiat", model="128", max_year=1985),
    ModelYearRule(make="Fiat", model="131", max_year=1984),

    # Priority 3 — EV and new-generation models with confirmed min years
    ModelYearRule(make="Tesla", model="Model 3", min_year=2017),
    ModelYearRule(make="Tesla", model="Model S", min_year=2012),
    ModelYearRule(make="Tesla", model="Model X", min_year=2015),
    ModelYearRule(make="BYD", model="Seal", min_year=2022),
    ModelYearRule(make="BYD", model="Han", min_year=2020),
    ModelYearRule(make="BYD", model="Dolphin", min_year=2021),
    ModelYearRule(make="BYD", model="Atto 3", min_year=2022),
    ModelYearRule(make="BYD", model="Song Plus", min_year=2020),
    ModelYearRule(make="Hyundai", model="Ioniq 5", min_year=2021),
    ModelYearRule(make="Hyundai", model="Ioniq 6", min_year=2022),
    ModelYearRule(make="Kia", model="EV6", min_year=2021),
    ModelYearRule(make="Chery", model="Tiggo 9", min_year=2024),
    ModelYearRule(make="Chery", model="Arrizo 5 Plus", min_year=2021),
    ModelYearRule(make="MG", model="4", min_year=2022),
    ModelYearRule(make="MG", model="Marvel R", min_year=2021),
    ModelYearRule(make="Jetour", model="Dashing", min_year=2022),
    ModelYearRule(make="Jetour", model="X70 Plus", min_year=2020),
    ModelYearRule(make="Geely", model="Coolray", min_year=2019),
    ModelYearRule(make="Geely", model="Starray", min_year=2022),
    ModelYearRule(make="BAIC", model="X55", min_year=2019),
]

# Priority 2 — Conditional drops: valid years but mislabeled fuel/transmission
CONDITIONAL_DROPS: list[ConditionalDropRule] = [
    ConditionalDropRule(make="Chevrolet", model="Avalanche", fuel="diesel"),
    ConditionalDropRule(make="Chevrolet", model="Avalanche", transmission="Manual"),
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


def apply_year_cleaning(
    df: pd.DataFrame,
    action: str = "drop",
) -> tuple[pd.DataFrame, int, int]:
    """Remove or flag impossible model-year combinations and conditional drops.

    Returns (cleaned_df, year_invalid_count, conditional_drop_count).
    """
    if "make" not in df.columns or "model" not in df.columns or "year" not in df.columns:
        return df, 0, 0

    rules_map = {r.key: r for r in MIN_MODEL_YEAR}
    df = df.copy()

    drop_indices: list[Any] = []
    cond_drop_indices: list[Any] = []
    year_invalid = 0
    cond_dropped_count = 0

    for idx, row in df.iterrows():
        make = norm_text(str(row.get("make", "")))
        model = norm_text(str(row.get("model", "")))
        year = parse_year(row.get("year"))

        # Conditional drops first (fuel/transmission mislabels)
        if any(cd.matches(make, model, row) for cd in CONDITIONAL_DROPS):
            cond_drop_indices.append(idx)
            cond_dropped_count += 1
            continue

        rule = rules_map.get((make, model))
        is_invalid = _is_year_invalid(year, rule)

        if is_invalid:
            year_invalid += 1
            if action == "drop":
                drop_indices.append(idx)
            elif action == "clamp" and rule:
                clamp_to = rule.min_year if rule.min_year is not None else rule.max_year
                df.at[idx, "year"] = str(clamp_to)
            elif action == "flag":
                df.at[idx, "is_impossible_year"] = "1"
                df.at[idx, "min_valid_year"] = str(rule.min_year) if rule and rule.min_year is not None else ""
                df.at[idx, "max_valid_year"] = str(rule.max_year) if rule and rule.max_year is not None else ""

    all_drop = set(drop_indices) | set(cond_drop_indices)
    if all_drop:
        df = df.drop(list(all_drop)).reset_index(drop=True)

    if action == "flag":
        for col, default in [("is_impossible_year", "0"), ("min_valid_year", ""), ("max_valid_year", "")]:
            if col not in df.columns:
                df[col] = default

    return df, year_invalid, cond_dropped_count


# ============================================================================
# Stage 4: Deduplication
# ============================================================================

def apply_dedup(df: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    """Remove exact duplicate listings within-round.

    Groups by (make, model, year, mileage_km, price_egp) and keeps the first
    occurrence. Only removes exact copies — does NOT cross-round dedup.
    """
    key_cols = [c for c in ["make", "model", "year", "mileage_km", "price_egp"] if c in df.columns]
    if len(key_cols) < 3:
        return df, 0
    before = len(df)
    df = df.drop_duplicates(subset=key_cols, keep="first").reset_index(drop=True)
    return df, before - len(df)


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
    df_canon, canon_changes, canon_quarantine, canon_counts = apply_canonicalization(df, rules)

    logger.info("\nStage 1: Make/Model Canonicalization")
    logger.info("  Makes canonicalized: %d", canon_counts["makes_canonicalized"])
    logger.info("  Models canonicalized: %d", canon_counts["models_canonicalized"])
    logger.info("  Wrong-pair fixes: %d", canon_counts["wrong_pair_fixes_applied"])
    logger.info("  Rows quarantined: %d", canon_counts["rows_quarantined"])

    # Stage 2: EV/Hybrid Fixes
    df_ev, ev_changed = apply_ev_fixes(df_canon)
    logger.info("\nStage 2: EV/Hybrid Fuel/Transmission Fixes")
    logger.info("  Rows fixed: %d", ev_changed)

    # Stage 3: Year Cleaning + Conditional Drops
    df_yr, year_cleaned, cond_dropped = apply_year_cleaning(df_ev, action="drop")
    logger.info("\nStage 3: Impossible Model-Year Cleaning")
    logger.info("  Invalid year rows removed: %d", year_cleaned)
    logger.info("  Conditional drops (fuel/transmission): %d", cond_dropped)

    # Stage 4: Deduplication
    df_final, dedup_removed = apply_dedup(df_yr)
    logger.info("\nStage 4: Deduplication")
    logger.info("  Duplicate listings removed: %d", dedup_removed)

    final_rows = len(df_final)
    logger.info("\nSummary:")
    logger.info("  Initial rows:   %d", initial_rows)
    logger.info("  Final rows:     %d", final_rows)
    logger.info("  Total removed:  %d", initial_rows - final_rows)
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

    # Stage 1: Canonicalization (no model_family enrichment)
    rules = load_rules(args.rules)
    df_canon, canon_changes, canon_quarantine, canon_counts = apply_canonicalization(df, rules)

    logger.info("\nStage 1: Make/Model Canonicalization")
    logger.info("  Makes canonicalized: %d", canon_counts["makes_canonicalized"])
    logger.info("  Models canonicalized: %d", canon_counts["models_canonicalized"])
    logger.info("  Wrong-pair fixes: %d", canon_counts["wrong_pair_fixes_applied"])
    logger.info("  Rows quarantined: %d", canon_counts["rows_quarantined"])

    # Stage 2: EV/Hybrid Fixes
    df_ev, ev_changed = apply_ev_fixes(df_canon)
    logger.info("\nStage 2: EV/Hybrid Fuel/Transmission Fixes")
    logger.info("  Rows fixed: %d", ev_changed)

    # Stage 3: Year Cleaning + Conditional Drops
    df_yr, year_cleaned, cond_dropped = apply_year_cleaning(df_ev, action="drop")
    logger.info("\nStage 3: Impossible Model-Year Cleaning")
    logger.info("  Invalid year rows removed: %d", year_cleaned)
    logger.info("  Conditional drops (fuel/transmission): %d", cond_dropped)

    # Stage 4: Deduplication
    df_dedup, dedup_removed = apply_dedup(df_yr)
    logger.info("\nStage 4: Deduplication")
    logger.info("  Duplicate listings removed: %d", dedup_removed)

    df_final = df_dedup

    # Stage 5: Merge validation — detect row-count inflation risk
    lookup_path = PROJECT_ROOT / "data" / "lookups" / "car_specs_lookup_full_cleaned.fixed.csv"
    if lookup_path.exists():
        lookup_df = pd.read_csv(lookup_path)
        merge_keys = ["make", "model", "year"]
        if all(k in lookup_df.columns for k in merge_keys):
            dup_groups = lookup_df.groupby(merge_keys).size()
            ambiguous = dup_groups[dup_groups > 1]
            n_ambiguous = len(ambiguous)
            total_affected = int(ambiguous.sum())
            logger.info("\nStage 5: Merge Validation (lookup duplicate check)")
            logger.info("  Ambiguous (make,model,year) groups: %d", n_ambiguous)
            logger.info("  Total lookup rows in ambiguous groups: %d", total_affected)
            if n_ambiguous > 0:
                logger.warning(
                    "  WARNING: %d ambiguous lookup groups may cause row inflation "
                    "when raw data is merged with specs. Run fix_car_specs_lookup_full.py "
                    "--in-place to resolve.", n_ambiguous,
                )
        else:
            logger.info("\nStage 5: Skipped (lookup missing required columns)")
    else:
        logger.info("\nStage 5: Skipped (lookup file not found)")
    
    final_rows = len(df_final)
    
    # Write output
    df_final.to_csv(tmp_path, index=False)
    os.replace(tmp_path, args.input)
    
    logger.info("\nSummary:")
    logger.info("  Initial rows:   %d", initial_rows)
    logger.info("  Final rows:     %d", final_rows)
    logger.info("  Total removed:  %d", initial_rows - final_rows)
    logger.info("  EV/hybrid fixes: %d", ev_changed)
    logger.info("  Year violations: %d", year_cleaned)
    logger.info("  Cond. drops:    %d", cond_dropped)
    logger.info("  Dedup removed:  %d", dedup_removed)
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
