# Batch Prediction — Expert Explanations (Sample)

This document captures two example batch requests (10 items each) and their corresponding responses, used to validate Phase 1 deterministic expert-style factor explanations.

- Endpoint: `POST /api/v1/predict/batch`
- Important: `include_factors: true` enables the expert explanations.
- Expected behavior: factor descriptions contain **no currency amounts** and always align with the returned `direction`.

## Batch Request 1 (10 items)

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

## Post-Fix Batch Responses (After Explanation Updates)

These are the latest responses after applying:
- EV-safe `engine_cc` handling.
- Removal of repetitive direction-closing sentence.
- Cleaner factor text composition.

### Post-Fix Batch Response 1

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
          "min_price": 480000,
          "max_price": 690000
        },
        "confidence": "medium",
        "price_factors": [
          {
            "factor": "year",
            "direction": "positive",
            "description": "This is a very recent model year, so buyers often expect newer condition and updated features."
          },
          {
            "factor": "horsepower",
            "direction": "negative",
            "description": "Moderate horsepower is often acceptable for daily driving, balancing performance and running costs. This is within the typical range in the data."
          },
          {
            "factor": "brand_origin",
            "direction": "negative",
            "description": "Chinese brands are increasingly common in Egypt and can offer good features for the money, while resale confidence varies by model and support network."
          },
          {
            "factor": "transmission",
            "direction": "negative",
            "description": "Manual transmission can be cheaper to maintain, but many private buyers prefer automatic for daily traffic."
          },
          {
            "factor": "mileage_km",
            "direction": "positive",
            "description": "Mileage is very low, which usually suggests less wear on the engine, suspension, and interior. This is lower than what is typical in the data."
          }
        ],
        "model_version": "v1.0.0",
        "predicted_at": "2026-05-12T02:48:04.932664+00:00"
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
            "description": "Moderate horsepower is often acceptable for daily driving, balancing performance and running costs. This is within the typical range in the data."
          },
          {
            "factor": "year",
            "direction": "negative",
            "description": "This is an older model year, so depreciation and expected maintenance risk are more relevant to buyers."
          },
          {
            "factor": "mileage_km",
            "direction": "negative",
            "description": "Mileage is very high, which can raise buyer concern about wear and future maintenance. This is higher than what is typical in the data."
          },
          {
            "factor": "brand_origin",
            "direction": "positive",
            "description": "Nissan is common; condition and maintenance history are often important to buyers. Japanese/Korean brands are often associated with perceived reliability and parts availability in Egypt."
          },
          {
            "factor": "drivetrain",
            "direction": "negative",
            "description": "FWD is economical and common, and it is usually cheaper to maintain for daily driving."
          }
        ],
        "model_version": "v1.0.0",
        "predicted_at": "2026-05-12T02:48:05.481886+00:00"
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
            "description": "This is a mid-age model year; condition and maintenance history become more important to buyers."
          },
          {
            "factor": "drivetrain",
            "direction": "negative",
            "description": "FWD is economical and common, and it is usually cheaper to maintain for daily driving."
          },
          {
            "factor": "mileage_km",
            "direction": "negative",
            "description": "Mileage is on the higher side, which can imply more wear and higher near-term maintenance costs. This is within the typical range in the data."
          },
          {
            "factor": "brand_origin",
            "direction": "positive",
            "description": "European brands can have a premium image, but buyers often price in higher maintenance costs."
          },
          {
            "factor": "engine_cc",
            "direction": "negative",
            "description": "Mid-size engines balance daily usability with reasonable running costs. This is lower than what is typical in the data."
          }
        ],
        "model_version": "v1.0.0",
        "predicted_at": "2026-05-12T02:48:05.957722+00:00"
      },
      "error": null
    },
    {
      "index": 3,
      "success": true,
      "result": {
        "fair_price": 710000,
        "negotiation_range": {
          "min_price": 580000,
          "max_price": 840000
        },
        "confidence": "medium",
        "price_factors": [
          {
            "factor": "brand_origin",
            "direction": "negative",
            "description": "Chinese brands are increasingly common in Egypt and can offer good features for the money, while resale confidence varies by model and support network."
          },
          {
            "factor": "year",
            "direction": "positive",
            "description": "This is a relatively recent model year, which typically comes with newer condition expectations compared with older versions."
          },
          {
            "factor": "drivetrain",
            "direction": "negative",
            "description": "FWD is economical and common, and it is usually cheaper to maintain for daily driving."
          },
          {
            "factor": "mileage_km",
            "direction": "positive",
            "description": "Mileage is very low, which usually suggests less wear on the engine, suspension, and interior. This is lower than what is typical in the data."
          },
          {
            "factor": "horsepower",
            "direction": "negative",
            "description": "Higher horsepower can increase appeal for highway driving, loaded family use, and premium trims. This is higher than what is typical in the data."
          }
        ],
        "model_version": "v1.0.0",
        "predicted_at": "2026-05-12T02:48:06.432165+00:00"
      },
      "error": null
    },
    {
      "index": 4,
      "success": true,
      "result": {
        "fair_price": 320000,
        "negotiation_range": {
          "min_price": 280000,
          "max_price": 360000
        },
        "confidence": "high",
        "price_factors": [
          {
            "factor": "year",
            "direction": "negative",
            "description": "This is an older model year, so depreciation and expected maintenance risk are more relevant to buyers."
          },
          {
            "factor": "transmission",
            "direction": "negative",
            "description": "Manual transmission can be cheaper to maintain, but many private buyers prefer automatic for daily traffic."
          },
          {
            "factor": "horsepower",
            "direction": "negative",
            "description": "Moderate horsepower is often acceptable for daily driving, balancing performance and running costs. This is within the typical range in the data."
          },
          {
            "factor": "mileage_km",
            "direction": "negative",
            "description": "Mileage is very high, which can raise buyer concern about wear and future maintenance. This is higher than what is typical in the data."
          },
          {
            "factor": "drivetrain",
            "direction": "negative",
            "description": "FWD is economical and common, and it is usually cheaper to maintain for daily driving."
          }
        ],
        "model_version": "v1.0.0",
        "predicted_at": "2026-05-12T02:48:06.876838+00:00"
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
            "description": "Lower horsepower usually aligns with economy-focused driving, but may feel underpowered in larger cars. This is lower than what is typical in the data."
          },
          {
            "factor": "transmission",
            "direction": "negative",
            "description": "Manual transmission can be cheaper to maintain, but many private buyers prefer automatic for daily traffic."
          },
          {
            "factor": "year",
            "direction": "negative",
            "description": "This is a mid-age model year; condition and maintenance history become more important to buyers."
          },
          {
            "factor": "mileage_km",
            "direction": "negative",
            "description": "Mileage is very high, which can raise buyer concern about wear and future maintenance. This is higher than what is typical in the data."
          },
          {
            "factor": "drivetrain",
            "direction": "negative",
            "description": "FWD is economical and common, and it is usually cheaper to maintain for daily driving."
          }
        ],
        "model_version": "v1.0.0",
        "predicted_at": "2026-05-12T02:48:07.324318+00:00"
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
            "description": "This is a very old model year; inspections and maintenance history matter a lot to buyers."
          },
          {
            "factor": "horsepower",
            "direction": "negative",
            "description": "Moderate horsepower is often acceptable for daily driving, balancing performance and running costs. This is lower than what is typical in the data."
          },
          {
            "factor": "brand_origin",
            "direction": "negative",
            "description": "Chevrolet demand can be model-dependent; condition and serviceability often matter. American brands are model-dependent; demand often depends on parts availability and common service experience."
          },
          {
            "factor": "transmission",
            "direction": "negative",
            "description": "Manual transmission can be cheaper to maintain, but many private buyers prefer automatic for daily traffic."
          },
          {
            "factor": "mileage_km",
            "direction": "negative",
            "description": "Mileage is very high, which can raise buyer concern about wear and future maintenance. This is very high compared with typical listings in the data."
          }
        ],
        "model_version": "v1.0.0",
        "predicted_at": "2026-05-12T02:48:07.762630+00:00"
      },
      "error": null
    },
    {
      "index": 7,
      "success": true,
      "result": {
        "fair_price": 350000,
        "negotiation_range": {
          "min_price": 310000,
          "max_price": 390000
        },
        "confidence": "high",
        "price_factors": [
          {
            "factor": "horsepower",
            "direction": "negative",
            "description": "Lower horsepower usually aligns with economy-focused driving, but may feel underpowered in larger cars. This is lower than what is typical in the data."
          },
          {
            "factor": "transmission",
            "direction": "negative",
            "description": "Manual transmission can be cheaper to maintain, but many private buyers prefer automatic for daily traffic."
          },
          {
            "factor": "year",
            "direction": "positive",
            "description": "This is a mid-age model year; condition and maintenance history become more important to buyers."
          },
          {
            "factor": "car_segment",
            "direction": "negative",
            "description": "City/economy segments are valued for affordability and efficiency rather than premium positioning."
          },
          {
            "factor": "brand_origin",
            "direction": "positive",
            "description": "Japanese/Korean brands are often associated with perceived reliability and parts availability in Egypt."
          }
        ],
        "model_version": "v1.0.0",
        "predicted_at": "2026-05-12T02:48:08.218317+00:00"
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
            "description": "This is a relatively recent model year, which typically comes with newer condition expectations compared with older versions."
          },
          {
            "factor": "brand_origin",
            "direction": "negative",
            "description": "Chinese brands are increasingly common in Egypt and can offer good features for the money, while resale confidence varies by model and support network."
          },
          {
            "factor": "drivetrain",
            "direction": "negative",
            "description": "FWD is economical and common, and it is usually cheaper to maintain for daily driving. For SUVs, drivetrain choices can influence perceived capability and resale."
          },
          {
            "factor": "engine_cc",
            "direction": "negative",
            "description": "Mid-size engines balance daily usability with reasonable running costs. This is lower than what is typical in the data."
          },
          {
            "factor": "transmission",
            "direction": "positive",
            "description": "Automatic transmission is often preferred in Egyptian city traffic for stop-and-go comfort and ease of driving."
          }
        ],
        "model_version": "v1.0.0",
        "predicted_at": "2026-05-12T02:48:08.675651+00:00"
      },
      "error": null
    },
    {
      "index": 9,
      "success": true,
      "result": {
        "fair_price": 670000,
        "negotiation_range": {
          "min_price": 590000,
          "max_price": 750000
        },
        "confidence": "high",
        "price_factors": [
          {
            "factor": "horsepower",
            "direction": "negative",
            "description": "Moderate horsepower is often acceptable for daily driving, balancing performance and running costs. This is within the typical range in the data."
          },
          {
            "factor": "year",
            "direction": "positive",
            "description": "This is a mid-age model year; condition and maintenance history become more important to buyers."
          },
          {
            "factor": "mileage_km",
            "direction": "negative",
            "description": "Mileage is on the higher side, which can imply more wear and higher near-term maintenance costs. This is within the typical range in the data."
          },
          {
            "factor": "drivetrain",
            "direction": "negative",
            "description": "FWD is economical and common, and it is usually cheaper to maintain for daily driving."
          },
          {
            "factor": "transmission",
            "direction": "positive",
            "description": "Automatic transmission is often preferred in Egyptian city traffic for stop-and-go comfort and ease of driving."
          }
        ],
        "model_version": "v1.0.0",
        "predicted_at": "2026-05-12T02:48:09.120586+00:00"
      },
      "error": null
    }
  ]
}
```

### Post-Fix Batch Response 2

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
          "min_price": 920000,
          "max_price": 1170000
        },
        "confidence": "high",
        "price_factors": [
          {
            "factor": "year",
            "direction": "positive",
            "description": "This is a relatively recent model year, which typically comes with newer condition expectations compared with older versions."
          },
          {
            "factor": "horsepower",
            "direction": "negative",
            "description": "Moderate horsepower is often acceptable for daily driving, balancing performance and running costs. This is within the typical range in the data."
          },
          {
            "factor": "drivetrain",
            "direction": "negative",
            "description": "FWD is economical and common, and it is usually cheaper to maintain for daily driving."
          },
          {
            "factor": "brand_origin",
            "direction": "positive",
            "description": "Toyota is common in Egypt, and service/parts availability often influence resale. Japanese/Korean brands are often associated with perceived reliability and parts availability in Egypt."
          },
          {
            "factor": "mileage_km",
            "direction": "positive",
            "description": "Mileage is in a generally good range; condition and service history still matter a lot. This is lower than what is typical in the data."
          }
        ],
        "model_version": "v1.0.0",
        "predicted_at": "2026-05-12T02:48:50.877061+00:00"
      },
      "error": null
    },
    {
      "index": 1,
      "success": true,
      "result": {
        "fair_price": 4720000,
        "negotiation_range": {
          "min_price": 2730000,
          "max_price": 6700000
        },
        "confidence": "low",
        "price_factors": [
          {
            "factor": "horsepower",
            "direction": "positive",
            "description": "Very high horsepower can signal premium/performance positioning, but running costs may be higher. This is very high compared with typical listings in the data."
          },
          {
            "factor": "engine_cc",
            "direction": "positive",
            "description": "Very large engines can indicate premium/performance positioning, but buyers may factor in higher running costs. This is very high compared with typical listings in the data."
          },
          {
            "factor": "year",
            "direction": "positive",
            "description": "This is a mid-age model year; condition and maintenance history become more important to buyers."
          },
          {
            "factor": "drivetrain",
            "direction": "positive",
            "description": "AWD/4WD can add appeal for SUVs and rough-road use, but it may increase fuel and maintenance costs. For SUVs, drivetrain choices can influence perceived capability and resale."
          },
          {
            "factor": "car_segment",
            "direction": "positive",
            "description": "Luxury SUVs can be highly valued for space and image, but buyers often price in higher running and maintenance costs."
          }
        ],
        "model_version": "v1.0.0",
        "predicted_at": "2026-05-12T02:48:51.377825+00:00"
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
            "description": "RWD can be valued in some premium or performance-oriented cars, though running costs can be higher."
          },
          {
            "factor": "horsepower",
            "direction": "positive",
            "description": "Higher horsepower can increase appeal for highway driving, loaded family use, and premium trims. This is higher than what is typical in the data."
          },
          {
            "factor": "mileage_km",
            "direction": "negative",
            "description": "Mileage is on the higher side, which can imply more wear and higher near-term maintenance costs. This is higher than what is typical in the data."
          },
          {
            "factor": "transmission",
            "direction": "positive",
            "description": "Automatic transmission is often preferred in Egyptian city traffic for stop-and-go comfort and ease of driving."
          },
          {
            "factor": "year",
            "direction": "negative",
            "description": "This is a mid-age model year; condition and maintenance history become more important to buyers."
          }
        ],
        "model_version": "v1.0.0",
        "predicted_at": "2026-05-12T02:48:51.864396+00:00"
      },
      "error": null
    },
    {
      "index": 3,
      "success": true,
      "result": {
        "fair_price": 3890000,
        "negotiation_range": {
          "min_price": 3160000,
          "max_price": 4610000
        },
        "confidence": "medium",
        "price_factors": [
          {
            "factor": "year",
            "direction": "positive",
            "description": "This is a relatively recent model year, which typically comes with newer condition expectations compared with older versions."
          },
          {
            "factor": "horsepower",
            "direction": "positive",
            "description": "Higher horsepower can increase appeal for highway driving, loaded family use, and premium trims. This is very high compared with typical listings in the data."
          },
          {
            "factor": "drivetrain",
            "direction": "positive",
            "description": "AWD/4WD can add appeal for SUVs and rough-road use, but it may increase fuel and maintenance costs. For SUVs, drivetrain choices can influence perceived capability and resale."
          },
          {
            "factor": "mileage_km",
            "direction": "positive",
            "description": "Mileage is very low, which usually suggests less wear on the engine, suspension, and interior. This is lower than what is typical in the data."
          },
          {
            "factor": "car_segment",
            "direction": "positive",
            "description": "Luxury SUVs can be highly valued for space and image, but buyers often price in higher running and maintenance costs."
          }
        ],
        "model_version": "v1.0.0",
        "predicted_at": "2026-05-12T02:48:52.320999+00:00"
      },
      "error": null
    },
    {
      "index": 4,
      "success": true,
      "result": {
        "fair_price": 920000,
        "negotiation_range": {
          "min_price": 580000,
          "max_price": 1250000
        },
        "confidence": "low",
        "price_factors": [
          {
            "factor": "year",
            "direction": "negative",
            "description": "This is an older model year, so depreciation and expected maintenance risk are more relevant to buyers."
          },
          {
            "factor": "drivetrain",
            "direction": "positive",
            "description": "RWD can be valued in some premium or performance-oriented cars, though running costs can be higher."
          },
          {
            "factor": "mileage_km",
            "direction": "negative",
            "description": "Mileage is very high, which can raise buyer concern about wear and future maintenance. This is higher than what is typical in the data."
          },
          {
            "factor": "horsepower",
            "direction": "negative",
            "description": "Moderate horsepower is often acceptable for daily driving, balancing performance and running costs. This is within the typical range in the data."
          },
          {
            "factor": "transmission",
            "direction": "positive",
            "description": "Automatic transmission is often preferred in Egyptian city traffic for stop-and-go comfort and ease of driving."
          }
        ],
        "model_version": "v1.0.0",
        "predicted_at": "2026-05-12T02:48:52.786720+00:00"
      },
      "error": null
    },
    {
      "index": 5,
      "success": true,
      "result": {
        "fair_price": 1520000,
        "negotiation_range": {
          "min_price": 1340000,
          "max_price": 1710000
        },
        "confidence": "high",
        "price_factors": [
          {
            "factor": "horsepower",
            "direction": "positive",
            "description": "Higher horsepower can increase appeal for highway driving, loaded family use, and premium trims. This is very high compared with typical listings in the data."
          },
          {
            "factor": "mileage_km",
            "direction": "negative",
            "description": "Mileage is on the higher side, which can imply more wear and higher near-term maintenance costs. This is within the typical range in the data."
          },
          {
            "factor": "transmission",
            "direction": "positive",
            "description": "Automatic transmission is often preferred in Egyptian city traffic for stop-and-go comfort and ease of driving."
          },
          {
            "factor": "year",
            "direction": "positive",
            "description": "This is a mid-age model year; condition and maintenance history become more important to buyers."
          },
          {
            "factor": "engine_cc",
            "direction": "positive",
            "description": "Larger engines can support stronger performance, but fuel, licensing, and maintenance costs may be higher. This is very high compared with typical listings in the data."
          }
        ],
        "model_version": "v1.0.0",
        "predicted_at": "2026-05-12T02:48:53.261425+00:00"
      },
      "error": null
    },
    {
      "index": 6,
      "success": true,
      "result": {
        "fair_price": 4700000,
        "negotiation_range": {
          "min_price": 440000,
          "max_price": 8960000
        },
        "confidence": "low",
        "price_factors": [
          {
            "factor": "horsepower",
            "direction": "positive",
            "description": "Very high horsepower can signal premium/performance positioning, but running costs may be higher. This is very high compared with typical listings in the data."
          },
          {
            "factor": "engine_cc",
            "direction": "positive",
            "description": "Very large engines can indicate premium/performance positioning, but buyers may factor in higher running costs. This is very high compared with typical listings in the data."
          },
          {
            "factor": "year",
            "direction": "positive",
            "description": "This is a mid-age model year; condition and maintenance history become more important to buyers."
          },
          {
            "factor": "car_segment",
            "direction": "positive",
            "description": "Luxury SUVs can be highly valued for space and image, but buyers often price in higher running and maintenance costs."
          },
          {
            "factor": "brand_origin",
            "direction": "positive",
            "description": "European brands can have a premium image, but buyers often price in higher maintenance costs."
          }
        ],
        "model_version": "v1.0.0",
        "predicted_at": "2026-05-12T02:48:53.711850+00:00"
      },
      "error": null
    },
    {
      "index": 7,
      "success": true,
      "result": {
        "fair_price": 880000,
        "negotiation_range": {
          "min_price": 770000,
          "max_price": 980000
        },
        "confidence": "high",
        "price_factors": [
          {
            "factor": "year",
            "direction": "positive",
            "description": "This is a mid-age model year; condition and maintenance history become more important to buyers."
          },
          {
            "factor": "mileage_km",
            "direction": "negative",
            "description": "Mileage is on the higher side, which can imply more wear and higher near-term maintenance costs. This is within the typical range in the data."
          },
          {
            "factor": "drivetrain",
            "direction": "negative",
            "description": "FWD is economical and common, and it is usually cheaper to maintain for daily driving. For SUVs, drivetrain choices can influence perceived capability and resale."
          },
          {
            "factor": "brand_origin",
            "direction": "positive",
            "description": "Nissan is common; condition and maintenance history are often important to buyers. Japanese/Korean brands are often associated with perceived reliability and parts availability in Egypt."
          },
          {
            "factor": "engine_cc",
            "direction": "negative",
            "description": "Mid-size engines balance daily usability with reasonable running costs. This is lower than what is typical in the data."
          }
        ],
        "model_version": "v1.0.0",
        "predicted_at": "2026-05-12T02:48:54.160124+00:00"
      },
      "error": null
    },
    {
      "index": 8,
      "success": true,
      "result": {
        "fair_price": 630000,
        "negotiation_range": {
          "min_price": 560000,
          "max_price": 710000
        },
        "confidence": "high",
        "price_factors": [
          {
            "factor": "horsepower",
            "direction": "negative",
            "description": "Moderate horsepower is often acceptable for daily driving, balancing performance and running costs. This is lower than what is typical in the data."
          },
          {
            "factor": "year",
            "direction": "positive",
            "description": "This is a relatively recent model year, which typically comes with newer condition expectations compared with older versions."
          },
          {
            "factor": "brand_origin",
            "direction": "negative",
            "description": "Chinese brands are increasingly common in Egypt and can offer good features for the money, while resale confidence varies by model and support network."
          },
          {
            "factor": "drivetrain",
            "direction": "negative",
            "description": "FWD is economical and common, and it is usually cheaper to maintain for daily driving."
          },
          {
            "factor": "engine_cc",
            "direction": "negative",
            "description": "Mid-size engines balance daily usability with reasonable running costs. This is lower than what is typical in the data."
          }
        ],
        "model_version": "v1.0.0",
        "predicted_at": "2026-05-12T02:48:54.652248+00:00"
      },
      "error": null
    },
    {
      "index": 9,
      "success": true,
      "result": {
        "fair_price": 1610000,
        "negotiation_range": {
          "min_price": 1240000,
          "max_price": 1980000
        },
        "confidence": "medium",
        "price_factors": [
          {
            "factor": "year",
            "direction": "positive",
            "description": "This is a relatively recent model year, which typically comes with newer condition expectations compared with older versions."
          },
          {
            "factor": "horsepower",
            "direction": "positive",
            "description": "Higher horsepower can increase appeal for highway driving, loaded family use, and premium trims. This is very high compared with typical listings in the data."
          },
          {
            "factor": "drivetrain",
            "direction": "negative",
            "description": "FWD is economical and common, and it is usually cheaper to maintain for daily driving. For SUVs, drivetrain choices can influence perceived capability and resale."
          },
          {
            "factor": "mileage_km",
            "direction": "positive",
            "description": "Mileage is in a generally good range; condition and service history still matter a lot. This is lower than what is typical in the data."
          },
          {
            "factor": "engine_cc",
            "direction": "negative",
            "description": "This listing is electric; engine displacement (cc) is not a true mechanical attribute for pure EVs. If `engine_cc` appears influential here, it is likely acting as a catalog/data proxy rather than a real engine spec."
          }
        ],
        "model_version": "v1.0.0",
        "predicted_at": "2026-05-12T02:48:55.105688+00:00"
      },
      "error": null
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
          "min_price": 480000,
          "max_price": 690000
        },
        "confidence": "medium",
        "price_factors": [
          {
            "factor": "year",
            "direction": "positive",
            "description": "This is a very recent model year, so buyers often expect newer condition and updated features. In this case, the model treats this as price-supportive, so it tends to increase the estimated market value."
          },
          {
            "factor": "horsepower",
            "direction": "negative",
            "description": "Moderate horsepower is often acceptable for daily driving, balancing performance and running costs. This is within the typical range in the data. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          },
          {
            "factor": "brand_origin",
            "direction": "negative",
            "description": "Chinese brands are increasingly common in Egypt and can offer good features for the money, while resale confidence varies by model and support network. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          },
          {
            "factor": "transmission",
            "direction": "negative",
            "description": "Manual transmission can be cheaper to maintain, but many private buyers prefer automatic for daily traffic. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          },
          {
            "factor": "mileage_km",
            "direction": "positive",
            "description": "Mileage is very low, which usually suggests less wear on the engine, suspension, and interior. This is lower than what is typical in the data. In this case, the model treats this as price-supportive, so it tends to increase the estimated market value."
          }
        ],
        "model_version": "v1.0.0",
        "predicted_at": "2026-05-12T01:46:17.392795+00:00"
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
            "description": "Moderate horsepower is often acceptable for daily driving, balancing performance and running costs. This is within the typical range in the data. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          },
          {
            "factor": "year",
            "direction": "negative",
            "description": "This is an older model year, so depreciation and expected maintenance risk usually weigh on resale. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          },
          {
            "factor": "mileage_km",
            "direction": "negative",
            "description": "Mileage is very high, which can raise buyer concern about wear and future maintenance. This is higher than what is typical in the data. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          },
          {
            "factor": "brand_origin",
            "direction": "positive",
            "description": "Nissan is common; condition and maintenance history are often important to buyers. Japanese/Korean brands often have strong resale due to perceived reliability and parts availability. In this case, the model treats this as price-supportive, so it tends to increase the estimated market value."
          },
          {
            "factor": "drivetrain",
            "direction": "negative",
            "description": "FWD is economical and common, and it is usually cheaper to maintain for daily driving. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          }
        ],
        "model_version": "v1.0.0",
        "predicted_at": "2026-05-12T01:46:17.953327+00:00"
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
            "description": "This is a mid-age model year; condition and maintenance history become more important to buyers. In this case, the model treats this as price-supportive, so it tends to increase the estimated market value."
          },
          {
            "factor": "drivetrain",
            "direction": "negative",
            "description": "FWD is economical and common, and it is usually cheaper to maintain for daily driving. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          },
          {
            "factor": "mileage_km",
            "direction": "negative",
            "description": "Mileage is on the higher side, which can imply more wear and higher near-term maintenance costs. This is within the typical range in the data. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          },
          {
            "factor": "brand_origin",
            "direction": "positive",
            "description": "European brands can have a premium image, but buyers often price in higher maintenance costs. In this case, the model treats this as price-supportive, so it tends to increase the estimated market value."
          },
          {
            "factor": "engine_cc",
            "direction": "negative",
            "description": "Mid-size engines balance daily usability with reasonable running costs. This is lower than what is typical in the data. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          }
        ],
        "model_version": "v1.0.0",
        "predicted_at": "2026-05-12T01:46:18.445795+00:00"
      },
      "error": null
    },
    {
      "index": 3,
      "success": true,
      "result": {
        "fair_price": 710000,
        "negotiation_range": {
          "min_price": 580000,
          "max_price": 840000
        },
        "confidence": "medium",
        "price_factors": [
          {
            "factor": "brand_origin",
            "direction": "negative",
            "description": "Chinese brands are increasingly common in Egypt and can offer good features for the money, while resale confidence varies by model and support network. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          },
          {
            "factor": "year",
            "direction": "positive",
            "description": "This is a relatively recent model year, which usually supports resale compared with older versions. In this case, the model treats this as price-supportive, so it tends to increase the estimated market value."
          },
          {
            "factor": "drivetrain",
            "direction": "negative",
            "description": "FWD is economical and common, and it is usually cheaper to maintain for daily driving. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          },
          {
            "factor": "mileage_km",
            "direction": "positive",
            "description": "Mileage is very low, which usually suggests less wear on the engine, suspension, and interior. This is lower than what is typical in the data. In this case, the model treats this as price-supportive, so it tends to increase the estimated market value."
          },
          {
            "factor": "horsepower",
            "direction": "negative",
            "description": "Higher horsepower can increase appeal for highway driving, loaded family use, and premium trims. This is higher than what is typical in the data. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          }
        ],
        "model_version": "v1.0.0",
        "predicted_at": "2026-05-12T01:46:18.918603+00:00"
      },
      "error": null
    },
    {
      "index": 4,
      "success": true,
      "result": {
        "fair_price": 320000,
        "negotiation_range": {
          "min_price": 280000,
          "max_price": 360000
        },
        "confidence": "high",
        "price_factors": [
          {
            "factor": "year",
            "direction": "negative",
            "description": "This is an older model year, so depreciation and expected maintenance risk usually weigh on resale. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          },
          {
            "factor": "transmission",
            "direction": "negative",
            "description": "Manual transmission can be cheaper to maintain, but many private buyers prefer automatic for daily traffic. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          },
          {
            "factor": "horsepower",
            "direction": "negative",
            "description": "Moderate horsepower is often acceptable for daily driving, balancing performance and running costs. This is within the typical range in the data. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          },
          {
            "factor": "mileage_km",
            "direction": "negative",
            "description": "Mileage is very high, which can raise buyer concern about wear and future maintenance. This is higher than what is typical in the data. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          },
          {
            "factor": "drivetrain",
            "direction": "negative",
            "description": "FWD is economical and common, and it is usually cheaper to maintain for daily driving. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          }
        ],
        "model_version": "v1.0.0",
        "predicted_at": "2026-05-12T01:46:19.366376+00:00"
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
            "description": "Lower horsepower usually aligns with economy-focused driving, but may feel underpowered in larger cars. This is lower than what is typical in the data. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          },
          {
            "factor": "transmission",
            "direction": "negative",
            "description": "Manual transmission can be cheaper to maintain, but many private buyers prefer automatic for daily traffic. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          },
          {
            "factor": "year",
            "direction": "negative",
            "description": "This is a mid-age model year; condition and maintenance history become more important to buyers. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          },
          {
            "factor": "mileage_km",
            "direction": "negative",
            "description": "Mileage is very high, which can raise buyer concern about wear and future maintenance. This is higher than what is typical in the data. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          },
          {
            "factor": "drivetrain",
            "direction": "negative",
            "description": "FWD is economical and common, and it is usually cheaper to maintain for daily driving. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          }
        ],
        "model_version": "v1.0.0",
        "predicted_at": "2026-05-12T01:46:19.804092+00:00"
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
            "description": "This is a very old model year; inspections and maintenance history matter a lot to buyers. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          },
          {
            "factor": "horsepower",
            "direction": "negative",
            "description": "Moderate horsepower is often acceptable for daily driving, balancing performance and running costs. This is lower than what is typical in the data. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          },
          {
            "factor": "brand_origin",
            "direction": "negative",
            "description": "Chevrolet demand can be model-dependent; condition and serviceability often matter. American brands are model-dependent; demand often depends on parts availability and common service experience. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          },
          {
            "factor": "transmission",
            "direction": "negative",
            "description": "Manual transmission can be cheaper to maintain, but many private buyers prefer automatic for daily traffic. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          },
          {
            "factor": "mileage_km",
            "direction": "negative",
            "description": "Mileage is very high, which can raise buyer concern about wear and future maintenance. This is very high compared with typical listings in the data. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          }
        ],
        "model_version": "v1.0.0",
        "predicted_at": "2026-05-12T01:46:20.242430+00:00"
      },
      "error": null
    },
    {
      "index": 7,
      "success": true,
      "result": {
        "fair_price": 350000,
        "negotiation_range": {
          "min_price": 310000,
          "max_price": 390000
        },
        "confidence": "high",
        "price_factors": [
          {
            "factor": "horsepower",
            "direction": "negative",
            "description": "Lower horsepower usually aligns with economy-focused driving, but may feel underpowered in larger cars. This is lower than what is typical in the data. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          },
          {
            "factor": "transmission",
            "direction": "negative",
            "description": "Manual transmission can be cheaper to maintain, but many private buyers prefer automatic for daily traffic. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          },
          {
            "factor": "year",
            "direction": "positive",
            "description": "This is a mid-age model year; condition and maintenance history become more important to buyers. In this case, the model treats this as price-supportive, so it tends to increase the estimated market value."
          },
          {
            "factor": "car_segment",
            "direction": "negative",
            "description": "City/economy segments are valued for affordability and efficiency rather than premium positioning. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          },
          {
            "factor": "brand_origin",
            "direction": "positive",
            "description": "Japanese/Korean brands often have strong resale due to perceived reliability and parts availability. In this case, the model treats this as price-supportive, so it tends to increase the estimated market value."
          }
        ],
        "model_version": "v1.0.0",
        "predicted_at": "2026-05-12T01:46:20.676624+00:00"
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
            "description": "This is a relatively recent model year, which usually supports resale compared with older versions. In this case, the model treats this as price-supportive, so it tends to increase the estimated market value."
          },
          {
            "factor": "brand_origin",
            "direction": "negative",
            "description": "Chinese brands are increasingly common in Egypt and can offer good features for the money, while resale confidence varies by model and support network. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          },
          {
            "factor": "drivetrain",
            "direction": "negative",
            "description": "FWD is economical and common, and it is usually cheaper to maintain for daily driving. For SUVs, drivetrain choices can influence perceived capability and resale. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          },
          {
            "factor": "engine_cc",
            "direction": "negative",
            "description": "Mid-size engines balance daily usability with reasonable running costs. This is lower than what is typical in the data. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          },
          {
            "factor": "transmission",
            "direction": "positive",
            "description": "Automatic transmission is often preferred in Egyptian city traffic, which can support demand and resale. In this case, the model treats this as price-supportive, so it tends to increase the estimated market value."
          }
        ],
        "model_version": "v1.0.0",
        "predicted_at": "2026-05-12T01:46:21.112847+00:00"
      },
      "error": null
    },
    {
      "index": 9,
      "success": true,
      "result": {
        "fair_price": 670000,
        "negotiation_range": {
          "min_price": 590000,
          "max_price": 750000
        },
        "confidence": "high",
        "price_factors": [
          {
            "factor": "horsepower",
            "direction": "negative",
            "description": "Moderate horsepower is often acceptable for daily driving, balancing performance and running costs. This is within the typical range in the data. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          },
          {
            "factor": "year",
            "direction": "positive",
            "description": "This is a mid-age model year; condition and maintenance history become more important to buyers. In this case, the model treats this as price-supportive, so it tends to increase the estimated market value."
          },
          {
            "factor": "mileage_km",
            "direction": "negative",
            "description": "Mileage is on the higher side, which can imply more wear and higher near-term maintenance costs. This is within the typical range in the data. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          },
          {
            "factor": "drivetrain",
            "direction": "negative",
            "description": "FWD is economical and common, and it is usually cheaper to maintain for daily driving. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          },
          {
            "factor": "transmission",
            "direction": "positive",
            "description": "Automatic transmission is often preferred in Egyptian city traffic, which can support demand and resale. In this case, the model treats this as price-supportive, so it tends to increase the estimated market value."
          }
        ],
        "model_version": "v1.0.0",
        "predicted_at": "2026-05-12T01:46:21.550647+00:00"
      },
      "error": null
    }
  ]
}
```

## Batch Request 2 (10 items)

```json
{
  "items": [
    {
      "brand": "Toyota",
      "model": "Corolla",
      "year": 2021,
      "mileage_km": 42000,
      "transmission": "automatic",
      "fuel": "petrol",
      "location": "Maadi",
      "include_factors": true
    },
    {
      "brand": "Toyota",
      "model": "Land Cruiser",
      "year": 2020,
      "mileage_km": 78000,
      "transmission": "automatic",
      "fuel": "petrol",
      "location": "Coastal & Resorts",
      "include_factors": true
    },
    {
      "brand": "Mercedes",
      "model": "C180",
      "year": 2016,
      "mileage_km": 130000,
      "transmission": "automatic",
      "fuel": "petrol",
      "location": "Heliopolis",
      "include_factors": true
    },
    {
      "brand": "Mercedes",
      "model": "GLC200",
      "year": 2023,
      "mileage_km": 22000,
      "transmission": "automatic",
      "fuel": "petrol",
      "location": "New Cairo",
      "include_factors": true
    },
    {
      "brand": "BMW",
      "model": "316",
      "year": 2014,
      "mileage_km": 155000,
      "transmission": "automatic",
      "fuel": "petrol",
      "location": "Nasr City",
      "include_factors": true
    },
    {
      "brand": "Audi",
      "model": "A4",
      "year": 2017,
      "mileage_km": 115000,
      "transmission": "automatic",
      "fuel": "petrol",
      "location": "Giza",
      "include_factors": true
    },
    {
      "brand": "Porsche",
      "model": "Cayenne",
      "year": 2019,
      "mileage_km": 65000,
      "transmission": "automatic",
      "fuel": "petrol",
      "location": "Alexandria",
      "include_factors": true
    },
    {
      "brand": "Nissan",
      "model": "Qashqai",
      "year": 2020,
      "mileage_km": 98000,
      "transmission": "Cvt",
      "fuel": "petrol",
      "location": "Cairo",
      "include_factors": true
    },
    {
      "brand": "Geely",
      "model": "Emgrand",
      "year": 2022,
      "mileage_km": 48000,
      "transmission": "automatic",
      "fuel": "hybrid",
      "location": "Other/Unknown",
      "include_factors": true
    },
    {
      "brand": "Hyundai",
      "model": "Tucson",
      "year": 2022,
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
          "min_price": 920000,
          "max_price": 1170000
        },
        "confidence": "high",
        "price_factors": [
          {
            "factor": "year",
            "direction": "positive",
            "description": "This is a relatively recent model year, which usually supports resale compared with older versions. In this case, the model treats this as price-supportive, so it tends to increase the estimated market value."
          },
          {
            "factor": "horsepower",
            "direction": "negative",
            "description": "Moderate horsepower is often acceptable for daily driving, balancing performance and running costs. This is within the typical range in the data. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          },
          {
            "factor": "drivetrain",
            "direction": "negative",
            "description": "FWD is economical and common, and it is usually cheaper to maintain for daily driving. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          },
          {
            "factor": "brand_origin",
            "direction": "positive",
            "description": "Toyota is common in Egypt, and service/parts availability often influence resale. Japanese/Korean brands often have strong resale due to perceived reliability and parts availability. In this case, the model treats this as price-supportive, so it tends to increase the estimated market value."
          },
          {
            "factor": "mileage_km",
            "direction": "positive",
            "description": "Mileage is in a generally good range; condition and service history still matter a lot. This is lower than what is typical in the data. In this case, the model treats this as price-supportive, so it tends to increase the estimated market value."
          }
        ],
        "model_version": "v1.0.0",
        "predicted_at": "2026-05-12T01:47:50.901410+00:00"
      },
      "error": null
    },
    {
      "index": 1,
      "success": true,
      "result": {
        "fair_price": 4720000,
        "negotiation_range": {
          "min_price": 2730000,
          "max_price": 6700000
        },
        "confidence": "low",
        "price_factors": [
          {
            "factor": "horsepower",
            "direction": "positive",
            "description": "Very high horsepower can signal premium/performance positioning, but running costs may be higher. This is very high compared with typical listings in the data. In this case, the model treats this as price-supportive, so it tends to increase the estimated market value."
          },
          {
            "factor": "engine_cc",
            "direction": "positive",
            "description": "Very large engines can indicate premium/performance positioning, but buyers may factor in higher running costs. This is very high compared with typical listings in the data. In this case, the model treats this as price-supportive, so it tends to increase the estimated market value."
          },
          {
            "factor": "year",
            "direction": "positive",
            "description": "This is a mid-age model year; condition and maintenance history become more important to buyers. In this case, the model treats this as price-supportive, so it tends to increase the estimated market value."
          },
          {
            "factor": "drivetrain",
            "direction": "positive",
            "description": "AWD/4WD can add appeal for SUVs and rough-road use, but it may increase fuel and maintenance costs. For SUVs, drivetrain choices can influence perceived capability and resale. In this case, the model treats this as price-supportive, so it tends to increase the estimated market value."
          },
          {
            "factor": "car_segment",
            "direction": "positive",
            "description": "Toyota is common in Egypt, and service/parts availability often influence resale. Luxury SUVs can be highly valued for space and image, but buyers often price in higher running and maintenance costs. In this case, the model treats this as price-supportive, so it tends to increase the estimated market value."
          }
        ],
        "model_version": "v1.0.0",
        "predicted_at": "2026-05-12T01:47:51.430927+00:00"
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
            "description": "RWD can be valued in some premium or performance-oriented cars, though running costs can be higher. In this case, the model treats this as price-supportive, so it tends to increase the estimated market value."
          },
          {
            "factor": "horsepower",
            "direction": "positive",
            "description": "Higher horsepower can increase appeal for highway driving, loaded family use, and premium trims. This is higher than what is typical in the data. In this case, the model treats this as price-supportive, so it tends to increase the estimated market value."
          },
          {
            "factor": "mileage_km",
            "direction": "negative",
            "description": "Mileage is on the higher side, which can imply more wear and higher near-term maintenance costs. This is higher than what is typical in the data. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          },
          {
            "factor": "transmission",
            "direction": "positive",
            "description": "Automatic transmission is often preferred in Egyptian city traffic, which can support demand and resale. In this case, the model treats this as price-supportive, so it tends to increase the estimated market value."
          },
          {
            "factor": "year",
            "direction": "negative",
            "description": "This is a mid-age model year; condition and maintenance history become more important to buyers. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          }
        ],
        "model_version": "v1.0.0",
        "predicted_at": "2026-05-12T01:47:51.915290+00:00"
      },
      "error": null
    },
    {
      "index": 3,
      "success": true,
      "result": {
        "fair_price": 3890000,
        "negotiation_range": {
          "min_price": 3160000,
          "max_price": 4610000
        },
        "confidence": "medium",
        "price_factors": [
          {
            "factor": "year",
            "direction": "positive",
            "description": "This is a relatively recent model year, which usually supports resale compared with older versions. In this case, the model treats this as price-supportive, so it tends to increase the estimated market value."
          },
          {
            "factor": "horsepower",
            "direction": "positive",
            "description": "Higher horsepower can increase appeal for highway driving, loaded family use, and premium trims. This is very high compared with typical listings in the data. In this case, the model treats this as price-supportive, so it tends to increase the estimated market value."
          },
          {
            "factor": "drivetrain",
            "direction": "positive",
            "description": "AWD/4WD can add appeal for SUVs and rough-road use, but it may increase fuel and maintenance costs. For SUVs, drivetrain choices can influence perceived capability and resale. In this case, the model treats this as price-supportive, so it tends to increase the estimated market value."
          },
          {
            "factor": "mileage_km",
            "direction": "positive",
            "description": "Mileage is very low, which usually suggests less wear on the engine, suspension, and interior. This is lower than what is typical in the data. In this case, the model treats this as price-supportive, so it tends to increase the estimated market value."
          },
          {
            "factor": "car_segment",
            "direction": "positive",
            "description": "Mercedes is premium; buyers tend to be sensitive to maintenance history and condition. Luxury SUVs can be highly valued for space and image, but buyers often price in higher running and maintenance costs. In this case, the model treats this as price-supportive, so it tends to increase the estimated market value."
          }
        ],
        "model_version": "v1.0.0",
        "predicted_at": "2026-05-12T01:47:52.374316+00:00"
      },
      "error": null
    },
    {
      "index": 4,
      "success": true,
      "result": {
        "fair_price": 920000,
        "negotiation_range": {
          "min_price": 580000,
          "max_price": 1250000
        },
        "confidence": "low",
        "price_factors": [
          {
            "factor": "year",
            "direction": "negative",
            "description": "This is an older model year, so depreciation and expected maintenance risk usually weigh on resale. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          },
          {
            "factor": "drivetrain",
            "direction": "positive",
            "description": "RWD can be valued in some premium or performance-oriented cars, though running costs can be higher. In this case, the model treats this as price-supportive, so it tends to increase the estimated market value."
          },
          {
            "factor": "mileage_km",
            "direction": "negative",
            "description": "Mileage is very high, which can raise buyer concern about wear and future maintenance. This is higher than what is typical in the data. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          },
          {
            "factor": "horsepower",
            "direction": "negative",
            "description": "Moderate horsepower is often acceptable for daily driving, balancing performance and running costs. This is within the typical range in the data. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          },
          {
            "factor": "transmission",
            "direction": "positive",
            "description": "Automatic transmission is often preferred in Egyptian city traffic, which can support demand and resale. In this case, the model treats this as price-supportive, so it tends to increase the estimated market value."
          }
        ],
        "model_version": "v1.0.0",
        "predicted_at": "2026-05-12T01:47:52.812114+00:00"
      },
      "error": null
    },
    {
      "index": 5,
      "success": true,
      "result": {
        "fair_price": 1520000,
        "negotiation_range": {
          "min_price": 1340000,
          "max_price": 1710000
        },
        "confidence": "high",
        "price_factors": [
          {
            "factor": "horsepower",
            "direction": "positive",
            "description": "Higher horsepower can increase appeal for highway driving, loaded family use, and premium trims. This is very high compared with typical listings in the data. In this case, the model treats this as price-supportive, so it tends to increase the estimated market value."
          },
          {
            "factor": "mileage_km",
            "direction": "negative",
            "description": "Mileage is on the higher side, which can imply more wear and higher near-term maintenance costs. This is within the typical range in the data. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          },
          {
            "factor": "transmission",
            "direction": "positive",
            "description": "Automatic transmission is often preferred in Egyptian city traffic, which can support demand and resale. In this case, the model treats this as price-supportive, so it tends to increase the estimated market value."
          },
          {
            "factor": "year",
            "direction": "positive",
            "description": "This is a mid-age model year; condition and maintenance history become more important to buyers. In this case, the model treats this as price-supportive, so it tends to increase the estimated market value."
          },
          {
            "factor": "engine_cc",
            "direction": "positive",
            "description": "Larger engines can support stronger performance, but fuel, licensing, and maintenance costs may be higher. This is very high compared with typical listings in the data. In this case, the model treats this as price-supportive, so it tends to increase the estimated market value."
          }
        ],
        "model_version": "v1.0.0",
        "predicted_at": "2026-05-12T01:47:53.250609+00:00"
      },
      "error": null
    },
    {
      "index": 6,
      "success": true,
      "result": {
        "fair_price": 4700000,
        "negotiation_range": {
          "min_price": 440000,
          "max_price": 8960000
        },
        "confidence": "low",
        "price_factors": [
          {
            "factor": "horsepower",
            "direction": "positive",
            "description": "Very high horsepower can signal premium/performance positioning, but running costs may be higher. This is very high compared with typical listings in the data. In this case, the model treats this as price-supportive, so it tends to increase the estimated market value."
          },
          {
            "factor": "engine_cc",
            "direction": "positive",
            "description": "Very large engines can indicate premium/performance positioning, but buyers may factor in higher running costs. This is very high compared with typical listings in the data. In this case, the model treats this as price-supportive, so it tends to increase the estimated market value."
          },
          {
            "factor": "year",
            "direction": "positive",
            "description": "This is a mid-age model year; condition and maintenance history become more important to buyers. In this case, the model treats this as price-supportive, so it tends to increase the estimated market value."
          },
          {
            "factor": "car_segment",
            "direction": "positive",
            "description": "Luxury SUVs can be highly valued for space and image, but buyers often price in higher running and maintenance costs. In this case, the model treats this as price-supportive, so it tends to increase the estimated market value."
          },
          {
            "factor": "brand_origin",
            "direction": "positive",
            "description": "European brands can have a premium image, but buyers often price in higher maintenance costs. In this case, the model treats this as price-supportive, so it tends to increase the estimated market value."
          }
        ],
        "model_version": "v1.0.0",
        "predicted_at": "2026-05-12T01:47:53.695825+00:00"
      },
      "error": null
    },
    {
      "index": 7,
      "success": true,
      "result": {
        "fair_price": 880000,
        "negotiation_range": {
          "min_price": 770000,
          "max_price": 980000
        },
        "confidence": "high",
        "price_factors": [
          {
            "factor": "year",
            "direction": "positive",
            "description": "This is a mid-age model year; condition and maintenance history become more important to buyers. In this case, the model treats this as price-supportive, so it tends to increase the estimated market value."
          },
          {
            "factor": "mileage_km",
            "direction": "negative",
            "description": "Mileage is on the higher side, which can imply more wear and higher near-term maintenance costs. This is within the typical range in the data. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          },
          {
            "factor": "drivetrain",
            "direction": "negative",
            "description": "FWD is economical and common, and it is usually cheaper to maintain for daily driving. For SUVs, drivetrain choices can influence perceived capability and resale. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          },
          {
            "factor": "brand_origin",
            "direction": "positive",
            "description": "Nissan is common; condition and maintenance history are often important to buyers. Japanese/Korean brands often have strong resale due to perceived reliability and parts availability. In this case, the model treats this as price-supportive, so it tends to increase the estimated market value."
          },
          {
            "factor": "engine_cc",
            "direction": "negative",
            "description": "Mid-size engines balance daily usability with reasonable running costs. This is lower than what is typical in the data. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          }
        ],
        "model_version": "v1.0.0",
        "predicted_at": "2026-05-12T01:47:54.132083+00:00"
      },
      "error": null
    },
    {
      "index": 8,
      "success": true,
      "result": {
        "fair_price": 630000,
        "negotiation_range": {
          "min_price": 560000,
          "max_price": 710000
        },
        "confidence": "high",
        "price_factors": [
          {
            "factor": "horsepower",
            "direction": "negative",
            "description": "Moderate horsepower is often acceptable for daily driving, balancing performance and running costs. This is lower than what is typical in the data. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          },
          {
            "factor": "year",
            "direction": "positive",
            "description": "This is a relatively recent model year, which usually supports resale compared with older versions. In this case, the model treats this as price-supportive, so it tends to increase the estimated market value."
          },
          {
            "factor": "brand_origin",
            "direction": "negative",
            "description": "Chinese brands are increasingly common in Egypt and can offer good features for the money, while resale confidence varies by model and support network. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          },
          {
            "factor": "drivetrain",
            "direction": "negative",
            "description": "FWD is economical and common, and it is usually cheaper to maintain for daily driving. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          },
          {
            "factor": "engine_cc",
            "direction": "negative",
            "description": "Mid-size engines balance daily usability with reasonable running costs. This is lower than what is typical in the data. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          }
        ],
        "model_version": "v1.0.0",
        "predicted_at": "2026-05-12T01:47:54.597861+00:00"
      },
      "error": null
    },
    {
      "index": 9,
      "success": true,
      "result": {
        "fair_price": 1610000,
        "negotiation_range": {
          "min_price": 1240000,
          "max_price": 1980000
        },
        "confidence": "medium",
        "price_factors": [
          {
            "factor": "year",
            "direction": "positive",
            "description": "This is a relatively recent model year, which usually supports resale compared with older versions. In this case, the model treats this as price-supportive, so it tends to increase the estimated market value."
          },
          {
            "factor": "horsepower",
            "direction": "positive",
            "description": "Higher horsepower can increase appeal for highway driving, loaded family use, and premium trims. This is very high compared with typical listings in the data. In this case, the model treats this as price-supportive, so it tends to increase the estimated market value."
          },
          {
            "factor": "drivetrain",
            "direction": "negative",
            "description": "FWD is economical and common, and it is usually cheaper to maintain for daily driving. For SUVs, drivetrain choices can influence perceived capability and resale. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          },
          {
            "factor": "mileage_km",
            "direction": "positive",
            "description": "Mileage is in a generally good range; condition and service history still matter a lot. This is lower than what is typical in the data. In this case, the model treats this as price-supportive, so it tends to increase the estimated market value."
          },
          {
            "factor": "engine_cc",
            "direction": "negative",
            "description": "Mid-size engines balance daily usability with reasonable running costs. This is within the typical range in the data. In this case, the model treats this as less price-supportive, so it tends to decrease the estimated market value."
          }
        ],
        "model_version": "v1.0.0",
        "predicted_at": "2026-05-12T01:47:55.046096+00:00"
      },
      "error": null
    }
  ]
}
```
