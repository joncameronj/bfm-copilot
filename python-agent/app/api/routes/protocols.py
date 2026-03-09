"""
Protocol Engine API Route - Deterministic protocol recommendations.

This endpoint takes extracted diagnostic data and returns deterministic
protocol and supplement recommendations from the BFM Master Protocol Key.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.protocol_engine import (
    run_protocol_engine,
    bundle_from_extracted_data,
)
from app.utils.logger import get_logger

logger = get_logger("protocols")

router = APIRouter()


class ProtocolEngineRequest(BaseModel):
    """Request model: extracted diagnostic data from vision pipeline."""

    extracted_data: dict = Field(
        ...,
        description="Extracted diagnostic data (DiagnosticDataSummary from TypeScript)",
    )


class ProtocolItem(BaseModel):
    name: str
    priority: int
    trigger: str
    category: str
    notes: str = ""


class SupplementItem(BaseModel):
    name: str
    trigger: str
    dosage: str = ""
    timing: str = ""
    notes: str = ""


class ProtocolEngineResponse(BaseModel):
    protocols: list[ProtocolItem]
    supplements: list[SupplementItem]
    deal_breakers: list[str]
    cross_correlations: list[str]


@router.post("/protocols/engine", response_model=ProtocolEngineResponse)
async def run_protocol_analysis(
    request: ProtocolEngineRequest,
) -> ProtocolEngineResponse:
    """
    Run the deterministic protocol engine on extracted diagnostic data.

    Takes the output from vision extraction (DiagnosticDataSummary) and
    applies all BFM Master Protocol Key rules to produce protocol and
    supplement recommendations.

    This is the PRIMARY source of protocol decisions. The AI model should
    use these results as ground truth and only add explanation/sequencing.
    """
    try:
        bundle = bundle_from_extracted_data(request.extracted_data)
        result = run_protocol_engine(bundle)

        return ProtocolEngineResponse(
            protocols=[
                ProtocolItem(
                    name=p.name,
                    priority=p.priority,
                    trigger=p.trigger,
                    category=p.category,
                    notes=p.notes,
                )
                for p in result.protocols
            ],
            supplements=[
                SupplementItem(
                    name=s.name,
                    trigger=s.trigger,
                    dosage=s.dosage,
                    timing=s.timing,
                    notes=s.notes,
                )
                for s in result.supplements
            ],
            deal_breakers=result.deal_breakers_found,
            cross_correlations=result.cross_correlations,
        )

    except Exception as e:
        logger.error("Protocol engine failed: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Protocol engine failed: {e!s}",
        )
