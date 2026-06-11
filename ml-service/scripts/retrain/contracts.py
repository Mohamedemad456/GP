"""Typed contracts (dataclasses) for the retrain pipeline."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import numpy as np
import pandas as pd


@dataclass
class SplitBundle:
    """Holds train / validation / test splits."""

    train_df: pd.DataFrame
    val_df: pd.DataFrame
    test_df: pd.DataFrame


@dataclass
class QuantileModels:
    """Holds trained quantile models for both frameworks."""

    xgb: dict[str, Any]
    lgbm: dict[str, Any]
    label_encoders: dict[str, Any] | None = None


@dataclass
class PredictionMap:
    """Holds predictions from a single framework."""

    pred_map: dict[str, np.ndarray]
    framework: str


@dataclass
class EnsembleArtifact:
    """Holds the full trained ensemble ready for serialization."""

    xgb_models: dict[str, Any]
    lgbm_models: dict[str, Any]
    label_encoders: dict[str, Any]
    weights: list[float]
    feature_cols: list[str]
    cat_cols: list[str]
    num_cols: list[str]
    target_col: str
    is_log_target: bool


@dataclass
class HoldoutMetrics:
    """Global holdout metrics."""

    mae: float
    rmse: float
    r2: float
    mape_pct: float
    within_10pct: float
    within_15pct: float
    coverage_80_pct: float
    coverage_90_pct: float
    mean_width_pct: float


@dataclass
class CVMetrics:
    """Cross-validation summary metrics."""

    mae: float
    rmse: float
    r2: float
    mape_pct: float
    within_10pct: float
    within_15pct: float


@dataclass
class GateResult:
    """Outcome of the threshold-only promotion gate."""

    outcome: str  # "promote" | "candidate_only" | "reject"
    passed: bool
    reasons: list[str] = field(default_factory=list)


@dataclass
class RetrainConfig:
    """Runtime configuration for a single retrain run."""

    dataset_tag: str | None = None
    data_path: str | None = None
    target_col: str = "price_egp_log"
    split_name: str = "price_stratified"
    no_promote: bool = False
    model_id_suffix: str | None = None
    output_tag: str | None = None
    dry_run: bool = False
    skip_cv: bool = False
    grouped_cv: bool = False
    force_retrain: bool = False
    random_state: int = 42
