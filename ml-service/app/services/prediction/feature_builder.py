"""
Feature builder for inference time.

Transforms raw API input (brand, model, year, mileage, etc.)
into a model-ready feature vector by:
    1. Joining with car_specs_lookup CSV (engine_cc, hp, body_type, etc.)
    2. Engineering derived features (mileage_per_year, etc.)
    3. Handling missing lookup matches gracefully with 5-priority fallback
    4. Applying same preprocessing as training (label encoders, category dtype)
    5. Canonicalizing make/model from lookup to preserve dataset casing

IMPORTANT: This module must stay in sync with the training notebook's
feature engineering. No `model_family` or `car_age` features are used.
"""
from __future__ import annotations

import logging
from datetime import datetime
from functools import lru_cache

import pandas as pd
import numpy as np
from pathlib import Path
import joblib

from app.core.config import settings

logger = logging.getLogger(__name__)

# Feature columns — must match notebook 05 exactly
CAT_COLS = ['make', 'model', 'transmission', 'fuel', 'location',
            'body_type', 'drivetrain', 'brand_origin', 'car_segment']
NUM_COLS = ['year', 'mileage_km', 'mileage_per_year', 'engine_cc',
            'horsepower', 'seating_capacity']
FEATURE_COLS = NUM_COLS + CAT_COLS

# ── Lookup caching ────────────────────────────────────────────────────────────

@lru_cache(maxsize=1)
def _load_lookup() -> pd.DataFrame:
    """Load the fixed car specs lookup file (cached)."""
    path = settings.lookup_dir / "car_specs_lookup_full_cleaned.fixed.csv"
    if not path.exists():
        raise FileNotFoundError(f"Lookup file not found: {path}")
    return pd.read_csv(path)


# ── Canonicalization ──────────────────────────────────────────────────────────

_CANONICAL_MAKE_MODEL: dict[tuple[str, str], tuple[str, str]] = {}


def _build_canonical_map(lookup: pd.DataFrame) -> dict[tuple[str, str], tuple[str, str]]:
    """Build a canonical map from the lookup CSV.

    Key:   (make.lower().strip(), model.lower().strip())
    Value: (make as-is in dataset, model as-is in dataset)

    This preserves the exact casing used in the training data,
    avoiding blind .title() which would mangle names like 'BMW 116' -> 'Bmw 116'.
    """
    result = {}
    for _, row in lookup[["make", "model"]].drop_duplicates().iterrows():
        key = (str(row["make"]).strip().lower(), str(row["model"]).strip().lower())
        result[key] = (str(row["make"]).strip(), str(row["model"]).strip())
    return result


def _ensure_canonical_map():
    """Populate the canonical map lazily on first use."""
    if not _CANONICAL_MAKE_MODEL:
        _CANONICAL_MAKE_MODEL.update(_build_canonical_map(_load_lookup()))


def _canonicalize(make: str, model: str) -> tuple[str, str]:
    """Canonicalize make/model using the lookup-based map.

    Falls back to stripped input if no mapping found.
    """
    _ensure_canonical_map()
    key = (make.strip().lower(), model.strip().lower())
    return _CANONICAL_MAKE_MODEL.get(key, (make.strip(), model.strip()))


# ── Enum normalization ───────────────────────────────────────────────────────

_TRANSMISSION_MAP: dict[str, str] = {
    "auto": "Automatic",
    "automatic": "Automatic",
    "manual": "Manual",
    "stick": "Manual",
}

_FUEL_MAP: dict[str, str] = {
    "petrol": "petrol",
    "gasoline": "petrol",
    "gas": "petrol",
    "diesel": "diesel",
    "hybrid": "hybrid",
    "electric": "electric",
}


def _normalize_transmission(val: str | None) -> str | None:
    if val is None:
        return None
    return _TRANSMISSION_MAP.get(val.strip().lower(), val.strip())


def _normalize_fuel(val: str | None) -> str | None:
    if val is None:
        return None
    return _FUEL_MAP.get(val.strip().lower(), val.strip().lower())


def _normalize_location(val: str | None) -> str | None:
    if val is None:
        return None
    return val.strip()


# ── Specs fallback (5-priority) ──────────────────────────────────────────────

def _find_spec(lookup: pd.DataFrame, make: str, model: str, year: int) -> pd.Series | None:
    """Find specs for a make/model/year using a 5-priority fallback chain.

    Priority:
      1. Exact make/model/year
      2. Same make/model, nearest year
      3. Same make, median/mode
      4. (returns None — caller applies global defaults)
    """
    # Priority 1: exact make/model/year
    match = lookup[(lookup["make"] == make) & (lookup["model"] == model) & (lookup["year"] == year)]
    if len(match) > 0:
        return match.iloc[0]

    # Priority 2: same make/model, nearest year
    candidates = lookup[(lookup["make"] == make) & (lookup["model"] == model)]
    if len(candidates) > 0:
        idx = (candidates["year"] - year).abs().idxmin()
        return candidates.loc[idx]

    # Priority 3: same make, median/mode aggregate
    make_candidates = lookup[lookup["make"] == make]
    if len(make_candidates) > 0:
        num_agg = make_candidates.median(numeric_only=True)
        mode_df = make_candidates.mode(dropna=True)
        if len(mode_df) > 0:
            cat_agg = mode_df.iloc[0]
            return num_agg.combine_first(cat_agg)
        return num_agg

    # Priority 4: global defaults (handled by caller)
    return None


# ── Input validation ──────────────────────────────────────────────────────────

def _validate_inputs(year: int, mileage_km: float | None) -> None:
    """Validate plausible numeric inputs. Raises ValueError for invalid values."""
    current_year = datetime.now().year
    if year < 1950:
        raise ValueError(f"year must be >= 1950, got {year}")
    if year > current_year + 1:
        raise ValueError(f"year must be <= {current_year + 1}, got {year}")
    if mileage_km is not None and mileage_km < 0:
        raise ValueError(f"mileage_km must be >= 0, got {mileage_km}")


# ── Main feature builder ─────────────────────────────────────────────────────

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
    _validate_inputs(year, mileage_km)

    # Canonicalize make/model using lookup-based map
    make, model = _canonicalize(make, model)

    # Normalize enum fields
    transmission = _normalize_transmission(transmission)
    fuel = _normalize_fuel(fuel)
    location = _normalize_location(location)

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

    # Find specs using 5-priority fallback
    lookup = _load_lookup()
    spec = _find_spec(lookup, make, model, year)

    spec_cols = ['engine_cc', 'horsepower', 'body_type', 'drivetrain',
                 'seating_capacity', 'brand_origin', 'car_segment',
                 'transmission', 'fuel']
    if spec is not None:
        for col in spec_cols:
            if col not in row or row[col] is None:
                val = spec.get(col)
                if val is not None and (not isinstance(val, float) or not np.isnan(val)):
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


def _resolve_label_encoders_path(label_encoders_path: Path | None = None) -> Path | None:
    """Resolve the best available label encoders artifact for XGBoost inference."""
    candidates: list[Path] = []

    if label_encoders_path is not None:
        direct = Path(label_encoders_path)
        if direct.exists():
            return direct
        candidates.append(direct)

    candidates.extend([
        settings.model_preprocessors_dir / 'label_encoders.joblib',
        settings.model_pickles_dir / 'label_encoders.joblib',
    ])

    seen: set[Path] = set()
    for candidate in candidates:
        if candidate in seen:
            continue
        seen.add(candidate)
        if candidate.exists():
            return candidate

    versioned_matches: list[Path] = []
    for base_dir in (settings.model_preprocessors_dir, settings.model_pickles_dir):
        if base_dir.exists():
            versioned_matches.extend(base_dir.glob('label_encoders*.joblib'))

    versioned_matches = sorted(
        versioned_matches,
        key=lambda path: (path.stat().st_mtime, path.name),
        reverse=True,
    )
    return versioned_matches[0] if versioned_matches else None


def prepare_for_xgboost(df: pd.DataFrame, label_encoders_path: Path | None = None) -> pd.DataFrame:
    """Apply label encoding to categorical columns for XGBoost inference."""
    label_encoders_path = _resolve_label_encoders_path(label_encoders_path)

    if label_encoders_path is not None and label_encoders_path.exists():
        encoders = joblib.load(label_encoders_path)
        df = df.copy()
        for c in CAT_COLS:
            if c in encoders and c in df.columns:
                le = encoders[c]
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
