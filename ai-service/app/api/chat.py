import sys
from pathlib import Path
current_dir = Path(__file__).resolve()
app_dir = current_dir.parent.parent
project_root = app_dir.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.llm_service import llm_service
    
router = APIRouter()

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: str

@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    try:
        response_text = await llm_service.generate_response(request.message)
        return ChatResponse(response=response_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
