#!/usr/bin/env python3
"""
Script to ingest PPTX presentations from agent-assets/presentations directory.
"""

import asyncio
import subprocess
import sys
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.embeddings.preprocessing.pptx_processor import extract_pptx_text, extract_pptx_with_vision
from app.embeddings.preprocessing.frontmatter_generator import infer_metadata_from_filename
from app.embeddings.chunker import chunk_by_paragraphs
from app.embeddings.embedder import get_embeddings_batch
from app.services.supabase import get_supabase_client

# System user ID for global documents
SYSTEM_USER_ID = "dd78e6d8-09a2-4754-8834-870c36ed89ce"

# Map presentation names to categories
CATEGORY_MAP = {
    "diabetes": "diabetes",
    "hormones": "hormones",
    "neuro": "neurological",
    "thyroid": "thyroid",
}

BODY_SYSTEM_MAP = {
    "diabetes": "endocrine",
    "hormones": "endocrine",
    "neurological": "nervous",
    "thyroid": "endocrine",
}


def detect_category(filename: str) -> str:
    """Detect care category from filename."""
    lower_name = filename.lower()
    for key, category in CATEGORY_MAP.items():
        if key in lower_name:
            return category
    return "general"


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


def purge_existing_document_versions(filename: str) -> int:
    """
    Remove previously ingested versions of the same presentation.

    This keeps ingestion idempotent and prevents duplicate Sunday chunks from
    drifting out of sync with updated slide decks.
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


async def ingest_presentation(filepath: Path) -> dict:
    """Ingest a single PPTX presentation."""
    print(f"\nProcessing: {filepath.name}")

    # Extract content via vision-enhanced pipeline (LibreOffice + vision API)
    # Falls back to text-only if LibreOffice is not available
    try:
        print(f"  Attempting vision-enhanced extraction...")
        result = extract_pptx_with_vision(filepath)
        extraction_mode = "vision"
    except (FileNotFoundError, subprocess.CalledProcessError) as e:
        print(f"  Vision extraction unavailable ({e}), falling back to text-only")
        result = extract_pptx_text(filepath)
        extraction_mode = "text-only"

    if not result["has_content"]:
        print(f"  No content found in {filepath.name}")
        return {"success": False, "error": "No content found"}

    print(f"  Extracted {result['slide_count']} slides ({extraction_mode}), has_notes={result['has_notes']}")

    # Generate metadata first (needed for seminar day detection)
    doc_metadata = infer_metadata_from_filename(filepath)

    # Detect category and seminar day
    category = detect_category(filepath.name)
    body_system = BODY_SYSTEM_MAP.get(category, "multi_system")
    seminar_day = detect_seminar_day(filepath.name, doc_metadata.title if doc_metadata else "")
    print(f"  📁 Category: {category}, Body System: {body_system}, Seminar Day: {seminar_day or 'none'}")

    # Add header to content
    header = f"""# {doc_metadata.title}

**Care Category:** {category}
**Type:** Seminar Slides
**Slides:** {result['slide_count']}
**Source:** {filepath.name}

---

"""
    full_content = header + result["text_content"]

    # Chunk the content
    chunks = chunk_by_paragraphs(full_content)
    print(f"  📝 Created {len(chunks)} chunks")

    # Generate embeddings
    print(f"  🔄 Generating embeddings...")
    chunk_texts = [chunk.content for chunk in chunks]
    embeddings = await get_embeddings_batch(chunk_texts)
    print(f"  ✅ Generated {len(embeddings)} embeddings")

    # Store in database
    client = get_supabase_client()

    # Replace previous ingestions of this same presentation file.
    removed_count = purge_existing_document_versions(filepath.name)
    if removed_count:
        print(f"  ♻️  Removed {removed_count} previous version(s)")

    # Create document record
    doc_payload = {
        "user_id": SYSTEM_USER_ID,
        "filename": filepath.name,
        "file_type": "ip_material",
        "mime_type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "title": doc_metadata.title,
        "body_system": body_system,
        "document_category": "seminar_transcript",
        "care_category": category,
        "role_scope": "both",  # Seminar content is educational AND clinical
        "status": "processing",
        "is_global": True,
        "metadata": {
            "slide_count": result["slide_count"],
            "has_notes": result["has_notes"],
            "extraction_mode": extraction_mode,
        },
    }
    # Add seminar_day if detected (enables Sunday-first RAG search)
    if seminar_day:
        doc_payload["seminar_day"] = seminar_day

    doc_result = client.table("documents").insert(doc_payload).execute()

    doc_id = doc_result.data[0]["id"]
    print(f"  📄 Created document: {doc_id}")

    # Store chunks with embeddings
    chunk_records = []
    for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        chunk_records.append({
            "document_id": doc_id,
            "chunk_index": i,
            "content": chunk.content,
            "embedding": embedding,
            "token_count": chunk.token_count,
            "metadata": chunk.metadata,
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

    print(f"  ✅ Indexed {len(chunks)} chunks for {filepath.name}")

    return {
        "success": True,
        "document_id": doc_id,
        "chunks": len(chunks),
        "slides": result["slide_count"],
    }


async def main():
    """Main entry point."""
    presentations_dir = Path(__file__).parent.parent.parent / "agent-assets" / "presentations"

    if not presentations_dir.exists():
        print(f"❌ Presentations directory not found: {presentations_dir}")
        return

    pptx_files = list(presentations_dir.glob("*.pptx"))

    if not pptx_files:
        print("❌ No PPTX files found in presentations directory")
        return

    print(f"Found {len(pptx_files)} PPTX files to ingest")
    print("=" * 60)

    results = []
    for pptx_file in sorted(pptx_files):
        try:
            result = await ingest_presentation(pptx_file)
            results.append({"file": pptx_file.name, **result})
        except Exception as e:
            print(f"  ❌ Error processing {pptx_file.name}: {e}")
            results.append({"file": pptx_file.name, "success": False, "error": str(e)})

    # Summary
    print("\n" + "=" * 60)
    print("INGESTION SUMMARY")
    print("=" * 60)

    successful = [r for r in results if r.get("success")]
    failed = [r for r in results if not r.get("success")]

    print(f"Total files: {len(results)}")
    print(f"Successful: {len(successful)}")
    print(f"Failed: {len(failed)}")

    if successful:
        total_chunks = sum(r.get("chunks", 0) for r in successful)
        total_slides = sum(r.get("slides", 0) for r in successful)
        print(f"Total chunks: {total_chunks}")
        print(f"Total slides: {total_slides}")

    if failed:
        print("\nFailed files:")
        for r in failed:
            print(f"  - {r['file']}: {r.get('error', 'Unknown error')}")


if __name__ == "__main__":
    asyncio.run(main())
