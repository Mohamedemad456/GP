# Feature Engineering Guide

## Feature Ranking (Most → Least Predictive)

### Tier 1 — Must Have

| Feature | Source | Why |
|---------|--------|-----|
| brand | Parsed from title  | Strongest categorical predictor — Toyota vs BMW = completely different price |
| model | Parsed from title  | Huge variance within brand — Corolla vs Land Cruiser |
| year | Raw data | Direct depreciation proxy |
| mileage_km | Raw data | Wear indicator. Keep continuous, do NOT bin. |
| new_car_price_egp | Specs lookup CSV | Most powerful enrichment feature. Anchors prediction in the right price universe. |
| transmission | Raw data | Automatic = premium in Egypt |

### Tier 2 — Should Have

| Feature | Source | Why |
|---------|--------|-----|
| engine_cc | Specs lookup | Correlates with tier, running costs, tax |
| body_type | Specs lookup | SUV/Crossover premium is real |
| fuel | Raw data | Diesel trucks vs gas sedans vs hybrid luxury |
| brand_origin | Specs lookup | Japanese brands hold value best in Egypt |
| horsepower | Specs lookup | Performance tier indicator |

### Tier 3 — Nice to Have

| Feature | Source | Why |
|---------|--------|-----|
| drivetrain | Specs lookup | 4WD premium exists but collinear with body_type |
| seating_capacity | Specs lookup | Optional; mostly captured by body_type already |
| car_segment | Specs lookup | Optional coarse class like family / sport / trip / city |
| brand_market_share | Specs lookup | Optional popularity proxy from the ground-truth seed set |

### Skip These

| Feature | Why |
|---------|-----|
| fuel_efficiency | LLM estimates unreliable, collinear with engine_cc |
| fuel_tank_capacity | Collinear with engine_cc and body_type |
| mileage_category (binned) | Tree models find optimal splits themselves — binning destroys information |
| age_category (binned) | Same — never bin continuous features for tree models |
| luxury_brand (boolean) | Tree models learn this from brand + new_car_price interaction automatically |

---

## Derived Features to Engineer

| Feature | Formula / Logic | Why |
|---------|----------------|-----|
| car_age | 2026 - year | Depreciation proxy |
| mileage_per_year | mileage_km / max(car_age, 1) | Usage intensity — more meaningful than raw mileage |
| expected_depreciated_value | new_car_price × 0.85^(min(age,1)) × 0.90^(max(age-1,0)) | Theoretical value based on standard depreciation curve. The model learns how much actual price deviates from this. This is the most powerful derived feature. |

---

## Title Parsing Strategy

**Approach:** Use Claude Opus 4.6 in batch, not regex.

**Process:**
1. Extract all unique `title` values from raw data (expect ~2000-4000 unique titles from 27K listings)
2. Send to Claude in batches of 50-100 with a strict schema: extract brand, model, trim
3. Save results as `data/title_parsed.csv` with columns: `original_title`, `brand`, `model`, `trim`
4. On new scraping runs, only send NEW unique titles not already in title_parsed.csv
5. Commit title_parsed.csv to Git — it's reference data

**Why Claude over regex:**
- Handles edge cases: "Mercedes C 180", "BMW 320i", "Hyundai Elantra AD"
- Handles inconsistent formatting across sources
- One-time cost, not per-prediction
- More accurate than any regex pattern list

**Validation:** Spot-check the top 20 most frequent brands (~90% of data) manually.

---

## Specs Lookup Table

**Format:** CSV (flat, easy to inspect/edit in Excel, Git-friendly)

**Columns:** brand, model, year, engine_cc, body_type, horsepower, drivetrain, new_car_price_egp, seating_capacity, brand_origin, car_segment, brand_market_share

**Generation:**
1. Get unique (brand, model, year, transmission, fuel) combos from the ground-truth seed file
2. Enrich each row with the lookup-backed columns listed above
3. Save as `data/car_specs_lookup.csv`
4. Validate top 10 brands manually against official specs and Egyptian pricing sites
5. Commit to Git

**Join key:** (brand, model, year) — used identically at training and inference time.

**When lookup misses:** If a car's brand+model+year has no match, fall back to brand+model (ignoring year), then brand+body_type group medians. Mark the prediction as `confidence: "low"`.

---

## Categorical Feature Handling

**Use LightGBM's native categorical support.** Do not one-hot encode.

- Convert brand, model, transmission, fuel, body_type, drivetrain, brand_origin, car_segment to pandas `category` dtype
- Pass them as `categorical_feature` parameter to LightGBM
- LightGBM uses optimal partitioning internally, which is better than one-hot for high-cardinality features

For rare models (<10 samples), group into "Other_{brand}" to prevent noise.

---

## Missing Data Strategy

| Feature | Missing Pattern | Handling |
|---------|----------------|----------|
| mileage_km | Value is 0 or null | Flag with mileage_is_missing = True, then impute with brand+model median |
| transmission | Value is "0" | Flag with transmission_is_missing = True, then impute with brand+model mode |
| fuel | Rarely missing | Assume "Gas" (most common in Egypt) |
| Lookup features | No match in CSV | Impute with brand+body_type group median. Mark confidence = "low". |

**Key insight:** Missing values should still be handled during cleaning, but the final feature list stays limited to the agreed core, lookup, and engineered columns.

---

## Outlier Handling

- Remove prices < 50K or > 20M EGP (clearly invalid)
- Remove mileage > 500K km
- Within each brand+model group, remove rows beyond 3× IQR
- Flag mileage_per_year > 50K km as suspicious

**Expected impact:** ~5-10% of rows removed. Always log how many at each step.

---

## Data Leakage Checklist

Before training, verify NONE of these are in features:

| Potential Leak | Why |
|----------------|-----|
| price_egp (target) | Obviously |
| Any ratio involving price_egp | Contains target |
| page (pagination) | Scraping artifact |
| scraped_at | Temporal leakage risk — but use it for time-based split if enough data(later not now) |
| Aggregates computed from other rows' prices | Information from test set |

**Golden rule:** Can you compute this feature from only the dealer's input + the static lookup? If yes, it's safe. If no, it's a leak.

---

## Final Feature List (~18 features)

Lookup-backed features are the static enrichment columns stored in the lookup file.

**Core (6):** brand, model, year, mileage_km, transmission, fuel

**Lookup (9):** engine_cc, body_type, horsepower, new_car_price_egp, drivetrain, brand_origin, car_segment, brand_market_share, seating_capacity

**Engineered (3):** car_age, mileage_per_year, expected_depreciated_value

This is the right size — enough signal without overfitting on 26K samples.
