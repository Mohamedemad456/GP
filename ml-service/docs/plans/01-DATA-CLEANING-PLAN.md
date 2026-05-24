# Plan 1: Data Cleaning & Quality

> **Recommended Models**: GPT 5.4 OR Sonnet 4.6   
> **Dependencies**: None (this is the foundation)  
> **Blocks**: All other plans

---

## Current State & Problems

### Problem 1: Unwanted Columns Polluting the Pipeline
- **`model_family`** exists in `data/raw/cars_with_make_model.csv` and `data/lookups/AI_lookup.fixed.csv`
- **`brand_market_share`** exists in `data/lookups/car_specs_lookup_full_cleaned.fixed.csv`
- These columns are NOT used in training/inference but their presence creates confusion and risks accidental leakage
- The `model_family` column is often just a duplicate of `model` (e.g., "F3" → "F3") — no information gain

### Problem 2: Impossible Model-Year Combinations (Data Ghosts)
- Sellers input wrong years when listing cars (e.g., Tesla Model Y listed as 2015)
- Current rules only cover 7 make/model pairs — many more exist in the data
- These ghost entries bias the model: it "learns" that a 2015 Tesla Model Y costs X, which is impossible
- **Impact**: Inflates MAPE for specific make-model combos, confuses SHAP interpretations

### Problem 3: Incorrect Fuel/Transmission for Known EV/Hybrid Models
- Some electric vehicles are listed as "petrol" + "Manual" (seller error or scraping bug)
- Examples: Tesla (all models), BYD Seal, BYD Han, BYD Dolphin should always be electric + automatic
- **Impact**: Creates conflicting signals — model sees same car with different fuel types at different prices

### Problem 4: Dirty Location Data
- Raw `location` field contains strings like `"Sheikh Zayed, Giza•"` (with bullet char and compound format)
- The cleaning pipeline normalizes but some edge cases leak through
- Inconsistent location naming means the model treats "Giza" and "Sheikh Zayed, Giza•" as different categories (I think it's handled in the data cleaning notebook but recheck it if needs any fixes or updates)

### Problem 5: Duplicate/Near-Duplicate Listings
- Multiple scraping rounds (no unique car ID) means the same car may appear multiple times
- Without cross-scrape tracking, we cannot deduplicate across rounds
- **Mitigation**: We can deduplicate within-round by (make, model, year, mileage_km, price_egp, location) and if it have different prices and milage even if it is the same car it will have different date posted-scraped that may differenciate it  
---
## Recommended Approach

### Step 1.1 — Remove `model_family` & `brand_market_share`
**Model**: GPT 5.4  
**Complexity**: Low

**Files to modify**:
| File | Column(s) to Remove |
|------|---------------------|
| `data/raw/cars_with_make_model.csv` | `model_family` |
| `data/lookups/car_specs_lookup_full_cleaned.fixed.csv` | `model_family`, `brand_market_share` |
| `data/lookups/AI_lookup.fixed.csv` | `model_family` |

**Also check/clean**:
- `data/lookups/car_specs_lookup_full_cleaned.csv` (original unfixed version)
- `data/lookups/AI_lookup.csv` (original unfixed version)
- `scripts/cleaning/fix_lookups_make_model.py` — if it references or creates these columns
- `scripts/cleaning/fix_car_specs_lookup_full.py` — if it creates `brand_market_share`

**Approach**:
1. Load each CSV with pandas
2. Drop the columns
3. Save back (preserve encoding and no trailing whitespace)
4. Verify by re-loading and checking `.columns`

**Verification**:
```bash
python3 -c "
import pandas as pd
for f in ['data/raw/cars_with_make_model.csv', 'data/lookups/car_specs_lookup_full_cleaned.fixed.csv', 'data/lookups/AI_lookup.fixed.csv']:
    df = pd.read_csv(f)
    assert 'model_family' not in df.columns, f'{f} still has model_family'
    assert 'brand_market_share' not in df.columns, f'{f} still has brand_market_share'
    print(f'{f}: OK ({df.shape})')
"
```

---

### Step 1.2 — Expand Impossible Model-Year Rules
**Model**: Sonnet 4.6  
**Complexity**: Medium

**File**: `scripts/cleaning/clean_impossible_model_years.py`

**Current rules** (only 7):
```python
MIN_MODEL_YEAR = [
    ModelYearRule(make="Audi", model="Q4 E-Tron", min_year=2021),
    ModelYearRule(make="Tesla", model="Model Y", min_year=2020),
    ModelYearRule(make="BMW", model="IX1", min_year=2022),
    ModelYearRule(make="BYD", model="Destroyer 05", min_year=2022),
    ModelYearRule(make="MG", model="Cyberster", min_year=2023),
    ModelYearRule(make="Chery", model="Tiggo 8 Pro Max", min_year=2024),
    ModelYearRule(make="Kia", model="Xceed", min_year=2020),
]
```

**PRIORITY 1 — Confirmed dirty data (from external review + metrics)**:
```python
# These are CONFIRMED 100% dirty — immediate add
{"make": "Chevrolet", "model": "Avalanche", "min_year": 2002, "max_year": 2013},  # 101% MAPE
{"make": "Ford", "model": "Bronco Raptor", "min_year": 2021},                    # 73% MAPE
{"make": "Hyundai", "model": "Excel", "max_year": 1994},                          # 29% MAPE
{"make": "Fiat", "model": "127", "max_year": 1983},                               # 54% MAPE
{"make": "Fiat", "model": "128", "max_year": 1985},                               # 37% MAPE
{"make": "Fiat", "model": "131", "max_year": 1984},                               # 29% MAPE
```

**PRIORITY 2 — Conditional drop rules (new rule type needed)**:
```python
# After year filtering, remaining Avalanche entries with diesel or manual = mislabeled trucks
CONDITIONAL_DROPS = [
    {"make": "Chevrolet", "model": "Avalanche", "fuel": "diesel", "action": "drop"},
    {"make": "Chevrolet", "model": "Avalanche", "transmission": "Manual", "action": "drop"},
]
```

> **Implementation note**: The `ModelYearRule` class needs to be extended with an optional `max_year` field. Add: `max_year: int | None = None` to the dataclass.

**PRIORITY 3 — EV/New models with clear min years**:
```python
ModelYearRule(make="Tesla", model="Model 3", min_year=2017),
ModelYearRule(make="Tesla", model="Model S", min_year=2012),
ModelYearRule(make="Tesla", model="Model X", min_year=2015),
ModelYearRule(make="BYD", model="Seal", min_year=2022),
ModelYearRule(make="BYD", model="Han", min_year=2020),
ModelYearRule(make="BYD", model="Dolphin", min_year=2021),
ModelYearRule(make="BYD", model="Atto 3", min_year=2022),
ModelYearRule(make="BYD", model="Song Plus", min_year=2020),
ModelYearRule(make="Hyundai", model="Ioniq 5", min_year=2021),
ModelYearRule(make="Hyundai", model="Ioniq 6", min_year=2022),
ModelYearRule(make="Kia", model="EV6", min_year=2021),
ModelYearRule(make="Chery", model="Tiggo 9", min_year=2024),
ModelYearRule(make="Chery", model="Arrizo 5 Plus", min_year=2021),
ModelYearRule(make="MG", model="4", min_year=2022),
ModelYearRule(make="MG", model="Marvel R", min_year=2021),
ModelYearRule(make="Jetour", model="Dashing", min_year=2022),
ModelYearRule(make="Jetour", model="X70 Plus", min_year=2020),
ModelYearRule(make="Geely", model="Coolray", min_year=2019),
ModelYearRule(make="Geely", model="Starray", min_year=2022),
ModelYearRule(make="BAIC", model="X55", min_year=2019),
```

**Approach**:
1. Extend `ModelYearRule` dataclass with optional `max_year: int | None = None`
2. Add a new `ConditionalDropRule` class for fuel/transmission-based drops
3. Add all Priority 1 rules first (immediate impact on worst MAPE)
4. Add Priority 2 conditional drop logic
5. Add Priority 3 EV/new-model rules
6. Run in `--mode report` first to see what would be dropped
7. Confirm drops are legitimate, then run `--mode apply`

**Challenge**: Must be conservative — we don't want to drop legitimate data. Each rule should be verifiable against the real-world production year of that model.

---

### Step 1.2b — Investigate Remaining High-MAPE Models from Metrics
**Model**: Sonnet 4.6  
**Complexity**: Medium

**Source**: `models/metrics/make_model_mape_cv.csv` — 5-fold CV MAPE for all 532 make-model combos

The following models have **MAPE > 40%** and need investigation to determine if they're dirty data or multi-generation confusion:

| Make | Model | MAPE% | n | Likely Root Cause | Action |
|------|-------|-------|---|-------------------|--------|
| BMW | OTHER_BMW | 261.8% | 4 | Rare-category garbage | Handled by rare grouping |
| VW | Touareg | 288.2% | 6 | Wrong prices / fake listings | Investigate → likely drop |
| VW | Beetle | 172.7% | 8 | Multi-gen 1960s–2019 | `year_bucket` will help |
| GAC | Empow | 165.6% | 7 | New model, pricing chaos | Investigate |
| DFSK | Glory | 145.8% | 6 | Dirty data | Investigate → likely drop |
| Chery | Tiggo 7 Pro Max | 81.2% | 9 | Mislabeled years | Year rule already exists |
| BAIC | EU5 Plus | 87.5% | 13 | EV pricing chaos | Investigate |
| Cupra | Leon | 77.4% | 32 | Multi-gen + EV vs ICE | Need variant split |
| Chevrolet | T-Series | 72.8% | 19 | Mislabeled trucks | Investigate → conditional drop |
| Daihatsu | Grand Terios | 72.7% | 20 | Multi-gen old car | `year_bucket` + small n |
| Tesla | Model Y | 71.3% | 16 | Wrong years (year rule exists) | Year rule will fix |
| Chrysler | Town & Country | 70.8% | 13 | Multi-gen, very old | May need year bounds |
| Porsche | Cayenne | 61.0% | 33 | Multi-gen 2002–2024 | `year_bucket` + `mm_price_tier` |
| JAC | S2 | 61.8% | 20 | Pricing chaos | Investigate |
| Fiat | Linea | 64.2% | 10 | Dirty data | Investigate |
| Fiat | Tempra | 59.1% | 8 | Ancient car | Consider `max_year` |
| Fiat | Regata | 47.2% | 12 | Ancient car | Consider `max_year` |
| Mahindra | Scorpio | 58.2% | 7 | Dirty data | Investigate |
| Isuzu | D-Max | 103.1% | 5 | Mislabeled commercial | Investigate → likely drop |
| Lada | 2107 | 43.4% | 61 | Huge variance in old car | `is_vintage` + `year_bucket` |
| BYD | L3 | 44.1% | 9 | Dirty data | Investigate |
| BYD | Seagull | 43.4% | 11 | New EV, pricing chaos | Investigate |
| Daihatsu | Terios | 50.3% | 34 | Multi-gen | `year_bucket` |
| Suzuki | Grand Vitara | 41.3% | 113 | Multi-gen (old + new) | `year_bucket` + `mm_price_tier` |
| Chery | QQ | 41.8% | 6 | Ancient car | Investigate |
| Skoda | Octavia Combi | 41.8% | 73 | Multi-gen confusion | `year_bucket` |
| Haval | H6 | 42.4% | 22 | Pricing chaos | Investigate |
| Honda | Accord | 48.3% | 7 (test) | Multi-gen | `year_bucket` |

**Approach**:
1. For each model above, query the raw data to check year distribution and price range
2. Categorize: **dirty data** → add cleaning rules; **multi-gen** → addressed by features in Plan 2; **low n noise** → no action needed
3. Add any new `min_year`/`max_year` rules discovered
4. Add conditional drops for mislabeled commercial vehicles (T-Series, D-Max)

**Expected impact**:
- Cleaning rules (dirty data): Will directly reduce MAPE for ~10-15 models
- Multi-gen models (~15 models): Addressed by Plan 2 features (`year_bucket`, `mm_price_tier`)
- Low-n noise (~5 models): No fix possible without more data

**Key insight from Daewoo**:
- Daewoo Lanos: 28% MAPE, n=250. This is NOT dirty data.
- Root cause: huge price variance within same (make, model) because Lanos spans 1997–2008 and condition varies wildly.
- Fix: `year_bucket` + `mm_price_tier` + `mileage_ratio` (Plan 2 features), NOT data cleaning.
- Same pattern: Mercedes E200 (21.5%, n=193), Hyundai Tucson (34.7%, n=396), Hyundai Verna (34.6%, n=245)

---

### Step 1.3 — Fix Fuel/Transmission for Known EV Models
**Model**: Sonnet 4.6  
**Complexity**: Medium

**File**: `scripts/cleaning/fix_car_main_info_ev_fuel.py` (extend or create new section in pipeline)

**Rules to enforce**:

| Make | Model Pattern | Fuel | Transmission |
|------|---------------|------|--------------|
| Tesla | * (all models) | electric | Automatic |
| BYD | Seal, Han EV, Dolphin, Atto 3 | electric | Automatic |
| BYD | Song Plus DM-i, Han DM-i | hybrid | Automatic |
| Porsche | Taycan | electric | Automatic |
| BMW | iX, iX1, i4, i7 | electric | Automatic |
| Mercedes | EQA, EQB, EQC, EQS, EQE | electric | Automatic |

**Approach**:
1. Define correction rules as a data structure (list of dicts)
2. Apply after basic cleaning but before feature engineering
3. Log all corrections made for audit trail
4. Handle partial matches (e.g., "BYD Han" should match both "Han" and "Han EV")

**Challenge**: Some BYD models exist in both EV and hybrid versions (e.g., Song Plus vs Song Plus DM-i). Must distinguish by model name variant, not just make.

---

### Step 1.4 — Deduplicate Within-Round Listings
**Model**: GPT 5.4  
**Complexity**: Low

**Approach**:
1. Group by `(make, model, year, mileage_km, price_egp)` — exact match
2. Within each group, keep the first occurrence (or the one with most complete data)
3. Log how many duplicates removed
4. This is a conservative dedup — only removes exact copies

**Why not cross-round dedup**: No unique car ID exists, and price may change between scrapes (which is valid market signal). We'd lose information.

---

### Step 1.5 — Regenerate Processed Data
**Model**: Sonnet 4.6  
**Complexity**: Medium

**After steps 1.1-1.4 are complete**, regenerate `processed_data.csv`:

1. Start from cleaned `cars_with_make_model.csv` (post cleaning rules applied)
2. Merge with `car_specs_lookup_full_cleaned.fixed.csv` on `(make, model, year)`
   - Join keys: exact match first, then nearest-year fallback
   - Columns to add: `engine_cc, horsepower, body_type, drivetrain, seating_capacity, brand_origin, car_segment`
3. Compute derived columns: `car_age = current_year - year`, `mileage_per_year = mileage_km / max(car_age, 1)`
4. Compute `price_egp_log = log(price_egp)`
5. Drop rows with missing `price_egp` or `year`
6. Save to `data/processed/processed_data.csv`

**Important**: The `car_age` column in processed data is kept for reference/analysis but is NOT used as a training feature (redundant with `year`). The feature lists (`NUM_COLS`, `CAT_COLS`) explicitly do NOT include `car_age`.

**Verification**:
- Shape: expect 19,000-20,000 rows (some dropped by cleaning)
- No `model_family` or `brand_market_share` columns
- No NaN in `price_egp`, `year`, `make`, `model`
- `car_age` range: 0-30 (anything >30 is suspicious)
- `price_egp` range: 50,000 - 50,000,000 EGP (anything outside is suspicious)

---

## Challenges & Risks

| Challenge | Risk | Mitigation |
|-----------|------|-----------|
| Over-aggressive cleaning drops too many rows | Model has less training data | Run in report mode first, verify each rule |
| Lookup merge fails for some cars (no match) | Missing specs for some rows | Use 5-priority fallback (already implemented in feature_builder) |
| EV fuel correction applied to non-EV variant | Data corruption | Match on full model name, not just make |
| Dedup removes legitimate similar-but-different cars | Data loss | Only dedup on exact 5-field match |

---

## Files Modified by This Plan

| File | Action |
|------|--------|
| `data/raw/cars_with_make_model.csv` | Drop `model_family` column |
| `data/lookups/car_specs_lookup_full_cleaned.fixed.csv` | Drop `model_family`, `brand_market_share` |
| `data/lookups/AI_lookup.fixed.csv` | Drop `model_family` |
| `scripts/cleaning/clean_impossible_model_years.py` | Extend `MIN_MODEL_YEAR` rules |
| `scripts/cleaning/clean_raw_data_pipeline.py` | Add EV/fuel correction stage, dedup stage |
| `data/processed/processed_data.csv` | Regenerated output |

---

## Success Criteria

- [ ] No `model_family` or `brand_market_share` in any data file
- [ ] All impossible model-year combos removed (verified by report)
- [ ] All known EVs have correct fuel/transmission
- [ ] Processed data has no NaN in critical columns
- [ ] Row count is within 90-100% of original (not too much dropped)
- [ ] `pytest tests/` passes (no regressions)
