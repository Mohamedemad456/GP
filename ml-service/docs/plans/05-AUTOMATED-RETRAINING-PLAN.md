# Plan 5: Automated Retraining Pipeline

> **Recommended Model**: Sonnet 4.6  
> **Dependencies**: Plans 3 (Training) and 4 (CQR) must be complete  
> **Blocks**: None (nice-to-have for production readiness)

---

## Current State & Problems

### Problem 1: Training is Notebook-Only
- All model training happens in Jupyter notebooks (05, 06)
- Notebooks are great for experimentation but terrible for automation
- Cannot schedule retraining, cannot trigger from CI/CD
- **Impact**: Model gets stale as new data accumulates; manual effort to retrain

### Problem 2: No Reproducibility Guarantee
- Notebook cells can be run out of order
- Global state can leak between experiments
- Different runs may use different random seeds, data versions, or feature sets
- **Impact**: Can't guarantee the production model matches what was evaluated

### Problem 3: No Metric Gates
- Currently, trained models are manually promoted to production
- No automated check: "is the new model actually better than the old one?"
- Risk of deploying a worse model if human oversight fails
- **Impact**: Potential production regression

### Problem 4: Artifact Management is Manual
- Model pickles, label encoders, metadata JSONs, MAPE CSVs — all exported manually
- Registry update is a manual JSON edit
- Easy to forget an artifact or export wrong version
- **Impact**: Stale diagnostics, wrong model served

---

## Architecture

```
cli/retrain.py
├── load_processed_data()
├── compute_features()          # mm_price_tier, make_model_count, etc.
├── split_data()                # GroupShuffleSplit (train/cal/test)
├── train_models()              # XGB + LGBM with fixed hyperparams
├── calibrate_cqr()            # CQR on calibration set
├── evaluate()                  # Full metrics on test set
├── compare_with_current()     # Is new model better?
├── export_artifacts()         # Pickles, metadata, lookups
└── promote_model()            # Update registry if metrics pass
```

**Key principle**: The CLI uses the SAME logic as the notebook but without interactivity. Hyperparameters are frozen from the Optuna-tuned values found in Plan 3.

---

## Implementation Steps

### Step 5.1 — Create CLI Entry Point

**File**: `cli/retrain.py`

```python
"""
Automated model retraining pipeline.

Usage:
    python -m cli.retrain                    # Full retrain with promotion
    python -m cli.retrain --no-promote       # Train and evaluate, don't promote
    python -m cli.retrain --data-path X      # Use specific processed data
    python -m cli.retrain --dry-run          # Show what would happen
"""
```

**Arguments**:
- `--no-promote`: Train and evaluate but don't update registry
- `--data-path`: Override processed data path
- `--params-path`: Override hyperparameter file
- `--dry-run`: Print plan without executing
- `--force`: Promote even if metrics don't improve (for debugging)
- `--random-seed`: Override random seed (default: 42)

### Step 5.2 — Hyperparameter Configuration

**File**: `cli/configs/v2_hyperparams.json`

Store the Optuna-best hyperparameters from Plan 3:
```json
{
  "xgb": {
    "median": {"max_depth": 7, "learning_rate": 0.05, "n_estimators": 1500, ...},
    "q05": {"max_depth": 7, ...},
    "q10": {"max_depth": 7, ...},
    "q90": {"max_depth": 7, ...},
    "q95": {"max_depth": 7, ...}
  },
  "lgbm": {
    "median": {"max_depth": 7, "learning_rate": 0.05, "n_estimators": 1200, ...},
    ...
  },
  "ensemble": {
    "weights": {"xgb": 0.55, "lgbm": 0.45},
    "method": "weighted_average"
  },
  "sample_weights": {
    "economy": 1.5,
    "standard": 1.0,
    "luxury": 1.0,
    "ultra_luxury": 0.8
  }
}
```

### Step 5.3 — Metric Gates

Define pass/fail criteria for promotion:
```python
PROMOTION_GATES = {
    "MAPE_pct": {"max": 15.0, "prefer_improvement": True},
    "R2": {"min": 0.85, "prefer_improvement": True},
    "Within_15pct": {"min": 72.0, "prefer_improvement": True},
    "Coverage_80_pct": {"min": 75.0},
    "Coverage_90_pct": {"min": 85.0},
}
```

**Logic**:
1. ALL `min`/`max` constraints must pass (hard gates)
2. If `prefer_improvement=True`, compare with current production model
3. If new model is worse on ANY `prefer_improvement` metric, warn but still allow with `--force`

### Step 5.4 — Artifact Export

Standardized export function:
```python
def export_artifacts(models, metadata, version_tag):
    """Export all model artifacts to standardized paths."""
    # models/pickles/xgb_quantile_{version}.joblib
    # models/pickles/lgbm_quantile_{version}.joblib
    # models/pickles/ensemble_{version}.joblib
    # models/pickles/label_encoders_{version}.joblib
    # models/metadata/ensemble_{version}.json
    # models/metadata/mm_price_tier_lookup.csv
    # models/metadata/make_model_mape.csv
    # models/metadata/cqr_calibration.json
```

### Step 5.5 — Registry Update

```python
def promote_model(version_tag, metrics):
    """Update model_registry.json to point to new model."""
    registry = load_registry()
    
    # Add new model entry
    registry['models'][f'ensemble_v2_{version_tag}'] = {
        'model_id': f'ensemble_v2_{version_tag}',
        'framework': 'ensemble',
        'version': version_tag,
        'stage': 'production',
        'pkl_path': f'models/pickles/ensemble_{version_tag}.joblib',
        'meta_path': f'models/metadata/ensemble_{version_tag}.json',
        'metrics': metrics,
        ...
    }
    
    # Demote old model
    old_id = registry['active_model_id']
    registry['models'][old_id]['stage'] = 'archived'
    
    # Promote new
    registry['active_model_id'] = f'ensemble_v2_{version_tag}'
    registry['active_version'] = version_tag
    
    save_registry(registry)
```

---

## Pipeline Flow

```
1. Load data
   ↓
2. Validate data schema (columns, types, no NaN in critical fields)
   ↓
3. Compute V2 features (log_mileage_km, mileage_ratio, year_bucket)
   ↓
4. GroupShuffleSplit → train/calibration/test
   ↓
5. Compute mm_price_tier + make_model_count from train split
   ↓
6. Apply lookups to all splits
   ↓
7. Compute sample weights
   ↓
8. Train XGB (5 quantiles) with frozen params
   ↓
9. Train LGBM (5 quantiles) with frozen params
   ↓
10. Ensemble predictions on calibration + test sets
    ↓
11. CQR calibration on calibration set
    ↓
12. Evaluate on test set (full metrics)
    ↓
13. Compare with current production model
    ↓
14. IF passes gates → export artifacts → update registry
    ELSE → log warning, exit with code 1
```

---

## Challenges & Risks

| Challenge | Risk | Mitigation |
|-----------|------|-----------|
| Frozen params may not be optimal for new data | Model quality degrades over time | Re-tune with Optuna quarterly (back in notebook) |
| Data schema changes break pipeline | Runtime error | Add explicit schema validation at step 2 |
| Training takes too long for CI/CD | Timeout | XGB/LGBM with frozen params trains in ~5-10 min on this dataset |
| Race condition if two retrains run simultaneously | Corrupt registry | File locking or atomic write for registry |
| Memory usage spike during training | OOM on small machines | Process isolation, limit to one model at a time |

---

## Files Created by This Plan

| File | Purpose |
|------|---------|
| `cli/retrain.py` | Main retraining entry point |
| `cli/configs/v2_hyperparams.json` | Frozen hyperparameters |
| `cli/configs/promotion_gates.json` | Metric thresholds for promotion |

---

## Success Criteria

- [ ] `python -m cli.retrain --dry-run` shows correct plan
- [ ] `python -m cli.retrain --no-promote` trains and evaluates successfully
- [ ] Metrics from CLI match metrics from notebook (within 0.1% due to randomness)
- [ ] `python -m cli.retrain` promotes model and updates registry
- [ ] Service starts with newly promoted model
- [ ] All existing tests pass after promotion
