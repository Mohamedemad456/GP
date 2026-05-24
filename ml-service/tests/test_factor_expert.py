import re

from app.services.explainability.factor_expert import explain_factor


def _base_row(**overrides):
    row = {
        "make": "Toyota",
        "model": "Corolla",
        "year": 2018,
        "mileage_km": 85000,
        "mileage_per_year": 12000,
        "transmission": "Automatic",
        "fuel": "petrol",
        "location": "Cairo",
        "engine_cc": 1600,
        "horsepower": 120,
        "body_type": "Sedan",
        "drivetrain": "FWD",
        "seating_capacity": 5,
        "brand_origin": "japanese",
        "car_segment": "family",
    }
    row.update(overrides)
    return row


def test_no_currency_amounts_leak_into_description():
    row = _base_row()

    for factor in [
        "year",
        "mileage_km",
        "mileage_per_year",
        "transmission",
        "drivetrain",
        "engine_cc",
        "horsepower",
        "fuel",
        "body_type",
        "car_segment",
        "brand_origin",
        "location",
    ]:
        out = explain_factor(
            factor=factor,
            value=row.get(factor),
            direction="positive",
            make=row["make"],
            model=row["model"],
            raw_row=row,
        )
        desc = out["description"]
        assert "EGP" not in desc
        assert "£" not in desc


def test_direction_is_preserved_in_wording():
    row = _base_row(mileage_km=200000)

    pos = explain_factor(
        factor="mileage_km",
        value=row["mileage_km"],
        direction="positive",
        raw_row=row,
    )
    neg = explain_factor(
        factor="mileage_km",
        value=row["mileage_km"],
        direction="negative",
        raw_row=row,
    )

    assert pos["direction"] == "positive"
    assert neg["direction"] == "negative"
    # Descriptions are direction-agnostic; UI should rely on the `direction` field.
    assert "price-supportive" not in pos["description"].lower()
    assert "estimated market value" not in pos["description"].lower()
    assert "tends to increase" not in pos["description"].lower()
    assert "tends to decrease" not in pos["description"].lower()


def test_transmission_automatic_mentions_traffic_context():
    row = _base_row(transmission="Automatic")
    out = explain_factor(
        factor="transmission",
        value=row["transmission"],
        direction="positive",
        raw_row=row,
    )
    assert re.search(r"traffic", out["description"], flags=re.IGNORECASE)


def test_unknown_factor_falls_back_safely():
    row = _base_row()
    out = explain_factor(
        factor="some_new_feature",
        value="foo",
        direction="negative",
        raw_row=row,
    )
    assert out["factor"] == "some_new_feature"
    assert "some_new_feature" in out["description"]
    assert "price-supportive" not in out["description"].lower()


def test_engine_cc_ev_mentions_not_applicable():
    row = _base_row(fuel="electric")
    out = explain_factor(
        factor="engine_cc",
        value=row["engine_cc"],
        direction="negative",
        raw_row=row,
    )
    assert re.search(r"electric", out["description"], flags=re.IGNORECASE)
    assert re.search(r"not", out["description"], flags=re.IGNORECASE)
