# 07 — Data Quality Fixes (Lookup + Raw Listings)

**Date:** 2026-04-13

This document summarizes the data-quality issues discovered in this workspace and the exact fixes applied to:

- Lookup tables (spec enrichment)
- Raw marketplace listings (seller/scraper “data ghosts”)

The goal is to keep your Egypt used-cars price model from learning wrong relationships (e.g., unrealistic performance specs, wrong body type class, impossible model-year combinations).

---

## 1) Files in Scope

### 1.1 Lookup tables

- Car specs lookup (enrichment features):
  - [ml-service/data/lookups/car_specs_lookup_full_cleaned.csv](../data/lookups/car_specs_lookup_full_cleaned.csv)
- Main info lookup (basic listing metadata per make/model/year):
  - [ml-service/data/lookups/car_main_info.csv](../data/lookups/car_main_info.csv)

Note: we intentionally consolidated the lookup folder so only the production-ready CSVs remain (no duplicate `*.cleaned.csv` artifacts and no stale JSON).

### 1.2 Raw marketplace dataset

- Cleaned in place:
  - [ml-service/data/raw/cars_with_make_model.csv](../data/raw/cars_with_make_model.csv)
  - [ml-service/data/raw/cars_with_make_model.parquet](../data/raw/cars_with_make_model.parquet)

### 1.3 Data cleaning notebook

- Notebook pipeline:
  - [ml-service/notebooks/02_data_cleaning.ipynb](../notebooks/02_data_cleaning.ipynb)

---

## 2) Issues Found

### 2.1 Egypt-spec vs global-spec mismatch (lookup table)

Some rows were clearly generated from global specs or synthetic data, not what is common in Egypt (customs/taxes, dealer trims, fuel-quality constraints).

This affects ML heavily because `engine_cc`, `horsepower`, `drivetrain`, and `body_type` can directly influence the learned price function.

### 2.2 Systemic EV/EREV edge-case

A subset of electrified models had `engine_cc = 0`.

- For **pure EVs**, `engine_cc = 0` is expected.
- For **range-extended EVs (EREV/REEV)**, `engine_cc = 0` can be wrong because the car has a gasoline generator (even if the drivetrain is electric).

If not handled explicitly, `engine_cc = 0` can become a misleading “cheap/small engine” signal.

### 2.3 “Data ghosts” from seller input / scraping (raw + lookups)

We found impossible combinations that cannot exist in reality:

- **Audi Q4 E-Tron** before 2021 (e.g., 2013, 1995)
- **Tesla Model Y** before 2020 (e.g., 2017, 2018, 2019)

These “ghost” rows appear in:

- raw listings: [ml-service/data/raw/cars_with_make_model.csv](../data/raw/cars_with_make_model.csv)
- lookup tables: [ml-service/data/lookups/car_specs_lookup_full_cleaned.csv](../data/lookups/car_specs_lookup_full_cleaned.csv), [ml-service/data/lookups/car_main_info.csv](../data/lookups/car_main_info.csv)

This is a source-data reliability issue, not a lookup-fixer bug.

### 2.4 EV fuel/transmission noise (fixed via explicit rules)

In the lookup `car_main_info.csv`, some pure-EV models appeared with `fuel=petrol` (and/or non-automatic transmissions) in certain years (e.g., Tesla Model Y). This is a sign that `fuel`/`transmission` can inherit source noise.

We fixed this using an explicit allowlist of confirmed pure-EV models (see section 3.4).

---

## 3) Fixes Implemented

### 3.1 Targeted car-spec corrections (lookup)

Tooling:

- Script: [ml-service/src/fix_car_specs_lookup_full.py](../src/fix_car_specs_lookup_full.py)
- Strategy: deterministic correction map (“rules”) applied to specific (make, model, year-range) combinations.
- Safety: rules are intentionally tight; some only apply if the existing values match a known-bad pattern.
- Backup behavior: in-place edits create timestamped `.bak` backups.

**Current production file summary:**

- Rows in lookup (after ghost-year drops): `4190`

**Corrections applied (high level):**

- Deepal S 07 (2025–2026): for REEV entries with `engine_cc=0`, set `engine_cc=1500`.
- Subaru Impreza (Egypt spec):
  - 2009 set to `1498 cc / 107 hp`
  - 2005–2011 corrected **only** when the row still had `2000 cc / 154 hp`.
- Jetour X90 Plus (2024–2026): set to `1598 cc / 197 hp / FWD`.
- Chana Benni (2008–2009): set to `1301 cc / 86 hp`.
- Skoda Octavia + Octavia A8 (2024–2026): set to `1395 cc / 150 hp`.
- Mercedes mild-hybrid adjustments:
  - C200 (2020): `184 → 197 hp`
  - E300 (2020–2021): `258 → 272 hp` (only when hp was 258)
  - GLE450 (2022): fixed an obviously wrong row (`1600/156` and `Sedan`) to `2999/362`, `SUV`, `4WD`, `luxury_suv`.
- Market share calibration:
  - GAC (2024+ rows): set `brand_market_share=0.0040`
  - Zeekr (2023+ rows): set `brand_market_share=0.0035` when it was `<= 0.0010`
- Body type fixes:
  - Toyota Corolla Cross (2020+): force `body_type=Crossover`, `car_segment=crossover`
  - Toyota Urban Cruiser: force `body_type=Crossover`, `car_segment=crossover`

During development, in-place runs created timestamped `.bak` files. These were later deleted when consolidating the lookup folder to “latest-only”.

### 3.2 Remove impossible model-year rows (“data ghosts”)

Tooling:

- Script: [ml-service/src/clean_impossible_model_years.py](../src/clean_impossible_model_years.py)
- Rules implemented (minimal authoritative set):
  - Audi Q4 E-Tron: `min_year = 2021`
  - Tesla Model Y: `min_year = 2020`
  - BMW IX1: `min_year = 2022`
  - BYD Destroyer 05: `min_year = 2022`
  - MG Cyberster: `min_year = 2023`
  - Chery Tiggo 8 Pro Max: `min_year = 2024`
  - Kia Xceed: `min_year = 2020`

Supported actions:

- `drop` (default): remove invalid rows
- `flag`: keep rows but add columns `is_impossible_year` and `min_valid_year`
- `clamp`: set `year` to `min_year` (not recommended unless you deliberately want that behavior)

**Counts observed:**

- Raw dataset `cars_with_make_model.csv`: dropped `25` rows
  - Tesla Model Y: `18`
  - Audi Q4 E-Tron: `7`

After expanding the rule set (2026-04-13), additional ghost rows were removed:

- Raw dataset `cars_with_make_model.csv`: dropped `68` rows
  - Chery Tiggo 8 Pro Max: `28`
  - MG Cyberster: `21`
  - BYD Destroyer 05: `15`
  - BMW IX1: `3`
  - Kia Xceed: `1`

- Lookup `car_specs_lookup_full_cleaned.csv`: dropped `31` rows
  - Audi Q4 E-Tron: `6`
  - Tesla Model Y: `6`
  - Chery Tiggo 8 Pro Max: `6`
  - BYD Destroyer 05: `5`
  - MG Cyberster: `4`
  - BMW IX1: `3`
  - Kia Xceed: `1`

- Lookup `car_main_info.csv`: dropped `27` rows
  - BYD Destroyer 05: `11`
  - Chery Tiggo 8 Pro Max: `8`
  - MG Cyberster: `4`
  - BMW IX1: `3`
  - Kia Xceed: `1`

**Raw dataset in-place backup created:**

- [ml-service/data/raw/cars_with_make_model.csv.20260413_110741.bak](../data/raw/cars_with_make_model.csv.20260413_110741.bak)

**Parquet regeneration:**

To keep formats consistent, we regenerated:

- [ml-service/data/raw/cars_with_make_model.parquet](../data/raw/cars_with_make_model.parquet)

Non-destructive cleaned outputs may exist in `data/raw/` (e.g., `cars_with_make_model.csv.cleaned.csv`). Lookup-folder artifacts were intentionally removed during consolidation.

---

## 3.3 Segment corrections (spec lookup)

Confirmed segment mismatches were corrected in-place via [ml-service/src/fix_car_specs_lookup_full.py](../src/fix_car_specs_lookup_full.py):

- DS DS7: `executive` → `luxury_suv`
- Cupra Formentor: `sport` → `crossover`
- Alfa Romeo Tonale: `executive` → `crossover`
- Volkswagen Beetle: `city` → `sport`

Note: any intermediate `.bak` files created during development were removed during lookup-folder consolidation.

---

## 3.4 EV fuel/transmission normalization (main info lookup)

Some known pure-EV models appeared with `fuel=petrol` (and/or non-automatic transmissions) in [ml-service/data/lookups/car_main_info.csv](../data/lookups/car_main_info.csv).

Tooling:

- Script: [ml-service/src/fix_car_main_info_ev_fuel.py](../src/fix_car_main_info_ev_fuel.py)
- Rule: for confirmed pure-EV models, enforce `fuel='electric'` and `transmission='Automatic'`.

Observed changes (2026-04-13):

- `32` rows updated in `car_main_info.csv`

Note: any intermediate `.bak` files created during development were removed during lookup-folder consolidation.

---

## 4) Lookup Data Notes (Schema + Intended Use)

### 4.1 `car_specs_lookup_full_cleaned.csv`

Header:

- `make, model, year, engine_cc, horsepower, body_type, drivetrain, seating_capacity, brand_origin, car_segment, brand_market_share`

Intended use: model enrichment features for price prediction.

### 4.2 `car_main_info.csv`

Header:

- `make, model, year, transmission, fuel`

Intended use: coarse normalization by year and basic drivetrain/energy type.

### 4.3 Notebook-based preprocessing flow

The main cleaning notebook performs the following steps before feature engineering and merge:

- load `raw` listings and the lookup table through `settings.load_data(...)`
- standardize key string columns (`make`, `model`, `transmission`, `fuel`, `location`, `title`)
- drop duplicates using all columns except `id` and `location`
- recover `year` from `title`, then fill remaining nulls with the modal year per `(make, model)`, then drop unresolved rows
- apply hard filters for year, price, and mileage
- remove unusually old listings with implausibly low mileage
- fix only ultra-rare categorical inconsistencies using a very strict group-based rule
- impute `fuel` and `transmission` via hierarchical mode rules
- normalize `location` into the final Egyptian market categories
- remove rare make+model pairs with fewer than 5 rows
- engineer `price_egp_log`, `car_age`, and `mileage_per_year`
- merge the cleaned listings with the lookup on `(make, model, year)`
- drop `brand_market_share` from the lookup before the final merge output

### 4.4 Final notebook outputs

The notebook currently saves two production-facing outputs:

- cleaned listings: [ml-service/data/cleaned/cleaned_data.parquet](../data/cleaned/cleaned_data.parquet)
- feature-enriched dataset: [ml-service/data/processed/processed_data.csv](../data/processed/processed_data.csv)

These outputs are the ones that should feed downstream model training, not the intermediate cleaned lookup artifacts that were deleted during consolidation.

---

## 5) How to Reproduce

### 5.1 Re-run spec correction (in-place)

```bash
/home/mo-seif/Documents/GP/GPENV/bin/python ml-service/src/fix_car_specs_lookup_full.py --in-place
```

### 5.2 Re-run ghost-year cleanup (drop invalid rows)

Raw dataset (in-place):

```bash
/home/mo-seif/Documents/GP/GPENV/bin/python ml-service/src/clean_impossible_model_years.py \
  --input ml-service/data/raw/cars_with_make_model.csv \
  --in-place \
  --action drop
```

Lookups (recommended to run in-place on the production lookup):

```bash
/home/mo-seif/Documents/GP/GPENV/bin/python ml-service/src/clean_impossible_model_years.py \
  --input ml-service/data/lookups/car_specs_lookup_full_cleaned.csv \
  --in-place \
  --action drop

/home/mo-seif/Documents/GP/GPENV/bin/python ml-service/src/clean_impossible_model_years.py \
  --input ml-service/data/lookups/car_main_info.csv
```

### 5.3 Extending the ghost-year rules

You can add more (make, model, min_year) rules in one of two ways:

1) Edit `MIN_MODEL_YEAR` inside [ml-service/src/clean_impossible_model_years.py](../src/clean_impossible_model_years.py)

2) Provide an external JSON file:

```json
[
  {"make": "Porsche", "model": "Taycan", "min_year": 2019}
]
```

and run:

```bash
/home/mo-seif/Documents/GP/GPENV/bin/python ml-service/src/clean_impossible_model_years.py \
  --input ml-service/data/raw/cars_with_make_model.csv \
  --action drop \
  --extra-rules-json path/to/rules.json
```

---

## 6) Known Limits / Next Steps

- **Trim-level ambiguity:** some issues (e.g., Renault Duster 4WD variants) cannot be corrected without a trim/variant signal. A single (make, model, year) row cannot represent multiple drivetrains reliably.
- **Broader ghost-year audit:** the current cleaner only targets models you explicitly confirmed. If you want broader coverage, build a ruleset for the EV / newer-model universe (and/or detect outliers where a model appears decades before its median year).
- **Fuel/transmission cleanup:** implemented for an explicit allowlist of confirmed pure-EV models. Extend the allowlist only after validating additional models, because this category is easy to over-correct.
