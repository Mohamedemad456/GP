import logging

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.services.llm_service import llm_service

logger = logging.getLogger(__name__)

router = APIRouter()


class ChatRequest(BaseModel):
    """Request model for chat endpoint."""
    message: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="User's message in English or Arabic",
        examples=["What should I look for when buying a used car?"]
    )


class ChatResponse(BaseModel):
    """Response model for chat endpoint."""
    response: str = Field(
        ...,
        description="AI-generated response"
    )


@router.post(
    "/chat",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
    summary="Chat with AI Assistant",
    description="Send a message to Mohamed Seif, your car dealership AI assistant! then receive a response. Supports English and Arabic.",
    tags=["Chat"]
)
async def chat_endpoint(request: ChatRequest) -> ChatResponse:
    """
    Process user message and return AI response.
    Raises:
        HTTPException: 500 if LLM service fails
    """
    try:
        response_text = await llm_service.generate_response(request.message)
        return ChatResponse(response=response_text)
        
    except Exception as e:
        logger.exception("Chat endpoint failed")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate response. Please try again."
        )