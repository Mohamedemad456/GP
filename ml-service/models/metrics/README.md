# Model Metrics Folder

This folder contains evaluation metrics CSVs. JSON model metadata (registered via the model registry) lives in `../metadata/`.

| File | Description | Source |
|------|-------------|--------|
| `make_model_mape_cv.csv` | **Complete** per-make-model MAPE (5-fold CV + test), all combos, no minimum threshold. Used by production confidence / negotiation range. | Notebook 06b (new) |
| `make_model_mape.csv` | Test-set-only per-make-model MAPE, filtered to >=5 test rows. Kept for reference / backwards compatibility. | Notebook 06b (existing) |
| `per_make_metrics.csv` | Per-brand aggregated metrics (MAE, RMSE, R², MAPE%, n, coverage%). | Notebook 05/06 |
| `per_make_model_metrics.csv` | Per-make-model metrics including coverage%, same data as make_model_mape but with extra columns. | Notebook 05/06 |
| `per_make_model_metrics_filtered.csv` | Same as above but excluding outlier combos with MAPE > 50%. | Notebook 05/06 |
| `per_tier_metrics.csv` | Per-price-tier metrics (Budget, Mid-Range, Premium, Luxury). | Notebook 05/06 |
| `per_tier_metrics_filtered.csv` | Per-tier metrics after removing outlier combos. | Notebook 05/06 |
| `per_tier_all_models.csv` | Per-tier comparison across all trained models. | Notebook 05/06 |
| `per_tier_all_models_filtered.csv` | Filtered per-tier comparison. | Notebook 05/06 |
