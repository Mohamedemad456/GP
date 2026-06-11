# Plan 3: Retrain CLI

> **This is the immediate priority — unblocks everything after it.**  
> **Dependencies**: None — this is the foundation  
> **Blocks**: Plans 04 (V2 Training), 08 (Evaluation), all retrain runs

---

## Current State & Problems

### Problem 1: Training is Notebook-Only
- All model training happens in Jupyter notebooks
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
├── load_data()              # training_data.csv (default) or --data-path override
├── load_config()            # train_config_v1.1.0.json (default) or --config-path override
├── validate_schema()        # required columns, no critical NaNs
├── split_data()             # GroupShuffleSplit (train / cal / test)
├── train_xgb()              # frozen params from config
├── train_lgbm()             # frozen params from config
├── ensemble()               # weighted average 50/50
├── evaluate()               # global + CV + per-make-model MAPE
├── check_gates()            # auto_promote / warn / reject
├── export_artifacts()       # pickles, metadata, metrics, combo_set
└── log_result()             # append to training_history.json
```

**Key principle**: The CLI uses the SAME logic as the notebook but without interactivity. Hyperparameters are frozen from the Optuna-tuned values stored in `train_config_v1.1.0.json`.

---

## CLI Interface

```bash
# Full retrain with promotion (default)
python -m cli.retrain

# Evaluate only, don't promote
python -m cli.retrain --no-promote

# Use specific data file
python -m cli.retrain --data-path data/processed/versions/processed_2026-05-28_001.csv

# Use specific config (e.g. for V2 experiments)
python -m cli.retrain --config-path models/configs/train_config_v2.0.0.json

# Show what would happen without running
python -m cli.retrain --dry-run

# Override warn gates (NEVER overrides hard reject)
python -m cli.retrain --force

# Optional: re-tune hyperparams with Optuna
python -m cli.retrain --tune --splits price_range,make_model
```

---

## Data Source

**Default**: `data/processed/training_data.csv`

This is the merged/deduplicated dataset across all snapshots (currently 29,656 rows). It has no `scraping_date` column — the model learns from accumulated historical data.

**Why not the latest single snapshot?**
- Latest snapshot = ~19K rows, fewer combos
- Merged data = more combos, more training samples per combo
- The `scraping_date` column is NOT included as a feature (see Plan D — Snapshot Strategy decision is deferred)

---

## Outputs Per Retrain Run

Each run produces a versioned artifact set (tag = `YYYY-MM-DD` or user-specified):

| File | Path | Purpose |
|------|------|---------|
| XGB models | `models/pickles/xgb_quantile_{tag}.joblib` | 3 (or 5) quantile XGB models |
| LGBM models | `models/pickles/lgbm_quantile_{tag}.joblib` | 3 (or 5) quantile LGBM models |
| Ensemble config | `models/pickles/ensemble_{tag}.joblib` | Weights, method, base_model paths (all relative) |
| Label encoders | `models/pickles/label_encoders_{tag}.joblib` | For XGB inference |
| Model metadata | `models/metadata/ensemble_{tag}.json` | Model card: features, metrics, config ref |
| Train config copy | `models/configs/train_config_{tag}.json` | Snapshot of config used for this run |
| Combo set | `models/metrics/combo_set_{tag}.json` | Make-model coverage for fallback routing |
| Per-combo MAPE | `models/metrics/make_model_mape_{tag}.csv` | CV evaluation per make-model |
| Training log | `models/training_history.json` | Appended with this run's result |
| Registry update | `models/model_registry.json` | If promoted, active_model_id updated |

---

## Acceptance Gates

See `models/configs/train_config_v1.1.0.json` for the full gate specification. Summary:

| Gate | Auto-Promote | Warn (needs --force) | Hard Reject |
|------|-------------|---------------------|-------------|
| Global MAPE | ≤ 14% | 14–16% | > 16% |
| R2 | ≥ 0.87 | 0.82–0.87 | < 0.82 |
| Within_15pct | ≥ 75% | 70–75% | < 70% |
| CV MAPE | ≤ 17% | 17–20% | > 20% |
| % well-supported combos MAPE > 30% | ≤ 14% | 14–22% | > 22% |
| % well-supported combos MAPE > 50% | ≤ 6% | 6–12% | > 12% |

**Rules**:
- Combo gates apply only to well-supported combos (n ≥ 10)
- Sparse combos (n < 10) are excluded from combo gates
- `--force` overrides warn gates, NEVER hard reject gates
- Rejected models are still logged in `training_history.json`

---

## Implementation Steps

### Step 3.1 — Create CLI Entry Point
**File**: `cli/retrain.py`

```python
"""
Automated model retraining pipeline.

Usage:
    python -m cli.retrain                    # Full retrain with promotion
    python -m cli.retrain --no-promote       # Train and evaluate, don't promote
    python -m cli.retrain --data-path X      # Use specific processed data
    python -m cli.retrain --config-path X    # Use specific hyperparameter config
    python -m cli.retrain --dry-run          # Show what would happen
    python -m cli.retrain --force            # Override warn gates (not hard reject)
    python -m cli.retrain --tune             # Re-tune with Optuna
"""
```

**Arguments**:
- `--no-promote`: Train and evaluate but don't update registry
- `--data-path`: Override processed data path
- `--config-path`: Override hyperparameter config file
- `--dry-run`: Print plan without executing
- `--force`: Promote even if metrics trigger warn gates (for debugging)
- `--tune`: Re-run Optuna tuning instead of using frozen params
- `--random-seed`: Override random seed (default: 42)

### Step 3.2 — Create Config Loader
**File**: `cli/config.py` (or inline in retrain.py)

Load `models/configs/train_config_{version}.json` and expose:
- Data config (path, split, target)
- Feature lists
- Sample weights
- XGB params
- LGBM params
- Ensemble config

### Step 3.3 — Create Data Validator
**File**: `cli/validate.py` (or inline)

```python
def validate_data(df: pd.DataFrame, config: dict) -> list[str]:
    """Validate processed data before training.
    
    Returns list of error messages. Empty list = valid.
    """
    errors = []
    required = set(config['features']['feature_cols'] + [config['data']['target_col']])
    missing = required - set(df.columns)
    if missing:
        errors.append(f"Missing columns: {missing}")
    
    for col in ['make', 'model', 'year', config['data']['target_col']]:
        if df[col].isna().any():
            errors.append(f"NaN found in critical column: {col}")
    
    if len(df) < 5000:
        errors.append(f"Too few rows: {len(df)} (need >= 5000)")
    
    return errors
```

### Step 3.4 — Create Trainer
**File**: `cli/train.py` (or inline)

Train XGB and LGBM quantile models using frozen params from config.
Use `sample_weight` based on price tier from config.

### Step 3.5 — Create Evaluator
**File**: `cli/evaluate.py` (or inline)

Compute:
- Global metrics (MAPE, MAE, RMSE, R2, Within_10pct, Within_15pct)
- CV metrics (5-fold GroupKFold by make_model)
- Per-make-model MAPE on all combos
- Combo gate metrics (% well-supported combos with MAPE > 30%, > 50%)

### Step 3.6 — Create Gate Checker
**File**: `cli/gates.py` (or inline)

```python
def check_gates(metrics: dict, combo_metrics: dict) -> tuple[str, list[str]]:
    """Returns (result, violations) where result is one of:
    'auto_promote', 'warn', 'hard_reject'
    """
```

### Step 3.7 — Create Artifact Exporter
**File**: `cli/export.py` (or inline)

Standardized export function that writes all artifacts to versioned paths.

### Step 3.8 — Create Registry Updater
**File**: `cli/promote.py` (or inline)

```python
def promote_model(tag: str, metrics: dict):
    """Update model_registry.json to point to new model.
    
    - Add new model entry
    - Demote old model to 'archived'
    - Update active_model_id and active_version
    """
```

### Step 3.9 — Create Training History Logger
**File**: `cli/history.py` (or inline)

Append to `models/training_history.json` with all run details.

---

## Files Created by This Plan

| File | Purpose |
|------|---------|
| `cli/retrain.py` | Main CLI entry point |
| `cli/__init__.py` | Package init |
| `cli/config.py` | Config loader |
| `cli/validate.py` | Data validator |
| `cli/train.py` | XGB + LGBM trainer |
| `cli/evaluate.py` | Metrics evaluator |
| `cli/gates.py` | Acceptance gate checker |
| `cli/export.py` | Artifact exporter |
| `cli/promote.py` | Registry updater |
| `cli/history.py` | Training history logger |

---

## Success Criteria

- [ ] `python -m cli.retrain --dry-run` shows the planned workflow without errors
- [ ] `python -m cli.retrain --no-promote` trains a model and evaluates it
- [ ] Evaluation produces correct global metrics, CV metrics, and per-combo MAPE
- [ ] Gate checker correctly classifies results (auto_promote / warn / hard_reject)
- [ ] All artifacts are exported to correctly versioned paths
- [ ] `training_history.json` is appended with the run result
- [ ] `--force` allows promotion through warn gates but NOT hard reject gates
- [ ] Service can be restarted and load the newly promoted model
- [ ] All existing tests still pass

---

## Phase 2: Automation (Future)

After the CLI is working, automation can be added:
- Cron job / systemd timer to run `python -m cli.retrain` weekly
- GitHub Actions workflow to run on PR merge
- Webhook endpoint to trigger retrain from data pipeline completion
- Email/Slack notification on promotion or rejection

These are NOT in scope for this plan. They will be addressed in a future plan.
