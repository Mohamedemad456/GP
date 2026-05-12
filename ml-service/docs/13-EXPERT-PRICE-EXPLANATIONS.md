# Expert Price Factor Explanations Plan

Implement deterministic expert-style price factor explanations first, then optionally add LLM-enhanced explanations as a second phase using the existing AI service.

## Recommendation

Use **both approaches, phased**:

- **Phase 1: Rule-based expert explanations in `ml-service`**
  - Fast, deterministic, offline, testable, and safe for Swagger/API use now.
  - Converts SHAP factors into human explanations without exposing raw EGP SHAP values.
- **Phase 2: Optional LLM enrichment through `ai-service`**
  - Uses the rule-based output plus Egyptian-market context as grounded input.
  - Produces longer natural explanations only when requested, with timeout/fallback.

This avoids making the prediction endpoint dependent on external LLM latency or API keys.

## Current State

- `ml-service/app/services/explainer.py`
  - `compute_price_factors()` builds SHAP factors.
  - Current output is fixed-template: `factor`, `direction`, `description`.
  - It exposes approximate EGP effect amounts.
- `ml-service/app/schemas/prediction.py`
  - `PriceFactor` currently has `factor`, `direction`, `description` only.
- `ml-service/app/services/predictor.py`
  - Calls `compute_price_factors()` when `include_factors=True`.
- `ai-service/app/services/llm_service.py`
  - Already has Egyptian-market grounding and provider fallback.
- `ai-service/app/prompts/chatbot_prompts.yaml`
  - Contains useful Egyptian-market style/context, but currently says it does not have exact platform pricing data.

## Phase 1 — Deterministic Expert Explanation Layer

### 1. Add a new expert module

Create `ml-service/app/services/factor_expert.py`.

Responsibilities:

- Turn raw SHAP factor rows into richer user-facing explanations.
- Avoid price numbers in descriptions.
- Keep direction from SHAP (`positive` / `negative`) as the source of truth.
- Use feature value + car context to explain *why* the factor likely raises or lowers price.

Main function shape:

```python
def explain_factor(
    *,
    factor: str,
    value,
    direction: str,
    make: str,
    model: str,
    raw_row: dict,
) -> dict:
    ...
```

Return shape:

```python
{
  "factor": "transmission",
  "direction": "positive",
  "description": "Automatic transmission is usually preferred in Egyptian city traffic, so it tends to support resale value compared with manual versions.",
  "evidence": "transmission: Automatic",
  "category": "comfort_and_resale"
}
```

### 2. Rule families to implement

#### Year

Rules:

- Newer cars usually increase value due to lower age, newer technology, and lower expected wear.
- Older cars decrease value due to depreciation, possible maintenance, and older safety/comfort features.
- Very old cars should mention inspection importance.

Example:

- `year=2023`, positive: “This is a recent model year, so buyers expect newer condition, updated features, and lower accumulated wear.”
- `year=2012`, negative: “This is an older model year, so depreciation and expected maintenance risk reduce market value.”

#### Mileage

Rules:

- Low mileage supports price.
- High mileage lowers price due to engine/suspension/transmission wear.
- Very high mileage may imply long-distance, commercial, ride-hailing, or heavy family use, but phrase carefully as “may suggest” not certainty.
- Use mileage-per-year if available for nuance.

Thresholds proposal:

- `< 30k`: very low
- `30k-80k`: normal/good
- `80k-150k`: moderate/high
- `> 150k`: high/very high

#### Mileage per year

Rules:

- Low annual mileage supports condition.
- High annual mileage suggests intensive use.
- Very high annual mileage can mention highways, long trips, ride-hailing, or fleet-like usage as possibilities.

#### Transmission

Rules:

- Automatic/CVT generally increases demand in Egypt, especially Cairo/Giza traffic.
- Manual generally reduces value for private passenger cars, but can be acceptable for cheaper economy cars or commercial-style usage.
- CVT should not be universally described as “better”; explain it as smoother/easier in traffic but inspection/maintenance matters.

#### Drivetrain

Rules:

- FWD is economical, common, cheaper to maintain; may decrease value relative to RWD/AWD/4WD in premium/SUV contexts but not necessarily bad.
- RWD can increase value in BMW/Mercedes/performance/luxury sedans.
- AWD/4WD can increase SUV/luxury/off-road appeal, but mention higher maintenance/fuel costs.

#### Horsepower

Rules:

- Higher horsepower generally increases value for premium/sport/SUV cars.
- Lower horsepower may decrease value for larger cars or premium brands.
- For economy cars, modest horsepower can be acceptable because buyers value fuel economy.

#### Engine CC

Rules:

- Larger engines may increase performance/luxury appeal but raise fuel/licensing/maintenance cost.
- Smaller engines support economy but may reduce premium appeal.

#### Fuel

Rules:

- Petrol is standard and easy to maintain.
- Hybrid can increase value due to fuel economy if supported.
- Diesel/gas should be contextual and cautious based on actual dataset categories.

#### Body type / segment

Rules:

- SUV/luxury SUV/family segments often support price due to demand.
- City/economy segments can lower absolute price but may support affordability and running costs.
- Sedan/hatchback explanations should reference Egyptian demand and use case.

#### Brand origin

Rules:

- Japanese/Korean: usually strong resale, reliability, spare parts.
- German/European: premium image/performance but higher maintenance.
- Chinese: increasingly mainstream in Egypt, often good value/features, but resale confidence varies by model and parts network.
- American: model-dependent; some Chevrolet models are common with parts availability, but demand varies.

#### Make/model context

Use lightweight dictionaries for known market notes:

- Toyota/Hyundai/Kia/Nissan: resale and parts availability.
- BMW/Mercedes/Audi: premium, maintenance-sensitive.
- Chevrolet: common models/parts may help, but some models are fleet/commercial-associated.
- BAIC/BYD/Chery/MG/Geely: modern Chinese brands, value/features, resale varies by model.

Keep this context separate from SHAP direction: if SHAP says negative, explanation should respect it.

### 3. Update `explainer.py`

Keep SHAP ranking logic as-is.

Change only final description generation:

- Remove raw EGP SHAP amounts from default descriptions.
- Call `factor_expert.explain_factor(...)` for each selected factor.
- Preserve API fields `factor`, `direction`, `description` for compatibility.
- Optionally add non-breaking fields later: `evidence`, `category`.

### 4. Schema decision

For maximum API stability:

- Phase 1 can keep `PriceFactor` unchanged:
  - `factor`
  - `direction`
  - `description`

Optional future extension:

```python
class PriceFactor(BaseModel):
    factor: str
    direction: str
    description: str
    evidence: str | None = None
    category: str | None = None
```

This is backward compatible for JSON clients.

### 5. Tests

Add or update tests for:

- No EGP amounts in descriptions.
- Mileage high vs low explanations.
- Automatic/CVT/manual explanations.
- FWD/RWD/AWD/4WD explanations.
- Brand origin explanations.
- SHAP direction is preserved.
- Unknown factor falls back to a generic safe explanation.

## Phase 2 — Optional LLM Enrichment

### 1. Add explicit request mode

Extend request schema in a backward-compatible way:

```python
explanation_mode: Optional[str] = "expert"
```

Allowed values:

- `none`: do not compute factors
- `expert`: deterministic rule-based explanations
- `llm`: LLM-enriched explanations with expert fallback

Or keep `include_factors=True` and add:

```python
factor_explanation_style: Optional[str] = "expert"
```

### 2. Avoid blocking prediction endpoint by default

Do not call LLM during normal prediction unless explicitly requested.

Reasons:

- Prediction endpoint is sync and CPU-bound.
- LLM adds latency, network failures, and API-key dependency.
- Swagger tests and production pricing should remain reliable.

### 3. Add AI-service endpoint for price explanation

In `ai-service`, add a dedicated endpoint such as:

`POST /explain-price-factors`

Request:

```json
{
  "car": {"make": "BAIC", "model": "U5 Plus", "year": 2023, "mileage_km": 15000},
  "prediction": {"fair_price": 680000, "confidence": "high", "negotiation_range": {...}},
  "factors": [
    {"factor": "year", "direction": "positive", "description": "..."}
  ],
  "market_context": {...},
  "language": "en"
}
```

Response:

```json
{
  "summary": "Short paragraph explaining why the price is strong/weak.",
  "factors": [
    {"factor": "year", "explanation": "..."}
  ],
  "buyer_advice": ["Check service history", "Inspect suspension"]
}
```

### 4. Prompt strategy

LLM must be grounded with:

- Deterministic expert explanations.
- SHAP factor names and directions.
- Car specs from `feature_builder` output.
- Confidence and MAPE tier, but not raw hidden quantiles.
- Egyptian-market notes from `chatbot_prompts.yaml` / `CarSpecsLookup`.

Prompt rules:

- Do not invent factors not present in SHAP top factors.
- Do not contradict `direction`.
- Do not mention exact SHAP EGP contribution values.
- Keep explanation concise.
- Mention uncertainty when confidence is low.
- For Arabic, use Egyptian dialect and keep car terms in English.

### 5. LLM fallback behavior

If LLM fails or times out:

- Return deterministic `expert` explanations.
- Log warning.
- Do not fail prediction.

### 6. Caching

Optional later:

- Cache LLM explanations by hash of request car + top factors + confidence.
- TTL: 1 day or model-version based.

## Proposed Implementation Order

1. Implement `factor_expert.py` rule engine.
2. Wire `explainer.compute_price_factors()` to use expert descriptions.
3. Keep API response stable initially.
4. Add tests for deterministic explanations.
5. Update docs and Swagger examples.
6. Later: add optional `explanation_mode` and AI-service endpoint.
7. Later: add LLM prompt templates and fallback/caching.

## Example Target Output

Current:

```json
{
  "factor": "drivetrain",
  "direction": "negative",
  "description": "drivetrain: FWD. In the model, this decreases the estimated price by about EGP 126,626."
}
```

Phase 1 target:

```json
{
  "factor": "drivetrain",
  "direction": "negative",
  "description": "Drivetrain is FWD. It is economical and common, but for this car the model treats it as less price-supportive than RWD/AWD/4WD alternatives, so it lowers the estimated market value."
}
```

LLM target later:

```json
{
  "factor": "drivetrain",
  "direction": "negative",
  "description": "This car is FWD, which is practical and economical for daily use in Egypt. However, compared with premium or SUV-style drivetrains like RWD/AWD/4WD, buyers may value it less in this segment, so it pulls the estimated price down."
}
```

## Acceptance Criteria

- `include_factors=True` returns richer human explanations.
- Descriptions do not expose raw EGP SHAP contribution numbers.
- Existing fields remain compatible.
- Prediction endpoint still works without AI-service.
- Batch prediction remains best-effort.
- Tests pass.
- LLM phase is optional and fails open to deterministic expert explanations.

## Risks and Mitigations

- **Over-explaining false causality**: Use phrases like “the model treats this as...” and “usually in the Egyptian market...”.
- **Contradicting SHAP direction**: Direction remains source of truth; rules adapt wording to positive/negative.
- **LLM hallucination**: Only feed top factors and instruct not to invent new causes.
- **Latency**: Keep deterministic mode as default; LLM only on explicit request.
- **API breaking changes**: Keep current `PriceFactor` fields first; add optional fields only if needed.
