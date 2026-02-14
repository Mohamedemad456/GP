import logging
from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path

logger = logging.getLogger(__name__)

# Points to ai-service/ root (works both locally and inside Docker)
SERVICE_DIR = Path(__file__).resolve().parent.parent.parent

REPO_ENV = SERVICE_DIR.parent / ".env"


class Settings(BaseSettings):
    # ── Groq (primary provider) ─────────────────────────────────
    groq_api_key: str
    groq_base_url: str
    groq_model: str = "llama-3.3-70b-versatile"

    # ── Gemini (fallback provider) ──────────────────────────────
    gemini_api_key: str
    gemini_model: str = "gemini-3-flash-preview"

    # ── CORS (comma-separated origins, default allows all) ─────
    cors_origins: str = "*"

    model_config = SettingsConfigDict(
        env_file=str(REPO_ENV),
        env_file_encoding="utf-8",
        case_sensitive=False,
        # Don't crash when .env is missing (Docker injects env vars directly)
        extra="ignore",
    )


settings = Settings()


if __name__ == "__main__":
    print("✅ Configuration loaded successfully!")
    print(f"Groq API Key: ****{settings.groq_api_key[-4:]}")
    print(f"Groq Base URL: {settings.groq_base_url}")
    print(f"Groq Model: {settings.groq_model}")
    print(f"Gemini API Key: ****{settings.gemini_api_key[-4:]}")
    print(f"Gemini Model: {settings.gemini_model}")
    print(f"CORS Origins: {settings.cors_origins}")
    