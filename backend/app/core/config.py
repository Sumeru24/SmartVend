from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration loaded from environment variables / .env."""

    PROJECT_NAME: str = "SmartVend"
    API_V1_PREFIX: str = "/api/v1"
    SECRET_KEY: str = "change-me-use-a-long-random-secret-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 12
    DATABASE_URL: str = "sqlite:///./smartvend.db"
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"
    ENVIRONMENT: str = "development"
    DISPENSER_MODE: str = "simulation"
    SEED_DEMO_DATA: bool = True

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
