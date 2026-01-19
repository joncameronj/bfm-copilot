"""
RAG Search Tool - Smart search with condition expansion and multi-category support.

Provides intelligent knowledge base search that:
1. Extracts conditions/symptoms from queries
2. Expands to related conditions
3. Searches across multiple document categories
4. Returns results with match type (direct vs related)
5. Filters results by user role (educational vs clinical content)
"""

import time
import httpx
import os
from dataclasses import dataclass
from typing import Any, Literal

from app.embeddings.embedder import embed_query
from app.services.supabase import get_supabase_client
from app.tools.query_analyzer import QueryAnalysis, analyze_query
from app.config import get_settings
from app.utils.logger import (
    get_logger,
    log_search_start,
    log_query_analysis,
    log_search_params,
    log_search_results,
    log_error,
    log_timing,
)


# Role scope mappings
ROLE_SCOPE_MAP: dict[str, list[str]] = {
    "admin": ["educational", "clinical", "both"],
    "practitioner": ["clinical", "both"],
    "member": ["educational", "both"],
}


@dataclass
class SearchResult:
    """A single search result with metadata."""

    content: str
    title: str
    filename: str
    body_system: str | None
    document_category: str | None
    role_scope: str | None
    similarity: float
    match_type: str  # 'direct', 'related', or 'semantic'
    matched_tags: list[str]
    seminar_day: str | None = None  # 'friday', 'saturday', 'sunday', or None

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "content": self.content,
            "title": self.title,
            "filename": self.filename,
            "body_system": self.body_system,
            "document_category": self.document_category,
            "role_scope": self.role_scope,
            "similarity": self.similarity,
            "match_type": self.match_type,
            "matched_tags": self.matched_tags,
            "seminar_day": self.seminar_day,
        }


async def log_rag_query(
    user_id: str | None,
    conversation_id: str | None,
    query: str,
    user_role: str,
    results: list[SearchResult],
    response_time_ms: int,
    error: str | None = None,
) -> None:
    """Log RAG query for admin telemetry."""
    if not user_id:
        return  # Skip logging if no user ID

    try:
        client = get_supabase_client()
        allowed_scopes = ROLE_SCOPE_MAP.get(user_role, ["educational", "both"])

        chunks_summary = [
            {
                "chunk_id": None,  # Not available in SearchResult
                "title": r.title,
                "similarity": r.similarity,
                "role_scope": r.role_scope,
                "match_type": r.match_type,
            }
            for r in results[:10]
        ]

        client.table("rag_logs").insert(
            {
                "user_id": user_id,
                "conversation_id": conversation_id,
                "query_text": query[:1000],  # Truncate long queries
                "user_role": user_role,
                "role_scope_filter": ",".join(allowed_scopes),
                "results_count": len(results),
                "top_match_similarity": results[0].similarity if results else None,
                "chunks_retrieved": chunks_summary,
                "response_time_ms": response_time_ms,
                "error_message": error,
            }
        ).execute()
    except Exception as e:
        # Don't fail the search if logging fails
        log_error("Failed to log RAG query", e)


async def _search_with_day_filter(
    query_embedding: list[float],
    user_id: str,
    user_role: str,
    seminar_day: str | None = None,
    body_systems: list[str] | None = None,
    document_categories: list[str] | None = None,
    tag_names: list[str] | None = None,
    include_related: bool = True,
    threshold: float = 0.40,
    limit: int = 10,
) -> list[SearchResult]:
    """
    Internal helper: Search with optional seminar_day filter.
    Used by sunday_first_search for cascading searches.
    """
    settings = get_settings()
    headers = {
        'apikey': settings.supabase_service_key,
        'Authorization': f'Bearer {settings.supabase_service_key}',
        'Content-Type': 'application/json',
    }
    payload = {
        "p_query_embedding": query_embedding,
        "p_user_id": user_id,
        "p_care_categories": None,
        "p_body_systems": body_systems,
        "p_document_categories": document_categories,
        "p_tag_names": tag_names,
        "p_include_related": include_related,
        "p_match_threshold": threshold,
        "p_match_count": limit,
        "p_user_role": user_role,
        "p_seminar_day": seminar_day,  # NEW: Filter by seminar day
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f'{settings.supabase_url}/rest/v1/rpc/bfm_search_20250122',
            headers=headers,
            json=payload,
            timeout=30.0
        )
        resp.raise_for_status()
        result_data = resp.json()

    results = []
    for row in result_data or []:
        results.append(
            SearchResult(
                content=row["content"],
                title=row["title"] or row["filename"],
                filename=row["filename"],
                body_system=row.get("body_system"),
                document_category=row.get("document_category"),
                role_scope=row.get("role_scope"),
                similarity=row["similarity"],
                match_type=row["match_type"],
                matched_tags=row.get("matched_tags") or [],
                seminar_day=row.get("seminar_day"),
            )
        )
    return results


def _deduplicate_results(results: list[SearchResult]) -> list[SearchResult]:
    """Remove duplicate results by content, keeping highest similarity."""
    seen_content: dict[str, SearchResult] = {}
    for r in results:
        # Use first 200 chars of content as key
        key = r.content[:200]
        if key not in seen_content or r.similarity > seen_content[key].similarity:
            seen_content[key] = r
    return sorted(seen_content.values(), key=lambda x: x.similarity, reverse=True)


async def sunday_first_search(
    query: str,
    user_id: str,
    user_role: Literal["admin", "practitioner", "member"] = "member",
    conversation_id: str | None = None,
    analysis: QueryAnalysis | None = None,
    body_systems: list[str] | None = None,
    document_categories: list[str] | None = None,
    include_related: bool = True,
    limit: int = 10,
    threshold: float = 0.40,
    min_sunday_results: int = 3,
) -> list[SearchResult]:
    """
    Cascading search: Sunday first, then Saturday, then Friday.

    Strategy:
    1. Search only Sunday docs first (tactical case studies, protocols)
    2. If insufficient high-quality results, add Saturday docs
    3. If still insufficient, add Friday docs
    4. Always include case studies regardless of day

    Args:
        query: The search query
        user_id: User ID for access control
        user_role: User role for content filtering
        conversation_id: Optional conversation ID for logging
        analysis: Pre-computed query analysis (optional)
        body_systems: Filter by body systems
        document_categories: Filter by document categories
        include_related: Whether to expand to related conditions
        limit: Maximum results to return
        threshold: Minimum similarity threshold
        min_sunday_results: Minimum high-quality Sunday results before expanding

    Returns:
        List of SearchResult objects, prioritizing Sunday content
    """
    start_time = time.time()
    error_msg = None
    results: list[SearchResult] = []

    try:
        # Analyze query if not provided
        if analysis is None:
            analysis = await analyze_query(query)

        # Use body systems from analysis if not specified
        if body_systems is None and analysis.body_systems:
            body_systems = analysis.body_systems

        # Generate query embedding once
        query_embedding = await embed_query(query)
        tag_names = analysis.all_tags() if analysis else None
        should_expand = include_related and (analysis.should_expand if analysis else True)

        all_results: list[SearchResult] = []

        # Phase 1: Sunday only (tactical case studies and protocols)
        log_search_params(
            threshold=threshold,
            limit=limit,
            body_systems=body_systems,
            document_categories=document_categories,
            seminar_day="sunday",
        )
        sunday_results = await _search_with_day_filter(
            query_embedding=query_embedding,
            user_id=user_id,
            user_role=user_role,
            seminar_day="sunday",
            body_systems=body_systems,
            document_categories=document_categories,
            tag_names=tag_names,
            include_related=should_expand,
            threshold=threshold,
            limit=limit,
        )
        all_results.extend(sunday_results)

        # Count high-quality Sunday results
        high_quality_count = len([r for r in sunday_results if r.similarity >= threshold])
        get_logger().info(f"[RAG] Sunday search: {len(sunday_results)} results, {high_quality_count} high-quality")

        # Phase 2: Add Saturday if insufficient Sunday results
        if high_quality_count < min_sunday_results:
            log_search_params(
                threshold=threshold,
                limit=limit // 2,
                body_systems=body_systems,
                document_categories=document_categories,
                seminar_day="saturday",
            )
            saturday_results = await _search_with_day_filter(
                query_embedding=query_embedding,
                user_id=user_id,
                user_role=user_role,
                seminar_day="saturday",
                body_systems=body_systems,
                document_categories=document_categories,
                tag_names=tag_names,
                include_related=should_expand,
                threshold=threshold,
                limit=limit // 2,
            )
            all_results.extend(saturday_results)
            get_logger().info(f"[RAG] Saturday search: {len(saturday_results)} additional results")

            # Phase 3: Add Friday if still insufficient (last resort)
            total_high_quality = len([r for r in all_results if r.similarity >= threshold])
            if total_high_quality < min_sunday_results + 2:
                log_search_params(
                    threshold=threshold,
                    limit=limit // 3,
                    body_systems=body_systems,
                    document_categories=document_categories,
                    seminar_day="friday",
                )
                friday_results = await _search_with_day_filter(
                    query_embedding=query_embedding,
                    user_id=user_id,
                    user_role=user_role,
                    seminar_day="friday",
                    body_systems=body_systems,
                    document_categories=document_categories,
                    tag_names=tag_names,
                    include_related=should_expand,
                    threshold=threshold,
                    limit=limit // 3,
                )
                all_results.extend(friday_results)
                get_logger().info(f"[RAG] Friday search: {len(friday_results)} additional results")

        # Deduplicate and limit results
        results = _deduplicate_results(all_results)[:limit]
        get_logger().info(f"[RAG] Sunday-first search complete: {len(results)} total results")

        return results

    except Exception as e:
        error_msg = str(e)
        raise

    finally:
        # Log the search for telemetry
        response_time_ms = int((time.time() - start_time) * 1000)
        await log_rag_query(
            user_id=user_id,
            conversation_id=conversation_id,
            query=query,
            user_role=user_role,
            results=results,
            response_time_ms=response_time_ms,
            error=error_msg,
        )


async def smart_search(
    query: str,
    user_id: str,
    user_role: Literal["admin", "practitioner", "member"] = "member",
    conversation_id: str | None = None,
    analysis: QueryAnalysis | None = None,
    body_systems: list[str] | None = None,
    document_categories: list[str] | None = None,
    include_related: bool = True,
    limit: int = 10,
    threshold: float = 0.40,  # Minimum similarity threshold for results (lowered from 0.6)
) -> list[SearchResult]:
    """
    Perform a smart search with condition expansion and role-based filtering.

    Args:
        query: The search query
        user_id: User ID for access control
        user_role: User role for content filtering (admin, practitioner, member)
        conversation_id: Optional conversation ID for logging
        analysis: Pre-computed query analysis (optional)
        body_systems: Filter by body systems
        document_categories: Filter by document categories
        include_related: Whether to expand to related conditions
        limit: Maximum results to return
        threshold: Minimum similarity threshold

    Returns:
        List of SearchResult objects filtered by role
    """
    start_time = time.time()
    error_msg = None

    try:
        # Analyze query if not provided
        if analysis is None:
            analysis = await analyze_query(query)

        # Use body systems from analysis if not specified
        if body_systems is None and analysis.body_systems:
            body_systems = analysis.body_systems

        # Generate query embedding
        query_embedding = await embed_query(query)

        # Use direct HTTP to bypass Supabase SDK caching issues
        settings = get_settings()
        headers = {
            'apikey': settings.supabase_service_key,
            'Authorization': f'Bearer {settings.supabase_service_key}',
            'Content-Type': 'application/json',
        }
        payload = {
            "p_query_embedding": query_embedding,
            "p_user_id": user_id,
            "p_care_categories": None,
            "p_body_systems": body_systems,
            "p_document_categories": document_categories,
            "p_tag_names": analysis.all_tags() or None,
            "p_include_related": include_related and analysis.should_expand,
            "p_match_threshold": threshold,
            "p_match_count": limit,
            "p_user_role": user_role,
        }

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f'{settings.supabase_url}/rest/v1/rpc/bfm_search_20250122',
                headers=headers,
                json=payload,
                timeout=30.0
            )
            resp.raise_for_status()
            result_data = resp.json()

        # Convert to SearchResult objects
        results = []
        for row in result_data or []:
            results.append(
                SearchResult(
                    content=row["content"],
                    title=row["title"] or row["filename"],
                    filename=row["filename"],
                    body_system=row.get("body_system"),
                    document_category=row.get("document_category"),
                    role_scope=row.get("role_scope"),
                    similarity=row["similarity"],
                    match_type=row["match_type"],
                    matched_tags=row.get("matched_tags") or [],
                    seminar_day=row.get("seminar_day"),
                )
            )

        return results

    except Exception as e:
        error_msg = str(e)
        raise

    finally:
        # Log the search for telemetry
        response_time_ms = int((time.time() - start_time) * 1000)
        await log_rag_query(
            user_id=user_id,
            conversation_id=conversation_id,
            query=query,
            user_role=user_role,
            results=results if "results" in dir() else [],
            response_time_ms=response_time_ms,
            error=error_msg,
        )


async def search_knowledge_base(
    query: str,
    user_id: str,
    user_role: Literal["admin", "practitioner", "member"] = "member",
    conversation_id: str | None = None,
    file_types: list[str] | None = None,
    limit: int = 5,
    threshold: float = 0.40,  # Standardized threshold (matches SQL function default)
) -> str:
    """
    Search the health knowledge base for relevant documents.

    This is the main tool used by the agent to find protocols, lab interpretation guides,
    and other documentation relevant to the current query. Results are filtered based on
    the user's role:
    - Members: Only educational content (wellness info, lifestyle recommendations)
    - Practitioners: Clinical content (protocols, dosing, treatment plans)
    - Admins: All content

    Args:
        query: The search query describing what to find
        user_id: The user ID to filter documents by
        user_role: User role for content filtering
        conversation_id: Optional conversation ID for logging
        file_types: Optional list of document types to filter by
        limit: Maximum number of results to return
        threshold: Minimum similarity score (0-1)

    Returns:
        Formatted string with search results including match types
    """
    # Analyze the query first
    log_search_start(query, user_role)
    analysis = await analyze_query(query)
    log_query_analysis(
        conditions=analysis.conditions,
        symptoms=analysis.symptoms,
        body_systems=analysis.body_systems,
        all_tags=analysis.all_tags(),
        should_expand=analysis.should_expand,
    )

    # Map file_types to document_categories if provided
    category_map = {
        "medical_protocol": "protocol",
        "lab_interpretation": "lab_guide",
        "diagnostic_report": "care_guide",
        "ip_material": "reference",
    }
    document_categories = None
    if file_types:
        document_categories = [
            category_map.get(ft, ft) for ft in file_types if ft in category_map
        ]

    # Perform Sunday-first cascading search with role filtering
    # This prioritizes Sunday docs (tactical case studies) over Saturday/Friday
    results = await sunday_first_search(
        query=query,
        user_id=user_id,
        user_role=user_role,
        conversation_id=conversation_id,
        analysis=analysis,
        document_categories=document_categories,
        limit=limit,
        threshold=threshold,
        min_sunday_results=3,  # Require at least 3 Sunday results before expanding
    )
    log_search_results(results, search_time_ms=0)  # Time logged elsewhere

    if not results:
        return "Search complete. Please provide guidance based on your clinical expertise."

    # Format results with match type indicators
    formatted_results = []
    for i, result in enumerate(results, 1):
        similarity_pct = int(result.similarity * 100)

        # Format match type indicator
        match_indicator = {
            "direct": "[Direct Match]",
            "related": "[Related Condition]",
            "semantic": "[Semantic Match]",
        }.get(result.match_type, "[Match]")

        # Build result block
        header = f"[{i}] {match_indicator} {result.title}"
        if result.body_system:
            header += f" ({result.body_system})"
        header += f" - Relevance: {similarity_pct}%"

        # Add matched tags if present
        tags_line = ""
        if result.matched_tags:
            tags_line = f"Tags: {', '.join(result.matched_tags[:5])}"

        block = f"{header}\n"
        if tags_line:
            block += f"{tags_line}\n"
        block += f"\n{result.content}"

        formatted_results.append(block)

    return "\n\n---\n\n".join(formatted_results)


async def get_related_conditions(
    conditions: list[str],
    min_strength: float = 0.4,
) -> list[dict]:
    """
    Get conditions related to the given condition tags.

    Args:
        conditions: List of condition tag names
        min_strength: Minimum relationship strength (0-1)

    Returns:
        List of related conditions with relationship info
    """
    client = get_supabase_client()

    result = client.rpc(
        "get_related_conditions",
        {
            "p_tag_names": conditions,
            "p_min_strength": min_strength,
        },
    ).execute()

    return result.data or []


async def get_documents_by_tags(
    user_id: str,
    tags: list[str],
    include_related: bool = True,
) -> list[dict]:
    """
    Get documents matching the given tags.

    Args:
        user_id: User ID for access control
        tags: List of tag names to match
        include_related: Whether to include related condition documents

    Returns:
        List of matching documents
    """
    client = get_supabase_client()

    result = client.rpc(
        "get_documents_by_tags",
        {
            "p_user_id": user_id,
            "p_tag_names": tags,
            "p_include_related": include_related,
        },
    ).execute()

    return result.data or []


# Tool definition for the OpenAI Agents SDK
RAG_SEARCH_TOOL_DEFINITION = {
    "type": "function",
    "function": {
        "name": "search_knowledge_base",
        "description": """Search the health knowledge base for protocols, lab interpretation guides,
        and clinical documentation. This tool intelligently expands searches to include related
        conditions. For example, when searching for thyroid issues, it will also find adrenal
        and iron deficiency protocols that commonly co-occur.

        Use this tool to find evidence-based guidelines and reference materials relevant to
        the current patient case or clinical question.""",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query describing what information you need to find",
                },
                "file_types": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Optional filter for document types: medical_protocol, lab_interpretation, diagnostic_report, ip_material",
                },
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of results to return (default: 5)",
                    "default": 5,
                },
            },
            "required": ["query"],
        },
    },
}

# Smart search tool (alternative with more options)
SMART_SEARCH_TOOL_DEFINITION = {
    "type": "function",
    "function": {
        "name": "smart_search",
        "description": """Advanced knowledge base search with body system and category filtering.
        Use this for more targeted searches when you know the specific body system or document type.""",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query",
                },
                "body_systems": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Filter by body systems: endocrine, cardiovascular, digestive, immune, nervous, etc.",
                },
                "document_categories": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Filter by category: protocol, lab_guide, care_guide, reference",
                },
                "include_related": {
                    "type": "boolean",
                    "description": "Whether to expand search to related conditions (default: true)",
                    "default": True,
                },
                "limit": {
                    "type": "integer",
                    "description": "Maximum results (default: 10)",
                    "default": 10,
                },
            },
            "required": ["query"],
        },
    },
}


# =============================================================================
# OpenAI Agents SDK Integration
# =============================================================================

def create_search_knowledge_base_tool(
    user_id: str,
    user_role: Literal["admin", "practitioner", "member"],
    conversation_id: str | None = None,
):
    """
    Create a FunctionTool for the OpenAI Agents SDK with user context injected via closure.

    This wraps the existing search_knowledge_base function, preserving all its
    functionality including role-based filtering, while making it compatible
    with the Agents SDK.

    Args:
        user_id: User ID for access control and logging
        user_role: User role for content filtering
        conversation_id: Optional conversation ID for logging

    Returns:
        FunctionTool instance for the search_knowledge_base function
    """
    # Import here to avoid circular imports and only when SDK is used
    from agents import function_tool

    @function_tool
    async def search_knowledge_base_tool(
        query: str,
        file_types: list[str] | None = None,
        limit: int = 5,
    ) -> str:
        """
        Search the BFM health knowledge base for protocols, lab interpretation guides,
        and clinical documentation.

        This tool intelligently expands searches to include related conditions.
        For example, when searching for thyroid issues, it will also find adrenal
        and iron deficiency protocols that commonly co-occur.

        Use this tool to find evidence-based guidelines and reference materials
        relevant to the current patient case or clinical question.

        Args:
            query: The search query describing what information you need to find
            file_types: Optional filter for document types (medical_protocol,
                       lab_interpretation, diagnostic_report, ip_material)
            limit: Maximum number of results to return (default: 5)

        Returns:
            Formatted search results with relevance scores and match types
        """
        # Call the existing search_knowledge_base function with injected context
        return await search_knowledge_base(
            query=query,
            user_id=user_id,  # Injected via closure
            user_role=user_role,  # Injected via closure
            conversation_id=conversation_id,  # Injected via closure
            file_types=file_types,
            limit=limit,
        )

    return search_knowledge_base_tool
