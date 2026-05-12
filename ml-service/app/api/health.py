from fastapi import APIRouter
from app.schemas.health import HealthResponse
import app.services.model_state as _ms
import datetime

router = APIRouter()
start_time = datetime.datetime.now(datetime.timezone.utc)


@router.get("/health", response_model=HealthResponse)
def health_check():
    """Returns service status, active model version, and uptime."""
    uptime = datetime.datetime.now(datetime.timezone.utc) - start_time
    active_version = _ms.get_active_model_version()

    return HealthResponse(
        status="ok",
        model_version=active_version,
        uptime=str(uptime),
        model_loaded=_ms.is_model_loaded(),
        framework=_ms.ACTIVE_FRAMEWORK,
        active_model_id=_ms.ACTIVE_MODEL_ID,
        diagnostics_loaded=_ms.is_diagnostics_loaded(),
    )
