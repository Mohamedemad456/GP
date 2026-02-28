# Sprint Plan — 10-Week Breakdown (23 Tasks)

## Timeline Overview

```
Week 1-2:  DATA FOUNDATION        (EDA + Cleaning + Parsing)
Week 3-4:  FEATURE ENGINEERING     (Lookup + Features + Pipeline)
Week 5-6:  MODEL TRAINING          (Baseline → LightGBM → Tuning → SHAP)
Week 7-8:  API & DEPLOYMENT        (FastAPI → Docker → Deploy)
Week 9-10: POLISH & DEFENSE PREP   (Retrain pipeline + Docs + Demo)
```

**Working capacity:** 20-30 hours/week = ~4-5 hours/day, 5-6 days/week.

---

## Sprint 1: Data Foundation (Week 1-2)

### Goal: Clean dataset ready for feature engineering

| Task ID | Title | Priority | Estimate | Dependencies | Description | Definition of Done |
|---------|-------|----------|----------|-------------|-------------|-------------------|
| DS-001 | Environment setup + Supabase pull | Must-have | 1 day | None | **Files:** `requirements.txt`, `.env`, `src/data_loader.py`. Install all packages, verify LightGBM + Jupyter. Configure `.env` with Supabase credentials. Write `src/data_loader.py` — connect to Supabase, pull raw listings, save as `data/raw/cars_raw.parquet`. | All imports work. `.env` configured. Raw Parquet saved with all rows. |
| DS-002 | Exploratory Data Analysis | Must-have | 2 days | DS-001 | **Files:** `notebooks/01_EDA.ipynb`. Price distribution (histogram + log-scale), missing values heatmap, year/mileage distributions, transmission/fuel value counts, location analysis, price vs year/mileage scatters, top 20 titles. | 10 analyses complete. Key insights documented. Outliers identified. |
| DS-003 | Title parsing with Claude | Must-have | 2 days | DS-002 | **Files:** `src/title_parser.py` → output: `data/lookups/title_parsed.csv`. Send unique titles in batches to Claude API. Extract brand, model, trim. Build known_brands list (30+ brands). Target >95% brand coverage. Log unparsed titles. | title_parsed.csv generated. >95% brand coverage. Unparsed titles reviewed. |
| DS-004 | Data cleaning pipeline | Must-have | 2 days | DS-003 | **Files:** `notebooks/02_data_cleaning.ipynb`, `src/data_cleaner.py` → output: `data/cleaned/cars_cleaned.parquet`. Remove price < 50K / > 20M EGP, handle mileage=0 and transmission="0" (→ NaN), dedup on title+year+mileage+price, standardize locations → governorate → tier (A/B/C), IQR outlier removal per brand+model (1.5× IQR, groups ≥ 10). Log cleaning funnel. | Cleaned Parquet saved. ~5-15% rows removed. Funnel chart shows each step. |


**Sprint 1 Total: ~7.5 days**

### Sprint 1 Checkpoint
At end of Week 2 you should have: clean dataset in Parquet, brand/model parsed (>95%), EDA notebook with insights, understanding of data quality.

---

## Sprint 2: Feature Engineering (Week 3-4)

### Goal: Complete feature set ready for model training

| Task ID | Title | Priority | Estimate | Dependencies | Description | Definition of Done |
|---------|-------|----------|----------|-------------|-------------|-------------------|
| DS-005 | Generate specs lookup via Claude | Must-have | 1 day | DS-004 | **Files:** `src/generate_lookup.py` → output: `data/lookups/car_specs_lookup.csv`. Extract unique (brand, model, year) combos from cleaned data, batch-send to Claude with strict JSON schema (engine_cc, body_type, hp, drivetrain, new_car_price_egp, seating_capacity). Manually validate top 10 brands (5-10 entries each). | Lookup CSV generated. Top 10 brands validated. Errors fixed. |
| DS-006 | Join lookup + engineer derived features | Must-have | 1 day | DS-005 | **Files:** `src/feature_engineering.py`, `notebooks/03_feature_engineering.ipynb`. Merge specs lookup on (brand, model, year), handle lookup misses with group medians. Engineer: car_age, mileage_per_year, depreciation_ratio, hp_per_cc, is_high_mileage, brand_origin. Correlation matrix + VIF multicollinearity check. | Join coverage > 85%. All features computed. No NaN in final set. Feature distributions plotted. |
| DS-007 | Build preprocessing pipeline + save training data | Must-have | 2.5-3 days | DS-006 | **Files:** `src/feature_engineering.py` (update), `app/services/feature_builder.py` (shared logic) → output: `data/processed/features.parquet`, `models/preprocessor.joblib`. Create a reusable preprocessor (class or sklearn Pipeline): categorical dtype conversion, missing value imputation (median for numeric, mode for categorical), derived feature creation. Saveable with joblib. Ensure same preprocessing at training and inference time. | Preprocessor works end-to-end. Saveable. Training-ready Parquet saved. |

**Sprint 2 Total: ~6 days**

### Sprint 2 Checkpoint
At end of Week 4 you should have: complete specs lookup (validated), full feature set (~20 features), preprocessing pipeline (saveable, reusable), training-ready dataset.

---

## Sprint 3: Model Training & Evaluation (Week 5-6)

### Goal: Production-quality model with confidence intervals + SHAP

| Task ID | Title | Priority | Estimate | Dependencies | Description | Definition of Done |
|---------|-------|----------|----------|-------------|-------------|-------------------|
| DS-008 | Baseline models | Must-have | 0.5 day | DS-007 | **Files:** `notebooks/04_model_experiments.ipynb`. Baseline 1 — mean price per brand+model. Baseline 2 — median price per brand+model+year. Evaluate both with MAPE, MAE, R². These are the benchmarks. | Baselines implemented. Results documented. |
| DS-009 | LightGBM + Optuna tuning | Must-have | 2 days | DS-008 | **Files:** `src/train.py`, `notebooks/04_model_experiments.ipynb`. Train initial LightGBM (default params, median quantile, 70/15/15 split). Verify it beats baselines (expect 30-50% lower MAPE). Then run Optuna (100 trials, ~30 min): tune learning_rate, num_leaves, max_depth, min_child_samples, subsample, colsample_bytree, reg_alpha, reg_lambda. Optionally try log(price) target — keep whichever gives lower MAPE. | LightGBM beats baselines significantly. Optuna best params saved. Log-price comparison documented. |
| DS-010 | Train 3 quantile models + cross-validation | Must-have | 1.5 days | DS-009 | **Files:** `src/train.py` (update). Using best Optuna params: train α=0.1 (lower), α=0.5 (median), α=0.9 (upper). Validate: coverage ≈ 80%, reasonable interval width, no quantile crossing. Run 5-fold CV on median model → report mean ± std for all metrics. This is the "official" accuracy for defense. | 3 models trained. Coverage validated. CV MAPE std < 2%. |
| DS-011 | Evaluation suite + SHAP | Must-have | 2 days | DS-010 | **Files:** `src/evaluate.py`, `notebooks/04_model_experiments.ipynb` (SHAP plots). MAPE, MAE, RMSE, R², within-±10%/±15% accuracy, CI coverage, segmented eval (by brand, by price tier). Generate JSON report. SHAP: global feature importance (summary plot), top-5 dependence plots, waterfall for 3 example predictions. Save all plots to model version dir. | Full evaluation report. SHAP plots generated. Global importance is intuitive. |
| DS-012 | Save model v1.0.0 | Must-have | 0.5 day | DS-011 | **Files:** `models/v1.0.0/` (create dir), `models/model_registry.json` (update). Save: 3 model `.joblib` files, preprocessor, `metadata.json` (metrics, params, feature list), SHAP plots. Update registry with v1.0.0 as active. | models/v1.0.0/ complete. Registry points to v1.0.0. |

**Sprint 3 Total: ~6.5 days**

### Sprint 3 Checkpoint
At end of Week 6 you should have: trained LightGBM beating baselines by 30%+, confidence intervals with ~80% coverage, SHAP explanations, all model artifacts saved/versioned, evaluation report with segmented analysis.

**CRITICAL CHECKPOINT.** If model works here, you're on track. If MAPE > 20%, revisit features.

---

## Sprint 4: API & Deployment (Week 7-8)

### Goal: Working FastAPI service in Docker, deployed

| Task ID | Title | Priority | Estimate | Dependencies | Description | Definition of Done |
|---------|-------|----------|----------|-------------|-------------|-------------------|
| DS-013 | Pydantic schemas + ModelManager | Must-have | 1.5 days | DS-012 | **Files:** `app/schemas/prediction.py`, `app/core/model_loader.py`. PredictionRequest (with validation), PredictionResponse (with NegotiationRange, PriceFactor). ModelManager — load models from registry, predict with all 3, enforce monotonicity, round to nearest 1K EGP. | Schemas defined. ModelManager predicts correctly for 5+ test cases. |
| DS-014 | Feature builder + predictor service | Must-have | 1.5 days | DS-013 | **Files:** `app/services/feature_builder.py`, `app/services/predictor.py`. Feature builder: transform raw API input → model-ready features (same logic as training). Join with specs lookup. Handle missing lookups. Predictor: orchestrate feature_builder → 3 models → SHAP factors → response. | Feature builder matches training output. Full prediction flow works. |
| DS-015 | FastAPI endpoints + app entry point | Must-have | 1.5 days | DS-014 | **Files:** `app/api/predict.py`, `app/api/health.py`, `app/main.py`, `app/schemas/health.py`. POST /api/v1/predict. GET /health + /model-info. Lifespan, routers, CORS, logging. HealthResponse, ModelInfoResponse. | App starts, loads model, all endpoints respond correctly. |
| DS-016 | Tests | Must-have | 1 day | DS-015 | **Files:** `tests/test_predict.py`, `tests/test_features.py`, `tests/test_data_pipeline.py`. Test valid/invalid inputs, feature builder correctness, cleaning functions. pytest. | All tests pass. Critical paths covered. |
| DS-017 | Docker + deploy | Must-have | 1.5 days | DS-016 | **Files:** `Dockerfile`, `.dockerignore`. python:3.11-slim, install deps, copy app + models + lookup, healthcheck, CMD uvicorn. Exclude notebooks/src/tests/docs/raw data. Build locally, test all endpoints with curl. Deploy to Railway.app (or Render). | Docker works locally. Deployed with live URL. <200ms latency. |

**Sprint 4 Total: ~7 days**

### Sprint 4 Checkpoint
At end of Week 8 you should have: working FastAPI service (local + Docker), all endpoints tested, deployed to cloud, <200ms prediction latency.

---

## Sprint 5: Polish & Defense Prep (Week 9-10)

### Goal: Retrain pipeline, documentation, demo-ready

| Task ID | Title | Priority | Estimate | Dependencies | Description | Definition of Done |
|---------|-------|----------|----------|-------------|-------------|-------------------|
| DS-018 | Retraining pipeline | Must-have | 2 days | DS-012 | **Files:** `src/retrain.py`. Chains: data_loader → data_cleaner → title_parser (new titles only) → feature_engineering → train → evaluate. Activates new model only if it beats current. CLI: `python -m src.retrain --version v1.1.0`. Test with current data (new version should produce similar metrics). | Script runs end-to-end. New model saved. Comparison report generated. |
| DS-019 | Prediction logging | Should-have | 0.5 day | DS-015 | **Files:** `app/services/predictor.py` (update), `logs/predictions.jsonl` (auto-created). Log every prediction: timestamp, input features, predicted price, confidence, latency, model version. | Predictions logged. Log file readable. |
| DS-020 | Code cleanup | Must-have | 1 day | All | **Files:** all `src/*.py`, all `app/**/*.py`. Add docstrings to all public functions. Remove dead code. Format with black/ruff. Type hints. Organize imports. No leftover TODOs. | Code passes linter. All functions documented. |
| DS-021 | Demo notebook | Must-have | 1 day | DS-015 | **Files:** `notebooks/05_demo.ipynb`. 5 real car examples with predictions, negotiation ranges, SHAP waterfall for each, comparison with actual listing prices, model vs baseline chart. | Demo tells a compelling story. Ready for defense. |
| DS-022 | End-to-end integration test | Must-have | 0.5 day | DS-017 | **Files:** `tests/test_integration.py`. Test full flow: Supabase → pipeline → training → model save → FastAPI load → API prediction → correct response. | Full pipeline works without manual intervention. |
| DS-023 | Defense slides content | Must-have | 1.5 days | DS-021 | **Files:** presentation slides (external). Prepare: problem statement, architecture diagram, data pipeline overview, feature engineering decisions, model selection rationale, results (metrics + visuals), SHAP explanations, live demo plan, future improvements. | All content drafted. Key metrics and visuals ready. |

**Sprint 5 Total: ~6.5 days**

---

## Dependency Graph (Critical Path)

```
DS-001 → DS-002 → DS-003 → DS-004 → DS-005
                                        │
                              DS-006 → DS-007 → DS-008
                                                   │
                              DS-009 → DS-010 → DS-011 → DS-012
                                                            │
                              DS-013 → DS-014 → DS-015 → DS-016 → DS-017
                                                           │
                                               DS-018    DS-019
                                                 │
                                    DS-020  DS-021  DS-022 → DS-023
```

**Critical path:** DS-001 → DS-004 → DS-005 → DS-007 → DS-008 → DS-009 → DS-011 → DS-012 → DS-014 → DS-015 → DS-017

**Total critical path: ~6 weeks.** You have 10 weeks. The 4-week buffer covers learning time, unexpected issues, and scope adjustments.

---

## Quick File Reference (all tasks)

| Task | Files to Create/Update |
|------|----------------------|
| Environment setup + Supabase pull | `requirements.txt`, `.env`, `src/data_loader.py` |
| Exploratory Data Analysis | `notebooks/01_EDA.ipynb` |
| Title parsing with Claude | `src/title_parser.py` → `data/lookups/title_parsed.csv` |
| Data cleaning pipeline | `src/data_cleaner.py`, `notebooks/02_data_cleaning.ipynb` → `data/cleaned/cars_cleaned.parquet` |
| Generate specs lookup via Claude | `src/generate_lookup.py` → `data/lookups/car_specs_lookup.csv` |
| Join lookup + engineer features | `src/feature_engineering.py`, `notebooks/03_feature_engineering.ipynb` |
| Build preprocessing pipeline | `src/feature_engineering.py`, `app/services/feature_builder.py` → `data/processed/features.parquet`, `models/preprocessor.joblib` |
| Baseline models | `notebooks/04_model_experiments.ipynb` |
| LightGBM + Optuna tuning | `src/train.py`, `notebooks/04_model_experiments.ipynb` |
| Train 3 quantile models + CV | `src/train.py` |
| Evaluation suite + SHAP | `src/evaluate.py`, `notebooks/04_model_experiments.ipynb` |
| Save model v1.0.0 | `models/v1.0.0/` (3 joblib + metadata.json + SHAP plots), `models/model_registry.json` |
| Pydantic schemas + ModelManager | `app/schemas/prediction.py`, `app/core/model_loader.py` |
| Feature builder + predictor | `app/services/feature_builder.py`, `app/services/predictor.py` |
| FastAPI endpoints + app entry | `app/api/predict.py`, `app/api/health.py`, `app/main.py`, `app/schemas/health.py` |
| Tests | `tests/test_predict.py`, `tests/test_features.py`, `tests/test_data_pipeline.py` |
| Docker + deploy | `Dockerfile`, `.dockerignore` |
| Retraining pipeline | `src/retrain.py` |
| Prediction logging | `app/services/predictor.py` → `logs/predictions.jsonl` |
| Code cleanup | all `src/*.py`, all `app/**/*.py` |
| Demo notebook | `notebooks/05_demo.ipynb` |
| End-to-end integration test | `tests/test_integration.py` |
| Defense slides content | presentation slides (external) |

---

## Weekly Milestones (Self-Tracking)

| Week | Milestone | If Behind Schedule |
|------|-----------|-------------------|
| 1 | Raw data pulled, EDA complete | Reduce EDA to 6 analyses |
| 2 | Titles parsed, data cleaned | Skip location tier — add later |
| 3 | Specs lookup generated + validated | Validate top 5 brands only |
| 4 | Features engineered, preprocessor saved | Drop low-priority features |
| 5 | Baselines done, LightGBM beating them | Skip Optuna — use defaults |
| 6 | 3 quantile models + SHAP + eval report | Skip segmented evaluation |
| 7 | FastAPI service works locally | Skip SHAP in API response |
| 8 | Docker works, deployed | Deploy locally only |
| 9 | Retrain script done, code cleaned | Skip prediction logging |
| 10 | Demo notebook + defense content ready | Focus only on demo quality |

---

## Effort Allocation

```
Data work (Sprint 1-2):      35%   ~14 days
Model work (Sprint 3):       20%   ~6.5 days
API & Deploy (Sprint 4):     25%   ~7 days
Polish & Docs (Sprint 5):    20%   ~6.5 days
```

This front-loads data work, which is correct — 80% of ML project time should be on data, 20% on models.
