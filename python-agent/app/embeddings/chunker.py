"""
Document Chunker - Split documents into searchable chunks with protocol awareness.

For Sunday seminar content, extracts and tags protocol mentions (frequencies,
supplements) to enable protocol-based filtering in RAG search.
"""

import re
import tiktoken
from dataclasses import dataclass, field


# =============================================================================
# PROTOCOL DETECTION PATTERNS (for Sunday content chunking)
# =============================================================================

# Dynamic protocol loading from database
from app.services.protocol_loader import get_frequency_patterns, get_supplement_patterns


def _get_frequency_patterns() -> list[str]:
    """Get frequency patterns (loaded from DB with caching)."""
    return get_frequency_patterns()


def _get_supplement_patterns() -> list[str]:
    """Get supplement patterns."""
    return get_supplement_patterns()

# Diagnostic pattern keywords that indicate protocol context
DIAGNOSTIC_CONTEXT_PATTERNS = [
    r"\b(low\s*alpha|alpha\s*under\s*\d+)\b",
    r"\b(high\s*beta|beta\s*dominant)\b",
    r"\b(high\s*gamma)\b",
    r"\b(theta\s*>\s*alpha|theta\s*greater\s*than\s*alpha)\b",
    r"\b(PNS\s*negative|parasympathetic\s*negative)\b",
    r"\b(SNS\s*switched|sympathetic\s*switched)\b",
    r"\b(failed\s*VCS|VCS\s*fail)\b",
    r"\b(low\s*pH|pH\s*under\s*6\.5)\b",
    r"\b(protein\s*in\s*urine|proteinuria)\b",
    r"\b(biotoxin\s*illness|biotoxic)\b",
]


def extract_protocols_from_text(text: str) -> dict[str, list[str]]:
    """
    Extract all protocol mentions from text.

    Scans for known frequency and supplement names in the text.

    Args:
        text: Text to scan for protocol mentions

    Returns:
        Dict with 'frequencies', 'supplements', and 'diagnostics' keys
    """
    text_lower = text.lower()

    # Use dynamic patterns from database
    frequency_patterns = _get_frequency_patterns()
    supplement_patterns = _get_supplement_patterns()

    frequencies = set()
    for pattern in frequency_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        frequencies.update(m if isinstance(m, str) else m[0] for m in matches)

    supplements = set()
    for pattern in supplement_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        supplements.update(m if isinstance(m, str) else m[0] for m in matches)

    diagnostics = set()
    for pattern in DIAGNOSTIC_CONTEXT_PATTERNS:
        matches = re.findall(pattern, text, re.IGNORECASE)
        diagnostics.update(m if isinstance(m, str) else m[0] for m in matches)

    return {
        "frequencies": list(frequencies),
        "supplements": list(supplements),
        "diagnostics": list(diagnostics),
    }


def normalize_protocol_name(name: str) -> str:
    """Normalize protocol names for consistent matching."""
    name = name.strip()
    # Handle X-39 / X39 variations
    name = re.sub(r"X[-\s]?39", "X-39", name, flags=re.IGNORECASE)
    # Handle CP-P / CPP variations
    name = re.sub(r"CP[-\s]?P", "CP-P", name, flags=re.IGNORECASE)
    # Handle Pectasol-C variations
    name = re.sub(r"Pectasol[-\s]?C?", "Pectasol-C", name, flags=re.IGNORECASE)
    # Handle Vagus/Vagas/Vegas variations
    name = re.sub(r"V[ae]g[au]s", "Vagus", name, flags=re.IGNORECASE)
    # Handle Tri-Salts / Tri Salts
    name = re.sub(r"Tri[-\s]?Salts", "Tri-Salts", name, flags=re.IGNORECASE)
    # Handle D-Ribose / DRibose
    name = re.sub(r"D[-\s]?Ribose", "D-Ribose", name, flags=re.IGNORECASE)
    return name


@dataclass
class TextChunk:
    index: int
    content: str
    token_count: int
    metadata: dict = field(default_factory=dict)
    # Protocol tags for search boosting
    protocols: list[str] = field(default_factory=list)
    has_protocol_context: bool = False


def chunk_document(
    text: str,
    chunk_size: int = 500,
    overlap: int = 50,
    model: str = "text-embedding-3-small",
) -> list[TextChunk]:
    """
    Split text into overlapping chunks based on token count.

    Args:
        text: The text to chunk
        chunk_size: Target number of tokens per chunk
        overlap: Number of tokens to overlap between chunks
        model: Model name for tokenizer selection

    Returns:
        List of TextChunk objects
    """
    # Get the appropriate tokenizer
    try:
        encoding = tiktoken.encoding_for_model(model)
    except KeyError:
        encoding = tiktoken.get_encoding("cl100k_base")

    # Tokenize the entire text
    tokens = encoding.encode(text)
    total_tokens = len(tokens)

    if total_tokens == 0:
        return []

    chunks = []
    start = 0
    chunk_index = 0

    while start < total_tokens:
        # Calculate end position
        end = min(start + chunk_size, total_tokens)

        # Get tokens for this chunk
        chunk_tokens = tokens[start:end]

        # Decode back to text
        chunk_text = encoding.decode(chunk_tokens)

        # Create chunk object
        chunks.append(
            TextChunk(
                index=chunk_index,
                content=chunk_text.strip(),
                token_count=len(chunk_tokens),
                metadata={
                    "start_token": start,
                    "end_token": end,
                },
            )
        )

        # Move start position (accounting for overlap)
        start = end - overlap if end < total_tokens else end
        chunk_index += 1

    return chunks


def chunk_by_paragraphs(
    text: str,
    max_chunk_size: int = 500,
    model: str = "text-embedding-3-small",
) -> list[TextChunk]:
    """
    Split text by paragraphs, combining small paragraphs and splitting large ones.

    This method preserves semantic boundaries better than fixed-size chunking.
    """
    try:
        encoding = tiktoken.encoding_for_model(model)
    except KeyError:
        encoding = tiktoken.get_encoding("cl100k_base")

    # Split by double newlines (paragraphs)
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

    chunks = []
    current_chunk = ""
    current_tokens = 0
    chunk_index = 0

    for para in paragraphs:
        para_tokens = len(encoding.encode(para))

        # If single paragraph exceeds max size, use fixed chunking
        if para_tokens > max_chunk_size:
            # Flush current chunk first
            if current_chunk:
                chunks.append(
                    TextChunk(
                        index=chunk_index,
                        content=current_chunk.strip(),
                        token_count=current_tokens,
                        metadata={},
                    )
                )
                chunk_index += 1
                current_chunk = ""
                current_tokens = 0

            # Chunk the large paragraph
            para_chunks = chunk_document(para, max_chunk_size, overlap=50, model=model)
            for pc in para_chunks:
                pc.index = chunk_index
                chunks.append(pc)
                chunk_index += 1
            continue

        # Check if adding this paragraph exceeds limit
        if current_tokens + para_tokens > max_chunk_size:
            # Flush current chunk
            if current_chunk:
                chunks.append(
                    TextChunk(
                        index=chunk_index,
                        content=current_chunk.strip(),
                        token_count=current_tokens,
                        metadata={},
                    )
                )
                chunk_index += 1

            current_chunk = para
            current_tokens = para_tokens
        else:
            # Add to current chunk
            if current_chunk:
                current_chunk += "\n\n" + para
            else:
                current_chunk = para
            current_tokens += para_tokens

    # Flush remaining content
    if current_chunk:
        chunks.append(
            TextChunk(
                index=chunk_index,
                content=current_chunk.strip(),
                token_count=current_tokens,
                metadata={},
            )
        )

    return chunks


def chunk_with_protocols(
    text: str,
    max_chunk_size: int = 500,
    model: str = "text-embedding-3-small",
    include_surrounding_context: bool = True,
) -> list[TextChunk]:
    """
    Chunk document with protocol-aware metadata for Sunday content.

    This specialized chunker:
    1. Splits text into semantic chunks (by paragraph)
    2. Detects protocol mentions (frequencies, supplements) in each chunk
    3. Tags chunks with detected protocols for search boosting
    4. Optionally includes surrounding context when protocols are mentioned

    Best used for Sunday seminar transcripts and case study content where
    protocol recommendations are scattered throughout conversational text.

    Args:
        text: Document text to chunk
        max_chunk_size: Maximum tokens per chunk
        model: Model name for tokenizer
        include_surrounding_context: If True, include context from adjacent
            paragraphs when protocols are mentioned

    Returns:
        List of TextChunk objects with protocol metadata
    """
    try:
        encoding = tiktoken.encoding_for_model(model)
    except KeyError:
        encoding = tiktoken.get_encoding("cl100k_base")

    # Split by double newlines (paragraphs)
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

    if not paragraphs:
        return []

    # First pass: identify which paragraphs contain protocols
    para_protocols: list[dict[str, list[str]]] = []
    for para in paragraphs:
        protocols = extract_protocols_from_text(para)
        para_protocols.append(protocols)

    chunks: list[TextChunk] = []
    chunk_index = 0
    i = 0

    while i < len(paragraphs):
        para = paragraphs[i]
        protocols = para_protocols[i]
        para_tokens = len(encoding.encode(para))

        # Check if this paragraph has protocol content
        has_protocols = bool(
            protocols["frequencies"] or
            protocols["supplements"] or
            protocols["diagnostics"]
        )

        # If protocols found and context requested, gather surrounding context
        if has_protocols and include_surrounding_context:
            context_paras = [para]
            context_tokens = para_tokens
            all_protocols: dict[str, set[str]] = {
                "frequencies": set(protocols["frequencies"]),
                "supplements": set(protocols["supplements"]),
                "diagnostics": set(protocols["diagnostics"]),
            }

            # Look back for context (up to 1 paragraph)
            if i > 0:
                prev_para = paragraphs[i - 1]
                prev_tokens = len(encoding.encode(prev_para))
                if context_tokens + prev_tokens <= max_chunk_size:
                    context_paras.insert(0, prev_para)
                    context_tokens += prev_tokens
                    # Also capture any protocols from context
                    prev_protocols = para_protocols[i - 1]
                    all_protocols["frequencies"].update(prev_protocols["frequencies"])
                    all_protocols["supplements"].update(prev_protocols["supplements"])

            # Look ahead for context (up to 1 paragraph)
            if i + 1 < len(paragraphs):
                next_para = paragraphs[i + 1]
                next_tokens = len(encoding.encode(next_para))
                if context_tokens + next_tokens <= max_chunk_size:
                    context_paras.append(next_para)
                    context_tokens += next_tokens
                    next_protocols = para_protocols[i + 1]
                    all_protocols["frequencies"].update(next_protocols["frequencies"])
                    all_protocols["supplements"].update(next_protocols["supplements"])
                    i += 1  # Skip next paragraph since we included it

            chunk_content = "\n\n".join(context_paras)
            all_protocol_names = (
                list(all_protocols["frequencies"]) +
                list(all_protocols["supplements"])
            )

            chunks.append(
                TextChunk(
                    index=chunk_index,
                    content=chunk_content.strip(),
                    token_count=context_tokens,
                    metadata={
                        "diagnostics": list(all_protocols["diagnostics"]),
                    },
                    protocols=[normalize_protocol_name(p) for p in all_protocol_names],
                    has_protocol_context=True,
                )
            )
            chunk_index += 1

        else:
            # No protocols - use standard paragraph chunking
            if para_tokens > max_chunk_size:
                # Large paragraph - use fixed chunking
                para_chunks = chunk_document(para, max_chunk_size, overlap=50, model=model)
                for pc in para_chunks:
                    pc.index = chunk_index
                    # Check for protocols in sub-chunks
                    sub_protocols = extract_protocols_from_text(pc.content)
                    pc.protocols = [
                        normalize_protocol_name(p)
                        for p in (sub_protocols["frequencies"] + sub_protocols["supplements"])
                    ]
                    pc.has_protocol_context = bool(pc.protocols)
                    chunks.append(pc)
                    chunk_index += 1
            else:
                # Normal paragraph - add as single chunk
                all_protocol_names = protocols["frequencies"] + protocols["supplements"]
                chunks.append(
                    TextChunk(
                        index=chunk_index,
                        content=para.strip(),
                        token_count=para_tokens,
                        metadata={
                            "diagnostics": protocols["diagnostics"],
                        },
                        protocols=[normalize_protocol_name(p) for p in all_protocol_names],
                        has_protocol_context=bool(all_protocol_names),
                    )
                )
                chunk_index += 1

        i += 1

    return chunks


def enrich_chunks_with_protocols(chunks: list[TextChunk]) -> list[TextChunk]:
    """
    Post-process existing chunks to add protocol metadata.

    Use this to add protocol awareness to chunks created by other methods.

    Args:
        chunks: List of TextChunk objects to enrich

    Returns:
        Same chunks with protocol metadata added
    """
    for chunk in chunks:
        protocols = extract_protocols_from_text(chunk.content)
        all_protocol_names = protocols["frequencies"] + protocols["supplements"]
        chunk.protocols = [normalize_protocol_name(p) for p in all_protocol_names]
        chunk.has_protocol_context = bool(all_protocol_names)
        if "diagnostics" not in chunk.metadata:
            chunk.metadata["diagnostics"] = protocols["diagnostics"]

    return chunks
