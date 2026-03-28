"""
Eval Report API Routes - Full clinical evaluation via Claude Sonnet 4.6.

POST /agent/eval        - Single patient eval (queues background job)
POST /agent/eval/batch  - 1-5 patients in parallel (queues N background jobs)
GET  /agent/eval/{id}   - Get eval report by diagnostic_analysis_id
"""

from __future__ import annotations

import asyncio
import json
import re
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
from app.services.protocol_engine import bundle_from_extracted_data, run_protocol_engine
from app.services.supabase import get_supabase_client
from app.utils.logger import get_logger

logger = get_logger("eval_routes")

router = APIRouter()

# Max concurrent eval jobs per user (each costs ~$2-4 in Claude Sonnet tokens)
MAX_CONCURRENT_EVAL_JOBS = 5


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _is_positive(data) -> bool:
    """Check if a UA value (dict or raw) indicates a positive result."""
    if isinstance(data, dict):
        val = str(data.get("value", "")).lower()
        status = str(data.get("status", "")).lower()
        return status in ("positive", "abnormal") or val not in ("neg", "negative", "0", "")
    return bool(data)


# Known-normal urobilinogen values — these should NEVER be treated as positive,
# even if the vision model incorrectly sets status to "positive".
# 0.2 mg/dL is the standard reference range on UA strips.
_UROBILINOGEN_NORMAL_VALUES = frozenset({
    "0.2", "0.2 mg/dl", "0.2 eu/dl", "normal", "normal range",
    "neg", "negative", "",
})


def _is_urobilinogen_positive(data) -> bool:
    """Urobilinogen requires EXPLICIT positive evidence — '0.2 mg/dL' or 'Normal' is negative.

    Standard urinalysis reference range for urobilinogen is 0.2 mg/dL (Normal).
    Only 1+, 2+, 4+, 8+, or explicit 'positive' status should trigger Blood Support.

    IMPORTANT: Value is checked FIRST. If the value is a known-normal reading,
    we return False regardless of status. This defends against vision model
    hallucinations where status is incorrectly set to 'positive' for normal values.
    """
    if not data or not isinstance(data, dict):
        return False

    val = str(data.get("value", "")).lower().strip()

    # DEFENSE: If the value is a known-normal reading, reject regardless of status.
    # This catches the hallucination where vision reads value="0.2" but status="positive".
    if val in _UROBILINOGEN_NORMAL_VALUES:
        return False

    # Check value for explicit positive indicators (allowlist)
    if val in ("positive", "+", "1+", "2+", "4+", "8+", "++", "+++", "++++"):
        return True

    # Check status only after value is confirmed not-normal
    status = str(data.get("status", "")).lower().strip()
    if status == "positive":
        return True

    return False


def _is_glucose_positive(data) -> bool:
    """Glucose requires EXPLICIT positive evidence — never infer from ambiguous values.

    Unlike _is_positive() which uses denylist logic (anything not negative = positive),
    this uses allowlist logic: only return True when status or value is explicitly positive.
    This prevents hallucinated or ambiguous vision extractions from triggering Diabetes protocols.
    """
    if not data or not isinstance(data, dict):
        return False
    status = str(data.get("status", "")).lower().strip()
    if status == "positive":
        return True
    val = str(data.get("value", "")).lower().strip()
    if val in ("positive", "+", "1+", "2+", "3+", "++", "+++"):
        return True
    return False


def _check_exact_match(a: dict, b: dict) -> bool:
    """All 4 NervExpress values must match exactly (Locus Coeruleus / NS Tox test)."""
    keys = ["hr", "r_hf", "r_lf1", "r_lf2"]
    return all(
        a.get(k) is not None and b.get(k) is not None and a[k] == b[k]
        for k in keys
    )


def _coerce_float(value):
    """Coerce a raw extracted value to float when possible."""
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            return None
    return None


def _normalize_bundle(raw_bundle: dict) -> dict:
    """
    Transform raw TypeScript vision extraction dicts into the flat
    DiagnosticBundle-shaped dict that the eval agent (and CLI eval scripts) expect.

    This bridges the structural mismatch between:
    - Frontend vision extractions: nested {value, status} objects, eye-by-eye VCS, etc.
    - Python DiagnosticBundle: flat fields like calm_pns, score_correct, ph as float
    """
    normalized: dict = {}

    # ----- HRV normalization -----
    hrv_raw = raw_bundle.get("hrv", {})
    if hrv_raw:
        patterns = hrv_raw.get("patterns") or {}
        calm = hrv_raw.get("calm_position") or {}
        stressed = hrv_raw.get("stressed_position") or {}
        recovery = hrv_raw.get("recovery_position") or {}

        calm_pns = calm.get("pns") if calm else None
        calm_sns = calm.get("sns") if calm else None
        switched = patterns.get("switched_sympathetics", False)

        # Validate switched_sympathetics against numerical data:
        # If both calm_sns and calm_pns are negative, this is a lower-left quadrant
        # (total depletion) pattern — NOT switched sympathetics. The Vision API
        # sometimes misidentifies this pattern as "switched" because both values
        # are abnormal, but clinically switched means the red dot crosses to the
        # wrong side of the blue dot (SNS positive when PNS is negative or vice versa).
        if switched and calm_sns is not None and calm_pns is not None:
            if calm_sns < 0 and calm_pns < 0:
                logger.warning(
                    "Overriding switched_sympathetics=True → False: "
                    "both calm_sns=%.1f and calm_pns=%.1f are negative "
                    "(lower-left quadrant depletion, NOT switched)",
                    calm_sns, calm_pns,
                )
                switched = False

        normalized["hrv"] = {
            "system_energy": hrv_raw.get("system_energy"),
            "stress_response": hrv_raw.get("stress_response"),
            "calm_pns": calm_pns,
            "calm_sns": calm_sns,
            "stressed_pns": stressed.get("pns") if stressed else None,
            "stressed_sns": stressed.get("sns") if stressed else None,
            "recovery_pns": recovery.get("pns") if recovery else None,
            "recovery_sns": recovery.get("sns") if recovery else None,
            "switched_sympathetics": switched,
            "pns_negative": patterns.get("pns_negative", False),
            "vagus_dysfunction": patterns.get("vagus_dysfunction", False),
            "ortho_dots_superimposed": False,
            "valsalva_dots_superimposed": False,
        }

    # ----- Brainwave — check HRV-embedded AND standalone extraction -----
    bw_embedded = hrv_raw.get("brainwave") or {} if hrv_raw else {}
    bw_standalone = raw_bundle.get("brainwave") or {}
    bw_source = bw_standalone if bw_standalone and bw_standalone.get("alpha") else bw_embedded

    if bw_source:
        def _bw_val(v):
            if isinstance(v, dict):
                return v.get("value", 0) or 0
            return v or 0

        normalized["brainwave"] = {
            "alpha": _bw_val(bw_source.get("alpha", 0)),
            "beta": _bw_val(bw_source.get("beta", 0)),
            "delta": _bw_val(bw_source.get("delta", 0)),
            "gamma": _bw_val(bw_source.get("gamma", 0)),
            "theta": _bw_val(bw_source.get("theta", 0)),
        }

    # ----- D-Pulse normalization -----
    dpulse_raw = raw_bundle.get("d_pulse", {})
    if dpulse_raw:
        organs = []
        for m in (dpulse_raw.get("markers") or []):
            organs.append({
                "name": m.get("name", ""),
                "percentage": m.get("percentage") or m.get("value") or 0,
            })
        normalized["dpulse"] = {
            "stress_index": dpulse_raw.get("stress_index"),
            "vegetative_balance": dpulse_raw.get("vegetative_balance"),
            "brain_activity": dpulse_raw.get("brain_activity"),
            "immunity": dpulse_raw.get("immunity"),
            "physiological_resources": dpulse_raw.get("physiological_resources"),
            "organs": organs,
        }

    # ----- UA normalization -----
    ua_raw = raw_bundle.get("urinalysis", {})
    if ua_raw:
        ph_data = ua_raw.get("ph", {})
        protein_data = ua_raw.get("protein", {})
        sg_data = ua_raw.get("specific_gravity", {})
        glucose_data = ua_raw.get("glucose", {})
        uric_acid_data = ua_raw.get("uric_acid", {})
        bilirubin_data = ua_raw.get("bilirubin", {})
        urobilinogen_data = ua_raw.get("urobilinogen", {})
        uric_acid_value = (
            uric_acid_data.get("value") if isinstance(uric_acid_data, dict) else uric_acid_data
        )
        uric_acid_status = (
            str(uric_acid_data.get("status", "")).lower()
            if isinstance(uric_acid_data, dict)
            else ""
        )
        if uric_acid_value is None:
            for finding in ua_raw.get("findings") or []:
                if not isinstance(finding, str):
                    continue
                match = re.search(r"uric acid\s+(\d+(?:\.\d+)?)", finding, re.IGNORECASE)
                if match:
                    uric_acid_value = match.group(1)
                    uric_acid_status = uric_acid_status or ("high" if "high" in finding.lower() else "")
                    break
        normalized["ua"] = {
            "ph": ph_data.get("value") if isinstance(ph_data, dict) else ph_data,
            "protein_positive": _is_positive(protein_data),
            "protein_value": str(protein_data.get("value", "")) if isinstance(protein_data, dict) else str(protein_data),
            "specific_gravity": sg_data.get("value") if isinstance(sg_data, dict) else sg_data,
            "glucose_positive": _is_glucose_positive(glucose_data),
            "uric_acid": _coerce_float(uric_acid_value),
            "uric_acid_status": uric_acid_status,
            "bilirubin_positive": _is_positive(bilirubin_data),
            "urobilinogen_positive": _is_urobilinogen_positive(urobilinogen_data),
        }

    # ----- VCS normalization — standalone VCS file OR UA-embedded vcs_score -----
    vcs_raw = raw_bundle.get("vcs", {})
    if not vcs_raw:
        vcs_raw = ua_raw.get("vcs_score", {}) if ua_raw else {}
    if vcs_raw:
        passed = vcs_raw.get("passed", True)
        score_correct = vcs_raw.get("score_correct") or vcs_raw.get("correct")
        if score_correct is None:
            right = vcs_raw.get("right_eye") or {}
            left = vcs_raw.get("left_eye") or {}
            if right and left:
                r_scores = right.get("scores") or []
                l_scores = left.get("scores") or []
                score_correct = len([s for s in r_scores if s]) + len([s for s in l_scores if s])
        normalized["vcs"] = {
            "score_correct": score_correct,
            "score_total": vcs_raw.get("score_total") or vcs_raw.get("total") or 32,
            "passed": passed,
        }

    # ----- Ortho normalization -----
    ortho_raw = raw_bundle.get("ortho", {})
    if ortho_raw:
        normalized["ortho"] = ortho_raw
        # Compute Locus Coeruleus flag (blue supine + red upright exactly matching)
        # Use both: exact numeric match AND vision-reported flag
        supine = ortho_raw.get("supine", {})
        upright = ortho_raw.get("upright", {})
        superimposed_by_values = supine and upright and _check_exact_match(supine, upright)
        superimposed_by_vision = ortho_raw.get("dots_superimposed", False)
        if (superimposed_by_values or superimposed_by_vision) and "hrv" in normalized:
            normalized["hrv"]["ortho_dots_superimposed"] = True

    # ----- Valsalva normalization -----
    valsalva_raw = raw_bundle.get("valsalva", {})
    if valsalva_raw:
        normalized["valsalva"] = valsalva_raw
        # Compute NS Tox flag (blue normal + green deep exactly matching)
        # Use both: exact numeric match AND vision-reported flag
        normal = valsalva_raw.get("normal_breathing", {})
        deep = valsalva_raw.get("deep_breathing", {})
        superimposed_by_values = normal and deep and _check_exact_match(normal, deep)
        superimposed_by_vision = valsalva_raw.get("dots_superimposed", False)
        if (superimposed_by_values or superimposed_by_vision) and "hrv" in normalized:
            normalized["hrv"]["valsalva_dots_superimposed"] = True

    # ----- Blood panel (fallback from vision extraction) -----
    bp_raw = raw_bundle.get("blood_panel", {})
    if bp_raw:
        markers = bp_raw.get("markers") or []
        normalized["labs"] = [
            {
                "name": m.get("name", ""),
                "value": float(m.get("value", 0)) if m.get("value") is not None else 0,
                "unit": m.get("unit", ""),
                "status": m.get("status", "normal"),
            }
            for m in markers
        ]

    return normalized


async def _fetch_diagnostic_bundle(diagnostic_analysis_id: str) -> tuple[dict, str]:
    """
    Fetch the diagnostic bundle and patient name for an analysis.

    Returns (bundle_dict, patient_name).
    """
    client = get_supabase_client()

    # Get the analysis → upload → extracted values chain
    analysis_result = client.table("diagnostic_analyses").select(
        "id, patient_id, diagnostic_upload_id, "
        "patients(first_name, last_name, chief_complaints, medical_history, current_medications, allergies)"
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

    raw_bundle: dict = {}
    for file_rec in (files_result.data or []):
        file_type = file_rec.get("file_type")
        extractions = file_rec.get("diagnostic_extracted_values") or []
        for extraction in extractions:
            if extraction.get("status") in ("complete", "needs_review"):
                extracted = extraction.get("extracted_data") or {}
                if extracted:
                    # Merge by file type key
                    raw_bundle[file_type] = extracted

    if not raw_bundle:
        # Log diagnostic detail to help debug extraction failures
        for file_rec in (files_result.data or []):
            extractions = file_rec.get("diagnostic_extracted_values") or []
            statuses = [e.get("status") for e in extractions]
            logger.info(
                "File %s (%s): %d extractions, statuses=%s",
                file_rec.get("id"), file_rec.get("file_type"),
                len(extractions), statuses,
            )
        raise ValueError(
            f"No extracted diagnostic data found for analysis {diagnostic_analysis_id}. "
            f"Upload {upload_id} has {len(files_result.data or [])} files but none with complete/needs_review extractions. "
            "Run extraction first."
        )

    # Normalize vision extraction format → DiagnosticBundle format
    bundle = _normalize_bundle(raw_bundle)

    bundle["patient_context"] = {
        "chief_complaints": patient.get("chief_complaints"),
        "medical_history": patient.get("medical_history"),
        "current_medications": patient.get("current_medications") or [],
        "allergies": patient.get("allergies") or [],
    }

    # Phase 2: Override vision-extracted labs with structured DB data if available
    patient_id = analysis.get("patient_id")
    if patient_id:
        try:
            lab_result = client.table("lab_results").select(
                "id, test_date, lab_values(id, value, evaluation, is_ominous, "
                "lab_markers(name, display_name, unit, category))"
            ).eq("patient_id", patient_id).order(
                "test_date", desc=True
            ).limit(1).execute()

            if lab_result.data and lab_result.data[0].get("lab_values"):
                lab_markers = []
                for lv in lab_result.data[0]["lab_values"]:
                    marker_info = lv.get("lab_markers") or {}
                    lab_markers.append({
                        "name": marker_info.get("display_name") or marker_info.get("name", ""),
                        "value": float(lv.get("value", 0)),
                        "unit": marker_info.get("unit", ""),
                        "status": lv.get("evaluation", "normal"),
                    })
                if lab_markers:
                    bundle["labs"] = lab_markers
        except Exception as exc:
            logger.warning("Failed to fetch structured lab data for patient %s: %s", patient_id, exc)

    try:
        deterministic_bundle = bundle_from_extracted_data(bundle)
        engine_result = run_protocol_engine(deterministic_bundle)
        bundle["deterministic_engine"] = {
            "protocols": [
                {
                    "name": p.name,
                    "priority": p.priority,
                    "trigger": p.trigger,
                    "category": p.category,
                    "notes": p.notes,
                }
                for p in engine_result.protocols
            ],
            "supplements": [
                {
                    "name": s.name,
                    "trigger": s.trigger,
                    "dosage": s.dosage,
                    "timing": s.timing,
                    "notes": s.notes,
                }
                for s in engine_result.supplements
            ],
            "deal_breakers": engine_result.deal_breakers_found,
            "cross_correlations": engine_result.cross_correlations,
        }
    except Exception as exc:
        logger.warning(
            "Failed to build deterministic engine grounding for analysis %s: %s",
            diagnostic_analysis_id,
            exc,
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

        # Run Claude Sonnet
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


def _log_task_exception(task: asyncio.Task) -> None:
    """Callback for fire-and-forget tasks — ensures exceptions are logged."""
    if task.cancelled():
        logger.warning("Background eval task was cancelled")
        return
    exc = task.exception()
    if exc:
        logger.error("Background eval task failed unexpectedly: %s", exc, exc_info=exc)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/eval", response_model=EvalJobResponse)
async def create_eval_report(request: EvalReportRequest):
    """
    Trigger a full clinical eval report for a single patient.

    Uses Claude Sonnet 4.6 with all 9 master protocol files inline.
    The eval runs as a background task (~3-5 minutes).

    Returns the report_id immediately; poll GET /agent/eval/{report_id} for status.
    """
    try:
        return await _create_eval_report_inner(request)
    except Exception as exc:
        logger.error("create_eval_report failed: %s", exc, exc_info=True)
        raise


async def _create_eval_report_inner(request: EvalReportRequest) -> EvalJobResponse:
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
    task = asyncio.create_task(
        _run_eval_and_store(request.diagnostic_analysis_id, request.patient_id, report_id)
    )
    task.add_done_callback(_log_task_exception)

    return EvalJobResponse(
        job_id=report_id,
        diagnostic_analysis_id=request.diagnostic_analysis_id,
        patient_id=request.patient_id,
        status="pending",
        message="Eval report queued. Claude Sonnet is analyzing all diagnostic data (~3-5 min).",
    )


class ForAnalysisRequest(BaseModel):
    """Request from Next.js generate-analysis route — synchronous eval."""
    diagnostic_analysis_id: str
    patient_id: str


class ForAnalysisResponse(BaseModel):
    """Full EvalReport returned synchronously for the analysis pipeline."""
    eval_report: dict
    patient_name: str


@router.post("/eval/for-analysis", response_model=ForAnalysisResponse)
async def eval_for_analysis(request: ForAnalysisRequest):
    """
    Synchronous eval endpoint for the diagnostic analysis pipeline.

    Called by Next.js generate-analysis route. Fetches diagnostic bundle,
    runs Claude Sonnet eval, and returns the full EvalReport JSON.
    No background job — the caller already has a 5-minute timeout.
    """
    try:
        bundle_dict, patient_name = await _fetch_diagnostic_bundle(
            request.diagnostic_analysis_id
        )

        runner = get_eval_runner()
        report: EvalReport = await runner.run(bundle_dict, patient_name)

        return ForAnalysisResponse(
            eval_report=report.model_dump(),
            patient_name=patient_name,
        )

    except ValueError as exc:
        logger.error("eval_for_analysis validation error: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("eval_for_analysis failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Eval agent failed: {exc}",
        ) from exc


@router.post("/eval/batch", response_model=BatchEvalJobResponse)
async def create_batch_eval_reports(request: BatchEvalRequest):
    """
    Trigger full clinical eval reports for 1-5 patients simultaneously.

    All patient evals start in parallel via asyncio.gather(). Each report
    takes ~3-5 minutes; all finish in ~3-5 minutes regardless of patient count.

    Enforces max 5 concurrent to control Claude Sonnet API costs.
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

        task = asyncio.create_task(
            _run_eval_and_store(
                patient_req.diagnostic_analysis_id,
                patient_req.patient_id,
                report_id,
            )
        )
        task.add_done_callback(_log_task_exception)

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
        message=f"Queued {new_count} eval report(s). All running in parallel (~3-5 min each).",
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
