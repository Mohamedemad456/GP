from pydantic import BaseModel
from typing import Optional

class HealthResponse(BaseModel):
    status: str
    model_version: Optional[str] = None
    uptime: Optional[str] = None
    model_loaded: bool = False
    framework: Optional[str] = None
    active_model_id: Optional[str] = None
    diagnostics_loaded: bool = False
