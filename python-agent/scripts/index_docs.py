#!/usr/bin/env python3
"""
Document Indexing Script

Index all Markdown documents from the protocols directory into the vector store.

Usage:
    python scripts/index_docs.py ../docs/protocols
    python scripts/index_docs.py ../docs/protocols --dry-run
    python scripts/index_docs.py ../docs/protocols --user-id <uuid>
    python scripts/index_docs.py ../docs/protocols --global  # Index as global docs
"""

import argparse
import asyncio
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.embeddings.doc_processor import (
    ProcessedDocument,
    infer_metadata_from_path,
    process_directory,
    validate_document,
)
from app.embeddings.chunker import chunk_by_paragraphs
from app.embeddings.embedder import get_embeddings_batch
from app.services.supabase import get_supabase_client


async def index_document_with_metadata(
    doc: ProcessedDocument,
    user_id: str | None = None,
    is_global: bool = False,
    dry_run: bool = False,
) -> dict:
    """
    Index a processed document with its metadata.

    Args:
        doc: ProcessedDocument with metadata and content
        user_id: User ID (required unless is_global)
        is_global: Whether this is a global document
        dry_run: If True, don't actually insert

    Returns:
        Result dict with status
    """
    if dry_run:
        return {
            "filename": doc.filename,
            "title": doc.title,
            "status": "dry_run",
            "body_system": doc.metadata.body_system,
            "category": doc.metadata.document_category,
            "tags": doc.metadata.all_tags(),
            "content_length": len(doc.content),
        }

    client = get_supabase_client()

    # Map document_category to file_type for backwards compatibility
    file_type_map = {
        "protocol": "medical_protocol",
        "lab_guide": "lab_interpretation",
        "care_guide": "medical_protocol",
        "reference": "other",
        "patient_education": "other",
        "case_study": "diagnostic_report",
    }
    file_type = file_type_map.get(doc.metadata.document_category, "other")

    # Create document record with extended metadata
    doc_data = {
        "filename": doc.filename,
        "file_type": file_type,
        "mime_type": "text/markdown",
        "status": "pending",
        "title": doc.title,
        "body_system": doc.metadata.body_system or None,
        "document_category": doc.metadata.document_category or None,
        "is_global": is_global,
        "version": doc.metadata.version,
        "metadata": doc.raw_frontmatter,
    }

    # Add user_id if not global (global docs need a system user)
    if user_id:
        doc_data["user_id"] = user_id
    elif is_global:
        # For global docs, we need a system user - this should be set up in your DB
        # For now, we'll skip the user_id for global docs if RLS allows
        pass

    try:
        result = client.table("documents").insert(doc_data).execute()
        document_id = result.data[0]["id"]

        # Update status to processing
        client.table("documents").update({"status": "processing"}).eq(
            "id", document_id
        ).execute()

        # Chunk the document
        chunks = chunk_by_paragraphs(doc.content, max_chunk_size=500)

        if not chunks:
            client.table("documents").update(
                {"status": "error", "error_message": "No content to index"}
            ).eq("id", document_id).execute()
            return {"filename": doc.filename, "status": "error", "error": "No content"}

        # Generate embeddings
        chunk_texts = [chunk.content for chunk in chunks]
        embeddings = await get_embeddings_batch(chunk_texts)

        # Prepare chunk records
        chunk_records = [
            {
                "document_id": document_id,
                "chunk_index": chunk.index,
                "content": chunk.content,
                "embedding": embeddings[i],
                "token_count": chunk.token_count,
                "metadata": chunk.metadata,
            }
            for i, chunk in enumerate(chunks)
        ]

        # Insert chunks in batches
        batch_size = 100
        for i in range(0, len(chunk_records), batch_size):
            batch = chunk_records[i : i + batch_size]
            client.table("document_chunks").insert(batch).execute()

        # Link tags to document
        await link_document_tags(document_id, doc.metadata.all_tags())

        # Update status to indexed
        client.table("documents").update(
            {"status": "indexed", "total_chunks": len(chunks)}
        ).eq("id", document_id).execute()

        return {
            "filename": doc.filename,
            "document_id": document_id,
            "status": "indexed",
            "chunks": len(chunks),
        }

    except Exception as e:
        return {"filename": doc.filename, "status": "error", "error": str(e)}


async def link_document_tags(document_id: str, tag_names: list[str]) -> None:
    """Link a document to its tags in the database."""
    if not tag_names:
        return

    client = get_supabase_client()

    # Get tag IDs for the given tag names
    result = (
        client.table("document_tags")
        .select("id, tag_name")
        .in_("tag_name", tag_names)
        .execute()
    )

    if not result.data:
        return

    # Create mappings
    mappings = [
        {"document_id": document_id, "tag_id": tag["id"]} for tag in result.data
    ]

    # Insert mappings (ignore conflicts)
    for mapping in mappings:
        try:
            client.table("document_tag_mappings").insert(mapping).execute()
        except Exception:
            # Ignore duplicate key errors
            pass


async def main():
    parser = argparse.ArgumentParser(
        description="Index Markdown documents into the vector store"
    )
    parser.add_argument("directory", help="Directory containing Markdown files")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be indexed without actually doing it",
    )
    parser.add_argument("--user-id", help="User ID to associate documents with")
    parser.add_argument(
        "--global",
        dest="is_global",
        action="store_true",
        help="Index as global documents (accessible to all users)",
    )
    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="Only validate documents, don't index",
    )

    args = parser.parse_args()

    directory = Path(args.directory)
    if not directory.exists():
        print(f"Error: Directory '{directory}' does not exist")
        sys.exit(1)

    if not args.is_global and not args.user_id and not args.dry_run:
        print("Error: Either --user-id or --global must be specified")
        print("Use --dry-run to preview without indexing")
        sys.exit(1)

    print(f"Processing documents from: {directory}")
    print()

    # Process all documents
    documents = process_directory(directory)
    print(f"Found {len(documents)} documents")
    print()

    # Infer metadata from paths
    documents = [infer_metadata_from_path(doc) for doc in documents]

    # Validate documents
    all_warnings = []
    for doc in documents:
        warnings = validate_document(doc)
        all_warnings.extend(warnings)

    if all_warnings:
        print("Validation warnings:")
        for warning in all_warnings:
            print(f"  - {warning}")
        print()

    if args.validate_only:
        print("Validation complete (--validate-only specified)")
        return

    # Index documents
    results = []
    for i, doc in enumerate(documents, 1):
        print(f"[{i}/{len(documents)}] Processing: {doc.filename}")

        result = await index_document_with_metadata(
            doc,
            user_id=args.user_id,
            is_global=args.is_global,
            dry_run=args.dry_run,
        )

        results.append(result)

        if result["status"] == "indexed":
            print(f"  ✓ Indexed ({result.get('chunks', 0)} chunks)")
        elif result["status"] == "dry_run":
            print(f"  → Would index: {result['title']}")
            print(f"    Body system: {result.get('body_system', 'N/A')}")
            print(f"    Category: {result.get('category', 'N/A')}")
            print(f"    Tags: {', '.join(result.get('tags', []))}")
        else:
            print(f"  ✗ Error: {result.get('error', 'Unknown error')}")

    print()
    print("=" * 50)
    print("Summary:")
    indexed = sum(1 for r in results if r["status"] == "indexed")
    dry_run = sum(1 for r in results if r["status"] == "dry_run")
    errors = sum(1 for r in results if r["status"] == "error")

    if args.dry_run:
        print(f"  Would index: {dry_run} documents")
    else:
        print(f"  Indexed: {indexed}")
        print(f"  Errors: {errors}")


if __name__ == "__main__":
    asyncio.run(main())
