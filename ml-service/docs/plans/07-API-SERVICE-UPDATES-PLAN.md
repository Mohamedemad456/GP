# Plan 7: API & Service Updates

> **Recommended Model**: Sonnet 4.6 (predictor updates) + GPT 5.4 (bug fixes)  
> **Dependencies**: Plans 02 (Features), 04 (V2 Model), 06 (CQR internal signal) must be complete  
> **Blocks**: Plan 09 (Testing)

---

## Current State & Problems

### Problem 1: Predictor Hardcoded for V1 Model Structure
- `predictor.py` expects either 3-quantile dict `{lower, median, upper}` or ensemble with base_models
- V2 models have 5 quantiles `{q05, q10, median, q90, q95}` — predictor can't handle this
- V2 ensemble drops Huber — current ensemble logic specifically handles Huber's sklearn-style predict
- **Impact**: V2 model won't work with current API code

### Problem 2: Negotiation Range Can Leak
- From findings doc: `negotiation_range.min_price` can exceed `fair_price` in edge cases
- Root cause: MAPE-based calculation doesn't account for cases where model MAPE is very high
- **Impact**: Confusing user experience ("minimum price is higher than fair price?!")

### Problem 3: Expert Descriptions Repeat and Contradict
- `factor_expert.py` sometimes generates the same description template for multiple factors
- SHAP direction (positive/negative) can contradict the text sentiment
- Example: SHAP says year is pushing price DOWN, but description says "Newer model year adds value"
- **Impact**: User distrust of explainability features

### Problem 4: Missing Transmission Values in Schema
- API schema only accepts "Automatic" and "Manual"
- CVT and DSG exist in the data but aren't accepted by the API validation
- **Impact**: API rejects valid requests for cars with CVT/DSG transmissions

### Problem 5: Feature Builder Out of Sync After V2
- After Plan 2 adds new features, the inference feature builder must produce EXACTLY the same feature vector as training
- Any mismatch = garbage predictions silently
- **Impact**: Most dangerous silent failure mode

---

## Implementation Steps

### Step 7.1 — Update Model Loading for V2 Format
**Model**: Sonnet 4.6  
**File**: `app/services/model/model_state.py`

**Changes**:
1. Handle V2 ensemble format:
   ```python
   # V2 ensemble artifact structure:
   {
       "method": "weighted_average",
       "weights": {"xgb": 0.55, "lgbm": 0.45},
       "base_models": {
           "xgb": "models/pickles/xgb_quantile_v2.joblib",
           "lgbm": "models/pickles/lgbm_quantile_v2.joblib"
       },
       "quantiles": ["q05", "q10", "median", "q90", "q95"]
   }
   ```
2. Load CQR calibration params at startup:
   ```python
   CQR_PARAMS: dict | None = None  # Loaded from cqr_calibration.json
   
   def load_cqr_params():
       global CQR_PARAMS
       path = settings.model_metadata_dir / "cqr_calibration.json"
       if path.exists():
           CQR_PARAMS = json.loads(path.read_text())
   ```
3. Handle 5-quantile model dicts (keys: `q05, q10, median, q90, q95`)

### Step 7.2 — Update Predictor for V2 Ensemble
**Model**: Sonnet 4.6  
**File**: `app/services/prediction/predictor.py`

**Changes**:
1. Update `_predict_ensemble()` to handle V2 structure (no Huber, 5 quantiles):
   ```python
   def _predict_ensemble_v2(df_features):
       # Load sub-models (XGB + LGBM only)
       xgb_preds = _predict_xgb_quantiles(df_features)  # {q05, q10, median, q90, q95}
       lgbm_preds = _predict_lgbm_quantiles(df_features)  # {q05, q10, median, q90, q95}
       
       # Weighted average per quantile
       w_xgb, w_lgbm = 0.55, 0.45
       ensemble = {q: w_xgb * xgb_preds[q] + w_lgbm * lgbm_preds[q] for q in quantiles}
       
       # Apply CQR corrections
       if CQR_PARAMS:
           ensemble['lower_80'] = ensemble['q10'] - CQR_PARAMS['q_hat_80']
           ensemble['upper_80'] = ensemble['q90'] + CQR_PARAMS['q_hat_80']
           ensemble['lower_90'] = ensemble['q05'] - CQR_PARAMS['q_hat_90']
           ensemble['upper_90'] = ensemble['q95'] + CQR_PARAMS['q_hat_90']
       
       return {
           'fair_price': max(ensemble['median'], 0),
           'lower_price': max(ensemble.get('lower_80', ensemble['q10']), 0),
           'upper_price': max(ensemble.get('upper_80', ensemble['q90']), 0),
           ...
       }
   ```

2. Keep backward compatibility: if model is V1 format, use old path

### Step 7.3 — Fix Negotiation Range Leak
**Model**: GPT 5.4  
**File**: `app/services/model/intervals.py`

**Bug**: `min_price` can exceed `fair_price`  
**Fix**:
```python
def compute_negotiation_range(fair_price, confidence, mape_pct):
    ...
    # ALWAYS enforce: min_price <= fair_price <= max_price
    min_price = min(min_price, fair_price)
    max_price = max(max_price, fair_price)
    return min_price, max_price
```

### Step 7.4 — Fix Expert Description Issues
**Model**: GPT 5.4  
**File**: `app/services/explainability/factor_expert.py`

**Bug 1**: Repeated descriptions  
**Fix**: Track used template keys, skip if already used

**Bug 2**: Direction contradiction  
**Fix**: Validate SHAP direction against template sentiment:
```python
def _validate_direction(shap_value, template_sentiment):
    """Ensure SHAP direction matches template.
    shap_value > 0 = pushes price UP → template should be positive
    shap_value < 0 = pushes price DOWN → template should be negative
    """
    if shap_value > 0 and template_sentiment == 'negative':
        return False  # Skip this template, use generic
    if shap_value < 0 and template_sentiment == 'positive':
        return False
    return True
```

### Step 7.5 — Add CVT/DSG to Transmission Schema
**Model**: GPT 5.4  
**File**: `app/schemas/` (request validation)

**Add** to valid transmission values:
- `"CVT"` (Continuously Variable Transmission)
- `"DSG"` (Direct Shift Gearbox)
- `"Tiptronic"`

**Also update**: `feature_builder.py`'s `_TRANSMISSION_MAP`:
```python
_TRANSMISSION_MAP = {
    "auto": "Automatic",
    "automatic": "Automatic",
    "manual": "Manual",
    "stick": "Manual",
    "cvt": "Automatic",      # Treat CVT as automatic variant
    "dsg": "Automatic",      # Treat DSG as automatic variant
    "tiptronic": "Automatic", # Treat Tiptronic as automatic variant
}
```

### Step 7.6 — Ensure Feature Builder Sync
**Model**: Sonnet 4.6 (CRITICAL)  
**File**: `app/services/prediction/feature_builder.py`

This is the most dangerous step — must match training EXACTLY:
1. `FEATURE_COLS` list must match training notebook exactly (same order)
2. New feature computations must use same formulas
3. Lookup loading must handle missing entries gracefully
4. Label encoder must include new categories (`mm_price_tier` values)
5. Defaults must be sensible (not 0, which could bias predictions)

**Verification approach**: Create a test that:
1. Takes 10 samples from processed_data.csv
2. Feeds them through feature_builder
3. Compares output with what the training notebook would produce
4. Asserts exact equality (within floating point tolerance)

---

## API Contract Stability

### What MUST NOT change:
- Response schema for existing fields (`fair_price`, `negotiation_range`, `confidence`)
- Endpoint paths (`/api/v1/predict`, `/api/v1/predict/batch`)
- Request schema (make, model, year, mileage_km, transmission, fuel, location)
- Price rounding behavior (< 200K → round to 5K, ≥ 200K → round to 10K)
- Error response format

### What CAN change:
- Internal model version (transparent to client)
- Confidence calibration (better is better)
- Addition of new OPTIONAL response fields
- Addition of new OPTIONAL query parameters

---

## Challenges & Risks

| Challenge | Risk | Mitigation |
|-----------|------|-----------|
| V2 model format breaks V1 backward compat | Service won't start | Version detection in model loading logic |
| CQR params not available (file missing) | Crash on startup | Graceful fallback to raw quantiles |
| Feature builder mismatch with training | Silent wrong predictions | Test with actual training data samples |
| Expert description fix breaks existing tests | Test regressions | Update test expectations |
| CVT/DSG mapping to "Automatic" loses info | Slightly worse predictions for these cars | Acceptable — tree model has limited transmission splits anyway |

---

## Files Modified by This Plan

| File | Action |
|------|--------|
| `app/services/model/model_state.py` | V2 model format support |
| `app/services/prediction/predictor.py` | V2 ensemble prediction logic |
| `app/services/model/intervals.py` | Fix negotiation range leak |
| `app/services/explainability/factor_expert.py` | Fix description bugs |
| `app/services/prediction/feature_builder.py` | V2 features sync |
| `app/schemas/` | Add CVT/DSG transmission values |

---

## Success Criteria

- [ ] Service starts with V2 model without errors
- [ ] `/health` returns `model_loaded: true`, correct version
- [ ] `/api/v1/predict` returns valid predictions with V2 model
- [ ] `negotiation_range.min_price` ≤ `fair_price` ≤ `negotiation_range.max_price` (always)
- [ ] CVT/DSG transmissions are accepted
- [ ] Expert descriptions don't repeat or contradict
- [ ] All existing tests pass
- [ ] Feature builder output matches training pipeline exactly
