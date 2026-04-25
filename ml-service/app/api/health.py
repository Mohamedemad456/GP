from fastapi import APIRouter
from app.schemas.health import HealthResponse
import datetime

router = APIRouter()
start_time = datetime.datetime.now(datetime.timezone.utc)

@router.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Returns service status, active model version, and uptime.
    """
    uptime = datetime.datetime.now(datetime.timezone.utc) - start_time
    # Hardcoded dummy model version for now
    active_version = "v1.0.0" 
    
    return HealthResponse(
        status="ok",
        model_version=active_version,
        uptime=str(uptime)
    )
