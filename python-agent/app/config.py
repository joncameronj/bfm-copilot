from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Anthropic (primary AI provider)
    anthropic_api_key: str | None = None
    anthropic_chat_model: str = "claude-opus-4-6"
    anthropic_fast_model: str = "claude-haiku-4-5-20251001"
    anthropic_vision_model: str = "claude-opus-4-6"

    # OpenAI embeddings (xAI removed standalone embedding models)
    openai_api_key: str | None = None
    openai_embedding_model: str = "text-embedding-3-small"
    openai_embedding_dimensions: int = 1536

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

    # Chat history forwarding limits (effective context control)
    chat_history_message_limit: int = 400
    chat_history_char_budget: int = 1800000

    # RAG logging settings
    rag_log_level: str = "INFO"  # DEBUG, INFO, WARNING, ERROR

@lru_cache
def get_settings() -> Settings:
    return Settings()
