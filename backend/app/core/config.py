from pathlib import Path
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve path tới file .env ở root project
# config.py
#   -> core
#   -> app
#   -> backend
#   -> root project
DOTENV_PATH = (
    Path(__file__).resolve().parent.parent.parent.parent / ".env"
)

class Settings(BaseSettings):
    # =========================================================
    # App
    # =========================================================
    APP_NAME: str = "Mezon Knowledge Hub API"
    API_V1_STR: str = "/api/v1"
    DEBUG: bool = False

    # =========================================================
    # JWT
    # =========================================================
    SECRET_KEY: str = "change-this-in-production-please"
    ALGORITHM: str = "HS256"

    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # =========================================================
    # Database
    # =========================================================
    DB_HOST: str = "127.0.0.1"
    DB_PORT: int = 3306
    DB_USER: str = "root"

    # Required field - lay tu .env
    DB_PASSWORD: str

    DB_NAME: str = "mezon_knowledge_hub"

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"mysql+pymysql://"
            f"{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}"
            f"/{self.DB_NAME}"
        )

    # =========================================================
    # External APIs
    # =========================================================
    GEMINI_API_KEY: str

    MEZON_BOT_TOKEN: str = ""
    MEZON_BOT_ID: str = ""

    TAVILY_API_KEY: str = ""
    DEEPSEEK_API_KEY: str = ""

    # =========================================================
    # Transcript API
    # =========================================================
    TRANSCRIPT_API_KEY: str = ""
    TRANSCRIPT_API_BASE: str = "https://transcriptapi.com/api/v1"

    # =========================================================
    # Supadata API (YouTube transcript REST API)
    # =========================================================
    SUPADATA_API_KEY: str = ""
    SUPADATA_API_BASE: str = "https://api.supadata.ai/v1"

    # =========================================================
    # Mezon OAuth2
    # =========================================================
    MEZON_CLIENT_ID: str = ""
    MEZON_CLIENT_SECRET: str = ""

    MEZON_REDIRECT_URI: str = (
        "http://localhost:8000/api/v1/auth/mezon/callback"
    )

    # =========================================================
    # Frontend
    # =========================================================
    FRONTEND_URL: str = "http://localhost:3000"

    # =========================================================
    # CORS
    # =========================================================
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ]

    # =========================================================
    # Pydantic v2
    # =========================================================
    model_config = SettingsConfigDict(
        env_file=DOTENV_PATH,
        extra="ignore",
        case_sensitive=True,
    )

settings = Settings()
