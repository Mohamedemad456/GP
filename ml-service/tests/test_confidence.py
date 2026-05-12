import pytest

from app.services.confidence import confidence_label_from_signals


@pytest.mark.parametrize(
    "mape,n_support,width_pct,is_quantile,expected",
    [
        (13.0, 50, 0.4, True, "high"),
        (15.0, 50, 0.4, True, "medium"),
        (19.0, 50, 0.4, True, "low"),
        (None, 50, 0.4, True, "medium"),
    ],
)
def test_confidence_base_mape(mape, n_support, width_pct, is_quantile, expected):
    assert (
        confidence_label_from_signals(
            mape_pct=mape,
            n_support=n_support,
            width_pct=width_pct,
            is_quantile=is_quantile,
        )
        == expected
    )


def test_confidence_low_support_forces_low():
    assert (
        confidence_label_from_signals(
            mape_pct=13.0,
            n_support=4,
            width_pct=0.2,
            is_quantile=True,
        )
        == "low"
    )


def test_confidence_wide_interval_degrades():
    # Start high, degrade by wide interval
    assert (
        confidence_label_from_signals(
            mape_pct=13.0,
            n_support=100,
            width_pct=1.1,
            is_quantile=True,
        )
        == "medium"
    )


def test_confidence_extremely_wide_interval_forces_low():
    assert (
        confidence_label_from_signals(
            mape_pct=13.0,
            n_support=100,
            width_pct=1.6,
            is_quantile=True,
        )
        == "low"
    )
