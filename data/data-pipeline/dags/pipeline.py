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
        dubizzleDF = pd.read_csv("data/dubizzle_cars_english.csv")
        return dubizzleDF

    htla2eeData = extract_htla2ee()
    dubizzleData = extract_dubizzle()

data_pipeline()


