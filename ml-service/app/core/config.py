"""
Configuration settings loaded from environment variables.

Settings:
    MODEL_DIR: Path to models directory (default: "models")
    DATA_DIR: Path to data directory (default: "data")
    LOG_LEVEL: Logging level (default: "info")
    SUPABASE_URL: Supabase project URL (training only)
    SUPABASE_KEY: Supabase anon/service key (training only)
"""

# TODO: Implement Settings class using pydantic-settings
# Load from .env file with python-dotenv
