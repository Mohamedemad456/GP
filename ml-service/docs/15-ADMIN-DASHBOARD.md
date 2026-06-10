# Admin Dashboard & Model Activation System

**Document ID:** 15-ADMIN-DASHBOARD  
**Scope:** Streamlit admin UI, FastAPI admin endpoints, model activation flow, and hot-reload mechanism.  
**Last Updated:** 2026-06-10

---

## 1. Overview

The **KARNA ML Admin Dashboard** is an internal Streamlit web application that provides a visual interface for managing the ML service model registry. It allows administrators to:

- Browse all registered models with their metrics and metadata
- Inspect individual model details, diagnostics, and coverage
- Compare two models side-by-side
- Activate a model (promote it to production) with **zero-downtime hot-reload**
- Explore make/model coverage to understand routing behavior

The dashboard communicates with the ML service via FastAPI REST endpoints exposed on port `8001`. The dashboard itself runs on port `8501` inside the container, mapped to `8502` on the host.

### Architecture Diagram

```
┌─────────────────┐     HTTP GET/POST      ┌──────────────────────┐
│   Streamlit     │ ◄────────────────────► │    FastAPI Admin     │
│   Dashboard     │    (port 8501/8502)    │    Endpoints         │
│   (Port 8501)   │                        │    (Port 8001)       │
└─────────────────┘                        └──────────────────────┘
                                                   │
                                                   │ writes
                                                   ▼
                                          ┌──────────────────────┐
                                          │  model_registry.json │
                                          │  (bind-mounted)      │
                                          └──────────────────────┘
                                                   │
                                                   │ triggers
                                                   ▼
                                          ┌──────────────────────┐
                                          │  In-Memory Reload    │
                                          │  (model_state.py)      │
                                          └──────────────────────┘
```

---

## 2. File Structure

```
ml-service/
├── admin/
│   └── dashboard.py          # Streamlit application (single file, all pages)
├── app/
│   ├── api/
│   │   └── admin.py          # FastAPI admin endpoints
│   ├── core/
│   │   └── model_registry.py # Registry read/write primitives
│   ├── services/
│   │   ├── explainability/
│   │   │   ├── explainer.py        # SHAP explainer + cache clear
│   │   │   └── ensemble_explainer.py # Ensemble SHAP + init
│   │   └── model/
│   │       └── model_state.py      # Global model state + reload logic
│   └── main.py               # FastAPI app (lifespan startup)
├── models/
│   └── model_registry.json   # Central registry file
├── Dockerfile                # Multi-process container (uvicorn + streamlit)
├── entrypoint.sh             # Starts both services
└── docker-compose.yml        # Service orchestration
```

---

## 3. Streamlit Dashboard (`admin/dashboard.py`)

### 3.1 Pages

The dashboard is a single-file multi-page Streamlit app using a sidebar radio button for navigation.

| Page | Purpose |
|------|---------|
| **Registry Overview** | Table of all models with metrics, active model highlighted |
| **Model Details** | Deep-dive into one model: metrics, diagnostics, metadata |
| **Compare Models** | Side-by-side comparison of two models (metrics + coverage + diagnostics) |
| **Activate Model** | Select a candidate and activate it with live preview |
| **Coverage Explorer** | Search a make/model to see routing behavior and which models cover it |

### 3.2 Theme & Styling

Custom CSS is injected via `st.markdown(..., unsafe_allow_html=True)` to override Streamlit defaults:

- **Primary color:** `#1D6159` (teal)
- **Background:** `#FAF6F0` (warm off-white)
- **Text:** `#363636` (dark grey)
- **Border:** `#E0DDD5` (light warm grey)
- **Success:** `#27AE60` | **Warning:** `#E67E22` | **Error:** `#C0392B`
- Font: Inter (Google Fonts)

All buttons, metric cards, tables, and tabs are styled consistently.

### 3.3 Data Fetching Helpers

```python
API_BASE = os.environ.get("ADMIN_API_BASE", "http://localhost:8001/admin")

def _get(path: str) -> dict | None:
    """GET helper with connection and error handling."""

def _post(path: str) -> dict | None:
    """POST helper that surfaces API error detail messages."""
```

Both helpers catch `ConnectionError` and display a user-friendly Streamlit error, so the dashboard degrades gracefully when the FastAPI backend is unreachable.

### 3.4 Activation Page Flow

1. **Currently Active** — shows the active model ID, version, and promotion timestamp
2. **Select Model to Activate** — dropdown of all non-active models
3. **Preview Card** — stage, framework, and coverage combo count for the selected candidate
4. **Confirm Activation** — warning box confirming the replacement (no restart required)
5. **Activate Model button** — POSTs to `/admin/models/{id}/activate`

#### Success State Persistence

Streamlit `st.success()` toasts disappear on `st.rerun()`. To keep the success message visible after the page auto-refreshes, the result is stored in `st.session_state`:

```python
if st.button("Activate Model", type="primary"):
    result = _post(f"/models/{selected}/activate")
    if result:
        st.session_state["activation_success"] = result
        st.rerun()

# On subsequent render, display persisted message
if st.session_state.get("activation_success"):
    result = st.session_state.pop("activation_success")
    st.success(result.get("message"))
    # ... detail box + balloons
```

This ensures:
- The page refreshes to show the new "Currently Active" model
- The success toast and activation details remain visible
- The state is cleaned up (popped) so it doesn't re-appear on every interaction

---

## 4. FastAPI Admin Endpoints (`app/api/admin.py`)

### 4.1 Endpoint Reference

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/models` | List all models + registry summary |
| `GET` | `/admin/models/{model_id}` | Full detail for one model (metrics, coverage, diagnostics, metadata) |
| `POST` | `/admin/models/{model_id}/activate` | Promote model to active + hot-reload |

### 4.2 Activation Endpoint (`POST /admin/models/{model_id}/activate`)

```python
@router.post("/models/{model_id}/activate")
def activate_model(model_id: str):
    # 1. Validate model exists in registry
    # 2. Call promote_active_model(model_id) → writes model_registry.json
    # 3. Clear coverage cache
    # 4. Call reload_active_model() → in-memory hot-reload
    # 5. Return success with "reloaded": true
```

#### Error Handling

| Exception | HTTP Status | Message |
|-----------|-------------|---------|
| `ValueError` | `400` | Model not found or already active |
| `PermissionError` | `500` | Container cannot write `model_registry.json` — check volume mount permissions |
| `OSError` | `500` | General filesystem error writing registry |
| Reload failure | `500` | Registry updated but model failed to load in memory |

The `PermissionError` handler specifically advises checking that the volume mount is writable — this was added after SELinux/Fedora bind-mount issues caused silent failures.

---

## 5. Model Activation & Hot-Reload Flow

### 5.1 The Problem (Before)

Originally, `activate_model` only updated `model_registry.json`. The FastAPI app called `load_active_model()` **only once** during startup (`app/main.py` lifespan). This meant:

- The registry file showed the new active model
- Predictions still used the **old** in-memory model
- A full container restart was required to load the new model

### 5.2 The Solution (After)

A **hot-reload** mechanism was added so activation immediately loads the new model into memory without a restart.

#### Step-by-step Flow

```
User clicks "Activate Model" in Streamlit
        │
        ▼
POST /admin/models/{id}/activate
        │
        ▼
┌─────────────────┐
│ 1. Validate     │  → ValueError if model missing
│ 2. Promote      │  → Writes model_registry.json
│    (registry)   │
└─────────────────┘
        │
        ▼
┌─────────────────┐
│ 3. Clear        │  → _MODEL_COVERAGE_CACHE.clear()
│    Coverage     │
│    Cache        │
└─────────────────┘
        │
        ▼
┌─────────────────┐
│ 4. Reload       │  → reload_active_model()
│    Active       │
│    Model        │
└─────────────────┘
        │
        ├──► load_active_model()     → Re-populates ACTIVE_MODELS, ACTIVE_FRAMEWORK, etc.
        ├──► load_model_diagnostics() → Re-populates MAKE_MODEL_MAPE, MAKE_MAPE
        ├──► clear_shap_cache()       → Resets ACTIVE_SHAP_EXPLAINER
        └──► init_ensemble_explainer() → Rebuilds ensemble SHAP state
        │
        ▼
   Return 200 OK
   { "success": true, "reloaded": true, ... }
```

#### Key Functions

| Function | File | Purpose |
|----------|------|---------|
| `reload_active_model()` | `app/services/model/model_state.py` | Orchestrates the full in-memory reload safely |
| `load_active_model()` | `app/services/model/model_state.py` | Loads model pickle + metadata into globals |
| `load_model_diagnostics()` | `app/services/model/model_state.py` | Loads MAPE/MAE diagnostics from CSV or fallback |
| `clear_shap_cache()` | `app/services/explainability/explainer.py` | Resets cached SHAP explainer |
| `init_ensemble_explainer()` | `app/services/explainability/ensemble_explainer.py` | Rebuilds ensemble sub-model explainers |

### 5.3 Global State Variables

All live in `app/services/model/model_state.py`:

```python
ACTIVE_MODELS       # Loaded model object (sklearn/XGBoost/LightGBM/ensemble dict)
ACTIVE_FRAMEWORK    # "sklearn", "XGBoost", "LightGBM", or "ensemble"
ACTIVE_IS_QUANTILE  # Bool: is this a quantile model?
ACTIVE_PREPROCESSOR # Loaded preprocessor (if sklearn)
ACTIVE_IS_LOG_TARGET # Bool: target was log-transformed
ACTIVE_METADATA     # Full metadata JSON dict
ACTIVE_MODEL_ID     # Currently loaded model ID
```

`reload_active_model()` resets all of these by calling `load_active_model()`, which clears and repopulates them from the updated registry.

### 5.4 SHAP Cache Clearing

The SHAP explainer is expensive to build and is cached globally:

```python
# explainer.py
ACTIVE_SHAP_EXPLAINER = None   # The built SHAP TreeExplainer
ACTIVE_SHAP_MODEL_REF = None   # Reference to the model it was built for
ACTIVE_SHAP_FRAMEWORK = None   # Framework at build time
```

`clear_shap_cache()` sets all three to `None`, so the next prediction request that needs SHAP will trigger a fresh build against the newly loaded model.

Similarly, `init_ensemble_explainer()` in `ensemble_explainer.py` clears and rebuilds:

```python
_ENSEMBLE_EXPLAINERS.clear()
_ENSEMBLE_SUB_MODELS.clear()
_ENSEMBLE_WEIGHTS = None
```

---

## 6. Docker Configuration

### 6.1 Dockerfile (`ml-service/Dockerfile`)

The container runs **both** FastAPI and Streamlit simultaneously using `entrypoint.sh`:

```dockerfile
# Base: python:3.11-slim
# Working dir: /app
# Installs: requirements.txt + local package
# Copies: application code
# Entrypoint: /app/entrypoint.sh
```

**Important:** The container runs as `root` (not a non-root user). This is intentional because:
- The `models/` directory is bind-mounted from the host
- `model_registry.json` must be writable by the activation endpoint
- SELinux/Fedora contexts make non-root write access unreliable on bind mounts

### 6.2 Entrypoint (`entrypoint.sh`)

```bash
#!/bin/bash
# Start FastAPI in background
uvicorn app.main:app --host 0.0.0.0 --port 8001 &
# Start Streamlit in foreground
streamlit run admin/dashboard.py --server.port 8501 --server.address 0.0.0.0
```

FastAPI runs in the background; Streamlit runs in the foreground so the container stays alive.

### 6.3 Docker Compose

```yaml
ml-service:
  build: ./ml-service
  ports:
    - "8001:8001"    # FastAPI
    - "8502:8501"    # Streamlit (host:container)
  volumes:
    - ./ml-service:/app:Z,U  # Bind mount for live code changes
  environment:
    - ADMIN_API_BASE=http://localhost:8001/admin
```

- `:Z` — SELinux label sharing
- `:U` — User namespace remapping (helps with permissions)
- Port `8502` on host maps to `8501` inside container to avoid conflicts

---

## 7. Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `ADMIN_API_BASE` | `http://localhost:8001/admin` | Base URL for FastAPI admin endpoints (used by Streamlit dashboard) |

Set this in `docker-compose.yml` or `.env` so the dashboard knows where to find the API. Inside the container, localhost works because both processes share the same network namespace.

---

## 8. Troubleshooting

### 8.1 "Cannot write model registry file" (PermissionError)

**Symptom:** Activation returns `500` with message about container lacking write access.

**Cause:** The container user doesn't have write permission to the bind-mounted `models/` directory.

**Fix:** Ensure the Dockerfile does **not** use `USER appuser` and does **not** `chown` to a non-root user. The container must run as `root` to write to the host-mounted volume.

**Verify:**
```bash
curl -s http://localhost:8001/admin/models
# Check that activation works:
curl -s -X POST http://localhost:8001/admin/models/{model_id}/activate
```

### 8.2 Dashboard shows "Cannot connect to API"

**Cause:** Streamlit started before FastAPI finished booting, or FastAPI crashed.

**Fix:**
```bash
# Check FastAPI health
curl http://localhost:8001/health
# Restart ml-service container
docker compose -f docker-compose-fedora.yml restart ml-service
```

### 8.3 Activated model not used for predictions

**Cause:** `reload_active_model()` failed silently, or the prediction code bypasses `_active_model_context()`.

**Fix:** Check the FastAPI logs for reload errors:
```bash
docker compose -f docker-compose-fedora.yml logs ml-service | grep -i reload
```

Verify health endpoint shows the correct `active_model_id`:
```bash
curl -s http://localhost:8001/health | jq .active_model_id
```

### 8.4 SHAP explanations wrong after activation

**Cause:** SHAP explainer cache was not cleared.

**Fix:** Ensure `reload_active_model()` calls `clear_shap_cache()`. If the active model changed from single to ensemble (or vice versa), also verify `init_ensemble_explainer()` is called.

### 8.5 Dashboard shows stale data after activation

**Cause:** Streamlit page was not refreshed.

**Fix:** The activation handler now calls `st.rerun()` automatically. If this fails, check browser console for JavaScript errors or verify the Streamlit version supports `st.rerun()` (requires Streamlit ≥ 1.23).

---

## 9. API Response Examples

### GET /admin/models (Registry Overview)

```json
{
  "summary": {
    "active_model_id": "ensemble_robust_average_v1.1.0",
    "active_version": "v1.1.0",
    "promoted_at": "2026-06-09T21:42:00",
    "total_models": 5,
    "latest_candidate": "v2_2026-06-03_008"
  },
  "models": [
    {
      "model_id": "ensemble_robust_average_v1.1.0",
      "version": "v1.1.0",
      "framework": "ensemble",
      "stage": "production",
      "is_active": true,
      "metrics": { "MAPE_pct": 8.5, "MAE": 45000, "R2": 0.92 },
      "registered_at": "2026-06-01T10:00:00"
    }
  ]
}
```

### POST /admin/models/{id}/activate

```json
{
  "success": true,
  "activated_model_id": "v2_2026-06-03_008",
  "previous_model_id": "ensemble_robust_average_v1.1.0",
  "reloaded": true,
  "message": "Model 'v2_2026-06-03_008' is now active and loaded in memory."
}
```

---

## 10. Future Improvements

- **Audit log:** Persist activation history (who, when, from→to) to a database table or append-only log file
- **Rollback:** One-click revert to previous active model
- **A/B testing gate:** Require confirmation with model metrics diff before activation
- **Auto-refresh:** Periodic polling in Registry Overview to show live state without manual refresh
- **Dark mode:** Add theme toggle in sidebar

---

## 11. Related Documents

- `04-DEPLOYMENT-GUIDE.md` — Container build and deployment instructions
- `11-ML-SERVICE-REFACTOR-PLAN.md` — Service architecture and code organization
- `13-EXPERT-PRICE-EXPLANATIONS.md` — SHAP explainability system details
- `app/core/model_registry.py` — Registry JSON read/write primitives
- `app/services/model/model_state.py` — Global model state and loading

---

## 12. Known Issues & Bug Fixes

### Bug 1: Prediction API returned wrong model version after activation

**Symptom:** After activating a new model via the dashboard or `/admin/models/{id}/activate`, `GET /admin/models` showed the correct active model, but `POST /api/v1/predict` still returned the old `model_version` (e.g. `v2.1.0` instead of `v1.1.0`).

**Root Cause:** `app/services/model/router.py` implemented an **older-model fallback** policy. If the active model did not contain the exact `(make, model)` combination in its coverage artifacts, the router searched all registered models and served the newest older model that did support that combo. The fallback happened silently — the response showed the fallback model's version with no indication the active model was bypassed.

**Fix (2026-06-10):**
- Removed `older_model_fallback` from `resolve_model_for_prediction()`.
- For known makes, the active model is now always used. If the exact combo is missing, the active model generalizes with degraded confidence (`known_make_model_missing`).
- This guarantees that activating a model immediately changes the serving behavior for all known makes.
- Removed unreachable fallback branches from `app/api/predict.py` (single and batch endpoints).
- Removed stale `older_model_fallback` label from `admin/dashboard.py`.

**Files changed:** `app/services/model/router.py`, `app/api/predict.py`, `admin/dashboard.py`

---

### Bug 2: `price_factors` missing even when `include_factors=true`

**Symptom:** After activating a new model, `POST /api/v1/predict` with `include_factors: true` returned `price_factors: null`.

**Root Cause:** Two separate issues:
1. **Fallback context skips factors:** The prediction pipeline (`app/services/prediction/predictor.py`) intentionally skips factor computation when a fallback `context` is provided, to avoid explainer mismatch. Because Bug 1 was silently routing to a fallback model, factors were always skipped.
2. **Silent ensemble explainer init failure:** `reload_active_model()` in `model_state.py` called `init_ensemble_explainer()` inside a bare `except: pass` block. If the ensemble explainer failed to initialize after hot-reload, the failure was swallowed silently with no log entry, leaving `_ENSEMBLE_EXPLAINER_READY = False`. Without the explainer ready, ensemble factor requests returned `None`.

**Fix (2026-06-10):**
- Fixing Bug 1 eliminated the first cause (no more fallback contexts in the main flow).
- Changed the bare `except: pass` blocks in `reload_active_model()` to explicit `logger.warning(...)` / `logger.error(...)` calls so future SHAP or ensemble explainer failures are visible in logs.
- Deleted dead legacy modules (`app/services/predictor.py` and `app/services/ensemble_explainer.py`) that were not imported by the active code path but created confusion when tracing the issue.

**Files changed:** `app/services/model/model_state.py`, `app/services/predictor.py` (deleted), `app/services/ensemble_explainer.py` (deleted)

---

### Verification

After the fixes, a prediction request for `Toyota Corolla` with `include_factors: true` now returns:
- `model_version: "v1.1.0"` (matches active model)
- `price_factors: [...]` (5 ranked SHAP factors from the ensemble explainer)

This confirms that activation, hot-reload, routing, and factor generation are all aligned on the same active model.
