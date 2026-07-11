# Consolidated Report: 07a vs 07b vs 07c vs Current Registry Model

## Scope

This report compares:

- `07a_dataset_baselines.ipynb`
- `07b_feature_engineering_v2_ablation.ipynb`
- `07c_model_v2_training_experiments.ipynb`
- the active registry model from `ml-service/models/model_registry.json`

The comparison uses exported artifacts already written under `ml-service/models/experiments/plan2_plan4/` plus the active registry metadata and diagnostics under `ml-service/models/`.

## Critical Comparison Caveat

The active registry model is **not** a fully apples-to-apples benchmark against the `07x` notebooks.

Registry model context:

- `active_model_id`: `ensemble_robust_average_v1.1.0`
- Source notebook: `notebooks/06_ensemble_experiments.ipynb`
- Data version: `baseline_2026-05-12`
- Target: `price_egp`
- Log target: `False`
- Quantiles: `0.05 / 0.50 / 0.95`
- Architecture note: weighted average XGBoost + LightGBM ensemble

By contrast, `07a`, `07b`, and `07c` are based on:

- Dataset tag: `2026-06-03_008`
- Split: `price_stratified`
- Target: `price_egp_log`

So the registry comparison should be treated as **directional**, not as a final promotion decision by itself.

## Executive Summary

### Best holdout result on the refreshed 07x setup

`07b` is still the strongest reported holdout winner:

- Winner: `plus_make_model_count`
- Framework: `WeightedEnsemble`
- Holdout MAPE: `11.2461%`

### Best model-recipe notebook quality

`07c` is the cleanest and most complete model-selection notebook:

- full-run artifact set,
- distinct 80% and 90% interval evaluation,
- true ensemble CV support,
- holdout and CV make-model diagnostics,
- per-price-tier CV breakdown,
- clearer winner export.

### Best simplicity/performance compromise

If you want one practical choice from the current evidence, `07c` is now the best balance of simplicity and performance: it keeps the V1 feature set, stays very close to the best holdout result, and gives the strongest refreshed full-dataset CV tail behavior.

### Registry takeaway

The active registry model is clearly older and evaluated under a different setup. Its reported MAPE (`12.7750%`) is materially worse than all three `07x` notebook winners, but that alone is not sufficient for promotion because the dataset and target differ.

## Holdout Winner Comparison

| Artifact | Winner | Framework | MAE | RMSE | R² | MAPE% | Within 10% | Within 15% | Coverage 80% | Coverage 90% | Mean width% |
|---------|--------|-----------|-----|------|----|-------|------------|------------|--------------|--------------|-------------|
| `07a` | baseline best | WeightedEnsemble | 150,593.86 | 605,558.62 | 0.8875 | 11.3258 | 61.24% | 76.76% | 85.76% | 85.76% | 61.55% |
| `07b` | `plus_make_model_count` | WeightedEnsemble | **149,547.69** | **598,313.09** | **0.8902** | **11.2461** | 61.60% | **77.00%** | 72.64% | 86.00% | 35.89% |
| `07c` | `ensemble_baseline_5q` | WeightedEnsemble | 151,004.71 | 602,399.19 | 0.8887 | 11.2937 | **61.64%** | 76.88% | 73.52% | **86.52%** | 36.29% |
| Registry | `ensemble_robust_average_v1.1.0` | ensemble | 133,592.68 | 473,138.30 | 0.8880 | 12.7750 | 61.27% | 76.58% | 86.79% | n/a | 77.27% |

## Direct Deltas

### 07b vs 07a

- MAPE improvement: `0.0797` points better
- MAE improvement: `1,046.17` EGP better
- R² improvement: `+0.0027`

Interpretation:

- `07b` proves that `make_model_count` helps, but only modestly.
- The gain is real, yet small enough that the 07b report reasonably rejected Plan 2 features for production complexity reasons.

### 07c vs 07a

- MAPE improvement: `0.0321` points better
- MAE change: `410.85` EGP worse
- R² improvement: `+0.0012`

Interpretation:

- `07c` improves slightly over the trusted V1 baseline without changing the feature surface.
- The gain is too small to claim a major modeling breakthrough.

### 07c vs 07b

- MAPE change: `0.0476` points worse
- MAE change: `1,457.02` EGP worse
- R² change: `-0.0015`

Interpretation:

- `07c` does not beat the best 07b ablation.
- `07c` is better viewed as validation and packaging of the V1 model recipe than as a replacement for the 07b accuracy winner.

### 07x winners vs registry

Reported MAPE gaps versus the active registry model:

- `07a` better by `1.4492` points
- `07b` better by `1.5289` points
- `07c` better by `1.4813` points

Interpretation:

- The newer 07x experiment line looks clearly stronger than the old registry setup on reported metrics.
- Because the data version and target differ, the right next step is a controlled re-evaluation on the same split and target, not direct promotion from this table alone.

## Per-Price-Tier CV View for 07c

From `per_tier_cv_metrics__ensemble_baseline_5q.csv`:

| Tier | n | MAPE% | MAE | R² | Within 10% | Within 15% |
|------|---:|------:|----:|---:|-----------:|-----------:|
| Economy (`< 500K`) | 4,438 | 15.7613 | 37,883.87 | 0.6386 | 50.72% | 66.56% |
| Standard (`500K-1.5M`) | 4,877 | 8.9359 | 77,296.90 | 0.7262 | 70.27% | 85.05% |
| Luxury (`1.5M-4M`) | 2,319 | 9.9896 | 238,435.20 | 0.6631 | 66.84% | 81.80% |
| Ultra-luxury (`> 4M`) | 864 | 12.9542 | 957,366.14 | 0.6280 | 56.94% | 72.34% |

Interpretation:

- The per-tier row counts sum to `12,498`, matching the full-dataset CV run exactly.
- Standard and Luxury are the strongest segments and both stay below the Plan 4 target of `< 10%` MAPE.
- Ultra-luxury remains acceptable on relative error (`12.9542%` MAPE) even though its absolute MAE is necessarily large due to price scale.
- Economy is still the main weak segment at `15.7613%`, narrowly missing the `< 15%` target and confirming where future work should focus.
- This segmentation view supports the broader `07c` recommendation: the untuned 5-quantile ensemble is stable overall, but segment-specific gains are still most needed in lower-price vehicles.

## Per-Make-Model Threshold Comparison

### Holdout diagnostics

| Artifact | Groups | >15% MAPE | >20% MAPE | >50% MAPE |
|---------|--------|-----------|-----------|-----------|
| `07a` holdout | 160 | 36 (`22.50%`) | **14 (`8.75%`)** | 0 (`0.00%`) |
| `07b` holdout | 160 | **34 (`21.25%`)** | 16 (`10.00%`) | 0 (`0.00%`) |
| `07c` holdout | 160 | 35 (`21.875%`) | 15 (`9.375%`) | 0 (`0.00%`) |
| Registry diagnostics | 218 | 61 (`27.98%`) | 34 (`15.60%`) | 3 (`1.38%`) |

Interpretation:

- All three `07x` notebooks are materially better than the current registry diagnostics on the high-MAPE tail.
- `07b` gives the best `>15%` holdout tail compression.
- `07a` gives the best `>20%` holdout tail compression.
- `07c` lands between them and keeps the tail controlled with zero `>50%` holdout groups.

### Cross-validation diagnostics

| Artifact | Groups | >15% MAPE | >20% MAPE | >50% MAPE |
|---------|--------|-----------|-----------|-----------|
| `07a` CV | 441 | 147 (`33.33%`) | 86 (`19.50%`) | 6 (`1.36%`) |
| `07b` CV | 441 | 147 (`33.33%`) | **85 (`19.27%`)** | 6 (`1.36%`) |
| `07c` CV | 441 | 147 (`33.33%`) | **80 (`18.14%`)** | **5 (`1.13%`)** |
| Registry diagnostics | 218 | 61 (`27.98%`) | 34 (`15.60%`) | 3 (`1.38%`) |

Interpretation:

- `07c` now has the best refreshed CV tail behavior on the fully comparable `441`-group denominator.
- `07c` matches `07a` and `07b` on `>15%`, improves on both at `>20%`, and improves on both at `>50%`.
- The registry diagnostics remain directionally useful, but they are not directly comparable CV outputs because they come from a different dataset/target setup.

## What Each Notebook Proved

### 07a: stable V1 baseline

What it established:

- The refreshed dataset and `price_stratified` split support a strong V1 baseline.
- WeightedEnsemble is the best default framework.
- Baseline CV MAPE around `12%` is already good.

Strengths:

- simplest trustworthy reference point,
- clean production story,
- low pipeline complexity.

Weaknesses:

- 3-quantile setup causes `Coverage_80_pct` and `Coverage_90_pct` to collapse to the same value,
- original CV used a single-framework approximation,
- less complete interval and export diagnostics than later notebooks.

### 07b: feature ablation decision notebook

What it established:

- `make_model_count` is the only Plan 2 feature that consistently helped.
- The gain is real but small.
- WeightedEnsemble still dominates individual frameworks.

Strengths:

- strongest holdout winner,
- most informative feature-level decision notebook,
- 5-quantile coverage fix makes interval diagnostics more meaningful.

Weaknesses:

- production value of the extra feature engineering is marginal,
- original CV logic fell back to XGBoost instead of a true ensemble,
- adds training and inference lookup complexity for a small gain.

### 07c: model-recipe refinement and full diagnostics notebook

What it established:

- On the V1 feature set, a simple 5-quantile ensemble remains the safest model choice.
- Tuning and sample weighting did not outperform the untuned ensemble shortlist winner.
- True ensemble CV can be supported and exported cleanly.

Strengths:

- most complete validation and export story,
- true ensemble CV support,
- better notebook structure for review and downstream reporting,
- best refreshed comparable CV tail behavior,
- best `Coverage_90_pct` among the 07x winners.

Weaknesses:

- does not beat the `07b` feature winner,
- gains vs `07a` are tiny,
- tuned and weighted variants did not justify their added complexity.

## Recommendations

### Production recommendation today

If you are choosing purely from the current 07x evidence:

- **Accuracy winner:** `07b` (`plus_make_model_count`) by a small margin.
- **Simplicity winner:** `07c`.
- **Current best practical recommendation:** use `07c` as the default next model candidate because it has nearly the best holdout MAPE, the best comparable CV tail behavior, no added feature-engineering dependency, and the strongest validation/export story.

### Promotion recommendation

Do **not** promote against the current registry model from this report alone.

Instead:

1. Re-score the active registry model on the `2026-06-03_008` / `price_stratified` / `price_egp_log` setup.
2. Re-score the `07c` winner and, if desired, the `07b` winner on the exact same evaluation harness.
3. Compare not only overall MAPE, but also per-make-model tail behavior and interval calibration.

### Recommended next experiments

1. Add calibration analysis for the 5-quantile intervals.
2. Focus future improvements on hard low-sample make-model groups rather than broader hyperparameter search.
3. If you revisit Plan 2 features, test whether `make_model_count` can be added with minimal pipeline surface area.
4. Re-run the final candidate comparison against the registry model on a fully matched dataset/target harness.

## Bottom Line

- **07a** gave you the trusted baseline.
- **07b** showed that Plan 2 features help only a little, with `make_model_count` as the only clearly useful feature.
- **07c** gave you the best notebook structure, the best validation/export story, and a strong V1-model recipe that is nearly tied with the best earlier results.
- **Registry** is older and clearly weaker on reported metrics, but it still needs a same-data comparison before any replacement decision is finalized.
