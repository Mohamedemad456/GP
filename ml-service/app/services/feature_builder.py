"""
Feature builder for inference time.

Transforms raw API input (brand, model, year, mileage, etc.)
into a model-ready feature vector by:
    1. Joining with car_specs_lookup.csv (engine_cc, hp, body_type, etc.)
    2. Engineering derived features (car_age, mileage_per_year, depreciation, etc.)
    3. Handling missing lookup matches gracefully
    4. Applying same preprocessing as training (via saved preprocessor)

IMPORTANT: This module is also imported by src/feature_engineering.py
during training to guarantee identical feature building at train and inference time.
"""

# TODO: Implement build_features() function
