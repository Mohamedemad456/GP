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

### Problem 5: No Data Versioning
- All cleaning scripts read/write **fixed paths** (`data/raw/cars_with_make_model.csv`, `data/processed/processed_data.csv`)
- Each `--apply` overwrites the previous file (only a `.bak` backup survives)
- No way to know: *which raw snapshot produced this processed file?*
- No way to reproduce a previous training run from the exact same data
- No manifest tracks version history or current pointer
- **Impact**: Cannot audit data lineage, cannot rollback, cannot compare model trained on v1 data vs v2 data

---

## Architecture

```
cli/retrain.py
├── load_processed_data()       # load latest version via VersionManager
├── compute_features()          # mm_price_tier, make_model_count, etc.
├── split_data()                # GroupShuffleSplit (train/cal/test)
├── train_models()              # XGB + LGBM with fixed hyperparams
├── calibrate_cqr()            # CQR on calibration set
├── evaluate()                  # Full metrics on test set
├── compare_with_current()     # Is new model better?
├── export_artifacts()         # Pickles, metadata, lookups
└── promote_model()            # Update registry if metrics pass

data_pipeline.py  (orchestrates the full ETL)
├── pull_raw_snapshot()         # data_loader.py → data/raw/snapshots/cars_YYYY-MM-DD.csv
├── clean_snapshot()            # clean_raw_data_pipeline.py → data/cleaned/cars_cleaned_YYYY-MM-DD.csv
├── build_processed()           # generate_processed_data.py → data/processed/versions/processed_YYYY-MM-DD.csv
└── fingerprint_check()         # skip if input unchanged (SHA-256)
```

**Key principle**: The CLI uses the SAME logic as the notebook but without interactivity. Hyperparameters are frozen from the Optuna-tuned values found in Plan 3.

### Versioned Data Strategy

**Version tag format**: `YYYY-MM-DD` (date of pull). Same-day re-pull appends a sequence suffix: `2026-05-24`, `2026-05-24.2`, `2026-05-24.3`.

Each data pull → clean → process cycle produces **immutable versioned files**.
No versioned file is ever modified after creation — new data = new version.

```
data/
├── raw/
│   ├── snapshots/                              # immutable raw pulls
│   │   ├── cars_raw_2026-05-01.csv
│   │   └── cars_raw_2026-05-24.csv
│   └── cars_with_make_model.csv                # ← COPY of latest (backward compat)
├── cleaned/                                    # immutable cleaned layer
│   ├── cars_cleaned_2026-05-01.csv
│   └── cars_cleaned_2026-05-24.csv
├── processed/
│   ├── versions/                               # immutable processed layer
│   │   ├── processed_2026-05-01.csv
│   │   └── processed_2026-05-24.csv
│   └── processed_data.csv                      # ← COPY of latest (backward compat)
├── lookups/                                    # reference data (rarely changes)
└── data_manifest.json                          # ← single source of truth for versions
```

**Backward compatibility**: The fixed-path files (`cars_with_make_model.csv`, `processed_data.csv`) are always a **copy** of the latest versioned file. Existing scripts, notebooks, and the API service continue to read from fixed paths. The versioning is invisible to consumers.

**`data_manifest.json`** (single source of truth):
```json
{
  "current_version": "2026-05-24",
  "versions": {
    "2026-05-24": {
      "tag": "2026-05-24",
      "created_at": "2026-05-24T16:18:38",
      "raw_path": "data/raw/snapshots/cars_raw_2026-05-24.csv",
      "cleaned_path": "data/cleaned/cars_cleaned_2026-05-24.csv",
      "processed_path": "data/processed/versions/processed_2026-05-24.csv",
      "raw_fingerprint": "sha256:a1b2c3...",
      "raw_rows": 26361,
      "cleaned_rows": 22969,
      "processed_rows": 20215,
      "model_trained_on": "ensemble_v2_20260524"
    }
  }
}
```

### Data Accumulation Strategy

> **Clarification**: "Incremental" here means **accumulating data across snapshots**, NOT
> incremental ML training (warm-start, online learning). The model always retrains from scratch
> on the full accumulated dataset.

**Why accumulate, not replace?**
We pull from active marketplace listings. Each snapshot shows only currently active listings:
- Snapshot 1 (month 1): 26K active listings
- Snapshot 2 (month 2): 18K active listings (some sold, some new)
- Snapshot 3 (month 3): 16K active listings

If you train on only the latest snapshot, you lose all the "sold cars" which are legitimate
historical data points. Sold cars represent real completed transactions — the most trustworthy
price data. Accumulating snapshots grows the training set over time as more cars transact.

**Cross-snapshot deduplication rule**:

| Case | Action |
|------|--------|
| Same (make, model, year, mileage_km, price_egp) in two snapshots | Keep one, preserve earliest `scraped_at` |
| Same car, price changed between snapshots | Keep **both** — repricing is a legitimate data point |
| Car disappears (sold) | Already in training from when it was active |

**`scraped_at` as a temporal feature**:
The date the listing was scraped captures market conditions at that moment:
- EGP devaluation trends (prices rising in nominal terms)
- Seasonal demand (Ramadan, summer, post-harvest)
- Supply shocks (new import quotas, model launches)

At training time: use `scraped_at` → `days_since_baseline` as a feature.
At inference time: pass today's date as `scraped_at` — "predict for current market conditions."

This is detailed further in Plan 2 (Feature 2.6).

**Strategy comparison**:

| Strategy | Training Data | Trend Capture | Complexity |
|----------|--------------|---------------|------------|
| Latest snapshot only | 16-26K rows | None | Lowest |
| **Accumulated snapshots** (recommended) | grows over time | Via `scraped_at` | Low |
| Incremental ML (warm-start) | N/A | N/A | Very High, not justified |

**Scope for Plan 5**: Full retrain on accumulated + deduplicated data from all versions in
`data_manifest.json`. The `data_pipeline.py` accumulation step merges all `processed/versions/*.csv`
files, deduplicates cross-snapshot, and produces a single training CSV.

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

### Step 5.5 — Version Manager Helper ✅ *Implemented 2026-05-24*

**File**: `scripts/cleaning/version_manager.py`

Central helper module that all cleaning/pipeline scripts import to resolve
versioned paths. This is the **only file that knows the naming convention
and manifest location** — no other script hardcodes version logic.

```python
@dataclass
class DataVersion:
    tag: str                  # "2026-05-24"
    raw_path: Path            # data/raw/snapshots/cars_raw_2026-05-24.csv
    cleaned_path: Path        # data/cleaned/cars_cleaned_2026-05-24.csv
    processed_path: Path      # data/processed/versions/processed_2026-05-24.csv
    fingerprint: str | None   # SHA-256 of raw file
    created_at: str | None

class VersionManager:
    """Read/write data_manifest.json. Resolve versioned paths."""

    def next_tag(self) -> str:
        """Generate tag for today. Appends .2, .3 if same-day re-pull."""

    def resolve(self, tag: str) -> DataVersion:
        """Return all paths for a given version tag."""

    def latest(self) -> DataVersion:
        """Return the current (latest) version from manifest."""

    def register(self, version: DataVersion) -> None:
        """Add a version to the manifest and set it as current."""

    def set_current(self, tag: str) -> None:
        """Point 'current_version' to an existing tag (for rollback)."""

    def update_current_copies(self, version: DataVersion) -> None:
        """Copy versioned files to fixed-path locations for backward compat."""

    def fingerprint_file(self, path: Path) -> str:
        """SHA-256 fingerprint of a CSV file (reuses data_loader.py pattern)."""

    def list_versions(self) -> list[DataVersion]:
        """All versions in the manifest, newest first."""
```

**Design decisions**:
- **Date-based tags** (not v1/v2) — self-documenting, naturally ordered
- **Copy** latest to fixed paths (not symlink) — symlinks break on Windows and in Docker bind mounts
- **Manifest is the truth** — file system is just storage; if manifest says "2026-05-24" is current, that's what the pipeline uses
- **No auto-cleanup** — old versions remain until manually pruned

### Step 5.6 — Data Pipeline Orchestrator ✅ *Implemented 2026-05-24*

**File**: `scripts/cleaning/data_pipeline.py`

Orchestrates the full ETL from Supabase pull to versioned processed data.
Each run produces a new set of immutable versioned files. It wraps the
existing cleaning scripts (does NOT duplicate their logic).

```python
def run_pipeline(date_tag: str | None = None, skip_pull: bool = False):
    """Full ETL: raw pull → clean → process → version."""
    vm = VersionManager()
    tag = date_tag or vm.next_tag()
    version = vm.resolve(tag)

    # 1. Pull raw snapshot (calls data_loader.py)
    if not skip_pull:
        subprocess.run(["python", "scripts/data/data_loader.py", "--output", str(version.raw_path)])

    # 2. Fingerprint check — skip if raw data unchanged since last processed version
    new_fp = vm.fingerprint_file(version.raw_path)
    if vm.latest() and new_fp == vm.latest().fingerprint:
        log.info("Raw data unchanged since %s — skipping.", vm.latest().tag)
        return

    # 3. Clean snapshot (calls clean_raw_data_pipeline.py on the versioned raw file)
    shutil.copy2(version.raw_path, version.cleaned_path)  # start from raw copy
    subprocess.run(["python", "scripts/cleaning/clean_raw_data_pipeline.py",
                    "--mode", "apply", "--input", str(version.cleaned_path)])

    # 4. Build processed data (calls generate_processed_data.py with versioned paths)
    subprocess.run(["python", "scripts/cleaning/generate_processed_data.py",
                    "--apply", "--raw", str(version.cleaned_path),
                    "--output", str(version.processed_path)])

    # 5. Register version + update fixed-path copies
    version.fingerprint = new_fp
    vm.register(version)
    vm.update_current_copies(version)
```

**Usage**:
```bash
python scripts/cleaning/data_pipeline.py                    # full ETL for today
python scripts/cleaning/data_pipeline.py --date 2026-05-24  # specific date tag
python scripts/cleaning/data_pipeline.py --skip-pull        # clean+process only
python scripts/cleaning/data_pipeline.py --rollback 2026-05-01  # point current to old version
```

### Step 5.7 — Registry Update

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
── Data ETL (data_pipeline.py) ──────────────────────────────────

1. Pull raw snapshot from Supabase
   ↓
2. Fingerprint check (skip if unchanged)
   ↓
3. Clean snapshot (5-stage pipeline)
   ↓
4. Build processed data (merge + features)
   ↓
5. Write versioned files (immutable)
   ↓
6. Update current symlinks

── Model Retraining (cli/retrain.py) ────────────────────────────

7. Load latest processed data
   ↓
8. Validate data schema (columns, types, no NaN in critical fields)
   ↓
9. Compute V2 features (log_mileage_km, mileage_ratio, year_bucket)
   ↓
10. GroupShuffleSplit → train/calibration/test
    ↓
11. Compute mm_price_tier + make_model_count from train split
    ↓
12. Apply lookups to all splits
    ↓
13. Compute sample weights
    ↓
14. Train XGB (5 quantiles) with frozen params
    ↓
15. Train LGBM (5 quantiles) with frozen params
    ↓
16. Ensemble predictions on calibration + test sets
    ↓
17. CQR calibration on calibration set
    ↓
18. Evaluate on test set (full metrics)
    ↓
19. Compare with current production model
    ↓
20. IF passes gates → export artifacts → update registry
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
| Manifest and file system get out of sync | Orphaned files or missing versions | Manifest is truth; add `--verify` command to check consistency |
| Disk fills up with old versions | Storage exhaustion | No auto-cleanup; add `--prune --keep N` to manually trim old versions |

---

## Files Created by This Plan

| File | Purpose |
|------|---------|
| `scripts/cleaning/version_manager.py` | Version tag generation, manifest I/O, path resolution | ✅ Done |
| `scripts/cleaning/data_pipeline.py` | Full ETL orchestrator (pull → clean → process → version) | ✅ Done |
| `data/data_manifest.json` | Single source of truth for data version history | ✅ Seeded |
| `cli/retrain.py` | Main retraining entry point |
| `cli/configs/v2_hyperparams.json` | Frozen hyperparameters |
| `cli/configs/promotion_gates.json` | Metric thresholds for promotion |

---

## Success Criteria

**Data versioning**:
- [x] `data_manifest.json` correctly tracks all versions
- [x] `version_manager.py` resolves paths for any tag
- [x] `data_pipeline.py` produces immutable versioned files at correct paths
- [x] Fixed-path files (`cars_with_make_model.csv`, `processed_data.csv`) are copies of latest version
- [x] Fingerprint check skips re-processing when raw data is unchanged
- [x] `--rollback <tag>` correctly points current to an older version

**Retraining**:
- [ ] `python -m cli.retrain --dry-run` shows correct plan
- [ ] `python -m cli.retrain --no-promote` trains and evaluates successfully
- [ ] Metrics from CLI match metrics from notebook (within 0.1% due to randomness)
- [ ] `python -m cli.retrain` promotes model and updates registry
- [ ] Service starts with newly promoted model
- [ ] All existing tests pass after promotion
