# Plan 4: Model V2 Training

> **This is a MAJOR architecture change (v1.x → v2.x).**  
> Requires Plan 02 (Feature Engineering) complete first.  
> Requires Plan 03 (Retrain CLI) complete first so V2 training USES the CLI, not a notebook.  
> V2 is a new model version, not a retrain of V1.

> **Recommended Model**: **Opus 4.6** (most critical task — model quality depends entirely on correct implementation)  
> **Dependencies**: Plan 02 (Feature Engineering) + Plan 03 (Retrain CLI) complete  
> **Blocks**: Plans 06 (CQR), 07 (API Updates), 08 (Evaluation), 09 (Testing)

---

## Current State & Problems

### Current Model Performance (V1 Ensemble)
| Metric | Value | Target |
|--------|-------|--------|
| MAPE | 12.78% | < 10% |
| R² | 0.888 | > 0.92 |
| Within ±10% | 61.3% | > 70% |
| Within ±15% | 76.6% | > 85% |
| Coverage 80% | 86.8% | > 85% ✓ |
| Mean Width | 77.3% | < 50% |

### Problem 1: Optuna May Have Tuned on Wrong Target
- V1 notebook may have tuned hyperparameters on `log(price)` but evaluated on `price`
- If true, the optimal parameters are for a different loss surface
- **Impact**: Suboptimal hyperparameters → 1-3% MAPE penalty
- **Fix**: Tune directly on `price_egp` with `reg:quantileerror` objective (XGBoost) / `quantile` (LightGBM)

### Problem 2: Train/Test Split May Leak Make-Model Groups
- V1 uses random `train_test_split` which can put the same (make, model) in both train and test
- This inflates test metrics — model appears better than it is on truly unseen cars
- **Impact**: Real-world MAPE is likely 1-2% higher than reported
- **Fix**: Use `GroupKFold` or `GroupShuffleSplit` with group = `(make, model)`

### Problem 3: Quantile Intervals Too Narrow
- Current 80% coverage interval is only 87% (barely passes), but the mean width is 77% of price
- The intervals are wide where they shouldn't be AND narrow where they shouldn't be
- Root cause: No calibration step — raw quantile predictions are unreliable coverage guarantees
- **Impact**: Users can't trust the prediction interval
- **Fix**: CQR calibration (Plan 06) + wider base quantiles (q0.05/q0.95 instead of q0.10/q0.90)

### Problem 4: Economy Segment Dominates Error
- Cars < 500K EGP make up ~40% of data but contribute ~60% of total absolute error
- These cars have high price variance (condition-dependent), fewer distinguishing features
- **Impact**: Global MAPE is dragged up by economy cars
- **Fix**: Sample weighting — upweight economy cars during training so model tries harder there

### Problem 5: Huber Baseline in Ensemble Adds Noise
- The Huber regressor predicts `log(price)` while XGB/LGBM predict `price`
- Mixing log-space and price-space predictions in an ensemble creates inconsistencies
- Huber R²=0.864 vs ensemble R²=0.888 — it's dragging the average down for many predictions
- **Impact**: Huber helps for some outliers but hurts more often than it helps
- **Fix**: Drop Huber from V2 ensemble, use only XGB + LGBM quantile models

### Problem 6: Single Model Architecture Limitations
- A single model must handle both cheap BYD F3s (600K EGP) and Mercedes S-Class (15M EGP)
- Price dynamics are fundamentally different across segments
- However, a three-model architecture is too complex for the current timeline
- **Compromise**: Use `mm_price_tier` feature + sample weighting to let single model adapt per segment

---

## V2 Model Architecture

### Design Decision: Enhanced Single Model (not three-model split)

**Why NOT three-model architecture**:
- Routing logic adds complexity and potential bugs
- Each sub-model has less training data (already small dataset)
- Cross-segment cars (e.g., high-spec Hyundai) may be misrouted
- Maintenance burden triples

**V2 architecture instead**:
```
Input → Feature Engineering V2 (15 → 20 features)
      → XGBoost Quantile Models (Q0.05, Q0.10, Q0.50, Q0.90, Q0.95)
      → LightGBM Quantile Models (Q0.05, Q0.10, Q0.50, Q0.90, Q0.95)
      → Ensemble (Weighted Average: XGB 0.55, LGBM 0.45)
      → CQR Calibration (Plan 06)
      → Final Predictions
```

### Quantile Setup
- **5 quantile targets**: Q0.05, Q0.10, Q0.50, Q0.90, Q0.95
- **Why 5 instead of 3**: CQR needs inner (80%) and outer (90%) intervals
- **Quantile crossing fix**: After prediction, sort quantiles to enforce monotonicity

### Ensemble Strategy
- **Method**: Weighted average (not Robust Average — simpler, more stable)
- **Weights**: XGB 0.55, LGBM 0.45 (XGB slightly better on this dataset historically)
- **Per-quantile**: Apply ensemble separately to each quantile level

---

## Training Procedure

### Step 3.1 — Data Split Strategy
**Three-way split** (required for CQR):

```
Full Data (20K rows)
├── Training Set (70%) → ~14K rows — used for model training
├── Calibration Set (15%) → ~3K rows — used for CQR calibration ONLY
└── Test Set (15%) → ~3K rows — used for final evaluation ONLY
```

**Split method**: `GroupShuffleSplit` with `groups = make + "_" + model`
- Ensures all rows for a given (make, model) are in the SAME split
- No leakage between splits
- Random state = 42 for reproducibility

### Step 3.2 — Sample Weighting

Assign training sample weights based on price tier:

| Price Tier | Weight | Rationale |
|------------|--------|-----------|
| Economy (< 500K) | 1.5 | Highest MAPE, needs more attention |
| Standard (500K - 1.5M) | 1.0 | Baseline weight |
| Luxury (1.5M - 4M) | 1.0 | Already well-predicted |
| Ultra-luxury (> 4M) | 0.8 | Few samples, don't over-fit to outliers |

**Implementation**: Pass as `sample_weight` to XGBoost/LightGBM `.train()` method.

### Step 3.3 — XGBoost Hyperparameter Tuning

**Objective**: `reg:quantileerror` (one model per quantile)  
**Target**: `price_egp` (raw price, NOT log)  
**Tuning**: Optuna with 200 trials per quantile (median first, then others warm-start)

**Search space**:
```python
{
    'max_depth': [4, 10],
    'learning_rate': [0.01, 0.3],
    'n_estimators': [500, 3000],
    'min_child_weight': [5, 100],
    'subsample': [0.6, 0.95],
    'colsample_bytree': [0.5, 0.95],
    'reg_alpha': [0, 10],
    'reg_lambda': [1, 10],
    'gamma': [0, 5],
}
```

**Early stopping**: 50 rounds on validation loss (20% of training data, random split within training)

**Critical**: Tune the MEDIAN quantile first (most important for fair_price), then reuse similar params for other quantiles with minor adjustments.

### Step 3.4 — LightGBM Hyperparameter Tuning

**Objective**: `quantile` with `alpha` parameter  
**Target**: `price_egp` (raw price)  
**Tuning**: Optuna with 200 trials

**Search space**:
```python
{
    'max_depth': [4, 10],
    'learning_rate': [0.01, 0.3],
    'n_estimators': [500, 3000],
    'num_leaves': [31, 255],
    'min_child_samples': [10, 100],
    'subsample': [0.6, 0.95],
    'colsample_bytree': [0.5, 0.95],
    'reg_alpha': [0, 10],
    'reg_lambda': [1, 10],
    'min_split_gain': [0, 1.0],
}
```

**LightGBM categorical handling**: Use native categorical support (`categorical_feature` parameter) — no label encoding needed. This is a key advantage over XGBoost.

### Step 3.5 — Post-Training Quantile Fix

After all models are trained, enforce monotonicity on predictions:
```python
# For each sample, ensure: q05 ≤ q10 ≤ q50 ≤ q90 ≤ q95
preds = np.column_stack([q05_pred, q10_pred, q50_pred, q90_pred, q95_pred])
preds_sorted = np.sort(preds, axis=1)  # Sort along quantile axis
```

### Step 3.6 — Ensemble Combination

```python
# Per quantile level
for q in ['q05', 'q10', 'q50', 'q90', 'q95']:
    ensemble_pred[q] = 0.55 * xgb_pred[q] + 0.45 * lgbm_pred[q]
```

### Step 3.7 — Export Artifacts

After training is complete, export:

| Artifact | Path | Purpose |
|----------|------|---------|
| XGB quantile models | `models/pickles/xgb_quantile_v2.joblib` | 5 XGB models |
| LGBM quantile models | `models/pickles/lgbm_quantile_v2.joblib` | 5 LGBM models |
| Ensemble config | `models/pickles/ensemble_v2.joblib` | Weights, method |
| Label encoders | `models/pickles/label_encoders_v2.joblib` | For XGB inference |
| mm_price_tier lookup | `models/metadata/mm_price_tier_lookup.csv` | For inference |
| make_model_mape | `models/metadata/make_model_mape.csv` | For confidence |
| CQR calibration | `models/metadata/cqr_calibration.json` | For interval calibration |
| V2 metadata | `models/metadata/ensemble_v2.json` | Model info, metrics, params |
| Model registry | `models/model_registry.json` | Updated with V2 entry |

---

## Evaluation Framework

### Primary Metrics (computed on TEST set only)

| Metric | Formula | Target |
|--------|---------|--------|
| MAPE | mean(|y - ŷ| / y) × 100 | < 10% |
| MAE | mean(|y - ŷ|) | < 100K EGP |
| R² | 1 - SS_res / SS_tot | > 0.92 |
| Within ±10% | % predictions where |y - ŷ|/y < 0.10 | > 70% |
| Within ±15% | % predictions where |y - ŷ|/y < 0.15 | > 85% |
| Coverage 80% | % where y ∈ [q10, q90] | > 80% (CQR guarantees) |
| Coverage 90% | % where y ∈ [q05, q95] | > 90% (CQR guarantees) |
| Mean Interval Width | mean((q90 - q10) / q50) × 100 | < 50% |

### Per-Tier Metrics

| Tier | MAPE Target | Why |
|------|-------------|-----|
| Economy (< 500K) | < 15% | Hardest segment, condition-dependent |
| Standard (500K-1.5M) | < 10% | Main market, good data |
| Luxury (1.5M-4M) | < 10% | Feature-rich, stable pricing |
| Ultra-luxury (> 4M) | < 15% | Few samples, high variance |

### Per-Brand Exclusion Rules
Exclude brands with < 10 test samples from per-brand metrics (too noisy). Report them separately as "low-confidence brands."

---

## Challenges & Risks

| Challenge | Risk | Mitigation |
|-----------|------|-----------|
| Optuna takes too long (200 trials × 5 quantiles × 2 frameworks) | Exceeds compute budget | Tune median first, warm-start others with ±5% param variation |
| GroupSplit reduces effective training data for rare brands | Rare-brand model quality drops | Sample weighting compensates; rare brands already flagged as low-confidence |
| Raw price target has high variance (50K-50M range) | Gradient explosions, slow convergence | Use `tree_method='hist'`, clip extreme predictions |
| LightGBM categorical requires consistent category sets | Error on unseen categories at inference | Use label encoding fallback (-1) for unknown categories |
| Ensemble weights are fixed | May not be optimal for all segments | Can be upgraded to per-tier weights in V3 |
| 5 quantile models per framework = 10 total models | High memory usage | joblib compression, lazy loading |

---

## Notebook Structure: `07_model_v2_training.ipynb`

```
Cell 1:  Imports and configuration
Cell 2:  Load processed data, verify schema
Cell 3:  Compute mm_price_tier and make_model_count from full data (for lookup export)
Cell 4:  Three-way GroupShuffleSplit (train/calibration/test)
Cell 5:  Apply mm_price_tier and make_model_count to all splits (from train-derived lookup)
Cell 6:  Compute sample weights
Cell 7:  Prepare features (label encoding for XGB, category dtype for LGBM)
Cell 8:  Optuna XGBoost median tuning (200 trials)
Cell 9:  Train all 5 XGBoost quantile models with best params
Cell 10: Optuna LightGBM median tuning (200 trials)
Cell 11: Train all 5 LightGBM quantile models with best params
Cell 12: Ensemble predictions on test set
Cell 13: Quantile crossing fix
Cell 14: CQR calibration on calibration set (see Plan 06)
Cell 15: Final evaluation on test set (all metrics)
Cell 16: Per-tier breakdown
Cell 17: Per-brand breakdown
Cell 18: Comparison table V1 vs V2
Cell 19: Export all artifacts
Cell 20: Update model_registry.json
```

---

## Key Technical Decisions

1. **Target variable**: `price_egp` (raw), NOT `log(price_egp)` — avoids exp() rounding artifacts
2. **Split strategy**: GroupShuffleSplit by (make, model) — prevents leakage
3. **No Huber in ensemble**: Simplifies architecture, removes log/linear mixing issues
4. **5 quantiles**: Enables both 80% and 90% prediction intervals
5. **Fixed ensemble weights**: XGB 0.55, LGBM 0.45 — simple, proven effective
6. **Sample weighting**: Economy 1.5×, to reduce per-tier MAPE gap
7. **Single model**: No three-model split — dataset too small, maintenance too high

---

## Success Criteria

- [ ] V2 model trained successfully with 5 quantile levels
- [ ] Test MAPE < 12% (improvement over V1's 12.78%)
- [ ] Test R² > 0.89
- [ ] Within ±15% > 78%
- [ ] Coverage 90% (post-CQR) > 90%
- [ ] All artifacts exported to correct paths
- [ ] `model_registry.json` updated with V2 entry
- [ ] Per-tier MAPE shows improvement in economy segment
