"""
Model registry helpers for reading, writing, and promoting model artifacts.

This module centralizes all registry/metadata operations so that both
notebooks and the backend API use the same logic.
"""
from __future__ import annotations

import json
import datetime as dt
from pathlib import Path
from typing import Any

from app.core.config import settings


# ---------------------------------------------------------------------------
# Path helpers
# ---------------------------------------------------------------------------

def model_pickles_dir() -> Path:
    return settings.models_dir / "pickles"


def model_metadata_dir() -> Path:
    return settings.models_dir / "metadata"


def model_preprocessors_dir() -> Path:
    return settings.models_dir / "preprocessors"


def model_plots_dir(name: str) -> Path:
    """Return (and create) a plots directory for a given notebook/model name."""
    d = settings.models_dir / f"plots_{name}"
    d.mkdir(parents=True, exist_ok=True)
    return d


def resolve_registry_path(path_value: str | Path) -> Path:
    """Resolve a registry-stored path against the current project layout.

    Registry entries may contain absolute paths created on a different machine
    or inside a different mount point. If the exact path does not exist, try to
    re-anchor it under the current project root while preserving the path segment
    starting at `models/` when available.
    """
    path = Path(path_value).expanduser()
    if path.is_absolute() and path.exists():
        return path.resolve()

    if path.is_absolute():
        parts = path.parts
        if "models" in parts:
            rel = Path(*parts[parts.index("models"):])
            candidate = settings.project_root / rel
            if candidate.exists():
                return candidate.resolve()

        candidate = settings.project_root / path.name
        if candidate.exists():
            return candidate.resolve()

    candidate = (settings.project_root / path).resolve()
    if candidate.exists():
        return candidate

    return path.resolve() if path.exists() else candidate


# ---------------------------------------------------------------------------
# Registry I/O
# ---------------------------------------------------------------------------

def load_registry() -> dict[str, Any]:
    """Load the model registry JSON. Returns empty structure if missing."""
    path = settings.model_registry_path
    if not path.exists():
        return {"active_version": None, "active_model_id": None, "models": {}}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_registry(registry: dict[str, Any]) -> None:
    """Write the full registry dict to disk."""
    path = settings.model_registry_path
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(registry, f, indent=2, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Active model
# ---------------------------------------------------------------------------

def get_active_model_info() -> dict[str, Any] | None:
    """Return the full info dict for the currently active model, or None.

    Handles both new format (active_model_id → models[id]) and
    legacy format (active_model inline dict).
    """
    reg = load_registry()
    model_id = reg.get("active_model_id")
    if model_id is not None:
        info = reg.get("models", {}).get(model_id)
        if info:
            return info

    # Fallback: try legacy active_model key (inline dict)
    legacy = reg.get("active_model")
    if legacy:
        # Enrich with artifacts from the metadata JSON if available
        if "artifacts" not in legacy or not legacy.get("artifacts"):
            meta_path_str = legacy.get("meta_path")
            if meta_path_str:
                mp = Path(meta_path_str)
                if not mp.is_absolute():
                    mp = settings.project_root / mp
                if mp.exists():
                    with open(mp, "r", encoding="utf-8") as f:
                        meta = json.load(f)
                    if "artifacts" in meta:
                        legacy["artifacts"] = meta["artifacts"]
        return legacy

    return None


def get_active_model_path() -> Path | None:
    """Return the pkl path for the active model, or None."""
    info = get_active_model_info()
    if info is None:
        return None
    pkl = info.get("pkl_path") or info.get("artifacts", {}).get("model_pkl")
    if pkl is None:
        return None
    return resolve_registry_path(pkl)


# ---------------------------------------------------------------------------
# Metadata I/O
# ---------------------------------------------------------------------------

def load_model_metadata(model_id: str) -> dict[str, Any] | None:
    """Load metadata JSON for a specific model_id."""
    reg = load_registry()
    info = reg.get("models", {}).get(model_id)
    if info is None:
        return None
    meta_path = info.get("meta_path")
    if meta_path is None:
        return info
    p = Path(meta_path)
    if not p.is_absolute():
        p = settings.project_root / p
    if not p.exists():
        return info
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)


def build_model_metadata(
    *,
    version: str,
    model_id: str,
    framework: str,
    target: str,
    is_log_target: bool,
    split_strategy: str,
    quantiles: dict[str, float] | None = None,
    feature_list: list[str] | None = None,
    cat_cols: list[str] | None = None,
    metrics: dict[str, float] | None = None,
    interval_metrics: dict[str, float] | None = None,
    hyperparams: dict[str, Any] | None = None,
    artifacts: dict[str, str] | None = None,
    plot_dir: str | None = None,
    source_notebook: str | None = None,
) -> dict[str, Any]:
    """Build a standardized metadata dict for a model."""
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    return {
        "version": version,
        "model_id": model_id,
        "framework": framework,
        "trained_at": now,
        "train_config": {
            "target": target,
            "is_log_target": is_log_target,
            "split": split_strategy,
            "quantiles": quantiles or {},
        },
        "features": {
            "all": feature_list or [],
            "categorical": cat_cols or [],
        },
        "metrics": metrics or {},
        "interval_metrics": interval_metrics or {},
        "hyperparams": hyperparams or {},
        "artifacts": artifacts or {},
        "plot_dir": plot_dir,
        "source_notebook": source_notebook,
    }


def save_model_metadata(metadata: dict[str, Any], filename: str | None = None) -> Path:
    """Save metadata JSON to the metadata directory. Returns the path written."""
    mdir = model_metadata_dir()
    mdir.mkdir(parents=True, exist_ok=True)
    if filename is None:
        model_id = metadata.get("model_id", "unknown")
        version = metadata.get("version", "v0")
        filename = f"{model_id}__{version}.json"
    path = mdir / filename
    with open(path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
    return path


# ---------------------------------------------------------------------------
# Registration and promotion
# ---------------------------------------------------------------------------

def register_model(
    model_id: str,
    *,
    pkl_path: str | Path,
    meta_path: str | Path,
    framework: str,
    version: str,
    metrics: dict[str, float] | None = None,
    **extra: Any,
) -> None:
    """Add or update a model entry in the registry."""
    reg = load_registry()
    models = reg.setdefault("models", {})
    models[model_id] = {
        "framework": framework,
        "version": version,
        "pkl_path": str(pkl_path),
        "meta_path": str(meta_path),
        "metrics": metrics or {},
        "registered_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        **extra,
    }
    save_registry(reg)


def promote_active_model(model_id: str) -> None:
    """Set the given model_id as the active production model."""
    reg = load_registry()
    models = reg.get("models", {})
    if model_id not in models:
        raise ValueError(f"Model '{model_id}' not found in registry. Register it first.")
    reg["active_model_id"] = model_id
    reg["active_version"] = models[model_id].get("version", "unknown")
    reg["promoted_at"] = dt.datetime.now(dt.timezone.utc).isoformat()
    save_registry(reg)
