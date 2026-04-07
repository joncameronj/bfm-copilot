"""
RAG Search Tool - Smart search with condition expansion and multi-category support.

Provides intelligent knowledge base search that:
1. Extracts conditions/symptoms from queries
2. Expands to related conditions
3. Searches across multiple document categories
4. Returns results with match type (direct vs related)
5. Filters results by user role (educational vs clinical content)
6. Boosts results containing matching protocols (from diagnostic mappings)
"""

import asyncio
import hashlib
import re
import time
import httpx
import os
from dataclasses import dataclass, field
from typing import Any, Literal

# Shared httpx client for Supabase RPC calls — avoids TLS handshake per request.
_supabase_http_client: httpx.AsyncClient | None = None


def _get_supabase_http_client() -> httpx.AsyncClient:
    """Return a persistent httpx client for Supabase RPC calls."""
    global _supabase_http_client
    if _supabase_http_client is None or _supabase_http_client.is_closed:
        _supabase_http_client = httpx.AsyncClient(
            limits=httpx.Limits(max_keepalive_connections=10, max_connections=20),
            timeout=30.0,
        )
    return _supabase_http_client


async def close_supabase_http_client() -> None:
    """Close the shared httpx client (call on app shutdown)."""
    global _supabase_http_client
    if _supabase_http_client is not None and not _supabase_http_client.is_closed:
        await _supabase_http_client.aclose()
        _supabase_http_client = None

from app.embeddings.embedder import embed_query
from app.embeddings.chunker import extract_protocols_from_text, normalize_protocol_name
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

# Deep-dive retrieval controls for chat tool usage.
DEEP_DIVE_NOTICE_PREFIX = "[DEEP_DIVE_NOTICE]"
STANDARD_TOOL_MAX_LIMIT = 8
DEEP_DIVE_TOOL_MAX_LIMIT = 20
DEEP_DIVE_TOOL_MIN_LIMIT = 10


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
    # Protocol boosting fields
    matched_protocols: list[str] = field(default_factory=list)
    protocol_boost: float = 0.0  # Boost applied for protocol matches

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
            "matched_protocols": self.matched_protocols,
            "protocol_boost": self.protocol_boost,
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

    client = _get_supabase_http_client()
    resp = await client.post(
        f'{settings.supabase_url}/rest/v1/rpc/bfm_search_20250122',
        headers=headers,
        json=payload,
        timeout=30.0,
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


def _boost_by_protocols(
    results: list[SearchResult],
    target_protocols: list[str],
    boost_factor: float = 0.15,
) -> list[SearchResult]:
    """
    Boost search results that contain matching protocols.

    This post-processing step increases the effective similarity score
    for results that mention protocols suggested by the query analysis.
    Sunday content with matching protocols gets priority.

    Args:
        results: Search results to process
        target_protocols: Protocols to look for (from QueryAnalysis)
        boost_factor: Amount to boost similarity (0.0-0.3)

    Returns:
        Results sorted by boosted similarity score
    """
    if not target_protocols:
        return results

    # Normalize target protocols for matching
    target_normalized = {
        normalize_protocol_name(p).lower()
        for p in target_protocols
    }

    boosted_results: list[SearchResult] = []

    for result in results:
        # Extract protocols from result content
        content_protocols = extract_protocols_from_text(result.content)
        all_content_protocols = (
            content_protocols["frequencies"] +
            content_protocols["supplements"]
        )
        content_normalized = {
            normalize_protocol_name(p).lower()
            for p in all_content_protocols
        }

        # Find matching protocols
        matched = target_normalized.intersection(content_normalized)

        if matched:
            # Calculate boost based on number of matches
            match_ratio = len(matched) / max(len(target_normalized), 1)
            protocol_boost = boost_factor * match_ratio

            # Extra boost for master reference content (authoritative source)
            if result.document_category == "master_reference":
                protocol_boost *= 2.0
            # Extra boost for Sunday content (tactical/case study)
            elif result.seminar_day == "sunday":
                protocol_boost *= 1.5

            result.matched_protocols = list(matched)
            result.protocol_boost = protocol_boost
            result.similarity = min(1.0, result.similarity + protocol_boost)
        else:
            # Still boost master_reference docs even without protocol match
            if result.document_category == "master_reference":
                result.protocol_boost = boost_factor * 0.5
                result.similarity = min(1.0, result.similarity + result.protocol_boost)
            else:
                result.protocol_boost = 0.0
            result.matched_protocols = []

        boosted_results.append(result)

    # Re-sort by boosted similarity
    return sorted(boosted_results, key=lambda x: x.similarity, reverse=True)


def _extract_target_protocols(analysis: QueryAnalysis) -> list[str]:
    """
    Extract all target protocols from a query analysis.

    Combines suggested frequencies and supplements from diagnostic mappings.

    Args:
        analysis: Analyzed query with protocol suggestions

    Returns:
        List of protocol names to search for
    """
    protocols: set[str] = set()

    # From diagnostic mappings
    if analysis.suggested_frequencies:
        protocols.update(analysis.suggested_frequencies)
    if analysis.suggested_supplements:
        protocols.update(analysis.suggested_supplements)

    # Also check if query mentions specific protocols directly
    # (already handled in enrich_analysis_with_protocols)

    return list(protocols)


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
    precomputed_embedding: list[float] | None = None,
) -> list[SearchResult]:
    """
    Parallel search across all seminar days with Sunday prioritization.

    Strategy:
    1. Run all three day searches in parallel (Sunday, Saturday, Friday)
    2. Prioritize Sunday results (tactical case studies, protocols)
    3. Include Saturday/Friday only if insufficient Sunday results
    4. Deduplicate and boost by protocol matches

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
        min_sunday_results: Minimum high-quality Sunday results before including other days

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

        # Use precomputed embedding if available, otherwise generate
        query_embedding = precomputed_embedding if precomputed_embedding is not None else await embed_query(query)
        tag_names = analysis.all_tags() if analysis else None
        should_expand = include_related and (analysis.should_expand if analysis else True)

        # Run searches in parallel: master_reference + Sunday/Saturday/Friday
        # Master reference docs are the authoritative protocol key and always searched
        get_logger().info("[RAG] Running parallel search: master_reference + all seminar days")
        parallel_start = time.time()

        # Master reference search — always included, lower threshold
        master_ref_task = _search_with_day_filter(
            query_embedding=query_embedding,
            user_id=user_id,
            user_role=user_role,
            seminar_day=None,  # No day filter
            body_systems=body_systems,
            document_categories=["master_reference"],
            tag_names=tag_names,
            include_related=should_expand,
            threshold=max(threshold - 0.10, 0.30),  # Lower threshold for master ref
            limit=5,
        )
        sunday_task = _search_with_day_filter(
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
        saturday_task = _search_with_day_filter(
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
        friday_task = _search_with_day_filter(
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

        master_results, sunday_results, saturday_results, friday_results = await asyncio.gather(
            master_ref_task, sunday_task, saturday_task, friday_task
        )

        parallel_elapsed = time.time() - parallel_start
        get_logger().info(f"[PERF] Parallel search took {parallel_elapsed:.2f}s")

        # Count high-quality results
        high_quality_sunday = len([r for r in sunday_results if r.similarity >= threshold])
        get_logger().info(
            f"[RAG] Search results: Master={len(master_results)}, "
            f"Sunday={len(sunday_results)} ({high_quality_sunday} HQ), "
            f"Saturday={len(saturday_results)}, Friday={len(friday_results)}"
        )

        # Build final result list: master_reference first, then Sunday
        all_results: list[SearchResult] = list(master_results) + list(sunday_results)

        # Only include Saturday/Friday if insufficient Sunday results
        if high_quality_sunday < min_sunday_results:
            all_results.extend(saturday_results)
            total_high_quality = len([r for r in all_results if r.similarity >= threshold])
            if total_high_quality < min_sunday_results + 2:
                all_results.extend(friday_results)

        # Deduplicate results
        deduped = _deduplicate_results(all_results)

        # Apply protocol boosting if analysis has suggested protocols
        target_protocols = _extract_target_protocols(analysis)
        if target_protocols:
            get_logger().info(f"[RAG] Boosting for protocols: {target_protocols}")
            results = _boost_by_protocols(deduped, target_protocols)[:limit]
            boosted_count = len([r for r in results if r.protocol_boost > 0])
            get_logger().info(f"[RAG] Protocol boost applied to {boosted_count} results")
        else:
            results = deduped[:limit]

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

        client = _get_supabase_http_client()
        resp = await client.post(
            f'{settings.supabase_url}/rest/v1/rpc/bfm_search_20250122',
            headers=headers,
            json=payload,
            timeout=30.0,
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

    # Map file_types to document_categories if provided.
    # IMPORTANT: include seminar_transcript so Sunday session chunks are not
    # accidentally excluded when callers pass file_type filters.
    # IMPORTANT: always include master_reference — these are the authoritative
    # source of truth for all protocol decisions.
    category_map: dict[str, list[str]] = {
        "medical_protocol": ["protocol", "seminar_transcript", "master_reference"],
        "lab_interpretation": ["lab_guide", "seminar_transcript", "master_reference"],
        "diagnostic_report": ["care_guide", "seminar_transcript", "master_reference"],
        "ip_material": ["seminar_transcript", "reference", "master_reference"],
    }
    document_categories = None
    if file_types:
        mapped_categories: list[str] = []
        for ft in file_types:
            mapped_categories.extend(category_map.get(ft, [ft]))
        # Always include master_reference
        if "master_reference" not in mapped_categories:
            mapped_categories.append("master_reference")
        # De-duplicate while preserving order.
        document_categories = list(dict.fromkeys(mapped_categories))

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

        # Add protocol boost indicator if present
        if result.protocol_boost > 0:
            match_indicator += " [Protocol Match]"

        # Build result block
        header = f"[{i}] {match_indicator} {result.title}"
        if result.body_system:
            header += f" ({result.body_system})"
        header += f" - Relevance: {similarity_pct}%"

        # Add matched tags if present
        tags_line = ""
        if result.matched_tags:
            tags_line = f"Tags: {', '.join(result.matched_tags[:5])}"

        # Add matched protocols if present
        protocols_line = ""
        if result.matched_protocols:
            protocols_line = f"Protocols: {', '.join(result.matched_protocols[:5])}"

        block = f"{header}\n"
        if tags_line:
            block += f"{tags_line}\n"
        if protocols_line:
            block += f"{protocols_line}\n"
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


# =============================================================================
# Tool Schema + Handler for custom AgentRunner
# =============================================================================

RAG_SEARCH_TOOL_SCHEMA = {
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
}

RAG_SEARCH_TOOL_DESCRIPTION = """Search the BFM health knowledge base for protocols, lab interpretation guides,
seminar presentations, and clinical documentation. This tool intelligently expands
searches to include related conditions. For example, when searching for thyroid issues,
it will also find adrenal and iron deficiency protocols that commonly co-occur.

Content includes:
- BFM Master Protocol Key (authoritative reference for all protocols, deal breakers,
  lab mappings, condition protocols, supplements, contraindications, and the Five Archimedes
  Levers — Melatonin, Leptin, MSH, Vitamin D, UB Rates — Dr. Rob's foundational framework.
  Also referred to as "5 Levers", "5 Archimedes Levers", "the levers", or "master levers".)
- BFM seminar slides (Friday/Saturday/Sunday sessions) with case studies and walkthroughs
- Supplement reference with dosages, timing, indications, and brands
- Frequency protocol details and mitochondrial frequency settings

ALWAYS search this knowledge base before recommending any protocol, supplement, or
frequency. The Master Protocol Key is the definitive source of truth."""


def create_search_handler(
    user_id: str,
    user_role: Literal["admin", "practitioner", "member"],
    conversation_id: str | None = None,
    deep_dive: bool = False,
):
    """Create an async handler for the search tool with user context injected via closure."""

    def normalize_limit(requested_limit: int) -> tuple[int, str | None]:
        normalized = max(1, requested_limit)

        if deep_dive:
            capped = min(max(normalized, DEEP_DIVE_TOOL_MIN_LIMIT), DEEP_DIVE_TOOL_MAX_LIMIT)
            if capped != normalized:
                return (
                    capped,
                    (
                        f"{DEEP_DIVE_NOTICE_PREFIX} Retrieval capped at {capped} chunks "
                        "(Deep Dive guardrail)."
                    ),
                )
            return capped, None

        capped = min(normalized, STANDARD_TOOL_MAX_LIMIT)
        return capped, None

    async def handler(
        query: str,
        file_types: list[str] | None = None,
        limit: int = 5,
    ) -> str:
        normalized_limit, notice = normalize_limit(limit)
        result = await search_knowledge_base(
            query=query,
            user_id=user_id,
            user_role=user_role,
            conversation_id=conversation_id,
            file_types=file_types,
            limit=normalized_limit,
        )
        if notice:
            return f"{notice}\n{result}"
        return result

    return handler
