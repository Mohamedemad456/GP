# Plan 1 Implementation Notes — Data Cleaning & Quality

> **Completed**: 2026-05-24  
> **Status**: ✅ Done  
> **Result**: 26,361 → 22,969 cleaned rows → 20,215 processed rows

---

## What Was Done

### Step 1.1 — Drop `model_family` & `brand_market_share`

**Files modified**:
- `data/raw/cars_with_make_model.csv` — removed `model_family` column
- `data/lookups/car_specs_lookup_full_cleaned.fixed.csv` — removed `model_family` + `brand_market_share`
- `data/lookups/AI_lookup.fixed.csv` — removed `model_family`

**Script created**: `scripts/cleaning/drop_unwanted_columns.py`
- Supports `--apply` (in-place with `.bak` backup) and dry-run (default)
- Verifies columns are gone after writing

**Verification**: All three CSVs confirmed clean via header inspection. Zero grep hits for either column across all `.py` files.

---

### Step 1.1b — Remove `model_family` from Pipeline Scripts

**Files modified**:
- `scripts/cleaning/clean_raw_data_pipeline.py` — removed `build_family_map()`, `resolve_model_family()`, `enrich_with_family()` functions and all calls to them
- `scripts/cleaning/fix_lookups_make_model.py` — removed `enrich_with_family()` calls in both report and apply modes; added guard that drops `model_family`/`brand_market_share` from output DataFrames before writing CSV

**Why**: Even if a future data pull re-introduces these columns, the pipeline will strip them automatically.

---

### Step 1.2 — Expand Model-Year Rules

**Files modified**:
- `scripts/cleaning/clean_impossible_model_years.py` — extended `ModelYearRule` with `max_year: int | None = None`; added `ConditionalDropRule` dataclass; added 23 new rules (Priority 1, 2, 3); updated `clean_file()` to handle conditional drops and max_year checks
- `scripts/cleaning/clean_raw_data_pipeline.py` — mirrored all changes: `ModelYearRule` with `max_year`, `ConditionalDropRule`, same rule lists, updated `apply_year_cleaning()` returning 3-tuple

**New rules added**:

| Priority | Type | Count | Examples |
|----------|------|-------|---------|
| 1 | `ModelYearRule` with `max_year` | 6 | Chevrolet Avalanche 2002–2013, Fiat 127 ≤1983, Hyundai Excel ≤1994 |
| 2 | `ConditionalDropRule` | 2 | Avalanche diesel → drop, Avalanche Manual → drop |
| 3 | `ModelYearRule` with `min_year` | 17 | Tesla Model 3 ≥2017, BYD Seal ≥2022, Kia EV6 ≥2021, Geely Coolray ≥2019 |

**Impact**: 269 year-violation rows removed + 25 conditional drops (fuel/transmission mislabels).

---

### Step 1.3 — Expand EV/Hybrid Fix Rules

**Files modified**:
- `scripts/cleaning/fix_car_main_info_ev_fuel.py` — expanded `PURE_EV_MODELS` from 22 → 44 entries; added `HYBRID_MODELS` set (4 BYD DM-i models); updated main loop to handle both EV and hybrid corrections
- `scripts/cleaning/clean_raw_data_pipeline.py` — mirrored: same expanded `PURE_EV_MODELS`, added `HYBRID_MODELS`, updated `apply_ev_fixes()`

**New EV models added**: Tesla Model S/X, BMW I4/IX, Mercedes EQS/EQE/EQB/EQC, BYD Seal/Han/Dolphin/Atto 3/Seagull/Ocean, Porsche Taycan, MG Marvel R, Hyundai Ioniq 5/6, Kia EV6/EV9

**New hybrid models**: BYD Song Plus DM-i, Han DM-i, Tang DM-i, Song Pro DM-i

**Impact**: 0 rows changed in this run (existing data already had correct values), but the rules are now comprehensive for future data pulls.

---

### Step 1.4 — Deduplication Stage

**File modified**: `scripts/cleaning/clean_raw_data_pipeline.py` — added `apply_dedup()` function as Stage 4

**Logic**: Groups by `(make, model, year, mileage_km, price_egp)` and keeps first occurrence. Conservative — only exact copies removed.

**Impact**: 3,098 duplicate listings removed (11.7% of data).

---

### Step 1.5 — Generate Processed Data

**File created**: `scripts/cleaning/generate_processed_data.py`

**Pipeline**:
1. Read cleaned `cars_with_make_model.csv`
2. Strip residual `model_family`/`brand_market_share`
3. Drop rows missing `price_egp` or `year`
4. Normalize location → 17 categories (mirrors notebook `02_data_cleansing.ipynb` exactly)
5. Merge with `car_specs_lookup_full_cleaned.fixed.csv` — exact match, then nearest-year fallback
6. Derive `car_age`, `mileage_per_year`, `price_egp_log`
7. Select 18 output columns
8. Verify no unwanted columns in output

**Result**: 20,215 rows in `data/processed/processed_data.csv` (down from 20,462 in old copy).

---

## Files Created

| File | Purpose |
|------|---------|
| `scripts/cleaning/drop_unwanted_columns.py` | Strip unwanted columns from CSVs |
| `scripts/cleaning/generate_processed_data.py` | Build processed_data.csv from cleaned raw + lookup |

## Files Modified

| File | Changes |
|------|---------|
| `scripts/cleaning/clean_raw_data_pipeline.py` | Removed model_family enrichment; added max_year + ConditionalDropRule + all new rules; expanded EV/hybrid models; added dedup stage |
| `scripts/cleaning/clean_impossible_model_years.py` | Added max_year + ConditionalDropRule + all new rules |
| `scripts/cleaning/fix_car_main_info_ev_fuel.py` | Expanded EV models; added hybrid models support |
| `scripts/cleaning/fix_lookups_make_model.py` | Removed enrich_with_family; added model_family/brand_market_share drop guard |
| `data/raw/cars_with_make_model.csv` | model_family column dropped |
| `data/lookups/car_specs_lookup_full_cleaned.fixed.csv` | model_family + brand_market_share dropped |
| `data/lookups/AI_lookup.fixed.csv` | model_family dropped |
| `data/processed/processed_data.csv` | Regenerated from cleaned data |
| `docs/MASTER_IMPLEMENTATION_PLAN.md` | Plan 1 marked ✅ Done |

---

## Notes & Observations

### 1. EV fixes had zero impact on current data
All existing EV/hybrid rows already had correct fuel/transmission values. The expanded rule set is **forward-looking** — it will catch errors in future data pulls where sellers mislabel new EV models.

### 2. Dedup removed a significant chunk (11.7%)
3,098 exact duplicates is substantial. This likely comes from multiple scraping rounds where the same car was listed with identical attributes. The dedup is conservative (exact 5-field match) so we're not losing legitimate data.

### 3. Year violations were concentrated
269 year-violation rows is reasonable. Most were likely seller input errors (e.g., typing "2015" instead of "2025" for a Tesla Model Y). The new `max_year` rules for discontinued models (Fiat 127/128/131, Hyundai Excel) will prevent future ghost entries.

### 4. Conditional drops are a new concept
The `ConditionalDropRule` class handles cases where the year is valid but the fuel or transmission is impossible for that make/model. Currently only 2 rules (Chevrolet Avalanche diesel/Manual), but the infrastructure is ready for more.

### 5. Location normalization mirrors the notebook exactly
The `normalize_locations()` function in `generate_processed_data.py` replicates the `np.select` logic from `02_data_cleansing.ipynb` cell 20, including the tier ordering fix (Giza before October & Zayed to catch "hadayek october").

### 6. Idempotency is verified
Re-running the master pipeline on already-cleaned data produces 0 changes across all stages. This is critical for the incremental pipeline — you can safely re-run after adding new rules.

### 7. `data_cleaner.py` is a legacy placeholder
This file has only a docstring and a `# TODO: Implement`. It's superseded by the master pipeline. Consider removing or redirecting it.

---

## Step 1.6 — Data Versioning Infrastructure ✅ Implemented 2026-05-24

### What Was Built

Two new files in `scripts/cleaning/`:

| File | Lines | Purpose |
|------|-------|---------|
| `version_manager.py` | 245 | `DataVersion` dataclass, `VersionManager` class, CLI (`seed`, `list`, `current`, `rollback`, `verify`, `new-tag`) |
| `data_pipeline.py` | 170 | Versioned clean + process orchestrator — wraps existing scripts via subprocess |

**`data/data_manifest.json`** — seeded with the current state as version `2026-05-24`:
```json
{
  "current_version": "2026-05-24",
  "versions": {
    "2026-05-24": {
      "raw_rows": 22969,
      "cleaned_rows": 22969,
      "processed_rows": 20214,
      "raw_fingerprint": "sha256:eefebf175c7a73fb9..."
    }
  }
}
```

### New Directory Structure
```
data/
├── raw/snapshots/cars_raw_2026-05-24.csv        ← immutable
├── cleaned/cars_cleaned_2026-05-24.csv          ← immutable after creation
├── processed/versions/processed_2026-05-24.csv  ← immutable after creation
└── data_manifest.json                           ← single source of truth
```

Fixed-path files (`cars_with_make_model.csv`, `processed_data.csv`) remain as
**copies** of the latest version — all existing scripts/notebooks/API continue
to work unchanged.

### Key Design Decisions
- **Date-based tags** (`YYYY-MM-DD`), not `v1/v2` — self-documenting
- **Copies** not symlinks — Docker/Windows compat
- **Atomic manifest writes** — write to `.json.tmp`, then rename
- **No auto-cleanup** — old versions persist until manually pruned

### Usage Going Forward
```bash
# After pulling fresh data from Supabase:
python scripts/cleaning/data_pipeline.py --apply --raw <new_file>

# Version management:
python scripts/cleaning/version_manager.py list
python scripts/cleaning/version_manager.py rollback 2026-05-24 --apply
```

---

## Future Considerations (Plans 2 & 5)

### Incremental Data Accumulation
"Incremental" means accumulating data **across snapshots**, NOT incremental ML training.
Each snapshot captures only currently active listings (16–26K rows). Training on only
the latest snapshot discards all "sold car" records, which are the most trustworthy
price data (completed transactions).

**Strategy**: Merge all versioned processed files → dedup → train on full accumulated set.
- Dedup key: `(make, model, year, mileage_km, price_egp)` — same exact listing = keep one
- Price changed: keep both (repricing is a legitimate separate data point)
- `scraped_at` becomes Feature 2.6 (`days_since_baseline`) to capture EGP inflation and
  seasonal demand patterns (see Plan 2)

### `scraped_at` Preservation
Currently `generate_processed_data.py` does NOT preserve `scraped_at` in `processed_data.csv`.
Plan 2 Step 2.1 will add `days_since_baseline` derived from `scraped_at` to the output columns.

### Feature Distribution Baseline
Plan 08 Step 8.10 will create `models/metrics/feature_distribution_baseline.json` at
training time, and `check_drift()` will run against it at each new snapshot.
