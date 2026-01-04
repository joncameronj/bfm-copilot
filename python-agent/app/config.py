from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # OpenAI
    openai_api_key: str
    openai_model: str = "gpt-5.2"

    # Supabase
    supabase_url: str
    supabase_service_key: str
    supabase_jwt_secret: str

    # App settings
    debug: bool = False
    cors_origins: list[str] = ["http://localhost:3000"]

    # Frontend URL for fetching dynamic settings
    frontend_url: str = "http://localhost:3000"

    # Reasoning settings (defaults, can be overridden by admin panel)
    reasoning_effort: str = "high"  # low, medium, high
    reasoning_summary: str = "detailed"  # auto, concise, detailed

    # Settings cache TTL in seconds
    settings_cache_ttl: int = 60

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
