# Model V2 Improvement Plan
## Egyptian Used Car Pricing Engine

**Current model:** XGBoost quantile regression, MAPE 12.91%, Coverage 87.7%  
**Target for v2:** MAPE < 11%, Coverage 78-82%, Economy segment MAPE < 18%

---

## Section 1 — Root Cause Analysis of High-MAPE Cells

Before recommending fixes, you need to understand WHY each cell is bad.
Applying the wrong fix wastes time. These are the confirmed root causes:

### 1.1 Economy Segment (<300k EGP) — 22% MAPE Global Average

**Root cause: Condition variance with no condition signal.**

Old cars (pre-2010, <300k EGP) have pricing driven 60-70% by physical condition,
not by the features in your dataset. Two identical 2003 Peugeot 405 listings:
- Good condition, new paint, fresh service: 320,000 EGP
- Poor condition, needs work: 130,000 EGP

Your model sees the same `year=2003, make=Peugeot, mileage=180000`. It averages
the distribution and produces ~225,000 EGP. Both predictions are "wrong" by 40-50k.

This is NOT a model architecture problem. It is a missing features problem.
No tree model, no neural net, no ensemble will fix this without condition data.

**Mercedes Economy (172% MAPE)** is an extreme case of this:
- W123/W124 Mercedes (1975-1995) are collectors' items in Egypt
- Price range: 80,000 EGP (neglected) to 1,200,000 EGP (restored/mint)
- Same year, same model, 15× price difference

**Actionable conclusion:** Do not try to improve economy MAPE by changing the model.
Improve it by adding data signals (see Section 2) or by segmenting the model.

---

### 1.2 Ultra-luxury (5M+) — 17-20% MAPE

**Root cause: Tiny sample size + extreme price variance.**

Chevrolet Ultra-luxury (84.7%): Tahoe/Suburban/Camaro. Likely 3-8 test rows.
Statistical noise, not a model failure. Do not attempt to fix this in v2.

BYD Luxury (29.6%): Brand too new in Egypt (2022+). Insufficient comparable sales.
The model extrapolates from general EV patterns. Will improve naturally as more data
accumulates.

**Actionable conclusion:** Exclude brands/tiers with < 20 test rows from
per-brand evaluation metrics. They are not statistically meaningful.

---

### 1.3 Volkswagen Premium (17%) and Economy (27.7%)

**Root cause: Platform overlap creates cross-segment confusion.**

VW Golf 7 (2017, good condition) prices overlap with Renault Logan (2022, new).
The model cannot learn clear VW-specific pricing patterns because the brand spans
from 60,000 EGP (old Golf 3) to 2,500,000 EGP (new Touareg).

VW specifically also has the DSG transmission issue — DSG cars are significantly
more expensive but the model may not have learned this precisely since DSG was
not normalized to Automatic (intentional decision) and the split between DSG
vs Automatic within VW is imperfect.

---

### 1.4 Hyundai/Kia Luxury (19.1% / 12.7%)

**Root cause: Rapid model year price jumps in Korean premium segment.**

A 2021 Hyundai Sonata and a 2022 Hyundai Sonata have very different prices due
to the 2022 EGP depreciation shock. The model sees year as a continuous feature
and interpolates linearly, but Egyptian pricing had a step-change in 2022-2023
due to import duty changes and currency devaluation.

This is an Egyptian market-specific phenomenon: the 2022-2023 EGP devaluation
created sharp discontinuities in car prices that year-based linear features
cannot capture.

---

## Section 2 — Feature Engineering Improvements for V2

### 2.1 High Priority — Fix Economy Segment

**Feature: `listing_age_days` (if available)**
How many days since the listing was posted. Stale listings suggest overpriced cars
that aren't selling — a weak but real signal.
```python
df['listing_age_days'] = (pd.Timestamp.now() - df['scraped_at']).dt.days
```

**Feature: `mileage_ratio` — Actual vs Expected Mileage**
Expected mileage for a car of that age in Egyptian market context.
A car with 50% of expected mileage is better maintained than average.
```python
EXPECTED_KM_PER_YEAR = 15000  # Egyptian market average
df['expected_mileage'] = df['car_age'] * EXPECTED_KM_PER_YEAR
df['mileage_ratio'] = df['mileage_km'] / df['expected_mileage'].clip(lower=1)
# Values < 1: lower than expected (positive signal)
# Values > 1: higher than expected (negative signal)
# Values > 2: very high usage (strong negative signal)
```

**Feature: `log_mileage_km`**
Log transform dramatically helps with high-mileage outliers (200k-500k km range).
The linear mileage feature has diminishing returns — the difference between
200k and 250k km matters much less than between 20k and 70k km.
```python
df['log_mileage_km'] = np.log1p(df['mileage_km'])
```
Add to NUM_COLS. Keep original mileage_km too — they complement each other.

**Feature: `is_vintage`**
Cars older than 18 years have fundamentally different pricing dynamics
(collectible value replaces depreciation value).
```python
df['is_vintage'] = (df['car_age'] >= 18).astype(int)
```
Add as a binary numeric feature.

---

### 2.2 Medium Priority — Fix Cross-Segment Confusion

**Feature: `brand_tier`**
A categorical feature grouping makes by market positioning in Egypt.
This is more informative than `brand_origin` (european/korean/etc.) because
it captures economic positioning directly.

```python
BRAND_TIERS = {
    'budget':      ['Daewoo', 'Chana', 'Speranza', 'DFSK', 'JAC', 'Saipa',
                    'Lada', 'Rox', 'Fiat', 'Chery'],
    'mainstream':  ['Toyota', 'Hyundai', 'Kia', 'Renault', 'Peugeot',
                    'Chevrolet', 'Opel', 'Nissan', 'Honda', 'Mitsubishi',
                    'Suzuki', 'MG', 'BYD', 'Skoda', 'Volkswagen', 'Ford',
                    'Mazda', 'Seat', 'Haval', 'Jetour', 'Geely', 'BAIC',
                    'Changan', 'Soueast'],
    'premium':     ['BMW', 'Mercedes', 'Audi', 'Volvo', 'Subaru', 'Cupra',
                    'Alfa Romeo', 'Citroën', 'DS', 'SsangYong', 'Zeekr',
                    'Xpeng', 'Avatr', 'Mini'],
    'luxury':      ['Land Rover', 'Porsche', 'Lexus', 'Infiniti', 'Cadillac',
                    'Dodge', 'Jeep', 'Jaguar', 'Maserati', 'Lotus'],
}

def get_brand_tier(make: str) -> str:
    for tier, makes in BRAND_TIERS.items():
        if make in makes:
            return tier
    return 'mainstream'  # safe default

df['brand_tier'] = df['make'].apply(get_brand_tier)
```
Add to CAT_COLS.

**Feature: `year_bucket`**
Group years into cohorts that reflect Egyptian market import patterns.
This captures the step-change effects better than continuous year.

```python
def year_bucket(year: int) -> str:
    if year < 2000:   return 'pre_2000'
    if year < 2010:   return '2000s'
    if year < 2016:   return '2010s_early'
    if year < 2020:   return '2010s_late'
    if year < 2023:   return '2020_2022'
    return '2023_plus'

df['year_bucket'] = df['year'].apply(year_bucket)
```
Add to CAT_COLS. Keep continuous `year` too — they work together.

---

### 2.3 Lower Priority — Marginal Improvements

**Feature: `make_model_count`**
How many listings in training data for this make+model combination.
This gives the model explicit knowledge of its own data density.
```python
mm_counts = df.groupby(['make', 'model']).size().reset_index(name='make_model_count')
df = df.merge(mm_counts, on=['make', 'model'], how='left')
```
Add to NUM_COLS. At inference, look up count from training distribution.

**Feature: `transmission_fuel_combo`**
The interaction between transmission and fuel is pricing-relevant in Egypt.
Manual+Diesel = fleet/taxi. Automatic+Petrol = private. Automatic+Electric = EV.
```python
df['transmission_fuel_combo'] = df['transmission'] + '_' + df['fuel']
```
Add to CAT_COLS.

---

## Section 3 — Model Architecture Changes for V2

### 3.1 Separate Economy Model (High Impact)

The most impactful single change for v2 is training a separate model for
the economy segment (<300k EGP or car_age > 15 years).

**Why it works:**
- Economy cars need different features (condition proxies weighted higher)
- The regularization requirements are different (more regularization needed
  for sparse/noisy economy data)
- Quantile intervals should be wider for economy (higher uncertainty)

**Implementation approach:**
```python
# Split training data
ECONOMY_THRESHOLD_PRICE = 300_000
ECONOMY_THRESHOLD_AGE = 15

economy_mask = (df['price_egp'] < ECONOMY_THRESHOLD_PRICE) | (df['car_age'] > ECONOMY_THRESHOLD_AGE)
df_economy = df[economy_mask]
df_standard = df[~economy_mask]

# Train separate models
model_economy = train_quantile_model(df_economy, params=economy_params)
model_standard = train_quantile_model(df_standard, params=standard_params)

# Routing at inference:
# if year < 2009 or expected_price < 300k → model_economy
# else → model_standard
```

**Expected MAPE improvement:**
- Economy segment: 22% → ~16-18% (condition proxy features help)
- Standard segment: 12.9% → ~11.5-12% (less noise from economy)
- Overall: ~11-12%

**Trade-off:** Adds inference complexity (two models + router). Worth it.

---

### 3.2 LightGBM + XGBoost Ensemble (Easy Win)

From Section 5 results: LightGBM and XGBoost make different errors.
A simple average of their median predictions almost always improves MAPE 0.5-1%.

```python
def ensemble_predict(lgbm_median, xgb_median, is_log_target=True):
    """Average predictions in log space then exponentiate."""
    if is_log_target:
        # Average log predictions then exp → geometric mean (preferred)
        log_ensemble = 0.5 * lgbm_median + 0.5 * xgb_median
        return np.exp(log_ensemble)
    return 0.5 * lgbm_median + 0.5 * xgb_median
```

For quantile intervals, take:
- `lower` = min(lgbm_lower, xgb_lower) — widest lower bound
- `upper` = max(lgbm_upper, xgb_upper) — widest upper bound
- `median` = geometric mean as above

This gives you tighter central estimates with appropriately wide intervals.

---

### 3.3 Tweedie/Gamma Objective for Economy Segment

For the economy model specifically, Tweedie distribution fits better than
log-normal because economy car prices have a heavy right tail
(rare vintage cars worth 10× the typical price for the same model).

```python
# LightGBM economy model
lgbm_params_economy = {
    'objective': 'tweedie',
    'tweedie_variance_power': 1.5,  # between Poisson (1) and Gamma (2)
    # ... other params
}
```

This is NOT useful for the standard model — only economy.

---

### 3.4 Price-Tier-Aware Quantile Widths

Instead of using the same quantiles (q5/q95 currently) for all cars,
use tier-specific quantile widths:

```python
# Training: train multiple quantile pairs
QUANTILE_PAIRS = {
    'economy':      (0.10, 0.90),  # tighter — less useful to over-cover
    'standard':     (0.05, 0.95),  # current
    'luxury':       (0.05, 0.95),
    'ultra_luxury': (0.15, 0.85),  # fewer samples, wider central band is better
}
```

At inference, route to the appropriate quantile based on predicted price tier.

---

## Section 4 — Data Collection Priorities

These will have more impact than any model change for the economy segment.

### 4.1 Targeted Economy Data Collection

**Priority list by expected impact:**

1. **Old Toyota Corolla (1995-2007)**: Huge volume in Egypt, highly variable
   prices. Need 500+ more listings with verified prices.

2. **Old Hyundai Elantra/Accent (2000-2010)**: Same situation.

3. **Mercedes old models (200, 230, E280 pre-2005)**: These are pricing outliers.
   Either collect condition data alongside price OR flag them as a separate
   "vintage Mercedes" category that doesn't get standard pricing.

4. **Old Peugeot 206/405 (1990-2010)**: Very common in Egypt, very variable.

### 4.2 Condition Proxy Data

For the economy segment specifically, scrape these additional fields from
listing descriptions:
- Number of photos in listing (more photos → better condition disclosure)
- Title keyword flags: "بدون حوادث" (no accidents), "كالجديد" (like new),
  "محتاج صيانة" (needs maintenance), "اوتوماتيك" (automatic), "تيربو" (turbo)
- Listing description word count (longer description → more transparent seller)

These are weak signals but they add up. A 3-feature condition proxy could
improve economy MAPE by 2-4%.

---

## Section 5 — Training Changes

### 5.1 Sample Weighting for Economy Segment

Before separating into two models, try sample weights first (easier to implement):

```python
# In LightGBM/XGBoost training:
# Upweight economy samples so the model pays more attention to them

def compute_sample_weights(price_egp: np.ndarray) -> np.ndarray:
    weights = np.ones(len(price_egp))
    economy_mask = price_egp < 300_000
    weights[economy_mask] = 2.5  # 2.5× weight on economy predictions
    return weights

# Usage:
lgbm_model.fit(X_train, y_train, sample_weight=compute_sample_weights(prices_train))
```

This won't fully solve the economy problem but it's a 3-line change that
might reduce economy MAPE from 22% to ~18% without architectural changes.

### 5.2 Longer Optuna Training for V2

From the convergence plots, both models converged around trial 40-60.
Run 150-200 trials for v2 — both models still had room to improve.
The LightGBM trial 80-100 region had several competitive trials that suggest
the landscape is still being explored.

### 5.3 Cross-Validation Strategy

Switch from KFold to GroupKFold by `make` for the Optuna objective:
```python
from sklearn.model_selection import GroupKFold

gkf = GroupKFold(n_splits=5)
for train_idx, val_idx in gkf.split(X, groups=df['make']):
    # each fold tests on unseen makes
```
This gives a more conservative (honest) CV estimate and prevents the model
from memorizing make-specific pricing patterns during tuning.

---

## Section 6 — Evaluation Framework for V2

### 6.1 Primary Metrics (for GP presentation and investors)

Report these, in this order of importance:

1. **Within ±15% rate by price tier** — most interpretable for non-technical audience
   - Target v2: Economy > 65%, Standard > 78%, Premium > 82%, Luxury > 72%

2. **MAPE by price tier** — shows honest per-segment performance
   - Never report global MAPE alone

3. **CI Coverage** — shows calibration quality
   - Target: 78-82% for 80% PI

4. **Median absolute error in EGP by price tier** — gives absolute context
   - "For cars between 300k-600k EGP, our typical error is X EGP (Y%)"

### 6.2 Brands to Exclude from Per-Brand Evaluation

Always exclude from per-brand metrics when n_test < 20:
```python
MIN_BRAND_TEST_ROWS = 20
brand_eval = brand_eval[brand_eval['n_test'] >= MIN_BRAND_TEST_ROWS]
```

Current brands that should be excluded from v1 evaluation:
- Soueast (7 test rows)
- Jaguar (5 test rows)
- Any brand with n_test < 20 in the segmented heatmap

### 6.3 New Evaluation Plot for V2

Add a **confidence calibration plot** (reliability diagram):
Plot predicted confidence vs actual accuracy.
- x-axis: predicted confidence (high/medium/low → 85%/70%/50% expected)
- y-axis: actual fraction of predictions within ±15%
- If the line is diagonal: well-calibrated confidence scores
- If high-confidence predictions are only 65% accurate: overconfident

This is the most compelling visualization for a GP committee because it shows
the system knows when it's wrong.

---

## Section 7 — V2 Implementation Roadmap

### Sprint 1 (1-2 days): Easy wins, high impact

1. Add `log_mileage_km` to NUM_COLS
2. Add `mileage_ratio` to NUM_COLS
3. Add `is_vintage` to NUM_COLS
4. Add `brand_tier` to CAT_COLS
5. Add `year_bucket` to CAT_COLS
6. Add `transmission_fuel_combo` to CAT_COLS
7. Add sample weights (2.5× for economy)
8. Run Optuna for 150 trials

**Expected improvement:** Economy MAPE 22% → 17-19%, overall MAPE 12.9% → 11.5-12.5%

### Sprint 2 (2-3 days): Structural changes

1. Train LightGBM + XGBoost ensemble (geometric mean of log predictions)
2. Switch CV to GroupKFold by make
3. Add per-tier quantile widths
4. Implement reliability diagram evaluation

**Expected improvement:** Overall MAPE → 11-12%, Coverage better calibrated

### Sprint 3 (3-5 days): Economy segment model

1. Train separate economy model (car_age > 15 or price < 300k)
2. Implement router at inference time
3. Feature-engineer condition proxies from listing text if available
4. Evaluate separately on economy test set

**Expected improvement:** Economy MAPE 17-19% → 14-16%, overall MAPE → 10.5-11.5%

---

## Section 8 — What NOT to Do in V2

1. **Do NOT add model_family as a feature.** The v1 model already dropped it
   correctly. At inference time, model_family is derived from the lookup —
   it's not a direct user input and adds complexity without clear benefit
   since `model` already encodes this.

2. **Do NOT try to fix the Mercedes Economy cells.** They are fundamentally
   unfixable without condition data. Report them as "excluded from evaluation
   (condition-dependent pricing, insufficient data)."

3. **Do NOT use neural networks or deep learning.** With 20,000 rows and 15
   features, gradient-boosted trees remain the gold standard. Neural nets would
   require 10× more data to match tree performance here.

4. **Do NOT tune hyperparameters separately for each make.** The model already
   handles make-specific patterns through its splits. Per-make hyperparameters
   would overfit dramatically.

5. **Do NOT add `car_age` back.** Even though the model slightly changed
   behavior without it, the improvement in generalization is worth it.
   `year` + `log_mileage_km` + `mileage_ratio` together carry all the
   age-related information more robustly.

---

## Summary Priority Table

| Change | Effort | Expected MAPE Impact | Expected Coverage Impact |
|---|---|---|---|
| log_mileage_km + mileage_ratio + is_vintage | Low (2h) | −0.5 to −1.0% | Neutral |
| brand_tier + year_bucket features | Low (2h) | −0.3 to −0.7% | Neutral |
| Sample weights for economy | Low (1h) | Economy −2 to −4% | Neutral |
| LightGBM + XGBoost ensemble | Low (3h) | −0.5 to −1.0% | Better calibration |
| GroupKFold CV | Low (1h) | +0.1 to +0.3% (honest) | Better calibration |
| 150 Optuna trials | Medium (4-8h run) | −0.3 to −0.5% | Neutral |
| Separate economy model | High (2 days) | Economy −4 to −6% | Wider, honest |
| Condition proxy features from text | High (3 days) | Economy −2 to −4% | Neutral |

*A "+" in MAPE means the reported number goes up because CV is more honest,
not because the model got worse.*

---

*Document prepared May 2026 — for GP project ML Pricing Engine v2 planning*
