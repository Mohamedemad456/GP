import pandas as pd
from my_translation_module import load_mapping, translate_arabic_series


# Load dictionary
mapping = load_mapping("/opt/airflow/scripts/arabic_to_english_dict.json")

# Scraped data (Arabic only) new data
df = pd.read_csv("/opt/airflow/data/dubizzle_cars.csv", dtype=str)


df["english_title"] = translate_arabic_series(df["title"], mapping)

# Save output
df.to_csv("/opt/airflow/data/dubizzle_cars_translated.csv", index=False)
print('Saved to /opt/airflow/data/dubizzle_cars_translated.csv')