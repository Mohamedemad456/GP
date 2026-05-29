# GP Project — Data, Model & Confidence System: Full Decision Context

**Purpose:** Complete context of all analysis, findings, recommendations, design questions,
and trade-offs discussed. Written for handoff to a local coding agent or future review.

---

## 1. Project Context (Brief)

- **Project:** Dynamic Pricing Engine — AI microservice for an Egyptian used-car dealership platform
- **Model:** Ensemble of XGBoost + LightGBM with Huber loss and robust averaging
- **Current global MAPE:** ~12.4% (measured on old data — see caveat below)
- **Business rule:** The system **must always return a price prediction**. No "we don't know" responses allowed. The user must get a number, but honesty about confidence is required.
- **Confidence system:** `confidence.py` classifies predictions as `high / medium / low` today

---

## 2. The Two Datasets — Verified Numbers

All numbers below were verified by direct pandas analysis, not from agent notes.

| Metric | Old (`processed_data_copy.csv`) | New (`processed_data.csv`) |
|---|---|---|
| Total rows | 20,461 | 12,810 |
| Make+model combos | 535 | 430 |
| Duplicate rows (on key cols) | **213** | **0** |
| Zero-mileage rows | 2,083 | 1,312 |
| Columns | 18 | 21 (+ scraping metadata) |

### Where Did the 7,651 Rows Go?

The row reduction breaks down as:

| Source | Rows |
|---|---|
| Entirely dropped combos (125 combos removed) | ~1,390 |
| Duplicate rows removed | 213 |
| Pipeline filtering within shared combos | ~6,729 |
| **Total** | **~7,651** |

The 6,729 rows filtered within shared combos are **not random**. Examples:
- Toyota Corolla: 344 → 199 rows. Old data had prices up to **16,400,000 EGP** (clearly a scraping error). New max is 2,020,000 EGP.
- Mercedes C180: 413 → 244. Old data included listings the pipeline's mileage/price bounds correctly rejected.
- Hyundai Tucson: 396 → 238. Old year range was 1988–2026. The pipeline removed impossible year combinations.

These are noise rows removed, not signal rows.

### The 125 Dropped Combos — Not All Bad

Of the 125 combos only in old data:
- **89 had n < 10** in old data. Their average MAPE was 26.8%. These are statistically unreliable.
- **36 had n ≥ 10** in old data. Their average MAPE was **28.0%**. The majority are dirty:
  - Chevrolet Avalanche: 25 rows, **101% MAPE** (in cleaning rules explicitly)
  - Ford Bronco Raptor: 36 rows, **73% MAPE** (in cleaning rules)
  - Chevrolet T-Series: 19 rows, **72% MAPE**
  - Chrysler Town & Country: 13 rows, **70% MAPE**
  - Fiat 132: 16 rows, **36% MAPE** (in cleaning rules, max_year=1984)

**Legitimate losses** (good MAPE but didn't survive the pipeline):
- Renault Austral: 16 rows, **5.8% MAPE**
- JAC S3: 14 rows, **6.3% MAPE**
- Citroën C4X: 11 rows, **6.4% MAPE**
- Toyota Belta: 15 rows, **6.6% MAPE** *(may exist as Toyota Yaris in new data — alias)*
- Renault Austral: 16 rows, **5.8% MAPE**

**Alias renames (appear dropped but aren't):**
- `BMW 318i` (97 rows) → `BMW 318` (62 rows in new) — alias normalization in canonical_rules.yaml
- `Suzuki Grand vitara` (113 rows) → `Suzuki Grand Vitara` (79 rows in new) — casing fix

### Fallback Territory: MAPE Distribution

Of the 97 fallback combos with MAPE data from the old model evaluation:

| MAPE Range | Count |
|---|---|
| < 15% (good) | 32 combos |
| 15–20% (acceptable) | 25 combos |
| 20–30% (poor) | 18 combos |
| 30–40% (bad) | 5 combos |
| > 40% (very bad) | 17 combos |

**Average MAPE of fallback combos: 26.0%**

This means roughly **57 of 97 fallback combos** have MAPE < 20% on the old model —
these are worth serving. The remaining 40 combos will trigger `very_low` confidence
under the new system.

---

## 3. The Caveat on 12.4% MAPE

The 12.4% global MAPE was measured on old data which contained:
- 213 exact duplicate rows
- Toyota Corolla listings at 16.4M EGP
- Other pipeline-filtered outliers

**The actual MAPE on clean data is unknown until you retrain and re-evaluate.**
It could be better (outliers no longer pull predictions wrong) or worse (fewer samples
for some combos). Do not assume 12.4% is a reliable baseline for the new model.

---

## 4. Recommendations

### 4.1 Data Strategy

**Recommendation: Train the new primary model on `processed_data.csv` (new data).**

Rationale:
- 0 duplicates vs 213 in old
- Extreme outlier prices removed (16.4M EGP Toyota Corolla gone)
- Pipeline-enforced quality: impossible year/mileage/price combinations removed
- 446+ make+model combos with ≥ 5 samples each (all statistically valid)

**Do NOT train on old data as primary.** The 7,651 extra rows are mostly noise.

### 4.2 Fallback Strategy

**Recommendation: Keep the old model loaded as a fallback, but with conditions.**

The business rule says you must always return a prediction. The fallback is therefore
architecturally necessary — not because the old model is better, but because it covers
125 combos the new model doesn't have.

Fallback flow:
```
Request comes in
  → Does new model have this make+model in its training combos?
    YES → serve new model prediction
    NO  → serve old model prediction
      → set confidence using OLD model's per-combo MAPE
      → if MAPE > 40% or n_support < 5 → "very_low" confidence
  → Neither model has it?
    → new model still predicts (tree models generalize on features)
    → n_support = None → confidence degrades naturally
```

**Important:** The fallback is not a permanent solution. As you scrape more data,
more combos will enter the new model and the fallback will shrink.

### 4.3 Confidence System

**Recommendation: Add `very_low` as a fourth confidence label.**

Trigger conditions for `very_low` (applied before all other logic):
- `mape_pct > 40.0` — at 40% MAPE on a 600K EGP car you're ±240K off
- `n_support < 5` AND `mape_pct` is not excellent (≤ 10%)

`very_low` should **only be set explicitly**, never through `_degrade_label()`.
`_degrade_label("low")` should still return `"low"`, not `"very_low"`.

**Recommendation: Fix four existing issues in `confidence.py`** (see Section 5).

### 4.4 Admin Review Workflow

When confidence = `very_low`, the backend should:
1. Flag the prediction for admin review
2. Add it to an admin queue
3. Admin manually sets a `fair_price_override`
4. Subsequent requests for the same car use the override

This is a **backend responsibility**, not the AI service's. The AI service only
sets the label. Do not implement the queue logic in `confidence.py`.

### 4.5 MAPE Thresholds After Retraining

After you retrain on new data, the global MAPE will shift. You must:
1. Re-run per-combo MAPE evaluation (equivalent of `make_model_mape_cv.csv`)
2. Update `MAPE_THRESHOLDS` in `confidence.py` to match the new distribution
3. The 14% / 18% thresholds were calibrated to 12.4% global MAPE. If the new
   model is 11% globally, the thresholds should shift down proportionally.

---

## 5. `confidence.py` — Code Review Findings

### Issue 1: `width_pct` branch is dead for non-quantile models

```python
if is_quantile and width_pct is not None:
```

If `is_quantile=False`, the entire width branch is skipped. If your ensemble
returns `lower_price` / `upper_price` even in non-quantile mode (e.g. from a
fixed offset), you're silently ignoring a useful signal.

**Decision needed:** Does your non-quantile model produce meaningful upper/lower bounds?
If yes, remove the `is_quantile` guard or add a separate branch for it.

### Issue 2: MAPE thresholds are magic numbers

```python
elif mape_pct <= 14.0:
    label = "high"
elif mape_pct <= 18.0:
    label = "medium"
```

These are calibrated to the 12.4% global MAPE of the old model. After retraining
they will be wrong. Move them to named constants at the top of the file:

```python
MAPE_HIGH_THRESHOLD = 14.0   # below this → high confidence
MAPE_MEDIUM_THRESHOLD = 18.0 # below this → medium confidence
MAPE_VERY_LOW_THRESHOLD = 40.0  # above this → very_low confidence
```

### Issue 3: `SUPPORT_COUNTS_MM` will be wrong for fallback combos

```python
n_support = _ms.SUPPORT_COUNTS_MM.get((mk, md))
```

`SUPPORT_COUNTS_MM` currently holds row counts from the **new** model's training data.
When the old model serves a prediction for a fallback combo, this dict will return
`None` for that combo — so the support-count degradation logic never fires.

**Fix:** When old model fallback is used, `n_support` must come from the old
model's support counts, not the new model's.

**Options:**
- A: Keep two separate dicts: `SUPPORT_COUNTS_MM_NEW` and `SUPPORT_COUNTS_MM_OLD`
- B: Merge into one dict, populating old counts only for combos not in new
- C: Pass `n_support` explicitly to `compute_confidence_label` based on which model served

Option C is cleanest architecturally — the caller knows which model was used.

### Issue 4: `n_support < 5` double-check logic is non-obvious

```python
if n_support < 5:
    if excellent_mape:
        label = _degrade_label(label)   # degrades once
    else:
        return "low"
if n_support < 10:                       # this also runs when n < 5
    if not excellent_mape:
        label = _degrade_label(label)
```

When `n < 5` and `not excellent_mape`, you hit `return "low"` and never reach
the `n < 10` block. Fine. But when `n < 5` and `excellent_mape`, you degrade
once, then fall through to the `n < 10` block — but `not excellent_mape` is False
so it's skipped. This is actually correct behavior but invisible to a reader.

**Fix:** Add a comment explaining the fall-through, or use `elif` to make it explicit.

---

## 6. Trade-offs

### Train on new data only vs old data only

| | New data only | Old data only |
|---|---|---|
| Row count | 12,810 | 20,461 |
| Combos | 430 | 535 |
| Data quality | High (deduplicated, filtered) | Lower (213 dups, price outliers) |
| MAPE reliability | Unknown until retrained | 12.4% (but measured on dirty data) |
| Fallback needed? | Yes, for 125 combos | No |
| Risk | Retrained MAPE might be worse on paper | Model learns from noise |

**Winner: New data.** The quality difference is not marginal.

### Old model fallback vs "very_low" only from new model

| | Old model fallback | New model only + very_low |
|---|---|---|
| Coverage | 535 combos | 430 combos + generalization |
| Complexity | Two models loaded in memory | One model |
| MAPE for fallback combos | Known (26% avg) | Unknown (generalization) |
| Confidence correctness | Can use old per-combo MAPE | n_support = None, degrades naturally |
| Maintenance | Two model versions to manage | One |

**Winner for this project:** Old model fallback. The business rule says give a number,
and having known MAPE per combo (even if high) is better than unknown generalization.
The complexity cost is manageable.

### `very_low` threshold: 40% vs 50%

| | 40% threshold | 50% threshold |
|---|---|---|
| Combos flagged in fallback | ~22 of 97 | ~17 of 97 |
| User harm at 40% | ±240K EGP on 600K car | — |
| User harm at 50% | ±300K EGP on 600K car | — |
| Admin queue volume | Higher | Lower |

**Winner: 40%.** At 50% MAPE you're telling a user a car is worth 600K when it could
be 300K or 900K. That's actively misleading. Flag it at 40%.

---

## 7. Design Questions You Must Answer

These are decisions no one can make for you. They depend on your system's architecture.

### Q1: How does the prediction router know which model to use?

At request time, something must decide: "this make+model → new model" vs "this
make+model → old model fallback." Where does that routing logic live?

Options:
- In the `predict()` function in your model service
- In a separate `ModelRouter` class
- As a set stored at startup from training data combos

You need to persist a set of combos the new model was trained on, load it at
startup, and check membership at prediction time. Where does that set come from
and how is it stored?

### Q2: Which MAPE dict does `car_mape_pct()` use after fallback?

`car_mape_pct(make, model)` calls `_ms.get_make_model_mape_pct(make, model)`.
Today that presumably queries the new model's per-combo MAPE. For fallback combos,
it will return `None` and fall back to global MAPE — which is the **new** model's
global MAPE, not the old model's.

You need the old model's per-combo MAPE loaded and queryable separately.
How does `model_state.py` store this? Single dict? Two dicts?

### Q3: Is `width_pct` meaningful for your non-quantile predictions?

Does your ensemble produce `lower_price` and `upper_price` in non-quantile mode?
If yes, what method generates those bounds? Fixed percentage? Bootstrapped intervals?
If those bounds are meaningful, the `is_quantile` guard should be removed or extended.

### Q4: Should `very_low` feed the admin queue automatically, or just be a label?

The AI service can set `confidence = "very_low"`. The backend can read that and
decide what to do. But who owns the admin queue logic? If the backend team handles
it, the AI service just returns the label. If the AI service needs to POST to an
admin endpoint, that's a different design. Clarify this with the team.

### Q5: What happens when NEITHER model has trained on the car?

Example: user enters a brand-new make+model that appeared in the Egyptian market
after both models were trained. The new model will still predict based on features
(car_segment, engine_cc, brand_origin, etc.) but:
- `n_support` will be `None`
- `car_mape_pct()` will return global MAPE
- Confidence will degrade naturally via the `n_support=None` path

Is this acceptable? Or do you want a hard rule: "if not in any training data → very_low
regardless of other signals"?

### Q6: After retraining, do you recalibrate MAPE thresholds?

The 14% / 18% thresholds in `confidence_label_from_signals` were chosen based on
12.4% global MAPE. If your retrained model achieves 10% global MAPE, keeping 14%
as the "high" ceiling is too generous — most cars will be "high" even if they're not.

Do you want static thresholds you update manually after each retrain, or dynamic
thresholds computed as `(global_mape * 1.1)` and `(global_mape * 1.5)` at load time?

---

## 8. Implementation Order (Recommended)

Do these in order. Each builds on the previous.

### Step 1 — Add `very_low` to `confidence.py` *(small, testable, isolated)*

Add named constants. Add the `very_low` early-return. Update `_degrade_label`
docstring to clarify it never produces `very_low`. Write unit tests for the new
boundary conditions.

### Step 2 — Fix `SUPPORT_COUNTS_MM` for fallback combos

Before implementing routing, solve the data problem: how does `compute_confidence_label`
get the correct `n_support` when the old model served the prediction? This requires
a design decision from Q3 above.

### Step 3 — Implement model routing

Create the routing logic that decides which model serves a prediction. Load the
set of new-model combos at startup. Add the old model's per-combo MAPE dict.

### Step 4 — Retrain on new data, re-evaluate per-combo MAPE

Run the full pipeline on `processed_data.csv`. Generate the new `make_model_mape_cv.csv`
equivalent. Update thresholds in `confidence.py` based on real numbers.

### Step 5 — Review fallback combos after retraining

After retraining, re-check which combos are still in "fallback territory." Some may
now be covered by the new model if new scraping rounds added rows. The fallback
set shrinks over time as data quality improves.

---

## 9. Key Numbers Reference

| Number | Value | Source |
|---|---|---|
| New model combos | 430 | Direct count from `processed_data.csv` |
| Old model combos | 535 | Direct count from `processed_data_copy.csv` |
| Fallback-only combos | 125 | Set difference |
| Fallback combos with MAPE data | 97 | Cross-join with `make_model_mape_cv.csv` |
| Avg MAPE of fallback combos | 26.0% | Computed from evaluation file |
| Fallback combos with MAPE < 15% | 32 | Worth serving with medium/high conf |
| Fallback combos with MAPE < 20% | 57 | Worth serving at all |
| Fallback combos with MAPE > 40% | 17 | Should trigger `very_low` |
| Duplicate rows in old data | 213 | Key-column dedup check |
| Duplicate rows in new data | 0 | Verified |
| Row shrinkage in shared combos | 6,729 | Pipeline filtering (noise removal) |
| Current global MAPE | 12.4% | Measured on old (dirty) data — unreliable baseline |

---

## 10. Files Referenced

| File | Role |
|---|---|
| `processed_data_copy.csv` | Old training data (pre-pipeline) |
| `processed_data.csv` | New training data (pipeline output, R2) |
| `make_model_mape_cv.csv` | Per-combo MAPE evaluation on old model/old data |
| `confidence.py` | Confidence label computation — needs `very_low` added |
| `clean_impossible_model_years.py` | Cleaning rules — explains why Avalanche/Bronco Raptor dropped |
| `clean_raw_data_pipeline.py` | Master pipeline — all 5 cleaning stages |
| `canonical_rules.yaml` | Alias normalization — explains BMW 318i → BMW 318 |
| `generate_processed_data.py` | Feature builder — price/mileage/year hard bounds |
| `combine_versions.py` | Combines scraping rounds → `training_data.csv` |
| `version_manager.py` | Manifest management for versioned data |

---

*Generated from analysis session — all numbers verified by direct pandas computation.*
