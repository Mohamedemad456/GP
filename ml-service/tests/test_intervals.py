import pytest

from app.services.intervals import compute_negotiation_range


def test_high_confidence_band():
    min_p, max_p = compute_negotiation_range(fair_price=1_000_000, confidence="high", mape_pct=13.5)
    # band = max(13.5/100 * 1.0, 0.12) = 0.135
    assert min_p == pytest.approx(865_000, rel=1e-6)
    assert max_p == pytest.approx(1_135_000, rel=1e-6)


def test_medium_confidence_band():
    min_p, max_p = compute_negotiation_range(fair_price=1_000_000, confidence="medium", mape_pct=13.5)
    # band = max(13.5/100 * 1.35, 0.18) = max(0.18225, 0.18) = 0.18225
    assert min_p == pytest.approx(817_750, rel=1e-6)
    assert max_p == pytest.approx(1_182_250, rel=1e-6)


def test_low_confidence_band():
    min_p, max_p = compute_negotiation_range(fair_price=1_000_000, confidence="low", mape_pct=13.5)
    # band = max(13.5/100 * 1.85, 0.25) = max(0.24975, 0.25) = 0.25
    assert min_p == pytest.approx(750_000, rel=1e-6)
    assert max_p == pytest.approx(1_250_000, rel=1e-6)


def test_no_mape_uses_default():
    min_p, max_p = compute_negotiation_range(fair_price=1_000_000, confidence="high", mape_pct=None)
    # default mape = 15.0, band = max(15/100 * 1.0, 0.12) = 0.15
    assert min_p == pytest.approx(850_000, rel=1e-6)
    assert max_p == pytest.approx(1_150_000, rel=1e-6)


def test_min_price_non_negative():
    min_p, max_p = compute_negotiation_range(fair_price=100_000, confidence="low", mape_pct=50.0)
    # band = max(50/100 * 1.85, 0.25) = 0.925 → min = 100k * (1 - 0.925) = 7500
    assert min_p >= 0


def test_minimum_band_floor_high():
    """Very low MAPE should still hit the 12% floor for high confidence."""
    min_p, max_p = compute_negotiation_range(fair_price=500_000, confidence="high", mape_pct=5.0)
    # band = max(5/100 * 1.0, 0.12) = 0.12
    assert min_p == pytest.approx(440_000, rel=1e-6)
    assert max_p == pytest.approx(560_000, rel=1e-6)
