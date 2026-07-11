# Chapter 4 — ML/AI Service Implementation Knowledge (Extracted from Codebase)

> **Purpose:** This document contains precise, code-sourced implementation details for Chapter 4.1 (Software Architecture) and Chapter 4.2 (Workflow / Pseudocode) of the GP report. Every value, threshold, formula, and file path is taken directly from the codebase.

---

## Table of Contents

- [Section A: ML Model Architecture](#a-ml-model-architecture)
- [Section B: Confidence Label & Negotiation Interval Logic](#b-confidence-label--negotiation-interval-logic)
- [Section C: Prediction Flow (Single & Batch)](#c-prediction-flow-single--batch)
- [Section D: SHAP Explainability & Price Factors](#d-shap-explainability--price-factors)
- [Section E: Model Registry & Promotion Gate](#e-model-registry--promotion-gate)
- [Section F: Retrain Pipeline](#f-retrain-pipeline)
- [Section G: Data Pipeline & Feature Engineering](#g-data-pipeline--feature-engineering)
- [Section H: AI Service (Chatbot)](#h-ai-service-chatbot)
- [Section I: System Communication & Admin Dashboard](#i-system-communication--admin-dashboard)

---

## A. ML Model Architecture

### A0. ML Service Layered Architecture

The ML service is organized into four horizontal layers. Each layer depends only on layers below it, and the **serving layer (API + predictor) is deliberately model-independent** — it does not know whether the active model is XGBoost, LightGBM, an ensemble, or a sklearn linear model.

```
┌─────────────────────────────────────────────────────────────┐
│  API Layer        (predict.py, health.py, admin.py)        │
│  - HTTP routing, input validation, response building         │
│  - Prometheus metrics, structured audit logging              │
├─────────────────────────────────────────────────────────────┤
│  Prediction Orchestration  (predictor.py)                  │
│  - predict_price()  →  predict_full()                      │
│  - Delegates to quantile / ensemble / single paths         │
│  - Model-INDEPENDENT: only sees ModelContext               │
├─────────────────────────────────────────────────────────────┤
│  Services Layer   (feature_builder, confidence, intervals) │
│  - Feature engineering (spec lookup, encoding, derivation)   │
│  - Confidence label computation (MAPE + support + width)       │
│  - Negotiation range (symmetric band around fair price)    │
│  - SHAP explainability (TreeExplainer + factor expert)      │
├─────────────────────────────────────────────────────────────┤
│  Core / State Layer   (model_state, model_registry)       │
│  - Global active model state (ACTIVE_MODELS, etc.)          │
│  - ModelContext dataclass (framework-agnostic container)    │
│  - Registry JSON read/write, promotion, path resolution    │
│  - Valid car combos, support counts, per-car MAPE diagnostics  │
├─────────────────────────────────────────────────────────────┤
│  Data / Config Layer   (config.py, logging_config.py)       │
│  - Pydantic Settings (env-driven paths, DB config)           │
│  - CSV / Parquet / JSON loaders                            │
│  - Structured JSON logging + JSONL audit stream            │
└─────────────────────────────────────────────────────────────┘
```

**Key design principle:** The `ModelContext` dataclass (`@/home/mo-seif/Documents/GP/ml-service/app/services/model/model_state.py:41-65`) is the **only** object passed downward from the state layer to the prediction layer. It contains:

```python
@dataclass
class ModelContext:
    models: Any = None           # loaded estimator(s)
    framework: str | None = None   # 'XGBoost' | 'LightGBM' | 'sklearn' | 'ensemble'
    is_quantile: bool = False
    is_log_target: bool | None = None
    preprocessor: Any = None   # sklearn ColumnTransformer
    metadata: dict | None = None
    model_id: str | None = None
    model_version: str = "unknown"
```

The predictor uses only two fields to decide execution path:
1. `ctx.framework == 'ensemble'` → `_predict_ensemble()`
2. `ctx.is_quantile` → `_predict_quantile()`
3. Otherwise → `_predict_single()`

This means a new model family (e.g., CatBoost, Neural Network) can be added by:
1. Implementing a new `_predict_*()` helper
2. Adding framework detection in `_detect_framework()`
3. Updating `model_state.py` loader logic

**No API endpoint or feature engineering code needs to change.**

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/services/prediction/predictor.py:1-410`, `@/home/mo-seif/Documents/GP/ml-service/app/services/model/model_state.py:1-200`

### A1. Model Family and Inference Pipeline

The ML service supports three model archetypes. At startup, `load_active_model()` in `model_state.py` detects which archetype is stored in the active model's pickle file by inspecting the loaded object and the registry metadata.

#### Archetype 1: Quantile Models

Loaded as a Python `dict` with keys `{lower, median, upper}` (serving aliases) or `{q05, q10, q50, q90, q95}` (full quantiles). Used by XGBoost and LightGBM.

**Detection logic:**
```python
if isinstance(loaded, dict) and 'median' in loaded:
    ACTIVE_MODELS = loaded
    ACTIVE_IS_QUANTILE = True
```

At inference time:
- **XGBoost:** Features are label-encoded via `prepare_for_xgboost()`, then wrapped in `xgb.DMatrix(df_prepared)`. Each quantile sub-model calls `predict(dm)`.
- **LightGBM:** Features are cast to `category` dtype via `prepare_for_lightgbm()`. Each quantile sub-model calls `predict(df_prepared)`.

**Log-target handling:** If `is_log_target=True`, raw predictions are clipped to `[-5, 18]` to avoid overflow, then exponentiated via `np.exp()`. The safe range `[-5, 18]` maps to roughly `[0.01 EGP, 65 million EGP]`.

**Monotonicity enforcement:** After exponentiation (or directly for non-log targets), the predictor ensures `lower_price ≤ fair_price ≤ upper_price`.

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/services/prediction/predictor.py:152-200`

#### Archetype 2: Ensemble Models

Loaded as a `dict` with key `base_models` containing **path-strings** to sub-model pickles. The active production ensemble uses:
- **XGBoost (weight 0.55)** + **LightGBM (weight 0.45)**
- **Method:** "Weighted Average"

**Detection logic:**
```python
elif isinstance(loaded, dict) and 'base_models' in loaded:
    ACTIVE_MODELS = loaded
    ACTIVE_IS_QUANTILE = _ensemble_is_quantile(loaded, info, ACTIVE_METADATA)
```

The `_ensemble_is_quantile()` function determines whether the ensemble produces quantile predictions by:
1. Checking metadata for a `"quantiles"` dict containing `"median"`
2. Inspecting `base_models` values for nested dicts with `"median"`
3. Loading artifact pickles and checking for `"median"` key (lazy inspection)

At inference time, `_predict_ensemble()`:
1. Loads each sub-model pickle from path-strings (lazy, cached)
2. Predicts quantiles independently per sub-model
3. Aggregates via weighted average: `ensemble_pred = Σ(w_i × pred_i) / Σ(w_i)`
4. Returns `{fair_price, lower_price, upper_price, sub_model_predictions, model_version, framework}`

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/services/model/model_state.py:138-162`, `@/home/mo-seif/Documents/GP/ml-service/app/services/prediction/predictor.py:200-260`

#### Archetype 3: Single Models (sklearn)

Loaded as a raw sklearn estimator (e.g., `HuberRegressor`, `Ridge`, `Lasso`). May include a `ColumnTransformer` preprocessor saved alongside the model pickle.

**Detection logic:**
```python
else:
    ACTIVE_MODELS = loaded
    ACTIVE_IS_QUANTILE = False
```

At inference time:
1. Feature builder creates the feature DataFrame
2. `car_age = current_year - year` is appended
3. If a preprocessor exists, `preprocessor.transform()` is applied
4. The estimator's `predict()` returns a single point estimate
5. `fair_price = prediction`, `lower_price = upper_price = fair_price` (no interval)

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/services/prediction/predictor.py:376-398`

#### Framework Detection

`_detect_framework()` inspects registry info in this priority:
1. `info.get('framework')` if explicitly set
2. `info.get('model_type')` string matching: `'xgboost'/'xgb'` → XGBoost, `'lightgbm'/'lgbm'` → LightGBM, `'huber'/'ridge'/'lasso'` → sklearn, `'ensemble'` → ensemble
3. Falls back to `'unknown'`

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/services/model/model_state.py:95-111`

### A2. Feature Engineering Approach and Spec-Merge

Feature engineering is performed at **inference time** by `feature_builder.py`. This ensures training-inference consistency: the exact same transformations (encoding, dtype casting, derived features) applied during notebook training are applied at serving time.

#### Feature Column Contract

The feature set is a **hard contract** between training notebooks and the serving layer. Any change requires synchronized updates to both.

- **Categorical (`CAT_COLS`):** `make`, `model`, `transmission`, `fuel`, `location`, `body_type`, `drivetrain`, `brand_origin`, `car_segment`
- **Numerical (`NUM_COLS`):** `year`, `mileage_km`, `mileage_per_year`, `engine_cc`, `horsepower`, `seating_capacity`

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/services/prediction/feature_builder.py:31-35`

#### Spec Lookup Fallback Chain

Raw API input only provides `brand`, `model`, `year`, and optional `mileage_km`, `transmission`, `fuel`, `location`. Missing spec fields (`engine_cc`, `horsepower`, `body_type`, `drivetrain`, `brand_origin`, `car_segment`, `seating_capacity`) are populated from a lookup CSV: `car_specs_lookup_full_cleaned.fixed.csv`.

The lookup uses a **4-priority fallback chain:**

1. **Priority 1:** Exact `make + model + year` match
2. **Priority 2:** Same `make + model`, nearest year (absolute difference)
3. **Priority 3:** Same `make`, aggregate median/mode across all models and years for that make
4. **Priority 4:** Global defaults (applied by the caller after `build_features()` returns)

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/services/prediction/feature_builder.py:124-155`

#### Safe Defaults for Missing Values

When all lookup priorities fail, the feature builder returns these defaults:

| Field | Default | Rationale |
|-------|---------|-----------|
| `engine_cc` | 1500 | Most common Egyptian market engine size |
| `horsepower` | 100 | Conservative average for mid-range sedans |
| `seating_capacity` | 5 | Standard sedan/hatchback capacity |
| `body_type` | "Sedan" | Most common body type in dataset |
| `drivetrain` | "FWD" | Front-wheel drive dominates Egyptian market |
| `brand_origin` | "other" | Neutral fallback for unknown origins |
| `car_segment` | "family" | Largest segment in training data |
| `transmission` | "Manual" | Conservative fallback (older cars) |
| `fuel` | "petrol" | Dominant fuel type in Egypt |
| `location` | "Cairo" | Largest market, price baseline |
| `mileage_km` | 50000 | Moderate usage assumption |
| `mileage_per_year` | 10000 | ~27 km/day, typical urban driving |

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/services/prediction/feature_builder.py:235-241`

#### Derived Features

- `mileage_per_year = mileage_km / max(current_year - year, 1)`
  - Prevents division by zero for cars from the current year
  - Captures usage intensity: a 2018 car with 200k km is high-usage; a 2010 car with 200k km is average

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/services/prediction/feature_builder.py:227-232`

#### Input Validation

Before feature engineering:
- `year >= 1950` and `year <= current_year + 1` (prevents future-year typos)
- `mileage_km >= 0` (if provided)

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/services/prediction/feature_builder.py:160-168`

#### Enum Normalization

Raw API values are canonicalized to training-vocabulary values:

| API Value | Normalized Value |
|-----------|-----------------|
| "auto", "automatic", "cvt", "dct", "dsg" | "Automatic" |
| "manual", "stick", "mt" | "Manual" |
| "petrol", "gasoline", "gas" | "petrol" |
| "diesel" | "diesel" |
| "hybrid" | "hybrid" |
| "electric", "ev" | "electric" |

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/services/prediction/feature_builder.py:87-120`

#### Framework-Specific Preparation

After feature engineering, the feature matrix must be prepared differently for each framework:

**XGBoost (`prepare_for_xgboost()`):**
1. Applies `LabelEncoder` to each categorical column
2. Fit on training data (loaded from `label_encoders.pkl`)
3. Unseen categories mapped to `"__UNKNOWN__"` → encoded as `-1`
4. Returns fully numeric DataFrame

**LightGBM (`prepare_for_lightgbm()`):**
1. Casts categorical columns to pandas `category` dtype
2. LightGBM handles categorical splits natively
3. No encoding needed

**sklearn (`prepare_for_sklearn()`):**
1. Appends `car_age = current_year - year`
2. If a `ColumnTransformer` was saved with the model, it is applied here
3. Otherwise passes numeric features through

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/services/prediction/feature_builder.py:287-310`, `@/home/mo-seif/Documents/GP/ml-service/app/services/prediction/predictor.py:376-398`

### A3. Evaluation Metrics Methodology

The retrain pipeline computes a comprehensive set of evaluation metrics at global, per-tier, per-make, and per-make-model granularities.

#### Global Holdout Metrics

Computed on the held-out test set after training:

| Metric | Symbol |
|--------|--------|
| **MAE** | Mean Absolute Error |
| **RMSE** | Root Mean Squared Error | 
| **R²** | Coefficient of Determination | 
| **MAPE_pct** | Mean Absolute Percentage Error | 
| **Within_10pct** | Accuracy within ±10% | 
| **Within_15pct** | Accuracy within ±15% | 
| **Coverage_80_pct** | 80% interval coverage | 
| **Coverage_90_pct** | 90% interval coverage | 
| **Mean_width_pct** | Mean relative interval width | 

**Key implementation detail:** MAPE uses `max(|y_true|, 1e-9)` as denominator to prevent division-by-zero on near-zero prices.

**Source:** `@/home/mo-seif/Documents/GP/ml-service/scripts/retrain/evaluation.py:12-78`, `@/home/mo-seif/Documents/GP/ml-service/scripts/retrain/trainer.py:24-46`

#### Per-Price-Tier Metrics

The test set is segmented by true price into tiers. The tier bins are defined in `constants.py`:

| Tier Label | Price Range (EGP) |
|------------|-------------------|
| Budget | ≤ 200,000 |
| Mid-range | 200,001 – 400,000 |
| Premium | 400,001 – 800,000 |
| Luxury | > 800,000 |

For each tier, the same 9 metrics are computed independently. This reveals whether the model performs differently across market segments (e.g., luxury cars may have higher MAPE due to sparse data).

**Source:** `@/home/mo-seif/Documents/GP/ml-service/scripts/retrain/evaluation.py:89-145`, `@/home/mo-seif/Documents/GP/ml-service/scripts/retrain/constants.py`

#### Per-Make and Per-Make-Model Metrics

These granularities are critical for the confidence system and diagnostics.

- **Per-make:** Group by `make`, compute metrics. Minimum `5` rows required for reporting.
- **Per-make-model:** Group by `(make, model)`, compute metrics. Minimum `5` rows required for reporting.

Each per-make-model row contains:
- `make`, `model`, `n_test` (test set count)
- `supported` flag: `True` if `n_test >= 5`
- `MAE`, `RMSE`, `R2`, `MAPE_pct`, `mean_price`

The `supported` flag is central to the confidence system: a combo with `n_test < 5` has noisy MAPE estimates and receives confidence degradation.

**Source:** `@/home/mo-seif/Documents/GP/ml-service/scripts/retrain/evaluation.py:147-216`

### A4. Per-Make-Model MAPE Diagnostics

At startup, `load_model_diagnostics()` populates three global dictionaries:

1. **`MAKE_MODEL_MAPE`:** `dict[(make_lower, model_lower), MAPE_pct]` — per exact combo
2. **`MAKE_MAPE`:** `dict[make_lower, MAPE_pct]` — per make (aggregated)

#### Loading Priority

**Step 1:** Attempt to load `models/metadata/make_model_mape.csv`
- Expected columns: `make, model, MAPE_pct`
- This file is produced by the retrain pipeline (`generate_make_model_mape_csv()`)
- If present, it contains **true model-evaluated MAPE** for each combo

**Step 2:** If CSV not found, fall back to a **price-dispersion proxy** computed from `processed_data.csv`:

```python
# For each (make, model) group with ≥ 5 rows:
median_price = group["price_egp"].median()
mape_proxy = mean(abs((price_egp - median_price) / median_price)) * 100.0
```

This proxy estimates how "predictable" a combo is by measuring price dispersion around the median. High dispersion → high proxy MAPE → low confidence.

**Why the proxy matters:** In production, if a new dataset arrives but the retrain pipeline hasn't been run yet, the service can still compute per-car MAPE using the proxy. This ensures the confidence system never breaks even when diagnostics are stale.

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/services/model/model_state.py:229-318`

### A5. Model-Independent Serving Design

The serving layer achieves model independence through three mechanisms:

**1. ModelContext Abstraction**
All prediction code receives a `ModelContext` object containing everything needed to run a prediction. The context is built from global state (`_active_model_context()`) but can also be constructed manually for fallback routing or A/B testing.

**2. Framework Dispatch in predictor.py**
The `predict_price()` function is a thin dispatcher:
```python
def predict_price(..., context: ModelContext | None = None) -> dict:
    ctx = context if context is not None else _active_model_context()
    if ctx.framework == 'ensemble':
        return _predict_ensemble(df_features, ctx)
    elif ctx.is_quantile:
        return _predict_quantile(df_features, ctx)
    else:
        return _predict_single(df_features, ctx)
```

Each internal helper knows its framework's specifics (XGB DMatrix, LGBM category dtype, sklearn preprocessor) but returns a **uniform dict**:
```python
{
    "fair_price": float,
    "lower_price": float | None,
    "upper_price": float | None,
    "model_version": str,
    "framework": str,
    "sub_model_predictions": dict | None,  # ensemble only
}
```

**3. Feature Builder Framework Awareness**
The feature builder produces a framework-agnostic feature DataFrame. Framework-specific preparation happens in the predictor layer, not the feature builder. This separation means:
- Adding a new framework only requires a new `prepare_for_*()` function
- The feature builder never needs to know which model will consume its output

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/services/prediction/predictor.py:31-66`

---

## B. Confidence Label & Negotiation Interval Logic

### B1. Confidence System Architecture

The confidence system is a **multi-signal classifier** that converts model diagnostics into a human-readable `high` / `medium` / `low` label. It operates in two stages:

1. **`car_mape_pct(make, model)`** — Resolves the best available MAPE for the specific car via a lookup cascade
2. **`confidence_label_from_signals()`** — Applies degradation rules based on MAPE, support count, interval width, and exact-combo flag

The design goal is to **never overstate confidence**. When evidence is weak (sparse training data, wide prediction intervals, or unseen combinations), the system systematically degrades the label.

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/services/model/confidence.py:1-172`

### B2. Per-Car MAPE Lookup Cascade (`car_mape_pct`)

Before confidence can be computed, the system must determine how accurate the model is for the specific `(make, model)` being requested. This uses a **three-level fallback cascade:**

```
1. MAKE_MODEL_MAPE.get((make_lower, model_lower))
   → Exact per-make-model MAPE from diagnostics CSV
2. MAKE_MAPE.get(make_lower)
   → Per-make aggregate MAPE (all models of this make averaged)
3. active_mape_pct()
   → Global active model test MAPE from metadata
```

**Level 1 — Exact combo:** If `make_model_mape.csv` contains a row for `"toyota corolla"`, that exact MAPE is used. This is the most precise signal.

**Level 2 — Make-level aggregate:** If the exact combo is missing but the make exists, the per-make MAPE is used. This is less precise but still better than the global average.

**Level 3 — Global fallback:** If neither exact combo nor make-level data exists, the active model's global test MAPE is used. This is the coarsest signal.

**Why this cascade matters:** A request for a common car (e.g., "Toyota Corolla 2018") uses its exact MAPE (often ~8-12%). A request for a rare car (e.g., "BMW M4") may fall back to BMW's make-level MAPE (~15-18%). An unknown make falls back to the global MAPE (~15%). Each level affects the initial confidence label.

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/services/model/confidence.py:54-59`, `@/home/mo-seif/Documents/GP/ml-service/app/services/model/model_state.py:229-318`

### B3. Signal Cascade: How the Confidence Label Is Built

The core function `confidence_label_from_signals()` applies four sequential signals. Each signal can modify the label, and the order matters.

#### Signal 1: MAPE Tier (Primary Signal)

The MAPE value (from the lookup cascade) maps to an initial label:

| MAPE_pct | Initial Label | Interpretation |
|----------|---------------|----------------|
| `≤ 14.0` | `high` | Model demonstrates good accuracy for this car |
| `≤ 18.0` | `medium` | Acceptable accuracy, some uncertainty |
| `> 18.0` | `low` | Poor accuracy, significant uncertainty |

This is the "base" label. All subsequent signals can only **degrade** it (high → medium → low). There is no upgrade path — once degraded, the label never recovers.

#### Signal 2: Support Count Degradation

The support count is the number of `(make, model)` rows in the **training data** (`SUPPORT_COUNTS_MM`). It measures how much evidence the model has seen for this exact combo.

| Support Count | Effect on Label | Rationale |
|---------------|-----------------|-----------|
| `< 5` | Hard `low` (unless excellent MAPE → degrade one step) | Insufficient evidence; model is generalizing |
| `< 10` | Degrade one step (unless excellent MAPE) | Sparse evidence; predictions may be noisy |
| `≥ 10` | No degradation | Sufficient evidence for reliable prediction |

**The "excellent MAPE" exception:** If `MAPE ≤ 10.0%`, the model has proven accuracy for this specific car despite low support. In this case, the degradation is softened:
- `< 5` support → degrade one step (not hard `low`)
- `< 10` support → no degradation (instead of one step)

**Why excellent MAPE relaxes thresholds:** The system reasons that if a model achieves ≤10% MAPE on a combo, it has learned the pattern well enough that generic heuristics (support count) should carry less weight. However, interval width degradation still applies.

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/services/model/confidence.py:82-109`

#### Signal 3: Interval Width Degradation (Quantile Models Only)

For quantile models, the width of the prediction interval is a direct measure of model uncertainty. Width is computed as:

```python
width_pct = (upper_price - lower_price) / fair_price
```

**For excellent MAPE (≤ 10.0%):**
| Width_pct | Effect |
|-----------|--------|
| `> 2.5` | Hard `low` |
| `> 2.0` | Degrade one step |
| `≤ 2.0` | No degradation |

**For normal MAPE (> 10.0%):**
| Width_pct | Effect |
|-----------|--------|
| `> 2.0` | Hard `low` |
| `> 1.5` | Degrade one step |
| `≤ 1.5` | No degradation |

**Rationale:** A narrow interval (width ≤ 1.5× fair price) indicates the model is confident. A wide interval (width > 2.0×) indicates high uncertainty, regardless of MAPE. The excellent-MAPE thresholds are relaxed because proven accuracy justifies wider tolerance.

**Note:** This signal only applies when `is_quantile=True`. Single sklearn models (Huber, Ridge) do not produce intervals, so this signal is skipped.

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/services/model/confidence.py:111-123`

#### Signal 4: Exact-Combo Flag (Final Degradation)

After all previous signals, if `exact_combo_supported=False` (known make, unknown model), the label is degraded one additional step.

**When does `exact_combo_supported=False`?**
- The make exists in `VALID_CARS` (e.g., "toyota")
- But the specific model does not exist (e.g., "toyota prius-c")
- The router still routes to the active model (known-make generalization)
- The model has never seen this exact combo in training

**Example degradation chain:**
- Initial label from MAPE: `high`
- Support count `< 10`: `high` → `medium`
- Width > 1.5: `medium` → `low`
- `exact_combo_supported=False`: `low` → `low` (already at floor)

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/services/model/confidence.py:168-171`

### B4. The `_degrade_label` Function

The degradation logic is implemented as a pure, stateless function:

```python
def _degrade_label(label: str) -> str:
    if label == "high":
        return "medium"
    if label == "medium":
        return "low"
    return "low"  # floor
```

This function is the **only** mechanism for changing labels. There is no `_upgrade_label()`. The system is intentionally pessimistic: it degrades conservatively and never inflates confidence.

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/services/model/confidence.py:33-38`

### B5. Worked Example

Consider a request for `"toyota corolla"` with these diagnostics:

| Signal | Value | Effect |
|--------|-------|--------|
| MAPE | 12.0% | Initial label = `high` |
| Support count | 8 rows | `< 10` → degrade one step: `high` → `medium` |
| Interval width | 1.6× fair price | Normal MAPE, width > 1.5 → degrade one step: `medium` → `low` |
| Exact combo | `True` | No additional degradation |
| **Final label** | | **`low`** |

Now consider `"toyota corolla"` with excellent MAPE:

| Signal | Value | Effect |
|--------|-------|--------|
| MAPE | 8.0% | Initial label = `high` (excellent) |
| Support count | 8 rows | Excellent MAPE → `< 10` has NO effect |
| Interval width | 1.6× fair price | Excellent MAPE, width ≤ 2.0 → NO degradation |
| Exact combo | `True` | No additional degradation |
| **Final label** | | **`high`** |

This demonstrates how the excellent-MAPE exception can **prevent two degradations** that would otherwise occur.

### B6. Negotiation Interval / Range Logic

The negotiation range is a **symmetric interval** around the fair price, computed after the confidence label is finalized.

#### Formula

```python
effective_mape = car_mape_pct(make, model) or 15.0  # default fallback
multiplier = _CONFIDENCE_MULTIPLIERS[confidence]  # high=1.00, medium=1.35, low=1.85
min_band = _MIN_BAND[confidence]  # high=0.12, medium=0.18, low=0.25

alpha = max((effective_mape / 100.0) * multiplier, min_band)

min_price = max(0.0, fair_price * (1.0 - alpha))
max_price = fair_price * (1.0 + alpha)
```

#### Parameters

| Confidence | Multiplier | Min Band | Rationale |
|------------|------------|----------|-----------|
| `high` | `1.00` | `0.12` | Tight band: ±12% minimum even if MAPE is tiny |
| `medium` | `1.35` | `0.18` | Moderate band: ±18% minimum |
| `low` | `1.85` | `0.25` | Wide band: ±25% minimum |

#### How `alpha` is determined

`alpha` is the **maximum** of two values:
1. `(MAPE / 100) × multiplier` — data-driven spread based on model accuracy
2. `min_band` — absolute floor to prevent unreasonably narrow bands

**Example 1:** MAPE = 10%, confidence = `high`
- `(10/100) × 1.00 = 0.10`
- `max(0.10, 0.12) = 0.12` → band = ±12%

**Example 2:** MAPE = 20%, confidence = `medium`
- `(20/100) × 1.35 = 0.27`
- `max(0.27, 0.18) = 0.27` → band = ±27%

**Example 3:** MAPE = 25%, confidence = `low`
- `(25/100) × 1.85 = 0.4625`
- `max(0.4625, 0.25) = 0.4625` → band = ±46%

The min_band floor ensures that even cars with tiny MAPE (e.g., 5%) don't get unreasonably narrow negotiation ranges.

**Default MAPE** (when per-car MAPE is unavailable): `15.0`

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/services/model/intervals.py:1-49`

### B7. Price Rounding

Before returning to the client, all prices (fair, min, max) are rounded to market-friendly EGP figures to match Egyptian used-car listing conventions:

- **`< 200,000 EGP`** → round to nearest **5,000 EGP**
- **`≥ 200,000 EGP`** → round to nearest **10,000 EGP**

**Implementation:**
```python
def _round_half_up_to_step(value, step):
    abs_value = abs(value)
    rounded = math.floor((abs_value / step) + 0.5) * step
    return -rounded if value < 0 else rounded
```

After rounding, ordering invariants are enforced:
- `min_price ≤ fair_price ≤ max_price`

If rounding violates this (e.g., min rounds up above fair), the invariant is restored by adjusting the boundary values.

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/core/price_rounding.py:1-49`, `@/home/mo-seif/Documents/GP/ml-service/app/api/predict.py:72-79`

---

## C. Prediction Flow (Single & Batch)

### C1. Request Validation Layer

Before any prediction logic runs, the API layer performs strict validation:

**1. Make Known Check:**
```python
def check_make_known(brand: str) -> bool:
    return brand.strip().lower() in {make for (make, _) in VALID_CARS}
```
- Unknown make → `400 Bad Request` with detail: `"Unknown car make: {brand}"`
- This prevents wasted computation on cars the model has never seen

**2. Model Loaded Check:**
```python
def is_model_loaded() -> bool:
    return ACTIVE_MODELS is not None
```
- No active model → `503 Service Unavailable`
- This typically means the service is still starting up or the registry is empty

**3. Input Sanitization:**
- `year` must be `>= 1950` and `<= current_year + 1`
- `mileage_km` must be `>= 0` if provided
- All string fields are stripped and lowercased for lookup consistency

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/api/predict.py:40-80`, `@/home/mo-seif/Documents/GP/ml-service/app/services/prediction/feature_builder.py:160-168`

### C2. Fallback Routing (`resolve_model_for_prediction`)

The router implements a **"Best Older Match"** policy to handle cars the active model may not explicitly cover.

**RoutingResult dataclass:**
```python
@dataclass
class RoutingResult:
    coverage_mode: str   # "exact_match" | "known_make_model_missing" | "unknown_make"
    target_model_id: str | None
    fallback_used: bool
    fallback_reason: str | None
```

**Decision logic:**

1. **Exact match:** `(make, model)` exists in `VALID_CARS` AND the active model's coverage includes this combo
   - `coverage_mode = "exact_match"`
   - `exact_combo_supported = True`
   - Uses active model directly

2. **Known make, missing model:** The make exists but the exact model does not
   - `coverage_mode = "known_make_model_missing"`
   - `exact_combo_supported = False`
   - **Still routes to active model** (generalization), but confidence is degraded one step
   - This is a deliberate design choice: rejecting would provide no value; generalizing with degraded confidence provides an approximate estimate

3. **Unknown make:** Already rejected at the API validation layer (step 1 above)

**Why generalize instead of reject?**
The active model has learned price patterns across all training data. For a known make with an unseen model, the model can still apply make-level price patterns (e.g., "BMWs are generally more expensive than Toyotas"). The confidence degradation signals to the user that this is an approximate estimate.

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/services/model/router.py:1-127`, `@/home/mo-seif/Documents/GP/ml-service/app/api/predict.py:98-204`

### C3. Single Prediction Endpoint (`POST /api/v1/predict`)

**Complete flow:**

```
HTTP Request → Pydantic Validation → check_make_known() → is_model_loaded()
    → resolve_model_for_prediction() → predict_full()
        → predict_price() → build_features() → framework dispatch → raw prices
        → compute_confidence_label() → car_mape_pct() → confidence_label_from_signals()
        → compute_negotiation_range() → price rounding
        → (optional) compute_price_factors() / compute_ensemble_price_factors()
    → record_prediction_metrics() → log_prediction_audit()
    → _build_response() → round prices → enforce invariants → JSON Response
```

**Step-by-step detail:**

1. **Pydantic validation** — `PredictionRequest` schema enforces `brand`, `model`, `year` as required; all others optional
2. **Make known check** — `check_make_known(request.brand)` → `400` if unknown
3. **Model loaded check** — `is_model_loaded()` → `503` if not loaded
4. **Fallback routing** — `resolve_model_for_prediction(brand, model)` returns `RoutingResult`
5. **Run prediction** — `predictor.predict_full(..., exact_combo_supported=result.coverage_mode == "exact_match")`
6. **Record Prometheus metrics** — `PREDICTION_REQUESTS_TOTAL.labels(confidence=...).inc()`, `PREDICTION_DURATION_SECONDS.observe(duration)`, `PREDICTION_REQUESTS_BY_ENDPOINT_TOTAL.labels(endpoint="single").inc()`
7. **Audit log** — Structured JSONL to `predictions.jsonl` with fields: `make`, `model`, `year`, `fair_price`, `confidence`, `model_version`, `framework`, `routing_mode`, `duration_ms`
8. **Build response** — `PredictionResponse` with rounded prices, enforced invariants, optional factors

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/api/predict.py:98-204`

### C4. Batch Prediction Endpoint (`POST /api/v1/predict/batch`)

**Design:** Best-effort with partial results. The endpoint never fails entirely; individual items may fail while others succeed.

**Schema:**
```python
class BatchPredictionRequest(BaseModel):
    items: List[PredictionRequest]  # min=1, max=50

class BatchPredictionResponse(BaseModel):
    total: int
    successful: int
    failed: int
    results: List[dict]  # Each dict is either PredictionResponse or {"error": str}
```

**Execution model:**
- Each item is processed **independently** with its own fallback routing
- Exceptions on individual items are caught and converted to `{"error": "..."}` entries
- The response always includes `total`, `successful`, `failed` counts
- Prometheus metrics are recorded per item: each successful item increments prediction counters; each failed item increments `PREDICTION_ERRORS_TOTAL`

**Why max 50?**
- Prevents abuse and long-running requests
- Each item triggers full feature engineering + prediction; 50 items × ~50ms = ~2.5s max
- Can be increased if infrastructure allows

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/api/predict.py:207-320`, `@/home/mo-seif/Documents/GP/ml-service/app/schemas/prediction.py:53-80`

### C5. Internal Prediction Orchestration (`predict_full`)

The `predict_full()` function is the **central orchestrator**. It delegates to specialist modules but coordinates the entire pipeline.

```python
def predict_full(..., include_factors: bool = False,
                 context: ModelContext | None = None,
                 exact_combo_supported: bool = True) -> dict:
```

**Pipeline stages:**

**Stage 1: Price Prediction (`predict_price()`)**
- Builds features via `feature_builder.build_features()`
- Gets `ModelContext` (either provided `context` or global `_active_model_context()`)
- Dispatches to framework-specific helper:
  - Ensemble → `_predict_ensemble()` → weighted average of sub-model quantiles
  - Quantile → `_predict_quantile()` → `{lower, median, upper}` predictions
  - Single → `_predict_single()` → point estimate
- Handles log-target exponentiation with clipping `[-5, 18]`
- Enforces monotonicity: `lower ≤ fair ≤ upper`

**Stage 2: Confidence (`compute_confidence_label()`)**
- Looks up per-car MAPE via `car_mape_pct(make, model)`
- Looks up support count via `SUPPORT_COUNTS_MM`
- Computes interval width from raw predictions
- Applies the full signal cascade (Section B)
- If `exact_combo_supported=False`, applies final degradation

**Stage 3: Negotiation Range (`compute_negotiation_range()`)**
- Uses the finalized confidence label
- Uses per-car MAPE (not global)
- Computes symmetric band with min_band floor

**Stage 4: Price Factors (optional, SHAP)**
- **Only for the active model** (`context is None`)
- If `ACTIVE_FRAMEWORK == 'ensemble'` → `compute_ensemble_price_factors()`
- Otherwise → `compute_price_factors()`
- Fallback contexts skip SHAP to avoid explainer mismatch

**Stage 5: Response Assembly**
Returns dict with keys: `fair_price`, `negotiation_range`, `confidence`, `price_factors`, `model_version`, `framework`, `raw_lower_price`, `raw_upper_price`

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/services/prediction/predictor.py:69-148`

### C6. Response Building and Invariant Enforcement

The `_build_response()` function in `app/api/predict.py` performs final price processing:

1. **Round all prices** — `round_egp_market_price()` for fair, min, max
2. **Enforce ordering** — `min_price ≤ fair_price ≤ max_price`
   - If `min_price > fair_price`: set `min_price = fair_price`
   - If `max_price < fair_price`: set `max_price = fair_price`
3. **Build `NegotiationRange`** — Pydantic model with rounded min/max
4. **Build `PredictionResponse`** — Final Pydantic model with all fields
5. **Add timestamp** — `predicted_at = datetime.utcnow().isoformat()`

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/api/predict.py:72-79`, `@/home/mo-seif/Documents/GP/ml-service/app/schemas/prediction.py:1-80`

---

## D. SHAP Explainability & Price Factors

### D1. SHAP Architecture Overview

The explainability system provides **per-prediction, model-specific price factors** that tell the user *why* a particular price was predicted. It uses SHAP (SHapley Additive exPlanations) values from tree-based models to attribute the predicted price to individual input features.

**Two modules serve different model types:**
- **`explainer.py`** — For single tree models (XGBoost / LightGBM)
- **`ensemble_explainer.py`** — For ensemble models (XGB + LGBM weighted average)

Both modules produce the same output format: a list of `{factor, direction, description}` dicts.

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/services/explainability/explainer.py:1-287`, `@/home/mo-seif/Documents/GP/ml-service/app/services/explainability/ensemble_explainer.py:1-493`

### D2. Single Model SHAP (XGBoost / LightGBM)

#### TreeExplainer Mechanics

SHAP values for tree models are computed using `shap.TreeExplainer`, which implements an efficient polynomial-time algorithm (Lundberg et al., 2018) to compute exact Shapley values for decision trees.

**Mathematical basis:**
For a prediction `f(x)`, SHAP values satisfy:
```
f(x) = E[f(X)] + Σ φ_i
```
where:
- `E[f(X)]` is the expected prediction (baseline / background value)
- `φ_i` is the SHAP value for feature `i`
- `Σ φ_i = f(x) - E[f(X)]`

Each `φ_i` represents the **marginal contribution** of feature `i` to pushing the prediction away from the baseline. Positive SHAP means the feature increased the price; negative means it decreased the price.

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/services/explainability/explainer.py:31-66`

#### Lazy Explainer Construction

The explainer is built **once per model** and cached globally:

```python
ACTIVE_SHAP_EXPLAINER = None      # shap.TreeExplainer instance
ACTIVE_SHAP_MODEL_REF = None      # reference to the model object
ACTIVE_SHAP_FRAMEWORK = None      # 'XGBoost' | 'LightGBM'
```

When `compute_price_factors()` is called:
1. Check if cached explainer matches current active model (by object identity `is`)
2. If mismatch or missing, build new `TreeExplainer(model_obj)`
3. If `ACTIVE_FRAMEWORK == 'ensemble'`, return `None` (ensemble has its own module)
4. If framework is not XGBoost or LightGBM, return `None`

**Why object identity check?** After model activation via the admin dashboard, the active model changes. The explainer detects this via `ACTIVE_SHAP_MODEL_REF is model_obj` and rebuilds automatically.

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/services/explainability/explainer.py:14-65`

#### Warm-Up at Startup

SHAP's first explanation for a new model is slow (~200-500ms) due to internal JIT compilation and tree traversal setup. To avoid this latency on real user requests, the service **warms up SHAP at startup**:

```python
def warm_up_shap() -> bool:
    # 1. Build explainer
    explainer = _get_or_build_shap_explainer()
    # 2. Pick the highest-support (make, model) from training data
    sample_key = max(SUPPORT_COUNTS_MM, key=SUPPORT_COUNTS_MM.get)
    raw_make, raw_model = sample_key
    # 3. Build features for a realistic car
    df = build_features(make=raw_make, model=raw_model, year=2015, mileage_km=80000)
    # 4. Prepare for the active framework
    if ACTIVE_FRAMEWORK == "XGBoost":
        X = prepare_for_xgboost(df)
    else:
        X = prepare_for_lightgbm(df)
    # 5. Run SHAP computation
    explainer.shap_values(X)
```

**Key design choice:** The warm-up uses the **highest-support** combo from training data because:
- It guarantees the combo exists in the lookup tables
- It represents the most common car type, ensuring all spec fields are populated
- If warm-up fails, the service logs a warning and continues (does not crash)

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/services/explainability/explainer.py:78-116`

#### Feature Matrix Preparation for SHAP

SHAP requires the exact same feature matrix format used during training:

**For XGBoost:**
1. `build_features()` creates the raw feature DataFrame
2. `prepare_for_xgboost()` label-encodes categoricals
3. `xgb.DMatrix(df_prepared)` wraps the matrix
4. `explainer.shap_values(X)` computes values on the **numeric** matrix

**For LightGBM:**
1. `build_features()` creates the raw feature DataFrame
2. `prepare_for_lightgbm()` casts categoricals to `category` dtype
3. `explainer.shap_values(X)` computes values on the **category** matrix

**Critical point:** If the wrong preparation is used (e.g., passing raw strings to XGBoost SHAP), the explainer will fail or produce nonsensical values. The explainer module inspects `ACTIVE_FRAMEWORK` and calls the matching preparation function.

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/services/explainability/explainer.py:155-160`

#### Top-K Factor Selection

After computing SHAP values, the factor selection algorithm:

1. **Extract SHAP array:** `shap_values = explainer.shap_values(X)`
   - For some models, this returns a list; extract the first element
   - Convert to 1D array `shap_row`

2. **Exclude identity features:** `make` and `model` are excluded from ranking because:
   - They always have large SHAP values (they are the primary price determinants)
   - The user already knows the make and model
   - Excluding them reveals the *secondary* factors (year, mileage, specs)

3. **Sort by absolute SHAP:** `items.sort(key=lambda t: abs(t[1]), reverse=True)`

4. **Take top K:** Default `top_k=5`, minimum `max(1, top_k)`

5. **Map to user-facing descriptions:** Each `(feature_name, shap_value)` pair is passed to `factor_expert.explain_factor()`

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/services/explainability/explainer.py:162-210`

### D3. Ensemble SHAP Aggregation

When `ACTIVE_FRAMEWORK == "ensemble"`, the `ensemble_explainer.py` module handles SHAP for the weighted-average ensemble. This is significantly more complex than single-model SHAP.

#### Initialization (`init_ensemble_explainer()`)

At startup, after `load_active_model()`:

1. **Resolve path-strings** — The ensemble artifact stores `base_models: {"xgb": "models/pickles/...", "lgbm": "models/pickles/..."}`. These are resolved to absolute paths via `resolve_registry_path()`.

2. **Load sub-models** — Each path is loaded via `joblib.load()`. For quantile sub-models, the loaded object is a dict `{q05, q10, q50, q90, q95}`.

3. **Build TreeExplainers** — For each sub-model:
   - If sub-model is a quantile dict, use the `"median"` model for SHAP
   - If sub-model is a tree-based model, `shap.TreeExplainer(target)` succeeds
   - If sub-model is non-tree (e.g., Huber), TreeExplainer fails → **skipped**

4. **Map weights to names** — The ensemble artifact stores `weights: [0.55, 0.45]`. These are mapped to sub-model names (`"xgb"`, `"lgbm"`) in standard order.

5. **Cache everything globally:**
   - `_ENSEMBLE_EXPLAINERS: dict[name, TreeExplainer]`
   - `_ENSEMBLE_SUB_MODELS: dict[name, loaded_model]`
   - `_ENSEMBLE_WEIGHTS: tuple[float, ...]`
   - `_ENSEMBLE_WEIGHT_NAMES: list[str]`
   - `_ENSEMBLE_METHOD: str` (e.g., "Weighted Average")

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/services/explainability/ensemble_explainer.py:185-260`

#### Weight Redistribution for Non-Tree Sub-Models

If a sub-model cannot be explained (non-tree), its weight is **redistributed proportionally** among the explainable sub-models:

```python
# Original weights: xgb=0.55, lgbm=0.45, huber=0.20
# Huber is skipped (non-tree)
# Redistributed: xgb = 0.55 / (0.55+0.45) = 0.55, lgbm = 0.45 / (0.55+0.45) = 0.45
# Same proportions, just renormalized to sum to 1.0
```

This ensures the aggregated SHAP values still sum to the prediction deviation from baseline.

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/services/explainability/ensemble_explainer.py:112-153`

#### Robust Average Trim Detection

For ensembles using "Robust Average" (which trims outliers), the SHAP aggregation must exclude the trimmed sub-model to stay faithful to the actual prediction path.

**Algorithm:**
```python
def _robust_trim_index(predictions, weights, trim_fraction=0.2):
    n = len(predictions)
    n_trim = max(1, int(n * trim_fraction))  # For 3 models: trim 1

    # Compute weighted mean
    weighted_mean = sum(p * w for p, w in zip(predictions, weights)) / sum(weights)

    # Find the model furthest from the weighted mean
    deviations = [abs(p - weighted_mean) for p in predictions]
    trim_idx = int(np.argmax(deviations))

    return trim_idx
```

**Example:**
- XGB predicts 300,000 EGP, LGBM predicts 310,000 EGP, Huber predicts 400,000 EGP
- Weighted mean ≈ 305,500 EGP
- Huber (400k) is furthest → `trim_idx = 2`
- Huber's SHAP contribution is excluded from aggregation

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/services/explainability/ensemble_explainer.py:155-181`

#### Weighted SHAP Aggregation

At request time, SHAP values are computed per explainable sub-model, then aggregated:

```python
# For each feature i:
ensemble_shap[i] = Σ (sub_model_shap[i] * normalized_weight[j])
                     for j in explainable_models
                     excluding trimmed model if Robust Average
```

The aggregated SHAP values are then ranked by absolute value, top-K selected, and mapped to expert descriptions — identical to the single-model path.

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/services/explainability/ensemble_explainer.py:260-350`

### D4. Factor Expert (`factor_expert.py`)

The factor expert converts raw `(feature_name, shap_value, feature_value)` tuples into human-readable explanations grounded in Egyptian automotive market knowledge.

#### Make-Specific Notes

The expert includes **28+ make-specific notes** that inject local market context. Examples from the codebase:

| Make | Note |
|------|------|
| Toyota | "Toyota parts are widely available and affordable in Egypt, which supports strong resale values." |
| BMW | "BMW maintenance costs are high in Egypt; specialized workshops are limited outside Cairo/Alexandria." |
| Chinese brands (Chery, Geely, etc.) | "Chinese brands are gaining trust in Egypt but resale values remain lower than Japanese/Korean equivalents." |
| Mercedes | "Customs duties on European luxury cars are significant; prices reflect import costs." |

These notes are injected when the make appears in the SHAP factor list, making explanations locally relevant.

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/services/explainability/factor_expert.py:1-200`

#### Per-Factor Rule Engine

Each feature has deterministic rules that consider:
1. **Value** — the actual feature value (e.g., `year=2015`, `mileage_km=120000`)
2. **Direction** — `positive` (increases price) or `negative` (decreases price)
3. **Typicality** — how typical the value is for the Egyptian market (via quantile bucketing)

**Rule patterns (examples):**

**`year`:**
- If direction=positive and year is recent → "Recent model year increases price due to newer features and lower depreciation"
- If direction=negative and year is old → "Older model year reduces price due to higher depreciation and outdated features"

**`mileage_km` / `mileage_per_year`:**
- If direction=negative and mileage is high → "High mileage indicates more wear, reducing market value"
- If direction=positive and mileage is low → "Low mileage is attractive to buyers, supporting a higher price"
- If `mileage_per_year` > 20,000 → "Above-average annual usage suggests heavy driving conditions"

**`transmission`:**
- Automatic + positive → "Automatic transmission is preferred in Egyptian urban traffic (Cairo/Alexandria)"
- Manual + negative → "Manual transmission is less convenient in heavy traffic, reducing buyer demand"

**`engine_cc`:**
- Large engine (>2000cc) + negative → "Larger engines face higher fuel costs and annual registration fees in Egypt"
- Small engine (<1300cc) + negative → "Very small engines may lack power for highway driving, limiting buyer pool"

**`location`:**
- Cairo + positive → "Cairo is the largest market with highest demand, supporting stronger prices"
- Remote governorate + negative → "Cars in remote areas may have limited local buyer demand"

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/services/explainability/factor_expert.py:200-769`

#### Market Typicality Bucketing

For numerical features, the expert uses quantile statistics from `market_stats.py` to determine typicality:

```python
# Pseudocode from the expert:
if value < q25:
    typicality = "well below average"
elif value < q50:
    typicality = "below average"
elif value < q75:
    typicality = "above average"
else:
    typicality = "well above average"
```

This allows descriptions like: `"The engine size (1600cc) is typical for this segment, so it has a neutral effect on price."`

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/services/explainability/factor_expert.py:50-100`

### D5. Price Factor Response Schema

```python
class PriceFactor(BaseModel):
    factor: str          # Feature name, e.g., "year", "mileage_km"
    direction: str       # "positive" or "negative"
    description: str     # Human-readable explanation
```

**Example response:**
```json
[
  {"factor": "year", "direction": "positive", "description": "The 2018 model year is relatively recent, supporting a higher price due to lower depreciation."},
  {"factor": "mileage_km", "direction": "negative", "description": "High mileage (140,000 km) indicates significant wear, reducing market value."},
  {"factor": "transmission", "direction": "positive", "description": "Automatic transmission is preferred in Egyptian urban traffic, increasing buyer demand."}
]
```

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/schemas/prediction.py:31-34`

### D6. Market Typicality Bucketing (`market_stats.py`)

The `factor_expert.py` module uses quantile-based market statistics to provide context-aware explanations. These statistics are computed from `processed_data.csv` and cached in-memory.

#### `get_market_stats()`

```python
@lru_cache(maxsize=1)
def get_market_stats() -> MarketStats:
    """Load cached market stats from processed_data.csv.

    Returns quantiles (p25, p50, p75, p90) for:
    - year, mileage_km, mileage_per_year, engine_cc, horsepower

    If the file is missing or unreadable, all fields are None.
    Only columns with ≥ 50 valid rows produce quantiles.
    """
```

**Key design choices:**
- **Deterministic and offline** — No network calls; reads a local CSV once at first use
- **Fast** — `lru_cache(maxsize=1)` ensures the CSV is read exactly once per process lifetime
- **Best-effort** — If data is missing, `bucket_against_quantiles()` returns `None`, and the factor expert omits the typicality phrase rather than crashing

#### `Quantiles` Dataclass

```python
@dataclass(frozen=True)
class Quantiles:
    p25: float   # 25th percentile
    p50: float   # 50th percentile (median)
    p75: float   # 75th percentile
    p90: float   # 90th percentile
```

#### `bucket_against_quantiles()`

Converts a numeric feature value into a high-level typicality bucket:

| Bucket | Condition |
|--------|-----------|
| `low` | `value ≤ p25` |
| `typical` | `p25 < value ≤ p50` |
| `high` | `p50 < value ≤ p75` |
| `very_high` | `p75 < value ≤ p90` |
| `very_high` (extended) | `value > p90` |

**Usage in factor_expert.py:**

```python
stats = get_market_stats()
bucket = bucket_against_quantiles(km, stats.mileage_km)
typical = _typicality_phrase(bucket)
# bucket="high" → "This is higher than what is typical in the data."
```

**Why quantiles instead of raw means?**
- Quantiles are robust to outliers (e.g., a single 500,000 km listing doesn't skew the "typical" range)
- The `p25/p75` range captures the central 50% of the market, which is intuitive for users
- No currency amounts are exposed — only relative position within the data distribution

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/services/explainability/market_stats.py:1-133`, `@/home/mo-seif/Documents/GP/ml-service/app/services/explainability/factor_expert.py:98-109`

---

## E. Model Registry & Promotion Gate

### E1. Registry Schema (v2)

The registry is a single JSON file (`models/model_registry.json`) that serves as the **source of truth** for all model metadata, active state, and promotion history.

```json
{
  "schema_version": "2.0",
  "active_model_id": "ensemble_robust_average_v1.1.0",
  "active_version": "1.1.0",
  "promoted_at": "2026-06-03T14:22:18.451234",
  "models": {
    "ensemble_robust_average_v1.1.0": {
      "model_id": "ensemble_robust_average_v1.1.0",
      "framework": "ensemble",
      "version": "1.1.0",
      "stage": "production",
      "pkl_path": "models/pickles/ensemble_2026-06-03_008_v2.joblib",
      "meta_path": "models/metadata/ensemble_2026-06-03_008_v2.json",
      "metrics": {
        "holdout_mae": 14520.0,
        "holdout_rmse": 19840.0,
        "holdout_r2": 0.89,
        "holdout_mape_pct": 12.3,
        "holdout_within_15pct": 78.5,
        "cv_mape_pct": 12.8
      },
      "artifacts": {
        "xgb_quantile": "models/pickles/xgb_quantile_2026-06-03_008_v2.joblib",
        "lgbm_quantile": "models/pickles/lgbm_quantile_2026-06-03_008_v2.joblib",
        "label_encoders": "models/pickles/label_encoders_2026-06-03_008_v2.joblib"
      },
      "source_notebook": "07c_model_v2_training_experiments",
      "registered_at": "2026-06-03T14:22:18.451234"
    }
  }
}
```

**Key fields:**
- `schema_version` — Registry format version; currently `"2.0"`
- `active_model_id` — The currently serving model's ID
- `active_version` — Semantic version of the active model
- `promoted_at` — ISO timestamp of last promotion
- `models` — Dictionary of all registered models keyed by `model_id`
- `stage` — One of: `candidate` (newly trained), `production` (actively serving), `archived` (previously active)

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/core/model_registry.py:7-28`

### E2. Versioning System

#### Semantic Versioning for Models

The retrain pipeline uses **semantic versioning** (`major.minor.patch`):

- **Major (X.0.0)** — Breaking change: new feature set, different target column, incompatible API
- **Minor (x.Y.0)** — New model trained on same pipeline with same features but new data or hyperparameters
- **Patch (x.y.Z)** — Bug fix or retrain on same data with different random seed

**Auto-versioning logic (`_next_v2_version()`):**
```python
def _next_v2_version(existing_versions: list[str]) -> str:
    """Generate next semantic version based on existing versions."""
    if not existing_versions:
        return "1.0.0"

    # Parse all versions
    versions = []
    for v in existing_versions:
        try:
            major, minor, patch = map(int, v.split('.'))
            versions.append((major, minor, patch))
        except ValueError:
            continue

    if not versions:
        return "1.0.0"

    # Find highest version
    max_major = max(v[0] for v in versions)
    max_minor = max(v[1] for v in versions if v[0] == max_major)
    max_patch = max(v[2] for v in versions if v[0] == max_major and v[1] == max_minor)

    # Increment minor by default; patch if same day retrain
    return f"{max_major}.{max_minor + 1}.0"
```

**Default behavior:** Each new retrain increments the **minor** version. This reflects the project's workflow where most retrains use new data or adjusted recipes.

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/core/model_registry.py:70-95`

#### model_id vs version vs stage

These three identifiers serve different purposes:

| Identifier | Purpose | Example |
|------------|---------|---------|
| `model_id` | Unique key in registry; human-readable slug | `"ensemble_robust_average_v1.1.0"` |
| `version` | Semantic version for tracking lineage | `"1.1.0"` |
| `stage` | Operational state | `"production"`, `"candidate"`, `"archived"` |

**Why separate them?**
- `model_id` is used for lookups and API responses
- `version` is used for tracking what changed between retrains
- `stage` controls which model is actively serving predictions
- A model can be `archived` (no longer serving) but still referenced in training history

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/core/model_registry.py:128-329`

### E3. Registry Operations

| Operation | Function | Behavior |
|-----------|----------|----------|
| **Load** | `load_registry()` | Returns empty structure if file missing; never crashes |
| **Register** | `register_model()` | Adds/updates entry; converts absolute paths to relative; default stage = `candidate` |
| **Promote** | `promote_active_model()` | Atomically sets new active model to `production`, archives previous to `archived`, updates `promoted_at` |
| **Get active** | `get_active_model_info()` | Returns full info dict or `None` if no active model |
| **Get path** | `get_active_model_path()` | Resolves `pkl_path` against project root; handles both relative and absolute paths |
| **Load metadata** | `load_model_metadata()` | Loads JSON from `meta_path`; returns `None` on failure |

**Promotion atomicity:**
The `promote_active_model()` function performs an **atomic update** in memory:
1. Load current registry
2. Set previous active model's stage to `"archived"`
3. Set new model's stage to `"production"`
4. Update `active_model_id`, `active_version`, `promoted_at`
5. Save registry back to disk

If any step fails, the registry is not saved — the previous state is preserved.

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/core/model_registry.py:128-329`

### E4. Training History

The retrain pipeline appends a summary of each run to `models/training_history.json`:

```json
{
  "history": [
    {
      "model_id": "ensemble_robust_average_v1.1.0",
      "version": "1.1.0",
      "dataset_tag": "2026-06-03_008",
      "target_col": "price_egp_log",
      "split_name": "price_stratified",
      "holdout_mape_pct": 12.3,
      "cv_mape_pct": 12.8,
      "gate_outcome": "promote",
      "registered_at": "2026-06-03T14:22:18",
      "artifacts": { ... }
    }
  ]
}
```

This provides an audit trail of all training runs, their outcomes, and which dataset/target/split configuration was used.

**Source:** `@/home/mo-seif/Documents/GP/ml-service/scripts/retrain/run.py:700-750`

### E5. Promotion Gate (Retrain Pipeline)

The promotion gate (`scripts/retrain/gates.py`) is a **threshold-only, deterministic decision engine** that decides whether a newly trained model should be promoted to production.

#### Threshold Definitions

| Threshold | Default Value | What it measures |
|-----------|---------------|----------------|
| `max_holdout_mape_pct` | `15.0` | Global test-set accuracy |
| `min_holdout_r2` | `0.80` | Explained variance on test set |
| `min_holdout_within_15pct` | `70.0` | % of predictions within ±15% of true price |
| `max_cv_mape_pct` | `15.0` | Cross-validation accuracy (out-of-fold) |
| `max_supported_pct_above_30pct` | `10.0` | % of supported combos with MAPE > 30% |
| `max_supported_pct_above_50pct` | `2.0` | % of supported combos with MAPE > 50% |

**Hard reject rule:** If `holdout_mape_pct > 50.0`, the model is **immediately rejected** regardless of other metrics. This catches catastrophic failures (e.g., data corruption, wrong target column).

**Source:** `@/home/mo-seif/Documents/GP/ml-service/scripts/retrain/gates.py:1-98`

#### Gate Outcomes

The `check_gate()` function returns a `GateResult` dataclass:

```python
@dataclass
class GateResult:
    outcome: str   # "promote" | "candidate_only" | "reject"
    passed: bool
    reasons: list[str]
```

**Outcome 1: `promote`**
- All thresholds are met
- Holdout MAPE ≤ 15%, R² ≥ 0.80, within_15pct ≥ 70%
- CV MAPE ≤ 15%
- Supported tail error rates within bounds
- Unless `--no-promote` flag is set, the model is **automatically promoted** to active

**Outcome 2: `candidate_only`**
- Training completed successfully
- But one or more thresholds missed (e.g., holdout MAPE = 16%)
- Model is registered with stage = `candidate` but NOT promoted
- Admin must manually review and promote via dashboard if desired

**Outcome 3: `reject`**
- Hard reject triggered (MAPE > 50%)
- Or catastrophic failure (model file missing, metrics missing)
- Model is NOT registered
- Reasons are logged for debugging

**Source:** `@/home/mo-seif/Documents/GP/ml-service/scripts/retrain/gates.py:30-98`

#### Example Gate Evaluation

Consider a retrain with these metrics:

| Metric | Value | Threshold | Pass? |
|--------|-------|-----------|-------|
| Holdout MAPE | 12.3% | ≤ 15.0% | ✓ |
| Holdout R² | 0.89 | ≥ 0.80 | ✓ |
| Holdout within_15pct | 78.5% | ≥ 70.0% | ✓ |
| CV MAPE | 12.8% | ≤ 15.0% | ✓ |
| Supported % above 30% | 4.2% | ≤ 10.0% | ✓ |
| Supported % above 50% | 0.5% | ≤ 2.0% | ✓ |

**Result:** `GateResult(outcome="promote", passed=True, reasons=[])` → Auto-promote to active.

**Source:** `@/home/mo-seif/Documents/GP/ml-service/scripts/retrain/gates.py:1-98`

---

## F. Retrain Pipeline

### F1. Pipeline Architecture

The retrain pipeline is organized as a **modular, contract-driven system** with clear separation between data loading, validation, splitting, training, evaluation, diagnostics, and promotion.

```
scripts/retrain/
├── run.py              # Orchestration runner (main entry point)
├── contracts.py        # Typed dataclasses (SplitBundle, EnsembleArtifact, GateResult, etc.)
├── data_source.py      # Dataset tag resolution and CSV loading
├── validation.py       # Schema and quality checks
├── splitters.py        # Train/val/test split strategies
├── trainer.py          # XGBoost + LightGBM quantile training
├── evaluation.py       # Holdout and CV metrics computation
├── diagnostics.py      # Threshold summaries and make_model_mape.csv generation
├── gates.py            # Threshold-only promotion gate
└── constants.py        # Tier bins, default hyperparameters
```

**Source:** `@/home/mo-seif/Documents/GP/ml-service/scripts/retrain/`

### F2. Typed Contracts (`contracts.py`)

All pipeline stages communicate via strongly typed dataclasses:

```python
@dataclass
class SplitBundle:
    train_df: pd.DataFrame
    val_df: pd.DataFrame
    test_df: pd.DataFrame

@dataclass
class EnsembleArtifact:
    xgb_models: dict[str, Any]      # {q05, q10, q50, q90, q95}
    lgbm_models: dict[str, Any]     # {q05, q10, q50, q90, q95}
    label_encoders: dict[str, Any]  # For XGBoost categorical encoding
    weights: list[float]            # [0.55, 0.45]
    feature_cols: list[str]
    cat_cols: list[str]
    num_cols: list[str]
    target_col: str                 # "price_egp_log" or "price_egp"
    is_log_target: bool

@dataclass
class HoldoutMetrics:
    mae: float; rmse: float; r2: float; mape_pct: float
    within_10pct: float; within_15pct: float
    coverage_80_pct: float; coverage_90_pct: float; mean_width_pct: float

@dataclass
class GateResult:
    outcome: str   # "promote" | "candidate_only" | "reject"
    passed: bool
    reasons: list[str]

@dataclass
class RetrainConfig:
    dataset_tag: str | None = None
    data_path: str | None = None
    target_col: str = "price_egp_log"
    split_name: str = "price_stratified"
    no_promote: bool = False
    skip_cv: bool = False
    grouped_cv: bool = False
    random_state: int = 42
```

These contracts enforce type safety and make the pipeline's data flow explicit and testable.

**Source:** `@/home/mo-seif/Documents/GP/ml-service/scripts/retrain/contracts.py:1-105`

### F3. Data Source Resolution

The pipeline supports two data input modes:

**Mode 1: Dataset Tag (recommended)**
```bash
python scripts/retrain/run.py --dataset-tag 2026-06-03_008
```
- Resolves to `data/processed/processed_data.csv` if the tag matches the current processed data
- Tag is embedded in output filenames for traceability

**Mode 2: Explicit CSV Path**
```bash
python scripts/retrain/run.py --data-path /path/to/custom_data.csv
```
- Loads any CSV directly
- Useful for experiments on filtered or external datasets

**Source:** `@/home/mo-seif/Documents/GP/ml-service/scripts/retrain/data_source.py`

### F4. Data Validation (`validation.py`)

Before any training, the pipeline validates the input DataFrame:

**Schema checks:**
- Required columns present: `make`, `model`, `year`, `price_egp`
- Target column present (e.g., `price_egp_log`)
- Feature columns present: all `CAT_COLS` and `NUM_COLS`

**Quality checks:**
- No null values in required columns
- `year` within reasonable range `[1950, current_year + 1]`
- `price_egp` > 0 (no zero or negative prices)
- At least `100` rows total (minimum for meaningful training)
- At least `10` unique `(make, model)` combinations (prevents single-car overfitting)

If validation fails, the pipeline exits with a descriptive error before any expensive computation.

**Source:** `@/home/mo-seif/Documents/GP/ml-service/scripts/retrain/validation.py`

### F5. Split Strategies (`splitters.py`)

The pipeline supports multiple train/validation/test split strategies:

**`price_stratified` (default):**
- Uses `sklearn.model_selection.train_test_split` with `stratify` on price tiers
- Ensures each tier (budget, mid-range, premium, luxury) is proportionally represented in all splits
- Default split ratios: `train=70%`, `val=15%`, `test=15%`

**`make_model_grouped`:**
- Uses group-aware splitting where all rows of a given `(make, model)` combo stay in the same split
- Prevents data leakage: if a Corolla is in training, no Corolla appears in test
- More realistic but requires larger datasets (some combos may be too small)

**Why stratify by price tier?**
- Egyptian car prices span ~30,000 EGP (old Chinese sedans) to >2,000,000 EGP (luxury imports)
- Random splitting could place all luxury cars in one split, causing evaluation bias
- Stratification guarantees each split sees the full price distribution

**Source:** `@/home/mo-seif/Documents/GP/ml-service/scripts/retrain/splitters.py`

### F6. Frozen 07c Training Recipe (`trainer.py`)

The training module implements a **frozen recipe** (no hyperparameter tuning) based on the 07c notebook winner:

#### XGBoost Quantile Training

```python
# For each quantile alpha in [0.05, 0.10, 0.50, 0.90, 0.95]:
params = {
    "objective": "reg:quantileerror",
    "quantile_alpha": alpha,
    "tree_method": "hist",
    "device": "cpu",
    "max_depth": 8,
    "learning_rate": 0.05,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "n_estimators": 1000,
    "early_stopping_rounds": 50,
}
```

**Key params:**
- `reg:quantileerror` — XGBoost's quantile regression objective
- `tree_method: "hist"` — Histogram-based splits (faster than exact)
- `max_depth: 8` — Prevents overfitting on sparse combos
- `subsample: 0.8` — Row sampling for regularization
- `colsample_bytree: 0.8` — Column sampling for regularization

#### LightGBM Quantile Training

```python
# For each quantile alpha in [0.05, 0.10, 0.50, 0.90, 0.95]:
params = {
    "objective": "quantile",
    "alpha": alpha,
    "boosting_type": "gbdt",
    "num_leaves": 63,
    "learning_rate": 0.05,
    "feature_fraction": 0.8,
    "bagging_fraction": 0.8,
    "bagging_freq": 1,
    "n_estimators": 1000,
    "early_stopping_rounds": 50,
}
```

**Key params:**
- `quantile` — LightGBM's quantile objective
- `num_leaves: 63` — Controls model complexity (2^6 - 1)
- `bagging_freq: 1` — Bagging every iteration
- `feature_fraction: 0.8` — Column sampling per tree

#### Ensemble Assembly

After both frameworks are trained:
```python
ensemble = {
    "base_models": {
        "xgb": "models/pickles/xgb_quantile_<tag>.joblib",
        "lgbm": "models/pickles/lgbm_quantile_<tag>.joblib",
    },
    "weights": [0.55, 0.45],
    "method": "Weighted Average",
    "quantiles": {"q05", "q10", "q50", "q90", "q95"},
}
```

**Why XGB 0.55, LGBM 0.45?**
These weights were determined in notebook 06/07c experiments where XGBoost consistently outperformed LightGBM on Egyptian car price data. The weighted average provides the best of both frameworks.

**Source:** `@/home/mo-seif/Documents/GP/ml-service/scripts/retrain/trainer.py:81-228`

### F7. Cross-Validation (`evaluation.py`)

The pipeline performs **5-fold cross-validation** to estimate out-of-sample performance without using the holdout test set.

#### Standard KFold CV

```python
from sklearn.model_selection import KFold
kf = KFold(n_splits=5, shuffle=True, random_state=config.random_state)

for fold, (train_idx, val_idx) in enumerate(kf.split(X_train_full)):
    # Train on train_idx, predict on val_idx
    # Aggregate OOF (out-of-fold) predictions
```

**Metrics computed on OOF predictions:**
- Global MAE, RMSE, R², MAPE, within_10pct, within_15pct
- Per-tier metrics
- Per-make-model metrics

#### Grouped CV (optional `--grouped-cv`)

When `--grouped-cv` is set, uses `GroupKFold` with `(make, model)` as groups:
- Ensures no `(make, model)` combo appears in both train and validation folds
- More realistic but requires sufficient data (some groups may be too small)
- Default is standard KFold for stability

**Source:** `@/home/mo-seif/Documents/GP/ml-service/scripts/retrain/evaluation.py:89-216`, `@/home/mo-seif/Documents/GP/ml-service/scripts/retrain/run.py:500-550`

### F8. Diagnostics Module (`diagnostics.py`)

The diagnostics module computes threshold-based statistics used by the promotion gate.

#### Threshold Summary

Counts how many make-model combos exceed MAPE thresholds:

```python
def threshold_summary(per_mm_df, thresholds=[30.0, 50.0]):
    return {
        "n_total": len(per_mm_df),
        "above_30pct": int((per_mm_df["MAPE_pct"] > 30.0).sum()),
        "above_50pct": int((per_mm_df["MAPE_pct"] > 50.0).sum()),
        "pct_above_30pct": round(above_30pct / total * 100, 2),
        "pct_above_50pct": round(above_50pct / total * 100, 2),
    }
```

#### Supported Combo Stats

Distinguishes between combos with enough test data (`n_test >= 10`) vs. those with sparse data:

```python
def supported_combo_stats(per_mm_df, min_rows=10):
    supported = per_mm_df[per_mm_df["n_test"] >= min_rows]
    unsupported = per_mm_df[per_mm_df["n_test"] < min_rows]
    return {
        "n_supported": len(supported),
        "n_unsupported": len(unsupported),
        "pct_supported": round(len(supported) / len(per_mm_df) * 100, 2),
        "supported_mape_mean": round(supported["MAPE_pct"].mean(), 4),
        "supported_above_30pct": int((supported["MAPE_pct"] > 30.0).sum()),
    }
```

**Why `min_rows=10`?**
- Combos with < 10 test rows have noisy MAPE estimates
- The gate's `max_supported_pct_above_30pct` threshold only applies to **supported** combos
- This prevents punishing the model for poor performance on combos it has barely seen

#### make_model_mape.csv Generation

```python
def generate_make_model_mape_csv(per_mm_df, output_path):
    df = per_mm_df[["make", "model", "MAPE_pct"]].copy()
    df.to_csv(output_path, index=False)
```

This CSV is consumed by the ML service at startup via `load_model_diagnostics()`.

**Source:** `@/home/mo-seif/Documents/GP/ml-service/scripts/retrain/diagnostics.py:1-131`

### F9. Retrain Orchestration Steps

The `run_retrain()` function coordinates the full pipeline:

1. **Parse config** — CLI args → `RetrainConfig`
2. **Load data** — Resolve dataset tag or explicit path → `pd.DataFrame`
3. **Validate** — Schema + quality checks; exit on failure
4. **Split** — `price_stratified` or `make_model_grouped` → `SplitBundle`
5. **Train** — Frozen ensemble (XGB + LGBM, 5 quantiles each) → `EnsembleArtifact`
6. **Holdout prediction** — Predict on test set → `PredictionMap`
7. **Holdout evaluation** — Global + per-tier + per-make + per-make-model metrics
8. **CV evaluation** — 5-fold KFold OOF (unless `--skip-cv`)
9. **Diagnostics** — threshold_summary + supported_combo_stats + per_mm_threshold_diagnostics
10. **Gate check** — `check_gate()` → `GateResult`
11. **Save pickles** — XGB dict, LGBM dict, ensemble wrapper, label encoders
12. **Build metadata** — JSON with metrics, quantiles, artifacts, train config
13. **Register model** — `register_model()` with stage = `candidate`
14. **Promote** — If gate passes and not `--no-promote`, call `promote_active_model()`
15. **Append training history** — Record run summary in `models/training_history.json`

**Caching:** Training and CV results are cached under `models/cache/<tag>/` using `joblib.hash()` of the training DataFrame. If the same data is re-run, cached results are loaded instead of retraining.

**Source:** `@/home/mo-seif/Documents/GP/ml-service/scripts/retrain/run.py:394-784`

### F10. Artifact Outputs

Per retrain run, the following artifacts are produced:

| Artifact | Path Pattern | Purpose |
|----------|-------------|---------|
| Holdout metrics JSON | `metrics/<tag>/holdout_metrics_<tag>.json` | Global test metrics |
| Per-tier metrics CSV | `metrics/<tag>/per_tier_metrics_<tag>.csv` | Budget/mid/premium/luxury breakdown |
| Per-make metrics CSV | `metrics/<tag>/per_make_metrics_<tag>.csv` | Per-brand accuracy |
| Per-make-model holdout CSV | `metrics/<tag>/per_make_model_holdout_<tag>.csv` | Per-combo accuracy for confidence system |
| CV overall metrics JSON | `metrics/<tag>/cv_overall_metrics_<tag>.json` | Cross-validation summary |
| Per-tier CV CSV | `metrics/<tag>/per_tier_cv_metrics_<tag>.csv` | CV by price tier |
| Per-make-model CV CSV | `metrics/<tag>/per_make_model_cv_<tag>.csv` | CV per combo |
| OOF median preds CSV | `metrics/<tag>/oof_median_preds_<tag>.csv` | Out-of-fold predictions |
| Retrain summary JSON | `metrics/<tag>/retrain_summary_<tag>.json` | Full run summary |
| XGB quantile pickle | `pickles/xgb_quantile_<tag>.joblib` | XGB 5-quantile model dict |
| LGBM quantile pickle | `pickles/lgbm_quantile_<tag>.joblib` | LGBM 5-quantile model dict |
| Ensemble wrapper pickle | `pickles/ensemble_<tag>.joblib` | Ensemble artifact with paths |
| Label encoders pickle | `pickles/label_encoders_<tag>.joblib` | Fitted XGB label encoders |
| Metadata JSON | `metadata/ensemble_<tag>.json` | Full metadata for registry |
| make_model_mape CSV | `metadata/make_model_mape.csv` | Runtime diagnostics input |

**Source:** `@/home/mo-seif/Documents/GP/ml-service/scripts/retrain/run.py:77-102`

---

## G. Data Pipeline & Feature Engineering

### G1. Configuration System (`config.py`)

The ML service uses a **Pydantic-based Settings class** that centralizes all environment-driven configuration.

```python
class Settings(BaseSettings):
    # Project paths (auto-resolved)
    project_root: Path = Path(__file__).resolve().parents[3]
    data_dir: Path = project_root / "data"
    models_dir: Path = project_root / "models"

    # Data filenames
    processed_data_filename: str = "processed_data.csv"
    lookup_csv_filename: str = "car_specs_lookup_full_cleaned.fixed.csv"

    # Model registry
    registry_filename: str = "model_registry.json"

    # Environment
    log_level: str = "INFO"
    admin_api_base: str = "http://localhost:8001/admin"
```

**Key behaviors:**
- `project_root` is computed relative to `config.py` location (`.../ml-service/app/core/config.py` → `.../ml-service/`)
- All paths are `Path` objects, not strings
- Environment variables override any field (e.g., `LOG_LEVEL=DEBUG`)
- Missing optional values default to safe values (never crash on missing env)

**Path resolution in Docker:**
- Host: `./ml-service` mounted to container `/app`
- `project_root` resolves to `/app` in container
- All data/model paths are relative to `/app`

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/core/config.py:1-293`

### G2. Directory Structures

#### ML Service (`ml-service/`)

```
ml-service/
├── app/                              # FastAPI application
│   ├── main.py                       # App factory, lifespan, startup
│   ├── api/                          # HTTP endpoints
│   │   ├── predict.py                # /api/v1/predict, /api/v1/predict/batch
│   │   ├── health.py                 # /health, /metrics
│   │   └── admin.py                  # /admin/models/*, promote/activate
│   ├── core/                         # Shared infrastructure
│   │   ├── config.py                 # Pydantic Settings, data loaders
│   │   ├── logging_config.py         # Structured JSON logging
│   │   ├── metrics.py                # Prometheus counters
│   │   ├── middleware.py             # CORS, timing, request ID
│   │   ├── model_registry.py         # Registry v2, promote gate
│   │   └── price_rounding.py         # <200k->5k, >=200k->10k
│   ├── schemas/                      # Pydantic request/response models
│   │   ├── prediction.py             # PredictRequest, BatchPredictionRequest
│   │   └── health.py                 # HealthCheck, ModelInfo
│   └── services/                     # Business logic layer
│       ├── prediction/
│       │   ├── predictor.py          # predict_full() orchestration
│       │   ├── feature_builder.py    # 5-priority spec lookup
│       │   └── batch_predictor.py    # Batch prediction loop
│       ├── model/
│       │   ├── model_state.py        # ModelContext, VALID_CARS, MAPE lookup
│       │   ├── router.py             # Fallback routing, RoutingResult
│       │   ├── confidence.py         # Signal cascade (MAPE/support/width/combo)
│       │   └── intervals.py          # Negotiation range alpha computation
│       ├── explainability/
│       │   ├── explainer.py          # SHAP for single tree models
│       │   ├── ensemble_explainer.py # SHAP for ensemble (robust avg)
│       │   ├── factor_expert.py      # Rule-based per-factor descriptions
│       │   └── market_stats.py       # Quantile bucketing for typicality
│       └── orchestration/            # (reserved for future orchestrators)
├── data/                             # All data artifacts
│   ├── raw/                          # Scraped listings from Supabase
│   │   └── cars_with_make_model.csv
│   ├── cleaned/                      # Post-cleaning outputs (versioned)
│   │   ├── cars_cleaned_2026-05-25_001.csv
│   │   ├── cars_cleaned_2026-06-03_008.csv
│   │   └── cars_cleaned_2026-06-11_011.csv
│   ├── processed/                    # Final training-ready data
│   │   └── processed_data.csv        # 18 columns, feature-engineered
│   ├── lookups/                      # Specification tables
│   │   ├── car_specs_lookup_full_cleaned.fixed.csv
│   │   └── car_main_info.json
│   ├── archived/                     # Historical backups
│   │   ├── raw/, cleaned/, processed/, lookups/
│   │   └── logs/                     # Cleaning pipeline logs
│   ├── logs/                         # Current cleaning run logs
│   ├── data_manifest.json            # Current version metadata
│   └── training_manifest.json        # Training dataset tag registry
├── models/                           # All model artifacts
│   ├── model_registry.json           # Registry v2 (active + archived)
│   ├── training_history.json         # Promotion gate history
│   ├── pickles/                      # Serialized model objects
│   │   ├── xgb_quantile_*.joblib
│   │   ├── lgbm_quantile_*.joblib
│   │   ├── ensemble_*.joblib
│   │   └── label_encoders_*.joblib
│   ├── metadata/                     # Model metadata JSONs
│   │   ├── ensemble_*.json
│   │   └── make_model_mape.csv      # Per-make-model MAPE diagnostics
│   ├── metrics/                      # Evaluation outputs per run
│   │   └── 2026-06-11_011/
│   │       ├── holdout_metrics_*.json
│   │       ├── cv_overall_metrics_*.json
│   │       └── oof_median_preds_*.csv
│   ├── cache/                        # Training/CV cache files
│   │   └── 2026-06-11_011/
│   │       ├── training_cache.joblib
│   │       └── cv_cache.joblib
│   ├── experiments/                  # Notebook experiment artifacts
│   │   └── plan2_plan4/
│   │       ├── 07a_dataset_baselines/
│   │       ├── 07b_feature_engineering_v2_ablation/
│   │       ├── 07c_model_v2_training_experiments/
│   │       └── 07d_cqr_calibration_experiments/
│   ├── configs/                      # Training config snapshots
│   │   └── train_config_v1.1.0.json
│   └── archive/                      # Deprecated model files
│       ├── Baseline1__huberregressortuned.pkl
│       └── model_*_xgb.ubj
├── scripts/                          # Offline pipeline scripts
│   ├── cleaning/                     # Data cleaning stage
│   │   ├── clean_raw_data_pipeline.py    # Master cleaning pipeline
│   │   ├── data_cleaner.py               # IQR outlier removal
│   │   ├── generate_processed_data.py    # Build processed_data.csv
│   │   ├── check_lookup_coverage.py
│   │   └── canonical_rules.yaml
│   ├── data/                         # Data loading utilities
│   │   └── data_loader.py
│   ├── retrain/                      # Reproducible retrain runner
│   │   ├── run.py                    # Main orchestration entrypoint
│   │   ├── trainer.py                # XGB + LGBM quantile training
│   │   ├── evaluation.py             # Holdout + CV metrics
│   │   ├── diagnostics.py            # Per-MM threshold summaries
│   │   ├── gates.py                  # Promotion gate logic
│   │   ├── splitters.py              # price_stratified split
│   │   └── contracts.py              # Typed dataclasses
│   └── metrics/                      # Standalone metric scripts
│       ├── compute_cv_mape.py
│       └── compute_per_tier_metrics.py
├── notebooks/                        # Jupyter notebooks (chronological)
│   ├── 01_EDA_v1.ipynb
│   ├── 02_data_cleansing.ipynb
│   ├── 03_baseline_dummy_regressor.ipynb
│   ├── 04_linear_models_preprocessor.ipynb
│   ├── 05_xgboost_lgbm_quantile.ipynb
│   ├── 06_ensemble_experiments.ipynb
│   ├── 07a_dataset_baselines.ipynb
│   ├── 07b_feature_engineering_v2_ablation.ipynb
│   ├── 07c_model_v2_training_experiments.ipynb
│   └── 07d_cqr_calibration_experiments.ipynb
├── tests/                            # pytest suite (25 tests)
│   ├── conftest.py
│   ├── test_confidence.py
│   ├── test_feature_builder.py
│   ├── test_intervals.py
│   ├── test_price_rounding.py
│   ├── test_ensemble_explainer.py
│   └── test_factor_expert.py
├── admin/                            # Streamlit admin dashboard
│   └── dashboard.py
├── cli/                              # Command-line tools
│   └── manage_models.py
├── logs/                             # Runtime prediction audit logs
│   └── predictions.jsonl
├── Dockerfile
├── Makefile
├── requirements.txt
└── entrypoint.sh
```

**Key design decisions reflected in the structure:**
- **`app/services/` is model-independent:** `predictor.py` only sees `ModelContext`, never the concrete framework.
- **Data is versioned by tag:** `cars_cleaned_2026-06-11_011.csv` maps to `processed_data.csv` via `data_manifest.json`.
- **Models are fully self-contained per run:** Each tag has its own pickles, metadata, metrics, and cache subdirectories.
- **All evaluation is reproducible:** `metrics/` and `cache/` are preserved per run for later comparison.

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/core/config.py:76-128`, `@/home/mo-seif/Documents/GP/ml-service/.gitignore`

#### AI Service (`ai-service/`)

```
ai-service/
├── app/                              # FastAPI chatbot application
│   ├── main.py                       # App factory, lifespan
│   ├── api/
│   │   └── chat.py                   # /api/v1/chat, /api/v1/chat/reset
│   ├── core/
│   │   └── config.py                 # Pydantic Settings (API keys, timeouts)
│   ├── prompts/
│   │   └── chatbot_prompts.yaml      # System prompts + few-shot examples
│   └── services/                     # Chatbot business logic
│       ├── llm_service.py            # Singleton LLMService with fallback chain
│       ├── car_lookup.py             # rapidfuzz fuzzy car matching
│       ├── context_builder.py        # Verified context assembly
│       └── chat_history.py           # In-memory TTL session store
├── data/
│   ├── egypt_market_notes.yaml       # Egyptian market context snippets
│   └── lookups/
│       ├── AI_lookup.csv             # Primary car specs for chatbot
│       ├── AI_lookup.fixed.csv       # Corrected version
│       └── car_aliases.yaml          # Common name aliases
├── docs/
│   └── sample-conversations-*.md     # Example chat transcripts
├── tests/
│   └── test_car_lookup.py            # Fuzzy lookup unit tests
├── logs/
│   ├── ai-service.log                # Application runtime logs
│   └── deepinfra_smoke_test.log      # Provider connectivity tests
├── Dockerfile
├── requirements.txt
└── requirements.prod.txt
```

**Source:** `@/home/mo-seif/Documents/GP/ai-service/app/core/config.py`, `@/home/mo-seif/Documents/GP/ai-service/README.md`

### G3. Data Loaders

The `Settings` class provides typed data loaders:

```python
# CSV
df = settings.load_data("processed")  # → pd.read_csv(data/processed/processed_data.csv)

# Parquet
df = settings.load_data("training")   # → pd.read_parquet(data/processed/training/training.parquet)

# JSON
meta = settings.load_json("metadata") # → json.load(models/metadata/...)
```

These loaders handle:
- File-not-found gracefully (return `None` with warning)
- Encoding detection for CSVs
- Path resolution relative to `project_root`

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/core/config.py:200-250`

### G4. Startup Data Loading

On ML service startup (`main.py` lifespan), three data-loading functions run in sequence:

**1. `load_valid_cars()`**
- Reads `processed_data.csv`
- Builds `VALID_CARS`: set of `(make.lower(), model.lower())` tuples
- Builds `SUPPORT_COUNTS_MM`: dict mapping `(make, model)` → row count
- Builds `SUPPORT_COUNTS_MAKE`: dict mapping `make` → total row count
- If `processed_data.csv` is missing, logs a warning and continues with empty sets

**2. `load_active_model()`**
- Reads `model_registry.json`
- Gets active model path from `get_active_model_path()`
- Loads pickle via `joblib.load()`
- Detects framework via `_detect_framework()`
- Detects quantile vs single vs ensemble
- Loads metadata JSON if available
- Sets `ACTIVE_MODELS`, `ACTIVE_FRAMEWORK`, `ACTIVE_IS_QUANTILE`, `ACTIVE_IS_LOG_TARGET`, `ACTIVE_METADATA`, `ACTIVE_MODEL_ID`

**3. `load_model_diagnostics()`**
- Attempts to load `models/metadata/make_model_mape.csv`
- If found: populates `MAKE_MODEL_MAPE` and `MAKE_MAPE` dicts
- If not found: computes price-dispersion proxy from `processed_data.csv`
- Only groups with `≥ 5` rows are included

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/main.py:38-50`, `@/home/mo-seif/Documents/GP/ml-service/app/services/model/model_state.py:166-318`

### G5. Input Validation

The feature builder validates raw inputs before any lookup or transformation:

- `year >= 1950` and `year <= current_year + 1`
  - Prevents absurd values (e.g., year=1800 or year=2050)
  - Allows current-year cars (new listings)
- `mileage_km >= 0` (if provided)
  - Negative mileage is physically impossible

If validation fails, `ValueError` is raised with a descriptive message.

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/services/prediction/feature_builder.py:160-168`

### G6. Enum Normalization

Raw API values are canonicalized to training-vocabulary values using a lookup table:

| API Value(s) | Normalized Value |
|--------------|-----------------|
| "auto", "automatic", "cvt", "dct", "dsg" | "Automatic" |
| "manual", "stick", "mt" | "Manual" |
| "petrol", "gasoline", "gas" | "petrol" |
| "diesel" | "diesel" |
| "hybrid" | "hybrid" |
| "electric", "ev" | "electric" |

**Why normalize?**
- Training data uses a fixed vocabulary (e.g., "Automatic" not "auto")
- The spec lookup CSV stores canonical values
- Normalization ensures the feature builder and lookup tables speak the same language

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/services/prediction/feature_builder.py:87-120`

### G7. Raw Data Cleaning Pipeline

Before any model training or inference, raw scraped listing data undergoes a rigorous cleaning pipeline. This is an **offline, batch process** run whenever new data is ingested from Supabase.

#### Pipeline Architecture

```
scripts/cleaning/
├── clean_raw_data_pipeline.py   # Master idempotent pipeline
├── data_cleaner.py              # IQR outlier removal + bounds
└── generate_processed_data.py   # Builds processed_data.csv
```

#### Stage 1: Make/Model Canonicalization (`clean_raw_data_pipeline.py`)

- Loads canonical rules from `scripts/config/canonical_rules.yaml`
- Fixes wrong make-model pairs (e.g., "Toyota Civic" → "Honda Civic")
- Standardizes casing using lookup normalization (prevents "bmw 116" → "Bmw 116`)
- Quarantines rows that cannot be canonicalized

**Output:** Cleaned `cars_with_make_model.csv`

**Source:** `@/home/mo-seif/Documents/GP/ml-service/scripts/cleaning/clean_raw_data_pipeline.py:1-104`

#### Stage 2: EV/Hybrid Fixes

- Enforces correct fuel+transmission pairing for electric vehicles
- Corrects data-entry errors where EVs are labeled as "petrol"

#### Stage 3: Impossible Year Cleaning

- Removes listings with `year < 1975` or `year > current_year + 1`
- Conditional drops: flags rows where fuel/transmission combination is impossible for the stated year

#### Stage 4: Deduplication

- Removes exact duplicate listings (same title + year + mileage + price within the same scraping round)

#### Stage 5: Merge Validation

- Checks the specs lookup CSV for ambiguous `(make, model, year)` groups
- Warns if lookup duplicates could cause row inflation during the merge step

**Source:** `@/home/mo-seif/Documents/GP/ml-service/scripts/cleaning/clean_raw_data_pipeline.py:539-636`

#### `data_cleaner.py` — IQR Outlier Removal

```python
# Per brand+model group (minimum 10 rows)
Q1 = group.price_egp.quantile(0.25)
Q3 = group.price_egp.quantile(0.75)
IQR = Q3 - Q1
lower_bound = Q1 - 1.5 * IQR
upper_bound = Q3 + 1.5 * IQR
# Drop prices outside [lower_bound, upper_bound]
```

**Additional filters:**
- Price bounds: `< 50,000 EGP` or `> 20,000,000 EGP` → removed
- Mileage=0 → flagged as NaN, imputed later with brand+model median
- `transmission = "0"` → flagged as NaN, imputed with mode
- Location standardization → mapped to 17 Egyptian governorate categories

**Source:** `@/home/mo-seif/Documents/GP/ml-service/scripts/cleaning/data_cleaner.py:1-23`

### G8. Processed Data Generation (`generate_processed_data.py`)

This script builds `data/processed/processed_data.csv` — the single file consumed by both the ML service at startup and the retrain pipeline.

#### Pipeline Steps

1. **Load cleaned raw data** — `cars_with_make_model.csv`
2. **Drop residual columns** — Removes `model_family`, `brand_market_share` if present
3. **Drop rows missing critical identifiers** — `year` or `price_egp` null → removed
4. **Hard bounds:**
   - Year: `[1975, CURRENT_YEAR]`
   - Price: `[20,000, 20,000,000]` EGP
5. **Mileage fraud filters:**
   - Drop `mileage_km > 500,000` (physically implausible)
   - Old cars (`year < CURRENT_YEAR - 3`) with `< 5,000 km` → likely odometer fraud → dropped
   - New cars with age-specific max mileage caps:
     - Age 0 (current year): max `30,000 km`
     - Age 1: max `70,000 km`
     - Age 2: max `120,000 km`
6. **Fuel/transmission imputation** (mode hierarchy):
   - Primary: mode within `(make, model, year, other_category)`
   - Fallback: mode within `(make, model)`
   - Unresolved → row dropped
7. **Location normalization** — 17 standard Egyptian categories via regex matching:
   - New Cairo, Giza, October & Zayed, Nasr City, Heliopolis, Maadi, Alexandria, Cairo, Qalyubia, Sharqia, Dakahlia, Gharbia, Canal Zone, Upper Egypt, Coastal & Resorts
8. **Merge with specs lookup** — `car_specs_lookup_full_cleaned.fixed.csv` on `(make, model, year)`; exact match first, nearest-year fallback for unmatched rows
9. **Drop rows missing critical spec columns** after merge
10. **Derive features:**
    - `car_age = CURRENT_YEAR - year`
    - `mileage_per_year = mileage_km / max(car_age, 1)`
    - `price_egp_log = log(price_egp)`
11. **Drop rare make+model groups** — `< 5` rows → removed (prevents overfitting on sparse combos)
12. **Select output columns** — Final 18-column schema matching training notebook exactly

**Source:** `@/home/mo-seif/Documents/GP/ml-service/scripts/cleaning/generate_processed_data.py:1-569`

#### Final Output Schema (`processed_data.csv`)

| Column | Type | Source |
|--------|------|--------|
| `make` | categorical | Raw input |
| `model` | categorical | Raw input |
| `year` | int | Raw input |
| `car_age` | int | Derived (`CURRENT_YEAR - year`) |
| `transmission` | categorical | Raw / imputed |
| `fuel` | categorical | Raw / imputed |
| `mileage_km` | float | Raw / imputed |
| `mileage_per_year` | float | Derived |
| `location` | categorical | Normalized |
| `engine_cc` | float | Lookup |
| `horsepower` | float | Lookup |
| `body_type` | categorical | Lookup |
| `drivetrain` | categorical | Lookup |
| `seating_capacity` | int | Lookup |
| `brand_origin` | categorical | Lookup |
| `car_segment` | categorical | Lookup |
| `price_egp` | float | Raw input |
| `price_egp_log` | float | Derived |

**Important:** `data/processed/*.*` is gitignored. This file must be generated on the host machine before the Docker container starts, because `load_valid_cars()` reads it immediately at startup.

**Source:** `@/home/mo-seif/Documents/GP/ml-service/scripts/cleaning/generate_processed_data.py:51-59`

---

## H. AI Service (Chatbot)

### H1. AI Service Layered Architecture

The AI service follows a layered architecture similar to the ML service:

```
┌─────────────────────────────────────────────┐
│  API Layer     (chat.py, main.py)          │
│  - /api/v1/chat endpoint                   │
│  - /api/v1/chat/reset endpoint             │
│  - CORS, request logging middleware        │
├─────────────────────────────────────────────┤
│  LLMService    (llm_service.py)             │
│  - Provider routing & fallback             │
│  - Prompt loading from YAML                │
│  - Grounding augmentation                    │
│  - Response sanitization                   │
├─────────────────────────────────────────────┤
│  Context & Memory  (context_builder,       │
│                    chat_history, car_lookup)│
│  - Car specs lookup & fuzzy matching       │
│  - Search filter parsing                   │
│  - In-memory chat history (TTL-based)      │
├─────────────────────────────────────────────┤
│  Core / Config  (config.py)                │
│  - Pydantic Settings (API keys, paths)       │
│  - CORS origins, logging config            │
└─────────────────────────────────────────────┘
```

**Source:** `@/home/mo-seif/Documents/GP/ai-service/app/main.py:1-182`, `@/home/mo-seif/Documents/GP/ai-service/app/services/llm_service.py:1-751`

### H2. LLMService Provider Routing & Fallback

The `LLMService` class is initialized as a **singleton** at module import time. It manages all LLM provider interactions with automatic fallback.

#### Provider Priority Chain

When `model="auto"` (default), the service tries providers in this order:

**Tier 1: DeepInfra** (primary, most capable)
- Gemini Pro (`google/gemini-3.1-pro`)
- Claude Sonnet (`anthropic/claude-sonnet-4-6`)
- Claude Opus (`anthropic/claude-opus-4-7`)
- Qwen (`Qwen/Qwen3-235B-A22B-Instruct-2507`)

**Tier 2: SambaNova** (secondary)
- Llama 3.3 70B (`Meta-Llama-3.3-70B-Instruct`)

**Tier 3: Gemini** (last resort)
- Gemini 3 Flash Preview (`gemini-3-flash-preview`)

**Disabled providers:** Cerebras, Groq (API keys expired; explicitly skipped)

#### Fallback Mechanics

```python
async def generate_response(..., model: str = "auto"):
    if model == "auto":
        for provider in [deepinfra, sambanova, gemini]:
            try:
                return await provider.call(prompt, ...)
            except Exception as e:
                logger.warning(f"{provider.name} failed: {e}")
                continue
        raise RuntimeError("All providers failed")
    else:
        # Use explicit model selection
        return await specific_provider.call(prompt, ...)
```

**Timeout behavior:** Each provider call has a timeout. If a provider times out or returns an error, the next provider is tried immediately. The user experiences a single response with no awareness that fallback occurred.

#### DeepInfra Internal Fallback Chain

Within the DeepInfra tier, the service does not treat all models as a single block. Instead, it tries DeepInfra models in a specific internal priority order before falling back to SambaNova:

```python
async def _try_deepinfra_models(...):
    models = [
        ("DeepInfra Gemini Pro", settings.deepinfra_gemini_pro_model),
        ("DeepInfra Sonnet",     settings.deepinfra_sonnet_model),
        ("DeepInfra Opus",       settings.deepinfra_opus_model),
        ("DeepInfra Qwen",       settings.deepinfra_model),  # default
    ]
    for label, model_id in models:
        response = await self._try_deepinfra(..., model=model_id)
        if response:
            return response
    return None  # All DeepInfra models failed → fall back to SambaNova
```

**Why four models within DeepInfra?**
- Different models excel at different tasks (Gemini Pro for factual accuracy, Claude for nuanced reasoning, Qwen for Arabic)
- If one model is rate-limited or temporarily unavailable, the next is tried automatically
- This provides resilience without leaving the highest-quality provider tier

**Source:** `@/home/mo-seif/Documents/GP/ai-service/app/services/llm_service.py:476-500`

#### Timeout Configuration

The timeout for each LLM call is configured in `ai-service/app/prompts/chatbot_prompts.yaml`:

```yaml
timeout_seconds: 10.0
```

**Why 10 seconds?**
- DeepInfra and SambaNova APIs typically respond in 2–5 seconds for short chat messages
- 10 seconds provides headroom for longer grounding context blocks while preventing indefinite hangs
- The `AsyncOpenAI` client is initialized with `max_retries=0` to prevent the SDK from burning the timeout budget with internal retries

**Source:** `@/home/mo-seif/Documents/GP/ai-service/app/prompts/chatbot_prompts.yaml`, `@/home/mo-seif/Documents/GP/ai-service/app/services/llm_service.py:112`

#### Explicit Model Selection

The chat API supports explicit model selection via the `model` field:

| Request Value | Provider | Model |
|---------------|----------|-------|
| `auto` | Auto-fallback chain | Best available |
| `sonnet` | DeepInfra | Claude Sonnet |
| `opus` | DeepInfra | Claude Opus |
| `gemini_pro` | DeepInfra | Gemini Pro |
| `deepinfra` | DeepInfra | Default DeepInfra model |
| `llama_samba` | SambaNova | Llama 3.3 70B |
| `gemini` | Gemini | Gemini 3 Flash |

**Source:** `@/home/mo-seif/Documents/GP/ai-service/app/services/llm_service.py:78-144`

### H3. System Prompt & Context Engineering

#### Prompt Loading

The system prompt is loaded from `ai-service/app/prompts/chatbot_prompts.yaml`:

```yaml
system_prompt: |
  You are Karna, an AI assistant specialized in Egyptian used-car pricing and automotive advice.
  You help users understand car prices, features, and market conditions in Egypt.
  ...

few_shot_examples:
  - role: user
    content: "What is a fair price for a 2018 Toyota Corolla?"
  - role: assistant
    content: "In Egypt, a 2018 Toyota Corolla typically ranges from..."
```

**Important:** Few-shot examples are explicitly marked as "style demonstrations, NOT conversation history." They are prepended to every request to guide the model's tone and response structure but are not part of the user's actual conversation.

**Source:** `@/home/mo-seif/Documents/GP/ai-service/app/services/llm_service.py:187-223`

#### Output Script Guardrail

After the LLM generates a response, a script-guardrail is applied:

1. **No CJK characters** — Removes Chinese/Japanese/Korean characters
2. **Arabic script only** — For Arabic responses, strips any non-Arabic, non-ASCII characters
3. **No accented Latin** — Strips diacritics (`é` → `e`, `ö` → `o`)
4. **Currency normalization** — `£` → `EGP`, `€` → `EUR`
5. **Punctuation normalization** — `•` → `-`, `–` → `-`, `“` → `"`, `’` → `'`, `…` → `...`
6. **Collapse whitespace** — Removes excessive spaces and newlines

This ensures responses are clean, readable, and consistent regardless of which LLM provider generated them.

**Source:** `@/home/mo-seif/Documents/GP/ai-service/app/services/llm_service.py:225-260`

### H4. Grounding / Lookup Behavior

The AI service grounds responses using a local CSV snapshot to prevent hallucination about car specs and prices.

#### Grounding Pipeline (`_augment_with_grounding()`)

```
User Message
    → is_search_query()? → Yes → parse_filters() → search_cars() → build_search_context()
    → extract_mention()? → Yes → lookup_specs() → build_specs_context()
    → Neither → No grounding needed
```

**Step 1: Search Intent Detection**

`is_search_query()` detects if the user is asking for a list of cars. Triggers include:
- English: "what cars", "all models", "under", "before", "after", "between", "find me"
- Arabic: "عايز عربية", "كل الموديلات", "أقل من", "أكتر من", "بين"

**Step 2: Filter Parsing**

Natural language filters are extracted:
- `year_min`, `year_max` — "before 2018", "after 2015", "between 2015 and 2018"
- `transmission` — "automatic", "manual"
- `fuel` — "petrol", "diesel", "hybrid"
- `body_type` — "sedan", "suv", "hatchback"
- `drivetrain` — "fwd", "rwd", "awd"
- `engine_cc_max` — "under 1600cc"

**Step 3: Search Execution**

`search_cars()` queries the local `AI_lookup.csv` with the parsed filters and returns:
- Make/model summaries
- Year ranges available
- Transmission types
- Fuel types
- Body types

**Step 4: Specific Car Specs**

`extract_mention()` uses **rapidfuzz** (`token_set_ratio`, score cutoff `85`) to identify make/model mentions in user messages. For example, "I want a Toyota Corolla" → `{"make": "Toyota", "model": "Corolla"}`.

Then `lookup_specs()` retrieves full specification rows from the lookup CSV.

**Step 5: Egypt Market Notes**

Curated notes from `egypt_market_notes.yaml` are injected per make-model to provide local context:
- "Toyota Corolla: Best-selling sedan in Egypt, excellent parts availability, strong resale value."
- "BMW 3 Series: Higher maintenance costs in Egypt, limited specialized workshops outside major cities."

**Source:** `@/home/mo-seif/Documents/GP/ai-service/app/services/car_lookup.py:1-631`, `@/home/mo-seif/Documents/GP/ai-service/app/services/context_builder.py:1-148`

### H5. Chat Memory

The AI service maintains **in-memory chat history** with TTL and max-turn limits.

#### Implementation (`chat_history.py`)

```python
class ChatHistoryStore:
    def __init__(self, ttl_seconds: int = 21600, max_turns: int = 20):
        self.conversations: dict[str, list[dict]] = {}
        self.last_access: dict[str, datetime] = {}
        self.ttl = ttl_seconds
        self.max_turns = max_turns

    def append(self, key: str, role: str, content: str):
        if key not in self.conversations:
            self.conversations[key] = []
        self.conversations[key].append({"role": role, "content": content, "timestamp": now()})
        self.last_access[key] = now()
        # Trim to max_turns
        if len(self.conversations[key]) > self.max_turns * 2:
            self.conversations[key] = self.conversations[key][-self.max_turns * 2:]

    def get(self, key: str) -> list[dict]:
        self._cleanup()
        return self.conversations.get(key, [])

    def reset(self, key: str):
        self.conversations.pop(key, None)
        self.last_access.pop(key, None)

    def _cleanup(self):
        # Remove expired conversations
        now = datetime.utcnow()
        expired = [k for k, v in self.last_access.items() if (now - v).total_seconds() > self.ttl]
        for k in expired:
            self.conversations.pop(k, None)
            self.last_access.pop(k, None)
```

**Key parameters:**
- **TTL:** 6 hours (`21600` seconds) — conversations expire if inactive
- **Max turns:** 20 (40 messages: 20 user + 20 assistant)
- **Storage:** In-memory `dict` — **no persistence across restarts**
- **Current limitation:** Single shared conversation key (`"default"`) — all users share the same conversation context

**Source:** `@/home/mo-seif/Documents/GP/ai-service/app/services/chat_history.py:1-94`

#### History Intent Detection

The chat endpoint detects when the user is asking about previous conversation history:

**Arabic patterns:**
- "سألتك" (I asked you)
- "لحد دلوقتي" (until now)
- "إيه اللي اتكلمنا فيه" (what did we talk about)

**English patterns:**
- "what did I ask", "show my chat history", "what have we discussed", "recap our conversation"

When detected, the service retrieves the stored conversation and returns a summary instead of calling the LLM.

**Source:** `@/home/mo-seif/Documents/GP/ai-service/app/api/chat.py:16-47`

### H6. Response Sanitization

After LLM generation, responses go through a 6-stage sanitization pipeline:

```python
def _sanitize_response_text(text: str, is_arabic: bool = False) -> str:
    # 1. Strip reasoning blocks
    text = re.sub(r'<thinking>.*?</thinking>', '', text, flags=re.DOTALL)

    # 2. Remove CJK characters
    text = re.sub(r'[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]', '', text)

    # 3. Strip Latin diacritics
    text = unicodedata.normalize('NFKD', text)
    text = ''.join(c for c in text if not unicodedata.combining(c))

    # 4. Normalize punctuation
    text = text.replace('•', '-').replace('–', '-').replace('“', '"').replace('”', '"')
    text = text.replace('’', "'").replace('…', '...')

    # 5. Script filtering
    if is_arabic:
        text = re.sub(r'[^\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\u0020-\u007e]', '', text)
    else:
        text = re.sub(r'[^\x00-\x7f]', '', text)

    # 6. Collapse whitespace
    text = ' '.join(text.split())
    return text.strip()
```

**Why sanitize?**
- Different LLM providers produce different artifacts (CJK from Qwen, diacritics from Claude, thinking blocks from reasoning models)
- Sanitization ensures consistent output quality regardless of provider
- Script filtering prevents mixed-script responses (e.g., Arabic text with Cyrillic characters)

**Source:** `@/home/mo-seif/Documents/GP/ai-service/app/services/llm_service.py:225-260`

---

## I. System Communication & Admin Dashboard

### I1. ML Service Startup Sequence

The ML service uses FastAPI's `lifespan` context manager for startup/shutdown orchestration:

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # STARTUP
    1. setup_logging(log_level=settings.log_level)
       → Structured JSON logging + JSONL audit stream
    2. load_valid_cars()
       → Reads processed_data.csv, builds VALID_CARS, SUPPORT_COUNTS_MM, SUPPORT_COUNTS_MAKE
    3. load_active_model()
       → Reads registry, loads pickle, detects framework, sets global state
    4. load_model_diagnostics()
       → Loads make_model_mape.csv or computes proxy
    5. warm_up_shap()
       → Runs dummy SHAP on highest-support combo
    6. init_ensemble_explainer()
       → Loads ensemble sub-models, builds TreeExplainers
    7. warm_up_ensemble_shap()
       → Runs dummy ensemble SHAP

    yield  # Service is now running

    # SHUTDOWN
    # (no explicit cleanup required — in-memory state is released)
```

**Failure handling:** If any warm-up step fails, the service **logs a warning and continues**. This is a deliberate design choice: a prediction service that cannot explain itself is still more useful than a crashed service.

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/main.py:38-50`

### I2. Middleware Stack

The ML service registers three middleware layers in order:

**1. CORS Middleware**
- Allows cross-origin requests from the frontend
- Configurable origins via `CORS_ORIGINS` env var
- Default: `*` (development mode)

**2. RequestLoggingMiddleware**
- Logs every HTTP request/response as structured JSON
- Captures: `method`, `path`, `query_string`, `client_ip`, `status_code`, `duration_ms`, `user_agent`
- Logs at `INFO` level for all requests; `WARNING` for 4xx; `ERROR` for 5xx

**3. MetricsMiddleware**
- Records `http_request_duration_seconds` histogram for **all routes**
- Labels: `method`, `path`, `status_code`
- Also records `prediction_requests_by_endpoint_total` counter with `endpoint` label (`single` / `batch`)

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/core/middleware.py:1-39`, `@/home/mo-seif/Documents/GP/ml-service/app/core/metrics.py:1-118`

### I3. Health Check Endpoint (`GET /health`)

Returns a comprehensive readiness report:

```python
class HealthResponse(BaseModel):
    status: str = "ok"
    model_version: Optional[str] = None
    uptime: Optional[str] = None
    model_loaded: bool = False
    framework: Optional[str] = None
    active_model_id: Optional[str] = None
    diagnostics_loaded: bool = False
    shap_explainer_ready: bool = False
    ensemble_explainer_ready: bool = False
```

**What each field means:**
- `model_loaded` — `ACTIVE_MODELS is not None` (a model pickle was successfully loaded)
- `framework` — The detected framework of the active model (XGBoost / LightGBM / ensemble / sklearn)
- `active_model_id` — The `model_id` from the registry
- `diagnostics_loaded` — `MAKE_MODEL_MAPE` has entries (either from CSV or proxy)
- `shap_explainer_ready` — Single-model SHAP warm-up succeeded
- `ensemble_explainer_ready` — Ensemble SHAP initialization succeeded (only relevant for ensemble models)

**Usage:** The backend can poll this endpoint to determine if the ML service is ready to accept prediction requests.

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/api/health.py:1-29`, `@/home/mo-seif/Documents/GP/ml-service/app/schemas/health.py:1-14`

### I4. Prometheus Metrics Endpoint (`GET /metrics`)

The metrics endpoint exposes both **custom prediction metrics** and **generic HTTP metrics** in Prometheus exposition format.

#### Custom Prediction Metrics

| Metric | Type | Labels | When Incremented |
|--------|------|--------|----------------|
| `prediction_requests_total` | Counter | `confidence` (high/medium/low) | After every successful prediction |
| `prediction_duration_seconds` | Histogram | — | After every prediction, records wall-clock duration |
| `prediction_errors_total` | Counter | — | After every failed prediction or exception |
| `batch_prediction_requests_total` | Counter | — | After every batch request (once per batch, not per item) |
| `prediction_requests_by_endpoint_total` | Counter | `endpoint` (single / batch) | After every request to either endpoint |

**Why separate `prediction_requests_total` and `prediction_requests_by_endpoint_total`?**
- `prediction_requests_total` with `confidence` label is used for confidence-distribution monitoring
- `prediction_requests_by_endpoint_total` with `endpoint` label is used for traffic-volume monitoring
- They serve different observability purposes

#### Generic HTTP Metrics

| Metric | Type | Labels |
|--------|------|--------|
| `http_request_duration_seconds` | Histogram | `method`, `path`, `status_code` |

**Recorded for ALL routes:** `/health`, `/metrics`, `/api/v1/predict`, `/api/v1/predict/batch`, `/admin/*`

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/core/metrics.py:1-118`

### I5. Structured Audit Logging (`predictions.jsonl`)

Every prediction request (single and batch items) is logged as a structured JSON line to `logs/predictions.jsonl`:

```json
{
  "timestamp": "2026-06-03T14:22:18.451234",
  "make": "toyota",
  "model": "corolla",
  "year": 2018,
  "mileage_km": 85000,
  "fair_price": 285000,
  "confidence": "high",
  "model_version": "1.1.0",
  "framework": "ensemble",
  "routing_mode": "exact_match",
  "duration_ms": 45.2,
  "client_ip": "192.168.1.100"
}
```

**Implementation:**
- Dedicated `AuditFileHandler` rotates the file at 50MB
- Old files are suffixed with `.1`, `.2`, etc.
- Log format is pure JSON (no prefixes)
- Separate from the main application logger to prevent log pollution

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/core/logging_config.py:1-127`

### I6. Admin Dashboard (Streamlit)

**Technology:** Streamlit UI running on port `8501`
**API base:** `http://localhost:8001/admin` (configurable via `ADMIN_API_BASE` env var)
**Authentication:** None in current implementation (internal tool, runs on private network)

#### Pages

**1. Registry Overview**
- Active Model ID, Total Models, Latest Candidate, Active Version
- Sortable table of all models with MAPE, MAE, R², Dataset tag, Registered date
- Active model highlighted in green (`st.success`)
- Models sorted by registration date (newest first)

**2. Model Details**
- Dropdown to select any registered model
- Stage badge (green for `production`, blue for `candidate`, gray for `archived`)
- Framework icon, version, dataset tag, sample counts
- **Metrics tab:** Cards for all available metrics (MAE, RMSE, R², MAPE, within_10pct, within_15pct, coverage)
- **Diagnostics tab:** Expandable JSON view of diagnostics summary + full metadata

**3. Compare Models**
- Side-by-side dropdowns to select two models
- Metrics comparison table (highlighting which model is better per metric)
- Coverage comparison: combo count, make count, model count
- Per-tier accuracy comparison

**4. Activate Model**
- Displays currently active model in a green card
- Dropdown to select a `candidate` model for promotion
- Preview card showing stage, framework, version, coverage count
- **Confirmation dialog:** "Are you sure? This will affect live predictions."
- On success:
  - Calls `/admin/models/{id}/activate` API
  - Shows balloon animation (`st.balloons()`)
  - Refreshes the page to show new active model

**5. Coverage Explorer**
- Input fields for `make` and `model`
- "Search" button triggers coverage check
- Shows routing result: `coverage_mode`, `fallback_used`, `target_model_id`
- Lists all registered models that support the exact combo (with stage badges)

**Source:** `@/home/mo-seif/Documents/GP/ml-service/admin/dashboard.py:1-561`

### I7. Admin API Endpoints (`/admin/*`)

| Endpoint | Method | Description | Response |
|----------|--------|-------------|----------|
| `/admin/models` | GET | List all registered models with summary | `list[ModelSummary]` |
| `/admin/models/{model_id}` | GET | Full detail | `ModelDetail` with metadata, artifacts, diagnostics, coverage |
| `/admin/models/{model_id}/activate` | POST | Promote to active + reload | `ActivationResult` |

**Activation endpoint detail:**

```python
@router.post("/models/{model_id}/activate")
async def activate_model(model_id: str):
    # 1. Promote in registry
    promote_active_model(model_id)

    # 2. Clear cached coverage data
    clear_model_coverage_cache()

    # 3. Reload active model in memory
    reload_active_model()
    #    → Loads new pickle
    #    → Reloads diagnostics
    #    → Clears SHAP cache (clear_shap_cache())
    #    → Re-initializes ensemble explainer (init_ensemble_explainer())

    return {
        "success": True,
        "activated_model_id": model_id,
        "previous_model_id": previous_id,
        "reloaded": True,
    }
```

**Why reload everything?**
- The active model pickle is loaded into global memory
- SHAP explainers are cached per-model and must be rebuilt
- Ensemble explainers load sub-models from the new artifact
- Diagnostics CSV may have changed with the new model
- A full reload ensures zero stale state

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/api/admin.py:1-239`

### I8. Docker Compose Service Definitions

The `docker-compose.yml` defines the ML service as:

```yaml
services:
  ml-service:
    build:
      context: ./ml-service
      dockerfile: Dockerfile
    container_name: ml-service
    ports:
      - "8001:8001"   # FastAPI prediction API
      - "8501:8501"   # Streamlit admin dashboard
    volumes:
      - ./ml-service:/app
    env_file:
      - ./ml-service/.env
    environment:
      - PYTHONUNBUFFERED=1
      - ADMIN_API_BASE=http://localhost:8001/admin
    restart: unless-stopped
    networks:
      - karna-network

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    depends_on:
      - db
      - ml-service
    environment:
      - ML_SERVICE_URL=http://ml-service:8001
    networks:
      - karna-network
```

**Key observations:**
- The ML service is on the same Docker network as the backend (`karna-network`)
- The backend reaches the ML service at `http://ml-service:8001` (service name resolution)
- The admin dashboard is exposed on port `8501` from the same container
- Volume mount `./ml-service:/app` means host file changes are reflected immediately
- **Critical:** `processed_data.csv` must exist on the host before container startup because `load_valid_cars()` reads it immediately

**Source:** `@/home/mo-seif/Documents/GP/docker-compose.yml:1-120`

### I9. Internal Communication (Backend → ML Service)

The backend (.NET) communicates with the ML service via HTTP:

**Price generation flow:**
```
Seller clicks "Generate Price"
  → Backend POST /api/v1/predict
    → ML service validates input, runs prediction, returns {fair_price, confidence, negotiation_range}
  → Backend stores prediction in PricingHistory table
  → Backend returns price to frontend
```

**Endpoints used by backend:**

| Route | Method | Backend Usage |
|-------|--------|--------------|
| `/api/v1/predict` | POST | Price generation for seller listings |
| `/health` | GET | Health checks before prediction calls |
| `/metrics` | GET | Monitoring (not used by backend directly) |

**The AI service is called separately by the frontend:**
```
User opens chat widget
  → Frontend POST http://ai-service:8000/api/v1/chat
    → AI service processes message, returns response
  → Frontend displays response
```

**Source:** `@/home/mo-seif/Documents/GP/ml-service/app/main.py:1-72`, `@/home/mo-seif/Documents/GP/docker-compose.yml:1-120`

---

> **End of Chapter 4 ML/AI Implementation Knowledge Document**
>
> This document was generated by extracting precise implementation details directly from the codebase. Every threshold, formula, file path, and code value is taken from the actual source files cited in each section.
