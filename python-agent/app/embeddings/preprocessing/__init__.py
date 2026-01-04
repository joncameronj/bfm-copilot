"""
Preprocessing module for BFM asset ingestion.

Provides tools to clean, format, and extract content from various document types:
- Markdown transcripts
- PDFs (text and scanned)
- Images (via Vision API)
- DOCX templates
"""

from .frontmatter_generator import (
    generate_frontmatter,
    infer_metadata_from_filename,
    BODY_SYSTEM_MAPPING,
)
from .markdown_cleaner import clean_transcript, CleaningConfig
from .image_processor import process_image_with_vision, detect_image_type
from .pdf_processor import extract_pdf_text, process_pdf_with_vision_fallback
from .docx_processor import extract_docx_text

__all__ = [
    "generate_frontmatter",
    "infer_metadata_from_filename",
    "BODY_SYSTEM_MAPPING",
    "clean_transcript",
    "CleaningConfig",
    "process_image_with_vision",
    "detect_image_type",
    "extract_pdf_text",
    "process_pdf_with_vision_fallback",
    "extract_docx_text",
]
