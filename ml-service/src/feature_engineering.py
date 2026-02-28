"""
Feature engineering pipeline.

Responsibilities:
    1. Load cleaned Parquet from data/cleaned/
    2. Join with data/lookups/title_parsed.csv (adds brand, model)
    3. Join with data/lookups/car_specs_lookup.csv (adds engine_cc, hp, body_type, etc.)
    4. Engineer derived features:
        - car_age, mileage_per_year
        - depreciation_ratio, hp_per_cc
        - is_high_mileage, brand_origin
        - missing indicator flags
    5. Handle remaining missing values (median imputation for numeric, mode for categorical)
    6. Save training-ready Parquet to data/processed/

Note: Outlier removal and data cleaning happen in data_cleaner.py (upstream).
      This file assumes clean input.

Uses app.services.feature_builder for shared feature logic
to guarantee identical preprocessing at training and inference time.

Input:  data/cleaned/cars_cleaned.parquet + data/lookups/*.csv
Output: data/processed/features.parquet

Usage:
    python -m src.feature_engineering
"""

# TODO: Implement feature engineering pipeline
