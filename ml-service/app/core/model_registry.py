"""
Model registry helpers for reading, writing, and promoting model artifacts.

This module centralizes all registry/metadata operations so that both
notebooks and the backend API use the same logic.

Registry schema v2:
{
  "schema_version": "2.0",
  "active_model_id": "<model_id>",
  "active_version": "<semver>",
  "promoted_at": "<iso-ts>",
  "models": {
    "<model_id>": {
      "model_id": "...",
      "framework": "...",
      "version": "...",
      "stage": "production|candidate|archived",
      "pkl_path": "models/pickles/...",   # always relative
      "meta_path": "models/metadata/...",  # always relative
      "metrics": { ... },
      "artifacts": { ... },                # optional extra deps
      "source_notebook": "...",
      "registered_at": "<iso-ts>"
    }
  }
}
"""
from __future__ import annotations

import json
import datetime as dt
from pathlib import Path
from typing import Any

from app.core.config import settings

REGISTRY_SCHEMA_VERSION = "2.0"


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


def _to_relative_path(path_value: str | Path) -> str:
    """Convert an absolute path to a project-relative string for portability.

    If the path is already relative or cannot be made relative to the project
    root, return it as-is.
    """
    p = Path(path_value)
    if not p.is_absolute():
        return str(p)
    try:
        return str(p.relative_to(settings.project_root))
    except ValueError:
        parts = p.parts
        if "models" in parts:
            return str(Path(*parts[parts.index("models")]))
        return str(p)


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

def _empty_registry() -> dict[str, Any]:
    """Return a minimal clean v2 registry dict."""
    return {
        "schema_version": REGISTRY_SCHEMA_VERSION,
        "active_model_id": None,
        "active_version": None,
        "promoted_at": None,
        "models": {},
    }


def load_registry() -> dict[str, Any]:
    """Load the model registry JSON. Returns empty structure if missing."""
    path = settings.model_registry_path
    if not path.exists():
        return _empty_registry()
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_registry(registry: dict[str, Any]) -> None:
    """Write the full registry dict to disk.

    Ensures only v2 keys are persisted — strips legacy keys like
    ``active_model`` and ``versions`` that belong to the old schema.
    """
    allowed_top_keys = {
        "schema_version", "active_model_id", "active_version",
        "promoted_at", "models",
    }
    registry.setdefault("schema_version", REGISTRY_SCHEMA_VERSION)
    cleaned = {k: v for k, v in registry.items() if k in allowed_top_keys}
    cleaned.setdefault("models", {})

    path = settings.model_registry_path
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(cleaned, f, indent=2, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Active model
# ---------------------------------------------------------------------------

def get_active_model_info() -> dict[str, Any] | None:
    """Return the full info dict for the currently active model, or None."""
    reg = load_registry()
    model_id = reg.get("active_model_id")
    if model_id is None:
        return None
    info = reg.get("models", {}).get(model_id)
    if info is not None:
        info.setdefault("model_id", model_id)
    return info


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
    source_notebook: str | None = None,
    artifacts: dict[str, str] | None = None,
    stage: str = "candidate",
    **extra: Any,
) -> None:
    """Add or update a model entry in the registry.

    Paths are automatically converted to project-relative strings.
    """
    reg = load_registry()
    models = reg.setdefault("models", {})

    rel_artifacts: dict[str, str] = {}
    if artifacts:
        rel_artifacts = {k: _to_relative_path(v) for k, v in artifacts.items()}

    models[model_id] = {
        "model_id": model_id,
        "framework": framework,
        "version": version,
        "stage": stage,
        "pkl_path": _to_relative_path(pkl_path),
        "meta_path": _to_relative_path(meta_path),
        "metrics": metrics or {},
        "artifacts": rel_artifacts,
        "source_notebook": source_notebook,
        "registered_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        **{k: v for k, v in extra.items()
           if k not in ("model_id", "stage", "artifacts", "source_notebook")},
    }
    save_registry(reg)


def promote_active_model(model_id: str) -> None:
    """Set the given model_id as the active production model.

    Archives the previously active model (sets stage='archived') and
    marks the new one as stage='production'.
    """
    reg = load_registry()
    models = reg.get("models", {})
    if model_id not in models:
        raise ValueError(f"Model '{model_id}' not found in registry. Register it first.")

    prev_id = reg.get("active_model_id")
    if prev_id and prev_id in models and prev_id != model_id:
        models[prev_id]["stage"] = "archived"

    models[model_id]["stage"] = "production"
    reg["active_model_id"] = model_id
    reg["active_version"] = models[model_id].get("version", "unknown")
    reg["promoted_at"] = dt.datetime.now(dt.timezone.utc).isoformat()
    save_registry(reg)
