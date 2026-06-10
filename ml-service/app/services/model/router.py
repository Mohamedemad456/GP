"""
router.py — Model fallback routing service.

Implements the "Best Older Match" policy:
  1. Unknown make  → validation error
  2. Active model has exact (make, model)  → use active model
  3. Else, newest older registered model with exact combo  → fallback
  4. Else, make known but model unsupported anywhere  → active-model generalization
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

from app.core.model_registry import load_registry
from app.services.model.model_state import (
    check_make_known,
    get_model_coverage,
)
import app.services.model.model_state as _ms

logger = logging.getLogger(__name__)


# ── Result type ───────────────────────────────────────────────────────────────

@dataclass
class RoutingResult:
    """Outcome of the fallback routing decision."""
    coverage_mode: str   # exact_match | known_make_model_missing | unknown_make
    target_model_id: str | None   # None means "use active model"
    fallback_used: bool
    fallback_reason: str | None


# ── Core routing logic ────────────────────────────────────────────────────────

def resolve_model_for_prediction(make: str, model: str) -> RoutingResult:
    """Determine which model should serve a prediction request.

    Returns a RoutingResult describing the decision.  Callers should:
      - raise validation error when coverage_mode == "unknown_make"
      - use active model normally when coverage_mode == "exact_match"
      - use active model with degraded confidence when coverage_mode == "known_make_model_missing"
    """
    mk = str(make).strip().lower()
    md = str(model).strip().lower()

    # 1. Unknown make → hard error
    if not check_make_known(make):
        logger.info(
            "Routing: unknown make '%s' (model '%s') — rejecting request.",
            make, model,
        )
        return RoutingResult(
            coverage_mode="unknown_make",
            target_model_id=None,
            fallback_used=False,
            fallback_reason=f"Make '{make}' is not present in processed data",
        )

    # 2. Active model exact match?
    active_id = _ms.ACTIVE_MODEL_ID
    if active_id:
        active_coverage = get_model_coverage(active_id)
        if active_coverage and (mk, md) in active_coverage:
            logger.debug(
                "Routing: exact match for (%s, %s) in active model '%s'.",
                make, model, active_id,
            )
            return RoutingResult(
                coverage_mode="exact_match",
                target_model_id=None,  # use active model
                fallback_used=False,
                fallback_reason=None,
            )

    # 3. Active model is loaded and make is known → always use active model.
    #    Older-model fallback is removed so activation always changes the
    #    serving model.  Generalization (degraded confidence) is acceptable.
    if active_id:
        logger.info(
            "Routing: active model '%s' does not cover (%s, %s) — "
            "using active-model generalization.",
            active_id, make, model,
        )
        return RoutingResult(
            coverage_mode="known_make_model_missing",
            target_model_id=None,  # use active model
            fallback_used=False,
            fallback_reason=(
                f"Active model '{active_id}' does not cover ({make}, {model}); "
                f"generalizing with degraded confidence"
            ),
        )

    # 4. No active model loaded but make is known → generalize (edge case)
    logger.info(
        "Routing: known make '%s' but no active model loaded — generalizing.",
        make,
    )
    return RoutingResult(
        coverage_mode="known_make_model_missing",
        target_model_id=None,
        fallback_used=False,
        fallback_reason="No active model loaded",
    )


# ── Observability helpers ─────────────────────────────────────────────────────

def get_registry_models_sorted() -> list[dict]:
    """Return all registered models sorted by registered_at descending."""
    reg = load_registry()
    models = reg.get("models", {})
    items = []
    for model_id, info in models.items():
        items.append({
            "model_id": model_id,
            "registered_at": info.get("registered_at", ""),
            "version": info.get("version", "unknown"),
            "stage": info.get("stage", "unknown"),
            "framework": info.get("framework", "unknown"),
        })
    items.sort(key=lambda x: x["registered_at"], reverse=True)
    return items
