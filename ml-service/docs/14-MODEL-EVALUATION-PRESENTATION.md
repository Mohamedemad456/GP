# KARNA — ML Service Model Evaluation & Presentation

> **Graduation Project Demo — Egypt Used-Car Price Prediction System**

---

## 1. Pipeline Overview

```
Scraping → Canonicalization → Data Cleansing → Feature Engineering → Model Training → FastAPI Serving
  26K raw      104 fixes         20K clean        15 features         XGBoost/LGBM       /api/v1/predict
```

| Stat | Value |
|------|-------|
| **Dataset** | 20,214 listings, 73 makes, 518 models |
| **Features** | 6 numeric + 9 categorical = 15 |
| **Target** | `price_egp` (22K–20M EGP) |
| **Price tiers** | Budget (<300K), Mid-Range (300K–700K), Premium (700K–1.5M), Luxury (1.5M+) |
| **Data sources** | `car_specs_lookup` (4,302 rows), `AI_lookup` (5,680 rows) |
| **Test split** | 4,043 rows (20%), stratified by price range |

---

## 2. Data Split Strategies (A–E)

Five train/test split strategies were evaluated to find the most realistic production scenario:

| Split | Strategy | Train | Test | Rationale |
|-------|----------|-------|------|-----------|
| **A** | Random rows | 16,171 | 4,043 | Simple baseline — data leaks make+model info across split |
| **B** | Within make+model | 16,367 | 3,847 | Every car model appears in both train & test — tests interpolation |
| **C** | By make only | 16,237 | 3,977 | **Hardest** — entire makes unseen in training — tests generalization |
| **D** | Stratified by make | 16,171 | 4,043 | Balanced make representation — good for diverse predictions |
| **E** | Stratified by price range | 16,171 | 4,043 | **Chosen for production** — balanced price distribution, realistic |

### Why Split E?

- **Split A** inflates metrics because the model memorizes specific cars that appear in both sets
- **Split B** is realistic for known models but doesn't test generalization to price ranges the model hasn't seen
- **Split C** is too hard — MAPE jumps to 34–38% because the model must predict for entirely unseen brands
- **Split D** ensures brand diversity but can skew toward common brands
- **Split E** ensures the test set has equal representation across cheap/mid/expensive cars, which matches real-world usage where users query cars at any price point

### Split Impact on Performance (XGBoost, `price_egp`)

| Split | MAE (EGP) | MAPE% | R² |
|-------|-----------|-------|-----|
| A (random) | 134,638 | 13.27 | 0.923 |
| **E (strat price)** ✅ | **138,277** | **13.53** | **0.893** |
| D (strat make) | 141,489 | 13.95 | 0.894 |
| B (within mm) | 143,636 | 14.94 | 0.870 |
| C (by make) | 796,546 | 34.24 | 0.484 |

> Split A gives the best numbers but is **optimistically biased**. Split E is the honest production estimate. Split C shows what happens when the model encounters a brand it's never seen — performance collapses.

---

## 3. All Models Tried (Chronological)

### 3.1 Notebook 03 — Dummy Baselines

Non-ML benchmarks using group statistics. These establish the floor — any ML model must beat these.

**Split**: B (within make+model by rows)

| Baseline | Strategy | MAE (EGP) | MAPE% | R² |
|----------|----------|-----------|-------|-----|
| Global mean | Average of all prices | 562,337 | 86.8 | 0.49 |
| Global median | Median of all prices | 528,129 | 63.2 | 0.46 |
| Make median (fallback global) | Median per make, fallback to global | 528,129 | 63.2 | 0.46 |
| **Make+Model median (cascade)** | Median per (make, model), fallback to make, then global | **316,670** | **37.3** | **0.74** |

> **Key insight**: Even a simple make+model median achieves R²=0.74 — brand and model are the strongest price signals. But MAPE 37.3% means the average error is ~⅓ of the price — unacceptable for a pricing tool.

### 3.2 Notebook 04 — Linear Models

Three linear models with a reusable preprocessing pipeline (OneHotEncoder + SimpleImputer + StandardScaler for numeric, OneHotEncoder for categorical). Evaluated across all 5 splits and both targets.

**Preprocessing pipeline**:
- Numeric: `SimpleImputer(median)` → `StandardScaler`
- Categorical: `SimpleImputer(most_frequent)` → `OneHotEncoder(handle_unknown='ignore')`
- Output: dense matrix via `FunctionTransformer(sparse_to_dense)`

| Model | Target | Best Split | MAE (EGP) | MAPE% | R² | Key Detail |
|-------|--------|-----------|-----------|-------|-----|------------|
| LinearRegression | price_egp | E | 274,124 | 51.5 | 0.85 | Outliers dominate raw EGP |
| Ridge (α=0.01) | price_egp | E | 274,525 | 51.8 | 0.85 | Regularization barely helps on raw target |
| HuberRegressor | price_egp | E | 238,335 | 32.2 | 0.83 | Robust loss handles outliers better |
| LinearRegression | price_egp_log | E | 162,643 | 16.9 | 0.91 | Log target compresses price range |
| Ridge (α=0.01) | price_egp_log | E | 162,672 | 16.8 | 0.91 | Nearly identical to OLS |
| **HuberRegressor (tuned)** | **price_egp_log** | **B** | **158,458** | **15.6** | **0.85** | **Best linear model** |

> **Key insight**: Log-transforming the target is critical for linear models — MAPE drops from 32% to 15.6%. Huber's robust loss (ε=1.3, α=0.0) further reduces outlier influence. But linear models can't capture nonlinear interactions (e.g., how mileage affects luxury vs budget cars differently).

### 3.3 Notebook 05 — XGBoost & LightGBM Quantile Regression

**Why tree-based models?** They naturally handle:
- Nonlinear feature interactions (year × make × mileage)
- Categorical variables without one-hot encoding (XGBoost: label encoding, LightGBM: native category dtype)
- Missing values natively
- Feature importance via SHAP

**Why quantile regression?** Instead of predicting a single price, we predict 3 values:
- **Lower bound** (5th percentile) → worst-case price
- **Median** (50th percentile) → fair market price
- **Upper bound** (95th percentile) → optimistic price

This gives the buyer a **negotiation range** [lower, median] and a **confidence interval** [lower, upper] with ~80% coverage.

**Optuna tuning**: 100 trials per framework, optimizing pinball loss on the median model. Best params reused for lower/upper quantiles.

| Framework | Target | MAE (EGP) | MAPE% | R² | Within ±10% | Within ±15% | Coverage |
|-----------|--------|-----------|-------|-----|-------------|-------------|----------|
| **XGBoost** | **price_egp** | **138,277** | **13.53** | **0.893** | **59.7%** | **74.5%** | **87.7%** |
| XGBoost | price_egp_log | 143,125 | 13.20 | 0.882 | 59.3% | 73.4% | — |
| LightGBM | price_egp | 147,359 | 13.62 | 0.879 | 59.3% | 72.2% | 78.4% |
| LightGBM | price_egp_log | 146,195 | 13.11 | 0.875 | 59.3% | 72.8% | — |

> **Key insight**: XGBoost on raw `price_egp` with split E is selected as the production model — best R² (0.893) and highest CI coverage (87.7%). LightGBM has slightly lower MAPE on log target but much worse coverage (78.4% vs 87.7%).

### 3.4 Notebook 06 — Ensemble Experiments

Four ensemble methods combining XGBoost + LightGBM + Huber predictions:

| Method | Strategy | MAE (EGP) | MAPE% | R² | Within ±15% | Coverage |
|--------|----------|-----------|-------|-----|-------------|----------|
| Simple Average | Equal weight (⅓ each) | 136,334 | 12.9 | 0.891 | 75.8% | 86.8% |
| Weighted Average | 0.4/0.4/0.2 (XGB/LGBM/Huber) | 135,490 | 12.9 | 0.892 | 75.9% | 65.4% |
| **Robust Average** ✅ | Weighted + outlier trimming | **133,593** | **12.78** | **0.888** | **76.6%** | **86.8%** |
| Stacking (Ridge meta) | Train Ridge on 3 predictions | 142,821 | 14.2 | 0.890 | 72.5% | 87.5% |

**Promotion criteria** (all must pass):
1. ✅ MAPE improvement ≥ 0.2% absolute over best single model
2. ✅ R² ≥ 0.88 (no significant degradation)
3. ✅ Within ±10% ≥ 59% (no regression on tight accuracy)
4. ✅ Coverage ≥ 85% for CI reliability

> **Robust Average promoted** — MAPE 12.78% vs XGBoost's 13.53% (−0.76% absolute improvement). The ensemble benefits from diversity: XGBoost excels on luxury cars, LightGBM on mid-range, Huber provides stability.

---

## 4. Production Model Architecture

### Why Quantile Regression?

Traditional regression predicts a **single point estimate**. For a used-car pricing tool, a single number is insufficient:
- Buyers need to know **how much room they have to negotiate**
- Sellers need to know the **range of fair prices**
- The system must communicate **confidence** — some cars are easy to price, others are not

Quantile regression solves this by predicting **3 values** simultaneously:

```
Lower bound (q=0.05) ─── "Don't pay more than this if you're getting a deal"
Median (q=0.50)     ─── "Fair market price"  
Upper bound (q=0.95) ─── "Reasonable ceiling price"

Negotiation range = [Lower, Median]  ← buyer's bargaining space
Confidence interval = [Lower, Upper] ← 90% of actual prices fall here
```

### XGBoost Quantile Architecture

```
Input (15 features)
    ├── Numeric: year, mileage_km, mileage_per_year, engine_cc, horsepower, seating_capacity
    └── Categorical (label-encoded): make, model, transmission, fuel, location,
                                      body_type, drivetrain, brand_origin, car_segment
    
    ↓ Label Encoding (9 encoders fitted on full dataset, unseen → '__MISSING__')
    
    ↓ XGBoost DMatrix (enable_categorical=True)
    
    ├── Model_q0.05 → lower bound   (objective=reg:quantileerror, alpha=0.05)
    ├── Model_q0.50 → median price  (objective=reg:quantileerror, alpha=0.50)  ← primary prediction
    └── Model_q0.95 → upper bound   (objective=reg:quantileerror, alpha=0.95)
    
    ↓ Post-processing
    ├── Enforce monotonicity: lower ≤ median ≤ upper
    ├── Price rounding: <200K → round to 5K, ≥200K → round to 10K
    ├── Confidence label: based on per-make-model MAPE lookup
    │     High (<14% MAPE), Medium (14–18%), Low (>18%)
    └── Negotiation range: MAPE-based width around median
```

### Optuna-Tuned Hyperparameters (100 trials each)

| Parameter | XGBoost | LightGBM | Meaning |
|-----------|---------|----------|---------|
| learning_rate | 0.0155 | 0.0277 | Step size — lower = more trees but better generalization |
| max_depth | 11 | 10 | Tree depth — controls model complexity |
| num_leaves | — | 62 | Leaf count (LightGBM-specific) |
| min_child_samples/weight | 4 | 12 | Min samples per leaf — prevents overfitting |
| subsample | 0.662 | 0.715 | Row sampling ratio per tree |
| colsample_bytree | 0.854 | 0.543 | Feature sampling ratio per tree |
| reg_alpha | 0.086 | 0.492 | L1 regularization — feature sparsity |
| reg_lambda | 1.4e-7 | 1.7e-5 | L2 regularization — weight shrinkage |
| gamma/min_split_gain | 0.447 | 0.028 | Min loss reduction for split |
| max_bin | 512 | — | Histogram bins for feature discretization |
| **Pinball loss (val)** | **0.0627** | **0.0630** | Quantile loss — XGBoost slightly better |

### Feature Set (15 features)

| Type | Feature | Description | Why it matters |
|------|---------|-------------|----------------|
| Numeric | `year` | Model year | Strongest price driver after make/model |
| Numeric | `mileage_km` | Odometer reading | Depreciation signal |
| Numeric | `mileage_per_year` | Derived: mileage / age | Detects abnormal usage |
| Numeric | `engine_cc` | Engine displacement | Performance tier |
| Numeric | `horsepower` | Engine power | Trim level indicator |
| Numeric | `seating_capacity` | Seats | Family vs sport segmentation |
| Categorical | `make` | Brand (73 values) | **#1 SHAP importance** |
| Categorical | `model` | Model name (518 values) | **#2 SHAP importance** |
| Categorical | `transmission` | Auto/Manual/... | Convenience premium |
| Categorical | `fuel` | Petrol/Diesel/Electric/... | Fuel type premium |
| Categorical | `location` | 17 Egyptian cities | Regional price variation |
| Categorical | `body_type` | Sedan/SUV/... | Market segment |
| Categorical | `drivetrain` | FWD/RWD/AWD/4WD | Performance indicator |
| Categorical | `brand_origin` | japanese/european/... | Origin premium |
| Categorical | `car_segment` | family/luxury/suv/... | Market positioning |

---

## 5. Comprehensive Model Comparison (All Models, Split E)

| Model | MAE (EGP) | MAPE% | R² | Within ±10% | Within ±15% | Coverage |
|-------|-----------|-------|-----|-------------|-------------|----------|
| Dummy (make+model median) | 316,670 | 37.3 | 0.74 | — | — | — |
| Huber (log, best linear) | 158,458 | 15.6 | 0.85 | — | — | — |
| LightGBM single | 141,291 | 13.4 | 0.88 | 59.3% | 74.9% | 78.4% |
| **XGBoost single (production)** | **138,277** | **13.5** | **0.89** | **59.7%** | **74.5%** | **87.7%** |
| **Ensemble Robust Avg** | **133,593** | **12.8** | **0.89** | **61.3%** | **76.6%** | **86.8%** |

### Improvement Journey

```
Dummy baseline    █████████████████████████████████████  37.3% MAPE
Linear (Huber)    ████████████████                       15.6% MAPE  (2.4× improvement)
XGBoost single    ██████████████                         13.5% MAPE  (2.8× improvement)
Ensemble          █████████████                          12.8% MAPE  (2.9× improvement)
```

### Overall Metrics (Computed on Exact Test Set)

| Model | MAE (EGP) | MAPE% | R² |
|-------|-----------|-------|-----|
| XGBoost | 138,277 | 13.53 | 0.8925 |
| Ensemble (Robust Avg) | 135,490 | 12.91 | 0.8921 |
| LightGBM | 141,291 | 13.40 | 0.8839 |
| Huber (Linear) | 159,668 | 14.62 | 0.8637 |

---

## 6. Per-Price-Tier Evaluation (Exact Numbers)

### 6.1 All Models — Unfiltered

| Tier | n | Model | MAE (EGP) | MAPE% | R² | Coverage |
|------|---|-------|-----------|-------|-----|----------|
| Budget (<300K) | 854 | XGBoost | 35,991 | 22.65 | -0.27 | 85.8% |
| Budget (<300K) | 854 | **Ensemble** | **33,668** | **21.18** | **-0.18** | **81.0%** |
| Budget (<300K) | 854 | LightGBM | 35,238 | 21.93 | -0.49 | 76.1% |
| Budget (<300K) | 854 | Huber | 36,412 | 22.87 | 0.04 | — |
| Mid-Range (300K–700K) | 1,367 | XGBoost | 49,781 | 10.59 | 0.48 | 87.4% |
| Mid-Range (300K–700K) | 1,367 | **Ensemble** | **48,713** | **10.30** | **0.51** | **85.2%** |
| Mid-Range (300K–700K) | 1,367 | LightGBM | 50,344 | 10.62 | 0.43 | 78.8% |
| Mid-Range (300K–700K) | 1,367 | Huber | 56,895 | 11.92 | 0.36 | — |
| Premium (700K–1.5M) | 1,032 | XGBoost | 107,428 | 10.82 | 0.27 | 89.8% |
| Premium (700K–1.5M) | 1,032 | **Ensemble** | **101,195** | **10.22** | **0.31** | **90.0%** |
| Premium (700K–1.5M) | 1,032 | LightGBM | 105,195 | 10.60 | 0.27 | 83.1% |
| Premium (700K–1.5M) | 1,032 | Huber | 118,315 | 11.96 | 0.04 | — |
| Luxury (1.5M+) | 790 | XGBoost | 442,282 | 12.31 | 0.75 | 87.5% |
| Luxury (1.5M+) | 790 | **Ensemble** | **440,518** | **12.01** | **0.75** | **85.6%** |
| Luxury (1.5M+) | 790 | LightGBM | 460,461 | 12.66 | 0.73 | 83.8% |
| Luxury (1.5M+) | 790 | Huber | 524,767 | 13.87 | 0.68 | — |

### Key Per-Tier Observations

- **Budget tier** has the highest MAPE (~22%) — cheap cars have high relative variance and fewer distinguishing features. Negative R² means the model is worse than a horizontal mean line within this tier alone (but still much better than the global dummy baseline).
- **Mid-Range** is the sweet spot — MAPE ~10%, most data (1,367 test rows), best accuracy.
- **Premium** achieves the best coverage (90% for ensemble) — price intervals are well-calibrated.
- **Luxury** has high absolute MAE (440K EGP) but reasonable MAPE (~12%) — expensive cars have larger absolute but smaller relative errors.
- **Ensemble wins on MAPE in every tier** — biggest gain on Budget (−1.47%).

![Price Tier Metrics](../models/plots_05_xgboost_lgbm_quantile/price_tier_metrics.png)

![Per Price Tier All Methods](../models/plots_06_ensemble_experiments/per_price_tier_all_methods.png)

![Heatmap Tier Method](../models/plots_06_ensemble_experiments/heatmap_tier_method.png)

### 6.2 Excluding Worst Models (MAPE > 50%)

3 make-model combos excluded (Chevrolet Avalanche 130%, Mercedes 200 52%, Land Rover Range Rover Vogue 51%). This removes 23 test rows (4,043 → 4,020).

| Tier | n | Model | MAE (EGP) | MAPE% | R² | Coverage |
|------|---|-------|-----------|-------|-----|----------|
| Budget (<300K) | 847 | XGBoost | 34,199 | 21.58 | 0.13 | 85.8% |
| Budget (<300K) | 847 | **Ensemble** | **32,124** | **20.25** | **0.13** | **81.1%** |
| Budget (<300K) | 847 | LightGBM | 33,592 | 20.96 | -0.15 | 76.2% |
| Budget (<300K) | 847 | Huber | 35,467 | 22.26 | 0.18 | — |
| Mid-Range (300K–700K) | 1,362 | XGBoost | 49,198 | 10.44 | 0.49 | 87.4% |
| Mid-Range (300K–700K) | 1,362 | **Ensemble** | **48,147** | **10.15** | **0.52** | **85.2%** |
| Mid-Range (300K–700K) | 1,362 | LightGBM | 49,681 | 10.44 | 0.45 | 78.8% |
| Mid-Range (300K–700K) | 1,362 | Huber | 56,606 | 11.84 | 0.37 | — |
| Premium (700K–1.5M) | 1,029 | XGBoost | 107,540 | 10.83 | 0.27 | 89.8% |
| Premium (700K–1.5M) | 1,029 | **Ensemble** | **101,233** | **10.21** | **0.30** | **90.0%** |
| Premium (700K–1.5M) | 1,029 | LightGBM | 105,048 | 10.57 | 0.27 | 83.1% |
| Premium (700K–1.5M) | 1,029 | Huber | 118,142 | 11.93 | 0.04 | — |
| Luxury (1.5M+) | 782 | XGBoost | 424,992 | 11.95 | 0.76 | 87.7% |
| Luxury (1.5M+) | 782 | **Ensemble** | **424,024** | **11.66** | **0.76** | **85.8%** |
| Luxury (1.5M+) | 782 | LightGBM | 443,838 | 12.30 | 0.74 | 83.8% |
| Luxury (1.5M+) | 782 | Huber | 499,584 | 13.32 | 0.69 | — |

### Overall: Filtered vs Unfiltered

| Model | MAE (All) | MAPE (All) | R² (All) | MAE (Filtered) | MAPE (Filtered) | R² (Filtered) |
|-------|-----------|------------|----------|-----------------|-----------------|----------------|
| XGBoost | 138,277 | 13.53% | 0.893 | 134,074 | 13.18% | 0.900 |
| **Ensemble** | **135,490** | **12.91%** | **0.892** | **131,478** | **12.59%** | **0.899** |
| LightGBM | 141,291 | 13.40% | 0.884 | 137,138 | 13.05% | 0.891 |
| Huber | 159,668 | 14.62% | 0.864 | 154,075 | 14.35% | 0.872 |

> Removing 3 outlier combos (0.6% of test rows) improves MAPE by ~0.35% absolute and R² by ~0.007 across all models. The worst models are rare edge cases — the system correctly flags them with "Low" confidence.

---

## 7. Ensemble vs XGBoost — Head-to-Head

| Metric | XGBoost Single | Ensemble (Robust Avg) | Delta | Winner |
|--------|---------------|----------------------|-------|--------|
| MAPE | 13.53% | 12.91% | **−0.62%** | Ensemble ✅ |
| MAE | 138,277 | 135,490 | **−2,787** | Ensemble ✅ |
| R² | 0.893 | 0.892 | −0.001 | XGBoost (negligible) |
| Within ±10% | 59.7% | 61.3% | **+1.6%** | Ensemble ✅ |
| Within ±15% | 74.5% | 76.6% | **+2.1%** | Ensemble ✅ |
| Coverage | 87.7% | 86.8% | −0.9% | XGBoost |

### Per-Tier Ensemble Advantage

| Tier | MAPE XGB | MAPE Ensemble | Delta |
|------|---------|---------------|-------|
| Budget | 22.65% | 21.18% | **−1.47%** ✅ |
| Mid-Range | 10.59% | 10.30% | **−0.29%** ✅ |
| Premium | 10.82% | 10.22% | **−0.60%** ✅ |
| Luxury | 12.31% | 12.01% | **−0.30%** ✅ |

> Ensemble improves MAPE in **every tier**, with the biggest gain on Budget cars (−1.47%). The Huber component stabilizes predictions on cheap cars where tree models overfit to outliers.

### Per-Brand Impact

30 out of 42 brands improved with the ensemble. Top improvements:

| Brand | XGB MAPE | Ensemble MAPE | Delta |
|-------|---------|---------------|-------|
| Ford | ~17% | ~12.4% | −4.6% |
| Changan | ~15% | ~12% | −3.0% |
| Geely | ~14% | ~11.3% | −2.7% |
| Fiat | ~16% | ~14.6% | −1.4% |
| BYD | ~14% | ~12.8% | −1.2% |

![Ensemble Comparison](../models/plots_06_ensemble_experiments/ensemble_comparison.png)

![Per Make MAPE All Methods](../models/plots_06_ensemble_experiments/per_make_mape_all_methods.png)

![Per Make MAPE Delta vs XGB](../models/plots_06_ensemble_experiments/per_make_mape_delta_vs_xgb.png)

---

## 8. Per-Make-Model Diagnostics

From notebook 06b — 218 make-model combos with ≥5 test rows:

| Stat | Value |
|------|-------|
| Median MAPE | 10.4% |
| Mean MAPE | 13.6% |
| Best MAPE | 1.2% (Jetour T2) |
| Worst MAPE | 130.3% (Chevrolet Avalanche) |
| Combos >50% MAPE | 3 / 218 (1.4%) |
| Combos <15% MAPE | 155 / 218 (71%) |
| Combos <10% MAPE | 98 / 218 (45%) |

### Top 5 Best Models

| Make | Model | MAPE% | R² | Mean Price |
|------|-------|-------|-----|------------|
| Jetour | T2 | 1.2% | 1.00 | 1.8M EGP |
| Cupra | Leon | 2.7% | 0.70 | 1.7M EGP |
| Speranza | Tiggo | 2.7% | 1.00 | 441K EGP |
| Chery | Tiggo 8 | 3.3% | 0.80 | 1.1M EGP |
| Land Rover | RR Velar | 3.4% | 1.00 | 4.3M EGP |

### Top 5 Worst Models

| Make | Model | MAPE% | R² | Mean Price | Why? |
|------|-------|-------|-----|------------|------|
| Chevrolet | Avalanche | 130.3% | -1.9 | 474K | Very rare, inconsistent pricing |
| Mercedes | 200 | 51.9% | 0.9 | 569K | Model name confusion (C200 vs standalone) |
| Land Rover | RR Vogue | 50.9% | 0.3 | 7.7M | Ultra-luxury, high variance |
| Porsche | Cayenne | 49.0% | 0.9 | 6.0M | Multiple trims with huge price spread |
| Honda | Accord | 48.3% | 0.9 | 1.0M | Generational overlap (old vs new) |

![Segmented MAPE](../models/plots_05_xgboost_lgbm_quantile/segmented_mape.png)

![Make Price Tier Heatmap](../models/plots_05_xgboost_lgbm_quantile/make_price_tier_heatmap.png)

![Make MAPE Heatmap](../models/plots_06_ensemble_experiments/make_mape_heatmap.png)

![Per Make Model MAPE](../models/plots_06_ensemble_experiments/per_make_model_mape.png)

---

## 9. SHAP & Feature Importance

![SHAP Summary](../models/plots_05_xgboost_lgbm_quantile/shap_summary.png)

![SHAP Beeswarm](../models/plots_05_xgboost_lgbm_quantile/shap_beeswarm.png)

![SHAP XGBoost Summary](../models/plots_05_xgboost_lgbm_quantile/shap_xgb_summary.png)

![SHAP Waterfall Sample 0](../models/plots_05_xgboost_lgbm_quantile/shap_waterfall_0.png)

**Top features by SHAP importance:**
1. **make** — brand is the strongest price signal (Mercedes vs Hyundai = 10× price difference)
2. **model** — specific model within brand (C-Class vs S-Class)
3. **year** — newer = more expensive (strong nonlinear effect: 1-year-old cars hold value, 10+ year drops sharply)
4. **horsepower** — performance tier within same model
5. **engine_cc** — displacement correlates with trim level
6. **mileage_km** — usage depreciation (diminishing effect after 100K km)

---

## 10. Confidence Intervals & Negotiation Range

![Quantile Bands](../models/plots_05_xgboost_lgbm_quantile/quantile_bands.png)

![Interval Width Distribution](../models/plots_05_xgboost_lgbm_quantile/interval_width_dist.png)

![Interval Bands Ensemble](../models/plots_06_ensemble_experiments/interval_bands.png)

### CI Quality Metrics

| Metric | XGBoost | Ensemble | Target |
|--------|---------|----------|--------|
| Coverage (actual within [lower, upper]) | 87.7% | 86.8% | ~90% |
| Mean interval width (% of median) | 86.5% | 77.3% | Narrower = better |
| Monotonicity violations | 0 | 0 | 0 |
| Negative lower bounds | 0 | 0 | 0 |

> Coverage ~87% means 87% of actual prices fall within the predicted [lower, upper] interval. The ensemble produces **tighter intervals** (77% width vs 87%) while maintaining similar coverage — more informative for users.

### How It Works in Production

| Confidence | MAPE Range | Negotiation Range | Example |
|-----------|-----------|-------------------|---------|
| **High** | <14% | ±(MAPE-based)% around median | Toyota Corolla 2018: 780K–900K EGP |
| **Medium** | 14–18% | Wider range | Seat Ibiza: 600K–820K EGP |
| **Low** | >18% | Widest range, caution advised | Chevrolet Avalanche: 200K–700K EGP |

Per-make-model MAPE is loaded from `models/metrics/make_model_mape_cv.csv` (all combos, no minimum threshold). Falls back to make-level median, then global MAPE (13.5%). The legacy test-only file `models/metrics/make_model_mape.csv` (218 combos) is kept for reference.

---

## 11. Residual Analysis & Predicted vs Actual

![Residual Analysis](../models/plots_05_xgboost_lgbm_quantile/residual_analysis.png)

![Best Splits XGBoost](../models/plots_05_xgboost_lgbm_quantile/best_splits_xgboost_price_egp.png)

![Best Splits LightGBM](../models/plots_05_xgboost_lgbm_quantile/best_splits_lightgbm_price_egp.png)

![Pred vs Actual All Methods](../models/plots_06_ensemble_experiments/pred_vs_actual_all_methods.png)

![Residual Analysis Ensemble](../models/plots_06_ensemble_experiments/residual_analysis.png)

---

## 12. Optuna Tuning & Model Selection

![Optuna Convergence](../models/plots_05_xgboost_lgbm_quantile/optuna_convergence.png)

![Optuna Param Importance](../models/plots_05_xgboost_lgbm_quantile/optuna_param_importance.png)

![Radar Comparison](../models/plots_05_xgboost_lgbm_quantile/radar_comparison.png)


![Final Verdict](../models/plots_06_ensemble_experiments/final_verdict_comparison.png)

---

## 13. 5-Fold Cross-Validation (Production Model)

| Metric | Mean | Std |
|--------|------|-----|
| MAPE | 14.54% | ±0.96% |
| R² | 0.886 | — |

> CV MAPE (14.54%) is slightly higher than test MAPE (13.53%) — expected since CV uses all splits averaged. The low std (±0.96%) indicates stable performance across folds.

---

## 14. All Available Plots Reference

### Notebook 05 — XGBoost/LightGBM Quantile (`models/plots_05_xgboost_lgbm_quantile/`)

| Plot | Description |
|------|-------------|
| `best_splits_xgboost_price_egp.png` | Top-2 splits by R² and MAE (XGBoost, raw target) |
| `best_splits_xgboost_price_egp_log.png` | Same, log target |
| `best_splits_lightgbm_price_egp.png` | Top-2 splits (LightGBM, raw target) |
| `best_splits_lightgbm_price_egp_log.png` | Same, log target |
| `interval_width_dist.png` | CI width histogram |
| `make_price_tier_heatmap.png` | MAPE by make × tier |
| `optuna_convergence.png` | Tuning trajectory over 100 trials |
| `optuna_param_importance.png` | Which hyperparameters matter most |
| `price_tier_metrics.png` | R²/MAPE by tier |
| `quantile_bands.png` | Lower/median/upper bands over price range |
| `radar_comparison.png` | XGB vs LGBM radar chart |
| `residual_analysis.png` | Residual plots |
| `segmented_mape.png` | MAPE by segment |
| `shap_beeswarm.png` | Feature impact direction |
| `shap_summary.png` | Feature importance bar |
| `shap_waterfall_0.png` | Individual explanation #1 |
| `shap_waterfall_1.png` | Individual explanation #2 |
| `shap_waterfall_2.png` | Individual explanation #3 |
| `shap_xgb_summary.png` | XGBoost-specific SHAP |

### Notebook 06 — Ensemble Experiments (`models/plots_06_ensemble_experiments/`)

| Plot | Description |
|------|-------------|
| `ape_histograms.png` | Absolute % error distribution per method |
| `ensemble_comparison.png` | MAPE/R²/Within±10% bars across methods |
| `final_verdict_comparison.png` | Promotion decision visualization |
| `heatmap_tier_method.png` | MAPE by tier × method heatmap |
| `interval_bands.png` | CI bands for all methods |
| `ladder_all_metrics.png` | Full metric ladder ranking |
| `make_mape_heatmap.png` | Per-make MAPE heatmap |
| `mape_bucket_analysis.png` | MAPE distribution buckets |
| `per_make_mape_all_methods.png` | Make-level comparison across methods |
| `per_make_mape_delta_vs_xgb.png` | Improvement over XGBoost per make |
| `per_make_model_mape.png` | Granular MAPE map |
| `per_price_tier_all_methods.png` | Tier × method comparison |
| `pred_vs_actual_all_methods.png` | Scatter for all methods |
| `radar_all_methods.png` | Multi-metric radar |
| `residual_analysis.png` | Residuals for all methods |

---

## 15. Demo Talking Points

### Must Show (5 min)

1. **Live API demo** — `curl /api/v1/predict` with a Toyota Corolla, show price + negotiation range + confidence
2. **Model evolution** — 37% → 15.6% → 13.5% → 12.8% MAPE (dummy → linear → XGBoost → ensemble)
3. **Quantile regression value** — show how lower/median/upper gives negotiation range, not just one number
4. **SHAP explanation** — show why a specific car got its price (which features pushed up/down)
5. **Per-make-model confidence** — system knows it's more accurate on Jetour T2 (1.2%) than Chevrolet Avalanche (130%)

### Nice to Show (if time)

6. **5 split strategies** — why stratified-by-price is the right production split (Split C = 34% MAPE!)
7. **Optuna tuning** — 100 trials, automated hyperparameter search, learning_rate and max_depth are most important
8. **Ensemble promotion criteria** — rigorous: must improve ≥0.2% MAPE without degrading R²
9. **Data quality pipeline** — 104 canonicalization, 54 quarantined entries, 0 ambiguous groups
10. **Batch endpoint** — multiple cars at once, partial results on error

### Key Numbers to Memorize

- **12.8% MAPE** — best ensemble accuracy (13.5% for XGBoost alone)
- **0.89 R²** — explains 89% of price variance
- **87.7% coverage** — actual price falls within CI 88% of the time
- **73 makes, 518 models** — market coverage
- **20K listings** — training data size
- **Budget tier MAPE ~22%** — hardest segment; Mid-Range ~10% — sweet spot
