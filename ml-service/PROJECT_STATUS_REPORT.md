# ML Service — Project Status Report

## Overview

The ML service is a car price prediction system for the Egyptian used-car market. It consists of:
- **Data pipeline**: Raw scraping → cleaning → lookup enrichment → processed data
- **Model training**: XGBoost/LightGBM quantile regression + sklearn baseline models
- **Backend API**: FastAPI service that loads trained models and serves price predictions with confidence intervals

---

## Phase 1: Make/Model Canonicalization & Lookup Conflict Resolution

### Problem
The lookup tables (`car_specs_lookup_full_cleaned.csv`, `AI_lookup.csv`) and raw data had pervasive inconsistencies:
- **Wrong make-model pairings**: Cars listed under the wrong manufacturer (e.g., "Toyota Cruze" should be "Chevrolet Cruze", "Volkswagen Tiggo" should be "Chery Tiggo", "Ford Echo" should be "Toyota Echo", "Fiat Polo" should be "Volkswagen Polo", "Fiat Jetta" should be "Volkswagen Jetta", "Suzuki Fit" should be "Honda Fit", "Mini Benni" / "Chana Benni" should be "Changan Benni")
- **Inconsistent capitalization**: "Grand vitara" vs "Grand Vitara", "Rx5" vs "RX5", "Cr V" vs "CRV", "Ds4" vs "DS4", "XTrail" vs "X-Trail", "Cool Ray" vs "Coolray", "U5 plus" vs "U5 Plus", "S Presso" vs "S-Presso"
- **KGM Torres** → should be **SsangYong Torres** (brand rename)
- **Fantasy/invalid entries**: Kia Saipa (Saipa is a separate brand), Renault Rainbow (doesn't exist), Skoda Fantasia (should be Fabia), Hyundai X3 (BMW model), Hyundai A1 / Mercedes A1 (Audi model), Chevrolet 300 (Chrysler model), Daihatsu Rio / Suzuki Rio (Kia Rio), Suzuki Maruti (Maruti is a brand)

### Solution — Script: `src/fix_lookups_make_model.py`
- Loads canonical rules from `src/config/canonical_rules.yaml`
- Applies **wrong-pair fixes** (reassigning make+model to correct pair)
- Applies **canonicalize_pair** fixes (normalizing capitalization/formatting)
- **Quarantines** invalid entries (54 rows moved to `quarantine.csv`)
- **Collapses safe duplicates** (7 groups where canonicalization created identical rows)
- **Enriches `model_family`** column for all rows (e.g., "Tiggo 7 Pro Max" → model_family "Tiggo 7")
- **Detects merge conflicts** — groups where same (make, model, year) has different spec values (kept as-is for manual review)

### Result
- 104 canonicalization fixes applied
- 54 invalid rows quarantined
- 7 duplicate groups collapsed
- 46 merge conflicts flagged (handed off to next script)

---

## Phase 2: Spec Conflict Resolution (Chery/Daewoo/Chevrolet/Changan)

### Problem
After canonicalization, 46 groups had the same `(make, model, year)` with **different spec values** (engine_cc, horsepower, body_type, etc.). Key conflicts:
- **Chery Tiggo**: Multiple years had 2 rows with different engine_cc/horsepower (e.g., 2023 Chery Tiggo had both 1600cc/114hp and 1500cc/113hp)
- **Daewoo Lanos**: Conflicting engine specs for same year
- **Chevrolet Cruze**: Conflicting specs for 2012 and 2014
- **Changan Benni**: Conflicting specs for 2008, 2015, 2016
- Many other makes with duplicate-key rows having different transmission/fuel/engine values

### Solution — Script: `src/fix_car_specs_lookup_full.py`
- Applies **deterministic spec correction rules** hardcoded for known conflict groups
- For each conflict, picks the authoritative spec based on research (e.g., Chery Tiggo 2023 → 1500cc/113hp is the correct Egyptian market spec)
- After corrections, **deduplicates** exact-duplicate rows
- Operates in-place on the `.fixed.csv` with `.bak` backup

### Result
- **46 → 0 ambiguous groups** in the main lookup
- Lookup reduced from ~4184 to 4110 rows
- All Chery, Daewoo, Chevrolet, Changan conflicts fully resolved

---

## Phase 3: EV Fuel/Transmission Fixes

### Problem
Some EV models in the AI lookup had incorrect fuel or transmission values:
- EVs listed with `fuel=petrol` instead of `fuel=electric`
- EVs listed with `transmission=Manual` instead of `transmission=Automatic`

### Solution — Script: `src/fix_car_main_info_ev_fuel.py`
- Identifies pure EV models (engine_cc == 0 or known EV make/model combinations)
- Enforces `fuel=electric` and `transmission=Automatic` for those rows
- Operates on `AI_lookup.fixed.csv`

### Result
- Tesla: all 12 rows correctly show electric + Automatic
- BYD: mixed (correct — they sell both EV and ICE)
- BMW: mixed (correct — they sell both EV and ICE)

### Note on DSG/CVT
The AI lookup still contains `Dsg` and `Cvt` as transmission values. These are valid transmission subtypes (DSG = Direct Shift Gearbox, CVT = Continuously Variable Transmission). The data cleansing notebook normalizes these to `Automatic` during the imputation step, so they don't cause issues downstream.

---

## Phase 4: Impossible Model-Year Cleaning

### Problem
Some lookup entries had years that predate the model's actual production start (e.g., Audi Q4 E-Tron listed before 2021 when it was first produced).

### Solution — Script: `src/clean_impossible_model_years.py`
- Maintains authoritative rules for model production year ranges
- Supports `drop`, `flag`, or `clamp` actions for out-of-range years
- Used in both the lookup cleaning and the raw data pipeline

### Result
- No additional rows removed from the main lookup (earlier steps had already handled most)
- The script is also integrated into the raw data pipeline (Step 5)

---

## Phase 5: Raw Data Pipeline Cleaning

### Problem
The raw scraped data (`cars_with_make_model.csv`) had the same canonicalization issues as the lookups, plus:
- No `model_family` column
- EV fuel/transmission inconsistencies
- Impossible model-year combinations

### Solution — Script: `src/clean_raw_data_pipeline.py`
- Master pipeline that applies all cleaning operations to raw listing data:
  1. Make/model canonicalization (using same rules as lookup fix)
  2. EV fuel/transmission fixes
  3. Impossible model-year cleaning
  4. Merge validation (ensures raw data can join with lookup without row inflation)
- Supports `--report` (dry-run) and `--apply` modes
- Creates `.bak` backup before overwriting

### Result
- 26,556 → 26,361 rows (~195 removed)
- `model_family` column added with 0 nulls
- All wrong pairs fixed (no Toyota Cruze, VW Tiggo, etc. remaining)
- All canonical forms updated (no "Grand vitara", "Rx5", etc. remaining)

---

## Phase 6: Data Cleansing Notebook (02_data_cleansing.ipynb)

This notebook takes the cleaned raw data and produces `processed_data.csv`. Key operations:
- **Drop duplicates** (ignoring id, location, scraped_at, title)
- **Categorical standardization** + drop Other/Unknown makes
- **Year null recovery** (extract from title → mode per make+model → drop unresolved)
- **Hard filters**: year 1975–2026, price 20K–20M, mileage 0–500K, old cars with <5K mileage, 2026 cars with >30K mileage, 2025 cars with >70K mileage, 2024 cars with >120K mileage
- **Inconsistency fixes**: EV fuel enforcement using lookup specs, ultra-rare minority categorical fixes
- **Fuel imputation**: mode within (make, model, year, transmission) → fallback (make, model) → drop
- **Transmission imputation**: mode within (make, model, year, fuel) → fallback (make, model) → drop
- **Location normalization** into 17 standard categories
- **Rare filter**: drop make+model combinations with count < 5
- **Merge with lookup** to add: engine_cc, horsepower, body_type, drivetrain, seating_capacity, brand_origin, car_segment, brand_market_share, model_family
- **Derived features**: `car_age`, `mileage_per_year`, `price_egp_log`

### Important Note
After re-running with the fixed lookups, the output `processed_data.csv` will now include `model_family` (previously absent). The training notebook (05) explicitly drops `car_age` (redundant with `year`) and does NOT use `model_family` as a feature.

---

## Phase 7: Model Training Notebook (05_xgboost_lgbm_quantile.ipynb)

### Architecture
- **Quantile regression** using both LightGBM and XGBoost
- Produces 3 predictions per input: **lower bound** (q=0.1), **median** (q=0.5), **upper bound** (q=0.9)
- This gives natural **confidence intervals** and **negotiation ranges**
- Multiple train/val/test splits evaluated
- **Optuna hyperparameter tuning** for each quantile model

### Feature Engineering
- Target: `price_egp_log` (log-transformed price)
- Features: make, model, year, mileage_km, mileage_per_year, transmission, fuel, location, engine_cc, horsepower, body_type, drivetrain, seating_capacity, brand_origin, car_segment, brand_market_share
- **Dropped**: `car_age` (redundant with year), `model_family` (not used as feature), `price_egp` (target)
- Categorical encoding: LabelEncoder for tree-based models
- No one-hot encoding needed (tree models handle ordinals naturally)

### Evaluation
- Per-price-tier evaluation (budget, mid-range, premium, luxury)
- Per-make diagnostics
- Coverage analysis (what % of actual prices fall within the prediction interval)
- Heatmaps and visualization plots

### Artifact Saving
- Model pickles → `models/pickles/`
- Metadata JSON → `models/metadata/`
- Metrics CSVs → `models/metrics/`
- Preprocessors → `models/preprocessors/`
- Plots → `models/plots_05_xgboost_lgbm_quantile/`
- Model registry → `models/model_registry.json`

---

## Phase 8: Backend Inference Readiness

### Feature Builder (`app/services/feature_builder.py`)
- Transforms raw API input `(make, model, year, mileage_km, transmission, fuel, location)` into model-ready features
- **Canonicalizes** make/model using the same rules as the cleaning scripts
- **Joins with car specs lookup** to fill engine_cc, horsepower, body_type, drivetrain, seating_capacity, brand_origin, car_segment, brand_market_share
- **Engineers derived features**: `mileage_per_year`
- **Handles missing values**: fills transmission/fuel from lookup mode, location with "Cairo"

### Predictor Service (`app/services/predictor.py`)
- Loads the **active model from the registry** on startup
- Supports two model types:
  - **Quantile models** (dict of {lower, median, upper} models) → produces confidence intervals and negotiation ranges
  - **Single sklearn models** (Pipeline with ColumnTransformer) → produces point estimate with ±15% negotiation range
- **Framework detection**: XGBoost, LightGBM, or sklearn — each has different prediction paths
- **sklearn 1.6+ pickle compatibility shim**: Old pickles reference `sparse_to_dense` which was removed in sklearn 1.6 and the module path changed in sklearn 1.8 (`_sparsefuncs` → `sparsefuncs`). The shim dynamically registers the missing function before `joblib.load`
- For sklearn Pipeline models: passes raw features directly (the Pipeline's ColumnTransformer handles encoding internally)
- For XGBoost: uses `prepare_for_xgboost()` + `DMatrix`
- For LightGBM: uses `prepare_for_lightgbm()` + direct predict

### Model Registry (`app/core/model_registry.py`)
- JSON-based registry at `models/model_registry.json`
- Supports both **legacy format** (inline `active_model` dict) and **new format** (`active_model_id` referencing a model entry)
- Legacy entries are enriched with artifact paths from metadata JSON files
- Helper functions: `get_active_model_info()`, `register_model()`, `set_active_model()`

### API Endpoint (`app/api/predict.py`)
- Validates that `(make, model, year)` exists in the valid cars set
- Calls `predict_price()` from predictor service
- Returns: predicted price (exp of log), lower/upper bounds, negotiation range, confidence level
- **Confidence level**: "high" for quantile models, "medium" for single sklearn models

### Schema (`app/schemas/prediction.py`)
- `mileage_km`, `transmission`, `fuel`, `location` are **optional** — the feature builder fills them from lookup data if not provided

### Configuration (`app/core/config.py`)metrics_dir`, `
- Added model artifact directory properties: `pickles_dir`, `metadata_dir`, `preprocessors_dir`, `plots_dir`, `registry_path`
- All paths derived from `settings.project_root`

---

## Key Concepts

### Quantile Regression
- Instead of predicting a single price, predicts 3 quantiles: 10th percentile (lower), 50th (median), 90th (upper)
- The interval [lower, upper] naturally represents price uncertainty
- **Negotiation range**: [lower, median] is the buyer's negotiation space
- **Coverage**: % of actual prices falling within the predicted interval (target: ~80%)

### Model Registry
- Central JSON file tracking all trained models, their artifacts, hyperparameters, and which one is "active"
- Allows swapping models without code changes — just update the registry
- Each model entry has: version, framework, quantile, metrics, artifact paths

### Canonicalization
- Make/model strings are normalized to a single canonical form across all data sources
- Rules defined in `src/config/canonical_rules.yaml`
- Applied consistently in: lookup fixing scripts, raw data pipeline, feature builder (inference)
- This ensures the API input "toyota cruze" gets corrected to "chevrolet cruze" before lookup

### Merge Validation
- When joining raw data with lookup on `(make, model, year)`, ambiguous lookup entries (multiple rows per key) would cause row inflation
- The cleaning scripts resolve all ambiguities before the merge, ensuring 1:1 joins

---

## Current Data State (After All Cleaning)

| File | Rows | Key Columns |
|------|------|-------------|
| `car_specs_lookup_full_cleaned.fixed.csv` | 4,110 | make, model, model_family, year, engine_cc, horsepower, body_type, drivetrain, seating_capacity, brand_origin, car_segment, brand_market_share |
| `AI_lookup.fixed.csv` | 5,680 | make, model, model_family, year, transmission, fuel, engine_cc, horsepower, body_type, drivetrain, seating_capacity, brand_origin, car_segment |
| `cars_with_make_model.csv` | 26,361 | id, title, make, model, model_family, year, mileage_km, transmission, fuel, price_egp, location, scraped_at |
| `main_car_info_for_backend.csv` | 5,647 | make, model, year, fuel, transmission |
| `quarantine.csv` | 54 | Invalid/fantasy entries removed from lookup |

- **0 ambiguous groups** in main lookup (was 46 before cleaning)
- **0 model_family nulls** across all files
- All wrong make-model pairs fixed
- All canonical forms standardized

---

## Remaining Steps (User Action Required)

1. **Run `02_data_cleansing.ipynb`** — Restart & Run All → produces `data/processed/processed_data.csv`
2. **Run `05_xgboost_lgbm_quantile.ipynb`** — Restart & Run All → trains models, saves artifacts, updates registry
3. **(Optional) Run `06_ensemble_experiments.ipynb`** — ensemble experiments
4. **Test API** — `uvicorn app.main:app --reload` + curl test

---

## Known Limitations / Future Work

- **Confidence level** is currently hardcoded ("high" for quantile, "medium" for single). Should be based on per-make sample size and accuracy metrics.
- **DSG/CVT transmission values** in AI lookup are not normalized to "Automatic" — the data cleansing notebook handles this, but the backend feature builder may need to handle it too if users pass these values.
- **Chevrolet 300** was quarantined (it's actually a Chrysler 300). If the raw data has Chevrolet 300 listings, they won't match any lookup entry after cleaning. May need a wrong-pair fix for this in the raw data pipeline too.
- **Location normalization** in the feature builder is basic — the notebook has a more sophisticated mapping.
