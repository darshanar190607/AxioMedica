"""
Application configuration module using Pydantic Settings v2.
Loads settings from environment variables and optional .env file.
"""
from typing import List, Union
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # Project metadata
    PROJECT_NAME: str = "AxioMedica Backend API"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"  # development, staging, production, test
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    # Database
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/axiomedica_db",
        description="SQLAlchemy PostgreSQL async database connection string",
    )
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_RECYCLE: int = 1800

    # Security & JWT Auth
    JWT_SECRET: str = Field(
        default="CHANGE_ME_SUPER_SECRET_JWT_KEY_MIN_32_CHARS_LONG_12345",
        description="Secret key used for signing JWT access and refresh tokens",
    )
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TTL_MIN: int = Field(
        default=15,
        description="Access token time-to-live in minutes",
    )
    REFRESH_TTL_DAYS: int = Field(
        default=7,
        description="Refresh token time-to-live in days",
    )

    # CORS Settings (Expo Dev, Web, Localhost)
    CORS_ORIGINS: Union[List[str], str] = Field(
        default=[
            "http://localhost:8081",   # Expo Dev Server default
            "http://localhost:19006",  # Expo Web default
            "http://localhost:3000",   # Local frontend/web
            "http://localhost:8000",   # Swagger UI / Docs
            "http://127.0.0.1:8081",
            "http://127.0.0.1:19006",
            "http://127.0.0.1:3000",
        ],
        description="Allowed CORS origins list or comma-separated string",
    )

    # Regex pattern to match Expo Go LAN IP addresses & tunneling in development
    CORS_ORIGIN_REGEX: str = (
        r"^(http://localhost:\d+|http://127\.0\.0\.1:\d+|"
        r"http://10\.\d+\.\d+\.\d+:\d+|http://192\.168\.\d+\.\d+:\d+|"
        r"http://172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+:\d+|"
        r"exp://.*)$"
    )

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            if not v.strip():
                return []
            if v.startswith("[") and v.endswith("]"):
                import json
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [item.strip() for item in v.split(",") if item.strip()]
        elif isinstance(v, list):
            return v
        return []

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"

    @property
    def is_testing(self) -> bool:
        return self.ENVIRONMENT.lower() == "test"


settings = Settings()
