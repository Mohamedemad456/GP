"""
Data cleaning pipeline.

Responsibilities:
    1. Load raw Parquet from data/raw/
    2. Remove exact duplicate listings (same title + year + mileage + price)
    3. Filter invalid prices (< 50K or > 20M EGP)
    4. Handle mileage = 0 (flag as NaN, impute later with brand+model median)
    5. Handle transmission = "0" (flag as NaN, impute with mode)
    6. Standardize location names → extract governorate → assign tier (A/B/C)
    7. IQR-based outlier removal per brand+model group (1.5× IQR, groups ≥ 10)
    8. Log row counts after each step (cleaning funnel)
    9. Save cleaned Parquet to data/cleaned/

Input:  data/raw/cars_raw.parquet
Output: data/cleaned/cars_cleaned.parquet

Usage:
    python -m src.data_cleaner
"""

# TODO: Implement cleaning pipeline
