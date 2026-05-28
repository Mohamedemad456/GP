#!/usr/bin/env python3
"""Version consistency checker — run before combining multiple data snapshots.

Reads all registered versions from data/data_manifest.json and produces a
combinability report for each pair of processed CSVs.

Checks:
  1. Column names identical
  2. Dtypes compatible (int/float tolerance)
  3. Make name casing consistent
  4. Cross-round duplicate rate
  5. Price / year / mileage distribution shift (median ± threshold)

Exit codes:
  0  All versions are combinable
  1  Issues found — review report before merging

Usage:
    python check_version_consistency.py               # check all versions
    python check_version_consistency.py --save        # also write report CSV
    python check_version_consistency.py --base 2026-05-24_001 --compare 2026-05-25_001
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATH = PROJECT_ROOT / "data" / "data_manifest.json"

DEDUP_KEY = ["make", "model", "year", "mileage_km", "price_egp"]
META_COLS = {"scraping_date", "version_tag", "scraping_num"}
FEATURE_COLS_REQUIRED = {
    "make", "model", "year", "car_age", "transmission", "fuel",
    "mileage_km", "mileage_per_year", "location",
    "engine_cc", "horsepower", "body_type", "drivetrain",
    "seating_capacity", "brand_origin", "car_segment",
    "price_egp", "price_egp_log",
}
# Flag a distribution shift if medians differ by more than this factor
SHIFT_WARN_FACTOR = 1.5


# ── Helpers ────────────────────────────────────────────────────────────────────

def _load_manifest() -> dict:
    if not MANIFEST_PATH.exists():
        print(f"ERROR: manifest not found at {MANIFEST_PATH}", file=sys.stderr)
        sys.exit(2)
    with open(MANIFEST_PATH) as f:
        return json.load(f)


def _load_processed(path: str) -> pd.DataFrame | None:
    p = Path(path)
    if not p.exists():
        return None
    return pd.read_csv(p)


def _feature_cols(df: pd.DataFrame) -> list[str]:
    return [c for c in df.columns if c not in META_COLS]


def _check_pair(tag_a: str, df_a: pd.DataFrame, tag_b: str, df_b: pd.DataFrame) -> dict:
    """Run all checks between two processed DataFrames. Returns a result dict."""
    issues: list[str] = []
    warnings: list[str] = []

    fc_a = set(_feature_cols(df_a))
    fc_b = set(_feature_cols(df_b))

    # 1 — Column consistency
    missing_in_b = fc_a - fc_b - META_COLS
    extra_in_b = fc_b - fc_a - META_COLS
    if missing_in_b:
        issues.append(f"Columns missing in {tag_b}: {sorted(missing_in_b)}")
    if extra_in_b:
        warnings.append(f"Extra columns in {tag_b}: {sorted(extra_in_b)}")

    required_missing = FEATURE_COLS_REQUIRED - (fc_a & fc_b)
    if required_missing:
        issues.append(f"Required feature columns absent in both: {sorted(required_missing)}")

    common = [c for c in _feature_cols(df_a) if c in _feature_cols(df_b)]

    # 2 — Dtype compatibility
    for col in common:
        ta, tb = df_a[col].dtype, df_b[col].dtype
        if ta == tb:
            continue
        # int/float mismatch is tolerable
        if pd.api.types.is_numeric_dtype(ta) and pd.api.types.is_numeric_dtype(tb):
            warnings.append(f"  dtype mismatch {col}: {tag_a}={ta}  {tag_b}={tb} (numeric → OK)")
        else:
            issues.append(f"  dtype mismatch {col}: {tag_a}={ta}  {tag_b}={tb}")

    # 3 — Make casing consistency
    makes_a = {m.lower(): m for m in df_a["make"].dropna().unique()}
    makes_b = {m.lower(): m for m in df_b["make"].dropna().unique()}
    casing_issues = [
        (makes_a[k], makes_b[k])
        for k in makes_a if k in makes_b and makes_a[k] != makes_b[k]
    ]
    if casing_issues:
        for a_make, b_make in casing_issues:
            issues.append(f"  make casing mismatch: {tag_a}={a_make!r}  {tag_b}={b_make!r}")

    # 4 — Cross-round duplicate rate
    dup_key_present = [c for c in DEDUP_KEY if c in common]
    if len(dup_key_present) == len(DEDUP_KEY):
        combined = pd.concat(
            [df_a[DEDUP_KEY].assign(_src=tag_a), df_b[DEDUP_KEY].assign(_src=tag_b)],
            ignore_index=True,
        )
        dup_mask = combined.drop(columns=["_src"]).duplicated(keep=False)
        dup_groups = combined[dup_mask].drop(columns=["_src"]).drop_duplicates().shape[0]
        dup_pct_of_b = dup_groups / len(df_b) * 100 if len(df_b) > 0 else 0
    else:
        dup_groups = -1
        dup_pct_of_b = -1.0

    # 5 — Distribution shift (price, year, mileage)
    for col in ["price_egp", "year", "mileage_km"]:
        if col not in common:
            continue
        med_a = pd.to_numeric(df_a[col], errors="coerce").median()
        med_b = pd.to_numeric(df_b[col], errors="coerce").median()
        if med_a and med_b:
            ratio = max(med_a, med_b) / min(med_a, med_b)
            if ratio > SHIFT_WARN_FACTOR:
                warnings.append(
                    f"  {col} median shift: {tag_a}={med_a:,.0f}  {tag_b}={med_b:,.0f}  (ratio={ratio:.2f})"
                )

    combinable = len(issues) == 0

    return {
        "tag_a": tag_a,
        "tag_b": tag_b,
        "rows_a": len(df_a),
        "rows_b": len(df_b),
        "combinable": combinable,
        "issues": issues,
        "warnings": warnings,
        "duplicate_groups": dup_groups,
        "duplicate_pct_of_b": round(dup_pct_of_b, 1),
        "net_new_if_combined": len(df_b) - dup_groups if dup_groups >= 0 else None,
    }


# ── Main ───────────────────────────────────────────────────────────────────────

def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        description="Check consistency between registered data versions.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python check_version_consistency.py\n"
            "  python check_version_consistency.py --save\n"
            "  python check_version_consistency.py "
            "--base 2026-05-24_001 --compare 2026-05-25_001\n"
        ),
    )
    parser.add_argument("--save", action="store_true",
                        help="Write consistency_report.csv to data/processed/")
    parser.add_argument("--base", default=None,
                        help="Specific base version tag (default: all pairs)")
    parser.add_argument("--compare", default=None,
                        help="Specific compare version tag (default: all pairs)")
    args = parser.parse_args(argv)

    manifest = _load_manifest()
    versions = manifest.get("versions", {})

    if not versions:
        print("No versions registered in manifest.")
        return 0

    # Build list of pairs to check
    tags = sorted(versions.keys())
    if args.base and args.compare:
        pairs = [(args.base, args.compare)]
    else:
        # All consecutive ordered pairs: (v1,v2), (v1,v3), (v2,v3) …
        pairs = [(tags[i], tags[j]) for i in range(len(tags)) for j in range(i + 1, len(tags))]

    results = []
    any_issue = False

    for tag_a, tag_b in pairs:
        if tag_a not in versions:
            print(f"WARNING: tag '{tag_a}' not in manifest — skipping pair.")
            continue
        if tag_b not in versions:
            print(f"WARNING: tag '{tag_b}' not in manifest — skipping pair.")
            continue

        df_a = _load_processed(versions[tag_a]["processed_path"])
        df_b = _load_processed(versions[tag_b]["processed_path"])

        if df_a is None:
            print(f"WARNING: processed file for {tag_a} not found on disk — skipping.")
            continue
        if df_b is None:
            print(f"WARNING: processed file for {tag_b} not found on disk — skipping.")
            continue

        r = _check_pair(tag_a, df_a, tag_b, df_b)
        results.append(r)
        if not r["combinable"]:
            any_issue = True

        # ── Print report ──────────────────────────────────────────────────────
        status = "✓  COMBINABLE" if r["combinable"] else "✗  ISSUES FOUND"
        print(f"\n{'=' * 62}")
        print(f"  {tag_a}  vs  {tag_b}  →  {status}")
        print(f"{'=' * 62}")
        print(f"  Rows:      {r['rows_a']:,} (A)  /  {r['rows_b']:,} (B)")
        if r["duplicate_groups"] >= 0:
            print(f"  Overlaps:  {r['duplicate_groups']:,} duplicate groups  "
                  f"({r['duplicate_pct_of_b']:.1f}% of B)")
            print(f"  Net new:   {r['net_new_if_combined']:,} rows if combined + deduped")
        sn_a = versions[tag_a].get("scraping_num")
        sn_b = versions[tag_b].get("scraping_num")
        if sn_a is not None or sn_b is not None:
            print(f"  Scraping:  round {sn_a} (A)  /  round {sn_b} (B)")
        if r["issues"]:
            print(f"\n  ISSUES ({len(r['issues'])}):")
            for msg in r["issues"]:
                print(f"    - {msg}")
        if r["warnings"]:
            print(f"\n  WARNINGS ({len(r['warnings'])}):")
            for msg in r["warnings"]:
                print(f"    - {msg}")
        if r["combinable"]:
            print(
                "\n  RECOMMENDATION: Safe to combine.\n"
                "    pd.concat([df_a, df_b]).drop_duplicates(\n"
                f"        subset={DEDUP_KEY}\n"
                "    ).reset_index(drop=True)"
            )
        else:
            print("\n  RECOMMENDATION: Fix the issues above before combining.")

    # ── Summary ────────────────────────────────────────────────────────────────
    print(f"\n{'─' * 62}")
    print(f"  Pairs checked: {len(results)}  |  Issues: {sum(1 for r in results if not r['combinable'])}")
    print(f"{'─' * 62}\n")

    if args.save and results:
        out = PROJECT_ROOT / "data" / "processed" / "consistency_report.csv"
        save_rows = []
        for r in results:
            save_rows.append({
                "tag_a": r["tag_a"],
                "tag_b": r["tag_b"],
                "rows_a": r["rows_a"],
                "rows_b": r["rows_b"],
                "combinable": r["combinable"],
                "duplicate_groups": r["duplicate_groups"],
                "duplicate_pct_of_b": r["duplicate_pct_of_b"],
                "net_new_if_combined": r["net_new_if_combined"],
                "n_issues": len(r["issues"]),
                "n_warnings": len(r["warnings"]),
                "issues": "; ".join(r["issues"]),
                "warnings": "; ".join(r["warnings"]),
            })
        pd.DataFrame(save_rows).to_csv(out, index=False)
        print(f"Report saved → {out}")

    return 1 if any_issue else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
