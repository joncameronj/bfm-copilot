"""
Anthropic Claude Client - Thin alias to ai_client for backward compatibility.

The eval report system and other callers import from here.
All clients now go through ai_client.py.
"""

from app.services.ai_client import get_async_client, reset_clients

EVAL_MODEL = "claude-opus-4-6"
EVAL_MAX_TOKENS = 8192


def get_claude_client():
    """Get the async Anthropic client (singleton). Alias for ai_client.get_async_client()."""
    return get_async_client()


def reset_client() -> None:
    """Reset cached client. Alias for ai_client.reset_clients()."""
    reset_clients()
