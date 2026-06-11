"""Train / validation / test splitting that reproduces the 07c notebook behavior."""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

from scripts.retrain.constants import RANDOM_STATE, TEST_SIZE, VAL_FRACTION
from scripts.retrain.contracts import SplitBundle


def _build_price_bins(price: pd.Series, desired_bins: int = 10) -> pd.Series:
    series = pd.to_numeric(price, errors="coerce").fillna(price.median())
    for q in [desired_bins, 8, 6, 5, 4, 3]:
        try:
            bins = pd.qcut(series, q=q, duplicates="drop")
        except ValueError:
            continue
        codes = bins.cat.codes.astype(int)
        rare_codes = codes.value_counts()[codes.value_counts() < 2].index
        codes = codes.where(~codes.isin(rare_codes), -1)
        if codes.value_counts().min() >= 2:
            return codes
    return pd.Series(np.zeros(len(series), dtype=int), index=price.index)


def split_train_val(
    train_idx: np.ndarray,
    val_fraction: float = VAL_FRACTION,
    random_state: int = RANDOM_STATE,
) -> tuple[np.ndarray, np.ndarray]:
    """Derive a validation set from the training indices (07c notebook style)."""
    rng = np.random.default_rng(random_state)
    val_size = max(1, int(len(train_idx) * val_fraction))
    val_idx = np.sort(rng.choice(train_idx, size=val_size, replace=False))
    train_only = np.array([idx for idx in train_idx if idx not in set(val_idx.tolist())])
    return train_only, val_idx


def build_primary_splits(
    df: pd.DataFrame,
    test_size: float = TEST_SIZE,
    random_state: int = RANDOM_STATE,
) -> dict[str, tuple[np.ndarray, np.ndarray]]:
    """Build both price_stratified and make_model_grouped splits."""
    idx_all = df.index.to_numpy()
    price_bins = _build_price_bins(df["price_egp"])

    tr_price, te_price = train_test_split(
        idx_all,
        test_size=test_size,
        random_state=random_state,
        stratify=price_bins,
    )

    groups = df["make"].fillna("UNKNOWN").astype(str) + "__" + df["model"].fillna("UNKNOWN").astype(str)
    from sklearn.model_selection import GroupShuffleSplit

    splitter = GroupShuffleSplit(n_splits=1, test_size=test_size, random_state=random_state)
    tr_group_i, te_group_i = next(splitter.split(df, groups=groups))
    tr_group = df.index[tr_group_i].to_numpy()
    te_group = df.index[te_group_i].to_numpy()

    return {
        "price_stratified": (tr_price, te_price),
        "make_model_grouped": (tr_group, te_group),
    }


def split_for_training(
    df: pd.DataFrame,
    split_name: str = "price_stratified",
    val_fraction: float = VAL_FRACTION,
    random_state: int = RANDOM_STATE,
) -> SplitBundle:
    """Return train/val/test dataframes matching the 07c notebook split strategy."""
    splits = build_primary_splits(df, random_state=random_state)
    if split_name not in splits:
        raise ValueError(f"Unknown split name: {split_name}. Available: {list(splits.keys())}")

    train_idx, test_idx = splits[split_name]
    train_idx, val_idx = split_train_val(train_idx, val_fraction=val_fraction, random_state=random_state)

    return SplitBundle(
        train_df=df.loc[train_idx].copy(),
        val_df=df.loc[val_idx].copy(),
        test_df=df.loc[test_idx].copy(),
    )
