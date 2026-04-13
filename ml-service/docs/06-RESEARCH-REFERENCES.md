# Used Car Price Prediction — Research Summary & Project Guidance

> Prepared for: Dynamic Pricing Engine GP Project (Egyptian Used Car Market)
> Scope: ~27K listings, LightGBM quantile models, FastAPI serving

---

## Part 1: Research Paper Summaries

---

### Paper 1 — Granular Vehicle Equipment Information (ScienceDirect, 2024)
**Full title:** "Machine learning for predicting used car resale prices using granular vehicle equipment information"

#### What they did
- Dataset: 92,239 real sales records
- Added granular equipment options (alloy rims, park assist, sunroof, etc.) — 50,000 equipment variations
- Compared models with and without equipment features
- Used gradient boosting as primary model

#### Key finding
Including equipment/specs information improved MAE by **3.27% at statistically significant level**. Small gain but consistent.

#### Pros
- Directly validates your lookup table approach for engine_cc, horsepower, body_type
- Real transaction data (not asking prices) — more reliable than most papers
- Large dataset (92K rows) gives credible results

#### Cons
- European market — equipment options matter more there (full options lists exist per VIN)
- You don't have VIN-level equipment data, only make/model/year
- 3.27% improvement is real but modest — don't over-invest in equipment features

#### Relevance to your project: HIGH
Your car_specs_lookup.csv (engine_cc, horsepower, body_type, new_car_price_egp) is exactly what this paper validates. The new_car_price_egp is your most powerful enrichment feature — this paper confirms that. Wakeel vs non-wakeel distinction would be the Egyptian equivalent of their equipment flag.

---

### Paper 2 — Advanced Feature Engineering for Heterogeneous Pre-Owned Cars (MDPI, 2025)
**Full title:** "Advanced Feature Engineering and Machine Learning Techniques for High Accurate Price Prediction of Heterogeneous Pre-Own Cars"

#### What they did
- Compared baseline (minimal preprocessing) vs full feature engineering pipeline
- Tested: Stacking Regressor, CatBoost, XGBoost, Random Forest
- Derived features: car age from year, mileage normalization, horsepower extraction, categorical encoding

#### Key finding
Stacking Regressor R² went from **0.14 (baseline) → 0.89 (after feature engineering)**. The algorithm barely mattered — feature engineering was the difference.

Also confirmed: mileage and age have strong negative correlations (−0.70 and −0.60) with price. Horsepower has strong positive correlation.

#### Pros
- Closest pipeline to yours in structure
- Proves feature engineering >>> algorithm selection
- Reproducible methodology described clearly

#### Cons
- Dataset not Egyptian — market dynamics differ
- "Stacking Regressor best" conclusion may not generalize — they didn't tune individual models well first
- No quantile regression — only point estimates

#### Relevance to your project: VERY HIGH
This is basically your pipeline described in a paper. Validates: car_age derived feature, mileage_per_year, horsepower from lookup. The key lesson: invest more time in feature engineering than in algorithm tuning.

---

### Paper 3 — XGBoost + LightGBM Iterative Framework (MDPI Electronics, 2022)
**Full title:** "Used Car Price Prediction Based on the Iterative Framework of XGBoost+LightGBM"

#### What they did
- Trained deep residual network (ResNet) first, fused predictions as new features
- Fed fused features into iterative XGBoost+LightGBM framework
- Compared against standalone Random Forest and ResNet

#### Key finding
Combining XGBoost + LightGBM in iterative framework outperforms both individually and outperforms deep learning on this task.

#### Pros
- Shows the ceiling you can reach with ensemble of GBMs
- Confirms tree-based models beat neural networks on tabular car pricing data

#### Cons
- Significant complexity for marginal gain over single well-tuned LightGBM
- Chinese market dataset — different dynamics
- Overkill for a GP project scope

#### Relevance to your project: LOW (for now)
Use this as Phase 2 if your single LightGBM underperforms. For GP defense, single well-tuned LightGBM with SHAP is cleaner and more defensible than a complex ensemble you can't fully explain.

---

### Paper 4 — Revolutionizing Used Car Market with XGBoost (2024)
**Full title:** "Revolutionizing the used car market: Predicting prices with XGBoost"

#### What they did
- Compared XGBoost vs traditional regression models (linear, ridge, lasso)
- Focused on heterogeneous feature handling
- Achieved best R² among compared models

#### Key finding
XGBoost outperforms linear models significantly. Gradient boosting handles heterogeneous data (mix of categorical + numerical) better than linear approaches.

#### Pros
- Clear comparison baseline
- Confirms that simple linear regression is a weak baseline (not a ceiling)

#### Cons
- Small dataset in some experiments — conclusions less reliable
- XGBoost vs LightGBM not directly compared here
- Hyperparameter sensitivity noted as a disadvantage

#### Relevance to your project: MEDIUM
Use linear regression as your baseline. If your LightGBM doesn't beat it by 30%+ MAPE, something is wrong with your features.

---

### Paper 5 — LightGBM for Used Car Price Prediction (IEEE, 2022)
**Full title:** "Prediction of Used Car Price Based on LightGBM"

#### What they did
- Applied LightGBM on actual transaction records from a Chinese used car platform
- Grid search for hyperparameter tuning
- Feature importance analysis to filter features before training

#### Key finding
LightGBM with tuned hyperparameters achieves strong performance on used car pricing. Feature filtering (removing low-importance features) improved generalization.

#### Pros
- Uses actual transaction prices (not asking prices) — your data is asking prices, note this difference
- Direct validation of LightGBM for this exact problem
- Feature importance used for selection, not just explanation

#### Cons
- Grid search is slower than Optuna — your design (Optuna) is better
- Chinese market, different feature importance ranking expected
- No uncertainty quantification — no quantile models

#### Relevance to your project: HIGH
Validates your algorithm choice. Key takeaway: run feature importance after first training, consider dropping features that contribute near-zero SHAP values.

---

### Paper 6 — Price Prediction and Classification of Used Vehicles (MDPI Sustainability, 2022)
**Full title:** "Price Prediction and Classification of Used-Vehicles Using Supervised Machine Learning"

#### What they did
- Dual approach: regression (price prediction) + classification (price bucket)
- Compared Random Forest, Gradient Boosting, SVM, KNN
- European market dataset

#### Key finding
Gradient Boosting consistently outperforms SVM and KNN. Random Forest competitive but slightly weaker than gradient boosting. SVM performed worst on large categorical feature sets.

#### Pros
- Directly kills the SVM debate — do not use SVM for your problem
- Classification framing (cheap/medium/luxury) could be a useful additional output for your UI

#### Cons
- No quantile regression
- SVM baseline confirms what we already know

#### Relevance to your project: MEDIUM
Buries the SVM option definitively. The price tier classification idea (cheap/medium/luxury) might be worth adding to your API response as a non-ML rule (price < 300K = budget, 300K-800K = mid, > 800K = premium) for UI friendliness.

---

### Paper 7 — Forecasting Resale Value (ScienceDirect, 2022)
**Full title:** "Forecasting resale value of the car: Evaluating the proficiency under the impact of machine learning model"

#### What they did
- Ensemble model (XGBoost) compared against LR, Lasso, Ridge, RF, KNN, CART
- Key features: model, year, distance driven, fuel type, seller type, transmission
- 10-fold cross validation

#### Key finding
XGBoost outperforms all others. Key price drivers: **year of manufacture, distance driven, fuel type, transmission** — exactly your Tier 1 features.

#### Pros
- Cross-validation methodology is rigorous (10-fold)
- Feature importance confirmed matches your design

#### Cons
- Indian market — price ranges and brand preferences differ
- No location or regional features tested

#### Relevance to your project: HIGH
Validates your Tier 1 features. The 10-fold CV approach on the median model is worth adopting for your GP defense metric.

---

### Paper 8 — Predicting Passenger Car Prices (Preprints, 2024)
**Full title:** "Predicting Passenger Car Prices with Machine Learning Models"

#### What they did
- Central Asian market (Kyrgyzstan) — similar developing market dynamics to Egypt
- Compared: Random Forest, CatBoost, SVM
- Added features from listing descriptions: color, conditioner, body type
- CatBoost best performer at 86.05% accuracy

#### Key finding
CatBoost strongest when you have many high-cardinality categoricals AND limited data. But they didn't test LightGBM.

#### Pros
- Developing market dataset — most comparable to Egypt in terms of data quality challenges
- Extracting features from description text is validated (similar to your title parsing approach)
- Color and AC features added modest improvement

#### Cons
- No LightGBM comparison — likely would have been competitive
- 86% "accuracy" uses bucketed price ranges, not MAPE — hard to compare directly
- Small dataset

#### Relevance to your project: MEDIUM
Interesting because it's a developing market. Validates that text extraction from listing titles (your Claude-based parsing) is a real technique used in research. Color could be worth extracting from titles if you see it frequently.

---

*Research papers referenced: ScienceDirect 2024, MDPI 2025, MDPI Electronics 2022, ACM 2024, IEEE 2022, MDPI Sustainability 2022, ScienceDirect 2022, Preprints 2024*