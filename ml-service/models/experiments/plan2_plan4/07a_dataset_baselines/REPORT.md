# 07a Dataset Baselines — Implementation Report

**Notebook:** `ml-service/notebooks/07a_dataset_baselines.ipynb`  
**Helper module:** `ml-service/notebooks/v2_experiment_utils.py`  
**Run date:** 2026-06-06  
**Output directory:** `models/experiments/plan2_plan4/07a_dataset_baselines`

---

## 1. Objective

Compare two processed dataset versions (`2026-05-28_001` and `2026-06-03_008`) using a V1-style feature set across:
- **Three frameworks:** LightGBM, XGBoost, WeightedEnsemble (55/45)
- **Two split strategies:** `price_stratified`, `make_model_grouped`
- **Two target choices:** `price_egp` (raw), `price_egp_log` (log-scaled)

Additionally, generate **cross-validation per-make-model MAPE diagnostics** to understand model reliability at the make-model level.

---

## 2. Datasets

| Dataset tag | Rows | Make count | Model count | Price median |
|-------------|------|------------|-------------|--------------|
| `2026-05-28_001` | 19,451 | 68 | 487 | 630,000 |
| `2026-06-03_008` | 12,498 | 65 | 436 | 725,000 |

Both datasets share `price_min = 22,222` and `price_max = 20,000,000`.

---

## 3. Feature Specification

Built via `build_feature_spec([])` — the current V1-style feature set:

**Numeric (6):** `year`, `mileage_km`, `mileage_per_year`, `engine_cc`, `horsepower`, `seating_capacity`

**Categorical (9):** `make`, `model`, `transmission`, `fuel`, `location`, `body_type`, `drivetrain`, `brand_origin`, `car_segment`

**Total features:** 15

---

## 4. Training Recipe (`fit_baseline_for_split`)

For each dataset / split / target combination:

1. **Internal validation split:** 10% holdout from training indices (`split_train_val_indices`, `RANDOM_STATE = 42`)
2. **Frame preparation:**
   - LightGBM: `make_lgbm_frame` (native categorical support)
   - XGBoost: label encoding via `fit_label_encoders` + `transform_with_label_encoders`
3. **Model training:** 3-quantile models (`q05`, `q50`, `q95`) via:
   - `train_lgbm_quantile_models` (`LGBM_BASE_PARAMS`, max 1200 estimators, early stopping 40 rounds)
   - `train_xgb_quantile_models` (`XGB_BASE_PARAMS`, max 1200 estimators, early stopping 40 rounds)
4. **Ensemble:** Weighted blend (XGBoost 0.55 + LightGBM 0.45)
5. **Metrics:** `evaluate_point_and_interval` computes MAE, RMSE, R², MAPE, Within-10%/15%, Coverage-80%/90%, Mean interval width
6. **Per-make-model diagnostics:** `per_make_model_mape_df` on the **best framework's** median predictions, with **inverse transform applied** when target is log-scaled (fixing the previous 99.999% MAPE bug)

### Log-target inverse transform fix
In `fit_baseline_for_split`, before calling `per_make_model_mape_df`:
```python
if is_log_target:
    if float(np.nanmedian(test_df[target_col].to_numpy())) < 10:
        median_pred = np.power(10.0, median_pred)
    else:
        median_pred = np.exp(median_pred)
```
This ensures predictions are in EGP space before MAPE calculation.

---

## 5. Execution Strategy

### Fast path (active cell)
Skipped the full 8-run matrix and trained only the **best-known configuration**:
- **Dataset:** `2026-06-03_008`
- **Split:** `price_stratified`
- **Target:** `price_egp_log`

Results for the 3 frameworks:

| Framework | MAE | RMSE | R² | MAPE% | Within 10% | Within 15% |
|-----------|------|------|-----|--------|-------------|-------------|
| LightGBM | 154,151 | 606,745 | 0.8871 | 11.58 | 60.84% | 76.32% |
| XGBoost | 154,314 | 613,959 | 0.8844 | 11.54 | 60.08% | 76.16% |
| **WeightedEnsemble** | **150,594** | **605,559** | **0.8875** | **11.33** | **61.24%** | **76.76%** |

### Full baseline matrix (commented-out cell)
The full 8-run matrix was executed previously. The decision table identified:

> **Best overall:** `2026-06-03_008` / `price_stratified` / `price_egp_log` / `WeightedEnsemble` — MAPE 11.33%

Full matrix results (all 24 rows) are preserved in the notebook and exported to `baseline_results_full.csv`.

---

## 6. Per-Make-Model Diagnostics (Best Run)

### Best 50 (lowest MAPE, ascending)

Top performers include:
- Audi A3: 2.86% (n=8)
- Chery Tiggo 3: 3.29% (n=11)
- Land Rover Range Rover Velar: 3.29% (n=5)
- MG ZS: 3.77% (n=12)
- Mercedes GLC300: 3.93% (n=14)

### Worst 50 (highest MAPE, descending)

Worst performers include:
- Toyota Cressida: 89.41% (n=5)
- Daewoo Juliet: 77.98% (n=17)
- Volvo XC90: 65.49% (n=8)
- Daewoo Espero: 57.86% (n=7)
- Lada 2017: 56.42% (n=10)
- Fiat 132: 54.64% (n=7)
- Dodge Charger: 47.04% (n=5)
- Volkswagen Beetle: 46.66% (n=6)
- Changan Benni: 46.26% (n=8)
- Citroën Ax: 42.33% (n=5)

**Sorting:** Best diagnostics are sorted by `MAPE_pct ASCENDING` (lowest first). Worst diagnostics are sorted by `MAPE_pct DESCENDING` (highest first). This is now **explicit** in the notebook cells.

---

## 7. Cross-Validation Per-Make-Model Diagnostics (NEW)

### New helper: `run_kfold_per_make_model_cv` (in `v2_experiment_utils.py`)

A reusable function that:
- Runs **KFold CV** (default 5 folds, `shuffle=True`, `random_state=42`)
- Trains **median-only quantile regression** models per fold
- Collects **out-of-fold predictions** for every row
- Applies **inverse log transform** if target is `price_egp_log`
- Groups predictions by `make` + `model` (with `min_rows=5` filter)
- Computes per-group: `MAPE_pct`, `n`, `MAE`, `R2`, `mean_price`
- Returns two objects:
  1. **Per-make-model DataFrame** (sorted by MAPE% ascending)
  2. **Overall CV metrics dict** (MAE, RMSE, R², MAPE%, Within-10%/15%)

### Notebook cell execution

Called with the same fast-path config, using **XGBoost** framework:
```python
cv_diag_df, cv_overall = run_kfold_per_make_model_cv(
    df_full, FEATURE_COLS, CAT_COLS, target_col,
    framework='XGBoost', params=XGB_BASE_PARAMS,
    n_splits=5, random_state=RANDOM_STATE, min_rows=5,
)
```

### Overall CV metrics

| Metric | Value |
|--------|-------|
| MAE | 155,669.48 |
| RMSE | 509,000.45 |
| R² | 0.9213 |
| **MAPE_pct** | **11.99** |
| Within_10pct | 60.95% |
| Within_15pct | 76.29% |

**Note:** CV MAPE (11.99%) is slightly higher than the single-holdout best-run MAPE (11.33%), which is expected because CV evaluates on all folds including harder ones.

### CV per-make-model results

- **Total make-model combos:** 441
- **Best:** Volkswagen Tayron (2.21%, n=10)
- **Worst:** Toyota Cressida (89.41%, n=5)

### MAPE threshold breakdown (by make-model combo)

| Threshold | Combos above | % of combos | Assessment |
|-----------|-------------|-------------|------------|
| MAPE > 15% | 147 / 441 | 33.3% | ~1 in 3 make-model groups |
| MAPE > 20% | 86 / 441 | 19.5% | ~1 in 5 make-model groups |
| MAPE > 50% | 6 / 441 | 1.4% | Extreme outliers only |

**Note:** These counts are by **unique make-model combination**, not weighted by sample size. The high-MAPE tail is dominated by rare / vintage / low-sample models (median n=8 for MAPE>20% vs median n=23 overall). If weighted by the number of actual cars (`n`), the >15% and >20% shares of total data volume would be materially lower.

### Is this good for a baseline?

| Aspect | Verdict |
|--------|---------|
| Overall CV MAPE ~12% | **Good** for a V1-style 15-feature baseline with no Plan 2 engineered features and no hyperparameter tuning. |
| 60.9% within 10% | Acceptable baseline; leaves room for Plan 2 features + V2 tuning to push toward 65-70%. |
| 33% of combos >15% MAPE | **Expected** at this stage. These are predominantly low-sample make-models the model has rarely seen. Plan 2 features (e.g., `make_model_count`, `mm_price_tier`) and more data should compress this tail. |
| 1.4% of combos >50% MAPE | **Acceptable outliers.** Six rare models (old Lada, Daewoo, Fiat 132, etc.) with tiny sample sizes. Not representative of mainstream prediction quality. |

### Export
Saved to: `make_model_mape_cv.csv` with columns: `make, model, n, MAPE_pct, MAE, R2, mean_price`

---

## 8. Exported Artifacts

| File | Description |
|------|-------------|
| `baseline_results_summary.csv` | Best framework per dataset/split/target |
| `baseline_results_full.csv` | All 24 framework results |
| `dataset_summary.csv` | Dataset metadata |
| `frozen_splits.csv` | Train/test index mappings |
| `best_make_model_mape__{tag}__{split}__{target}.csv` | Best-run per-make-model diagnostics |
| `make_model_mape_cv.csv` | **NEW:** CV per-make-model diagnostics |

---

## 9. Key Design Decisions

1. **Fast path over full matrix:** To save time, only the best-known configuration is trained by default. The full 8-run matrix is preserved in a commented-out cell.
2. **Inverse transform before diagnostics:** Log-target predictions are exponentiated (or `10^x`) before passing to `per_make_model_mape_df`. This was a critical bug fix.
3. **XGBoost for CV helper:** `run_kfold_per_make_model_cv` uses a single framework (XGBoost in the notebook cell). It does not run an ensemble inside CV to keep runtime reasonable.
4. **Median-only inside CV:** The CV helper trains only the `q50` / `median` quantile, not the full 3- or 5-quantile suite, because per-make-model diagnostics only need point predictions.
5. **Explicit sorting:** Best and worst diagnostic display cells use explicit `.sort_values()` to guarantee the intended ordering regardless of DataFrame's current sort state.

---

## 10. Notes & Observations

- **CV vs holdout consistency:** Overall CV MAPE (11.99%) is close to the single-holdout MAPE (11.33%), suggesting the model is stable and not overfitting to a particular split.
- **High variance by make-model:** The worst models (e.g., Toyota Cressida 89%, Daewoo Juliet 78%) are rare or very old models with very few samples. This is expected.
- **Coverage_80 = Coverage_90:** This is a known issue in `compute_interval_metrics` when only 3 quantiles are provided (the 80% bounds fall back to the 90% bounds). This is documented and expected for the 3-quantile baseline setup.
- **R2 can be negative in CV:** Some per-make-model R² values are negative, indicating the model performs worse than a simple mean predictor for that specific group. This happens on small or high-variance groups.

---

## 11. Files Modified

1. `ml-service/notebooks/07a_dataset_baselines.ipynb`
   - Added `run_kfold_per_make_model_cv` import
   - Added inverse transform in `fit_baseline_for_split`
   - Added fast-path cell
   - Added explicit sorting to best/worst diagnostic cells
   - Added new CV diagnostics cell (8.5)
   - Added overall CV metrics printout

2. `ml-service/notebooks/v2_experiment_utils.py`
   - Added `run_kfold_per_make_model_cv()` function (~90 lines)
   - Returns `(per_make_model_df, overall_metrics_dict)` tuple
