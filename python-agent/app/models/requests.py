from pydantic import BaseModel
from typing import Literal
from app.models.messages import Message, PatientContext


class ChatRequest(BaseModel):
    message: str
    conversation_id: str | None = None
    conversation_type: Literal["general", "lab_analysis", "diagnostics", "brainstorm"] = "general"
    patient_context: PatientContext | None = None
    history: list[Message] = []
    file_ids: list[str] | None = None
    # Role-based content filtering
    user_role: Literal["admin", "practitioner", "member"] = "member"
    user_id: str | None = None
    # Force web search for this query
    force_web_search: bool = False
    # Enable high-depth Sunday-first retrieval and high reasoning for this request
    deep_dive: bool = False


class IngestRequest(BaseModel):
    file_type: Literal[
        "medical_protocol", "lab_interpretation", "diagnostic_report", "ip_material", "other"
    ]
    # Role-based content visibility
    role_scope: Literal["educational", "clinical", "both"] = "clinical"
