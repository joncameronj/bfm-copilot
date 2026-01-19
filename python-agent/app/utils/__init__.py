"""Utils package for RAG observability and logging."""

from app.utils.logger import (
    get_logger,
    log_search_start,
    log_query_analysis,
    log_search_results,
    log_search_params,
)

__all__ = [
    "get_logger",
    "log_search_start",
    "log_query_analysis",
    "log_search_results",
    "log_search_params",
]
