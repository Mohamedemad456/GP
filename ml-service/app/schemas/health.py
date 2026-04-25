from pydantic import BaseModel
from typing import Optional

class HealthResponse(BaseModel):
    status: str
    model_version: Optional[str] = None
    uptime: Optional[str] = None
