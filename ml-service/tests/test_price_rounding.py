import pytest

from app.core.price_rounding import egp_market_step, round_egp_market_price


@pytest.mark.parametrize(
    "price,expected",
    [
        (1062928.75, 1060000.0),
        (174782.078125, 175000.0),
        (172500.0, 175000.0),  # half-up
        (170000.0, 170000.0),
        (199999.0, 200000.0),
    ],
)
def test_round_egp_market_price_examples(price, expected):
    assert round_egp_market_price(price) == expected


def test_egp_market_step_threshold():
    assert egp_market_step(199999.0) == 5000
    assert egp_market_step(200000.0) == 10000
