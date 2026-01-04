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
from dataclasses import dataclass
from typing import Any, Literal

from app.embeddings.embedder import embed_query
from app.services.supabase import get_supabase_client
from app.tools.query_analyzer import QueryAnalysis, analyze_query


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
        print(f"Warning: Failed to log RAG query: {e}")


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
    threshold: float = 0.6,
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

        # Get Supabase client
        client = get_supabase_client()

        # Use smart search function V2 with role filtering
        result = client.rpc(
            "smart_search_documents_v2",
            {
                "p_query_embedding": query_embedding,
                "p_user_id": user_id,
                "p_user_role": user_role,
                "p_tag_names": analysis.all_tags() or None,
                "p_body_systems": body_systems,
                "p_document_categories": document_categories,
                "p_include_related": include_related and analysis.should_expand,
                "p_match_threshold": threshold,
                "p_match_count": limit,
            },
        ).execute()

        # Convert to SearchResult objects
        results = []
        for row in result.data or []:
            results.append(
                SearchResult(
                    content=row["content"],
                    title=row["title"] or row["filename"],
                    filename=row["filename"],
                    body_system=row["body_system"],
                    document_category=row["document_category"],
                    role_scope=row.get("role_scope"),
                    similarity=row["similarity"],
                    match_type=row["match_type"],
                    matched_tags=row["matched_tags"] or [],
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
    threshold: float = 0.7,
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
    analysis = await analyze_query(query)

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

    # Perform smart search with role filtering
    results = await smart_search(
        query=query,
        user_id=user_id,
        user_role=user_role,
        conversation_id=conversation_id,
        analysis=analysis,
        document_categories=document_categories,
        limit=limit,
        threshold=threshold,
    )

    if not results:
        return "No relevant documents found in the knowledge base."

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
