from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

# 1. Resolve the path to the root .env file relative to this file:
# config.py -> core -> app -> backend -> root folder (mezon-campus-studio-06-2026-team)
DOTENV_PATH = Path(__file__).resolve().parent.parent.parent.parent / ".env"


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Mezon Knowledge Hub API"
    API_V1_STR: str = "/api/v1"
    DEBUG: bool = False

    # JWT
    SECRET_KEY: str = "change-this-in-production-please"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Google OAuth2
    GOOGLE_CLIENT_ID: str = ""

    # Database
    DB_HOST: str = "127.0.0.1"
    DB_PORT: int = 3306
    DB_USER: str = "root"
    
    # Required fields (Pydantic loads these from DOTENV_PATH)
    DB_PASSWORD: str
    DB_NAME: str = "mezon_knowledge_hub"

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )

    # External APIs
    GEMINI_API_KEY: str
    # MEZON_BOT_TOKEN: str = ""
    # MEZON_BOT_ID: str = ""
    TAVILY_API_KEY: str = ""
    GOOGLE_CLIENT_ID: str = "100832011919-f8ite98k0fnr1k3l1b7umdaqasgt6q1g.apps.googleusercontent.com"
    GOOGLE_CLIENT_SECRET: str = "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"

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:3000"]

    # Cấu hình Pydantic v2
    model_config = SettingsConfigDict(
        env_file=DOTENV_PATH,  # <--- Points directly to the root .env file
        extra="ignore",
        case_sensitive=True
    )


settings = Settings()