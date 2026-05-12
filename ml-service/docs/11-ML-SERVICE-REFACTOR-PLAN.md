# ML Service Refactor, Negotiation Range, Observability, and Future Conformal Prediction Plan

This document is the updated implementation-ready plan for refactoring the FastAPI ML pricing service while keeping the public API stable for backend integration, replacing wide quantile-based negotiation ranges with product-safe confidence/MAPE bands, improving input preprocessing, adding batch prediction, logging, monitoring, and documenting a future conformal prediction roadmap for model vNext.

---

## 0. Final Decisions From Review

- **Public API response will not include `prediction_interval` for now**
  - The backend team only needs `fair_price`, `negotiation_range`, `confidence`, optional `price_factors`, `model_version`, and `predicted_at`.
  - Raw quantile outputs are still useful internally for monitoring, confidence scoring, calibration, and future conformal prediction, but they should not be exposed in the response unless a product/backend consumer needs them.

- **Use MAPE/confidence-based `negotiation_range`**
  - Do not use raw Q5/Q95 quantiles as negotiation range.
  - Quantile outputs can be very wide and can suffer from quantile crossing.

- **Keep/fix current price rounding behavior**
  - Keep market-friendly prices rounded to EGP 5,000 below 200k and EGP 10,000 from 200k upward.
  - Do not switch `>1M` to EGP 25,000 because it would change desired examples like `1,062,928.75 -> 1,060,000`.

- **Refactor `predictor.py` into focused modules**
  - The current file is too large and mixes unrelated responsibilities.

- **Improve `feature_builder.py` safely**
  - Cache lookup files.
  - Normalize inputs.
  - Avoid blind `.title()` for brands/models like `BMW`, `MG`, `BYD`, `A6`, `C180`.
  - Prefer canonicalization from lookup/processed data.

- **Add batch endpoint with best-effort partial results**
  - A failed item should not fail the whole batch.

- **Add observability**
  - Structured JSON logs.
  - Prometheus `/metrics`.
  - Custom prediction/model metrics.

- **SHAP warm-up should execute a real explanation path**
  - Building `TreeExplainer` alone may not remove the first-request delay.

---

## 1. Current Audit and Main Gaps

| Area | Current State | Risk | Recommendation |
|---|---|---|---|
| `services/predictor.py` | 687 lines | Hard to debug, test, modify | Split into state, confidence, interval/range, explainer, orchestration |
| `feature_builder.py` | Loads lookup CSV each request | Slower predictions | Cache lookup with `lru_cache` |
| Feature canonicalization | Uses `.title()` | Breaks `BMW`, `MG`, `BYD`, model casing | Canonicalize using lookup/processed data maps |
| Specs lookup | Exact make/model/year only | Falls back to generic defaults too often | Add nearest-year and aggregate fallback |
| Negotiation range | Raw quantile lower/upper | Too wide, crossing artifacts | Use MAPE/confidence product band |
| Raw quantiles | Returned as range | Confuses product with uncertainty | Keep internal only for monitoring/calibration |
| Price rounding | Current behavior is acceptable | Proposed 25k tier would change expected prices | Keep current 5k/10k behavior |
| API endpoints | `async def` with blocking ML | Can block event loop | Use sync `def` endpoints or threadpool |
| Batch prediction | Missing | Inefficient for bulk clients | Add `/api/v1/predict/batch` |
| SHAP | Cold first call ~10s | Bad first request UX | Warm explainer + real `shap_values()` on startup |
| Logging | Basic module logging only | Hard to trace requests | Structured logs with request IDs |
| Monitoring | No `/metrics` | No model/API visibility | Prometheus metrics and counters |
| Health | Hardcoded model version | Misleading health | Read registry active version |
| Tests | Only rounding/confidence | Refactor can break silently | Add interval, feature, API, batch, health tests |

---

## 2. Negotiation Range Strategy

### 2.1 Why not expose `prediction_interval` in the API response?

The raw model quantiles answer a different question:

- **Raw quantiles / prediction interval:** “What statistical range does the model think could contain prices?”
- **Negotiation range:** “What range should users use for buying/selling negotiation?”

Since your backend/frontend integration only needs the negotiation range, exposing `prediction_interval` now adds interface complexity without a consumer.

### Final API recommendation

Keep the response shape close to current integration:

```json
{
  "fair_price": 1060000,
  "negotiation_range": {
    "min_price": 900000,
    "max_price": 1220000
  },
  "confidence": "high",
  "price_factors": [],
  "model_version": "v1.0.0",
  "predicted_at": "2026-05-11T01:35:42.247419+00:00"
}
```

### Internal-only fields

Inside the service, `predict_price()` may still return:

```python
{
    "fair_price": ...,
    "lower_price": ...,  # raw quantile lower or fallback lower
    "upper_price": ...,  # raw quantile upper or fallback upper
    "model_version": ...,
    "framework": ...,
}
```

But the API should map only the product-safe `negotiation_range` into the response.

---

## 3. Recommended Negotiation Range Formula

### 3.1 Use model MAPE + confidence tier

Current model metadata:

- Active model: `XGBoost_quantile_v1.0.0`
- Test MAPE: about `13.53%`
- Mean quantile width: about `86.45%`

Raw quantile width is too wide for negotiation UX.

### Recommended formula

```python
base_mape = active_model_mape_pct / 100

if confidence == "high":
    band_pct = max(base_mape, 0.12)
elif confidence == "medium":
    band_pct = max(base_mape * 1.35, 0.18)
else:
    band_pct = max(base_mape * 1.85, 0.25)

min_price = fair_price * (1 - band_pct)
max_price = fair_price * (1 + band_pct)
```

For current MAPE ≈ `13.5%`:

| Confidence | Band |
|---|---:|
| high | about ±13.5% |
| medium | about ±18.3% |
| low | about ±25.0% |

### Why this is recommended

- It is stable for product UX.
- It is anchored to measured model error.
- It still widens for low confidence/low support cases.
- It avoids absurd Q5/Q95 output ranges.
- It keeps the API stable.

### Important naming

Do not call this a statistically guaranteed prediction interval. It is a **product negotiation range**.

---

## 4. Future Research-Backed Plan: Conformal Prediction for Model vNext

Conformal prediction should be treated as a **model training/calibration roadmap**, not a quick API patch.

### 4.1 Goal

Create calibrated uncertainty intervals that have measured coverage guarantees, e.g.:

- 80% calibrated interval
- 90% calibrated interval

These can later be used internally or optionally exposed if product needs it.

### 4.2 Recommended method

Use **Conformalized Quantile Regression (CQR)**:

1. Train lower quantile model, e.g. Q0.10 or Q0.05.
2. Train median model Q0.50.
3. Train upper quantile model, e.g. Q0.90 or Q0.95.
4. Use a held-out calibration set.
5. For each calibration row, compute nonconformity score:

```python
score_i = max(q_low_i - y_i, y_i - q_high_i)
```

6. Choose calibrated adjustment `q_hat` from the empirical quantile of scores.
7. Final interval:

```python
calibrated_low = q_low - q_hat
calibrated_high = q_high + q_hat
```

### 4.3 Fix quantile crossing during training/export

Before conformal calibration, ensure:

```python
q_low <= q_median <= q_high
```

Options:

- Sort/rearrange predicted quantiles at inference.
- Use monotonic post-processing.
- Train with constraints or joint models if available.

Current inference only forces ordering with:

```python
lower = min(lower, fair)
upper = max(upper, fair)
```

This prevents invalid ordering but does not fix calibration quality.

### 4.4 Add interval metrics to metadata

Future metadata should include:

```json
{
  "interval_metrics": {
    "target_coverage_pct": 80,
    "actual_coverage_pct": 80.7,
    "mean_width_pct": 34.2,
    "median_width_pct": 28.9,
    "coverage_by_price_segment": {},
    "coverage_by_car_segment": {},
    "coverage_by_support_bucket": {},
    "quantile_crossing_rate_pct": 0.0,
    "calibration_method": "conformalized_quantile_regression"
  }
}
```

### 4.5 How conformal intervals should be used later

Recommended future behavior:

- Keep `negotiation_range` as product-safe MAPE/confidence band unless product changes.
- Use conformal interval internally for:
  - model monitoring
  - confidence scoring
  - drift detection
  - QA dashboards
- Optionally add a separate endpoint later:

```text
GET /api/v1/model/uncertainty
```

or add a request flag:

```json
{
  "include_uncertainty": true
}
```

Do not add it to the default response until there is a consumer.

### 4.6 Research references to document

Add/keep references in `docs/06-RESEARCH-REFERENCES.md`:

- Romano, Patterson, Candes — “Conformalized Quantile Regression”
- Angelopoulos & Bates — “A Gentle Introduction to Conformal Prediction and Distribution-Free Uncertainty Quantification”
- Barber et al. — “Predictive inference with the jackknife+”

---

## 5. Target Refactored Layout

```text
ml-service/app/
├── main.py
├── api/
│   ├── __init__.py
│   ├── health.py
│   └── predict.py
├── core/
│   ├── config.py
│   ├── logging_config.py
│   ├── model_registry.py
│   └── price_rounding.py
├── middleware/
│   ├── __init__.py
│   └── logging_middleware.py
├── monitoring/
│   ├── __init__.py
│   └── metrics.py
├── schemas/
│   ├── health.py
│   └── prediction.py
└── services/
    ├── __init__.py
    ├── model_state.py
    ├── feature_builder.py
    ├── confidence.py
    ├── intervals.py
    ├── explainer.py
    └── predictor.py
```

### Module responsibilities

| Module | Responsibility |
|---|---|
| `model_state.py` | Active model loading, registry metadata, support counts, validity lookup |
| `feature_builder.py` | User input normalization, canonicalization, lookup join, feature engineering |
| `confidence.py` | Confidence label logic using MAPE, support, interval width |
| `intervals.py` | Product-safe negotiation range calculation |
| `explainer.py` | SHAP explainer cache, warm-up, factor computation |
| `predictor.py` | Thin orchestration layer |
| `api/predict.py` | HTTP mapping, validation errors, response construction |
| `monitoring/metrics.py` | Prometheus instrumentation and custom counters/histograms |
| `middleware/logging_middleware.py` | Request ID and structured request logs |

---

## 6. Detailed Implementation Steps

### Step 1 — Preserve/fix price rounding

File: `app/core/price_rounding.py`

Keep the current desired rounding behavior:

```python
def egp_market_step(price_egp: float) -> int:
    p = abs(float(price_egp))
    if p < 200_000:
        return 5_000
    return 10_000
```

Expected examples:

| Raw | Rounded |
|---:|---:|
| 174,782 | 175,000 |
| 393,104 | 390,000 |
| 1,062,928 | 1,060,000 |

Do not implement the `>1M -> 25,000` tier unless product explicitly approves it.

---

### Step 2 — Improve `feature_builder.py`

#### 2.1 Cache lookup loading

Use `@lru_cache(maxsize=1)` for the lookup CSV.

#### 2.2 Add canonicalization maps

Build the canonical map once at module level from the cached lookup CSV:

```python
from functools import lru_cache

@lru_cache(maxsize=1)
def _load_lookup() -> pd.DataFrame:
    path = settings.lookup_dir / "car_specs_lookup_full_cleaned.fixed.csv"
    if not path.exists():
        raise FileNotFoundError(f"Lookup file not found: {path}")
    return pd.read_csv(path)


def _build_canonical_map(lookup: pd.DataFrame) -> dict[tuple[str, str], tuple[str, str]]:
    result = {}
    for _, row in lookup[["make", "model"]].drop_duplicates().iterrows():
        key = (str(row["make"]).strip().lower(), str(row["model"]).strip().lower())
        result[key] = (str(row["make"]).strip(), str(row["model"]).strip())
    return result


# Built once at import time from the cached lookup
_CANONICAL_MAKE_MODEL: dict[tuple[str, str], tuple[str, str]] = {}


def _canonicalize(make: str, model: str) -> tuple[str, str]:
    key = (make.strip().lower(), model.strip().lower())
    return _CANONICAL_MAKE_MODEL.get(key, (make.strip(), model.strip()))
```

Populate `_CANONICAL_MAKE_MODEL` lazily on first call to `build_features()` or at startup:

```python
("BMW", "116")
("Nissan", "Sunny")
("Audi", "A6")
```

Do not use blind `.title()` for make/model. This preserves dataset casing exactly, e.g. `BMW`, `MG`, `A6`, `C180`.

#### 2.3 Normalize enums safely

Normalize transmission:

```python
auto, automatic -> Automatic
manual, stick -> Manual
```

Normalize fuel:

```python
petrol, gasoline, gas -> petrol
diesel -> diesel
hybrid -> hybrid
electric -> electric
```

Location should be stripped, but only title-cased if the dataset uses title-cased locations. Prefer canonical location map if available.

#### 2.4 Add specs fallback

Use this exact pandas priority order inside `build_features()`:

```python
lookup = _load_lookup()
spec = None

# Priority 1: exact make/model/year
match = lookup[(lookup["make"] == make) & (lookup["model"] == model) & (lookup["year"] == year)]
if len(match) > 0:
    spec = match.iloc[0]

# Priority 2: same make/model, nearest year
if spec is None:
    candidates = lookup[(lookup["make"] == make) & (lookup["model"] == model)]
    if len(candidates) > 0:
        idx = (candidates["year"] - year).abs().idxmin()
        spec = candidates.loc[idx]

# Priority 3: same make/model, median numeric / mode categorical specs
if spec is None:
    candidates = lookup[(lookup["make"] == make) & (lookup["model"] == model)]
    if len(candidates) > 0:
        spec = candidates.median(numeric_only=True).combine_first(
            candidates.mode().iloc[0]
        )

# Priority 4: same make, median/mode specs
if spec is None:
    candidates = lookup[lookup["make"] == make]
    if len(candidates) > 0:
        spec = candidates.median(numeric_only=True).combine_first(
            candidates.mode().iloc[0]
        )

# Priority 5: global defaults applied at end of build_features() as before
```

Fill engine_cc, horsepower, body_type, drivetrain, seating_capacity, brand_origin, car_segment from `spec` if it is not None before falling back to the hardcoded defaults dict.

#### 2.5 Validate plausible numeric fields

- `year >= 1950`
- `year <= current_year + 1`
- `mileage_km >= 0`
- optionally cap unrealistic mileage with validation error, e.g. `> 1,000,000` can return 422/400

---

### Step 2b — `services/__init__.py` — what to export

File: `app/services/__init__.py`

Only export stable functions. **Never re-export mutable globals** (`ACTIVE_MODELS`, `ACTIVE_METADATA`, etc.) because `from ... import ACTIVE_MODELS` captures the `None` value at import time and will never see the post-startup value.

```python
from app.services.model_state import load_active_model, load_valid_cars, check_car_validity
from app.services.predictor import predict_price, predict_full
from app.services.explainer import warm_up_shap

__all__ = [
    "load_active_model",
    "load_valid_cars",
    "check_car_validity",
    "predict_price",
    "predict_full",
    "warm_up_shap",
]
# Do NOT add ACTIVE_MODELS or any other mutable module-level globals here.
```

---

### Step 3 — Extract `model_state.py`

Move active model state and loading logic out of `predictor.py`:

- `VALID_CARS`
- `SUPPORT_COUNTS_MM`
- `SUPPORT_COUNTS_MAKE`
- `ACTIVE_MODELS`
- `ACTIVE_FRAMEWORK`
- `ACTIVE_IS_QUANTILE`
- `ACTIVE_PREPROCESSOR`
- `ACTIVE_IS_LOG_TARGET`
- `ACTIVE_METADATA`
- `ACTIVE_MODEL_ID`

Functions:

- `_norm_make_model`
- `_sparse_to_dense`
- `_register_sparse_to_dense_for_unpickling`
- `_detect_framework`
- `_load_is_log_target_from_metadata`
- `load_valid_cars`
- `load_active_model`
- `check_car_validity`
- `is_model_loaded`
- `get_active_model_version`

Important implementation rule:

Do not import mutable globals like this:

```python
from app.services.model_state import ACTIVE_MODELS
```

Use module access instead:

```python
import app.services.model_state as model_state
model_state.ACTIVE_MODELS
```

---

### Step 4 — Extract `confidence.py`

Move confidence logic into `app/services/confidence.py`.

Expose:

- `_confidence_label_from_signals`
- `compute_confidence_label`
- `active_mape_pct`

Keep the current logic directionally:

- global MAPE sets base confidence
- make/model support count degrades confidence
- raw interval width can degrade confidence internally

Future enhancement:

- use segment-level MAPE when training metadata provides it
- e.g. by `car_segment`, `price_range`, `make_support_bucket`

---

### Step 5 — Create `intervals.py`

This module computes the public `negotiation_range`.

Public function:

```python
def compute_negotiation_range(
    fair_price: float,
    confidence: str,
    mape_pct: float | None,
) -> tuple[float, float]:
    ...
```

Recommended formula:

```python
base = (mape_pct or 15.0) / 100.0

if confidence == "high":
    band = max(base, 0.12)
elif confidence == "medium":
    band = max(base * 1.35, 0.18)
else:
    band = max(base * 1.85, 0.25)

return max(0, fair_price * (1 - band)), fair_price * (1 + band)
```

Private helper can still compute raw interval width for monitoring/confidence:

```python
def raw_interval_width_pct(lower_price, fair_price, upper_price) -> float:
    ...
```

Do not expose raw `prediction_interval` in the default API response.

---

### Step 6 — Extract `explainer.py`

Move SHAP functions from `predictor.py`:

- `_get_explain_model`
- `_get_or_build_shap_explainer`
- `compute_price_factors`

Add real warm-up that exercises the full `shap_values()` path, not just `TreeExplainer` construction:

```python
def warm_up_shap() -> bool:
    import app.services.model_state as _ms
    from app.services.feature_builder import build_features, prepare_for_xgboost, prepare_for_lightgbm

    explainer = _get_or_build_shap_explainer()
    if explainer is None:
        logger.warning("SHAP warm-up skipped: explainer could not be built.")
        return False

    # Pick the highest-support make/model pair as the safe warm-up sample
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
```

Startup should call this synchronously. If it fails, log warning and continue — do not crash the server.

---

### Step 7 — Refactor `predictor.py` into thin orchestration

Keep only:

- `predict_price`
- `_predict_quantile`
- `_predict_single`
- `predict_full`

`predict_full` should return internal result dict:

```python
{
    "fair_price": raw_fair,
    "negotiation_range": {
        "min_price": min_price,
        "max_price": max_price,
    },
    "confidence": confidence,
    "price_factors": factors,
    "model_version": model_version,
    "framework": framework,
    "raw_lower_price": raw_lower,  # internal optional
    "raw_upper_price": raw_upper,  # internal optional
}
```

The API response builder should not serialize `raw_lower_price` and `raw_upper_price`.

---

### Step 8 — Update schemas without `prediction_interval`

File: `app/schemas/prediction.py`

Keep public response stable:

```python
class NegotiationRange(BaseModel):
    min_price: float
    max_price: float

class PredictionResponse(BaseModel):
    fair_price: float
    negotiation_range: NegotiationRange
    confidence: str
    price_factors: Optional[List[PriceFactor]] = None
    model_version: str
    predicted_at: str
```

Add batch schemas:

```python
class BatchPredictionRequest(BaseModel):
    items: List[PredictionRequest] = Field(..., min_length=1, max_length=50)

class BatchPredictionItem(BaseModel):
    index: int
    success: bool
    result: Optional[PredictionResponse] = None
    error: Optional[str] = None

class BatchPredictionResponse(BaseModel):
    total: int
    successful: int
    failed: int
    results: List[BatchPredictionItem]
```

Optional guardrail:

- If any item has `include_factors=true`, limit effective batch size to 10 or log warning.

---

### Step 9 — Update API endpoints

File: `app/api/predict.py`

Endpoints:

- `POST /api/v1/predict`
- `POST /api/v1/predict/batch`

Recommendation:

Use sync `def` endpoints because prediction code is blocking CPU work and FastAPI will run sync handlers in a threadpool.

```python
@router.post("/api/v1/predict", response_model=PredictionResponse)
def predict_endpoint(request: PredictionRequest):
    ...
```

Batch behavior:

- Best-effort.
- Return per-item success/error.
- Do not fail whole batch because one car is invalid.

API response builder should:

1. Round fair price.
2. Round negotiation min/max.
3. Re-enforce `min <= fair <= max` after rounding.
4. Convert SHAP dicts into `PriceFactor` models.

---

### Step 10 — Fix health endpoint

File: `app/api/health.py`

Read version from registry/model state instead of hardcoding:

```python
version = get_active_model_version()
```

Return:

```json
{
  "status": "ok",
  "model_version": "v1.0.0",
  "uptime": "..."
}
```

Optional future addition:

```json
{
  "model_loaded": true,
  "shap_ready": true
}
```

Only add those if backend wants them.

---

### Step 11 — Add structured logging

Files:

- `app/core/logging_config.py`
- `app/middleware/logging_middleware.py`

Requirements:

- JSON logs to stdout.
- Optional rotating file log.
- Add request ID.
- Log latency.
- Log endpoint path and status.
- Do not log full body by default.

Recommended prediction log fields:

```json
{
  "event": "prediction_completed",
  "request_id": "...",
  "brand": "Nissan",
  "model": "Sunny",
  "year": 2007,
  "confidence": "high",
  "fair_price": 390000,
  "latency_ms": 82.4,
  "include_factors": true
}
```

Avoid double-encoding JSON. Do not call `logger.info(json.dumps(...))` if the formatter already emits JSON.

---

### Step 12 — Add Prometheus monitoring

Add dependency:

```text
prometheus-fastapi-instrumentator>=6.1
```

Expose:

```text
/metrics
```

Recommended custom metrics:

- `prediction_requests_total`
- `prediction_errors_total`
- `prediction_latency_seconds`
- `prediction_confidence_total{confidence="high|medium|low"}`
- `prediction_batch_size`
- `shap_latency_seconds`
- `shap_failures_total`
- `model_loaded` gauge
- `shap_ready` gauge

HTTP metrics from instrumentator are useful, but custom model metrics are needed for ML monitoring.

---

### Step 13 — Update `main.py`

Startup order:

1. Configure logging.
2. Load valid cars/support counts.
3. Load active model.
4. Warm SHAP with real `shap_values()` call.
5. Register middleware.
6. Register metrics.
7. Include routers.

Startup should log:

- model id/version
- framework
- quantile or single model
- MAPE
- number of valid make/model pairs
- SHAP warm-up status and duration

---

## 7. Testing Plan

Update existing tests:

- `tests/test_confidence.py`
  - Import from `app.services.confidence`, not `app.services.predictor`.

- `tests/test_price_rounding.py`
  - Keep current expected behavior.
  - Do not change to 25k step.

Add tests:

| Test file | What to test |
|---|---|
| `test_intervals.py` | MAPE/confidence range calculation |
| `test_feature_builder.py` | canonicalization, enum normalization, nearest-year fallback |
| `test_predict_api.py` | single endpoint response shape remains stable |
| `test_batch_predict_api.py` | partial success and per-item errors |
| `test_health.py` | model version comes from registry |
| `test_explainer.py` | SHAP warm-up does not crash when supported |

Important API contract test:

```python
assert "prediction_interval" not in response.json()
```

---

## 8. Scalability Notes

### Current realistic estimates

| Deployment | With SHAP | Without SHAP |
|---|---:|---:|
| 1 worker | ~2-5 RPS | ~40-100 RPS |
| 4 workers | ~8-20 RPS | ~160-400 RPS |

These are rough estimates and should be benchmarked.

### Recommendations

- Use multiple workers in production.
- Keep model loaded per worker.
- Avoid SHAP for large batches unless needed.
- Use sync endpoints or threadpool for blocking prediction code.
- Add benchmark script after refactor.

Example production command:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

---

## 9. Future Model Version Roadmap

### v1.1 API/service improvements

- Modular refactor.
- MAPE/confidence negotiation range.
- Batch endpoint.
- Logging + metrics.
- SHAP warm-up.
- Better feature canonicalization.

### v1.2 model calibration improvements

- Add segment-level MAPE.
- Add support-bucket MAPE.
- Add interval metrics by segment.
- Add quantile crossing diagnostics.

### v2.0 conformal prediction

- Train/export quantile models.
- Add calibration split.
- Implement CQR.
- Save conformal adjustment artifact.
- Store calibrated interval metrics in metadata.
- Use calibrated uncertainty internally for confidence and monitoring.

---

## 10. Final Implementation Checklist

- [ ] Keep API response stable; no `prediction_interval` field.
- [ ] Use MAPE/confidence negotiation range.
- [ ] Preserve current price rounding behavior.
- [ ] Split `predictor.py` into focused service modules.
- [ ] Avoid importing mutable globals directly.
- [ ] Cache lookup CSV.
- [ ] Canonicalize make/model from data, not `.title()`.
- [ ] Add nearest-year spec fallback.
- [ ] Add best-effort batch endpoint.
- [ ] Make prediction endpoints sync or use threadpool.
- [ ] Add structured JSON logs with request IDs.
- [ ] Add Prometheus `/metrics` and custom model metrics.
- [ ] Warm up SHAP with a real explanation call.
- [ ] Update tests and add API contract tests.
- [ ] Document conformal prediction as future model work.
