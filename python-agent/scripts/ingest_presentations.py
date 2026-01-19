#!/usr/bin/env python3
"""
Script to ingest PPTX presentations from agent-assets/presentations directory.
"""

import asyncio
import sys
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.embeddings.preprocessing.pptx_processor import extract_pptx_text
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


async def ingest_presentation(filepath: Path) -> dict:
    """Ingest a single PPTX presentation."""
    print(f"\nProcessing: {filepath.name}")

    # Extract text
    result = extract_pptx_text(filepath)

    if not result["has_content"]:
        print(f"  ⚠️  No content found in {filepath.name}")
        return {"success": False, "error": "No content found"}

    print(f"  📊 Extracted {result['slide_count']} slides, has_notes={result['has_notes']}")

    # Detect category
    category = detect_category(filepath.name)
    body_system = BODY_SYSTEM_MAP.get(category, "multi_system")
    print(f"  📁 Category: {category}, Body System: {body_system}")

    # Generate metadata
    doc_metadata = infer_metadata_from_filename(filepath)

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

    # Create document record
    doc_result = client.table("documents").insert({
        "user_id": SYSTEM_USER_ID,
        "filename": filepath.name,
        "file_type": "ip_material",
        "mime_type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "title": doc_metadata.title,
        "body_system": body_system,
        "document_category": "seminar_transcript",
        "care_category": category,
        "status": "processing",
        "is_global": True,
        "metadata": {
            "slide_count": result["slide_count"],
            "has_notes": result["has_notes"],
        },
    }).execute()

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
