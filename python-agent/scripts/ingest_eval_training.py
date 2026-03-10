#!/usr/bin/env python3
"""
Ingest all eval training documents into the vector database.

Ingests three types of training material:
1. Dr. Rob's graded review (already existing — re-ingest for freshness)
2. Clinical correction patterns (generalizable rules from corrections)
3. Reviewed case studies (verified diagnostic-to-protocol mappings)

Idempotent — purges previous versions before re-inserting.

Usage:
    cd python-agent && uv run python -m scripts.ingest_eval_training
"""

import asyncio
import re
import sys
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.embeddings.chunker import chunk_with_protocols, enrich_chunks_with_protocols
from app.embeddings.embedder import get_embeddings_batch
from app.services.supabase import get_supabase_client

# System user ID for global documents
SYSTEM_USER_ID = "dd78e6d8-09a2-4754-8834-870c36ed89ce"

EVAL_REVIEWS_DIR = (
    Path(__file__).parent.parent.parent / "agent-assets" / "eval-reviews"
)

# All training documents to ingest
TRAINING_DOCS = [
    {
        "filename": "BFM-Patient-Eval-Report-Mar2026-REVIEW.md",
        "title": "BFM Patient Eval Report — Dr. Rob's Review & Corrections (Mar 2026)",
        "doc_type": "practitioner_review",
        "body_system": "multi_system",
        "chunk_size": 800,
        "metadata_extra": {
            "report_type": "practitioner_review",
            "contains_corrections": True,
            "source": "Dr. Rob clinical review of 5 patient evals",
            "patients": ["DH", "GD", "GG", "JW", "TH"],
        },
    },
    {
        "filename": "clinical-correction-patterns.md",
        "title": "BFM Clinical Correction Patterns — Dr. Rob Verified Rules (Mar 2026)",
        "doc_type": "clinical_rules",
        "body_system": "multi_system",
        "chunk_size": 600,
        "metadata_extra": {
            "report_type": "clinical_rules",
            "contains_corrections": True,
            "source": "Distilled correction patterns from Dr. Rob's 5-patient review",
            "priority": "highest",
        },
    },
    {
        "filename": "reviewed-case-studies.md",
        "title": "BFM Reviewed Case Studies — Dr. Rob Verified Mappings (Mar 2026)",
        "doc_type": "case_studies",
        "body_system": "multi_system",
        "chunk_size": 700,
        "metadata_extra": {
            "report_type": "case_studies",
            "contains_corrections": True,
            "source": "Verified diagnostic-to-protocol mappings from 5 patient evals",
            "patients": ["DH", "GD", "GG", "JW", "TH"],
        },
    },
]


def purge_existing_versions(filename: str) -> int:
    """Remove previously ingested versions of the same file."""
    client = get_supabase_client()

    existing = (
        client.table("documents")
        .select("id")
        .eq("filename", filename)
        .execute()
    )
    doc_ids = [row["id"] for row in (existing.data or []) if row.get("id")]
    if not doc_ids:
        return 0

    batch_size = 50
    for i in range(0, len(doc_ids), batch_size):
        batch_ids = doc_ids[i : i + batch_size]
        client.table("document_chunks").delete().in_("document_id", batch_ids).execute()
        client.table("document_tag_mappings").delete().in_("document_id", batch_ids).execute()
        client.table("documents").delete().in_("id", batch_ids).execute()

    return len(doc_ids)


def split_by_headings(content: str, level: str = "## ") -> list[dict]:
    """Split markdown content by heading level into sections."""
    lines = content.split("\n")
    sections: list[dict] = []
    current_title = "Introduction"
    current_lines: list[str] = []

    for line in lines:
        if line.startswith(level) and not line.startswith(level + "#"):
            # Save previous section
            if current_lines:
                text = "\n".join(current_lines).strip()
                if text:
                    sections.append({"title": current_title, "content": text})
            current_title = line.lstrip("#").strip()
            current_lines = [line]
        else:
            current_lines.append(line)

    # Save last section
    if current_lines:
        text = "\n".join(current_lines).strip()
        if text:
            sections.append({"title": current_title, "content": text})

    return sections


async def ingest_single_doc(doc_config: dict) -> dict:
    """Ingest a single training document into the vector database."""
    filepath = EVAL_REVIEWS_DIR / doc_config["filename"]

    if not filepath.exists():
        print(f"  SKIP: {doc_config['filename']} — file not found")
        return {"success": False, "error": "File not found", "filename": doc_config["filename"]}

    print(f"\n  Reading: {doc_config['filename']}")
    content = filepath.read_text(encoding="utf-8")

    if not content.strip():
        return {"success": False, "error": "Empty file", "filename": doc_config["filename"]}

    # Split into sections by ## headings for better chunking
    sections = split_by_headings(content, "## ")
    if len(sections) <= 1:
        # Try # headings instead
        sections = split_by_headings(content, "# ")

    print(f"  Split into {len(sections)} sections")

    # Chunk each section with protocol awareness
    all_chunks: list[tuple[str, str, dict]] = []

    for section in sections:
        chunks = chunk_with_protocols(
            section["content"],
            max_chunk_size=doc_config["chunk_size"],
            include_surrounding_context=True,
        )
        chunks = enrich_chunks_with_protocols(chunks)

        for chunk in chunks:
            chunk_meta = {
                "section_title": section["title"],
                "doc_type": doc_config["doc_type"],
            }
            all_chunks.append((section["title"], chunk.content, {
                **chunk_meta,
                "protocols": chunk.protocols or [],
                "has_protocol_context": chunk.has_protocol_context,
                "token_count": chunk.token_count,
            }))

    print(f"  Created {len(all_chunks)} chunks")

    # Generate embeddings
    print(f"  Generating embeddings...")
    chunk_texts = [text for _, text, _ in all_chunks]
    embeddings = await get_embeddings_batch(chunk_texts)
    print(f"  Generated {len(embeddings)} embeddings")

    # Store in database
    client = get_supabase_client()

    # Purge previous versions
    removed = purge_existing_versions(doc_config["filename"])
    if removed:
        print(f"  Removed {removed} previous version(s)")

    # Create document record
    doc_payload = {
        "user_id": SYSTEM_USER_ID,
        "filename": doc_config["filename"],
        "file_type": "medical_protocol",
        "mime_type": "text/markdown",
        "title": doc_config["title"],
        "body_system": doc_config["body_system"],
        "document_category": "master_reference",
        "care_category": "general",
        "role_scope": "clinical",
        "status": "processing",
        "is_global": True,
        "metadata": {
            "master_reference": True,
            **doc_config["metadata_extra"],
        },
    }

    doc_result = client.table("documents").insert(doc_payload).execute()
    doc_id = doc_result.data[0]["id"]
    print(f"  Document ID: {doc_id}")

    # Store chunks
    chunk_records = []
    for i, (title, text, meta) in enumerate(all_chunks):
        chunk_records.append({
            "document_id": doc_id,
            "chunk_index": i,
            "content": text,
            "embedding": embeddings[i],
            "token_count": meta.get("token_count", 0),
            "metadata": {
                **meta,
                "master_reference": True,
                **doc_config["metadata_extra"],
            },
        })

    # Insert in batches
    BATCH_SIZE = 50
    for i in range(0, len(chunk_records), BATCH_SIZE):
        batch = chunk_records[i : i + BATCH_SIZE]
        client.table("document_chunks").insert(batch).execute()

    # Update document status
    client.table("documents").update({
        "status": "indexed",
        "total_chunks": len(chunk_records),
    }).eq("id", doc_id).execute()

    print(f"  Indexed {len(chunk_records)} chunks ✓")

    return {
        "success": True,
        "filename": doc_config["filename"],
        "document_id": doc_id,
        "total_chunks": len(chunk_records),
    }


async def main():
    """Ingest all training documents."""
    print("=" * 60)
    print("INGESTING BFM EVAL TRAINING DOCUMENTS")
    print("=" * 60)

    results = []
    for doc_config in TRAINING_DOCS:
        result = await ingest_single_doc(doc_config)
        results.append(result)

    print("\n" + "=" * 60)
    print("INGESTION SUMMARY")
    print("=" * 60)

    total_chunks = 0
    for result in results:
        status = "OK" if result.get("success") else "FAIL"
        chunks = result.get("total_chunks", 0)
        total_chunks += chunks
        print(f"  [{status}] {result['filename']}: {chunks} chunks")

    print(f"\n  Total chunks ingested: {total_chunks}")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
