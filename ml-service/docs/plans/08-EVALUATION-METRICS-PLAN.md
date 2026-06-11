# Plan 8: Evaluation & Metrics Export

> **Recommended Model**: GPT 5.5 (analysis + visualization) + GPT 5.4 (exports)  
> **Dependencies**: Plan 04 (Model Training) must be complete  
> **Blocks**: None (but needed for GP presentation)

---

## Current State & Problems

### Problem 1: Global Metrics Hide Segment-Level Issues
- Global MAPE of 12.78% sounds acceptable
- But per-tier breakdown reveals: Economy 22%, Standard 10%, Luxury 8%
- GP examiners will ask "how does it perform for cheap cars?" — need ready answers
- **Impact**: Misleading presentation if only global metrics shown

### Problem 2: Per-Brand Metrics Include Noisy Brands
- Brands with 3-5 samples have wild MAPE (e.g., Soueast R²=−0.418)
- Including these in "per-brand evaluation" makes the model look bad
- They should be reported separately as "insufficient data" brands
- **Impact**: Unfair evaluation, examiners focus on worst-case numbers

### Problem 3: No V1 vs V2 Comparison
- For GP presentation, the narrative is "we improved the model"
- Need side-by-side comparison showing exactly what improved and by how much
- Need to show it on the SAME test set for fair comparison
- **Impact**: No quantified evidence of improvement

### Problem 4: Coverage Metrics Not Properly Reported
- Current "Coverage 80%" is just "% of test set within raw quantile bounds"
- No distinction between raw quantile coverage vs CQR-calibrated coverage
- No report on interval width vs coverage tradeoff
- **Impact**: Can't demonstrate CQR's value

### Problem 5: No Presentation-Ready Outputs
- Raw metrics in notebooks aren't formatted for slides/papers
- Need clean tables, charts, and JSON exports for the frontend demo
- **Impact**: Extra manual work to prepare GP presentation

---

## Deliverables

### Deliverable 7.1: Evaluation Notebook
**File**: `notebooks/08_v2_evaluation_report.ipynb`

### Deliverable 7.2: Metrics JSON
**File**: `models/metrics/v2_evaluation_summary.json`

### Deliverable 7.3: Per-Tier CSV
**File**: `models/metrics/per_tier_metrics_v2.csv`

### Deliverable 7.4: Per-Brand CSV
**File**: `models/metrics/per_brand_metrics_v2.csv`

### Deliverable 7.5: MAPE Export for Production
**File**: `models/metadata/make_model_mape.csv`

---

## Implementation Steps

### Step 8.1 — Load V2 Model and Test Data
```python
# Load the exact same test set used during training (same random seed, same split)
# This ensures evaluation is on truly unseen data
# Load V1 model predictions on same test set for comparison
```

### Step 8.2 — Compute Global Metrics

| Metric | Formula | V1 Baseline | V2 Target |
|--------|---------|-------------|-----------|
| MAPE | mean(|y-ŷ|/y) × 100 | 12.78% | < 10% |
| MAE | mean(|y-ŷ|) | 133,593 | < 100,000 |
| RMSE | sqrt(mean((y-ŷ)²)) | 473,138 | < 400,000 |
| R² | 1 - SS_res/SS_tot | 0.888 | > 0.92 |
| Within ±10% | % where |y-ŷ|/y < 0.10 | 61.3% | > 70% |
| Within ±15% | % where |y-ŷ|/y < 0.15 | 76.6% | > 85% |

### Step 8.3 — Per-Price-Tier Evaluation

**Tier definitions**:
| Tier | Price Range | Expected % of Data |
|------|-------------|-------------------|
| Economy | < 500K EGP | ~35% |
| Standard | 500K - 1.5M EGP | ~40% |
| Luxury | 1.5M - 4M EGP | ~18% |
| Ultra-luxury | > 4M EGP | ~7% |

**Metrics per tier**: MAPE, MAE, R², Within ±10%, Within ±15%, Coverage 80%, Count

**Output format** (`per_tier_metrics_v2.csv`):
```csv
tier,count,MAPE_pct,MAE,R2,Within_10pct,Within_15pct,Coverage_80_pct
economy,1050,15.2,85000,0.82,55,72,81
standard,1200,9.1,95000,0.91,72,87,83
luxury,540,8.5,180000,0.93,75,89,82
ultra_luxury,210,12.1,650000,0.88,62,78,79
```

### Step 8.4 — Per-Brand Evaluation

**Rules**:
- Only include brands with ≥ 10 test samples
- Report others in a separate "low-sample brands" table
- Highlight: top 5 best-performing, top 5 worst-performing

**Output format** (`per_brand_metrics_v2.csv`):
```csv
make,count,MAPE_pct,MAE,R2,Within_15pct
Toyota,180,8.2,75000,0.94,88
Hyundai,150,9.5,82000,0.92,85
...
Soueast,8,45.2,250000,-0.3,25  # (in separate low-sample table)
```

### Step 8.5 — Coverage & Interval Analysis

**Metrics to compute**:
- Raw quantile coverage (before CQR): % of test samples within [Q10, Q90]
- CQR-calibrated 80% coverage: should be 78-82%
- CQR-calibrated 90% coverage: should be 88-92%
- Mean interval width (as % of fair price)
- Interval width by tier (economy intervals should be wider than luxury)

**Key chart**: Coverage vs Width plot showing the tradeoff

### Step 8.6 — V1 vs V2 Comparison Table

**The money table for GP presentation**:

| Metric | V1 (Ensemble) | V2 (Enhanced) | Improvement |
|--------|---------------|---------------|-------------|
| MAPE | 12.78% | X% | -Y% |
| R² | 0.888 | X | +Y |
| Within ±15% | 76.6% | X% | +Y% |
| Coverage 90% | N/A | X% | NEW |
| Economy MAPE | ~22% | X% | -Y% |
| Interval Width | 77.3% | X% | -Y% |

### Step 8.7 — Visualization Plots

**Charts to generate** (save as PNG in `models/plots_08_v2_evaluation/`):

1. **Predicted vs Actual scatter** — colored by tier
2. **Residual distribution** — histogram, check for normality
3. **MAPE by price tier** — bar chart comparing V1 vs V2
4. **Coverage curve** — coverage % vs interval width at different quantile levels
5. **Per-brand MAPE** — horizontal bar chart (top 20 brands)
6. **SHAP summary plot** — feature importance for V2 model
7. **Prediction interval example** — 5 sample cars with intervals shown

### Step 8.8 — Export for Production

Generate files that the running service loads:

```python
# make_model_mape.csv — used by confidence.py
test_df.groupby(['make', 'model']).apply(
    lambda g: pd.Series({
        'MAPE_pct': np.mean(np.abs((g['y_true'] - g['y_pred']) / g['y_true'])) * 100
    })
).reset_index().to_csv('models/metadata/make_model_mape.csv', index=False)
```

### Step 8.9 — Summary JSON Export

```python
summary = {
    "model_version": "v2.0.0",
    "evaluation_date": "2026-06-XX",
    "test_set_size": len(test_df),
    "global_metrics": {
        "MAPE_pct": ...,
        "MAE": ...,
        "RMSE": ...,
        "R2": ...,
        "Within_10pct": ...,
        "Within_15pct": ...,
    },
    "coverage": {
        "raw_80": ...,
        "cqr_80": ...,
        "cqr_90": ...,
        "mean_width_pct": ...
    },
    "per_tier": {...},
    "improvement_vs_v1": {...},
    "training_info": {
        "n_train": ...,
        "n_calibration": ...,
        "n_test": ...,
        "features_used": 20,
        "quantiles": ["q05", "q10", "median", "q90", "q95"]
    }
}
```

### Step 8.10 — Feature Distribution Drift Monitoring

**File**: `models/metrics/feature_distribution_baseline.json`

Captures the training-time feature distribution so every new snapshot can be
compared against it to detect data drift before retraining.

**What to measure**:

| Feature type | Statistics to record |
|---|---|
| Numeric (`year`, `mileage_km`, `engine_cc`, `horsepower`, `days_since_baseline`) | mean, std, min, max, p5, p25, p50, p75, p95, % NaN |
| Categorical (`make`, `model`, `fuel`, `transmission`, `location`, `body_type`) | top-10 value counts + share, # unique values, % NaN |
| Price (`price_egp`) | full percentile table (p5, p10, ..., p95) + mean, std |

**Drift alerts** (run at each new snapshot before retraining):
```python
def check_drift(new_df, baseline_stats, thresholds):
    """
    Compare new snapshot feature distributions against baseline.
    Returns list of DriftAlert with severity: 'warning' or 'critical'.
    """
    alerts = []

    # Numeric: flag if mean shifts > K standard deviations from baseline
    for col in NUMERIC_COLS:
        z_shift = abs(new_df[col].mean() - baseline_stats[col]['mean']) / baseline_stats[col]['std']
        if z_shift > thresholds['critical_z']:  # default: 2.0
            alerts.append(DriftAlert(col, 'critical', f'mean shifted {z_shift:.1f} std dev'))
        elif z_shift > thresholds['warning_z']:  # default: 1.0
            alerts.append(DriftAlert(col, 'warning', f'mean shifted {z_shift:.1f} std dev'))

    # Categorical: flag if top-1 value share changes by > 10 pct points
    for col in CATEGORICAL_COLS:
        baseline_top = baseline_stats[col]['top_value_share']
        new_top = new_df[col].value_counts(normalize=True).iloc[0]
        if abs(new_top - baseline_top) > thresholds['cat_share_delta']:  # default: 0.10
            alerts.append(DriftAlert(col, 'warning', f'top value share changed by {abs(new_top-baseline_top):.1%}'))

    # New categories not seen in training
    for col in ['make', 'model', 'location']:
        new_cats = set(new_df[col].unique()) - set(baseline_stats[col]['known_values'])
        if new_cats:
            alerts.append(DriftAlert(col, 'info', f'{len(new_cats)} new values: {list(new_cats)[:5]}'))

    return alerts
```

**Baseline storage** (`models/metrics/feature_distribution_baseline.json`):
```json
{
  "created_at": "2026-05-24",
  "data_version": "2026-05-24",
  "n_rows": 20214,
  "features": {
    "mileage_km": {"mean": 82450, "std": 55200, "p50": 72000, "p95": 210000},
    "year":       {"mean": 2018.3, "std": 4.1, "p50": 2019, "p95": 2024},
    "make":       {"top_value": "Toyota", "top_value_share": 0.187, "n_unique": 47, "known_values": [...]},
    "price_egp":  {"mean": 650000, "std": 480000, "p25": 280000, "p50": 490000, "p75": 870000}
  }
}
```

**When to re-baseline**: After each model promotion. The baseline always reflects
the distribution the current production model was trained on.

**Output**: `models/metrics/drift_report_YYYY-MM-DD.json` — generated at each new snapshot,
stored alongside the baseline for audit trail.

---

## GP Presentation Key Numbers

These are the numbers that should appear on your GP slides:

1. **"Our model predicts car prices within ±15% for X% of all cars"** (Within_15pct)
2. **"Model achieves X% MAPE, outperforming V1 by Y percentage points"** (MAPE comparison)
3. **"Prediction intervals guarantee 90% coverage using CQR"** (Coverage_90)
4. **"Covers X% of the Egyptian used car market"** (unique brands × % of market volume)
5. **"Per-segment accuracy: Economy X%, Standard Y%, Luxury Z%"** (Per-tier MAPE)

---

## Challenges & Risks

| Challenge | Risk | Mitigation |
|-----------|------|-----------|
| V2 metrics are worse than V1 in some areas | Embarrassing comparison | Only present improvements; acknowledge challenges honestly |
| Test set is too small for stable per-brand metrics | High variance in per-brand numbers | Report confidence intervals, exclude small-sample brands |
| Different test sets between V1 and V2 | Unfair comparison | Use SAME test set (same random seed in GroupShuffleSplit) |
| Plots look unprofessional | Poor GP impression | Use seaborn/matplotlib with consistent styling |

---

## Files Created by This Plan

| File | Purpose |
|------|---------|
| `notebooks/08_v2_evaluation_report.ipynb` | Full evaluation notebook |
| `models/metrics/v2_evaluation_summary.json` | Summary for API/frontend |
| `models/metrics/per_tier_metrics_v2.csv` | Per-tier breakdown |
| `models/metrics/per_brand_metrics_v2.csv` | Per-brand breakdown |
| `models/metadata/make_model_mape.csv` | Production diagnostics |
| `models/plots_08_v2_evaluation/` | All visualization PNGs |
| `models/metrics/feature_distribution_baseline.json` | Training distribution for drift detection |
| `models/metrics/drift_report_YYYY-MM-DD.json` | Per-snapshot drift report |

---

## Success Criteria

- [ ] All metrics computed on correct test set (GroupShuffleSplit, same seed)
- [ ] V1 vs V2 comparison is on SAME test samples
- [ ] Per-tier table shows improvement in economy segment
- [ ] Coverage metrics show CQR working correctly (90% coverage achieved)
- [ ] `make_model_mape.csv` exported for production use
- [ ] Summary JSON has all required fields
- [ ] At least 5 publication-quality plots generated
- [ ] Numbers are ready to copy-paste into GP presentation
- [ ] `feature_distribution_baseline.json` created and covers all numeric + categorical features
- [ ] `check_drift()` produces alerts for a deliberately distorted test snapshot
- [ ] Drift report generated for the initial `2026-05-24` snapshot vs baseline
