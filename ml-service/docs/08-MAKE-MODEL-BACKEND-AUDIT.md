# make_model_backend.json — Data Quality Audit

- Source: `ml-service/data/lookups/make_model_backend.json`
- Generated: 2026-05-07
- Total rows: **540**
- Unique exact `(make, model)` pairs: **540**

## Executive summary

- **No exact duplicate `(make, model)` pairs were found.**
  - The file does not contain repeated rows like `BMW / 320i` appearing twice with the exact same casing and spacing.
  - If the backend reports duplicate make+model combinations, the most likely causes are:
    - The backend normalizes text before inserting, for example lowercasing and removing spaces/punctuation.
    - The backend has a uniqueness rule on `model` alone instead of `(make_id, normalized_model_name)`.
    - The backend seed process is inserting into an already-populated database without upsert/idempotency.

- **There are real data quality issues.**
  - Some rows become duplicates after normalization, such as `Honda / CRV` and `Honda / Cr V`.
  - Some model names appear under multiple makes. This is not always wrong, but it can break a backend schema that treats model names as globally unique.
  - Several rows are likely wrong make/model assignments, for example `Toyota / Cruze`, `Volkswagen / Tiggo`, and `Fiat / Jetta`.
  - The file mixes model families, generations, trims, aliases, and generic labels.

- **Important backend schema warning:**
  - Car model names should **not** be globally unique.
  - A better backend constraint is: `UNIQUE(make_id, normalized_model_name)`.
  - Model names like `X7`, `500`, `A5`, `Leon`, and `Torres` can legitimately exist under different makes.

## A) Exact duplicate `(make, model)` pairs

- **None found** using case-sensitive exact matching.

This means the backend complaint is probably not caused by exact duplicate JSON rows.

## B) Backend-normalized duplicate pairs within the same make

These are the highest-priority blocker issues if the backend normalizes model names before inserting.

### Honda

- Collides as `crv`: `CRV`, `Cr V`
- Suggested canonical value: choose one style, preferably `CR-V` if punctuation is allowed, otherwise `CRV`.

### MG

- Collides as `rx5`: `RX5`, `Rx5`
- Suggested canonical value: `RX5`.

## C) Same model string used under multiple makes

If the backend enforces a globally unique `model` name, every item here can cause insert conflicts. This does **not** mean every item is wrong.

- **X7** → BAIC, BMW, Geely, Kaiyi
- **A1** → Hyundai, Mercedes, Senova
- **Benni** → Chana, Changan, Mini
- **Rio** → Daihatsu, Kia, Suzuki
- **Tiggo** → Chery, Speranza, Volkswagen
- **350** → MG, Mercedes
- **500** → Fiat, Mercedes
- **A11** → Chery, Speranza
- **A5** → Audi, Chery
- **Cruze** → Chevrolet, Toyota
- **Echo** → Ford, Toyota
- **Envy** → Chery, Speranza
- **Jetta** → Fiat, Volkswagen
- **Lanos** → Chevrolet, Daewoo
- **Leon** → Cupra, Seat
- **Polo** → Fiat, Volkswagen
- **Pride** → Kia, Saipa
- **Torres** → KGM, SsangYong
- **X3** → BMW, Hyundai
- **X5** → BMW, MG

## D) Cross-make collisions that are probably valid or explainable

Do not automatically delete these. They may be legitimate automotive cases, rebadges, old-market naming, or rebrand situations.

- **Seat / Leon** and **Cupra / Leon**
  - Likely valid. Cupra was separated from Seat, and `Leon` exists under both contexts.

- **KGM / Torres** and **SsangYong / Torres**
  - Likely valid rebrand issue. KGM is the newer SsangYong branding.

- **Chevrolet / Lanos** and **Daewoo / Lanos**
  - Likely valid in Egypt due historical rebadging and market usage.

- **Fiat / 500** and **Mercedes / 500**
  - Likely valid. Same model code/name, different brands.

- **BMW / X7**, **BAIC / X7**, **Geely / X7**, **Kaiyi / X7**
  - Could be valid because `X7` is a common SUV/model code across brands.
  - Needs validation, but this should not be treated as a backend duplicate if models are correctly scoped by make.

- **Kia / Pride** and **Saipa / Pride**
  - Could be historically explainable. Needs domain validation before removal.

## E) High-confidence likely incorrect make↔model rows

These are the rows to review first. They look like obvious cross-brand swaps or user-entry mistakes.

> “Row index” below is the **0-based index in the JSON array**.

| Row index | Current row | Why suspicious | Likely action |
|---:|---|---|---|
| 191 | `Toyota / Cruze` | Cruze is strongly associated with Chevrolet, not Toyota. | Review and likely map to `Chevrolet / Cruze`. |
| 280 | `Volkswagen / Tiggo` | Tiggo is associated with Chery/Speranza, not Volkswagen. | Review and likely map to `Chery / Tiggo`. |
| 194 | `Hyundai / X3` | X3 is strongly associated with BMW, not Hyundai. | Review and likely correct make/model. |
| 88 | `Ford / Echo` | Echo is strongly associated with Toyota, not Ford. | Review and likely map to `Toyota / Echo`. |
| 338 | `Fiat / Polo` | Polo is strongly associated with Volkswagen, not Fiat. | Review and likely map to `Volkswagen / Polo`. |
| 354 | `Fiat / Jetta` | Jetta is strongly associated with Volkswagen, not Fiat. | Review and likely map to `Volkswagen / Jetta`. |
| 268 | `Suzuki / Fit` | Fit is strongly associated with Honda, not Suzuki. | Review and likely map to `Honda / Fit`. |
| 107 | `Mini / Benni` | Benni is associated with Changan/Chana, not Mini. | Review and likely map to `Changan / Benni` or remove. |
| 402 | `Mercedes / A1` | A1 is not a normal Mercedes model label. | Review and likely correct/remove. |
| 246 | `Hyundai / A1` | A1 is not a normal Hyundai model label. | Review and likely correct/remove. |
| 322 | `Chevrolet / 300` | `300` is more commonly associated with Chrysler 300. | Review and likely correct/remove. |

## F) Suspicious rows that need manual review, not automatic deletion

These rows may look wrong, but they can be affected by Egypt-market naming, historical rebadging, or user shorthand.

| Row index | Current row | Notes |
|---:|---|---|
| 16 | `Kia / Saipa` | Suspicious because `Saipa` is a make, not normally a Kia model. Could be user-swapped make/model. |
| 23 | `Fiat / Shahin` | Needs market decision. In Egypt, Shahin may be associated with Nasr/Tofas/Fiat lineage. |
| 254 | `Mercedes / C30` | Suspicious because `C30` is more strongly associated with Volvo, but verify before deleting. |
| 355 | `Daewoo / Juliet` | Could be local shorthand around Daewoo Lanos Juliet/hatchback. Needs review. |

## G) Generic or weak model labels

These may not break seeding, but they are weak values for a clean backend lookup because they are categories, divisions, or broad labels rather than precise models.

- **Mercedes / AMG**
  - `AMG` is a performance division/trim line, not a precise model.

- **Chevrolet / Pickup**
  - `Pickup` is a body/category label, not a specific model.

- **Suzuki / Van**
  - Too generic for model lookup unless this is intentionally how the market names it.

- **Dodge / Ram**
  - Can be historically valid, but there is also a separate Ram brand in many markets. Needs backend taxonomy decision.

## H) Canonicalization and style issues

These are not always backend blockers, but they hurt UI/search quality and can create duplicate-like behavior.

| Current value | Suggested canonical style |
|---|---|
| `Honda / Cr V` | `Honda / CRV` or `Honda / CR-V` |
| `MG / Rx5` | `MG / RX5` |
| `Suzuki / Grand vitara` | `Suzuki / Grand Vitara` |
| `BAIC / U5 plus` | `BAIC / U5 Plus` |
| `DS / Ds4` | `DS / DS4` |
| `Xiaomi / Yu7` | `Xiaomi / YU7` if following official uppercase style |
| `Isuzu / D max` | `Isuzu / D-Max` |
| `Suzuki / S Presso` | `Suzuki / S-Presso` |
| `Nissan / XTrail` | `Nissan / X-Trail` |
| `Geely / Cool Ray` | `Geely / Coolray` |
| `Citroën / C Elysee` | `Citroën / C-Elysée` if Unicode is allowed, otherwise `C Elysee` |

## I) Make alias and rebrand issues

These need explicit business rules. Do not rely on raw user text alone.

### Chana / Changan

- `Chana / Benni`
- `Changan / Benni`
- `Changan / Benni Mini`

Possible decision:

- Treat `Chana` as an alias of `Changan`, or keep both as separate makes if the backend/product team wants market-facing raw labels.

### KGM / SsangYong

- `KGM / Torres`
- `SsangYong / Torres`

Possible decision:

- Keep both makes but connect them with an alias/rebrand mapping.
- Or canonicalize older rows to one brand depending on product requirement.

## J) Model hierarchy and granularity issues

The file mixes different levels of vehicle naming:

- model family
- generation
- trim
- engine variant
- body style

This is not always wrong, but it affects ML features, filters, and backend UX.

### BMW examples

- `BMW / 3 Series`
- `BMW / 316`
- `BMW / 318`
- `BMW / 318i`
- `BMW / 320`
- `BMW / 320i`
- `BMW / 330`
- `BMW / 340`

These are not simple duplicates. They represent mixed granularity: family (`3 Series`) vs variant/engine label (`320i`).

### Mercedes examples

- `Mercedes / GLC`
- `Mercedes / GLC200`
- `Mercedes / GLC300`
- `Mercedes / GLC43`

Same issue: model family vs variant.

### Hyundai examples

- `Hyundai / Elantra`
- `Hyundai / Elantra AD`
- `Hyundai / Elantra HD`
- `Hyundai / Elantra MD`
- `Hyundai / Elantra CN7`

These may be useful market-facing labels, but from an ML/taxonomy perspective they are better represented as:

- `model = Elantra`
- `generation = AD / HD / MD / CN7`

## K) Recommended backend schema decision

Avoid this:

```text
Model
- id
- name UNIQUE
```

Prefer this:

```text
Make
- id
- name
- normalized_name UNIQUE

Model
- id
- make_id
- name
- normalized_name

UNIQUE(make_id, normalized_model_name)
```

Recommended optional tables:

```text
MakeAlias
- raw_name
- canonical_make_id

ModelAlias
- make_id
- raw_model_name
- canonical_model_id
```

This lets the system preserve messy user input while seeding clean canonical values.

## L) Recommended cleanup workflow

Do not delete rows immediately. Create a review table with:

```text
raw_make
raw_model
issue_type
severity
suggested_make
suggested_model
decision
notes
```

Suggested `issue_type` values:

```text
exact_duplicate
normalized_duplicate
wrong_make_model
make_alias
model_alias
generic_model
case_style
model_hierarchy
valid_cross_make_name
```

Suggested `severity` values:

```text
blocker
high
medium
low
```

## M) Priority action list

### Blockers before backend seed

- Normalize `Honda / Cr V` and `Honda / CRV` into one canonical value.
- Normalize `MG / Rx5` and `MG / RX5` into one canonical value.
- Confirm backend model uniqueness is scoped by make, not globally by model name.

### High-priority manual review

- `Toyota / Cruze`
- `Volkswagen / Tiggo`
- `Hyundai / X3`
- `Ford / Echo`
- `Fiat / Polo`
- `Fiat / Jetta`
- `Suzuki / Fit`
- `Mini / Benni`
- `Mercedes / A1`
- `Hyundai / A1`
- `Chevrolet / 300`

### Medium-priority manual review

- `Kia / Saipa`
- `Fiat / Shahin`
- `Mercedes / C30`
- `Daewoo / Juliet`
- `Mercedes / AMG`
- `Chevrolet / Pickup`
- `Suzuki / Van`
- `Dodge / Ram`

## Final assessment

The backend developer is **not correct** if the claim is that this JSON contains exact duplicate `(make, model)` rows.

The backend developer is **correct** that this file contains real data quality problems that can break seeding depending on backend constraints and normalization behavior.

The safest next step is to clean only blocker/high-confidence cases first, then define a canonical make/model/alias strategy before doing aggressive automatic cleanup.
