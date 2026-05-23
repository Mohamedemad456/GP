# 10 — Unified Implementation Plan (Completed)

**Date:** 2026-05-10

This document captures the full implementation plan that was executed across multiple sessions. It covers everything from data quality fixes through model training to backend inference readiness. Each item includes what was planned, what was implemented, and the current status.

---

## Plan Overview — 6 Work Items

| # | Work Item | Priority | Status |
|---|-----------|----------|--------|
| 1 | Fix make/model canonicalization and lookup conflicts in scripts/rules | High | ✅ Done |
| 2 | Add validation to prevent ambiguous lookup merges and row-count inflation | High | ✅ Done |
| 3 | Add config and registry helper functions | High | ✅ Done |
| 4 | Update notebook 05: no model_family, no car_age, correct artifact/plot paths | High | ✅ Done |
| 5 | Create 06_ensemble_experiments.ipynb | High | ✅ Done |
| 6 | Update backend inference readiness (predict.py, feature_builder.py, predictor.py) | Medium | ✅ Done |

---

## Item 1: Fix Make/Model Canonicalization and Lookup Conflicts

### Problem
The lookup tables and raw data had pervasive inconsistencies causing:
- Wrong make-model pairings (e.g., "Toyota Cruze" should be "Chevrolet Cruze")
- Inconsistent capitalization ("Grand vitara" vs "Grand Vitara", "Rx5" vs "RX5")
- Fantasy/invalid entries (Kia Saipa, Renault Rainbow, Chevrolet 300)
- No `model_family` column in lookup or raw data
- Merge conflicts: same (make, model, year) with different spec values

### Implementation
- Created **canonical rules YAML** (`src/config/canonical_rules.yaml`) with sections:
  - `make_aliases`: variant → canonical make (Chana→Changan, KGM→SsangYong, etc.)
  - `model_aliases_by_make`: per-make model normalization (Honda Cr V→CRV, MG Rx5→RX5, etc.)
  - `wrong_pair_fixes_allowlist`: explicit (make, model) → (make, model) reassignments
  - `valid_exceptions`: entries not to flag/auto-fix
  - `flag_for_deletion`: entries to quarantine (Hyundai X3, Mercedes A1, Chevrolet 300, etc.)
- Created **shared canonicalization module** (`src/make_model_canonical.py`):
  - `norm_key(text)` for robust matching (whitespace collapse, punctuation removal)
  - `canonicalize_make(make)` using make_aliases
  - `canonicalize_model(make, model)` using model_aliases_by_make
  - `canonicalize_pair(make, model)` returns canonical pair + change metadata
- Created **fix script** (`src/fix_lookups_make_model.py`):
  - `--report` mode: dry-run, surfaces all issues
  - `--apply` mode: writes fixed files
  - Fix order: canonicalize → wrong-pair fixes → quarantine → model_family enrichment → collapse safe duplicates → detect merge conflicts → validate
  - Outputs: `car_specs_lookup_full_cleaned.fixed.csv`, `AI_lookup.fixed.csv`, `main_car_info_for_backend.csv`, `quarantine.csv`

### Results
- 104 canonicalization fixes applied
- 54 invalid rows quarantined
- 7 duplicate groups collapsed
- 46 merge conflicts flagged (resolved in Item 2)
- `model_family` assigned to all rows (0 nulls)

### Key Decisions
- Canonical targets: `KGM` → `SsangYong`, `Chana` → `Changan`
- Auto-fix wrong pairs only via curated allowlist (no fuzzy matching)
- Fantasy entries quarantined, not auto-reassigned
- Model hierarchy (BMW 318i vs 320i) explicitly out of scope — left as distinct entries

---

## Item 2: Add Validation to Prevent Ambiguous Lookup Merges and Row-Count Inflation

### Problem
After canonicalization, 46 groups had the same `(make, model, year)` with different spec values. When the data cleansing notebook merges raw data with lookup on these keys, ambiguous entries cause row-count inflation (each raw row matches multiple lookup rows).

Key conflicts:
- **Chery Tiggo**: Multiple years had 2 rows with different engine_cc/horsepower
- **Daewoo Lanos**: Conflicting engine specs for same year
- **Chevrolet Cruze**: Conflicting specs for 2012 and 2014
- **Changan Benni**: Conflicting specs for multiple years
- Many other makes with duplicate-key rows having different transmission/fuel/engine values

### Implementation
- Updated **`src/fix_car_specs_lookup_full.py`** with deterministic correction rules for all 46 conflict groups
- For each conflict, picked the authoritative spec based on Egypt market research
- After corrections, deduplicates exact-duplicate rows
- Operates in-place on `.fixed.csv` with `.bak` backup

### Results
- **46 → 0 ambiguous groups** in the main lookup
- Lookup reduced from ~4184 to 4110 rows
- All Chery, Daewoo, Chevrolet, Changan conflicts fully resolved
- Merge validation: joining raw data with lookup now produces 1:1 matches (no row inflation)

---

## Item 3: Add Config and Registry Helper Functions

### Problem
- No centralized model registry — model artifacts were tracked ad-hoc
- No standard way to load the "active" model or swap models
- Config lacked properties for model artifact directories

### Implementation
- **`app/core/model_registry.py`** — Helper functions:
  - `get_active_model_info()`: retrieves active model metadata from registry JSON
  - Supports both legacy format (inline `active_model` dict) and new format (`active_model_id` referencing a model entry)
  - Legacy entries enriched with artifact paths from metadata JSON files
  - `register_model()`: adds a new model entry to the registry
  - `set_active_model()`: marks a model as active by ID
- **`app/core/config.py`** updates:
  - Added `pickles_dir`, `metadata_dir`, `metrics_dir`, `preprocessors_dir`, `plots_dir`, `registry_path` properties
  - All paths derived from `settings.project_root`

### Results
- Single source of truth for which model is active
- Model swapping without code changes — just update registry JSON
- Each model entry tracks: version, framework, quantile, metrics, artifact paths

---

## Item 4: Update Notebook 05 — No model_family, No car_age, Correct Paths

### Problem
- Notebook 05 was using `car_age` as a feature (redundant with `year`)
- `model_family` was being included as a feature (not desired for tree models)
- Artifact and plot paths were inconsistent
- No per-price-tier evaluation or per-make diagnostics
- Model saving didn't use the registry helper functions

### Implementation
- **Dropped `car_age`** from features (redundant with `year`)
- **Dropped `model_family`** from features (not used as a feature — tree models handle make/model directly)
- Added `PLOT_DIR` alongside `OUT_DIR` for organized plot output
- Updated metadata and registry saving to use helper functions from `model_registry.py`
- Added detailed **per-price-tier evaluation** cells (budget, mid-range, premium, luxury)
- Added **per-make diagnostics** cells
- Added **coverage analysis** (% of actual prices within prediction interval)
- Added **heatmaps and visualization** plots

### Results
- Cleaner feature set: year, mileage_km, mileage_per_year, transmission, fuel, location, engine_cc, horsepower, body_type, drivetrain, seating_capacity, brand_origin, car_segment, brand_market_share
- Organized output: models/pickles/, models/metadata/, models/metrics/, models/preprocessors/, models/plots_05_xgboost_lgbm_quantile/
- Registry updated automatically after training

---

## Item 5: Create 06_ensemble_experiments.ipynb

### Problem
No notebook for experimenting with stacking/ensemble methods combining multiple model types.

### Implementation
- Created `notebooks/06_ensemble_experiments.ipynb`
- Supports combining predictions from LightGBM, XGBoost, and sklearn models
- Ensemble strategies: simple average, weighted average, stacking
- Evaluation against held-out test set

### Results
- Optional notebook for advanced experimentation
- Not required for the main pipeline

---

## Item 6: Update Backend Inference Readiness

### Problem
The backend API was returning dummy predictions. No real model loading, no feature engineering for inference, no handling of different model types (quantile vs single sklearn).

### Implementation — Feature Builder (`app/services/feature_builder.py`)
- Transforms raw API input `(make, model, year, mileage_km, transmission, fuel, location)` into model-ready features
- **Canonicalizes** make/model using the same rules as the cleaning scripts (ensures API input matches training data)
- **Joins with car specs lookup** to fill: engine_cc, horsepower, body_type, drivetrain, seating_capacity, brand_origin, car_segment, brand_market_share
- **Engineers derived features**: `mileage_per_year`
- **Handles missing values**: fills transmission/fuel from lookup mode, location with "Cairo"

### Implementation — Predictor Service (`app/services/predictor.py`)
- Loads the **active model from the registry** on app startup
- Supports two model types:
  - **Quantile models** (dict of {lower, median, upper} models) → produces confidence intervals and negotiation ranges
  - **Single sklearn models** (Pipeline with ColumnTransformer) → produces point estimate with ±15% negotiation range
- **Framework detection**: XGBoost, LightGBM, or sklearn — each has different prediction paths
- **sklearn 1.6+ pickle compatibility shim**: Old pickles reference `sparse_to_dense` which was removed in sklearn 1.6 and the module path changed in sklearn 1.8 (`_sparsefuncs` → `sparsefuncs`). The shim dynamically registers the missing function before `joblib.load`
- For sklearn Pipeline models: passes raw features directly (the Pipeline's ColumnTransformer handles encoding internally — passing pre-encoded features caused a "648 features vs 16 expected" error)
- For XGBoost: uses `prepare_for_xgboost()` + `DMatrix`
- For LightGBM: uses `prepare_for_lightgbm()` + direct predict

### Implementation — API Endpoint (`app/api/predict.py`)
- Validates that `(make, model, year)` exists in the valid cars set
- Calls `predict_price()` from predictor service
- Returns: predicted price (exp of log), lower/upper bounds, negotiation range, confidence level
- **Confidence level**: "high" for quantile models, "medium" for single sklearn models

### Implementation — Schema (`app/schemas/prediction.py`)
- `mileage_km`, `transmission`, `fuel`, `location` are **optional** — the feature builder fills them from lookup data if not provided

### Key Bugs Fixed During Implementation
1. **`AttributeError: module '__main__' has no attribute 'sparse_to_dense'`**: Old sklearn pickles referenced a function removed in sklearn 1.6+. Fixed by registering a compatibility shim in `sys.modules['__main__']` and `sklearn.utils.sparsefuncs` before `joblib.load`.
2. **`ModuleNotFoundError: No module named 'sklearn.utils._sparsefuncs'`**: The initial shim tried importing the old module path which doesn't exist in sklearn 1.8. Fixed with try/except that tries `sparsefuncs` (new) then `_sparsefuncs` (old).
3. **`ValueError: X has 648 features, but ColumnTransformer is expecting 16 features`**: The `_predict_single` function was passing already label-encoded features to an sklearn Pipeline that includes its own ColumnTransformer. Fixed by passing raw features directly to the Pipeline.

---

## Data Cleaning Pipeline Execution Order

The scripts must run in this exact order:

```
1. fix_lookups_make_model.py --apply
   ↓  (canonicalizes make/model, adds model_family, quarantines bad rows)
2. fix_car_specs_lookup_full.py --in-place
   ↓  (resolves spec conflicts for Chery/Daewoo/Chevrolet/Changan)
3. fix_car_main_info_ev_fuel.py --input AI_lookup.fixed.csv --in-place
   ↓  (enforces electric+Automatic for pure EVs)
4. clean_impossible_model_years.py --input car_specs_lookup_full_cleaned.fixed.csv --in-place
   ↓  (removes ghost-year rows)
5. clean_raw_data_pipeline.py --apply
   ↓  (applies all cleaning to raw listing data)
6. 02_data_cleansing.ipynb (Restart & Run All)
   ↓  (produces processed_data.csv)
7. 05_xgboost_lgbm_quantile.ipynb (Restart & Run All)
   ↓  (trains models, saves artifacts, updates registry)
8. (Optional) 06_ensemble_experiments.ipynb
```

---

## Current Data State (After All Cleaning)

| File | Rows | Key Properties |
|------|------|----------------|
| `car_specs_lookup_full_cleaned.fixed.csv` | 4,110 | 0 ambiguous groups, model_family with 0 nulls |
| `AI_lookup.fixed.csv` | 5,680 | model_family present, EV fuel/transmission correct |
| `cars_with_make_model.csv` | 26,361 | model_family with 0 nulls, all wrong pairs fixed |
| `main_car_info_for_backend.csv` | 5,647 | make, model, year, fuel, transmission |
| `quarantine.csv` | 54 | Invalid/fantasy entries removed from lookup |

---

## Known Limitations / Future Work

- **Confidence level** is hardcoded ("high" for quantile, "medium" for single). Should be based on per-make sample size and accuracy metrics.
- **DSG/CVT transmission values** in AI lookup are not normalized to "Automatic" — the data cleansing notebook handles this, but the backend feature builder may need to handle it too.
- **Chevrolet 300** was quarantined (it's actually a Chrysler 300). Raw data with Chevrolet 300 listings won't match any lookup entry. May need a wrong-pair fix in the raw data pipeline.
- **Location normalization** in the feature builder is basic — the notebook has a more sophisticated mapping.
- **Model hierarchy** (BMW 318i vs 320i, etc.) is explicitly deferred — requires product/business decision on granularity.
- **Source data is not ground truth** — the cleaning pipeline improves data significantly but cannot detect wrong spec values within plausible ranges.
