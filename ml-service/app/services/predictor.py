import pandas as pd
from app.core.config import settings

# Global state to hold valid sets
VALID_CARS = set()

def load_valid_cars():
    """
    Loads processed data on startup to build a lookup of valid
    (make, model, year) combinations for input validation.
    """
    try:
        df = settings.load_data("processed")
        
        required_cols = {"make", "model", "year"}
        if required_cols.issubset(df.columns):
            # Extract unique records directly using pandas for better performance
            unique_records = df[["make", "model", "year"]].drop_duplicates()
            for _, row in unique_records.iterrows():
                make = str(row["make"]).strip().lower()
                model = str(row["model"]).strip().lower()
                try:
                    year = int(float(row["year"]))
                except ValueError:
                    continue
                VALID_CARS.add((make, model, year))
            print(f"[Predictor Service] Loaded {len(VALID_CARS)} valid car combinations.")
        else:
            print("[Predictor Service] Processed data does not contain required columns: make, model, year.")
    except Exception as e:
        print(f"[Predictor Service] Failed to load processed data: {e}")

def check_car_validity(brand: str, model: str, year: int) -> bool:
    """
    Checks if a (brand, model, year) combination exists in our processed data.
    """
    target = (brand.strip().lower(), model.strip().lower(), year)
    return target in VALID_CARS
