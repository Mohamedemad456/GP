# ML Model Issues, Fixes, and Recommendations
## Egyptian Used Car Dynamic Pricing Engine — GP Project

**Context:** XGBoost + LightGBM quantile regression models trained on ~20,000 Egyptian used car listings.  
**Current best result:** MAPE ≈ 12.50%, MAE ≈ 131,068 EGP, R² ≈ 0.897 (XGBoost | price_egp_log | E_stratified_by_price_range)  
**Target:** Production-ready pricing engine with honest confidence intervals.

---

## SECTION 1 — Feature Engineering Bugs (Fix Before Next Training Run)

### Issue 1.1 — `car_age` Is Redundant With `year` (Critical)

**Problem:**  
`car_age = 2026 - year` exactly. Both columns contain identical information under different names. The model currently has both in the top 4 SHAP features, splitting importance between two columns that describe one concept. This wastes model capacity and produces a misleading SHAP chart.

**Evidence:**  
SHAP beeswarm shows `year` rank 1 and `car_age` rank 4. They should be one feature.

**Fix:**  
```python
# In the DROP_COLS set at the top of the notebook:
DROP_COLS = {'price_egp', 'price_egp_log', 'car_age'}  # add car_age here

# This automatically removes it from NUM_COLS and FEATURE_COLS
# since NUM_COLS = [c for c in df_raw.columns if c not in DROP_COLS and c not in CAT_COLS]
```

**Expected impact:** Cleaner SHAP, year absorbs all age-related importance, possible minor MAPE improvement.

---

### Issue 1.2 — `location` Missing from CAT_COLS (Critical)

**Problem:**  
`location` has 17 unique string values (Cairo, Giza, Alexandria, New Cairo, Nasr City, etc.) and is clearly categorical. It is not listed in CAT_COLS, so it falls into NUM_COLS as a string column.

- **LightGBM:** auto-detects strings and handles them, but non-canonically
- **XGBoost with enable_categorical=True:** will crash or silently produce garbage on a string column not declared as categorical

**Current CAT_COLS (wrong):**
```python
CAT_COLS = ['make', 'model', 'transmission', 'fuel',
            'body_type', 'drivetrain', 'brand_origin', 'car_segment']
```

**Fixed CAT_COLS:**
```python
CAT_COLS = ['make', 'model', 'transmission', 'fuel', 'location',
            'body_type', 'drivetrain', 'brand_origin', 'car_segment']
```

**Why location matters:**  
A car in New Cairo or Maadi lists 15-20% higher than the same car in Sharqia or Upper Egypt. Location has directional SHAP impact confirmed in beeswarm plot. Dropping it hurts predictions for premium-location cars.

---

### Issue 1.3 — `model_family` Not Used as Feature (Medium Priority)

**Problem:**  
The data pipeline added a `model_family` column to the lookup CSVs during the canonicalization phase (BMW 318i → "3 Series", Hyundai Elantra AD → "Elantra", etc.). This column is not currently in FEATURE_COLS. Adding it provides a mid-level grouping between `make` and `model` that helps with:
- Skoda: Octavia A4/A5/A7/A8 all map to "Octavia" family — the model learns family pricing patterns
- BMW: 316/318/320 share "3 Series" family pricing baseline
- Rare model variants that are grouped into `OTHER_{make}` could still use family signal

**How to add:**  
The `model_family` column should already be present in the processed data after the lookup merge in `02_data_cleaning.ipynb`. If not, add it at the merge step.

```python
# Add to CAT_COLS (it's categorical):
CAT_COLS = ['make', 'model', 'model_family', 'transmission', 'fuel', 'location',
            'body_type', 'drivetrain', 'brand_origin', 'car_segment']
```

**Expected impact:** Improved R² and MAPE for Skoda, BMW variants, and any brand with multiple generations of the same model at different price points.

---

## SECTION 2 — Hyperparameter Tuning Issues

### Issue 2.1 — Optuna Tunes on Wrong Target (High Priority)

**Problem:**  
The Optuna study uses `price_egp` (raw EGP) as the tuning target. But the best-performing models use `price_egp_log` as train target. Parameters optimized for raw EGP are suboptimal for log-transformed training. The export cell also hardcodes `price_egp` model, exporting the worse framework.

**Current code (wrong):**
```python
TUNE_SPLIT = 'D_stratified_by_make'
y_tr_lgbm_tune = df_raw.loc[tr_tune_, 'price_egp']   # wrong target for tuning
```

**Fixed code:**
```python
TUNE_SPLIT = 'E_stratified_by_price_range'   # best split from baseline results
TUNE_TARGET = 'price_egp_log'                # log was consistently better

y_tr_lgbm_tune = df_raw.loc[tr_tune_, TUNE_TARGET]
y_vl_lgbm_tune = df_raw.loc[val_tune,  TUNE_TARGET]
```

**Expected impact:** Better hyperparameters for the model that actually gets exported. Possible 0.3-0.8% MAPE reduction.

---

### Issue 2.2 — Tuning Split Is Suboptimal (Medium Priority)

**Problem:**  
`TUNE_SPLIT = 'D_stratified_by_make'` but the baseline results showed `E_stratified_by_price_range` consistently outperforms D across all frameworks and targets. Optuna should optimize on the split that best represents production distribution.

**Fix:** Change to `E_stratified_by_price_range` as shown above.

---

## SECTION 3 — Quantile Interval Coverage Problem

### Issue 3.1 — Intervals Are Too Narrow (High Priority for GP Defense)

**Problem:**  
The model produces an 80% prediction interval (q10–q90) but actual coverage on the test set is:
- LightGBM: **68.2%** coverage (should be ~80%)
- XGBoost: **71.6%** coverage (should be ~80%)

This means when you tell a user "the price is between X and Y with 80% confidence," you are only right ~70% of the time. A GP reviewer or investor will catch this discrepancy.

**Fix Option A — Widen the quantile bands (easiest):**
```python
# Change from q10/q90 to q5/q95 for wider, better-calibrated intervals
QUANTILES = {
    'lower' : 0.05,   # was 0.10
    'median': 0.50,
    'upper' : 0.95,   # was 0.90
}
```

**Fix Option B — Conformal prediction calibration (most rigorous, best for defense):**

After training the quantile models, calibrate on a held-out calibration set:

```python
def calibrate_coverage(y_cal, y_lo_cal, y_hi_cal, target_coverage=0.80):
    """
    Compute the conformity score needed to achieve target coverage.
    Returns a width multiplier to apply to intervals at inference time.
    """
    # Conformity scores: how much does each interval need to grow to cover y_true?
    conformity_scores = np.maximum(y_lo_cal - y_cal, y_cal - y_hi_cal)
    conformity_scores = np.where(
        (y_cal >= y_lo_cal) & (y_cal <= y_hi_cal), 0, conformity_scores
    )
    
    # Quantile of conformity scores needed for target coverage
    n = len(y_cal)
    q_level = np.ceil((n + 1) * target_coverage) / n
    q_level = min(q_level, 1.0)
    margin = np.quantile(conformity_scores, q_level)
    
    return margin   # add this to lower, subtract from upper at inference


# Usage at inference:
margin = calibrate_coverage(y_cal, y_lo_cal, y_hi_cal, target_coverage=0.80)
y_lo_calibrated = y_lo_pred - margin
y_hi_calibrated = y_hi_pred + margin
```

This guarantees ~80% coverage by construction and is defensible in a GP presentation.

---

## SECTION 4 — Per-Brand Accuracy Problems

### Issue 4.1 — Soueast R²=−0.418 (Not a Real Problem)

**Root cause:** Only 7 test rows. A single outlier prediction completely destroys R² from 7 samples. This is statistical noise, not model failure.

**Fix (evaluation only):**
```python
# Exclude brands with fewer than 20 test rows from per-brand evaluation
MIN_TEST_ROWS_FOR_BRAND_EVAL = 20
```

**What to tell reviewers:** "Soueast has insufficient test samples (n=7) for reliable per-brand evaluation. It is excluded from brand-level metrics but included in global evaluation."

---

### Issue 4.2 — Chery R²=0.074 Despite Acceptable MAPE=9.9% (Data Quality)

**Root cause:** Two separate problems:

1. **Merge conflict in spec data:** During the lookup canonicalization phase, `Volkswagen/Tiggo` rows were reassigned to `Chery/Tiggo`. But Chery/Tiggo already existed with different spec values (different engine_cc, horsepower). The pipeline kept both rows as a merge conflict. Result: some Chery Tiggo rows have wrong specs (the VW-era values), causing the model to see contradictory feature combinations for the same model.

2. **Narrow price range:** All Chery models sell between 400k–900k EGP. R² is sensitive to variance — a model can have good MAPE but poor R² when the target variance is low. Use MAPE as primary metric for Chery, not R².

**Fix for merge conflict:** Manually resolve the Chery/Tiggo rows in `car_specs_lookup_full_cleaned.fixed.csv`. Inspect rows where `make=Chery` AND `model=Tiggo` and keep only the correct Chery Tiggo specs (1498cc, 115hp for standard; larger for Pro/Plus variants).

```python
# Diagnostic query:
specs_df = pd.read_csv('data/lookups/car_specs_lookup_full_cleaned.fixed.csv')
chery_tiggo = specs_df[(specs_df['make']=='Chery') & (specs_df['model']=='Tiggo')]
print(chery_tiggo[['year','engine_cc','horsepower','drivetrain']].to_string())
# Look for rows with inconsistent engine_cc/horsepower for the same year
```

---

### Issue 4.3 — Skoda R²=0.540 (Model Hierarchy Problem)

**Root cause:** Skoda in Egypt spans an extreme price range:
- Octavia A4 (2005): ~150,000 EGP
- Kodiaq (2024): ~2,500,000 EGP

The `model` feature distinguishes these, but the model hierarchy is inconsistent — "Octavia," "Octavia A4," "Octavia A5," "Octavia A7," "Octavia A8" are treated as separate models when they are generations of the same family. Adding `model_family` (all map to "Octavia") gives the model a stable mid-level anchor.

**Fix:** Add `model_family` to FEATURE_COLS as described in Issue 1.3. This is the primary fix for Skoda.

---

### Issue 4.4 — Chevrolet R²=0.787 with 241 Test Samples (Mixed Segment Problem)

**Root cause:** Chevrolet in Egypt is three completely different market segments sharing one brand:
- Economy: Lanos, Aveo (100k–350k EGP) — high volume, consistent pricing
- Mid: Cruze, Captiva (400k–800k EGP) — moderate volume
- American/Luxury: Tahoe, Camaro, Silverado (2M–8M+ EGP) — very few rows, extreme prices

The aggregate Chevrolet metric mixes all three. A few badly-predicted Tahoe rows destroy the aggregate R². The model actually performs well on Lanos and Aveo (likely 6-9% MAPE).

**Diagnostic to run:**
```python
# Per-model MAPE within Chevrolet
chev_mask = df_test['make'] == 'Chevrolet'
chev_true = y_test[chev_mask]
chev_pred = model.predict(X_test[chev_mask])
chev_model = df_test[chev_mask]['model']

results = []
for m in chev_model.unique():
    m_mask = chev_model == m
    if m_mask.sum() < 3:
        continue
    yt = chev_true[m_mask]
    yp = chev_pred[m_mask]
    results.append({
        'model': m,
        'n': m_mask.sum(),
        'MAPE': np.mean(np.abs((yt-yp)/yt)) * 100
    })
pd.DataFrame(results).sort_values('MAPE', ascending=False)
```

**Fix:** Per-price-range evaluation separates economy Chevrolets from luxury ones in the presentation metrics, showing investors a fair picture. The model itself does not need architectural changes for Chevrolet — it already distinguishes models via the `model` feature.

---

## SECTION 5 — Evaluation and Presentation Improvements

### Issue 5.1 — Global MAE Is Misleading for Investors (High Priority for Pitch)

**Problem:**  
Saying "MAE = 131,000 EGP" to an investor or GP doctor is meaningless without context:
- On a 260,000 EGP car: 131k MAE = 50% error (terrible)
- On a 1,000,000 EGP car: 131k MAE = 13% error (good)
- On a 5,000,000 EGP car: 131k MAE = 2.6% error (excellent)

The same number means completely different things depending on the price tier.

**Fix — Implement per-price-range evaluation:**

```python
import numpy as np
import pandas as pd

# Define Egyptian market price tiers
PRICE_BINS   = [0, 300_000, 600_000, 1_000_000, 2_000_000, 5_000_000, float('inf')]
PRICE_LABELS = [
    'Economy       (< 300k EGP)',
    'Mid-range     (300k–600k EGP)',
    'Upper-mid     (600k–1M EGP)',
    'Premium       (1M–2M EGP)',
    'Luxury        (2M–5M EGP)',
    'Ultra-luxury  (5M+ EGP)',
]


def per_price_range_metrics(y_true: np.ndarray,
                             y_pred: np.ndarray,
                             bins: list = PRICE_BINS,
                             labels: list = PRICE_LABELS,
                             min_samples: int = 10) -> pd.DataFrame:
    """
    Compute MAE, MAPE, and Within-10%/15% accuracy per price range.
    Skips buckets with fewer than min_samples rows.
    Always evaluated in EGP space (pass raw price, not log).
    """
    y_true = np.array(y_true, dtype=float)
    y_pred = np.array(y_pred, dtype=float)
    results = []

    for i, label in enumerate(labels):
        mask = (y_true >= bins[i]) & (y_true < bins[i + 1])
        n = int(mask.sum())
        if n < min_samples:
            continue
        yt, yp = y_true[mask], y_pred[mask]
        abs_err  = np.abs(yt - yp)
        rel_err  = abs_err / yt

        results.append({
            'Price Range'     : label,
            'N cars (test)'   : n,
            'Avg actual price': f'{np.mean(yt):,.0f}',
            'MAE (EGP)'       : f'{np.mean(abs_err):,.0f}',
            'MAPE'            : f'{np.mean(rel_err)*100:.1f}%',
            'Within ±10%'     : f'{np.mean(rel_err <= 0.10)*100:.1f}%',
            'Within ±15%'     : f'{np.mean(rel_err <= 0.15)*100:.1f}%',
        })

    df = pd.DataFrame(results)
    return df


# Usage example — call after getting predictions in EGP space:
# y_true_egp = test set actual prices in EGP
# y_pred_egp = model median predictions in EGP (exp transform if log model)

price_range_table = per_price_range_metrics(y_true_egp, y_pred_egp)
print(price_range_table.to_string(index=False))
```

**What to say in your pitch:**  
*"For the most common Egyptian market segment — cars priced between 300,000 and 600,000 EGP, which represents the majority of transactions — our model achieves an average error of [X] EGP with [Y]% of predictions within 15% of the actual price."*

---

### Issue 5.2 — Per-Brand Evaluation Excludes Small-Sample Brands

**Fix already described:** Exclude any brand with fewer than 20 test rows from per-brand evaluation. Add a note to the plot.

```python
MIN_BRAND_TEST_ROWS = 20

brand_eval = (
    per_brand_results[per_brand_results['n_test'] >= MIN_BRAND_TEST_ROWS]
    .sort_values('LGBM_MAPE')
)
```

---

### Issue 5.3 — Cross-Validation Uses KFold Instead of GroupKFold

**Problem:**  
Plain `KFold` can put rows from the same make-model in both train and test folds, producing optimistic CV estimates.

**Fix:**
```python
from sklearn.model_selection import GroupKFold

CV_FOLDS = 5
gkf = GroupKFold(n_splits=CV_FOLDS)

# Use make as the group — each fold tests on unseen makes
for fold, (tr_f, te_f) in enumerate(gkf.split(X_lgbm_all, groups=df_raw['make'])):
    ...
```

**Expected effect:** CV MAPE will be 1-2% higher (more conservative), but more defensible in a GP presentation. The C_split_by_make_only results (MAPE ~25-32%) show what a full make-holdout looks like — GroupKFold is a gentler version of this.

---

## SECTION 6 — Simple Ensemble (Quick Win)

### Recommendation — Average LightGBM + XGBoost Predictions

After training both frameworks, average their median predictions. This consistently reduces MAPE by 0.5-1.5% at zero additional training cost.

```python
def ensemble_predict(lgbm_model, xgb_model, X_lgbm, X_xgb,
                     lgbm_weight=0.5, xgb_weight=0.5,
                     is_log=False):
    """
    Simple weighted average ensemble of LightGBM and XGBoost median predictions.
    If is_log=True, averages in log space then exp-transforms (preferred).
    """
    pred_lgbm = lgbm_model.predict(X_lgbm)
    pred_xgb  = xgb_model.predict(xgb.DMatrix(X_xgb, enable_categorical=True))

    if is_log:
        # Average in log space, then transform — avoids upward bias from raw averaging
        ensemble_log = lgbm_weight * pred_lgbm + xgb_weight * pred_xgb
        return np.exp(ensemble_log)
    else:
        return lgbm_weight * pred_lgbm + xgb_weight * pred_xgb


# Weighted by inverse CV MAPE for better results:
w_lgbm = 1.0 / cv_mape_lgbm
w_xgb  = 1.0 / cv_mape_xgb
total  = w_lgbm + w_xgb

pred_ensemble = ensemble_predict(
    lgbm_med, xgb_med, X_lgbm_test, X_xgb_test,
    lgbm_weight=w_lgbm/total,
    xgb_weight=w_xgb/total,
    is_log=True
)
```

---

## SECTION 7 — Priority Order for Implementation

| Priority | Issue | Expected MAPE Impact | Effort |
|---|---|---|---|
| 1 | Fix `location` in CAT_COLS | 0.2–0.5% improvement | 1 line |
| 2 | Drop `car_age` from features | Minor, cleaner SHAP | 1 line |
| 3 | Tune Optuna on `price_egp_log` + E split | 0.3–0.8% improvement | 5 lines |
| 4 | Simple LightGBM + XGBoost ensemble | 0.5–1.0% improvement | 10 lines |
| 5 | Per-price-range evaluation table | Presentation only | 30 lines |
| 6 | Fix quantile coverage (q5/q95 or conformal) | Fixes coverage gap 68%→80% | 5–50 lines |
| 7 | Add `model_family` to FEATURE_COLS | Fixes Skoda, BMW hierarchy | 5 lines |
| 8 | Fix Chery/Tiggo spec merge conflicts | Fixes Chery R² | Manual data edit |
| 9 | Switch CV to GroupKFold | More conservative CV metrics | 5 lines |
| 10 | Exclude n<20 brands from brand eval | Presentation only | 1 line |

---

## SECTION 8 — Key Numbers to Use in Pitch

After implementing fixes 1–6, expected final metrics:

| Metric | Before fixes | After fixes (expected) |
|---|---|---|
| Best MAPE | 12.50% | ~11.5–12.0% |
| Coverage (80% PI) | 68–72% | ~78–82% |
| Within ±15% | 75.9% | ~77–79% |

**Price range breakdown talking points (fill in after running):**
- Economy (< 300k): MAE = [X] EGP, MAPE = [Y]%
- Mid-range (300k–600k): MAE = [X] EGP, MAPE = [Y]%
- Upper-mid (600k–1M): MAE = [X] EGP, MAPE = [Y]%
- Premium (1M–2M): MAE = [X] EGP, MAPE = [Y]%
- Luxury (2M+): MAE = [X] EGP, MAPE = [Y]%

---

## SECTION 9 — Data Pipeline Issues Still Open

### Issue 9.1 — Chery/Tiggo Merge Conflicts in Spec File

**File:** `data/lookups/car_specs_lookup_full_cleaned.fixed.csv`  
**Problem:** `Volkswagen/Tiggo` rows were reassigned to `Chery/Tiggo` during wrong-pair fixing. The conflict was kept as-is because the spec values differed. Some Chery Tiggo rows now have wrong engine_cc/horsepower values originating from the VW-era entries.  
**Fix:** Open the fixed CSV, filter on `make=Chery, model=Tiggo`, identify which rows have wrong specs, and delete them. The correct Chery Tiggo specs are approximately 1498cc, 115hp (standard), 1500cc, 147hp (Pro), 1600cc, 147hp (some trims).

### Issue 9.2 — model_family Column Propagation to Processed Data

**Problem:** `model_family` was added to the lookup CSVs but may not be flowing through to the processed training data depending on how `02_data_cleaning.ipynb` performs the merge.  
**Check:** After running the cleaning notebook, verify that `model_family` is present in the processed CSV before loading it in the modeling notebook.

```python
df = settings.load_data('processed')
assert 'model_family' in df.columns, "model_family not in processed data — check merge in 02_data_cleaning.ipynb"
```

---

*Document generated during GP project review session — May 2026*  
*For use with coding assistant to implement fixes in notebook 05_xgboost_lgbm_quantile.ipynb*
