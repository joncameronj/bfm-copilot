from openai import OpenAI

from app.config import get_settings

# Embedding model configuration
EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMENSIONS = 1536
BATCH_SIZE = 100  # OpenAI recommends batches of up to 2048, we use 100 for safety


def get_openai_client() -> OpenAI:
    """Get OpenAI client instance."""
    settings = get_settings()
    return OpenAI(api_key=settings.openai_api_key)


async def get_embedding(text: str) -> list[float]:
    """
    Generate embedding for a single text.

    Args:
        text: The text to embed

    Returns:
        List of floats representing the embedding vector
    """
    client = get_openai_client()

    response = client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=text,
        dimensions=EMBEDDING_DIMENSIONS,
    )

    return response.data[0].embedding


async def get_embeddings_batch(texts: list[str]) -> list[list[float]]:
    """
    Generate embeddings for multiple texts in batches.

    Args:
        texts: List of texts to embed

    Returns:
        List of embedding vectors in the same order as input
    """
    client = get_openai_client()
    all_embeddings = []

    # Process in batches
    for i in range(0, len(texts), BATCH_SIZE):
        batch = texts[i : i + BATCH_SIZE]

        response = client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=batch,
            dimensions=EMBEDDING_DIMENSIONS,
        )

        # Extract embeddings in order
        batch_embeddings = [item.embedding for item in response.data]
        all_embeddings.extend(batch_embeddings)

    return all_embeddings


async def embed_query(query: str) -> list[float]:
    """
    Embed a search query.

    This is an alias for get_embedding but named semantically for search use cases.
    """
    return await get_embedding(query)
