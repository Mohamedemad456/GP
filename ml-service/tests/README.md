# Tests

## test_predict.py
Tests for the /predict endpoint:
- Valid input returns correct response structure
- Invalid year (< 1990) returns 422
- Invalid mileage (negative) returns 422
- Unknown brand returns prediction with low confidence
- Response contains all required fields

## test_features.py
Tests for the feature builder:
- Feature vector has correct number of columns
- Lookup join returns expected specs for known car
- Missing lookup returns graceful fallback
- Derived features computed correctly (car_age, mileage_per_year)

## test_data_pipeline.py
Tests for data cleaning functions:
- Price outliers removed correctly
- Mileage zeros flagged as missing
- Transmission "0" flagged as missing
- Duplicate rows removed
