#!/usr/bin/env python3
"""
Re-embed all document_chunks using OpenAI text-embedding-3-small.

Needed after switching to OpenAI embeddings.
Updates embeddings in-place without changing any other chunk data.
"""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.supabase import get_supabase_client
from app.services.embeddings_client import create_embedding_batch_sync

BATCH_SIZE = 100  # OpenAI batch limit


def fetch_all_chunk_ids_and_content() -> list[dict]:
    """Fetch all chunk IDs and content from the database."""
    client = get_supabase_client()
    all_chunks = []
    offset = 0
    page_size = 1000

    while True:
        result = (
            client.table("document_chunks")
            .select("id, content")
            .order("id")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        if not result.data:
            break
        all_chunks.extend(result.data)
        if len(result.data) < page_size:
            break
        offset += page_size

    return all_chunks


def update_embeddings_batch(updates: list[dict]) -> None:
    """Update embedding vectors for a batch of chunks."""
    client = get_supabase_client()
    for item in updates:
        client.table("document_chunks").update(
            {"embedding": item["embedding"]}
        ).eq("id", item["id"]).execute()


def main():
    print("=== Re-embedding all chunks with OpenAI text-embedding-3-small ===")
    start = time.time()

    # Fetch all chunks
    print("Fetching all chunks...")
    chunks = fetch_all_chunk_ids_and_content()
    print(f"Found {len(chunks)} chunks to re-embed")

    if not chunks:
        print("Nothing to do.")
        return

    # Process in batches
    total_batches = (len(chunks) + BATCH_SIZE - 1) // BATCH_SIZE
    updated = 0

    for batch_num in range(total_batches):
        batch_start = batch_num * BATCH_SIZE
        batch_end = min(batch_start + BATCH_SIZE, len(chunks))
        batch = chunks[batch_start:batch_end]

        texts = [c["content"] for c in batch]
        ids = [c["id"] for c in batch]

        print(f"  Batch {batch_num + 1}/{total_batches}: embedding {len(texts)} chunks...")
        embeddings = create_embedding_batch_sync(texts)

        # Build updates and write to DB
        updates = [
            {"id": cid, "embedding": emb}
            for cid, emb in zip(ids, embeddings)
        ]
        update_embeddings_batch(updates)
        updated += len(updates)
        print(f"    Updated {updated}/{len(chunks)} chunks")

    elapsed = time.time() - start
    print(f"\nDone! Re-embedded {updated} chunks in {elapsed:.1f}s")


if __name__ == "__main__":
    main()
