# 07 — Data Quality Fixes (Lookup + Raw Listings)

**Date:** 2026-04-12

This document summarizes the data-quality issues discovered in this workspace and the exact fixes applied to:

- Lookup tables (spec enrichment)
- Raw marketplace listings (seller/scraper “data ghosts”)

The goal is to keep your Egypt used-cars price model from learning wrong relationships (e.g., unrealistic performance specs, wrong body type class, impossible model-year combinations).

---

## 1) Files in Scope

### 1.1 Lookup tables

- Car specs lookup (enrichment features):
  - [ml-service/data/lookups/car_specs_lookup_full.csv](../data/lookups/car_specs_lookup_full.csv)
- Main info lookup (basic listing metadata per make/model/year):
  - [ml-service/data/lookups/car_main_info.csv](../data/lookups/car_main_info.csv)

### 1.2 Raw marketplace dataset

- Cleaned in place:
  - [ml-service/data/raw/cars_with_make_model.csv](../data/raw/cars_with_make_model.csv)
  - [ml-service/data/raw/cars_with_make_model.parquet](../data/raw/cars_with_make_model.parquet)

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
- lookup tables: [ml-service/data/lookups/car_specs_lookup_full.csv](../data/lookups/car_specs_lookup_full.csv), [ml-service/data/lookups/car_main_info.csv](../data/lookups/car_main_info.csv)

This is a source-data reliability issue, not a lookup-fixer bug.

### 2.4 Additional inconsistency to watch (not auto-fixed)

In the lookup `car_main_info.csv`, some EV models appear with fuel like `petrol` in certain years (e.g., Tesla Model Y entries). This is a sign that `fuel`/`transmission` can also inherit source noise.

We did **not** mass-correct fuel/transmission yet because it needs explicit rules (and likely depends on trim/model year).

---

## 3) Fixes Implemented

### 3.1 Targeted car-spec corrections (lookup)

Tooling:

- Script: [ml-service/src/fix_car_specs_lookup_full.py](../src/fix_car_specs_lookup_full.py)
- Strategy: deterministic correction map (“rules”) applied to specific (make, model, year-range) combinations.
- Safety: rules are intentionally tight; some only apply if the existing values match a known-bad pattern.
- Backup behavior: in-place edits create timestamped `.bak` backups.

**Latest run summary (from the script output):**

- Rows in lookup: `4221`
- Rule applications: `37`

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

**Backups created (car specs lookup):**

- [ml-service/data/lookups/car_specs_lookup_full.csv.20260412_200231.bak](../data/lookups/car_specs_lookup_full.csv.20260412_200231.bak)
- [ml-service/data/lookups/car_specs_lookup_full.csv.20260412_200828.bak](../data/lookups/car_specs_lookup_full.csv.20260412_200828.bak)

### 3.2 Remove impossible model-year rows (“data ghosts”)

Tooling:

- Script: [ml-service/src/clean_impossible_model_years.py](../src/clean_impossible_model_years.py)
- Rules implemented (minimal authoritative set):
  - Audi Q4 E-Tron: `min_year = 2021`
  - Tesla Model Y: `min_year = 2020`

Supported actions:

- `drop` (default): remove invalid rows
- `flag`: keep rows but add columns `is_impossible_year` and `min_valid_year`
- `clamp`: set `year` to `min_year` (not recommended unless you deliberately want that behavior)

**Counts observed:**

- Raw dataset `cars_with_make_model.csv`: dropped `25` rows
  - Tesla Model Y: `18`
  - Audi Q4 E-Tron: `7`
- Lookup `car_specs_lookup_full.csv`: dropped `12` rows in cleaned-output file
- Lookup `car_main_info.csv`: dropped `13` rows in cleaned-output file

**Raw dataset in-place backup created:**

- [ml-service/data/raw/cars_with_make_model.csv.20260412_203832.bak](../data/raw/cars_with_make_model.csv.20260412_203832.bak)

**Parquet regeneration:**

To keep formats consistent, we regenerated:

- [ml-service/data/raw/cars_with_make_model.parquet](../data/raw/cars_with_make_model.parquet)

with a backup:

- [ml-service/data/raw/cars_with_make_model.parquet.20260412_204057.bak](../data/raw/cars_with_make_model.parquet.20260412_204057.bak)

**Non-destructive cleaned outputs also produced:**

- [ml-service/data/raw/cars_with_make_model.csv.cleaned.csv](../data/raw/cars_with_make_model.csv.cleaned.csv)
- [ml-service/data/lookups/car_specs_lookup_full.csv.cleaned.csv](../data/lookups/car_specs_lookup_full.csv.cleaned.csv)
- [ml-service/data/lookups/car_main_info.csv.cleaned.csv](../data/lookups/car_main_info.csv.cleaned.csv)

---

## 4) Lookup Data Notes (Schema + Intended Use)

### 4.1 `car_specs_lookup_full.csv`

Header:

- `make, model, year, engine_cc, horsepower, body_type, drivetrain, seating_capacity, brand_origin, car_segment, brand_market_share`

Intended use: model enrichment features for price prediction.

### 4.2 `car_main_info.csv`

Header:

- `make, model, year, transmission, fuel`

Intended use: coarse normalization by year and basic drivetrain/energy type.

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

Lookups (non-destructive cleaned outputs):

```bash
/home/mo-seif/Documents/GP/GPENV/bin/python ml-service/src/clean_impossible_model_years.py \
  --input ml-service/data/lookups/car_specs_lookup_full.csv

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
- **Fuel/transmission cleanup:** `car_main_info.csv` contains suspicious energy-type values for some EVs. If you want, we can add a second cleaner to enforce EV fuel types based on the spec lookup (engine_cc=0 + known EV models), but that should be done with explicit rules to avoid false positives.
