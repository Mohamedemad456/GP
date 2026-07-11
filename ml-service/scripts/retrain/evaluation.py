"""Holdout evaluation: global, per-tier, per-make, per-make-model metrics."""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from scripts.retrain.constants import PRICE_TIER_BINS, PRICE_TIER_LABELS


def _safe_mape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    y_true_arr = np.asarray(y_true, dtype=float)
    y_pred_arr = np.asarray(y_pred, dtype=float)
    denom = np.maximum(np.abs(y_true_arr), 1e-9)
    return float(np.mean(np.abs((y_true_arr - y_pred_arr) / denom)) * 100)


def compute_interval_metrics(
    y_true: np.ndarray,
    pred_map: dict[str, np.ndarray],
    is_log: bool = False,
) -> dict:
    """Compute interval coverage and width metrics from a quantile prediction map."""
    quantile_order = {
        "lower": 0.05,
        "median": 0.50,
        "upper": 0.95,
        "q05": 0.05,
        "q10": 0.10,
        "q50": 0.50,
        "q90": 0.90,
        "q95": 0.95,
    }
    ordered_keys = sorted(pred_map.keys(), key=lambda key: quantile_order[key])
    values = [np.asarray(pred_map[key], dtype=float) for key in ordered_keys]
    matrix = np.column_stack(values)

    if is_log:
        if float(np.nanmedian(y_true)) < 10:
            matrix = np.power(10.0, matrix)
            y_true_eval = np.power(10.0, np.asarray(y_true, dtype=float))
        else:
            matrix = np.exp(matrix)
            y_true_eval = np.exp(np.asarray(y_true, dtype=float))
    else:
        y_true_eval = np.asarray(y_true, dtype=float)

    matrix = np.sort(matrix, axis=1)
    lower_80 = matrix[:, 1] if matrix.shape[1] >= 5 else matrix[:, 0]
    median = matrix[:, matrix.shape[1] // 2]
    upper_80 = matrix[:, -2] if matrix.shape[1] >= 5 else matrix[:, -1]
    lower_90 = matrix[:, 0]
    upper_90 = matrix[:, -1]
    width = (upper_80 - lower_80) / np.maximum(np.abs(median), 1e-9)

    return {
        "Coverage_80_pct": float(np.mean((y_true_eval >= lower_80) & (y_true_eval <= upper_80)) * 100),
        "Coverage_90_pct": float(np.mean((y_true_eval >= lower_90) & (y_true_eval <= upper_90)) * 100),
        "Mean_width_pct": float(np.mean(width) * 100),
    }


def evaluate_holdout(
    y_true_log: np.ndarray,
    pred_map: dict[str, np.ndarray],
    is_log: bool = True,
) -> dict:
    """Global holdout metrics: point + interval."""
    from scripts.retrain.trainer import compute_metrics_egp

    median_key = "median" if "median" in pred_map else "q50"
    metrics = compute_metrics_egp(y_true_log, pred_map[median_key], is_log=is_log)
    # Strip aliases to avoid duplicate quantile entries in interval calculation
    core_quantiles = {k: v for k, v in pred_map.items() if k in {"q05", "q10", "q50", "q90", "q95"}}
    metrics.update(compute_interval_metrics(y_true_log, core_quantiles, is_log=is_log))
    return metrics


def _assign_price_tier(price_egp: pd.Series) -> pd.Series:
    return pd.cut(
        price_egp,
        bins=PRICE_TIER_BINS,
        labels=PRICE_TIER_LABELS,
        include_lowest=True,
    ).astype(str)


def evaluate_per_tier(
    df_test: pd.DataFrame,
    pred_map: dict[str, np.ndarray],
    is_log: bool = True,
) -> pd.DataFrame:
    """Per-price-tier holdout metrics."""
    target_col = "price_egp_log" if is_log else "price_egp"

    df = df_test[["price_egp"]].copy()
    df["tier"] = _assign_price_tier(df["price_egp"])

    median_key = "median" if "median" in pred_map else "q50"
    if is_log:
        if float(np.nanmedian(df_test["price_egp"].to_numpy())) < 10:
            pred_egp = np.power(10.0, np.asarray(pred_map[median_key], dtype=float))
        else:
            pred_egp = np.exp(np.asarray(pred_map[median_key], dtype=float))
    else:
        pred_egp = np.asarray(pred_map[median_key], dtype=float)

    df["pred_egp"] = pred_egp

    rows: list[dict] = []
    for tier, group in df.groupby("tier"):
        y_true = group["price_egp"].to_numpy(dtype=float)
        y_pred = group["pred_egp"].to_numpy(dtype=float)

        # Convert label indices to positional indices for numpy array slicing
        pos_indices = df_test.index.get_indexer(group.index)
        # Strip aliases to avoid duplicate quantile entries
        core_quantiles = {k: v for k, v in pred_map.items() if k in {"q05", "q10", "q50", "q90", "q95"}}
        sub_pred_map = {k: v[pos_indices] for k, v in core_quantiles.items()}
        sub_y_true = df_test.loc[group.index, target_col].to_numpy()
        interval = compute_interval_metrics(sub_y_true, sub_pred_map, is_log=is_log)

        mae = mean_absolute_error(y_true, y_pred)
        rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
        r2 = r2_score(y_true, y_pred)
        mape = _safe_mape(y_true, y_pred)
        within_10 = float(np.mean(np.abs(y_true - y_pred) / np.maximum(y_true, 1e-9) <= 0.10) * 100)
        within_15 = float(np.mean(np.abs(y_true - y_pred) / np.maximum(y_true, 1e-9) <= 0.15) * 100)

        rows.append({
            "tier": tier,
            "n": len(group),
            "MAE": mae,
            "RMSE": rmse,
            "R2": r2,
            "MAPE_pct": mape,
            "Within_10pct": within_10,
            "Within_15pct": within_15,
            "Coverage_80_pct": interval["Coverage_80_pct"],
            "Coverage_90_pct": interval["Coverage_90_pct"],
        })

    return pd.DataFrame(rows)


def evaluate_per_make(
    df_test: pd.DataFrame,
    pred_egp: np.ndarray,
    min_rows: int = 5,
) -> pd.DataFrame:
    """Per-make holdout metrics."""
    df = df_test[["make", "price_egp"]].copy()
    df["pred_egp"] = np.asarray(pred_egp, dtype=float)

    rows: list[dict] = []
    for make, group in df.groupby("make"):
        if len(group) < min_rows:
            continue
        y_true = group["price_egp"].to_numpy(dtype=float)
        y_pred = group["pred_egp"].to_numpy(dtype=float)
        rows.append({
            "make": make,
            "n": len(group),
            "MAE": mean_absolute_error(y_true, y_pred),
            "RMSE": float(np.sqrt(mean_squared_error(y_true, y_pred))),
            "R2": r2_score(y_true, y_pred),
            "MAPE_pct": _safe_mape(y_true, y_pred),
            "Within_10pct": float(np.mean(np.abs(y_true - y_pred) / np.maximum(y_true, 1e-9) <= 0.10) * 100),
            "Within_15pct": float(np.mean(np.abs(y_true - y_pred) / np.maximum(y_true, 1e-9) <= 0.15) * 100),
            "mean_price": float(np.mean(y_true)),
        })

    return pd.DataFrame(rows).sort_values("MAPE_pct", ascending=False).reset_index(drop=True)


def evaluate_per_make_model(
    df_test: pd.DataFrame,
    pred_egp: np.ndarray,
    min_rows: int = 5,
) -> pd.DataFrame:
    """Per-make-model holdout metrics for ALL combinations with a supported flag."""
    df = df_test[["make", "model", "price_egp"]].copy()
    df["pred_egp"] = np.asarray(pred_egp, dtype=float)

    rows: list[dict] = []
    for (make, model), group in df.groupby(["make", "model"], dropna=False):
        n = len(group)
        supported = n >= min_rows
        y_true = group["price_egp"].to_numpy(dtype=float)
        y_pred = group["pred_egp"].to_numpy(dtype=float)

        # Always compute metrics; small groups may yield noisy values, but
        # the user explicitly wants every combination present in diagnostics.
        mae_val = mean_absolute_error(y_true, y_pred)
        rmse_val = float(np.sqrt(mean_squared_error(y_true, y_pred)))
        try:
            r2_val = r2_score(y_true, y_pred)
        except Exception:
            r2_val = np.nan
        mape_val = _safe_mape(y_true, y_pred)

        rows.append({
            "make": make,
            "model": model,
            "n_test": n,
            "supported": supported,
            "MAE": mae_val,
            "RMSE": rmse_val,
            "R2": r2_val,
            "MAPE_pct": mape_val,
            "mean_price": float(np.mean(y_true)),
        })

    return pd.DataFrame(rows).sort_values(["MAPE_pct", "n_test"], ascending=[False, False]).reset_index(drop=True)
