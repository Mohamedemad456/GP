# Plan 6 Implementation Notes — Conformalized Quantile Regression (CQR)

> **Completed**: 2026-06-08
> **Status**: ✅ **DONE — REJECTED FOR PRODUCTION**
> **Result**: CQR pipeline works correctly, but calibrated intervals are too wide for production use. Deferred to future research with a matched calibration/test protocol.

---

## What Was Done

### Step 6.1 — CQR Notebook Prototype

**Notebook**: `notebooks/07d_cqr_calibration_experiments.ipynb`
**Output directory**: `models/experiments/plan2_plan4/07d_cqr_calibration_experiments/`

A complete CQR calibration experiment was implemented and executed:

| Step | Description |
|------|-------------|
| 6.1 | Load winning model from `07c_model_v2_training_experiments` (WeightedEnsemble, 5-quantile) |
| 6.2 | Create group-aware calibration split (15% of data, GroupShuffleSplit on make+model) |
| 6.3 | Retrain winner on train_fit split, predict quantiles on calibration and test sets |
| 6.4 | Enforce quantile monotonicity (q05 ≤ q10 ≤ q50 ≤ q90 ≤ q95) per sample |
| 6.5 | Compute nonconformity scores on calibration set for 80% and 90% intervals |
| 6.6 | Compute correction factors (`q_hat_80`, `q_hat_90`) via finite-sample conformal quantile |
| 6.7 | Apply corrections to test set and measure empirical coverage / width |
| 6.8 | Export calibration config, summary CSV, and per-tier diagnostics |

### Step 6.2 — Data Split Design

| Split | Rows | Method | Purpose |
|-------|------|--------|---------|
| train_fit | 7,875 | price_stratified train minus calibration/val | Model training |
| val | 875 | random 10% of train | Early stopping |
| calibration | 1,248 | GroupShuffleSplit (make+model), 15% | CQR q_hat estimation |
| test | 2,500 | price_stratified holdout | Final evaluation |

**Important**: Calibration split uses `GroupShuffleSplit` (group-aware), while the test split comes from the original `price_stratified` split (not group-aware). This mismatch is discussed in the methodological notes below.

### Step 6.3 — Monotonicity Enforcement

Before computing nonconformity scores, all quantile predictions were sorted per sample to prevent crossing quantiles. On the test set, ~5–8% of raw predictions had at least one quantile crossing; sorting corrected these without changing the underlying model.

---

## Results

### Global Summary (Test Set)

| Metric | Raw (Monotonic) | CQR Calibrated | Change |
|--------|-----------------|----------------|--------|
| **Coverage 80%** | 71.64% | **91.08%** | +19.4 pp |
| **Coverage 90%** | 85.92% | **96.32%** | +10.4 pp |
| **Width 80%** (median %) | 36.3% | **64.2%** | +27.9 pp |
| **Width 90%** (median %) | 61.3% | **96.4%** | +35.1 pp |
| MAE | 168,598 | 168,598 | — |
| MAPE | 12.25% | 12.25% | — |

**Correction factors** (`q_hat`):
- `q_hat_80` = **67,115 EGP**
- `q_hat_90` = **85,324 EGP**

**Interpretation**: CQR successfully corrected the under-coverage problem (raw 80% coverage was 71.6%, target was 80%), but it **overshot dramatically**. Calibrated coverage is ~91% for an 80% target — a ~11 pp over-correction. The price is interval width: the 80% interval went from ±18% around the median to ±32% around the median. The 90% interval is nearly ±48%.

### Per-Tier Diagnostics (Test Set)

| Tier | Rows | Raw 80% Cov | Calib 80% Cov | Raw 80% Width | Calib 80% Width | Median Price |
|------|------|-------------|---------------|---------------|-----------------|--------------|
| economy | 906 | 70.1% | **97.5%** | 45.1% | **100.1%** | 285,000 |
| standard | 966 | 72.8% | **91.2%** | 28.7% | **45.7%** | 830,000 |
| luxury | 461 | 74.2% | **85.7%** | 30.0% | **36.5%** | 2,250,000 |
| ultra_luxury | 167 | 66.5% | **70.7%** | 50.5% | **53.1%** | 5,800,000 |

**Key observations**:
- **Economy tier is hit hardest**: calibrated 80% width exceeds 100% of median price. The interval for a 285K EGP car becomes ~0–570K EGP — essentially uninformative.
- **Luxury tier tolerates CQR best**: width inflation is smallest (+6.5 pp), and coverage is closest to target without extreme over-correction.
- **Ultra-luxury has the worst raw coverage** (66.5%) and still ends up under the 80% target even after calibration (70.7%). A single global `q_hat` cannot fix this tier's severe under-coverage.

---

## Files Created

| File | Purpose |
|------|---------|
| `notebooks/07d_cqr_calibration_experiments.ipynb` | Full CQR experiment: training, monotonicity, score computation, calibration, diagnostics, export |
| `models/experiments/plan2_plan4/07d_cqr_calibration_experiments/cqr_calibration_config.json` | Exported config with q_hat values, coverage targets, split sizes, and empirical results |
| `models/experiments/plan2_plan4/07d_cqr_calibration_experiments/cqr_summary.csv` | Global summary: raw vs. calibrated metrics for calibration and test splits |
| `models/experiments/plan2_plan4/07d_cqr_calibration_experiments/cqr_per_tier_summary.csv` | Per-price-tier summary: raw vs. calibrated coverage, width, and error metrics |

---

## Design Choices & Trade-offs

### 1. Group-aware calibration split vs. non-group-aware test split

**Choice**: Calibration set was held out using `GroupShuffleSplit` on `(make, model)` to ensure no leakage. The test set was the original `price_stratified` holdout.

**Trade-off**:
- ✅ Calibration set is completely unseen by the model in terms of make/model combinations
- ❌ Test set distribution differs from calibration distribution because the test set may contain make/model groups that appeared in training
- ❌ This mismatch likely caused `q_hat` to overcorrect: the calibration set had harder cases (unseen groups), so the correction factor was tuned to a harder distribution than the test set

**Verdict**: This is a **methodological flaw** that contributes to over-coverage. A matched protocol (both calibration and test use the same group-aware strategy) is required for a fair CQR evaluation.

### 2. Global q_hat vs. per-tier q_hat

**Choice**: Computed a single global `q_hat` for all price tiers.

**Trade-off**:
- ✅ Simple to implement and deploy (one JSON config value)
- ❌ Economy tier gets destroyed (100% width), ultra-luxury remains under-covered (70.7%)
- ❌ A global correction cannot simultaneously fix a tier that needs a large correction and a tier that needs a small one

**Verdict**: Per-tier `q_hat` would help, but even then the economy-tier width would likely remain too large. The underlying quantile model is not well-calibrated enough for CQR to produce tight intervals.

### 3. Monotonicity enforcement via per-sample sorting

**Choice**: Sorted predicted quantiles per sample to guarantee q05 ≤ q10 ≤ q50 ≤ q90 ≤ q95.

**Trade-off**:
- ✅ Prevents nonsensical intervals where lower quantile > upper quantile
- ✅ Improves coverage consistency
- ❌ Sorting is a post-hoc fix; it does not change the model training. A better approach is to train with monotonicity constraints (e.g., XGBoost `monotone_constraints` or a shared base learner), but this was out of scope for Plan 6

**Verdict**: Correct and necessary for valid CQR. The model should ideally learn monotonic quantiles natively in a future iteration.

---

## Notes & Observations

### 1. CQR works, but the model is not calibrated well enough

The CQR algorithm itself executed correctly:
- Nonconformity scores were computed properly
- `q_hat` was derived via the finite-sample formula
- Coverage did increase (71.6% → 91.1% for 80% target)

The problem is **not CQR** — it is that the raw quantile predictions are so poorly calibrated that fixing them requires a massive correction, which inflates width beyond usability.

### 2. Width inflation is the dealbreaker

For production, a negotiation range of ±32% (80% interval) or ±48% (90% interval) centered on the predicted price is not useful to users. The current MAPE-based negotiation range (±10–15% for high-confidence cars) is far more actionable, even if it lacks formal coverage guarantees.

### 3. Economy tier is the weakest link

Economy cars (median 285K EGP) have the worst calibrated width (100%). This is because:
- Absolute errors are smaller in EGP terms, but relative to the low price, they are large
- The same absolute `q_hat` (67K EGP) applied to a 285K car is 23.5% of price, while applied to a 5.8M car it is only 1.2% of price
- CQR with a global additive `q_hat` is inherently unfair to low-price tiers

A **multiplicative** CQR correction (scaling the interval by a percentage rather than adding a flat EGP amount) would likely be more appropriate for price data with wide absolute ranges.

### 4. The calibration/test split mismatch amplifies overcorrection

Because the calibration set was held out using GroupShuffleSplit (unseen make/model groups), it contained harder cases than the test set. The `q_hat` learned from these harder cases was then applied to the easier test set, causing over-coverage. This is a known issue in conformal prediction when the calibration and test distributions differ.

### 5. The duplicate row bug in export

During notebook review, a bug was found in the summary export logic: `pd.concat` duplicated the `test,raw_monotonic` row. This was fixed by explicitly selecting only the `calibration` row from `raw_summary_df` before concatenation with `comparison_summary_df`.

---

## Final Decision: REJECT CQR FOR PRODUCTION (FOR NOW)

### The numbers

| Metric | Raw (Monotonic) | CQR Calibrated | Judgment |
|--------|-----------------|----------------|----------|
| 80% Coverage | 71.6% | 91.1% | Over-corrected by ~11 pp |
| 90% Coverage | 85.9% | 96.3% | Over-corrected by ~6 pp |
| 80% Width | 36.3% | 64.2% | Too wide for production |
| 90% Width | 61.3% | 96.4% | Far too wide for production |
| Economy 80% Width | 45.1% | **100.1%** | Unusable |

### Why it was rejected

1. **Intervals are not actionable**: A ±32% range (80%) or ±48% range (90%) does not help users negotiate. It is too wide to be meaningful.
2. **Economy tier is destroyed**: The lowest-price segment gets intervals wider than the car's value.
3. **No clear path to fix it quickly**: Better calibration would require (a) a matched group-aware test protocol, (b) per-tier q_hat, (c) multiplicative instead of additive correction, and (d) possibly monotonicity-constrained training. These are research tasks, not quick fixes.
4. **Existing system is better for users**: The MAPE/confidence-based negotiation range (±10–15% for high confidence) is tighter and more useful, even without formal coverage guarantees.

### What was learned (value of the exercise)

Despite rejecting CQR for production, the experiment was **not wasted effort**:

1. **Validated the quantile pipeline end-to-end**: The notebook proves that 5-quantile WeightedEnsemble training, monotonicity enforcement, and interval computation work correctly.
2. **Discovered the calibration mismatch issue**: The group-aware vs. non-group-aware split mismatch was identified as a methodological flaw. Future CQR experiments must use matched protocols.
3. **Quantified raw quantile calibration quality**: We now know that raw 80% coverage is ~71.6% and raw 90% coverage is ~85.9%. This baseline is essential for any future calibration research.
4. **Built reusable infrastructure**: The CQR notebook cells (nonconformity scores, `q_hat` computation, per-tier diagnostics) can be reused in a future CQR retry.
5. **Confirmed that confidence should stay MAPE-based for now**: The decision to keep the existing negotiation/confidence system is now data-driven, not speculative.

---

## Future Considerations

### If retrying CQR later

A future CQR experiment should address the following issues:

| Issue | Fix |
|-------|-----|
| Calibration/test split mismatch | Use **group-aware split for both** calibration and test (e.g., nested group CV) |
| Global q_hat unfair to economy tier | Use **per-tier q_hat** or **multiplicative correction** (percentage of predicted price) |
| Raw quantile crossing | Train with **monotonicity constraints** or shared base learner (e.g., `cqr_nn` approach) |
| Over-correction on test | Use a **proper nested validation**: group-aware outer folds, with CQR calibrated per fold |

### Alternative interval methods to explore

If CQR remains unsuitable after a retry:
- **MAPE-based negotiation range** (current): keep as-is; it is empirically tight and useful
- **Bootstrap / jackknife intervals**: computationally expensive but distribution-free
- **Model disagreement intervals**: width based on ensemble member disagreement (XGB vs. LGBM spread)
- **Per-make-model empirical error bands**: compute historical MAPE per group and use that as the interval width

---

## Success Criteria Revisited

| Criterion from Plan 6 | Status | Notes |
|-----------------------|--------|-------|
| CQR calibration completes without errors | ✅ Done | Notebook executed end-to-end |
| `q_hat_80` and `q_hat_90` are finite and reasonable | ⚠️ Finite but **too large** | 67K and 85K EGP are large relative to economy-tier prices |
| Test-set 80% coverage between 78–84% | ❌ **Failed** | 91.1% — over-corrected |
| Test-set 90% coverage between 88–94% | ❌ **Failed** | 96.3% — over-corrected |
| Calibrated intervals narrower than naive ±MAPE% | ❌ **Failed** | 64% width >> typical ±15% MAPE range |
| `cqr_calibration.json` exported | ✅ Done | Exported with all required fields |
| API integration | ❌ **Not implemented** | Rejected before integration |

**Final status**: Plan 6 experimentation completed successfully. **CQR is rejected for production.** The existing MAPE/confidence-based negotiation range remains the production interval method. CQR may be revisited in future research with a matched calibration/test protocol and per-tier corrections.
