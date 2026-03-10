#!/usr/bin/env python3
"""
Ingest BFM Master Protocol Key markdown files into the vector database.

Reads the structured markdown files from agent-assets/master-protocols/
and ingests them with protocol-aware chunking and master_reference tagging.

This script is idempotent - safe to re-run. It purges previous versions
of each file before re-ingesting.

Usage:
    cd python-agent && uv run python scripts/ingest_master_protocols.py
    # or
    cd python-agent && python scripts/ingest_master_protocols.py
"""

import asyncio
import sys
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.embeddings.chunker import chunk_with_protocols, enrich_chunks_with_protocols
from app.embeddings.embedder import get_embeddings_batch
from app.services.supabase import get_supabase_client

# System user ID for global documents
SYSTEM_USER_ID = "dd78e6d8-09a2-4754-8834-870c36ed89ce"

# Map filenames to care categories and descriptions
FILE_CONFIG = {
    "01-deal-breakers.md": {
        "title": "BFM Master Protocol Key: Deal Breakers",
        "care_category": "general",
        "body_system": "multi_system",
        "description": "7 critical deal breakers that must be addressed before any frequency protocol",
    },
    "02-hrv-brainwave-mapping.md": {
        "title": "BFM Master Protocol Key: HRV & Brainwave Mapping",
        "care_category": "general",
        "body_system": "nervous",
        "description": "Maps HRV autonomic patterns and brainwave findings to frequency protocols",
    },
    "03-dpulse-organ-mapping.md": {
        "title": "BFM Master Protocol Key: D-Pulse Organ Mapping",
        "care_category": "general",
        "body_system": "multi_system",
        "description": "Maps low organ scores from D-Pulse testing to frequency protocols",
    },
    "04-lab-diagnostic-mapping.md": {
        "title": "BFM Master Protocol Key: Lab & Diagnostic Mapping",
        "care_category": "general",
        "body_system": "multi_system",
        "description": "Maps lab markers and diagnostic findings to protocols and supplementation",
    },
    "05-condition-protocols.md": {
        "title": "BFM Master Protocol Key: Condition-Specific Protocols",
        "care_category": "general",
        "body_system": "multi_system",
        "description": "Disease-specific protocol stacks with frequency combinations and timelines",
    },
    "06-five-levers.md": {
        "title": "BFM Master Protocol Key: The Five Levers",
        "care_category": "general",
        "body_system": "endocrine",
        "description": "5 master levers: Melatonin, Leptin, MSH, Vitamin D, UB Rates",
    },
    "07-supplement-reference.md": {
        "title": "BFM Master Protocol Key: Supplement Reference",
        "care_category": "general",
        "body_system": "multi_system",
        "description": "Complete supplement catalog with dosages, timing, indications, and brands",
    },
    "08-mitochondrial-frequencies.md": {
        "title": "BFM Master Protocol Key: Mitochondrial Frequencies",
        "care_category": "general",
        "body_system": "multi_system",
        "description": "All MIT/Mito frequency settings with mechanisms and indications",
    },
    "09-contraindications.md": {
        "title": "BFM Master Protocol Key: Contraindications & Safety",
        "care_category": "general",
        "body_system": "multi_system",
        "description": "Safety warnings and contraindications for frequency protocols",
    },
    "10-clinical-decision-rules.md": {
        "title": "BFM Master Protocol Key: Clinical Decision Rules (Eval-Trained)",
        "care_category": "general",
        "body_system": "multi_system",
        "description": "Eval-trained clinical decision rules from Dr. Rob's review of 5 patient evaluations. Corrects common errors in autonomic pattern classification, supplement phasing, Cell Synergy dosing, vagus ordering, VCS-Leptin-MSH gating, and lab-triggered protocols.",
    },
}


def purge_existing_versions(filename: str) -> int:
    """
    Remove previously ingested versions of the same file.

    Keeps ingestion idempotent and prevents duplicate chunks.
    """
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
        batch_ids = doc_ids[i:i + batch_size]
        client.table("document_chunks").delete().in_("document_id", batch_ids).execute()
        client.table("document_tag_mappings").delete().in_("document_id", batch_ids).execute()
        client.table("documents").delete().in_("id", batch_ids).execute()

    return len(doc_ids)


async def ingest_master_protocol_file(filepath: Path) -> dict:
    """Ingest a single master protocol markdown file."""
    filename = filepath.name
    config = FILE_CONFIG.get(filename)

    if not config:
        print(f"  SKIP: No config for {filename}")
        return {"success": False, "error": "No config defined"}

    print(f"\nProcessing: {filename}")
    print(f"  Title: {config['title']}")

    # Read content
    content = filepath.read_text(encoding="utf-8")
    if not content.strip():
        print(f"  Empty file, skipping")
        return {"success": False, "error": "Empty file"}

    # Use protocol-aware chunking for better retrieval
    print(f"  Chunking with protocol awareness...")
    chunks = chunk_with_protocols(
        content,
        max_chunk_size=500,
        include_surrounding_context=True,
    )

    # Enrich any chunks that missed protocol detection
    chunks = enrich_chunks_with_protocols(chunks)

    protocol_chunks = sum(1 for c in chunks if c.has_protocol_context)
    print(f"  Created {len(chunks)} chunks ({protocol_chunks} with protocol context)")

    # Generate embeddings
    print(f"  Generating embeddings...")
    chunk_texts = [chunk.content for chunk in chunks]
    embeddings = await get_embeddings_batch(chunk_texts)
    print(f"  Generated {len(embeddings)} embeddings")

    # Store in database
    client = get_supabase_client()

    # Purge previous versions (idempotent)
    removed_count = purge_existing_versions(filename)
    if removed_count:
        print(f"  Removed {removed_count} previous version(s)")

    # Create document record with master_reference category
    doc_payload = {
        "user_id": SYSTEM_USER_ID,
        "filename": filename,
        "file_type": "medical_protocol",
        "mime_type": "text/markdown",
        "title": config["title"],
        "body_system": config["body_system"],
        "document_category": "master_reference",
        "care_category": config["care_category"],
        "role_scope": "both",
        "status": "processing",
        "is_global": True,
        "metadata": {
            "master_reference": True,
            "source": "BFM Master Protocol Key XLSX",
            "description": config["description"],
            "protocol_chunks": protocol_chunks,
        },
    }

    doc_result = client.table("documents").insert(doc_payload).execute()
    doc_id = doc_result.data[0]["id"]
    print(f"  Created document: {doc_id}")

    # Store chunks with embeddings and protocol metadata
    chunk_records = []
    for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        metadata = {
            **(chunk.metadata or {}),
            "master_reference": True,
        }
        if chunk.protocols:
            metadata["protocols"] = chunk.protocols
        if chunk.has_protocol_context:
            metadata["has_protocol_context"] = True

        chunk_records.append({
            "document_id": doc_id,
            "chunk_index": i,
            "content": chunk.content,
            "embedding": embedding,
            "token_count": chunk.token_count,
            "metadata": metadata,
        })

    # Insert chunks in batches
    BATCH_SIZE = 50
    for i in range(0, len(chunk_records), BATCH_SIZE):
        batch = chunk_records[i:i + BATCH_SIZE]
        client.table("document_chunks").insert(batch).execute()

    # Update document status
    client.table("documents").update({
        "status": "indexed",
        "total_chunks": len(chunk_records),
    }).eq("id", doc_id).execute()

    print(f"  Indexed {len(chunks)} chunks for {filename}")

    return {
        "success": True,
        "document_id": doc_id,
        "chunks": len(chunks),
        "protocol_chunks": protocol_chunks,
    }


async def main():
    """Main entry point."""
    protocols_dir = Path(__file__).parent.parent.parent / "agent-assets" / "master-protocols"

    if not protocols_dir.exists():
        print(f"Error: Master protocols directory not found: {protocols_dir}")
        print("Run convert_master_xlsx.py first to generate the markdown files.")
        return

    md_files = sorted(protocols_dir.glob("*.md"))

    if not md_files:
        print("Error: No markdown files found in master-protocols directory")
        return

    print(f"Found {len(md_files)} master protocol files to ingest")
    print("=" * 60)

    results = []
    for md_file in md_files:
        try:
            result = await ingest_master_protocol_file(md_file)
            results.append({"file": md_file.name, **result})
        except Exception as e:
            print(f"  Error processing {md_file.name}: {e}")
            results.append({"file": md_file.name, "success": False, "error": str(e)})

    # Summary
    print("\n" + "=" * 60)
    print("MASTER PROTOCOL INGESTION SUMMARY")
    print("=" * 60)

    successful = [r for r in results if r.get("success")]
    failed = [r for r in results if not r.get("success")]

    print(f"Total files: {len(results)}")
    print(f"Successful: {len(successful)}")
    print(f"Failed: {len(failed)}")

    if successful:
        total_chunks = sum(r.get("chunks", 0) for r in successful)
        total_protocol_chunks = sum(r.get("protocol_chunks", 0) for r in successful)
        print(f"Total chunks: {total_chunks}")
        print(f"Protocol-tagged chunks: {total_protocol_chunks}")

    if failed:
        print("\nFailed files:")
        for r in failed:
            print(f"  - {r['file']}: {r.get('error', 'Unknown error')}")

    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
