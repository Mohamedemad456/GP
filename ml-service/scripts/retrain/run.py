"""Single orchestration runner for the frozen 07c retrain recipe (Milestones 2 + 3)."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import logging
import sys
import time
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from scripts.retrain.constants import (
    CAT_COLS,
    DEFAULT_DATASET_TAG,
    DEFAULT_SPLIT_NAME,
    DEFAULT_TARGET_COL,
    FEATURE_COLS,
    MODEL_FAMILY,
    NUM_COLS,
    QUANTILES,
)
from scripts.retrain.contracts import RetrainConfig
from scripts.retrain.data_source import find_ml_root, load_data
from scripts.retrain.predictor import predict_ensemble
from scripts.retrain.splitters import split_for_training
from scripts.retrain.trainer import compute_metrics_egp, train_frozen_ensemble
from scripts.retrain.validate import ValidationError, validate_dataframe

# Milestone 2 imports
from scripts.retrain import evaluation as eval_mod
from scripts.retrain import cv as cv_mod
from scripts.retrain import diagnostics as diag_mod
from scripts.retrain import gates

# Milestone 3 imports
from app.core.model_registry import (
    build_model_metadata,
    promote_active_model,
    register_model,
    save_model_metadata,
    load_registry,
    model_metadata_dir,
    model_pickles_dir,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Retrain the V2 pricing model (frozen 07c recipe)")
    parser.add_argument("--dataset-tag", default=DEFAULT_DATASET_TAG, help="Dataset tag from data manifest")
    parser.add_argument("--dataset-name", default=None, help="Alias for --dataset-tag")
    parser.add_argument("--data-path", default=None, help="Override: explicit CSV path")
    parser.add_argument("--target-col", default=DEFAULT_TARGET_COL, help="Target column")
    parser.add_argument("--split-name", default=DEFAULT_SPLIT_NAME, help="Split strategy")
    parser.add_argument("--no-promote", action="store_true", help="Skip auto-promotion even if gates pass")
    parser.add_argument("--model-id-suffix", default=None, help="Suffix for the model ID")
    parser.add_argument("--output-tag", default=None, help="Tag for output artifacts")
    parser.add_argument("--dry-run", action="store_true", help="Validate and split but do not train")
    parser.add_argument("--random-state", type=int, default=42, help="Random seed")
    parser.add_argument("--skip-cv", action="store_true", help="Skip CV evaluation (faster)")
    parser.add_argument("--grouped-cv", action="store_true", help="Run grouped CV (default: off)")
    parser.add_argument("--force-retrain", action="store_true", help="Ignore cache and retrain from scratch")
    return parser


def _output_tag(config: RetrainConfig) -> str:
    return config.output_tag or config.dataset_tag or "retrain"


def _artifact_paths(tag: str, ml_root: Path) -> dict[str, Path]:
    metrics_dir = ml_root / "models" / "metrics" / tag
    meta_dir = ml_root / "models" / "metadata"
    pkl_dir = ml_root / "models" / "pickles"
    metrics_dir.mkdir(parents=True, exist_ok=True)
    meta_dir.mkdir(parents=True, exist_ok=True)
    pkl_dir.mkdir(parents=True, exist_ok=True)
    return {
        "holdout_metrics": metrics_dir / f"holdout_metrics_{tag}.json",
        "per_tier_metrics": metrics_dir / f"per_tier_metrics_{tag}.csv",
        "per_make_metrics": metrics_dir / f"per_make_metrics_{tag}.csv",
        "per_make_model_holdout": metrics_dir / f"per_make_model_holdout_{tag}.csv",
        "cv_overall_metrics": metrics_dir / f"cv_overall_metrics_{tag}.json",
        "per_tier_cv_metrics": metrics_dir / f"per_tier_cv_metrics_{tag}.csv",
        "per_make_model_cv": metrics_dir / f"per_make_model_cv_{tag}.csv",
        "oof_median_preds": metrics_dir / f"oof_median_preds_{tag}.csv",
        "cv_grouped_metrics": metrics_dir / f"cv_grouped_metrics_{tag}.json",
        "retrain_summary": metrics_dir / f"retrain_summary_{tag}.json",
        "make_model_mape": meta_dir / "make_model_mape.csv",
        # Milestone 3 artifact paths
        "xgb_pkl": pkl_dir / f"xgb_quantile_{tag}.joblib",
        "lgbm_pkl": pkl_dir / f"lgbm_quantile_{tag}.joblib",
        "ensemble_pkl": pkl_dir / f"ensemble_{tag}.joblib",
        "encoders_pkl": pkl_dir / f"label_encoders_{tag}.joblib",
        "metadata_json": meta_dir / f"ensemble_{tag}.json",
    }


def _cache_dir(tag: str, ml_root: Path) -> Path:
    d = ml_root / "models" / "cache" / tag
    d.mkdir(parents=True, exist_ok=True)
    return d


def _save_training_cache(
    cache_dir: Path,
    artifact,
    ensemble_pred_map: dict,
    holdout_metrics: dict,
    per_tier: pd.DataFrame,
    per_make: pd.DataFrame,
    per_mm: pd.DataFrame,
    diag_summary: dict,
) -> None:
    cache = {
        "artifact": artifact,
        "ensemble_pred_map": ensemble_pred_map,
        "holdout_metrics": holdout_metrics,
        "per_tier": per_tier,
        "per_make": per_make,
        "per_mm": per_mm,
        "diag_summary": diag_summary,
    }
    path = cache_dir / "training_cache.joblib"
    joblib.dump(cache, path)
    logger.info("Training cache saved -> %s", path)


def _load_training_cache(cache_dir: Path) -> dict | None:
    path = cache_dir / "training_cache.joblib"
    if not path.exists():
        return None
    try:
        cache = joblib.load(path)
        logger.info("Training cache hit: loaded from %s", path)
        return cache
    except Exception as exc:
        logger.warning("Failed to load training cache: %s", exc)
        return None


def _save_cv_cache(
    cache_dir: Path,
    cv_result: dict,
    cv_metrics: dict,
    cv_per_tier: pd.DataFrame,
    cv_per_mm: pd.DataFrame,
    oof_df: pd.DataFrame,
    grouped_cv: dict | None,
) -> None:
    cache = {
        "cv_result": cv_result,
        "cv_metrics": cv_metrics,
        "cv_per_tier": cv_per_tier,
        "cv_per_mm": cv_per_mm,
        "oof_df": oof_df,
        "grouped_cv": grouped_cv,
    }
    path = cache_dir / "cv_cache.joblib"
    joblib.dump(cache, path)
    logger.info("CV cache saved -> %s", path)


def _load_cv_cache(cache_dir: Path) -> dict | None:
    path = cache_dir / "cv_cache.joblib"
    if not path.exists():
        return None
    try:
        cache = joblib.load(path)
        logger.info("CV cache hit: loaded from %s", path)
        return cache
    except Exception as exc:
        logger.warning("Failed to load CV cache: %s", exc)
        return None


def _next_v2_version() -> str:
    """Compute next V2.x version from the registry."""
    try:
        registry = load_registry()
        models = registry.get("models", {})
        v2_versions = []
        for model_id, info in models.items():
            if isinstance(info, list):
                for entry in info:
                    v = entry.get("version", "")
                    if isinstance(v, str) and v.startswith("v2."):
                        v2_versions.append(v)
            else:
                v = info.get("version", "")
                if isinstance(v, str) and v.startswith("v2."):
                    v2_versions.append(v)
        if not v2_versions:
            return "v2.1.0"
        v2_versions.sort()
        latest = v2_versions[-1]
        try:
            parts = latest.split(".")
            minor = int(parts[1])
            patch = int(parts[2])
            return f"v2.{minor}.{patch + 1}"
        except Exception:
            return "v2.1.0"
    except Exception:
        return "v2.1.0"


def _save_model_pickles(
    artifact,
    paths: dict[str, Path],
    ml_root: Path,
) -> None:
    """Save quantile sub-models, ensemble wrapper, and label encoders."""
    # XGB sub-model with full quantiles + serving aliases
    xgb_dict = dict(artifact.xgb_models)  # q05, q10, q50, q90, q95
    xgb_dict["lower"] = artifact.xgb_models["q05"]
    xgb_dict["median"] = artifact.xgb_models["q50"]
    xgb_dict["upper"] = artifact.xgb_models["q95"]
    joblib.dump(xgb_dict, paths["xgb_pkl"])
    logger.info("XGB quantile sub-model -> %s", paths["xgb_pkl"])

    # LGBM sub-model with full quantiles + serving aliases
    lgbm_dict = dict(artifact.lgbm_models)
    lgbm_dict["lower"] = artifact.lgbm_models["q05"]
    lgbm_dict["median"] = artifact.lgbm_models["q50"]
    lgbm_dict["upper"] = artifact.lgbm_models["q95"]
    joblib.dump(lgbm_dict, paths["lgbm_pkl"])
    logger.info("LGBM quantile sub-model -> %s", paths["lgbm_pkl"])

    # Ensemble wrapper (format expected by serving layer)
    xgb_rel = str(paths["xgb_pkl"].relative_to(ml_root))
    lgbm_rel = str(paths["lgbm_pkl"].relative_to(ml_root))
    ensemble_wrapper = {
        "base_models": {
            "xgb": xgb_rel,
            "lgbm": lgbm_rel,
        },
        "method": "Weighted Average",
        "weights": [0.55, 0.45],
    }
    joblib.dump(ensemble_wrapper, paths["ensemble_pkl"])
    logger.info("Ensemble wrapper -> %s", paths["ensemble_pkl"])

    # Label encoders
    joblib.dump(artifact.label_encoders, paths["encoders_pkl"])
    logger.info("Label encoders -> %s", paths["encoders_pkl"])


def _build_and_save_metadata(
    artifact,
    holdout_metrics: dict,
    cv_metrics: dict,
    paths: dict[str, Path],
    tag: str,
) -> str:
    """Build model metadata JSON and return the resolved meta_path string."""
    quantiles_compat = {
        "q05": 0.05,
        "q10": 0.10,
        "q50": 0.50,
        "q90": 0.90,
        "q95": 0.95,
        "lower": 0.05,
        "median": 0.50,
        "upper": 0.95,
    }

    metadata = build_model_metadata(
        version=tag,
        model_id=f"v2_{tag}",
        framework="ensemble",
        target="price_egp",
        is_log_target=artifact.is_log_target,
        split_strategy="price_stratified",
        quantiles=quantiles_compat,
    )

    # Augment with retrain-specific fields
    metadata["holdout_metrics"] = holdout_metrics
    metadata["cv_metrics"] = cv_metrics if cv_metrics else None
    metadata["training_date"] = dt.datetime.now(dt.timezone.utc).isoformat()
    metadata["dataset_tag"] = tag
    metadata["model_family"] = MODEL_FAMILY
    metadata["artifacts"] = {
        "make_model_mape_csv": str(paths["make_model_mape"].relative_to(paths["make_model_mape"].parents[2])),
    }
    metadata["quantile_models"] = {
        "xgb": str(paths["xgb_pkl"].relative_to(paths["xgb_pkl"].parents[2])),
        "lgbm": str(paths["lgbm_pkl"].relative_to(paths["lgbm_pkl"].parents[2])),
    }

    save_model_metadata(metadata, str(paths["metadata_json"]))
    logger.info("Metadata -> %s", paths["metadata_json"])
    return str(paths["metadata_json"].relative_to(paths["metadata_json"].parents[2]))


def _register_model(
    model_id: str,
    version: str,
    paths: dict[str, Path],
    meta_path: str,
    holdout_metrics: dict,
    cv_metrics: dict,
    gate,
    diagnostics_summary: dict | None = None,
) -> None:
    """Register model in the central registry."""
    ensemble_rel = str(paths["ensemble_pkl"].relative_to(paths["ensemble_pkl"].parents[2]))
    metrics_flat: dict[str, float] = {}
    for k, v in holdout_metrics.items():
        if isinstance(v, (int, float)):
            metrics_flat[k] = float(v)
    if cv_metrics:
        for k, v in cv_metrics.items():
            if isinstance(v, (int, float)):
                metrics_flat[f"cv_{k}"] = float(v)

    # Registration is always candidate; promotion is a separate explicit step
    stage = "candidate"

    register_model(
        model_id=model_id,
        pkl_path=ensemble_rel,
        meta_path=meta_path,
        framework="ensemble",
        version=version,
        metrics=metrics_flat,
        artifacts={
            "xgb_pkl": str(paths["xgb_pkl"].relative_to(paths["xgb_pkl"].parents[2])),
            "lgbm_pkl": str(paths["lgbm_pkl"].relative_to(paths["lgbm_pkl"].parents[2])),
            "encoders_pkl": str(paths["encoders_pkl"].relative_to(paths["encoders_pkl"].parents[2])),
            "make_model_mape_csv": str(paths["make_model_mape"].relative_to(paths["make_model_mape"].parents[2])),
        },
        stage=stage,
        tags=["v2", "retrain", "frozen_recipe"],
        diagnostics_summary=diagnostics_summary or {},
    )
    logger.info("Model %s registered at stage=%s", model_id, stage)


def _append_training_history(
    ml_root: Path,
    model_id: str,
    version: str,
    gate,
    holdout_metrics: dict,
    cv_metrics: dict | None,
    elapsed_sec: float,
    promoted: bool,
    diagnostics_summary: dict | None = None,
) -> None:
    """Append a run record to models/training_history.json."""
    history_path = ml_root / "models" / "training_history.json"
    history_path.parent.mkdir(parents=True, exist_ok=True)

    record = {
        "timestamp": dt.datetime.now(dt.timezone.utc).isoformat(),
        "model_id": model_id,
        "version": version,
        "stage": "production" if promoted else ("candidate" if gate.passed else "rejected"),
        "gate_outcome": gate.outcome,
        "gate_passed": gate.passed,
        "holdout_mape_pct": holdout_metrics.get("MAPE_pct"),
        "holdout_mae": holdout_metrics.get("MAE"),
        "cv_mape_pct": cv_metrics.get("MAPE_pct") if cv_metrics else None,
        "elapsed_sec": round(elapsed_sec, 2),
        "promoted": promoted,
        "diagnostics_summary": diagnostics_summary or {},
    }

    if history_path.exists():
        try:
            with history_path.open("r", encoding="utf-8") as fh:
                history = json.load(fh)
            if not isinstance(history, list):
                history = []
        except Exception:
            history = []
    else:
        history = []

    history.append(record)
    with history_path.open("w", encoding="utf-8") as fh:
        json.dump(history, fh, indent=2, default=str)
    logger.info("Training history appended -> %s", history_path)


def run_retrain(config: RetrainConfig) -> dict:
    """Execute a single retrain run end-to-end (Milestone 2).

    Returns a compact result dict for logging/history.
    """
    start_time = time.time()
    ml_root = find_ml_root()
    tag = _output_tag(config)
    paths = _artifact_paths(tag, ml_root)
    cache_dir = _cache_dir(tag, ml_root)

    result = {
        "status": "started",
        "config": {
            "dataset_tag": config.dataset_tag,
            "data_path": config.data_path,
            "target_col": config.target_col,
            "split_name": config.split_name,
            "no_promote": config.no_promote,
            "model_id_suffix": config.model_id_suffix,
            "output_tag": config.output_tag,
            "dry_run": config.dry_run,
            "skip_cv": config.skip_cv,
            "grouped_cv": config.grouped_cv,
            "force_retrain": config.force_retrain,
            "random_state": config.random_state,
        },
    }

    # ── 1. Load data ─────────────────────────────────────────────────────────
    logger.info("Loading data (tag=%s, path=%s)", config.dataset_tag, config.data_path)
    try:
        df = load_data(dataset_tag=config.dataset_tag, data_path=config.data_path)
    except FileNotFoundError as exc:
        logger.error("Data loading failed: %s", exc)
        result["status"] = "reject"
        result["reason"] = str(exc)
        return result

    logger.info("Loaded %d rows, %d cols", len(df), len(df.columns))

    # ── 2. Validate ────────────────────────────────────────────────────────────
    logger.info("Validating schema and quality...")
    try:
        validate_dataframe(df, target_col=config.target_col)
    except ValidationError as exc:
        logger.error("Validation failed: %s", exc)
        result["status"] = "reject"
        result["reason"] = str(exc)
        return result

    logger.info("Validation passed")

    # ── 3. Split ─────────────────────────────────────────────────────────────
    logger.info("Splitting with strategy=%s", config.split_name)
    splits = split_for_training(
        df,
        split_name=config.split_name,
        random_state=config.random_state,
    )
    logger.info(
        "Split sizes: train=%d, val=%d, test=%d",
        len(splits.train_df),
        len(splits.val_df),
        len(splits.test_df),
    )

    if config.dry_run:
        logger.info("Dry run complete — stopping before training")
        result["status"] = "dry_run"
        result["split_sizes"] = {
            "train": len(splits.train_df),
            "val": len(splits.val_df),
            "test": len(splits.test_df),
        }
        return result

    # ── Training cache check ───────────────────────────────────────────────────
    training_cache = None
    if not config.force_retrain:
        training_cache = _load_training_cache(cache_dir)

    if training_cache:
        logger.info("Training cache hit — skipping retrain & holdout evaluation")
        artifact = training_cache["artifact"]
        ensemble_pred_map = training_cache["ensemble_pred_map"]
        holdout_metrics = training_cache["holdout_metrics"]
        per_tier = training_cache["per_tier"]
        per_make = training_cache["per_make"]
        per_mm = training_cache["per_mm"]
        diag_summary = training_cache["diag_summary"]
    else:
        # ── 4. Train ───────────────────────────────────────────────────────────
        logger.info("Training frozen ensemble (XGB 0.55 / LGBM 0.45) with 5 quantiles...")
        artifact = train_frozen_ensemble(
            splits,
            feature_cols=FEATURE_COLS,
            cat_cols=CAT_COLS,
            num_cols=NUM_COLS,
            target_col=config.target_col,
        )
        logger.info("Training complete")

        # ── 5. Holdout prediction ────────────────────────────────────────────
        logger.info("Predicting on holdout test set...")
        ensemble_pred_map = predict_ensemble(artifact, splits.test_df, config.target_col)

        # ── 6. Full holdout evaluation (Milestone 2) ───────────────────────────
        logger.info("Computing full holdout evaluation...")
        holdout_metrics = eval_mod.evaluate_holdout(
            splits.test_df[config.target_col].to_numpy(),
            ensemble_pred_map,
            is_log=artifact.is_log_target,
        )
        logger.info("Holdout metrics: %s", json.dumps(holdout_metrics, indent=2, default=str))

        # Per-tier
        per_tier = eval_mod.evaluate_per_tier(
            splits.test_df, ensemble_pred_map, is_log=artifact.is_log_target
        )
        logger.info("Per-tier metrics computed")

        # EGP predictions for per-make / per-make-model
        median_key = "median" if "median" in ensemble_pred_map else "q50"
        if artifact.is_log_target:
            if float(np.nanmedian(splits.test_df[config.target_col].to_numpy())) < 10:
                pred_egp = np.power(10.0, ensemble_pred_map[median_key])
            else:
                pred_egp = np.exp(ensemble_pred_map[median_key])
        else:
            pred_egp = ensemble_pred_map[median_key]

        # Per-make
        per_make = eval_mod.evaluate_per_make(splits.test_df, pred_egp, min_rows=5)
        logger.info("Per-make metrics computed")

        # Per-make-model
        per_mm = eval_mod.evaluate_per_make_model(splits.test_df, pred_egp, min_rows=5)
        logger.info("Per-make-model holdout computed")

        # ── 8. Diagnostics (Milestone 2) ─────────────────────────────────────
        logger.info("Computing diagnostics...")
        diag_summary = diag_mod.threshold_summary(per_mm)
        supported_stats = diag_mod.supported_combo_stats(per_mm, min_rows=10)
        diag_summary.update(supported_stats)
        logger.info("Diagnostics: %s", json.dumps(diag_summary, indent=2, default=str))

        # Save training cache
        _save_training_cache(
            cache_dir=cache_dir,
            artifact=artifact,
            ensemble_pred_map=ensemble_pred_map,
            holdout_metrics=holdout_metrics,
            per_tier=per_tier,
            per_make=per_make,
            per_mm=per_mm,
            diag_summary=diag_summary,
        )

    # Write holdout metrics files (always, so they live in the versioned folder)
    per_tier.to_csv(paths["per_tier_metrics"], index=False)
    logger.info("Per-tier metrics -> %s", paths["per_tier_metrics"])
    per_make.to_csv(paths["per_make_metrics"], index=False)
    logger.info("Per-make metrics -> %s", paths["per_make_metrics"])
    per_mm.to_csv(paths["per_make_model_holdout"], index=False)
    logger.info("Per-make-model holdout -> %s", paths["per_make_model_holdout"])

    # Production make_model_mape.csv
    diag_mod.generate_make_model_mape_csv(per_mm, paths["make_model_mape"])
    logger.info("make_model_mape.csv -> %s", paths["make_model_mape"])

    # ── 7. CV evaluation (Milestone 2) ─────────────────────────────────────────
    cv_result: dict | None = None
    grouped_cv = None
    if not config.skip_cv:
        cv_cache = None
        if not config.force_retrain:
            cv_cache = _load_cv_cache(cache_dir)

        if cv_cache:
            logger.info("CV cache hit — skipping CV computation")
            cv_result = cv_cache["cv_result"]
            cv_metrics = cv_cache["cv_metrics"]
            cv_per_tier = cv_cache["cv_per_tier"]
            cv_per_mm = cv_cache["cv_per_mm"]
            oof_df = cv_cache["oof_df"]
            grouped_cv = cv_cache.get("grouped_cv")
        else:
            logger.info("Running 5-fold KFold OOF CV...")
            cv_result = cv_mod.run_kfold_cv(
                df,
                target_col=config.target_col,
                random_state=config.random_state,
            )
            cv_metrics = cv_result["overall_metrics"]
            logger.info("CV metrics: %s", json.dumps(cv_metrics, indent=2, default=str))

            # Per-tier CV
            cv_per_tier = cv_mod.evaluate_cv_per_tier(df, cv_result["oof_preds"])
            logger.info("Per-tier CV metrics computed")

            # Per-make-model CV
            cv_per_mm = cv_mod.evaluate_cv_per_make_model(df, cv_result["oof_preds"], min_rows=5)
            logger.info("Per-make-model CV computed")

            # OOF predictions
            oof_df = pd.DataFrame({
                "price_egp": df["price_egp"],
                "oof_pred_egp": cv_result["oof_preds"],
            })
            logger.info("OOF predictions computed")

            # Secondary grouped CV (opt-in)
            if config.grouped_cv:
                logger.info("Running secondary grouped CV...")
                grouped_cv = cv_mod.run_grouped_cv(
                    df,
                    target_col=config.target_col,
                    random_state=config.random_state,
                )
                logger.info("Grouped CV metrics computed")
            else:
                grouped_cv = None

            # Save CV cache
            _save_cv_cache(
                cache_dir=cache_dir,
                cv_result=cv_result,
                cv_metrics=cv_metrics,
                cv_per_tier=cv_per_tier,
                cv_per_mm=cv_per_mm,
                oof_df=oof_df,
                grouped_cv=grouped_cv,
            )

        # Export CV files (always, so they live in the versioned folder)
        with paths["cv_overall_metrics"].open("w", encoding="utf-8") as fh:
            json.dump(cv_metrics, fh, indent=2, default=str)

        cv_per_tier.to_csv(paths["per_tier_cv_metrics"], index=False)
        logger.info("Per-tier CV metrics -> %s", paths["per_tier_cv_metrics"])

        cv_per_mm.to_csv(paths["per_make_model_cv"], index=False)
        logger.info("Per-make-model CV -> %s", paths["per_make_model_cv"])

        oof_df.to_csv(paths["oof_median_preds"], index=False)
        logger.info("OOF predictions -> %s", paths["oof_median_preds"])

        if grouped_cv:
            with paths["cv_grouped_metrics"].open("w", encoding="utf-8") as fh:
                json.dump(grouped_cv["overall_metrics"], fh, indent=2, default=str)
            logger.info("Grouped CV metrics -> %s", paths["cv_grouped_metrics"])
    else:
        logger.info("CV skipped (--skip-cv)")
        cv_metrics = {}

    # Holdout metrics JSON
    with paths["holdout_metrics"].open("w", encoding="utf-8") as fh:
        json.dump(holdout_metrics, fh, indent=2, default=str)
    logger.info("Holdout metrics -> %s", paths["holdout_metrics"])

    # ── 9. Gate check (Milestone 2) ────────────────────────────────────────────
    gate = gates.check_gate(
        holdout_metrics=holdout_metrics,
        cv_metrics=cv_metrics if cv_result else {},
        diag_summary=diag_summary,
    )
    logger.info("Gate result: %s (passed=%s)", gate.outcome, gate.passed)
    for reason in gate.reasons:
        logger.info("  - %s", reason)

    # ── 10. Artifact exports (Milestone 2) ───────────────────────────────────
    # Compute per-MM threshold diagnostics for registry/history
    diagnostics_summary: dict = {}
    diagnostics_summary.update(
        diag_mod.per_mm_threshold_diagnostics(per_mm, prefix="holdout")
    )
    if cv_result and "cv_per_mm" in locals():
        diagnostics_summary.update(
            diag_mod.per_mm_threshold_diagnostics(cv_per_mm, prefix="cv")
        )
    logger.info("Diagnostics summary: %s", json.dumps(diagnostics_summary, indent=2, default=str))

    # Holdout metrics JSON
    with paths["holdout_metrics"].open("w", encoding="utf-8") as fh:
        json.dump(holdout_metrics, fh, indent=2, default=str)
    logger.info("Holdout metrics -> %s", paths["holdout_metrics"])

    # Summary JSON
    summary = {
        "dataset_tag": config.dataset_tag,
        "target_col": config.target_col,
        "split_name": config.split_name,
        "output_tag": tag,
        "model_family": MODEL_FAMILY,
        "holdout_metrics": holdout_metrics,
        "cv_metrics": cv_metrics if cv_result else None,
        "diagnostics": diag_summary,
        "diagnostics_summary": diagnostics_summary,
        "gate": {
            "outcome": gate.outcome,
            "passed": gate.passed,
            "reasons": gate.reasons,
        },
        "split_sizes": {
            "train": len(splits.train_df),
            "val": len(splits.val_df),
            "test": len(splits.test_df),
        },
        "elapsed_sec": round(time.time() - start_time, 2),
    }
    with paths["retrain_summary"].open("w", encoding="utf-8") as fh:
        json.dump(summary, fh, indent=2, default=str)
    logger.info("Summary -> %s", paths["retrain_summary"])

    # ── 11. Milestone 3: Save model pickles ─────────────────────────────────
    logger.info("Saving model pickles (Milestone 3)...")
    _save_model_pickles(artifact, paths, ml_root)

    # ── 12. Milestone 3: Build and save metadata ────────────────────────────
    logger.info("Building model metadata (Milestone 3)...")
    meta_path = _build_and_save_metadata(
        artifact=artifact,
        holdout_metrics=holdout_metrics,
        cv_metrics=cv_metrics if cv_result else {},
        paths=paths,
        tag=tag,
    )

    # ── 13. Milestone 3: Register model ─────────────────────────────────────
    model_id = f"v2_{tag}"
    if config.model_id_suffix:
        model_id = f"v2_{config.model_id_suffix}"
    version = _next_v2_version()

    logger.info("Registering model %s @ %s (Milestone 3)...", model_id, version)
    _register_model(
        model_id=model_id,
        version=version,
        paths=paths,
        meta_path=meta_path,
        holdout_metrics=holdout_metrics,
        cv_metrics=cv_metrics if cv_result else {},
        gate=gate,
        diagnostics_summary=diagnostics_summary,
    )

    # ── 14. Milestone 3: Promote if gate passes ───────────────────────────────
    promoted = False
    if gate.outcome == "promote" and not config.no_promote:
        logger.info("Promoting %s to active production model...", model_id)
        try:
            promote_active_model(model_id)
            promoted = True
            logger.info("Model %s promoted successfully", model_id)
        except Exception as exc:
            logger.warning("Promotion failed: %s", exc)

    # ── 15. Milestone 3: Append training history ──────────────────────────────
    _append_training_history(
        ml_root=ml_root,
        model_id=model_id,
        version=version,
        gate=gate,
        holdout_metrics=holdout_metrics,
        cv_metrics=cv_metrics if cv_result else None,
        elapsed_sec=summary["elapsed_sec"],
        promoted=promoted,
        diagnostics_summary=diagnostics_summary,
    )

    # ── 16. Result assembly ──────────────────────────────────────────────────
    final_status = gate.outcome
    if config.no_promote and final_status == "promote":
        final_status = "candidate_only"

    result["status"] = final_status
    result["gate_passed"] = gate.passed
    result["gate_reasons"] = gate.reasons
    result["holdout_metrics"] = holdout_metrics
    result["cv_metrics"] = cv_metrics if cv_result else None
    result["diagnostics"] = diag_summary
    result["split_sizes"] = summary["split_sizes"]
    result["elapsed_sec"] = summary["elapsed_sec"]
    result["model_id"] = model_id
    result["version"] = version
    result["promoted"] = promoted
    result["artifacts"] = {k: str(v.relative_to(ml_root)) for k, v in paths.items()}

    logger.info("Retrain run finished in %.2fs", result["elapsed_sec"])
    return result


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)

    dataset_tag = args.dataset_name or args.dataset_tag

    config = RetrainConfig(
        dataset_tag=dataset_tag,
        data_path=args.data_path,
        target_col=args.target_col,
        split_name=args.split_name,
        no_promote=args.no_promote,
        model_id_suffix=args.model_id_suffix,
        output_tag=args.output_tag,
        dry_run=args.dry_run,
        skip_cv=args.skip_cv,
        grouped_cv=args.grouped_cv,
        force_retrain=args.force_retrain,
        random_state=args.random_state,
    )

    result = run_retrain(config)
    print(json.dumps(result, indent=2, default=str))
    return 0 if result["status"] not in {"reject", "error"} else 1


if __name__ == "__main__":
    sys.exit(main())
