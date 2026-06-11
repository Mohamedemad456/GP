"""Cross-validation: notebook-parity KFold OOF + secondary grouped CV."""

from __future__ import annotations

import logging

import numpy as np
import pandas as pd
from sklearn.model_selection import KFold

from scripts.retrain.constants import (
    CAT_COLS,
    EARLY_STOPPING_ROUNDS,
    ENSEMBLE_WEIGHTS,
    FEATURE_COLS,
    MAX_BOOST_ROUNDS,
    NUM_COLS,
    QUANTILES,
    RANDOM_STATE,
)
from scripts.retrain.evaluation import (
    _assign_price_tier,
    _safe_mape,
    compute_interval_metrics,
)
from scripts.retrain.predictor import (
    blend_prediction_maps,
    predict_lgbm_quantiles,
    predict_xgb_quantiles,
)
from scripts.retrain.splitters import split_train_val
from scripts.retrain.trainer import (
    compute_metrics_egp,
    fit_label_encoders,
    make_lgbm_frame,
    train_lgbm_quantile_models,
    train_xgb_quantile_models,
    transform_with_label_encoders,
)

logger = logging.getLogger("retrain.cv")


def run_kfold_cv(
    df: pd.DataFrame,
    target_col: str,
    n_splits: int = 5,
    random_state: int = RANDOM_STATE,
    lgbm_params: dict | None = None,
    xgb_params: dict | None = None,
) -> dict:
    """Notebook-parity 5-fold KFold OOF evaluation.

    Returns a dict with:
    - overall_metrics: dict of CV metrics
    - oof_preds: np.ndarray of OOF median predictions (in EGP space)
    - oof_true: np.ndarray of true values (in EGP space)
    """
    is_log = target_col == "price_egp_log"
    kf = KFold(n_splits=n_splits, shuffle=True, random_state=random_state)

    oof_preds_log = np.full(len(df), np.nan, dtype=float)
    oof_pred_maps: list[dict[str, np.ndarray]] = []
    test_indices: list[np.ndarray] = []

    # Use full data for encoders (same as notebook)
    label_encoders = fit_label_encoders(df, CAT_COLS)

    fold = 0
    for train_pos, test_pos in kf.split(df):
        fold += 1
        logger.info(f"CV fold {fold}/{n_splits}")

        train_df = df.iloc[train_pos].copy()
        test_df = df.iloc[test_pos].copy()

        # Derive validation from train (same as notebook: 10% from start)
        train_fit_idx, val_idx = split_train_val(
            train_pos, val_fraction=0.10, random_state=random_state
        )
        fit_df = df.loc[train_fit_idx].copy()
        valid_df = df.loc[val_idx].copy()

        # Build frames
        X_fit_lgb = make_lgbm_frame(fit_df, FEATURE_COLS, CAT_COLS)
        X_valid_lgb = make_lgbm_frame(valid_df, FEATURE_COLS, CAT_COLS)
        X_test_lgb = make_lgbm_frame(test_df, FEATURE_COLS, CAT_COLS)

        X_fit_xgb = transform_with_label_encoders(fit_df, FEATURE_COLS, CAT_COLS, label_encoders)
        X_valid_xgb = transform_with_label_encoders(valid_df, FEATURE_COLS, CAT_COLS, label_encoders)
        X_test_xgb = transform_with_label_encoders(test_df, FEATURE_COLS, CAT_COLS, label_encoders)

        # Train both models
        xgb_models = train_xgb_quantile_models(
            X_fit_xgb,
            fit_df[target_col],
            X_valid_xgb,
            valid_df[target_col],
            QUANTILES,
            params=xgb_params,
            n_estimators_max=MAX_BOOST_ROUNDS,
            early_stopping_rounds=EARLY_STOPPING_ROUNDS,
        )
        lgbm_models = train_lgbm_quantile_models(
            X_fit_lgb,
            fit_df[target_col],
            X_valid_lgb,
            valid_df[target_col],
            CAT_COLS,
            QUANTILES,
            params=lgbm_params,
            n_estimators_max=MAX_BOOST_ROUNDS,
            early_stopping_rounds=EARLY_STOPPING_ROUNDS,
        )

        # Predict on test fold
        pred_map_xgb = predict_xgb_quantiles(xgb_models, X_test_xgb)
        pred_map_lgbm = predict_lgbm_quantiles(lgbm_models, X_test_lgb)
        pred_map = blend_prediction_maps(
            [pred_map_xgb, pred_map_lgbm],
            weights=ENSEMBLE_WEIGHTS,
        )

        median_key = "median" if "median" in pred_map else "q50"
        oof_preds_log[test_pos] = pred_map[median_key]
        oof_pred_maps.append({k: v.copy() for k, v in pred_map.items()})
        test_indices.append(test_pos.copy())

    # Convert OOF predictions to EGP space
    if is_log:
        if float(np.nanmedian(df[target_col].to_numpy())) < 10:
            oof_preds = np.power(10.0, oof_preds_log)
        else:
            oof_preds = np.exp(oof_preds_log)
        y_true_egp = df["price_egp"].to_numpy(dtype=float)
    else:
        oof_preds = oof_preds_log
        y_true_egp = df[target_col].to_numpy(dtype=float)

    # Overall CV point metrics from OOF
    # Interval metrics omitted from overall CV because OOF only stores median
    metrics = compute_metrics_egp(df[target_col].to_numpy(), oof_preds_log, is_log=is_log)

    return {
        "overall_metrics": metrics,
        "oof_preds": oof_preds,
        "oof_true": y_true_egp,
        "test_indices": test_indices,
    }


def evaluate_cv_per_tier(
    df: pd.DataFrame,
    oof_preds: np.ndarray,
) -> pd.DataFrame:
    """Per-tier metrics from OOF predictions."""
    df = df[["price_egp"]].copy()
    df["tier"] = _assign_price_tier(df["price_egp"])
    df["pred_egp"] = oof_preds

    rows: list[dict] = []
    for tier, group in df.groupby("tier"):
        y_true = group["price_egp"].to_numpy(dtype=float)
        y_pred = group["pred_egp"].to_numpy(dtype=float)
        rows.append({
            "tier": tier,
            "n": len(group),
            "MAE": float(np.mean(np.abs(y_true - y_pred))),
            "RMSE": float(np.sqrt(np.mean((y_true - y_pred) ** 2))),
            "R2": float(1 - np.sum((y_true - y_pred) ** 2) / np.sum((y_true - np.mean(y_true)) ** 2)),
            "MAPE_pct": _safe_mape(y_true, y_pred),
            "Within_10pct": float(np.mean(np.abs(y_true - y_pred) / np.maximum(y_true, 1e-9) <= 0.10) * 100),
            "Within_15pct": float(np.mean(np.abs(y_true - y_pred) / np.maximum(y_true, 1e-9) <= 0.15) * 100),
        })

    return pd.DataFrame(rows)


def evaluate_cv_per_make_model(
    df: pd.DataFrame,
    oof_preds: np.ndarray,
    min_rows: int = 5,
) -> pd.DataFrame:
    """Per-make-model metrics from OOF predictions for ALL combinations."""
    df = df[["make", "model", "price_egp"]].copy()
    df["pred_egp"] = oof_preds

    rows: list[dict] = []
    for (make, model), group in df.groupby(["make", "model"], dropna=False):
        n = len(group)
        supported = n >= min_rows
        y_true = group["price_egp"].to_numpy(dtype=float)
        y_pred = group["pred_egp"].to_numpy(dtype=float)

        if np.isnan(y_pred).any():
            continue

        # Always compute metrics; small groups may yield noisy values
        mae_val = float(np.mean(np.abs(y_true - y_pred)))
        mape_val = _safe_mape(y_true, y_pred)
        rows.append({
            "make": make,
            "model": model,
            "n_test": n,
            "supported": supported,
            "MAPE_pct": mape_val,
            "MAE": mae_val,
            "mean_price": float(np.mean(y_true)),
        })

    return pd.DataFrame(rows).sort_values(["MAPE_pct", "n_test"], ascending=[False, False]).reset_index(drop=True)


def run_grouped_cv(
    df: pd.DataFrame,
    target_col: str,
    n_splits: int = 5,
    random_state: int = RANDOM_STATE,
    lgbm_params: dict | None = None,
    xgb_params: dict | None = None,
) -> dict:
    """Secondary robustness CV using GroupKFold by make-model.

    Returns overall group-CV metrics and per-group diagnostics.
    """
    from sklearn.model_selection import GroupKFold

    is_log = target_col == "price_egp_log"
    df = df.copy()
    df["__group__"] = df["make"].astype(str) + "::" + df["model"].astype(str)
    groups = df["__group__"].to_numpy()

    gkf = GroupKFold(n_splits=n_splits)
    oof_preds_log = np.full(len(df), np.nan, dtype=float)

    label_encoders = fit_label_encoders(df, CAT_COLS)

    fold = 0
    for train_pos, test_pos in gkf.split(df, groups=groups):
        fold += 1
        logger.info(f"Grouped CV fold {fold}/{n_splits}")

        train_df = df.iloc[train_pos].copy()
        test_df = df.iloc[test_pos].copy()

        train_fit_idx, val_idx = split_train_val(
            train_pos, val_fraction=0.10, random_state=random_state
        )
        fit_df = df.loc[train_fit_idx].copy()
        valid_df = df.loc[val_idx].copy()

        X_fit_lgb = make_lgbm_frame(fit_df, FEATURE_COLS, CAT_COLS)
        X_valid_lgb = make_lgbm_frame(valid_df, FEATURE_COLS, CAT_COLS)
        X_test_lgb = make_lgbm_frame(test_df, FEATURE_COLS, CAT_COLS)

        X_fit_xgb = transform_with_label_encoders(fit_df, FEATURE_COLS, CAT_COLS, label_encoders)
        X_valid_xgb = transform_with_label_encoders(valid_df, FEATURE_COLS, CAT_COLS, label_encoders)
        X_test_xgb = transform_with_label_encoders(test_df, FEATURE_COLS, CAT_COLS, label_encoders)

        xgb_models = train_xgb_quantile_models(
            X_fit_xgb, fit_df[target_col], X_valid_xgb, valid_df[target_col],
            QUANTILES, params=xgb_params,
            n_estimators_max=MAX_BOOST_ROUNDS,
            early_stopping_rounds=EARLY_STOPPING_ROUNDS,
        )
        lgbm_models = train_lgbm_quantile_models(
            X_fit_lgb, fit_df[target_col], X_valid_lgb, valid_df[target_col],
            CAT_COLS, QUANTILES, params=lgbm_params,
            n_estimators_max=MAX_BOOST_ROUNDS,
            early_stopping_rounds=EARLY_STOPPING_ROUNDS,
        )

        pred_map_xgb = predict_xgb_quantiles(xgb_models, X_test_xgb)
        pred_map_lgbm = predict_lgbm_quantiles(lgbm_models, X_test_lgb)
        pred_map = blend_prediction_maps(
            [pred_map_xgb, pred_map_lgbm],
            weights=ENSEMBLE_WEIGHTS,
        )

        median_key = "median" if "median" in pred_map else "q50"
        oof_preds_log[test_pos] = pred_map[median_key]

    if is_log:
        if float(np.nanmedian(df[target_col].to_numpy())) < 10:
            oof_preds = np.power(10.0, oof_preds_log)
        else:
            oof_preds = np.exp(oof_preds_log)
        y_true_egp = df["price_egp"].to_numpy(dtype=float)
    else:
        oof_preds = oof_preds_log
        y_true_egp = df[target_col].to_numpy(dtype=float)

    metrics = compute_metrics_egp(df[target_col].to_numpy(), oof_preds_log, is_log=is_log)

    return {
        "overall_metrics": metrics,
        "oof_preds": oof_preds,
        "oof_true": y_true_egp,
    }
