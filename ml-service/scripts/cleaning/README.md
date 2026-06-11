# Cleaning Module — Data Pipeline

Reusable cleaning and preprocessing pipeline for the KARNA car price prediction service.
Every script here is **idempotent** and designed to run on each new raw data snapshot
pulled from Supabase — not just a one-time fix.

---

## Pipeline Flow

```
Supabase (data_loader.py)
    │
    ▼
data/raw/cars_with_make_model.csv        ← raw snapshot (versioned by timestamp)
    │
    ▼
┌───────────────────────────────── ───────┐
│  clean_raw_data_pipeline.py   (MASTER PIPELINE — orchestrates)  │
│                                                                                                                  │
│  Stage 1:  Make/model canonicalization + wrong-pair fixes                   │
│  Stage 2:  EV/hybrid fuel/transmission enforcement                               │
│  Stage 3:  Impossible model-year cleaning + conditional drops              │
│  Stage 4:  Deduplication (exact duplicate listings)                                  │
│  Stage 5:  Merge validation (lookup duplicate check)                             │                
└─ ───────────────────────────────────────┘
    │
    ▼
data/raw/cars_with_make_model.csv        ← cleaned in-place (backup auto-created)
    │
    ▼
┌────────────────────────────────  ─────┐
│  generate_processed_data.py   (FEATURE BUILDER)                  │ 
│                                                                                                           │
│  1. Drop residual unwanted columns                                                │
│  2. Drop rows missing price/year                                                     │
│  3. Normalize location → 17 standard categories                            │
│  4. Merge with car_specs_lookup on (make, model, year)              │
│     - Exact match → nearest-year fallback                                        │
│  5. Derive: car_age, mileage_per_year, price_egp_log                    │
│  6. Select final columns                                                                    │
└─────────────────────────────────────  ┘
    │
    ▼
data/processed/processed_data.csv        ← model-ready data (versioned)
```

---

## File Reference

| File | Purpose | When to Run |
|------|---------|-------------|
| `clean_raw_data_pipeline.py` | **Master pipeline** — orchestrates all 5 cleaning stages. Start here. | Every new raw data snapshot |
| `generate_processed_data.py` | Builds `processed_data.csv` from cleaned raw + lookup merge. Runs *after* the master pipeline. | Every new raw data snapshot |
| `clean_impossible_model_years.py` | Standalone model-year validator. Used by the master pipeline (Stage 3) but can run independently for debugging. | As needed |
| `fix_car_main_info_ev_fuel.py` | Standalone EV/hybrid fuel+transmission fixer. Used by master pipeline (Stage 2) but can run independently. | As needed |
| `fix_lookups_make_model.py` | Canonicalizes make/model in lookup CSVs, collapses duplicates, validates specs. Run when lookup data changes. | When lookups are updated |
| `fix_car_specs_lookup_full.py` | Targeted overrides for car spec lookup (engine_cc, horsepower, body_type, etc.). Run when spec corrections are needed. | When specs need correction |
| `drop_unwanted_columns.py` | Strips `model_family` and `brand_market_share` from CSVs. Guard rail — also applied inside the master pipeline and `generate_processed_data.py`. | Once per data version (or as guard) |
| `version_manager.py` | **Version manager** — generates date-based tags, reads/writes `data/data_manifest.json`, resolves versioned paths, provides rollback. | When needed (CLI tool) |
| `data_pipeline.py` | **Versioned pipeline orchestrator** — wraps clean + process into a single versioned run, registers in manifest. Use instead of running scripts manually. | Every new raw data snapshot |
| `combine_versions.py` | **Training dataset builder** — combines all processed versions into a deduped, rare-filtered `training_data.csv`. Creates immutable versions in `training_versions/` and logs structured run summaries. | After adding new processed versions |
| `check_version_consistency.py` | Verifies all registered versions are combinable (same columns, dtypes, casing). | Before `combine` or ad-hoc |
| `data_cleaner.py` | Legacy placeholder (not yet implemented). Superseded by the master pipeline above. | — |

---

## Data Versioning

**Implemented** (2026-05-24). Each data pull → clean → process cycle produces immutable versioned files.

```
data/
├── raw/
│   ├── snapshots/cars_raw_YYYY-MM-DD_NNN.csv   ← immutable raw pull
│   └── cars_with_make_model.csv                ← copy of latest (backward compat)
├── cleaned/
│   └── cars_cleaned_YYYY-MM-DD_NNN.csv         ← immutable cleaned snapshot
├── processed/
│   ├── versions/processed_YYYY-MM-DD_NNN.csv   ← immutable processed snapshot
│   ├── training_versions/                      ← immutable training datasets
│   │   └── training_YYYY-MM-DD_NNN.csv
│   ├── processed_data.csv                      ← copy of latest processed (backward compat)
│   └── training_data.csv                     ← copy of latest training (backward compat)
├── data_manifest.json                        ← raw/cleaned/processed versions
├── training_manifest.json                    ← training dataset versions
└── logs/
    ├── pipeline_YYYYMMDD_HHMMSS.log
    ├── combine_YYYYMMDD_HHMMSS.log
    ├── clean_raw_data_YYYYMMDD_HHMMSS.log
    ├── generate_YYYYMMDD_HHMMSS.log
    └── runs/
        ├── pipeline_YYYYMMDD_HHMMSS.json      ← structured pipeline run summaries
        └── combine_YYYYMMDD_HHMMSS.json       ← structured combine run summaries
```

**Version tags**: `YYYY-MM-DD_NNN`. Same-day re-pull auto-increments `NNN` starting at `001`.

**Training data versions**: Every `combine` run creates an immutable training dataset in `training_versions/` and updates the alias `training_data.csv`. Tags follow the same `YYYY-MM-DD_NNN` convention and are tracked in `training_manifest.json`.

**Backward compatibility**: Fixed-path files are always a copy of the latest version.
Existing scripts, notebooks, and the API service continue to read from fixed paths.

**Structured run summaries**: Every `data_pipeline.py` and `combine_versions.py` run writes a machine-readable JSON summary to `data/logs/runs/`. These capture status, row counts, stage results, errors, and file paths for programmatic auditing.

**Rollback**: `python scripts/cleaning/version_manager.py rollback <tag> --apply`

---

## Quick Start

```bash
# 1. Pull fresh data from Supabase
python scripts/data/data_loader.py

# 2. Run the versioned pipeline (clean + process + register version)
python scripts/cleaning/data_pipeline.py             # dry-run first
python scripts/cleaning/data_pipeline.py --apply     # execute

# 3. Check version history
python scripts/cleaning/version_manager.py list
python scripts/cleaning/version_manager.py current

# 4. Verify all versions are combinable
python scripts/cleaning/check_version_consistency.py

# 5. Combine all processed versions → versioned training_data.csv
python scripts/cleaning/combine_versions.py              # dry-run first
python scripts/cleaning/combine_versions.py --apply       # execute
# Optional: label the training version explicitly
python scripts/cleaning/combine_versions.py --apply --tag 2026-06-03_001

# 6. Inspect the latest run summary
# data/logs/runs/combine_YYYYMMDD_HHMMSS.json

# 7. (If needed) Rollback to a previous version
python scripts/cleaning/version_manager.py rollback 2026-05-24 --apply
```

---

## Design Principles

1. **Idempotent** — running any script on already-cleaned data produces zero changes
2. **Conservative** — rules only act on explicitly listed (make, model) pairs; no fuzzy matching
3. **Auditable** — every `--apply` creates a timestamped `.bak` backup and a `.log` file
4. **Report-first** — always run `--mode report` or dry-run before applying changes
5. **Guard-railed** — `drop_unwanted_columns` and `generate_processed_data` both strip `model_family`/`brand_market_share` even if they somehow reappear
6. **Immutable training data** — `combine_versions.py` never overwrites a training version tag. Each run produces a new `training_YYYY-MM-DD_NNN.csv` in `training_versions/` and updates the alias `training_data.csv` for backward compatibility.
