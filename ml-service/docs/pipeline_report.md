# Data Pipeline — Full Audit Report

> Last updated: 2026-06-03  
> Covers scraping rounds 1 (2026-05-24) and 2 (2026-05-25).  
> Added: Training data versioning, run summaries, and `make combine TAG=...` support.

---

## 1. Architecture Overview

```
Supabase (used_cars table)
    │
    ▼  data_loader.py  [scripts/data/]
data/raw/cars_raw_vNNN.csv          ← parquet + CSV snapshot
    │
    ▼  data_pipeline.py  [scripts/cleaning/]
data/raw/snapshots/  YYYY-MM-DD_NNN.csv   ← immutable archive
    │
    ▼  clean_raw_data_pipeline.py
data/cleaned/  cars_cleaned_YYYY-MM-DD_NNN.csv
    │
    ▼  generate_processed_data.py
data/processed/versions/  processed_YYYY-MM-DD_NNN.csv
    │
    ▼  combine_versions.py
    │
    ├── data/processed/training_versions/  training_YYYY-MM-DD_NNN.csv  ← immutable training dataset
    │
    ├── data/processed/training_data.csv   ← alias to latest training version (backward compat)
    │
    ├── data/training_manifest.json        ← training version metadata
    │
    └── data/logs/runs/combine_*.json      ← structured run summaries
    │
    ▼  data_manifest.json                  ← single source of truth (raw/cleaned/processed)
```

**Fixed-path aliases** (`cars_with_make_model.csv`, `processed_data.csv`, `training_data.csv`) are
always kept in sync with the latest registered version — backward compat for
notebooks and the API.

**Training data is now versioned** (2026-06-03). Every `combine` run creates an immutable
training dataset in `training_versions/` and tracks it in `training_manifest.json`.
The alias `training_data.csv` always points to the latest version.

---

## 2. Version Naming Convention

| Format | Example | When |
|--------|---------|------|
| `YYYY-MM-DD_NNN` | `2026-05-25_001` | Standard auto-generated tag |
| `YYYY-MM-DD_002` | `2026-05-25_002` | Second pull on same calendar day |

The `NNN` counter is auto-incremented by `version_manager.next_tag()`.  
The manifest also stores `scraping_num` (integer) so you can always trace
which Supabase round a version came from.

---

## 3. Data Versions Registered

| Tag | Date | Scraping Round | Raw Rows | Cleaned | Processed |
|-----|------|---------------|----------|---------|-----------|
| 2026-05-24 | 2026-05-24 | 1 | 22,969 | 22,969 | 20,214 |
| 2026-05-25_001 | 2026-05-25 | 2 | 17,903 | 15,956 | 12,748 |
| 2026-05-25_002 | 2026-05-25 | 2 | 17,903 | 15,948 | 12,810 |

> Note: `2026-05-25` (old date-only tag) was removed from the manifest and
> superseded by `_001`. `_002` is the latest canonical version. Both `_001` and
> `_002` contain **round 2** data (scraping_num = 2). `snapshot_one` was
> deleted — it incorrectly claimed scraping_num = 1 while its raw data was
> actually round 2. The true round 1 file is the unversioned
> `data/raw/cars_raw.csv` (26,896 rows) produced before the pipeline existed.

---

## 3b. Training Data Versions

Each `combine_versions.py` run produces an immutable training dataset and a structured run summary.

### Training Manifest (`data/training_manifest.json`)

```json
{
  "current_training_version": "2026-06-03_001",
  "versions": {
    "2026-06-03_001": {
      "tag": "2026-06-03_001",
      "created_at": "2026-06-03T00:20:22",
      "path": "data/processed/training_versions/training_2026-06-03_001.csv",
      "rows": 29656,
      "fingerprint": "sha256:820a2fa8d39c563a462a36572eaf66cff7a25acf97aea0e7fe2db62a41a6562e",
      "source_processed_tags": ["2026-05-25_002", "2026-05-28_001"],
      "excluded_tags": [],
      "pre_dedup_rows": 32261,
      "post_dedup_rows": 30186,
      "duplicates_removed": 2075,
      "post_rare_filter_rows": 29656,
      "rare_dropped": 530,
      "make_model_combos": 431
    }
  }
}
```

**Fields tracked per training version:**
- `tag` / `created_at` — version identity and timestamp
- `path` — relative path to the immutable CSV
- `rows` / `fingerprint` — integrity verification
- `source_processed_tags` — which processed versions were merged
- `excluded_tags` — versions intentionally skipped (e.g. `snapshot_one`)
- `pre_dedup_rows` / `post_dedup_rows` / `duplicates_removed` — deduplication stats
- `post_rare_filter_rows` / `rare_dropped` / `make_model_combos` — rare-filter stats

### Run Summaries (`data/logs/runs/combine_YYYYMMDD_HHMMSS.json`)

Every `combine` run writes a machine-readable summary for auditing and programmatic analysis:

```json
{
  "run_id": "20260603_002020",
  "kind": "combine_versions",
  "status": "applied",
  "created_at": "2026-06-03T00:20:22",
  "log_path": "data/logs/combine_20260603_002020.log",
  "training_tag": "2026-06-03_001",
  "source_processed_tags": ["2026-05-25_002", "2026-05-28_001"],
  "excluded_tags": [],
  "pre_dedup": 32261,
  "post_dedup": 30186,
  "duplicates_removed": 2075,
  "post_rare_filter": 29656,
  "rare_dropped": 530,
  "make_model_combos": 431,
  "output_cols": ["make", "model", "year", ...],
  "versioned_output_path": "data/processed/training_versions/training_2026-06-03_001.csv",
  "latest_alias_path": "data/processed/training_data.csv",
  "training_manifest_path": "data/training_manifest.json"
}
```

### Why version training data?

| Concern | Before | After |
|---------|--------|-------|
| Overwrite risk | `training_data.csv` overwritten every combine | Immutable versions + alias |
| Reproducibility | No record of what was trained on | Manifest + fingerprint |
| Rollback | Manual file copy | Point alias to any past version |
| Audit | Text logs only | Structured JSON per run |

### CLI usage

```bash
# Auto-tag (YYYY-MM-DD_NNN)
python scripts/cleaning/combine_versions.py --apply

# Explicit tag
python scripts/cleaning/combine_versions.py --apply --tag 2026-06-03_001

# Exclude historical versions
python scripts/cleaning/combine_versions.py --apply --exclude snapshot_one

# Via Makefile
make combine
make combine TAG=2026-06-03_001
make combine EXCLUDE=snapshot_one
```

---

## 3c. Pipeline Run Summaries

Both `data_pipeline.py` and `combine_versions.py` write structured JSON run summaries to `data/logs/runs/` on every execution — success, failure, dry-run, or skipped.

### Pipeline Run Summary (`data/logs/runs/pipeline_YYYYMMDD_HHMMSS.json`)

```json
{
  "run_id": "20260603_003305",
  "kind": "data_pipeline",
  "status": "skipped",
  "created_at": "2026-06-03T00:33:05",
  "log_path": "data/logs/pipeline_20260603_003305.log",
  "tag": "2026-06-03_001",
  "raw_path": "data/raw/snapshots/cars_raw_2026-05-28_001.csv",
  "scraping_num": null,
  "skip_clean": false,
  "skip_process": false,
  "force": false,
  "fingerprint_unchanged": true,
  "stages": {},
  "error": null,
  "last_version_tag": "2026-05-28_001",
  "exit_code": 0
}
```

**Status values:** `success` | `failed` | `dry_run` | `skipped`

**Tracked per run:**
- `run_id`, `kind`, `status`, `created_at` — run identity
- `log_path` — path to the companion text log
- `tag`, `raw_path`, `scraping_num` — pipeline inputs
- `skip_clean`, `skip_process`, `force` — flags used
- `fingerprint_unchanged` — whether the raw data was already processed
- `stages` — per-stage results:
  - `raw_snapshot`: path, rows, skipped_copy
  - `clean`: exit_code, skipped, rows
  - `process`: exit_code, skipped, rows
- `error` — error message on failure
- `manifest_registered`, `fixed_paths_updated` — completion flags
- `row_counts` — {raw, cleaned, processed}
- `exit_code` — shell exit code

### Why structured summaries?

| Use case | Before | After |
|---|---|---|
| Audit every run | Text logs only | JSON + text for every exit path |
| Detect failures programmatically | Parse text | Read `status` == `"failed"` |
| Track row counts over time | Manual | `row_counts` in every summary |
| Monitor pipeline health | Ad-hoc | Query `data/logs/runs/*.json` |

---

## 4. Pipeline Stages & What Each Does

### Stage 1–4: `clean_raw_data_pipeline.py`

| Stage | Action |
|-------|--------|
| 1 | Make/model canonicalization via `canonical_rules.yaml` |
| 2 | EV/Hybrid fuel+transmission auto-fix (BEV → Electric, CVT, etc.) |
| 3 | Impossible model-year rows removed (future years, year < 1975) |
| 4 | Deduplication on (make, model, year, mileage_km, price_egp, location) |

### Stage 5–13: `generate_processed_data.py`

| Step | Action | Rows dropped (R2) |
|------|--------|-------------------|
| 2a | Drop null year/price | 181 |
| 2b | Year bounds 1975–CURRENT_YEAR | 31 |
| 2b | Price bounds 20K–20M EGP | 54 |
| 2c | Null mileage | 4 |
| 2c | Mileage > 500,000 km | 149 |
| 2c | Impossible new-car mileage | 1,101 |
| 2d | Fuel imputation (primary+fallback) | 2 unresolved |
| 2d | Transmission imputation | 0 unresolved |
| 7 | Spec lookup merge (exact) | — |
| 8 | Spec lookup nearest-year fallback | 627 recovered |
| 9 | Drop no-spec-match rows | 3,616 |
| 10 | Rare make+model filter (< 5 rows) | 278 |
| — | **Final** | **10,664** |

---

## 5. Bugs Found and Fixed

### 5.1 `parse_title.py` — Chery Tiggo in MULTI_WORD_MAKES *(critical)*

**Bug:** `"Chery Tiggo"` was listed as a multi-word make. Titles like
`"Chery Tiggo 4 Pro 2022"` were parsed as make=`"Chery Tiggo"`, model=`"4 Pro"`.
This caused 267 rows to have an unknown make, dropping them at the spec-merge step.

**Fix:** Removed `"Chery Tiggo"` from `MULTI_WORD_MAKES`. Now correctly parsed
as make=`"Chery"`, model=`"Tiggo 4 Pro"`.

---

### 5.2 `parse_title.py` — Range Rover / Ssang Yong not handled *(significant)*

**Bug:** Titles like `"Range Rover Sport 2019"` were parsed as make=`"Range"`.
`"Ssang Yong Tivoli 2020"` was parsed as make=`"Ssang"`.

**Fix:**
- Added `MULTI_WORD_MAKE_REMAPS = {"range rover": "Land Rover"}` — remaps to
  correct parent brand; model includes the sub-brand prefix (e.g. `"Range Rover Sport"`).
- Added `"Ssang Yong"` to `MULTI_WORD_MAKES` and `ssangyong/ssang yong → SsangYong`
  alias in `canonical_rules.yaml`.

---

### 5.3 `canonical_rules.yaml` — Missing ALL-CAPS aliases *(cross-round inconsistency)*

**Bug:** Round 1 data had makes like `GMC`, `DS`, `FAW`, `JMC`, `KYC`, `DFSK`,
`XPeng` (from original scraper). Round 2 parsed these as `Gmc`, `Ds`, `Faw`, etc.
Combining the two rounds would create duplicate make names with different casing.

**Fix:** Added aliases for all affected makes:
`gmc→GMC`, `ds→DS`, `faw→FAW`, `jmc→JMC`, `kyc→KYC`, `dfsk→DFSK`,
`xpeng→XPeng`, `lynkco→Lynk & Co`, `citroen→Citroën`.

---

### 5.4 `generate_processed_data.py` — Hardcoded mileage year cutoffs *(future regression)*

**Bug:** New-car mileage filters were hardcoded to specific calendar years:
```python
raw = raw[~((raw["year"] == 2026) & (raw["mileage_km"] > 30_000))]
raw = raw[~((raw["year"] == 2025) & (raw["mileage_km"] > 70_000))]
```
In 2027 the filters for `year=2027` would be missing.

**Fix:** Replaced with CURRENT_YEAR-relative age logic:
```python
_NEW_CAR_MAX_KM = {0: 30_000, 1: 70_000, 2: 120_000}
raw["_age_filter"] = CURRENT_YEAR - raw["year"].astype(int)
for _age, _max_km in _NEW_CAR_MAX_KM.items():
    raw = raw[~((raw["_age_filter"] == _age) & (raw["mileage_km"] > _max_km))]
```

---

### 5.5 `generate_processed_data.py` — `_nearest_year_merge` dropped spec columns *(critical)*

**Bug:** The function returned a DataFrame built with `columns=unmatched.columns`,
which did not include the newly assigned spec columns, silently discarding them.

**Fix:** Added `spec_cols` to the column list used when constructing the output:
```python
all_cols = list(unmatched.columns) + [c for c in spec_cols if c not in unmatched.columns]
return pd.DataFrame(result_rows, columns=all_cols)
```

---

### 5.6 `data_pipeline.py` — `--skip-clean` overwrote cleaned file *(data loss risk)*

**Bug:** Even with `--skip-clean`, the pipeline always copied raw → cleaned,
destroying any previously cleaned data at that path.

**Fix:** Added guard: skip the copy if `skip_clean=True` and the cleaned file
already exists.

---

### 5.7 `data_loader.py` — `.any()` check for partial make/model *(subtle bug)*

**Bug:** `(df["make"] != "").any()` returns `True` if even a single row has a
non-empty make. If Supabase partially returns make/model (e.g. 10% populated),
the partial data would be used as-is, leaving 90% of rows without make/model.

**Fix:** Replaced with a 50% population threshold:
```python
valid = df[col].notna() & (df[col].astype(str).str.strip() != "")
return valid.mean() >= 0.5
```

---

### 5.8 `version_manager.py` — Same-day pulls overwrite version *(data loss risk)*

**Bug:** Tags were date-only (`2026-05-25`). Two pulls on the same day used the
same tag, overwriting the manifest entry.

**Fix:** Changed `next_tag()` to `YYYY-MM-DD_NNN` format — counter starts at
`001` and auto-increments for each same-day pull.

---

### 5.9 `generate_processed_data.py` — `scraping_date` index misalignment *(data corruption)*

**Bug:** After step 8 (column selection) and step 9 (rare filter), `result.index`
was reset to `[0, 1, 2, ...]`. But the code then did
`merged.loc[result.index, "scraping_date"]`, which looked up the **first N rows
of merged** (different rows than those in `result`). This silently assigned the
wrong scraping dates to processed output.

**Fix:** Include `scraping_date` in the initial column selection alongside feature
columns, so it stays row-aligned through all subsequent filters.

---

### 5.10 Makefile — `SCRAPING_NUM` defaulted to 1 *(silent mistagging)*

**Bug:** `SCRAPING_NUM ?= 1` meant `make pipeline APPLY=1` always passed
`--scraping-num 1`, incorrectly tagging every version as scraping round 1 even
when no scraping number was intended.

**Fix:** Changed default to empty. `SCRAPING_NUM` is now required for `make pull`
and optional for `make pipeline`.

---

### 5.11 Missing notebook filters in pipeline *(data quality gap)*

**Notebook steps not yet in pipeline (fixed):**
- Mileage: null drop, >500K drop, old-car <5K mileage, new-car impossible mileage
- Fuel+transmission imputation (mode hierarchy)
- Rare make+model filter (groups < 5 rows)

**Fix:** All three added to `generate_processed_data.py` steps 2c, 2d, and 9.

---

### 5.12 `data_loader.py` — `_resolve_snapshot_path` ignored `scraping_num` *(naming mismatch)*

**Old logic:**
```python
def _resolve_snapshot_path(base_path, df):
    fingerprint = _dataframe_fingerprint(df)
    # Check existing files for identical fingerprint → reuse
    for version, candidate in existing_paths:
        if _dataframe_fingerprint(pd.read_parquet(candidate)) == fingerprint:
            return candidate   # Reuse old file
    # Otherwise auto-increment version number
    next_version = max(existing_versions) + 1
    return _versioned_path(base_path, next_version)
```

Problems:
1. `scraping_num` was received from Supabase but **never used** to determine the filename.
2. The first pull of round 2 data created `cars_raw_v001.csv` because no previous snapshot existed.
3. This created a **permanent mismatch**: `v001` contained `scraping_num = 2`, and `v002` was a later duplicate.

**New logic:**
```python
def _resolve_snapshot_path(base_path, df, scraping_num=None):
    if scraping_num is not None:
        # Direct mapping: scraping_num → cars_raw_v{NNN:03d}
        path = _versioned_path(base_path, scraping_num)
        log.info("Using scraping-num-based path: %s", path)
        return path
    # Fallback to old auto-increment for unversioned pulls
    ...
```

Fixes applied:
1. `_resolve_snapshot_path` now receives `scraping_num` and maps it directly to the version suffix.
2. `load_raw` passes `scraping_num` through and **always overwrites** the target file for versioned pulls (idempotent).
3. Misnamed duplicate `cars_raw_v001.csv` / `.parquet` (containing round 2 data) were **deleted**.
4. Only `cars_raw_v002.csv` / `.parquet` remain, correctly representing scraping round 2.

**Impact:** Container/teammate reproducibility — pulling round 2 on any machine always writes the same filename.

---

## 6. Consistency Check: Round 1 vs Round 2 (post-alias-expansion)

Run `make consistency-check` or `python scripts/cleaning/check_version_consistency.py`
at any time to verify new versions against existing ones.

| Check | Result |
|-------|---------|
| Column names | ✓ Identical (18 feature cols + 3 metadata) |
| Dtypes | ✓ Identical |
| Make casing | ✓ 0 mismatches |
| Cross-round overlaps | 12,746 / 12,810 = **99.5% identical** |
| Net new rows from R2 | +64 |
| **Combinable** | **YES** |

**Insight:** R1 and R2 scraped the same active listings at nearly the same time.
Combining adds almost no unique rows (+64). Use `make combine` to produce the
deduped training dataset.

---

## 6a. Deduplication & Rare-Filter Decision

### Should you drop duplicates after combining?
**Yes, always.** The 5-key hash `(make, model, year, mileage_km, price_egp)`
identifies the same physical listing. Keeping duplicates would:
- Inflate training set size artificially
- Create data leakage if the same listing falls in both train and test splits
- Bias the model toward cars that happened to be listed during multiple rounds

```python
DEDUP_KEY = ["make", "model", "year", "mileage_km", "price_egp"]
combined = pd.concat([r1, r2]).drop_duplicates(subset=DEDUP_KEY).reset_index(drop=True)
```

### Where to apply the rare make+model filter?
**Apply AFTER combining, not per-version.** Rationale:
- A make+model with 3 rows in R1 and 3 unique rows in R2 → 6 rows after dedup → valid
- Applying per-version first drops both groups independently, losing them from the combined set
- Per-version files use `threshold=5` for per-round analysis (fine)
- The combined training file uses `threshold=10` for better model quality

### Threshold: keep 5 or raise to 10?

Measured on the actual data:

| Dataset | t=5 | t=10 | t=15 |
|---------|-----|------|------|
| R2 alone (12,810) | 0 dropped, 430 combos | 935 dropped (7.3%), 292 combos | 1,861 dropped (14.5%), 214 combos |
| R1+R2 combined (12,812) | 0 dropped, 430 combos | 935 dropped (7.3%), 292 combos | 1,861 dropped (14.5%) |

**Decision:**
- `generate_processed_data.py` keeps `t=5` — appropriate for per-version analysis files
- `combine_versions.py` applies `t=10` on the combined dataset before saving `training_data.csv`
- `t=15` drops too much (14.5%) and is not recommended

**Why t=10 for training?**
- XGBoost needs at least 10 samples per group to learn a stable split
- Groups with 5–9 samples produce high-variance predictions for rare cars
- 7.3% data loss (935 rows) is an acceptable trade-off for model quality
- The `make_model_count` feature (Plan 2) will let the model self-calibrate for rarer cars

---

## 6b. Historical Snapshot Compatibility Test

The original pre-pipeline processed data (`processed_data copy.csv`, 20,461 rows)
was registered as version `snapshot_one` (scraping_num=1) and tested for
compatibility with the new R1/R2 versions.

### Consistency Check Results

| Pair | Overlap | Combinable? |
|------|---------|-------------|
| R1 vs R2 | 12,746 / 12,810 (99.5%) | ✓ YES |
| R1 vs snapshot_one | 2,204 / 20,461 (10.8%) | ✓ YES |
| R2 vs snapshot_one | 2,208 / 20,461 (10.8%) | ✓ YES |

### Combine Test (all 3 versions)

| Stage | Rows | Notes |
|-------|------|-------|
| Pre-dedup (R1+R2+snapshot) | 46,019 | |
| Post-dedup | 31,017 | Dropped 15,002 duplicates (32.6%) |
| Post-rare-filter (t=10) | 30,318 | 446 make+model combos |

### Verdict

**Combinable, but NOT recommended for training.**

`snapshot_one` and R1 share the same raw source (`cars_raw_v001.csv`) but the
old data has **~18,000 extra rows** that the new pipeline intentionally dropped:

- Missing critical specs (no lookup match)
- Mileage outliers (>500K km or implausible for year)
- Rare make+model groups (< 5 rows)
- No nearest-year fallback, no fuel/transmission imputation

Including `snapshot_one` in training would **re-introduce low-quality data**
that the pipeline fixes were designed to remove.

**Recommended usage:** Keep `snapshot_one` in the manifest as a historical
reference only. Exclude it from combine:

```bash
# Exclude historical versions
python scripts/cleaning/combine_versions.py --apply --exclude snapshot_one

# Or via Makefile
make combine EXCLUDE=snapshot_one
```

**Combined training recipe** (use `make combine` instead):
```python
import pandas as pd

DEDUP_KEY  = ["make", "model", "year", "mileage_km", "price_egp"]
META_COLS  = ["scraping_date", "version_tag", "scraping_num"]
RARE_THRESHOLD = 10

combined = (
    pd.concat([df_r1, df_r2], ignore_index=True)
    .drop_duplicates(subset=DEDUP_KEY)
    .reset_index(drop=True)
)
counts = combined.groupby(["make", "model"])["make"].transform("count")
training = combined[counts >= RARE_THRESHOLD].reset_index(drop=True)
# Drop metadata before training
X = training.drop(columns=[c for c in META_COLS if c in training.columns])
```

---

## 7. `scraped_at` Date — Recommendation

**Options considered:**

| Option | Pros | Cons |
|--------|------|------|
| Keep raw timestamp | Full precision | Storage overhead; time component useless for training |
| Date only (`YYYY-MM-DD`) | Compact; enables temporal analysis | ✓ **Chosen** |
| Month+year only | Very compact | Loses intra-month ordering |
| Drop entirely | Minimal schema | Loses provenance and temporal split capability |

**Decision: Keep as `scraping_date` (date string, `YYYY-MM-DD`), stored as a
metadata column in processed output.** It is NOT a model feature — drop it
before training. Use it for:
- Time-based train/test splits
- Detecting listing-date seasonality
- Data drift monitoring between rounds

---

## 8. Spec-Match Drop Analysis (post-alias-expansion)

**Before alias expansion:** 30.6% of cleaned rows dropped (3,616 rows unmatched).
**After 250+ model aliases added:** 8.2% dropped (1,311 rows unmatched) — **64% reduction**.

| Stage | Count | Notes |
|-------|-------|-------|
| Exact merge matched | ~13,600 | Direct hit |
| Nearest-year fallback recovered | 774 | Same make+model, different year |
| Still unmatched after fallback | **1,311** | Genuine lookup gaps or junk titles |
| Nearest-year total filled | 774 | Spec accuracy: ±1–3 years, safe for tree models |

**Remaining gap breakdown (top):** 20 rows "Other/Other" (junk), 16 "Mercedes/Other" (junk),
15 "Renault/Model Y" (wrong-make parse, now fixed), 15 "SsangYong/Tivoli Xlv" (now fixed),
9 "Toyota/Hilux" (genuinely missing from lookup). Long tail of 786 unique pairs averaging
< 2 rows each — diminishing returns to pursue further.

**Is nearest-year fallback safe for the model?**
Yes. Specs like `engine_cc`, `horsepower`, `body_type`, `drivetrain`, `seating_capacity`
change rarely year-to-year for the same model. A 2018 spec used for a 2019 listing
is accurate enough for tree-based regression. The `year` column itself is exact;
only the spec columns are approximated.

---

## 9. Workflow (per scraping round)

```bash
# Step 1: Pull from Supabase (writes data/raw/cars_raw_v{NNN}.csv)
make pull SCRAPING_NUM=3

# Step 2: Run full pipeline
make pipeline RAW=data/raw/cars_raw_v003.csv APPLY=1 SCRAPING_NUM=3

# Step 3: Verify version
make version-current

# Step 4: Check consistency against all previous versions
make consistency-check

# Step 5: Combine all versions → versioned training_data.csv (dedup + t=10 rare filter)
make combine
# Optional: label the training version explicitly
make combine TAG=2026-06-03_001
# Optional: exclude historical versions
make combine EXCLUDE=snapshot_one

# Step 6: Review the latest run summary
# data/logs/runs/combine_YYYYMMDD_HHMMSS.json
```

**`cars_raw_v{scraping_num:03d}` naming guarantee:**
- Pulling `SCRAPING_NUM=2` always produces `data/raw/cars_raw_v002.csv`.
- Pulling `SCRAPING_NUM=3` always produces `data/raw/cars_raw_v003.csv`.
- No auto-increment confusion: the version suffix equals the Supabase scraping round.

Logs are written to `data/logs/pipeline_YYYYMMDD_HHMMSS.log` automatically.

---

## 10. Recommended Next Steps

| Priority | Action |
|----------|--------|
| ✅ Done | Expand lookup (aliases): spec-drop reduced 64%, 12,812 training rows |
| ✅ Done | Re-process R1 + R2 with full pipeline (mileage, imputation, metadata) |
| ✅ Done | `combine_versions.py` — dedup + t=10 rare filter → `training_data.csv` |
| ✅ Done | **Training data versioning** — immutable versions in `training_versions/`, manifest in `training_manifest.json`, alias `training_data.csv`, structured run summaries in `data/logs/runs/` |
| 🔴 **Next** | **Plan 2 — Feature Engineering V2** (log_mileage, mileage_ratio, year_bucket, days_since_baseline, mm_price_tier, make_model_count) |
| 🟡 Medium | Train Model V2 on `training_data.csv` with new features (Plan 3) |
| 🟡 Medium | CQR calibration on V2 predictions (Plan 4) |
| 🟢 Low | Add more lookup entries for Toyota Hilux, BYD Leopard 7, Proton Saga, etc. (very low row count — defer until new scraping round) |
