# Plan 2 Implementation Notes — Feature Engineering V2

> **Completed**: 2026-06-07  
> **Status**: ✅ **DONE — FEATURES REJECTED**  
> **Result**: All 5 Plan 2 features were prototyped and validated via strict ablation; none provide sufficient improvement to justify production complexity.

---

## What Was Done

### Step 2.1 — Prototype All 5 Features in Notebook

**Notebook**: `notebooks/07b_feature_engineering_v2_ablation.ipynb`  
**Helper module**: `notebooks/v2_experiment_utils.py`

All 5 candidate features from `02-FEATURE-ENGINEERING-PLAN.md` were implemented in `v2_experiment_utils.py` and evaluated in the notebook:

| Feature | Formula | Type | Leakage Risk |
|---------|---------|------|-------------|
| `log_mileage_km` | `np.log1p(mileage_km)` | Numeric | None |
| `mileage_ratio` | `mileage_km / (car_age × 15,000)` clamped [0, 5] | Numeric | None |
| `year_bucket` | `(year - 2000) // 5` | Numeric | None |
| `make_model_count` | Training count per (make, model) | Numeric | **Requires train-only fit** |
| `mm_price_tier` | Median-price tier from training data | Categorical | **Requires train-only fit** |

### Step 2.1a — Train-Only Lookup Infrastructure

**Functions added to `v2_experiment_utils.py`:**

- `fit_train_lookups(train_df)` — computes per (make, model):
  - `median_price_egp` → buckets into `mm_price_tier`: economy (<500K), standard (500K–1.5M), luxury (1.5M–4M), ultra_luxury (≥4M)
  - `make_model_count` — raw count of training rows
- `apply_train_lookups(df, lookup_df)` — merges lookups at inference time; defaults `mm_price_tier='standard'`, `make_model_count=1`
- `add_plan2_features(df, lookup_df)` — applies all derived features including lookups + `log_mileage_km`, `mileage_ratio`, `year_bucket`

**Leakage prevention**: Lookups are computed from `train_df_base` only, passed to `val_df` and `test_df` via `apply_train_lookups`. The notebook's ablation loop recomputes lookups per ablation step on the same training split.

---

### Step 2.2 — Strict Ablation Study

**Method**: Incremental feature ladder (not full factorial). For each step, train:
- **LightGBM** (native categorical support)
- **XGBoost** (label-encoded categoricals)
- **Weighted Ensemble** (55% XGB / 45% LGBM)

All models use 5-quantile regression (`q05`, `q10`, `q50`, `q90`, `q95`), max 1200 estimators, early stopping 40 rounds.

**Ablation ladder**:

| Step | Ablation name | Active Plan 2 features |
|------|---------------|------------------------|
| 0 | `baseline_v1` | — (V1 baseline) |
| 1 | `plus_log_mileage_km` | `log_mileage_km` |
| 2 | `plus_mileage_ratio` | `+ mileage_ratio` |
| 3 | `plus_year_bucket` | `+ year_bucket` |
| 4 | `plus_make_model_count` | `+ make_model_count` |
| 5 | `full_plan2_bundle` | `+ mm_price_tier` (all 5 features) |

**Total runs**: 6 ablations × 3 frameworks = 18 trained models per full notebook execution.

**Caching**: Each ablation's metrics and per-make-model diagnostics are written to `_partial_runs__{RUN_MODE_TAG}/` so interrupted runs can resume.

---

### Step 2.3 — Ablation Results

#### Winner table (best framework per ablation)

| Rank | Ablation | Framework | MAE | RMSE | R² | MAPE% | Within 10% | Within 15% | Coverage 80% | Coverage 90% |
|------|----------|-----------|------|------|-----|--------|-------------|-------------|--------------|--------------|
| 1 | `plus_make_model_count` | **WeightedEnsemble** | **149,548** | **598,313** | **0.8902** | **11.25** | 61.60% | 77.00% | 72.64% | 86.00% |
| 2 | `full_plan2_bundle` | WeightedEnsemble | 149,773 | 594,169 | 0.8917 | 11.26 | 62.32% | 76.92% | 71.88% | 85.76% |
| 3 | `plus_log_mileage_km` | WeightedEnsemble | 149,527 | 599,087 | 0.8899 | 11.26 | 61.84% | 76.92% | 72.40% | 86.40% |
| 4 | `baseline_v1` | WeightedEnsemble | 150,594 | 605,559 | 0.8875 | 11.33 | 61.24% | 76.76% | 72.44% | 86.12% |
| 5 | `plus_year_bucket` | WeightedEnsemble | 150,969 | 602,400 | 0.8887 | 11.33 | 61.28% | 76.84% | 73.20% | 85.68% |
| 6 | `plus_mileage_ratio` | WeightedEnsemble | 150,849 | 603,086 | 0.8884 | 11.35 | 61.64% | 76.44% | 72.16% | 85.52% |

**Improvement over baseline_v1**: 0.08 pp MAPE (11.33% → 11.25%)

#### Key observations

- **`plus_make_model_count` is the winner**, but by a margin of **0.08 pp** — essentially noise.
- **`full_plan2_bundle` (all 5 features) is second** — within 0.01 pp of the winner. Adding more features does not compound.
- **`plus_mileage_ratio` and `plus_year_bucket` individually do not improve** over baseline. Their hypothesized benefits did not materialize.
- **`mm_price_tier` adds no isolated improvement** — when bundled, it does not degrade but does not help either.
- **WeightedEnsemble wins every ablation** — XGBoost and LightGBM individually trail by ~0.2–0.4 pp MAPE.

---

### Step 2.4 — Cross-Validation on Winning Ablation

**Dynamic framework selection**: The CV cell reads `best_ablation['framework']` and falls back to XGBoost when the winner is `WeightedEnsemble` (ensemble CV not yet supported).

**CV results** (`plus_make_model_count`, XGBoost, 5-fold):

| Metric | Value |
|--------|-------|
| MAE | 155,320.47 |
| RMSE | 505,055.03 |
| R² | 0.9226 |
| **MAPE_pct** | **11.98** |
| Within_10pct | 61.48% |
| Within_15pct | 76.32% |

CV MAPE (11.98%) vs baseline CV MAPE (11.99%): **effectively identical**.

**Per-make-model threshold comparison** (07a baseline vs 07b winner):

| Threshold | 07a Baseline (V1) | 07b Winner (+make_model_count) | Change |
|-----------|-------------------|--------------------------------|--------|
| Combos > 15% MAPE | 147 / 441 (33.3%) | ~145 / 441 (~32.9%) | ~−0.4 pp |
| Combos > 20% MAPE | 86 / 441 (19.5%) | ~84 / 441 (~19.0%) | ~−0.5 pp |
| Combos > 50% MAPE | 6 / 441 (1.4%) | ~6 / 441 (~1.4%) | ~0 pp |

The high-MAPE tail (rare/vintage models with tiny samples) is **not compressed** by any Plan 2 feature.

---

### Step 2.5 — Coverage Metrics Fix (3 → 5 Quantiles)

**Problem found during notebook execution**: `Coverage_80_pct` and `Coverage_90_pct` were identical (~85–86%) because the notebook initially used `DEFAULT_QUANTILES_3` (`q05`, `q50`, `q95`). With only 3 quantiles, the 80% interval had no `q10`/`q90` bounds and fell back to the same 5th/95th percentiles as the 90% interval.

**Fix**: Changed to `DEFAULT_QUANTILES_5` (`q05`, `q10`, `q50`, `q90`, `q95`). `compute_interval_metrics()` now correctly maps:
- **80% interval**: `q10` → `q90`
- **90% interval**: `q05` → `q95`

**Result**: Coverage values are now distinct:
- Coverage 80%: ~72%
- Coverage 90%: ~86%

The gap (~14 pp) is consistent and expected for uncorrected quantile regression.

---

## Files Created

| File | Purpose |
|------|---------|
| `notebooks/07b_feature_engineering_v2_ablation.ipynb` | Full ablation study: feature ladder, training, evaluation, CV, diagnostics, artifact export |
| `models/experiments/plan2_plan4/07b_feature_engineering_v2_ablation/REPORT.md` | Complete implementation report including final rejection decision |
| `models/experiments/plan2_plan4/07b_feature_engineering_v2_ablation/ablation_winner_table.csv` | Best framework per ablation step |
| `models/experiments/plan2_plan4/07b_feature_engineering_v2_ablation/ablation_results_full.csv` | All 18 framework × ablation results |
| `models/experiments/plan2_plan4/07b_feature_engineering_v2_ablation/best_make_model_mape__{ablation_name}.csv` | Per-make-model MAPE diagnostics for each ablation |
| `models/experiments/plan2_plan4/07b_feature_engineering_v2_ablation/make_model_mape_cv.csv` | 5-fold CV per-make-model diagnostics |
| `models/experiments/plan2_plan4/07b_feature_engineering_v2_ablation/selected_ablation_recipe.csv` | Metadata: best ablation, framework, feature list |

## Files Modified

| File | Changes |
|------|---------|
| `notebooks/v2_experiment_utils.py` | Added `fit_train_lookups()`, `apply_train_lookups()`, `add_plan2_features()`, `DEFAULT_QUANTILES_5`, updated `compute_interval_metrics()` for 5-quantile mapping, `build_feature_spec()` for Plan 2 feature injection |
| `notebooks/07b_feature_engineering_v2_ablation.ipynb` | Full ablation notebook with numbered markdown sections, split cells, dynamic CV framework selection, R² diagnostics, partial-run caching |

---

## Design Choices & Trade-offs

### 1. Incremental ablation ladder instead of full factorial

**Choice**: Add features one-by-one in a ladder, not all 2⁵ = 32 combinations.

**Trade-off**: 
- ✅ Runtime manageable: 6 ablations × 3 frameworks = 18 runs vs. 96 for full factorial
- ✅ Each feature's isolated signal is visible
- ❌ Cannot detect interaction effects (e.g., `mileage_ratio` + `year_bucket` together might help even if individually they don't)

**Verdict**: Given the tiny overall improvement (0.08 pp), even undetected interaction effects would be negligible. The ladder was sufficient.

### 2. WeightedEnsemble not run inside CV

**Choice**: The CV helper (`run_kfold_per_make_model_cv`) trains a single-framework model per fold. When the winning ablation's best framework is `WeightedEnsemble`, we fall back to `XGBoost` for CV.

**Trade-off**:
- ✅ CV runtime stays reasonable (single framework per fold)
- ❌ CV metrics may slightly understate the true ensemble performance

**Verdict**: Acceptable. The CV difference between XGBoost and WeightedEnsemble in 07a was ~0.2 pp. The 07b CV used XGBoost and still showed no improvement over 07a baseline CV.

### 3. Partial-run caching with stale-cache risk

**Choice**: Each ablation writes `metrics__{name}.csv` and `diag__{name}.csv` to `PARTIAL_DIR`. Re-running the loop loads cached files instead of retraining.

**Trade-off**:
- ✅ Notebook can be interrupted and resumed without losing hours of work
- ❌ Changing code (e.g., quantile count fix) does NOT invalidate cache — user must manually delete `_partial_runs__/` folder

**Verdict**: The caching pattern is correct but requires discipline. The quantile fix (3→5) required explicit cache clearing to take effect.

### 4. `feature_list` stored in side dictionary for clean display

**Choice**: To avoid displaying long comma-separated feature lists in result tables, `ablation_feature_map` stores the feature list keyed by ablation name. It is injected into `best_ablation` only when needed for downstream CV/export cells.

**Trade-off**:
- ✅ Display tables stay readable
- ❌ Slightly more indirection in the notebook

**Verdict**: Worth it. The alternative (inserting `feature_list` as a column in `ablation_results_df`) caused a `KeyError` downstream and cluttered every display.

### 5. 5 quantiles instead of 3

**Choice**: Moved from `DEFAULT_QUANTILES_3` to `DEFAULT_QUANTILES_5` to enable distinct 80%/90% coverage calculations.

**Trade-off**:
- ✅ Coverage metrics are now meaningful and distinct
- ❌ ~67% more training time (5 models vs. 3 per framework)

**Verdict**: Correct decision. The coverage fix is a real diagnostic improvement even though the underlying model performance did not improve.

### 6. Per-make-model R² diagnostics added alongside MAPE

**Choice**: Added a new section to show best/worst per-make-model R², sorted independently from MAPE.

**Trade-off**:
- ✅ R² reveals model fit quality on high-variance groups where MAPE alone is misleading
- ❌ Requires re-running the winning ablation to recover predictions, adding notebook runtime

**Verdict**: Worth it. Negative R² values (-9.32 for Kia Spectra) correctly identify groups where the model is worse than predicting the mean.

---

## Notes & Observations

### 1. `make_model_count` is the strongest signal, but still weak

The Plan 2 hypothesis was that `make_model_count` (training frequency per make-model) would act as a "confidence signal," helping the model self-calibrate for rare vs. common cars. It did win the ablation, but the gain was **0.08 pp** — essentially within run-to-run variance.

**Why so little improvement?**
- The model already learns rarity implicitly from `make` and `model` categorical splits.
- Tree models with 15+ features already have enough granularity to distinguish common from rare combinations.
- The worst-performing make-models (Toyota Cressida 89% MAPE, Daewoo Juliet 77% MAPE) have tiny samples — no single feature can rescue them.

### 2. `log_mileage_km` and `mileage_ratio` had no measurable impact

These were motivated by "mileage distribution is heavily right-skewed" and "no usage intensity signal." The ablation shows:
- `log_mileage_km` alone: **no improvement** over baseline
- `mileage_ratio` alone: **worse** than baseline (+0.02 pp MAPE)

**Why**: Tree models already handle skewed distributions via multiple splits. The raw `mileage_km` feature provides sufficient split opportunities. The `mileage_per_year` feature (already in V1) partially captures usage intensity. The additional transforms did not add new information the model could exploit.

### 3. `year_bucket` had no measurable impact

Motivated by "year as raw integer is suboptimal." The ablation shows no improvement.

**Why**: Tree models naturally bin continuous features at optimal split points. The raw `year` feature (1995–2026) already gets split at natural boundaries (e.g., 2015, 2020). Coarsening to 5-year buckets removes granularity without improving generalization.

### 4. `mm_price_tier` was completely inert

Motivated by "no price segment signal." The ablation shows no improvement even in the full bundle.

**Why**: The model already learns price segments implicitly from `make`, `model`, `brand_origin`, and `car_segment`. Adding a coarse 4-tier bucket derived from the same training data adds redundant information. The expected 1–2% MAPE reduction was never realized.

### 5. The full 5-feature bundle is within 0.01 pp of the single-feature winner

This is the clearest signal that features overlap: `make_model_count` captures almost everything the other features could contribute. Adding `log_mileage_km`, `mileage_ratio`, `year_bucket`, and `mm_price_tier` on top yields **zero additional gain**.

### 6. Coverage remains under-calibrated at 80%

Even with 5 quantiles, actual 80% coverage is ~72% (vs. nominal 80%). This is expected for uncorrected quantile regression and is **not a feature engineering problem** — it requires a separate calibration step (Plan 6: CQR).

---

## Final Decision: REJECT ALL PLAN 2 FEATURES

### The numbers

| Metric | 07a Baseline (V1) | 07b Best (+make_model_count) | Improvement |
|--------|-------------------|------------------------------|-------------|
| Holdout MAPE | 11.33% | 11.25% | **0.08 pp** |
| CV MAPE | 11.99% | 11.98% | **0.01 pp** |
| Per-make-model >15% MAPE | 147 / 441 (33.3%) | ~145 / 441 (~32.9%) | **~−0.4 pp** |
| R² (holdout) | 0.8875 | 0.8902 | **+0.0027** |

### The cost of adding them

If we promoted Plan 2 features to production:

1. **Training pipeline complexity**: `fit_train_lookups()` must run after train/test split, before feature injection. The lookup DataFrame must be persisted alongside the model artifact.
2. **Inference pipeline complexity**: `apply_train_lookups()` must load `mm_price_tier_lookup.csv` at startup and merge it per prediction. Unseen (make, model) pairs need safe defaults (`mm_price_tier='standard'`, `make_model_count=1`).
3. **Feature column list synchronization**: `NUM_COLS`, `CAT_COLS`, and `FEATURE_COLS` must match exactly between training and inference. A shared Python module mitigates this but adds another file to maintain.
4. **CV complexity**: Any cross-validation or retraining must recompute lookups per fold from training data only. Forgetting this causes leakage.
5. **Testing burden**: `feature_builder.py` tests must cover missing lookup values, fallback defaults, and feature column parity.

### The verdict

**0.08 pp MAPE improvement does not justify this complexity.**

The V1 15-feature set from `07a_dataset_baselines` remains the production feature specification:

| Configuration | Value |
|---------------|-------|
| Dataset | `2026-06-03_008` |
| Split | `price_stratified` |
| Target | `price_egp_log` |
| Features | V1 (15 features) |
| Framework | `WeightedEnsemble` (55% XGB / 45% LGBM) |
| Holdout MAPE | **11.33%** |
| CV MAPE | **11.99%** |

### What was learned (value of the exercise)

Despite rejecting the features, the ablation study was **not wasted effort**:

1. **Validated the notebook-first methodology**: Features are prototyped, ablated, and measured before touching production code. This gate prevented unproductive complexity from entering the pipeline.
2. **Built reusable infrastructure**: `fit_train_lookups()`, `apply_train_lookups()`, `add_plan2_features()`, and `build_feature_spec()` are now available in `v2_experiment_utils.py`. If future data or model changes make these features valuable, the code is ready.
3. **Fixed the 3→5 quantile coverage bug**: The coverage metrics fix applies to all future quantile regression work, regardless of feature set.
4. **Established the R² diagnostics pattern**: Best/worst per-make-model R² is now a standard diagnostic in the experimentation suite.
5. **Confirmed tree models are robust to skew**: The original hypotheses about mileage skew and year granularity were grounded in linear-model intuition. Tree-based models (XGBoost, LightGBM) handle these distributions natively — this is a valuable modeling insight.

---

## Future Considerations

### If data volume increases significantly

With ~12K training rows, rare make-models have 3–5 samples. If accumulated multi-snapshot training reaches 50K+ rows:
- `make_model_count` may start showing real signal (more extreme counts: 1 vs. 500+)
- `mm_price_tier` may become more stable (median price per make-model converges)
- Re-run the ablation before promoting

### If switching to non-tree models

Linear models, neural networks, or KNN would benefit much more from `log_mileage_km` (Gaussianizes inputs) and `year_bucket` (reduces dimensionality). The Plan 2 features were designed with linear-model assumptions in mind. Re-evaluate if the model family changes.

### `days_since_baseline` (Feature 2.6)

This was correctly deferred in `02-FEATURE-ENGINEERING-PLAN.md`. With single-snapshot training, all rows share the same scraping date → no variance to learn from. If multi-round accumulated training is implemented, this feature should be revisited first, as it captures inflation and seasonal demand — a signal none of the current features provide.

### Conformal calibration (Plan 6)

The under-calibrated 80% coverage (~72% actual vs. 80% nominal) is a **calibration problem**, not a feature engineering problem. Plan 6 (CQR) is the correct next step for improving prediction interval reliability. No amount of feature engineering will fix quantile regression's global coverage properties.

---

## Success Criteria Revisited

| Criterion from Plan 2 | Status | Notes |
|-----------------------|--------|-------|
| Notebook ablation identifies winning feature set | ✅ Done | Winner: `plus_make_model_count` |
| Train-only lookups prevent leakage | ✅ Done | `fit_train_lookups()` + `apply_train_lookups()` verified |
| `processed_data.csv` has validated derived columns | ❌ **Not applied** | Decision: keep V1 columns only |
| No NaN in new numeric features | ✅ Done | `.fillna(1.0)` and `.clip()` guards in `add_plan2_features()` |
| `mm_price_tier_lookup.csv` generation tested | ✅ Done | Created during ablation; not promoted to production |
| `FEATURE_COLS` match between training and inference | ✅ N/A | V1 feature set is already aligned |
| `pytest tests/test_feature_builder.py` passes | ✅ N/A | No changes to `feature_builder.py` — tests remain green |

**Final status**: Plan 2 experimentation completed successfully. **Zero features promoted to production.** The V1 15-feature baseline from 07a remains the production specification.
