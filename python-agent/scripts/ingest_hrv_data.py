#!/usr/bin/env python3
"""
Script to ingest NervExpress HRV patient reports from agent-assets/hrv-data directory.

These reports contain:
- Physical Fitness Assessment (ortho-test results)
- ANS functional state assessment
- HRV analysis with conclusions
- Interpretation summary

Filename pattern: "{initials} {test_type} {date}.pdf"
Example: "IO Ortho 1-8-26.pdf" -> patient "IO", test "ortho", date "1-8-26"
"""

import asyncio
import re
import sys
from pathlib import Path
from datetime import datetime

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.embeddings.preprocessing import process_pdf_with_vision_fallback
from app.embeddings.chunker import chunk_by_paragraphs
from app.embeddings.embedder import get_embeddings_batch
from app.services.supabase import get_supabase_client

# System user ID for global documents
SYSTEM_USER_ID = "dd78e6d8-09a2-4754-8834-870c36ed89ce"


def parse_hrv_filename(filename: str) -> dict:
    """
    Parse HRV report filename to extract metadata.

    Filename pattern: "{initials} {test_type} {date}.pdf"
    Examples:
    - "IO Ortho 1-8-26.pdf" -> patient "IO", test "ortho", date "1-8-26"
    - "SVP Valsalva 12-29-25.pdf" -> patient "SVP", test "valsalva", date "12-29-25"

    Returns:
        Dictionary with patient_initials, test_type, test_date
    """
    # Remove .pdf extension
    name = filename.replace(".pdf", "").strip()

    # Split by spaces
    parts = name.split()

    if len(parts) < 3:
        return {
            "patient_initials": "unknown",
            "test_type": "unknown",
            "test_date": "unknown",
        }

    # Last part is date, second-to-last is test type, rest is initials
    test_date = parts[-1]
    test_type = parts[-2].lower()
    patient_initials = " ".join(parts[:-2])

    return {
        "patient_initials": patient_initials,
        "test_type": test_type,  # "ortho" or "valsalva"
        "test_date": test_date,
    }


async def ingest_hrv_report(filepath: Path) -> dict:
    """Ingest a single HRV PDF report."""
    print(f"\nProcessing: {filepath.name}")

    # Parse filename for metadata
    file_meta = parse_hrv_filename(filepath.name)
    print(f"  Patient: {file_meta['patient_initials']}, Test: {file_meta['test_type']}, Date: {file_meta['test_date']}")

    # Extract text from PDF (will use vision fallback if needed)
    result = await process_pdf_with_vision_fallback(filepath)

    text_content = result["text_content"]
    method = result.get("method", "text")
    tokens_used = result.get("tokens_used", 0)
    page_count = result.get("page_count", 0)

    print(f"  Extracted {page_count} pages using {method} method")

    # Create document title
    test_type_display = file_meta["test_type"].title()
    title = f"HRV {test_type_display} Report - Patient {file_meta['patient_initials']} ({file_meta['test_date']})"

    # Add header with context
    header = f"""# {title}

**Patient ID:** {file_meta['patient_initials']}
**Test Type:** NervExpress {test_type_display} Test
**Test Date:** {file_meta['test_date']}
**Document Type:** HRV Case Study
**Body System:** Nervous System (Autonomic)

---

"""
    full_content = header + text_content

    # Chunk the content
    chunks = chunk_by_paragraphs(full_content)
    print(f"  Created {len(chunks)} chunks")

    # Generate embeddings
    print(f"  Generating embeddings...")
    chunk_texts = [chunk.content for chunk in chunks]
    embeddings = await get_embeddings_batch(chunk_texts)
    print(f"  Generated {len(embeddings)} embeddings")

    # Store in database
    client = get_supabase_client()

    # Create document record with HRV-specific metadata
    doc_result = client.table("documents").insert({
        "user_id": SYSTEM_USER_ID,
        "filename": filepath.name,
        "file_type": "diagnostic_report",
        "mime_type": "application/pdf",
        "title": title,
        "body_system": "nervous",
        "document_category": "case_study",
        "care_category": "general",
        "status": "processing",
        "is_global": True,
        "metadata": {
            "test_type": "hrv",
            "hrv_test_type": file_meta["test_type"],
            "patient_initials": file_meta["patient_initials"],
            "test_date": file_meta["test_date"],
            "page_count": page_count,
            "extraction_method": method,
            "source": "nervexpress",
        },
    }).execute()

    doc_id = doc_result.data[0]["id"]
    print(f"  Created document: {doc_id}")

    # Store chunks with embeddings
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
                "hrv_test_type": file_meta["test_type"],
                "patient_initials": file_meta["patient_initials"],
            },
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

    print(f"  Indexed {len(chunks)} chunks for {filepath.name}")

    return {
        "success": True,
        "document_id": doc_id,
        "chunks": len(chunks),
        "pages": page_count,
        "tokens_used": tokens_used,
        "method": method,
        "test_type": file_meta["test_type"],
    }


async def main():
    """Main entry point."""
    hrv_data_dir = Path(__file__).parent.parent.parent / "agent-assets" / "hrv-data"

    if not hrv_data_dir.exists():
        print(f"HRV data directory not found: {hrv_data_dir}")
        return

    pdf_files = list(hrv_data_dir.glob("*.pdf"))

    if not pdf_files:
        print("No PDF files found in hrv-data directory")
        return

    print(f"Found {len(pdf_files)} HRV PDF files to ingest")
    print("=" * 60)

    # Sort files for consistent processing order
    pdf_files = sorted(pdf_files)

    results = []
    for pdf_file in pdf_files:
        try:
            result = await ingest_hrv_report(pdf_file)
            results.append({"file": pdf_file.name, **result})
        except Exception as e:
            print(f"  Error processing {pdf_file.name}: {e}")
            results.append({"file": pdf_file.name, "success": False, "error": str(e)})

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
        total_pages = sum(r.get("pages", 0) for r in successful)
        ortho_count = sum(1 for r in successful if r.get("test_type") == "ortho")
        valsalva_count = sum(1 for r in successful if r.get("test_type") == "valsalva")

        print(f"\nTotal chunks created: {total_chunks}")
        print(f"Total pages processed: {total_pages}")
        print(f"Ortho tests: {ortho_count}")
        print(f"Valsalva tests: {valsalva_count}")

    if failed:
        print("\nFailed files:")
        for r in failed:
            print(f"  - {r['file']}: {r.get('error', 'Unknown error')}")


if __name__ == "__main__":
    asyncio.run(main())
