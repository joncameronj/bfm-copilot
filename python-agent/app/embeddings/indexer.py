from app.embeddings.chunker import TextChunk, chunk_by_paragraphs
from app.embeddings.embedder import get_embeddings_batch
from app.services.supabase import (
    insert_document,
    insert_document_chunks,
    update_document_status,
)


async def index_document(
    user_id: str,
    filename: str,
    file_type: str,
    mime_type: str,
    text_content: str,
    storage_path: str | None = None,
) -> dict:
    """
    Index a document: chunk, embed, and store in vector database.

    Args:
        user_id: The user who owns this document
        filename: Original filename
        file_type: Type category for filtering
        mime_type: MIME type of the original file
        text_content: Extracted text content to index
        storage_path: Optional path to stored file

    Returns:
        Document record with status
    """
    # Create document record
    document = await insert_document(
        user_id=user_id,
        filename=filename,
        file_type=file_type,
        mime_type=mime_type,
        storage_path=storage_path,
    )
    document_id = document["id"]

    try:
        # Update status to processing
        await update_document_status(document_id, "processing")

        # Chunk the document
        chunks = chunk_by_paragraphs(text_content, max_chunk_size=500)

        if not chunks:
            await update_document_status(
                document_id, "error", error_message="No content to index"
            )
            return {"id": document_id, "status": "error", "error": "No content to index"}

        # Generate embeddings for all chunks
        chunk_texts = [chunk.content for chunk in chunks]
        embeddings = await get_embeddings_batch(chunk_texts)

        # Prepare chunks for storage
        chunk_records = [
            {
                "index": chunk.index,
                "content": chunk.content,
                "embedding": embeddings[i],
                "token_count": chunk.token_count,
                "metadata": chunk.metadata,
            }
            for i, chunk in enumerate(chunks)
        ]

        # Store chunks in database
        await insert_document_chunks(document_id, chunk_records)

        # Update document status
        await update_document_status(document_id, "indexed", total_chunks=len(chunks))

        return {
            "id": document_id,
            "status": "indexed",
            "total_chunks": len(chunks),
        }

    except Exception as e:
        await update_document_status(document_id, "error", error_message=str(e))
        return {"id": document_id, "status": "error", "error": str(e)}


async def index_chunks(
    document_id: str,
    chunks: list[TextChunk],
    embeddings: list[list[float]],
) -> None:
    """
    Store pre-generated chunks and embeddings.

    This is useful when you want to control the chunking/embedding separately.
    """
    chunk_records = [
        {
            "index": chunk.index,
            "content": chunk.content,
            "embedding": embeddings[i],
            "token_count": chunk.token_count,
            "metadata": chunk.metadata,
        }
        for i, chunk in enumerate(chunks)
    ]

    await insert_document_chunks(document_id, chunk_records)
