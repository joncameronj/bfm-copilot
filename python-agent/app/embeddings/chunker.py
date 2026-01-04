import tiktoken
from dataclasses import dataclass


@dataclass
class TextChunk:
    index: int
    content: str
    token_count: int
    metadata: dict


def chunk_document(
    text: str,
    chunk_size: int = 500,
    overlap: int = 50,
    model: str = "text-embedding-3-small",
) -> list[TextChunk]:
    """
    Split text into overlapping chunks based on token count.

    Args:
        text: The text to chunk
        chunk_size: Target number of tokens per chunk
        overlap: Number of tokens to overlap between chunks
        model: Model name for tokenizer selection

    Returns:
        List of TextChunk objects
    """
    # Get the appropriate tokenizer
    try:
        encoding = tiktoken.encoding_for_model(model)
    except KeyError:
        encoding = tiktoken.get_encoding("cl100k_base")

    # Tokenize the entire text
    tokens = encoding.encode(text)
    total_tokens = len(tokens)

    if total_tokens == 0:
        return []

    chunks = []
    start = 0
    chunk_index = 0

    while start < total_tokens:
        # Calculate end position
        end = min(start + chunk_size, total_tokens)

        # Get tokens for this chunk
        chunk_tokens = tokens[start:end]

        # Decode back to text
        chunk_text = encoding.decode(chunk_tokens)

        # Create chunk object
        chunks.append(
            TextChunk(
                index=chunk_index,
                content=chunk_text.strip(),
                token_count=len(chunk_tokens),
                metadata={
                    "start_token": start,
                    "end_token": end,
                },
            )
        )

        # Move start position (accounting for overlap)
        start = end - overlap if end < total_tokens else end
        chunk_index += 1

    return chunks


def chunk_by_paragraphs(
    text: str,
    max_chunk_size: int = 500,
    model: str = "text-embedding-3-small",
) -> list[TextChunk]:
    """
    Split text by paragraphs, combining small paragraphs and splitting large ones.

    This method preserves semantic boundaries better than fixed-size chunking.
    """
    try:
        encoding = tiktoken.encoding_for_model(model)
    except KeyError:
        encoding = tiktoken.get_encoding("cl100k_base")

    # Split by double newlines (paragraphs)
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

    chunks = []
    current_chunk = ""
    current_tokens = 0
    chunk_index = 0

    for para in paragraphs:
        para_tokens = len(encoding.encode(para))

        # If single paragraph exceeds max size, use fixed chunking
        if para_tokens > max_chunk_size:
            # Flush current chunk first
            if current_chunk:
                chunks.append(
                    TextChunk(
                        index=chunk_index,
                        content=current_chunk.strip(),
                        token_count=current_tokens,
                        metadata={},
                    )
                )
                chunk_index += 1
                current_chunk = ""
                current_tokens = 0

            # Chunk the large paragraph
            para_chunks = chunk_document(para, max_chunk_size, overlap=50, model=model)
            for pc in para_chunks:
                pc.index = chunk_index
                chunks.append(pc)
                chunk_index += 1
            continue

        # Check if adding this paragraph exceeds limit
        if current_tokens + para_tokens > max_chunk_size:
            # Flush current chunk
            if current_chunk:
                chunks.append(
                    TextChunk(
                        index=chunk_index,
                        content=current_chunk.strip(),
                        token_count=current_tokens,
                        metadata={},
                    )
                )
                chunk_index += 1

            current_chunk = para
            current_tokens = para_tokens
        else:
            # Add to current chunk
            if current_chunk:
                current_chunk += "\n\n" + para
            else:
                current_chunk = para
            current_tokens += para_tokens

    # Flush remaining content
    if current_chunk:
        chunks.append(
            TextChunk(
                index=chunk_index,
                content=current_chunk.strip(),
                token_count=current_tokens,
                metadata={},
            )
        )

    return chunks
