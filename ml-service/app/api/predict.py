from fastapi import APIRouter, HTTPException
from app.schemas.prediction import PredictionRequest, PredictionResponse, NegotiationRange, PriceFactor
from app.services import predictor
from app.core.price_rounding import round_egp_market_price
import datetime

router = APIRouter()


@router.post("/api/v1/predict", response_model=PredictionResponse)
async def predict_endpoint(request: PredictionRequest):
    """Return price prediction using the active quantile model."""
    is_valid = predictor.check_car_validity(request.brand, request.model)

    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail=f"Make '{request.brand}', Model '{request.model}' combination is not available in our current dataset."
        )

    if predictor.ACTIVE_MODELS is None:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded. Please ensure a model is registered and the server has loaded it."
        )

    result = predictor.predict_price(
        make=request.brand,
        model=request.model,
        year= request.year,
        mileage_km=request.mileage_km,
        transmission=request.transmission,
        fuel=request.fuel,
        location=request.location,
    )

    factors = None
    if request.include_factors:
        shap_factors = predictor.compute_price_factors(
            make=request.brand,
            model=request.model,
            year=request.year,
            mileage_km=request.mileage_km,
            transmission=request.transmission,
            fuel=request.fuel,
            location=request.location,
        )
        if shap_factors:
            factors = [PriceFactor(**f) for f in shap_factors]

    confidence = predictor.compute_confidence_label(
        make=request.brand,
        model=request.model,
        prediction=result,
    )

    fair_price = round_egp_market_price(result.get("fair_price"))
    lower_price = round_egp_market_price(result.get("lower_price"))
    upper_price = round_egp_market_price(result.get("upper_price"))

    # Keep the ordering invariant after rounding.
    if fair_price is not None:
        if lower_price is not None:
            lower_price = min(lower_price, fair_price)
        if upper_price is not None:
            upper_price = max(upper_price, fair_price)
    if lower_price is not None and upper_price is not None:
        lower_price, upper_price = min(lower_price, upper_price), max(lower_price, upper_price)

    return PredictionResponse(
        fair_price=fair_price if fair_price is not None else result["fair_price"],
        negotiation_range=NegotiationRange(
            min_price=lower_price if lower_price is not None else result["lower_price"],
            max_price=upper_price if upper_price is not None else result["upper_price"],
        ),
        confidence=confidence,
        price_factors=factors,
        model_version=result['model_version'],
        predicted_at=datetime.datetime.now(datetime.timezone.utc).isoformat()
    )
