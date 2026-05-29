# Complete Project Findings, Bugs, and V2 Plan
## Egyptian Used Car Pricing Engine — Full Session Notes

**Scope:** Everything discussed, found, recommended, and planned across the full review session.
**Audience:** Developer + coding agent implementing V2.
**How to use:** Work through sections in order. Do not skip sections.

---

## Part 1 — What Is Working Well (Keep As-Is)

### 1.1 Data Pipeline
- Canonicalization pipeline is production-grade. YAML-driven rules, three-layer fix approach,
  idempotent scripts. Architecture is correct and maintainable.
- Quarantine pattern (removing bad rows with audit trail) is the right approach.
- model_family column is correctly added to lookup CSVs.
- 46 spec conflicts resolved (0 ambiguous groups remaining in lookup).
- `fix_lookups_make_model.py --report / --apply` pattern is solid engineering.

### 1.2 Model
- XGBoost quantile regression is the right architecture for this problem.
- Q5/Q95 quantile choice (changed from Q10/Q90) significantly improved coverage:
  LightGBM 68% → 78.4%, XGBoost 71.6% → 87.7%.
- Optuna tuning converged correctly. Both models well-tuned.
- Dropping car_age from features was correct. SHAP chart confirmed no redundancy.
- location correctly added to CAT_COLS. SHAP confirms it has real signal.
- Ensemble (geometric mean in log space) consistently beats any single model.
- SHAP factors are directionally correct and business-interpretable.
- Per-price-tier evaluation is the right presentation framework for investors.

### 1.3 API
- Module decomposition (model_state / confidence / interval / explainer / predictor) is clean.
- SHAP warm-up at startup is the right solution to first-request latency.
- Dual-field response (negotiation_range + prediction_interval) is the right product decision.
- Batch endpoint design (best-effort, error per item, max 50) is correct.
- Structured JSON logging middleware is correct.
- Price rounding tiers (<100k→1k, 100-500k→5k, 500k-1M→10k, >1M→25k) are correct.

### 1.4 Confidence Scoring
- Multi-signal approach (MAPE + support count + interval width) is correct.
- The three thresholds (≤14%=high, ≤18%=medium, >18%=low) are appropriate for current MAPE ~12.9%.
- Confidence correctly degrades for rare models.

---

## Part 2 — Confirmed Bugs (Fix Immediately)

### BUG-001 — Negotiation Range Leaks Raw Quantiles for Low-Confidence Luxury Cars
**Severity:** Critical (wrong product output)
**Symptom:** For a 4.7M EGP car with low confidence, negotiation_range shows
min_price=440,000 EGP and max_price=8,960,000 EGP (raw Q5/Q95 quantile output
instead of MAPE-tiered product band).

**Expected behavior:** With MAPE=13.5% and low confidence (multiplier=1.5):
- alpha = 0.135 × 1.5 = 0.2025
- min_price = 4,700,000 × (1 - 0.2025) = 3,752,250 EGP
- max_price = 4,700,000 × (1 + 0.2025) = 5,647,750 EGP

**Where to look:** `app/services/interval.py` → `compute_negotiation_range()` must be
called from `app/services/predictor.py` → `predict_full()`. Check that `_build_response()`
in `app/api/predict.py` uses `result["negotiation_range"]` (from predict_full) not the
raw quantile lower/upper values directly.

**Test to confirm fix:**
```python
# After fix, run this test:
import requests
r = requests.post('http://localhost:8000/api/v1/predict', json={
    "brand": "Land Rover", "model": "Range Rover",
    "year": 2022, "mileage_km": 20000
})
data = r.json()
fair = data['fair_price']
mn = data['negotiation_range']['min_price']
mx = data['negotiation_range']['max_price']
confidence = data['confidence']

# For low confidence, max width should be ±20.25% not ±90%
max_allowed_width_pct = {'high': 0.135, 'medium': 0.155, 'low': 0.2025}[confidence]
assert mn >= fair * (1 - max_allowed_width_pct * 1.05), f"min_price too low: {mn}"
assert mx <= fair * (1 + max_allowed_width_pct * 1.05), f"max_price too high: {mx}"
print("PASS: negotiation_range is MAPE-tiered")
```

---

### BUG-002 — Expert Explanation Descriptions Contain Repetitive Closing Sentence
**Severity:** Medium (quality issue)
**Symptom:** Most factor descriptions end with:
"In this case, the model treats this as price-supportive, so it tends to increase
the estimated market value." This sentence adds no information since direction
is already a separate field.

**Fix:** Remove closing meta-sentence from all rule templates in `factor_expert.py`
(or wherever expert descriptions are generated). Description should be self-contained.

---

### BUG-003 — Contradiction in Descriptions When Direction=Negative for Neutral-Sounding Feature
**Severity:** Medium (user confusion)
**Symptom:** BYD F3, horsepower, direction=negative, description says:
"Moderate horsepower is often acceptable for daily driving"
User reads "acceptable" and cannot understand why it decreases price.

**Fix:** When direction is negative for a feature that sounds neutral/positive,
the description must explain WHY it is still a negative signal:
"Moderate horsepower is standard for economy cars, but it is lower than what
the model typically sees at this price point, so it acts as a mild negative signal."

The rule: never use positive adjectives (acceptable, fine, good) when direction=negative
without explaining the contradiction.

---

### BUG-004 — CVT/DSG Not in API Schema Validation
**Severity:** Low-Medium
**Symptom:** Training data has 388 rows with transmission=Cvt or Dsg (intentionally kept).
If the Pydantic schema uses `Literal['Manual', 'Automatic']` it will reject these values.

**Fix:** Schema must accept all four values:
```python
transmission: Optional[Literal['Manual', 'Automatic', 'Cvt', 'Dsg']] = None
```
Also verify `feature_builder.py` passes CVT/DSG through to the model without normalizing.

---

### BUG-005 — Ford Bronco Raptor Mislabeled Data Still in Training
**Severity:** Medium (model quality issue)
**Symptom:** 36 rows labeled "Ford Bronco Raptor" with mean price 553k EGP.
Real Bronco Raptor is a $75,000+ import costing 3-4M EGP in Egypt.
These are mislabeled Ford Rangers or other commercial pickups.

**Fix:** Add to `clean_impossible_model_years.py`:
```python
{"make": "Ford", "model": "Bronco Raptor", "min_year": 2021,
 "note": "Real Raptor min year 2021. Pre-2021 entries are mislabeled."}
```
Then investigate: do post-2021 entries also have wrong prices (~553k)?
If mean price is still wrong after year fix, drop Bronco Raptor from training entirely.

**Diagnostic notebook cell:**
```python
import pandas as pd
df = pd.read_csv('data/processed/processed_data.csv')
raptor = df[(df['make']=='Ford') & (df['model']=='Bronco Raptor')]
print(f'Total Bronco Raptor rows: {len(raptor)}')
print(raptor[['make','model','year','transmission','fuel','engine_cc',
              'horsepower','price_egp','mileage_km']].sort_values('year').to_string())
print(f'\nPrice stats:')
print(raptor['price_egp'].describe())
print(f'\nReal Bronco Raptor should cost 3,000,000+ EGP.')
print(f'Any row below 2,000,000 EGP is mislabeled.')
```

---

## Part 3 — Data Quality Issues Found

### 3.1 Confirmed Dirty Data — Add to `clean_impossible_model_years.py`

For each entry below, also add a diagnostic notebook cell (see Section 7 for template).

| make | model | Fix | Note |
|---|---|---|---|
| Chevrolet | Avalanche | min_year=2002, max_year=2013 | Only produced 2002-2013. 1978/1984/1985/1996 entries are Egyptian commercial trucks (Dababa) mislabeled. |
| Ford | Bronco Raptor | min_year=2021 | Investigate if post-2021 entries also wrong prices |
| Hyundai | Excel | max_year=1994 | Discontinued 1994 globally |
| Fiat | 127 | max_year=1983 | Discontinued 1983 |
| Fiat | 128 | max_year=1985 | Discontinued 1985 |
| Fiat | 131 | max_year=1984 | Discontinued 1984 |
| Fiat | 132 | max_year=1981 | Discontinued 1981 |

### 3.2 Suspected Dirty Data — Investigate Before V2

Run diagnostic cells for each (template in Section 7):

**VW Touareg (MAPE=288%, n=6):**
- Print all Touareg rows with specs and prices
- Check if years/prices are plausible (should be 2002+, price > 600k EGP)
- If entries are clearly wrong (e.g., 1990 Touareg), add year rule

**VW Beetle (MAPE=173%, n=8):**
- The old "VW Bug" (1938-2003) and new Beetle (1997-2019) share the name
- Print all rows: old Bug (engine_cc=1100-1600, RWD, price<200k) mixed with new Beetle
- If mixed: add transmission+fuel+body_type based split or use year>1997 for new Beetle

**GAC Empow (MAPE=166%, n=7, mean=2.87M, MAE=3.58M):**
- MAE > mean_price means model predictions are completely wrong
- Print all rows with actual prices — if some are clearly outliers (50k EGP or 15M EGP), remove

**DFSK Glory (MAPE=146%, n=6):**
- DFSK Glory 580, Glory 500, Glory Pro are very different cars with same "Glory" label
- Print all rows — check if year/spec diversity is the cause

**Cupra Leon (MAPE=77%, n=32, mean=2.22M):**
- Old "Seat Leon Cupra" (pre-brand-split, 2010-2020): price 300-600k EGP
- New "Cupra Leon" (post-2020): price 1.5-3M EGP
- Check: `df[(df['make']=='Cupra') & (df['model']=='Leon') & (df['price_egp'] < 700000)]`
- If low-price entries exist, they are mislabeled Seat Leon Cupras

**Daihatsu Terios (MAPE=50%, n=34, mean=560k EGP):**
- Terios stopped production in 2006 generation in most markets
- 560k mean is suspicious (should be 100-250k for 2000-2006 era car)
- Print all rows: check if years are correct and prices are plausible

**BMW OTHER_BMW (MAPE=262%, R²=-276, n=4):**
- The OTHER_ grouping is catastrophic — 4 cars with wildly different specs/prices
- Print what models got grouped as OTHER_BMW: they are not comparable cars
- Fix: raise MIN_ROWS_PER_MODEL to 10-12 to reduce OTHER groupings

**Chevrolet Lanos (MAPE=17.8%, R²=-2.52, n=289):**
- R²=-2.52 means model is 3.52× WORSE than a simple mean for this car
- Despite acceptable MAPE, the model cannot explain Lanos price variance AT ALL
- Root cause: massive condition variance in old high-volume economy car
- For V2: this validates the separate economy model approach

**Hyundai Verna (MAPE=34.6%, n=245) + Hyundai Tucson (MAPE=34.7%, n=396):**
- Combined 641 rows (~3.2% of dataset) with terrible MAPE
- Multi-generation crisis: Verna spans 2005 (~150k EGP) to 2023 (~600k EGP)
- Tucson spans 2007 (~250k EGP) to 2023 hybrid (~1.5M EGP)
- PRIMARY target for mm_price_tier + year_bucket feature improvement

### 3.3 Data Patterns to Check Across All Models

Run this cell to find all potential multi-generation problems:
```python
import pandas as pd
import numpy as np

df = pd.read_csv('data/processed/processed_data.csv')
mape_df = pd.read_csv('models/metadata/make_model_mape_cv.csv')

# Find high-sample, high-MAPE models (the fixable ones)
fixable = mape_df[(mape_df['n'] >= 50) & (mape_df['MAPE_pct'] > 20)].copy()

for _, row in fixable.iterrows():
    make, model = row['make'], row['model']
    subset = df[(df['make']==make) & (df['model']==model)]
    price_cv = subset['price_egp'].std() / subset['price_egp'].mean()
    year_range = subset['year'].max() - subset['year'].min()
    print(f"{make} {model}: MAPE={row['MAPE_pct']:.1f}%, n={int(row['n'])}, "
          f"price_CV={price_cv:.2f}, year_range={year_range}yrs, "
          f"price_range={subset['price_egp'].min()/1000:.0f}k-{subset['price_egp'].max()/1000:.0f}k EGP")
```
Models with high `price_CV` (coefficient of variation) and wide `year_range` are
multi-generation problems. These are the primary targets for `year_bucket` + `mm_price_tier`.

---

## Part 4 — Model Performance Findings

### 4.1 Per-Tier Summary (V1 Ensemble, Filtered)

| Tier | MAPE | MAE | R² | Coverage | n | Status |
|---|---|---|---|---|---|---|
| Budget (<300K) | 20.2% | 32,124 EGP | 0.13 | 81.1% | 847 | Fundamental limitation |
| Mid-Range (300K-700K) | 10.1% | 48,147 EGP | 0.52 | 85.2% | 1,362 | Good |
| Premium (700K-1.5M) | 10.2% | 101,233 EGP | 0.30 | 90.0% | 1,029 | R² low, investigate |
| Luxury (1.5M+) | 11.7% | 424,024 EGP | 0.76 | 85.8% | 782 | Good, improve with more data |

**Budget R²=0.13 (near zero):** The model barely beats a simple mean for budget cars.
Without condition data, this cannot be improved dramatically. The separate economy
model approach + sample weighting will help but will not solve it completely.

**Premium R²=0.30:** Surprisingly low for 700k-1.5M tier. This tier includes
heterogeneous cars: old Toyota Fortuner (~700k), new Kia Sportage (~900k), new
Hyundai Tucson 2022 (~1.2M). These are very different cars in the same bin.
Investigation: check if Tucson and Verna are driving this down. If so, mm_price_tier
will help by distinguishing generations within the 700k-1.5M range.

### 4.2 SHAP Feature Importance (V1 LightGBM, after car_age drop)

Rank by mean |SHAP|:
1. year (largest by far, ~300k EGP mean impact)
2. make (~170k EGP)
3. mileage_km (~165k EGP)
4. horsepower (~140k EGP)
5. model (~125k EGP)
6. car_segment (~100k EGP)
7. drivetrain (~70k EGP)
8. engine_cc (~65k EGP)
9. transmission (~60k EGP)
10. mileage_per_year (~22k EGP)
11. brand_origin (~23k EGP)
12. body_type (~7k EGP)
13. location (~6k EGP)
14. seating_capacity (~6k EGP)
15. fuel (~2k EGP, lowest)

**Key observations:**
- model dropped from rank 2 to rank 5 after dropping car_age (expected — model leans more on year+mileage now)
- location at rank 13 is low but real signal — confirmed location has directional effect in beeswarm
- fuel at rank 15 (nearly zero) is concerning — might indicate EV/hybrid labeling inconsistency

### 4.3 Optuna Convergence

- Both models converged. LightGBM converged ~trial 40. XGBoost ~trial 20.
- LightGBM most important param: learning_rate (0.6) — changed from prev run where min_split_gain dominated
- XGBoost most important param: gamma (0.85) — same as before
- Both models have room for improvement with 150 trials

### 4.4 Residual Analysis

- Both models show heteroscedasticity (variance increases with price) — expected
- Error distribution: slight positive skew — model underestimates luxury more than overestimates
- Within ±10%: 59.3% (LightGBM), 59.7% (XGBoost)
- Within ±15%: 74.2% (LightGBM), 74.5% (XGBoost)

---

## Part 5 — How to Identify If the Model Learned the Right Pattern

### 5.1 General Diagnostic Approach

"The model learned the right pattern" means:
1. SHAP directions match domain knowledge
2. Partial dependence plots show expected curves
3. Error is random (not systematic for specific subgroups)
4. Per-subgroup MAPE is consistent with known uncertainty

### 5.2 SHAP Direction Validation Tests

```python
import shap
import pandas as pd
import numpy as np

# After loading model and building test features X_test:

# TEST 1: Year should positively affect price
# Sample cars with same make/model but different years
year_test = X_test[X_test['make_encoded'] == make_encoder['Toyota']].copy()
shap_year = explainer.shap_values(year_test)[year_col_idx]
corr = np.corrcoef(year_test['year'], shap_year)[0,1]
assert corr > 0.5, f"FAIL: Year-SHAP correlation {corr:.2f} should be strongly positive"
print(f"PASS: Year-SHAP correlation = {corr:.2f} (expected: strongly positive)")

# TEST 2: Mileage should negatively affect price
mileage_shap = explainer.shap_values(year_test)[mileage_col_idx]
corr = np.corrcoef(year_test['mileage_km'], mileage_shap)[0,1]
assert corr < -0.3, f"FAIL: Mileage-SHAP correlation {corr:.2f} should be negative"
print(f"PASS: Mileage-SHAP correlation = {corr:.2f} (expected: negative)")

# TEST 3: Horsepower should positively affect price
hp_shap = explainer.shap_values(year_test)[hp_col_idx]
corr = np.corrcoef(year_test['horsepower'], hp_shap)[0,1]
assert corr > 0.3, f"FAIL: Horsepower-SHAP correlation {corr:.2f} should be positive"
print(f"PASS: Horsepower-SHAP correlation = {corr:.2f} (expected: positive)")
```

### 5.3 Residual Bias Tests (Systematic Error Detection)

```python
import pandas as pd
import numpy as np

# After generating test predictions:
df_test['residual_pct'] = (df_test['pred_price'] - df_test['price_egp']) / df_test['price_egp']

# TEST: Model should not systematically over/under-predict for any subgroup

# By make: check if any make has mean residual > ±15%
by_make = df_test.groupby('make')['residual_pct'].agg(['mean','std','count'])
systematic_make_bias = by_make[abs(by_make['mean']) > 0.15]
if len(systematic_make_bias) > 0:
    print(f"WARNING: Systematic bias detected for these makes:")
    print(systematic_make_bias)
else:
    print("PASS: No systematic make-level bias > 15%")

# By price tier: check if model over/under-predicts for specific tiers
bins = [0, 300_000, 700_000, 1_500_000, float('inf')]
labels = ['budget', 'mid', 'premium', 'luxury']
df_test['tier'] = pd.cut(df_test['price_egp'], bins=bins, labels=labels)
by_tier = df_test.groupby('tier')['residual_pct'].agg(['mean','std','count'])
print("\nMean residual by tier (should be near 0 for each):")
print(by_tier)

# By year bucket: check if old cars are systematically biased
df_test['year_bucket'] = pd.cut(df_test['year'],
    bins=[1970, 2000, 2010, 2016, 2020, 2023, 2030],
    labels=['pre_2000','y2000s','y2010s_early','y2010s_late','y2020_2022','y2023_plus'])
by_year = df_test.groupby('year_bucket')['residual_pct'].agg(['mean','count'])
print("\nMean residual by year bucket:")
print(by_year)
```

### 5.4 Counterfactual Checks (Business Logic Validation)

These test that the model responds correctly to feature changes:

```python
from app.services.predictor import predict_price
from app.services.feature_builder import build_features

# COUNTERFACTUAL 1: Higher mileage should lower price
base = {'make': 'Toyota', 'model': 'Corolla', 'year': 2018, 'mileage_km': 50000,
        'transmission': 'Automatic', 'fuel': 'petrol', 'location': 'Cairo'}
high_mileage = dict(base); high_mileage['mileage_km'] = 200000

p_base = predict_price(**base)['fair_price']
p_high = predict_price(**high_mileage)['fair_price']
assert p_high < p_base, f"FAIL: High mileage ({p_high}) should be cheaper than low mileage ({p_base})"
pct_diff = (p_base - p_high) / p_base * 100
print(f"PASS: 200k vs 50k km: {pct_diff:.1f}% price difference (expected: 10-25%)")

# COUNTERFACTUAL 2: Newer year should increase price (same model)
car_2015 = {'make': 'Kia', 'model': 'Cerato', 'year': 2015, 'mileage_km': 80000}
car_2022 = dict(car_2015); car_2022['year'] = 2022; car_2022['mileage_km'] = 30000
p_old = predict_price(**car_2015)['fair_price']
p_new = predict_price(**car_2022)['fair_price']
assert p_new > p_old, f"FAIL: Newer car ({p_new}) should cost more than older ({p_old})"
print(f"PASS: 2022 vs 2015 Cerato: {(p_new/p_old):.1f}× price ratio (expected: 1.5-3×)")

# COUNTERFACTUAL 3: Automatic should be more expensive than Manual (same car)
manual = {'make': 'Renault', 'model': 'Logan', 'year': 2019, 'mileage_km': 60000,
          'transmission': 'Manual', 'fuel': 'petrol', 'location': 'Cairo'}
auto = dict(manual); auto['transmission'] = 'Automatic'
p_manual = predict_price(**manual)['fair_price']
p_auto = predict_price(**auto)['fair_price']
assert p_auto >= p_manual * 0.95, f"FAIL: Auto ({p_auto}) should be >= Manual ({p_manual})"
print(f"PASS: Automatic vs Manual: {(p_auto/p_manual):.2f}× ratio (expected: 1.05-1.20×)")

# COUNTERFACTUAL 4: Cairo should price higher than Upper Egypt (same car)
cairo = {'make': 'Hyundai', 'model': 'Elantra', 'year': 2020, 'mileage_km': 50000,
         'location': 'Cairo'}
upper = dict(cairo); upper['location'] = 'Upper Egypt'
p_cairo = predict_price(**cairo)['fair_price']
p_upper = predict_price(**upper)['fair_price']
# May not always hold but should at least not be dramatically reversed
print(f"INFO: Cairo={p_cairo:,.0f} vs Upper Egypt={p_upper:,.0f} (Cairo usually higher)")
```

### 5.5 The Chevrolet Avalanche Diagnostic Cell Template

Use this template for any suspected dirty data model:

```python
def diagnose_model_quality(make: str, model: str, df: pd.DataFrame,
                            mape_df: pd.DataFrame, real_specs: dict = None):
    """
    Print everything about a specific make+model to identify data quality issues.

    real_specs example: {'min_year': 2002, 'max_year': 2013,
                          'correct_fuel': 'petrol', 'correct_trans': 'Automatic',
                          'expected_price_range': (300_000, 2_000_000)}
    """
    subset = df[(df['make'] == make) & (df['model'] == model)].copy()
    mape_row = mape_df[(mape_df['make'] == make) & (mape_df['model'] == model)]

    print(f"\n{'='*60}")
    print(f"DIAGNOSIS: {make} {model}")
    print(f"{'='*60}")
    print(f"Total rows in processed data: {len(subset)}")

    if len(mape_row) > 0:
        r = mape_row.iloc[0]
        print(f"MAPE: {r.get('MAPE_pct', 'N/A'):.1f}%")
        print(f"R²: {r.get('R2', 'N/A'):.3f}")
        print(f"n_test: {r.get('n_test', r.get('n', 'N/A'))}")
        print(f"Mean price: {r.get('mean_price', 'N/A'):,.0f} EGP")

    print(f"\n--- Price Distribution ---")
    print(subset['price_egp'].describe().apply(lambda x: f"{x:,.0f}"))

    print(f"\n--- Year Distribution ---")
    print(subset['year'].value_counts().sort_index().to_string())

    print(f"\n--- Transmission Values ---")
    print(subset['transmission'].value_counts().to_string())

    print(f"\n--- Fuel Values ---")
    print(subset['fuel'].value_counts().to_string())

    print(f"\n--- Engine CC ---")
    print(subset['engine_cc'].value_counts().to_string())

    print(f"\n--- Horsepower ---")
    print(subset['horsepower'].value_counts().to_string())

    print(f"\n--- All Rows ---")
    print(subset[['year', 'transmission', 'fuel', 'engine_cc', 'horsepower',
                   'mileage_km', 'price_egp', 'location']].sort_values('year').to_string())

    if real_specs:
        print(f"\n--- Real World Specs Check ---")
        violations = []
        if 'min_year' in real_specs:
            bad = subset[subset['year'] < real_specs['min_year']]
            if len(bad) > 0:
                violations.append(f"YEAR: {len(bad)} rows before {real_specs['min_year']}")
        if 'max_year' in real_specs:
            bad = subset[subset['year'] > real_specs['max_year']]
            if len(bad) > 0:
                violations.append(f"YEAR: {len(bad)} rows after {real_specs['max_year']}")
        if 'correct_fuel' in real_specs:
            bad = subset[subset['fuel'] != real_specs['correct_fuel']]
            if len(bad) > 0:
                violations.append(f"FUEL: {len(bad)} rows with wrong fuel "
                                   f"(found: {subset['fuel'].value_counts().to_dict()})")
        if 'correct_trans' in real_specs:
            bad = subset[subset['transmission'] != real_specs['correct_trans']]
            if len(bad) > 0:
                violations.append(f"TRANSMISSION: {len(bad)} rows with wrong transmission")
        if 'expected_price_range' in real_specs:
            lo, hi = real_specs['expected_price_range']
            bad = subset[(subset['price_egp'] < lo) | (subset['price_egp'] > hi)]
            if len(bad) > 0:
                violations.append(f"PRICE: {len(bad)} rows outside expected range "
                                   f"{lo/1000:.0f}k-{hi/1000:.0f}k EGP")

        if violations:
            for v in violations:
                print(f"  VIOLATION: {v}")
        else:
            print("  All checks passed")


# Usage examples:
df = pd.read_csv('data/processed/processed_data.csv')
mape_df = pd.read_csv('models/metadata/make_model_mape_cv.csv')

# Chevrolet Avalanche
diagnose_model_quality('Chevrolet', 'Avalanche', df, mape_df, {
    'min_year': 2002, 'max_year': 2013,
    'correct_fuel': 'petrol', 'correct_trans': 'Automatic',
    'expected_price_range': (300_000, 3_000_000)
})

# Ford Bronco Raptor
diagnose_model_quality('Ford', 'Bronco Raptor', df, mape_df, {
    'min_year': 2021,
    'correct_fuel': 'petrol', 'correct_trans': 'Automatic',
    'expected_price_range': (2_500_000, 8_000_000)
})

# Cupra Leon
diagnose_model_quality('Cupra', 'Leon', df, mape_df, {
    'expected_price_range': (800_000, 4_000_000)
})

# VW Beetle
diagnose_model_quality('Volkswagen', 'Beetle', df, mape_df, {
    'expected_price_range': (50_000, 1_000_000)
})
```

---

## Part 6 — V2 Feature Plan (Complete)

### 6.1 Features to Add (in priority order)

**Priority 1 — High Impact (implement before retraining):**

```python
# In 02_data_cleaning.ipynb or at start of 05 training notebook,
# AFTER train/test split, BEFORE feature matrix construction:

# 1. mm_price_tier — make+model price tier based on TRAINING median
def compute_mm_price_tier(df_train, df_full):
    TIER_BINS   = [0, 300_000, 700_000, 1_500_000, 3_000_000, 7_000_000, float('inf')]
    TIER_LABELS = ['economy','mid_range','upper_mid','premium','luxury','ultra_luxury']

    mm_median = df_train.groupby(['make','model'])['price_egp'].median()
    mm_tier   = pd.cut(mm_median, bins=TIER_BINS, labels=TIER_LABELS).to_dict()

    # Save as artifact
    import json
    with open('models/metadata/mm_price_tier_lookup.json', 'w') as f:
        json.dump({f"{k[0]}|{k[1]}": v for k,v in mm_tier.items()}, f)

    return df_full.apply(
        lambda r: mm_tier.get((r['make'], r['model']), 'mid_range'), axis=1
    )

df['mm_price_tier'] = compute_mm_price_tier(df_train, df)
CAT_COLS.append('mm_price_tier')

# 2. log_mileage_km
df['log_mileage_km'] = np.log1p(df['mileage_km'])
NUM_COLS.append('log_mileage_km')

# 3. mileage_ratio
df['mileage_ratio'] = (df['mileage_km'] / (df['car_age'].clip(1) * 15000)).clip(0, 5)
NUM_COLS.append('mileage_ratio')

# 4. is_vintage
df['is_vintage'] = (df['car_age'] >= 18).astype(int)
NUM_COLS.append('is_vintage')

# 5. year_bucket
def year_to_bucket(y):
    if y < 2000: return 'pre_2000'
    if y < 2010: return 'y2000s'
    if y < 2016: return 'y2010s_early'
    if y < 2020: return 'y2010s_late'
    if y < 2023: return 'y2020_2022'
    return 'y2023_plus'

df['year_bucket'] = df['year'].apply(year_to_bucket)
CAT_COLS.append('year_bucket')
```

**Priority 2 — Medium Impact:**

```python
# 6. brand_tier
BRAND_TIERS = {
    'budget':    ['Daewoo','Chana','Speranza','DFSK','JAC','Lada','Rox','Fiat','Chery'],
    'premium':   ['BMW','Mercedes','Audi','Volvo','Subaru','Cupra','Mini','DS','Zeekr','Avatr'],
    'luxury':    ['Land Rover','Porsche','Lexus','Jaguar','Maserati','Lotus','Ferrari'],
}
def get_brand_tier(make):
    for tier, makes in BRAND_TIERS.items():
        if make in makes: return tier
    return 'mainstream'

df['brand_tier'] = df['make'].apply(get_brand_tier)
CAT_COLS.append('brand_tier')

# 7. iso_anomaly_score
from sklearn.ensemble import IsolationForest
import joblib

ISO_FEATURES = ['year','mileage_km','mileage_per_year','engine_cc','horsepower','seating_capacity']
iso = IsolationForest(n_estimators=200, contamination=0.05, random_state=42, n_jobs=-1)
iso.fit(df_train[ISO_FEATURES])
joblib.dump(iso, 'models/preprocessors/isolation_forest.joblib')
df['iso_anomaly_score'] = iso.score_samples(df[ISO_FEATURES])
NUM_COLS.append('iso_anomaly_score')

# Also update confidence.py to use iso_anomaly_score at inference:
# Load iso model in model_state.py at startup
# Pass score to compute_confidence_label() as additional signal
```

### 6.2 Sample Weights for Economy Segment

```python
def compute_sample_weights(price_egp):
    weights = np.ones(len(price_egp))
    economy_mask = price_egp < 300_000
    weights[economy_mask] = 2.5
    return weights

# In lgbm training:
lgbm_model.fit(X_train, y_train,
    sample_weight=compute_sample_weights(df_train['price_egp'].values))
```

### 6.3 Three-Model Architecture

```python
# Split by mm_price_tier
economy_mask  = df['mm_price_tier'] == 'economy'
standard_mask = df['mm_price_tier'].isin(['mid_range', 'upper_mid'])
luxury_mask   = df['mm_price_tier'].isin(['premium', 'luxury', 'ultra_luxury'])

# Train each model separately with segment-specific Optuna study
# Economy: more regularization (noisy data)
ECONOMY_EXTRA_PARAMS  = {'min_child_samples': 30, 'reg_lambda': 3.0}
# Standard: use Optuna defaults
STANDARD_EXTRA_PARAMS = {}
# Luxury: less regularization (few samples, don't overfit)
LUXURY_EXTRA_PARAMS   = {'min_child_samples': 5, 'reg_lambda': 0.5, 'n_estimators': 2000}

# Routing at inference (in predictor.py):
MM_TIER_LOOKUP = json.load(open('models/metadata/mm_price_tier_lookup.json'))
def get_model_for_car(make, model):
    tier = MM_TIER_LOOKUP.get(f"{make}|{model}", 'mid_range')
    if tier == 'economy':        return economy_model
    if tier in ['premium','luxury','ultra_luxury']: return luxury_model
    return standard_model
```

### 6.4 MIN_ROWS_PER_MODEL Recommendation

Increase from current value (5 or 8) to 12-15 to reduce OTHER_ groupings.
Current OTHER_BMW (R²=-276) shows that 4 cars with incompatible pricing
should not be grouped together.

```python
MIN_ROWS_PER_MODEL = 12  # was probably 5 or 8
```

---

## Part 7 — Required Tests and Validations

### 7.1 Data Pipeline Tests

```python
# Run after fix_lookups_make_model.py --apply:

def test_data_pipeline_output():
    import pandas as pd
    specs = pd.read_csv('data/lookups/car_specs_lookup_full_cleaned.fixed.csv')
    ai    = pd.read_csv('data/lookups/AI_lookup.fixed.csv')
    quar  = pd.read_csv('data/lookups/quarantine.csv')

    # No wrong pairs
    wrong = [('Toyota','Cruze'),('Volkswagen','Tiggo'),('Fiat','Jetta'),
             ('Fiat','Polo'),('Ford','Echo'),('Suzuki','Fit')]
    for make, model in wrong:
        n = len(specs[(specs.make==make) & (specs.model==model)])
        assert n == 0, f"FAIL: {make}/{model} still in specs ({n} rows)"
    print("PASS: No wrong pairs in specs")

    # No alias makes
    for alias in ['Chana','KGM','Bmw','bmw']:
        n = len(specs[specs.make==alias])
        assert n == 0, f"FAIL: Alias make '{alias}' still present ({n} rows)"
    print("PASS: No alias makes")

    # No nulls in critical columns
    for col in ['make','model','year','engine_cc','horsepower']:
        assert specs[col].isnull().sum() == 0, f"FAIL: Nulls in {col}"
    print("PASS: No nulls in specs critical columns")

    # Quarantine has the right entries
    quarantined_pairs = set(zip(quar['make'], quar['model']))
    expected_quarantined = {('Hyundai','X3'),('Mercedes','A1'),('Hyundai','A1'),
                            ('Kia','Saipa'),('Suzuki','Maruti'),('Renault','Rainbow'),
                            ('Skoda','Fantasia')}
    for pair in expected_quarantined:
        assert pair in quarantined_pairs, f"FAIL: {pair} not in quarantine"
    print(f"PASS: Quarantine has all expected entries ({len(quar)} total)")

test_data_pipeline_output()
```

### 7.2 Processed Data Validation

```python
def validate_processed_data(path='data/processed/processed_data.csv'):
    df = pd.read_csv(path)
    errors = []

    # No nulls
    null_cols = df.isnull().sum()
    null_cols = null_cols[null_cols > 0]
    if len(null_cols) > 0:
        errors.append(f"Nulls found: {null_cols.to_dict()}")

    # Year range
    bad_year = df[(df['year'] < 1975) | (df['year'] > 2027)]
    if len(bad_year) > 0:
        errors.append(f"{len(bad_year)} rows with year outside 1975-2027")

    # Price range
    bad_price = df[(df['price_egp'] < 20000) | (df['price_egp'] > 20_000_000)]
    if len(bad_price) > 0:
        errors.append(f"{len(bad_price)} rows with price outside 20k-20M EGP")

    # Mileage range
    bad_mileage = df[(df['mileage_km'] < 0) | (df['mileage_km'] > 500_000)]
    if len(bad_mileage) > 0:
        errors.append(f"{len(bad_mileage)} rows with mileage outside 0-500k")

    # No wrong pairs
    for make, model in [('Toyota','Cruze'),('Volkswagen','Tiggo'),('Fiat','Jetta')]:
        n = len(df[(df['make']==make) & (df['model']==model)])
        if n > 0:
            errors.append(f"{make}/{model} still in processed data ({n} rows)")

    # No alias makes
    for alias in ['Chana','KGM']:
        n = len(df[df['make']==alias])
        if n > 0:
            errors.append(f"Alias make '{alias}' in processed data ({n} rows)")

    # EV consistency
    ev = df[df['fuel']=='electric']
    ev_bad = ev[ev['transmission'] != 'Automatic']
    if len(ev_bad) > 0:
        errors.append(f"{len(ev_bad)} EVs with non-Automatic transmission")

    # Rare filter applied
    mm_counts = df.groupby(['make','model']).size()
    below_threshold = mm_counts[mm_counts < 4]
    if len(below_threshold) > 0:
        errors.append(f"{len(below_threshold)} make+model combos below threshold of 4")

    if errors:
        for e in errors:
            print(f"ERROR: {e}")
    else:
        print(f"PASS: All {len(df)} rows in processed data are valid")
        print(f"  Rows: {len(df)}, Cols: {len(df.columns)}")
        print(f"  Makes: {df['make'].nunique()}, Models: {df['model'].nunique()}")

validate_processed_data()
```

### 7.3 API Endpoint Tests

```python
import requests

BASE_URL = 'http://localhost:8000'

def test_single_prediction():
    r = requests.post(f'{BASE_URL}/api/v1/predict', json={
        "brand": "Toyota", "model": "Corolla", "year": 2019,
        "mileage_km": 85000, "transmission": "Automatic",
        "fuel": "petrol", "location": "Cairo", "include_factors": True
    })
    assert r.status_code == 200, f"Status {r.status_code}: {r.text}"
    data = r.json()

    # Required fields
    for field in ['fair_price','negotiation_range','confidence','model_version','predicted_at']:
        assert field in data, f"Missing field: {field}"

    # Price sanity (Toyota Corolla 2019 should be 800k-1.4M EGP)
    assert 500_000 < data['fair_price'] < 2_000_000, f"Price out of range: {data['fair_price']}"

    # Negotiation range sanity
    fair = data['fair_price']
    mn = data['negotiation_range']['min_price']
    mx = data['negotiation_range']['max_price']
    assert mn < fair < mx, f"Range violated: {mn} < {fair} < {mx}"

    # Confidence should be high (Corolla is well-represented)
    assert data['confidence'] == 'high', f"Expected high confidence, got {data['confidence']}"

    # Factors present when requested
    assert data['price_factors'] is not None
    assert len(data['price_factors']) > 0

    print(f"PASS: Single prediction OK — fair_price={fair:,.0f}, confidence={data['confidence']}")

def test_negotiation_range_width():
    """Test that negotiation range is MAPE-based, not raw quantiles."""
    r = requests.post(f'{BASE_URL}/api/v1/predict', json={
        "brand": "Land Rover", "model": "Range Rover", "year": 2022,
        "mileage_km": 20000
    })
    data = r.json()
    fair = data['fair_price']
    mn   = data['negotiation_range']['min_price']
    mx   = data['negotiation_range']['max_price']
    conf = data['confidence']

    max_alpha = {'high': 0.16, 'medium': 0.18, 'low': 0.22}[conf]
    width_pct = (mx - mn) / fair

    assert width_pct < max_alpha * 2 * 1.1, (
        f"FAIL: Width {width_pct:.1%} too wide for {conf} confidence. "
        f"Max expected: {max_alpha*2:.1%}. Raw quantiles are leaking through."
    )
    print(f"PASS: Negotiation range width {width_pct:.1%} for {conf} confidence")

def test_batch_prediction():
    r = requests.post(f'{BASE_URL}/api/v1/predict/batch', json={"items": [
        {"brand": "Toyota", "model": "Corolla", "year": 2019},
        {"brand": "Invalid Make XYZ", "model": "Fake Model", "year": 2020},
        {"brand": "BMW", "model": "320i", "year": 2018, "mileage_km": 90000},
    ]})
    assert r.status_code == 200
    data = r.json()
    assert data['total'] == 3
    assert data['successful'] == 2  # second item should fail
    assert data['failed'] == 1
    assert data['results'][1]['success'] == False
    print(f"PASS: Batch prediction — {data['successful']}/{data['total']} succeeded")

def test_invalid_car():
    r = requests.post(f'{BASE_URL}/api/v1/predict', json={
        "brand": "NotAMake", "model": "NotAModel", "year": 2020
    })
    assert r.status_code == 400
    print("PASS: Invalid car correctly rejected with 400")

# Run all tests
test_single_prediction()
test_negotiation_range_width()
test_batch_prediction()
test_invalid_car()
print("\nAll API tests passed.")
```

### 7.4 Counterfactual Tests (run in notebook, not API)

See Section 5.4 above. Run after every retraining to verify the model learned
correct economic relationships.

### 7.5 Coverage Validation Test

```python
def test_coverage(y_true, y_lower, y_upper, target=0.80, tolerance=0.05):
    """Coverage should be within tolerance of target."""
    coverage = np.mean((y_true >= y_lower) & (y_true <= y_upper))
    assert abs(coverage - target) <= tolerance, (
        f"FAIL: Coverage {coverage:.1%} is more than {tolerance:.0%} away "
        f"from target {target:.0%}. Adjust quantiles."
    )
    print(f"PASS: Coverage {coverage:.1%} (target {target:.0%} ± {tolerance:.0%})")
    return coverage
```

---

## Part 8 — Good Things That Need Enhancement (Not Broken, Just Improvable)

### 8.1 Confidence Scoring Enhancements

**Current:** Uses global MAPE for all cars.
**Better:** Use tier-specific MAPE. A Premium-tier car with 10.2% tier MAPE should
get a higher base confidence than using the global 12.9%. Load tier-specific MAPEs
from `models/metadata/per_tier_metrics.csv` and select by predicted price tier.

```python
TIER_MAPES = {
    'budget':   22.0,
    'mid':      10.1,
    'premium':  10.2,
    'luxury':   11.7,
}
def get_tier_mape(fair_price):
    if fair_price < 300_000:  return TIER_MAPES['budget']
    if fair_price < 700_000:  return TIER_MAPES['mid']
    if fair_price < 1_500_000: return TIER_MAPES['premium']
    return TIER_MAPES['luxury']
```

### 8.2 Expert Explanation Improvements

**Add to each rule in factor_expert.py:**
- Never use positive adjectives (acceptable, fine, good) when direction=negative
- Remove closing meta-sentence from all templates
- Add Arabic translations for key phrases (prepare for bilingual mode)
- Add a `category` field: one of [performance, condition, brand_value, market_demand, cost_ownership]

### 8.3 Feature Builder Improvements

**Add year/mileage sanity checks:**
```python
current_year = pd.Timestamp.now().year
if year < 1950 or year > current_year + 1:
    raise ValueError(f"year {year} outside plausible range")
if mileage_km is not None and mileage_km < 0:
    raise ValueError(f"mileage_km must be non-negative")
```

**Add mm_price_tier lookup at inference (V2):**
```python
MM_TIER_LOOKUP = json.load(open(settings.model_metadata_dir / 'mm_price_tier_lookup.json'))
row['mm_price_tier'] = MM_TIER_LOOKUP.get(f"{make}|{model}", 'mid_range')
```

---

## Part 9 — Things That Are Limitations, Not Bugs (Do Not Try to Fix)

1. **Budget tier R²=0.13:** Without condition data, this is the correct behavior.
   The model is barely better than a mean predictor for old economy cars.
   Acceptable for V1. The economy-specific model in V2 will help but not solve it.

2. **Mercedes old models (172% MAPE in economy tier):** 1975-1995 Mercedes pricing
   is entirely condition-driven. No feature set without condition data will fix this.
   Report as "excluded from per-brand evaluation (vintage, condition-dependent pricing)."

3. **Coverage slightly above 80% (87.7% for XGBoost):** With Q5/Q95, the model
   over-covers. This is safer than under-covering for a negotiation tool. Do not
   tighten quantiles. If conformal prediction is implemented in V2, this will
   self-calibrate to exactly 80%.

4. **Location at rank 13 in SHAP:** Low signal but real. Egypt has 27 governorates
   mapped to 17 location categories. The signal is real but location explains a small
   fraction of price variance (most variance is make/model/year/mileage). Keep in features.

5. **Fuel at rank 15 (near zero SHAP):** In the Egyptian market, petrol is dominant.
   Diesel and electric cars are well-identified by other features (engine_cc=0 for EVs,
   body_type for diesel trucks). Fuel adds marginal information. Keep it for completeness.

---

*Document generated: May 2026*
*Covers: Full review session of Egyptian Used Car Pricing Engine*
*Version covered: V1.0 (current), V2.0 (planned)*
