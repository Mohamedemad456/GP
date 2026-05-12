"""
predictor.py — Thin prediction orchestrator.

Delegates to:
  - model_state   : model loading, validity checks, global state
  - confidence     : confidence label computation
  - intervals      : negotiation range computation
  - explainer      : SHAP price factors and warm-up
  - feature_builder: feature engineering
"""
import logging

import numpy as np
import pandas as pd

import app.services.model_state as _ms
from app.services.confidence import compute_confidence_label, car_mape_pct
from app.services.intervals import compute_negotiation_range
from app.services.explainer import compute_price_factors
from app.services.feature_builder import (
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
) -> dict:
    """Run the active model and return raw price predictions.

    Returns dict with keys: fair_price, lower_price, upper_price,
    model_version, framework.
    """
    if _ms.ACTIVE_MODELS is None:
        raise RuntimeError("No active model loaded. Call load_active_model() first.")

    df_features = build_features(
        make=make, model=model, year=year,
        mileage_km=mileage_km, transmission=transmission,
        fuel=fuel, location=location,
    )

    if _ms.ACTIVE_IS_QUANTILE:
        return _predict_quantile(df_features)
    else:
        return _predict_single(df_features)


def predict_full(
    make: str,
    model: str,
    year: int,
    mileage_km: float | None = None,
    transmission: str | None = None,
    fuel: str | None = None,
    location: str | None = None,
    include_factors: bool = False,
) -> dict:
    """Full prediction pipeline: price + confidence + negotiation range + optional factors.

    Returns dict with keys:
      fair_price, negotiation_range, confidence, model_version, framework,
      raw_lower_price, raw_upper_price, price_factors (optional).
    """
    raw = predict_price(
        make=make, model=model, year=year,
        mileage_km=mileage_km, transmission=transmission,
        fuel=fuel, location=location,
    )

    confidence = compute_confidence_label(
        make=make, model=model, prediction=raw,
    )

    min_price, max_price = compute_negotiation_range(
        fair_price=raw["fair_price"],
        confidence=confidence,
        mape_pct=car_mape_pct(make, model),
    )

    factors = None
    if include_factors:
        factors = compute_price_factors(
            make=make, model=model, year=year,
            mileage_km=mileage_km, transmission=transmission,
            fuel=fuel, location=location,
        )

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

def _predict_quantile(df_features: pd.DataFrame) -> dict:
    """Predict using a quantile model dict {lower, median, upper}."""
    if _ms.ACTIVE_FRAMEWORK == 'XGBoost':
        df_prepared = prepare_for_xgboost(df_features)
        import xgboost as xgb
        dm = xgb.DMatrix(df_prepared)
        preds = {q: float(m.predict(dm)[0]) for q, m in _ms.ACTIVE_MODELS.items()}
    elif _ms.ACTIVE_FRAMEWORK == 'LightGBM':
        df_prepared = prepare_for_lightgbm(df_features)
        preds = {q: float(m.predict(df_prepared)[0]) for q, m in _ms.ACTIVE_MODELS.items()}
    else:
        try:
            df_prepared = prepare_for_xgboost(df_features)
            import xgboost as xgb
            dm = xgb.DMatrix(df_prepared)
            preds = {q: float(m.predict(dm)[0]) for q, m in _ms.ACTIVE_MODELS.items()}
        except Exception:
            df_prepared = prepare_for_lightgbm(df_features)
            preds = {q: float(m.predict(df_prepared)[0]) for q, m in _ms.ACTIVE_MODELS.items()}

    logger.debug("Raw predictions: %s", preds)

    if _ms.ACTIVE_IS_LOG_TARGET:
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

    model_version = _ms.get_active_model_version()

    return {
        'fair_price': fair_price,
        'lower_price': lower_price,
        'upper_price': upper_price,
        'model_version': model_version,
        'framework': _ms.ACTIVE_FRAMEWORK,
    }


def _predict_single(df_features: pd.DataFrame) -> dict:
    """Predict using a single sklearn-style model.

    Produces a point estimate and derives a ±15% negotiation range
    since there are no quantile bounds.
    """
    if _ms.ACTIVE_FRAMEWORK == 'sklearn':
        df_raw = df_features.copy()
        current_year = pd.Timestamp.now().year
        df_raw['car_age'] = current_year - df_raw['year']
        pred_log = float(_ms.ACTIVE_MODELS.predict(df_raw)[0])
    elif _ms.ACTIVE_FRAMEWORK == 'XGBoost':
        df_prepared = prepare_for_xgboost(df_features)
        import xgboost as xgb
        dm = xgb.DMatrix(df_prepared)
        pred_log = float(_ms.ACTIVE_MODELS.predict(dm)[0])
    elif _ms.ACTIVE_FRAMEWORK == 'LightGBM':
        df_prepared = prepare_for_lightgbm(df_features)
        pred_log = float(_ms.ACTIVE_MODELS.predict(df_prepared)[0])
    else:
        try:
            df_raw = df_features.copy()
            current_year = pd.Timestamp.now().year
            df_raw['car_age'] = current_year - df_raw['year']
            pred_log = float(_ms.ACTIVE_MODELS.predict(df_raw)[0])
        except Exception:
            df_prepared = prepare_for_xgboost(df_features)
            pred_log = float(_ms.ACTIVE_MODELS.predict(df_prepared)[0])

    fair_price = float(np.exp(pred_log)) if _ms.ACTIVE_IS_LOG_TARGET else float(pred_log)
    lower_price = fair_price * 0.85
    upper_price = fair_price * 1.15

    model_version = _ms.get_active_model_version()

    return {
        'fair_price': fair_price,
        'lower_price': lower_price,
        'upper_price': upper_price,
        'model_version': model_version,
        'framework': _ms.ACTIVE_FRAMEWORK,
    }
