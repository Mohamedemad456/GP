import math
from typing import Optional


def _round_half_up_to_step(value: float, step: int) -> int:
    """Round a numeric value to the nearest multiple of step using half-up.

    Assumes step is a positive integer.
    """
    if step <= 0:
        raise ValueError("step must be positive")

    # Market prices are expected to be non-negative, but keep this symmetric.
    sign = -1 if value < 0 else 1
    abs_value = abs(float(value))
    return int(sign * step * math.floor((abs_value / step) + 0.5))


def egp_market_step(price_egp: float) -> int:
    """Return a market-friendly rounding step (EGP) based on price magnitude."""
    p = abs(float(price_egp))

    # Tuned to match product examples:
    # - 174,782 -> 175,000  (5k step)
    # - 1,062,928.75 -> 1,060,000 (10k step)
    if p < 200_000:
        return 5_000
    return 10_000


def round_egp_market_price(price_egp: Optional[float]) -> Optional[float]:
    """Round a price (EGP) into a market-friendly figure.

    Returns None if input is None or not finite.
    """
    if price_egp is None:
        return None

    try:
        price_f = float(price_egp)
    except Exception:
        return None

    if not math.isfinite(price_f):
        return None

    step = egp_market_step(price_f)
    return float(_round_half_up_to_step(price_f, step))
