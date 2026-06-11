"""Training logic for XGBoost and LightGBM quantile models (frozen 07c recipe)."""

from __future__ import annotations

from typing import Any

import lightgbm as lgb
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.preprocessing import LabelEncoder

from scripts.retrain.constants import (
    EARLY_STOPPING_ROUNDS,
    LGBM_BASE_PARAMS,
    MAX_BOOST_ROUNDS,
    QUANTILES,
    XGB_BASE_PARAMS,
)
from scripts.retrain.contracts import EnsembleArtifact, QuantileModels
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score


def compute_metrics_egp(y_true: np.ndarray, y_pred: np.ndarray, is_log: bool = False) -> dict:
    y_true_arr = np.asarray(y_true, dtype=float)
    y_pred_arr = np.asarray(y_pred, dtype=float)
    if is_log:
        if float(np.nanmedian(y_true_arr)) < 10:
            y_true_arr = np.power(10.0, y_true_arr)
            y_pred_arr = np.power(10.0, y_pred_arr)
        else:
            y_true_arr = np.exp(y_true_arr)
            y_pred_arr = np.exp(y_pred_arr)
    mae = float(mean_absolute_error(y_true_arr, y_pred_arr))
    rmse = float(np.sqrt(mean_squared_error(y_true_arr, y_pred_arr)))
    r2 = float(r2_score(y_true_arr, y_pred_arr))
    denom = np.maximum(np.abs(y_true_arr), 1e-9)
    ape = np.abs((y_true_arr - y_pred_arr) / denom)
    return {
        "MAE": mae,
        "RMSE": rmse,
        "R2": r2,
        "MAPE_pct": float(np.mean(ape) * 100),
        "Within_10pct": float(np.mean(ape <= 0.10) * 100),
        "Within_15pct": float(np.mean(ape <= 0.15) * 100),
    }


def make_lgbm_frame(df: pd.DataFrame, feature_cols: list[str], cat_cols: list[str]) -> pd.DataFrame:
    frame = df[feature_cols].copy()
    for column in cat_cols:
        frame[column] = frame[column].astype("category")
    return frame


def fit_label_encoders(df_train: pd.DataFrame, cat_cols: list[str]) -> dict[str, LabelEncoder]:
    encoders: dict[str, LabelEncoder] = {}
    for column in cat_cols:
        encoder = LabelEncoder()
        values = df_train[column].fillna("__MISSING__").astype(str).tolist() + ["__UNKNOWN__"]
        encoder.fit(values)
        encoders[column] = encoder
    return encoders


def transform_with_label_encoders(
    df: pd.DataFrame,
    feature_cols: list[str],
    cat_cols: list[str],
    encoders: dict[str, LabelEncoder],
) -> pd.DataFrame:
    frame = df[feature_cols].copy()
    for column in cat_cols:
        values = df[column].fillna("__MISSING__").astype(str)
        allowed = set(encoders[column].classes_)
        safe_values = values.where(values.isin(allowed), "__UNKNOWN__")
        frame[column] = encoders[column].transform(safe_values)
    return frame


def train_lgbm_quantile_models(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_valid: pd.DataFrame,
    y_valid: pd.Series,
    cat_cols: list[str],
    quantiles: dict[str, float] | None = None,
    *,
    params: dict | None = None,
    n_estimators_max: int = MAX_BOOST_ROUNDS,
    early_stopping_rounds: int = EARLY_STOPPING_ROUNDS,
) -> dict[str, lgb.Booster]:
    import logging
    _logger = logging.getLogger("retrain.trainer")
    quantiles = quantiles or QUANTILES
    params = params or LGBM_BASE_PARAMS
    models: dict[str, lgb.Booster] = {}
    for name, alpha in quantiles.items():
        _logger.info("Training LGBM quantile=%s (alpha=%.2f)...", name, alpha)
        full_params = {
            **params,
            "objective": "quantile",
            "alpha": alpha,
            "metric": "quantile",
            "verbosity": -1,
            "n_jobs": -1,
            "subsample_freq": 1,
            "feature_pre_filter": False,
        }
        dtrain = lgb.Dataset(
            X_train,
            label=y_train,
            categorical_feature=cat_cols,
            free_raw_data=False,
        )
        dvalid = lgb.Dataset(
            X_valid,
            label=y_valid,
            categorical_feature=cat_cols,
            free_raw_data=False,
            reference=dtrain,
        )
        models[name] = lgb.train(
            full_params,
            dtrain,
            num_boost_round=n_estimators_max,
            valid_sets=[dvalid],
            callbacks=[
                lgb.early_stopping(early_stopping_rounds, verbose=False),
                lgb.log_evaluation(-1),
            ],
        )
    return models


def train_xgb_quantile_models(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_valid: pd.DataFrame,
    y_valid: pd.Series,
    quantiles: dict[str, float] | None = None,
    *,
    params: dict | None = None,
    n_estimators_max: int = MAX_BOOST_ROUNDS,
    early_stopping_rounds: int = EARLY_STOPPING_ROUNDS,
) -> dict[str, xgb.Booster]:
    import logging
    _logger = logging.getLogger("retrain.trainer")
    quantiles = quantiles or QUANTILES
    params = params or XGB_BASE_PARAMS
    dtrain = xgb.DMatrix(X_train, label=y_train, enable_categorical=True)
    dvalid = xgb.DMatrix(X_valid, label=y_valid, enable_categorical=True)
    models: dict[str, xgb.Booster] = {}
    for name, alpha in quantiles.items():
        _logger.info("Training XGB quantile=%s (alpha=%.2f)...", name, alpha)
        full_params = {
            **params,
            "objective": "reg:quantileerror",
            "quantile_alpha": alpha,
            "eval_metric": "quantile",
            "tree_method": "hist",
            "device": "cpu",
            "verbosity": 0,
        }
        models[name] = xgb.train(
            full_params,
            dtrain,
            num_boost_round=n_estimators_max,
            evals=[(dvalid, "val")],
            early_stopping_rounds=early_stopping_rounds,
            verbose_eval=False,
        )
    return models


def train_frozen_ensemble(
    split_bundle,
    feature_cols: list[str],
    cat_cols: list[str],
    num_cols: list[str],
    target_col: str,
) -> EnsembleArtifact:
    """Train the full frozen 07c ensemble on a SplitBundle."""
    import logging
    _logger = logging.getLogger("retrain.trainer")
    train_df = split_bundle.train_df
    val_df = split_bundle.val_df
    _logger.info("Starting ensemble training: %d train / %d val", len(train_df), len(val_df))

    # LightGBM matrices
    X_train_lgb = make_lgbm_frame(train_df, feature_cols, cat_cols)
    X_val_lgb = make_lgbm_frame(val_df, feature_cols, cat_cols)

    # XGBoost matrices (with label encoders)
    encoders = fit_label_encoders(train_df, cat_cols)
    X_train_xgb = transform_with_label_encoders(train_df, feature_cols, cat_cols, encoders)
    X_val_xgb = transform_with_label_encoders(val_df, feature_cols, cat_cols, encoders)

    lgbm_models = train_lgbm_quantile_models(
        X_train_lgb,
        train_df[target_col],
        X_val_lgb,
        val_df[target_col],
        cat_cols,
    )

    xgb_models = train_xgb_quantile_models(
        X_train_xgb,
        train_df[target_col],
        X_val_xgb,
        val_df[target_col],
    )
    _logger.info("Ensemble training complete")

    is_log_target = target_col == "price_egp_log"

    return EnsembleArtifact(
        xgb_models=xgb_models,
        lgbm_models=lgbm_models,
        label_encoders=encoders,
        weights=[0.55, 0.45],
        feature_cols=feature_cols,
        cat_cols=cat_cols,
        num_cols=num_cols,
        target_col=target_col,
        is_log_target=is_log_target,
    )
