"""
Query Analyzer - Extract conditions, symptoms, and search terms from user queries.

Uses GPT-4o to analyze queries and extract structured information for smart RAG search.
"""

import json
from dataclasses import dataclass, field
from typing import Any

from openai import OpenAI

from app.config import get_settings
from app.services.prompt_service import get_query_analyzer_prompt


@dataclass
class QueryAnalysis:
    """Structured analysis of a user query."""

    conditions: list[str] = field(default_factory=list)
    symptoms: list[str] = field(default_factory=list)
    lab_markers: list[str] = field(default_factory=list)
    body_systems: list[str] = field(default_factory=list)
    intent: str = ""
    should_expand: bool = True
    search_queries: list[str] = field(default_factory=list)
    raw_response: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "QueryAnalysis":
        """Create QueryAnalysis from a dictionary."""
        return cls(
            conditions=data.get("conditions", []) or [],
            symptoms=data.get("symptoms", []) or [],
            lab_markers=data.get("lab_markers", []) or [],
            body_systems=data.get("body_systems", []) or [],
            intent=data.get("intent", ""),
            should_expand=data.get("should_expand", True),
            search_queries=data.get("search_queries", []) or [],
            raw_response=data,
        )

    def all_tags(self) -> list[str]:
        """Get all extracted tags for database matching."""
        tags = set()
        tags.update(self.conditions)
        tags.update(self.symptoms)
        tags.update(self.lab_markers)
        return list(tags)


async def analyze_query(
    query: str,
    conversation_context: str | None = None,
) -> QueryAnalysis:
    """
    Analyze a user query to extract searchable information.

    Args:
        query: The user's query text
        conversation_context: Optional recent conversation for context

    Returns:
        QueryAnalysis with extracted conditions, symptoms, etc.
    """
    settings = get_settings()
    client = OpenAI(api_key=settings.openai_api_key)

    system_prompt = get_query_analyzer_prompt()

    messages = [{"role": "system", "content": system_prompt}]

    # Add conversation context if provided
    if conversation_context:
        messages.append(
            {
                "role": "user",
                "content": f"Recent conversation context:\n{conversation_context}",
            }
        )

    messages.append({"role": "user", "content": f"Analyze this query:\n{query}"})

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",  # Fast model for analysis
            messages=messages,
            temperature=0,
            response_format={"type": "json_object"},
        )

        content = response.choices[0].message.content
        if content:
            data = json.loads(content)
            return QueryAnalysis.from_dict(data)

    except Exception as e:
        print(f"Warning: Query analysis failed: {e}")

    # Fallback: basic keyword extraction
    return _fallback_analysis(query)


def _fallback_analysis(query: str) -> QueryAnalysis:
    """
    Basic keyword extraction as fallback when AI analysis fails.

    Args:
        query: The user's query text

    Returns:
        QueryAnalysis with basic extracted terms
    """
    query_lower = query.lower()

    # Common conditions to look for
    condition_keywords = {
        "thyroid": "hypothyroidism",
        "hypothyroid": "hypothyroidism",
        "hyperthyroid": "hyperthyroidism",
        "hashimoto": "hashimotos",
        "adrenal": "adrenal_fatigue",
        "fatigue": "chronic_fatigue",
        "iron": "iron_deficiency",
        "anemia": "anemia",
        "diabetes": "diabetes_type2",
        "insulin": "insulin_resistance",
        "cholesterol": "hyperlipidemia",
        "inflammation": "chronic_inflammation",
        "autoimmune": "autoimmune",
        "gut": "leaky_gut",
        "sibo": "sibo",
        "mold": "mold_toxicity",
        "depression": "depression",
        "anxiety": "anxiety",
        "pcos": "pcos",
    }

    # Common symptoms to look for
    symptom_keywords = {
        "tired": "fatigue",
        "exhausted": "fatigue",
        "weight gain": "weight_gain",
        "hair loss": "hair_loss",
        "cold": "cold_intolerance",
        "brain fog": "brain_fog",
        "bloat": "bloating",
        "constipat": "constipation",
        "headache": "headaches",
        "joint pain": "joint_pain",
        "muscle pain": "muscle_pain",
        "insomnia": "insomnia",
        "sleep": "insomnia",
    }

    # Common lab markers
    lab_keywords = {
        "tsh": "tsh",
        "t3": "free_t3",
        "t4": "free_t4",
        "ferritin": "ferritin",
        "iron": "iron",
        "vitamin d": "vitamin_d",
        "b12": "vitamin_b12",
        "crp": "hscrp",
        "a1c": "hba1c",
        "glucose": "glucose",
        "cortisol": "cortisol",
        "testosterone": "testosterone",
        "estrogen": "estradiol",
        "cholesterol": "total_cholesterol",
    }

    # Body systems
    system_keywords = {
        "thyroid": "endocrine",
        "adrenal": "endocrine",
        "hormone": "endocrine",
        "heart": "cardiovascular",
        "cholesterol": "cardiovascular",
        "blood pressure": "cardiovascular",
        "gut": "digestive",
        "stomach": "digestive",
        "digest": "digestive",
        "immune": "immune",
        "autoimmune": "immune",
        "brain": "nervous",
        "neuro": "nervous",
    }

    conditions = []
    symptoms = []
    lab_markers = []
    body_systems = []

    for keyword, tag in condition_keywords.items():
        if keyword in query_lower:
            conditions.append(tag)

    for keyword, tag in symptom_keywords.items():
        if keyword in query_lower:
            symptoms.append(tag)

    for keyword, tag in lab_keywords.items():
        if keyword in query_lower:
            lab_markers.append(tag)

    for keyword, system in system_keywords.items():
        if keyword in query_lower:
            body_systems.append(system)

    # Generate search queries from the original query
    search_queries = [query]

    return QueryAnalysis(
        conditions=list(set(conditions)),
        symptoms=list(set(symptoms)),
        lab_markers=list(set(lab_markers)),
        body_systems=list(set(body_systems)),
        intent="general query",
        should_expand=True,
        search_queries=search_queries,
    )


# Tool definition for the OpenAI Agents SDK
QUERY_ANALYZER_TOOL_DEFINITION = {
    "type": "function",
    "function": {
        "name": "analyze_query",
        "description": """Analyze a clinical query to extract conditions, symptoms, and lab markers.
        Use this to prepare for knowledge base searches.""",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The query to analyze",
                },
            },
            "required": ["query"],
        },
    },
}
