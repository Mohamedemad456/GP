import pytest

from app.services.feature_builder import (
    _canonicalize,
    _normalize_transmission,
    _normalize_fuel,
    _validate_inputs,
)


def test_normalize_transmission_variants():
    assert _normalize_transmission("auto") == "Automatic"
    assert _normalize_transmission("Automatic") == "Automatic"
    assert _normalize_transmission("manual") == "Manual"
    assert _normalize_transmission("stick") == "Manual"
    assert _normalize_transmission(None) is None
    assert _normalize_transmission("CVT") == "CVT"  # unknown passes through


def test_normalize_fuel_variants():
    assert _normalize_fuel("petrol") == "petrol"
    assert _normalize_fuel("gasoline") == "petrol"
    assert _normalize_fuel("gas") == "petrol"
    assert _normalize_fuel("diesel") == "diesel"
    assert _normalize_fuel("hybrid") == "hybrid"
    assert _normalize_fuel("electric") == "electric"
    assert _normalize_fuel(None) is None


def test_validate_inputs_year_too_old():
    with pytest.raises(ValueError, match="year must be >= 1950"):
        _validate_inputs(year=1900, mileage_km=50000)


def test_validate_inputs_year_future():
    with pytest.raises(ValueError, match="year must be <="):
        _validate_inputs(year=2100, mileage_km=50000)


def test_validate_inputs_negative_mileage():
    with pytest.raises(ValueError, match="mileage_km must be >= 0"):
        _validate_inputs(year=2020, mileage_km=-100)


def test_validate_inputs_valid():
    _validate_inputs(year=2020, mileage_km=50000)  # no exception
