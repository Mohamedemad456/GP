"""Frozen recipe constants from the 07c winner (ensemble_baseline_5q)."""

from __future__ import annotations

# ── Reproducibility ───────────────────────────────────────────────────────────
RANDOM_STATE = 42
VAL_FRACTION = 0.10
TEST_SIZE = 0.20

# ── Target ───────────────────────────────────────────────────────────────────
DEFAULT_TARGET_COL = "price_egp_log"
DEFAULT_SPLIT_NAME = "price_stratified"

# ── Features (V1 only — Plan 2 features rejected) ────────────────────────────
NUM_COLS = [
    "year",
    "mileage_km",
    "mileage_per_year",
    "engine_cc",
    "horsepower",
    "seating_capacity",
]

CAT_COLS = [
    "make",
    "model",
    "transmission",
    "fuel",
    "location",
    "body_type",
    "drivetrain",
    "brand_origin",
    "car_segment",
]

FEATURE_COLS = NUM_COLS + CAT_COLS

# ── Quantiles (5-quantile 07c recipe) ──────────────────────────────────────
QUANTILES = {
    "q05": 0.05,
    "q10": 0.10,
    "q50": 0.50,
    "q90": 0.90,
    "q95": 0.95,
}

# Serving compatibility aliases
SERVING_ALIASES = {
    "lower": "q05",
    "median": "q50",
    "upper": "q95",
}

# ── Ensemble weights ─────────────────────────────────────────────────────────
XGB_WEIGHT = 0.55
LGBM_WEIGHT = 0.45
ENSEMBLE_WEIGHTS = [XGB_WEIGHT, LGBM_WEIGHT]

# ── Training hyperparameters (frozen from 07c / v2_experiment_utils) ────────
XGB_BASE_PARAMS = {
    "learning_rate": 0.015490483286740053,
    "max_depth": 11,
    "min_child_weight": 4,
    "subsample": 0.6622077411666858,
    "colsample_bytree": 0.8536659127023519,
    "reg_alpha": 0.085522303812033,
    "reg_lambda": 1.3969605300880791e-07,
    "gamma": 0.447036756545783,
    "max_bin": 512,
}

LGBM_BASE_PARAMS = {
    "learning_rate": 0.027681271280960946,
    "num_leaves": 62,
    "max_depth": 10,
    "min_child_samples": 12,
    "subsample": 0.715216053848345,
    "colsample_bytree": 0.5431488908733526,
    "reg_alpha": 0.49247701388255255,
    "reg_lambda": 1.7238989341211074e-05,
    "min_split_gain": 0.02774152144413644,
}

# ── Training config ──────────────────────────────────────────────────────────
MAX_BOOST_ROUNDS = 1200
EARLY_STOPPING_ROUNDS = 40

# ── Price tiers ──────────────────────────────────────────────────────────────
PRICE_TIER_BINS = [0, 500_000, 1_500_000, 4_000_000, float("inf")]
PRICE_TIER_LABELS = ["economy", "standard", "luxury", "ultra_luxury"]

# ── Dataset reference ────────────────────────────────────────────────────────
DEFAULT_DATASET_TAG = "2026-06-03_008"

# ── Versioning ───────────────────────────────────────────────────────────────
MODEL_FAMILY = "v2"
