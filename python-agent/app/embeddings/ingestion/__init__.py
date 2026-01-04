"""
Ingestion Pipeline for BFM assets.

Orchestrates the processing and indexing of:
- Raw transcripts (markdown)
- Case studies (images, PDFs)
- Frequency protocols (PDFs)
"""

from .pipeline import IngestionPipeline, ProcessingResult, AssetType
from .batch import process_with_rate_limit

__all__ = [
    "IngestionPipeline",
    "ProcessingResult",
    "AssetType",
    "process_with_rate_limit",
]
