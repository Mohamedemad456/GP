# Chapter 4 — Model Evaluation & Diagnostics Tables

> Comprehensive evaluation tables extracted from `model_registry.json`, `training_history.json`, and `per_make_model_cv_2026-06-12_012.csv` (v2.1.5 active model).
> These tables cover model evolution, metric comparisons, make-model diagnostics, price-tier analysis, and promotion gate history.

---

## Table 1: Model Evolution — Registry Overview

All registered models from baseline to current production (v2.1.5).

| Model ID | Framework | Version | Stage | MAPE % | MAE | RMSE | R2 | W10% | W15% |
|----------|-----------|---------|-------|--------|-----|------|----|------|------|
| huber_baseline_v1.0.0 | sklearn | v1.0.0 | archived | 14.62 | 159,668 | 522,562 | 0.864 | 54.59 | 70.25 |
| xgboost_quantile_v1.1.0 | XGBoost | v1.1.0 | archived | 13.53 | 138,277 | 463,949 | 0.893 | 59.66 | 74.50 |
| ensemble_robust_average_v1.1.0 | ensemble | v1.1.0 | archived | 12.78 | 133,593 | 473,138 | 0.888 | 61.27 | 76.58 |
| v2_2026-06-03_008 | ensemble | v2.1.0 | archived | 11.33 | 150,594 | 605,559 | 0.888 | 61.24 | 76.76 |
| v2_2026-06-11_008 | ensemble | v2.1.1 | archived | 11.33 | 150,594 | 605,559 | 0.888 | 61.24 | 76.76 |
| v2_2026-06-11_010 | ensemble | v2.1.2 | archived | 11.82 | 145,600 | 409,831 | 0.945 | 61.19 | 76.44 |
| v2_2026-06-11_007 | ensemble | v2.1.3 | archived | **10.55** | 156,429 | 435,806 | **0.947** | **62.95** | **79.82** |
| v2_2026-06-11_011 | ensemble | v2.1.4 | archived | 13.85 | **145,876** | **413,098** | 0.940 | 60.59 | 76.29 |
| **v2_2026-06-12_012** | **ensemble** | **v2.1.5** | **production** | **11.13** | 146,008 | 478,289 | 0.928 | 61.92 | 77.73 |

**Notes:**
- **MAPE** = Mean Absolute Percentage Error (holdout test set).
- **W10% / W15%** = percentage of predictions within 10% / 15% of actual price.
- v2.1.3 achieved the best MAPE (10.55%) and highest R2 (0.947) but was archived.
- v2.1.4 was promoted on 2026-06-11 with higher MAPE but lowest MAE and RMSE.
- **v2.1.5 (active)** was promoted on 2026-06-12 with the best MAPE since v2.1.3 (11.13%) and competitive MAE/RMSE on a larger dataset (13,785 rows).

---

## Table 2: Quantile Coverage & Interval Width Comparison

Only quantile and ensemble models report coverage metrics.

| Model ID | Cov-80% | Cov-90% | Mean Width % | Notes |
|----------|---------|---------|--------------|-------|
| xgboost_quantile_v1.1.0 | 87.71 | — | 86.45 | Wide intervals (XGB only) |
| ensemble_robust_average_v1.1.0 | 86.79 | — | 77.27 | Ensemble narrowed width |
| v2_2026-06-03_008 (v2.1.0) | 72.44 | 86.12 | 35.17 | V2 dataset dramatically reduced width |
| v2_2026-06-11_008 (v2.1.1) | 72.44 | 86.12 | 35.17 | Same as v2.1.0 |
| v2_2026-06-11_010 (v2.1.2) | 72.73 | 85.86 | **34.53** | Narrowest intervals |
| v2_2026-06-11_007 (v2.1.3) | **73.38** | **87.74** | 33.92 | Best coverage + narrow width |
| v2_2026-06-11_011 (v2.1.4) | 71.15 | 85.78 | 35.15 | Slightly wider than v2.1.3 |
| **v2_2026-06-12_012 (v2.1.5)** | **72.94** | **86.22** | **34.37** | Best coverage since v2.1.3, narrowest width since v2.1.2 |

**Key insight:** V2 models (trained on 2026-06-03_008 dataset) reduced mean interval width from ~77% to ~35% while maintaining ~86% coverage, a major calibration improvement. v2.1.5 improves further on a fresh 2026-06-12 dataset.

---

## Table 3: Holdout vs Cross-Validation Metrics

Cross-validation uses 5-fold OOF predictions on the full training set.

| Model ID | Holdout MAPE | CV MAPE | Holdout R2 | CV R2 | Holdout W15% | CV W15% |
|----------|-------------|---------|-----------|-------|-------------|---------|
| v2_2026-06-03_008 | 11.33 | 11.77 | 0.888 | 0.924 | 76.76 | 77.21 |
| v2_2026-06-11_008 | 11.33 | 11.77 | 0.888 | 0.924 | 76.76 | 77.21 |
| v2_2026-06-11_010 | 11.82 | 12.12 | **0.945** | **0.925** | 76.44 | 77.21 |
| v2_2026-06-11_007 | **10.55** | 11.73 | **0.947** | 0.919 | **79.82** | 77.91 |
| v2_2026-06-11_011 | 13.85 | 12.00 | 0.940 | **0.926** | 76.29 | **77.85** |
| **v2_2026-06-12_012** | **11.13** | **11.86** | 0.928 | 0.933 | **77.73** | 77.57 |

**Observation:** CV metrics are generally stable within ~1.3 MAPE points of holdout. v2.1.5 shows excellent consistency (holdout 11.13 vs CV 11.86, gap only 0.73 points), indicating a well-balanced train/test split.

---

## Table 4: Promotion Gate History

Extracted from `training_history.json`.

| Timestamp | Model ID | Version | Gate Outcome | Gate Passed | Holdout MAPE | CV MAPE | Elapsed (sec) | Promoted |
|-----------|----------|---------|-------------|-------------|-------------|---------|---------------|----------|
| 2026-06-09 08:53 | v2_2026-06-03_008 | v2.1.0 | promote | Yes | 11.33 | 11.77 | 3.3 | No |
| 2026-06-11 00:46 | v2_2026-06-11_008 | v2.1.1 | promote | Yes | 11.33 | 11.77 | 757.0 | **Yes** |
| 2026-06-11 00:59 | v2_2026-06-11_010 | v2.1.2 | promote | Yes | 11.82 | 12.12 | 760.5 | **Yes** |
| 2026-06-11 01:41 | v2_2026-06-11_007 | v2.1.3 | promote | Yes | **10.55** | 11.73 | 2289.8 | **Yes** |
| 2026-06-11 02:06 | v2_2026-06-11_011 | v2.1.4 | promote | Yes | 13.85 | 12.00 | 614.9 | **Yes** |
| **2026-06-12 10:58** | **v2_2026-06-12_012** | **v2.1.5** | **promote** | **Yes** | **11.13** | **11.86** | **1150.7** | **Yes** |

**Notes:**
- v2.1.0 ran in 3.3 seconds (likely cached or abbreviated run).
- v2.1.3 took the longest (2,290 sec) but produced the best MAPE.
- v2.1.5 trained on the largest dataset yet (13,785 rows) in 1,151 sec.
- All v2 models passed the threshold-only promotion gate.

---

## Table 5: Make-Model Diagnostics — Threshold Summary (Holdout)

Per-make-model MAPE distribution on holdout test set. Sourced from `diagnostics_summary` in registry.

| Metric | v2.1.0 | v2.1.1 | v2.1.2 | v2.1.3 | v2.1.4 | v2.1.5 (Active) |
|--------|--------|--------|--------|--------|--------|-----------------|
| Total make-model combos | 393 | 393 | 410 | 362 | 422 | **414** |
| Supported combos (n>=5) | 76 | 76 | 88 | 56 | 82 | **86** |
| % under 15% MAPE | 70.99 | 70.99 | 71.46 | **79.56** | 70.38 | 71.74 |
| % over 15% MAPE | 29.01 | 29.01 | 28.54 | 20.44 | 29.62 | 28.26 |
| Supported % over 15% | 15.79 | 15.79 | 14.77 | **5.36** | 14.63 | **8.14** |
| % under 20% MAPE | 82.95 | 82.95 | 84.88 | **86.74** | 81.52 | **85.27** |
| % under 30% MAPE | 93.89 | 93.89 | 92.68 | **93.65** | 95.02 | 93.48 |
| % under 50% MAPE | 98.73 | 98.73 | 98.29 | **99.17** | 98.58 | 98.55 |

**Key finding:** v2.1.3 still holds the strictest make-model quality (79.6% under 15% MAPE). v2.1.5 (active) achieves competitive threshold performance (71.7% under 15% MAPE, 8.1% supported over 15%) with a strong 85.3% under 20% MAPE. The supported mean MAPE is 9.88%.

---

## Table 6: Make-Model Diagnostics — Threshold Summary (CV)

Cross-validation per-make-model diagnostics.

| Metric | v2.1.0 | v2.1.1 | v2.1.2 | v2.1.3 | v2.1.4 | v2.1.5 (Active) |
|--------|--------|--------|--------|--------|--------|-----------------|
| Total make-model combos | 441 | 441 | 453 | 400 | 451 | **453** |
| Supported combos (n>=5) | 289 | 289 | 302 | 251 | 301 | **305** |
| % under 15% MAPE | 65.53 | 65.53 | **67.77** | **75.25** | 70.95 | 69.98 |
| % over 15% MAPE | 34.47 | 34.47 | 32.23 | 24.75 | 29.05 | 30.02 |
| Supported % over 15% | 24.57 | 24.57 | 22.52 | **15.54** | 20.93 | **21.97** |
| % under 20% MAPE | 82.09 | 82.09 | 82.34 | **87.00** | 84.48 | 83.44 |
| % under 30% MAPE | 95.01 | 95.01 | 92.94 | **96.50** | 93.57 | **95.81** |
| % under 50% MAPE | 98.87 | 98.87 | 98.23 | **98.75** | 98.45 | 98.68 |

---

## Table 7: Top 15 Best-Performing Make-Model Combinations (CV MAPE)

From `per_make_model_cv_2026-06-12_012.csv` (v2.1.5 active model, n >= 5, sorted by MAPE ascending).

| Rank | Make | Model | Support (n) | CV MAPE % | Mean Price (EGP) | Tier |
|------|------|-------|-------------|-----------|------------------|------|
| 1 | Jetour | X90 | 10 | **2.59** | 1,517,000 | Luxury |
| 2 | Geely | GX3 Pro | 13 | **2.71** | 786,154 | Mid |
| 3 | Jetour | X95 | 9 | **2.80** | 1,253,333 | Premium |
| 4 | BAIC | BJ30 | 14 | **2.81** | 1,667,493 | Luxury |
| 5 | Soueast | S05 | 10 | **3.43** | 1,067,500 | Premium |
| 6 | Volkswagen | ID6 | 5 | **3.71** | 1,680,000 | Luxury |
| 7 | Cupra | Formentor | 28 | **3.86** | 2,087,822 | Luxury |
| 8 | Renault | Captur | 14 | **4.30** | 563,929 | Mid |
| 9 | Jetour | T2 | 35 | **4.34** | 1,904,429 | Luxury |
| 10 | Mercedes | A180 | 7 | **4.36** | 1,879,286 | Luxury |
| 11 | Jetour | Dashing | 11 | **4.38** | 1,394,091 | Premium |
| 12 | Kia | Xceed | 25 | **4.45** | 1,278,600 | Premium |
| 13 | Renault | Taliant | 16 | **4.84** | 782,813 | Mid |
| 14 | Hyundai | I30 | 13 | **4.92** | 914,231 | Premium |
| 15 | BMW | X4 | 19 | **4.94** | 3,232,895 | Luxury |

---

## Table 8: Top 15 Worst-Performing Make-Model Combinations (CV MAPE)

From `per_make_model_cv_2026-06-12_012.csv` (v2.1.5 active model, sorted by MAPE descending).

| Rank | Make | Model | Support (n) | CV MAPE % | Mean Price (EGP) | Notes |
|------|------|-------|-------------|-----------|------------------|-------|
| 1 | Audi | A5 | 23 | **315.69** | 2,877,174 | Extreme outlier, price segmentation issue |
| 2 | Daewoo | Espero | 5 | **84.51** | 510,000 | Discontinued, rare |
| 3 | Volvo | XC90 | 8 | **76.18** | 2,943,750 | Luxury SUV, high variance |
| 4 | Lada | 2017 | 11 | **64.26** | 117,364 | Very low price point |
| 5 | Peugeot | 305 | 5 | **52.23** | 77,000 | Extremely low price, vintage |
| 6 | Mercedes | S580 | 5 | **51.07** | 8,760,000 | Ultra-luxury, sparse data |
| 7 | Changan | Benni | 8 | **48.00** | 190,625 | Low support |
| 8 | Dodge | Charger | 6 | **47.02** | 4,596,667 | High-price muscle car |
| 9 | Mercedes | B150 | 6 | **44.57** | 494,833 | Low support import |
| 10 | Zotye | Xplosion | 7 | **44.40** | 230,000 | Niche brand |
| 11 | BYD | Leopard 5 | 5 | **42.53** | 2,918,000 | New model, sparse comps |
| 12 | Land Rover | Range Rover | 18 | **41.17** | 4,310,556 | High variance luxury SUV |
| 13 | Peugeot | 504 | 9 | **38.89** | 129,444 | Vintage model |
| 14 | Tesla | Cybertruck | 8 | **37.10** | 7,510,000 | New/unique, no local comps |
| 15 | Volkswagen | Parati | 12 | **35.98** | 221,250 | Niche import |

---

## Table 9: Price Tier vs MAPE Comparison

Make-model combos grouped by mean price tier (v2.1.5 CV). Tiers: **Budget** < 400k, **Mid** 400k-800k, **Premium** 800k-1.5M, **Luxury** > 1.5M.

| Tier | Count | Mean MAPE % | Median MAPE % | Min MAPE % | Max MAPE % | Examples (best) |
|------|-------|-------------|---------------|------------|------------|-----------------|
| Budget (< 400k EGP) | 105 | 17.65 | 14.54 | 5.04 | 64.26 | Peugeot 407 (5.04%) |
| Mid (400k - 800k) | 100 | 12.49 | 9.79 | 2.71 | 84.51 | Geely GX3 Pro (2.71%) |
| Premium (800k - 1.5M) | 106 | 10.41 | 9.44 | 2.80 | 27.07 | Jetour X95 (2.80%) |
| Luxury (> 1.5M EGP) | 142 | 16.45 | 10.91 | 2.59 | 315.69 | Jetour X90 (2.59%) |

**Key insight:**
- **Premium tier (800k-1.5M)** shows the best and most consistent MAPE (mean 10.41%, median 9.44%) because it has the highest listing density and stable depreciation curves.
- **Mid tier** also performs well (median 9.79%) with the best single model (Geely GX3 Pro at 2.71%).
- **Budget tier** has the widest spread (mean 17.65%) driven by vintage cars with sparse data.
- **Luxury tier** has the most combos (142) but highest variance due to outliers like Audi A5 (315.69%) and Mercedes S580 (51.07%).

---

## Table 10: Support Count vs MAPE Relationship

Grouped by training sample size per make-model (v2.1.5 CV).

| Support Range | Count | Mean MAPE % | Median MAPE % | Interpretation |
|---------------|-------|-------------|---------------|----------------|
| n < 10 | 148 | 17.69 | 14.41 | Low confidence: insufficient training data |
| 10 <= n < 30 | 174 | 14.31 | 10.59 | Moderate: acceptable for common segments |
| 30 <= n < 60 | 67 | 11.80 | 10.61 | Good: enough data for stable estimates |
| 60 <= n < 100 | 37 | 10.14 | 9.27 | Strong: reliable per-make-model MAPE |
| n >= 100 | 27 | 9.90 | 9.60 | Excellent: highly reliable predictions |

**Correlation:** Clear inverse relationship between support count and MAPE. Models with n >= 100 average 9.9% MAPE, while n < 10 average 17.7% MAPE. This validates the confidence label degradation logic for low-support predictions.

---

## Table 11: Version-to-Version Metric Delta

Changes between consecutive promoted versions.

| Transition | Delta MAPE | Delta R2 | Delta W15% | Delta Mean Width % | Interpretation |
|------------|-----------|----------|-----------|-------------------|----------------|
| v1.0.0 -> v1.1.0 (XGB) | **-1.09** | +0.029 | +4.25 | +87.71* | First quantile model |
| v1.1.0 -> v1.1.0 (Ensemble) | **-0.76** | -0.005 | +2.08 | -9.19 | Ensemble narrows width |
| v1.1.0 -> v2.1.0 | **-1.44** | +0.000 | +0.18 | **-42.10** | V2 data + features |
| v2.1.0 -> v2.1.1 | 0.00 | 0.000 | 0.00 | 0.00 | Same metrics, new run |
| v2.1.1 -> v2.1.2 | +0.49 | **+0.057** | -0.32 | -0.64 | Better R2, slightly worse MAPE |
| v2.1.2 -> v2.1.3 | **-1.27** | **+0.002** | **+3.38** | **-0.61** | Best MAPE + coverage model |
| v2.1.3 -> v2.1.4 | +3.30 | -0.007 | -3.53 | +1.23 | Higher MAPE but lowest MAE/RMSE |
| **v2.1.4 -> v2.1.5** | **-2.72** | -0.012 | **+1.44** | **-0.78** | **Major MAPE improvement on fresh data** |

*XGB v1.1.0 introduced coverage metrics for the first time.

---

## Table 12: All Metrics Glossary

Every metric used across evaluation, registry, and diagnostics.

| Metric | Full Name | Unit | Used In | Description |
|--------|-----------|------|---------|-------------|
| MAPE | Mean Absolute Percentage Error | % | Holdout, CV, per-MM | Average percentage error; primary ranking metric |
| MAE | Mean Absolute Error | EGP | Holdout, CV | Average absolute error in Egyptian Pounds |
| RMSE | Root Mean Squared Error | EGP | Holdout, CV | Punishes large outliers more than MAE |
| R2 | Coefficient of Determination | 0-1 | Holdout, CV | Variance explained by model |
| W10% | Within 10% | % | Holdout, CV | % predictions within +/- 10% of true price |
| W15% | Within 15% | % | Holdout, CV | % predictions within +/- 15% of true price |
| Cov-80% | 80% Coverage | % | Holdout | % of true prices inside 80% prediction interval |
| Cov-90% | 90% Coverage | % | Holdout | % of true prices inside 90% prediction interval |
| Mean Width % | Mean Interval Width | % | Holdout | Average interval width as % of predicted price |
| cv_ prefix | Cross-Validation | varies | Registry | Same metric computed via 5-fold OOF |
| holdout_per_mm | Holdout per make-model | count | Diagnostics | Number of make-model combos evaluated |
| supported | Supported combos | count | Diagnostics | Combos with n >= 5 (or threshold) |
| pct_under_X | % Under Threshold | % | Diagnostics | % of combos with MAPE below threshold |

---

> **Where to place these tables:**
> - **Chapter 4 (Implementation):** Tables 1-4 can supplement Section 4.2.3 (Retrain) and 4.1.1 (Model Architecture).
> - **Chapter 5 (Testing & Evaluation):** Tables 5-10 are the core evidence for model evaluation. Place in a dedicated evaluation subsection.
> - **Chapter 6 (Results):** Tables 1, 2, 5, 9, 10 should be prominently featured as results evidence.
> - **Appendix:** Full per-make-model CSV (453 rows for v2.1.5) can be attached as an appendix table.
