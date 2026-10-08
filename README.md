# Egyptian Used Cars Data Pipeline

An end-to-end data engineering pipeline that scrapes used-car listings from Egyptian marketplaces, cleans and unifies them, and loads them into PostgreSQL. It is orchestrated with Apache Airflow and runs in Docker.

## What it does

1. **Scrapes** used-car listings from two sources:
   - [Hatla2ee](https://eg.hatla2ee.com) (Playwright)
   - [Dubizzle Egypt](https://www.dubizzle.com.eg) (Selenium + BeautifulSoup)
2. **Cleans** each dataset (types, prices, mileage, titles, dates).
3. **Unions** both sources into one schema.
4. **Standardizes** values (e.g. fuel types), removes duplicates and empty titles.
5. **Tags** each run with an incrementing `scraping_num`.
6. **Loads** the result into the `used_cars_new` table in PostgreSQL.

## Pipeline flow

```
scrape_hatla2ee  -> extract_htla2ee  -> clean_hatla2ee  \
                                                          -> union_datasets -> final_clean -> add_scraping_num -> load_to_db
scrape_dubizzle  -> extract_dubizzle -> clean_dubizzle  /
```

The two scrapers run in parallel. Scrape tasks have a 6-hour timeout and 2 retries (10 minutes apart); database tasks retry 3 times.

## Output schema

| Column | Description |
|---|---|
| `title` | Make / model (lowercase) |
| `year` | Model year |
| `mileage_km` | Mileage in kilometers |
| `transmission` | Automatic / Manual |
| `fuel` | `petrol`, `diesel`, `cng`, `electric`, `hybrid` |
| `price_egp` | Price in Egyptian pounds |
| `location` | City / area |
| `scraped_at` | Scrape timestamp |
| `scraping_num` | Sequential ID of the pipeline run |

## Project structure

```
.
├── data-pipeline/
│   ├── dags/
│   │   └── pipeline.py                  # Airflow DAG (main pipeline)
│   ├── scripts/
│   │   ├── first_scraping.py            # Hatla2ee scraper (Playwright)
│   │   ├── used_cars_scraper_dubizzle.py# Dubizzle scraper (Selenium)
│   │   ├── my_translation_module.py     # Arabic -> English title translation helpers
│   │   ├── translate.py                 # Applies translation to scraped data (currently disabled in the DAG)
│   │   └── arabic_to_english_dict.json  # Translation dictionary
│   ├── config/airflow.cfg               # Airflow configuration
│   ├── data/                            # Scraped / intermediate CSV files
│   ├── docker-compose.yaml              # Airflow + Postgres services
│   └── requirements.txt
├── producer.py, dubizzle_producer.py    # Producer scripts
├── producer_container.py, dubizzle_producer_container.py
├── Dockerfile
└── docker-compose.yml
```

## Tech stack

Python, Apache Airflow 3, PostgreSQL, Docker, Playwright, Selenium, BeautifulSoup, pandas, SQLAlchemy.

## Getting started

### Prerequisites
- Docker and Docker Compose (at least 4 GB RAM available to Docker)
- A PostgreSQL database for the final table

### 1. Configure the database

Create a `.env` file that the DAG can read (e.g. in `data-pipeline/`):

```env
DB_USER=your_user
DB_PASSWORD=your_password
DB_HOST=your_host
DB_PORT=5432
DB_NAME=your_database
```

> Never commit `.env` to Git.

The target table `used_cars_new` is created automatically on first load.

### 2. Start Airflow

```bash
cd data-pipeline
docker compose up airflow-init
docker compose up -d
```

Open the Airflow UI at **http://localhost:8080**.

### 3. Run the pipeline

In the Airflow UI, unpause the `data_pipeline` DAG and trigger it manually. A full run can take several hours because it scrapes hundreds of pages (about 696 on Hatla2ee and 200 on Dubizzle).

## Configuration

- **Pages to scrape:** `PAGES_TO_SCRAPE` in `scripts/first_scraping.py` and `TOTAL_PAGES` in `scripts/used_cars_scraper_dubizzle.py`. Lower these for quick tests.
- **Load mode:** `load_to_db` appends to `used_cars_new`. Change `if_exists` to `replace` when testing.
- **Translation:** the `translate_dubizzle` task is commented out in the DAG. Re-enable it if you need English titles for Arabic listings.

## Notes

- Scraping depends on the websites' HTML structure. If a site changes its layout, the scrapers may need updating.
- Please respect each website's terms of service and keep request rates polite.
- Before sharing the repository, remove secrets from `config/airflow.cfg` (such as the Fernet key and JWT secret) and use environment variables instead.
