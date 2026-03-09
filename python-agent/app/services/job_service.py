"""
Job Service - Database operations for background agent jobs.

Provides CRUD operations and status management for agent_jobs table.
"""

from datetime import datetime
from typing import Literal
from app.services.supabase import get_supabase_client


JobStatus = Literal['pending', 'running', 'streaming', 'completed', 'failed', 'cancelled']


async def create_job(
    conversation_id: str,
    user_id: str,
    input_message: str,
    input_context: dict | None = None,
) -> dict:
    """Create a new background job."""
    client = get_supabase_client()

    result = client.table("agent_jobs").insert({
        "conversation_id": conversation_id,
        "user_id": user_id,
        "input_message": input_message,
        "input_context": input_context or {},
        "status": "pending",
    }).execute()

    return result.data[0] if result.data else {}


async def get_job(job_id: str) -> dict | None:
    """Get a job by ID."""
    client = get_supabase_client()

    result = client.table("agent_jobs").select(
        "*, conversations(id, title, patient_id)"
    ).eq("id", job_id).single().execute()

    return result.data


async def get_user_active_jobs(user_id: str) -> list[dict]:
    """Get all active (non-completed) jobs for a user."""
    client = get_supabase_client()

    result = client.table("agent_jobs").select(
        "*, conversations(id, title, patient_id)"
    ).eq("user_id", user_id).in_(
        "status", ["pending", "running", "streaming"]
    ).order("created_at", desc=True).execute()

    return result.data or []


async def get_user_unread_jobs(user_id: str) -> list[dict]:
    """Get all completed but unread jobs for a user."""
    client = get_supabase_client()

    result = client.table("agent_jobs").select(
        "*, conversations(id, title, patient_id)"
    ).eq("user_id", user_id).eq(
        "status", "completed"
    ).eq("is_read", False).order("completed_at", desc=True).execute()

    return result.data or []


async def get_user_jobs(
    user_id: str,
    include_read: bool = False,
    limit: int = 20,
) -> list[dict]:
    """Get recent jobs for a user (active + unread completed, optionally read)."""
    client = get_supabase_client()

    query = client.table("agent_jobs").select(
        "*, conversations(id, title, patient_id)"
    ).eq("user_id", user_id)

    if not include_read:
        # Get active jobs OR unread completed jobs
        query = query.or_(
            "status.in.(pending,running,streaming),and(status.eq.completed,is_read.eq.false)"
        )

    result = query.order("created_at", desc=True).limit(limit).execute()

    return result.data or []


async def update_job_status(
    job_id: str,
    status: JobStatus,
    current_step: str | None = None,
    error_message: str | None = None,
) -> dict | None:
    """Update job status."""
    client = get_supabase_client()

    update_data: dict = {"status": status}

    if current_step is not None:
        update_data["current_step"] = current_step

    if status == "running" and "started_at" not in update_data:
        update_data["started_at"] = datetime.utcnow().isoformat()

    if status in ("completed", "failed", "cancelled"):
        update_data["completed_at"] = datetime.utcnow().isoformat()

    if error_message is not None:
        update_data["error_message"] = error_message

    result = client.table("agent_jobs").update(
        update_data
    ).eq("id", job_id).execute()

    return result.data[0] if result.data else None


async def update_job_output(
    job_id: str,
    output_content: str | None = None,
    output_reasoning: str | None = None,
    output_metadata: dict | None = None,
    append: bool = True,
) -> dict | None:
    """Update job output (content, reasoning, metadata)."""
    client = get_supabase_client()

    # First get current job if appending
    current_job = None
    if append:
        current_job = await get_job(job_id)

    update_data: dict = {}

    if output_content is not None:
        if append and current_job:
            update_data["output_content"] = (current_job.get("output_content") or "") + output_content
        else:
            update_data["output_content"] = output_content

    if output_reasoning is not None:
        if append and current_job:
            update_data["output_reasoning"] = (current_job.get("output_reasoning") or "") + output_reasoning
        else:
            update_data["output_reasoning"] = output_reasoning

    if output_metadata is not None:
        if append and current_job:
            existing_metadata = current_job.get("output_metadata") or {}
            update_data["output_metadata"] = {**existing_metadata, **output_metadata}
        else:
            update_data["output_metadata"] = output_metadata

    if not update_data:
        return await get_job(job_id)

    result = client.table("agent_jobs").update(
        update_data
    ).eq("id", job_id).execute()

    return result.data[0] if result.data else None


async def mark_job_read(job_id: str) -> dict | None:
    """Mark a job as read."""
    client = get_supabase_client()

    result = client.table("agent_jobs").update({
        "is_read": True
    }).eq("id", job_id).execute()

    return result.data[0] if result.data else None


async def cancel_job(job_id: str) -> dict | None:
    """Cancel a pending or running job."""
    client = get_supabase_client()

    # Only cancel if not already completed
    result = client.table("agent_jobs").update({
        "status": "cancelled",
        "completed_at": datetime.utcnow().isoformat(),
    }).eq("id", job_id).in_(
        "status", ["pending", "running", "streaming"]
    ).execute()

    return result.data[0] if result.data else None


async def claim_pending_job() -> dict | None:
    """Claim the oldest pending job for processing (atomic operation)."""
    client = get_supabase_client()

    # First get the oldest pending job
    pending_result = client.table("agent_jobs").select("id").eq(
        "status", "pending"
    ).order("created_at").limit(1).execute()

    if not pending_result.data:
        return None

    job_id = pending_result.data[0]["id"]

    # Atomically update to running (only if still pending)
    result = client.table("agent_jobs").update({
        "status": "running",
        "started_at": datetime.utcnow().isoformat(),
    }).eq("id", job_id).eq("status", "pending").execute()

    if not result.data:
        # Job was already claimed by another worker
        return None

    # Fetch full job data
    return await get_job(job_id)


async def get_active_jobs_count(user_id: str) -> int:
    """Get count of active jobs for a user."""
    client = get_supabase_client()

    result = client.rpc(
        "get_active_jobs_count",
        {"p_user_id": user_id}
    ).execute()

    return result.data or 0


async def get_unread_jobs_count(user_id: str) -> int:
    """Get count of unread completed jobs for a user."""
    client = get_supabase_client()

    result = client.rpc(
        "get_unread_jobs_count",
        {"p_user_id": user_id}
    ).execute()

    return result.data or 0


async def increment_retry_count(job_id: str) -> int:
    """Increment retry count and return new value."""
    client = get_supabase_client()

    # Get current retry count
    job = await get_job(job_id)
    if not job:
        return 0

    new_count = (job.get("retry_count") or 0) + 1

    client.table("agent_jobs").update({
        "retry_count": new_count,
        "status": "pending",  # Reset to pending for retry
        "error_message": None,
    }).eq("id", job_id).execute()

    return new_count
