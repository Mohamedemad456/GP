"""
explainer.py — SHAP explanation logic and warm-up.

Extracted from predictor.py to isolate SHAP concerns from prediction logic.
"""
import logging

import numpy as np

import app.services.model.model_state as _ms

logger = logging.getLogger(__name__)

# ── Cached SHAP state ─────────────────────────────────────────────────────────
ACTIVE_SHAP_EXPLAINER = None
ACTIVE_SHAP_MODEL_REF = None
ACTIVE_SHAP_FRAMEWORK: str | None = None


# ── Internal helpers ──────────────────────────────────────────────────────────

def _get_explain_model():
    """Return the model object to explain with SHAP."""
    if _ms.ACTIVE_MODELS is None:
        return None
    if isinstance(_ms.ACTIVE_MODELS, dict) and "median" in _ms.ACTIVE_MODELS:
        return _ms.ACTIVE_MODELS["median"]
    return _ms.ACTIVE_MODELS


def _get_or_build_shap_explainer():
    """Build (and cache) a SHAP explainer for the active model."""
    global ACTIVE_SHAP_EXPLAINER, ACTIVE_SHAP_MODEL_REF, ACTIVE_SHAP_FRAMEWORK

    model_obj = _get_explain_model()
    if model_obj is None:
        return None

    # Skip SHAP for ensemble models — would need libgomp in Docker image
    if _ms.ACTIVE_FRAMEWORK == "ensemble":
        return None

    if _ms.ACTIVE_FRAMEWORK not in {"XGBoost", "LightGBM"}:
        return None

    if (ACTIVE_SHAP_EXPLAINER is not None
            and ACTIVE_SHAP_MODEL_REF is model_obj
            and ACTIVE_SHAP_FRAMEWORK == _ms.ACTIVE_FRAMEWORK):
        return ACTIVE_SHAP_EXPLAINER

    try:
        import shap

        explainer = shap.TreeExplainer(model_obj)
        ACTIVE_SHAP_EXPLAINER = explainer
        ACTIVE_SHAP_MODEL_REF = model_obj
        ACTIVE_SHAP_FRAMEWORK = _ms.ACTIVE_FRAMEWORK
        logger.info("Initialized SHAP TreeExplainer for %s", _ms.ACTIVE_FRAMEWORK)
        return explainer
    except Exception as e:
        logger.warning("Failed to initialize SHAP explainer: %s", e)
        ACTIVE_SHAP_EXPLAINER = None
        ACTIVE_SHAP_MODEL_REF = None
        ACTIVE_SHAP_FRAMEWORK = None
        return None


# ── Public API ────────────────────────────────────────────────────────────────

def warm_up_shap() -> bool:
    """Run a real SHAP explanation at startup to avoid first-request latency.

    Picks the highest-support make/model pair from SUPPORT_COUNTS_MM
    and exercises the full shap_values() path.

    Returns True if warm-up succeeded, False otherwise.
    Startup should call this synchronously.  If it fails, log warning
    and continue — do NOT crash the server.
    """
    from app.services.prediction.feature_builder import build_features, prepare_for_xgboost, prepare_for_lightgbm

    explainer = _get_or_build_shap_explainer()
    if explainer is None:
        logger.warning("SHAP warm-up skipped: explainer could not be built.")
        return False

    if not _ms.SUPPORT_COUNTS_MM:
        logger.warning("SHAP warm-up skipped: no support counts loaded.")
        return False

    sample_key = max(_ms.SUPPORT_COUNTS_MM, key=_ms.SUPPORT_COUNTS_MM.get)
    raw_make, raw_model = sample_key  # already lowercased

    try:
        df = build_features(
            make=raw_make, model=raw_model,
            year=2015, mileage_km=80000,
        )
        if _ms.ACTIVE_FRAMEWORK == "XGBoost":
            X = prepare_for_xgboost(df)
        else:
            X = prepare_for_lightgbm(df)
        explainer.shap_values(X)
        logger.info("SHAP warm-up completed successfully.")
        return True
    except Exception as e:
        logger.warning("SHAP warm-up failed: %s", e)
        return False


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
    from app.services.prediction.feature_builder import build_features, prepare_for_xgboost, prepare_for_lightgbm
    from app.services.explainability.factor_expert import explain_factor

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

        if _ms.ACTIVE_FRAMEWORK == "XGBoost":
            X = prepare_for_xgboost(df_features)
        elif _ms.ACTIVE_FRAMEWORK == "LightGBM":
            X = prepare_for_lightgbm(df_features)
        else:
            return None

        shap_values = explainer.shap_values(X)
        if isinstance(shap_values, list) and len(shap_values) > 0:
            shap_values = shap_values[0]

        shap_arr = np.asarray(shap_values)
        if shap_arr.ndim == 2:
            shap_row = shap_arr[0]
        else:
            shap_row = shap_arr

        cols = list(X.columns)
        val_row = X.iloc[0].to_dict()

        baseline = getattr(explainer, "expected_value", None)
        try:
            if isinstance(baseline, (list, tuple, np.ndarray)):
                baseline = float(np.asarray(baseline).ravel()[0])
            elif baseline is not None:
                baseline = float(baseline)
        except Exception:
            baseline = None

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
            try:
                if isinstance(v, float) and np.isnan(v):
                    return "unknown"
            except Exception:
                pass
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
            display_val = raw_row.get(col)
            if display_val is None or (isinstance(display_val, float) and np.isnan(display_val)):
                display_val = val_row.get(col)

            try:
                expert = explain_factor(
                    factor=col,
                    value=display_val,
                    direction=direction,
                    make=raw_row.get("make"),
                    model=raw_row.get("model"),
                    raw_row=raw_row,
                )
                desc = expert.get("description") or ""
            except Exception as e:
                logger.warning("Expert explanation failed for %s: %s", col, e)
                name = _pretty_name(col)
                val_str = _format_value(col, display_val)
                desc = (
                    f"{name}: {val_str}. "
                    f"In this case, the model treats this as {'price-supportive' if direction == 'positive' else 'less price-supportive'}, "
                    f"so it tends to {'increase' if direction == 'positive' else 'decrease'} the estimated market value."
                )

            factors.append({
                "factor": col,
                "direction": direction,
                "description": desc,
            })

        return factors
    except Exception as e:
        logger.warning("Failed to compute SHAP price factors: %s", e)
        return None
