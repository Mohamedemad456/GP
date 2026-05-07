from fastapi import APIRouter, HTTPException
from app.schemas.prediction import PredictionRequest, PredictionResponse, NegotiationRange, PriceFactor
from app.services.predictor import check_car_validity
import datetime

router = APIRouter()

@router.post("/api/v1/predict", response_model=PredictionResponse)
async def predict_price(request: PredictionRequest):
    """
    Return price prediction. This is currently returning dummy data 
    for backend integration purposes.
    """
    is_valid = check_car_validity(request.brand, request.model, request.year)
    
    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail=f"Make '{request.brand}', Model '{request.model}', Year {request.year} combination is not available in our current dataset."
        )
    
    # Dummy data generation for valid car
    fair_price = 485000.0
    min_price = fair_price * 0.85
    max_price = fair_price * 1.15
    
    factors = None
    if request.include_factors:
        factors = [
            PriceFactor(factor="mileage_km", direction="negative", description="High mileage decreases price"),
            PriceFactor(factor="year", direction="positive", description="Newer car increases price"),
        ]
        
    return PredictionResponse(
        fair_price=fair_price,
        negotiation_range=NegotiationRange(min_price=min_price, max_price=max_price),
        confidence="high",
        price_factors=factors,
        model_version="v1.0.0",
        predicted_at=datetime.datetime.now(datetime.timezone.utc).isoformat()
    )
