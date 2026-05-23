import logging
import re

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.services.llm_service import llm_service
from app.services.chat_history import history_store
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


_ARABIC_LETTER_RE = re.compile(r"[\u0600-\u06FF]")
_HISTORY_INTENT_AR_RE = re.compile(
    r"(سألتك|سئلتك|سالتك).*(لحد\s+دلوقتي|لحد\s+الان|لحد\s+الآن|حتى\s+الان|حتى\s+الآن)",
    flags=re.IGNORECASE,
)
_HISTORY_INTENT_EN_RE = re.compile(
    r"\b(what\s+did\s+i\s+ask|show\s+what\s+i\s+asked|my\s+questions?\s+so\s+far|"
    r"show\s+me\s+my\s+questions|show\s+my\s+chat\s+history|list\s+my\s+questions|"
    r"recap\s+what\s+i\s+asked|what\s+have\s+i\s+asked)\b",
    flags=re.IGNORECASE,
)


def _detect_history_intent(message: str) -> tuple[bool, str]:
    msg = (message or "").strip()
    if not msg:
        return False, "unknown"

    lang = "ar" if _ARABIC_LETTER_RE.search(msg) else "en"

    if lang == "ar" and _HISTORY_INTENT_AR_RE.search(msg):
        return True, "ar"

    if lang == "en" and _HISTORY_INTENT_EN_RE.search(msg):
        return True, "en"

    if _HISTORY_INTENT_AR_RE.search(msg):
        return True, "ar"
    if _HISTORY_INTENT_EN_RE.search(msg):
        return True, "en"

    return False, lang


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
        description=(
            "Optional provider/model selector for testing: auto, cerebras/qwen (primary), "
            "deepinfra/qwen_deepinfra (secondary), groq/llama_groq, Llama_samba, or gemini"
        ),
        examples=["auto", "cerebras", "qwen", "deepinfra", "qwen_deepinfra", "groq", "llama_groq", "Llama_samba", "gemini"],
    )


class ChatResponse(BaseModel):
    """Response model for chat endpoint."""
    response: str = Field(
        ...,
        description="AI-generated response"
    )


class ResetResponse(BaseModel):
    """Response model for reset endpoint."""
    status: str = Field(..., description="Reset status")


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

        is_history_intent, lang = _detect_history_intent(request.message)
        if is_history_intent:
            if not settings.chat_memory_enabled:
                response_text = (
                    "ميزة الذاكرة مقفولة حالياً." if lang == "ar" else "Chat memory is currently disabled."
                )
                return ChatResponse(response=response_text)

            history = await history_store.get_messages(settings.chat_memory_default_conversation_key)
            user_messages = [m.content for m in history if m.role == "user" and m.content.strip()]

            if not user_messages:
                response_text = (
                    "لم تسأل أي أسئلة لحد دلوقتي." if lang == "ar" else "You haven't asked any questions yet."
                )
                return ChatResponse(response=response_text)

            header = (
                "إليك الأسئلة اللي سألتها لحد دلوقتي:" if lang == "ar" else "Here are your questions so far:"
            )
            lines = [f"- {idx}. {text}" for idx, text in enumerate(user_messages, start=1)]
            response_text = header + "\n\n" + "\n".join(lines)
            return ChatResponse(response=response_text)

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


@router.post(
    "/chat/reset",
    response_model=ResetResponse,
    status_code=status.HTTP_200_OK,
    summary="Reset chat memory (dev)",
    description="Clears the in-memory chat history for the default dev conversation.",
    tags=["Chat"],
)
async def reset_chat_memory() -> ResetResponse:
    await history_store.reset(settings.chat_memory_default_conversation_key)
    return ResetResponse(status="ok")
