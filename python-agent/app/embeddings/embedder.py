import hashlib

from app.services.embeddings_client import create_embedding, create_embedding_batch_sync

# Batch size for embedding operations
BATCH_SIZE = 100

# Embedding cache (in-memory, keyed by MD5 hash of query text)
_embedding_cache: dict[str, list[float]] = {}


async def get_embedding(text: str) -> list[float]:
    """
    Generate embedding for a single text using async client with caching.

    Uses MD5 hash of the text as cache key to avoid recomputing embeddings
    for repeated queries. This saves 1-2s on repeated queries.

    Args:
        text: The text to embed

    Returns:
        List of floats representing the embedding vector
    """
    # Check cache first
    cache_key = hashlib.md5(text.encode()).hexdigest()
    if cache_key in _embedding_cache:
        return _embedding_cache[cache_key]

    embedding = await create_embedding(text=text)

    # Cache the result
    _embedding_cache[cache_key] = embedding

    return embedding


async def get_embeddings_batch(texts: list[str]) -> list[list[float]]:
    """
    Generate embeddings for multiple texts in batches.

    Uses synchronous client for batch operations (typically used in
    ingestion scripts where async isn't critical).

    Args:
        texts: List of texts to embed

    Returns:
        List of embedding vectors in the same order as input
    """
    return create_embedding_batch_sync(
        texts=texts,
        batch_size=BATCH_SIZE,
    )


async def embed_query(query: str) -> list[float]:
    """
    Embed a search query.

    This is an alias for get_embedding but named semantically for search use cases.
    """
    return await get_embedding(query)


def clear_embedding_cache() -> None:
    """Clear the embedding cache. Useful for testing or memory management."""
    global _embedding_cache
    _embedding_cache = {}
