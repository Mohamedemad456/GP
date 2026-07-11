import asyncio
import time
from dataclasses import dataclass
from typing import Literal

from app.core.config import settings


ChatRole = Literal["user", "assistant"]


@dataclass(frozen=True)
class ChatMessage:
    role: ChatRole
    content: str


@dataclass
class ConversationState:
    messages: list[ChatMessage]
    updated_at: float


class InMemoryHistoryStore:
    def __init__(self, ttl_seconds: int, max_turns: int) -> None:
        self._ttl_seconds = max(0, int(ttl_seconds))
        self._max_turns = max(0, int(max_turns))
        self._conversations: dict[str, ConversationState] = {}
        self._lock = asyncio.Lock()

    @property
    def max_messages(self) -> int:
        if self._max_turns <= 0:
            return 0
        return self._max_turns * 2

    def _is_expired(self, state: ConversationState, now: float) -> bool:
        if self._ttl_seconds <= 0:
            return False
        return (now - state.updated_at) > self._ttl_seconds

    def _get_or_create_state(self, conversation_key: str, now: float) -> ConversationState:
        state = self._conversations.get(conversation_key)
        if state is None:
            state = ConversationState(messages=[], updated_at=now)
            self._conversations[conversation_key] = state
            return state

        if self._is_expired(state, now):
            state.messages = []
            state.updated_at = now

        return state

    def _trim_in_place(self, state: ConversationState) -> None:
        max_messages = self.max_messages
        if max_messages <= 0:
            return

        overflow = len(state.messages) - max_messages
        if overflow > 0:
            del state.messages[:overflow]

    async def get_messages(self, conversation_key: str) -> list[ChatMessage]:
        now = time.time()
        async with self._lock:
            state = self._get_or_create_state(conversation_key, now)
            self._trim_in_place(state)
            return list(state.messages)

    async def append_turn(self, conversation_key: str, user_text: str, assistant_text: str) -> None:
        now = time.time()
        async with self._lock:
            state = self._get_or_create_state(conversation_key, now)
            state.messages.append(ChatMessage(role="user", content=user_text))
            state.messages.append(ChatMessage(role="assistant", content=assistant_text))
            state.updated_at = now
            self._trim_in_place(state)

    async def reset(self, conversation_key: str) -> None:
        now = time.time()
        async with self._lock:
            state = self._conversations.get(conversation_key)
            if state is None:
                return
            state.messages = []
            state.updated_at = now


history_store = InMemoryHistoryStore(
    ttl_seconds=getattr(settings, "chat_memory_ttl_seconds", 21600),
    max_turns=getattr(settings, "chat_memory_max_turns", 20),
)
