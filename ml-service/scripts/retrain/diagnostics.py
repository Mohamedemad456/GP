"""Diagnostics: threshold summaries and make_model_mape.csv generation."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd


def threshold_summary(
    per_mm_df: pd.DataFrame,
    thresholds: list[float] | None = None,
) -> dict:
    """Count make-model combos above MAPE thresholds.

    Returns a dict like:
    {
        "n_total": int,
        "above_30pct": int,
        "above_50pct": int,
        "pct_above_30pct": float,
        "pct_above_50pct": float,
    }
    """
    thresholds = thresholds or [30.0, 50.0]
    total = len(per_mm_df)
    if total == 0:
        return {
            "n_total": 0,
            "above_30pct": 0,
            "above_50pct": 0,
            "pct_above_30pct": 0.0,
            "pct_above_50pct": 0.0,
        }

    above_counts: dict[str, int] = {}
    for t in thresholds:
        key = f"above_{int(t)}pct"
        above_counts[key] = int((per_mm_df["MAPE_pct"] > t).sum())

    result: dict = {"n_total": total}
    for t in thresholds:
        key = f"above_{int(t)}pct"
        pct_key = f"pct_{key}"
        result[key] = above_counts[key]
        result[pct_key] = round(above_counts[key] / total * 100, 2)
    return result


def supported_combo_stats(
    per_mm_df: pd.DataFrame,
    min_rows: int = 10,
) -> dict:
    """Statistics for supported vs unsupported make-model combos.

    Supported combo = n_test >= min_rows.
    """
    supported = per_mm_df[per_mm_df["n_test"] >= min_rows]
    unsupported = per_mm_df[per_mm_df["n_test"] < min_rows]

    return {
        "min_rows": min_rows,
        "n_supported": len(supported),
        "n_unsupported": len(unsupported),
        "pct_supported": round(len(supported) / len(per_mm_df) * 100, 2) if len(per_mm_df) else 0.0,
        "supported_mape_mean": round(supported["MAPE_pct"].mean(), 4) if len(supported) else None,
        "supported_mape_median": round(supported["MAPE_pct"].median(), 4) if len(supported) else None,
        "supported_above_30pct": int((supported["MAPE_pct"] > 30.0).sum()) if len(supported) else 0,
        "supported_above_50pct": int((supported["MAPE_pct"] > 50.0).sum()) if len(supported) else 0,
    }


def per_mm_threshold_diagnostics(
    per_mm_df: pd.DataFrame,
    prefix: str = "holdout",
    thresholds: list[float] | None = None,
    min_rows: int = 10,
) -> dict:
    """Compute per-make-model threshold statistics for registry/history.

    Returns a flat dict like:
    {
        "holdout_per_mm_total": 160,
        "holdout_per_mm_supported": 76,
        "holdout_per_mm_pct_under_15pct": 72.3,
        "holdout_per_mm_pct_under_20pct": 85.0,
        "holdout_per_mm_pct_under_30pct": 93.8,
        "holdout_per_mm_pct_over_30pct": 6.2,
        "holdout_per_mm_pct_over_50pct": 1.2,
        "holdout_per_mm_supported_pct_over_30pct": 3.9,
        "holdout_per_mm_supported_pct_over_50pct": 0.0,
    }
    """
    thresholds = thresholds or [15.0, 20.0, 30.0, 50.0]
    total = len(per_mm_df)
    supported = per_mm_df[per_mm_df["n_test"] >= min_rows]
    n_supported = len(supported)

    result: dict = {
        f"{prefix}_per_mm_total": total,
        f"{prefix}_per_mm_supported": n_supported,
    }

    for t in thresholds:
        key_under = f"{prefix}_per_mm_pct_under_{int(t)}pct"
        key_over = f"{prefix}_per_mm_pct_over_{int(t)}pct"
        result[key_under] = float(round((per_mm_df["MAPE_pct"] < t).mean() * 100, 2)) if total else 0.0
        result[key_over] = float(round((per_mm_df["MAPE_pct"] > t).mean() * 100, 2)) if total else 0.0

        if n_supported > 0:
            key_sup_over = f"{prefix}_per_mm_supported_pct_over_{int(t)}pct"
            result[key_sup_over] = float(round((supported["MAPE_pct"] > t).mean() * 100, 2))

    return result


def generate_make_model_mape_csv(
    per_mm_df: pd.DataFrame,
    output_path: str | Path,
) -> Path:
    """Write make_model_mape.csv for runtime diagnostics consumption.

    Columns: make, model, MAPE_pct
    """
    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    df = per_mm_df[["make", "model", "MAPE_pct"]].copy()
    df.to_csv(out, index=False)
    return out
