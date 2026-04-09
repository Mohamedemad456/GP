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

    # ── SambaNova (secondary provider) ──────────────────────────
    sambanova_api_key: str
    sambanova_base_url: str = "https://api.sambanova.ai/v1"
    sambanova_model: str = "Meta-Llama-3.3-70B-Instruct"

    # ── Gemini (fallback provider) ──────────────────────────────
    gemini_api_key: str
    gemini_model: str = "gemini-3-flash-preview"

    # ── Logging ──────────────────────────────────────────────────
    log_level: str = "INFO"
    log_file_path: Path = SERVICE_DIR / "logs" / "ai-service.log"
    log_max_bytes: int = 10 * 1024 * 1024
    log_backup_count: int = 5

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
    print(f"SambaNova API Key: ****{settings.sambanova_api_key[-4:]}")
    print(f"SambaNova Base URL: {settings.sambanova_base_url}")
    print(f"SambaNova Model: {settings.sambanova_model}")
    print(f"Gemini API Key: ****{settings.gemini_api_key[-4:]}")
    print(f"Gemini Model: {settings.gemini_model}")
    print(f"Log Level: {settings.log_level}")
    print(f"Log File: {settings.log_file_path}")
    print(f"CORS Origins: {settings.cors_origins}")
    