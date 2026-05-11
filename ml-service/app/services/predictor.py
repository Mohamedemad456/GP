import logging
import sys

import pandas as pd
import numpy as np
import joblib
from pathlib import Path

from app.core.config import settings
from app.core.model_registry import (
    get_active_model_info, get_active_model_path, load_registry, resolve_registry_path,
)
from app.services.feature_builder import (
    build_features, prepare_for_xgboost, prepare_for_lightgbm, FEATURE_COLS,
)
def _sparse_to_dense(X):
    # Avoid importing scipy at import-time; older pickles may pass CSR matrices.
    return X.toarray() if hasattr(X, "toarray") else X


def _register_sparse_to_dense_for_unpickling() -> None:
    """Register compat symbols required by older sklearn pickles."""
    # Some saved pipelines reference __main__.sparse_to_dense
    setattr(sys.modules["__main__"], "sparse_to_dense", _sparse_to_dense)

    # sklearn internal module path changed across versions
    try:
        from sklearn.utils import sparsefuncs as _sf
    except Exception:
        try:
            from sklearn.utils import _sparsefuncs as _sf
        except Exception:
            _sf = None

    if _sf is not None and not hasattr(_sf, "sparse_to_dense"):
        _sf.sparse_to_dense = _sparse_to_dense

logger = logging.getLogger(__name__)

# Global state
VALID_CARS = set()
SUPPORT_COUNTS_MM: dict[tuple[str, str], int] = {}
SUPPORT_COUNTS_MAKE: dict[str, int] = {}
ACTIVE_MODELS = None       # dict of quantile models {lower, median, upper} or single model
ACTIVE_FRAMEWORK = None   # 'LightGBM' or 'XGBoost' or 'sklearn' or 'ensemble'
ACTIVE_IS_QUANTILE = False  # True if ACTIVE_MODELS is a dict of {lower, median, upper}
ACTIVE_PREPROCESSOR = None  # sklearn ColumnTransformer for baseline models
ACTIVE_IS_LOG_TARGET = None  # Whether the active model predicts log(price)
ACTIVE_METADATA: dict | None = None  # Loaded metadata JSON for the active model (if available)
ACTIVE_MODEL_ID: str | None = None

ACTIVE_SHAP_EXPLAINER = None
ACTIVE_SHAP_MODEL_REF = None
ACTIVE_SHAP_FRAMEWORK: str | None = None


def _norm_make_model(make: str, model: str) -> tuple[str, str]:
    return (str(make).strip().lower(), str(model).strip().lower())


def _load_is_log_target_from_metadata(info: dict) -> bool | None:
    """Read is_log_target from a model metadata file if available."""
    meta_path_str = info.get("meta_path")
    if not meta_path_str:
        return None

    try:
        meta_path = resolve_registry_path(meta_path_str)
        if not meta_path.exists():
            return None
        import json
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


def load_valid_cars():
    """Load processed data on startup to build a lookup of valid
    (make, model) combinations for input validation."""
    global SUPPORT_COUNTS_MM, SUPPORT_COUNTS_MAKE
    df = settings.load_data("processed")
    if "make" not in df.columns or "model" not in df.columns:
        logger.warning("Processed data missing make/model columns; validity + support counts disabled")
        return

    df_mm = df[["make", "model"]].copy()
    df_mm["make"] = df_mm["make"].astype(str).str.strip().str.lower()
    df_mm["model"] = df_mm["model"].astype(str).str.strip().str.lower()

    # Build validity set
    for make, model in df_mm.drop_duplicates().itertuples(index=False, name=None):
        VALID_CARS.add((make, model))

    # Build support counts
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


def _detect_framework(info: dict) -> str:
    """Detect the model framework from registry info."""
    fw = info.get('framework')
    if fw:
        return fw
    # Fallback: infer from model_type string
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


def load_active_model():
    """Load the active model from the registry on startup.

    Handles both quantile models (dict of {lower, median, upper})
    and single sklearn-style models.
    """
    global ACTIVE_MODELS, ACTIVE_FRAMEWORK, ACTIVE_IS_QUANTILE, ACTIVE_PREPROCESSOR, ACTIVE_IS_LOG_TARGET
    global ACTIVE_METADATA, ACTIVE_MODEL_ID

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

    # ── sklearn pickle compat ─────────────────────────────────────────────
    _register_sparse_to_dense_for_unpickling()

    # Cache full metadata JSON for later use (confidence, factors)
    ACTIVE_METADATA = None
    meta_path_str = info.get("meta_path")
    if meta_path_str:
        try:
            meta_path = resolve_registry_path(meta_path_str)
            if meta_path.exists():
                import json
                with open(meta_path, "r", encoding="utf-8") as f:
                    loaded_meta = json.load(f)
                if isinstance(loaded_meta, dict):
                    ACTIVE_METADATA = loaded_meta
        except Exception as e:
            logger.warning("Failed to load active metadata: %s", e)

    loaded = joblib.load(pkl_path)

    # Determine if this is a quantile dict or a single model
    if isinstance(loaded, dict) and 'median' in loaded:
        ACTIVE_MODELS = loaded
        ACTIVE_IS_QUANTILE = True
        logger.info(f"Loaded quantile model ({ACTIVE_FRAMEWORK}): "
                    f"keys={list(loaded.keys())}")
    else:
        ACTIVE_MODELS = loaded
        ACTIVE_IS_QUANTILE = False
        logger.info(f"Loaded single model ({ACTIVE_FRAMEWORK}): "
                    f"{type(loaded).__name__}")

        # For sklearn models, also load the preprocessor if available
        if ACTIVE_FRAMEWORK == 'sklearn':
            preprocessor_path_str = info.get('artifacts', {}).get('preprocessor_pkl')
            if preprocessor_path_str:
                pp_path = resolve_registry_path(preprocessor_path_str)
                if pp_path.exists():
                    ACTIVE_PREPROCESSOR = joblib.load(pp_path)
                    logger.info(f"Loaded preprocessor from {pp_path}")

    # Load metadata target transform info (if available)
    ACTIVE_IS_LOG_TARGET = _load_is_log_target_from_metadata(info)
    if ACTIVE_IS_LOG_TARGET is None:
        # Heuristic defaults: legacy baseline models were trained on log target.
        # Notebook 05 quantile models predict EGP directly.
        ACTIVE_IS_LOG_TARGET = False if ACTIVE_IS_QUANTILE else True
        logger.warning(
            "Active model metadata missing is_log_target; defaulting to %s",
            ACTIVE_IS_LOG_TARGET,
        )


def check_car_validity(brand: str, model: str) -> bool:
    """Check if a (brand, model) combination exists in our processed data."""
    target = _norm_make_model(brand, model)
    return target in VALID_CARS


def _pick_active_metrics_dict(meta: dict | None) -> dict | None:
    """Pick the best available metrics block from active model metadata."""
    if not isinstance(meta, dict):
        return None

    # Newer quantile metadata (notebook 05) stores framework-specific blocks
    if ACTIVE_FRAMEWORK == "XGBoost" and isinstance(meta.get("test_metrics_xgb"), dict):
        return meta.get("test_metrics_xgb")
    if ACTIVE_FRAMEWORK == "LightGBM" and isinstance(meta.get("test_metrics_lgbm"), dict):
        return meta.get("test_metrics_lgbm")

    # Fallback: use whatever exists
    if isinstance(meta.get("test_metrics_xgb"), dict):
        return meta.get("test_metrics_xgb")
    if isinstance(meta.get("test_metrics_lgbm"), dict):
        return meta.get("test_metrics_lgbm")

    # Legacy standardized metadata uses 'metrics'
    if isinstance(meta.get("metrics"), dict):
        return meta.get("metrics")

    return None


def _active_mape_pct() -> float | None:
    metrics = _pick_active_metrics_dict(ACTIVE_METADATA)
    if isinstance(metrics, dict) and "MAPE_pct" in metrics:
        try:
            return float(metrics["MAPE_pct"])
        except Exception:
            return None
    return None


def _degrade_label(label: str) -> str:
    if label == "high":
        return "medium"
    if label == "medium":
        return "low"
    return "low"


def _confidence_label_from_signals(
    *,
    mape_pct: float | None,
    n_support: int | None,
    width_pct: float | None,
    is_quantile: bool,
) -> str:
    """Pure confidence function so it can be unit-tested easily."""

    # Base on measured test MAPE (global or segment-level when we add it later)
    if mape_pct is None:
        label = "medium"
    elif mape_pct <= 14.0:
        label = "high"
    elif mape_pct <= 18.0:
        label = "medium"
    else:
        label = "low"

    # Penalize low support (make+model frequency in processed dataset)
    if n_support is not None:
        if n_support < 5:
            return "low"
        if n_support < 10:
            label = _degrade_label(label)
        elif n_support < 20 and label == "high":
            label = "medium"

    # Penalize very wide intervals (quantile models only)
    if is_quantile and width_pct is not None:
        if width_pct > 1.5:
            return "low"
        if width_pct > 1.0:
            label = _degrade_label(label)

    return label


def compute_confidence_label(*, make: str, model: str, prediction: dict) -> str:
    """Compute a confidence label for a given request.

    Uses:
      - active model global test MAPE (metadata)
      - make+model support count from processed dataset
      - interval width (when available)
    """
    mk, md = _norm_make_model(make, model)
    n_support = SUPPORT_COUNTS_MM.get((mk, md))

    fair = float(prediction.get("fair_price") or 0.0)
    lower = float(prediction.get("lower_price") or fair)
    upper = float(prediction.get("upper_price") or fair)
    denom = max(fair, 1.0)
    width_pct = (upper - lower) / denom

    return _confidence_label_from_signals(
        mape_pct=_active_mape_pct(),
        n_support=int(n_support) if n_support is not None else None,
        width_pct=float(width_pct) if width_pct is not None else None,
        is_quantile=bool(ACTIVE_IS_QUANTILE),
    )


def predict_price(
    make: str,
    model: str,
    year: int,
    mileage_km: float | None = None,
    transmission: str | None = None,
    fuel: str | None = None,
    location: str | None = None,
) -> dict:
    """Run the active model and return price predictions.

    Handles both quantile models (dict of {lower, median, upper})
    and single sklearn-style models.

    Returns dict with keys: fair_price, lower_price, upper_price,
    model_version, framework.
    """
    if ACTIVE_MODELS is None:
        raise RuntimeError("No active model loaded. Call load_active_model() first.")

    # Build features
    df_features = build_features(
        make=make, model=model, year=year,
        mileage_km=mileage_km, transmission=transmission,
        fuel=fuel, location=location,
    )

    if ACTIVE_IS_QUANTILE:
        return _predict_quantile(df_features)
    else:
        return _predict_single(df_features)


def _predict_quantile(df_features: pd.DataFrame) -> dict:
    """Predict using a quantile model dict {lower, median, upper}."""
    if ACTIVE_FRAMEWORK == 'XGBoost':
        df_prepared = prepare_for_xgboost(df_features)
        import xgboost as xgb
        dm = xgb.DMatrix(df_prepared)
        preds = {q: float(m.predict(dm)[0]) for q, m in ACTIVE_MODELS.items()}
    elif ACTIVE_FRAMEWORK == 'LightGBM':
        df_prepared = prepare_for_lightgbm(df_features)
        preds = {q: float(m.predict(df_prepared)[0]) for q, m in ACTIVE_MODELS.items()}
    else:
        # Fallback: try XGBoost then LightGBM
        try:
            df_prepared = prepare_for_xgboost(df_features)
            import xgboost as xgb
            dm = xgb.DMatrix(df_prepared)
            preds = {q: float(m.predict(dm)[0]) for q, m in ACTIVE_MODELS.items()}
        except Exception:
            df_prepared = prepare_for_lightgbm(df_features)
            preds = {q: float(m.predict(df_prepared)[0]) for q, m in ACTIVE_MODELS.items()}

    logger.debug("Raw predictions: %s", preds)

    # Convert to EGP if model was trained on log(price)
    if ACTIVE_IS_LOG_TARGET:
        logger.debug("Predictions are log-space; applying exp().")
        # Clip log-space to avoid exp overflow and absurd magnitudes
        for key in preds:
            if preds[key] > 18:
                logger.warning("Prediction %s=%s exceeds safe log range; clipping", key, preds[key])
                preds[key] = 18
            elif preds[key] < -5:
                logger.warning("Prediction %s=%s below safe log range; clipping", key, preds[key])
                preds[key] = -5

        fair_price = float(np.exp(preds.get("median", 0.0)))
        lower_price = float(np.exp(preds.get("lower", np.log(max(fair_price, 1.0)))))
        upper_price = float(np.exp(preds.get("upper", np.log(max(fair_price, 1.0)))))
    else:
        # Predictions are already in EGP
        fair_price = float(preds.get("median", 0.0))
        lower_price = float(preds.get("lower", fair_price))
        upper_price = float(preds.get("upper", fair_price))

        # Prevent negative prices
        fair_price = max(fair_price, 0.0)
        lower_price = max(lower_price, 0.0)
        upper_price = max(upper_price, 0.0)

    # Enforce monotonicity
    lower_price = min(lower_price, fair_price)
    upper_price = max(upper_price, fair_price)

    reg = load_registry()
    model_version = reg.get('active_version', 'unknown')

    return {
        'fair_price': fair_price,
        'lower_price': lower_price,
        'upper_price': upper_price,
        'model_version': model_version,
        'framework': ACTIVE_FRAMEWORK,
    }


def _predict_single(df_features: pd.DataFrame) -> dict:
    """Predict using a single sklearn-style model.

    Produces a point estimate and derives a ±15% negotiation range
    since there are no quantile bounds.
    """
    if ACTIVE_FRAMEWORK == 'sklearn':
        # sklearn models are typically Pipelines that include the
        # ColumnTransformer — pass raw features directly.
        # Add car_age for backward compat with v1.0.0 models.
        df_raw = df_features.copy()
        current_year = pd.Timestamp.now().year
        df_raw['car_age'] = current_year - df_raw['year']
        pred_log = float(ACTIVE_MODELS.predict(df_raw)[0])
    elif ACTIVE_FRAMEWORK == 'XGBoost':
        df_prepared = prepare_for_xgboost(df_features)
        import xgboost as xgb
        dm = xgb.DMatrix(df_prepared)
        pred_log = float(ACTIVE_MODELS.predict(dm)[0])
    elif ACTIVE_FRAMEWORK == 'LightGBM':
        df_prepared = prepare_for_lightgbm(df_features)
        pred_log = float(ACTIVE_MODELS.predict(df_prepared)[0])
    else:
        # Unknown framework — try sklearn-style first
        try:
            df_raw = df_features.copy()
            current_year = pd.Timestamp.now().year
            df_raw['car_age'] = current_year - df_raw['year']
            pred_log = float(ACTIVE_MODELS.predict(df_raw)[0])
        except Exception:
            df_prepared = prepare_for_xgboost(df_features)
            pred_log = float(ACTIVE_MODELS.predict(df_prepared)[0])

    fair_price = float(np.exp(pred_log)) if ACTIVE_IS_LOG_TARGET else float(pred_log)
    # Derive negotiation range from point estimate (±15%)
    lower_price = fair_price * 0.85
    upper_price = fair_price * 1.15

    reg = load_registry()
    model_version = reg.get('active_version', 'unknown')

    return {
        'fair_price': fair_price,
        'lower_price': lower_price,
        'upper_price': upper_price,
        'model_version': model_version,
        'framework': ACTIVE_FRAMEWORK,
    }


def _get_explain_model():
    """Return the model object to explain with SHAP."""
    if ACTIVE_MODELS is None:
        return None
    if isinstance(ACTIVE_MODELS, dict) and "median" in ACTIVE_MODELS:
        return ACTIVE_MODELS["median"]
    return ACTIVE_MODELS


def _get_or_build_shap_explainer():
    """Build (and cache) a SHAP explainer for the active model."""
    global ACTIVE_SHAP_EXPLAINER, ACTIVE_SHAP_MODEL_REF, ACTIVE_SHAP_FRAMEWORK

    model_obj = _get_explain_model()
    if model_obj is None:
        return None

    if ACTIVE_FRAMEWORK not in {"XGBoost", "LightGBM"}:
        return None

    if ACTIVE_SHAP_EXPLAINER is not None and ACTIVE_SHAP_MODEL_REF is model_obj and ACTIVE_SHAP_FRAMEWORK == ACTIVE_FRAMEWORK:
        return ACTIVE_SHAP_EXPLAINER

    try:
        import shap

        explainer = shap.TreeExplainer(model_obj)
        ACTIVE_SHAP_EXPLAINER = explainer
        ACTIVE_SHAP_MODEL_REF = model_obj
        ACTIVE_SHAP_FRAMEWORK = ACTIVE_FRAMEWORK
        logger.info("Initialized SHAP TreeExplainer for %s", ACTIVE_FRAMEWORK)
        return explainer
    except Exception as e:
        logger.warning("Failed to initialize SHAP explainer: %s", e)
        ACTIVE_SHAP_EXPLAINER = None
        ACTIVE_SHAP_MODEL_REF = None
        ACTIVE_SHAP_FRAMEWORK = None
        return None


def compute_price_factors(
    *,
    make: str,
    model: str,
    year: int,
    mileage_km: float | None = None,
    transmission: str | None = None,
    fuel: str | None = None,
    location: str | None = None,
    top_k: int = 5,
) -> list[dict] | None:
    """Compute SHAP-based price factors for the request.

    Returns list of dicts: {factor, direction, description}.
    Only supported for tree models (XGBoost/LightGBM). Returns None on failure.
    """
    explainer = _get_or_build_shap_explainer()
    if explainer is None:
        return None

    try:
        df_features = build_features(
            make=make,
            model=model,
            year=year,
            mileage_km=mileage_km,
            transmission=transmission,
            fuel=fuel,
            location=location,
        )

        raw_row = df_features.iloc[0].to_dict()

        if ACTIVE_FRAMEWORK == "XGBoost":
            X = prepare_for_xgboost(df_features)
        elif ACTIVE_FRAMEWORK == "LightGBM":
            X = prepare_for_lightgbm(df_features)
        else:
            return None

        shap_values = explainer.shap_values(X)
        # SHAP API may return list for some models; normalize
        if isinstance(shap_values, list) and len(shap_values) > 0:
            shap_values = shap_values[0]

        shap_arr = np.asarray(shap_values)
        if shap_arr.ndim == 2:
            shap_row = shap_arr[0]
        else:
            shap_row = shap_arr

        cols = list(X.columns)
        val_row = X.iloc[0].to_dict()

        # Baseline meaning: SHAP values represent contribution relative to the model's
        # expected value (i.e., a typical example from the training distribution).
        baseline = getattr(explainer, "expected_value", None)
        try:
            if isinstance(baseline, (list, tuple, np.ndarray)):
                baseline = float(np.asarray(baseline).ravel()[0])
            elif baseline is not None:
                baseline = float(baseline)
        except Exception:
            baseline = None

        # Avoid non-actionable identifiers
        excluded = {"make", "model"}
        items = []
        for i, col in enumerate(cols):
            if col in excluded:
                continue
            sv = float(shap_row[i])
            items.append((col, sv))

        items.sort(key=lambda t: abs(t[1]), reverse=True)
        items = items[: max(1, int(top_k))]

        def _pretty_name(s: str) -> str:
            return str(s).replace("_", " ").strip()

        def _pretty_value(v) -> str:
            if v is None:
                return "unknown"
            # pandas uses nan for missing
            try:
                if isinstance(v, float) and np.isnan(v):
                    return "unknown"
            except Exception:
                pass
            # Avoid showing trailing .0 for ints
            if isinstance(v, (int, np.integer)):
                return str(int(v))
            if isinstance(v, (float, np.floating)):
                if float(v).is_integer():
                    return str(int(v))
                return f"{float(v):.2f}"
            return str(v)

        def _format_value(col: str, v) -> str:
            if v is None:
                return "unknown"
            try:
                if isinstance(v, float) and np.isnan(v):
                    return "unknown"
            except Exception:
                pass

            if col == "mileage_km":
                try:
                    return f"{float(v):,.0f} km"
                except Exception:
                    return f"{_pretty_value(v)} km"
            if col == "mileage_per_year":
                try:
                    return f"{float(v):,.0f} km/yr"
                except Exception:
                    return f"{_pretty_value(v)} km/yr"
            if col == "engine_cc":
                try:
                    return f"{float(v):,.0f} cc"
                except Exception:
                    return f"{_pretty_value(v)} cc"
            if col == "horsepower":
                try:
                    return f"{float(v):,.0f} hp"
                except Exception:
                    return f"{_pretty_value(v)} hp"
            if col == "year":
                try:
                    return str(int(float(v)))
                except Exception:
                    return _pretty_value(v)
            return _pretty_value(v)

        factors: list[dict] = []
        for col, sv in items:
            direction = "positive" if sv >= 0 else "negative"
            # Prefer human-readable (pre-encoding) values for categoricals
            display_val = raw_row.get(col)
            if display_val is None or (isinstance(display_val, float) and np.isnan(display_val)):
                display_val = val_row.get(col)

            name = _pretty_name(col)
            val_str = _format_value(col, display_val)

            verb = "increases" if sv >= 0 else "decreases"
            if ACTIVE_IS_LOG_TARGET:
                desc = f"{name}: {val_str}. In the model, this {verb} the estimated price."
            else:
                delta = abs(sv)
                desc = f"{name}: {val_str}. In the model, this {verb} the estimated price by about EGP {delta:,.0f}."

            factors.append({
                "factor": col,
                "direction": direction,
                "description": desc,
            })

        return factors
    except Exception as e:
        logger.warning("Failed to compute SHAP price factors: %s", e)
        return None
