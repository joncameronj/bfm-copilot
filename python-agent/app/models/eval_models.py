"""
Eval Report Data Models - Pydantic models for the Claude Opus full eval report.

These mirror the structured JSON that Claude Opus returns after analyzing
all 9 master protocol files + patient diagnostic data.
"""

from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, Field


# Layer labels and descriptions — the 3-tier practitioner delivery model
LAYER_LABELS = {
    1: "High Priorities",
    2: "Next If No Response",
    3: "If They Are Still Stuck",
}
LAYER_DESCRIPTIONS = {
    1: "Deal breakers and urgent protocols. Address these first.",
    2: "Secondary protocols if no response after 4-6 weeks.",
    3: "Deep-dive protocols for resistant cases after 2-3 months.",
}


class DealBreaker(BaseModel):
    """A BFM deal breaker finding with traceable citation."""
    name: str = Field(description="Deal breaker name (e.g. 'SNS Switched')")
    finding: str = Field(description="Specific diagnostic measurement that triggered this")
    protocol: str = Field(description="Primary frequency protocol to run")
    urgency: str = Field(description="Why this must be addressed first")
    patient_data_citation: str = Field(description="Exact patient data point cited from the bundle")


class FrequencyPhase(BaseModel):
    """A single frequency protocol in its treatment phase."""
    phase: int = Field(description="Phase number (1=deal breakers, 2=primary, 3=support)")
    protocol_name: str = Field(description="Exact BFM protocol name from master key")
    trigger: str = Field(description="Diagnostic finding that triggered this protocol")
    patient_data_citation: str = Field(description="Exact data point from patient bundle")
    sequencing_note: str = Field(
        default="",
        description="Any gating or sequencing requirement (e.g. 'only after Cyto Lower')"
    )
    layer_label: str = Field(
        default="",
        description="Human-readable layer label (e.g. 'High Priorities')"
    )
    layer_description: str = Field(
        default="",
        description="Brief description of what this layer means for the practitioner"
    )


class SupplementItem(BaseModel):
    """A supplement recommendation with dosage and clinical rationale."""
    name: str = Field(description="Supplement name (use BFM branded name from master key)")
    trigger: str = Field(description="Clinical reason this supplement is needed")
    dosage: str = Field(default="", description="Specific dosage from master key")
    timing: str = Field(default="", description="When to take (morning/night/with food)")
    patient_data_citation: str = Field(description="Patient data point that triggered this")
    priority: int = Field(default=2, description="1=deal breaker support, 2=primary, 3=maintenance")
    layer: int = Field(default=0, description="Treatment layer (1=High Priorities, 2=Next If No Response, 3=If Still Stuck, 0=unassigned)")


class Lever(BaseModel):
    """One of the BFM Five Levers with patient-specific assessment."""
    lever_number: int = Field(description="1-5")
    lever_name: str = Field(description="Lever name from master key")
    patient_status: str = Field(
        description="How this lever is presenting for THIS patient specifically"
    )
    recommendation: str = Field(description="Specific action for this patient")
    patient_data_citation: str = Field(description="Data point that informs this assessment")


class PatientAnalogy(BaseModel):
    """Plain-language explanation of a clinical finding for patient communication."""
    finding: str = Field(description="Clinical finding being explained")
    analogy: str = Field(description="3-4 sentence metaphor using everyday language, no jargon")
    what_this_means: str = Field(description="Bridge statement: 'What this means for you...'")
    hopeful_framing: str = Field(description="Positive framing: 'The good news is...'")


class UrgencyRating(BaseModel):
    """Overall urgency assessment for the patient."""
    score: float = Field(description="0-5 scale: 5=critical, 4=urgent, 3=moderate, 2.5=mild, 2=maintenance")
    rationale: str = Field(description="Why this urgency score was assigned")
    timeline: str = Field(description="Expected treatment timeline (e.g. '3-6 months intensive')")
    critical_path: str = Field(description="The single most important thing to address first")


class MonitoringItem(BaseModel):
    """A specific metric to watch during treatment."""
    metric: str = Field(description="What to measure")
    baseline: str = Field(description="Current value")
    target: str = Field(description="Goal value")
    reassessment_interval: str = Field(description="When to re-check")


class EvalReport(BaseModel):
    """
    Full BFM clinical evaluation report — the output from Claude Opus 4.6.

    Every recommendation cites the exact patient data point that triggered it.
    This is the same structure produced in the manual eval that achieved near-perfect accuracy.
    """
    patient_name: str
    report_date: str

    urgency: UrgencyRating

    deal_breakers: list[DealBreaker] = Field(
        description="Priority-ordered deal breakers that must be addressed first"
    )

    frequency_phases: list[FrequencyPhase] = Field(
        description="All frequency protocols organized by treatment phase"
    )

    supplementation: list[SupplementItem] = Field(
        description="Full supplement stack ordered by priority"
    )

    five_levers: list[Lever] = Field(
        description="All 5 BFM levers assessed for this patient"
    )

    patient_analogies: list[PatientAnalogy] = Field(
        description="Plain-language explanations for each major finding"
    )

    monitoring: list[MonitoringItem] = Field(
        description="Key metrics to track during treatment"
    )

    clinical_summary: str = Field(
        description="2-3 paragraph clinical narrative tying all findings together"
    )

    confidence_notes: str = Field(
        default="",
        description="Any caveats about data quality or missing diagnostic information"
    )


# Request/response models for the API
class EvalReportRequest(BaseModel):
    """Request to generate a full eval report."""
    diagnostic_analysis_id: str
    patient_id: str


class BatchEvalRequest(BaseModel):
    """Request to generate eval reports for multiple patients in parallel."""
    patients: list[EvalReportRequest] = Field(
        min_length=1,
        max_length=5,
        description="1-5 patients to evaluate in parallel"
    )


class EvalJobResponse(BaseModel):
    """Response after queuing an eval job."""
    job_id: str
    diagnostic_analysis_id: str
    patient_id: str
    status: Literal["pending", "processing", "complete", "error"]
    message: str


class BatchEvalJobResponse(BaseModel):
    """Response after queuing batch eval jobs."""
    jobs: list[EvalJobResponse]
    total: int
    message: str
