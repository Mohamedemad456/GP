from urllib.parse import quote_plus
from sqlalchemy import create_engine
from urllib.parse import quote_plus
from airflow.sdk import dag, task
import pandas as pd


@dag
def data_pipeline():
    @task
    def extract_htla2ee():
        hatla2eeDF = pd.read_csv("data/hatla2ee_ultra_light.csv")
        return hatla2eeDF

    @task
    def extract_dubizzle():
        dubizzleDF = pd.read_csv("data/dubizzle_cars_translated.csv")
        return dubizzleDF
    
    @task
    def clean_hatla2ee(df):
        df['scraped_at'] = pd.to_datetime(df['scraped_at'])
        df.drop(columns=['page'], inplace=True)
        return df

    @task
    def clean_dubizzle(df):
        df.drop(columns=['url', 'page', 'title'], inplace=True)
        df['price_egp'] = df['price_egp'].map(lambda x: x.replace('EGP', '').replace(',', '')).astype('Int64')
        df['year'] = df['year'].astype('Int64')
        df['mileage_km'] = (
                                pd.to_numeric(
                                    df['mileage_km']
                                    .astype(str)
                                    .str.replace(r'[^\d]', '', regex=True),
                                    errors='coerce'
                                ).astype('Int64'))
        df['scraped_at'] = pd.to_datetime(df['scraped_at'])
        return df
    
    @task
    def union_datasets(hatla2ee, dubizzle):
        dubizzle = dubizzle.rename(columns={'english_title' : 'title'})

        cols_int = ["year", "mileage_km", "price_egp"]
        for col in cols_int:
            dubizzle[col] = dubizzle[col].astype("Int64")
            hatla2ee[col] = pd.to_numeric(hatla2ee[col], errors="coerce").astype("Int64")
        
        column_order = [
            "title",
            "year",
            "mileage_km",
            "transmission",
            "fuel",
            "price_egp",
            "location",
            "scraped_at"
        ]

        dubizzle = dubizzle[column_order]
        hatla2ee = hatla2ee[column_order]

        final_df = pd.concat([dubizzle, hatla2ee], ignore_index=True)
        return final_df
        
    @task
    def edit_fuel(df):

        fuel_map = {
            "gas": "petrol",
            "benzine": "petrol",
            "petrol": "petrol",
            "gasoline": "petrol",

            "natural gas": "cng",
            "cng": "cng",

            "diesel": "diesel",
            "electric": "electric",
            "hybrid": "hybrid"
        }

        df['fuel'] = (df['fuel'].str.strip().str.lower().replace(fuel_map))
        return df
    
    @task
    def load_to_db(df):
        password = quote_plus("!YA-gp*13579karna")
        engine = create_engine(
            f"postgresql://postgres.idcnjzlutvmnpmgyukrk:{password}@aws-1-eu-west-1.pooler.supabase.com:6543/postgres"
        )
        df.to_sql("test", engine, if_exists="append", index=False)

    htla2eeData = extract_htla2ee()
    dubizzleData = extract_dubizzle()
    cleaned_htla2eeData = clean_hatla2ee(htla2eeData)
    cleaned_dubizzleData = clean_dubizzle(dubizzleData)
    unioned_data = union_datasets(cleaned_htla2eeData, cleaned_dubizzleData)
    final_data = edit_fuel(unioned_data)
    load_to_db(final_data)

data_pipeline()


