"""
Eval Report API Routes - Full clinical evaluation via Claude Opus 4.6.

POST /agent/eval        - Single patient eval (queues background job)
POST /agent/eval/batch  - 1-5 patients in parallel (queues N background jobs)
GET  /agent/eval/{id}   - Get eval report by diagnostic_analysis_id
"""

from __future__ import annotations

import asyncio
import json
from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.agent.eval_agent import get_eval_runner
from app.models.eval_models import (
    EvalReportRequest,
    BatchEvalRequest,
    EvalJobResponse,
    BatchEvalJobResponse,
    EvalReport,
)
from app.services.supabase import get_supabase_client
from app.utils.logger import get_logger

logger = get_logger("eval_routes")

router = APIRouter()

# Max concurrent eval jobs per user (each costs ~$2-4 in Claude Opus tokens)
MAX_CONCURRENT_EVAL_JOBS = 5


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _fetch_diagnostic_bundle(diagnostic_analysis_id: str) -> tuple[dict, str]:
    """
    Fetch the diagnostic bundle and patient name for an analysis.

    Returns (bundle_dict, patient_name).
    """
    client = get_supabase_client()

    # Get the analysis → upload → extracted values chain
    analysis_result = client.table("diagnostic_analyses").select(
        "id, patient_id, diagnostic_upload_id, patients(first_name, last_name)"
    ).eq("id", diagnostic_analysis_id).single().execute()

    if not analysis_result.data:
        raise ValueError(f"Diagnostic analysis not found: {diagnostic_analysis_id}")

    analysis = analysis_result.data
    patient = analysis.get("patients") or {}
    patient_name = f"{patient.get('first_name', 'Unknown')} {patient.get('last_name', '')}".strip()
    upload_id = analysis["diagnostic_upload_id"]

    # Get all extracted values for this upload
    files_result = client.table("diagnostic_files").select(
        "id, file_type, diagnostic_extracted_values(extracted_data, status)"
    ).eq("upload_id", upload_id).execute()

    bundle: dict = {}
    for file_rec in (files_result.data or []):
        file_type = file_rec.get("file_type")
        extractions = file_rec.get("diagnostic_extracted_values") or []
        for extraction in extractions:
            if extraction.get("status") in ("complete", "needs_review"):
                extracted = extraction.get("extracted_data") or {}
                if extracted:
                    # Merge by file type key
                    bundle[file_type] = extracted

    if not bundle:
        raise ValueError(
            f"No extracted diagnostic data found for analysis {diagnostic_analysis_id}. "
            "Run extraction first."
        )

    return bundle, patient_name


async def _run_eval_and_store(
    diagnostic_analysis_id: str,
    patient_id: str,
    report_id: str,
) -> None:
    """
    Run the eval agent and store the result. Called as a background task.
    """
    db = get_supabase_client()

    try:
        # Mark as processing
        db.table("diagnostic_eval_reports").update({
            "status": "processing",
        }).eq("id", report_id).execute()

        # Fetch data
        bundle_dict, patient_name = await _fetch_diagnostic_bundle(diagnostic_analysis_id)

        # Run Claude Opus
        runner = get_eval_runner()
        report: EvalReport = await runner.run(bundle_dict, patient_name)

        # Store result
        db.table("diagnostic_eval_reports").update({
            "status": "complete",
            "report_json": report.model_dump(),
            "urgency_rating": report.urgency.score,
            "deal_breaker_count": len(report.deal_breakers),
            "updated_at": datetime.utcnow().isoformat(),
        }).eq("id", report_id).execute()

        logger.info(
            "Eval complete for analysis %s: urgency=%.1f, deal_breakers=%d",
            diagnostic_analysis_id,
            report.urgency.score,
            len(report.deal_breakers),
        )

    except Exception as exc:
        logger.error("Eval failed for analysis %s: %s", diagnostic_analysis_id, exc, exc_info=True)
        db.table("diagnostic_eval_reports").update({
            "status": "error",
            "error_message": str(exc),
            "updated_at": datetime.utcnow().isoformat(),
        }).eq("id", report_id).execute()


async def _create_eval_job(
    diagnostic_analysis_id: str,
    patient_id: str,
) -> dict:
    """Create a pending eval report record and return it."""
    db = get_supabase_client()

    result = db.table("diagnostic_eval_reports").insert({
        "diagnostic_analysis_id": diagnostic_analysis_id,
        "patient_id": patient_id,
        "report_json": {},
        "status": "pending",
    }).execute()

    if not result.data:
        raise RuntimeError("Failed to create eval report record")

    return result.data[0]


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/eval", response_model=EvalJobResponse)
async def create_eval_report(request: EvalReportRequest):
    """
    Trigger a full clinical eval report for a single patient.

    Uses Claude Opus 4.6 with all 9 master protocol files inline.
    The eval runs as a background task (~3 minutes).

    Returns the report_id immediately; poll GET /agent/eval/{report_id} for status.
    """
    # Check for existing pending/processing report to avoid duplicates
    db = get_supabase_client()
    existing = db.table("diagnostic_eval_reports").select("id, status").eq(
        "diagnostic_analysis_id", request.diagnostic_analysis_id
    ).in_("status", ["pending", "processing", "complete"]).execute()

    if existing.data:
        rec = existing.data[0]
        return EvalJobResponse(
            job_id=rec["id"],
            diagnostic_analysis_id=request.diagnostic_analysis_id,
            patient_id=request.patient_id,
            status=rec["status"],
            message="Report already exists" if rec["status"] == "complete" else "Report in progress",
        )

    # Create the record
    record = await _create_eval_job(request.diagnostic_analysis_id, request.patient_id)
    report_id = record["id"]

    # Fire background task (don't await — returns immediately)
    asyncio.create_task(
        _run_eval_and_store(request.diagnostic_analysis_id, request.patient_id, report_id)
    )

    return EvalJobResponse(
        job_id=report_id,
        diagnostic_analysis_id=request.diagnostic_analysis_id,
        patient_id=request.patient_id,
        status="pending",
        message="Eval report queued. Claude Opus is analyzing all diagnostic data (~3 min).",
    )


@router.post("/eval/batch", response_model=BatchEvalJobResponse)
async def create_batch_eval_reports(request: BatchEvalRequest):
    """
    Trigger full clinical eval reports for 1-5 patients simultaneously.

    All patient evals start in parallel via asyncio.gather(). Each report
    takes ~3 minutes; all finish in ~3 minutes regardless of patient count.

    Enforces max 5 concurrent to control Claude Opus API costs.
    """
    if len(request.patients) > MAX_CONCURRENT_EVAL_JOBS:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {MAX_CONCURRENT_EVAL_JOBS} patients per batch. Got {len(request.patients)}.",
        )

    db = get_supabase_client()
    jobs: list[EvalJobResponse] = []

    for patient_req in request.patients:
        # Check for existing report
        existing = db.table("diagnostic_eval_reports").select("id, status").eq(
            "diagnostic_analysis_id", patient_req.diagnostic_analysis_id
        ).in_("status", ["pending", "processing", "complete"]).execute()

        if existing.data:
            rec = existing.data[0]
            jobs.append(EvalJobResponse(
                job_id=rec["id"],
                diagnostic_analysis_id=patient_req.diagnostic_analysis_id,
                patient_id=patient_req.patient_id,
                status=rec["status"],
                message="Report already exists" if rec["status"] == "complete" else "Report in progress",
            ))
            continue

        record = await _create_eval_job(patient_req.diagnostic_analysis_id, patient_req.patient_id)
        report_id = record["id"]

        asyncio.create_task(
            _run_eval_and_store(
                patient_req.diagnostic_analysis_id,
                patient_req.patient_id,
                report_id,
            )
        )

        jobs.append(EvalJobResponse(
            job_id=report_id,
            diagnostic_analysis_id=patient_req.diagnostic_analysis_id,
            patient_id=patient_req.patient_id,
            status="pending",
            message="Queued",
        ))

    new_count = sum(1 for j in jobs if j.status == "pending")
    return BatchEvalJobResponse(
        jobs=jobs,
        total=len(jobs),
        message=f"Queued {new_count} eval report(s). All running in parallel (~3 min each).",
    )


class EvalReportResponse(BaseModel):
    id: str
    diagnostic_analysis_id: str
    patient_id: str
    status: str
    report: dict | None
    urgency_rating: float | None
    deal_breaker_count: int | None
    error_message: str | None
    created_at: str
    updated_at: str


@router.get("/eval/{report_id}", response_model=EvalReportResponse)
async def get_eval_report(report_id: str):
    """Get an eval report by its ID (the job_id from the POST response)."""
    db = get_supabase_client()

    result = db.table("diagnostic_eval_reports").select("*").eq("id", report_id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Eval report not found")

    rec = result.data
    return EvalReportResponse(
        id=rec["id"],
        diagnostic_analysis_id=rec["diagnostic_analysis_id"],
        patient_id=rec["patient_id"],
        status=rec["status"],
        report=rec.get("report_json"),
        urgency_rating=rec.get("urgency_rating"),
        deal_breaker_count=rec.get("deal_breaker_count"),
        error_message=rec.get("error_message"),
        created_at=rec["created_at"],
        updated_at=rec["updated_at"],
    )


@router.get("/eval/by-analysis/{diagnostic_analysis_id}", response_model=EvalReportResponse | None)
async def get_eval_report_by_analysis(diagnostic_analysis_id: str):
    """Get an eval report by the diagnostic analysis ID."""
    db = get_supabase_client()

    result = db.table("diagnostic_eval_reports").select("*").eq(
        "diagnostic_analysis_id", diagnostic_analysis_id
    ).order("created_at", desc=True).limit(1).execute()

    if not result.data:
        return None

    rec = result.data[0]
    return EvalReportResponse(
        id=rec["id"],
        diagnostic_analysis_id=rec["diagnostic_analysis_id"],
        patient_id=rec["patient_id"],
        status=rec["status"],
        report=rec.get("report_json"),
        urgency_rating=rec.get("urgency_rating"),
        deal_breaker_count=rec.get("deal_breaker_count"),
        error_message=rec.get("error_message"),
        created_at=rec["created_at"],
        updated_at=rec["updated_at"],
    )
