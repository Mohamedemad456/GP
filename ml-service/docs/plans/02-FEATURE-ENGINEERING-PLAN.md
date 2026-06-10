# Plan 2: Feature Engineering V2

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

### Feature 2.6: ~~`days_since_baseline`~~ — DEFERRED

**Status**: **Not implemented.** We train on single snapshots (one scraping round at a time),
not merged multi-round data, so temporal drift is not a concern for the current pipeline.

**Rationale for deferral**:
- With single-snapshot training, all rows share the same scraping date → no variance to learn from
- The inflation/seasonality signal only appears when combining multiple rounds
- Revisit if we switch to multi-round merged training in the future

**If revisited later**: Would require preserving `scraped_at` through the pipeline and
computing `(scraped_at - baseline).days` per row.

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

## Recommended Workflow

### Phase A — Notebook-First Validation
- Prototype all candidate features in the training notebook first
- Run ablations against the V1 baseline before touching the running inference module
- Keep the notebook as the experimentation surface only, not the long-term source of truth
- Promote only features that show consistent improvement on validation and segment-level slices

### Phase B — Promote Only Validated Features
- After validation, move the winning feature logic into reusable Python modules
- Update training and inference together in the same rollout to avoid drift
- Export any inference-time lookup artifacts from training as versioned metadata

### Promotion Gate
A feature should only move beyond notebook experimentation if it satisfies all of the following:
- Improves overall validation metrics or clearly improves an important business slice
- Does not introduce train/test leakage
- Can be reproduced deterministically in Python outside the notebook
- Has a safe fallback behavior for unseen or missing values at inference

### Source-of-Truth Rule
The notebook is for testing and comparison. The final feature definitions, feature column lists,
and lookup-loading behavior must live in reusable Python code so training and inference share one
authoritative definition.

---

## Implementation Steps

### Step 2.1 — Prototype Features in Notebook First

Before modifying the processing script or inference module:

1. Add the candidate features in the training notebook
2. Compare baseline vs per-feature and combined ablations
3. Review overall metrics plus economy/luxury and rare-make/model slices
4. Freeze the final winning feature set

Only after this notebook validation should the features be promoted into the reproducible Python pipeline.

### Step 2.2 — Add Validated Features to Processing Script

**Model**: Opus 4.6

Create/update the data processing logic to add only the validated features after the basic cleaning:

```python
# After basic processing produces df with existing columns...

# Feature: log_mileage_km
df['log_mileage_km'] = np.log1p(df['mileage_km'].fillna(0))

# Feature: mileage_ratio
car_age = (current_year - df['year']).clip(lower=1)
df['mileage_ratio'] = (df['mileage_km'] / (car_age * 15000)).clip(0, 5)
df['mileage_ratio'] = df['mileage_ratio'].fillna(1.0)

# Feature: year_bucket
df['year_bucket'] = ((df['year'] - 2000) // 5).astype(int)

# Feature: mm_price_tier (from training data only - computed during training)
# Feature: make_model_count (from training data only - computed during training)
```

**Important**: `mm_price_tier` and `make_model_count` are computed DURING TRAINING from
the training split only.

### Step 2.3 — Update Feature Column Lists

**Training notebook** (`NUM_COLS` and `CAT_COLS`):

```python
NUM_COLS = ['year', 'mileage_km', 'mileage_per_year', 'engine_cc',
            'horsepower', 'seating_capacity',
            'log_mileage_km', 'mileage_ratio', 'year_bucket',
            'make_model_count']
CAT_COLS = ['make', 'model', 'transmission', 'fuel', 'location',
            'body_type', 'drivetrain', 'brand_origin', 'car_segment', 'mm_price_tier']
FEATURE_COLS = NUM_COLS + CAT_COLS
```

**Inference feature builder** (`app/services/prediction/feature_builder.py`):
```python
# Same lists, with lookup-based computation for mm_price_tier and make_model_count
```

**Recommendation**: Replace duplicated hardcoded lists with a shared Python feature-spec module
before production rollout so training and inference cannot silently diverge.

### Step 2.4 — Create Tier Lookup Export
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

**Validation rule**: If using cross-validation, recompute this lookup inside each fold using only
that fold's training portion. Do not fit it once on the full dataset and then score on held-out rows.

### Step 2.5 — Promote Validated Features to Shared Python Modules

After notebook validation, move feature logic into reusable Python code and make it the single source
of truth for:

1. Derived feature formulas
2. `NUM_COLS`, `CAT_COLS`, `FEATURE_COLS`
3. Lookup artifact schema and load paths
4. Default/fallback behavior for inference

### Step 2.6 — Update Inference Feature Builder

**Model**: Sonnet 4.6

Update `app/services/prediction/feature_builder.py`:

1. Load `mm_price_tier_lookup.csv` at startup (cached)
2. Add `log_mileage_km`, `mileage_ratio`, `year_bucket` computation
3. Look up `mm_price_tier` and `make_model_count` from the lookup
4. Add defaults for new features (e.g., `mm_price_tier='standard'`, `make_model_count=1`)
5. Update `CAT_COLS`, `NUM_COLS`, `FEATURE_COLS`

### Step 2.7 — Update Label Encoders
When training V2, the label encoders must include the new `mm_price_tier` category. The `prepare_for_xgboost` function must encode it alongside other categorical columns.

---

## Challenges & Risks

| Challenge | Risk | Mitigation |
|-----------|------|-----------|
| `mm_price_tier` leakage | Using test data prices to assign tiers | Strictly compute from train split only |
| New features increase dimensionality | Possible overfitting | Only a small number of validated new features should be promoted |
| `mileage_ratio` undefined when `mileage_km` is NaN | NaN propagation or misleading "low usage" signal | Fill with 1.0 (average usage) when mileage is unknown |
| `make_model_count` is missing for unseen cars at inference | Model sees unsupported confidence signal | Default to 1 (minimum), which signals "rare" |
| Feature builder drift from training | Predictions are garbage | Single source of truth for feature column lists |
| `year_bucket` for future years (2027+) | Extrapolation | Clamp to max bucket seen in training |
| Candidate feature adds complexity but no real gain | Unnecessary production risk | Require notebook ablation evidence before promotion |

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
| Training notebook (07) | Prototype candidate features, run ablations, and compute train-only lookups |
| Reusable Python feature module | NEW — single source of truth for formulas and feature column lists after validation |
| `data/processed/processed_data.csv` | Add only the validated derived columns selected from notebook testing |
| `app/services/prediction/feature_builder.py` | Update only after validation to match the promoted Python feature logic |
| `models/metadata/mm_price_tier_lookup.csv` | NEW — created during training from training data only |

---

## Success Criteria

- [ ] Notebook ablation results identify the final winning feature set before production changes
- [ ] Any target-derived lookup (`mm_price_tier`, `make_model_count`) is fit on training data only
- [ ] `processed_data.csv` has only the validated derived columns selected for rollout
- [ ] No NaN in new numeric features
- [ ] `mm_price_tier_lookup.csv` exists with all make/model combos
- [ ] `feature_builder.py` produces correct output for test inputs
- [ ] `FEATURE_COLS` match between training and inference
- [ ] `pytest tests/test_feature_builder.py` passes with new features
