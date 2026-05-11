"""
Feature builder for inference time.

Transforms raw API input (brand, model, year, mileage, etc.)
into a model-ready feature vector by:
    1. Joining with car_specs_lookup CSV (engine_cc, hp, body_type, etc.)
    2. Engineering derived features (mileage_per_year, etc.)
    3. Handling missing lookup matches gracefully
    4. Applying same preprocessing as training (label encoders, category dtype)

IMPORTANT: This module must stay in sync with the training notebook's
feature engineering. No `model_family` or `car_age` features are used.
"""
from __future__ import annotations

import pandas as pd
import numpy as np
from pathlib import Path
import joblib

from app.core.config import settings


# Feature columns — must match notebook 05 exactly
CAT_COLS = ['make', 'model', 'transmission', 'fuel', 'location',
            'body_type', 'drivetrain', 'brand_origin', 'car_segment']
NUM_COLS = ['year', 'mileage_km', 'mileage_per_year', 'engine_cc',
            'horsepower', 'seating_capacity']
FEATURE_COLS = NUM_COLS + CAT_COLS


def _load_lookup() -> pd.DataFrame:
    """Load the fixed car specs lookup file."""
    path = settings.lookup_dir / "car_specs_lookup_full_cleaned.fixed.csv"
    if not path.exists():
        raise FileNotFoundError(f"Lookup file not found: {path}")
    return pd.read_csv(path)


def _canonicalize_make_model(make: str, model: str) -> tuple[str, str]:
    """Apply basic canonicalization to make/model strings."""
    make = make.strip().title()
    model = model.strip().title()
    return make, model


def build_features(
    make: str,
    model: str,
    year: int,
    mileage_km: float | None = None,
    transmission: str | None = None,
    fuel: str | None = None,
    location: str | None = None,
) -> pd.DataFrame:
    """Build a single-row feature DataFrame for inference.

    Joins with the car specs lookup to fill in engine_cc, horsepower,
    body_type, drivetrain, seating_capacity, brand_origin, car_segment.
    Missing values from the API are filled from the lookup; remaining
    NaNs are filled with safe defaults.

    Returns a DataFrame with exactly the FEATURE_COLS columns.
    """
    make, model = _canonicalize_make_model(make, model)

    # Start with what we know from the API
    row: dict = {
        'make': make,
        'model': model,
        'year': int(year),
        'mileage_km': float(mileage_km) if mileage_km is not None else np.nan,
        'transmission': transmission,
        'fuel': fuel,
        'location': location,
    }

    # Join with lookup for specs
    lookup = _load_lookup()
    match = lookup[(lookup['make'] == make) & (lookup['model'] == model) & (lookup['year'] == year)]

    if len(match) > 0:
        spec = match.iloc[0]
        for col in ['engine_cc', 'horsepower', 'body_type', 'drivetrain',
                     'seating_capacity', 'brand_origin', 'car_segment',
                     'transmission', 'fuel']:
            if col not in row or row[col] is None:
                val = spec.get(col)
                if pd.notna(val):
                    row[col] = val

    # Compute derived features
    if pd.notna(row.get('mileage_km')) and year is not None:
        current_year = pd.Timestamp.now().year
        age = max(current_year - year, 1)
        row['mileage_per_year'] = row['mileage_km'] / age
    else:
        row['mileage_per_year'] = np.nan

    # Fill remaining NaNs with safe defaults
    defaults = {
        'engine_cc': 1500, 'horsepower': 100, 'seating_capacity': 5,
        'body_type': 'Sedan', 'drivetrain': 'FWD',
        'brand_origin': 'other', 'car_segment': 'family',
        'transmission': 'Manual', 'fuel': 'petrol', 'location': 'Cairo',
        'mileage_km': 50000, 'mileage_per_year': 10000,
    }
    for col, default in defaults.items():
        if col in FEATURE_COLS and (col not in row or row[col] is None or (isinstance(row[col], float) and np.isnan(row[col]))):
            row[col] = default

    # Build DataFrame with exact column order
    df = pd.DataFrame([{c: row.get(c) for c in FEATURE_COLS}])
    return df


def prepare_for_xgboost(df: pd.DataFrame, label_encoders_path: Path | None = None) -> pd.DataFrame:
    """Apply label encoding to categorical columns for XGBoost inference."""
    if label_encoders_path is None:
        label_encoders_path = settings.model_preprocessors_dir / 'label_encoders.joblib'
        if not label_encoders_path.exists():
            label_encoders_path = settings.model_pickles_dir / 'label_encoders.joblib'

    if label_encoders_path.exists():
        encoders = joblib.load(label_encoders_path)
        df = df.copy()
        for c in CAT_COLS:
            if c in encoders and c in df.columns:
                le = encoders[c]
                # Handle unseen categories
                df[c] = df[c].apply(
                    lambda x: le.transform([str(x)])[0] if str(x) in le.classes_ else -1
                )
    return df


def prepare_for_lightgbm(df: pd.DataFrame) -> pd.DataFrame:
    """Cast categorical columns to category dtype for LightGBM inference."""
    df = df.copy()
    for c in CAT_COLS:
        if c in df.columns:
            df[c] = df[c].astype('category')
    return df
