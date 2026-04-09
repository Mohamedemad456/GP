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
    model: str | None = Field(
        default=None,
        description="Optional provider selector for testing: auto, Llama_groq, Llama_samba, or gemini",
        examples=["auto", "Llama_groq", "Llama_samba", "gemini"],
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
        logger.info(
            "Chat request received model=%s message_length=%s",
            request.model or "auto",
            len(request.message),
        )
        response_text = await llm_service.generate_response(request.message, request.model)
        return ChatResponse(response=response_text)

    except ValueError as e:
        logger.warning("Invalid chat request model: %s", e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
        
    except Exception as e:
        logger.exception("Chat endpoint failed")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate response. Please try again."
        )