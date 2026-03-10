#!/usr/bin/env python3
"""
Ingest BFM eval reports into the RAG vector database.

Converts structured eval JSON output into protocol-aware chunks that teach
the RAG agent (both the Python agent and the TS analysis-generator) how to
reason from diagnostics → protocols → supplements.

Creates three types of chunks:
1. **Clinical reasoning chain** — full case study with deal breakers, reasoning, and outcomes
2. **Protocol decision chunks** — per-protocol "when you see X, apply Y because Z"
3. **Supplement phasing chunks** — per-layer supplement decisions with timing/dosing

All chunks are ingested as `document_category='case_study'` with `is_global=True`
so they appear in RAG search for all users/roles.

Usage:
    cd python-agent && uv run python scripts/ingest_eval_reports.py <path-to-eval-json>
    # Example:
    cd python-agent && uv run python scripts/ingest_eval_reports.py \
        ../eval/bfm-eval-mar2026/patient-DH-eval-output.json
"""

import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.embeddings.chunker import chunk_with_protocols, enrich_chunks_with_protocols
from app.embeddings.embedder import get_embeddings_batch
from app.services.supabase import get_supabase_client

SYSTEM_USER_ID = "dd78e6d8-09a2-4754-8834-870c36ed89ce"


def build_clinical_reasoning_chunk(report: dict) -> str:
    """Build a full case study reasoning chunk from the eval report."""
    patient = report["patient_name"]
    urgency = report["urgency"]

    lines = [
        f"# BFM Clinical Eval Case Study: {patient}",
        f"**Urgency: {urgency['score']}/5** — {urgency['rationale']}",
        f"**Critical Path:** {urgency['critical_path']}",
        f"**Timeline:** {urgency['timeline']}",
        "",
        "## Deal Breakers Identified",
    ]

    for db in report["deal_breakers"]:
        lines.append(f"- **{db['name']}**: {db['finding']} — Protocol: {db['protocol']}")
        lines.append(f"  Data citation: {db['patient_data_citation']}")

    lines.append("")
    lines.append("## Clinical Summary")
    lines.append(report["clinical_summary"])

    if report.get("confidence_notes"):
        lines.append("")
        lines.append(f"**Confidence Notes:** {report['confidence_notes']}")

    return "\n".join(lines)


def build_protocol_decision_chunks(report: dict) -> list[str]:
    """Build per-protocol decision chunks for RAG learning."""
    chunks = []
    patient = report["patient_name"]

    # Group by layer
    by_layer: dict[int, list[dict]] = {}
    for fp in report["frequency_phases"]:
        phase = fp["phase"]
        by_layer.setdefault(phase, []).append(fp)

    for layer_num in sorted(by_layer.keys()):
        protocols = by_layer[layer_num]
        layer_label = protocols[0].get("layer_label", f"Layer {layer_num}")
        layer_desc = protocols[0].get("layer_description", "")

        lines = [
            f"# Frequency Protocol Decisions — {layer_label} (Layer {layer_num})",
            f"**Case:** {patient}",
        ]
        if layer_desc:
            lines.append(f"**Layer meaning:** {layer_desc}")
        lines.append("")

        for fp in protocols:
            lines.append(f"### {fp['protocol_name']}")
            lines.append(f"**Diagnostic trigger:** {fp['trigger']}")
            lines.append(f"**Patient data citation:** {fp['patient_data_citation']}")
            if fp.get("sequencing_note"):
                lines.append(f"**Sequencing:** {fp['sequencing_note']}")
            lines.append("")

        chunks.append("\n".join(lines))

    return chunks


def build_supplement_phasing_chunks(report: dict) -> list[str]:
    """Build per-layer supplement decision chunks."""
    chunks = []
    patient = report["patient_name"]

    # Group by layer
    by_layer: dict[int, list[dict]] = {}
    for supp in report["supplementation"]:
        layer = supp.get("layer", 0)
        by_layer.setdefault(layer, []).append(supp)

    layer_names = {
        1: "Day 1 (In-Office Findings)",
        2: "Week 1-2 (Lab-Triggered)",
        3: "If Still Stuck (Advanced)",
        0: "Unassigned",
    }

    for layer_num in sorted(by_layer.keys()):
        supps = by_layer[layer_num]
        layer_name = layer_names.get(layer_num, f"Layer {layer_num}")

        lines = [
            f"# Supplement Phasing — {layer_name} (Layer {layer_num})",
            f"**Case:** {patient}",
            "",
        ]

        for s in supps:
            lines.append(f"### {s['name']} (priority={s.get('priority', 'N/A')})")
            lines.append(f"**Trigger:** {s['trigger']}")
            if s.get("dosage"):
                lines.append(f"**Dosage:** {s['dosage']}")
            if s.get("timing"):
                lines.append(f"**Timing:** {s['timing']}")
            lines.append(f"**Patient data citation:** {s['patient_data_citation']}")
            lines.append("")

        chunks.append("\n".join(lines))

    return chunks


def build_five_levers_chunk(report: dict) -> str:
    """Build five levers assessment chunk."""
    patient = report["patient_name"]
    lines = [
        f"# Five Levers Assessment — {patient}",
        "",
    ]

    for lever in report.get("five_levers", []):
        lines.append(f"### Lever {lever['lever_number']}: {lever['lever_name']}")
        lines.append(f"**Patient status:** {lever['patient_status']}")
        lines.append(f"**Recommendation:** {lever['recommendation']}")
        lines.append(f"**Data citation:** {lever['patient_data_citation']}")
        lines.append("")

    return "\n".join(lines)


def build_monitoring_chunk(report: dict) -> str:
    """Build monitoring plan chunk."""
    patient = report["patient_name"]
    lines = [
        f"# Monitoring Plan — {patient}",
        "",
    ]

    for item in report.get("monitoring", []):
        lines.append(f"- **{item['metric']}**: Baseline={item['baseline']}, "
                     f"Target={item['target']}, Reassess={item['reassessment_interval']}")

    return "\n".join(lines)


def build_patient_analogies_chunk(report: dict) -> str:
    """Build patient-facing analogy explanations chunk."""
    patient = report["patient_name"]
    lines = [
        f"# Patient Communication Analogies — {patient}",
        "",
    ]

    for analogy in report.get("patient_analogies", []):
        lines.append(f"### {analogy['finding']}")
        lines.append(f"**Analogy:** {analogy['analogy']}")
        lines.append(f"**What this means:** {analogy['what_this_means']}")
        lines.append(f"**Hopeful framing:** {analogy['hopeful_framing']}")
        lines.append("")

    return "\n".join(lines)


def report_to_markdown_sections(report: dict) -> list[tuple[str, str]]:
    """
    Convert eval report to (title, markdown_content) pairs for ingestion.

    Returns chunks that are semantically meaningful and protocol-tagged.
    """
    patient = report["patient_name"]
    sections = []

    # 1. Full clinical reasoning (the "case study" overview)
    sections.append((
        f"BFM Eval Case Study: {patient} — Clinical Reasoning",
        build_clinical_reasoning_chunk(report),
    ))

    # 2. Protocol decision chunks (per-layer)
    for i, chunk in enumerate(build_protocol_decision_chunks(report)):
        sections.append((
            f"BFM Eval: {patient} — Frequency Protocols (Part {i + 1})",
            chunk,
        ))

    # 3. Supplement phasing chunks (per-layer)
    for i, chunk in enumerate(build_supplement_phasing_chunks(report)):
        sections.append((
            f"BFM Eval: {patient} — Supplements (Part {i + 1})",
            chunk,
        ))

    # 4. Five Levers assessment
    if report.get("five_levers"):
        sections.append((
            f"BFM Eval: {patient} — Five Levers",
            build_five_levers_chunk(report),
        ))

    # 5. Monitoring plan
    if report.get("monitoring"):
        sections.append((
            f"BFM Eval: {patient} — Monitoring Plan",
            build_monitoring_chunk(report),
        ))

    # 6. Patient analogies (useful for member-facing responses)
    if report.get("patient_analogies"):
        sections.append((
            f"BFM Eval: {patient} — Patient Analogies",
            build_patient_analogies_chunk(report),
        ))

    return sections


def purge_existing_eval(patient_name: str) -> int:
    """Remove previously ingested eval documents for this patient."""
    client = get_supabase_client()

    existing = (
        client.table("documents")
        .select("id")
        .eq("document_category", "case_study")
        .like("title", f"BFM Eval%{patient_name}%")
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


async def ingest_eval_section(
    title: str,
    content: str,
    patient_name: str,
    section_index: int,
) -> dict:
    """Ingest one section of the eval report."""
    print(f"\n  [{section_index}] {title}")

    # Protocol-aware chunking
    chunks = chunk_with_protocols(
        content,
        max_chunk_size=500,
        include_surrounding_context=True,
    )
    chunks = enrich_chunks_with_protocols(chunks)
    protocol_chunks = sum(1 for c in chunks if c.has_protocol_context)
    print(f"      {len(chunks)} chunks ({protocol_chunks} with protocol context)")

    # Generate embeddings
    chunk_texts = [chunk.content for chunk in chunks]
    embeddings = await get_embeddings_batch(chunk_texts)

    # Store in database
    client = get_supabase_client()

    filename = f"eval-{patient_name.lower().replace(' ', '-')}-{section_index:02d}.md"

    doc_payload = {
        "user_id": SYSTEM_USER_ID,
        "filename": filename,
        "file_type": "diagnostic_report",
        "mime_type": "text/markdown",
        "title": title,
        "body_system": "multi_system",
        "document_category": "case_study",
        "care_category": "general",
        "role_scope": "both",
        "status": "processing",
        "is_global": True,
        "metadata": {
            "eval_report": True,
            "patient_name": patient_name,
            "source": "Claude Opus 4.6 Eval Agent",
            "section_index": section_index,
            "protocol_chunks": protocol_chunks,
        },
    }

    doc_result = client.table("documents").insert(doc_payload).execute()
    doc_id = doc_result.data[0]["id"]

    chunk_records = []
    for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        metadata = {
            **(chunk.metadata or {}),
            "eval_report": True,
            "patient_name": patient_name,
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

    BATCH_SIZE = 50
    for i in range(0, len(chunk_records), BATCH_SIZE):
        batch = chunk_records[i:i + BATCH_SIZE]
        client.table("document_chunks").insert(batch).execute()

    client.table("documents").update({
        "status": "indexed",
        "total_chunks": len(chunk_records),
    }).eq("id", doc_id).execute()

    return {
        "document_id": doc_id,
        "chunks": len(chunks),
        "protocol_chunks": protocol_chunks,
    }


async def ingest_eval_report(eval_json_path: str) -> None:
    """Main entry: load eval JSON, build sections, ingest into RAG."""
    path = Path(eval_json_path)
    if not path.exists():
        print(f"Error: File not found: {path}")
        return

    report = json.loads(path.read_text())
    patient_name = report["patient_name"]

    print("=" * 70)
    print(f"INGESTING EVAL REPORT: {patient_name}")
    print("=" * 70)

    # Purge previous versions (idempotent)
    removed = purge_existing_eval(patient_name)
    if removed:
        print(f"Removed {removed} previous eval document(s) for {patient_name}")

    # Build markdown sections
    sections = report_to_markdown_sections(report)
    print(f"\nBuilt {len(sections)} sections from eval report")

    # Ingest each section
    results = []
    for idx, (title, content) in enumerate(sections):
        result = await ingest_eval_section(title, content, patient_name, idx)
        results.append(result)

    # Summary
    total_chunks = sum(r["chunks"] for r in results)
    total_protocol_chunks = sum(r["protocol_chunks"] for r in results)

    print("\n" + "=" * 70)
    print("INGESTION COMPLETE")
    print("=" * 70)
    print(f"Patient: {patient_name}")
    print(f"Documents created: {len(results)}")
    print(f"Total chunks: {total_chunks}")
    print(f"Protocol-tagged chunks: {total_protocol_chunks}")
    print(f"Document IDs:")
    for r in results:
        print(f"  - {r['document_id']} ({r['chunks']} chunks)")
    print("=" * 70)


# Also support ingesting the answer key alongside the eval
async def ingest_answer_key(answer_key_path: str) -> None:
    """Ingest an answer key as a reference for expected outcomes."""
    path = Path(answer_key_path)
    if not path.exists():
        print(f"Error: File not found: {path}")
        return

    data = json.loads(path.read_text())
    meta = data.get("_meta", {})
    patient = meta.get("patient", "Unknown")
    initials = meta.get("initials", "")

    lines = [
        f"# BFM Eval Answer Key: {patient} ({initials})",
        f"**Age/Sex:** {meta.get('age_sex', 'N/A')}",
        f"**Reviewed by:** {meta.get('reviewed_by', 'N/A')}",
        f"**Overall Grade:** {meta.get('overall_grade', 'N/A')}",
        f"**Review Notes:** {meta.get('review_notes', '')}",
        "",
        "## Expected Deal Breakers",
    ]
    for db in data.get("expected_deal_breakers", []):
        lines.append(f"- {db}")

    lines.append("")
    lines.append("## Expected Protocols")
    for p in data.get("expected_protocols", []):
        lines.append(f"- {p}")

    lines.append("")
    lines.append("## Expected Day 1 Supplements")
    for s in data.get("expected_supplements_day1", []):
        lines.append(f"- {s}")

    lines.append("")
    lines.append("## Expected Week 1-2 Supplements")
    for s in data.get("expected_supplements_week1_2", []):
        lines.append(f"- {s}")

    lines.append("")
    lines.append("## All Expected Supplements")
    for s in data.get("expected_supplements", []):
        lines.append(f"- {s}")

    if data.get("corrections"):
        lines.append("")
        lines.append("## Corrections / Clinical Notes")
        for key, val in data["corrections"].items():
            lines.append(f"- **{key}:** {val}")

    if data.get("grading"):
        lines.append("")
        lines.append("## Grading")
        for key, val in data["grading"].items():
            lines.append(f"- **{key}:** {val}/5")

    content = "\n".join(lines)

    # Ingest as a single section
    result = await ingest_eval_section(
        title=f"BFM Eval Answer Key: {patient} ({initials})",
        content=content,
        patient_name=patient,
        section_index=99,
    )

    print(f"\nAnswer key ingested: {result['chunks']} chunks, doc_id={result['document_id']}")


async def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/ingest_eval_reports.py <eval-output.json> [answer-key.json]")
        print("  eval-output.json: The JSON output from the eval agent")
        print("  answer-key.json:  Optional answer key for reference")
        sys.exit(1)

    eval_path = sys.argv[1]
    await ingest_eval_report(eval_path)

    # If answer key is provided, ingest that too
    if len(sys.argv) >= 3:
        answer_key_path = sys.argv[2]
        await ingest_answer_key(answer_key_path)


if __name__ == "__main__":
    asyncio.run(main())
