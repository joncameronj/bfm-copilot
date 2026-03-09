"""
RAG Search API Route - Unified endpoint for all RAG searches.

This endpoint is the single source of truth for RAG searches across:
- AI Chat conversations
- Diagnostic analysis
- Protocol recommendations
"""

import time
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Literal

from app.tools.rag_search import sunday_first_search, smart_search
from app.tools.query_analyzer import analyze_query
from app.embeddings.embedder import embed_query

router = APIRouter()


class RagSearchRequest(BaseModel):
    """Request model for RAG search endpoint."""

    query: str = Field(..., description="The search query")
    user_id: str = Field(..., description="User ID for access control and logging")
    user_role: Literal["admin", "practitioner", "member"] = Field(
        default="practitioner",
        description="User role for content filtering",
    )
    conversation_id: str | None = Field(
        default=None,
        description="Optional conversation ID for logging context",
    )
    limit: int = Field(
        default=15,
        ge=1,
        le=50,
        description="Maximum number of results to return",
    )
    threshold: float = Field(
        default=0.40,
        ge=0.0,
        le=1.0,
        description="Minimum similarity threshold (0-1)",
    )
    body_systems: list[str] | None = Field(
        default=None,
        description="Filter by body systems (e.g., endocrine, cardiovascular)",
    )
    document_categories: list[str] | None = Field(
        default=None,
        description="Filter by document categories (e.g., protocol, lab_guide)",
    )
    include_related: bool = Field(
        default=True,
        description="Whether to expand search to related conditions",
    )
    enforce_sunday_first: bool = Field(
        default=True,
        description="Whether to prioritize Sunday seminar chunks before other days",
    )


class RagSearchResultItem(BaseModel):
    """A single search result item."""

    content: str
    title: str
    filename: str
    body_system: str | None
    document_category: str | None
    role_scope: str | None
    similarity: float
    match_type: str
    matched_tags: list[str]
    seminar_day: str | None
    search_phase: str | None


class RagSearchResponse(BaseModel):
    """Response model for RAG search endpoint."""

    results: list[RagSearchResultItem]
    total_count: int
    query: str
    threshold_used: float


@router.post("/rag/search", response_model=RagSearchResponse)
async def rag_search(request: RagSearchRequest) -> RagSearchResponse:
    """
    Unified RAG search endpoint.

    This is the single source of truth for all RAG searches in the system.
    It provides:
    - Query analysis and condition expansion
    - Role-based content filtering
    - Telemetry logging to rag_logs table
    - Consistent search behavior across all consumers

    Returns search results with similarity scores and match types.
    """
    try:
        if request.enforce_sunday_first:
            results = await sunday_first_search(
                query=request.query,
                user_id=request.user_id,
                user_role=request.user_role,
                conversation_id=request.conversation_id,
                body_systems=request.body_systems,
                document_categories=request.document_categories,
                include_related=request.include_related,
                limit=request.limit,
                threshold=request.threshold,
            )
        else:
            results = await smart_search(
                query=request.query,
                user_id=request.user_id,
                user_role=request.user_role,
                conversation_id=request.conversation_id,
                body_systems=request.body_systems,
                document_categories=request.document_categories,
                include_related=request.include_related,
                limit=request.limit,
                threshold=request.threshold,
            )

        # Convert SearchResult objects to response model
        result_items = [
            RagSearchResultItem(
                content=r.content,
                title=r.title,
                filename=r.filename,
                body_system=r.body_system,
                document_category=r.document_category,
                role_scope=r.role_scope,
                similarity=r.similarity,
                match_type=r.match_type,
                matched_tags=r.matched_tags,
                seminar_day=r.seminar_day,
                search_phase=(
                    "sunday_primary"
                    if r.seminar_day == "sunday"
                    else "seminar_secondary"
                    if r.seminar_day in {"friday", "saturday"}
                    else None
                ),
            )
            for r in results
        ]

        return RagSearchResponse(
            results=result_items,
            total_count=len(result_items),
            query=request.query,
            threshold_used=request.threshold,
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"RAG search failed: {str(e)}",
        )


# =============================================================================
# Debug Endpoint - Verbose diagnostic information
# =============================================================================


class RagDebugRequest(BaseModel):
    """Request model for RAG debug endpoint."""

    query: str = Field(..., description="The search query to debug")
    user_id: str = Field(
        default="00000000-0000-0000-0000-000000000000",
        description="User ID for access control (defaults to test UUID)",
    )
    user_role: Literal["admin", "practitioner", "member"] = Field(
        default="practitioner",
        description="User role for content filtering",
    )
    limit: int = Field(
        default=10,
        ge=1,
        le=50,
        description="Maximum number of results to return",
    )
    threshold: float = Field(
        default=0.40,
        ge=0.0,
        le=1.0,
        description="Minimum similarity threshold (0-1)",
    )


class QueryAnalysisInfo(BaseModel):
    """Query analysis breakdown."""

    conditions: list[str]
    symptoms: list[str]
    lab_markers: list[str]
    body_systems: list[str]
    intent: str
    should_expand: bool
    all_tags: list[str]


class SearchParamsInfo(BaseModel):
    """Search parameters sent to Supabase."""

    p_match_threshold: float
    p_match_count: int
    p_user_role: str
    p_tag_names: list[str] | None
    p_body_systems: list[str] | None
    p_document_categories: list[str] | None
    p_include_related: bool


class DebugResultItem(BaseModel):
    """A single debug result with full metadata."""

    rank: int
    title: str
    filename: str
    similarity: float
    similarity_pct: int
    match_type: str
    matched_tags: list[str]
    body_system: str | None
    document_category: str | None
    role_scope: str | None
    content_preview: str


class RagDebugResponse(BaseModel):
    """Response model for RAG debug endpoint."""

    query: str
    total_time_ms: int
    analysis_time_ms: int
    embedding_time_ms: int
    search_time_ms: int
    query_analysis: QueryAnalysisInfo
    search_params: SearchParamsInfo
    results_count: int
    results: list[DebugResultItem]


@router.post("/rag/debug", response_model=RagDebugResponse)
async def rag_debug(request: RagDebugRequest) -> RagDebugResponse:
    """
    Debug endpoint for RAG search with verbose diagnostic output.

    Returns detailed timing breakdown, query analysis, search parameters,
    and results with full metadata. Useful for:
    - Diagnosing why queries aren't finding expected content
    - Understanding how queries are analyzed and expanded
    - Seeing exact parameters sent to Supabase
    - Verifying content exists in the knowledge base
    """
    total_start = time.time()

    try:
        # Step 1: Analyze query
        analysis_start = time.time()
        analysis = await analyze_query(request.query)
        analysis_time_ms = int((time.time() - analysis_start) * 1000)

        # Step 2: Generate embedding (for timing purposes)
        embedding_start = time.time()
        await embed_query(request.query)
        embedding_time_ms = int((time.time() - embedding_start) * 1000)

        # Build search params info
        search_params = SearchParamsInfo(
            p_match_threshold=request.threshold,
            p_match_count=request.limit,
            p_user_role=request.user_role,
            p_tag_names=analysis.all_tags() or None,
            p_body_systems=analysis.body_systems or None,
            p_document_categories=None,
            p_include_related=analysis.should_expand,
        )

        # Step 3: Execute search
        search_start = time.time()
        results = await smart_search(
            query=request.query,
            user_id=request.user_id,
            user_role=request.user_role,
            analysis=analysis,
            limit=request.limit,
            threshold=request.threshold,
        )
        search_time_ms = int((time.time() - search_start) * 1000)

        # Build response
        total_time_ms = int((time.time() - total_start) * 1000)

        query_analysis = QueryAnalysisInfo(
            conditions=analysis.conditions,
            symptoms=analysis.symptoms,
            lab_markers=analysis.lab_markers,
            body_systems=analysis.body_systems,
            intent=analysis.intent,
            should_expand=analysis.should_expand,
            all_tags=analysis.all_tags(),
        )

        debug_results = [
            DebugResultItem(
                rank=i + 1,
                title=r.title,
                filename=r.filename,
                similarity=r.similarity,
                similarity_pct=int(r.similarity * 100),
                match_type=r.match_type,
                matched_tags=r.matched_tags,
                body_system=r.body_system,
                document_category=r.document_category,
                role_scope=r.role_scope,
                content_preview=r.content[:300] + "..." if len(r.content) > 300 else r.content,
            )
            for i, r in enumerate(results)
        ]

        return RagDebugResponse(
            query=request.query,
            total_time_ms=total_time_ms,
            analysis_time_ms=analysis_time_ms,
            embedding_time_ms=embedding_time_ms,
            search_time_ms=search_time_ms,
            query_analysis=query_analysis,
            search_params=search_params,
            results_count=len(results),
            results=debug_results,
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"RAG debug failed: {str(e)}",
        )
