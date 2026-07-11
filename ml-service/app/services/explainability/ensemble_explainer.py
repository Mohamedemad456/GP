"""
ensemble_explainer.py — SHAP explanation logic for ensemble models.

Additive module: does NOT replace explainer.py.  When the active model
is a single tree model (XGBoost / LightGBM), the original explainer is
still used.  This module is only invoked when ACTIVE_FRAMEWORK == "ensemble".

Strategy
--------
1. On startup, resolve the path-strings stored in the ensemble artifact's
   ``base_models`` dict into actual loaded model objects.
2. Build a ``shap.TreeExplainer`` for each tree-based sub-model (XGBoost,
   LightGBM).  Non-tree sub-models (e.g. Huber) are tracked but skipped
   for SHAP — their weight is redistributed proportionally among the
   explainable sub-models.
3. At request time, compute local SHAP values per explainable sub-model,
   then aggregate into a single ranked factor list using the ensemble
   weights.  If the ensemble uses Robust Average trimming, the trimmed
   sub-model's contribution is excluded from the aggregation so the
   explanation stays faithful to the actual prediction path.
4. Fallback: if *some* sub-model explainers fail, return best-effort
   factors from the remaining ones.  If *none* succeed, return None
   (prediction still works, just no factors).
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import numpy as np

import app.services.model.model_state as _ms
from app.core.model_registry import resolve_registry_path

logger = logging.getLogger(__name__)

# ── Cached ensemble explainer state ──────────────────────────────────────────

# Dict[str, shap.TreeExplainer]  — keyed by sub-model name (e.g. "xgb", "lgbm")
_ENSEMBLE_EXPLAINERS: dict[str, Any] = {}

# Dict[str, object]  — loaded sub-model objects keyed by name
_ENSEMBLE_SUB_MODELS: dict[str, Any] = {}

# Weights tuple from the ensemble artifact (e.g. (0.4, 0.4, 0.2))
_ENSEMBLE_WEIGHTS: tuple[float, ...] | None = None

# Ordered list of sub-model names matching the weights tuple order
_ENSEMBLE_WEIGHT_NAMES: list[str] | None = None

# Ensemble method string (e.g. "Robust Average")
_ENSEMBLE_METHOD: str | None = None

# Trim fraction used by Robust Average (default 0.2 from notebook)
_ROBUST_TRIM_FRACTION: float = 0.2

# Whether the ensemble explainer has been initialised successfully
_ENSEMBLE_EXPLAINER_READY: bool = False


# ── Internal helpers ─────────────────────────────────────────────────────────

def _resolve_sub_model_paths(base_models: dict[str, str]) -> dict[str, Path]:
    """Resolve path-strings in base_models to absolute Path objects."""
    resolved: dict[str, Path] = {}
    for name, path_str in base_models.items():
        p = resolve_registry_path(path_str)
        if p.exists():
            resolved[name] = p
        else:
            logger.warning("Ensemble sub-model path not found: %s → %s", name, p)
    return resolved


def _load_sub_models(resolved_paths: dict[str, Path]) -> dict[str, Any]:
    """Load joblib pickles for each resolved sub-model path."""
    loaded: dict[str, Any] = {}
    for name, path in resolved_paths.items():
        try:
            import joblib
            obj = joblib.load(path)
            loaded[name] = obj
            logger.info("Loaded ensemble sub-model '%s' from %s", name, path)
        except Exception as e:
            logger.warning("Failed to load ensemble sub-model '%s': %s", name, e)
    return loaded


def _build_explainers(sub_models: dict[str, Any]) -> dict[str, Any]:
    """Build shap.TreeExplainer for each tree-based sub-model."""
    explainers: dict[str, Any] = {}
    for name, model_obj in sub_models.items():
        # If sub-model is a quantile dict {lower, median, upper}, use median
        target = model_obj
        if isinstance(model_obj, dict) and "median" in model_obj:
            target = model_obj["median"]

        try:
            import shap
            explainer = shap.TreeExplainer(target)
            explainers[name] = explainer
            logger.info("Built SHAP TreeExplainer for ensemble sub-model '%s'", name)
        except Exception as e:
            logger.warning(
                "Could not build TreeExplainer for sub-model '%s': %s", name, e
            )
    return explainers


def _map_weights_to_names(
    weights: tuple[float, ...] | list[float] | None,
    base_model_names: list[str],
    artifact: dict,
) -> tuple[list[str], tuple[float, ...]]:
    """Map the weights tuple to sub-model names.

    The ensemble artifact stores weights as (xgb_w, lgbm_w, huber_w).
    The base_models dict only contains tree models (xgb, lgbm).
    We need to know which weight corresponds to which name.

    Convention from notebook 06:
      weights = (xgb_weight, lgbm_weight, huber_weight)
      base_models keys are 'xgb' and 'lgbm'
    """
    if weights is None:
        # Equal weight fallback
        n = len(base_model_names)
        return base_model_names, tuple(1.0 / n for _ in range(n))

    weights_list = list(weights)
    # Standard order from the notebook: xgb, lgbm, huber
    standard_order = ["xgb", "lgbm", "huber"]
    name_to_weight: dict[str, float] = {}
    for i, w in enumerate(weights_list):
        if i < len(standard_order):
            name_to_weight[standard_order[i]] = float(w)
        else:
            break

    # Only include names that are actually in base_model_names
    ordered_names = [n for n in standard_order if n in base_model_names]
    ordered_weights = tuple(name_to_weight.get(n, 0.0) for n in ordered_names)

    # If some base_model_names are not in standard_order, append them with 0 weight
    for n in base_model_names:
        if n not in ordered_names:
            ordered_names.append(n)
            ordered_weights = ordered_weights + (0.0,)

    return ordered_names, ordered_weights


def _robust_trim_index(
    predictions: list[float],
    weights: list[float],
    trim_fraction: float = _ROBUST_TRIM_FRACTION,
) -> int | None:
    """Determine which sub-model index is trimmed by Robust Average.

    For 3 models with trim_fraction=0.2, n_trim = max(1, int(3*0.2)) = 1.
    The model whose prediction is the most extreme outlier (furthest from
    weighted mean) gets trimmed.

    Returns the index of the trimmed model, or None if no trimming occurs.
    """
    n = len(predictions)
    n_trim = max(1, int(n * trim_fraction))
    if n_trim == 0 or n <= 2:
        # With 2 models, trimming 1 leaves 1 which is just that model's prediction
        # For robust average with 3 models, we trim 1
        pass

    weighted_mean = sum(p * w for p, w in zip(predictions, weights)) / max(sum(weights), 1e-9)
    deviations = [abs(p - weighted_mean) for p in predictions]

    # The most extreme prediction gets trimmed
    trim_idx = int(np.argmax(deviations))
    return trim_idx


# ── Public API ───────────────────────────────────────────────────────────────

def init_ensemble_explainer() -> bool:
    """Initialise the ensemble explainer at startup.

    Loads sub-model pickles, builds TreeExplainers, and caches weights.
    Returns True if at least one sub-model explainer was built.
    Should be called after load_active_model().
    """
    global _ENSEMBLE_EXPLAINERS, _ENSEMBLE_SUB_MODELS
    global _ENSEMBLE_WEIGHTS, _ENSEMBLE_WEIGHT_NAMES, _ENSEMBLE_METHOD
    global _ENSEMBLE_EXPLAINER_READY

    _ENSEMBLE_EXPLAINERS.clear()
    _ENSEMBLE_SUB_MODELS.clear()
    _ENSEMBLE_WEIGHTS = None
    _ENSEMBLE_WEIGHT_NAMES = None
    _ENSEMBLE_METHOD = None
    _ENSEMBLE_EXPLAINER_READY = False

    if _ms.ACTIVE_FRAMEWORK != "ensemble":
        return False

    if _ms.ACTIVE_MODELS is None:
        return False

    artifact = _ms.ACTIVE_MODELS
    if not isinstance(artifact, dict) or "base_models" not in artifact:
        logger.warning("Ensemble artifact missing 'base_models' key.")
        return False

    base_models_raw: dict[str, str] = artifact.get("base_models", {})
    if not base_models_raw:
        logger.warning("Ensemble artifact has empty 'base_models'.")
        return False

    _ENSEMBLE_METHOD = artifact.get("method", "Unknown")

    # Resolve paths and load sub-models
    resolved = _resolve_sub_model_paths(base_models_raw)
    if not resolved:
        logger.warning("No ensemble sub-model paths could be resolved.")
        return False

    sub_models = _load_sub_models(resolved)
    if not sub_models:
        logger.warning("No ensemble sub-models could be loaded.")
        return False

    _ENSEMBLE_SUB_MODELS = sub_models

    # Build explainers for tree-based sub-models
    explainers = _build_explainers(sub_models)
    if not explainers:
        logger.warning("No ensemble sub-model explainers could be built.")
        return False

    _ENSEMBLE_EXPLAINERS = explainers

    # Map weights to sub-model names
    raw_weights = artifact.get("weights")
    base_names = list(sub_models.keys())
    weight_names, weight_tuple = _map_weights_to_names(raw_weights, base_names, artifact)
    _ENSEMBLE_WEIGHT_NAMES = weight_names
    _ENSEMBLE_WEIGHTS = weight_tuple

    _ENSEMBLE_EXPLAINER_READY = True
    logger.info(
        "Ensemble explainer ready: method=%s, explainable_sub_models=%s, "
        "weight_names=%s, weights=%s",
        _ENSEMBLE_METHOD,
        list(explainers.keys()),
        weight_names,
        weight_tuple,
    )
    return True


def is_ensemble_explainer_ready() -> bool:
    """Return True if the ensemble explainer has been initialised."""
    return _ENSEMBLE_EXPLAINER_READY


def compute_ensemble_price_factors(
    *,
    make: str,
    model: str,
    year: int,
    mileage_km: float | None = None,
    transmission: str | None = None,
    fuel: str | None = None,
    location: str | None = None,
    top_k: int = 5,
    sub_model_predictions: dict[str, dict[str, float]] | None = None,
) -> list[dict] | None:
    """Compute SHAP-based price factors for an ensemble prediction.

    This mirrors ``explainer.compute_price_factors()`` but aggregates
    SHAP contributions across the ensemble's tree-based sub-models.

    Args:
        sub_model_predictions: optional dict mapping sub-model name to
            {lower, median, upper} predictions.  When provided and the
            ensemble method is Robust Average, the trimmed sub-model is
            excluded from the SHAP aggregation so the explanation stays
            faithful to the actual prediction path.

    Returns:
        list of dicts {factor, direction, description} or None on failure.
    """
    from app.services.prediction.feature_builder import (
        build_features, prepare_for_xgboost, prepare_for_lightgbm,
    )
    from app.services.explainability.factor_expert import explain_factor

    if not _ENSEMBLE_EXPLAINER_READY or not _ENSEMBLE_EXPLAINERS:
        return None

    try:
        df_features = build_features(
            make=make, model=model, year=year,
            mileage_km=mileage_km, transmission=transmission,
            fuel=fuel, location=location,
        )
        raw_row = df_features.iloc[0].to_dict()

        # Determine which sub-models are trimmed (for Robust Average)
        trimmed_name: str | None = None
        if (
            _ENSEMBLE_METHOD == "Robust Average"
            and sub_model_predictions is not None
            and len(sub_model_predictions) >= 3
        ):
            # Build aligned predictions list for trimming detection
            pred_list = []
            weight_list = []
            name_list = []
            for i, name in enumerate(_ENSEMBLE_WEIGHT_NAMES or []):
                if name in sub_model_predictions:
                    pred_list.append(sub_model_predictions[name].get("median", 0.0))
                    weight_list.append(
                        _ENSEMBLE_WEIGHTS[i] if _ENSEMBLE_WEIGHTS and i < len(_ENSEMBLE_WEIGHTS) else 0.0
                    )
                    name_list.append(name)
            if len(pred_list) >= 3:
                trim_idx = _robust_trim_index(pred_list, weight_list)
                if trim_idx is not None and trim_idx < len(name_list):
                    trimmed_name = name_list[trim_idx]
                    logger.debug(
                        "Robust Average trimmed sub-model: %s", trimmed_name
                    )

        # Compute SHAP per explainable sub-model
        per_model_shap: dict[str, np.ndarray] = {}
        per_model_cols: dict[str, list[str]] = {}
        per_model_baseline: dict[str, float | None] = {}

        for name, explainer in _ENSEMBLE_EXPLAINERS.items():
            # Skip trimmed sub-model for faithful explanation
            if name == trimmed_name:
                continue

            sub_obj = _ENSEMBLE_SUB_MODELS.get(name)
            if sub_obj is None:
                continue

            # Determine framework for this sub-model
            is_xgb = "xgb" in name.lower() or "xgboost" in name.lower()
            is_lgbm = "lgbm" in name.lower() or "lightgbm" in name.lower()

            if is_xgb:
                X = prepare_for_xgboost(df_features)
            elif is_lgbm:
                X = prepare_for_lightgbm(df_features)
            else:
                # Default to XGBoost preparation
                X = prepare_for_xgboost(df_features)

            shap_values = explainer.shap_values(X)
            if isinstance(shap_values, list) and len(shap_values) > 0:
                shap_values = shap_values[0]

            shap_arr = np.asarray(shap_values)
            shap_row = shap_arr[0] if shap_arr.ndim == 2 else shap_arr

            per_model_shap[name] = shap_row
            per_model_cols[name] = list(X.columns)

            baseline = getattr(explainer, "expected_value", None)
            try:
                if isinstance(baseline, (list, tuple, np.ndarray)):
                    baseline = float(np.asarray(baseline).ravel()[0])
                elif baseline is not None:
                    baseline = float(baseline)
            except Exception:
                baseline = None
            per_model_baseline[name] = baseline

        if not per_model_shap:
            logger.warning("No SHAP values computed for any ensemble sub-model.")
            return None

        # Aggregate SHAP contributions across sub-models
        # Use a common feature set (union of all columns, aligned by name)
        all_cols_set: set[str] = set()
        for cols in per_model_cols.values():
            all_cols_set.update(cols)
        all_cols = sorted(all_cols_set)

        # Get effective weights (redistribute trimmed weight)
        effective_weights: dict[str, float] = {}
        total_w = 0.0
        for i, name in enumerate(_ENSEMBLE_WEIGHT_NAMES or []):
            if name in per_model_shap:
                w = _ENSEMBLE_WEIGHTS[i] if _ENSEMBLE_WEIGHTS and i < len(_ENSEMBLE_WEIGHTS) else 1.0
                effective_weights[name] = float(w)
                total_w += float(w)

        # Normalise weights to sum to 1
        if total_w > 0:
            for name in effective_weights:
                effective_weights[name] /= total_w

        # Weighted average of SHAP values per feature
        agg_shap: dict[str, float] = {col: 0.0 for col in all_cols}
        for name, shap_row in per_model_shap.items():
            w = effective_weights.get(name, 0.0)
            cols = per_model_cols[name]
            for i, col in enumerate(cols):
                if col in agg_shap:
                    agg_shap[col] += float(shap_row[i]) * w

        # Rank by absolute contribution, exclude make/model
        excluded = {"make", "model"}
        items = [(col, sv) for col, sv in agg_shap.items() if col not in excluded]
        items.sort(key=lambda t: abs(t[1]), reverse=True)
        items = items[: max(1, int(top_k))]

        # Build factor dicts using factor_expert
        val_row = df_features.iloc[0].to_dict()

        factors: list[dict] = []
        for col, sv in items:
            direction = "positive" if sv >= 0 else "negative"
            display_val = raw_row.get(col)
            if display_val is None or (isinstance(display_val, float) and np.isnan(display_val)):
                display_val = val_row.get(col)

            try:
                expert = explain_factor(
                    factor=col,
                    value=display_val,
                    direction=direction,
                    make=raw_row.get("make"),
                    model=raw_row.get("model"),
                    raw_row=raw_row,
                )
                desc = expert.get("description") or ""
            except Exception as e:
                logger.warning("Expert explanation failed for %s: %s", col, e)
                pretty_name = str(col).replace("_", " ").strip()
                desc = (
                    f"{pretty_name} influences the estimated market value. "
                    f"The model treats this as {'price-supportive' if direction == 'positive' else 'less price-supportive'}."
                )

            factors.append({
                "factor": col,
                "direction": direction,
                "description": desc,
            })

        return factors

    except Exception as e:
        logger.warning("Failed to compute ensemble SHAP price factors: %s", e)
        return None


def warm_up_ensemble_shap() -> bool:
    """Run a real SHAP explanation at startup for the ensemble.

    Exercises the full compute_ensemble_price_factors() path.
    Returns True if warm-up succeeded.
    """
    if not _ENSEMBLE_EXPLAINER_READY:
        logger.warning("Ensemble SHAP warm-up skipped: explainer not ready.")
        return False

    if not _ms.SUPPORT_COUNTS_MM:
        logger.warning("Ensemble SHAP warm-up skipped: no support counts loaded.")
        return False

    sample_key = max(_ms.SUPPORT_COUNTS_MM, key=_ms.SUPPORT_COUNTS_MM.get)
    raw_make, raw_model = sample_key

    try:
        result = compute_ensemble_price_factors(
            make=raw_make, model=raw_model,
            year=2015, mileage_km=80000,
        )
        if result is not None:
            logger.info("Ensemble SHAP warm-up completed successfully.")
            return True
        else:
            logger.warning("Ensemble SHAP warm-up returned None.")
            return False
    except Exception as e:
        logger.warning("Ensemble SHAP warm-up failed: %s", e)
        return False
