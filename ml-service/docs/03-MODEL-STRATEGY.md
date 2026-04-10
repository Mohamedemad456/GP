# Model Strategy

## Algorithm Selection

### Primary: LightGBM

| Criterion | LightGBM | XGBoost | CatBoost |
|-----------|----------|---------|----------|
| Training speed | Fastest | Medium | Slowest |
| Categorical handling | Native | Needs encoding | Best native |
| Quantile regression | Built-in | Built-in (slower) | Built-in |
| Memory usage | Lowest | Medium | Highest |
| SHAP support | TreeSHAP | TreeSHAP | Built-in |

**Verdict:** LightGBM gives the fastest iteration cycle (critical with limited timeline) and handles categorical-heavy data natively. Use CatBoost as a comparison if time permits, but do not build an ensemble — single model is cleaner for deployment, explainability, and maintenance.

### Baseline Models (For Comparison)

Always compare against simple baselines. This separates a strong GP from a weak one.

1. **Baseline 1:** Mean price per brand+model group
2. **Baseline 2:** Median price per brand+model+year group
3. **Baseline 3:** Linear regression on numeric features

Expected: LightGBM should beat baselines by 30-50% on MAPE. If it doesn't, something is wrong with features.

---

## Training Strategy

### Data Split

- **80% train / 10% validation / 10% test**
- Stratified on price decile bins to ensure even distribution across price ranges
- Use validation set for early stopping during training
- Use test set for final evaluation only (never during tuning)

**Note:** When 3+ months of data is available, switch to time-based split (train on older, test on newer) to simulate real deployment. With current data (all from Feb 2026), stratified random split is correct.

### Three Quantile Models

Train three separate LightGBM models with `objective='quantile'`:

| Model | Alpha | Output |
|-------|-------|--------|
| Lower | 0.1 | 10th percentile → negotiation floor |
| Median | 0.5 | 50th percentile → fair price (point estimate) |
| Upper | 0.9 | 90th percentile → negotiation ceiling |

The negotiation range [lower, upper] is an 80% prediction interval with no distributional assumptions.

### Hyperparameter Tuning

Use Optuna with 100 trials (~30 minutes). Key parameters to tune:

| Parameter | Search Range | Purpose |
|-----------|-------------|---------|
| learning_rate | 0.01 - 0.3 (log) | Convergence speed vs accuracy |
| num_leaves | 15 - 127 | Model complexity |
| max_depth | 3 - 12 | Tree depth limit |
| min_child_samples | 10 - 100 | Overfitting control for rare groups |
| subsample | 0.5 - 1.0 | Row sampling |
| colsample_bytree | 0.5 - 1.0 | Feature sampling |
| reg_alpha | 1e-8 - 10 (log) | L1 regularization |
| reg_lambda | 1e-8 - 10 (log) | L2 regularization |

Use early stopping (50 rounds) on validation set to prevent overfitting. The best iteration count is determined automatically.

### Cross-Validation

Run 5-fold CV on the median model with best Optuna params to get robust performance estimates with standard deviation. This is your "official" accuracy number for the GP defense.

### Log-Transform Experiment

Try training on `log(price_egp)` vs raw `price_egp`. Car prices are right-skewed, and log-transform often improves MAPE. Compare both approaches on the test set and pick the winner.

---

## Confidence Intervals

### Quality Checks

After training quantile models, verify:

1. **Coverage:** ~80% of test set true values fall within [lower, upper]. If coverage is <70% or >90%, the models are miscalibrated.
2. **Monotonicity:** lower ≤ median ≤ upper for every prediction. If violated, clip post-prediction.
3. **Reasonable width:** Average interval width should be 15-30% of the median prediction. Too narrow = overconfident. Too wide = useless.
4. **No negative predictions:** Clip lower bound to a minimum of 0.

### Confidence Classification

| Confidence | Condition |
|-----------|-----------|
| High | Relative interval width < 15% AND ≥ 20 similar cars in training data |
| Medium | Relative interval width < 30% AND ≥ 5 similar cars |
| Low | Everything else |

"Similar cars" = same brand+model within ±2 years.

---

## Explainability (SHAP)

**SHAP is a must-have, not optional.** Rationale:
- Takes ~1 day to implement (TreeSHAP is fast and integrates natively with LightGBM)
- Dealers want to know WHY a car is priced at X
- Strengthens GP defense significantly — shows depth of understanding
- Doubles as a debugging tool — reveals if the model learned spurious patterns

### What to Generate

**For training reports (notebooks):**
- Global feature importance summary plot
- Dependence plots for top 5 features (car_age, mileage_km, new_car_price_egp, brand, body_type)
- Waterfall plot for example predictions (great for demo)

**For API responses (when `include_factors=True`):**
- Top 5 SHAP contributors for the specific prediction
- Human-readable descriptions: "High mileage (120K km) decreases price" or "Brand (Toyota) increases price"

---

## Evaluation Metrics & Targets

### Realistic Targets

| Metric | Good | Excellent | Notes |
|--------|------|-----------|-------|
| R² | 0.85 - 0.90 | 0.90 - 0.95 | >0.95 is suspicious (possible leakage) |
| MAPE | 10 - 15% | 8 - 12% | Research on similar datasets shows this range |
| MAE | 30K - 60K EGP | 20K - 40K EGP | Depends on average price (~500K) |
| Within ±10% | 60 - 70% | 70 - 80% | Percentage of predictions within 10% of actual |
| Within ±15% | 75 - 85% | 85 - 90% | Best metric for GP defense (most intuitive) |
| CI Coverage | 75 - 85% | 78 - 82% | Should be close to nominal 80% |

### Primary Metric: MAPE

- Scale-independent (works across price ranges)
- Interpretable ("average prediction is off by X%")
- Directly maps to business value

### Segmented Evaluation

Evaluate by brand and by price tier separately. Overall MAPE of 12% might hide 25% error on rare brands. Identify WHERE the model fails, not just overall performance.

### Evaluation Report

Generate a JSON report with all metrics, saved to the model version directory. Include: overall metrics, per-brand breakdown, per-price-tier breakdown, CI calibration stats.

---

## Model Artifacts (Per Version)

Each model version `models/vX.X.X/` contains:

| File | Purpose |
|------|---------|
| model_median.joblib | Point estimate model |
| model_lower.joblib | 10th percentile model |
| model_upper.joblib | 90th percentile model |
| preprocessor.joblib | Feature transformations (ensures train-serve consistency) |
| metadata.json | Metrics, hyperparameters, feature list, training date, sample count using tensor board or any possible way |
| shap_summary.png | Global feature importance plot |

The `model_registry.json` at the root of `models/` points to the active version.

---

## Overfitting Red Flags

| Signal | What It Means | Action |
|--------|--------------|--------|
| Train R² > 0.98, Val R² < 0.88 | Overfitting | Increase regularization, increase min_child_samples |
| Validation loss increases while training loss decreases | Classic overfit | Early stopping should catch this |
| One feature dominates SHAP (e.g., model alone explains 80%) | Feature dominance | Check if it's leaking information |
| Great MAPE on common brands, terrible on rare ones | Insufficient data for rare groups | Group rare models into "Other_{brand}" |
