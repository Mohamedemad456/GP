"""
Generate car specs lookup table via Claude.

Process:
    1. Load title_parsed.csv to get unique (brand, model, year) combos
    2. Send to Claude in batches with strict schema
    3. For each combo, extract: engine_cc, body_type, horsepower,
       drivetrain, new_car_price_egp, seating_capacity
    4. Validate outputs (range checks, cross-checks)
    5. Save as data/car_specs_lookup.csv

This is a ONE-TIME operation, re-run only when new brand+model+year
combos appear in fresh scraped data.

Output: data/car_specs_lookup.csv with columns:
    brand, model, year, engine_cc, body_type, horsepower,
    drivetrain, new_car_price_egp, seating_capacity

Usage:
    python -m src.generate_lookup
"""

# TODO: Implement lookup generation
