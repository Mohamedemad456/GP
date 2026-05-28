from __future__ import annotations

import argparse
import logging
import re
import sys
from hashlib import sha256
from pathlib import Path

import pandas as pd
from pandas.util import hash_pandas_object
from sqlalchemy import create_engine

PROJECT_ROOT = Path(__file__).resolve().parents[2]  # scripts/data/ -> ml-service/
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.core.config import settings
from scripts.data.parse_title import enrich_with_make_model


"""
src/data_loader.py  —  Bronze layer

Responsibility: First step of ETL --> Extract the data --> pull the raw car-listings snapshot from Supabase via the
PostgreSQL pooler and save it as a Parquet and/or CSV file.

Connection: SQLAlchemy + psycopg2 → Supabase PostgreSQL pooler
Input :  shared config in app/core/config.py, backed by root .env
Output:  versioned files under data/raw/

Supports filtering by scraping_num to pull a specific scraping round.

Usage:
    python data_loader.py                              # pull all rows
    python data_loader.py --scraping-num 2             # pull scraping round 2 only
    python data_loader.py --scraping-num 2 --csv       # also save as CSV
    python data_loader.py --out data/raw/snapshot.parquet  # custom output path

"""

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


DEFAULT_OUT = settings.raw_snapshot_base_path


def _build_engine():
    """Build a SQLAlchemy engine from the shared Supabase settings."""

    url = settings.supabase_sqlalchemy_url
    if not url:
        raise RuntimeError(
            "Missing Supabase database settings. Set SUPABASE_DB_HOST, "
            "SUPABASE_DB_PORT, SUPABASE_DB_USER, and SUPABASE_DB_PASSWORD."
        )

    return create_engine(url, pool_pre_ping=True)


def _normalize_base_path(path: Path) -> Path:
    if path.suffix:
        return path
    return path.with_suffix(".parquet")


def _dataframe_fingerprint(df: pd.DataFrame) -> str:
    canonical = df.reindex(sorted(df.columns), axis=1)
    row_hashes = hash_pandas_object(canonical, index=False).to_numpy().copy()
    row_hashes.sort()

    digest = sha256()
    digest.update(str(len(canonical)).encode("utf-8"))
    digest.update("|".join(map(str, canonical.columns)).encode("utf-8"))
    digest.update("|".join(str(dtype) for dtype in canonical.dtypes).encode("utf-8"))
    digest.update(row_hashes.tobytes())
    return digest.hexdigest()


def _versioned_path(base_path: Path, version: int) -> Path:
    return base_path.with_name(f"{base_path.stem}_v{version:03d}{base_path.suffix}")


def _existing_snapshot_paths(base_path: Path) -> list[tuple[int, Path]]:
    candidates: list[tuple[int, Path]] = []

    if base_path.exists():
        candidates.append((0, base_path))

    pattern = re.compile(
        rf"^{re.escape(base_path.stem)}_v(?P<version>\d+){re.escape(base_path.suffix)}$"
    )
    for candidate in base_path.parent.glob(f"{base_path.stem}_v*{base_path.suffix}"):
        match = pattern.match(candidate.name)
        if match:
            candidates.append((int(match.group("version")), candidate))

    return sorted(candidates, key=lambda item: item[0])


def _resolve_snapshot_path(
    base_path: Path,
    df: pd.DataFrame,
    scraping_num: int | None = None,
) -> Path:
    """Determine the target file path for a snapshot.

    When scraping_num is provided, the filename is ALWAYS
    cars_raw_v{scraping_num:03d} — this overwrites any stale file for that
    round.  Re-pulling the same scraping_num gives a fresh file.

    When scraping_num is None, fall back to fingerprint-based dedup and
    auto-increment (legacy behavior for "all rows" pulls).
    """
    if scraping_num is not None:
        path = _versioned_path(base_path, scraping_num)
        log.info("Using scraping-num-based path: %s", path)
        return path

    # --- legacy path: no scraping_num provided ("all rows" pull) ---
    fingerprint = _dataframe_fingerprint(df)
    existing_paths = _existing_snapshot_paths(base_path)

    for version, candidate in existing_paths:
        existing_fingerprint = _dataframe_fingerprint(pd.read_parquet(candidate))
        if existing_fingerprint == fingerprint:
            log.info("Reusing identical snapshot %s", candidate)
            return candidate

    versioned_versions = [version for version, _ in existing_paths if version > 0]
    next_version = (max(versioned_versions) if versioned_versions else 0) + 1
    return _versioned_path(base_path, next_version)


def load_raw(
    out_path: Path = DEFAULT_OUT,
    scraping_num: int | None = None,
    save_csv: bool = False,
) -> pd.DataFrame:
    """
    Pull rows from Supabase, save as a versioned Parquet snapshot, and return the DataFrame.

    If scraping_num is provided, the file is ALWAYS saved as cars_raw_v{scraping_num:03d}
    (overwriting any existing file).  If scraping_num is None, fingerprint dedup is used
    and existing identical snapshots are reused.

    Parameters
    ----------
    out_path : Path
        Base Parquet path. Parent directories are created if needed.
    scraping_num : int | None
        If provided, only pull rows where scraping_num matches this value.
        If None, pull all rows.
    save_csv : bool
        If True, also save a CSV copy alongside the Parquet file.

    Returns
    -------
    pd.DataFrame
        Raw listings exactly as stored in Supabase.
    """
    table = settings.supabase_table

    log.info("Building engine...")
    engine = _build_engine()

    try:
        with engine.connect() as conn:
            conn.exec_driver_sql("SELECT 1")
            log.info("Connection OK.")

            if scraping_num is not None:
                query = f"SELECT * FROM {table} WHERE scraping_num = {int(scraping_num)}"
                log.info("Reading table '%s' WHERE scraping_num = %d ...", table, scraping_num)
                df = pd.read_sql(query, con=conn)
            else:
                log.info("Reading table '%s' (all rows) ...", table)
                df = pd.read_sql_table(table, con=conn)
    finally:
        engine.dispose()

    if df.empty:
        raise ValueError(f"Table '{table}' returned 0 rows for scraping_num={scraping_num}. Check the table name and filter.")

    log.info("Pulled %d rows.", len(df))

    # Enrich with make/model if missing or insufficiently populated.
    # Supabase currently stores only `title`; if it ever gains real make/model
    # columns we use them — but only if both are ≥50% populated (guards against
    # partial scraper output where some rows have make/model and others don't).
    def _col_populated(col: str) -> bool:
        if col not in df.columns:
            return False
        valid = df[col].notna() & (df[col].astype(str).str.strip() != "")
        return valid.mean() >= 0.5

    if not (_col_populated("make") and _col_populated("model")):
        log.info("make/model absent or <50%% populated — parsing from title column...")
        df = enrich_with_make_model(df)
        log.info("make/model columns added.")
    else:
        pct = (df["make"].notna() & (df["make"] != "")).mean() * 100
        log.info("Using make/model from source (%.0f%% populated).", pct)

    base_path = _normalize_base_path(Path(out_path))
    base_path.parent.mkdir(parents=True, exist_ok=True)

    target_path = _resolve_snapshot_path(base_path, df, scraping_num=scraping_num)
    # For scraping_num pulls: always overwrite (fresh pull of that round)
    if scraping_num is not None or not target_path.exists():
        df.to_parquet(target_path, index=False)
        log.info("Saved %d rows → %s", len(df), target_path)

    if save_csv:
        csv_path = target_path.with_suffix(".csv")
        if scraping_num is not None or not csv_path.exists():
            df.to_csv(csv_path, index=False)
            log.info("Saved CSV → %s", csv_path)

    return df


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Pull raw car listings from Supabase.")
    parser.add_argument(
        "--out",
        type=Path,
        default=DEFAULT_OUT,
        help=f"Base output Parquet path (versioned automatically, default: {DEFAULT_OUT})",
    )
    parser.add_argument(
        "--scraping-num",
        type=int,
        default=None,
        help="Only pull rows with this scraping_num value (e.g. 2 for scraping round 2).",
    )
    parser.add_argument(
        "--csv",
        action="store_true",
        help="Also save a CSV copy alongside the Parquet file.",
    )
    args = parser.parse_args()
    load_raw(out_path=args.out, scraping_num=args.scraping_num, save_csv=args.csv)