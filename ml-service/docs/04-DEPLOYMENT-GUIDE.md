# Deployment Guide

## Deployment Philosophy

Keep it simple. This is a GP project, not enterprise infrastructure. The goal is a working, demo-able, CV-worthy deployment — not Kubernetes.

---

## What You Need

1. **Trained models** saved as `.joblib` files in `models/vX.X.X/`
2. **FastAPI app** that loads the active model on startup and serves predictions
3. **Docker container** wrapping the app (reproducibility + deployment)
4. **A host** — Railway.app, Render, or just localhost for demo

---

## FastAPI Service Design

### Application Lifecycle

- On startup: load active model version from `model_registry.json`, load `car_specs_lookup.csv` into memory
- On request: validate input → join with lookup → build features → predict with 3 models → return response
- On shutdown: cleanup (nothing special needed)

### Key Components

| File | Responsibility |
|------|---------------|
| `app/main.py` | FastAPI app creation, lifespan (model loading), router registration, CORS |
| `app/core/config.py` | Settings from environment variables (model dir, log level, etc.) |
| `app/core/model_loader.py` | ModelManager class — loads models, lookup, runs predictions |
| `app/services/feature_builder.py` | Transforms raw API input into model-ready feature vector |
| `app/services/predictor.py` | Orchestrates prediction: feature building → model inference → SHAP → response |
| `app/api/predict.py` | POST /api/v1/predict endpoint |
| `app/api/health.py` | GET /health endpoint |
| `app/schemas/prediction.py` | Pydantic request/response models with field validation |
| `app/schemas/health.py` | Health response model |

### Input Validation (Pydantic)

- year: 1990 ≤ year ≤ 2027
- mileage_km: 0 ≤ mileage_km ≤ 1,000,000
- transmission: must be "Automatic" or "Manual"
- fuel: must be one of "Gas", "Diesel", "Hybrid", "Natural gas"
- brand/model: required strings

Reject invalid inputs with 422 status and clear error messages.

### Error Handling

- Unknown brand+model (no lookup match): Return prediction with `confidence: "low"` and wider range
- Model loading failure: Return 503 Service Unavailable
- Feature building failure: Return 400 Bad Request with description

---

## Docker Setup

### Dockerfile Structure

- Base image: `python:3.11-slim`
- Install system deps (build-essential for LightGBM)
- Install Python deps from `requirements.txt`
- Copy only production files: `app/`, `data/car_specs_lookup.csv`, `models/`
- Do NOT copy: `src/`, `notebooks/`, `tests/`, `docs/`, raw data
- Expose port 8000
- Healthcheck: curl localhost:8000/health
- CMD: uvicorn app.main:app --host 0.0.0.0 --port 8000

### .dockerignore

Exclude: notebooks/, src/, tests/, docs/, *.ipynb, __pycache__/, .git/, .env, data/raw/, data/processed/

---

## Deployment Options

### Option 1: Railway.app (Recommended)

- Free tier: 500 hours/month (sufficient)
- Docker support, auto-deploy from GitHub, HTTPS included
- 512MB RAM — enough for LightGBM models (~50-100MB total)
- Steps: install CLI → `railway login` → `railway init` → `railway up`

### Option 2: Render.com

- Free tier with Docker + HTTPS
- Limitation: spins down after 15 min inactivity (cold start ~30s)
- Acceptable for GP demo

### Option 3: Local Docker (Backup)

- Perfectly fine for GP defense demo
- Show it works with curl/Postman during presentation

---

## Model Versioning & Updates

### Version Directory Structure

```
models/
├── model_registry.json     ← Points to active version
├── v1.0.0/
│   ├── model_median.joblib
│   ├── model_lower.joblib
│   ├── model_upper.joblib
│   ├── preprocessor.joblib
│   ├── metadata.json
│   └── shap_summary.png
└── v1.1.0/
    └── ...
```

### model_registry.json

```json
{
  "active_version": "v1.0.0",
  "versions": {
    "v1.0.0": {
      "trained_at": "2026-03-15T10:00:00",
      "mape": 0.12,
      "r2": 0.89,
      "n_samples": 25000
    }
  }
}
```

### Safe Model Swap

1. Train new model → save as `models/v1.1.0/`
2. Compare metrics: is v1.1.0 better than v1.0.0?
3. If yes: update `model_registry.json` → active_version = "v1.1.0" → restart service
4. If no: keep v1.1.0 saved but don't activate → manual review

### Rollback

Edit `model_registry.json` → change active_version back → restart service. Takes 30 seconds.

---

## Retraining Pipeline

### Monthly Cycle

1. Pull latest data from Supabase (data_loader.py)
2. Parse any new unique titles (title_parser.py)
3. Run full feature engineering (feature_engineering.py)
4. Train new model with Optuna tuning (train.py)
5. Evaluate against current active model (evaluate.py)
6. If better: save and activate new version
7. If worse: save but don't activate — review manually

**Trigger:** Manual CLI command (`python -m src.retrain --version v1.1.0`). Fully automated scheduling is unnecessary at GP scope.

---

## Monitoring (Simple)

Log every prediction to a JSON log file:
- Timestamp, input features, predicted price, confidence, latency (ms), model version

This serves as:
- Debugging tool (which predictions were wrong?)
- Drift detection (are input distributions changing?)
- Usage stats for GP defense ("the system processed N predictions")

No Grafana, no Prometheus. A log file you can grep is sufficient.

---

## Latency Budget

Target: <200ms per prediction

| Component | Expected |
|-----------|----------|
| Request parsing + validation | ~1ms |
| Feature lookup (CSV in memory) | ~0.1ms |
| Feature engineering | ~1ms |
| LightGBM prediction (3 models) | ~5-10ms |
| SHAP (if requested) | ~50-100ms |
| Response serialization | ~1ms |
| **Total** | **~60-115ms** |

---

## Requirements.txt

**Production (in Docker):**
- lightgbm, scikit-learn, numpy, pandas, joblib
- fastapi, uvicorn[standard], pydantic
- shap
- python-dotenv

**Training only (not in Docker):**
- optuna
- supabase
- matplotlib, seaborn (for notebooks)
- anthropic (for Claude API in title parsing)
