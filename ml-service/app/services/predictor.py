import pandas as pd
from app.core.config import settings

# Global state to hold valid sets
VALID_CARS = set()

def load_valid_cars():
    """
    Loads processed data on startup to build a lookup of valid
    (make, model, year) combinations for input validation.
    """

    df = settings.load_data("processed")

    unique_records = df[["make", "model", "year"]].drop_duplicates()
    for _, row in unique_records.iterrows():
        make = str(row["make"]).strip().lower()
        model = str(row["model"]).strip().lower()
        year = int(float(row["year"]))

        VALID_CARS.add((make, model, year))


def check_car_validity(brand: str, model: str, year: int) -> bool:
    """
    Checks if a (brand, model, year) combination exists in our processed data.
    """
    target = (brand.strip().lower(), model.strip().lower(), year)
    return target in VALID_CARS
