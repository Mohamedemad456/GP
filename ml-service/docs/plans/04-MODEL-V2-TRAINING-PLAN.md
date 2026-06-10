# Plan 4: Model V2 Training

> **Status**: In progress — 07c notebook experimentation phase  
> **Approach**: Baseline-first (anchor on proven 07a recipe), then iterate on training strategy  
> **Dependencies**: Plan 01 (Data Cleaning) complete; Plan 02 (Feature Engineering) was evaluated and **rejected**  
> V2 is a new model version, not a retrain of V1.

> **Recommended Model**: **Opus 4.6** (most critical task — model quality depends entirely on correct implementation)  
> **Dependencies**: Plan 01 complete; Plan 02 evaluated and rejected; Plan 03 (Retrain CLI) for reproducible module  
> **Blocks**: Plans 06 (CQR), 07 (API Updates), 08 (Evaluation), 09 (Testing)

---

## Current State & Problems

### 07a Baseline (V1 Features, Proven Recipe)
| Metric | Value | Target |
|--------|-------|--------|
| MAPE | ~11.33% | < 10% |
| R² | ~0.93 | > 0.92 |
| Within ±10% | ~68% | > 70% |
| Within ±15% | ~82% | > 85% |

### Current Model Performance (V1 Ensemble — older measurement)
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
- **Compromise**: Sample weighting by price tier to let single model adapt per segment

---

## V2 Model Architecture

### Design Decision: Enhanced Single Model (not three-model split)

**Why NOT three-model architecture**:
- Routing logic adds complexity and potential bugs
- Each sub-model has less training data (already small dataset)
- Cross-segment cars (e.g., high-spec Hyundai) may be misrouted
- Maintenance burden triples

**V2 architecture (07c experimentation)**:
```
Input → V1 Features (15 features only — Plan 2 rejected)
      → XGBoost Quantile Models (Q0.05, Q0.10, Q0.50, Q0.90, Q0.95)
      → LightGBM Quantile Models (Q0.05, Q0.10, Q0.50, Q0.90, Q0.95)
      → Ensemble (Weighted Average: XGB 0.55, LGBM 0.45)
      → CQR Calibration (Plan 06)
      → Final Predictions
```

> **Note on Plan 2**: All 5 proposed Plan 2 features were prototyped and ablated in 07b. The best improvement was 0.08 pp MAPE from `make_model_count`, insufficient to justify production complexity. Plan 2 features are **rejected**; 07c uses V1 features only.

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

**07c notebook split** (two-way for experimentation; three-way reserved for CQR in Plan 06):

```
Full Data
├── Training + Val (90%) — 10% holdout for internal validation
└── Test Set (10%) — holdout for final evaluation
```

**Split method**: `price_stratified` (proven in 07a)
- Stratifies on price tiers to ensure balanced representation across segments
- Reproducible via `build_primary_splits()` with random_state=42
- For CQR calibration, a dedicated calibration split will be created in Plan 06

> **Historical note**: Plan 4 originally recommended `GroupShuffleSplit` by (make, model). The 07a baseline proved `price_stratified` is effective; 07c anchors on that proven split. `GroupShuffleSplit` may be revisited for CQR specifically.

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
**Target**: `price_egp_log` (log price — matches 07a baseline recipe)  
**Tuning**: Optuna with 50 trials for median quantile in notebook mode; 200 trials recommended for final reproducible module

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

**Early stopping**: 40 rounds on validation loss (10% val split from training)

**Critical**: Tune the MEDIAN quantile first (most important for fair_price), then reuse similar params for other quantiles with minor adjustments.

### Step 3.4 — LightGBM Hyperparameter Tuning

**Objective**: `quantile` with `alpha` parameter  
**Target**: `price_egp_log` (log price — matches 07a baseline)  
**Tuning**: Optuna with 50 trials in notebook mode; 200 trials for final reproducible module

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

### Step 3.5 — Ensemble Combination

```python
# Per quantile level
for q in ['q05', 'q10', 'q50', 'q90', 'q95']:
    ensemble_pred[q] = 0.55 * xgb_pred[q] + 0.45 * lgbm_pred[q]
```

### Step 3.6 — Export Artifacts

After training is complete, export:

| Artifact | Path | Purpose |
|----------|------|---------|
| XGB quantile models | `models/pickles/xgb_quantile_v2.joblib` | 5 XGB models |
| LGBM quantile models | `models/pickles/lgbm_quantile_v2.joblib` | 5 LGBM models |
| Ensemble config | `models/pickles/ensemble_v2.joblib` | Weights, method |
| Label encoders | `models/pickles/label_encoders_v2.joblib` | For XGB inference |
| make_model_mape | `models/metadata/make_model_mape.csv` | For confidence |
| CQR calibration | `models/metadata/cqr_calibration.json` | For interval calibration |
| V2 metadata | `models/metadata/ensemble_v2.json` | Model info, metrics, params |
| Model registry | `models/model_registry.json` | Updated with V2 entry |

> **Note**: `mm_price_tier` lookup was removed after Plan 2 rejection. V2 uses V1 features only.

---

## Evaluation Framework
### Primary Metrics (computed on TEST set only)

| Metric | Formula | Target |
|--------|---------|--------|
| MAPE | `mean(abs(y - ŷ) / y) × 100` | `< 16%` |
| MAE | `mean(abs(y - ŷ))` | `< 100K EGP` |
| R² | `1 - SS_res / SS_tot` | `>= 0.84` |
| Within ±10% | `% predictions where abs(y - ŷ) / y < 0.10` | `> 70%` |
| Within ±15% | `% predictions where abs(y - ŷ) / y < 0.15` | `> 65%` |
| Coverage 80% | `% where y ∈ [q10, q90]` | `> 75% (raw quantiles, pre-CQR)` |
| Coverage 90% | `% where y ∈ [q05, q95]` | `> 75% (raw quantiles, pre-CQR)` |
| Mean Interval Width | `mean((q90 - q10) / q50) × 100` | `< 50%` |
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

## Notebook Structure: `07c_model_v2_training_experiments.ipynb`

```
Cell 1:  Title & execution notes
Cell 2:  Imports and configuration (explicit baseline anchor)
Cell 3:  07a baseline reference
Cell 4:  Load dataset, reconstruct price_stratified split
Cell 5:  Build V1 feature specification (no Plan 2)
Cell 6:  Prepare training matrices (XGB + LGBM)
Cell 7:  Sample weight configuration
Cell 8:  Optuna tuning config
Cell 9:  Tune XGBoost median quantile
Cell 10: Tune LightGBM median quantile
Cell 11: Define V2 experiment ladder
Cell 12: Experiment runner helper
Cell 13: Run experiment ladder
Cell 14: Shortlist & winner selection
Cell 15: Holdout evaluation summary (best experiment)
Cell 16: Best & worst per-make-model by MAPE
Cell 17: Best & worst per-make-model by R²
Cell 18: Cross-validation (5-fold, overall + per-make-model)
Cell 19: Export artifacts
Cell 20: Generate REPORT.md
```

## Reproducible Module

The notebook experiments above produce the **design decisions** and **hyperparameters** for the final V2 model. Once the best configuration is selected, a reproducible Python module (`retrain_cli` or dedicated V2 training script) should:
1. Accept the same configuration via CLI args or config file
2. Run the identical pipeline on the full dataset
3. Export artifacts to `models/pickles/` and `models/metadata/`
4. Update `model_registry.json`

The notebook is the experimentation ground; the Python module is the production source of truth.

---

## Key Technical Decisions

1. **Target variable**: `price_egp_log` — matches proven 07a baseline recipe (avoids gradient issues on raw price while maintaining predictability)
2. **Split strategy**: `price_stratified` — proven effective in 07a; GroupShuffleSplit reserved for CQR calibration if needed
3. **No Huber in ensemble**: Simplifies architecture, removes log/linear mixing issues
4. **5 quantiles**: Enables both 80% and 90% prediction intervals
5. **Fixed ensemble weights**: XGB 0.55, LGBM 0.45 — simple, proven effective
6. **Sample weighting**: Economy 1.5×, to reduce per-tier MAPE gap
7. **Single model**: No three-model split — dataset too small, maintenance too high
8. **V1 features only**: Plan 2 features rejected after 07b ablation showed negligible gains
9. **Notebook-first, module-second**: Experiments in `07c` notebook → validated config → reproducible Python training module

---

## Success Criteria

- [ ] V2 model trained successfully with 5 quantile levels
- [ ] Test MAPE < 16%
- [ ] Test R² >= 0.84
- [ ] Within ±15% > 65%
- [ ] Coverage 90% (raw quantiles, pre-CQR) > 75%
- [ ] All artifacts exported to correct paths
- [ ] `model_registry.json` updated with V2 entry
- [ ] Per-tier MAPE shows improvement in economy segment
