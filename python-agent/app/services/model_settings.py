"""
Model Settings Service

Fetches model configuration from the Next.js API with caching.
Falls back to environment variables if the API is unavailable.
"""

import time
import httpx
from dataclasses import dataclass
from typing import Optional
from app.services.ai_client import get_chat_model, get_fast_model
from app.utils.logger import get_logger

logger = get_logger("model_settings")


@dataclass
class ModelSettings:
    """Model configuration settings."""
    chat_model: str
    fast_model: str
    reasoning_effort: str
    reasoning_summary: str
    temperature: float = 0.8
    prompt_routing_enabled: bool = True


class ModelSettingsService:
    """Service for fetching and caching model settings."""

    def __init__(
        self,
        api_url: str,
        cache_ttl_seconds: int = 60,
        default_model: str | None = None,
        default_fast_model: str | None = None,
        default_reasoning_effort: str = "high",
        default_reasoning_summary: str = "detailed",
        default_temperature: float = 0.8,
    ):
        self.api_url = api_url
        self.cache_ttl_seconds = cache_ttl_seconds
        self.default_model = default_model or get_chat_model()
        self.default_fast_model = default_fast_model or get_fast_model()
        self.default_reasoning_effort = default_reasoning_effort
        self.default_reasoning_summary = default_reasoning_summary
        self.default_temperature = default_temperature

        self._cached_settings: Optional[ModelSettings] = None
        self._cache_timestamp: float = 0

    def _normalize_chat_model(self, chat_model: str) -> str:
        """
        Ensure model name matches Anthropic provider to avoid silent mismatches.
        """
        if chat_model.startswith(("gpt-", "o1", "o3", "grok-")):
            fallback = get_chat_model()
            logger.warning(f"Model '{chat_model}' does not match Anthropic provider. Using '{fallback}' instead.")
            return fallback

        return chat_model

    def _is_cache_valid(self) -> bool:
        """Check if the cached settings are still valid."""
        if self._cached_settings is None:
            return False
        return (time.time() - self._cache_timestamp) < self.cache_ttl_seconds

    def _get_defaults(self) -> ModelSettings:
        """Return default settings from environment variables."""
        return ModelSettings(
            chat_model=self.default_model,
            fast_model=self.default_fast_model,
            reasoning_effort=self.default_reasoning_effort,
            reasoning_summary=self.default_reasoning_summary,
            temperature=self.default_temperature,
        )

    async def get_settings(self) -> ModelSettings:
        """
        Get current model settings.

        First checks the cache, then fetches from API if cache is stale.
        Falls back to defaults if API is unavailable.
        """
        # Return cached settings if still valid
        if self._is_cache_valid():
            return self._cached_settings  # type: ignore

        # Try to fetch from API
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.api_url}/api/settings/models")

                if response.status_code == 200:
                    data = response.json().get("data", {})
                    self._cached_settings = ModelSettings(
                        chat_model=self._normalize_chat_model(data.get("chat_model", self.default_model)),
                        fast_model=data.get("fast_model", self.default_fast_model),
                        reasoning_effort=data.get("reasoning_effort", self.default_reasoning_effort),
                        reasoning_summary=data.get("reasoning_summary", self.default_reasoning_summary),
                        temperature=float(data.get("temperature", self.default_temperature)),
                        prompt_routing_enabled=data.get("prompt_routing_enabled", True),
                    )
                    self._cache_timestamp = time.time()
                    return self._cached_settings
                else:
                    # API returned error, use defaults
                    return self._get_defaults()

        except Exception as e:
            # API unavailable, use defaults
            logger.warning(f"Failed to fetch model settings from API: {e}")
            return self._get_defaults()

    def get_settings_sync(self) -> ModelSettings:
        """
        Synchronous version of get_settings.

        Useful for contexts where async is not available.
        """
        # Return cached settings if still valid
        if self._is_cache_valid():
            return self._cached_settings  # type: ignore

        # Try to fetch from API
        try:
            with httpx.Client(timeout=5.0) as client:
                response = client.get(f"{self.api_url}/api/settings/models")

                if response.status_code == 200:
                    data = response.json().get("data", {})
                    self._cached_settings = ModelSettings(
                        chat_model=self._normalize_chat_model(data.get("chat_model", self.default_model)),
                        fast_model=data.get("fast_model", self.default_fast_model),
                        reasoning_effort=data.get("reasoning_effort", self.default_reasoning_effort),
                        reasoning_summary=data.get("reasoning_summary", self.default_reasoning_summary),
                        temperature=float(data.get("temperature", self.default_temperature)),
                        prompt_routing_enabled=data.get("prompt_routing_enabled", True),
                    )
                    self._cache_timestamp = time.time()
                    return self._cached_settings
                else:
                    return self._get_defaults()

        except Exception as e:
            logger.warning(f"Failed to fetch model settings from API: {e}")
            return self._get_defaults()

    def invalidate_cache(self) -> None:
        """Force the next request to fetch fresh settings."""
        self._cached_settings = None
        self._cache_timestamp = 0


# Singleton instance (will be initialized in main.py)
_model_settings_service: Optional[ModelSettingsService] = None


def get_model_settings_service() -> ModelSettingsService:
    """Get the model settings service singleton."""
    global _model_settings_service
    if _model_settings_service is None:
        raise RuntimeError("ModelSettingsService not initialized. Call init_model_settings_service first.")
    return _model_settings_service


def init_model_settings_service(
    api_url: str,
    default_model: str | None = None,
    default_reasoning_effort: str = "high",
    default_reasoning_summary: str = "detailed",
    default_temperature: float = 0.8,
    cache_ttl_seconds: int = 60,
) -> ModelSettingsService:
    """Initialize the model settings service singleton."""
    global _model_settings_service
    _model_settings_service = ModelSettingsService(
        api_url=api_url,
        cache_ttl_seconds=cache_ttl_seconds,
        default_model=default_model,
        default_reasoning_effort=default_reasoning_effort,
        default_reasoning_summary=default_reasoning_summary,
        default_temperature=default_temperature,
    )
    return _model_settings_service
