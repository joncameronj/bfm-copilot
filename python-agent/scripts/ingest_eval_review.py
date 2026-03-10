#!/usr/bin/env python3
"""
Ingest Dr. Rob's graded evaluation review into the vector database.

Reads the review markdown from agent-assets/eval-reviews/ and splits it into
patient-level chunks plus correction-specific chunks for high-value RAG retrieval.

Idempotent — purges previous versions before re-inserting.

Usage:
    cd python-agent && uv run python -m scripts.ingest_eval_review
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

REVIEW_FILENAME = "BFM-Patient-Eval-Report-Mar2026-REVIEW.md"
REVIEW_PATH = (
    Path(__file__).parent.parent.parent
    / "agent-assets"
    / "eval-reviews"
    / REVIEW_FILENAME
)


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


def split_into_sections(content: str) -> list[dict]:
    """
    Split the review document into logical sections for chunking.

    Returns a list of dicts with keys: title, content, section_type.
    section_type is one of: executive_summary, patient_eval, patient_corrections,
    cross_patient, overall_assessment.
    """
    lines = content.split("\n")
    sections: list[dict] = []

    # Find major section boundaries (# headings)
    heading_indices: list[tuple[int, str]] = []
    for i, line in enumerate(lines):
        if line.startswith("# **"):
            heading_indices.append((i, line.strip()))

    # Extract executive summary (from start to first patient)
    first_patient_idx = None
    for idx, heading in heading_indices:
        if "PATIENT" in heading:
            first_patient_idx = idx
            break

    if first_patient_idx:
        exec_content = "\n".join(lines[:first_patient_idx]).strip()
        if exec_content:
            sections.append({
                "title": "Executive Summary & How to Use",
                "content": exec_content,
                "section_type": "executive_summary",
            })

    # Extract patient sections
    patient_headings = [
        (idx, heading)
        for idx, heading in heading_indices
        if "PATIENT" in heading
    ]

    for i, (start_idx, heading) in enumerate(patient_headings):
        # Find end of this patient section
        end_idx = (
            patient_headings[i + 1][0]
            if i + 1 < len(patient_headings)
            else None
        )

        # Find end — next top-level heading that isn't a patient
        if end_idx is None:
            for idx, h in heading_indices:
                if idx > start_idx and "PATIENT" not in h:
                    end_idx = idx
                    break

        patient_lines = lines[start_idx:end_idx] if end_idx else lines[start_idx:]
        patient_content = "\n".join(patient_lines).strip()

        # Extract patient ID from heading (e.g., "PATIENT DH")
        patient_match = re.search(r"PATIENT\s+(\w+)", heading)
        patient_id = patient_match.group(1) if patient_match else "Unknown"

        # Add full patient section as one chunk
        sections.append({
            "title": f"Patient {patient_id} — Full Evaluation & Grading",
            "content": patient_content,
            "section_type": "patient_eval",
            "patient_id": patient_id,
        })

        # Extract Client Notes blocks as separate high-value correction chunks
        corrections: list[str] = []
        for line in patient_lines:
            if "Client Notes" in line:
                # Extract the note content from the table cell
                note = line.strip().strip("|").strip()
                # Remove the "Client Notes on X:" prefix for cleaner content
                corrections.append(note)

        if corrections:
            correction_content = (
                f"# Dr. Rob's Corrections — Patient {patient_id}\n\n"
                + "\n\n".join(corrections)
            )
            sections.append({
                "title": f"Patient {patient_id} — Dr. Rob's Corrections",
                "content": correction_content,
                "section_type": "patient_corrections",
                "patient_id": patient_id,
            })

    # Extract Cross-Patient Notes
    cross_start = None
    overall_start = None
    for idx, heading in heading_indices:
        if "Cross-Patient" in heading:
            cross_start = idx
        if "Overall Assessment" in heading:
            overall_start = idx

    if cross_start:
        cross_end = overall_start or len(lines)
        cross_content = "\n".join(lines[cross_start:cross_end]).strip()
        sections.append({
            "title": "Cross-Patient Notes & Shared Protocols",
            "content": cross_content,
            "section_type": "cross_patient",
        })

    if overall_start:
        overall_content = "\n".join(lines[overall_start:]).strip()
        sections.append({
            "title": "Overall Assessment & Model Training Notes",
            "content": overall_content,
            "section_type": "overall_assessment",
        })

    return sections


async def ingest_review() -> dict:
    """Ingest the review document into the vector database."""
    if not REVIEW_PATH.exists():
        print(f"Error: Review file not found: {REVIEW_PATH}")
        return {"success": False, "error": "File not found"}

    print(f"Reading: {REVIEW_PATH}")
    content = REVIEW_PATH.read_text(encoding="utf-8")

    if not content.strip():
        print("Error: Empty file")
        return {"success": False, "error": "Empty file"}

    # Split into logical sections
    sections = split_into_sections(content)
    print(f"Split into {len(sections)} logical sections")

    # Chunk each section with protocol awareness
    all_chunks: list[tuple[str, str, dict]] = []  # (section_title, chunk_content, metadata)

    for section in sections:
        chunks = chunk_with_protocols(
            section["content"],
            max_chunk_size=800,  # Larger chunks for review context
            include_surrounding_context=True,
        )
        chunks = enrich_chunks_with_protocols(chunks)

        for chunk in chunks:
            chunk_meta = {
                "section_type": section["section_type"],
                "section_title": section["title"],
                **({"patient_id": section["patient_id"]} if "patient_id" in section else {}),
            }
            all_chunks.append((section["title"], chunk.content, {
                **chunk_meta,
                "protocols": chunk.protocols or [],
                "has_protocol_context": chunk.has_protocol_context,
                "token_count": chunk.token_count,
            }))

    print(f"Created {len(all_chunks)} total chunks")
    correction_chunks = sum(
        1 for _, _, m in all_chunks if m["section_type"] == "patient_corrections"
    )
    print(f"  Correction chunks (highest value): {correction_chunks}")

    # Generate embeddings
    print("Generating embeddings...")
    chunk_texts = [text for _, text, _ in all_chunks]
    embeddings = await get_embeddings_batch(chunk_texts)
    print(f"Generated {len(embeddings)} embeddings")

    # Store in database
    client = get_supabase_client()

    # Purge previous versions
    removed = purge_existing_versions(REVIEW_FILENAME)
    if removed:
        print(f"Removed {removed} previous version(s)")

    # Create document record
    doc_payload = {
        "user_id": SYSTEM_USER_ID,
        "filename": REVIEW_FILENAME,
        "file_type": "medical_protocol",
        "mime_type": "text/markdown",
        "title": "BFM Patient Eval Report — Dr. Rob's Review & Corrections (Mar 2026)",
        "body_system": "multi_system",
        "document_category": "master_reference",
        "care_category": "general",
        "role_scope": "clinical",
        "status": "processing",
        "is_global": True,
        "metadata": {
            "master_reference": True,
            "report_type": "practitioner_review",
            "contains_corrections": True,
            "source": "Dr. Rob clinical review of 5 patient evals",
            "patients": ["DH", "GD", "GG", "JW", "TH"],
            "review_date": "2026-03",
        },
    }

    doc_result = client.table("documents").insert(doc_payload).execute()
    doc_id = doc_result.data[0]["id"]
    print(f"Created document: {doc_id}")

    # Store chunks
    chunk_records = []
    for i, (_, text, meta) in enumerate(zip(range(len(all_chunks)), chunk_texts, [m for _, _, m in all_chunks])):
        chunk_records.append({
            "document_id": doc_id,
            "chunk_index": i,
            "content": all_chunks[i][1],
            "embedding": embeddings[i],
            "token_count": meta.get("token_count", 0),
            "metadata": {
                **meta,
                "master_reference": True,
                "report_type": "practitioner_review",
                "contains_corrections": meta["section_type"] == "patient_corrections",
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

    print(f"Indexed {len(chunk_records)} chunks for {REVIEW_FILENAME}")

    return {
        "success": True,
        "document_id": doc_id,
        "total_chunks": len(chunk_records),
        "correction_chunks": correction_chunks,
    }


async def main():
    """Main entry point."""
    print("=" * 60)
    print("INGESTING DR. ROB'S EVAL REVIEW DOCUMENT")
    print("=" * 60)

    result = await ingest_review()

    print("\n" + "=" * 60)
    print("INGESTION SUMMARY")
    print("=" * 60)

    if result.get("success"):
        print(f"Document ID: {result['document_id']}")
        print(f"Total chunks: {result['total_chunks']}")
        print(f"Correction chunks: {result['correction_chunks']}")
        print("Status: SUCCESS")
    else:
        print(f"Status: FAILED — {result.get('error', 'Unknown error')}")

    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
