#!/usr/bin/env python3
"""
Ingest a correction/evaluation PDF into the vector database.

This is designed for ad hoc Copilot eval review PDFs that contain a small number
of page images with typed corrections. It ingests:
1. Per-page extracted text from the PDF
2. Optional per-page vision analysis of the rendered page image

Usage:
    cd python-agent
    ./.venv/bin/python scripts/ingest_eval_corrections_pdf.py \
        "$HOME/Downloads/Copilot Eval 3.11.26.pdf" \
        --title "Copilot Eval Corrections — 2026-03-11"
"""

from __future__ import annotations

import argparse
import asyncio
import subprocess
import sys
import tempfile
from pathlib import Path

from PyPDF2 import PdfReader

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.embeddings.chunker import chunk_with_protocols, enrich_chunks_with_protocols
from app.embeddings.embedder import get_embeddings_batch
from app.embeddings.preprocessing.image_processor import process_image_with_vision
from app.services.supabase import get_supabase_client

SYSTEM_USER_ID = "dd78e6d8-09a2-4754-8834-870c36ed89ce"


def purge_existing_versions(filename: str) -> int:
    """Remove previously ingested versions of the same source PDF."""
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


def extract_page_text(pdf_path: Path) -> list[str]:
    """Extract raw text page-by-page from a PDF."""
    reader = PdfReader(str(pdf_path))
    page_texts: list[str] = []
    for page in reader.pages:
        page_texts.append((page.extract_text() or "").strip())
    return page_texts


def render_pdf_pages(pdf_path: Path, output_dir: Path) -> list[Path]:
    """Render each PDF page to PNG using pdftoppm."""
    prefix = output_dir / "page"
    subprocess.run(
        ["pdftoppm", "-png", str(pdf_path), str(prefix)],
        check=True,
        capture_output=True,
        text=True,
    )
    return sorted(output_dir.glob("page-*.png"))


async def build_sections(
    pdf_path: Path,
    include_page_vision: bool,
) -> list[dict]:
    """Build per-page sections with text and optional vision analysis."""
    page_texts = extract_page_text(pdf_path)
    sections: list[dict] = []

    with tempfile.TemporaryDirectory(prefix="copilot-eval-pages-") as tmpdir:
        page_images = render_pdf_pages(pdf_path, Path(tmpdir))

        for page_index, page_image in enumerate(page_images, start=1):
            page_text = page_texts[page_index - 1] if page_index - 1 < len(page_texts) else ""

            vision_text = ""
            vision_error = None
            if include_page_vision:
                try:
                    vision = await process_image_with_vision(
                        page_image,
                        image_type="general",
                        additional_context=(
                            "This is a practitioner correction/evaluation PDF page. "
                            "Extract correction notes, patient identifiers, protocol mentions, "
                            "supplement mentions, and any clinically relevant screenshots."
                        ),
                    )
                    vision_text = vision.get("extracted_text", "").strip()
                except Exception as exc:
                    vision_error = str(exc)

            content_parts = [
                f"# Copilot Eval Correction — Page {page_index}",
                f"**Source PDF:** {pdf_path.name}",
                "",
            ]

            if page_text:
                content_parts.extend([
                    "## Extracted Page Text",
                    page_text,
                    "",
                ])

            if vision_text:
                content_parts.extend([
                    "## Rendered Page Analysis",
                    vision_text,
                    "",
                ])

            if vision_error:
                content_parts.extend([
                    "## Rendered Page Analysis",
                    f"Vision extraction unavailable for this page: {vision_error}",
                    "",
                ])

            sections.append({
                "title": f"{pdf_path.stem} — Page {page_index}",
                "content": "\n".join(content_parts).strip(),
                "page_number": page_index,
                "has_page_text": bool(page_text),
                "has_page_vision": bool(vision_text),
                "vision_error": vision_error,
            })

    return sections


async def ingest_pdf(
    pdf_path: Path,
    title: str | None,
    include_page_vision: bool,
) -> dict:
    """Ingest the correction PDF into Supabase with embeddings."""
    if not pdf_path.exists():
        return {"success": False, "error": f"File not found: {pdf_path}"}

    print(f"Reading: {pdf_path}")
    sections = await build_sections(pdf_path, include_page_vision=include_page_vision)
    if not sections:
        return {"success": False, "error": "No sections were extracted from the PDF"}

    print(f"Built {len(sections)} page sections")

    all_chunks: list[tuple[str, str, dict]] = []
    for section in sections:
        chunks = chunk_with_protocols(
            section["content"],
            max_chunk_size=800,
            include_surrounding_context=True,
        )
        chunks = enrich_chunks_with_protocols(chunks)

        for chunk in chunks:
            all_chunks.append((
                section["title"],
                chunk.content,
                {
                    "page_number": section["page_number"],
                    "has_page_text": section["has_page_text"],
                    "has_page_vision": section["has_page_vision"],
                    "vision_error": section["vision_error"],
                    "protocols": chunk.protocols or [],
                    "has_protocol_context": chunk.has_protocol_context,
                    "token_count": chunk.token_count,
                    "report_type": "copilot_eval_correction",
                },
            ))

    print(f"Created {len(all_chunks)} total chunks")
    print("Generating embeddings...")
    chunk_texts = [text for _, text, _ in all_chunks]
    embeddings = await get_embeddings_batch(chunk_texts)
    print(f"Generated {len(embeddings)} embeddings")

    client = get_supabase_client()
    removed = purge_existing_versions(pdf_path.name)
    if removed:
        print(f"Removed {removed} previous version(s)")

    doc_payload = {
        "user_id": SYSTEM_USER_ID,
        "filename": pdf_path.name,
        "file_type": "medical_protocol",
        "mime_type": "application/pdf",
        "title": title or pdf_path.stem,
        "body_system": "multi_system",
        "document_category": "master_reference",
        "care_category": "general",
        "role_scope": "clinical",
        "status": "processing",
        "is_global": True,
        "metadata": {
            "master_reference": True,
            "report_type": "copilot_eval_correction",
            "source_pdf_path": str(pdf_path),
            "page_count": len(sections),
            "includes_page_vision": include_page_vision,
        },
    }

    doc_result = client.table("documents").insert(doc_payload).execute()
    doc_id = doc_result.data[0]["id"]
    print(f"Created document: {doc_id}")

    chunk_records = []
    for i, (_, text, meta) in enumerate(all_chunks):
        chunk_records.append({
            "document_id": doc_id,
            "chunk_index": i,
            "content": text,
            "embedding": embeddings[i],
            "token_count": meta.get("token_count", 0),
            "metadata": meta,
        })

    batch_size = 50
    for i in range(0, len(chunk_records), batch_size):
        client.table("document_chunks").insert(chunk_records[i : i + batch_size]).execute()

    client.table("documents").update({
        "status": "indexed",
        "total_chunks": len(chunk_records),
    }).eq("id", doc_id).execute()

    print(f"Indexed {len(chunk_records)} chunks for {pdf_path.name}")
    return {
        "success": True,
        "document_id": doc_id,
        "total_chunks": len(chunk_records),
        "page_count": len(sections),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Ingest a Copilot eval correction PDF into the vector database",
    )
    parser.add_argument("pdf_path", help="Path to the source PDF")
    parser.add_argument(
        "--title",
        help="Optional document title override",
    )
    parser.add_argument(
        "--skip-page-vision",
        action="store_true",
        help="Skip rendered page vision analysis and ingest PDF text only",
    )
    return parser.parse_args()


async def main() -> None:
    args = parse_args()
    pdf_path = Path(args.pdf_path).expanduser().resolve()

    print("=" * 60)
    print("INGESTING COPILOT EVAL CORRECTION PDF")
    print("=" * 60)

    result = await ingest_pdf(
        pdf_path=pdf_path,
        title=args.title,
        include_page_vision=not args.skip_page_vision,
    )

    print("\n" + "=" * 60)
    print("INGESTION SUMMARY")
    print("=" * 60)
    if result.get("success"):
        print(f"Document ID: {result['document_id']}")
        print(f"Total chunks: {result['total_chunks']}")
        print(f"Page count: {result['page_count']}")
        print("Status: SUCCESS")
    else:
        print(f"Status: FAILED — {result.get('error', 'Unknown error')}")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
