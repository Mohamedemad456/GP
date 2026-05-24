"""
intervals.py — Product-safe negotiation range computation.

Computes the negotiation_range field for the API response using
MAPE-based confidence bands instead of raw quantile outputs.

Raw quantile outputs (lower_price / upper_price) remain available
internally for monitoring and confidence scoring but are NOT exposed
in the default API response.
"""
import logging


logger = logging.getLogger(__name__)

# Confidence → width multiplier for MAPE-tiered bands
_CONFIDENCE_MULTIPLIERS = {
    "high": 1.00,
    "medium": 1.35,
    "low": 1.85,
}

# Fallback MAPE % if model metadata unavailable (conservative)
_DEFAULT_MAPE_PCT = 15.0

# Minimum band percentages by confidence tier
_MIN_BAND = {
    "high": 0.12,
    "medium": 0.18,
    "low": 0.25,
}


def compute_negotiation_range(
    fair_price: float,
    confidence: str,
    mape_pct: float | None = None,
) -> tuple[float, float]:
    """Compute a product-safe MAPE-tiered negotiation range.

    Formula: [fair × (1 − α), fair × (1 + α)]
    where α = (mape_pct / 100) × confidence_multiplier,
    floored at a minimum band per tier.

    Returns (min_price, max_price).
    """
    effective_mape = mape_pct if mape_pct is not None else _DEFAULT_MAPE_PCT
    multiplier = _CONFIDENCE_MULTIPLIERS.get(confidence, 1.85)
    min_band = _MIN_BAND.get(confidence, 0.25)

    alpha = max((effective_mape / 100.0) * multiplier, min_band)

    min_price = max(0.0, fair_price * (1.0 - alpha))
    max_price = fair_price * (1.0 + alpha)
    return min_price, max_price


def raw_interval_width_pct(
    lower_price: float,
    fair_price: float,
    upper_price: float,
) -> float:
    """Compute raw quantile interval width as a fraction of fair price.

    Used internally for confidence scoring and monitoring.
    """
    denom = max(fair_price, 1.0)
    return (upper_price - lower_price) / denom
