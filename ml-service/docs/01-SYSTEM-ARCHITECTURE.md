# System Architecture

## Overview

The ML pricing engine is a standalone microservice that predicts used car prices with negotiation ranges. It is decoupled from both the chatbot service and the .NET backend.

## Architecture Diagram

```
                        SUPABASE (Raw Data)
                                ↓
                                ↓ Connection string (training only)
                                ↓
                        ---------------------------------------------------------------------------------------
                        ML SERVICE
                        Data & Training Pipeline (src/)

                                data_loader.py        → Pull raw data from Supabase
                                data_cleaner.py       → Clean & validate data
                                feature_engineering.py→ Build all features
                                train.py              → Train quantile models
                                evaluate.py           → Metrics & reports
                                retrain.py            → Orchestrate retraining

                        ---------------------------------------------------------------------------------------
                        ARTIFACTS

                                data/
                                ├── lookups/
                                │   ├── car_specs_lookup.csv ← Lookup features
                                │   └── title_parsed.csv    ← Claude-parsed titles
                                ├── raw/                    ← Raw snapshots
                                ├── cleaned/                ← Cleaned data
                                └── processed/              ← Training-ready data

                                models/
                                ├── model_registry.json    ← Active version ptr
                                └── v1.0.0/
                                ├── model_median.joblib
                                ├── model_lower.joblib
                                ├── model_upper.joblib
                                ├── preprocessor.joblib
                                ├── metadata.json
                                └── shap_summary.png

                        ---------------------------------------------------------------------------------------
                        ONLINE: FastAPI Prediction Service (app/)

                                POST /api/v1/predict   → Price + range + factors
                                GET  /health           → Status + model version
                                GET  /model-info       → Metrics & metadata

                                On startup: loads active model + lookup CSV
                                At inference: joins input with lookup → predict

                        ---------------------------------------------------------------------------------------
                        .NET BACKEND (not my scope)
                                ↑
                                ↑ HTTP JSON
```
---

## Key Design Decisions

### 1. Static Lookup CSV Instead of Runtime LLM

Car specs (engine_cc, horsepower, body_type, new_car_price) are deterministic properties of a model+year, not of an individual car. They are generated once via Claude, validated manually, stored as CSV, and used identically at training time and inference time.

**Why not LLM at runtime:**
- Non-deterministic — same input can produce different outputs across calls
- Adds 1-3s latency per prediction
- Creates train-serve skew — training data enriched differently than inference data
- Costs money per prediction
- External API downtime takes our service down

### 2. Offline/Online Separation

- `src/` — Training code. Runs in notebooks or CLI. Never deployed to production.
- `app/` — Serving code. Runs in Docker. Loads pre-trained models only.
- Shared logic (feature building) lives in `app/services/feature_builder.py` and is imported by `src/` during training to guarantee identical preprocessing.

### 3. Three Quantile Models

Instead of one regression model, three LightGBM models are trained:
- **Lower (α=0.1):** 10th percentile → negotiation floor
- **Median (α=0.5):** 50th percentile → fair price estimate
- **Upper (α=0.9):** 90th percentile → negotiation ceiling

This gives an 80% prediction interval without distributional assumptions.

### 4. Model Registry Pattern

A simple `model_registry.json` points to the active model version. Rollback = change the pointer and restart. No MLflow, DVC, or external tooling.

### 5. Title Parsing via Claude (Not Regex)

Unique titles are sent to Claude Opus 4.6 in batch to extract brand, model, and trim. Results are saved as `data/title_parsed.csv`. This is a one-time operation repeated only when new unique titles appear after scraping.

**Why Claude over regex:** Handles multi-word models, Arabic transliterations, trim levels, and inconsistent formats far more reliably.

---

## Technology Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| ML Framework | LightGBM | Fast, native categoricals, built-in quantile loss |
| Tuning | Optuna | Efficient TPE sampler |
| Explainability | SHAP (TreeSHAP) | Fast for tree models, industry standard |
| API | FastAPI | Async, auto-docs, Pydantic validation |
| Serialization | joblib | Optimized for numpy-heavy objects |
| Container | Docker | Reproducibility |
| Lookups | CSV | Human-editable, Git-friendly, easy to inspect |
| Datasets | Parquet | Compressed, typed, fast for large data |
| Deployment | Railway.app / Render | Free tier, Docker support |

### Skip List

| Tool | Why |
|------|-----|
| MLflow / DVC | JSON registry is sufficient at this scope |
| Kubernetes | Enterprise-scale, unnecessary |
| Airflow | Monthly retraining = a Python script, not a DAG |
| Feature Store | <30K rows, no real-time features |

---

## Data Flow

```
Step 1: DE team scrapes Hatla2ee/Dubizzel → raw data lands in Supabase

Step 2: data_loader.py
        Pull raw data from Supabase → basic validation (dtypes, nulls)
        → save raw snapshot as Parquet (no cleaning)

Step 3: data_cleaner.py
        Load raw Parquet → remove duplicates → filter invalid prices
        → handle mileage=0 & transmission="0" → standardize locations
        → IQR outlier removal per brand+model → log cleaning funnel
        → save cleaned Parquet to data/cleaned/

Step 4: title_parser.py (first run or when new titles appear)
        Extract unique titles → send to Claude in batch
        → receive brand, model, trim → save as title_parsed.csv

Step 5: feature_engineering.py
        Load cleaned Parquet from data/cleaned/
        + Join with title_parsed.csv     → adds brand, model columns
        + Join with car_specs_lookup.csv  → adds engine_cc, hp, body_type, new_car_price, etc.
        + Engineer derived features       → car_age, mileage_per_year, depreciation, etc.
        + Impute remaining missing values
        → Save training-ready Parquet to data/processed/

Step 6: train.py
        Load processed data → split (70/15/15)
        → tune hyperparameters (Optuna) → train 3 quantile models
        → evaluate → generate SHAP plots → save all artifacts to models/vX.X.X/

Step 7: FastAPI (app/)
        On startup: load active model version + car_specs_lookup.csv
        On request: receive car details → join with lookup → build features → predict
        → return price + negotiation range + factors

Step 8: retrain.py (monthly)
        Orchestrates steps 2-6 → compares new model vs active
        → promotes if better, keeps old if worse
```

---

## API Contract

### POST /api/v1/predict

**Request:** brand, model, year, mileage_km, transmission, fuel, location (optional), include_factors (optional)

**Response:**
- `fair_price` — Point estimate, rounded to nearest 1K EGP
- `negotiation_range` — { min_price, max_price } from quantile models
- `confidence` — "high" / "medium" / "low" based on interval width and data support
- `price_factors` — (if requested) Top 5 SHAP factors with direction and description
- `model_version` — Active version string
- `predicted_at` — UTC timestamp

### GET /health

Returns: service status, active model version, training date, uptime.

---

## Lookup Feature Enrichment

The `car_specs_lookup.csv` adds these features at both training and inference time:

| Feature | Description | Source |
|---------|-------------|--------|
| engine_cc | Engine displacement in cc | Claude batch → validated |
| body_type | Sedan, SUV, Hatchback, etc. | Claude batch → validated |
| horsepower | Engine power | Claude batch → validated |
| drivetrain | FWD, RWD, AWD | Claude batch → validated |
| new_car_price_egp | MSRP in Egyptian market | Claude batch → cross-checked with Hatla2ee |
| seating_capacity | Number of seats | Claude batch → validated |

**Join key:** (brand, model, year) — the same key is used during training and during inference to guarantee no train-serve skew.

**Validation:** Top 10 brands (covering ~80% of data) are manually cross-checked against official specs and Egyptian pricing sites.
