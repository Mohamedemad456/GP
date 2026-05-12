# Conformal Prediction Roadmap — ML Pricing Engine v2.0

This document defines the plan for replacing the current heuristic prediction intervals with
statistically valid uncertainty quantification using Conformalized Quantile Regression (CQR).
This is a **model training and calibration concern, not an API patch**. It is planned for model v2.0.

---

## 0. Motivation

### Current state

The active model `XGBoost_quantile_v1.0.0` is trained with three quantile objectives:

- Q0.05 (lower)
- Q0.50 (median / fair price)
- Q0.95 (upper)

Observed problems:

| Problem | Evidence |
|---|---|
| Mean quantile width is **86.45% of fair price** | `test_metrics_xgb.Mean_width_pct` in metadata |
| Quantile crossing occurs | BMW example: `upper_price == fair_price` after clamping |
| Raw interval too wide for product use | Replaced in v1.1 with MAPE/confidence bands |
| No calibration guarantee | Q0.05–Q0.95 does not guarantee 90% empirical coverage |
| Coverage not uniform across segments | `segmented_mape.png` shows MAPE variance by car type |

### What conformal prediction solves

Given any underlying quantile model, CQR produces intervals that:

1. Achieve the **desired empirical coverage** (e.g. 80%) on the test distribution.
2. Require **no distributional assumptions** — only exchangeability.
3. Are **automatically tighter when the base model is better calibrated**.
4. Fix the **quantile crossing problem** by design.
5. Produce **narrower intervals** than raw Q0.05/Q0.95 because the adjustment is
   calibrated against the actual error distribution, not worst-case.

---

## 1. Background: How CQR Works

### 1.1 Standard quantile regression problem

Train models to predict lower and upper quantile bounds:

```
ŷ_low(x)  → prediction for Q_alpha/2         e.g. Q0.10 for 80% coverage
ŷ_high(x) → prediction for Q_(1-alpha/2)     e.g. Q0.90 for 80% coverage
```

**Problem:** the empirical coverage on unseen data is NOT guaranteed to match the target.

### 1.2 CQR: the calibration fix

CQR adds a one-time calibration step after training using a **held-out calibration set**
that was never seen during training.

**Step 1 — Train quantile models** (same as current, just add Q0.10/Q0.90)

**Step 2 — Compute nonconformity scores on calibration set**

For each calibration example `i`:

```
score_i = max(ŷ_low(x_i) − y_i,   y_i − ŷ_high(x_i))
```

Interpretation:
- Score ≤ 0 → `y_i` is inside `[ŷ_low, ŷ_high]` ✓
- Score > 0 → `y_i` is outside, and the value measures how far outside ✗

**Step 3 — Compute the calibrated adjustment `q_hat`**

```
alpha  = 1 − target_coverage             (e.g. 0.20 for 80% coverage)
level  = ceil((n + 1) × (1 − alpha)) / n
q_hat  = quantile(scores, level)
```

**Step 4 — Apply at inference**

```
calibrated_low  = ŷ_low(x_test)  − q_hat
calibrated_high = ŷ_high(x_test) + q_hat
calibrated_low  = max(calibrated_low, 0)     # prices cannot be negative
```

This interval has a **guaranteed marginal coverage** of at least `1 − alpha`.

### 1.3 Key properties

| Property | Value |
|---|---|
| Marginal coverage guarantee | P(y ∈ interval) ≥ 1 − α |
| Assumption required | Exchangeability only (train/cal from same distribution) |
| Model-agnostic | Works with XGBoost, LightGBM, any quantile model |
| Width depends on | Base model quality — better model → tighter intervals |
| Quantile crossing | Eliminated by design (fix_crossings before scoring) |

---

## 2. Expected Improvement Over Current State

Using current model (MAPE ≈ 13.5%, Q0.05/Q0.95 mean width ≈ 86%):

| Car example | Fair Price | Current raw width | MAPE band v1.1 (high) | CQR 80% est. |
|---|---:|---:|---:|---:|
| Nissan Sunny 2007 | 390,000 | ~337,000 (86%) | ±53,000 (13.5%) | ~±60,000–90,000 |
| BMW 116 2014 | 1,060,000 | uncalibrated upper crossing | ±143,000 | ~±150,000–220,000 |
| Audi A6 2022 | 2,750,000 | ~2,500,000 (90%) | ±371,000 (low conf) | ~±400,000–600,000 |

CQR intervals will be:
- **Tighter than raw Q0.05/Q0.95** (calibrated, not worst-case)
- **Wider than MAPE bands for rare/out-of-distribution cars** (correct behavior)
- **Guaranteed 80% coverage** on in-distribution cars

The MAPE/confidence band (`negotiation_range`) remains the product UX field.
CQR interval is used internally for monitoring and optionally for advanced consumers.

---

## 3. Required Changes

### 3.1 Training data split (notebook 06 or 07)

**Current:** train / test (two-way, stratified by price range)

**Required:** train / calibration / test (three-way)

```
Total data: ~20,461 rows

train:          ~14,000  (68%)
calibration:     ~3,000  (15%)
test:            ~3,461  (17%)
```

Rules:
- Calibration must NOT overlap with train.
- Use stratified split on `price_range` bucket — same strategy as current.
- Test set remains fully held-out for final evaluation metrics.

### 3.2 Quantile targets to train

**Current:** Q0.05, Q0.50, Q0.95

**Recommended for v2.0:**

```python
QUANTILES = {
    "lower_90": 0.05,   # 90% interval lower
    "lower_80": 0.10,   # 80% interval lower (primary product band)
    "median":   0.50,   # fair price
    "upper_80": 0.90,   # 80% interval upper (primary product band)
    "upper_90": 0.95,   # 90% interval upper
}
```

Train all five quantile models. Export as a single dict in the joblib pickle.

**Why 80% primary:**
- 80% intervals are tighter and more product-friendly than 90%.
- 90% intervals are available for internal monitoring and risk-averse consumers.

### 3.3 Fix quantile crossing before calibration scoring

CQR nonconformity scores are corrupted if `ŷ_low > ŷ_high`.

Apply crossing fix to calibration and test predictions before scoring:

```python
def fix_crossings(
    lower: np.ndarray,
    upper: np.ndarray,
) -> tuple[np.ndarray, np.ndarray]:
    return np.minimum(lower, upper), np.maximum(lower, upper)
```

Apply at inference time too (already done in v1.x as a clamp, keep it).

### 3.4 CQR calibration code

```python
import numpy as np


def fit_cqr(
    y_cal: np.ndarray,
    q_low_cal: np.ndarray,
    q_high_cal: np.ndarray,
    target_coverage: float = 0.80,
) -> float:
    """
    Compute the CQR calibration adjustment q_hat.

    Parameters
    ----------
    y_cal        : actual prices on the calibration set
    q_low_cal    : model lower quantile predictions on calibration set
    q_high_cal   : model upper quantile predictions on calibration set
    target_coverage : desired marginal coverage (e.g. 0.80 for 80%)

    Returns
    -------
    q_hat : scalar; add/subtract this at inference time
    """
    n = len(y_cal)
    # Fix crossings before scoring
    q_low_cal, q_high_cal = np.minimum(q_low_cal, q_high_cal), np.maximum(q_low_cal, q_high_cal)
    scores = np.maximum(q_low_cal - y_cal, y_cal - q_high_cal)
    alpha = 1.0 - target_coverage
    level = np.ceil((n + 1) * (1 - alpha)) / n
    level = float(np.clip(level, 0.0, 1.0))
    q_hat = float(np.quantile(scores, level))
    return q_hat


def apply_cqr(
    q_low: np.ndarray,
    q_high: np.ndarray,
    q_hat: float,
) -> tuple[np.ndarray, np.ndarray]:
    """Apply CQR adjustment at inference time."""
    cal_low  = np.maximum(q_low  - q_hat, 0.0)  # prices cannot be negative
    cal_high = q_high + q_hat
    return cal_low, cal_high
```

### 3.5 Validate coverage on test set after calibration

```python
def evaluate_coverage(
    y_test: np.ndarray,
    cal_low: np.ndarray,
    cal_high: np.ndarray,
    target_coverage: float = 0.80,
    label: str = "overall",
) -> dict:
    covered = (y_test >= cal_low) & (y_test <= cal_high)
    actual_cov  = float(covered.mean())
    mean_width  = float((cal_high - cal_low).mean())
    mean_w_pct  = float(((cal_high - cal_low) / np.maximum(y_test, 1)).mean() * 100)

    print(f"[{label}]  target={target_coverage:.0%}  "
          f"actual={actual_cov:.3%}  "
          f"mean_width={mean_width:,.0f} EGP  ({mean_w_pct:.1f}%)")

    return {
        "segment": label,
        "target_coverage_pct": target_coverage * 100,
        "actual_coverage_pct": round(actual_cov * 100, 2),
        "mean_width_egp": round(mean_width, 0),
        "mean_width_pct": round(mean_w_pct, 2),
    }


# Evaluate overall + by segment
results = [evaluate_coverage(y_test, cal_low, cal_high, 0.80)]

for seg in df_test["car_segment"].unique():
    mask = df_test["car_segment"] == seg
    results.append(
        evaluate_coverage(y_test[mask], cal_low[mask], cal_high[mask], 0.80, label=seg)
    )
```

**Acceptance criteria:**

| Metric | Required |
|---|---|
| Overall actual coverage | ≥ 78% (within 2% of 80% target) |
| No segment below | 70% |
| Mean width | < 50% of fair price |
| Quantile crossing rate | 0% |

---

## 4. Artifacts to Export

After calibration, export:

```
models/
├── pickles/
│   ├── xgb_quantile_models_v2.joblib       # dict: {lower_90, lower_80, median, upper_80, upper_90}
│   └── cqr_calibration_v2.joblib           # dict below
└── metadata/
    └── XGBoost_quantile_v2.0.0.json
```

**`cqr_calibration_v2.joblib` structure:**

```python
{
    "q_hat_80": 42500.0,             # subtract/add for 80% coverage
    "q_hat_90": 68200.0,             # subtract/add for 90% coverage
    "calibration_n": 3024,
    "calibration_date": "2026-...",
    "actual_coverage_80": 0.803,
    "actual_coverage_90": 0.901,
    "mean_width_pct_80": 34.2,
    "mean_width_pct_90": 51.6,
}
```

**Updated `interval_metrics` block in metadata JSON:**

```json
{
  "interval_metrics": {
    "target_coverage_80_pct": 80.0,
    "actual_coverage_80_pct": 80.3,
    "mean_width_80_pct": 34.2,
    "median_width_80_pct": 28.9,
    "target_coverage_90_pct": 90.0,
    "actual_coverage_90_pct": 90.1,
    "mean_width_90_pct": 51.6,
    "quantile_crossing_rate_pct": 0.0,
    "calibration_method": "conformalized_quantile_regression",
    "calibration_set_n": 3024,
    "coverage_80_by_car_segment": {
      "budget": 81.2,
      "family": 80.1,
      "premium": 79.4,
      "luxury": 77.8
    },
    "coverage_80_by_support_bucket": {
      "low_support_under10": 74.2,
      "medium_10_to_50": 79.6,
      "high_over50": 82.1
    }
  }
}
```

---

## 5. API Integration Plan

### 5.1 v1.1 — no API change needed

```json
{
  "fair_price": 1060000,
  "negotiation_range": { "min_price": 900000, "max_price": 1220000 },
  "confidence": "high",
  "model_version": "v1.1.0"
}
```

MAPE/confidence `negotiation_range` stays as the product-safe field.

### 5.2 v2.0 — optional calibrated interval field

Load the CQR artifact in `model_state.py` at startup:

```python
CQR_CALIBRATION: dict | None = None   # new global

# In load_active_model():
cqr_path = resolve_registry_path(info.get("cqr_path"))
if cqr_path and cqr_path.exists():
    CQR_CALIBRATION = joblib.load(cqr_path)
    logger.info("Loaded CQR calibration: q_hat_80=%.0f", CQR_CALIBRATION["q_hat_80"])
```

Add optional request flag to schema:

```python
class PredictionRequest(BaseModel):
    ...
    include_uncertainty: Optional[bool] = False
```

Add optional response field:

```python
class CalibratedInterval(BaseModel):
    low: float
    high: float
    coverage_target_pct: int

class PredictionResponse(BaseModel):
    fair_price: float
    negotiation_range: NegotiationRange
    confidence: str
    calibrated_interval: Optional[CalibratedInterval] = None   # new, opt-in only
    price_factors: Optional[List[PriceFactor]] = None
    model_version: str
    predicted_at: str
```

Build it in `predict_full()` when requested and when CQR is available:

```python
cal_interval = None
if include_uncertainty and _ms.CQR_CALIBRATION is not None and _ms.ACTIVE_IS_QUANTILE:
    q_hat = _ms.CQR_CALIBRATION.get("q_hat_80", 0.0)
    low  = max(raw["lower_price"] - q_hat, 0.0)
    high = raw["upper_price"] + q_hat
    cal_interval = {
        "low": low, "high": high, "coverage_target_pct": 80
    }
```

**Do NOT add this to the default response.** Only appears when `include_uncertainty=true`.

### 5.3 How CQR improves confidence scoring in v2.0

Replace the raw-width penalty in `confidence.py` with the calibrated width:

```python
# v1.1: penalizes raw interval width (unreliable because of crossing/wide Q0.05-Q0.95)
if width_pct > 1.5:
    return "low"

# v2.0: use calibrated width (tighter, reliable)
if calibrated_width_pct > 0.60:
    return "low"
elif calibrated_width_pct > 0.40:
    label = _degrade_label(label)
```

This makes confidence scoring more accurate for out-of-distribution cars.

---

## 6. Implementation Checklist

### Notebook (06 or 07)

- [ ] Three-way stratified split (train / calibration / test)
- [ ] Train Q0.10 and Q0.90 in addition to Q0.05, Q0.50, Q0.95
- [ ] Apply `fix_crossings()` before computing calibration scores
- [ ] Run `fit_cqr()` for 80% and 90% targets
- [ ] Evaluate coverage overall and by `car_segment` and support bucket
- [ ] Verify all acceptance criteria are met
- [ ] Export `cqr_calibration_v2.joblib`
- [ ] Update metadata JSON with `interval_metrics` block
- [ ] Register new model in registry with `cqr_path`

### API service (v2.0)

- [ ] Add `CQR_CALIBRATION` global to `model_state.py`
- [ ] Load CQR artifact in `load_active_model()`
- [ ] Add `include_uncertainty` flag to `PredictionRequest` schema
- [ ] Add `CalibratedInterval` and `calibrated_interval` to `PredictionResponse` schema
- [ ] Build calibrated interval in `predict_full()` when requested
- [ ] Update `confidence.py` to use calibrated width when available
- [ ] Update health endpoint to report `cqr_ready` status

### Testing

- [ ] Unit test `fit_cqr()` with synthetic data — verify coverage at target level
- [ ] Unit test `apply_cqr()` — verify non-negative outputs
- [ ] Integration test: `calibrated_interval` absent by default
- [ ] Integration test: `calibrated_interval` present when `include_uncertainty=true`
- [ ] Coverage integration test on held-out test set (overall ≥ 78%)
- [ ] Regression test: `fair_price` and `negotiation_range` unchanged after v2.0 model swap

---

## 7. Migration Path

```
v1.0.0  (current production)
  Model:  Q0.05 / Q0.50 / Q0.95 only
  API:    raw quantiles → forced monotonicity → wide ranges

v1.1.x  (this refactor — no model change)
  Model:  v1.0.0 unchanged
  API:    MAPE/confidence negotiation_range (product-safe)
          raw quantiles used internally for confidence scoring only

v1.2.x  (calibration metrics — notebook change only)
  Model:  v1.1.0 — same quantile models + segment-level MAPE in metadata
  API:    confidence scoring uses segment MAPE when available
          no API contract change

v2.0.0  (CQR — major model version)
  Model:  5 quantiles + CQR calibration artifact exported
  API:    optional calibrated_interval field (opt-in with include_uncertainty=true)
          negotiation_range stays primary product field
          confidence scoring uses calibrated width
```

---

## 8. Why Not Simpler Alternatives

| Alternative | Why not |
|---|---|
| Wider raw quantiles (Q0.01/Q0.99) | Even wider intervals; still no coverage guarantee; crossing still possible |
| Bootstrap percentile intervals | Requires many model fits; too expensive at inference |
| Bayesian credible intervals | Requires full Bayesian model — different architecture, expensive |
| Fixed MAPE bands only (v1.1) | Product-safe but not statistically valid; no per-car uncertainty |
| Isotonic regression recalibration | Fixes crossing only, not coverage guarantee |

---

## 9. Research References

| Paper | Key contribution |
|---|---|
| Romano, Patterson, Candes — "Conformalized Quantile Regression" (NeurIPS 2019) | Original CQR algorithm with full coverage guarantee proof |
| Angelopoulos & Bates — "A Gentle Introduction to Conformal Prediction" (2022) | Practical guide; split conformal, adaptive conformal |
| Barber, Candes, Ramdas, Tibshirani — "Predictive Inference with the Jackknife+" (2019) | Alternative for small calibration sets |
| Tibshirani et al. — "Conformal Prediction Under Covariate Shift" (NeurIPS 2019) | Handles distribution shift between train and production |
| Lei et al. — "Distribution-Free Predictive Inference for Regression" (JASA 2018) | Local conformal regression, per-instance adaptive width |

---

*This document covers model v2.0 planning only.*
*No changes to current production code are required to implement this plan.*
*Update this document when notebook 06/07 is created and calibration results are available.*
