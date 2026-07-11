"""Prediction, ensemble blending, and serving compatibility helpers."""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
import xgboost as xgb

from scripts.retrain.constants import SERVING_ALIASES
from scripts.retrain.trainer import make_lgbm_frame, transform_with_label_encoders


def predict_lgbm_quantiles(models: dict[str, Any], X: pd.DataFrame) -> dict[str, np.ndarray]:
    return {name: np.asarray(model.predict(X), dtype=float) for name, model in models.items()}


def predict_xgb_quantiles(models: dict[str, Any], X: pd.DataFrame) -> dict[str, np.ndarray]:
    dmatrix = xgb.DMatrix(X, enable_categorical=True)
    return {name: np.asarray(model.predict(dmatrix), dtype=float) for name, model in models.items()}


def blend_prediction_maps(
    pred_maps: list[dict[str, np.ndarray]],
    weights: list[float] | None = None,
) -> dict[str, np.ndarray]:
    if not pred_maps:
        raise ValueError("pred_maps must not be empty")
    weights = weights or [1.0 / len(pred_maps)] * len(pred_maps)
    keys = pred_maps[0].keys()
    return {
        key: sum(weight * np.asarray(pred_map[key], dtype=float) for weight, pred_map in zip(weights, pred_maps))
        for key in keys
    }


def add_serving_aliases(pred_map: dict[str, np.ndarray]) -> dict[str, np.ndarray]:
    """Add lower/median/upper aliases to a 5-quantile prediction map.

    Returns a new dict with both the original quantile keys and the serving aliases.
    """
    out = dict(pred_map)
    for alias, original in SERVING_ALIASES.items():
        if original in out:
            out[alias] = out[original]
    return out


def normalize_quantile_predictions(preds: dict[str, Any]) -> dict[str, Any]:
    """Runtime helper: accept either legacy or 5-quantile keys and return a normalized dict.

    This is useful for the serving layer to safely consume both old and new artifacts.
    """
    out: dict[str, Any] = {}
    # Direct copies
    for key in preds:
        out[key] = preds[key]

    # Ensure aliases exist
    for alias, original in SERVING_ALIASES.items():
        if original in out and alias not in out:
            out[alias] = out[original]

    # Also map legacy -> new if needed
    reverse_aliases = {v: k for k, v in SERVING_ALIASES.items()}
    for legacy, new in reverse_aliases.items():
        if legacy in out and new not in out:
            out[new] = out[legacy]

    return out


def predict_ensemble(
    artifact,
    df: pd.DataFrame,
    target_col: str,
) -> dict[str, np.ndarray]:
    """Run the full ensemble prediction pipeline on *df*."""
    feature_cols = artifact.feature_cols
    cat_cols = artifact.cat_cols
    encoders = artifact.label_encoders

    # Prepare matrices
    X_lgb = make_lgbm_frame(df, feature_cols, cat_cols)
    X_xgb = transform_with_label_encoders(df, feature_cols, cat_cols, encoders)

    # Predict each framework
    lgbm_preds = predict_lgbm_quantiles(artifact.lgbm_models, X_lgb)
    xgb_preds = predict_xgb_quantiles(artifact.xgb_models, X_xgb)

    # Blend
    ensemble_preds = blend_prediction_maps(
        [xgb_preds, lgbm_preds],
        weights=artifact.weights,
    )

    # Add serving aliases
    return add_serving_aliases(ensemble_preds)
