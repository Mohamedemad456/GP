# Plan 7: Evaluation & Metrics Export

> **Recommended Model**: GPT 5.5 (analysis + visualization) + GPT 5.4 (exports)  
> **Dependencies**: Plan 3 (Model Training) must be complete  
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

### Step 7.1 — Load V2 Model and Test Data
```python
# Load the exact same test set used during training (same random seed, same split)
# This ensures evaluation is on truly unseen data
# Load V1 model predictions on same test set for comparison
```

### Step 7.2 — Compute Global Metrics

| Metric | Formula | V1 Baseline | V2 Target |
|--------|---------|-------------|-----------|
| MAPE | mean(|y-ŷ|/y) × 100 | 12.78% | < 10% |
| MAE | mean(|y-ŷ|) | 133,593 | < 100,000 |
| RMSE | sqrt(mean((y-ŷ)²)) | 473,138 | < 400,000 |
| R² | 1 - SS_res/SS_tot | 0.888 | > 0.92 |
| Within ±10% | % where |y-ŷ|/y < 0.10 | 61.3% | > 70% |
| Within ±15% | % where |y-ŷ|/y < 0.15 | 76.6% | > 85% |

### Step 7.3 — Per-Price-Tier Evaluation

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

### Step 7.4 — Per-Brand Evaluation

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

### Step 7.5 — Coverage & Interval Analysis

**Metrics to compute**:
- Raw quantile coverage (before CQR): % of test samples within [Q10, Q90]
- CQR-calibrated 80% coverage: should be 78-82%
- CQR-calibrated 90% coverage: should be 88-92%
- Mean interval width (as % of fair price)
- Interval width by tier (economy intervals should be wider than luxury)

**Key chart**: Coverage vs Width plot showing the tradeoff

### Step 7.6 — V1 vs V2 Comparison Table

**The money table for GP presentation**:

| Metric | V1 (Ensemble) | V2 (Enhanced) | Improvement |
|--------|---------------|---------------|-------------|
| MAPE | 12.78% | X% | -Y% |
| R² | 0.888 | X | +Y |
| Within ±15% | 76.6% | X% | +Y% |
| Coverage 90% | N/A | X% | NEW |
| Economy MAPE | ~22% | X% | -Y% |
| Interval Width | 77.3% | X% | -Y% |

### Step 7.7 — Visualization Plots

**Charts to generate** (save as PNG in `models/plots_08_v2_evaluation/`):

1. **Predicted vs Actual scatter** — colored by tier
2. **Residual distribution** — histogram, check for normality
3. **MAPE by price tier** — bar chart comparing V1 vs V2
4. **Coverage curve** — coverage % vs interval width at different quantile levels
5. **Per-brand MAPE** — horizontal bar chart (top 20 brands)
6. **SHAP summary plot** — feature importance for V2 model
7. **Prediction interval example** — 5 sample cars with intervals shown

### Step 7.8 — Export for Production

Generate files that the running service loads:

```python
# make_model_mape.csv — used by confidence.py
test_df.groupby(['make', 'model']).apply(
    lambda g: pd.Series({
        'MAPE_pct': np.mean(np.abs((g['y_true'] - g['y_pred']) / g['y_true'])) * 100
    })
).reset_index().to_csv('models/metadata/make_model_mape.csv', index=False)
```

### Step 7.9 — Summary JSON Export

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
