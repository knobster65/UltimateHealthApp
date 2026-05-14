from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    APP_NAME: str = "UltimateHealthApp"
    SECRET_KEY: str = "change-me-to-a-random-secret-key"
    TOKEN_EXPIRE_HOURS: int = 720  # 30 days

    DATABASE_URL: str = "sqlite:///./health.db"

    UPLOAD_DIR: str = "../uploads"
    MAX_UPLOAD_SIZE_MB: int = 20

    NIGHTSCOUT_URL: Optional[str] = None
    NIGHTSCOUT_API_TOKEN: Optional[str] = ""
    ALLOWED_ORIGINS: str = ""  # e.g. "https://karcass.com" (blank = allow all)

    # AbacusAI for PDF parsing
    # AI Provider configuration (abacusai, openai, anthropic)
    AI_PROVIDER: str = "abacusai"  # which provider to use
    AI_API_KEY: Optional[str] = None  # API key for the selected provider
    AI_MODEL: str = "gpt-4.1"  # model name (provider-specific)
    AI_BASE_URL: Optional[str] = None  # optional custom base URL (for providers like AbacusAI that use different endpoints)

    model_config = {"env_file": ".env", "case_sensitive": False, "extra": "ignore"}


settings = Settings()
