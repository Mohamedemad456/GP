# Plan 2: Feature Engineering V2

> **Recommended Model**: **Opus 4.6** (critical — wrong features damage the model permanently)  
> **Dependencies**: Plan 1 (Data Cleaning) must be complete  
> **Blocks**: Plan 04 (Model V2 Training), Plan 07 (API Updates)

---

## Current State & Problems

### Current Feature Set (V1)
**Numeric (6)**: `year, mileage_km, mileage_per_year, engine_cc, horsepower, seating_capacity`  
**Categorical (9)**: `make, model, transmission, fuel, location, body_type, drivetrain, brand_origin, car_segment`  
**Total**: 15 features

### Problem 1: Mileage Distribution is Heavily Right-Skewed
- `mileage_km` ranges from 0 to 500,000+ with most values between 10K-100K
- Tree models split on absolute thresholds — the few extreme values get disproportionate splits
- A car with 300K km vs 400K km has negligible price difference, but model wastes splits there
- **Impact**: Suboptimal tree structure, especially in economy segment where mileage matters most

### Problem 2: No "Usage Intensity" Signal
- Two cars with same mileage but different ages have very different conditions:
  - 2024 car with 50K km = heavily used (50K/year)
  - 2015 car with 50K km = lightly used (5K/year)
- `mileage_per_year` partially captures this but isn't normalized to expected usage
- **Impact**: Model can't distinguish "high-mileage-for-age" from "normal-mileage-for-age"

### Problem 3: No Price Segment Signal
- Economy cars (< 500K EGP) and luxury cars (> 2M EGP) follow different pricing dynamics
- Economy: dominated by condition/mileage, high price variance
- Luxury: dominated by brand/year/features, lower relative variance
- Currently the model learns these implicitly from make/model — but a direct segment signal helps
- **Impact**: Economy segment MAPE is 18-25% vs luxury at 8-12%

### Problem 4: Year as Raw Integer is Suboptimal
- `year` ranges from ~1995 to 2026
- Price depreciation is non-linear: a 2024→2023 drop is different from 2010→2009
- Fine year granularity creates many sparse splits for old cars
- **Impact**: Model overfits to specific years for rare make/model/year combos

### Problem 5: No Rarity Signal
- Some make/model combos have 500+ training samples, others have 3-5
- The model treats all predictions with equal certainty regardless of data support
- A direct "how many training examples do we have for this car" feature helps the model self-calibrate
- **Impact**: Overconfident predictions for rare cars, underconfident for common ones

---

## New Features to Add

### Feature 2.1: `log_mileage_km`
**Formula**: `np.log1p(mileage_km)`  
**Type**: Numeric  
**Rationale**: Compresses the mileage distribution, makes tree splits more informative in the 0-100K range where most cars live  
**Expected Impact**: 0.5-1% MAPE reduction (better splits in economy segment)

### Feature 2.2: `mileage_ratio`
**Formula**: `mileage_km / (max(car_age, 1) * 15000)` clamped to [0, 5]  
**Type**: Numeric  
**Rationale**: 15,000 km/year is the Egyptian market average. Ratio > 1 = heavier-than-average use, ratio < 1 = lighter use. Captures "condition proxy" without condition data.  
**Clamp reason**: Values > 5 are data errors or taxis — capping prevents extreme splits.  
**Expected Impact**: 0.5-1% MAPE reduction (especially in economy segment)

### Feature 2.3: `mm_price_tier`
**Formula**: Compute median price per (make, model) from training data → bucket into tiers  
**Tiers**:
- `economy`: median price < 500,000 EGP
- `standard`: 500,000 ≤ median price < 1,500,000 EGP
- `luxury`: 1,500,000 ≤ median price < 4,000,000 EGP
- `ultra_luxury`: median price ≥ 4,000,000 EGP

**Type**: Categorical  
**Critical**: Must be computed from TRAINING DATA ONLY (not test/calibration) to avoid leakage  
**Storage**: Export as `models/metadata/mm_price_tier_lookup.csv` for inference-time use  
**Expected Impact**: 1-2% MAPE reduction (enables segment-aware decisions within single model)

### Feature 2.4: `year_bucket`
**Formula**: `(year - 2000) // 5`  
**Type**: Numeric (ordinal)  
**Rationale**: Groups years into 5-year buckets (2000-2004, 2005-2009, ..., 2020-2024, 2025+). Reduces sparsity for old cars while preserving recent-year granularity through the raw `year` feature.  
**Expected Impact**: 0.3-0.5% MAPE reduction (better handling of older cars)

### Feature 2.5: `make_model_count`
**Formula**: Count of rows in training data for each (make, model) pair  
**Type**: Numeric  
**Critical**: Must be computed from TRAINING DATA ONLY  
**Storage**: Export as part of the `mm_price_tier_lookup.csv` or separate lookup  
**Rationale**: Gives the model a "confidence" signal — it can learn to be more conservative for rare cars  
**Expected Impact**: 0.3% MAPE reduction, but major improvement in per-brand fairness

### Feature 2.6: `days_since_baseline`
**Formula**: `(scraped_at - BASELINE_DATE).days` where `BASELINE_DATE = 2024-01-01`  
**Type**: Numeric  
**Source**: `scraped_at` column in raw data (date listing was pulled from the marketplace)  
**Rationale**: We pull from active listing sites, so each snapshot captures market conditions
at that point in time. This feature encodes:
- EGP inflation / devaluation trends (nominal prices drift upward over time)
- Seasonal demand patterns (Ramadan, summer, back-to-school buying cycles)
- Supply shocks (new model year arrivals, import quota changes)

**At inference time**: Pass today's date as `scraped_at` — the model predicts
"what would this car sell for under current market conditions?"

**Pipeline requirement**: `scraped_at` must be preserved through the cleaning pipeline
and included in `processed_data.csv`. It is NOT dropped by `generate_processed_data.py`.

**Expected Impact**: Likely 0.5-1.5% MAPE reduction, and more importantly captures EGP
devaluation trends that are invisible to a static model.  
**Data leakage risk**: None — `scraped_at` is when WE collected the data, not a price-derived field.

---

## What NOT to Add (and Why)

| Feature | Why Not |
|---------|---------|
| `iso_anomaly_score` | Requires Isolation Forest training, adds pipeline complexity, marginal gain |
| `is_vintage` | Too few cars (< 50) qualify, negligible statistical impact |
| `listing_age_days` | How long a listing has been active — requires re-identifying the same car across pulls, which we cannot do without a stable listing ID. Different from `scraped_at` (market date) |
| `price_reduced` | Same reason — no temporal tracking possible |
| `brand_tier` | Redundant with `mm_price_tier` which is more granular |
| `transmission_fuel_combo` | Already captured by interaction of both categorical features in tree models |
| `car_age` | Redundant with `year` — tree model computes the same splits. Confirmed by SHAP: `year` and `car_age` have near-identical importance |

---

## Implementation Steps

### Step 2.1 — Add Features to Processing Script
**Model**: Opus 4.6

Create/update the data processing logic to add the new features after the basic cleaning:

```python
import datetime as dt
BASELINE_DATE = dt.date(2024, 1, 1)

# After basic processing produces df with existing columns...

# Feature: log_mileage_km
df['log_mileage_km'] = np.log1p(df['mileage_km'].fillna(0))

# Feature: mileage_ratio
car_age = (current_year - df['year']).clip(lower=1)
df['mileage_ratio'] = (df['mileage_km'].fillna(0) / (car_age * 15000)).clip(0, 5)

# Feature: year_bucket
df['year_bucket'] = ((df['year'] - 2000) // 5).astype(int)

# Feature: days_since_baseline (from scraped_at column)
df['scraped_at'] = pd.to_datetime(df['scraped_at'], errors='coerce')
df['days_since_baseline'] = (df['scraped_at'].dt.date.apply(
    lambda d: (d - BASELINE_DATE).days if pd.notna(d) else 0
)).astype(int)

# Feature: mm_price_tier (from training data only - computed during training)
# Feature: make_model_count (from training data only - computed during training)
```

**Important**: `mm_price_tier` and `make_model_count` are computed DURING TRAINING from
the training split only. `days_since_baseline` IS included in `processed_data.csv`
(derived from `scraped_at`). At inference time, the API computes it from `datetime.date.today()`.

### Step 2.2 — Update Feature Column Lists

**Training notebook** (`NUM_COLS` and `CAT_COLS`):
```python
NUM_COLS = ['year', 'mileage_km', 'mileage_per_year', 'engine_cc',
            'horsepower', 'seating_capacity',
            'log_mileage_km', 'mileage_ratio', 'year_bucket',
            'make_model_count', 'days_since_baseline']
CAT_COLS = ['make', 'model', 'transmission', 'fuel', 'location',
            'body_type', 'drivetrain', 'brand_origin', 'car_segment', 'mm_price_tier']
FEATURE_COLS = NUM_COLS + CAT_COLS
```

**Inference feature builder** (`app/services/prediction/feature_builder.py`):
```python
# Same lists, with lookup-based computation for mm_price_tier and make_model_count
```

### Step 2.3 — Create Tier Lookup Export
During training, after train/test split:
```python
# Compute from training data only
tier_lookup = train_df.groupby(['make', 'model'])['price_egp'].median().reset_index()
tier_lookup['mm_price_tier'] = pd.cut(
    tier_lookup['price_egp'],
    bins=[0, 500_000, 1_500_000, 4_000_000, float('inf')],
    labels=['economy', 'standard', 'luxury', 'ultra_luxury']
)
count_lookup = train_df.groupby(['make', 'model']).size().reset_index(name='make_model_count')
tier_lookup = tier_lookup.merge(count_lookup, on=['make', 'model'])
tier_lookup.to_csv('models/metadata/mm_price_tier_lookup.csv', index=False)
```

### Step 2.4 — Update Inference Feature Builder
**Model**: Sonnet 4.6

Update `app/services/prediction/feature_builder.py`:
1. Load `mm_price_tier_lookup.csv` at startup (cached)
2. Add `log_mileage_km`, `mileage_ratio`, `year_bucket` computation
3. Look up `mm_price_tier` and `make_model_count` from the lookup
4. Add defaults for new features (e.g., `mm_price_tier='standard'`, `make_model_count=50`)
5. Update `CAT_COLS`, `NUM_COLS`, `FEATURE_COLS`

### Step 2.5 — Update Label Encoders
When training V2, the label encoders must include the new `mm_price_tier` category. The `prepare_for_xgboost` function must encode it alongside other categorical columns.

---

## Challenges & Risks

| Challenge | Risk | Mitigation |
|-----------|------|-----------|
| `mm_price_tier` leakage | Using test data prices to assign tiers | Strictly compute from train split only |
| New features increase dimensionality | Possible overfitting | Only 5 new features, all theoretically motivated |
| `mileage_ratio` undefined when `mileage_km` is NaN | NaN propagation | Fill with 1.0 (average usage) when mileage is unknown |
| `make_model_count` is 0 for unseen cars at inference | Division-by-zero or meaningless value | Default to 1 (minimum), which signals "rare" |
| Feature builder drift from training | Predictions are garbage | Single source of truth for feature column lists |
| `year_bucket` for future years (2027+) | Extrapolation | Clamp to max bucket seen in training |

---

## Feature Correlation Expectations

After adding features, expected correlations:
- `log_mileage_km` ↔ `mileage_km`: ~0.95 (monotonic transform, but different distribution)
- `mileage_ratio` ↔ `mileage_per_year`: ~0.7 (related but normalized differently)
- `year_bucket` ↔ `year`: ~0.99 (coarser version)
- `mm_price_tier` ↔ `price_egp`: moderate (it's a tier, not the price itself)
- `make_model_count` ↔ anything: low correlation (orthogonal information)

**This is acceptable** — tree models handle correlated features well. The new features provide different "split opportunities" at different granularities.

---

## Files Modified by This Plan

| File | Action |
|------|--------|
| `data/processed/processed_data.csv` | Add `log_mileage_km`, `mileage_ratio`, `year_bucket`, `days_since_baseline` columns |
| `app/services/prediction/feature_builder.py` | Add new feature computation + lookups |
| `models/metadata/mm_price_tier_lookup.csv` | NEW — created during training |
| Training notebook (07) | Compute `mm_price_tier`, `make_model_count` from train split |

---

## Success Criteria

- [ ] `processed_data.csv` has `log_mileage_km`, `mileage_ratio`, `year_bucket`, `days_since_baseline` columns
- [ ] No NaN in new numeric features
- [ ] `mm_price_tier_lookup.csv` exists with all make/model combos
- [ ] `feature_builder.py` produces correct output for test inputs
- [ ] `FEATURE_COLS` match between training and inference
- [ ] `pytest tests/test_feature_builder.py` passes with new features
