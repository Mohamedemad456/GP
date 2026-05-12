"""
Prediction API endpoints.

Uses sync `def` (not `async def`) because the underlying ML code
(XGBoost, SHAP, pandas) is CPU-bound and would block the event loop
if run in an async handler.
"""
import datetime
import logging
import time

from fastapi import APIRouter, HTTPException
from app.core.logging_config import log_prediction_audit
from app.core.metrics import record_prediction, record_prediction_error, record_batch_request

from app.schemas.prediction import (
    PredictionRequest, PredictionResponse, NegotiationRange, PriceFactor,
    BatchPredictionRequest, BatchPredictionResponse, BatchPredictionItem,
)
from app.services import predictor
import app.services.model_state as _ms
from app.core.price_rounding import round_egp_market_price

logger = logging.getLogger(__name__)

router = APIRouter()


def _audit_prediction(
    request: PredictionRequest,
    *,
    duration_ms: float,
    success: bool,
    fair_price: float | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    confidence: str | None = None,
    model_version: str | None = None,
    error_type: str | None = None,
    error_message: str | None = None,
) -> None:
    log_prediction_audit(
        request_id=None,
        brand=request.brand,
        model=request.model,
        year=request.year,
        mileage_km=request.mileage_km,
        transmission=request.transmission,
        fuel=request.fuel,
        location=request.location,
        fair_price=fair_price,
        min_price=min_price,
        max_price=max_price,
        confidence=confidence,
        model_version=model_version,
        active_model_id=_ms.ACTIVE_MODEL_ID,
        duration_ms=round(duration_ms, 1),
        success=success,
        error_type=error_type,
        error_message=error_message,
    )


def _build_response(result: dict) -> PredictionResponse:
    """Build a PredictionResponse from the internal predict_full result dict."""
    fair_price = round_egp_market_price(result["fair_price"])
    min_price = round_egp_market_price(result["negotiation_range"]["min_price"])
    max_price = round_egp_market_price(result["negotiation_range"]["max_price"])

    # Keep ordering invariant after rounding
    if fair_price is not None:
        if min_price is not None:
            min_price = min(min_price, fair_price)
        if max_price is not None:
            max_price = max(max_price, fair_price)
    if min_price is not None and max_price is not None:
        min_price, max_price = min(min_price, max_price), max(min_price, max_price)

    factors = None
    if result.get("price_factors"):
        factors = [PriceFactor(**f) for f in result["price_factors"]]

    return PredictionResponse(
        fair_price=fair_price if fair_price is not None else result["fair_price"],
        negotiation_range=NegotiationRange(
            min_price=min_price if min_price is not None else result["negotiation_range"]["min_price"],
            max_price=max_price if max_price is not None else result["negotiation_range"]["max_price"],
        ),
        confidence=result["confidence"],
        price_factors=factors,
        model_version=result["model_version"],
        predicted_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
    )


@router.post("/api/v1/predict", response_model=PredictionResponse)
def predict_endpoint(request: PredictionRequest):
    """Return price prediction using the active quantile model."""
    start = time.monotonic()

    if not _ms.check_car_validity(request.brand, request.model):
        _audit_prediction(
            request,
            duration_ms=(time.monotonic() - start) * 1000,
            success=False,
            error_type="validation_error",
            error_message=(
                f"Make '{request.brand}', Model '{request.model}' combination is not available in our current dataset."
            ),
            model_version=_ms.get_active_model_version(),
        )
        raise HTTPException(
            status_code=400,
            detail=f"Make '{request.brand}', Model '{request.model}' combination is not available in our current dataset."
        )

    if not _ms.is_model_loaded():
        _audit_prediction(
            request,
            duration_ms=(time.monotonic() - start) * 1000,
            success=False,
            error_type="service_unavailable",
            error_message="Model not loaded. Please ensure a model is registered and the server has loaded it.",
            model_version=_ms.get_active_model_version(),
        )
        raise HTTPException(
            status_code=503,
            detail="Model not loaded. Please ensure a model is registered and the server has loaded it."
        )

    try:
        result = predictor.predict_full(
            make=request.brand,
            model=request.model,
            year=request.year,
            mileage_km=request.mileage_km,
            transmission=request.transmission,
            fuel=request.fuel,
            location=request.location,
            include_factors=request.include_factors or False,
        )
    except ValueError as e:
        _audit_prediction(
            request,
            duration_ms=(time.monotonic() - start) * 1000,
            success=False,
            error_type=type(e).__name__,
            error_message=str(e),
            model_version=_ms.get_active_model_version(),
        )
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error("Prediction failed: %s", e, exc_info=True)
        record_prediction_error()
        _audit_prediction(
            request,
            duration_ms=(time.monotonic() - start) * 1000,
            success=False,
            error_type=type(e).__name__,
            error_message=str(e),
            model_version=_ms.get_active_model_version(),
        )
        raise HTTPException(status_code=500, detail="Prediction failed.")

    duration = time.monotonic() - start
    record_prediction(confidence=result["confidence"], duration_s=duration)
    _audit_prediction(
        request,
        duration_ms=duration * 1000,
        success=True,
        fair_price=result["fair_price"],
        min_price=result["negotiation_range"]["min_price"],
        max_price=result["negotiation_range"]["max_price"],
        confidence=result["confidence"],
        model_version=result["model_version"],
    )
    return _build_response(result)


@router.post("/api/v1/predict/batch", response_model=BatchPredictionResponse)
def predict_batch_endpoint(request: BatchPredictionRequest):
    """Best-effort batch prediction. Returns partial results on individual failures."""
    record_batch_request()
    results: list[BatchPredictionItem] = []
    successful = 0
    failed = 0

    for i, item in enumerate(request.items):
        item_start = time.monotonic()
        try:
            if not _ms.check_car_validity(item.brand, item.model):
                _audit_prediction(
                    item,
                    duration_ms=(time.monotonic() - item_start) * 1000,
                    success=False,
                    error_type="validation_error",
                    error_message=f"Make '{item.brand}', Model '{item.model}' not in dataset.",
                    model_version=_ms.get_active_model_version(),
                )
                results.append(BatchPredictionItem(
                    index=i, success=False,
                    error=f"Make '{item.brand}', Model '{item.model}' not in dataset."
                ))
                failed += 1
                continue

            if not _ms.is_model_loaded():
                _audit_prediction(
                    item,
                    duration_ms=(time.monotonic() - item_start) * 1000,
                    success=False,
                    error_type="service_unavailable",
                    error_message="Model not loaded.",
                    model_version=_ms.get_active_model_version(),
                )
                results.append(BatchPredictionItem(
                    index=i, success=False, error="Model not loaded."
                ))
                failed += 1
                continue

            result = predictor.predict_full(
                make=item.brand,
                model=item.model,
                year=item.year,
                mileage_km=item.mileage_km,
                transmission=item.transmission,
                fuel=item.fuel,
                location=item.location,
                include_factors=item.include_factors or False,
            )
            record_prediction(
                confidence=result["confidence"],
                duration_s=time.monotonic() - item_start,
            )
            _audit_prediction(
                item,
                duration_ms=(time.monotonic() - item_start) * 1000,
                success=True,
                fair_price=result["fair_price"],
                min_price=result["negotiation_range"]["min_price"],
                max_price=result["negotiation_range"]["max_price"],
                confidence=result["confidence"],
                model_version=result["model_version"],
            )
            results.append(BatchPredictionItem(
                index=i, success=True, result=_build_response(result)
            ))
            successful += 1

        except Exception as e:
            logger.warning("Batch item %d failed: %s", i, e)
            record_prediction_error()
            _audit_prediction(
                item,
                duration_ms=(time.monotonic() - item_start) * 1000,
                success=False,
                error_type=type(e).__name__,
                error_message=str(e),
                model_version=_ms.get_active_model_version(),
            )
            results.append(BatchPredictionItem(
                index=i, success=False, error=str(e)
            ))
            failed += 1

    return BatchPredictionResponse(
        total=len(request.items),
        successful=successful,
        failed=failed,
        results=results,
    )
