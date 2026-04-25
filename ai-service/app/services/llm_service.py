import yaml
import asyncio
import logging
import re
import unicodedata
from pathlib import Path
from google import genai
from google.genai import types
from typing import Optional
from openai import AsyncOpenAI  # type: ignore
from sambanova import SambaNova

from app.core.config import settings
from app.services.chat_history import ChatMessage, history_store
from app.services.car_lookup import CarSpecsLookup
from app.services.context_builder import build_search_context, build_specs_context

logger = logging.getLogger(__name__)


_CJK_CHAR_RE = re.compile(
    r"[\u3040-\u30ff"  # Hiragana + Katakana
    r"\u3400-\u4dbf"  # CJK Unified Ideographs Extension A
    r"\u4e00-\u9fff"  # CJK Unified Ideographs
    r"\uf900-\ufaff"  # CJK Compatibility Ideographs
    r"\uac00-\ud7af]"  # Hangul Syllables
)

_ARABIC_LETTER_RE = re.compile(r"[\u0600-\u06FF]")


def _is_ascii_allowed(cp: int) -> bool:
    return cp in (0x09, 0x0A, 0x0D) or 0x20 <= cp <= 0x7E


def _is_arabic_allowed(cp: int) -> bool:
    arabic_ranges = (
        (0x0600, 0x06FF),
        (0x0750, 0x077F),
        (0x08A0, 0x08FF),
        (0xFB50, 0xFDFF),
        (0xFE70, 0xFEFF),
    )
    for start, end in arabic_ranges:
        if start <= cp <= end:
            return True
    return False


def _strip_latin_diacritics(text: str) -> str:
    if not text:
        return text

    normalized = unicodedata.normalize("NFKD", text)
    out_chars: list[str] = []
    last_base_is_latin = False

    for ch in normalized:
        if unicodedata.combining(ch):
            if last_base_is_latin:
                continue
            out_chars.append(ch)
            continue

        cp = ord(ch)
        last_base_is_latin = (0x41 <= cp <= 0x5A) or (0x61 <= cp <= 0x7A)
        out_chars.append(ch)

    return "".join(out_chars)

ModelChoice = Optional[str]


class LLMService:
    """
    Service for generating AI responses with automatic provider fallback.
    Uses Cerebras first (Qwen), then Groq, then SambaNova, then Gemini.

    Providers:
    - Primary: Cerebras (Qwen 3 235B)
    - Secondary: Groq (Llama 3.3 70B)
    - Tertiary: SambaNova (Meta-Llama-3.3-70B-Instruct)
    - Quaternary: Google (Gemini-3-preview)

    Flow:
    User message → Try Cerebras → If fails → Try Groq → If fails → Try SambaNova → If fails → Try Gemini → Return response

    Loads system prompts and parameters from YAML configuration.
    """
    
    def __init__(self):
        """Initialize the LLM service with API client and load prompts."""

        self.cerebras_client: AsyncOpenAI | None = None
        if settings.cerebras_api_key:
            self.cerebras_client = AsyncOpenAI(
                base_url=settings.cerebras_base_url,
                api_key=settings.cerebras_api_key,
            )

        self.groq_client = AsyncOpenAI(
            base_url=settings.groq_base_url,
            api_key=settings.groq_api_key,
        )

        self.sambanova_client = SambaNova(
            api_key=settings.sambanova_api_key,
            base_url=settings.sambanova_base_url,
        )

        self.gemini_client = genai.Client(
            api_key=settings.gemini_api_key,
        )

        # Load configuration from YAML prompt templates
        self.config = self._load_config()
        self.system_prompt = self.config["system_prompt"]
        self.model_params = self.config["model_params"]
        self.timeout = self.config["timeout"]
        self.few_shot_examples = self.config.get("few_shot_examples", [])
        self.system_instruction = self._build_system_instruction(
            system_prompt=self.system_prompt,
            few_shot_examples=self.few_shot_examples,
        )

        # Grounding (CSV lookup) — fail open if files are missing.
        self.car_lookup: CarSpecsLookup | None = None
        try:
            self.car_lookup = CarSpecsLookup(
                csv_path=settings.ai_lookup_csv_path,
                aliases_yaml_path=settings.car_aliases_yaml_path,
                egypt_market_notes_yaml_path=settings.egypt_market_notes_yaml_path,
            )
        except Exception as exc:
            logger.warning("Car lookup disabled: %s", exc)

    def _augment_with_grounding(self, user_message: str) -> str:
        if not self.car_lookup:
            return user_message

        try:
            # 1) Search/filter intent
            if self.car_lookup.is_search_query(user_message):
                filters = self.car_lookup.parse_filters(user_message)
                total, summaries = self.car_lookup.search(filters)
                if total > 0:
                    context = build_search_context(total, summaries, filters)
                    if context:
                        return f"{context}\n\nUser question: {user_message}"

            # 2) Specific car specs intent
            mention = self.car_lookup.extract_mention(user_message)
            if not mention:
                return user_message

            rows = self.car_lookup.lookup_specs(mention)
            if not rows:
                return user_message

            egypt_note = self.car_lookup.get_egypt_note(mention.make, mention.model)
            context = build_specs_context(rows, egypt_note=egypt_note)
            if not context:
                return user_message

            return f"{context}\n\nUser question: {user_message}"

        except Exception as exc:
            logger.warning("Grounding failed; continuing without lookup: %s", exc)
            return user_message

    def _build_system_instruction(self, system_prompt: str, few_shot_examples: list[dict]) -> str:
        examples_text_lines: list[str] = []
        for ex in few_shot_examples:
            role = str(ex.get("role", "")).strip().lower()
            content = str(ex.get("content", "")).strip()
            if not content:
                continue

            if role == "user":
                examples_text_lines.append("User: " + content)
            elif role == "assistant":
                examples_text_lines.append("Assistant: " + content)
            else:
                examples_text_lines.append(content)

        examples_block = "\n\n".join(examples_text_lines).strip()

        instruction_parts: list[str] = [system_prompt.strip()]

        if examples_block:
            instruction_parts.append(
                "\n\n"
                "## Style Examples (NOT conversation history)\n"
                "The examples below are demonstrations of preferred style and terminology. "
                "They are NOT part of the user's chat history, and must never be treated as prior user messages.\n\n"
                + examples_block
            )

        instruction_parts.append(
            "\n\n"
            "## Output Script Guardrail\n"
            "Do not output Chinese/Japanese/Korean characters. "
            "If you are responding in Arabic, use Arabic script plus plain English (ASCII) car terms only. "
            "Do not output accented Latin letters or any other scripts."
        )

        return "\n".join(part.strip() for part in instruction_parts if part.strip()).strip()

    def _sanitize_response_text(self, text: str, *, expected_lang: str) -> str:
        if not text:
            return text

        cleaned = _CJK_CHAR_RE.sub("", text)
        cleaned = _strip_latin_diacritics(cleaned)
        cleaned = (
            cleaned.replace("•", "-")
            .replace("–", "-")
            .replace("—", "-")
            .replace("−", "-")
            .replace("“", '"')
            .replace("”", '"')
            .replace("‘", "'")
            .replace("’", "'")
            .replace("…", "...")
            .replace("£", "EGP")
            .replace("€", "EUR")
        )

        if expected_lang == "ar":
            filtered_chars: list[str] = []
            for ch in cleaned:
                cp = ord(ch)
                if _is_ascii_allowed(cp) or _is_arabic_allowed(cp):
                    filtered_chars.append(ch)
            cleaned = "".join(filtered_chars)
        else:
            filtered_chars = [ch for ch in cleaned if _is_ascii_allowed(ord(ch))]
            cleaned = "".join(filtered_chars)

        cleaned = re.sub(r"[ \t]{2,}", " ", cleaned)
        cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
        return cleaned.strip()

    def _format_openai_messages(
        self,
        history: list[ChatMessage],
        user_message: str,
    ) -> list[dict[str, str]]:
        messages: list[dict[str, str]] = [{"role": "system", "content": self.system_instruction}]

        for msg in history:
            if msg.role == "user":
                messages.append({"role": "user", "content": msg.content})
            elif msg.role == "assistant":
                messages.append({"role": "assistant", "content": msg.content})

        messages.append({"role": "user", "content": user_message})
        return messages

    def _format_gemini_contents(
        self,
        history: list[ChatMessage],
        user_message: str,
    ) -> list[types.Content]:
        contents: list[types.Content] = []

        for msg in history:
            role = "user" if msg.role == "user" else "model"
            contents.append(
                types.Content(
                    role=role,
                    parts=[types.Part.from_text(text=msg.content)],
                )
            )

        contents.append(
            types.Content(
                role="user",
                parts=[types.Part.from_text(text=user_message)],
            )
        )

        return contents

    async def _get_history(self, conversation_key: str) -> list[ChatMessage]:
        if not settings.chat_memory_enabled:
            return []
        return await history_store.get_messages(conversation_key)

    def _normalize_model_choice(self, model_choice: ModelChoice) -> str:
        if not model_choice:
            return "auto"

        normalized = model_choice.strip().lower().replace("-", "_").replace(" ", "_")

        aliases = {
            "auto": "auto",
            "default": "auto",
            # Cerebras (Qwen)
            "cerebras": "cerebras",
            "qwen": "cerebras",
            "qwen_cerebras": "cerebras",
            "cerebras_qwen": "cerebras",

            # Groq (Llama)
            "groq": "groq_primary",
            "llama_groq": "groq_primary",
            "groq_llama": "groq_primary",
            "llama": "groq_primary",
            "llama_samba": "sambanova",
            "llama_sambanova": "sambanova",
            "samba": "sambanova",
            "sambanova": "sambanova",
            "gemini": "gemini",
        }

        if normalized not in aliases:
            raise ValueError(
                "Unknown model choice. Use auto, cerebras/qwen, groq/llama_groq, llama_samba, or gemini."
            )

        return aliases[normalized]

    def _get_effective_groq_model(self) -> str:
        """Return the Groq model ID to use (env override first, then default)."""

        model = (settings.groq_model or settings.groq_primary_model or "").strip()
        if not model:
            raise RuntimeError("No Groq model is configured")
        return model

    def _load_config(self) -> dict:
        """Load chatbot configuration from YAML file."""

        prompts_dir = Path(__file__).parent.parent / "prompts"
        config_path = prompts_dir / "chatbot_prompts.yaml"

        with open(config_path, "r", encoding="utf-8") as f:
            config = yaml.safe_load(f)

        return config

    async def _try_groq(
        self,
        conversation_key: str,
        user_message: str,
        temperature: float,
        max_tokens: int,
        *,
        model: str,
    ) -> Optional[str]:
        """
        Try to get response from Groq.

        Args:
            user_message: User's input text
            temperature: Response creativity
            max_tokens: Maximum response length

        Returns:
            str: Response text if successful
            None: If Groq fails for any reason
        """
        try:
            history = await self._get_history(conversation_key)
            messages = self._format_openai_messages(history, user_message)

            response = await self.groq_client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                top_p=self.model_params.get("top_p", 0.85),
                timeout=self.timeout,
            )
            return response.choices[0].message.content

        except Exception as e:
            logger.warning("Groq failed: %s", e)
            return None

    async def _try_cerebras(
        self,
        conversation_key: str,
        user_message: str,
        temperature: float,
        max_tokens: int,
    ) -> Optional[str]:
        """Try to get a response from Cerebras (primary provider)."""

        if not self.cerebras_client:
            return None

        try:
            history = await self._get_history(conversation_key)
            messages = self._format_openai_messages(history, user_message)

            response = await self.cerebras_client.chat.completions.create(
                model=settings.cerebras_model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                top_p=self.model_params.get("top_p", 0.85),
                timeout=self.timeout,
            )
            return response.choices[0].message.content

        except Exception as e:
            logger.warning("Cerebras failed: %s", e)
            return None

    async def _try_sambanova(
        self,
        conversation_key: str,
        user_message: str,
        temperature: float,
        max_tokens: int,
    ) -> Optional[str]:
        """
        Try to get response from SambaNova (secondary provider).

        Args:
            user_message: User's input text
            temperature: Response creativity
            max_tokens: Maximum response length

        Returns:
            str: Response text if successful
            None: If SambaNova fails for any reason
        """
        try:
            history = await self._get_history(conversation_key)
            messages = self._format_openai_messages(history, user_message)

            def _create_completion() -> str:
                response = self.sambanova_client.chat.completions.create(
                    model=settings.sambanova_model,
                    messages=messages,
                    temperature=temperature,
                    top_p=self.model_params.get("top_p", 0.85),
                    max_tokens=max_tokens,
                )
                return response.choices[0].message.content

            return await asyncio.to_thread(_create_completion)

        except Exception as e:
            logger.warning("SambaNova failed: %s", e)
            return None

    async def _try_gemini(
        self,
        conversation_key: str,
        user_message: str,
        temperature: float,
        max_tokens: int,
    ) -> str:
        """
        Get response from Gemini (fallback provider).
        Uses the NEW Google Gen AI SDK with async support.

        Args:
            user_message: User's input text
            temperature: Response creativity
            max_tokens: Maximum response length

        Returns:
            str: Response text

        Raises:
            Exception: If Gemini also fails
        """
        try:
            history = await self._get_history(conversation_key)
            contents = self._format_gemini_contents(history, user_message)

            generate_config = types.GenerateContentConfig(
                temperature=temperature,
                max_output_tokens=max_tokens,
                top_p=self.model_params.get("top_p", 0.85),
                system_instruction=self.system_instruction,
            )

            response = await self.gemini_client.aio.models.generate_content(
                model=settings.gemini_model,
                contents=contents,
                config=generate_config,
            )

            return response.text or ""

        except Exception as e:
            logger.error("Gemini also failed: %s", e)
            raise

    async def generate_response(self, user_message: str, model_choice: ModelChoice = "qwen") -> str:
        """
        Generate AI response with automatic fallback or a selected provider.

        When model_choice is omitted or set to auto, the fallback pattern is:
        1. Try Cerebras Qwen first
        2. If fails → Try Groq Llama
        3. If fails → Try SambaNova Llama
        4. If fails → Try Gemini
        5. If all fail → Raise exception

        When model_choice is provided, the matching provider is used directly.

        Args:
            user_message: The user's input text
            model_choice: Optional provider alias for testing (auto, qwen/cerebras,
                groq/llama_groq, Llama_samba, or gemini)

        Returns:
            str: AI-generated response text

        Raises:
            Exception: If the selected provider fails or all fallback providers fail
        """
        raw_user_message = user_message

        temp = self.model_params["temperature"]
        max_tok = self.model_params["max_tokens"]

        expected_lang = "ar" if _ARABIC_LETTER_RE.search(raw_user_message or "") else "en"

        user_message = self._augment_with_grounding(raw_user_message)

        conversation_key = settings.chat_memory_default_conversation_key

        async def _finalize(assistant_text: str) -> str:
            sanitized = self._sanitize_response_text(assistant_text, expected_lang=expected_lang)
            if settings.chat_memory_enabled:
                await history_store.append_turn(conversation_key, raw_user_message, sanitized)
            return sanitized

        selected_model = self._normalize_model_choice(model_choice)

        if selected_model == "cerebras":
            logger.info("Using Cerebras explicitly: %s", settings.cerebras_model)
            cerebras_response = await self._try_cerebras(conversation_key, user_message, temp, max_tok)
            if cerebras_response:
                return await _finalize(cerebras_response)
            raise RuntimeError("Cerebras failed to generate a response")

        if selected_model == "groq_primary":
            chosen = self._get_effective_groq_model()
            logger.info("Using Groq explicitly: %s", chosen)

            groq_response = await self._try_groq(
                conversation_key,
                user_message,
                temp,
                max_tok,
                model=chosen,
            )
            if groq_response:
                return await _finalize(groq_response)
            raise RuntimeError("Groq failed to generate a response")

        if selected_model == "sambanova":
            logger.info("Using SambaNova explicitly...")
            samba_response = await self._try_sambanova(conversation_key, user_message, temp, max_tok)
            if samba_response:
                return await _finalize(samba_response)
            raise RuntimeError("SambaNova failed to generate a response")

        if selected_model == "gemini":
            logger.info("Using Gemini explicitly...")
            gemini_text = await self._try_gemini(conversation_key, user_message, temp, max_tok)
            return await _finalize(gemini_text)

        # Try Cerebras first (Qwen)
        if self.cerebras_client:
            logger.info("Trying Cerebras (Primary): %s", settings.cerebras_model)
            cerebras_response = await self._try_cerebras(conversation_key, user_message, temp, max_tok)
            if cerebras_response:
                logger.info("Cerebras succeeded")
                return await _finalize(cerebras_response)

        # Then try Groq
        groq_model = self._get_effective_groq_model()
        logger.info("Trying Groq: %s", groq_model)

        groq_response = await self._try_groq(
            conversation_key,
            user_message,
            temp,
            max_tok,
            model=groq_model,
        )

        if groq_response:
            logger.info("Groq succeeded")
            return await _finalize(groq_response)

        # Fallback to SambaNova (secondary provider)
        logger.info("Falling back to SambaNova...")
        sambanova_response = await self._try_sambanova(conversation_key, user_message, temp, max_tok)

        if sambanova_response:
            logger.info("SambaNova succeeded")
            return await _finalize(sambanova_response)

        # Fallback to Gemini (tertiary provider)
        logger.info("Falling back to Gemini...")
        gemini_response = await self._try_gemini(conversation_key, user_message, temp, max_tok)
        logger.info("Gemini succeeded")

        return await _finalize(gemini_response)


llm_service = LLMService()

if __name__ == "__main__":

    async def test():
        user_msg = "هل لو العربية فابريكا دي حاجة حلوة ولا وحشة ويعني ايه رش حزام برضه ممكن تفهمني بعض المصطلحات المصرية عن العربيات دي عشان اعرف اتعامل مع السوق هنا؟"
        response = await llm_service.generate_response(user_msg)
        print(f"Assistant: {response}")

    asyncio.run(test())
