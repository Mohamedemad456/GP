# Changelog — v1.2.0 (Ensemble + Explainability Enhancements)

**Date:** 2026-05-23

---

## 1. Ensemble Model Promoted to Production

- **Active model:** `ensemble_robust_average_v1.1.0` (was `xgboost_quantile_v1.1.0`)
- **Method:** Robust Average — trimmed mean across XGBoost, LightGBM, and Huber sub-models
- **Weights:** `(0.4 XGB, 0.4 LGBM, 0.2 Huber)`
- **Metrics improvement:** MAPE 12.78% (was 13.53%), Within-15% 76.6% (was 74.5%)

## 2. Ensemble SHAP Explainability

**New file:** `app/services/ensemble_explainer.py`

- Loads sub-model pickles from ensemble artifact at startup
- Builds per-sub-model `TreeExplainer` (XGBoost, LightGBM); Huber uses coefficient fallback
- Aggregates SHAP values across sub-models using ensemble weights
- Respects Robust Average trimming — excludes trimmed sub-model from explanation
- Graceful fallback: if some explainers fail, remaining sub-models still produce factors
- Warm-up at startup to avoid cold-start latency on first request

**Existing `explainer.py` untouched** — can switch back to XGBoost at any time by changing `active_model_id` in the registry.

## 3. Predictor Ensemble Branch

**Modified:** `app/services/predictor.py`

- Added `_predict_ensemble()` with lazy sub-model loading and robust average aggregation
- `predict_price()` routes to ensemble branch when `framework == "ensemble"`
- `predict_full()` calls `compute_ensemble_price_factors()` for ensemble, `compute_price_factors()` for XGBoost

## 4. Health Endpoint Readiness

**Modified:** `app/schemas/health.py`, `app/api/health.py`

- Added `shap_explainer_ready` (single-model) and `ensemble_explainer_ready` fields
- When ensemble is active: `shap_explainer_ready: false`, `ensemble_explainer_ready: true` (expected)
- When XGBoost is active: `shap_explainer_ready: true`, `ensemble_explainer_ready: false`

## 5. Egyptian-Market Expert Explanations

**Modified:** `app/services/factor_expert.py`

### Brand notes expanded (8 → 27 brands)
Added: MG, Chery, Geely, BYD, Fiat, Mitsubishi, Suzuki, Peugeot, Renault, Volkswagen, Jeep, Skoda, SEAT, Opel, Honda, Mazda, Subaru, Volvo, Porsche, Land Rover. Each with Egypt-specific dealer, parts, and resale context.

### Factor explanations enriched

| Factor | Before | After |
|---|---|---|
| **Year** | Generic age buckets | Warranty periods, customs duties, depreciation patterns, classic car niche |
| **Mileage** | Generic wear concern | Cairo–Alex commuting, ride-sharing, component-specific wear (bushings, timing belt) |
| **Mileage/yr** | Generic usage intensity | Egyptian commute patterns (6th Oct–Nasr City), Cairo–Aswan corridor |
| **Transmission** | "Auto preferred" | Cairo/Alex congestion context, DSG stress in traffic, CVT longevity concerns |
| **Drivetrain** | Generic AWD/FWD | Sahel/Sinai desert trips, differential/driveshaft costs for RWD |
| **Horsepower** | Generic buckets | Model-class examples (Alto, Cerato, Camry, V8 SUVs), Desert Road context |
| **Engine CC** | Generic size buckets | Egyptian customs duty brackets, licensing fee tiers |
| **Fuel** | One-liner per type | Octane 92/95, CNG cylinder certification, hybrid duty reduction, EV charging network |
| **Body type** | Generic categories | Egypt-specific demand (SUV family use, hatchback parking, convertible climate rarity) |
| **Car segment** | Generic positioning | Specific Egyptian models per segment (Elantra, Cerato, i10, Fortuner) |
| **Brand origin** | Japanese/Korean/European | Split Japanese vs Korean; German vs European; specific Chinese brands; American nuances |
| **Location** | One generic line | Cairo benchmark, Alexandria rust, Delta, Upper Egypt, Red Sea, Canal zone |
| **Seating** | Generic capacity | Egyptian large-family demand, 7-seat premium (Avanza, Carnival, Fortuner) |

### Make-note scope
Brand-specific notes prepended **only** to `brand_origin` factor (not engine_cc, car_segment, etc.) to avoid disconnected text.

## 6. Tests

**New file:** `tests/test_ensemble_explainer.py`

- `test_map_weights_to_names` — weight-to-submodel mapping
- `test_robust_trim_index` — trimming logic for robust average
- `test_ensemble_explainer_ready` — readiness state
- `test_compute_ensemble_price_factors_fallback` — graceful degradation

## Files Changed

| File | Action |
|---|---|
| `app/services/ensemble_explainer.py` | **New** — ensemble SHAP logic |
| `app/services/predictor.py` | Modified — ensemble prediction branch |
| `app/services/factor_expert.py` | Modified — Egypt-market explanations |
| `app/main.py` | Modified — ensemble warm-up at startup |
| `app/schemas/health.py` | Modified — readiness fields |
| `app/api/health.py` | Modified — readiness population |
| `tests/test_ensemble_explainer.py` | **New** — unit tests |
| `models/model_registry.json` | Modified — ensemble promoted to production |
| `docs/batch_prediction_expert_explanations_sample_v2.md` | **New** — v2 sample outputs |
