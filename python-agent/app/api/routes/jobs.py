"""
Jobs API Routes - Background job management endpoints.

Provides endpoints for creating, querying, and managing background agent jobs.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services import job_service


router = APIRouter()


# Maximum concurrent background jobs per user
MAX_CONCURRENT_JOBS = 3


class CreateJobRequest(BaseModel):
    """Request model for creating a background job."""
    conversation_id: str
    user_id: str
    message: str
    context: dict | None = None


class CreateJobResponse(BaseModel):
    """Response model for job creation."""
    job_id: str
    status: str
    message: str


class JobResponse(BaseModel):
    """Response model for a single job."""
    id: str
    conversation_id: str
    user_id: str
    status: str
    input_message: str
    output_content: str | None
    output_reasoning: str | None
    output_metadata: dict | None
    current_step: str | None
    error_message: str | None
    is_read: bool
    created_at: str
    started_at: str | None
    completed_at: str | None
    conversation: dict | None = None


class JobsListResponse(BaseModel):
    """Response model for job list."""
    jobs: list[JobResponse]
    unread_count: int
    active_count: int


@router.post("/jobs", response_model=CreateJobResponse)
async def create_job(request: CreateJobRequest):
    """
    Create a new background job for agent execution.

    The job will be picked up by the worker and processed independently
    of the HTTP connection, allowing the user to navigate away.
    """
    user_id = request.user_id

    # Check concurrent job limit
    active_count = await job_service.get_active_jobs_count(user_id)
    if active_count >= MAX_CONCURRENT_JOBS:
        raise HTTPException(
            status_code=429,
            detail=f"Maximum concurrent jobs ({MAX_CONCURRENT_JOBS}) reached. Please wait for existing jobs to complete."
        )

    # Create the job
    job = await job_service.create_job(
        conversation_id=request.conversation_id,
        user_id=user_id,
        input_message=request.message,
        input_context=request.context,
    )

    if not job:
        raise HTTPException(status_code=500, detail="Failed to create job")

    return CreateJobResponse(
        job_id=job["id"],
        status=job["status"],
        message="Job created successfully. Processing will begin shortly."
    )


@router.get("/jobs", response_model=JobsListResponse)
async def get_jobs(user_id: str, include_read: bool = False):
    """
    Get all jobs for a user.

    Returns active jobs and unread completed jobs by default.
    Set include_read=true to also include read completed jobs.
    """
    jobs = await job_service.get_user_jobs(user_id, include_read=include_read)
    unread_count = await job_service.get_unread_jobs_count(user_id)
    active_count = await job_service.get_active_jobs_count(user_id)

    return JobsListResponse(
        jobs=[_format_job(job) for job in jobs],
        unread_count=unread_count,
        active_count=active_count,
    )


@router.get("/jobs/active", response_model=JobsListResponse)
async def get_active_jobs(user_id: str):
    """Get only active (pending/running/streaming) jobs for a user."""
    jobs = await job_service.get_user_active_jobs(user_id)
    unread_count = await job_service.get_unread_jobs_count(user_id)
    active_count = len(jobs)

    return JobsListResponse(
        jobs=[_format_job(job) for job in jobs],
        unread_count=unread_count,
        active_count=active_count,
    )


@router.get("/jobs/{job_id}", response_model=JobResponse)
async def get_job(job_id: str):
    """Get a specific job by ID."""
    job = await job_service.get_job(job_id)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return _format_job(job)


@router.post("/jobs/{job_id}/mark-read")
async def mark_job_read(job_id: str):
    """Mark a job as read."""
    job = await job_service.mark_job_read(job_id)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return {"success": True, "job_id": job_id}


@router.post("/jobs/{job_id}/cancel")
async def cancel_job(job_id: str):
    """Cancel a pending or running job."""
    job = await job_service.cancel_job(job_id)

    if not job:
        raise HTTPException(
            status_code=400,
            detail="Job not found or already completed"
        )

    return {"success": True, "job_id": job_id, "status": "cancelled"}


def _format_job(job: dict) -> JobResponse:
    """Format a job record for API response."""
    return JobResponse(
        id=job["id"],
        conversation_id=job["conversation_id"],
        user_id=job["user_id"],
        status=job["status"],
        input_message=job["input_message"],
        output_content=job.get("output_content"),
        output_reasoning=job.get("output_reasoning"),
        output_metadata=job.get("output_metadata"),
        current_step=job.get("current_step"),
        error_message=job.get("error_message"),
        is_read=job.get("is_read", False),
        created_at=job["created_at"],
        started_at=job.get("started_at"),
        completed_at=job.get("completed_at"),
        conversation=job.get("conversations"),
    )
