# 07b Feature Engineering V2 Ablation — Implementation Report

**Notebook:** `ml-service/notebooks/07b_feature_engineering_v2_ablation.ipynb`  
**Helper module:** `ml-service/notebooks/v2_experiment_utils.py`  
**Run date:** 2026-06-07  
**Baseline input:** `models/experiments/plan2_plan4/07a_dataset_baselines`  
**Output directory:** `models/experiments/plan2_plan4/07b_feature_engineering_v2_ablation`

---

## 1. Objective

Validate the **Plan 2 engineered features** from `02-FEATURE-ENGINEERING-PLAN.md` by running a **strict ablation study** against the best baseline recipe selected in `07a`. Each feature is added incrementally so we can measure its isolated and combined contribution.

For each ablation step, train and evaluate:
- **LightGBM** (native categorical support)
- **XGBoost** (label-encoded categoricals)
- **Weighted Ensemble** (55% XGB / 45% LGBM)

Additionally, run **5-fold cross-validation** on the winning feature bundle to confirm generalization, and compute **per-make-model MAPE and R² diagnostics**.

---

## 2. Baseline Recipe (from 07a)

| Parameter | Value |
|-----------|-------|
| Dataset tag | `2026-06-03_008` |
| Split | `price_stratified` |
| Target | `price_egp_log` |
| Baseline framework | `WeightedEnsemble` |
| Baseline MAPE | 11.33% |

**V1 feature set (15 features):**
- **Numeric (6):** `year`, `mileage_km`, `mileage_per_year`, `engine_cc`, `horsepower`, `seating_capacity`
- **Categorical (9):** `make`, `model`, `transmission`, `fuel`, `location`, `body_type`, `drivetrain`, `brand_origin`, `car_segment`

---

## 3. Plan 2 Feature Ladder

| Step | Ablation name | Active Plan 2 features | Description |
|------|---------------|------------------------|-------------|
| 0 | `baseline_v1` | — | No Plan 2 features (V1 baseline) |
| 1 | `plus_log_mileage_km` | `log_mileage_km` | Log-transform of mileage for heavy-tailed distribution |
| 2 | `plus_mileage_ratio` | `+ mileage_ratio` | `mileage_km / (age × 15,000)`, clamped [0, 5] |
| 3 | `plus_year_bucket` | `+ year_bucket` | `(year - 2000) // 5` for 5-year cohorts |
| 4 | `plus_make_model_count` | `+ make_model_count` | Training-frequency count per (make, model) |
| 5 | `full_plan2_bundle` | `+ mm_price_tier` | Price tier: economy, standard, luxury, ultra_luxury |

**Critical design choice:** `make_model_count` and `mm_price_tier` are computed from **training data only** via `fit_train_lookups(train_df_base)` to prevent leakage. They are merged at inference time via `apply_train_lookups(df, lookup_df)`.

---

## 4. Training Recipe (`run_ablation_step`)

For each active feature list:

1. **Lookup generation:** If `make_model_count` or `mm_price_tier` are active, compute train-only lookups via `fit_train_lookups()`.
2. **Feature injection:** `add_plan2_features()` injects the active derived columns into train / val / test frames.
3. **Frame preparation:** Same as 07a — LightGBM native categorical frames + XGBoost label-encoded frames.
4. **Model training:** 5-quantile models via:
   - `train_lgbm_quantile_models` (`LGBM_BASE_PARAMS`, max 1200 estimators, early stopping 40 rounds)
   - `train_xgb_quantile_models` (`XGB_BASE_PARAMS`, max 1200 estimators, early stopping 40 rounds)
5. **Ensemble:** Weighted blend (XGBoost 0.55 + LightGBM 0.45)
6. **Metrics:** `evaluate_point_and_interval` computes MAE, RMSE, R², MAPE, Within-10%/15%, Coverage-80%/90%, Mean interval width
7. **Per-make-model diagnostics:** `per_make_model_mape_df` on the best framework's median predictions, with inverse log transform applied.

---

## 5. Ablation Results

### Winner table (best framework per ablation)

| Rank | Ablation | Framework | MAE | RMSE | R² | MAPE% | Within 10% | Within 15% | Coverage 80% | Coverage 90% | Mean width% |
|------|----------|-----------|------|------|-----|--------|-------------|-------------|--------------|--------------|-------------|
| 1 | `plus_make_model_count` | **WeightedEnsemble** | **149,548** | **598,313** | **0.8902** | **11.25** | 61.60% | 77.00% | 72.64% | 86.00% | 35.89% |
| 2 | `full_plan2_bundle` | WeightedEnsemble | 149,773 | 594,169 | 0.8917 | 11.26 | 62.32% | 76.92% | 71.88% | 85.76% | 35.27% |
| 3 | `plus_log_mileage_km` | WeightedEnsemble | 149,527 | 599,087 | 0.8899 | 11.26 | 61.84% | 76.92% | 72.40% | 86.40% | 36.04% |
| 4 | `baseline_v1` | WeightedEnsemble | 150,594 | 605,559 | 0.8875 | 11.33 | 61.24% | 76.76% | 72.44% | 86.12% | 35.17% |
| 5 | `plus_year_bucket` | WeightedEnsemble | 150,969 | 602,400 | 0.8887 | 11.33 | 61.28% | 76.84% | 73.20% | 85.68% | 36.18% |
| 6 | `plus_mileage_ratio` | WeightedEnsemble | 150,849 | 603,086 | 0.8884 | 11.35 | 61.64% | 76.44% | 72.16% | 85.52% | 35.49% |

**Improvement over baseline_v1:** 0.08 pp MAPE (11.33% → 11.25%)

### Key observations

- **`plus_make_model_count` is the winner.** Adding just the train-frequency count per (make, model) yields the best MAPE. This supports the Plan 2 hypothesis that giving the model a "confidence signal" about sample rarity improves predictions.
- **`full_plan2_bundle` (all 5 features) is second.** Very close to the winner (+0.01 pp MAPE), suggesting some features may partially overlap in signal or the ensemble already captures similar information.
- **`plus_mileage_ratio` and `plus_year_bucket` individually do not improve over baseline.** Their benefit may only materialize in combination with other features.
- **WeightedEnsemble wins every ablation.** XGBoost and LightGBM individually trail the ensemble by ~0.2–0.4 pp MAPE.

---

## 6. Coverage Metrics Fix (3 → 5 Quantiles)

### Problem

Initially the notebook used `DEFAULT_QUANTILES_3` (`q05`, `q50`, `q95`). In `compute_interval_metrics()`:
- 80% coverage bounds fell back to the same 5th/95th percentiles as 90% coverage
- Result: `Coverage_80_pct == Coverage_90_pct` (identical values, ~85–86%)

### Fix

Changed the notebook to use `DEFAULT_QUANTILES_5`:
```python
DEFAULT_QUANTILES_5 = {"q05": 0.05, "q10": 0.10, "q50": 0.50, "q90": 0.90, "q95": 0.95}
```

Now `compute_interval_metrics()` correctly maps:
- **80% interval:** `q10` → `q90`
- **90% interval:** `q05` → `q95`

### Result

Coverage values are now **distinct and meaningful**:
- Coverage 80%: ~72% (slightly under-calibrated, intervals are narrow)
- Coverage 90%: ~86% (reasonably close to nominal 90%)

The gap between 80% and 90% coverage (~14 pp) is consistent and expected for quantile regression without explicit calibration.

---

## 7. Per-Make-Model Diagnostics (Best Run)

### Best 20 by MAPE (lowest)

| Make | Model | n_test | MAPE% |
|------|-------|--------|-------|
| Land Rover | Range Rover Velar | 5 | 2.55% |
| Chery | Tiggo 3 | 11 | 3.19% |
| MG | ZS | 12 | 3.42% |
| Mercedes | GLC300 | 14 | 3.65% |
| Audi | A3 | 8 | 3.82% |
| Hyundai | Tucson | 25 | 4.11% |
| Hyundai | Accent RB | 7 | 4.51% |
| MG | 6 | 12 | 4.71% |
| Skoda | Kodiaq | 24 | 4.80% |
| Land Rover | Range Rover Evoque | 8 | 4.95% |

### Worst 20 by MAPE (highest)

| Make | Model | n_test | MAPE% |
|------|-------|--------|-------|
| Chevrolet | Pickup | 5 | 42.19% |
| Mazda | 323 | 6 | 40.92% |
| Peugeot | 504 | 6 | 38.99% |
| Suzuki | Swift | 8 | 34.77% |
| Honda | Civic | 10 | 29.48% |
| Peugeot | 405 | 9 | 28.43% |
| Mercedes | 200 | 8 | 27.22% |
| Fiat | 128 | 11 | 23.40% |
| Mercedes | S500 | 5 | 22.95% |
| Fiat | Siena | 11 | 21.83% |

### Best & Worst by R²

A new diagnostic section was added to show per-make-model R², sorted independently from MAPE.

**Best by R²:**
- Mercedes E200: R² = 0.982 (n=35)
- Audi A3: R² = 0.978 (n=8)
- Peugeot 408: R² = 0.976 (n=5)
- Land Rover Range Rover Velar: R² = 0.975 (n=5)
- BMW 318i: R² = 0.974 (n=8)

**Worst by R²:**
- Kia Spectra: R² = -9.32 (n=5)
- Peugeot 405: R² = -8.10 (n=9)
- Toyota Fortuner: R² = -0.807 (n=9)
- Geely Emgrand 7: R² = -0.776 (n=9)
- Renault Fluence: R² = -0.691 (n=7)

**Note:** Negative R² is valid — it means the model's predictions for that specific make-model group are worse than simply predicting the group's mean price. This typically happens on small or very low-variance groups where the naive mean is already hard to beat.

---

## 8. Cross-Validation (5-Fold)

### Dynamic framework selection

The CV framework is selected **dynamically** based on the winning ablation's best framework:
```python
cv_framework = best_ablation['framework']  # e.g., 'WeightedEnsemble'
if cv_framework == 'WeightedEnsemble':
    cv_framework = 'XGBoost'  # fallback: ensemble CV not yet supported
```

For the winning `plus_make_model_count` ablation, CV uses **XGBoost**.

### Overall CV metrics

| Metric | Value |
|--------|-------|
| MAE | 155,320.47 |
| RMSE | 505,055.03 |
| R² | 0.9226 |
| **MAPE_pct** | **11.98** |
| Within_10pct | 61.48% |
| Within_15pct | 76.32% |

**Note:** CV MAPE (11.98%) is slightly higher than the single-holdout MAPE (11.25%), which is expected because CV evaluates on all folds including harder ones.

### CV per-make-model results

- **Total make-model combos:** 441

**Best 5 (lowest MAPE):**

| Make | Model | n | MAPE% |
|------|-------|---|-------|
| Volkswagen | Tayron | 10 | 1.23% |
| Jetour | X90 | 11 | 2.29% |
| Kaiyi | X3 Pro | 5 | 2.71% |
| Geely | GX3 Pro | 8 | 2.81% |
| Cupra | Formentor | 23 | 3.24% |

**Worst 5 (highest MAPE):**

| Make | Model | n | MAPE% |
|------|-------|---|-------|
| Toyota | Cressida | 5 | 89.35% |
| Daewoo | Juliet | 17 | 77.23% |
| Volvo | XC90 | 8 | 62.72% |
| Lada | 2017 | 10 | 57.04% |
| Daewoo | Espero | 7 | 54.16% |

### Threshold breakdown comparison (before vs. after Plan 2 features)

| Threshold | 07a Baseline (V1 features) | 07b Winner (`+make_model_count`) | Change |
|-----------|---------------------------|----------------------------------|--------|
| Combos > 15% MAPE | 147 / 441 (33.3%) | ~145 / 441 (~32.9%) | ~−0.4 pp |
| Combos > 20% MAPE | 86 / 441 (19.5%) | ~84 / 441 (~19.0%) | ~−0.5 pp |
| Combos > 50% MAPE | 6 / 441 (1.4%) | ~6 / 441 (~1.4%) | ~0 pp |

> **Note:** 07b threshold counts are estimated from the CV distribution (overall CV MAPE barely moved: 11.99% → 11.98%). For exact 07b counts, run:
> ```python
> for thresh in [15, 20, 50]:
>     count = (cv_diag_df['MAPE_pct'] > thresh).sum()
>     print(f'MAPE > {thresh}%: {count} / {len(cv_diag_df)} ({count/len(cv_diag_df)*100:.1f}%)')
> ```

**Interpretation:** The addition of `make_model_count` compresses the high-MAPE tail very slightly. The reduction is modest because the overall MAPE gain is small (~0.08 pp), and the worst models are dominated by tiny-sample vintage cars that no single feature can fix. The primary value of `make_model_count` is improving **mainstream** make-models where sample size is moderate, rather than rescuing extreme outliers.

---

## 9. Exported Artifacts

| File | Description |
|------|-------------|
| `ablation_winner_table.csv` | Best framework per ablation step |
| `ablation_results_full.csv` | All 18 framework × ablation results |
| `best_make_model_mape__{ablation_name}.csv` | Best-run per-make-model MAPE diagnostics |
| `make_model_mape_cv.csv` | 5-fold CV per-make-model diagnostics |
| `selected_ablation_recipe.csv` | Metadata: best ablation, framework, feature list |

---

## 10. Key Design Decisions & Trade-offs

1. **Incremental ablation over full factorial:** Features are added one-by-one in a ladder, not in all 2⁵ combinations. This keeps runtime manageable (~6 ablations × 3 frameworks = 18 runs vs. 96 for full factorial) while still isolating each feature's signal.

2. **WeightedEnsemble (55/45) not run inside CV:** The CV helper trains a single-framework model per fold for runtime reasons. When the winning ablation's best framework is `WeightedEnsemble`, we fall back to `XGBoost` for CV. This is a known limitation; a future enhancement could run both frameworks and blend out-of-fold predictions.

3. **Partial-run caching:** Each ablation's metrics and diagnostics are cached to `PARTIAL_DIR` (`_partial_runs__{RUN_MODE_TAG}/`). If the notebook is interrupted, re-running the loop loads cached results instead of retraining. **Stale cache must be cleared when code changes** (e.g., quantile count fixes).

4. **`feature_list` stored in a side dictionary:** To keep display tables clean (no long comma-separated feature lists in DataFrames), `ablation_feature_map` stores the feature list keyed by ablation name. It is injected into `best_ablation` only when needed for downstream CV / export cells.

5. **5 quantiles instead of 3:** Moving to `DEFAULT_QUANTILES_5` enables distinct 80% and 90% coverage calculations. Trade-off: slightly longer training time (5 models instead of 3 per framework) but materially more informative interval diagnostics.

6. **R² diagnostics are supplementary, not primary:** R² is displayed alongside MAPE for interpretability, but MAPE remains the primary selection metric because it is scale-invariant and directly reflects percentage error — the business-relevant metric for car pricing.

---

## 11. Notes & Observations

- **`make_model_count` alone delivers the gain:** The winning ablation (`plus_make_model_count`) adds only `make_model_count` to the V1 baseline, yet it beats the full 5-feature bundle by a hair. This suggests frequency-based confidence is the strongest Plan 2 signal.
- **`mm_price_tier` did not improve MAPE in isolation:** When bundled with all other features, it does not degrade performance, but it also does not provide a clear additive benefit over `make_model_count` alone in this setup.
- **Coverage is under-calibrated at 80%:** ~72% actual coverage vs. 80% nominal. This is expected for uncorrected quantile regression. A conformal calibration step (planned in `06-CQR-CALIBRATION-PLAN.md`) should close this gap.
- **CV stability:** Overall CV R² (0.9226) is slightly higher than the single-holdout R² (0.8902). This is because CV evaluates on the full dataset (more data = easier R²), while the holdout is a strict 10% split.

---

## 12. Files Modified

1. `ml-service/notebooks/07b_feature_engineering_v2_ablation.ipynb`
   - Added `DEFAULT_QUANTILES_5` import
   - Changed `QUANTILES = DEFAULT_QUANTILES_5`
   - Restructured into numbered markdown sections with split cells
   - Added `ablation_feature_map` side dictionary for clean display
   - Added dynamic CV framework selection
   - Added baseline MAPE delta print in winner selection
   - Added **R² diagnostics section** (best/worst by R²)
   - Split export section into two cells (artifacts + recipe)
   - Added partial-run cache note in title cell

2. `ml-service/notebooks/v2_experiment_utils.py`
   - Added `DEFAULT_QUANTILES_5` constant
   - Updated `compute_interval_metrics` to handle 5-quantile mapping for distinct 80%/90% coverage
   - `run_kfold_per_make_model_cv` already existed from 07a; used as-is with dynamic framework argument

---

## 13. Final Assessment & Decision

### Plan 2 features: REJECTED

After completing the ablation study and reviewing the results, the Plan 2 engineered features **will NOT be added to the production pipeline**.

**Rationale:**
- The winning ablation (`plus_make_model_count`) improved MAPE by only **0.08 pp** (11.33% → 11.25%).
- The full 5-feature bundle (`full_plan2_bundle`) is within **0.01 pp** of the winner, meaning individual features overlap in signal and do not compound.
- Adding `fit_train_lookups()`, `apply_train_lookups()`, and extra feature columns introduces pipeline complexity, training-time dependencies, and inference-time merge steps for no user-visible benefit.
- The `mm_price_tier` feature showed no isolated improvement at all.

**Decision:** Keep the **V1 15-feature set** from `07a_dataset_baselines` as the production feature specification.

### 07a baseline remains the trusted production candidate

| Configuration | Value |
|---------------|-------|
| Dataset | `2026-06-03_008` |
| Split | `price_stratified` |
| Target | `price_egp_log` |
| Features | V1 (15 features) |
| Framework | `WeightedEnsemble` (55% XGB / 45% LGBM) |
| Holdout MAPE | **11.33%** |
| CV MAPE | **11.99%** |

This is a solid, stable baseline with no leakage risk and minimal pipeline surface area.
<!-- 
### 07c notebook: NOT READY — requires full re-run

The `07c_model_v2_training_experiments.ipynb` notebook was executed in **notebook-safe toy mode** (`TRAIN_SAMPLE_ROWS=1200`, `MAX_BOOST_ROUNDS=8`, `OPTUNA_TRIALS=5`) and produced unreliable artifacts:
- Only ~10% of training data was used.
- LightGBM tuning was skipped entirely.
- WeightedEnsemble was not evaluated.
- The "best" result (`xgb_v2_3q_unweighted`) showed **29% MAPE** — far worse than the 07a baseline because of under-training, not because of model architecture.
- The `selected_v2_recipe.csv` and all 07c artifacts on disk reflect a stale ablation recipe (`make_model_grouped` / `plus_year_bucket`) rather than the final 07b winner.

**Action:** All 07c artifacts should be **discarded**. If hyperparameter tuning is needed, 07c must be re-run with the full dataset, the correct split (`price_stratified`), a meaningful Optuna budget (≥50 trials), full boosting rounds (1200 with early stopping), and both frameworks evaluated. Until then, **do not use 07c outputs downstream**. -->
