"""
Markdown Cleaner - Clean and format BFM seminar transcripts.

Handles common transcript issues:
- Filler words (um, uh, like)
- Run-on paragraphs
- Missing section headers
- Inconsistent formatting
"""

import re
from dataclasses import dataclass
from typing import Optional

from openai import OpenAI


@dataclass
class CleaningConfig:
    """Configuration for transcript cleaning."""

    remove_filler_words: bool = True
    normalize_paragraphs: bool = True
    min_paragraph_length: int = 50  # Characters
    max_paragraph_length: int = 2000  # Characters
    detect_sections_with_llm: bool = False  # Use LLM to detect topic sections


# Common filler words and phrases to remove
FILLER_PATTERNS = [
    r"\b(um+|uh+|er+|ah+)\b",  # Verbal fillers
    r"\b(you know|i mean|like,|sort of|kind of)\b",  # Discourse markers
    r"\.\.\.",  # Ellipses from speech patterns
    r"\s+,",  # Space before comma
]


def clean_transcript(
    content: str,
    care_category: str,
    config: Optional[CleaningConfig] = None,
) -> tuple[str, dict]:
    """
    Clean and format a transcript markdown file.

    Args:
        content: Raw markdown content
        care_category: The care category (diabetes, thyroid, etc.)
        config: Cleaning configuration options

    Returns:
        Tuple of (cleaned_content, extracted_metadata)
    """
    if config is None:
        config = CleaningConfig()

    cleaned = content
    metadata = {
        "original_length": len(content),
        "care_category": care_category,
    }

    # Step 1: Remove filler words
    if config.remove_filler_words:
        cleaned = _remove_filler_words(cleaned)

    # Step 2: Normalize whitespace and paragraphs
    if config.normalize_paragraphs:
        cleaned = _normalize_paragraphs(cleaned, config)

    # Step 3: Clean up formatting
    cleaned = _clean_formatting(cleaned)

    # Step 4: (Optional) Use LLM to detect topic sections
    if config.detect_sections_with_llm:
        cleaned, topics = _detect_sections_with_llm(cleaned, care_category)
        metadata["detected_topics"] = topics

    metadata["cleaned_length"] = len(cleaned)
    metadata["reduction_percent"] = round(
        (1 - len(cleaned) / len(content)) * 100, 1
    ) if len(content) > 0 else 0

    return cleaned, metadata


def _remove_filler_words(content: str) -> str:
    """Remove filler words and verbal tics from transcript."""
    cleaned = content

    for pattern in FILLER_PATTERNS:
        cleaned = re.sub(pattern, "", cleaned, flags=re.IGNORECASE)

    # Clean up resulting double spaces
    cleaned = re.sub(r"  +", " ", cleaned)

    return cleaned


def _normalize_paragraphs(content: str, config: CleaningConfig) -> str:
    """Normalize paragraph breaks and structure."""
    # Split by existing paragraph breaks
    paragraphs = re.split(r"\n\s*\n", content)

    normalized = []
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        # Skip very short paragraphs (likely headers or artifacts)
        if len(para) < config.min_paragraph_length:
            # Keep headers (lines starting with #)
            if para.startswith("#"):
                normalized.append(para)
            # Keep short lines that look like section markers
            elif re.match(r"^[A-Z][A-Za-z\s]+:$", para):
                normalized.append(f"\n## {para.rstrip(':')}\n")
            continue

        # Break up very long paragraphs
        if len(para) > config.max_paragraph_length:
            # Try to break at sentence boundaries
            sentences = re.split(r"(?<=[.!?])\s+", para)
            current_chunk = []
            current_length = 0

            for sentence in sentences:
                if current_length + len(sentence) > config.max_paragraph_length and current_chunk:
                    normalized.append(" ".join(current_chunk))
                    current_chunk = [sentence]
                    current_length = len(sentence)
                else:
                    current_chunk.append(sentence)
                    current_length += len(sentence)

            if current_chunk:
                normalized.append(" ".join(current_chunk))
        else:
            normalized.append(para)

    return "\n\n".join(normalized)


def _clean_formatting(content: str) -> str:
    """Clean up common formatting issues."""
    cleaned = content

    # Fix multiple consecutive newlines
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)

    # Fix space before punctuation
    cleaned = re.sub(r"\s+([.,!?;:])", r"\1", cleaned)

    # Fix missing space after punctuation
    cleaned = re.sub(r"([.,!?;:])([A-Za-z])", r"\1 \2", cleaned)

    # Ensure headers have proper spacing
    cleaned = re.sub(r"(^|\n)(#+)\s*", r"\n\n\2 ", cleaned)

    # Clean up leading/trailing whitespace per line
    lines = cleaned.split("\n")
    lines = [line.strip() for line in lines]
    cleaned = "\n".join(lines)

    # Final cleanup
    cleaned = cleaned.strip()

    return cleaned


def _detect_sections_with_llm(content: str, care_category: str) -> tuple[str, list[str]]:
    """
    Use GPT to detect and insert section headers.

    This is optional and adds latency/cost but can significantly improve
    the quality of transcripts for RAG retrieval.
    """
    try:
        client = OpenAI()

        # Take a sample to analyze (don't send entire transcript)
        sample = content[:8000] if len(content) > 8000 else content

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": f"""You are analyzing a medical seminar transcript about {care_category}.

Identify the main topics discussed and return a JSON list of topics in the order they appear.
Focus on clinical topics, conditions, lab markers, and treatments discussed.

Return ONLY a JSON array of topic strings, like:
["Introduction to {care_category}", "Key Lab Markers", "Treatment Protocols", "Case Discussion"]"""
                },
                {
                    "role": "user",
                    "content": sample
                }
            ],
            max_tokens=500,
            temperature=0.3,
        )

        topics_text = response.choices[0].message.content.strip()

        # Parse the JSON response
        import json
        try:
            topics = json.loads(topics_text)
            if isinstance(topics, list):
                return content, topics
        except json.JSONDecodeError:
            pass

        return content, []

    except Exception as e:
        print(f"Warning: LLM section detection failed: {e}")
        return content, []


def add_section_headers(content: str, sections: list[str]) -> str:
    """
    Insert section headers into content based on detected topics.

    This is a heuristic approach - looks for topic mentions in the content
    and inserts headers before them.
    """
    if not sections:
        return content

    result = content

    for section in sections:
        # Look for the section topic in the content
        pattern = re.compile(
            rf"(?<!\#)(\n)([^#\n]*{re.escape(section.lower())}[^#\n]*\n)",
            re.IGNORECASE
        )
        # Insert header before first mention
        result = pattern.sub(rf"\1\n## {section}\n\2", result, count=1)

    return result
