import yaml
import asyncio
import logging
from pathlib import Path
from google import genai
from google.genai import types
from typing import Optional
from openai import AsyncOpenAI  # type: ignore

from app.core.config import settings

logger = logging.getLogger(__name__)


class LLMService:
    """
    Service for generating AI responses with automatic provider fallback.
    Uses OpenAI SDK for the main model and google sdk for the fallback.

    Providers:
    - Primary: OpenAI (Groq — Llama 3 70b)
    - Secondary: Google (Gemini-3-preview)

    Flow:
    User message → Try Groq → If fails → Try Gemini → Return response

    Loads system prompts and parameters from YAML configuration.
    """
    
    def __init__(self):
        """Initialize the LLM service with API client and load prompts."""

        self.groq_client = AsyncOpenAI(
            base_url=settings.groq_base_url,
            api_key=settings.groq_api_key,
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

    def _load_config(self) -> dict:
        """Load chatbot configuration from YAML file."""

        prompts_dir = Path(__file__).parent.parent / "prompts"
        config_path = prompts_dir / "chatbot_prompts.yaml"

        with open(config_path, "r", encoding="utf-8") as f:
            config = yaml.safe_load(f)

        return config

    async def _try_groq(
        self,
        user_message: str,
        temperature: float,
        max_tokens: int,
    ) -> Optional[str]:
        """
        Try to get response from Groq (primary provider).

        Args:
            user_message: User's input text
            temperature: Response creativity
            max_tokens: Maximum response length

        Returns:
            str: Response text if successful
            None: If Groq fails for any reason
        """
        try:
            messages = [
                    {"role": "system", "content": self.system_prompt},
                ]
            messages.extend(self.few_shot_examples)
            messages.append({"role": "user", "content": user_message})

            response = await self.groq_client.chat.completions.create(
                model=settings.groq_model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                timeout=self.timeout,
            )
            return response.choices[0].message.content

        except Exception as e:
            logger.warning("Groq failed: %s", e)
            return None

    async def _try_gemini(
        self,
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
            user_content = types.Content(
                role="user",
                parts=[types.Part.from_text(text=user_message)],
            )

            generate_config = types.GenerateContentConfig(
                temperature=temperature,
                max_output_tokens=max_tokens,
                system_instruction=self.system_prompt,
            )

            response = await self.gemini_client.aio.models.generate_content(
                model=settings.gemini_model,
                contents=user_content,
                config=generate_config,
            )

            return response.text

        except Exception as e:
            logger.error("Gemini also failed: %s", e)
            raise

    async def generate_response(self, user_message: str) -> str:
        """
        Generate AI response with automatic fallback.

        Implements the fallback pattern:
        1. Try Groq first
        2. If fails → Try Gemini
        3. If both fail → Raise exception

        Args:
            user_message: The user's input text

        Returns:
            str: AI-generated response text

        Raises:
            Exception: If both providers fail
        """
        temp = self.model_params["temperature"]
        max_tok = self.model_params["max_tokens"]

        # Try Groq first
        logger.info("Trying Llama via Groq (Primary)...")
        groq_response = await self._try_groq(user_message, temp, max_tok)

        if groq_response:
            logger.info("Groq succeeded")
            return groq_response

        # Fallback to Gemini (secondary provider)
        logger.info("Falling back to Gemini...")
        gemini_response = await self._try_gemini(user_message, temp, max_tok)
        logger.info("Gemini succeeded")

        return gemini_response


llm_service = LLMService()

if __name__ == "__main__":

    async def test():
        user_msg = "هل لو العربية فابريكا دي حاجة حلوة ولا وحشة ويعني ايه رش حزام برضه ممكن تفهمني بعض المصطلحات المصرية عن العربيات دي عشان اعرف اتعامل مع السوق هنا؟"
        response = await llm_service.generate_response(user_msg)
        print(f"Assistant: {response}")

    asyncio.run(test())
