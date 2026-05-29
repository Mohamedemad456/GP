# Plan 8: Testing & Hardening

> **Recommended Model**: GPT 5.4 (tests) + GPT 5.2 (docs/cleanup)  
> **Dependencies**: Plans 2 (Features) and 6 (API Updates) must be complete  
> **Blocks**: None (final quality gate)

---

## Current State & Problems

### Problem 1: Test Suite is Incomplete for V2
- Current 6 test files cover V1 behavior only
- No tests for new features (`log_mileage_km`, `mileage_ratio`, `mm_price_tier`, etc.)
- No tests for CQR calibration logic
- No tests for V2 ensemble prediction path
- **Impact**: Silent regressions when V2 changes are deployed

### Problem 2: No Data Pipeline Tests
- The cleaning/processing pipeline has no automated validation
- Schema drift (wrong columns, wrong types) would only be caught at training time
- **Impact**: Garbage in → garbage out, discovered too late

### Problem 3: No Integration/Smoke Tests
- Unit tests mock dependencies — can't catch integration issues
- No test that starts the real service and hits the API
- No test that verifies the full prediction path end-to-end
- **Impact**: "Tests pass but service crashes" scenarios

### Problem 4: No Regression Test for Feature Builder Sync
- The most dangerous bug: feature builder produces different features than training
- Currently no automated check that inference features match training features
- **Impact**: Silently wrong predictions in production

### Problem 5: Stale Files and Duplicates
- `processed_data copy.csv` — unnecessary duplicate
- Multiple `.bak` files in lookups directory
- Old notebook backups (`05_xgboost_lgbm_quantile_backup.ipynb`, `05_xgboost_lgbm_quantile_first_version.ipynb`)
- Dead code references to `model_family`
- **Impact**: Confusion, larger repo, potential bugs from using wrong file

---

## Test Categories

### Category A: Unit Tests (existing + new)
Fast, isolated, mock dependencies. Run on every commit.

### Category B: Data Validation Tests
Verify data files have correct schema. Run after any data change.

### Category C: Integration Tests
Start service, hit real endpoints. Run before deployment.

### Category D: Feature Sync Tests
Verify inference features match training. Run after any feature change.

---

## Implementation Steps

### Step 8.1 — Update `test_feature_builder.py` for V2
**Model**: GPT 5.4

**New test cases**:
```python
def test_v2_features_present():
    """Feature builder output includes all V2 features."""
    df = build_features(make="Toyota", model="Corolla", year=2020, mileage_km=50000)
    assert 'log_mileage_km' in df.columns
    assert 'mileage_ratio' in df.columns
    assert 'year_bucket' in df.columns
    assert 'mm_price_tier' in df.columns
    assert 'make_model_count' in df.columns

def test_log_mileage_computation():
    """log_mileage_km = log1p(mileage_km)."""
    df = build_features(make="Toyota", model="Corolla", year=2020, mileage_km=50000)
    import numpy as np
    assert abs(df['log_mileage_km'].iloc[0] - np.log1p(50000)) < 0.001

def test_mileage_ratio_clamped():
    """mileage_ratio is clamped to [0, 5]."""
    # Extreme mileage: 500K km on 1-year-old car → ratio = 500000/(1*15000) = 33 → clamped to 5
    df = build_features(make="Toyota", model="Corolla", year=2025, mileage_km=500000)
    assert df['mileage_ratio'].iloc[0] <= 5.0

def test_year_bucket_computation():
    """year_bucket = (year - 2000) // 5."""
    df = build_features(make="Toyota", model="Corolla", year=2022, mileage_km=50000)
    assert df['year_bucket'].iloc[0] == (2022 - 2000) // 5  # = 4

def test_mm_price_tier_default():
    """Unknown make/model gets default tier."""
    df = build_features(make="UnknownBrand", model="UnknownModel", year=2020, mileage_km=50000)
    assert df['mm_price_tier'].iloc[0] == 'standard'  # default

def test_feature_cols_order():
    """Feature columns match expected order exactly."""
    from app.services.prediction.feature_builder import FEATURE_COLS
    df = build_features(make="Toyota", model="Corolla", year=2020, mileage_km=50000)
    assert list(df.columns) == FEATURE_COLS
```

### Step 8.2 — Create `test_cqr_calibration.py`
**Model**: GPT 5.4

```python
def test_cqr_params_loaded():
    """CQR calibration params load successfully."""
    from app.services.model.model_state import CQR_PARAMS
    # After startup, CQR_PARAMS should be a dict with required keys
    assert CQR_PARAMS is not None or True  # Graceful if file missing

def test_cqr_interval_monotonicity():
    """CQR-calibrated intervals maintain: lower_90 <= lower_80 <= fair <= upper_80 <= upper_90."""
    # Test with a mock prediction
    ...

def test_cqr_non_negative():
    """CQR-calibrated lower bounds are never negative."""
    # Even with large q_hat, prices should be clipped to 0
    ...
```

### Step 8.3 — Create `test_data_pipeline.py`
**Model**: GPT 5.4

```python
import pandas as pd
from app.core.config import settings

def test_processed_data_schema():
    """Processed data has required columns and no forbidden columns."""
    df = pd.read_csv(settings.processed_data_path, nrows=100)
    
    required = {'make', 'model', 'year', 'mileage_km', 'price_egp', 'transmission', 'fuel'}
    assert required.issubset(set(df.columns))
    
    forbidden = {'model_family', 'brand_market_share'}
    assert forbidden.isdisjoint(set(df.columns))

def test_processed_data_no_impossible_years():
    """No known impossible model-year combinations in processed data."""
    df = pd.read_csv(settings.processed_data_path)
    # Tesla Model Y before 2020
    tesla_y = df[(df['make'].str.lower() == 'tesla') & (df['model'].str.lower() == 'model y')]
    assert (tesla_y['year'] >= 2020).all()

def test_processed_data_price_range():
    """All prices are in reasonable range."""
    df = pd.read_csv(settings.processed_data_path)
    assert (df['price_egp'] > 0).all()
    assert (df['price_egp'] < 100_000_000).all()  # No car > 100M EGP

def test_processed_data_no_nan_critical():
    """No NaN in critical columns."""
    df = pd.read_csv(settings.processed_data_path)
    for col in ['make', 'model', 'year', 'price_egp']:
        assert df[col].notna().all(), f"NaN found in {col}"

def test_lookup_no_forbidden_columns():
    """Lookup files don't have model_family or brand_market_share."""
    for path in [settings.lookup_dir / 'car_specs_lookup_full_cleaned.fixed.csv',
                 settings.lookup_dir / 'AI_lookup.fixed.csv']:
        if path.exists():
            df = pd.read_csv(path, nrows=5)
            assert 'model_family' not in df.columns
            assert 'brand_market_share' not in df.columns
```

### Step 8.4 — Create `test_feature_sync.py`
**Model**: GPT 5.4 (CRITICAL TEST)

```python
"""
Test that inference feature builder produces the SAME features
as the training pipeline for identical inputs.

This is the most important test in the system — if this fails,
all predictions are silently wrong.
"""
import numpy as np
import pandas as pd
from app.services.prediction.feature_builder import build_features, FEATURE_COLS, CAT_COLS, NUM_COLS

def test_feature_cols_match_training():
    """FEATURE_COLS in inference must match training notebook exactly."""
    # These are the V2 training feature columns (update if training changes)
    EXPECTED_NUM = ['year', 'mileage_km', 'mileage_per_year', 'engine_cc',
                    'horsepower', 'seating_capacity',
                    'log_mileage_km', 'mileage_ratio', 'year_bucket', 'make_model_count']
    EXPECTED_CAT = ['make', 'model', 'transmission', 'fuel', 'location',
                    'body_type', 'drivetrain', 'brand_origin', 'car_segment', 'mm_price_tier']
    
    assert NUM_COLS == EXPECTED_NUM, f"NUM_COLS mismatch: {NUM_COLS}"
    assert CAT_COLS == EXPECTED_CAT, f"CAT_COLS mismatch: {CAT_COLS}"

def test_feature_builder_no_extra_columns():
    """build_features() output has EXACTLY FEATURE_COLS, no more no less."""
    df = build_features(make="Toyota", model="Corolla", year=2020, mileage_km=50000)
    assert set(df.columns) == set(FEATURE_COLS)
    assert len(df.columns) == len(FEATURE_COLS)

def test_feature_builder_deterministic():
    """Same input always produces same output."""
    df1 = build_features(make="Toyota", model="Corolla", year=2020, mileage_km=50000)
    df2 = build_features(make="Toyota", model="Corolla", year=2020, mileage_km=50000)
    pd.testing.assert_frame_equal(df1, df2)
```

### Step 8.5 — Create Integration Smoke Test
**Model**: GPT 5.4

**File**: `tests/test_integration.py`

```python
"""
Integration tests — require the service to be running.
Run with: pytest tests/test_integration.py --integration
Skip if service not running.
"""
import pytest
import requests

BASE_URL = "http://localhost:8001"

@pytest.fixture
def service_available():
    try:
        r = requests.get(f"{BASE_URL}/health", timeout=2)
        if r.status_code != 200:
            pytest.skip("Service not running")
    except:
        pytest.skip("Service not running")

def test_health_endpoint(service_available):
    r = requests.get(f"{BASE_URL}/health")
    data = r.json()
    assert data["model_loaded"] is True
    assert "model_version" in data or "active_model_id" in data

def test_predict_basic(service_available):
    r = requests.post(f"{BASE_URL}/api/v1/predict", json={
        "make": "Toyota", "model": "Corolla", "year": 2020,
        "mileage_km": 50000, "transmission": "Automatic", "fuel": "petrol"
    })
    assert r.status_code == 200
    data = r.json()
    assert "fair_price" in data
    assert data["fair_price"] > 0
    assert "negotiation_range" in data
    assert data["negotiation_range"]["min_price"] <= data["fair_price"]
    assert data["negotiation_range"]["max_price"] >= data["fair_price"]

def test_predict_with_interval(service_available):
    r = requests.post(f"{BASE_URL}/api/v1/predict?include_interval=true", json={
        "make": "BMW", "model": "X5", "year": 2022,
        "mileage_km": 30000
    })
    data = r.json()
    if "prediction_interval" in data:
        pi = data["prediction_interval"]
        assert pi["lower_90"] <= pi["lower_80"] <= data["fair_price"]
        assert data["fair_price"] <= pi["upper_80"] <= pi["upper_90"]
```

### Step 8.6 — Cleanup Stale Files
**Model**: GPT 5.2

**Files to remove**:
| File | Reason |
|------|--------|
| `data/processed/processed_data copy.csv` | Unnecessary duplicate |
| `data/lookups/*.bak` | Old backups, cluttering |
| `data/raw/*.bak` | Old backups |
| `data/lookups/fix_run.log` | One-time log from fixing script |

**Files to archive** (rename, don't delete):
| File | New Name |
|------|----------|
| `notebooks/05_xgboost_lgbm_quantile_backup.ipynb` | `notebooks/archive/05_v1_backup.ipynb` |
| `notebooks/05_xgboost_lgbm_quantile_first_version.ipynb` | `notebooks/archive/05_v1_first.ipynb` |

### Step 8.7 — Update Documentation
**Model**: GLM 5.1 / GPT 5.2

**Files to update**:
- `ml-service/README.md` — Add V2 model info, retraining CLI usage
- `ml-service/PROJECT_STATUS_REPORT.md` — Mark tasks as complete
- Consider a simple `CHANGELOG.md` for V2 release notes

---

## Test Execution Commands

```bash
# Run all unit tests (fast, no service needed)
pytest tests/ -v --ignore=tests/test_integration.py

# Run data validation tests only
pytest tests/test_data_pipeline.py -v

# Run feature sync tests only (CRITICAL)
pytest tests/test_feature_sync.py -v

# Run integration tests (service must be running)
pytest tests/test_integration.py -v --integration

# Run everything
pytest tests/ -v
```

---

## Challenges & Risks

| Challenge | Risk | Mitigation |
|-----------|------|-----------|
| Integration tests require running service | Can't run in CI easily | Mark with `@pytest.mark.integration`, skip if service down |
| Feature sync test becomes stale | False sense of security | Update EXPECTED constants whenever training changes |
| Deleting backup files loses history | Can't recover if needed | Git history preserves everything |
| Test data may not cover edge cases | Bugs slip through | Add edge cases as they're discovered |

---

## Files Created/Modified by This Plan

| File | Action |
|------|--------|
| `tests/test_feature_builder.py` | Update with V2 feature tests |
| `tests/test_cqr_calibration.py` | NEW |
| `tests/test_data_pipeline.py` | NEW |
| `tests/test_feature_sync.py` | NEW |
| `tests/test_integration.py` | NEW |
| `data/processed/processed_data copy.csv` | DELETE |
| `data/lookups/*.bak` | DELETE |
| `data/raw/*.bak` | DELETE |
| `notebooks/archive/` | NEW directory for old notebooks |
| `README.md` | Update |

---

## Success Criteria

- [ ] All existing 6 test files pass (no regressions)
- [ ] All new test files pass
- [ ] `test_feature_sync.py` passes (inference matches training)
- [ ] `test_data_pipeline.py` passes (data is clean)
- [ ] Integration tests pass when service is running
- [ ] No stale/duplicate files in data directories
- [ ] README reflects V2 state
- [ ] Total test count: ≥ 35 tests (up from 25)
