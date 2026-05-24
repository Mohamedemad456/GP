"""market_stats.py

Optional, lightweight market statistics used to make explanations more concrete.

Design goals:
- Deterministic and offline (no network calls).
- Fast: loads a small CSV once and caches results.
- Best-effort: if data is missing or invalid, explanations still work.

We intentionally keep the stats high-level (quantile buckets) so we don't expose
training data details or any currency amounts.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from functools import lru_cache

import numpy as np
import pandas as pd

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Quantiles:
    p25: float
    p50: float
    p75: float
    p90: float


@dataclass(frozen=True)
class MarketStats:
    year: Quantiles | None
    mileage_km: Quantiles | None
    mileage_per_year: Quantiles | None
    engine_cc: Quantiles | None
    horsepower: Quantiles | None


def _safe_quantiles(series: pd.Series) -> Quantiles | None:
    s = pd.to_numeric(series, errors="coerce").dropna()
    if len(s) < 50:
        return None
    try:
        q = s.quantile([0.25, 0.50, 0.75, 0.90])
        return Quantiles(
            p25=float(q.loc[0.25]),
            p50=float(q.loc[0.50]),
            p75=float(q.loc[0.75]),
            p90=float(q.loc[0.90]),
        )
    except Exception:
        return None


@lru_cache(maxsize=1)
def get_market_stats() -> MarketStats:
    """Load cached market stats from `data/processed/processed_data.csv`.

    Returns a MarketStats object with optional quantiles. If the file is missing
    or unreadable, all fields will be None.
    """

    path = settings.processed_data_path
    if not path.exists():
        logger.info("Market stats skipped; processed dataset not found at %s", path)
        return MarketStats(None, None, None, None, None)

    usecols = [
        "year",
        "mileage_km",
        "mileage_per_year",
        "engine_cc",
        "horsepower",
    ]

    try:
        df = pd.read_csv(path, usecols=lambda c: c in set(usecols))
    except Exception as e:
        logger.warning("Market stats load failed: %s", e)
        return MarketStats(None, None, None, None, None)

    def col_q(col: str) -> Quantiles | None:
        if col not in df.columns:
            return None
        return _safe_quantiles(df[col])

    # Coerce absurd values away (best-effort sanity)
    for col in ["mileage_km", "mileage_per_year", "engine_cc", "horsepower"]:
        if col in df.columns:
            df.loc[~np.isfinite(pd.to_numeric(df[col], errors="coerce")), col] = np.nan

    return MarketStats(
        year=col_q("year"),
        mileage_km=col_q("mileage_km"),
        mileage_per_year=col_q("mileage_per_year"),
        engine_cc=col_q("engine_cc"),
        horsepower=col_q("horsepower"),
    )


def bucket_against_quantiles(value: float | int | None, q: Quantiles | None) -> str | None:
    """Convert a numeric value into a high-level bucket relative to quantiles.

    Returns one of: very_low, low, typical, high, very_high.
    Returns None if value/q is not available.
    """

    if value is None or q is None:
        return None
    try:
        v = float(value)
    except Exception:
        return None

    if not np.isfinite(v):
        return None

    if v <= q.p25:
        return "low"
    if v <= q.p50:
        return "typical"
    if v <= q.p75:
        return "high"
    if v <= q.p90:
        return "very_high"
    return "very_high"
