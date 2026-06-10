# Plan 3 Implementation Notes — Retrain Runner

> **Completed**: 2026-06-09  
> **Status**: ✅ **DONE**  
> **Result**: A reproducible retrain runner was implemented, exercised on dataset tag `2026-06-03_008`, registered as `v2_2026-06-03_008`, and promoted to active production model `v2.1.0`.

---

## What Was Done

### Step 3.1 — Single Retrain Entry Point

**Implemented path**: `scripts/retrain/run.py`

The original plan was written as a `cli/...` suite. The actual implementation uses a single orchestrator under `scripts/retrain`, which is closer to the final approved design.

**Supported runner arguments**:
- `--dataset-tag`
- `--data-path`
- `--no-promote`
- `--model-id-suffix`
- `--output-tag`
- `--dry-run`
- `--skip-cv`
- `--grouped-cv`
- `--force-retrain`

**Important design difference from the original Plan 3 draft**:
- No `cli/` package was created
- No `--tune` flow was added
- No config-switching framework was added
- The implementation was intentionally narrowed to a **single frozen recipe runner**

---

### Step 3.2 — Modular Retrain Package

**Directory created**: `scripts/retrain/`

**Files implemented**:
- `__init__.py`
- `constants.py`
- `contracts.py`
- `data_source.py`
- `validate.py`
- `splitters.py`
- `trainer.py`
- `predictor.py`
- `evaluation.py`
- `cv.py`
- `diagnostics.py`
- `gates.py`
- `run.py`

**Not created as separate modules**:
- `feature_recipe.py`
- `artifacts.py`
- `registry_ops.py`
- `history.py`
- `drift.py`

These responsibilities are partly implemented inline inside `run.py` or intentionally deferred.

---

### Step 3.3 — Frozen 07c Recipe in Code

**Files implemented**:
- `scripts/retrain/constants.py`
- `scripts/retrain/contracts.py`
- `scripts/retrain/trainer.py`

The retrain runner wraps the final selected V2 recipe:
- target: `price_egp_log`
- split: `price_stratified`
- random state: `42`
- validation fraction: `0.10`
- quantiles: `q05`, `q10`, `q50`, `q90`, `q95`
- ensemble weights: `0.55` XGBoost / `0.45` LightGBM
- feature surface: V1 features only

This matches the frozen production recipe rather than the older generic CLI concept.

---

### Step 3.4 — Data Loading and Validation

**Files implemented**:
- `scripts/retrain/data_source.py`
- `scripts/retrain/validate.py`

The runner supports:
- dataset-driven loading via `--dataset-tag`
- explicit path override via `--data-path`
- schema checks
- required column checks
- target availability checks
- row-count and null validation

**Verified in run logs**:
- data loaded successfully for `2026-06-03_008`
- validation passed before every retrain execution

---

### Step 3.5 — Training, Holdout Evaluation, and CV

**Files implemented**:
- `scripts/retrain/splitters.py`
- `scripts/retrain/trainer.py`
- `scripts/retrain/predictor.py`
- `scripts/retrain/evaluation.py`
- `scripts/retrain/cv.py`
- `scripts/retrain/diagnostics.py`
- `scripts/retrain/gates.py`

**Implemented outputs**:
- holdout global metrics
- per-tier holdout metrics
- per-make holdout metrics
- per-make-model holdout metrics
- KFold CV overall metrics
- per-tier CV metrics
- per-make-model CV diagnostics
- OOF predictions
- diagnostics summary for holdout and CV

**Additional improvement beyond the original draft**:
- grouped CV was added as an **optional** secondary report via `--grouped-cv`
- detailed `diagnostics_summary` percentages were added to registry/history

---

### Step 3.6 — Versioned Metrics and Cache

**Implemented in**: `scripts/retrain/run.py`

This was not part of the older Plan 3 text, but it was requested and implemented.

**New behavior**:
- all run-specific metrics are written under `models/metrics/<dataset_tag>/`
- training cache stored at `models/cache/<dataset_tag>/training_cache.joblib`
- CV cache stored at `models/cache/<dataset_tag>/cv_cache.joblib`
- repeated runs with the same dataset tag reuse cached artifacts unless `--force-retrain` is set

**Verified**:
- cache hit logs were observed on rerun
- rerun completed in ~3.3 seconds

---

### Step 3.7 — Artifact Export and Registry Integration

**Implemented in**: `scripts/retrain/run.py`

**Artifacts exported**:
- `models/pickles/xgb_quantile_<tag>.joblib`
- `models/pickles/lgbm_quantile_<tag>.joblib`
- `models/pickles/ensemble_<tag>.joblib`
- `models/pickles/label_encoders_<tag>.joblib`
- `models/metadata/ensemble_<tag>.json`
- `models/metadata/make_model_mape.csv`
- metrics JSON/CSV outputs under `models/metrics/<tag>/`

**Registry/history integration**:
- model registered into `models/model_registry.json`
- training run appended to `models/training_history.json`
- diagnostics summary persisted in both registry and history
- all stored paths remain **relative**

**Verified run result**:
- model id: `v2_2026-06-03_008`
- version: `v2.1.0`
- first registered as candidate
- later promoted to active production model

---

### Step 3.8 — Serving Compatibility Hardening

**Implemented behavior**:
- 5-quantile sub-model pickles preserve original keys: `q05`, `q10`, `q50`, `q90`, `q95`
- serving-safe aliases are also exported:
  - `lower = q05`
  - `median = q50`
  - `upper = q95`

This made the new retrained model loadable by the current service without breaking the API contract.

---

## Files Created or Updated by This Work

### New retrain package files
- `scripts/retrain/__init__.py`
- `scripts/retrain/constants.py`
- `scripts/retrain/contracts.py`
- `scripts/retrain/data_source.py`
- `scripts/retrain/validate.py`
- `scripts/retrain/splitters.py`
- `scripts/retrain/trainer.py`
- `scripts/retrain/predictor.py`
- `scripts/retrain/evaluation.py`
- `scripts/retrain/cv.py`
- `scripts/retrain/diagnostics.py`
- `scripts/retrain/gates.py`
- `scripts/retrain/run.py`

### Files updated during completion/fix phase
- `scripts/retrain/contracts.py`
- `scripts/retrain/diagnostics.py`
- `scripts/retrain/run.py`

### Runtime/registry artifacts produced and verified
- `models/model_registry.json`
- `models/training_history.json`
- `models/metadata/ensemble_2026-06-03_008.json`
- `models/metadata/make_model_mape.csv`
- `models/pickles/xgb_quantile_2026-06-03_008.joblib`
- `models/pickles/lgbm_quantile_2026-06-03_008.joblib`
- `models/pickles/ensemble_2026-06-03_008.joblib`
- `models/pickles/label_encoders_2026-06-03_008.joblib`

---

## Verification Performed

### Retrain verification
- successful retrain execution on `2026-06-03_008`
- successful cache reuse on rerun
- successful artifact export
- successful registry entry creation
- successful history append

### Runtime verification
- model promoted to active production model
- active registry pointer updated to `v2_2026-06-03_008`
- `model_state.load_active_model()` succeeded
- ensemble SHAP explainer initialized successfully
- predictions succeeded for multiple cars
- diagnostics CSV loaded successfully
- container/API prediction test returned `model_version: v2.1.0`
- API explanation output returned confidence, negotiation range, and price factors correctly

---

## Important Fixes Made During Implementation

### 1. Label encoder export crash
**Issue**:
- `AttributeError: 'EnsembleArtifact' object has no attribute 'encoders'`

**Fix**:
- corrected `run.py` to use `artifact.label_encoders`

### 2. JSON serialization for diagnostics summary
**Issue**:
- `numpy.float64` values were not JSON serializable

**Fix**:
- converted summary values to native Python `float`

### 3. Final production verification
**Result**:
- the model is now active in the registry and confirmed working through the running API

---

## What Was Intentionally Not Implemented From the Original Draft

These are not bugs; they were either superseded by the approved design or intentionally deferred:

- no `cli/` package
- no `--tune` mode
- no config-path switching system
- no `combo_set_<tag>.json` export
- no drift baseline/report module yet
- no old-style `auto_promote / warn / hard_reject + --force` lifecycle

The final shipped design is the simpler and safer retrain runner under `scripts/retrain`.

---

## Final Outcome

Plan 3 is complete in practical production terms.

The retrain system now provides:
- reproducible retraining
- automatic evaluation
- artifact export
- registry/history integration
- cached reruns
- serving-compatible V2 artifacts
- production activation of the new model

The deployed active model after verification is:
- **Model ID**: `v2_2026-06-03_008`
- **Version**: `v2.1.0`
- **Stage**: `production`
