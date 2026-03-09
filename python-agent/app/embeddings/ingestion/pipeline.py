"""
Ingestion Pipeline - Main orchestrator for processing BFM assets.

Processes all assets in the agent-assets directory:
- Raw transcripts (markdown files)
- Case studies (images, PDFs, DOCX)
- Frequency protocols (PDFs)
"""

import asyncio
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Optional

from app.utils.logger import get_logger

logger = get_logger("pipeline")

from app.embeddings.preprocessing import (
    clean_transcript,
    CleaningConfig,
    generate_frontmatter,
    infer_metadata_from_filename,
    process_image_with_vision,
    detect_image_type,
    extract_pdf_text,
    process_pdf_with_vision_fallback,
    extract_docx_text,
    extract_pptx_text,
)
from app.embeddings.chunker import chunk_by_paragraphs
from app.embeddings.embedder import get_embeddings_batch
from app.services.supabase import get_supabase_client

from .batch import process_with_rate_limit, ProgressReporter


class AssetType(Enum):
    """Types of assets that can be processed."""

    MARKDOWN = "markdown"
    PDF = "pdf"
    IMAGE = "image"
    DOCX = "docx"
    PPTX = "pptx"


@dataclass
class ProcessingResult:
    """Result of processing a single asset."""

    asset_path: Path
    asset_type: AssetType
    care_category: str
    document_id: Optional[str] = None
    success: bool = True
    error: Optional[str] = None
    chunks_created: int = 0
    tokens_used: int = 0
    processing_time_ms: int = 0


@dataclass
class IngestionStats:
    """Statistics for the ingestion run."""

    total_files: int = 0
    processed: int = 0
    failed: int = 0
    chunks_created: int = 0
    tokens_used: int = 0
    by_category: dict = field(default_factory=dict)
    by_type: dict = field(default_factory=dict)
    errors: list = field(default_factory=list)


# System user ID for global documents (admin user for BFM)
SYSTEM_USER_ID = "dd78e6d8-09a2-4754-8834-870c36ed89ce"


class IngestionPipeline:
    """
    Main pipeline for ingesting BFM assets into the vector database.

    Usage:
        pipeline = IngestionPipeline(Path("/path/to/agent-assets"))
        results = await pipeline.process_all()
    """

    def __init__(
        self,
        assets_dir: Path,
        global_user_id: str = SYSTEM_USER_ID,
        skip_images: bool = False,
        dry_run: bool = False,
    ):
        """
        Initialize the ingestion pipeline.

        Args:
            assets_dir: Path to the agent-assets directory
            global_user_id: User ID for global documents
            skip_images: If True, skip Vision API processing for images
            dry_run: If True, scan and report but don't index
        """
        self.assets_dir = assets_dir
        self.global_user_id = global_user_id
        self.skip_images = skip_images
        self.dry_run = dry_run
        self.stats = IngestionStats()

    async def process_all(self) -> list[ProcessingResult]:
        """
        Process all assets in the directory structure.

        Returns:
            List of ProcessingResult for each file
        """
        results = []
        categories = ["diabetes", "thyroid", "hormones", "neurological"]

        logger.info(f"{'='*60}")
        logger.info(f"BFM Asset Ingestion Pipeline")
        logger.info(f"Assets directory: {self.assets_dir}")
        logger.info(f"Dry run: {self.dry_run}")
        logger.info(f"Skip images: {self.skip_images}")
        logger.info(f"{'='*60}")

        for category in categories:
            category_path = self.assets_dir / category
            if category_path.exists():
                logger.info(f"Processing category: {category.upper()}")
                category_results = await self._process_category(category_path, category)
                results.extend(category_results)

                # Update stats
                self.stats.by_category[category] = len(
                    [r for r in category_results if r.success]
                )

        # Process root-level files (like conference transcripts)
        root_results = await self._process_root_files()
        results.extend(root_results)

        # Print summary
        self._print_summary(results)

        return results

    async def _process_category(
        self, category_path: Path, category: str
    ) -> list[ProcessingResult]:
        """Process all assets for a care category."""
        results = []

        # 1. Process raw transcripts
        raw_data_path = category_path / "raw-data"
        if raw_data_path.exists():
            logger.info(f"  Processing raw transcripts...")
            for md_file in raw_data_path.glob("*.md"):
                result = await self._process_markdown(md_file, category)
                results.append(result)
                self._update_stats(result)

        # 2. Process frequency PDFs at category level
        for pdf_file in category_path.glob("*frequencies*.pdf"):
            logger.info(f"  Processing frequency PDF: {pdf_file.name}")
            result = await self._process_pdf(pdf_file, category, "frequency_reference")
            results.append(result)
            self._update_stats(result)

        # 3. Process case studies
        case_studies_path = category_path / f"{category}-casestudies"
        if case_studies_path.exists():
            logger.info(f"  Processing case studies...")
            for case_dir in sorted(case_studies_path.iterdir()):
                if case_dir.is_dir() and not case_dir.name.startswith("."):
                    case_results = await self._process_case_study(case_dir, category)
                    results.extend(case_results)
                    for r in case_results:
                        self._update_stats(r)

        return results

    async def _process_case_study(
        self, case_dir: Path, category: str
    ) -> list[ProcessingResult]:
        """Process all files in a case study directory."""
        results = []
        case_id = case_dir.name

        logger.info(f"    Case study: {case_id}")

        # Process images
        if not self.skip_images:
            image_files = list(case_dir.glob("*.png")) + list(case_dir.glob("*.jpg"))
            for img_file in image_files:
                result = await self._process_image(img_file, category, case_id)
                results.append(result)

        # Process PDFs
        for pdf_file in case_dir.glob("*.pdf"):
            result = await self._process_pdf(pdf_file, category, "case_study", case_id)
            results.append(result)

        # Process DOCX
        for docx_file in case_dir.glob("*.docx"):
            result = await self._process_docx(docx_file, category, case_id)
            results.append(result)

        # Process PPTX
        for pptx_file in case_dir.glob("*.pptx"):
            result = await self._process_pptx(pptx_file, category, case_id)
            results.append(result)

        return results

    async def _process_markdown(
        self, filepath: Path, category: str
    ) -> ProcessingResult:
        """Process a markdown transcript file."""
        start_time = datetime.now()

        try:
            # Read content
            content = filepath.read_text(encoding="utf-8")

            # Clean the transcript
            cleaned_content, clean_metadata = clean_transcript(
                content, category, CleaningConfig(detect_sections_with_llm=False)
            )

            # Generate metadata
            doc_metadata = infer_metadata_from_filename(filepath)
            frontmatter = generate_frontmatter(doc_metadata)

            # Combine frontmatter and content
            full_content = f"{frontmatter}\n\n{cleaned_content}"

            if self.dry_run:
                return ProcessingResult(
                    asset_path=filepath,
                    asset_type=AssetType.MARKDOWN,
                    care_category=category,
                    success=True,
                    chunks_created=0,
                )

            # Index the document
            doc_id, chunks_count = await self._index_content(
                content=full_content,
                title=doc_metadata.title,
                care_category=category,
                source_type="transcript",
                filename=filepath.name,
                metadata={"cleaned_metadata": clean_metadata},
            )

            elapsed_ms = int((datetime.now() - start_time).total_seconds() * 1000)

            return ProcessingResult(
                asset_path=filepath,
                asset_type=AssetType.MARKDOWN,
                care_category=category,
                document_id=doc_id,
                success=True,
                chunks_created=chunks_count,
                processing_time_ms=elapsed_ms,
            )

        except Exception as e:
            return ProcessingResult(
                asset_path=filepath,
                asset_type=AssetType.MARKDOWN,
                care_category=category,
                success=False,
                error=str(e),
            )

    async def _process_image(
        self, filepath: Path, category: str, case_id: str
    ) -> ProcessingResult:
        """Process an image file using Vision API."""
        start_time = datetime.now()

        try:
            # Extract content using Vision API
            result = await process_image_with_vision(filepath)

            extracted_text = result["extracted_text"]
            image_type = result["image_type"]
            tokens_used = result.get("tokens_used", 0)

            if self.dry_run:
                return ProcessingResult(
                    asset_path=filepath,
                    asset_type=AssetType.IMAGE,
                    care_category=category,
                    success=True,
                    tokens_used=tokens_used,
                )

            # Generate metadata
            doc_metadata = infer_metadata_from_filename(filepath)

            # Create header with context
            header = f"""# {doc_metadata.title}

**Care Category:** {category}
**Case Study:** {case_id}
**Test Type:** {image_type}
**Source:** {filepath.name}

---

"""

            full_content = header + extracted_text

            # Index the document
            doc_id, chunks_count = await self._index_content(
                content=full_content,
                title=doc_metadata.title,
                care_category=category,
                source_type="case_study",
                filename=filepath.name,
                metadata={
                    "case_study_id": case_id,
                    "test_type": image_type,
                    "extraction_method": "vision",
                },
            )

            elapsed_ms = int((datetime.now() - start_time).total_seconds() * 1000)

            return ProcessingResult(
                asset_path=filepath,
                asset_type=AssetType.IMAGE,
                care_category=category,
                document_id=doc_id,
                success=True,
                chunks_created=chunks_count,
                tokens_used=tokens_used,
                processing_time_ms=elapsed_ms,
            )

        except Exception as e:
            return ProcessingResult(
                asset_path=filepath,
                asset_type=AssetType.IMAGE,
                care_category=category,
                success=False,
                error=str(e),
            )

    async def _process_pdf(
        self,
        filepath: Path,
        category: str,
        source_type: str,
        case_id: Optional[str] = None,
    ) -> ProcessingResult:
        """Process a PDF file."""
        start_time = datetime.now()

        try:
            # Extract text from PDF
            result = await process_pdf_with_vision_fallback(filepath)

            text_content = result["text_content"]
            method = result.get("method", "text")
            tokens_used = result.get("tokens_used", 0)

            if self.dry_run:
                return ProcessingResult(
                    asset_path=filepath,
                    asset_type=AssetType.PDF,
                    care_category=category,
                    success=True,
                    tokens_used=tokens_used,
                )

            # Generate metadata
            doc_metadata = infer_metadata_from_filename(filepath)

            # Index the document
            metadata = {
                "extraction_method": method,
            }
            if case_id:
                metadata["case_study_id"] = case_id

            doc_id, chunks_count = await self._index_content(
                content=text_content,
                title=doc_metadata.title,
                care_category=category,
                source_type=source_type,
                filename=filepath.name,
                metadata=metadata,
            )

            elapsed_ms = int((datetime.now() - start_time).total_seconds() * 1000)

            return ProcessingResult(
                asset_path=filepath,
                asset_type=AssetType.PDF,
                care_category=category,
                document_id=doc_id,
                success=True,
                chunks_created=chunks_count,
                tokens_used=tokens_used,
                processing_time_ms=elapsed_ms,
            )

        except Exception as e:
            return ProcessingResult(
                asset_path=filepath,
                asset_type=AssetType.PDF,
                care_category=category,
                success=False,
                error=str(e),
            )

    async def _process_docx(
        self, filepath: Path, category: str, case_id: str
    ) -> ProcessingResult:
        """Process a DOCX file."""
        start_time = datetime.now()

        try:
            # Extract text from DOCX
            result = extract_docx_text(filepath)

            if not result["has_content"]:
                return ProcessingResult(
                    asset_path=filepath,
                    asset_type=AssetType.DOCX,
                    care_category=category,
                    success=False,
                    error="No content found in document",
                )

            text_content = result["text_content"]

            if self.dry_run:
                return ProcessingResult(
                    asset_path=filepath,
                    asset_type=AssetType.DOCX,
                    care_category=category,
                    success=True,
                )

            # Generate metadata
            doc_metadata = infer_metadata_from_filename(filepath)

            # Index the document
            doc_id, chunks_count = await self._index_content(
                content=text_content,
                title=doc_metadata.title,
                care_category=category,
                source_type="case_study",
                filename=filepath.name,
                metadata={"case_study_id": case_id},
            )

            elapsed_ms = int((datetime.now() - start_time).total_seconds() * 1000)

            return ProcessingResult(
                asset_path=filepath,
                asset_type=AssetType.DOCX,
                care_category=category,
                document_id=doc_id,
                success=True,
                chunks_created=chunks_count,
                processing_time_ms=elapsed_ms,
            )

        except Exception as e:
            return ProcessingResult(
                asset_path=filepath,
                asset_type=AssetType.DOCX,
                care_category=category,
                success=False,
                error=str(e),
            )

    async def _process_pptx(
        self, filepath: Path, category: str, case_id: str
    ) -> ProcessingResult:
        """Process a PPTX file."""
        start_time = datetime.now()

        try:
            # Extract text from PPTX
            result = extract_pptx_text(filepath)

            if not result["has_content"]:
                return ProcessingResult(
                    asset_path=filepath,
                    asset_type=AssetType.PPTX,
                    care_category=category,
                    success=False,
                    error="No content found in presentation",
                )

            text_content = result["text_content"]

            if self.dry_run:
                return ProcessingResult(
                    asset_path=filepath,
                    asset_type=AssetType.PPTX,
                    care_category=category,
                    success=True,
                )

            # Generate metadata
            doc_metadata = infer_metadata_from_filename(filepath)

            # Index the document
            doc_id, chunks_count = await self._index_content(
                content=text_content,
                title=doc_metadata.title,
                care_category=category,
                source_type="case_study",
                filename=filepath.name,
                metadata={
                    "case_study_id": case_id,
                    "slide_count": result["slide_count"],
                    "has_notes": result["has_notes"],
                },
            )

            elapsed_ms = int((datetime.now() - start_time).total_seconds() * 1000)

            return ProcessingResult(
                asset_path=filepath,
                asset_type=AssetType.PPTX,
                care_category=category,
                document_id=doc_id,
                success=True,
                chunks_created=chunks_count,
                processing_time_ms=elapsed_ms,
            )

        except Exception as e:
            return ProcessingResult(
                asset_path=filepath,
                asset_type=AssetType.PPTX,
                care_category=category,
                success=False,
                error=str(e),
            )

    async def _process_root_files(self) -> list[ProcessingResult]:
        """Process files at the root of agent-assets directory."""
        results = []

        for md_file in self.assets_dir.glob("*.md"):
            logger.info(f"Processing root file: {md_file.name}")
            result = await self._process_markdown(md_file, "general")
            results.append(result)
            self._update_stats(result)

        return results

    async def _index_content(
        self,
        content: str,
        title: str,
        care_category: str,
        source_type: str,
        filename: str,
        metadata: Optional[dict] = None,
    ) -> tuple[str, int]:
        """
        Index content into the vector database.

        Returns:
            Tuple of (document_id, chunks_created)
        """
        client = get_supabase_client()

        # Map source_type to valid file_type values
        file_type_map = {
            "transcript": "ip_material",
            "case_study": "diagnostic_report",
            "frequency_reference": "medical_protocol",
        }
        file_type = file_type_map.get(source_type, "other")

        # Map source_type to valid document_category values
        doc_category_map = {
            "transcript": "seminar_transcript",
            "case_study": "case_study",
            "frequency_reference": "frequency_reference",
        }
        doc_category = doc_category_map.get(source_type, "other")

        # Create document record
        doc_result = client.table("documents").insert({
            "user_id": self.global_user_id,
            "filename": filename,
            "file_type": file_type,
            "mime_type": "text/markdown",
            "title": title,
            "body_system": _map_category_to_body_system(care_category),
            "document_category": doc_category,
            "care_category": care_category,
            "status": "processing",
            "is_global": True,
            "metadata": metadata or {},
        }).execute()

        doc_id = doc_result.data[0]["id"]

        # Chunk the content
        chunks = chunk_by_paragraphs(content)

        # Generate embeddings in batches
        chunk_texts = [chunk.content for chunk in chunks]
        embeddings = await get_embeddings_batch(chunk_texts)

        # Store chunks with embeddings
        chunk_records = []
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            chunk_records.append({
                "document_id": doc_id,
                "chunk_index": i,
                "content": chunk.content,
                "embedding": embedding,
                "token_count": chunk.token_count,
                "metadata": chunk.metadata,
            })

        # Insert chunks in batches
        BATCH_SIZE = 50
        for i in range(0, len(chunk_records), BATCH_SIZE):
            batch = chunk_records[i:i + BATCH_SIZE]
            client.table("document_chunks").insert(batch).execute()

        # Update document status
        client.table("documents").update({
            "status": "indexed",
            "total_chunks": len(chunk_records),
        }).eq("id", doc_id).execute()

        return doc_id, len(chunks)

    def _update_stats(self, result: ProcessingResult) -> None:
        """Update statistics with a processing result."""
        self.stats.total_files += 1

        if result.success:
            self.stats.processed += 1
            self.stats.chunks_created += result.chunks_created
            self.stats.tokens_used += result.tokens_used
        else:
            self.stats.failed += 1
            self.stats.errors.append({
                "file": str(result.asset_path),
                "error": result.error,
            })

        # Update by type
        type_name = result.asset_type.value
        self.stats.by_type[type_name] = self.stats.by_type.get(type_name, 0) + 1

    def _print_summary(self, results: list[ProcessingResult]) -> None:
        """Log a summary of the ingestion run."""
        logger.info(f"{'='*60}")
        logger.info("INGESTION SUMMARY")
        logger.info(f"{'='*60}")
        logger.info(f"Total files:     {self.stats.total_files}")
        logger.info(f"Processed:       {self.stats.processed}")
        logger.info(f"Failed:          {self.stats.failed}")
        logger.info(f"Chunks created:  {self.stats.chunks_created}")
        logger.info(f"Tokens used:     {self.stats.tokens_used}")
        logger.info(f"By Category:")
        for cat, count in self.stats.by_category.items():
            logger.info(f"  {cat}: {count}")
        logger.info(f"By Type:")
        for type_name, count in self.stats.by_type.items():
            logger.info(f"  {type_name}: {count}")

        if self.stats.errors:
            logger.error(f"Errors ({len(self.stats.errors)}):")
            for err in self.stats.errors[:5]:
                logger.error(f"  - {err['file']}: {err['error'][:50]}...")
            if len(self.stats.errors) > 5:
                logger.error(f"  ... and {len(self.stats.errors) - 5} more")

        logger.info(f"{'='*60}")


def _map_category_to_body_system(category: str) -> str:
    """Map care category to body system."""
    mapping = {
        "diabetes": "endocrine",
        "thyroid": "endocrine",
        "hormones": "endocrine",
        "neurological": "nervous",
        "general": "multi_system",  # General/energetic debt spans multiple systems
    }
    return mapping.get(category, "multi_system")
