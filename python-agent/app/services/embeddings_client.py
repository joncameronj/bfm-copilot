"""Embeddings Client - httpx wrapper for OpenAI REST /v1/embeddings endpoint.

xAI removed standalone embedding models, so we use OpenAI's
text-embedding-3-small via the same OpenAI-compatible REST format.
"""

import httpx

from app.config import get_settings

OPENAI_BASE_URL = "https://api.openai.com/v1"


def _get_embedding_config() -> tuple[str, str, int]:
    """Return (api_key, model, dimensions) for embedding calls."""
    settings = get_settings()
    api_key = settings.openai_api_key
    if not api_key:
        raise ValueError(
            "OPENAI_API_KEY is required for embeddings. "
            "Set it in .env or as an environment variable."
        )
    return api_key, settings.openai_embedding_model, settings.openai_embedding_dimensions


async def create_embedding(
    text: str,
    model: str | None = None,
    dimensions: int | None = None,
) -> list[float]:
    """Create a single embedding via the OpenAI REST API (async)."""
    api_key, default_model, default_dims = _get_embedding_config()
    model = model or default_model
    dimensions = dimensions or default_dims

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{OPENAI_BASE_URL}/embeddings",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "input": text,
                "dimensions": dimensions,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return data["data"][0]["embedding"]


def create_embedding_batch_sync(
    texts: list[str],
    model: str | None = None,
    dimensions: int | None = None,
    batch_size: int = 100,
) -> list[list[float]]:
    """Create embeddings for multiple texts via the OpenAI REST API (sync, batched)."""
    api_key, default_model, default_dims = _get_embedding_config()
    model = model or default_model
    dimensions = dimensions or default_dims
    all_embeddings: list[list[float]] = []

    with httpx.Client(timeout=60.0) as client:
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            resp = client.post(
                f"{OPENAI_BASE_URL}/embeddings",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "input": batch,
                    "dimensions": dimensions,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            batch_embeddings = [item["embedding"] for item in data["data"]]
            all_embeddings.extend(batch_embeddings)

    return all_embeddings
