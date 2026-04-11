# System Architecture

## Overview

The ML pricing engine is a standalone microservice that predicts used car prices with negotiation ranges. It is decoupled from both the chatbot service and the .NET backend.

The key architectural decision in this version is how we handle dynamic pricing across multiple scraping runs. The service is designed to work with a single snapshot today, but it already carries the structure needed to move to multi-snapshot training later.

## Architecture Diagram

```text
                        SUPABASE (raw scraped listings)
                                ↓
                                ↓ training-only connection string
                                ↓
        ──────────────────────────────────────────────────────────────────
        ML SERVICE - Data and Training Pipeline (src/)

                data_loader.py         → pull raw data from Supabase
                data_cleaner.py        → clean and validate data
                feature_engineering.py → build all features
                train.py               → train quantile models
                evaluate.py            → metrics and reports
                retrain.py             → orchestrate monthly retraining

        ──────────────────────────────────────────────────────────────────
        ARTIFACTS

                data/
                ├── lookups/
                │   ├── car_specs_lookup.csv   ← static specs per make+model+year
                │   └── title_parsed.csv       ← Claude-parsed titles cache
                ├── raw/                       ← timestamped raw snapshots
                ├── cleaned/                   ← cleaned per-snapshot data
                └── processed/                 ← training-ready merged data

                models/
                ├── model_registry.json        ← active version pointer
                └── v1.0.0/
                    ├── model_median.joblib
                    ├── model_lower.joblib
                    ├── model_upper.joblib
                    ├── preprocessor.joblib
                    ├── metadata.json
                    └── shap_summary.png

        ──────────────────────────────────────────────────────────────────
        ONLINE: FastAPI Prediction Service (app/)

                POST /api/v1/predict    → price + range + factors
                GET  /health            → status + model version
                GET  /model-info        → metrics + metadata

                On startup: load active model + lookup CSV into memory
                At inference: join input with lookup, build features, predict

        ──────────────────────────────────────────────────────────────────
        .NET BACKEND (not my scope)
                ↑
                ↑ HTTP JSON
```

## Key Design Decisions

### 1. Dynamic Pricing Strategy

The supervisor concern is valid: prices change over time, so a one-time model can go stale. The right answer depends on how much data you have.

**Current recommendation: Approach A - independent snapshots.**

Treat each monthly scrape as its own dataset and train on the latest snapshot only. The previous snapshot stays archived, but it is not merged into the current training set.

```text
Feb scrape → clean → train v1.0.0 (baseline)
Mar scrape → clean → train v1.1.0 (current market)
Apr scrape → clean → train v1.2.0 (refreshed market)
```

Why this is the correct starting point:
- It is simple to explain and defend in a GP presentation.
- It avoids stale historical prices contaminating current predictions.
- It does not require stable listing IDs across runs.
- It matches the current state of the project if you only have one snapshot.

**Upgrade path: Approach B - cumulative dataset.**

When you have several months of data, merge snapshots and keep `scraped_at` only for splitting and auditing latter not now, not as a model feature. That gives the model more history and better trend coverage.

**Approach C - listing-level trend tracking** is possible later if stable listing IDs exist, but it is unnecessary for the current scope.

### 2. Static Lookup CSV Instead of Runtime LLM

Car specs such as `engine_cc`, `horsepower`, `body_type`, and `new_car_price_egp` are deterministic properties of a model-year combination. They should be generated once, validated, and reused at both training and inference time.

Why not call an LLM at prediction time:
- Non-deterministic output.
- Adds seconds of latency.
- Creates train-serve skew.
- Adds per-request cost.
- Makes the service dependent on an external API.

### 3. Offline / Online Separation

- `src/` contains training code only. It runs in notebooks or CLI and is never deployed.
- `app/` contains serving code only. It runs in Docker and loads pre-trained artifacts.
- Shared feature logic lives in `app/services/feature_builder.py` and is imported by `src/` during training so preprocessing stays identical.

This is the main safeguard against preprocessing skew.

### 4. Three Quantile Models

Instead of one regression model, the service trains three independent LightGBM models:

- Lower (`alpha = 0.1`) → negotiation floor.
- Median (`alpha = 0.5`) → fair price estimate.
- Upper (`alpha = 0.9`) → negotiation ceiling.

Together they produce an 80% prediction interval without distributional assumptions.

### 5. Model Registry Pattern

`model_registry.json` is the only pointer needed for promotion and rollback. Update the pointer, restart the service, and the active version changes. That keeps versioning simple and explainable.

### 6. Title Parsing via Claude

Unique titles are parsed in batch to extract brand, model, and trim, then cached in `data/title_parsed.csv`.

Why this is better than regex:
- Handles multi-word models and trims.
- Handles Arabic transliterations and inconsistent formatting.
- Is easier to validate manually than a large ruleset.

## Technology Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| ML framework | LightGBM | Fast, native categoricals, quantile loss |
| Tuning | Optuna | Efficient TPE sampler |
| Explainability | SHAP (TreeSHAP) | Fast and industry standard for trees |
| API | FastAPI | Async, auto-docs, Pydantic validation |
| Serialization | joblib | Efficient for numpy-heavy artifacts |
| Container | Docker | Reproducibility and simple deployment |
| Lookups | CSV | Human-editable and Git-friendly |
| Datasets | Parquet | Compact and typed |
| Deployment | Railway.app / Render | Simple Docker hosting |

### Skip List

| Tool | Why |
|------|-----|
| MLflow / DVC | JSON registry is enough at this scope |
| Kubernetes | Too heavy for the project |
| Airflow | Monthly retraining does not need a DAG |
| Feature store | Too much overhead for this dataset size |

## Data Flow

```text
Step 1: DE team scrapes Hatla2ee / Dubizzle and lands raw data in Supabase.

Step 2: data_loader.py
        Pull raw data from Supabase, validate dtypes and nulls, save a raw Parquet snapshot.

Step 3: title_parser.py
        Parse unique titles with Claude or any agent in batch, then save the dagta to the raw dir.

Step 4: data_cleaner.py
        Load raw Parquet → remove duplicates → filter invalid prices and mileage, standardize fields
        → handle mileage=0 & transmission="0" → standardize locations
        impute missing values using training statistics only, save processed Parquet.
        Join the data that have the titles parsed with car_specs_lookup.csv, build derived features,
        apply group-level outlier removal, log the cleaning funnel, save cleaned Parquet.
        → save cleaned Parquet to data/cleaned/


Step 5: train.py
        Split data(StratifiedShuffleSplit), tune with Optuna, train 3 quantile models, evaluate, save artifacts.
        evaluate, generate SHAP plots and save it, save the model with it's version

Step 7: FastAPI app
        Load the active version on startup.
        build features, predict, and optionally compute SHAP explanations.

Step 8: retrain.py
        Repeat the pipeline monthly, compare against the active version, and promote only if better.
```

## API Contract

### POST /api/v1/predict

**Request body example:**

```json
{
  "brand": "Toyota",
  "model": "Corolla",
  "year": 2018,
  "mileage_km": 85000,
  "transmission": "Automatic",
  "fuel": "petrol",
  "location": "Cairo",
  "include_factors": true
}
```

**Response:**
- `fair_price` — Point estimate, rounded to nearest 1K EGP
- `negotiation_range` — { min_price, max_price } from quantile models
- `confidence` — "high" / "medium" / "low" based on interval width and data support
- `price_factors` — (if requested) Top 5 SHAP factors with direction and description
- `model_version` — Active version string
- `predicted_at` — UTC timestamp


```json
{
  "fair_price": 485000,
  "negotiation_range": { "min_price": 420000, "max_price": 560000 },
  "confidence": "high",
  "price_factors": [
    { "factor": "mileage_km", "direction": "negative", "description": "High mileage decreases price" }
  ],
  "model_version": "v1.0.0",
  "predicted_at": "2026-04-10T14:30:00Z"
}
```

### GET /health

Returns service status, active model version, training date, and uptime.

## Lookup Feature Enrichment

`car_specs_lookup.csv` enriches both training and inference with deterministic features.

| Feature | Description | Source |
|---------|-------------|--------|
| engine_cc | Engine displacement in cc | Claude batch, then validated |
| body_type | Sedan, SUV, hatchback, and similar body classes | Claude batch, then validated |
| horsepower | Engine power | Claude batch, then validated |
| drivetrain | FWD, RWD, AWD | Claude batch, then validated |
| new_car_price_egp | MSRP in the Egyptian market | Claude batch, cross-checked manually |
| seating_capacity | Number of seats | Claude batch, then validated |

**Join key:** `(brand, model, year)`.

If there is no exact year match, fall back to `(brand, model)` using the nearest available year and mark the prediction confidence as low.

**Validation priority:** cross-check the top 10 brands, which cover most of the dataset, against official specs and Egyptian pricing sources.
