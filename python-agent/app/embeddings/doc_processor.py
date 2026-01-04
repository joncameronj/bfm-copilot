"""
Document Processor - Parse Markdown files with YAML frontmatter.

Handles extracting metadata and content from protocol documents.
"""

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml


@dataclass
class DocumentMetadata:
    """Metadata extracted from document frontmatter."""

    title: str = ""
    document_category: str = ""
    body_system: str = ""
    tags: list[str] = field(default_factory=list)
    related_conditions: list[str] = field(default_factory=list)
    lab_markers: list[str] = field(default_factory=list)
    version: str = "1.0"
    last_updated: str = ""

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "DocumentMetadata":
        """Create metadata from frontmatter dictionary."""
        return cls(
            title=data.get("title", ""),
            document_category=data.get("document_category", ""),
            body_system=data.get("body_system", ""),
            tags=data.get("tags", []) or [],
            related_conditions=data.get("related_conditions", []) or [],
            lab_markers=data.get("lab_markers", []) or [],
            version=str(data.get("version", "1.0")),
            last_updated=str(data.get("last_updated", "")),
        )

    def all_tags(self) -> list[str]:
        """Get all tags including related conditions and lab markers."""
        all_tags = set(self.tags)
        all_tags.update(self.related_conditions)
        all_tags.update(self.lab_markers)
        return list(all_tags)


@dataclass
class ProcessedDocument:
    """A processed document with metadata and content."""

    filepath: Path
    filename: str
    metadata: DocumentMetadata
    content: str
    raw_frontmatter: dict[str, Any] = field(default_factory=dict)

    @property
    def title(self) -> str:
        """Get document title, falling back to filename."""
        return self.metadata.title or self.filename


def parse_frontmatter(content: str) -> tuple[dict[str, Any], str]:
    """
    Parse YAML frontmatter from Markdown content.

    Args:
        content: Raw Markdown content with optional frontmatter

    Returns:
        Tuple of (frontmatter dict, content without frontmatter)
    """
    # Match frontmatter pattern: --- at start, content, ---
    frontmatter_pattern = r"^---\s*\n(.*?)\n---\s*\n"
    match = re.match(frontmatter_pattern, content, re.DOTALL)

    if not match:
        return {}, content

    try:
        frontmatter_yaml = match.group(1)
        frontmatter = yaml.safe_load(frontmatter_yaml) or {}
        content_without_frontmatter = content[match.end() :].strip()
        return frontmatter, content_without_frontmatter
    except yaml.YAMLError as e:
        print(f"Warning: Failed to parse frontmatter: {e}")
        return {}, content


def process_markdown_file(filepath: Path) -> ProcessedDocument:
    """
    Process a single Markdown file.

    Args:
        filepath: Path to the Markdown file

    Returns:
        ProcessedDocument with extracted metadata and content
    """
    content = filepath.read_text(encoding="utf-8")
    frontmatter, body = parse_frontmatter(content)
    metadata = DocumentMetadata.from_dict(frontmatter)

    return ProcessedDocument(
        filepath=filepath,
        filename=filepath.stem,
        metadata=metadata,
        content=body,
        raw_frontmatter=frontmatter,
    )


def process_directory(
    directory: Path,
    recursive: bool = True,
    extensions: list[str] | None = None,
) -> list[ProcessedDocument]:
    """
    Process all Markdown files in a directory.

    Args:
        directory: Directory to process
        recursive: Whether to process subdirectories
        extensions: File extensions to process (default: ['.md', '.markdown'])

    Returns:
        List of ProcessedDocument objects
    """
    if extensions is None:
        extensions = [".md", ".markdown"]

    documents = []
    pattern = "**/*" if recursive else "*"

    for ext in extensions:
        for filepath in directory.glob(f"{pattern}{ext}"):
            # Skip index and config files
            if filepath.name.startswith("_"):
                continue

            try:
                doc = process_markdown_file(filepath)
                documents.append(doc)
            except Exception as e:
                print(f"Warning: Failed to process {filepath}: {e}")

    return documents


def infer_body_system_from_path(filepath: Path) -> str | None:
    """
    Infer body system from file path structure.

    Expected structure: docs/protocols/{body_system}/...
    """
    parts = filepath.parts
    try:
        # Find 'protocols' in path and get next part
        protocols_idx = parts.index("protocols")
        if protocols_idx + 1 < len(parts):
            potential_system = parts[protocols_idx + 1]
            # Known body systems
            known_systems = {
                "endocrine",
                "cardiovascular",
                "digestive",
                "immune",
                "nervous",
                "musculoskeletal",
                "reproductive",
                "respiratory",
                "integumentary",
                "urinary",
                "lymphatic",
            }
            if potential_system in known_systems:
                return potential_system
    except ValueError:
        pass

    return None


def infer_metadata_from_path(doc: ProcessedDocument) -> ProcessedDocument:
    """
    Infer missing metadata from file path structure.

    Args:
        doc: ProcessedDocument with potentially incomplete metadata

    Returns:
        ProcessedDocument with inferred metadata filled in
    """
    # Infer body system from path if not set
    if not doc.metadata.body_system:
        inferred_system = infer_body_system_from_path(doc.filepath)
        if inferred_system:
            doc.metadata.body_system = inferred_system

    # Infer document category from filename patterns
    if not doc.metadata.document_category:
        filename_lower = doc.filename.lower()
        if "protocol" in filename_lower:
            doc.metadata.document_category = "protocol"
        elif "lab" in filename_lower or "guide" in filename_lower:
            doc.metadata.document_category = "lab_guide"
        elif "reference" in filename_lower:
            doc.metadata.document_category = "reference"

    return doc


def validate_document(doc: ProcessedDocument) -> list[str]:
    """
    Validate a processed document for required fields.

    Args:
        doc: ProcessedDocument to validate

    Returns:
        List of validation warnings (empty if valid)
    """
    warnings = []

    if not doc.metadata.title:
        warnings.append(f"{doc.filename}: Missing title in frontmatter")

    if not doc.metadata.document_category:
        warnings.append(f"{doc.filename}: Missing document_category")

    if not doc.content.strip():
        warnings.append(f"{doc.filename}: Empty content")

    if len(doc.content) < 100:
        warnings.append(f"{doc.filename}: Very short content ({len(doc.content)} chars)")

    return warnings
