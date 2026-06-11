"""Data loading and resolution for the retrain pipeline."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandas as pd

from scripts.retrain.constants import DEFAULT_DATASET_TAG


def find_ml_root(start: Path | None = None) -> Path:
    """Walk upward from *start* until we find the ml-service root."""
    start = (start or Path.cwd()).resolve()
    for candidate in (start, *start.parents):
        if (candidate / "app" / "core" / "config.py").exists():
            return candidate
    raise FileNotFoundError("Cannot find ml-service root")


ML_ROOT = find_ml_root()
DATA_MANIFEST_PATH = ML_ROOT / "data" / "data_manifest.json"
PROCESSED_VERSIONS_DIR = ML_ROOT / "data" / "processed" / "versions"


def load_data_manifest() -> dict[str, Any]:
    with DATA_MANIFEST_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def available_dataset_tags() -> list[str]:
    manifest = load_data_manifest()
    return list(manifest.get("versions", {}).keys())


def processed_path_for_tag(tag: str) -> Path:
    manifest = load_data_manifest()
    versions = manifest.get("versions", {})
    if tag in versions:
        rel_path = versions[tag]["processed_path"]
        return (ML_ROOT / rel_path).resolve()
    candidate = PROCESSED_VERSIONS_DIR / f"processed_{tag}.csv"
    if candidate.exists():
        return candidate
    raise FileNotFoundError(f"No processed dataset found for tag: {tag}")


def _normalize_string_columns(df: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    out = df.copy()
    for column in columns:
        if column in out.columns:
            out[column] = out[column].astype(str).str.strip()
            out.loc[out[column].isin(["nan", "None", "<NA>"]), column] = pd.NA
    return out


def _normalize_numeric_columns(df: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    out = df.copy()
    for column in columns:
        if column in out.columns:
            series = out[column]
            if not pd.api.types.is_numeric_dtype(series):
                series = series.astype(str).str.replace(",", "", regex=False).str.strip()
            out[column] = pd.to_numeric(series, errors="coerce")
    return out


def normalize_processed_df(df: pd.DataFrame) -> pd.DataFrame:
    """Clean and normalize a raw processed CSV to match the V1 feature spec."""
    out = df.copy()
    out = out.loc[:, ~out.columns.astype(str).str.startswith("Unnamed:")]

    from scripts.retrain.constants import CAT_COLS, NUM_COLS

    out = _normalize_string_columns(out, CAT_COLS)
    out = _normalize_numeric_columns(out, NUM_COLS + ["car_age", "price_egp", "price_egp_log"])

    if "car_age" not in out.columns and "year" in out.columns:
        out["car_age"] = (pd.Timestamp.utcnow().year - out["year"]).clip(lower=0)

    return out


def load_data(
    dataset_tag: str | None = None,
    data_path: str | None = None,
) -> pd.DataFrame:
    """Load processed data by tag or explicit path."""
    if data_path:
        path = Path(data_path)
        if not path.is_absolute():
            path = ML_ROOT / path
    elif dataset_tag:
        path = processed_path_for_tag(dataset_tag)
    else:
        path = processed_path_for_tag(DEFAULT_DATASET_TAG)

    if not path.exists():
        raise FileNotFoundError(f"Data file not found: {path}")

    df = pd.read_csv(path)
    df = normalize_processed_df(df)
    df["_dataset_tag"] = dataset_tag or path.stem
    return df
