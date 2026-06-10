"""Schema and quality validation for incoming training data."""

from __future__ import annotations

import pandas as pd

from scripts.retrain.constants import CAT_COLS, FEATURE_COLS, NUM_COLS


class ValidationError(Exception):
    """Raised when incoming data fails retrain validation."""


REQUIRED_COLS = FEATURE_COLS + ["price_egp", "price_egp_log"]
MIN_ROWS = 100


def validate_dataframe(df: pd.DataFrame, target_col: str = "price_egp_log") -> None:
    """Validate that *df* is ready for the frozen V1 retrain recipe.

    Raises:
        ValidationError: on any critical issue.
    """
    errors: list[str] = []

    # 1. Required columns
    missing = [c for c in REQUIRED_COLS if c not in df.columns]
    if missing:
        errors.append(f"Missing required columns: {missing}")

    # 2. Target availability
    if target_col not in df.columns:
        errors.append(f"Target column '{target_col}' not found")
    elif df[target_col].isna().sum() > len(df) * 0.05:
        errors.append(f"Target '{target_col}' has >5% missing values")

    # 3. Minimum rows
    if len(df) < MIN_ROWS:
        errors.append(f"Dataset has {len(df)} rows; minimum required is {MIN_ROWS}")

    # 4. Critical NaNs in feature columns
    for col in FEATURE_COLS:
        if col not in df.columns:
            continue
        nan_pct = df[col].isna().mean()
        if nan_pct > 0.20:
            errors.append(f"Feature '{col}' has {nan_pct:.1%} missing values (>20%)")

    # 5. Numeric sanity
    for col in NUM_COLS:
        if col not in df.columns:
            continue
        if not pd.api.types.is_numeric_dtype(df[col]):
            errors.append(f"Numeric feature '{col}' is not numeric dtype")

    # 6. Categorical sanity
    for col in CAT_COLS:
        if col not in df.columns:
            continue
        n_unique = df[col].nunique(dropna=True)
        if n_unique < 2:
            errors.append(f"Categorical feature '{col}' has <2 unique values")

    if errors:
        raise ValidationError("; ".join(errors))
