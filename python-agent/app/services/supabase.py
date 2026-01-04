from functools import lru_cache
from supabase import create_client, Client

from app.config import get_settings


@lru_cache
def get_supabase_client() -> Client:
    """Get Supabase client instance."""
    settings = get_settings()
    return create_client(
        settings.supabase_url,
        settings.supabase_service_key
    )


async def insert_document(
    user_id: str,
    filename: str,
    file_type: str,
    mime_type: str,
    storage_path: str | None = None,
) -> dict:
    """Create a new document record."""
    client = get_supabase_client()
    result = client.table("documents").insert({
        "user_id": user_id,
        "filename": filename,
        "file_type": file_type,
        "mime_type": mime_type,
        "storage_path": storage_path,
        "status": "pending",
    }).execute()
    return result.data[0] if result.data else {}


async def update_document_status(
    document_id: str,
    status: str,
    total_chunks: int | None = None,
    error_message: str | None = None,
) -> None:
    """Update document processing status."""
    client = get_supabase_client()
    update_data = {"status": status}
    if total_chunks is not None:
        update_data["total_chunks"] = total_chunks
    if error_message is not None:
        update_data["error_message"] = error_message

    client.table("documents").update(update_data).eq("id", document_id).execute()


async def insert_document_chunks(
    document_id: str,
    chunks: list[dict],
) -> None:
    """Insert document chunks with embeddings."""
    client = get_supabase_client()

    # Format chunks for insertion
    records = [
        {
            "document_id": document_id,
            "chunk_index": chunk["index"],
            "content": chunk["content"],
            "embedding": chunk["embedding"],
            "token_count": chunk.get("token_count"),
            "metadata": chunk.get("metadata", {}),
        }
        for chunk in chunks
    ]

    # Insert in batches of 100
    batch_size = 100
    for i in range(0, len(records), batch_size):
        batch = records[i : i + batch_size]
        client.table("document_chunks").insert(batch).execute()


async def search_documents(
    query_embedding: list[float],
    user_id: str,
    file_types: list[str] | None = None,
    match_threshold: float = 0.7,
    match_count: int = 5,
) -> list[dict]:
    """Search for similar document chunks."""
    client = get_supabase_client()

    result = client.rpc(
        "match_document_chunks",
        {
            "query_embedding": query_embedding,
            "match_threshold": match_threshold,
            "match_count": match_count,
            "filter_user_id": user_id,
            "filter_file_types": file_types,
        },
    ).execute()

    return result.data or []


async def get_document(document_id: str) -> dict | None:
    """Get a document by ID."""
    client = get_supabase_client()
    result = client.table("documents").select("*").eq("id", document_id).single().execute()
    return result.data


async def delete_document(document_id: str) -> None:
    """Delete a document and its chunks."""
    client = get_supabase_client()
    client.table("documents").delete().eq("id", document_id).execute()


async def list_documents(
    user_id: str,
    file_type: str | None = None,
    status: str | None = None,
) -> list[dict]:
    """List documents for a user."""
    client = get_supabase_client()
    query = client.table("documents").select("*").eq("user_id", user_id)

    if file_type:
        query = query.eq("file_type", file_type)
    if status:
        query = query.eq("status", status)

    result = query.order("created_at", desc=True).execute()
    return result.data or []


# ============================================
# Extended Document Functions
# ============================================


async def insert_document_extended(
    user_id: str,
    filename: str,
    file_type: str,
    mime_type: str,
    storage_path: str | None = None,
    title: str | None = None,
    body_system: str | None = None,
    document_category: str | None = None,
    is_global: bool = False,
    version: str = "1.0",
    metadata: dict | None = None,
) -> dict:
    """Create a document record with extended metadata."""
    client = get_supabase_client()

    data = {
        "user_id": user_id,
        "filename": filename,
        "file_type": file_type,
        "mime_type": mime_type,
        "storage_path": storage_path,
        "status": "pending",
        "title": title,
        "body_system": body_system,
        "document_category": document_category,
        "is_global": is_global,
        "version": version,
        "metadata": metadata or {},
    }

    result = client.table("documents").insert(data).execute()
    return result.data[0] if result.data else {}


async def get_document_tags(document_id: str) -> list[dict]:
    """Get all tags for a document."""
    client = get_supabase_client()

    result = (
        client.table("document_tag_mappings")
        .select("tag_id, document_tags(tag_name, tag_type, display_name)")
        .eq("document_id", document_id)
        .execute()
    )

    return result.data or []


async def add_document_tags(document_id: str, tag_ids: list[str]) -> None:
    """Add tags to a document."""
    client = get_supabase_client()

    mappings = [{"document_id": document_id, "tag_id": tag_id} for tag_id in tag_ids]

    # Use upsert to ignore duplicates
    for mapping in mappings:
        try:
            client.table("document_tag_mappings").insert(mapping).execute()
        except Exception:
            pass  # Ignore duplicate key errors


async def get_tags_by_name(tag_names: list[str]) -> list[dict]:
    """Get tag records by name."""
    client = get_supabase_client()

    result = (
        client.table("document_tags")
        .select("*")
        .in_("tag_name", tag_names)
        .execute()
    )

    return result.data or []


async def get_tags_by_type(tag_type: str) -> list[dict]:
    """Get all tags of a specific type."""
    client = get_supabase_client()

    result = (
        client.table("document_tags")
        .select("*")
        .eq("tag_type", tag_type)
        .order("tag_name")
        .execute()
    )

    return result.data or []


# ============================================
# Smart Search Functions
# ============================================


async def smart_search_documents(
    query_embedding: list[float],
    user_id: str,
    tag_names: list[str] | None = None,
    body_systems: list[str] | None = None,
    document_categories: list[str] | None = None,
    include_related: bool = True,
    match_threshold: float = 0.6,
    match_count: int = 10,
) -> list[dict]:
    """
    Smart search with condition expansion.

    Uses the smart_search_documents database function.
    """
    client = get_supabase_client()

    result = client.rpc(
        "smart_search_documents",
        {
            "p_query_embedding": query_embedding,
            "p_user_id": user_id,
            "p_tag_names": tag_names,
            "p_body_systems": body_systems,
            "p_document_categories": document_categories,
            "p_include_related": include_related,
            "p_match_threshold": match_threshold,
            "p_match_count": match_count,
        },
    ).execute()

    return result.data or []


async def get_related_conditions(
    tag_names: list[str],
    min_strength: float = 0.3,
    relationship_types: list[str] | None = None,
) -> list[dict]:
    """Get conditions related to the given tags."""
    client = get_supabase_client()

    result = client.rpc(
        "get_related_conditions",
        {
            "p_tag_names": tag_names,
            "p_min_strength": min_strength,
            "p_relationship_types": relationship_types,
        },
    ).execute()

    return result.data or []


async def get_documents_by_tags(
    user_id: str,
    tag_names: list[str],
    include_related: bool = True,
) -> list[dict]:
    """Get documents matching the given tags."""
    client = get_supabase_client()

    result = client.rpc(
        "get_documents_by_tags",
        {
            "p_user_id": user_id,
            "p_tag_names": tag_names,
            "p_include_related": include_related,
        },
    ).execute()

    return result.data or []


# ============================================
# System Prompts Functions
# ============================================


async def get_active_prompt(prompt_key: str) -> str | None:
    """Get the active prompt content for a key."""
    client = get_supabase_client()

    result = client.rpc(
        "get_active_prompt",
        {"p_prompt_key": prompt_key},
    ).execute()

    return result.data


async def get_all_active_prompts() -> dict[str, str]:
    """Get all active prompts as a dictionary."""
    client = get_supabase_client()

    result = (
        client.table("system_prompts")
        .select("prompt_key, content")
        .eq("is_active", True)
        .execute()
    )

    return {row["prompt_key"]: row["content"] for row in result.data or []}


async def create_prompt_version(
    prompt_key: str,
    content: str,
    description: str | None = None,
    created_by: str | None = None,
    activate: bool = False,
) -> int:
    """Create a new version of a prompt."""
    client = get_supabase_client()

    result = client.rpc(
        "create_prompt_version",
        {
            "p_prompt_key": prompt_key,
            "p_content": content,
            "p_description": description,
            "p_created_by": created_by,
            "p_activate": activate,
        },
    ).execute()

    return result.data


async def activate_prompt_version(prompt_key: str, version: int) -> bool:
    """Activate a specific version of a prompt."""
    client = get_supabase_client()

    result = client.rpc(
        "activate_prompt_version",
        {
            "p_prompt_key": prompt_key,
            "p_version": version,
        },
    ).execute()

    return result.data


async def get_prompt_history(prompt_key: str) -> list[dict]:
    """Get version history for a prompt."""
    client = get_supabase_client()

    result = client.rpc(
        "get_prompt_history",
        {"p_prompt_key": prompt_key},
    ).execute()

    return result.data or []
