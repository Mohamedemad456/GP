#!/usr/bin/env python3
"""
fix_lookups_make_model.py

Canonicalizes make/model strings, applies wrong-pair fixes, quarantines
flagged rows, enriches every row with a model_family column (solving the
model-hierarchy problem), and validates spec ranges/enums across lookup CSVs.

The model_family column resolves the hierarchy without destroying granularity:
  - model stays intact   →  "BMW 318i"  (used for ML pricing features)
  - model_family is added →  "3 Series"  (used for grouping, search, filtering)

Usage:
    python fix_lookups_make_model.py                   # report mode (no writes)
    python fix_lookups_make_model.py --mode report     # explicit report
    python fix_lookups_make_model.py --mode apply      # write fixed outputs
    python fix_lookups_make_model.py --apply           # shorthand apply
    python fix_lookups_make_model.py --apply --output-dir /tmp/out
"""
from __future__ import annotations

import argparse
import logging
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.make_model_canonical import canonicalize_pair, load_rules, norm_key

LOOKUP_DIR = PROJECT_ROOT / "data" / "lookups"
DEFAULT_RULES_PATH = PROJECT_ROOT / "src" / "config" / "canonical_rules.yaml"


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class SourceSpec:
    name: str
    path: Path
    fixed_filename: str
    dedupe_key_cols: tuple[str, ...]


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

def configure_logging(log_file: Path | None = None) -> logging.Logger:
    logger = logging.getLogger("fix_lookups_make_model")
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


# ---------------------------------------------------------------------------
# Key helpers
# ---------------------------------------------------------------------------

def pair_key(make: Any, model: Any) -> tuple[str, str]:
    """Normalized (make, model) tuple used for dictionary lookups only."""
    return (norm_key(str(make)), norm_key(str(model)))


# ---------------------------------------------------------------------------
# Rule builders — parse canonical_rules.yaml sections into fast lookup dicts
# ---------------------------------------------------------------------------

def build_wrong_pair_map(
    rules: dict[str, Any],
) -> dict[tuple[str, str], tuple[str, str]]:
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


def build_exception_set(rules: dict[str, Any]) -> set[tuple[str, str]]:
    out: set[tuple[str, str]] = set()
    for item in rules.get("valid_exceptions", []) or []:
        out.add(pair_key(item.get("make", ""), item.get("model", "")))
    return out


def build_family_map(rules: dict[str, Any]) -> dict[tuple[str, str], str]:
    """
    Build (norm_make, norm_model) → family_name from model_family_map in YAML.

    YAML structure expected:
        model_family_map:
          BMW:
            "318i": "3 Series"
            "320":  "3 Series"
          Mercedes:
            "GLC200": "GLC"

    If a (make, model) has no entry, resolve_model_family() falls back to
    model itself — meaning the model IS its own family.
    """
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
    """
    Return the model family name for a canonical (make, model) pair.
    Falls back to model itself when no explicit mapping exists.
    """
    return family_map.get(pair_key(make, model), model)


# ---------------------------------------------------------------------------
# Family enrichment — adds model_family column without touching model
# ---------------------------------------------------------------------------

def enrich_with_family(
    df: pd.DataFrame,
    family_map: dict[tuple[str, str], str],
    source_name: str,  # kept for future per-source logging if needed
) -> tuple[pd.DataFrame, int]:
    """
    Add or refresh the model_family column on df.

    - model column is NEVER modified (granularity is preserved for ML).
    - model_family is inserted right after model if it doesn't exist yet.
    - Rows with an explicit mapping in family_map get the family name.
    - All other rows get model_family == model (model is its own family).

    Returns (enriched_df, count_of_rows_with_explicit_family_mapping).
    """
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
        # Insert right after the model column for readability
        model_idx = df.columns.get_loc("model")
        df.insert(model_idx + 1, "model_family", families)
    else:
        df["model_family"] = families

    return df, explicit_count


# ---------------------------------------------------------------------------
# Source loading
# ---------------------------------------------------------------------------

def read_source(spec: SourceSpec) -> pd.DataFrame:
    if not spec.path.exists():
        raise FileNotFoundError(
            f"Required input not found for '{spec.name}': {spec.path}"
        )
    return pd.read_csv(spec.path)


# ---------------------------------------------------------------------------
# Core rule application
# ---------------------------------------------------------------------------

def apply_rules(
    df: pd.DataFrame,
    source_name: str,
    rules: dict[str, Any],
) -> tuple[pd.DataFrame, list[dict[str, Any]], list[dict[str, Any]], Counter[str]]:
    """
    Apply canonicalization, wrong-pair fixes, and quarantine in order:
      1. canonicalize_pair   (make_aliases + model_aliases_by_make)
      2. wrong_pair_fixes    (explicit reassignments)
      3. flag_for_deletion   (move to quarantine)

    Returns (cleaned_df, changes_log, quarantine_rows, counts).
    """
    required = {"make", "model"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"'{source_name}' is missing required columns: {sorted(missing)}")

    wrong_pair_map = build_wrong_pair_map(rules)
    deletion_map = build_deletion_map(rules)
    exceptions = build_exception_set(rules)

    rows: list[dict[str, Any]] = []
    changes: list[dict[str, Any]] = []
    quarantine: list[dict[str, Any]] = []
    counts: Counter[str] = Counter()

    for idx, row in df.iterrows():
        current = row.to_dict()
        original_make = str(current.get("make", ""))
        original_model = str(current.get("model", ""))

        # Step 1 — canonicalize make + model strings
        pair = canonicalize_pair(original_make, original_model, rules)
        current["make"] = pair["canonical_make"]
        current["model"] = pair["canonical_model"]

        if pair["make_changed"]:
            counts["makes_canonicalized"] += 1
        if pair["model_changed"]:
            counts["models_canonicalized"] += 1
        if pair["make_changed"] or pair["model_changed"]:
            changes.append({
                "source": source_name,
                "row_index": idx,
                "change_type": "canonicalize_pair",
                "before_make": original_make,
                "before_model": original_model,
                "after_make": current["make"],
                "after_model": current["model"],
            })

        # Step 2 — apply wrong-pair fixes
        wrong_fix = wrong_pair_map.get(pair_key(current["make"], current["model"]))
        if wrong_fix is not None:
            before_make, before_model = current["make"], current["model"]
            current["make"], current["model"] = wrong_fix
            counts["wrong_pair_fixes_applied"] += 1
            changes.append({
                "source": source_name,
                "row_index": idx,
                "change_type": "wrong_pair_fix",
                "before_make": before_make,
                "before_model": before_model,
                "after_make": current["make"],
                "after_model": current["model"],
            })

        # Step 3 — quarantine flagged rows
        delete_key = pair_key(current["make"], current["model"])
        deletion_reason = deletion_map.get(delete_key)
        if deletion_reason is not None and delete_key not in exceptions:
            counts["rows_quarantined"] += 1
            quarantine.append({
                "source": source_name,
                "row_index": idx,
                "reason": deletion_reason,
                **current,
            })
            continue  # do not include in clean output

        rows.append(current)

    return pd.DataFrame(rows, columns=df.columns), changes, quarantine, counts


# ---------------------------------------------------------------------------
# Duplicate detection and collapsing
# ---------------------------------------------------------------------------

def _normalized_key_series(
    df: pd.DataFrame, key_cols: tuple[str, ...]
) -> pd.DataFrame:
    out = pd.DataFrame(index=df.index)
    for col in key_cols:
        if col not in df.columns:
            raise ValueError(f"Missing key column '{col}' needed for duplicate detection")
        out[col] = df[col].apply(norm_key) if col in {"make", "model"} else df[col]
    return out


def detect_normalized_duplicates(
    df: pd.DataFrame,
    source_name: str,
    *,
    key_cols: tuple[str, ...],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """
    Find groups of rows that share the same normalized key.

    Returns:
      collapsible — groups where all non-key columns agree (safe to keep first)
      conflicts   — groups where non-key columns differ (manual resolution needed)

    model_family is excluded from conflict comparison because it is a derived
    column and will always agree after enrich_with_family runs.
    """
    if df.empty:
        return [], []

    norm_keys = _normalized_key_series(df, key_cols)
    groups: dict[tuple[Any, ...], list[int]] = defaultdict(list)
    for idx in df.index:
        groups[tuple(norm_keys.loc[idx, list(key_cols)].tolist())].append(int(idx))

    collapsible: list[dict[str, Any]] = []
    conflicts: list[dict[str, Any]] = []

    for key, indexes in groups.items():
        if len(indexes) <= 1:
            continue
        subset = df.loc[indexes]
        # Exclude key cols and derived model_family from conflict comparison
        compare_cols = [
            c for c in df.columns
            if c not in set(key_cols) and c != "model_family"
        ]
        if compare_cols:
            compare = subset[compare_cols].astype(str).fillna("")
            has_conflict = compare.drop_duplicates().shape[0] > 1
        else:
            has_conflict = False

        entry = {
            "source": source_name,
            "normalized_key": key,
            "key_cols": list(key_cols),
            "row_indexes": indexes,
            "row_count": len(indexes),
        }
        (conflicts if has_conflict else collapsible).append(entry)

    return collapsible, conflicts


def collapse_duplicates(
    df: pd.DataFrame,
    *,
    key_cols: tuple[str, ...],
) -> tuple[pd.DataFrame, list[dict[str, Any]], list[dict[str, Any]]]:
    """
    Keep first row of each collapsible group; leave conflict groups as-is.
    Returns (df_out, collapsible_groups, conflict_groups).
    """
    collapsible, conflicts = detect_normalized_duplicates(df, "", key_cols=key_cols)
    if not collapsible:
        return df, [], conflicts

    keep_indexes: set[int] = set(df.index.tolist())
    for group in collapsible:
        for idx in group["row_indexes"][1:]:
            keep_indexes.discard(idx)

    return (
        df.loc[sorted(keep_indexes)].reset_index(drop=True),
        collapsible,
        conflicts,
    )


# ---------------------------------------------------------------------------
# Spec validation
# ---------------------------------------------------------------------------

def validate_ranges(df: pd.DataFrame, source_name: str) -> list[dict[str, Any]]:
    """
    Check numeric ranges and enum column values.
    engine_cc == 0 is allowed (EVs with no combustion engine).
    All enum checks are case-insensitive.
    brand_market_share is only present in car_specs_lookup_full_cleaned.csv.
    """
    issues: list[dict[str, Any]] = []

    numeric_ranges: dict[str, tuple[float, float]] = {
        "engine_cc": (500, 8000),
        "horsepower": (40, 1000),
        "seating_capacity": (1, 9),
        "year": (1970, 2027),
        "brand_market_share": (0.0, 1.0),
    }

    for col, (low, high) in numeric_ranges.items():
        if col not in df.columns:
            continue
        values = pd.to_numeric(df[col], errors="coerce")
        # Skip engine_cc == 0 (electric vehicles)
        mask = (
            values.notna() & values.ne(0) & ~values.between(low, high)
            if col == "engine_cc"
            else values.notna() & ~values.between(low, high)
        )
        for idx in df.index[mask]:
            issues.append({
                "source": source_name,
                "row_index": idx,
                "issue_type": "range_validation",
                "column": col,
                "value": df.at[idx, col],
                "expected": f"{low}..{high}",
            })

    enum_values: dict[str, set[str]] = {
        "fuel": {"petrol", "diesel", "electric", "hybrid", "cng"},
        "transmission": {"manual", "automatic"},
        "drivetrain": {"fwd", "rwd", "awd", "4wd"},
        "body_type": {
            "sedan", "hatchback", "suv", "crossover", "coupe",
            "convertible", "wagon", "van", "pickup", "minivan", "mpv"
        },
    }

    for col, allowed in enum_values.items():
        if col not in df.columns:
            continue
        normalized = df[col].astype(str).str.strip().str.lower()
        mask = df[col].notna() & ~normalized.isin(allowed)
        for idx in df.index[mask]:
            issues.append({
                "source": source_name,
                "row_index": idx,
                "issue_type": "enum_validation",
                "column": col,
                "value": df.at[idx, col],
                "expected": sorted(allowed),
            })

    return issues


# ---------------------------------------------------------------------------
# Logging helpers
# ---------------------------------------------------------------------------

def log_section(
    logger: logging.Logger,
    title: str,
    rows: list[dict[str, Any]],
    limit: int = 80,
) -> None:
    logger.info("\n=== %s (%d) ===", title, len(rows))
    for row in rows[:limit]:
        logger.info(row)
    if len(rows) > limit:
        logger.info("  ... %d more rows (truncated)", len(rows) - limit)


# ---------------------------------------------------------------------------
# Source specs — defined once, used by both modes
# ---------------------------------------------------------------------------

def _build_sources(input_dir: Path) -> list[SourceSpec]:
    return [
        SourceSpec(
            name="car_specs_lookup_full_cleaned",
            path=input_dir / "car_specs_lookup_full_cleaned.csv",
            fixed_filename="car_specs_lookup_full_cleaned.fixed.csv",
            dedupe_key_cols=("make", "model", "year"),
        ),
        SourceSpec(
            name="AI_lookup",
            path=input_dir / "AI_lookup.csv",
            fixed_filename="AI_lookup.fixed.csv",
            dedupe_key_cols=("make", "model", "year", "fuel", "transmission"),
        ),
    ]


# ---------------------------------------------------------------------------
# Report mode
# ---------------------------------------------------------------------------

def run_report(args: argparse.Namespace) -> int:
    """
    Read-only analysis. Shows every proposed change and all issues.
    Writes nothing to disk (unless --log-file is given).
    Always exits with code 0.
    """
    logger = configure_logging(args.log_file)
    rules = load_rules(args.rules)
    family_map = build_family_map(rules)
    sources = _build_sources(args.input_dir)

    total_counts: Counter[str] = Counter()
    all_changes: list[dict[str, Any]] = []
    all_quarantine: list[dict[str, Any]] = []
    all_collapsible: list[dict[str, Any]] = []
    all_conflicts: list[dict[str, Any]] = []
    all_validation_issues: list[dict[str, Any]] = []
    rows_processed: dict[str, int] = {}
    family_assigned_count = 0

    for source in sources:
        df = read_source(source)
        rows_processed[source.name] = len(df)

        fixed, changes, quarantine, counts = apply_rules(df, source.name, rules)
        fixed, explicit_family = enrich_with_family(fixed, family_map, source.name)
        family_assigned_count += explicit_family

        collapsible, conflicts = detect_normalized_duplicates(
            fixed, source.name, key_cols=source.dedupe_key_cols
        )
        validation_issues = validate_ranges(fixed, source.name)

        all_changes.extend(changes)
        all_quarantine.extend(quarantine)
        all_collapsible.extend(collapsible)
        all_conflicts.extend(conflicts)
        all_validation_issues.extend(validation_issues)
        total_counts.update(counts)

    log_section(logger, "Proposed changes (canonicalize + wrong-pair fixes)", all_changes)
    log_section(logger, "Rows to quarantine", all_quarantine)
    log_section(logger, "Normalized duplicates (collapsible — would be collapsed on apply)", all_collapsible)
    log_section(logger, "Merge conflicts (kept as-is — manual resolution required)", all_conflicts)
    log_section(logger, "Validation issues", all_validation_issues)

    logger.info("\n=== fix_lookups_make_model run summary ===")
    logger.info("Mode: report (no files written)")
    logger.info("Files processed: %d", len(sources))
    logger.info("Rows processed: %s", rows_processed)
    logger.info("Makes canonicalized: %d", total_counts["makes_canonicalized"])
    logger.info("Models canonicalized: %d", total_counts["models_canonicalized"])
    logger.info("Wrong-pair fixes applied: %d", total_counts["wrong_pair_fixes_applied"])
    logger.info("Rows quarantined: %d", total_counts["rows_quarantined"])
    logger.info("Normalized duplicates (would collapse): %d", len(all_collapsible))
    logger.info("Merge conflicts (would keep as-is): %d", len(all_conflicts))
    logger.info("Model family mappings to assign: %d rows", family_assigned_count)
    logger.info("==========================================")
    if args.log_file:
        logger.info("Log written: %s", args.log_file)
    return 0


# ---------------------------------------------------------------------------
# Apply mode
# ---------------------------------------------------------------------------

def run_apply(args: argparse.Namespace) -> int:
    """
    Apply all fixes and write output files.

    Outputs:
      - car_specs_lookup_full_cleaned.fixed.csv
      - AI_lookup.fixed.csv
      - main_car_info_for_backend.csv  (input for BACKEND.ipynb)
      - quarantine.csv                 (excluded rows with reason)
      - fix_run.log

    Conflict groups are kept as-is in output files and logged.
    Running this script twice on the same inputs produces identical results.
    """
    log_file = args.log_file or args.output_dir / "fix_run.log"
    logger = configure_logging(log_file)
    rules = load_rules(args.rules)
    family_map = build_family_map(rules)
    sources = _build_sources(args.input_dir)

    args.output_dir.mkdir(parents=True, exist_ok=True)

    total_counts: Counter[str] = Counter()
    all_changes: list[dict[str, Any]] = []
    all_quarantine: list[dict[str, Any]] = []
    all_collapsible: list[dict[str, Any]] = []
    all_conflicts: list[dict[str, Any]] = []
    all_validation_issues: list[dict[str, Any]] = []
    rows_processed: dict[str, int] = {}
    fixed_by_source: dict[str, pd.DataFrame] = {}
    family_assigned_count = 0

    for source in sources:
        df = read_source(source)
        rows_processed[source.name] = len(df)

        # 1. Canonicalize + wrong-pair fixes + quarantine
        fixed, changes, quarantine, counts = apply_rules(df, source.name, rules)

        # 2. Enrich with model_family column (hierarchy solution)
        fixed, explicit_family = enrich_with_family(fixed, family_map, source.name)
        family_assigned_count += explicit_family

        # 3. Collapse safe duplicates; keep conflict groups as-is
        fixed, collapsible, conflicts = collapse_duplicates(
            fixed, key_cols=source.dedupe_key_cols
        )

        # 4. Validate ranges and enums
        validation_issues = validate_ranges(fixed, source.name)

        # 5. Write fixed file
        out_path = args.output_dir / source.fixed_filename
        fixed.to_csv(out_path, index=False)
        fixed_by_source[source.name] = fixed

        all_changes.extend(changes)
        all_quarantine.extend(quarantine)
        all_collapsible.extend(collapsible)
        all_conflicts.extend(conflicts)
        all_validation_issues.extend(validation_issues)
        total_counts.update(counts)
        total_counts["normalized_duplicates_collapsed"] += len(collapsible)

    # Write quarantine
    quarantine_path = args.output_dir / "quarantine.csv"
    pd.DataFrame(all_quarantine).to_csv(quarantine_path, index=False)

    # Generate main_car_info_for_backend.csv for BACKEND.ipynb
    ai = fixed_by_source.get("AI_lookup")
    if ai is None:
        raise RuntimeError("AI_lookup fixed DataFrame is missing — cannot generate backend CSV.")

    backend_cols = ["make", "model", "year", "fuel", "transmission"]
    missing_backend_cols = [c for c in backend_cols if c not in ai.columns]
    if missing_backend_cols:
        raise ValueError(
            f"AI_lookup.fixed is missing columns for backend CSV: {missing_backend_cols}"
        )

    main_info = ai[backend_cols].drop_duplicates().reset_index(drop=True)
    main_info_path = args.output_dir / "main_car_info_for_backend.csv"
    main_info.to_csv(main_info_path, index=False)

    # Conflict notice
    if all_conflicts:
        logger.info(
            "\nNOTE: %d merge conflict group(s) kept as-is in output files. "
            "These require manual spec review before backend seeding.",
            len(all_conflicts),
        )

    log_section(logger, "Applied changes (canonicalize + wrong-pair fixes)", all_changes)
    log_section(logger, "Rows quarantined", all_quarantine)
    log_section(logger, "Normalized duplicates collapsed", all_collapsible)
    log_section(logger, "Merge conflicts (kept as-is — manual resolution required)", all_conflicts)
    log_section(logger, "Validation issues", all_validation_issues)

    logger.info("\n=== fix_lookups_make_model run summary ===")
    logger.info("Mode: apply")
    logger.info("Files processed: %d", len(sources))
    logger.info("Rows processed: %s", rows_processed)
    logger.info("Makes canonicalized: %d", total_counts["makes_canonicalized"])
    logger.info("Models canonicalized: %d", total_counts["models_canonicalized"])
    logger.info("Wrong-pair fixes applied: %d", total_counts["wrong_pair_fixes_applied"])
    logger.info("Rows quarantined: %d", total_counts["rows_quarantined"])
    logger.info("Normalized duplicates collapsed: %d", total_counts["normalized_duplicates_collapsed"])
    logger.info("Merge conflicts detected: %d (kept as-is)", len(all_conflicts))
    logger.info("Model family mappings assigned: %d rows", family_assigned_count)
    logger.info("==========================================")
    logger.info("Wrote: %s", args.output_dir / "car_specs_lookup_full_cleaned.fixed.csv")
    logger.info("Wrote: %s", args.output_dir / "AI_lookup.fixed.csv")
    logger.info("Wrote: %s", main_info_path)
    logger.info("Wrote: %s", quarantine_path)
    logger.info("Log written: %s", log_file)
    return 0


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        description="Report/apply canonical make/model lookup fixes",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python fix_lookups_make_model.py                        # report (default)
  python fix_lookups_make_model.py --mode report          # explicit report
  python fix_lookups_make_model.py --mode apply           # write fixes
  python fix_lookups_make_model.py --apply                # shorthand
  python fix_lookups_make_model.py --apply --output-dir /tmp/out
        """,
    )
    parser.add_argument(
        "--mode",
        choices=["report", "apply"],
        default="report",
        help="report: read-only analysis (default). apply: write fixed output files.",
    )
    parser.add_argument("--report", action="store_true", help="Shorthand for --mode report")
    parser.add_argument("--apply", action="store_true", help="Shorthand for --mode apply")
    parser.add_argument(
        "--input-dir",
        type=Path,
        default=LOOKUP_DIR,
        help=f"Directory containing source CSVs (default: {LOOKUP_DIR})",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=LOOKUP_DIR,
        help=f"Directory to write fixed outputs (default: {LOOKUP_DIR})",
    )
    parser.add_argument(
        "--rules",
        type=Path,
        default=DEFAULT_RULES_PATH,
        help=f"Path to canonical_rules.yaml (default: {DEFAULT_RULES_PATH})",
    )
    parser.add_argument(
        "--log-file",
        type=Path,
        default=None,
        help="Optional log file path (apply mode defaults to output-dir/fix_run.log)",
    )

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