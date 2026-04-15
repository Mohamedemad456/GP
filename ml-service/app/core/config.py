from __future__ import annotations
import sys
from functools import lru_cache
from pathlib import Path
from typing import Any
from urllib.parse import quote_plus
import pandas as pd
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve the repository root from this file location so imports work regardless of the
# current working directory.
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def _find_env_file() -> Path | None:
    """Finds the nearest `.env` starting at PROJECT_ROOT and walking upward."""
    for candidate_dir in (PROJECT_ROOT, *PROJECT_ROOT.parents):
        candidate = candidate_dir / ".env"
        if candidate.exists():
            return candidate
    return None


def _resolve_path(path: Path | str, base_dir: Path = PROJECT_ROOT) -> Path:
    """Resolves a path to an absolute path, using base_dir if relative."""
    candidate = Path(path).expanduser()
    if candidate.is_absolute():
        return candidate.resolve()
    return (base_dir / candidate).resolve()


class Settings(BaseSettings):
    """Environment-driven configuration for the ml-service project."""

    model_config = SettingsConfigDict(
        env_file=_find_env_file(),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- Directories ---
    project_root: Path = Field(default=PROJECT_ROOT)
    data_dir: Path = Field(default=Path("data"))
    models_dir: Path = Field(default=Path("models"))
    log_dir: Path = Field(default=Path("logs"))
    log_level: str = Field(default="INFO")

    # --- Database Config ---
    supabase_url: str | None = None
    supabase_key: str | None = None
    supabase_db_host: str | None = None
    supabase_db_port: str | None = None
    supabase_db_user: str | None = None
    supabase_db_password: str | None = None
    supabase_db_name: str = Field(default="postgres")
    supabase_table: str = Field(default="used_cars")

    # --- File Names ---
    raw_snapshot_file_stem: str = Field(default="cars_raw")
    model_registry_file: str = Field(default="model_registry.json")
    lookup_file_name: str = Field(default="car_specs_lookup_full_cleaned.csv")
    main_info_file_name: str = Field(default="car_main_info")

    def model_post_init(self, __context: Any) -> None:
        """Resolves directory paths to absolute paths after model instantiation."""
        root = _resolve_path(self.project_root)
        object.__setattr__(self, "project_root", root)
        object.__setattr__(self, "data_dir", _resolve_path(self.data_dir, root))
        object.__setattr__(self, "models_dir", _resolve_path(self.models_dir, root))
        object.__setattr__(self, "log_dir", _resolve_path(self.log_dir, root))

    # --- Directory Properties ---
    @property
    def raw_data_dir(self) -> Path:
        return self.data_dir / "raw"

    @property
    def cleaned_data_dir(self) -> Path:
        return self.data_dir / "cleaned"

    @property
    def processed_data_dir(self) -> Path:
        return self.data_dir / "processed"

    @property
    def lookup_dir(self) -> Path:
        return self.data_dir / "lookups"

    # --- File Path Properties ---
    @property
    def raw_data_path(self) -> Path:
        return self.raw_data_dir / "cars_with_make_model.csv"

    @property
    def raw_snapshot_base_path(self) -> Path:
        return self.raw_data_dir / f"{self.raw_snapshot_file_stem}.parquet"

    def raw_snapshot_path(self, version: int) -> Path:
        if version < 1:
            raise ValueError("version must be greater than or equal to 1")
        return self.raw_data_dir / f"{self.raw_snapshot_file_stem}_v{version:03d}.parquet"

    @property
    def cleaned_data_path(self) -> Path:
        return self.cleaned_data_dir / "cleaned_data.parquet"

    @property
    def processed_data_path(self) -> Path:
        return self.processed_data_dir / "processed_data.csv"
    
    @property
    def training_data_path(self) -> Path:
        return self.processed_data_dir / "training" /"training.parquet"
    
    @property
    def testing_data_path(self) -> Path:
        return self.processed_data_dir / "testing" /"testing.parquet"
    

    @property
    def lookup_data_path(self) -> Path:
        return self.lookup_dir / self.lookup_file_name

    @property
    def main_info_data_path(self) -> Path:
        return self.lookup_dir / f"{self.main_info_file_name}.json"

    @property
    def model_registry_path(self) -> Path:
        return self.models_dir / self.model_registry_file

    @property
    def lookup_candidates(self) -> tuple[Path, ...]:
        return (
            self.lookup_data_path,
            self.data_dir / self.lookup_file_name,
        )

    @property
    def main_info_candidates(self) -> tuple[Path, ...]:
        return (
            self.main_info_data_path,
            self.main_info_data_path.with_suffix(".csv"),
        )

    # --- Database Helpers ---
    @property
    def supabase_sqlalchemy_url(self) -> str | None:
        """Constructs a standard SQLAlchemy PostgreSQL connection string."""
        required = [
            self.supabase_db_host,
            self.supabase_db_port,
            self.supabase_db_user,
            self.supabase_db_password,
        ]
        if not all(required):
            return None

        host = self.supabase_db_host or ""
        port = str(self.supabase_db_port or "")

        password = quote_plus(self.supabase_db_password or "")
        return (
            f"postgresql+psycopg2://{self.supabase_db_user}:{password}"
            f"@{host}:{port}/{self.supabase_db_name}"
        )

    # --- Data Loading ---
    def load_data(self, data_type: str) -> pd.DataFrame:
        """
        Dynamically loads Parquet or CSV data into a Pandas DataFrame based on the type.
        """
        normalized = data_type.strip().lower()
        
        # Dispatch map for direct paths
        paths = {
            "raw": self.raw_data_path,
            "cleaned": self.cleaned_data_path,
            "processed": self.processed_data_path,
        }

        if normalized in paths:
            return pd.read_csv(paths[normalized])

        if normalized == "main_info":
            for candidate in self.main_info_candidates:
                if candidate.exists():
                    if candidate.suffix == ".json":
                        return pd.read_json(candidate)
                    return pd.read_csv(candidate)
            raise FileNotFoundError(
                f"No car main info file found. Looked in: {', '.join(str(path) for path in self.main_info_candidates)}"
            )
            
        if normalized == "lookup":
            for candidate in self.lookup_candidates:
                if candidate.exists():
                    return pd.read_csv(candidate)
            raise FileNotFoundError(
                f"No lookup file found. Looked in: {', '.join(str(path) for path in self.lookup_candidates)}"
            )

        raise ValueError("data_type must be one of: raw, cleaned, processed, lookup, main_info")
    
    def save_data(self, data: pd.DataFrame, data_type: str, format: str = "parquet") -> None:
        """
        Saves a DataFrame to the specified location in the given format.
        
        Args:
            data: DataFrame to save
            data_type: Type of data (raw, cleaned, processed, lookup, main_info)
            format: File format - "parquet", "csv", "json", or "all" (default: "parquet")
        """
        normalized_type = data_type.strip().lower()
        normalized_format = format.strip().lower()
        
        path_map = {
            "raw": self.raw_data_path,
            "cleaned": self.cleaned_data_path,
            "processed": self.processed_data_path,
            "lookup": self.lookup_data_path,
            "main_info": self.main_info_data_path,
        }
        
        if normalized_type not in path_map:
            raise ValueError("data_type must be one of: raw, cleaned, processed, lookup, main_info")
        
        if normalized_format not in ("parquet", "csv", "json", "all"):
            raise ValueError("format must be one of: parquet, csv, json, all")
        
        base_path = path_map[normalized_type]
        base_path.parent.mkdir(parents=True, exist_ok=True)

        if normalized_type == "main_info":
            if normalized_format == "parquet":
                raise ValueError("format must be one of: csv, json, all for main_info")

            if normalized_format in ("json", "all"):
                data.to_json(base_path, orient="records", force_ascii=False, indent=2)

            if normalized_format in ("csv", "all"):
                csv_path = base_path.with_suffix(".csv")
                data.to_csv(csv_path, index=False)

            return
        
        if normalized_format in ("parquet"):
            data.to_parquet(base_path)
        
        if normalized_format in ("csv", "all"):
            csv_path = base_path.with_suffix(".csv")
            data.to_csv(csv_path, index=False)

        if normalized_format == "json":
            json_path = base_path.with_suffix(".json")
            data.to_json(json_path, orient="records", force_ascii=False, indent=2)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

__all__ = [
    "PROJECT_ROOT",
    "Settings",
    "get_settings",
    "settings"
]