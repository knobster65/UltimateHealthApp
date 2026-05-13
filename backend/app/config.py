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

    model_config = {"env_file": ".env", "case_sensitive": False}


settings = Settings()
