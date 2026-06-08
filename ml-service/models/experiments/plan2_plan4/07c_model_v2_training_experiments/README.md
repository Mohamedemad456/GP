# 07c Model V2 Training Experiments

## Purpose

`07c_model_v2_training_experiments.ipynb` is the model-selection notebook for the V2 training stage on the refreshed full dataset.

Its role is to answer a narrower question than `07a` and `07b`:

- Keep the final feature set aligned with the chosen production-safe baseline.
- Compare model recipes rather than dataset versions or feature ladders.
- Evaluate whether tuning, sample weighting, and richer quantile outputs improve the final ensemble enough to justify extra complexity.

This notebook now reflects the intended full-run setup:

- Dataset tag: `2026-06-03_008`
- Split: `price_stratified`
- Target: `price_egp_log`
- Features: V1 feature set only
- Quantiles: 5-quantile setup for distinct 80% and 90% interval diagnostics
- Shortlist: XGBoost, LightGBM, and WeightedEnsemble variants

## What This Notebook Does

The notebook performs five jobs:

1. Rebuilds the full-dataset training/evaluation frame and reconstructs the `price_stratified` split.
2. Reintroduces a baseline reference so `07c` can be compared back to the `07a` winner.
3. Runs a compact experiment ladder focused on model recipe changes rather than feature changes.
4. Evaluates the shortlist on holdout and cross-validation, including per-make-model diagnostics.
5. Exports machine-readable artifacts for downstream review and reporting.

## Final Selected Recipe

The exported winner is:

- `best_experiment_name`: `ensemble_baseline_5q`
- `best_framework`: `WeightedEnsemble`
- `best_quantile_count`: `5`
- `uses_sample_weights`: `False`
- `uses_tuned_params`: `False`

From `selected_v2_recipe.csv`:

| Field | Value |
|------|-------|
| Dataset | `2026-06-03_008` |
| Split | `price_stratified` |
| Target | `price_egp_log` |
| Features | `year,mileage_km,mileage_per_year,engine_cc,horsepower,seating_capacity,make,model,transmission,fuel,location,body_type,drivetrain,brand_origin,car_segment` |
| Winner | `ensemble_baseline_5q` |
| Framework | `WeightedEnsemble` |
| Quantiles | `5` |
| Sample weighting | `False` |
| Tuned params | `False` |

## Experiment Shortlist and Holdout Results

From `v2_experiment_shortlist.csv`:

| Experiment | Framework | Weights | Tuned | Quantiles | MAE | RMSE | R² | MAPE% | Within 10% | Within 15% | Coverage 80% | Coverage 90% | Mean width% |
|-----------|-----------|---------|-------|-----------|-----|------|----|-------|------------|------------|--------------|--------------|-------------|
| `ensemble_baseline_5q` | WeightedEnsemble | No | No | 5 | 151,004.71 | 602,399.19 | 0.8887 | **11.2937** | 61.64% | 76.88% | 73.52% | 86.52% | 36.29% |
| `ensemble_tuned_5q` | WeightedEnsemble | No | Yes | 5 | 153,625.63 | 608,655.62 | 0.8864 | 11.4448 | 61.28% | 76.80% | 74.04% | 86.48% | 35.33% |
| `xgb_tuned_weighted_5q` | XGBoost | Yes | Yes | 5 | 160,613.75 | 631,653.55 | 0.8776 | 11.6137 | 60.04% | 75.00% | 69.68% | 85.40% | 33.57% |

## Interpretation of the Shortlist

The most important outcome is that the simplest shortlisted ensemble won.

- `ensemble_baseline_5q` beat the tuned ensemble by about `0.1511` MAPE points.
- `ensemble_baseline_5q` beat the weighted+tuned XGBoost variant by about `0.3200` MAPE points.
- The notebook did **not** find evidence that extra tuning or price-based sample weighting materially improved the V1 feature recipe.

That matters because it suggests the primary gains on the refreshed dataset come from:

- better data,
- stable V1 features,
- ensemble blending,
- and richer diagnostics,

not from more aggressive optimization.

## Cross-Validation Result

From `cv_overall_metrics.csv`:

| Metric | Value |
|--------|-------|
| MAE | 154,040.74 |
| RMSE | 505,786.37 |
| R² | 0.9223 |
| MAPE% | **11.8329** |
| Within 10% | 61.77% |
| Within 15% | 77.00% |

This CV result is directionally consistent with the holdout winner:

- Holdout MAPE: `11.2937%`
- CV MAPE: `11.8329%`

The CV value is higher, which is expected, but still close enough to show the model family is broadly stable rather than exploiting a single favorable split.

This refreshed CV run now uses the **full reconstructed dataset** (`12,498` rows) for fair comparison with `07a` and `07b`, so the per-make-model denominator is aligned again.

## Per-Price-Tier CV Metrics

From `per_tier_cv_metrics__ensemble_baseline_5q.csv`:

| Tier | n | MAPE% | MAE | R² | Within 10% | Within 15% |
|------|---:|------:|----:|---:|-----------:|-----------:|
| Economy (`< 500K`) | 4,438 | 15.7613 | 37,883.87 | 0.6386 | 50.72% | 66.56% |
| Standard (`500K-1.5M`) | 4,877 | 8.9359 | 77,296.90 | 0.7262 | 70.27% | 85.05% |
| Luxury (`1.5M-4M`) | 2,319 | 9.9896 | 238,435.20 | 0.6631 | 66.84% | 81.80% |
| Ultra-luxury (`> 4M`) | 864 | 12.9542 | 957,366.14 | 0.6280 | 56.94% | 72.34% |

Interpretation:

- The tier counts sum to `12,498`, matching the full CV dataset exactly.
- The tier-weighted MAPE is consistent with the overall CV MAPE (`11.8329%`), so the breakdown is internally coherent.
- Standard and Luxury both hit the Plan 4 per-tier target of `< 10%` MAPE.
- Ultra-luxury stays within the relaxed `< 15%` target despite the smallest sample count and largest absolute errors.
- Economy remains the hardest segment at `15.7613%`, narrowly missing the `< 15%` target and confirming that lower-price vehicles are still the main weakness area.

## Per-Make-Model Diagnostics

### Holdout threshold breakdown

From `best_make_model_mape__ensemble_baseline_5q.csv`:

| Threshold | Count | Share |
|-----------|-------|-------|
| `MAPE > 15%` | 35 / 160 | `21.875%` |
| `MAPE > 20%` | 15 / 160 | `9.375%` |
| `MAPE > 50%` | 0 / 160 | `0.000%` |

Observed range:

- Best group MAPE: `3.2440%`
- Worst group MAPE: `43.7698%`

### Cross-validation threshold breakdown

From `cv_per_make_model_diagnostics.csv`:

| Threshold | Count | Share |
|-----------|-------|-------|
| `MAPE > 15%` | 147 / 441 | `33.3333%` |
| `MAPE > 20%` | 80 / 441 | `18.1406%` |
| `MAPE > 50%` | 5 / 441 | `1.1338%` |

Observed range:

- Best group MAPE: `2.7854%`
- Worst group MAPE: `82.9102%`

## How 07c Compares to 07a and 07b

### Against 07a baseline

`07a` best holdout:

- Framework: `WeightedEnsemble`
- MAPE: `11.3258%`

`07c` best holdout:

- Framework: `WeightedEnsemble`
- MAPE: `11.2937%`

Difference:

- `07c` improves on `07a` by about `0.0321` MAPE points.

This is a real but very small gain. In practice, `07c` should be interpreted as a tighter validation and reporting notebook rather than a major accuracy breakthrough over `07a`.

### Against 07b winner

`07b` best holdout:

- Ablation: `plus_make_model_count`
- Framework: `WeightedEnsemble`
- MAPE: `11.2461%`

Difference:

- `07c` trails the `07b` winner by about `0.0476` MAPE points.

So the final `07c` result does **not** overturn the `07b` conclusion that `make_model_count` was the strongest Plan 2 engineered signal on this dataset. What `07c` shows is that once the feature decision is separated from the model-recipe decision, the untuned 5-quantile ensemble remains the safest model choice.

## Why This Notebook Is Valuable Even Without a Big MAPE Jump

`07c` adds value in notebook quality and decision confidence:

- It validates the shortlist on the full dataset rather than toy-mode artifacts.
- It uses 5 quantiles, so 80% and 90% interval metrics are now distinct and interpretable.
- It exports both holdout and CV diagnostics in a form that can be reused by downstream reporting.
- It now supports true ensemble CV rather than silently collapsing back to a single model family.
- It makes best/worst make-model diagnostics available for both holdout and CV views.

## Important Fixes Reflected in the Current Version

The current notebook and helper module include the key fixes needed for reliable full-run outputs:

- LightGBM tuning calls now pass `cat_cols` correctly.
- Ensemble blending uses the current `blend_prediction_maps` API.
- Cross-validation supports true `WeightedEnsemble` behavior by training both XGBoost and LightGBM per fold and blending their predictions.
- CV diagnostics now expose best and worst make-model slices explicitly.
- The experiment ladder has been reduced to a focused shortlist instead of mixing too many orthogonal choices.

## Artifacts Produced by This Notebook

| File | Purpose |
|------|---------|
| `v2_experiment_results_full.csv` | Full result table for all shortlisted V2 experiments |
| `v2_experiment_shortlist.csv` | Ranked shortlist summary |
| `selected_v2_recipe.csv` | Machine-readable winner metadata |
| `best_make_model_mape__ensemble_baseline_5q.csv` | Holdout make-model MAPE diagnostics for the winner |
| `best_make_model_r2__ensemble_baseline_5q.csv` | Holdout make-model R² diagnostics |
| `cv_overall_metrics.csv` | Overall 5-fold CV metrics for the selected recipe |
| `cv_per_make_model_diagnostics.csv` | Make-model CV diagnostics |
| `per_tier_cv_metrics__ensemble_baseline_5q.csv` | Full-dataset CV metrics broken out by price tier |
| `oof_median_preds__ensemble_baseline_5q.csv` | Cached out-of-fold median predictions used to compute tier metrics |
| `v2_shortlist_cv_results.csv` | Fold-level shortlist CV outputs |

## Quality Assessment

### What is strong

- The notebook now has a clear purpose and a tight experiment scope.
- Exported artifacts are sufficient for downstream comparison and audit.
- The winning recipe is easy to explain and does not depend on fragile tuning gains.
- Interval evaluation is much more trustworthy than the 3-quantile baseline setup.

### What is still limited

- The gains versus `07a` are small.
- The notebook does not establish a new dominant winner over `07b`.
- The tuned and weighted variants underperformed, so the search space may still be too shallow or simply not useful for this feature set.

## Recommendation

Treat `07c` as:

- the best-documented model-recipe notebook in the `07x` sequence,
- a strong validation of the 5-quantile ensemble setup,
- a fair-comparison CV reference against `07a` and `07b`,
- and a good source of reusable diagnostics/export artifacts.

Do **not** treat it as conclusive evidence that tuning or sample weighting should be added to production.

If you need a single practical default from the current `07x` line, `07c` is now the strongest choice when you balance:

- near-best holdout accuracy,
- the best fully comparable CV tail behavior,
- no extra feature-engineering dependency,
- and the cleanest validation/export story.

`07b` still remains the narrow holdout-accuracy winner, but only by a very small margin (`0.0476` MAPE points) and with added feature complexity.

If you continue from here, the most valuable next steps are:

1. Compare the `07c` winner and the active registry model on the **same** dataset/split/target.
2. Add calibration analysis for the 5-quantile intervals.
3. Focus future improvements on difficult low-sample make-model groups rather than more generic hyperparameter search.
