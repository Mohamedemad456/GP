"""
predictor.py — Thin prediction orchestrator.

Delegates to:
  - model_state        : model loading, validity checks, global state
  - confidence         : confidence label computation
  - intervals          : negotiation range computation
  - explainer          : SHAP price factors and warm-up (single tree models)
  - ensemble_explainer : SHAP price factors for ensemble models
  - feature_builder    : feature engineering
"""
import logging
from typing import Any

import numpy as np
import pandas as pd

import app.services.model.model_state as _ms
from app.services.model.model_state import ModelContext, _active_model_context
from app.services.model.confidence import compute_confidence_label, car_mape_pct
from app.services.model.intervals import compute_negotiation_range
from app.services.explainability.explainer import compute_price_factors
from app.services.explainability.ensemble_explainer import compute_ensemble_price_factors
from app.services.prediction.feature_builder import (
    build_features, prepare_for_xgboost, prepare_for_lightgbm,
)

logger = logging.getLogger(__name__)


# ── Public API ────────────────────────────────────────────────────────────────

def predict_price(
    make: str,
    model: str,
    year: int,
    mileage_km: float | None = None,
    transmission: str | None = None,
    fuel: str | None = None,
    location: str | None = None,
    context: ModelContext | None = None,
) -> dict:
    """Run a model and return raw price predictions.

    If ``context`` is provided, the prediction uses that model context
    instead of the global active model (useful for fallback routing).

    Returns dict with keys: fair_price, lower_price, upper_price,
    model_version, framework.
    """
    ctx = context if context is not None else _active_model_context()
    if ctx.models is None:
        raise RuntimeError("No model loaded. Call load_active_model() first.")

    df_features = build_features(
        make=make, model=model, year=year,
        mileage_km=mileage_km, transmission=transmission,
        fuel=fuel, location=location,
    )

    if ctx.framework == 'ensemble':
        return _predict_ensemble(df_features, ctx)
    elif ctx.is_quantile:
        return _predict_quantile(df_features, ctx)
    else:
        return _predict_single(df_features, ctx)


def predict_full(
    make: str,
    model: str,
    year: int,
    mileage_km: float | None = None,
    transmission: str | None = None,
    fuel: str | None = None,
    location: str | None = None,
    include_factors: bool = False,
    context: ModelContext | None = None,
    exact_combo_supported: bool = True,
) -> dict:
    """Full prediction pipeline: price + confidence + negotiation range + optional factors.

    If ``context`` is provided, the prediction uses that model context
    instead of the global active model (useful for fallback routing).

    ``exact_combo_supported`` should be ``False`` when the exact
    (make, model) combo is not in the model's training coverage,
    triggering one-step confidence degradation.

    Returns dict with keys:
      fair_price, negotiation_range, confidence, model_version, framework,
      raw_lower_price, raw_upper_price, price_factors (optional).
    """
    ctx = context if context is not None else _active_model_context()
    raw = predict_price(
        make=make, model=model, year=year,
        mileage_km=mileage_km, transmission=transmission,
        fuel=fuel, location=location,
        context=ctx,
    )

    confidence = compute_confidence_label(
        make=make, model=model, prediction=raw,
        is_quantile=ctx.is_quantile,
        exact_combo_supported=exact_combo_supported,
    )

    min_price, max_price = compute_negotiation_range(
        fair_price=raw["fair_price"],
        confidence=confidence,
        mape_pct=car_mape_pct(make, model),
    )

    factors = None
    # Price factors via SHAP are only available for the active model;
    # fallback contexts skip them to avoid explainer mismatch.
    if include_factors and context is None:
        if _ms.ACTIVE_FRAMEWORK == 'ensemble':
            sub_preds = raw.get("sub_model_predictions")
            factors = compute_ensemble_price_factors(
                make=make, model=model, year=year,
                mileage_km=mileage_km, transmission=transmission,
                fuel=fuel, location=location,
                sub_model_predictions=sub_preds,
            )
        else:
            factors = compute_price_factors(
                make=make, model=model, year=year,
                mileage_km=mileage_km, transmission=transmission,
                fuel=fuel, location=location,
            )
    elif include_factors and context is not None:
        logger.debug("Skipping price factors for fallback model context.")

    return {
        "fair_price": raw["fair_price"],
        "negotiation_range": {
            "min_price": min_price,
            "max_price": max_price,
        },
        "confidence": confidence,
        "price_factors": factors,
        "model_version": raw["model_version"],
        "framework": raw["framework"],
        "raw_lower_price": raw.get("lower_price"),
        "raw_upper_price": raw.get("upper_price"),
    }


# ── Internal prediction helpers ───────────────────────────────────────────────

def _predict_quantile(df_features: pd.DataFrame, ctx: ModelContext | None = None) -> dict:
    """Predict using a quantile model dict {lower, median, upper}."""
    c = ctx if ctx is not None else _active_model_context()
    if c.framework == 'XGBoost':
        df_prepared = prepare_for_xgboost(df_features)
        import xgboost as xgb
        dm = xgb.DMatrix(df_prepared)
        preds = {q: float(m.predict(dm)[0]) for q, m in c.models.items()}
    elif c.framework == 'LightGBM':
        df_prepared = prepare_for_lightgbm(df_features)
        preds = {q: float(m.predict(df_prepared)[0]) for q, m in c.models.items()}
    else:
        try:
            df_prepared = prepare_for_xgboost(df_features)
            import xgboost as xgb
            dm = xgb.DMatrix(df_prepared)
            preds = {q: float(m.predict(dm)[0]) for q, m in c.models.items()}
        except Exception:
            df_prepared = prepare_for_lightgbm(df_features)
            preds = {q: float(m.predict(df_prepared)[0]) for q, m in c.models.items()}

    logger.debug("Raw predictions: %s", preds)

    if c.is_log_target:
        logger.debug("Predictions are log-space; applying exp().")
        for key in preds:
            if preds[key] > 18:
                logger.warning("Prediction %s=%s exceeds safe log range; clipping", key, preds[key])
                preds[key] = 18
            elif preds[key] < -5:
                logger.warning("Prediction %s=%s below safe log range; clipping", key, preds[key])
                preds[key] = -5

        fair_price = float(np.exp(preds.get("median", 0.0)))
        lower_price = float(np.exp(preds.get("lower", np.log(max(fair_price, 1.0)))))
        upper_price = float(np.exp(preds.get("upper", np.log(max(fair_price, 1.0)))))
    else:
        fair_price = float(preds.get("median", 0.0))
        lower_price = float(preds.get("lower", fair_price))
        upper_price = float(preds.get("upper", fair_price))

        fair_price = max(fair_price, 0.0)
        lower_price = max(lower_price, 0.0)
        upper_price = max(upper_price, 0.0)

    # Enforce monotonicity
    lower_price = min(lower_price, fair_price)
    upper_price = max(upper_price, fair_price)

    return {
        'fair_price': fair_price,
        'lower_price': lower_price,
        'upper_price': upper_price,
        'model_version': c.model_version,
        'framework': c.framework,
    }


def _predict_ensemble(df_features: pd.DataFrame, ctx: ModelContext | None = None) -> dict:
    """Predict using an ensemble model (Robust Average / Weighted Average).

    The ensemble artifact stores base_models as path-strings.  We resolve
    and load them lazily on first call, then cache via model_state.

    Returns dict with keys: fair_price, lower_price, upper_price,
    model_version, framework, sub_model_predictions.
    """
    import joblib as _joblib
    from app.core.model_registry import resolve_registry_path as _resolve
    from app.services.explainability.ensemble_explainer import _ENSEMBLE_SUB_MODELS, _ENSEMBLE_WEIGHT_NAMES, _ENSEMBLE_WEIGHTS, _ENSEMBLE_METHOD

    c = ctx if ctx is not None else _active_model_context()
    artifact = c.models
    base_models_raw = artifact.get("base_models", {})
    method = artifact.get("method", "Unknown")
    raw_weights = artifact.get("weights")

    # For active model: use global lazy-loaded cache.
    # For fallback context: load sub-models fresh into local dict.
    use_global_cache = ctx is None
    if use_global_cache:
        sub_models: dict[str, Any] = dict(_ENSEMBLE_SUB_MODELS)
        if not sub_models:
            for name, path_str in base_models_raw.items():
                p = _resolve(path_str)
                if p.exists():
                    try:
                        sub_models[name] = _joblib.load(p)
                        logger.info("Lazy-loaded ensemble sub-model '%s'", name)
                    except Exception as e:
                        logger.warning("Failed to lazy-load sub-model '%s': %s", name, e)
            if sub_models:
                _ENSEMBLE_SUB_MODELS.update(sub_models)
    else:
        sub_models = {}
        for name, path_str in base_models_raw.items():
            p = _resolve(path_str)
            if p.exists():
                try:
                    sub_models[name] = _joblib.load(p)
                except Exception as e:
                    logger.warning("Failed to load fallback sub-model '%s': %s", name, e)

    # Run each sub-model and collect quantile predictions
    sub_preds: dict[str, dict[str, float]] = {}
    for name, sub_obj in sub_models.items():
        is_xgb = "xgb" in name.lower() or "xgboost" in name.lower()
        is_lgbm = "lgbm" in name.lower() or "lightgbm" in name.lower()

        try:
            if isinstance(sub_obj, dict) and "median" in sub_obj:
                # Quantile sub-model {lower, median, upper}
                if is_xgb:
                    df_prepared = prepare_for_xgboost(df_features)
                    import xgboost as xgb
                    dm = xgb.DMatrix(df_prepared)
                    q_preds = {q: float(m.predict(dm)[0]) for q, m in sub_obj.items()}
                elif is_lgbm:
                    df_prepared = prepare_for_lightgbm(df_features)
                    q_preds = {q: float(m.predict(df_prepared)[0]) for q, m in sub_obj.items()}
                else:
                    df_prepared = prepare_for_xgboost(df_features)
                    import xgboost as xgb
                    dm = xgb.DMatrix(df_prepared)
                    q_preds = {q: float(m.predict(dm)[0]) for q, m in sub_obj.items()}
                sub_preds[name] = q_preds
            else:
                # Single-output sub-model (e.g. Huber)
                if is_xgb:
                    df_prepared = prepare_for_xgboost(df_features)
                    import xgboost as xgb
                    dm = xgb.DMatrix(df_prepared)
                    pred = float(sub_obj.predict(dm)[0])
                elif is_lgbm:
                    df_prepared = prepare_for_lightgbm(df_features)
                    pred = float(sub_obj.predict(df_prepared)[0])
                else:
                    # sklearn-style
                    df_raw = df_features.copy()
                    current_year = pd.Timestamp.now().year
                    df_raw['car_age'] = current_year - df_raw['year']
                    pred = float(sub_obj.predict(df_raw)[0])
                sub_preds[name] = {"median": pred}
        except Exception as e:
            logger.warning("Ensemble sub-model '%s' prediction failed: %s", name, e)

    if not sub_preds:
        raise RuntimeError("All ensemble sub-models failed to predict.")

    # Map weights to sub-model names
    if use_global_cache:
        weight_names = list(_ENSEMBLE_WEIGHT_NAMES or [])
        weights = list(_ENSEMBLE_WEIGHTS or [])
    else:
        weight_names = []
        weights = []

    # If weights/names not yet mapped, derive them
    if not weight_names or not weights:
        standard_order = ["xgb", "lgbm", "huber"]
        weight_names = [n for n in standard_order if n in sub_preds]
        if raw_weights:
            weight_map = {standard_order[i]: float(w) for i, w in enumerate(raw_weights) if i < len(standard_order)}
            weights = [weight_map.get(n, 0.0) for n in weight_names]
        else:
            n = len(weight_names)
            weights = [1.0 / n] * n

    # Ensure we only use sub-models that actually predicted
    weight_names = [n for n in weight_names if n in sub_preds]
    weights = [w for n, w in zip(weight_names, weights) if n in sub_preds]

    # Aggregate per quantile
    def _aggregate(q: str) -> float:
        preds_list = [sub_preds[n].get(q, sub_preds[n].get("median", 0.0)) for n in weight_names]
        if method == "Robust Average" and len(preds_list) >= 3:
            preds_arr = np.array(preds_list)
            n_models = preds_arr.shape[0]
            n_trim = max(1, int(n_models * 0.2))
            sorted_preds = np.sort(preds_arr)
            trimmed = sorted_preds[n_trim:n_models - n_trim]
            if trimmed.shape[0] == 0:
                return float(np.median(preds_arr))
            return float(np.mean(trimmed))
        else:
            # Weighted average fallback
            total_w = max(sum(weights), 1e-9)
            return float(sum(p * w for p, w in zip(preds_list, weights)) / total_w)

    fair_price = _aggregate("median")
    lower_price = _aggregate("lower") if any("lower" in p for p in sub_preds.values()) else fair_price * 0.85
    upper_price = _aggregate("upper") if any("upper" in p for p in sub_preds.values()) else fair_price * 1.15

    # Handle log-target sub-models
    if c.is_log_target:
        fair_price = float(np.exp(fair_price)) if fair_price < 18 else fair_price
        lower_price = float(np.exp(lower_price)) if lower_price < 18 else lower_price
        upper_price = float(np.exp(upper_price)) if upper_price < 18 else upper_price

    fair_price = max(fair_price, 0.0)
    lower_price = max(lower_price, 0.0)
    upper_price = max(upper_price, 0.0)

    # Enforce monotonicity
    lower_price = min(lower_price, fair_price)
    upper_price = max(upper_price, fair_price)

    return {
        'fair_price': fair_price,
        'lower_price': lower_price,
        'upper_price': upper_price,
        'model_version': c.model_version,
        'framework': c.framework,
        'sub_model_predictions': sub_preds,
    }


def _predict_single(df_features: pd.DataFrame, ctx: ModelContext | None = None) -> dict:
    """Predict using a single sklearn-style model.

    Produces a point estimate and derives a ±15% negotiation range
    since there are no quantile bounds.
    """
    c = ctx if ctx is not None else _active_model_context()
    if c.framework == 'sklearn':
        df_raw = df_features.copy()
        current_year = pd.Timestamp.now().year
        df_raw['car_age'] = current_year - df_raw['year']
        pred_log = float(c.models.predict(df_raw)[0])
    elif c.framework == 'XGBoost':
        df_prepared = prepare_for_xgboost(df_features)
        import xgboost as xgb
        dm = xgb.DMatrix(df_prepared)
        pred_log = float(c.models.predict(dm)[0])
    elif c.framework == 'LightGBM':
        df_prepared = prepare_for_lightgbm(df_features)
        pred_log = float(c.models.predict(df_prepared)[0])
    else:
        try:
            df_raw = df_features.copy()
            current_year = pd.Timestamp.now().year
            df_raw['car_age'] = current_year - df_raw['year']
            pred_log = float(c.models.predict(df_raw)[0])
        except Exception:
            df_prepared = prepare_for_xgboost(df_features)
            pred_log = float(c.models.predict(df_prepared)[0])

    fair_price = float(np.exp(pred_log)) if c.is_log_target else float(pred_log)
    lower_price = fair_price * 0.85
    upper_price = fair_price * 1.15

    return {
        'fair_price': fair_price,
        'lower_price': lower_price,
        'upper_price': upper_price,
        'model_version': c.model_version,
        'framework': c.framework,
    }
