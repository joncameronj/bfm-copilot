"""
PPTX Processor - Extract text from PowerPoint presentations.

Handles PPTX files by extracting:
- Slide text (shapes, text frames)
- Speaker notes
- Table content
- Grouped shapes
"""

from pathlib import Path
from typing import Optional

from pptx import Presentation
from pptx.util import Inches


def extract_pptx_text(pptx_path: Path) -> dict:
    """
    Extract text content from a PPTX file.

    Args:
        pptx_path: Path to the PPTX file

    Returns:
        Dictionary with:
        - text_content: Extracted text as markdown
        - slide_count: Number of slides
        - has_notes: Whether speaker notes were found
        - has_content: Whether meaningful content was found
    """
    prs = Presentation(str(pptx_path))

    content_parts = []
    slide_count = 0
    has_notes = False

    for slide_num, slide in enumerate(prs.slides, start=1):
        slide_count += 1
        slide_content = []

        # Add slide header
        slide_content.append(f"## Slide {slide_num}")

        # Extract text from all shapes
        for shape in slide.shapes:
            shape_text = _extract_shape_text(shape)
            if shape_text:
                slide_content.append(shape_text)

        # Extract speaker notes
        notes_text = _extract_notes(slide)
        if notes_text:
            has_notes = True
            slide_content.append(f"\n**Speaker Notes:**\n{notes_text}")

        # Only add slide if it has content beyond the header
        if len(slide_content) > 1:
            content_parts.append("\n\n".join(slide_content))

    full_text = "\n\n---\n\n".join(content_parts)

    return {
        "text_content": full_text,
        "slide_count": slide_count,
        "has_notes": has_notes,
        "has_content": len(full_text.strip()) > 50,
    }


def _extract_shape_text(shape) -> Optional[str]:
    """Extract text from a shape, handling various shape types."""
    # Handle grouped shapes recursively
    if shape.shape_type == 6:  # MSO_SHAPE_TYPE.GROUP
        group_texts = []
        for child_shape in shape.shapes:
            child_text = _extract_shape_text(child_shape)
            if child_text:
                group_texts.append(child_text)
        return "\n".join(group_texts) if group_texts else None

    # Handle tables
    if shape.has_table:
        return _table_to_markdown(shape.table)

    # Handle text frames
    if shape.has_text_frame:
        return _extract_text_frame(shape.text_frame)

    return None


def _extract_text_frame(text_frame) -> Optional[str]:
    """Extract text from a text frame, preserving paragraph structure."""
    paragraphs = []

    for para in text_frame.paragraphs:
        text = para.text.strip()
        if text:
            # Check indentation level for list items
            level = para.level if para.level else 0
            if level > 0:
                indent = "  " * level
                text = f"{indent}- {text}"
            paragraphs.append(text)

    return "\n".join(paragraphs) if paragraphs else None


def _extract_notes(slide) -> Optional[str]:
    """Extract speaker notes from a slide."""
    if not slide.has_notes_slide:
        return None

    notes_slide = slide.notes_slide
    notes_frame = notes_slide.notes_text_frame

    if notes_frame:
        notes_text = notes_frame.text.strip()
        return notes_text if notes_text else None

    return None


def _table_to_markdown(table) -> Optional[str]:
    """Convert a PPTX table to markdown format."""
    rows = []

    for row in table.rows:
        cells = []
        for cell in row.cells:
            cell_text = cell.text.strip().replace("\n", " ")
            cells.append(cell_text)
        if any(cells):  # Skip completely empty rows
            rows.append(cells)

    if not rows:
        return None

    # Build markdown table
    md_lines = []

    # Header row
    header = rows[0]
    md_lines.append("| " + " | ".join(header) + " |")
    md_lines.append("| " + " | ".join(["---"] * len(header)) + " |")

    # Data rows
    for row in rows[1:]:
        # Pad row to match header length
        while len(row) < len(header):
            row.append("")
        md_lines.append("| " + " | ".join(row) + " |")

    return "\n".join(md_lines)
