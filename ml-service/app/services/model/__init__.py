"""Model loading, registry, confidence scoring, and interval computation."""

from app.services.model.model_state import (
    load_active_model,
    load_model_diagnostics,
    load_valid_cars,
    check_car_validity,
    is_model_loaded,
    is_diagnostics_loaded,
    get_active_model_version,
    ACTIVE_FRAMEWORK,
    ACTIVE_MODEL_ID,
    ACTIVE_MODELS,
    ACTIVE_IS_QUANTILE,
    VALID_CARS,
    SUPPORT_COUNTS_MM,
    SUPPORT_COUNTS_MAKE,
    MAKE_MODEL_MAPE,
    MAKE_MAPE,
)
from app.services.model.confidence import (
    compute_confidence_label,
    car_mape_pct,
    confidence_label_from_signals,
)
from app.services.model.intervals import compute_negotiation_range

__all__ = [
    "load_active_model",
    "load_model_diagnostics",
    "load_valid_cars",
    "check_car_validity",
    "is_model_loaded",
    "is_diagnostics_loaded",
    "get_active_model_version",
    "ACTIVE_FRAMEWORK",
    "ACTIVE_MODEL_ID",
    "ACTIVE_MODELS",
    "ACTIVE_IS_QUANTILE",
    "VALID_CARS",
    "SUPPORT_COUNTS_MM",
    "SUPPORT_COUNTS_MAKE",
    "MAKE_MODEL_MAPE",
    "MAKE_MAPE",
    "compute_confidence_label",
    "car_mape_pct",
    "confidence_label_from_signals",
    "compute_negotiation_range",
]
