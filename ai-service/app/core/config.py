from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent

class Settings(BaseSettings):
    cerebras_api_key: str    
    cerebras_base_url: str = "https://api.cerebras.ai/v1"
    cerebras_model: str = "qwen-3-235b-a22b-instruct-2507"
    
    model_config = SettingsConfigDict(
        env_file=ROOT_DIR / ".env",
        case_sensitive=False
    )
        
settings = Settings()

# Test
if __name__ == "__main__":
    print("Cerebras API Key Loaded:", "****" + settings.cerebras_api_key[-4:])
    print("Cerebras API Base URL:", settings.cerebras_base_url)
    print("Cerebras Model:", settings.cerebras_model)