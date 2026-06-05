#!/usr/bin/env python3
"""Build processed_data.csv from cleaned raw data and lookup files.

Reusable pipeline stage — run on every new raw data snapshot after the
cleaning pipeline has been applied. Produces the versioned processed data
that feeds model training and inference.

Pipeline:
  1. Read cleaned cars_with_make_model.csv
  2. Drop any residual model_family / brand_market_share columns
  3. Drop rows missing price_egp or year
  4. Hard bounds: year 1975–CURRENT_YEAR, price 20K–20M EGP
  5. Mileage filters: drop null / >500K / old-car low-mileage / new-car high-mileage
  6. Fuel + transmission imputation (mode hierarchy: mmy+cat → make+model → drop)
  7. Normalize location into 17 standard Egyptian categories
  8. Merge with car_specs_lookup_full_cleaned.fixed.csv on (make, model, year)
     - Exact match first; nearest-year fallback for unmatched rows
  9. Drop rows missing critical spec columns after merge
  10. Derive features: car_age, mileage_per_year, price_egp_log
  11. Drop rare make+model groups (< 5 rows)
  12. Select output columns (NO model_family, NO brand_market_share)
  13. Save to data/processed/processed_data.csv

Usage:
    python generate_processed_data.py              # dry-run (shows counts only)
    python generate_processed_data.py --apply      # write processed_data.csv
"""

from __future__ import annotations

import argparse
import datetime as dt
import logging
import math
import sys
from pathlib import Path

import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[2]
LOG_DIR = PROJECT_ROOT / "data" / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
RAW_DATA_PATH = PROJECT_ROOT / "data" / "raw" / "cars_with_make_model.csv"
LOOKUP_PATH = PROJECT_ROOT / "data" / "lookups" / "car_specs_lookup_full_cleaned.fixed.csv"
OUTPUT_PATH = PROJECT_ROOT / "data" / "processed" / "processed_data.csv"

CURRENT_YEAR = dt.datetime.now().year

# Final column order for processed_data.csv — must match training notebook exactly
OUTPUT_COLS = [
    "make", "model", "year", "car_age",
    "transmission", "fuel",
    "mileage_km", "mileage_per_year",
    "location",
    "engine_cc", "horsepower", "body_type", "drivetrain",
    "seating_capacity", "brand_origin", "car_segment",
    "price_egp", "price_egp_log",
]

# Spec columns sourced from the lookup
SPEC_COLS = [
    "engine_cc", "horsepower", "body_type", "drivetrain",
    "seating_capacity", "brand_origin", "car_segment",
]


# ── Location normalisation ────────────────────────────────────────────────────

def normalize_locations(series: pd.Series) -> pd.Series:
    """Map raw Egyptian marketplace location strings to 17 standard categories.

    Mirrors the logic from notebooks/02_data_cleansing.ipynb exactly so that
    the processed file produced here matches training-time expectations.
    """
    clean_s = (
        series.astype(str)
        .str.replace("•", "", regex=False)
        .str.replace(r"\+.*", "", regex=True)
        .str.lower()
        .str.strip()
    )

    conditions = [
        # Tier 1: New Cairo cluster
        clean_s.str.contains(
            r"new cairo|fifth settlement|5th settlement|tagamo3|tagamoa|tagamo|rehab|el rehab|"
            r"madinaty|mostakbal|shorouk|el shorouk|katameya|badr city is excluded",
            na=False,
        ),
        # Tier 2: Giza (before October/Zayed to catch hadayek october)
        clean_s.str.contains(
            r"giza|haram|faisal|dokki|imbaba|mohandessin|pyramids"
            r"|mariotaya|maryotaya|marioteya|mariotya|hadayek (?:al|el) ahram|hadayek october"
            r"|boulaq dakrour|motamidia|warraq|ramses",
            na=False,
        ),
        # Tier 3: October & Zayed cluster
        clean_s.str.contains(
            r"october|6th of october|6th october|6 october|october city|"
            r"sheikh zayed|shiekh zayed|shaikh zayed|zayed",
            na=False,
        ),
        # Tier 4: Nasr City
        clean_s.str.contains(
            r"nasr city|nasr|10th district|al sefarat|el nozha|ain shams|"
            r"el marg|obour|salam city|helmeya|zeitoun|matareya",
            na=False,
        ),
        # Tier 5: Heliopolis
        clean_s.str.contains(
            r"heliopolis|masr el gedida|masr el-gedida|sheraton|el korba|korba|"
            r"el nouzha(?! airport)|roxy|merghany|cleopatra|orouba",
            na=False,
        ),
        # Tier 6: Maadi
        clean_s.str.contains(
            r"maadi|basatin|tora|tura|el basatin",
            na=False,
        ),
        # Tier 7: Alexandria
        clean_s.str.contains(
            r"alexandria|alex|smoha|smouha|sidi gaber|sidi bishr|stanley|loran|gleem|"
            r"agamy|el agamy|amreya|borg el arab|montazah|mansheya|anfushi|"
            r"sidi beshr|asafra|miami|borg al arab",
            na=False,
        ),
        # Tier 8: Cairo (broad — after all districts)
        clean_s.str.contains(
            r"\bcairo\b|mokattam|helwan|shubra\b|abdeen|gesr el suez|rod el farag|"
            r"hadayek el kobba|el matareya(?! comes up)|bab el louq|downtown cairo|zamalek|"
            r"garden city|sayeda|bulaq|el sharabia",
            na=False,
        ),
        # Tier 9: Qalyubia
        clean_s.str.contains(
            r"qalyubia|banha|el khanka|el qanater|shubra el kheima|obour city",
            na=False,
        ),
        # Tier 10: Sharqia
        clean_s.str.contains(
            r"sharqia|zagazig|bilbeis|10th of ramadan",
            na=False,
        ),
        # Tier 11: Dakahlia
        clean_s.str.contains(
            r"dakahlia|el mansoura|talkha|mit ghamr",
            na=False,
        ),
        # Tier 12: Gharbia
        clean_s.str.contains(
            r"gharbia|tanta|el mahalla|kafr el zayat",
            na=False,
        ),
        # Tier 13: Canal Zone
        clean_s.str.contains(
            r"ismailia|port said|suez|ain sokhna",
            na=False,
        ),
        # Tier 14: Upper Egypt
        clean_s.str.contains(
            r"fayoum|beni suef|minya|asyut|sohag|qena|luxor|aswan|kom ombo|new valley",
            na=False,
        ),
        # Tier 15: Coastal & Resorts
        clean_s.str.contains(
            r"hurghada|el gouna|marsa matrouh|north coast|sahel|el alamein|"
            r"sharm el sheikh|dahab|nuweiba|ras sudr|sinai|red sea",
            na=False,
        ),
    ]

    choices = [
        "New Cairo",         # Tier 1
        "Giza",              # Tier 2
        "October & Zayed",   # Tier 3
        "Nasr City",         # Tier 4
        "Heliopolis",        # Tier 5
        "Maadi",             # Tier 6
        "Alexandria",        # Tier 7
        "Cairo",             # Tier 8
        "Qalyubia",          # Tier 9
        "Sharqia",           # Tier 10
        "Dakahlia",          # Tier 11
        "Gharbia",           # Tier 12
        "Canal Zone",        # Tier 13
        "Upper Egypt",       # Tier 14
        "Coastal & Resorts", # Tier 15
    ]

    result = pd.Series(
        np.select(conditions, choices, default="Other/Unknown"),
        index=series.index,
    )

    # Actual NaN or placeholder-only strings → Other/Unknown
    result[series.isna()] = "Other/Unknown"
    result[clean_s.isin(["", "nan", "none", "•"])] = "Other/Unknown"

    # Consolidate sparse governorates
    sparse = {"Monufia", "Kafr el-Sheikh", "Beheira", "Damietta"}
    result = result.replace({g: "Delta (Other)" for g in sparse})

    return result


# ── Nearest-year fallback ─────────────────────────────────────────────────────

def _nearest_year_merge(
    unmatched: pd.DataFrame,
    lookup: pd.DataFrame,
    spec_cols: list[str],
) -> pd.DataFrame:
    """For rows that didn't match on exact year, find nearest year in lookup.

    Modifies unmatched in-place with spec columns populated from the nearest
    available lookup year for the same (make, model) pair.
    Returns the enriched DataFrame.
    """
    if unmatched.empty:
        return unmatched

    lookup_years = lookup[["make", "model", "year"] + spec_cols].copy()
    lookup_years["year"] = pd.to_numeric(lookup_years["year"], errors="coerce")

    result_rows = []
    for _, row in unmatched.iterrows():
        row = row.copy()
        make_val = str(row.get("make", "")).strip()
        model_val = str(row.get("model", "")).strip()
        year_val = row.get("year")

        candidates = lookup_years[
            (lookup_years["make"].str.strip() == make_val)
            & (lookup_years["model"].str.strip() == model_val)
        ]

        if candidates.empty or pd.isna(year_val):
            result_rows.append(row)
            continue

        try:
            year_int = int(float(year_val))
        except (ValueError, TypeError):
            result_rows.append(row)
            continue

        # Pick the candidate with the smallest year distance
        candidates = candidates.dropna(subset=["year"])
        if candidates.empty:
            result_rows.append(row)
            continue

        idx_nearest = (candidates["year"] - year_int).abs().idxmin()
        nearest = candidates.loc[idx_nearest]

        for col in spec_cols:
            if col in nearest and pd.notna(nearest[col]):
                row[col] = nearest[col]

        result_rows.append(row)

    all_cols = list(unmatched.columns) + [c for c in spec_cols if c not in unmatched.columns]
    return pd.DataFrame(result_rows, columns=all_cols)


# ── Main pipeline ─────────────────────────────────────────────────────────────

def build_processed(
    raw_path: Path = RAW_DATA_PATH,
    lookup_path: Path = LOOKUP_PATH,
    version_tag: str | None = None,
    scraping_num: int | None = None,
) -> tuple[pd.DataFrame, dict]:
    """Build processed_data DataFrame from cleaned raw + lookup files.

    Returns (df, stats_dict). Output contains only model features.
    """
    stats: dict = {}

    # ── 1. Load raw data ──────────────────────────────────────────────────────
    raw = pd.read_csv(raw_path)
    stats["raw_rows"] = len(raw)

    # Drop model_family if still present
    for col in ["model_family", "brand_market_share"]:
        if col in raw.columns:
            raw = raw.drop(columns=[col])

    # ── 2. Drop rows missing critical identifiers ─────────────────────────────
    raw["year"] = pd.to_numeric(raw["year"], errors="coerce")
    raw["price_egp"] = pd.to_numeric(raw["price_egp"], errors="coerce")
    raw["mileage_km"] = pd.to_numeric(raw["mileage_km"], errors="coerce")

    before = len(raw)
    raw = raw.dropna(subset=["year", "price_egp"]).reset_index(drop=True)
    stats["dropped_missing_year_price"] = before - len(raw)
    stats["after_drop_missing"] = len(raw)

    # ── 2b. Hard bounds: year range + price range (mirror notebook decisions) ──
    MIN_YEAR, MAX_YEAR = 1975, CURRENT_YEAR
    MIN_PRICE, MAX_PRICE = 20_000, 20_000_000

    before = len(raw)
    raw = raw[(raw["year"] >= MIN_YEAR) & (raw["year"] <= MAX_YEAR)].reset_index(drop=True)
    stats["dropped_year_out_of_range"] = before - len(raw)

    before = len(raw)
    raw = raw[(raw["price_egp"] >= MIN_PRICE) & (raw["price_egp"] <= MAX_PRICE)].reset_index(drop=True)
    stats["dropped_price_out_of_range"] = before - len(raw)

    # ── 2c. Mileage filters (mirror notebook decisions) ─────────────────────
    raw["mileage_km"] = pd.to_numeric(raw["mileage_km"], errors="coerce")

    before = len(raw)
    raw = raw[raw["mileage_km"].notna()].reset_index(drop=True)
    stats["dropped_null_mileage"] = before - len(raw)

    before = len(raw)
    raw = raw[(raw["mileage_km"] >= 0) & (raw["mileage_km"] <= 500_000)].reset_index(drop=True)
    stats["dropped_mileage_out_of_range"] = before - len(raw)

    before = len(raw)
    # Old cars with suspiciously low mileage (likely odometer fraud / data error)
    # Use CURRENT_YEAR - 3 so this threshold advances automatically each year
    raw = raw[~((raw["year"] < CURRENT_YEAR - 3) & (raw["mileage_km"] < 5_000))].reset_index(drop=True)
    # Brand-new cars cannot realistically have very high mileage:
    # age 0 (this year): max 30k km, age 1: max 70k km, age 2: max 120k km
    _NEW_CAR_MAX_KM = {0: 30_000, 1: 70_000, 2: 120_000}
    raw["_age_filter"] = CURRENT_YEAR - raw["year"].astype(int)
    for _age, _max_km in _NEW_CAR_MAX_KM.items():
        raw = raw[~((raw["_age_filter"] == _age) & (raw["mileage_km"] > _max_km))]
    raw = raw.drop(columns=["_age_filter"]).reset_index(drop=True)
    stats["dropped_impossible_mileage"] = before - len(raw)

    # ── 2d. Fuel / transmission imputation (mode hierarchy) ───────────────────
    for col, group_primary, group_fallback in [
        ("fuel",         ["make", "model", "year", "transmission"], ["make", "model"]),
        ("transmission", ["make", "model", "year", "fuel"],         ["make", "model"]),
    ]:
        if col not in raw.columns:
            continue
        null_before = int(raw[col].isna().sum())
        if null_before == 0:
            stats[f"imputed_{col}_primary"] = 0
            stats[f"imputed_{col}_fallback"] = 0
            continue

        # Primary: mode within (make, model, year, other_cat)
        mode_primary = (
            raw.dropna(subset=[col] + group_primary)
            .groupby(group_primary, as_index=False)[col]
            .agg(lambda s: s.mode().iloc[0] if not s.mode().empty else pd.NA)
            .rename(columns={col: f"_{col}_p"})
        )
        raw = raw.merge(mode_primary, on=group_primary, how="left")
        mask_p = raw[col].isna() & raw[f"_{col}_p"].notna()
        raw.loc[mask_p, col] = raw.loc[mask_p, f"_{col}_p"]
        raw = raw.drop(columns=[f"_{col}_p"])
        stats[f"imputed_{col}_primary"] = int(mask_p.sum())

        # Fallback: mode within (make, model)
        mode_fallback = (
            raw.dropna(subset=[col] + group_fallback)
            .groupby(group_fallback, as_index=False)[col]
            .agg(lambda s: s.mode().iloc[0] if not s.mode().empty else pd.NA)
            .rename(columns={col: f"_{col}_f"})
        )
        raw = raw.merge(mode_fallback, on=group_fallback, how="left")
        mask_f = raw[col].isna() & raw[f"_{col}_f"].notna()
        raw.loc[mask_f, col] = raw.loc[mask_f, f"_{col}_f"]
        raw = raw.drop(columns=[f"_{col}_f"])
        stats[f"imputed_{col}_fallback"] = int(mask_f.sum())

        # Drop unresolved (EDA decision: no match → drop)
        before = len(raw)
        raw = raw[raw[col].notna()].reset_index(drop=True)
        stats[f"dropped_unresolved_{col}"] = before - len(raw)

    # ── 3. Location normalisation ─────────────────────────────────────────────
    if "location" in raw.columns:
        raw["location"] = normalize_locations(raw["location"])
    else:
        raw["location"] = "Other/Unknown"

    # ── 4. Load lookup ────────────────────────────────────────────────────────
    lookup = pd.read_csv(lookup_path)
    for col in ["model_family", "brand_market_share"]:
        if col in lookup.columns:
            lookup = lookup.drop(columns=[col])
    lookup["year"] = pd.to_numeric(lookup["year"], errors="coerce")

    available_spec_cols = [c for c in SPEC_COLS if c in lookup.columns]

    # ── 5. Exact merge on (make, model, year) ─────────────────────────────────
    merged = raw.merge(
        lookup[["make", "model", "year"] + available_spec_cols].drop_duplicates(
            subset=["make", "model", "year"], keep="first"
        ),
        on=["make", "model", "year"],
        how="left",
    )

    # ── 6. Nearest-year fallback for unmatched rows ───────────────────────────
    spec_missing_mask = merged[available_spec_cols[0]].isna() if available_spec_cols else pd.Series(False, index=merged.index)
    n_unmatched = int(spec_missing_mask.sum())
    stats["exact_merge_unmatched"] = n_unmatched

    if n_unmatched > 0:
        unmatched_rows = merged[spec_missing_mask].copy()
        # Drop spec cols from unmatched rows before re-merging
        for col in available_spec_cols:
            if col in unmatched_rows.columns:
                unmatched_rows = unmatched_rows.drop(columns=[col])

        enriched = _nearest_year_merge(unmatched_rows, lookup, available_spec_cols)
        merged.loc[spec_missing_mask, available_spec_cols] = enriched[available_spec_cols].values

    still_missing_mask = merged[available_spec_cols[0]].isna() if available_spec_cols else pd.Series(False, index=merged.index)
    stats["nearest_year_fallback_filled"] = n_unmatched - int(still_missing_mask.sum())
    stats["dropped_no_spec_match"] = int(still_missing_mask.sum())

    # Drop rows with no spec match
    if int(still_missing_mask.sum()) > 0:
        merged = merged[~still_missing_mask].reset_index(drop=True)

    # ── 7. Feature engineering ────────────────────────────────────────────────
    merged["year"] = merged["year"].astype(int)
    merged["car_age"] = CURRENT_YEAR - merged["year"]
    merged["car_age"] = merged["car_age"].clip(lower=0)

    # Ensure integer spec columns stay int (nearest-year NaN fill can cause float cast)
    for _int_col in ["engine_cc", "horsepower", "seating_capacity"]:
        if _int_col in merged.columns:
            merged[_int_col] = pd.to_numeric(merged[_int_col], errors="coerce").astype("Int64").astype(int)

    merged["mileage_km"] = pd.to_numeric(merged["mileage_km"], errors="coerce")
    merged["mileage_per_year"] = merged["mileage_km"] / merged["car_age"].replace(0, 1)

    merged["price_egp"] = pd.to_numeric(merged["price_egp"], errors="coerce")
    merged["price_egp_log"] = merged["price_egp"].apply(
        lambda x: math.log(x) if pd.notna(x) and x > 0 else float("nan")
    )

    # ── 8. Final column selection ─────────────────────────────────────────────
    # Only model features — no metadata columns. Version tracking is in the manifest.
    present_cols = [c for c in OUTPUT_COLS if c in merged.columns]
    result = merged[present_cols].copy()

    # Drop rows with NaN in price_egp_log (price was zero/missing after conversion)
    before_final = len(result)
    result = result.dropna(subset=["price_egp_log"]).reset_index(drop=True)
    stats["dropped_bad_price"] = before_final - len(result)

    # ── 9. Rare make+model filter: drop groups with fewer than 5 rows ─────────
    before_rare = len(result)
    mm_counts = result.groupby(["make", "model"])["make"].transform("count")
    result = result[mm_counts >= 5].reset_index(drop=True)
    stats["dropped_rare_make_model"] = before_rare - len(result)

    stats["final_rows"] = len(result)

    return result, stats


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        description="Regenerate data/processed/processed_data.csv (Step 1.5)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python generate_processed_data.py            # dry-run\n"
            "  python generate_processed_data.py --apply    # write output\n"
        ),
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write processed_data.csv (default: dry-run only)",
    )
    parser.add_argument(
        "--raw",
        type=Path,
        default=RAW_DATA_PATH,
        help=f"Input raw CSV (default: {RAW_DATA_PATH})",
    )
    parser.add_argument(
        "--lookup",
        type=Path,
        default=LOOKUP_PATH,
        help=f"Input lookup CSV (default: {LOOKUP_PATH})",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=OUTPUT_PATH,
        help=f"Output CSV path (default: {OUTPUT_PATH})",
    )
    parser.add_argument(
        "--version-tag",
        default=None,
        help="Version tag to embed in output (e.g. 2026-05-25_001)",
    )
    parser.add_argument(
        "--scraping-num",
        type=int,
        default=None,
        help="Supabase scraping round number to embed in output",
    )
    args = parser.parse_args(argv)

    log = logging.getLogger("generate_processed_data")
    log.setLevel(logging.INFO)
    if not log.handlers:
        ts = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
        fh = logging.FileHandler(LOG_DIR / f"generate_{ts}.log", encoding="utf-8")
        fh.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
        sh = logging.StreamHandler(sys.stdout)
        sh.setFormatter(logging.Formatter("%(message)s"))
        log.addHandler(fh)
        log.addHandler(sh)

    for p in [args.raw, args.lookup]:
        if not p.exists():
            log.error("File not found: %s", p)
            return 2

    log.info("Raw data:  %s", args.raw)
    log.info("Lookup:    %s", args.lookup)
    log.info("Output:    %s", args.output)

    df, stats = build_processed(
        raw_path=args.raw,
        lookup_path=args.lookup,
        version_tag=args.version_tag,
        scraping_num=args.scraping_num,
    )

    log.info("=== Build stats ===")
    for k, v in stats.items():
        log.info("  %s: %s", k, v)

    if not args.apply:
        log.info("Dry run — pass --apply to write output.")
        return 0

    args.output.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(args.output, index=False)
    log.info("Wrote %d rows → %s", len(df), args.output)

    # Verification
    check = pd.read_csv(args.output, nrows=0)
    bad_cols = [c for c in ["model_family", "brand_market_share"] if c in check.columns]
    if bad_cols:
        log.warning("Output still contains %s", bad_cols)
        return 1

    missing_critical = [c for c in ["price_egp", "year", "make", "model"] if c not in check.columns]
    if missing_critical:
        log.warning("Output missing critical columns %s", missing_critical)
        return 1

    log.info("Verification OK: %d columns, no unwanted columns.", len(check.columns))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
