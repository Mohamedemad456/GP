"""SHAP explainability, expert explanations, and market stats."""

from app.services.explainability.explainer import (
    warm_up_shap,
    compute_price_factors,
    ACTIVE_SHAP_EXPLAINER,
)
from app.services.explainability.ensemble_explainer import (
    init_ensemble_explainer,
    warm_up_ensemble_shap,
    compute_ensemble_price_factors,
    is_ensemble_explainer_ready,
)
from app.services.explainability.factor_expert import explain_factor
from app.services.explainability.market_stats import get_market_stats, bucket_against_quantiles

__all__ = [
    "warm_up_shap",
    "compute_price_factors",
    "ACTIVE_SHAP_EXPLAINER",
    "init_ensemble_explainer",
    "warm_up_ensemble_shap",
    "compute_ensemble_price_factors",
    "is_ensemble_explainer_ready",
    "explain_factor",
    "get_market_stats",
    "bucket_against_quantiles",
]
