"""
PDF Processor - Extract text from PDF files.

Handles both text-based and scanned PDFs:
- Text extraction using PyPDF2
- Vision API fallback for scanned/image PDFs
"""

from pathlib import Path
from typing import Optional

from PyPDF2 import PdfReader

from .image_processor import process_image_with_vision


async def extract_pdf_text(pdf_path: Path) -> dict:
    """
    Extract text from a PDF file.

    Args:
        pdf_path: Path to the PDF file

    Returns:
        Dictionary with:
        - text_content: Extracted text content
        - page_count: Number of pages
        - has_text: Whether meaningful text was found
        - needs_ocr: Whether the PDF likely needs OCR/Vision processing
    """
    reader = PdfReader(str(pdf_path))
    pages_text = []

    for page in reader.pages:
        text = page.extract_text()
        if text:
            pages_text.append(text.strip())

    full_text = "\n\n---\n\n".join(pages_text)

    # Check if we got meaningful text
    # A PDF with only images might extract some garbage characters
    has_meaningful_text = len(full_text.strip()) > 100 and _is_meaningful_text(full_text)

    return {
        "text_content": full_text,
        "page_count": len(reader.pages),
        "has_text": has_meaningful_text,
        "needs_ocr": not has_meaningful_text,
    }


def _is_meaningful_text(text: str) -> bool:
    """
    Check if extracted text appears to be meaningful content.

    Scanned PDFs sometimes extract garbage characters.
    This heuristic checks for readable content.
    """
    # Count alphanumeric vs total characters
    if len(text) == 0:
        return False

    alpha_count = sum(1 for c in text if c.isalnum())
    ratio = alpha_count / len(text)

    # Meaningful text should have at least 30% alphanumeric
    if ratio < 0.3:
        return False

    # Check for common words
    common_words = ["the", "and", "is", "to", "of", "a", "in", "for", "on", "with"]
    text_lower = text.lower()
    word_matches = sum(1 for word in common_words if word in text_lower)

    return word_matches >= 2


async def process_pdf_with_vision_fallback(
    pdf_path: Path,
    force_vision: bool = False,
) -> dict:
    """
    Extract text from PDF, using Vision API for scanned/image PDFs.

    Args:
        pdf_path: Path to the PDF file
        force_vision: If True, skip text extraction and use Vision directly

    Returns:
        Dictionary with:
        - text_content: Extracted text content (markdown formatted)
        - page_count: Number of pages
        - method: Extraction method used (text|vision)
        - tokens_used: Vision API tokens if used
    """
    if not force_vision:
        # Try text extraction first
        result = await extract_pdf_text(pdf_path)

        if result["has_text"]:
            return {
                "text_content": result["text_content"],
                "page_count": result["page_count"],
                "method": "text",
                "tokens_used": 0,
            }

    # Fall back to Vision API for scanned PDFs
    return await _process_pdf_with_vision(pdf_path)


async def _process_pdf_with_vision(pdf_path: Path) -> dict:
    """
    Process PDF pages as images using Vision API.

    Requires pdf2image library and poppler installation.
    """
    try:
        from pdf2image import convert_from_path
    except ImportError:
        raise ImportError(
            "pdf2image is required for processing scanned PDFs. "
            "Install with: pip install pdf2image"
        )

    # Convert PDF pages to images
    try:
        images = convert_from_path(str(pdf_path), dpi=150)
    except Exception as e:
        # pdf2image requires poppler to be installed
        raise RuntimeError(
            f"Failed to convert PDF to images. "
            f"Ensure poppler is installed (brew install poppler on macOS). "
            f"Error: {e}"
        )

    extracted_texts = []
    total_tokens = 0

    for i, image in enumerate(images):
        # Save temporarily and process with Vision
        import tempfile

        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            temp_path = Path(tmp.name)
            image.save(temp_path, "PNG")

        try:
            result = await process_image_with_vision(
                temp_path,
                image_type="general",
                additional_context=f"This is page {i + 1} of a PDF document.",
            )
            extracted_texts.append(f"## Page {i + 1}\n\n{result['extracted_text']}")
            total_tokens += result.get("tokens_used", 0)
        finally:
            # Clean up temp file
            temp_path.unlink(missing_ok=True)

    full_text = "\n\n---\n\n".join(extracted_texts)

    return {
        "text_content": full_text,
        "page_count": len(images),
        "method": "vision",
        "tokens_used": total_tokens,
    }


async def extract_frequency_pdf(pdf_path: Path) -> dict:
    """
    Extract content from a frequency protocol PDF.

    These are reference documents with specific formatting.
    Uses text extraction with specialized parsing.

    Args:
        pdf_path: Path to the frequency PDF

    Returns:
        Dictionary with structured content
    """
    result = await extract_pdf_text(pdf_path)

    if not result["has_text"]:
        # Fall back to Vision for image-based PDFs
        return await process_pdf_with_vision_fallback(pdf_path, force_vision=True)

    # Parse the frequency content
    content = result["text_content"]

    # Add metadata header
    category = _infer_category_from_path(pdf_path)
    header = f"""# {category.title()} Frequency Protocols

Source: {pdf_path.name}
Type: Frequency Reference Document

---

"""

    return {
        "text_content": header + content,
        "page_count": result["page_count"],
        "method": "text",
        "tokens_used": 0,
        "care_category": category,
    }


def _infer_category_from_path(pdf_path: Path) -> str:
    """Infer care category from PDF path."""
    path_str = str(pdf_path).lower()

    categories = ["diabetes", "thyroid", "hormones", "neurological"]
    for cat in categories:
        if cat in path_str:
            return cat

    # Check for neuro shorthand
    if "neuro" in path_str:
        return "neurological"

    return "unknown"
