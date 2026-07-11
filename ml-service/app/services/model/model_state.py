"""
model_state.py — Global model state, loading, and validity checks.
"""
import logging
import sys
import json
from dataclasses import dataclass
from typing import Any

import joblib
import numpy as np
import pandas as pd

from app.core.config import settings
from app.core.model_registry import (
    get_active_model_info,
    load_registry,
    resolve_registry_path,
)

logger = logging.getLogger(__name__)

# ── Global state ──────────────────────────────────────────────────────────────
VALID_CARS: set[tuple[str, str]] = set()
SUPPORT_COUNTS_MM: dict[tuple[str, str], int] = {}
SUPPORT_COUNTS_MAKE: dict[str, int] = {}
MAKE_MODEL_MAPE: dict[tuple[str, str], float] = {}
MAKE_MAPE: dict[str, float] = {}

ACTIVE_MODELS = None           # dict of quantile models {lower, median, upper} or single model
ACTIVE_FRAMEWORK: str | None = None   # 'LightGBM' or 'XGBoost' or 'sklearn' or 'ensemble'
ACTIVE_IS_QUANTILE: bool = False
ACTIVE_PREPROCESSOR = None     # sklearn ColumnTransformer for baseline models
ACTIVE_IS_LOG_TARGET: bool | None = None  # Whether the active model predicts log(price)
ACTIVE_METADATA: dict | None = None       # Loaded metadata JSON for the active model
ACTIVE_MODEL_ID: str | None = None


# ── ModelContext ──────────────────────────────────────────────────────────────

@dataclass
class ModelContext:
    """Request-scoped container for everything needed to run a prediction."""
    models: Any = None
    framework: str | None = None
    is_quantile: bool = False
    is_log_target: bool | None = None
    preprocessor: Any = None
    metadata: dict | None = None
    model_id: str | None = None
    model_version: str = "unknown"


def _active_model_context() -> ModelContext:
    """Build a ModelContext from current global active state."""
    return ModelContext(
        models=ACTIVE_MODELS,
        framework=ACTIVE_FRAMEWORK,
        is_quantile=ACTIVE_IS_QUANTILE,
        is_log_target=ACTIVE_IS_LOG_TARGET,
        preprocessor=ACTIVE_PREPROCESSOR,
        metadata=ACTIVE_METADATA,
        model_id=ACTIVE_MODEL_ID,
        model_version=get_active_model_version(),
    )


# ── Helpers ───────────────────────────────────────────────────────────────────

def _norm_make_model(make: str, model: str) -> tuple[str, str]:
    return (str(make).strip().lower(), str(model).strip().lower())


def _sparse_to_dense(X):
    # Avoid importing scipy at import-time; older pickles may pass CSR matrices.
    return X.toarray() if hasattr(X, "toarray") else X


def _register_sparse_to_dense_for_unpickling() -> None:
    """Register compat symbols required by older sklearn pickles."""
    setattr(sys.modules["__main__"], "sparse_to_dense", _sparse_to_dense)

    try:
        from sklearn.utils import sparsefuncs as _sf
    except Exception:
        try:
            from sklearn.utils import _sparsefuncs as _sf
        except Exception:
            _sf = None

    if _sf is not None and not hasattr(_sf, "sparse_to_dense"):
        _sf.sparse_to_dense = _sparse_to_dense


def _detect_framework(info: dict) -> str:
    """Detect the model framework from registry info."""
    fw = info.get('framework')
    if fw:
        return fw
    model_type = info.get('model_type', '')
    mt_lower = model_type.lower()
    if 'xgboost' in mt_lower or 'xgb' in mt_lower:
        return 'XGBoost'
    if 'lightgbm' in mt_lower or 'lgbm' in mt_lower:
        return 'LightGBM'
    if 'huber' in mt_lower or 'ridge' in mt_lower or 'lasso' in mt_lower:
        return 'sklearn'
    if 'ensemble' in mt_lower:
        return 'ensemble'
    return 'unknown'


def _load_is_log_target_from_metadata(info: dict) -> bool | None:
    """Read is_log_target from a model metadata file if available."""
    meta_path_str = info.get("meta_path")
    if not meta_path_str:
        return None

    try:
        meta_path = resolve_registry_path(meta_path_str)
        if not meta_path.exists():
            return None
        with open(meta_path, "r", encoding="utf-8") as f:
            meta = json.load(f)

        if isinstance(meta, dict):
            if "is_log_target" in meta:
                return bool(meta["is_log_target"])
            train_cfg = meta.get("train_config")
            if isinstance(train_cfg, dict) and "is_log_target" in train_cfg:
                return bool(train_cfg["is_log_target"])
    except Exception:
        return None

    return None


def _ensemble_is_quantile(loaded: dict, info: dict, metadata: dict | None = None) -> bool:
    """Determine whether an ensemble artifact provides quantile predictions."""
    if isinstance(metadata, dict):
        quantiles = metadata.get("quantiles")
        if isinstance(quantiles, dict) and "median" in quantiles:
            return True

    base = loaded.get("base_models", {})
    if any(isinstance(v, dict) and "median" in v for v in base.values()):
        return True

    artifacts = info.get("artifacts", {}) if isinstance(info, dict) else {}
    for key, path_str in artifacts.items():
        if not path_str or not any(token in key for token in ("xgb", "lgbm", "quantile")):
            continue
        try:
            sub_model = joblib.load(resolve_registry_path(path_str))
        except Exception as e:
            logger.warning("Failed to inspect ensemble sub-model artifact %s: %s", path_str, e)
            continue
        if isinstance(sub_model, dict) and "median" in sub_model:
            return True

    return False


# ── Public API ────────────────────────────────────────────────────────────────

def load_valid_cars():
    """Load processed data on startup to build a lookup of valid
    (make, model) combinations for input validation."""
    global SUPPORT_COUNTS_MM, SUPPORT_COUNTS_MAKE
    VALID_CARS.clear()
    SUPPORT_COUNTS_MM = {}
    SUPPORT_COUNTS_MAKE = {}
    df = settings.load_data("processed")
    if "make" not in df.columns or "model" not in df.columns:
        logger.warning("Processed data missing make/model columns; validity + support counts disabled")
        return

    df_mm = df[["make", "model"]].copy()
    df_mm["make"] = df_mm["make"].astype(str).str.strip().str.lower()
    df_mm["model"] = df_mm["model"].astype(str).str.strip().str.lower()

    for make, model in df_mm.drop_duplicates().itertuples(index=False, name=None):
        VALID_CARS.add((make, model))

    SUPPORT_COUNTS_MM = (
        df_mm.groupby(["make", "model"], dropna=False)
        .size()
        .astype(int)
        .to_dict()
    )
    SUPPORT_COUNTS_MAKE = (
        df_mm.groupby(["make"], dropna=False)
        .size()
        .astype(int)
        .to_dict()
    )

    logger.info(
        "Loaded validity + support counts: %d make-model combos, %d makes",
        len(SUPPORT_COUNTS_MM),
        len(SUPPORT_COUNTS_MAKE),
    )


def _model_diagnostics_candidate_paths(info: dict | None = None) -> list:
    paths = []
    artifacts = (info or {}).get("artifacts") if isinstance(info, dict) else None
    if isinstance(artifacts, dict):
        for key in (
            "make_model_metrics_csv",
            "model_diagnostics_csv",
            "per_make_model_mape_csv",
            "make_model_mape_csv",
            "make_model_mape_cv_csv",
        ):
            if artifacts.get(key):
                paths.append(resolve_registry_path(artifacts[key]))

    paths.extend([
        settings.model_metrics_dir / "make_model_mape_cv.csv",
        settings.model_metrics_dir / "make_model_mape.csv",
        settings.model_metadata_dir / "make_model_mape.csv",
        settings.model_metadata_dir / "model_diagnostics_make_model.csv",
        settings.model_pickles_dir / "make_model_mape.csv",
    ])
    return paths


def _load_model_diagnostics_csv(info: dict | None = None) -> bool:
    global MAKE_MODEL_MAPE, MAKE_MAPE

    for path in _model_diagnostics_candidate_paths(info):
        if not path.exists():
            continue
        try:
            df = pd.read_csv(path)
            required = {"make", "model", "MAPE_pct"}
            if not required.issubset(set(df.columns)):
                logger.warning("Skipping diagnostics file with missing columns: %s", path)
                continue

            df = df[["make", "model", "MAPE_pct"]].copy()
            df["make_norm"] = df["make"].astype(str).str.strip().str.lower()
            df["model_norm"] = df["model"].astype(str).str.strip().str.lower()
            df["MAPE_pct"] = pd.to_numeric(df["MAPE_pct"], errors="coerce")
            df = df.dropna(subset=["MAPE_pct"])

            MAKE_MODEL_MAPE = {
                (row.make_norm, row.model_norm): float(row.MAPE_pct)
                for row in df.itertuples(index=False)
            }
            MAKE_MAPE = (
                df.groupby("make_norm")["MAPE_pct"].median().astype(float).to_dict()
            )
            logger.info(
                "Loaded per make-model MAPE diagnostics from %s: %d combos, %d makes",
                path,
                len(MAKE_MODEL_MAPE),
                len(MAKE_MAPE),
            )
            return True
        except Exception as e:
            logger.warning("Failed to load diagnostics file %s: %s", path, e)

    return False


def _build_dispersion_mape_fallback() -> bool:
    global MAKE_MODEL_MAPE, MAKE_MAPE

    try:
        df = settings.load_data("processed")
        if not {"make", "model", "price_egp"}.issubset(df.columns):
            return False

        diag = df[["make", "model", "price_egp"]].copy()
        diag["make_norm"] = diag["make"].astype(str).str.strip().str.lower()
        diag["model_norm"] = diag["model"].astype(str).str.strip().str.lower()
        diag["price_egp"] = pd.to_numeric(diag["price_egp"], errors="coerce")
        diag = diag.dropna(subset=["price_egp"])

        rows = []
        for (make, model), grp in diag.groupby(["make_norm", "model_norm"]):
            if len(grp) < 5:
                continue
            median_price = float(grp["price_egp"].median())
            if median_price <= 0:
                continue
            mape_proxy = float(
                np.mean(np.abs((grp["price_egp"] - median_price) / median_price)) * 100.0
            )
            rows.append((make, model, mape_proxy))

        MAKE_MODEL_MAPE = {(make, model): mape for make, model, mape in rows}
        if rows:
            df_rows = pd.DataFrame(rows, columns=["make", "model", "MAPE_pct"])
            MAKE_MAPE = (
                df_rows.groupby("make")["MAPE_pct"].median().astype(float).to_dict()
            )

        logger.warning(
            "No saved per make-model model MAPE diagnostics found; using price-dispersion MAPE fallback for %d combos. "
            "Export notebook 05 df_model_diag to models/metadata/make_model_mape.csv for exact model MAPE.",
            len(MAKE_MODEL_MAPE),
        )
        return bool(MAKE_MODEL_MAPE)
    except Exception as e:
        logger.warning("Failed to build fallback make-model MAPE diagnostics: %s", e)
        return False


def load_model_diagnostics():
    info = get_active_model_info()
    MAKE_MODEL_MAPE.clear()
    MAKE_MAPE.clear()
    if _load_model_diagnostics_csv(info):
        return
    _build_dispersion_mape_fallback()


def reload_active_model() -> dict[str, Any]:
    """Reload the active model and diagnostics after a registry change.

    Safe to call at runtime (e.g. after activation) without restarting
    the container. Returns a status dict for the caller.
    """
    logger.info("Reloading active model from registry...")
    try:
        load_active_model()
    except Exception as e:
        logger.error("Failed to reload active model: %s", e)
        return {"success": False, "error": f"Model reload failed: {e}"}

    try:
        load_model_diagnostics()
    except Exception as e:
        logger.error("Failed to reload model diagnostics: %s", e)
        return {"success": False, "error": f"Diagnostics reload failed: {e}"}

    # Clear SHAP caches so they rebuild for the new model on next request
    try:
        from app.services.explainability.explainer import clear_shap_cache
        clear_shap_cache()
    except Exception as e:
        logger.warning("Failed to clear SHAP cache during reload: %s", e)

    try:
        from app.services.explainability.ensemble_explainer import init_ensemble_explainer
        init_ensemble_explainer()
    except Exception as e:
        logger.error("Failed to init ensemble explainer during reload: %s", e)

    logger.info("Active model reload complete: %s", ACTIVE_MODEL_ID)
    return {"success": True, "model_id": ACTIVE_MODEL_ID, "framework": ACTIVE_FRAMEWORK}


def load_active_model():
    """Load the active model from the registry on startup.

    Handles both quantile models (dict of {lower, median, upper})
    and single sklearn-style models.
    """
    global ACTIVE_MODELS, ACTIVE_FRAMEWORK, ACTIVE_IS_QUANTILE, ACTIVE_PREPROCESSOR, ACTIVE_IS_LOG_TARGET
    global ACTIVE_METADATA, ACTIVE_MODEL_ID

    ACTIVE_MODELS = None
    ACTIVE_FRAMEWORK = None
    ACTIVE_IS_QUANTILE = False
    ACTIVE_PREPROCESSOR = None
    ACTIVE_IS_LOG_TARGET = None
    ACTIVE_METADATA = None
    ACTIVE_MODEL_ID = None

    info = get_active_model_info()
    if info is None:
        logger.warning("No active model found in registry.")
        return

    ACTIVE_MODEL_ID = info.get("model_id") or info.get("id")

    ACTIVE_FRAMEWORK = _detect_framework(info)
    pkl_path_str = info.get('pkl_path')

    if pkl_path_str is None:
        logger.warning("Active model has no pkl_path in registry.")
        return

    pkl_path = resolve_registry_path(pkl_path_str)

    if not pkl_path.exists():
        logger.warning(f"Model pickle not found: {pkl_path}")
        return

    _register_sparse_to_dense_for_unpickling()

    # Cache full metadata JSON for later use (confidence, factors)
    ACTIVE_METADATA = None
    meta_path_str = info.get("meta_path")
    if meta_path_str:
        try:
            meta_path = resolve_registry_path(meta_path_str)
            if meta_path.exists():
                with open(meta_path, "r", encoding="utf-8") as f:
                    loaded_meta = json.load(f)
                if isinstance(loaded_meta, dict):
                    ACTIVE_METADATA = loaded_meta
        except Exception as e:
            logger.warning("Failed to load active metadata: %s", e)

    loaded = joblib.load(pkl_path)

    if isinstance(loaded, dict) and 'median' in loaded:
        ACTIVE_MODELS = loaded
        ACTIVE_IS_QUANTILE = True
        logger.info(f"Loaded quantile model ({ACTIVE_FRAMEWORK}): "
                    f"keys={list(loaded.keys())}")
    elif isinstance(loaded, dict) and 'base_models' in loaded:
        # Ensemble model: dict with 'base_models' containing sub-models
        ACTIVE_MODELS = loaded
        base = loaded.get('base_models', {})
        ACTIVE_IS_QUANTILE = _ensemble_is_quantile(loaded, info, ACTIVE_METADATA)
        logger.info(
            f"Loaded ensemble model ({ACTIVE_FRAMEWORK}): "
            f"method={loaded.get('method')}, weights={loaded.get('weights')}, "
            f"base_keys={list(base.keys())}, is_quantile={ACTIVE_IS_QUANTILE}"
        )
    else:
        ACTIVE_MODELS = loaded
        ACTIVE_IS_QUANTILE = False
        logger.info(f"Loaded single model ({ACTIVE_FRAMEWORK}): "
                    f"{type(loaded).__name__}")

        if ACTIVE_FRAMEWORK == 'sklearn':
            preprocessor_path_str = info.get('artifacts', {}).get('preprocessor_pkl')
            if preprocessor_path_str:
                pp_path = resolve_registry_path(preprocessor_path_str)
                if pp_path.exists():
                    ACTIVE_PREPROCESSOR = joblib.load(pp_path)
                    logger.info(f"Loaded preprocessor from {pp_path}")

    ACTIVE_IS_LOG_TARGET = _load_is_log_target_from_metadata(info)
    if ACTIVE_IS_LOG_TARGET is None:
        ACTIVE_IS_LOG_TARGET = False if ACTIVE_IS_QUANTILE else True
        logger.warning(
            "Active model metadata missing is_log_target; defaulting to %s",
            ACTIVE_IS_LOG_TARGET,
        )


def check_car_validity(brand: str, model: str) -> bool:
    """Check if a (brand, model) combination exists in our processed data."""
    target = _norm_make_model(brand, model)
    return target in VALID_CARS


def check_make_known(brand: str) -> bool:
    """Check if the make (brand) exists in our processed data at all.

    Used for fallback routing: unknown makes get a hard validation error,
    while known makes with unsupported models are allowed to generalize.
    """
    make_norm = str(brand).strip().lower()
    return make_norm in SUPPORT_COUNTS_MAKE


def get_make_model_mape_pct(make: str, model: str) -> float | None:
    mk, md = _norm_make_model(make, model)
    if (mk, md) in MAKE_MODEL_MAPE:
        return MAKE_MODEL_MAPE[(mk, md)]
    return MAKE_MAPE.get(mk)


def is_model_loaded() -> bool:
    """Return True if an active model has been loaded."""
    return ACTIVE_MODELS is not None


def is_diagnostics_loaded() -> bool:
    return bool(MAKE_MODEL_MAPE or MAKE_MAPE)


def get_active_model_version() -> str:
    """Return the active model version string from the registry."""
    reg = load_registry()
    return reg.get('active_version', 'unknown')


# ── Per-model coverage ────────────────────────────────────────────────────────

_MODEL_COVERAGE_CACHE: dict[str, set[tuple[str, str]]] = {}


def _load_coverage_from_artifacts(info: dict) -> set[tuple[str, str]]:
    """Load supported (make, model) combos from a model's artifacts."""
    artifacts = info.get("artifacts", {}) if isinstance(info, dict) else {}
    combos: set[tuple[str, str]] = set()

    # 1. Try dedicated combo_set_json artifact
    combo_json = artifacts.get("combo_set_json")
    if combo_json:
        try:
            path = resolve_registry_path(combo_json)
            if path.exists():
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                for item in data.get("combos", []):
                    mk = str(item.get("make", "")).strip().lower()
                    md = str(item.get("model", "")).strip().lower()
                    if mk and md:
                        combos.add((mk, md))
                return combos
        except Exception:
            pass

    # 2. Fall back to make_model_mape_csv artifact
    mape_csv = artifacts.get("make_model_mape_csv")
    if mape_csv:
        try:
            path = resolve_registry_path(mape_csv)
            if path.exists():
                df = pd.read_csv(path)
                if {"make", "model"}.issubset(df.columns):
                    for _, row in df.iterrows():
                        mk = str(row["make"]).strip().lower()
                        md = str(row["model"]).strip().lower()
                        if mk and md:
                            combos.add((mk, md))
                    return combos
        except Exception:
            pass

    # 3. If no artifact available, return empty set (model coverage unknown)
    return combos


def get_model_coverage(model_id: str) -> set[tuple[str, str]]:
    """Return the set of (make, model) combos a registered model supports.

    Results are cached for the lifetime of the process.
    """
    if model_id in _MODEL_COVERAGE_CACHE:
        return _MODEL_COVERAGE_CACHE[model_id]

    reg = load_registry()
    info = reg.get("models", {}).get(model_id)
    if info is None:
        return set()

    combos = _load_coverage_from_artifacts(info)
    _MODEL_COVERAGE_CACHE[model_id] = combos
    return combos


def clear_model_coverage_cache() -> None:
    """Clear the per-model coverage cache (useful after registry changes)."""
    _MODEL_COVERAGE_CACHE.clear()


# ── Request-scoped model loading ──────────────────────────────────────────────

def load_model_context(model_id: str) -> ModelContext | None:
    """Load any registered model into a temporary ModelContext for prediction.

    This does **not** mutate global active state, so it is safe for concurrent
    fallback requests.
    """
    reg = load_registry()
    info = reg.get("models", {}).get(model_id)
    if info is None:
        logger.warning("Model '%s' not found in registry.", model_id)
        return None

    pkl_path_str = info.get('pkl_path')
    if pkl_path_str is None:
        logger.warning("Model '%s' has no pkl_path in registry.", model_id)
        return None

    pkl_path = resolve_registry_path(pkl_path_str)
    if not pkl_path.exists():
        logger.warning("Model pickle not found: %s", pkl_path)
        return None

    _register_sparse_to_dense_for_unpickling()

    # Load metadata
    metadata = None
    meta_path_str = info.get("meta_path")
    if meta_path_str:
        try:
            meta_path = resolve_registry_path(meta_path_str)
            if meta_path.exists():
                with open(meta_path, "r", encoding="utf-8") as f:
                    loaded_meta = json.load(f)
                if isinstance(loaded_meta, dict):
                    metadata = loaded_meta
        except Exception as e:
            logger.warning("Failed to load metadata for '%s': %s", model_id, e)

    framework = _detect_framework(info)
    is_log_target = _load_is_log_target_from_metadata(info)

    try:
        loaded = joblib.load(pkl_path)
    except Exception as e:
        logger.error("Failed to load model '%s' from %s: %s", model_id, pkl_path, e)
        return None

    is_quantile = False
    preprocessor = None

    if isinstance(loaded, dict) and 'median' in loaded:
        is_quantile = True
    elif isinstance(loaded, dict) and 'base_models' in loaded:
        is_quantile = _ensemble_is_quantile(loaded, info, metadata)
    else:
        if framework == 'sklearn':
            preprocessor_path_str = info.get('artifacts', {}).get('preprocessor_pkl')
            if preprocessor_path_str:
                pp_path = resolve_registry_path(preprocessor_path_str)
                if pp_path.exists():
                    preprocessor = joblib.load(pp_path)

    if is_log_target is None:
        is_log_target = False if is_quantile else True

    version = info.get("version", "unknown")

    return ModelContext(
        models=loaded,
        framework=framework,
        is_quantile=is_quantile,
        is_log_target=is_log_target,
        preprocessor=preprocessor,
        metadata=metadata,
        model_id=model_id,
        model_version=version,
    )
