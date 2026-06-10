"""
Admin API endpoints for model management.

Mounted under /admin/* with no auth in Phase 1 (localhost-only internal tool).
"""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException

from app.core.model_registry import (
    load_registry,
    promote_active_model,
    load_model_metadata,
    get_active_model_info,
)
from app.services.model.model_state import (
    get_model_coverage,
    clear_model_coverage_cache,
    reload_active_model,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _extract_dataset_tag(info: dict, metadata: dict | None) -> str | None:
    """Return a normalized dataset tag from metadata or registry info."""
    if metadata:
        for key in ("dataset_tag", "data_version"):
            val = metadata.get(key)
            if val:
                return str(val)
    for key in ("dataset_tag", "data_version"):
        val = info.get(key)
        if val:
            return str(val)
    # Infer from model_id pattern like v2_2026-06-03_008
    mid = info.get("model_id", "")
    if "2026-" in mid:
        parts = mid.split("_")
        for p in parts:
            if "2026-" in p:
                return p
    return None


def _build_model_detail(model_id: str, info: dict) -> dict[str, Any]:
    """Construct a detailed model response dict."""
    coverage = get_model_coverage(model_id)
    makes = sorted({mk for mk, _ in coverage})
    models = sorted({md for _, md in coverage})

    # Load metadata for dataset provenance
    metadata = load_model_metadata(model_id)
    dataset_tag = _extract_dataset_tag(info, metadata)
    sample_counts = {}
    if metadata and isinstance(metadata, dict):
        for key in ("n_train", "n_test", "n_cal"):
            if key in metadata:
                sample_counts[key] = metadata[key]

    detail = {
        "model_id": model_id,
        "framework": info.get("framework", "unknown"),
        "version": info.get("version", "unknown"),
        "stage": info.get("stage", "unknown"),
        "pkl_path": info.get("pkl_path"),
        "meta_path": info.get("meta_path"),
        "metrics": info.get("metrics", {}),
        "artifacts": info.get("artifacts", {}),
        "source_notebook": info.get("source_notebook"),
        "registered_at": info.get("registered_at"),
        "tags": info.get("tags", []),
        "diagnostics_summary": info.get("diagnostics_summary", {}),
        "dataset_tag": dataset_tag,
        "sample_counts": sample_counts if sample_counts else None,
        "coverage": {
            "combo_count": len(coverage),
            "make_count": len(makes),
            "makes": makes,
            "models": models,
        },
    }

    if metadata and isinstance(metadata, dict) and metadata != info:
        detail["metadata"] = metadata

    return detail


def _build_registry_summary(reg: dict) -> dict[str, Any]:
    """Build a summary object for the list endpoint."""
    models = reg.get("models", {})
    active_id = reg.get("active_model_id")

    if not models:
        return {
            "active_model_id": active_id,
            "total_models": 0,
            "latest_candidate": None,
            "datasets_represented": [],
        }

    # Find latest candidate (most recently registered non-production model)
    candidates = [
        (mid, info) for mid, info in models.items()
        if info.get("stage") != "production"
    ]
    latest_candidate = None
    if candidates:
        candidates.sort(key=lambda x: x[1].get("registered_at", ""), reverse=True)
        latest_candidate = candidates[0][0]

    # Collect dataset tags from metadata for accuracy
    datasets: set[str] = set()
    for model_id, info in models.items():
        metadata = load_model_metadata(model_id)
        tag = _extract_dataset_tag(info, metadata)
        if tag:
            datasets.add(tag)
        else:
            # Fallback: infer from model_id
            mid = info.get("model_id", "")
            if "2026-" in mid:
                parts = mid.split("_")
                for p in parts:
                    if "2026-" in p:
                        datasets.add(p)

    return {
        "active_model_id": active_id,
        "active_version": reg.get("active_version"),
        "promoted_at": reg.get("promoted_at"),
        "total_models": len(models),
        "latest_candidate": latest_candidate,
        "datasets_represented": sorted(datasets),
    }


# ── Endpoints ───────────────────────────────────────────────────────────────────

@router.get("/models")
def list_models() -> dict[str, Any]:
    """List all registered models with sortable fields + registry summary."""
    reg = load_registry()
    models = reg.get("models", {})
    active_id = reg.get("active_model_id")

    items = []
    for model_id, info in models.items():
        metadata = load_model_metadata(model_id)
        dataset_tag = _extract_dataset_tag(info, metadata)
        items.append({
            "model_id": model_id,
            "version": info.get("version", "unknown"),
            "stage": info.get("stage", "unknown"),
            "framework": info.get("framework", "unknown"),
            "registered_at": info.get("registered_at", ""),
            "metrics": info.get("metrics", {}),
            "dataset_tag": dataset_tag,
            "is_active": model_id == active_id,
        })

    # Sort by registered_at descending (newest first)
    items.sort(key=lambda x: x["registered_at"], reverse=True)

    return {
        "summary": _build_registry_summary(reg),
        "models": items,
    }


@router.get("/models/{model_id}")
def get_model(model_id: str) -> dict[str, Any]:
    """Return full detail for one model: metadata + artifacts + diagnostics + coverage."""
    reg = load_registry()
    info = reg.get("models", {}).get(model_id)
    if info is None:
        raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found in registry.")

    return _build_model_detail(model_id, info)


@router.post("/models/{model_id}/activate")
def activate_model(model_id: str) -> dict[str, Any]:
    """Promote a model to active production status."""
    reg = load_registry()
    if model_id not in reg.get("models", {}):
        raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found in registry.")

    prev_id = reg.get("active_model_id")

    try:
        promote_active_model(model_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError:
        raise HTTPException(
            status_code=500,
            detail=(
                f"Cannot write model registry file. "
                f"The container may lack write access to the mounted models directory. "
                f"Check that the ml-service volume is writable."
            ),
        )
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"Failed to save registry: {e}")

    # Clear coverage cache since active model changed
    clear_model_coverage_cache()

    # Reload the model in-memory so predictions use it immediately
    reload_status = reload_active_model()
    if not reload_status.get("success"):
        logger.error("Activation succeeded but model reload failed: %s", reload_status.get("error"))
        raise HTTPException(
            status_code=500,
            detail=(
                f"Model '{model_id}' was promoted in the registry, but reloading it in memory failed. "
                f"Error: {reload_status.get('error')}"
            ),
        )

    logger.info("Admin activated and reloaded model '%s' (was '%s')", model_id, prev_id)

    return {
        "success": True,
        "activated_model_id": model_id,
        "previous_model_id": prev_id,
        "reloaded": True,
        "message": f"Model '{model_id}' is now active and loaded in memory.",
    }
