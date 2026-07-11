# Data Folder Cleanup Recommendations

> Generated: 2026-05-28
> Reviewed: all files under `data/` and subdirectories

---

## Summary

| Action | Count | Est. space saved |
|--------|-------|------------------|
| Safe to delete (stale logs) | 16 files | ~2–5 MB |
| Confirm before delete (orphaned processed file) | 1 file | ~20 MB |
| Keep (essential data / registered versions) | 22 files | — |

---

## SAFE TO DELETE — Stale / Redundant Log Files

### `data/raw/`
| File | Why delete |
|------|-----------|
| `clean_raw_data_20260510_201425.log` | Pre-versioning log (May 10). No registered version references it. |
| `clean_raw_data_20260524_161838.log` | Pre-versioning log (May 24). Same reason. |

### `data/cleaned/` — 11 old cleaning logs
All from May 25 pipeline iterations. Only the latest might be useful for debugging.

| File | Why delete |
|------|-----------|
| `clean_raw_data_20260525_113648.log` | Obsolete intermediate run |
| `clean_raw_data_20260525_114804.log` | Obsolete intermediate run |
| `clean_raw_data_20260525_115648.log` | Obsolete intermediate run |
| `clean_raw_data_20260525_122033.log` | Obsolete intermediate run |
| `clean_raw_data_20260525_131258.log` | Obsolete intermediate run |
| `clean_raw_data_20260525_135855.log` | Obsolete intermediate run |
| `clean_raw_data_20260525_140330.log` | Obsolete intermediate run |
| `clean_raw_data_20260525_141134.log` | Obsolete intermediate run |
| `clean_raw_data_20260525_141315.log` | Obsolete intermediate run |
| `clean_raw_data_20260525_141513.log` | Obsolete intermediate run |
| `clean_raw_data_20260525_142119.log` | **Keep** — latest cleaning log; may contain useful diagnostics |

### `data/logs/` — 4 old combine logs
| File | Why delete |
|------|-----------|
| `combine_20260525_151623.log` | Obsolete combine run |
| `combine_20260525_151729.log` | Obsolete combine run |
| `combine_20260525_152126.log` | Obsolete combine run |
| `combine_20260525_162023.log` | Obsolete combine run |
| `combine_20260525_163907.log` | **Keep** — latest combine log |

---

## CONFIRM BEFORE DELETE — Orphaned Pre-Pipeline File

| File | Why it might be deletable | Why you might want to keep it |
|------|--------------------------|-------------------------------|
| `data/processed/processed_data copy.csv` | `snapshot_one` (which referenced it) was deleted from the manifest. This file is now **untracked**. It was produced before the versioning pipeline existed. | It contains 20,461 processed rows and might be the "original" processed output you used for early experiments. If you have already reproduced those results with the versioned pipeline, it is safe to delete. |

**Recommendation:** If you have confirmed that `processed_2026-05-25_002.csv` (12,810 rows) supersedes this file, delete it. If not, keep it until you validate the new pipeline output against your old results.

---

## KEEP — Essential Data & Registered Versions

### Raw data
| File | Purpose |
|------|---------|
| `cars_raw.csv` | **Original round 1 data** (26,896 rows). Pre-pipeline, pre-versioning. |
| `cars_raw.parquet` | Parquet copy of `cars_raw.csv`. |
| `cars_raw_v002.csv` | Round 2 raw data (17,903 rows). Directly pulled from Supabase. |
| `cars_raw_v002.parquet` | Parquet copy of `cars_raw_v002.csv`. |
| `snapshots/cars_raw_2026-05-25_001.csv` | Registered version `_001` raw snapshot. |
| `snapshots/cars_raw_2026-05-25_002.csv` | Registered version `_002` raw snapshot. |
| `cars_with_make_model.csv` | Backward-compat alias → latest cleaned version. |
| `cars_with_make_model.parquet` | Parquet copy of above. |

### Cleaned data
| File | Purpose |
|------|---------|
| `data/cleaned/cars_cleaned_2026-05-25_001.csv` | Registered version `_001` cleaned output. |
| `data/cleaned/cars_cleaned_2026-05-25_002.csv` | Registered version `_002` cleaned output. |

### Processed data
| File | Purpose |
|------|---------|
| `data/processed/versions/processed_2026-05-25_001.csv` | Registered version `_001` processed output. |
| `data/processed/versions/processed_2026-05-25_002.csv` | Registered version `_002` processed output. |
| `data/processed/processed_data.csv` | Backward-compat alias → latest processed version. |
| `data/processed/training_data.csv` | Final deduped training dataset (from `make combine`). |
| `data/processed/consistency_report.csv` | Latest cross-version consistency check results. |

### Lookups & manifest
| File | Purpose |
|------|---------|
| `data/lookups/*` | All lookup tables (specs, locations, aliases, backend mappings). |
| `data/data_manifest.json` | Single source of truth for versions. |

---

## One-Liner to Delete Safe Files

```bash
cd data

# Delete stale raw logs
rm -f raw/clean_raw_data_20260510_201425.log raw/clean_raw_data_20260524_161838.log

# Delete stale cleaned logs (keep the latest 142119)
rm -f cleaned/clean_raw_data_20260525_113648.log \
      cleaned/clean_raw_data_20260525_114804.log \
      cleaned/clean_raw_data_20260525_115648.log \
      cleaned/clean_raw_data_20260525_122033.log \
      cleaned/clean_raw_data_20260525_131258.log \
      cleaned/clean_raw_data_20260525_135855.log \
      cleaned/clean_raw_data_20260525_140330.log \
      cleaned/clean_raw_data_20260525_141134.log \
      cleaned/clean_raw_data_20260525_141315.log \
      cleaned/clean_raw_data_20260525_141513.log

# Delete stale combine logs (keep the latest 163907)
rm -f logs/combine_20260525_151623.log \
      logs/combine_20260525_151729.log \
      logs/combine_20260525_152126.log \
      logs/combine_20260525_162023.log
```

> **⚠️ Do NOT run the above automatically** — confirm each step yourself.

---

## Path Fixes Applied

All absolute paths in `data_manifest.json` have been converted to **project-relative paths** (e.g. `data/raw/snapshots/...` instead of `/home/mo-seif/...`). This ensures the manifest works correctly inside Docker containers and on teammates' machines regardless of their local directory structure.

The following Python files were updated to store and resolve relative paths:
- `scripts/cleaning/version_manager.py`
- `scripts/cleaning/data_pipeline.py`
- `scripts/cleaning/combine_versions.py`
- `scripts/cleaning/register_processed_version.py`

The wrong version `snapshot_one` was removed from the manifest, and `2026-05-25_001` scraping_num was corrected from `1` to `2` to match its actual raw data.
