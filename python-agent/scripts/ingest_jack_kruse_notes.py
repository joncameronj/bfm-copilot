#!/usr/bin/env python3
"""
Ingest Jack Kruse Notes PDF into the BFM RAG knowledge base.

This document contains notes from Dr. Jack Kruse written by Dr. Rob DeMartino.
The content covers melanin, POMC, mitochondria, circadian biology, light therapy,
autoimmune conditions, deuterium depletion, EMF effects, and more.

IMPORTANT: This content is available to BOTH practitioners AND members (role_scope='both').

Usage:
    cd python-agent
    python scripts/ingest_jack_kruse_notes.py

Requirements:
    - OPENAI_API_KEY environment variable
    - SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables
    - poppler installed for PDF processing (brew install poppler)
"""

import asyncio
import os
import sys
from pathlib import Path

# Add the app directory to the path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from app.embeddings.preprocessing import process_pdf_with_vision_fallback
from app.embeddings.chunker import chunk_by_paragraphs
from app.embeddings.embedder import get_embeddings_batch
from app.services.supabase import get_supabase_client


# Configuration
PDF_PATH = Path("/Users/joncameron/Downloads/Documents/Jack Kruse Notes.pdf")
DOCUMENT_TITLE = "Jack Kruse Notes - Dr. Rob DeMartino"
DOCUMENT_FILENAME = "Jack_Kruse_Notes_DiMartino.pdf"


def detect_seminar_day(filename: str, title: str) -> str | None:
    """Detect seminar day from filename or title.

    Used to enable Sunday-first RAG search strategy:
    - Sunday: tactical case studies, protocols
    - Saturday: intermediate content
    - Friday: foundational content
    """
    text = f"{filename} {title}".lower()
    if 'sun ' in text or 'sun.' in text or 'sunday' in text:
        return 'sunday'
    elif 'sat ' in text or 'sat.' in text or 'saturday' in text:
        return 'saturday'
    elif 'fri ' in text or 'fri.' in text or 'friday' in text:
        return 'friday'
    return None

# System user ID for global documents (admin user for BFM)
SYSTEM_USER_ID = "dd78e6d8-09a2-4754-8834-870c36ed89ce"


async def ingest_jack_kruse_notes():
    """
    Ingest the Jack Kruse Notes PDF into the RAG knowledge base.

    This makes the content available to both practitioners and members
    via semantic search.
    """
    print(f"\n{'='*60}")
    print("Jack Kruse Notes Ingestion")
    print(f"{'='*60}")
    print(f"Source: {PDF_PATH}")
    print(f"Title: {DOCUMENT_TITLE}")
    print(f"Role Scope: BOTH (practitioners AND members)")
    print(f"{'='*60}\n")

    # Validate PDF exists
    if not PDF_PATH.exists():
        print(f"❌ Error: PDF not found at {PDF_PATH}")
        sys.exit(1)

    # Check for required environment variables
    required_vars = ["OPENAI_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_KEY"]
    missing = [v for v in required_vars if not os.getenv(v)]
    if missing:
        print(f"❌ Error: Missing required environment variables: {', '.join(missing)}")
        sys.exit(1)

    client = get_supabase_client()

    try:
        # Check if document already exists
        print("Checking for existing document...")
        existing = client.table("documents").select("id").eq(
            "filename", DOCUMENT_FILENAME
        ).execute()

        if existing.data:
            doc_id = existing.data[0]["id"]
            print(f"⚠️  Found existing document: {doc_id}")
            print("   Deleting existing chunks to refresh...")

            # Delete existing chunks
            client.table("document_chunks").delete().eq(
                "document_id", doc_id
            ).execute()

            # Update document status
            client.table("documents").update({
                "status": "processing"
            }).eq("id", doc_id).execute()
        else:
            # Create new document record
            print("Creating document record...")

            # Detect seminar day for Sunday-first RAG search
            seminar_day = detect_seminar_day(DOCUMENT_FILENAME, DOCUMENT_TITLE)
            if seminar_day:
                print(f"  Detected seminar day: {seminar_day}")

            doc_payload = {
                "user_id": SYSTEM_USER_ID,
                "filename": DOCUMENT_FILENAME,
                "file_type": "ip_material",
                "mime_type": "application/pdf",
                "title": DOCUMENT_TITLE,
                "body_system": "multi_system",  # Content spans many systems
                "document_category": "reference",
                "care_category": "general",  # General/foundational content
                "role_scope": "both",  # IMPORTANT: Available to practitioners AND members
                "status": "processing",
                "is_global": True,
                "metadata": {
                    "author": "Dr. Rob DeMartino",
                    "source": "Jack Kruse teachings",
                    "topics": [
                        "melanin",
                        "POMC",
                        "mitochondria",
                        "circadian biology",
                        "light therapy",
                        "autoimmune conditions",
                        "deuterium depletion",
                        "EMF effects",
                        "quantum biology"
                    ]
                }
            }
            # Add seminar_day if detected (enables Sunday-first RAG search)
            if seminar_day:
                doc_payload["seminar_day"] = seminar_day

            doc_result = client.table("documents").insert(doc_payload).execute()

            doc_id = doc_result.data[0]["id"]
            print(f"✓ Created document: {doc_id}")

        # Extract text from PDF
        print("\nExtracting text from PDF...")
        result = await process_pdf_with_vision_fallback(PDF_PATH)

        text_content = result["text_content"]
        method = result.get("method", "text")
        print(f"✓ Extracted text using method: {method}")
        print(f"  Content length: {len(text_content):,} characters")

        # Chunk the content
        print("\nChunking content...")
        chunks = chunk_by_paragraphs(text_content)
        print(f"✓ Created {len(chunks)} chunks")

        # Generate embeddings in batches
        print("\nGenerating embeddings...")
        chunk_texts = [chunk.content for chunk in chunks]
        embeddings = await get_embeddings_batch(chunk_texts)
        print(f"✓ Generated {len(embeddings)} embeddings")

        # Store chunks with embeddings
        print("\nStoring chunks in database...")
        chunk_records = []
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            chunk_records.append({
                "document_id": doc_id,
                "chunk_index": i,
                "content": chunk.content,
                "embedding": embedding,
                "token_count": chunk.token_count,
                "metadata": {
                    **chunk.metadata,
                    "source": "Jack Kruse Notes",
                    "author": "Dr. Rob DeMartino"
                }
            })

        # Insert chunks in batches
        BATCH_SIZE = 50
        for i in range(0, len(chunk_records), BATCH_SIZE):
            batch = chunk_records[i:i + BATCH_SIZE]
            client.table("document_chunks").insert(batch).execute()
            print(f"  ✓ Inserted batch {i // BATCH_SIZE + 1}/{(len(chunk_records) + BATCH_SIZE - 1) // BATCH_SIZE}")

        # Update document status
        client.table("documents").update({
            "status": "indexed",
            "total_chunks": len(chunk_records),
        }).eq("id", doc_id).execute()

        print(f"\n{'='*60}")
        print("✅ INGESTION COMPLETE!")
        print(f"{'='*60}")
        print(f"Document ID: {doc_id}")
        print(f"Total chunks: {len(chunk_records)}")
        print(f"Role scope: both (practitioners AND members)")
        print(f"\nThe Jack Kruse Notes are now available to the RAG system.")
        print(f"Both practitioners and members can access this knowledge.")
        print(f"{'='*60}\n")

    except Exception as e:
        print(f"\n❌ Error during ingestion: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(ingest_jack_kruse_notes())
