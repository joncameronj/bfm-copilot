"""
RAG Structured Logger - Lightweight logging wrapper for RAG observability.

Provides formatted logging with helper functions for search operations.
Log level controlled by RAG_LOG_LEVEL environment variable.
"""

import logging
import os
import sys
from datetime import datetime
from typing import Any

# ANSI color codes for terminal output
COLORS = {
    "RESET": "\033[0m",
    "BOLD": "\033[1m",
    "DIM": "\033[2m",
    "RED": "\033[31m",
    "GREEN": "\033[32m",
    "YELLOW": "\033[33m",
    "BLUE": "\033[34m",
    "MAGENTA": "\033[35m",
    "CYAN": "\033[36m",
    "WHITE": "\033[37m",
}


def _colorize(text: str, color: str, bold: bool = False) -> str:
    """Apply ANSI color codes to text."""
    prefix = COLORS.get(color, "")
    if bold:
        prefix = COLORS["BOLD"] + prefix
    return f"{prefix}{text}{COLORS['RESET']}"


class ColoredFormatter(logging.Formatter):
    """Custom formatter with colors and timestamps."""

    LEVEL_COLORS = {
        "DEBUG": "CYAN",
        "INFO": "GREEN",
        "WARNING": "YELLOW",
        "ERROR": "RED",
        "CRITICAL": "RED",
    }

    def format(self, record: logging.LogRecord) -> str:
        # Add timestamp
        timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
        level_color = self.LEVEL_COLORS.get(record.levelname, "WHITE")

        # Format the message
        level_str = _colorize(f"[{record.levelname}]", level_color, bold=True)
        time_str = _colorize(f"[{timestamp}]", "DIM")
        module_str = _colorize(f"[{record.name}]", "BLUE")

        return f"{time_str} {level_str} {module_str} {record.getMessage()}"


def get_logger(name: str = "rag") -> logging.Logger:
    """
    Get a configured logger for RAG operations.

    Log level is controlled by RAG_LOG_LEVEL env var (default: INFO).
    Valid levels: DEBUG, INFO, WARNING, ERROR

    Args:
        name: Logger name (default: "rag")

    Returns:
        Configured logging.Logger instance
    """
    logger = logging.getLogger(f"rag.{name}")

    # Only configure if not already configured
    if not logger.handlers:
        # Get log level from environment
        level_name = os.environ.get("RAG_LOG_LEVEL", "INFO").upper()
        level = getattr(logging, level_name, logging.INFO)

        logger.setLevel(level)

        # Create console handler with colored formatter
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(level)
        handler.setFormatter(ColoredFormatter())

        logger.addHandler(handler)

        # Prevent propagation to root logger
        logger.propagate = False

    return logger


# =============================================================================
# Helper Functions for Common Log Operations
# =============================================================================


def log_search_start(query: str, user_role: str = "unknown") -> None:
    """Log the start of a RAG search operation."""
    logger = get_logger("search")
    logger.info(
        _colorize("Search Started", "CYAN", bold=True)
        + f" | Query: {_colorize(repr(query), 'WHITE')} | Role: {user_role}"
    )


def log_query_analysis(
    conditions: list[str],
    symptoms: list[str],
    body_systems: list[str],
    all_tags: list[str],
    should_expand: bool = True,
) -> None:
    """Log query analysis results."""
    logger = get_logger("analysis")

    parts = []
    if conditions:
        parts.append(f"conditions={_colorize(str(conditions), 'YELLOW')}")
    if symptoms:
        parts.append(f"symptoms={_colorize(str(symptoms), 'YELLOW')}")
    if body_systems:
        parts.append(f"body_systems={_colorize(str(body_systems), 'MAGENTA')}")
    if all_tags:
        parts.append(f"all_tags={_colorize(str(all_tags), 'CYAN')}")

    logger.info(
        _colorize("Query Analysis", "GREEN", bold=True)
        + f" | {' | '.join(parts) if parts else 'No tags extracted'}"
        + f" | expand={should_expand}"
    )


def log_search_params(
    threshold: float,
    limit: int,
    tag_names: list[str] | None,
    body_systems: list[str] | None,
    document_categories: list[str] | None,
    include_related: bool,
) -> None:
    """Log search parameters sent to Supabase."""
    logger = get_logger("search")

    params = [
        f"threshold={_colorize(str(threshold), 'YELLOW')}",
        f"limit={limit}",
    ]

    if tag_names:
        params.append(f"tags={tag_names}")
    if body_systems:
        params.append(f"systems={body_systems}")
    if document_categories:
        params.append(f"categories={document_categories}")

    params.append(f"include_related={include_related}")

    logger.debug(_colorize("Search Params", "BLUE", bold=True) + f" | {' | '.join(params)}")


def log_search_results(
    results: list[Any],
    search_time_ms: int,
    query: str | None = None,
) -> None:
    """Log search results summary."""
    logger = get_logger("search")

    count = len(results)
    count_str = _colorize(str(count), "GREEN" if count > 0 else "RED", bold=True)

    time_color = "GREEN" if search_time_ms < 500 else "YELLOW" if search_time_ms < 1000 else "RED"
    time_str = _colorize(f"{search_time_ms}ms", time_color)

    logger.info(
        _colorize("Search Complete", "GREEN", bold=True)
        + f" | Found: {count_str} results | Time: {time_str}"
    )

    # Log top results at DEBUG level
    if results and logger.isEnabledFor(logging.DEBUG):
        logger.debug(_colorize("Top Results:", "CYAN", bold=True))
        for i, r in enumerate(results[:5], 1):
            title = getattr(r, "title", str(r)[:50])
            similarity = getattr(r, "similarity", 0)
            match_type = getattr(r, "match_type", "unknown")
            sim_pct = int(similarity * 100)
            sim_color = "GREEN" if sim_pct >= 60 else "YELLOW" if sim_pct >= 40 else "RED"

            logger.debug(
                f"  [{i}] {_colorize(f'{sim_pct}%', sim_color)} "
                f"| {_colorize(match_type, 'MAGENTA')} "
                f"| {title}"
            )


def log_error(message: str, error: Exception | None = None) -> None:
    """Log an error message."""
    logger = get_logger("error")
    if error:
        logger.error(f"{message}: {error}")
    else:
        logger.error(message)


def log_timing(operation: str, time_ms: int) -> None:
    """Log timing information for an operation."""
    logger = get_logger("timing")
    time_color = "GREEN" if time_ms < 200 else "YELLOW" if time_ms < 500 else "RED"
    logger.debug(f"{operation}: {_colorize(f'{time_ms}ms', time_color)}")
