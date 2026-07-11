# Model V2 Complete Planning Document
## Egyptian Used Car Pricing Engine — V2 Roadmap

**Current state:** XGBoost quantile, MAPE ~12.9%, Coverage 87.7%
**V2 target:** MAPE < 11%, Economy MAPE < 17%, 3-model ensemble with routing

---

## Part 1 — Immediate Data Cleaning (Do Before V2 Training)

### 1.1 Add to `clean_impossible_model_years.py`

These are confirmed data errors that corrupt training:

```python
IMPOSSIBLE_MODEL_YEARS = [
    # Existing entries...

    # NEW — confirmed production year violations
    {"make": "Chevrolet", "model": "Avalanche",
     "min_year": 2002, "max_year": 2013,
     "note": "Avalanche Gen1: 2002-2006, Gen2: 2007-2013. Pre-2002 and post-2013 are mislabeled trucks."},

    {"make": "Ford", "model": "Bronco Raptor",
     "min_year": 2021,
     "note": "Raptor launched 2021. Earlier entries are mislabeled Rangers."},

    {"make": "Hyundai", "model": "Excel",
     "max_year": 1994,
     "note": "Excel discontinued globally 1994."},

    {"make": "Fiat", "model": "127",
     "max_year": 1983,
     "note": "Fiat 127 discontinued 1983."},

    {"make": "Fiat", "model": "128",
     "max_year": 1985,
     "note": "Fiat 128 discontinued 1985."},

    {"make": "Fiat", "model": "131",
     "max_year": 1984,
     "note": "Fiat 131 discontinued 1984."},

    {"make": "Fiat", "model": "132",
     "max_year": 1981,
     "note": "Fiat 132 discontinued 1981."},
]
```

### 1.2 Post-Year-Filter Fuel/Transmission Correction

After year filtering, the remaining Avalanche entries are still mostly diesel+manual
(mislabeled commercial trucks). Add an explicit rule in `fix_car_specs_lookup_full.py`:

```python
Rule(
    id="chevrolet_avalanche_fuel_transmission",
    make="Chevrolet",
    model="Avalanche",
    year_range=(2002, 2013),
    updates={"fuel": "petrol", "transmission": "Automatic",
             "engine_cc": 5300, "horsepower": 300},
    # Note: Gen1 (2002-2006) = ~285-295hp, Gen2 (2007-2013) = ~310-320hp.
    # Using 300 as a compromise since we cannot determine gen without year info.
),
```

### 1.3 Expected Impact After Data Cleaning

| Model | Current MAPE | Expected After Clean | Root Cause |
|---|---|---|---|
| Chevrolet Avalanche | 130.3% | Excluded (too few valid rows) | Dirty data |
| Ford Bronco Raptor | 41.7% | Excluded/improved | Year violations |
| Hyundai Excel | 27.2% | ~15-18% | Old car condition variance |
| Fiat 127/128/131 | 19-26% | ~12-15% | Old car condition variance |

---

## Part 2 — New Features for V2

### 2.1 Make-Model Price Tier (mm_price_tier)

**What it solves:** Multi-generation confusion (Mercedes E200 spans 400k–5M EGP,
VW Golf spans 150k–800k EGP). The model needs to know which tier a specific
make+model falls into, independent of the individual car's price.

**Why it is NOT data leakage:**
- Computed from TRAINING median price per (make, model)
- Saved as a static lookup JSON at training time
- At inference: lookup from the saved table using make+model only
- Individual row price is NEVER used

**Implementation:**

```python
# ── TRAINING TIME ─────────────────────────────────────────────────────────

def compute_mm_price_tier_lookup(df_train: pd.DataFrame) -> dict:
    """
    Compute make+model price tier from training data only.
    Save result as artifact alongside model pickles.

    Returns dict: {"Toyota|Corolla": "mid_range", "BMW|X5": "luxury", ...}
    """
    TIER_BINS   = [0, 300_000, 700_000, 1_500_000, 3_000_000, 7_000_000, float('inf')]
    TIER_LABELS = ['economy', 'mid_range', 'upper_mid', 'premium', 'luxury', 'ultra_luxury']

    mm_median = (
        df_train
        .groupby(['make', 'model'])['price_egp']
        .median()
        .reset_index(name='mm_median_price')
    )
    mm_median['mm_price_tier'] = pd.cut(
        mm_median['mm_median_price'], bins=TIER_BINS, labels=TIER_LABELS
    ).astype(str)

    lookup = {
        f"{row['make']}|{row['model']}": row['mm_price_tier']
        for _, row in mm_median.iterrows()
    }
    return lookup


# Call after train/test split, BEFORE adding to df:
mm_tier_lookup = compute_mm_price_tier_lookup(df_train)

# Save alongside model
import json
with open('models/metadata/mm_price_tier_lookup.json', 'w') as f:
    json.dump(mm_tier_lookup, f, ensure_ascii=False, indent=2)

# Add to full dataset
def get_mm_price_tier(make, model, lookup, default='mid_range'):
    return lookup.get(f"{make}|{model}", default)

df['mm_price_tier'] = df.apply(
    lambda r: get_mm_price_tier(r['make'], r['model'], mm_tier_lookup), axis=1
)


# ── INFERENCE TIME (feature_builder.py) ───────────────────────────────────

# Load once at startup:
MM_TIER_LOOKUP = json.load(open('models/metadata/mm_price_tier_lookup.json'))

# In build_features():
row['mm_price_tier'] = MM_TIER_LOOKUP.get(f"{make}|{model}", 'mid_range')
```

Add `mm_price_tier` to `CAT_COLS` in the training notebook.

**Example of what this gives the model:**

| make | model | brand_tier | mm_price_tier | Interpretation |
|---|---|---|---|---|
| Mercedes | 200 | premium | economy | Old Mercedes, priced like economy car |
| Mercedes | GLC200 | premium | premium | Normal premium segment |
| Mercedes | G63 | premium | ultra_luxury | Ultra-luxury despite same brand |
| Chevrolet | Aveo | mainstream | economy | Budget Chevrolet |
| Chevrolet | Tahoe | mainstream | luxury | Luxury Chevrolet |

This is exactly the hierarchy you described: brand tier tells WHO made the car,
mm_price_tier tells WHERE it sits in the market.

---

### 2.2 Log Mileage

```python
df['log_mileage_km'] = np.log1p(df['mileage_km'])
```

Add to NUM_COLS. Keep original mileage_km. The log transform reduces the extreme
influence of 400k-500k km listings on high-mileage predictions.

---

### 2.3 Mileage Ratio (Actual vs Expected)

```python
EXPECTED_KM_PER_YEAR = 15_000  # Egyptian market average

def compute_mileage_ratio(row) -> float:
    expected = max(row['car_age'], 1) * EXPECTED_KM_PER_YEAR
    return row['mileage_km'] / expected

df['mileage_ratio'] = df.apply(compute_mileage_ratio, axis=1).clip(0, 5)
# Clipped at 5 to avoid extreme outliers dominating
# Values < 1.0: lower mileage than expected for age (positive signal)
# Values 1.0–1.5: normal usage
# Values > 2.0: heavy usage (negative signal)
```

Add to NUM_COLS.

---

### 2.4 Vintage Flag

```python
df['is_vintage'] = (df['car_age'] >= 18).astype(int)
```

Separates old cars where collectible dynamics apply (condition > depreciation).
Add to NUM_COLS.

---

### 2.5 Year Bucket

```python
def year_to_bucket(year: int) -> str:
    if year < 2000:   return 'pre_2000'
    if year < 2010:   return 'y2000s'
    if year < 2016:   return 'y2010s_early'
    if year < 2020:   return 'y2010s_late'
    if year < 2023:   return 'y2020_2022'
    return 'y2023_plus'

df['year_bucket'] = df['year'].apply(year_to_bucket)
```

Add to CAT_COLS. Captures Egyptian market price step-changes (2022-2023 EGP
devaluation created sharp discontinuities that continuous year cannot model well).

---

### 2.6 Isolation Forest Anomaly Score

Trains an outlier detector on numeric features. High anomaly score → unusual
car specification → higher price uncertainty. Used as both a feature and a
confidence modifier at inference.

```python
from sklearn.ensemble import IsolationForest
import joblib

ISOLATION_FEATURES = [
    'year', 'mileage_km', 'mileage_per_year',
    'engine_cc', 'horsepower', 'seating_capacity'
]

# Train on TRAINING data only
iso_model = IsolationForest(
    n_estimators=200,
    contamination=0.05,   # expect 5% outliers
    random_state=42,
    n_jobs=-1,
)
iso_model.fit(df_train[ISOLATION_FEATURES])

# Save
joblib.dump(iso_model, 'models/preprocessors/isolation_forest.joblib')

# Add scores (more negative = more outlier, range approx -0.7 to 0.1)
df['iso_anomaly_score'] = iso_model.score_samples(df[ISOLATION_FEATURES])
```

Add `iso_anomaly_score` to NUM_COLS.

**At inference in confidence.py:** Adjust confidence downward if iso_score is very negative:
```python
def adjust_confidence_for_anomaly(confidence: str, iso_score: float) -> str:
    """Degrade confidence for anomalous cars (unusual spec combinations)."""
    if iso_score < -0.55:
        # Very anomalous: drop one confidence level
        return {'high': 'medium', 'medium': 'low', 'low': 'low'}[confidence]
    elif iso_score < -0.40:
        # Moderately anomalous: degrade only from high
        return 'medium' if confidence == 'high' else confidence
    return confidence
```

---

## Part 3 — Three-Model Architecture

### 3.1 Why Three Models

| Segment | Price Range | Training rows (est.) | Key challenge |
|---|---|---|---|
| Economy | < 700k EGP | ~8,000 | Condition variance, old cars |
| Standard | 700k–3M EGP | ~10,000 | Multi-generation models |
| Luxury | > 3M EGP | ~2,000 | Low sample, ultra-high variance |

A single model forced to learn all three simultaneously uses the same
hyperparameters, the same regularization, and the same feature weights for
cars with fundamentally different pricing dynamics.

### 3.2 Routing Strategy

**Primary router: hard routing via mm_price_tier lookup.**

```
mm_price_tier                     → Model
─────────────────────────────────────────
economy                           → economy_model
mid_range                         → standard_model
upper_mid                         → standard_model
premium                           → luxury_model
luxury                            → luxury_model
ultra_luxury                      → luxury_model
(unknown — not in lookup)         → standard_model (safe default)
```

**Boundary blending** (for production quality):

For cars with mm_price_tier at the boundary between economy and standard
(mid-range zone of 500k–900k), blend predictions from both models:

```python
def route_and_blend(
    make: str,
    model: str,
    mm_tier_lookup: dict,
    economy_pred: float,
    standard_pred: float,
    luxury_pred: float,
) -> float:
    """
    Route prediction to the correct model or blend at boundaries.
    All predictions should be in LOG space. Caller applies exp().
    """
    tier = mm_tier_lookup.get(f"{make}|{model}", 'mid_range')

    if tier == 'economy':
        return economy_pred
    elif tier == 'mid_range':
        return standard_pred
    elif tier == 'upper_mid':
        return standard_pred
    elif tier == 'premium':
        return luxury_pred
    elif tier in ('luxury', 'ultra_luxury'):
        return luxury_pred
    return standard_pred  # safe fallback
```

**Why NOT stacking for now:**
Stacking requires a separate meta-model, separate hold-out data, and adds
inference latency and complexity. For a GP project, hard routing + optional
boundary blending is the right level of complexity.

### 3.3 Training Each Segment Model

```python
# Define tier membership
economy_mask  = df['mm_price_tier'].isin(['economy'])
standard_mask = df['mm_price_tier'].isin(['mid_range', 'upper_mid'])
luxury_mask   = df['mm_price_tier'].isin(['premium', 'luxury', 'ultra_luxury'])

df_economy  = df[economy_mask]
df_standard = df[standard_mask]
df_luxury   = df[luxury_mask]

# Each model gets its own Optuna study
# Recommendation: more regularization for economy (noisy), less for luxury (few samples)
ECONOMY_EXTRA_PARAMS  = {'min_child_samples': 30, 'reg_lambda': 3.0}
STANDARD_EXTRA_PARAMS = {}  # use Optuna-found params as-is
LUXURY_EXTRA_PARAMS   = {'min_child_samples': 5,  'reg_lambda': 0.5,
                          'n_estimators': 2000}  # more trees for small dataset
```

### 3.4 Model Registry Update

Save three model sets under one version:
```python
register_model(
    model_id='xgb_quantile_v2_economy',
    segment='economy',
    pkl_path='models/pickles/xgb_v2_economy.pkl',
    ...
)
register_model(
    model_id='xgb_quantile_v2_standard',
    segment='standard',
    pkl_path='models/pickles/xgb_v2_standard.pkl',
    ...
)
register_model(
    model_id='xgb_quantile_v2_luxury',
    segment='luxury',
    pkl_path='models/pickles/xgb_v2_luxury.pkl',
    ...
)
```

The active version = "v2" and the predictor loads all three, routing at inference.

---

## Part 4 — Isolation Forest in the Ensemble

### 4.1 As a Feature

The `iso_anomaly_score` feature tells the model about an individual car's
"unusualness." This is powerful because:

- A 1984 Chevrolet Avalanche (diesel, manual) → extremely negative score
  → model learns these combinations produce unreliable pricing
- A 2022 Toyota Corolla (automatic, petrol, 30k km) → near-zero score
  → normal car, model is confident

### 4.2 As an Ensemble Weight

In the boundary blending zone, use iso_score to determine how much to trust
the specialized model vs the standard model:

```python
def blend_with_anomaly(
    specialized_pred: float,
    standard_pred: float,
    iso_score: float,
    base_weight: float = 0.8,
) -> float:
    """
    High anomaly score → trust standard model more than specialized model.
    base_weight: how much to trust specialized model in normal conditions.
    """
    # Normalize iso_score: map (-0.7, 0.1) → (0, 1) where 1 = normal
    anomaly_weight = (iso_score + 0.7) / 0.8  # clipped to [0, 1]
    anomaly_weight = max(0.0, min(1.0, anomaly_weight))
    
    # Blend: more anomalous → less weight to specialized model
    w_specialized = base_weight * anomaly_weight
    w_standard    = 1.0 - w_specialized
    
    return w_specialized * specialized_pred + w_standard * standard_pred
```

---

## Part 5 — More Data Strategy (8 Scraping Versions)

### 5.1 What 8 Scraping Versions Gives You

Eight snapshots at different times provides:
1. **More unique cars**: ~26k → potentially 60-80k rows (overlap expected)
2. **Same car at different times**: Price change tracking
3. **Time-on-market signal**: How long a listing stays → market acceptance

### 5.2 New Features From Temporal Data

```python
# If you can track the same listing across time:

# Days on market (proxy for fair pricing)
# A listing that sells quickly was fairly priced. A stale listing is overpriced.
df['days_on_market'] = (df['last_seen'] - df['first_seen']).dt.days

# Price change rate (seller reduced price → motivated to sell)
df['price_reduced'] = (df['price_current'] < df['price_first']).astype(int)
df['price_reduction_pct'] = (
    (df['price_first'] - df['price_current']) / df['price_first']
).clip(0, 0.5)
```

### 5.3 Deduplication Strategy for Multi-Snapshot Data

When combining 8 snapshots, same listing appears multiple times:
```python
# For price prediction: keep the LAST observed price per listing
# This represents the final agreed price (or closest to it)
df_combined = (
    df_all_snapshots
    .sort_values('scraped_at')
    .groupby('listing_id')
    .last()
    .reset_index()
)

# Alternative: keep ALL observations (treats price changes as different training examples)
# This is valid if the price changes represent fair market value at different times
```

---

## Part 6 — V2 Implementation Order

### Sprint 1 — Data Cleaning (1 day)

1. Add year rules to `clean_impossible_model_years.py` (Section 1.1)
2. Add Avalanche fuel/transmission correction to `fix_car_specs_lookup_full.py` (1.2)
3. Rerun full data pipeline
4. Verify Avalanche is removed/cleaned in processed_data.csv
5. Rerun baseline model to confirm MAPE improvement from data cleanup alone

### Sprint 2 — New Features (1-2 days)

1. Implement `compute_mm_price_tier_lookup()` and save as artifact
2. Add `mm_price_tier` to CAT_COLS
3. Add `log_mileage_km`, `mileage_ratio`, `is_vintage`, `year_bucket` to features
4. Add `iso_anomaly_score` and save IsolationForest model
5. Retrain single global model with new features
6. Compare MAPE before/after — expect 0.5-1.5% improvement

### Sprint 3 — Three-Model Architecture (2-3 days)

1. Implement `compute_mm_price_tier_lookup()` routing table
2. Split training data into economy/standard/luxury segments
3. Train each segment model with segment-specific hyperparameter ranges
4. Run separate Optuna studies per segment (150 trials each)
5. Implement routing logic in `predictor.py`
6. Evaluate: per-segment MAPE, coverage, within-15% rate

### Sprint 4 — Isolation Forest Integration (1 day)

1. Train IsolationForest on training numeric features
2. Save alongside model artifacts
3. Add iso_anomaly_score to confidence adjustment in `confidence.py`
4. Load IsolationForest at startup in model_state.py

### Sprint 5 — Multi-Snapshot Data (2-3 days, after scraping)

1. Combine 8 snapshots with deduplication strategy
2. Add days_on_market and price_reduced features where trackable
3. Retrain with expanded dataset (~60-80k rows)
4. Full evaluation

---

## Part 7 — Expected V2 Results

### Optimistic Scenario (all improvements work as expected)

| Metric | V1 | V2 (estimated) |
|---|---|---|
| Global MAPE | 12.9% | 10.0–11.0% |
| Economy MAPE | 22% | 14–17% |
| Standard MAPE | ~11% | 9–10% |
| Luxury MAPE | ~15% | 10–13% |
| Coverage (80% PI) | 87.7% | 78–85% |
| Within ±15% | 74.5% | 78–82% |

### Conservative Scenario (features help moderately, data expansion limited)

| Metric | V1 | V2 (conservative) |
|---|---|---|
| Global MAPE | 12.9% | 11.5–12.0% |
| Economy MAPE | 22% | 17–20% |
| Standard MAPE | ~11% | 10–11% |
| Coverage | 87.7% | 80–85% |

### Models Avalanche Problem (after cleaning)

The Avalanche model will have 0-5 valid rows after year+fuel filtering.
Exclude it from training entirely. It will fall back to the Chevrolet brand
pattern in the model, which is acceptable.

---

## Part 8 — What NOT to Add in V2

1. **Condition data**: Confirmed unavailable. Not planned.
2. **model_family as feature**: Already decided against. Model identity via
   make+model+year+mm_price_tier is sufficient.
3. **Neural networks**: 60-80k rows + 20 features is tree territory. Not justified.
4. **Per-make models (70+ models)**: Too many models, not enough samples per model.
   The three-segment approach is the right granularity.
5. **Separate model per year_bucket**: Too many dimensions. year_bucket as a
   feature achieves the same goal with much less complexity.

---

*Document prepared May 2026 — for GP project ML Pricing Engine V2 planning*
*References: make_model_mape.csv analysis, V1 evaluation results, Avalanche data quality investigation*
