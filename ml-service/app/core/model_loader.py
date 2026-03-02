"""
ModelManager: Loads trained models from registry and runs predictions.

Responsibilities:
    - Read model_registry.json to determine active version
    - Load 3 quantile models (median, lower, upper) + preprocessor via joblib
    - Load car_specs_lookup.csv into memory
    - Expose predict() method that builds features and returns price + range
    - Expose explain() method for SHAP-based price factors

Loaded once on FastAPI startup via lifespan context manager.
"""

# TODO: Implement ModelManager class
