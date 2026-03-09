"""
Batch Processing Utilities for rate-limited API calls.

Provides tools to process items in batches with:
- Concurrency limiting
- Rate limiting between batches
- Progress tracking
- Error handling
"""

import asyncio
from dataclasses import dataclass
from typing import Any, Callable, Optional, TypeVar

from app.utils.logger import get_logger

logger = get_logger("batch")

T = TypeVar("T")
R = TypeVar("R")


@dataclass
class BatchProgress:
    """Progress tracking for batch processing."""

    total: int
    completed: int
    failed: int
    current_item: Optional[str] = None

    @property
    def percent(self) -> float:
        return (self.completed / self.total * 100) if self.total > 0 else 0

    def __str__(self) -> str:
        return f"{self.completed}/{self.total} ({self.percent:.1f}%) - {self.failed} failed"


async def process_with_rate_limit(
    items: list[T],
    processor: Callable[[T], Any],
    max_concurrent: int = 5,
    delay_between_batches: float = 1.0,
    on_progress: Optional[Callable[[BatchProgress], None]] = None,
) -> list[Any]:
    """
    Process items with rate limiting for API calls.

    Especially important for Vision API calls which have rate limits.

    Args:
        items: List of items to process
        processor: Async function to process each item
        max_concurrent: Maximum concurrent API calls
        delay_between_batches: Delay in seconds between batches
        on_progress: Optional callback for progress updates

    Returns:
        List of results (including exceptions as results)
    """
    semaphore = asyncio.Semaphore(max_concurrent)
    progress = BatchProgress(total=len(items), completed=0, failed=0)
    results = []

    async def process_with_semaphore(item: T, index: int) -> Any:
        async with semaphore:
            try:
                result = await processor(item)
                progress.completed += 1
                return result
            except Exception as e:
                progress.failed += 1
                return {"error": str(e), "item_index": index}
            finally:
                if on_progress:
                    on_progress(progress)
                # Small delay to avoid rate limits
                await asyncio.sleep(delay_between_batches / max_concurrent)

    tasks = [process_with_semaphore(item, i) for i, item in enumerate(items)]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    return results


async def process_in_batches(
    items: list[T],
    processor: Callable[[list[T]], Any],
    batch_size: int = 10,
    delay_between_batches: float = 1.0,
    on_progress: Optional[Callable[[BatchProgress], None]] = None,
) -> list[Any]:
    """
    Process items in fixed-size batches.

    Useful for APIs that support batch operations (like embeddings).

    Args:
        items: List of items to process
        processor: Async function to process a batch of items
        batch_size: Number of items per batch
        delay_between_batches: Delay in seconds between batches
        on_progress: Optional callback for progress updates

    Returns:
        List of all results
    """
    progress = BatchProgress(total=len(items), completed=0, failed=0)
    all_results = []

    for i in range(0, len(items), batch_size):
        batch = items[i : i + batch_size]

        try:
            results = await processor(batch)
            all_results.extend(results if isinstance(results, list) else [results])
            progress.completed += len(batch)
        except Exception as e:
            progress.failed += len(batch)
            all_results.extend([{"error": str(e), "batch_start": i}] * len(batch))

        if on_progress:
            on_progress(progress)

        # Delay between batches
        if i + batch_size < len(items):
            await asyncio.sleep(delay_between_batches)

    return all_results


class ProgressReporter:
    """Simple progress reporter that logs to console."""

    def __init__(self, prefix: str = "Processing"):
        self.prefix = prefix
        self._last_percent = -1

    def __call__(self, progress: BatchProgress) -> None:
        # Only log on significant progress changes
        current_percent = int(progress.percent)
        if current_percent > self._last_percent:
            self._last_percent = current_percent
            logger.info(f"{self.prefix}: {progress}")
