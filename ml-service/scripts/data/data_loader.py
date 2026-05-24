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


"""
src/data_loader.py  —  Bronze layer

Responsibility: First step of ETL --> Extarct the data --> pull the raw car-listings snapshot from Supabase via the
PostgreSQL pooler and save it as a Parquet file.

Connection: SQLAlchemy + psycopg2 → Supabase PostgreSQL pooler
Input :  shared config in app/core/config.py, backed by root .env
Output:  versioned files under data/raw/

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
    row_hashes = hash_pandas_object(canonical, index=False).to_numpy()
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


def _resolve_snapshot_path(base_path: Path, df: pd.DataFrame) -> Path:
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


def load_raw(out_path: Path = DEFAULT_OUT) -> pd.DataFrame:
    """
    Pull all rows from Supabase, save as a versioned Parquet snapshot, and return the DataFrame.

    If the extracted data is identical to an existing snapshot, the existing file is reused and
    no new version is created.

    Parameters
    ----------
    out_path : Path
        Base Parquet path. Parent directories are created if needed.

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

            log.info("Reading table '%s' ...", table)
            df = pd.read_sql_table(table, con=conn)
    finally:
        engine.dispose()

    if df.empty:
        raise ValueError(f"Table '{table}' returned 0 rows. Check the table name.")

    base_path = _normalize_base_path(Path(out_path))
    base_path.parent.mkdir(parents=True, exist_ok=True)

    target_path = _resolve_snapshot_path(base_path, df)
    if not target_path.exists():
        df.to_parquet(target_path, index=False)
        log.info("Saved %d rows → %s", len(df), target_path)

    return df


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Pull raw car listings from Supabase.")
    parser.add_argument(
        "--out",
        type=Path,
        default=DEFAULT_OUT,
        help=f"Base output Parquet path (versioned automatically, default: {DEFAULT_OUT})",
    )
    args = parser.parse_args()
    load_raw(out_path=args.out)