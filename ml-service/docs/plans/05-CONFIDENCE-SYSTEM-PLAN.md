# Plan 5: Confidence System & Fallback Routing

> **Recommended Model**: Sonnet 4.6 (confidence logic) + GPT 5.4 (bug fixes)  
> **Dependencies**: Plans 02 (Features) and 03 (Retrain CLI) must be complete  
> **Blocks**: Plan 07 (API Updates)

---

## Current State & Problems

### Problem 1: Missing `very_low` Confidence Label
- Current labels: `high`, `medium`, `low`
- No way to flag predictions where the model is genuinely unreliable
- At 40%+ MAPE on a 600K EGP car, the prediction is ±240K off — actively misleading
- **Impact**: Users trust predictions that shouldn't be trusted

### Problem 2: MAPE Thresholds Are Magic Numbers
- `confidence.py` uses hardcoded `14.0` and `18.0` thresholds
- These were calibrated to the 12.4% global MAPE of an old model
- After retraining, global MAPE shifts — thresholds become wrong
- **Impact**: Most cars get "high" even when they shouldn't, or vice versa

### Problem 3: No Fallback Routing for Missing Combos
- When a new model is trained, it may not cover all make-model combos
- If user requests a car the new model has never seen, it still predicts (tree generalization)
- But `n_support=None` and confidence degrades naturally — this may not be enough
- **Impact**: Silent degradation of quality for rare cars after retraining

### Problem 4: `width_pct` Branch Is Dead for Non-Quantile Models
- `confidence.py` checks `if is_quantile and width_pct is not None:`
- The width branch is skipped entirely for the current ensemble
- **Impact**: A useful uncertainty signal (interval width) is ignored

### Problem 5: Expert Descriptions Can Contradict SHAP
- `factor_expert.py` sometimes generates descriptions with wrong sentiment
- SHAP says feature pushes price DOWN, but text says "adds value"
- **Impact**: User distrust of explainability

---

## What is NOT in this plan (discarded from old fallback plan)

- **Stale data analysis**: The old vs new data comparison is outdated. Current training uses 20K+ rows from `training_data.csv`.
- **Old model fallback architecture**: Keeping a V0 model permanently loaded is unnecessary. Instead, we route to the **previous promoted version** when the current model lacks a combo.

---

## Implementation Steps

### Step 5.1 — Add `very_low` Confidence Label
**File**: `app/services/model/confidence.py`

Add a fourth label `very_low` with explicit trigger conditions:

```python
MAPE_HIGH_THRESHOLD = 14.0      # below this → high confidence
MAPE_MEDIUM_THRESHOLD = 18.0   # below this → medium confidence
MAPE_VERY_LOW_THRESHOLD = 40.0  # above this → very_low confidence

# Trigger conditions for very_low (applied before all other logic):
# - mape_pct > 40.0
# - OR: n_support < 5 AND mape_pct > 10.0
```

`very_low` should **only be set explicitly**, never through `_degrade_label()`.

### Step 5.2 — Make MAPE Thresholds Dynamic
**File**: `app/services/model/confidence.py`

After each retrain, the thresholds should be recalibrated to the new model's global MAPE:

```python
# Option A: Static thresholds updated manually after each retrain
# Option B: Dynamic thresholds computed at load time (recommended)

def compute_dynamic_thresholds(global_mape_pct: float) -> dict:
    """Compute thresholds relative to global MAPE."""
    return {
        'high': global_mape_pct * 1.1,      # slightly above global
        'medium': global_mape_pct * 1.5,    # generous buffer
        'very_low': max(global_mape_pct * 3.0, 35.0),  # never below 35%
    }
```

**Decision**: Start with Option A (manual update). After 2-3 retrains, evaluate if Option B is stable enough.

### Step 5.3 — Fix `SUPPORT_COUNTS_MM` for Fallback Combos
**File**: `app/services/model/confidence.py`

When a fallback model serves a prediction, `n_support` must come from the fallback model's support counts, not the current model's.

```python
# Current: n_support = _ms.SUPPORT_COUNTS_MM.get((make, model))
# Problem: Returns None for fallback combos

# Fix: Pass n_support explicitly based on which model served the prediction
# Or: Store per-version combo sets and look up the correct one
```

**Implementation**: Use `combo_set_{version}.json` (created at train time) to get the correct n_support for any model version.

### Step 5.4 — Implement Model Version Fallback Routing
**File**: `app/services/prediction/predictor.py` or new `app/services/model/router.py`

```python
def route_prediction(make: str, model: str) -> str:
    """Decide which model version serves this make+model.
    
    Returns model_id to use.
    """
    current = get_current_model()
    if (make, model) in current.trained_combos:
        return current.model_id
    
    # Fallback: find previous model that has this combo
    for prev in get_previous_models():
        if (make, model) in prev.trained_combos:
            return prev.model_id
    
    # No model has it — current model generalizes (tree models can do this)
    return current.model_id
```

**Combo set source**: `models/metrics/combo_set_{version}.json`

### Step 5.5 — CQR → Confidence Integration
**File**: `app/services/model/confidence.py`

Load `cqr_calibration.json` at startup (if available). Use calibrated interval width to gate confidence:

```python
def apply_cqr_to_confidence(
    base_confidence: str,
    fair_price: float,
    lower_raw: float,
    upper_raw: float,
    cqr_params: dict,
) -> tuple[str, float]:
    """Apply CQR-calibrated interval width to confidence decision.
    
    Returns (adjusted_confidence, calibrated_width_pct).
    """
    q_hat_80 = cqr_params.get('q_hat_80', 0)
    calibrated_lower = lower_raw - q_hat_80
    calibrated_upper = upper_raw + q_hat_80
    width_pct = (calibrated_upper - calibrated_lower) / fair_price * 100
    
    if width_pct > 60:
        return _degrade_label(base_confidence), width_pct
    
    return base_confidence, width_pct
```

### Step 5.6 — Fix Negotiation Range Leak
**File**: `app/services/model/intervals.py`

```python
def compute_negotiation_range(fair_price, confidence, mape_pct):
    ...
    # ALWAYS enforce: min_price <= fair_price <= max_price
    min_price = min(min_price, fair_price)
    max_price = max(max_price, fair_price)
    
    # Cap at ±15% if CQR says interval is very wide
    if cqr_width_pct and cqr_width_pct > 40:
        min_price = max(min_price, fair_price * 0.85)
        max_price = min(max_price, fair_price * 1.15)
    
    return min_price, max_price
```

### Step 5.7 — Fix Expert Description Issues
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
        return False
    if shap_value < 0 and template_sentiment == 'positive':
        return False
    return True
```

### Step 5.8 — Add CVT/DSG to Transmission Schema
**File**: `app/schemas/` (request validation)

Add to valid transmission values: `CVT`, `DSG`, `Tiptronic`

Also update `feature_builder.py` transmission map to treat these as automatic variants.

---

## Snapshot Strategy Decision (Deferred)

**Decision deferred until after first retrain on new data.**

Two options to test:

| Option | Data | Date Feature | Risk |
|--------|------|-------------|------|
| **Single latest snapshot** | 19,451 rows | `scraping_date` available | Less data, fewer combos |
| **Merged snapshots (current default)** | 29,656 rows | No date col | Same car at different prices → unexplained variance |

**Concern with merged snapshots**: Without `scraping_date` as a feature, the model sees duplicate cars at different prices as noise. Toyota Corolla at 850K in May vs 920K in July without a date feature looks like unexplained variance.

**Path forward**:
1. First retrain: use `training_data.csv` (merged, no date) — baseline
2. Second experiment: use individual snapshots with `scraping_date` as `days_since_baseline` feature
3. Compare eval metrics
4. The single-snapshot path makes fallback routing more important (combos drop per run)

Document results here before implementing fallback routing in production.

---

## Files Modified by This Plan

| File | Action |
|------|--------|
| `app/services/model/confidence.py` | Add `very_low`, dynamic thresholds, CQR integration |
| `app/services/model/intervals.py` | Fix leak, add CQR capping |
| `app/services/model/model_state.py` | Load combo sets for fallback routing |
| `app/services/prediction/predictor.py` | Add routing logic (or new router.py) |
| `app/services/explainability/factor_expert.py` | Fix description bugs |
| `app/schemas/` | Add CVT/DSG transmission values |
| `app/services/prediction/feature_builder.py` | Transmission mapping update |

---

## Success Criteria

- [ ] `very_low` confidence is triggered correctly (MAPE > 40% or n_support < 5 with high MAPE)
- [ ] MAPE thresholds are recalibrated after each retrain
- [ ] Fallback routing correctly uses previous model version for missing combos
- [ ] CQR-calibrated width degrades confidence when intervals are very wide
- [ ] `negotiation_range.min_price` ≤ `fair_price` ≤ `negotiation_range.max_price` (always)
- [ ] CVT/DSG transmissions are accepted by API
- [ ] Expert descriptions don't repeat or contradict SHAP direction
- [ ] All existing tests pass
