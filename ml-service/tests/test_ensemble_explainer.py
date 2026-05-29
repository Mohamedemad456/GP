"""Tests for ensemble_explainer module.

These tests exercise the internal aggregation and weight-mapping logic
without requiring a live SHAP explainer or loaded model artifacts.
The SHAP-dependent paths are tested via the running service instead.
"""

import numpy as np
import pytest

from app.services.explainability.ensemble_explainer import (
    _map_weights_to_names,
    _robust_trim_index,
    is_ensemble_explainer_ready,
)


# ── _map_weights_to_names ──────────────────────────────────────────────────

class TestMapWeightsToNames:
    def test_standard_xgb_lgbm_weights(self):
        names, weights = _map_weights_to_names(
            weights=(0.4, 0.4, 0.2),
            base_model_names=["xgb", "lgbm"],
            artifact={},
        )
        assert names == ["xgb", "lgbm"]
        assert weights == pytest.approx((0.4, 0.4))

    def test_none_weights_equal_fallback(self):
        names, weights = _map_weights_to_names(
            weights=None,
            base_model_names=["xgb", "lgbm"],
            artifact={},
        )
        assert names == ["xgb", "lgbm"]
        assert weights == pytest.approx((0.5, 0.5))

    def test_single_sub_model(self):
        names, weights = _map_weights_to_names(
            weights=(0.4, 0.4, 0.2),
            base_model_names=["xgb"],
            artifact={},
        )
        assert names == ["xgb"]
        assert weights == pytest.approx((0.4,))

    def test_unknown_sub_model_appended_with_zero_weight(self):
        names, weights = _map_weights_to_names(
            weights=(0.4, 0.4, 0.2),
            base_model_names=["xgb", "lgbm", "catboost"],
            artifact={},
        )
        assert "catboost" in names
        idx = names.index("catboost")
        assert weights[idx] == 0.0


# ── _robust_trim_index ─────────────────────────────────────────────────────

class TestRobustTrimIndex:
    def test_trims_outlier(self):
        # Three predictions: 100, 110, 500 — 500 is the outlier
        idx = _robust_trim_index([100.0, 110.0, 500.0], [0.4, 0.4, 0.2])
        assert idx == 2

    def test_trims_low_outlier(self):
        # Three predictions: 10, 500, 520 — 10 is the outlier
        idx = _robust_trim_index([10.0, 500.0, 520.0], [0.4, 0.4, 0.2])
        assert idx == 0

    def test_close_predictions_still_trims_one(self):
        # Even close predictions, one still gets trimmed
        idx = _robust_trim_index([100.0, 101.0, 102.0], [0.4, 0.4, 0.2])
        assert idx is not None
        assert 0 <= idx < 3

    def test_two_models_returns_index(self):
        # With 2 models, still returns an index
        idx = _robust_trim_index([100.0, 200.0], [0.5, 0.5])
        assert idx is not None


# ── is_ensemble_explainer_ready ─────────────────────────────────────────────

class TestEnsembleExplainerReadiness:
    def test_not_ready_by_default(self):
        # Without init, should be False
        assert is_ensemble_explainer_ready() is False


# ── compute_ensemble_price_factors fallback ──────────────────────────────────

class TestEnsemblePriceFactorsFallback:
    def test_returns_none_when_not_ready(self):
        from app.services.explainability.ensemble_explainer import compute_ensemble_price_factors
        # Without init, should return None gracefully
        result = compute_ensemble_price_factors(
            make="Toyota", model="Corolla", year=2020,
        )
        assert result is None
