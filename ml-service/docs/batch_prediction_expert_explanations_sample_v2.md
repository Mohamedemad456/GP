# Batch Prediction — Expert Explanations v2 (Ensemble + Egypt-Market Explanations)

This document captures sample batch requests and their responses after upgrading to:

- **Ensemble Robust Average model** (`ensemble_robust_average_v1.1.0`, model version `v1.2.0`)
- **Enhanced Egyptian-market expert explanations** with customs, licensing, regional, and brand-specific context
- **Ensemble SHAP explainability** aggregating per-sub-model SHAP values with robust-average trimming

### Changes from v1

| Aspect | v1 (XGBoost, generic) | v2 (Ensemble, Egypt-market) |
|---|---|---|
| Model | `xgboost_quantile_v1.1.0` | `ensemble_robust_average_v1.1.0` |
| Explainability | Single-model TreeExplainer | Ensemble SHAP (weighted sub-model aggregation) |
| Year | Generic ("recent model year") | Customs duties, warranty periods, depreciation context |
| Mileage | Generic ("very high, buyer concern") | Cairo–Alex commuting, ride-sharing, component-specific wear |
| Transmission | Generic ("auto preferred") | Cairo/Alexandria congestion, DSG stress patterns |
| Engine CC | Generic ("mid-size balance") | Egyptian customs duty brackets, licensing tiers |
| Fuel | Generic ("petrol standard") | Octane 92/95, CNG certification, EV charging network |
| Brand origin | Generic ("Japanese/Korean reliable") | Specific brand notes (Toyota, Hyundai, Chinese brands) |
| Location | One-liner | Regional: Cairo benchmark, Alex rust, Delta, Upper Egypt, Red Sea, Canal zone |
| Body type | Generic categories | Egypt-specific demand (SUV family, hatchback parking, convertible climate) |

### Known quality note

Make-notes (brand-specific context) are prepended **only** to `brand_origin` factors to avoid disconnected text on other factors like `engine_cc` or `car_segment`.

---

## Single Prediction (Toyota Corolla 2018)

### Request

```json
{
  "brand": "Toyota",
  "model": "Corolla",
  "year": 2018,
  "mileage_km": 85000,
  "transmission": "automatic",
  "fuel": "petrol",
  "location": "Cairo",
  "include_factors": true
}
```

### Response

```json
{
  "fair_price": 880000,
  "negotiation_range": {
    "min_price": 710000,
    "max_price": 1050000
  },
  "confidence": "medium",
  "price_factors": [
    {
      "factor": "horsepower",
      "direction": "negative",
      "description": "Moderate horsepower covers the Egyptian market's mainstream sweet spot — enough for daily commuting and occasional highway trips without excessive fuel costs. Common in Hyundai Accent / Kia Cerato class. This is within the typical range in the data."
    },
    {
      "factor": "brand_origin",
      "direction": "positive",
      "description": "Toyota dominates Egyptian resale thanks to legendary parts availability, low workshop costs, and strong brand trust across all governorates. Japanese brands (Toyota, Nissan, Honda, Mitsubishi) are the gold standard for resale in Egypt, backed by decades of parts availability, affordable workshop costs, and strong trust across all income levels."
    },
    {
      "factor": "year",
      "direction": "positive",
      "description": "This is a mid-age car in the Egyptian market, where condition and maintenance history matter increasingly. Buyers at this age expect honest disclosure on paint work, mechanical overhauls, and whether servicing was done at an agency or independent workshop."
    },
    {
      "factor": "drivetrain",
      "direction": "negative",
      "description": "FWD is the dominant drivetrain in Egypt — simpler, cheaper to maintain, and efficient for daily city driving. It's what most Egyptian buyers expect in the economy and family segments."
    },
    {
      "factor": "transmission",
      "direction": "positive",
      "description": "Automatic transmission is strongly preferred in Egypt, especially in Cairo and Alexandria where traffic congestion makes manual driving fatiguing. This preference boosts resale for auto-equipped listings."
    }
  ],
  "model_version": "v1.2.0",
  "predicted_at": "2026-05-23T22:39:59.786689+00:00"
}
```

---

## Batch Request 1 (10 items — same as v1)

```json
{
  "items": [
    {
      "brand": "BYD",
      "model": "F3",
      "year": 2024,
      "mileage_km": 8000,
      "transmission": "manual",
      "fuel": "petrol",
      "location": "Cairo",
      "include_factors": true
    },
    {
      "brand": "Nissan",
      "model": "Sunny",
      "year": 2015,
      "mileage_km": 175000,
      "transmission": "automatic",
      "fuel": "petrol",
      "location": "Giza",
      "include_factors": true
    },
    {
      "brand": "Skoda",
      "model": "Octavia",
      "year": 2018,
      "mileage_km": 95000,
      "transmission": "Dsg",
      "fuel": "petrol",
      "location": "Alexandria",
      "include_factors": true
    },
    {
      "brand": "Chery",
      "model": "Arrizo 5 Pro",
      "year": 2023,
      "mileage_km": 15000,
      "transmission": "Cvt",
      "fuel": "petrol",
      "location": "New Cairo",
      "include_factors": true
    },
    {
      "brand": "Hyundai",
      "model": "Verna",
      "year": 2012,
      "mileage_km": 190000,
      "transmission": "manual",
      "fuel": "petrol",
      "location": "Upper Egypt",
      "include_factors": true
    },
    {
      "brand": "Renault",
      "model": "Logan",
      "year": 2016,
      "mileage_km": 160000,
      "transmission": "manual",
      "fuel": "cng",
      "location": "Delta (Other)",
      "include_factors": true
    },
    {
      "brand": "Chevrolet",
      "model": "Aveo",
      "year": 2010,
      "mileage_km": 220000,
      "transmission": "manual",
      "fuel": "petrol",
      "location": "Sharqia",
      "include_factors": true
    },
    {
      "brand": "Suzuki",
      "model": "Alto",
      "year": 2020,
      "mileage_km": 55000,
      "transmission": "manual",
      "fuel": "petrol",
      "location": "Canal Zone",
      "include_factors": true
    },
    {
      "brand": "MG",
      "model": "HS",
      "year": 2022,
      "mileage_km": 65000,
      "transmission": "automatic",
      "fuel": "petrol",
      "location": "October & Zayed",
      "include_factors": true
    },
    {
      "brand": "Fiat",
      "model": "Tipo",
      "year": 2019,
      "mileage_km": 110000,
      "transmission": "automatic",
      "fuel": "diesel",
      "location": "Cairo",
      "include_factors": true
    }
  ]
}
```

## Batch Response 1

```json
{
  "total": 10,
  "successful": 10,
  "failed": 0,
  "results": [
    {
      "index": 0,
      "success": true,
      "result": {
        "fair_price": 590000,
        "negotiation_range": {
          "min_price": 310000,
          "max_price": 860000
        },
        "confidence": "low",
        "price_factors": [
          {
            "factor": "year",
            "direction": "positive",
            "description": "This is a very recent model year — still within or near the official warranty period. Buyers expect near-showroom condition, original paint, and full agency service records. Customs and import duties on recent-year cars are at their highest, which supports stronger resale."
          },
          {
            "factor": "horsepower",
            "direction": "negative",
            "description": "Moderate horsepower covers the Egyptian market's mainstream sweet spot — enough for daily commuting and occasional highway trips without excessive fuel costs. Common in Hyundai Accent / Kia Cerato class. This is within the typical range in the data."
          },
          {
            "factor": "brand_origin",
            "direction": "negative",
            "description": "BYD is at the forefront of Egypt's emerging EV market; resale depends on battery health and the expanding charging network. Chinese brands (MG, Chery, Geely, BYD) are rapidly growing in Egypt with competitive pricing, modern features, and expanding dealer networks. Resale confidence is improving but still trails Japanese and Korean brands for most buyers."
          },
          {
            "factor": "transmission",
            "direction": "negative",
            "description": "Manual transmission has lower maintenance costs and is still common in budget segments. However, the Egyptian private-buyer market increasingly favours automatic, which can narrow the buyer pool for manual cars."
          },
          {
            "factor": "mileage_km",
            "direction": "positive",
            "description": "Very low mileage for the Egyptian market, suggesting light use — possibly a second car or weekend-only driving. Buyers will verify this against the service book and tyre/brake wear. This is lower than what is typical in the data."
          }
        ],
        "model_version": "v1.2.0",
        "predicted_at": "2026-05-23T22:42:05.427404+00:00"
      },
      "error": null
    },
    {
      "index": 1,
      "success": true,
      "result": {
        "fair_price": 440000,
        "negotiation_range": {
          "min_price": 390000,
          "max_price": 500000
        },
        "confidence": "high",
        "price_factors": [
          {
            "factor": "horsepower",
            "direction": "negative",
            "description": "Moderate horsepower covers the Egyptian market's mainstream sweet spot — enough for daily commuting and occasional highway trips without excessive fuel costs. Common in Hyundai Accent / Kia Cerato class. This is within the typical range in the data."
          },
          {
            "factor": "year",
            "direction": "negative",
            "description": "This is an older model year. Depreciation is well advanced, and buyers focus heavily on mechanical soundness, rust (especially underbody in coastal cities), and whether major components like the gearbox and AC have been replaced."
          },
          {
            "factor": "mileage_km",
            "direction": "negative",
            "description": "Very high mileage by Egyptian standards. Buyers will expect significant cumulative wear and will negotiate hard. Major services (timing belt/chain, gearbox overhaul, AC compressor) should ideally be documented. This is higher than what is typical in the data."
          },
          {
            "factor": "brand_origin",
            "direction": "positive",
            "description": "Nissan has a solid Egyptian presence; models like Sunny and Sentra are popular for fleet and family use, with parts widely available. Japanese brands (Toyota, Nissan, Honda, Mitsubishi) are the gold standard for resale in Egypt, backed by decades of parts availability, affordable workshop costs, and strong trust across all income levels."
          },
          {
            "factor": "drivetrain",
            "direction": "negative",
            "description": "FWD is the dominant drivetrain in Egypt — simpler, cheaper to maintain, and efficient for daily city driving. It's what most Egyptian buyers expect in the economy and family segments."
          }
        ],
        "model_version": "v1.2.0",
        "predicted_at": "2026-05-23T22:42:05.921002+00:00"
      },
      "error": null
    },
    {
      "index": 2,
      "success": true,
      "result": {
        "fair_price": 940000,
        "negotiation_range": {
          "min_price": 830000,
          "max_price": 1060000
        },
        "confidence": "high",
        "price_factors": [
          {
            "factor": "year",
            "direction": "positive",
            "description": "This is a mid-age car in the Egyptian market, where condition and maintenance history matter increasingly. Buyers at this age expect honest disclosure on paint work, mechanical overhauls, and whether servicing was done at an agency or independent workshop."
          },
          {
            "factor": "drivetrain",
            "direction": "negative",
            "description": "FWD is the dominant drivetrain in Egypt — simpler, cheaper to maintain, and efficient for daily city driving. It's what most Egyptian buyers expect in the economy and family segments."
          },
          {
            "factor": "mileage_km",
            "direction": "negative",
            "description": "Mileage is on the higher side. In Egypt, this level often corresponds to regular Cairo–Alexandria commuting or ride-sharing use. Buyers will expect some mechanical wear — suspension bushings, clutch/transmission service, and possibly engine mounts may need attention. This is within the typical range in the data."
          },
          {
            "factor": "brand_origin",
            "direction": "positive",
            "description": "Skoda Octavia is a popular fleet and family choice in Egypt; German engineering at a more accessible price point. European brands (Peugeot, Renault, Fiat, SEAT, Skoda) occupy a mid-range niche in Egypt. They're often appreciated for build quality and features, but parts availability and cost can vary by brand."
          },
          {
            "factor": "engine_cc",
            "direction": "negative",
            "description": "Skoda Octavia is a popular fleet and family choice in Egypt; German engineering at a more accessible price point. Mid-range engine size (1,300–1,800 cc) is the Egyptian market's mainstream. It balances daily usability with manageable fuel and licensing costs — the bulk of Hyundai, Kia, and Nissan sales fall here. This is lower than what is typical in the data."
          }
        ],
        "model_version": "v1.2.0",
        "predicted_at": "2026-05-23T22:42:06.411829+00:00"
      },
      "error": null
    },
    {
      "index": 3,
      "success": true,
      "result": {
        "fair_price": 710000,
        "negotiation_range": {
          "min_price": 570000,
          "max_price": 850000
        },
        "confidence": "medium",
        "price_factors": [
          {
            "factor": "brand_origin",
            "direction": "negative",
            "description": "Chery offers value-for-money in the Egyptian market; resale depends heavily on model reputation and available after-sales support. Chinese brands (MG, Chery, Geely, BYD) are rapidly growing in Egypt with competitive pricing, modern features, and expanding dealer networks. Resale confidence is improving but still trails Japanese and Korean brands for most buyers."
          },
          {
            "factor": "year",
            "direction": "positive",
            "description": "This is a relatively recent model year. First-owner resale tends to be strong in this window, especially for popular Egyptian-market models. Buyers check for agency-stamped service books and accident-free history."
          },
          {
            "factor": "drivetrain",
            "direction": "negative",
            "description": "FWD is the dominant drivetrain in Egypt — simpler, cheaper to maintain, and efficient for daily city driving. It's what most Egyptian buyers expect in the economy and family segments."
          },
          {
            "factor": "mileage_km",
            "direction": "positive",
            "description": "Very low mileage for the Egyptian market, suggesting light use — possibly a second car or weekend-only driving. Buyers will verify this against the service book and tyre/brake wear. This is lower than what is typical in the data."
          },
          {
            "factor": "horsepower",
            "direction": "negative",
            "description": "Higher horsepower appeals for highway cruising, loaded family trips, and upper trims. In Egypt, this range often appears in mid-size sedans (Camry, Passat) and popular SUVs (Tucson, RAV4). This is higher than what is typical in the data."
          }
        ],
        "model_version": "v1.2.0",
        "predicted_at": "2026-05-23T22:42:06.875389+00:00"
      },
      "error": null
    },
    {
      "index": 4,
      "success": true,
      "result": {
        "fair_price": 320000,
        "negotiation_range": {
          "min_price": 115000,
          "max_price": 520000
        },
        "confidence": "low",
        "price_factors": [
          {
            "factor": "year",
            "direction": "negative",
            "description": "This is an older model year. Depreciation is well advanced, and buyers focus heavily on mechanical soundness, rust (especially underbody in coastal cities), and whether major components like the gearbox and AC have been replaced."
          },
          {
            "factor": "transmission",
            "direction": "negative",
            "description": "Manual transmission has lower maintenance costs and is still common in budget segments. However, the Egyptian private-buyer market increasingly favours automatic, which can narrow the buyer pool for manual cars."
          },
          {
            "factor": "horsepower",
            "direction": "negative",
            "description": "Moderate horsepower covers the Egyptian market's mainstream sweet spot — enough for daily commuting and occasional highway trips without excessive fuel costs. Common in Hyundai Accent / Kia Cerato class. This is within the typical range in the data."
          },
          {
            "factor": "mileage_km",
            "direction": "negative",
            "description": "Very high mileage by Egyptian standards. Buyers will expect significant cumulative wear and will negotiate hard. Major services (timing belt/chain, gearbox overhaul, AC compressor) should ideally be documented. This is higher than what is typical in the data."
          },
          {
            "factor": "drivetrain",
            "direction": "negative",
            "description": "FWD is the dominant drivetrain in Egypt — simpler, cheaper to maintain, and efficient for daily city driving. It's what most Egyptian buyers expect in the economy and family segments."
          }
        ],
        "model_version": "v1.2.0",
        "predicted_at": "2026-05-23T22:42:07.341316+00:00"
      },
      "error": null
    },
    {
      "index": 5,
      "success": true,
      "result": {
        "fair_price": 340000,
        "negotiation_range": {
          "min_price": 300000,
          "max_price": 380000
        },
        "confidence": "high",
        "price_factors": [
          {
            "factor": "horsepower",
            "direction": "negative",
            "description": "Lower horsepower suits city economy driving (Suzuki Alto, Chery QQ class). Adequate for Cairo traffic, but may feel strained on the Cairo–Alexandria Desert Road or when fully loaded. This is lower than what is typical in the data."
          },
          {
            "factor": "transmission",
            "direction": "negative",
            "description": "Manual transmission has lower maintenance costs and is still common in budget segments. However, the Egyptian private-buyer market increasingly favours automatic, which can narrow the buyer pool for manual cars."
          },
          {
            "factor": "year",
            "direction": "negative",
            "description": "This is a mid-age car in the Egyptian market, where condition and maintenance history matter increasingly. Buyers at this age expect honest disclosure on paint work, mechanical overhauls, and whether servicing was done at an agency or independent workshop."
          },
          {
            "factor": "mileage_km",
            "direction": "negative",
            "description": "Very high mileage by Egyptian standards. Buyers will expect significant cumulative wear and will negotiate hard. Major services (timing belt/chain, gearbox overhaul, AC compressor) should ideally be documented. This is higher than what is typical in the data."
          },
          {
            "factor": "drivetrain",
            "direction": "negative",
            "description": "FWD is the dominant drivetrain in Egypt — simpler, cheaper to maintain, and efficient for daily city driving. It's what most Egyptian buyers expect in the economy and family segments."
          }
        ],
        "model_version": "v1.2.0",
        "predicted_at": "2026-05-23T22:42:07.802331+00:00"
      },
      "error": null
    },
    {
      "index": 6,
      "success": true,
      "result": {
        "fair_price": 290000,
        "negotiation_range": {
          "min_price": 250000,
          "max_price": 320000
        },
        "confidence": "high",
        "price_factors": [
          {
            "factor": "year",
            "direction": "negative",
            "description": "This is a very old model year. In the Egyptian market, very old cars can still hold niche value (e.g. classic Fiat 128, old Land Cruisers), but most buyers will expect significant wear and negotiate accordingly. Full inspection and documented repairs are critical."
          },
          {
            "factor": "horsepower",
            "direction": "negative",
            "description": "Moderate horsepower covers the Egyptian market's mainstream sweet spot — enough for daily commuting and occasional highway trips without excessive fuel costs. Common in Hyundai Accent / Kia Cerato class. This is lower than what is typical in the data."
          },
          {
            "factor": "brand_origin",
            "direction": "negative",
            "description": "Chevrolet's Egyptian history (Optra, Lanos, Aveo) keeps parts cheap and service accessible, but model reputation varies significantly. American brands (Chevrolet, Jeep, Ford) have a mixed reputation in Egypt. Chevrolet benefits from local assembly history, while Jeep has cult SUV appeal. Resale is model-dependent, with parts availability varying by generation."
          },
          {
            "factor": "transmission",
            "direction": "negative",
            "description": "Manual transmission has lower maintenance costs and is still common in budget segments. However, the Egyptian private-buyer market increasingly favours automatic, which can narrow the buyer pool for manual cars."
          },
          {
            "factor": "mileage_km",
            "direction": "negative",
            "description": "Very high mileage by Egyptian standards. Buyers will expect significant cumulative wear and will negotiate hard. Major services (timing belt/chain, gearbox overhaul, AC compressor) should ideally be documented. This is very high compared with typical listings in the data."
          }
        ],
        "model_version": "v1.2.0",
        "predicted_at": "2026-05-23T22:42:08.283417+00:00"
      },
      "error": null
    },
    {
      "index": 7,
      "success": true,
      "result": {
        "fair_price": 350000,
        "negotiation_range": {
          "min_price": 200000,
          "max_price": 500000
        },
        "confidence": "low",
        "price_factors": [
          {
            "factor": "horsepower",
            "direction": "negative",
            "description": "Lower horsepower suits city economy driving (Suzuki Alto, Chery QQ class). Adequate for Cairo traffic, but may feel strained on the Cairo–Alexandria Desert Road or when fully loaded. This is lower than what is typical in the data."
          },
          {
            "factor": "transmission",
            "direction": "negative",
            "description": "Manual transmission has lower maintenance costs and is still common in budget segments. However, the Egyptian private-buyer market increasingly favours automatic, which can narrow the buyer pool for manual cars."
          },
          {
            "factor": "year",
            "direction": "positive",
            "description": "This is a mid-age car in the Egyptian market, where condition and maintenance history matter increasingly. Buyers at this age expect honest disclosure on paint work, mechanical overhauls, and whether servicing was done at an agency or independent workshop."
          },
          {
            "factor": "car_segment",
            "direction": "negative",
            "description": "Suzuki is popular for compact city cars in Egypt; affordability and low running costs support demand. City/economy cars (i10, Picanto, Alto) are valued for rock-bottom running costs and easy city parking. In Egypt, this segment is price-sensitive; small differences in condition can shift buyer interest."
          },
          {
            "factor": "brand_origin",
            "direction": "positive",
            "description": "Suzuki is popular for compact city cars in Egypt; affordability and low running costs support demand. Japanese brands (Toyota, Nissan, Honda, Mitsubishi) are the gold standard for resale in Egypt, backed by decades of parts availability, affordable workshop costs, and strong trust across all income levels."
          }
        ],
        "model_version": "v1.2.0",
        "predicted_at": "2026-05-23T22:42:08.760701+00:00"
      },
      "error": null
    },
    {
      "index": 8,
      "success": true,
      "result": {
        "fair_price": 1040000,
        "negotiation_range": {
          "min_price": 920000,
          "max_price": 1170000
        },
        "confidence": "high",
        "price_factors": [
          {
            "factor": "year",
            "direction": "positive",
            "description": "This is a relatively recent model year. First-owner resale tends to be strong in this window, especially for popular Egyptian-market models. Buyers check for agency-stamped service books and accident-free history."
          },
          {
            "factor": "brand_origin",
            "direction": "negative",
            "description": "MG is gaining market share in Egypt with competitive pricing and features, but long-term resale data is still developing. Chinese brands (MG, Chery, Geely, BYD) are rapidly growing in Egypt with competitive pricing, modern features, and expanding dealer networks. Resale confidence is improving but still trails Japanese and Korean brands for most buyers."
          },
          {
            "factor": "drivetrain",
            "direction": "negative",
            "description": "FWD is the dominant drivetrain in Egypt — simpler, cheaper to maintain, and efficient for daily city driving. It's what most Egyptian buyers expect in the economy and family segments. For SUVs in Egypt, 4WD/AWD can significantly boost appeal for buyers planning Sahel, Sinai, or desert trips."
          },
          {
            "factor": "engine_cc",
            "direction": "negative",
            "description": "MG is gaining market share in Egypt with competitive pricing and features, but long-term resale data is still developing. Mid-range engine size (1,300–1,800 cc) is the Egyptian market's mainstream. It balances daily usability with manageable fuel and licensing costs — the bulk of Hyundai, Kia, and Nissan sales fall here. This is lower than what is typical in the data."
          },
          {
            "factor": "transmission",
            "direction": "positive",
            "description": "Automatic transmission is strongly preferred in Egypt, especially in Cairo and Alexandria where traffic congestion makes manual driving fatiguing. This preference boosts resale for auto-equipped listings."
          }
        ],
        "model_version": "v1.2.0",
        "predicted_at": "2026-05-23T22:42:09.242633+00:00"
      },
      "error": null
    },
    {
      "index": 9,
      "success": true,
      "result": {
        "fair_price": 670000,
        "negotiation_range": {
          "min_price": 390000,
          "max_price": 950000
        },
        "confidence": "low",
        "price_factors": [
          {
            "factor": "horsepower",
            "direction": "negative",
            "description": "Moderate horsepower covers the Egyptian market's mainstream sweet spot — enough for daily commuting and occasional highway trips without excessive fuel costs. Common in Hyundai Accent / Kia Cerato class. This is within the typical range in the data."
          },
          {
            "factor": "year",
            "direction": "positive",
            "description": "This is a mid-age car in the Egyptian market, where condition and maintenance history matter increasingly. Buyers at this age expect honest disclosure on paint work, mechanical overhauls, and whether servicing was done at an agency or independent workshop."
          },
          {
            "factor": "mileage_km",
            "direction": "negative",
            "description": "Mileage is on the higher side. In Egypt, this level often corresponds to regular Cairo–Alexandria commuting or ride-sharing use. Buyers will expect some mechanical wear — suspension bushings, clutch/transmission service, and possibly engine mounts may need attention. This is within the typical range in the data."
          },
          {
            "factor": "drivetrain",
            "direction": "negative",
            "description": "FWD is the dominant drivetrain in Egypt — simpler, cheaper to maintain, and efficient for daily city driving. It's what most Egyptian buyers expect in the economy and family segments."
          },
          {
            "factor": "transmission",
            "direction": "positive",
            "description": "Automatic transmission is strongly preferred in Egypt, especially in Cairo and Alexandria where traffic congestion makes manual driving fatiguing. This preference boosts resale for auto-equipped listings."
          }
        ],
        "model_version": "v1.2.0",
        "predicted_at": "2026-05-23T22:42:09.707281+00:00"
      },
      "error": null
    }
  ]
}
```

---

## Batch Request 2 (10 items — same as v1)

```json
{
  "items": [
    {
      "brand": "Toyota",
      "model": "Corolla",
      "year": 2022,
      "mileage_km": 40000,
      "transmission": "automatic",
      "fuel": "petrol",
      "location": "Cairo",
      "include_factors": true
    },
    {
      "brand": "Toyota",
      "model": "Land Cruiser",
      "year": 2019,
      "mileage_km": 80000,
      "transmission": "automatic",
      "fuel": "petrol",
      "location": "Giza",
      "include_factors": true
    },
    {
      "brand": "BMW",
      "model": "3 Series",
      "year": 2019,
      "mileage_km": 95000,
      "transmission": "automatic",
      "fuel": "petrol",
      "location": "New Cairo",
      "include_factors": true
    },
    {
      "brand": "Mercedes-Benz",
      "model": "GLE",
      "year": 2022,
      "mileage_km": 25000,
      "transmission": "automatic",
      "fuel": "petrol",
      "location": "Zamalek",
      "include_factors": true
    },
    {
      "brand": "BMW",
      "model": "5 Series",
      "year": 2014,
      "mileage_km": 180000,
      "transmission": "automatic",
      "fuel": "petrol",
      "location": "Alexandria",
      "include_factors": true
    },
    {
      "brand": "Audi",
      "model": "A4",
      "year": 2018,
      "mileage_km": 100000,
      "transmission": "automatic",
      "fuel": "petrol",
      "location": "Maadi",
      "include_factors": true
    },
    {
      "brand": "Porsche",
      "model": "Cayenne",
      "year": 2019,
      "mileage_km": 65000,
      "transmission": "automatic",
      "fuel": "petrol",
      "location": "New Cairo",
      "include_factors": true
    },
    {
      "brand": "Nissan",
      "model": "Qashqai",
      "year": 2019,
      "mileage_km": 110000,
      "transmission": "automatic",
      "fuel": "petrol",
      "location": "Giza",
      "include_factors": true
    },
    {
      "brand": "Geely",
      "model": "Emgrand",
      "year": 2023,
      "mileage_km": 20000,
      "transmission": "automatic",
      "fuel": "petrol",
      "location": "6th of October",
      "include_factors": true
    },
    {
      "brand": "Hyundai",
      "model": "Ioniq 5",
      "year": 2023,
      "mileage_km": 36000,
      "transmission": "automatic",
      "fuel": "electric",
      "location": "Cairo",
      "include_factors": true
    }
  ]
}
```

## Batch Response 2

```json
{
  "total": 10,
  "successful": 10,
  "failed": 0,
  "results": [
    {
      "index": 0,
      "success": true,
      "result": {
        "fair_price": 1040000,
        "negotiation_range": {
          "min_price": 840000,
          "max_price": 1250000
        },
        "confidence": "medium",
        "price_factors": [
          {
            "factor": "year",
            "direction": "positive",
            "description": "This is a relatively recent model year. First-owner resale tends to be strong in this window, especially for popular Egyptian-market models. Buyers check for agency-stamped service books and accident-free history."
          },
          {
            "factor": "horsepower",
            "direction": "negative",
            "description": "Moderate horsepower covers the Egyptian market's mainstream sweet spot — enough for daily commuting and occasional highway trips without excessive fuel costs. Common in Hyundai Accent / Kia Cerato class. This is within the typical range in the data."
          },
          {
            "factor": "drivetrain",
            "direction": "negative",
            "description": "FWD is the dominant drivetrain in Egypt — simpler, cheaper to maintain, and efficient for daily city driving. It's what most Egyptian buyers expect in the economy and family segments."
          },
          {
            "factor": "brand_origin",
            "direction": "positive",
            "description": "Toyota dominates Egyptian resale thanks to legendary parts availability, low workshop costs, and strong brand trust across all governorates. Japanese brands (Toyota, Nissan, Honda, Mitsubishi) are the gold standard for resale in Egypt, backed by decades of parts availability, affordable workshop costs, and strong trust across all income levels."
          },
          {
            "factor": "mileage_km",
            "direction": "positive",
            "description": "Mileage is in a healthy range for the Egyptian market. This is typical for a car used mainly in-city (Cairo, Alexandria) without heavy intercity driving. Service history and consumable condition still matter. This is lower than what is typical in the data."
          }
        ],
        "model_version": "v1.2.0",
        "predicted_at": "2026-05-23T22:43:35.671354+00:00"
      },
      "error": null
    },
    {
      "index": 1,
      "success": true,
      "result": {
        "fair_price": 4720000,
        "negotiation_range": {
          "min_price": 2800000,
          "max_price": 6630000
        },
        "confidence": "low",
        "price_factors": [
          {
            "factor": "horsepower",
            "direction": "positive",
            "description": "Very high horsepower signals premium or performance positioning (BMW 5-series, Mustang, V8 SUVs). Egyptian buyers in this bracket expect strong condition, and sellers can command a premium, but fuel and insurance costs are higher. This is very high compared with typical listings in the data."
          },
          {
            "factor": "engine_cc",
            "direction": "positive",
            "description": "Toyota dominates Egyptian resale thanks to legendary parts availability, low workshop costs, and strong brand trust across all governorates. Very large engines (2,500+ cc) attract the highest customs duties and licensing fees in Egypt. They're typically found in premium/performance models and full-size SUVs, where buyers expect strong condition and accept higher fuel bills in exchange for capability and status. This is very high compared with typical listings in the data."
          },
          {
            "factor": "year",
            "direction": "positive",
            "description": "This is a mid-age car in the Egyptian market, where condition and maintenance history matter increasingly. Buyers at this age expect honest disclosure on paint work, mechanical overhauls, and whether servicing was done at an agency or independent workshop."
          },
          {
            "factor": "drivetrain",
            "direction": "positive",
            "description": "AWD/4WD is valued in Egypt for desert trips, Sahel road conditions, and the perceived ruggedness it adds to SUVs. However, it increases fuel consumption and drivetrain maintenance costs, which price-conscious buyers factor in. For SUVs in Egypt, 4WD/AWD can significantly boost appeal for buyers planning Sahel, Sinai, or desert trips."
          },
          {
            "factor": "car_segment",
            "direction": "positive",
            "description": "Toyota dominates Egyptian resale thanks to legendary parts availability, low workshop costs, and strong brand trust across all governorates. Luxury SUVs (GLE, X5, Range Rover) are aspirational in Egypt. Buyers accept high running costs but demand impeccable condition. Depreciation can be steep once warranty expires due to expensive maintenance."
          }
        ],
        "model_version": "v1.2.0",
        "predicted_at": "2026-05-23T22:43:36.243648+00:00"
      },
      "error": null
    },
    {
      "index": 2,
      "success": true,
      "result": {
        "fair_price": 1680000,
        "negotiation_range": {
          "min_price": 1470000,
          "max_price": 1880000
        },
        "confidence": "high",
        "price_factors": [
          {
            "factor": "drivetrain",
            "direction": "positive",
            "description": "RWD is common in premium and performance cars (BMW 3-Series, Mustang). In Egypt, it appeals to driving enthusiasts but can be trickier on wet roads and costs more to maintain (differential, driveshaft) than FWD alternatives."
          },
          {
            "factor": "horsepower",
            "direction": "positive",
            "description": "Higher horsepower appeals for highway cruising, loaded family trips, and upper trims. In Egypt, this range often appears in mid-size sedans (Camry, Passat) and popular SUVs (Tucson, RAV4). This is higher than what is typical in the data."
          },
          {
            "factor": "mileage_km",
            "direction": "negative",
            "description": "Mileage is on the higher side. In Egypt, this level often corresponds to regular Cairo–Alexandria commuting or ride-sharing use. Buyers will expect some mechanical wear — suspension bushings, clutch/transmission service, and possibly engine mounts may need attention. This is higher than what is typical in the data."
          },
          {
            "factor": "transmission",
            "direction": "positive",
            "description": "Automatic transmission is strongly preferred in Egypt, especially in Cairo and Alexandria where traffic congestion makes manual driving fatiguing. This preference boosts resale for auto-equipped listings."
          },
          {
            "factor": "year",
            "direction": "negative",
            "description": "This is a mid-age car in the Egyptian market, where condition and maintenance history matter increasingly. Buyers at this age expect honest disclosure on paint work, mechanical overhauls, and whether servicing was done at an agency or independent workshop."
          }
        ],
        "model_version": "v1.2.0",
        "predicted_at": "2026-05-23T22:43:36.780225+00:00"
      },
      "error": null
    },
    {
      "index": 3,
      "success": true,
      "result": {
        "fair_price": 3890000,
        "negotiation_range": {
          "min_price": 2050000,
          "max_price": 5720000
        },
        "confidence": "low",
        "price_factors": [
          {
            "factor": "year",
            "direction": "positive",
            "description": "This is a relatively recent model year. First-owner resale tends to be strong in this window, especially for popular Egyptian-market models. Buyers check for agency-stamped service books and accident-free history."
          },
          {
            "factor": "horsepower",
            "direction": "positive",
            "description": "Higher horsepower appeals for highway cruising, loaded family trips, and upper trims. In Egypt, this range often appears in mid-size sedans (Camry, Passat) and popular SUVs (Tucson, RAV4). This is very high compared with typical listings in the data."
          },
          {
            "factor": "drivetrain",
            "direction": "positive",
            "description": "AWD/4WD is valued in Egypt for desert trips, Sahel road conditions, and the perceived ruggedness it adds to SUVs. However, it increases fuel consumption and drivetrain maintenance costs, which price-conscious buyers factor in. For SUVs in Egypt, 4WD/AWD can significantly boost appeal for buyers planning Sahel, Sinai, or desert trips."
          },
          {
            "factor": "mileage_km",
            "direction": "positive",
            "description": "Very low mileage for the Egyptian market, suggesting light use — possibly a second car or weekend-only driving. Buyers will verify this against the service book and tyre/brake wear. This is lower than what is typical in the data."
          },
          {
            "factor": "car_segment",
            "direction": "positive",
            "description": "Mercedes-Benz is the benchmark for luxury in Egypt; well-maintained units hold value, but repair costs can be steep outside authorised centres. Luxury SUVs (GLE, X5, Range Rover) are aspirational in Egypt. Buyers accept high running costs but demand impeccable condition. Depreciation can be steep once warranty expires due to expensive maintenance."
          }
        ],
        "model_version": "v1.2.0",
        "predicted_at": "2026-05-23T22:43:37.305462+00:00"
      },
      "error": null
    },
    {
      "index": 4,
      "success": true,
      "result": {
        "fair_price": 920000,
        "negotiation_range": {
          "min_price": 550000,
          "max_price": 1280000
        },
        "confidence": "low",
        "price_factors": [
          {
            "factor": "year",
            "direction": "negative",
            "description": "This is an older model year. Depreciation is well advanced, and buyers focus heavily on mechanical soundness, rust (especially underbody in coastal cities), and whether major components like the gearbox and AC have been replaced."
          },
          {
            "factor": "drivetrain",
            "direction": "positive",
            "description": "RWD is common in premium and performance cars (BMW 3-Series, Mustang). In Egypt, it appeals to driving enthusiasts but can be trickier on wet roads and costs more to maintain (differential, driveshaft) than FWD alternatives."
          },
          {
            "factor": "mileage_km",
            "direction": "negative",
            "description": "Very high mileage by Egyptian standards. Buyers will expect significant cumulative wear and will negotiate hard. Major services (timing belt/chain, gearbox overhaul, AC compressor) should ideally be documented. This is higher than what is typical in the data."
          },
          {
            "factor": "horsepower",
            "direction": "negative",
            "description": "Moderate horsepower covers the Egyptian market's mainstream sweet spot — enough for daily commuting and occasional highway trips without excessive fuel costs. Common in Hyundai Accent / Kia Cerato class. This is within the typical range in the data."
          },
          {
            "factor": "transmission",
            "direction": "positive",
            "description": "Automatic transmission is strongly preferred in Egypt, especially in Cairo and Alexandria where traffic congestion makes manual driving fatiguing. This preference boosts resale for auto-equipped listings."
          }
        ],
        "model_version": "v1.2.0",
        "predicted_at": "2026-05-23T22:43:37.823474+00:00"
      },
      "error": null
    },
    {
      "index": 5,
      "success": true,
      "result": {
        "fair_price": 1520000,
        "negotiation_range": {
          "min_price": 1180000,
          "max_price": 1870000
        },
        "confidence": "medium",
        "price_factors": [
          {
            "factor": "horsepower",
            "direction": "positive",
            "description": "Higher horsepower appeals for highway cruising, loaded family trips, and upper trims. In Egypt, this range often appears in mid-size sedans (Camry, Passat) and popular SUVs (Tucson, RAV4). This is very high compared with typical listings in the data."
          },
          {
            "factor": "mileage_km",
            "direction": "negative",
            "description": "Mileage is on the higher side. In Egypt, this level often corresponds to regular Cairo–Alexandria commuting or ride-sharing use. Buyers will expect some mechanical wear — suspension bushings, clutch/transmission service, and possibly engine mounts may need attention. This is within the typical range in the data."
          },
          {
            "factor": "transmission",
            "direction": "positive",
            "description": "Automatic transmission is strongly preferred in Egypt, especially in Cairo and Alexandria where traffic congestion makes manual driving fatiguing. This preference boosts resale for auto-equipped listings."
          },
          {
            "factor": "year",
            "direction": "positive",
            "description": "This is a mid-age car in the Egyptian market, where condition and maintenance history matter increasingly. Buyers at this age expect honest disclosure on paint work, mechanical overhauls, and whether servicing was done at an agency or independent workshop."
          },
          {
            "factor": "engine_cc",
            "direction": "positive",
            "description": "Audi is a niche premium choice in Egypt; buyers value condition highly because spare parts and specialist servicing can be expensive. Larger engines (1,800–2,500 cc) enter higher customs duty tiers and carry increased fuel and annual licensing costs. They suit buyers who need the extra power for SUVs, family touring, or towing, but resale narrows to those who accept the running costs. This is very high compared with typical listings in the data."
          }
        ],
        "model_version": "v1.2.0",
        "predicted_at": "2026-05-23T22:43:38.348178+00:00"
      },
      "error": null
    },
    {
      "index": 6,
      "success": true,
      "result": {
        "fair_price": 4700000,
        "negotiation_range": {
          "min_price": 0,
          "max_price": 10000000
        },
        "confidence": "low",
        "price_factors": [
          {
            "factor": "horsepower",
            "direction": "positive",
            "description": "Very high horsepower signals premium or performance positioning (BMW 5-series, Mustang, V8 SUVs). Egyptian buyers in this bracket expect strong condition, and sellers can command a premium, but fuel and insurance costs are higher. This is very high compared with typical listings in the data."
          },
          {
            "factor": "engine_cc",
            "direction": "positive",
            "description": "Porsche is ultra-premium in Egypt; condition and service history are paramount, and the buyer pool is small but willing. Very large engines (2,500+ cc) attract the highest customs duties and licensing fees in Egypt. They're typically found in premium/performance models and full-size SUVs, where buyers expect strong condition and accept higher fuel bills in exchange for capability and status. This is very high compared with typical listings in the data."
          },
          {
            "factor": "year",
            "direction": "positive",
            "description": "This is a mid-age car in the Egyptian market, where condition and maintenance history matter increasingly. Buyers at this age expect honest disclosure on paint work, mechanical overhauls, and whether servicing was done at an agency or independent workshop."
          },
          {
            "factor": "car_segment",
            "direction": "positive",
            "description": "Porsche is ultra-premium in Egypt; condition and service history are paramount, and the buyer pool is small but willing. Luxury SUVs (GLE, X5, Range Rover) are aspirational in Egypt. Buyers accept high running costs but demand impeccable condition. Depreciation can be steep once warranty expires due to expensive maintenance."
          },
          {
            "factor": "brand_origin",
            "direction": "positive",
            "description": "Porsche is ultra-premium in Egypt; condition and service history are paramount, and the buyer pool is small but willing. European brands (Peugeot, Renault, Fiat, SEAT, Skoda) occupy a mid-range niche in Egypt. They're often appreciated for build quality and features, but parts availability and cost can vary by brand."
          }
        ],
        "model_version": "v1.2.0",
        "predicted_at": "2026-05-23T22:43:38.918154+00:00"
      },
      "error": null
    },
    {
      "index": 7,
      "success": true,
      "result": {
        "fair_price": 880000,
        "negotiation_range": {
          "min_price": 710000,
          "max_price": 1050000
        },
        "confidence": "medium",
        "price_factors": [
          {
            "factor": "year",
            "direction": "positive",
            "description": "This is a mid-age car in the Egyptian market, where condition and maintenance history matter increasingly. Buyers at this age expect honest disclosure on paint work, mechanical overhauls, and whether servicing was done at an agency or independent workshop."
          },
          {
            "factor": "mileage_km",
            "direction": "negative",
            "description": "Mileage is on the higher side. In Egypt, this level often corresponds to regular Cairo–Alexandria commuting or ride-sharing use. Buyers will expect some mechanical wear — suspension bushings, clutch/transmission service, and possibly engine mounts may need attention. This is within the typical range in the data."
          },
          {
            "factor": "drivetrain",
            "direction": "negative",
            "description": "FWD is the dominant drivetrain in Egypt — simpler, cheaper to maintain, and efficient for daily city driving. It's what most Egyptian buyers expect in the economy and family segments. For SUVs in Egypt, 4WD/AWD can significantly boost appeal for buyers planning Sahel, Sinai, or desert trips."
          },
          {
            "factor": "brand_origin",
            "direction": "positive",
            "description": "Nissan has a solid Egyptian presence; models like Sunny and Sentra are popular for fleet and family use, with parts widely available. Japanese brands (Toyota, Nissan, Honda, Mitsubishi) are the gold standard for resale in Egypt, backed by decades of parts availability, affordable workshop costs, and strong trust across all income levels."
          },
          {
            "factor": "engine_cc",
            "direction": "negative",
            "description": "Nissan has a solid Egyptian presence; models like Sunny and Sentra are popular for fleet and family use, with parts widely available. Mid-range engine size (1,300–1,800 cc) is the Egyptian market's mainstream. It balances daily usability with manageable fuel and licensing costs — the bulk of Hyundai, Kia, and Nissan sales fall here. This is lower than what is typical in the data."
          }
        ],
        "model_version": "v1.2.0",
        "predicted_at": "2026-05-23T22:43:39.389609+00:00"
      },
      "error": null
    },
    {
      "index": 8,
      "success": true,
      "result": {
        "fair_price": 630000,
        "negotiation_range": {
          "min_price": 550000,
          "max_price": 710000
        },
        "confidence": "high",
        "price_factors": [
          {
            "factor": "horsepower",
            "direction": "negative",
            "description": "Moderate horsepower covers the Egyptian market's mainstream sweet spot — enough for daily commuting and occasional highway trips without excessive fuel costs. Common in Hyundai Accent / Kia Cerato class. This is lower than what is typical in the data."
          },
          {
            "factor": "year",
            "direction": "positive",
            "description": "This is a relatively recent model year. First-owner resale tends to be strong in this window, especially for popular Egyptian-market models. Buyers check for agency-stamped service books and accident-free history."
          },
          {
            "factor": "brand_origin",
            "direction": "negative",
            "description": "Geely is growing in Egypt, backed by Ghabbour Auto; buyers weigh newer features against developing resale confidence. Chinese brands (MG, Chery, Geely, BYD) are rapidly growing in Egypt with competitive pricing, modern features, and expanding dealer networks. Resale confidence is improving but still trails Japanese and Korean brands for most buyers."
          },
          {
            "factor": "drivetrain",
            "direction": "negative",
            "description": "FWD is the dominant drivetrain in Egypt — simpler, cheaper to maintain, and efficient for daily city driving. It's what most Egyptian buyers expect in the economy and family segments."
          },
          {
            "factor": "engine_cc",
            "direction": "negative",
            "description": "Geely is growing in Egypt, backed by Ghabbour Auto; buyers weigh newer features against developing resale confidence. Mid-range engine size (1,300–1,800 cc) is the Egyptian market's mainstream. It balances daily usability with manageable fuel and licensing costs — the bulk of Hyundai, Kia, and Nissan sales fall here. This is lower than what is typical in the data."
          }
        ],
        "model_version": "v1.2.0",
        "predicted_at": "2026-05-23T22:43:39.882199+00:00"
      },
      "error": null
    },
    {
      "index": 9,
      "success": true,
      "result": {
        "fair_price": 1610000,
        "negotiation_range": {
          "min_price": 580000,
          "max_price": 2640000
        },
        "confidence": "low",
        "price_factors": [
          {
            "factor": "year",
            "direction": "positive",
            "description": "This is a relatively recent model year. First-owner resale tends to be strong in this window, especially for popular Egyptian-market models. Buyers check for agency-stamped service books and accident-free history."
          },
          {
            "factor": "horsepower",
            "direction": "positive",
            "description": "Higher horsepower appeals for highway cruising, loaded family trips, and upper trims. In Egypt, this range often appears in mid-size sedans (Camry, Passat) and popular SUVs (Tucson, RAV4). This is very high compared with typical listings in the data."
          },
          {
            "factor": "drivetrain",
            "direction": "negative",
            "description": "FWD is the dominant drivetrain in Egypt — simpler, cheaper to maintain, and efficient for daily city driving. It's what most Egyptian buyers expect in the economy and family segments. For SUVs in Egypt, 4WD/AWD can significantly boost appeal for buyers planning Sahel, Sinai, or desert trips."
          },
          {
            "factor": "mileage_km",
            "direction": "positive",
            "description": "Mileage is in a healthy range for the Egyptian market. This is typical for a car used mainly in-city (Cairo, Alexandria) without heavy intercity driving. Service history and consumable condition still matter. This is lower than what is typical in the data."
          },
          {
            "factor": "engine_cc",
            "direction": "negative",
            "description": "Hyundai has one of the widest service networks in Egypt, with locally assembled models holding value well due to affordable spare parts. This listing is electric; engine displacement (cc) is not a true mechanical attribute for pure EVs. If `engine_cc` appears influential here, it is likely acting as a catalog/data proxy rather than a real engine spec."
          }
        ],
        "model_version": "v1.2.0",
        "predicted_at": "2026-05-23T22:43:40.366037+00:00"
      },
      "error": null
    }
  ]
}
```

---

## Quality Notes (pre-fix observations from this test run)

These outputs were captured **before** the make-note scope fix. In some items, brand-specific notes leaked into `engine_cc` and `car_segment` factors, creating disconnected text (e.g. "Skoda Octavia is a popular fleet... Mid-range engine size..."). This has been corrected by restricting make-note prepending to `brand_origin` only.

After the fix, `engine_cc`, `car_segment`, `fuel`, and `location` factors will no longer be prefixed with brand-specific notes.
