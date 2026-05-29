"""
confidence.py — Confidence label computation.
Uses model MAPE, make+model support count, and interval width to classify
predictions as high / medium / low confidence.
"""
import logging
import app.services.model.model_state as _ms
logger = logging.getLogger(__name__)


#  Internal helpers 
def _pick_active_metrics_dict(meta: dict | None) -> dict | None:
    """Pick the best available metrics block from active model metadata."""
    if not isinstance(meta, dict):
        return None

    if _ms.ACTIVE_FRAMEWORK == "XGBoost" and isinstance(meta.get("test_metrics_xgb"), dict):
        return meta.get("test_metrics_xgb")
    if _ms.ACTIVE_FRAMEWORK == "LightGBM" and isinstance(meta.get("test_metrics_lgbm"), dict):
        return meta.get("test_metrics_lgbm")

    if isinstance(meta.get("test_metrics_xgb"), dict):
        return meta.get("test_metrics_xgb")
    if isinstance(meta.get("test_metrics_lgbm"), dict):
        return meta.get("test_metrics_lgbm")

    if isinstance(meta.get("metrics"), dict):
        return meta.get("metrics")

    return None


def _degrade_label(label: str) -> str:
    if label == "high":
        return "medium"
    if label == "medium":
        return "low"
    return "low"


#  Public API 

def active_mape_pct() -> float | None:
    """Return the active model's test MAPE percentage, or None if unavailable."""
    metrics = _pick_active_metrics_dict(_ms.ACTIVE_METADATA)
    if isinstance(metrics, dict) and "MAPE_pct" in metrics:
        try:
            return float(metrics["MAPE_pct"])
        except Exception:
            return None
    return None


def car_mape_pct(make: str, model: str) -> float | None:
    """Return per make-model MAPE, falling back to global active MAPE."""
    per_car = _ms.get_make_model_mape_pct(make, model)
    if per_car is not None:
        return per_car
    return active_mape_pct()


def confidence_label_from_signals(
    *,
    mape_pct: float | None,
    n_support: int | None,
    width_pct: float | None,
    is_quantile: bool,
) -> str:
    """Pure confidence function so it can be unit-tested easily.

    Parameters
    ----------
    mape_pct : per make-model MAPE (percentage), or None if unknown
    n_support : make+model row count in training data, or None
    width_pct : (upper - lower) / fair_price ratio, or None
    is_quantile : whether the active model is a quantile model

    When per-car MAPE ≤ 10 % ("excellent"), support-count and interval-width
    degradation thresholds are relaxed because the model has demonstrated
    accuracy for that specific car.
    """

    if mape_pct is None:
        label = "medium"
    elif mape_pct <= 14.0:
        label = "high"
    elif mape_pct <= 18.0:
        label = "medium"
    else:
        label = "low"

    # When per-car MAPE is excellent, soften degradation — the model has
    # demonstrated accuracy for this specific car, so generic heuristics
    # (support count, interval width) should carry less weight.
    excellent_mape = mape_pct is not None and mape_pct <= 10.0

    if n_support is not None:
        if n_support < 5:
            if excellent_mape:
                label = _degrade_label(label)      # one step, not hard "low"
            else:
                return "low"
        if n_support < 10:
            if not excellent_mape:
                label = _degrade_label(label)
        elif n_support < 20 and label == "high":
            if not excellent_mape:
                label = "medium"

    if is_quantile and width_pct is not None:
        if excellent_mape:
            # Proven accuracy → tolerate wider intervals
            if width_pct > 2.0:
                return "low"
            if width_pct > 1.5:
                label = _degrade_label(label)
        else:
            if width_pct > 1.5:
                return "low"
            if width_pct > 1.0:
                label = _degrade_label(label)

    return label


def compute_confidence_label(*, make: str, model: str, prediction: dict) -> str:
    """Compute a confidence label for a given request.

    Uses:
      - make+model MAPE diagnostics when available
      - active model global test MAPE as fallback
      - make+model support count from processed dataset
      - interval width (when available)
    """
    mk, md = _ms._norm_make_model(make, model)
    n_support = _ms.SUPPORT_COUNTS_MM.get((mk, md))

    fair = float(prediction.get("fair_price") or 0.0)
    lower = float(prediction.get("lower_price") or fair)
    upper = float(prediction.get("upper_price") or fair)
    denom = max(fair, 1.0)
    width_pct = (upper - lower) / denom

    return confidence_label_from_signals(
        mape_pct=car_mape_pct(make, model),
        n_support=int(n_support) if n_support is not None else None,
        width_pct=float(width_pct) if width_pct is not None else None,
        is_quantile=bool(_ms.ACTIVE_IS_QUANTILE),
    )
