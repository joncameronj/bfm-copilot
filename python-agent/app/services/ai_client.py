"""Anthropic AI Client Provider - Singleton clients for the Anthropic SDK."""

import anthropic

from app.config import get_settings

# Singleton clients
_sync_client: anthropic.Anthropic | None = None
_async_client: anthropic.AsyncAnthropic | None = None


def get_sync_client() -> anthropic.Anthropic:
    """Get a synchronous Anthropic client (singleton)."""
    global _sync_client
    if _sync_client is None:
        settings = get_settings()
        if not settings.anthropic_api_key:
            raise ValueError("ANTHROPIC_API_KEY is required")
        _sync_client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    return _sync_client


def get_async_client() -> anthropic.AsyncAnthropic:
    """Get an async Anthropic client (singleton)."""
    global _async_client
    if _async_client is None:
        settings = get_settings()
        if not settings.anthropic_api_key:
            raise ValueError("ANTHROPIC_API_KEY is required")
        _async_client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _async_client


def get_chat_model() -> str:
    return get_settings().anthropic_chat_model


def get_fast_model() -> str:
    return get_settings().anthropic_fast_model


def get_opus_model() -> str:
    return get_settings().anthropic_opus_model


def get_vision_model() -> str:
    return get_settings().anthropic_vision_model


def reset_clients() -> None:
    """Reset cached clients. Useful for testing or reconfiguration."""
    global _sync_client, _async_client
    _sync_client = None
    _async_client = None
