from __future__ import annotations
import argparse
import logging
import os
import sys
from pathlib import Path
from urllib.parse import quote_plus
import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine, text


"""
src/data_loader.py  —  Bronze layer

Responsibility: First step of ETL --> Extarct the data --> pull the raw car-listings snapshot from Supabase via the
PostgreSQL pooler and save it as a Parquet file.

Connection: SQLAlchemy + psycopg2  →  Supabase PgBouncer (port 6543)
Input :  env vars in root .env
Output:  data/raw/cars_raw.parquet

"""

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)



DEFAULT_OUT = Path("data/raw/cars_raw.parquet")
ENV_PATH = Path(__file__).resolve().parents[2] / ".env" 



def _build_engine():
    """
    Build a SQLAlchemy engine from the root .env credentials.
    Uses the Supabase PgBouncer pooler
    """
    load_dotenv(dotenv_path=ENV_PATH)

    host     = os.getenv("SUPABASE_DB_HOST", "")
    port     = os.getenv("SUPABASE_DB_PORT", "")
    user     = os.getenv("SUPABASE_DB_USER", "")
    password = os.getenv("SUPABASE_DB_PASSWORD", "")
    dbname   = os.getenv("SUPABASE_DB_NAME", "postgres")

    url = (
        f"postgresql+psycopg2://{user}:{quote_plus(password)}"
        f"@{host}:{port}/{dbname}"
    )

    return create_engine(url, pool_pre_ping=True)


def load_raw(out_path: Path = DEFAULT_OUT) -> pd.DataFrame:
    """
    Pull all rows from Supabase, save as Parquet, and return the DataFrame.

    Parameters
    ----------
    out_path : Path
        Destination Parquet file.  Parent directories are created if needed.

    Returns
    -------
    pd.DataFrame
        Raw listings exactly as stored in Supabase.
    """
    load_dotenv(dotenv_path=ENV_PATH)
    table = os.getenv("SUPABASE_TABLE", "used_cars")

    log.info("Building engine...")
    engine = _build_engine()

    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    log.info("Connection OK.")

    log.info("Reading table '%s' ...", table)
    df = pd.read_sql_table(table, con=engine)

    if df.empty:
        log.error("Table '%s' returned 0 rows. Check the table name.", table)
        sys.exit(1)


    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(out_path, index=False)
    log.info("Saved %d rows → %s", len(df), out_path)

    return df


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Pull raw car listings from Supabase.")
    parser.add_argument(
        "--out",
        type=Path,
        default=DEFAULT_OUT,
        help=f"Output Parquet path (default: {DEFAULT_OUT})",
    )
    args = parser.parse_args()
    load_raw(out_path=args.out)
