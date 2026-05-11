from pydantic import BaseModel, ConfigDict
from typing import Optional, List

class PredictionRequest(BaseModel):
    brand: str
    model: str
    year: int
    mileage_km: Optional[float] = None
    transmission: Optional[str] = None
    fuel: Optional[str] = None
    location: Optional[str] = None
    include_factors: Optional[bool] = False
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "brand": "Toyota",
                "model": "Corolla",
                "year": 2018,
                "mileage_km": 85000,
                "transmission": "Automatic",
                "fuel": "petrol",
                "location": "Cairo",
                "include_factors": True
            }
        }
    )

class PriceFactor(BaseModel):
    factor: str
    direction: str
    description: str

class NegotiationRange(BaseModel):
    min_price: float
    max_price: float

class PredictionResponse(BaseModel):
    fair_price: float
    negotiation_range: NegotiationRange
    confidence: str
    price_factors: Optional[List[PriceFactor]] = None
    model_version: str
    predicted_at: str
