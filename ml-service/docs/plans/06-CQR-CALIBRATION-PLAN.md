# Plan 6: Conformalized Quantile Regression (CQR) — Internal Confidence Signal

> **Scope**: CQR is an INTERNAL signal only. It feeds the confidence system and gates negotiation range width. No API response changes. No `prediction_interval` field.

> **Recommended Model**: **Opus 4.6** (statistical correctness is critical — wrong CQR = meaningless intervals)  
> **Dependencies**: Plan 04 (Model V2 Training) must be complete  
> **Blocks**: Plan 07 (API Updates — confidence system integration)

---

## Current State & Problems

### Problem 1: Raw Quantile Predictions Have No Coverage Guarantee
- Current model outputs Q0.10 and Q0.90 quantile predictions
- The actual empirical coverage is 86.8% (for a target of 80%) — sounds good but is inconsistent
- For some make/model combos, coverage is 60%; for others it's 99%
- **Why**: Quantile regression minimizes pinball loss globally, but doesn't guarantee per-sample coverage
- **Impact**: Users can't trust "this car is worth between X and Y" statement

### Problem 2: Intervals Are Not Adaptive
- Current intervals have fixed behavior — they don't widen for uncertain predictions
- A rare Soueast should have much wider intervals than a common Toyota Corolla
- The model can't express "I'm unsure about this specific prediction"
- **Impact**: False confidence for rare/unusual cars, unnecessarily wide for well-known cars

### Problem 3: Heuristic Negotiation Range is Disconnected from Model
- Current `negotiation_range` is MAPE-based: `fair_price × (1 ± mape%)`
- This ignores the actual model uncertainty for that specific prediction
- A car where XGB and LGBM agree should have a tighter range than one where they disagree
- **Impact**: Negotiation advice doesn't reflect model's actual uncertainty

### Problem 4: No Formal Statistical Validity
- For a GP presentation, having "statistically valid prediction intervals with guaranteed coverage" is a major selling point
- Current approach is heuristic — can't make formal claims about interval coverage
- **Impact**: Weaker academic argument for the pricing system's reliability

---

## What is CQR?

### Background
**Conformalized Quantile Regression (CQR)** is a distribution-free method that provides prediction intervals with finite-sample coverage guarantees.

**Key idea**: Use a held-out calibration set to compute a correction factor that adjusts raw quantile predictions so that the resulting intervals achieve exactly the desired coverage level.

### How it works (simplified):

1. **Train** quantile models on training data → get raw Q_lo and Q_hi
2. **Calibrate** on held-out calibration set:
   - For each calibration sample, compute nonconformity score: `E_i = max(Q_lo_i - y_i, y_i - Q_hi_i)`
   - The score measures "how wrong the interval was" for that sample
3. **Find correction**: `q_hat = quantile(E_scores, level=(1-α)(1 + 1/n))`
   - This is the correction needed to achieve target coverage α
4. **Apply at inference**: `[Q_lo - q_hat, Q_hi + q_hat]`
   - Widens the interval by exactly the amount needed for coverage

### Why CQR beats alternatives:
- **vs. wider quantiles**: CQR is data-adaptive — it widens only as much as needed
- **vs. bootstrap**: CQR is much faster (single calibration step) and has formal guarantees
- **vs. conformal prediction (vanilla)**: CQR gives asymmetric intervals that respect the data distribution

---

## Implementation Plan

### Step 6.1 — Calibration Data Preparation
**Already done in Plan 04** (15% calibration split using GroupShuffleSplit)

Requirements for calibration set:
- ~3,000 rows (15% of 20K)
- Same (make, model) groups as will appear in production
- Never seen during training
- Different from test set

### Step 6.2 — Compute Raw Quantile Predictions on Calibration Set

Using trained V2 models from Plan 04:
```python
# Predict all 5 quantiles on calibration set
q05_cal = ensemble_predict(X_cal, quantile='q05')
q10_cal = ensemble_predict(X_cal, quantile='q10')
q50_cal = ensemble_predict(X_cal, quantile='q50')
q90_cal = ensemble_predict(X_cal, quantile='q90')
q95_cal = ensemble_predict(X_cal, quantile='q95')
y_cal = calibration_set['price_egp'].values
```

### Step 6.3 — Enforce Quantile Monotonicity

Before computing nonconformity scores, ensure quantiles are monotonically ordered for each sample. This prevents crossing quantiles from distorting interval widths and coverage calculations.

```python
# Stack all quantile predictions: [q05, q10, q50, q90, q95]
preds = np.column_stack([q05_cal, q10_cal, q50_cal, q90_cal, q95_cal])
# Sort along the quantile axis so q05 <= q10 <= q50 <= q90 <= q95
preds_sorted = np.sort(preds, axis=1)
q05_cal, q10_cal, q50_cal, q90_cal, q95_cal = preds_sorted.T
```

This step was moved from Plan 04 into Plan 06 because monotonicity is most critical at the interval-calibration stage rather than during model experimentation.

### Step 6.4 — Compute Nonconformity Scores

For each coverage level (80% and 90%):

```python
# 80% interval: Q0.10 to Q0.90
scores_80 = np.maximum(q10_cal - y_cal, y_cal - q90_cal)

# 90% interval: Q0.05 to Q0.95
scores_90 = np.maximum(q05_cal - y_cal, y_cal - q95_cal)
```

**Interpretation of scores**:
- Score < 0 → true value is INSIDE the raw interval (correct)
- Score > 0 → true value is OUTSIDE the raw interval (incorrect, score = how far outside)
- Large positive score → the model was very wrong for this sample

### Step 6.5 — Compute Correction Factors

```python
n = len(scores_80)

# For 80% coverage (α = 0.80)
level_80 = np.ceil((1 - 0.80) * (n + 1)) / n  # Adjusted level
# Actually: quantile level = ceil((n+1) * (1-alpha)) / n for finite-sample guarantee
q_hat_80 = np.quantile(scores_80, min(level_80, 1.0))

# For 90% coverage (α = 0.90)
level_90 = np.ceil((1 - 0.90) * (n + 1)) / n
q_hat_90 = np.quantile(scores_90, min(level_90, 1.0))
```

**Correct formula**: The quantile level should be `ceil((n+1)(1-α)) / n` to ensure finite-sample marginal coverage ≥ 1-α.

### Step 6.6 — Validate on Test Set

```python
# Apply corrections to test set predictions
q10_corrected = q10_test - q_hat_80
q90_corrected = q90_test + q_hat_80
q05_corrected = q05_test - q_hat_90
q95_corrected = q95_test + q_hat_90

# Check empirical coverage
coverage_80 = np.mean((y_test >= q10_corrected) & (y_test <= q90_corrected))
coverage_90 = np.mean((y_test >= q05_corrected) & (y_test <= q95_corrected))

# Should be close to target (within ±2%)
assert 0.78 <= coverage_80 <= 0.84, f"80% coverage is {coverage_80:.3f}"
assert 0.88 <= coverage_90 <= 0.94, f"90% coverage is {coverage_90:.3f}"
```

### Step 6.7 — Export Calibration Artifacts

```python
import json

cqr_config = {
    "q_hat_80": float(q_hat_80),
    "q_hat_90": float(q_hat_90),
    "calibration_n": int(n),
    "coverage_80_empirical": float(coverage_80),
    "coverage_90_empirical": float(coverage_90),
    "method": "CQR",
    "reference": "Romano et al. 2019",
    "quantiles_used": {
        "interval_80": ["q10", "q90"],
        "interval_90": ["q05", "q95"]
    }
}

with open('models/metadata/cqr_calibration.json', 'w') as f:
    json.dump(cqr_config, f, indent=2)
```

### Step 6.8 — Integrate with Inference

At inference time, the predictor loads `cqr_calibration.json` and applies:
```python
# Raw quantile predictions from model
q05_raw, q10_raw, q50_raw, q90_raw, q95_raw = model.predict(x)

# Enforce monotonicity before calibration
preds = np.column_stack([q05_raw, q10_raw, q50_raw, q90_raw, q95_raw])
preds_sorted = np.sort(preds, axis=1)
q05_raw, q10_raw, q50_raw, q90_raw, q95_raw = preds_sorted.T

# CQR-calibrated 80% interval
lower_80 = q10_raw - q_hat_80
upper_80 = q90_raw + q_hat_80

# CQR-calibrated 90% interval
lower_90 = q05_raw - q_hat_90
upper_90 = q95_raw + q_hat_90

# Ensure non-negative prices
lower_80 = max(lower_80, 0)
lower_90 = max(lower_90, 0)
```

---

## How CQR Feeds the Confidence System (Internal)

### Internal signal flow

After computing `q_hat_80` and `q_hat_90` from calibration, the system knows the **calibrated interval width** for any prediction:

```python
calibrated_width_pct = ((q90 + q_hat_80) - (q10 - q_hat_80)) / fair_price * 100
```

### Usage in confidence logic

```python
if calibrated_width_pct > 60:
    # Model is very uncertain about this prediction
    confidence = degrade(confidence)   # e.g. "high" -> "medium", "medium" -> "low"
    
if calibrated_width_pct > 40:
    # Model is moderately uncertain
    negotiation_range = cap_at_percent(fair_price, 15)  # max ±15%
```

### Negotiation range capping

The existing MAPE-based `negotiation_range` is kept unchanged for the API. But internally, if CQR says the interval is very wide:

- **Cap** `negotiation_range.min_price` to `fair_price * 0.85`
- **Cap** `negotiation_range.max_price` to `fair_price * 1.15`
- **Degrade** confidence label accordingly

The API response shape stays identical. Only the `confidence` label and `negotiation_range` values change.

---

## Challenges & Risks

| Challenge | Risk | Mitigation |
|-----------|------|-----------|
| Calibration set too small | Noisy q_hat estimation | 3K samples is sufficient for stable estimation |
| Correction factor is very large | Intervals become uselessly wide | Indicates model is poorly calibrated — go back to training |
| Coverage guarantee is marginal (over all predictions, not per-group) | Per-tier coverage may still be uneven | Can compute per-tier q_hat for more granular calibration |
| q_hat can be negative | Interval narrows instead of widens | This is correct! Means raw quantiles were already too wide |
| Edge case: calibration set doesn't represent test distribution | Coverage guarantee weakens | GroupShuffleSplit ensures similar distribution |

---

## Advanced: Per-Tier CQR (Optional Enhancement)

If time allows, compute separate correction factors per price tier:
```python
for tier in ['economy', 'standard', 'luxury', 'ultra_luxury']:
    mask = tier_cal == tier
    scores_tier = scores_80[mask]
    q_hat_tier = np.quantile(scores_tier, level_80)
    # Store per-tier correction
```

This gives tighter intervals for well-predicted tiers and wider intervals for hard tiers.

**Decision**: Implement basic (global) CQR first. Per-tier CQR is a V3 enhancement.

---

## Files Modified/Created by This Plan

| File | Action |
|------|--------|
| `models/metadata/cqr_calibration.json` | NEW — calibration parameters |
| `app/services/model/model_state.py` | Load CQR params at startup |
| `app/services/prediction/predictor.py` | Apply CQR corrections to intervals |
| `app/services/model/intervals.py` | Optional: update negotiation range to use CQR info |
| Training notebook (07) | CQR calibration cells (Steps 4.2-4.6) |

---

## Success Criteria

- [ ] CQR calibration completes without errors
- [ ] `q_hat_80` and `q_hat_90` are finite, reasonable values (not > 50% of median price)
- [ ] Test-set 80% coverage is between 78-84%
- [ ] Test-set 90% coverage is between 88-94%
- [ ] Calibrated intervals are meaningfully narrower than naive ±MAPE% intervals
- [ ] `cqr_calibration.json` exported with all required fields
- [ ] API can optionally return calibrated intervals
