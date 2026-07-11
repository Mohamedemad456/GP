import logging
from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path

logger = logging.getLogger(__name__)

# Points to ai-service/ root (works both locally and inside Docker)
SERVICE_DIR = Path(__file__).resolve().parent.parent.parent

REPO_ENV = SERVICE_DIR.parent / ".env"


class Settings(BaseSettings):
    # # ── Cerebras (primary provider) ─────────────────────────────
    # # Optional: if missing, service will skip Cerebras and fall back.
    # # DISABLED: API key expired / model not available.
    # cerebras_api_key: str | None = None
    # cerebras_base_url: str = "https://api.cerebras.ai/v1"
    # cerebras_model: str = "qwen-3-235b-a22b-instruct-2507"

    deepinfra_api_key: str | None = None
    deepinfra_base_url: str = "https://api.deepinfra.com/v1/openai"
    deepinfra_model: str = "Qwen/Qwen3-235B-A22B-Instruct-2507"

    # ── DeepInfra paid models (higher priority) ─────────────────
    deepinfra_sonnet_model: str = "anthropic/claude-sonnet-4-6"
    deepinfra_opus_model: str = "anthropic/claude-opus-4-7"
    deepinfra_gemini_pro_model: str = "google/gemini-3.1-pro"

    # # ── Groq (fallback provider) ────────────────────────────────
    # # DISABLED: API key expired.
    # groq_api_key: str
    # groq_base_url: str
    # groq_model: str = "llama-3.3-70b-versatile"

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

    # ── Local lookup data (for grounding) ───────────────────────
    # These are optional and safe defaults; can be overridden via env.
    data_dir: Path = SERVICE_DIR / "data"
    ai_lookup_csv_path: Path = SERVICE_DIR / "data" / "lookups" / "AI_lookup.csv"
    car_aliases_yaml_path: Path = SERVICE_DIR / "data" / "lookups" / "car_aliases.yaml"
    egypt_market_notes_yaml_path: Path = SERVICE_DIR / "data" / "egypt_market_notes.yaml"

    # Optional env overrides (string paths) if you want to swap datasets without rebuild.
    # If set, these override the Path defaults above.
    ai_lookup_csv: str | None = None
    car_aliases_yaml: str | None = None
    egypt_market_notes_yaml: str | None = None

    # ── Chat memory (in-process only; no DB) ──────────────────
    chat_memory_enabled: bool = True
    chat_memory_ttl_seconds: int = 2 * 60 * 60
    chat_memory_max_turns: int = 20
    chat_memory_default_conversation_key: str = "default"

    model_config = SettingsConfigDict(
        env_file=str(REPO_ENV),
        env_file_encoding="utf-8",
        case_sensitive=False,
        # Don't crash when .env is missing (Docker injects env vars directly)
        extra="ignore",
    )


settings = Settings()

# Apply optional path overrides after settings initialization.
if settings.ai_lookup_csv:
    settings.ai_lookup_csv_path = Path(settings.ai_lookup_csv)
if settings.car_aliases_yaml:
    settings.car_aliases_yaml_path = Path(settings.car_aliases_yaml)
if settings.egypt_market_notes_yaml:
    settings.egypt_market_notes_yaml_path = Path(settings.egypt_market_notes_yaml)


if __name__ == "__main__":
    print("✅ Configuration loaded successfully!")
    # print(f"Cerebras Enabled: {bool(settings.cerebras_api_key)}")
    # print(f"Cerebras Base URL: {settings.cerebras_base_url}")
    # print(f"Cerebras Model: {settings.cerebras_model}")
    print(f"DeepInfra Enabled: {bool(settings.deepinfra_api_key)}")
    print(f"DeepInfra Base URL: {settings.deepinfra_base_url}")
    print(f"DeepInfra Model: {settings.deepinfra_model}")
    print(f"DeepInfra Sonnet Model: {settings.deepinfra_sonnet_model}")
    print(f"DeepInfra Opus Model: {settings.deepinfra_opus_model}")
    print(f"DeepInfra Gemini Pro Model: {settings.deepinfra_gemini_pro_model}")
    # print(f"Groq API Key: ****{settings.groq_api_key[-4:]}")
    # print(f"Groq Base URL: {settings.groq_base_url}")
    # effective_groq_primary = settings.groq_model
    # print(f"Groq Primary Model: {effective_groq_primary}")
    print(f"SambaNova API Key: ****{settings.sambanova_api_key[-4:]}")
    print(f"SambaNova Base URL: {settings.sambanova_base_url}")
    print(f"SambaNova Model: {settings.sambanova_model}")
    print(f"Gemini API Key: ****{settings.gemini_api_key[-4:]}")
    print(f"Gemini Model: {settings.gemini_model}")
    print(f"Log Level: {settings.log_level}")
    print(f"Log File: {settings.log_file_path}")
    print(f"CORS Origins: {settings.cors_origins}")
    