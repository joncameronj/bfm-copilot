"""
Frontmatter Generator - Auto-generate metadata from filenames and content.

Parses BFM asset filenames to extract:
- Care category (diabetes, thyroid, hormones, neurological)
- Conference year and day
- Case study information
- Test type
"""

import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional

# Mapping from folder/file names to care categories
BODY_SYSTEM_MAPPING = {
    "diabetes": "diabetes",
    "thyroid": "thyroid",
    "hormones": "hormones",
    "neurological": "neurological",
    "neuro": "neurological",
}

# Day name normalization
DAY_MAPPING = {
    "fri": "friday",
    "friday": "friday",
    "sat": "saturday",
    "saturday": "saturday",
    "sun": "sunday",
    "sunday": "sunday",
}


@dataclass
class DocumentMetadata:
    """Metadata extracted from document filename and path."""

    title: str
    care_category: str  # diabetes | thyroid | hormones | neurological
    source_type: str  # transcript | case_study | frequency_reference
    original_filename: str
    conference_year: Optional[int] = None
    conference_day: Optional[str] = None
    case_study_id: Optional[str] = None
    test_type: Optional[str] = None  # hrv | depulse | ua | lab | blood | nes
    tags: list[str] = field(default_factory=list)
    processed_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())


def infer_metadata_from_filename(filepath: Path) -> DocumentMetadata:
    """
    Parse filename and path to extract metadata.

    Examples:
        "BFM Sat 2025 Diabetes.md" -> {
            care_category: "diabetes",
            conference_year: 2025,
            conference_day: "saturday",
            source_type: "transcript"
        }

        "diabetes-cs1/Female Case Study 1 HRV.jpg" -> {
            care_category: "diabetes",
            case_study_id: "diabetes-cs1",
            test_type: "hrv",
            source_type: "case_study"
        }
    """
    filename = filepath.name
    parent_dir = filepath.parent.name
    grandparent_dir = filepath.parent.parent.name if filepath.parent.parent else None

    # Determine care category from path
    care_category = _extract_care_category(filepath)

    # Determine source type and extract specific metadata
    if "raw-data" in str(filepath):
        return _parse_transcript_metadata(filepath, filename, care_category)
    elif "casestud" in str(filepath).lower() or "-cs" in parent_dir.lower():
        return _parse_case_study_metadata(filepath, filename, care_category, parent_dir)
    elif "frequencies" in filename.lower():
        return _parse_frequency_metadata(filepath, filename, care_category)
    else:
        # Generic document
        return DocumentMetadata(
            title=_generate_title(filename),
            care_category=care_category,
            source_type="other",
            original_filename=filename,
        )


def _extract_care_category(filepath: Path) -> str:
    """Extract care category from file path."""
    path_str = str(filepath).lower()

    for key, category in BODY_SYSTEM_MAPPING.items():
        if key in path_str:
            return category

    return "unknown"


def _parse_transcript_metadata(
    filepath: Path, filename: str, care_category: str
) -> DocumentMetadata:
    """Parse metadata from BFM seminar transcript filename."""
    # Pattern: "BFM [Day] [Year] [Category].md"
    # Examples: "BFM Sat 2025 Diabetes.md", "BFM Friday 2021 Diabetes.md"

    year = None
    day = None

    # Extract year (4 digits)
    year_match = re.search(r"20\d{2}", filename)
    if year_match:
        year = int(year_match.group())

    # Extract day
    filename_lower = filename.lower()
    for day_key, day_value in DAY_MAPPING.items():
        if day_key in filename_lower:
            day = day_value
            break

    # Generate title
    title = f"BFM {year or ''} {care_category.title()} {day.title() if day else ''} Session".strip()
    title = re.sub(r"\s+", " ", title)  # Clean up extra spaces

    return DocumentMetadata(
        title=title,
        care_category=care_category,
        source_type="transcript",
        original_filename=filename,
        conference_year=year,
        conference_day=day,
        tags=[care_category, "seminar", "transcript"],
    )


def _parse_case_study_metadata(
    filepath: Path, filename: str, care_category: str, parent_dir: str
) -> DocumentMetadata:
    """Parse metadata from case study asset filename."""
    # Pattern: "[Gender] Case Study [N] [TestType].[ext]"
    # Examples: "Female Case Study 1 HRV.jpg", "Case Study 3 Depulse.png"

    # Extract case study ID from parent directory
    case_study_id = None
    cs_match = re.search(r"([\w-]+-cs\d+)", parent_dir.lower())
    if cs_match:
        case_study_id = cs_match.group(1)
    else:
        # Try to build from category + number
        num_match = re.search(r"cs(\d+)", parent_dir.lower())
        if num_match:
            case_study_id = f"{care_category}-cs{num_match.group(1)}"

    # Extract test type
    test_type = _detect_test_type(filename)

    # Generate title
    title = f"{care_category.title()} {case_study_id or 'Case Study'} - {test_type.upper() if test_type else 'Assessment'}"

    return DocumentMetadata(
        title=title,
        care_category=care_category,
        source_type="case_study",
        original_filename=filename,
        case_study_id=case_study_id,
        test_type=test_type,
        tags=[care_category, "case_study", test_type] if test_type else [care_category, "case_study"],
    )


def _parse_frequency_metadata(
    filepath: Path, filename: str, care_category: str
) -> DocumentMetadata:
    """Parse metadata from frequency reference PDF."""
    # Pattern: "[category]-frequencies.pdf" or "neuro-frequencies.pdf"

    title = f"{care_category.title()} Frequency Protocols"

    return DocumentMetadata(
        title=title,
        care_category=care_category,
        source_type="frequency_reference",
        original_filename=filename,
        tags=[care_category, "frequencies", "protocol", "reference"],
    )


def _detect_test_type(filename: str) -> Optional[str]:
    """Detect test type from filename."""
    filename_lower = filename.lower()

    test_types = {
        "hrv": ["hrv", "heart rate variability"],
        "depulse": ["depulse", "pulse"],
        "ua": ["ua", "urinalysis", "urine"],
        "lab": ["lab"],
        "blood": ["blood"],
        "nes": ["nes", "scan", "template"],
    }

    for test_type, keywords in test_types.items():
        for keyword in keywords:
            if keyword in filename_lower:
                return test_type

    return None


def _generate_title(filename: str) -> str:
    """Generate a clean title from filename."""
    # Remove extension
    name = Path(filename).stem

    # Replace underscores and hyphens with spaces
    name = re.sub(r"[-_]", " ", name)

    # Title case
    return name.title()


def generate_frontmatter(metadata: DocumentMetadata) -> str:
    """
    Generate YAML frontmatter from metadata.

    Returns:
        YAML frontmatter string ready to prepend to markdown content.
    """
    lines = [
        "---",
        f'title: "{metadata.title}"',
        f"care_category: {metadata.care_category}",
        f"source_type: {metadata.source_type}",
    ]

    if metadata.conference_year:
        lines.append(f"conference_year: {metadata.conference_year}")

    if metadata.conference_day:
        lines.append(f"conference_day: {metadata.conference_day}")

    if metadata.case_study_id:
        lines.append(f"case_study_id: {metadata.case_study_id}")

    if metadata.test_type:
        lines.append(f"test_type: {metadata.test_type}")

    if metadata.tags:
        tags_str = ", ".join(metadata.tags)
        lines.append(f"tags: [{tags_str}]")

    lines.append(f"original_filename: {metadata.original_filename}")
    lines.append(f"processed_at: {metadata.processed_at}")
    lines.append("---")

    return "\n".join(lines)
