"""
Protocol Loader - Dynamically load approved protocols from the database.

Provides functions to fetch approved frequency names and generate regex patterns
for protocol detection in RAG chunking and query analysis.
"""

import re
import time
from functools import lru_cache

from app.services.supabase import get_supabase_client
from app.utils.logger import get_logger

logger = get_logger(__name__)

# Cache TTL in seconds (5 minutes)
_CACHE_TTL = 300
_cache: dict[str, tuple[float, set[str]]] = {}


def _is_cache_valid(cache_key: str) -> bool:
    """Check if cached data is still valid."""
    if cache_key not in _cache:
        return False
    timestamp, _ = _cache[cache_key]
    return (time.time() - timestamp) < _CACHE_TTL


def fetch_approved_frequencies() -> set[str]:
    """
    Fetch all approved frequency names from the database.

    Returns:
        Set of lowercase frequency names for case-insensitive matching
    """
    cache_key = "frequencies"

    if _is_cache_valid(cache_key):
        _, data = _cache[cache_key]
        return data

    try:
        client = get_supabase_client()
        result = (
            client.table("approved_frequency_names")
            .select("name, aliases")
            .eq("is_active", True)
            .execute()
        )

        frequencies: set[str] = set()
        for row in result.data or []:
            # Add the primary name (lowercase for matching)
            name = row.get("name", "")
            if name:
                frequencies.add(name.lower())

            # Add aliases if present
            aliases = row.get("aliases") or []
            for alias in aliases:
                if alias:
                    frequencies.add(alias.lower())

        logger.info(f"Loaded {len(frequencies)} approved frequencies from database")
        _cache[cache_key] = (time.time(), frequencies)
        return frequencies

    except Exception as e:
        logger.error(f"Failed to fetch approved frequencies: {e}")
        # Return empty set on error - fall back to hardcoded if needed
        return set()


def get_known_frequencies() -> set[str]:
    """
    Get the set of known frequency names for protocol detection.

    This is the main entry point for query_analyzer.py.
    Falls back to a minimal hardcoded set if database fetch fails.

    Returns:
        Set of lowercase frequency names
    """
    db_frequencies = fetch_approved_frequencies()

    if db_frequencies:
        return db_frequencies

    # Fallback to minimal hardcoded set if DB is unavailable
    logger.warning("Using fallback hardcoded frequencies")
    return {
        "sns balance", "medula support", "pit p support", "vagus support",
        "pns support", "cyto lower", "leptin resist", "kidney support",
        "kidney vitality", "kidney repair", "cp-p", "alpha theta", "biotoxin",
        "sacral plexus", "ns emf", "melanin", "concussion brain balance",
    }


def get_known_supplements() -> set[str]:
    """
    Get the set of known supplement names for protocol detection.

    Currently hardcoded as supplements are not in a separate DB table.
    Can be extended to fetch from database if a table is added.

    Returns:
        Set of lowercase supplement names
    """
    return {
        "serculate", "cell synergy", "tri salts", "x39", "x-39",
        "deuterium drops", "deuterium", "pectasol-c", "pectasol", "apex",
    }


def _escape_for_regex(name: str) -> str:
    """
    Escape special regex characters in a protocol name.

    Handles special characters like +, #, (, ), etc.
    """
    # Escape special regex characters
    escaped = re.escape(name)
    # Allow flexible whitespace matching
    escaped = escaped.replace(r"\ ", r"\s*")
    return escaped


def _generate_pattern_for_name(name: str) -> str:
    """
    Generate a regex pattern for a single protocol name.

    Handles variations in spacing and common formatting differences.
    """
    # Handle names with numbers that might have spacing variations
    # e.g., "Mito Leak 2" should match "Mito Leak2" and vice versa
    pattern = _escape_for_regex(name)

    # Make number spacing optional (e.g., "Leak 2" -> "Leak\s*2")
    pattern = re.sub(r"(\d+)", r"\\s*\1", pattern)

    return rf"\b({pattern})\b"


def get_frequency_patterns() -> list[str]:
    """
    Generate regex patterns for all approved frequencies.

    This is the main entry point for chunker.py.

    Returns:
        List of regex patterns for frequency detection
    """
    cache_key = "frequency_patterns"

    if _is_cache_valid(cache_key):
        _, data = _cache[cache_key]
        return list(data)

    try:
        client = get_supabase_client()
        result = (
            client.table("approved_frequency_names")
            .select("name, aliases")
            .eq("is_active", True)
            .execute()
        )

        patterns: set[str] = set()
        for row in result.data or []:
            name = row.get("name", "")
            if name:
                patterns.add(_generate_pattern_for_name(name))

            # Also generate patterns for aliases
            aliases = row.get("aliases") or []
            for alias in aliases:
                if alias:
                    patterns.add(_generate_pattern_for_name(alias))

        logger.info(f"Generated {len(patterns)} frequency patterns from database")
        _cache[cache_key] = (time.time(), patterns)
        return list(patterns)

    except Exception as e:
        logger.error(f"Failed to generate frequency patterns: {e}")
        return _get_fallback_frequency_patterns()


def _get_fallback_frequency_patterns() -> list[str]:
    """Fallback patterns if database is unavailable."""
    logger.warning("Using fallback frequency patterns")
    return [
        r"\b(SNS\s*Balance)\b",
        r"\b(Medula\s*Support)\b",
        r"\b(Pit\s*P\s*Support|Pituitary\s*P\s*Support)\b",
        r"\b(Vagus\s*Support)\b",
        r"\b(PNS\s*Support)\b",
        r"\b(Cyto\s*Lower)\b",
        r"\b(Leptin\s*Resist)\b",
        r"\b(Kidney\s*Support)\b",
        r"\b(Kidney\s*Vitality)\b",
        r"\b(Kidney\s*Repair)\b",
        r"\b(CP-?P|Central\s*Pain\s*Protocol?)\b",
        r"\b(Alpha\s*Theta)\b",
        r"\b(Biotoxin)\b",
        r"\b(Sacral\s*Plexus)\b",
        r"\b(NS\s*EMF)\b",
        r"\b(Melanin)\b",
        r"\b(Concussion\s*Brain\s*Balance)\b",
    ]


def get_supplement_patterns() -> list[str]:
    """
    Get regex patterns for supplement detection.

    Currently hardcoded as supplements are not in a separate DB table.

    Returns:
        List of regex patterns for supplement detection
    """
    return [
        r"\b(Serculate)\b",
        r"\b(Cell\s*Synergy)\b",
        r"\b(Tri\s*Salts)\b",
        r"\b(X[-\s]?39)\b",
        r"\b(Deuterium\s*Drops?|Deuterium)\b",
        r"\b(Pectasol[-\s]?C|Pectasol)\b",
        r"\b(Apex)\b",
        r"\b(LifeWave)\b",
    ]


def clear_cache() -> None:
    """Clear all cached data (useful for testing or forcing refresh)."""
    global _cache
    _cache = {}
    logger.info("Protocol loader cache cleared")
