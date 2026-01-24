"""
Query Analyzer - Extract conditions, symptoms, and search terms from user queries.

Uses GPT-4o to analyze queries and extract structured information for smart RAG search.
Includes diagnostic-to-protocol mappings derived from Dr. Rob's Sunday teaching sessions.
"""

import json
import re
from dataclasses import dataclass, field
from typing import Any

from openai import OpenAI

from app.config import get_settings
from app.services.prompt_service import get_query_analyzer_prompt

# =============================================================================
# DIAGNOSTIC-TO-PROTOCOL MAPPINGS (from Sunday Case Studies)
# =============================================================================

# Frequency mappings derived from Sunday teaching sessions
# Key = diagnostic finding pattern, Value = recommended frequencies
DIAGNOSTIC_TO_FREQUENCY: dict[str, list[str]] = {
    # Brainwave patterns
    "low alpha": ["Alpha Theta"],
    "alpha under 10": ["Alpha Theta"],
    "high beta": ["CP-P", "SNS Balance"],
    "beta dominant": ["CP-P"],
    "high gamma": ["CP-P"],
    "racing brain": ["CP-P"],
    "theta > alpha": ["Alpha Theta"],
    "theta greater than alpha": ["Alpha Theta"],
    "reversed field": ["Alpha Theta"],
    "high delta": ["Melanin"],
    "high waking delta": ["Melanin"],
    "low direct current": ["Melanin"],

    # HRV/Autonomic patterns
    "pns negative": ["PNS Support", "Vagus Support"],
    "parasympathetic negative": ["PNS Support", "Vagus Support"],
    "negative zone": ["PNS Support", "Vagus Support"],
    "sns switched": ["SNS Balance"],
    "sympathetic switched": ["SNS Balance"],
    "sympathetic dominance": ["SNS Balance"],
    "sympathetic dominant": ["SNS Balance"],
    "vagus nerve": ["Vagus Support"],
    "vagal tone": ["Vagus Support"],
    "autonomic dysfunction": ["PNS Support", "SNS Balance"],

    # Organ-specific
    "pituitary": ["Pit P Support"],
    "pituitary issues": ["Pit P Support"],
    "medulla": ["Medula Support"],
    "medulla issues": ["Medula Support"],
    "sacral": ["Sacral Plexus"],
    "sacral plexus": ["Sacral Plexus"],
    "kidney": ["Kidney Support", "Kidney Vitality", "Kidney Repair"],
    "kidney issues": ["Kidney Support", "Kidney Vitality"],

    # Diabetes-specific (sacral plexus for autonomic neuropathy)
    "diabetes": ["Sacral Plexus", "Alpha Theta", "SNS Balance"],
    "diabetic": ["Sacral Plexus", "Alpha Theta", "SNS Balance"],
    "glucose spillover": ["Sacral Plexus"],
    "diabetic neuropathy": ["Sacral Plexus"],
    "autonomic neuropathy": ["Sacral Plexus"],

    # Biotoxin markers
    "failed vcs": ["Biotoxin", "Leptin Resist"],
    "vcs fail": ["Biotoxin", "Leptin Resist"],
    "biotoxin illness": ["Biotoxin"],
    "biotoxic": ["Biotoxin"],
    "high cytokines": ["Cyto Lower"],
    "cytokine storm": ["Cyto Lower"],
    "elevated cytokines": ["Cyto Lower"],
    "leptin resistance": ["Leptin Resist"],
    "leptin resist": ["Leptin Resist"],
    "high leptin": ["Leptin Resist"],

    # Labs/EMF
    "emf exposure": ["NS EMF"],
    "emf sensitivity": ["NS EMF"],
    "electromagnetic": ["NS EMF"],

    # Labs-driven kidney protocols
    "low egfr": ["Kidney Vitality", "Kidney Repair"],
    "egfr low": ["Kidney Vitality", "Kidney Repair"],
    "stage 5 ckd": ["Kidney Vitality", "Kidney Repair"],
    "kidney failure": ["Kidney Vitality", "Kidney Repair"],
    "high creatinine": ["Kidney Support", "Kidney Vitality"],
    "creatinine high": ["Kidney Support", "Kidney Vitality"],
    "proteinuria": ["Kidney Support"],
    "high bun": ["Kidney Support"],

    # Labs-driven anemia protocols
    "anemia": ["NS EMF"],
    "low hemoglobin": ["NS EMF"],
    "hemoglobin low": ["NS EMF"],
    "low hematocrit": ["NS EMF"],

    # Stress patterns (from D-Pulse/HRV)
    "high stress index": ["SNS Balance"],
    "elevated stress": ["SNS Balance"],
    "poor stress response": ["SNS Balance"],
    "stress response poor": ["SNS Balance"],

    # Spinal/D-Pulse patterns
    "low cervical": ["Medula Support"],
    "cervical low": ["Medula Support"],
    "low thoracic": ["Medula Support"],
    "thoracic low": ["Medula Support"],
    "spinal issues": ["Medula Support"],

    # Thyroid-pituitary axis
    "thyroid": ["Pit P Support"],
    "thyroid issues": ["Pit P Support"],
    "pituitary thyroid": ["Pit P Support"],
    "hypothyroid": ["Pit P Support"],
    "hyperthyroid": ["Pit P Support"],
}

# Supplement mappings derived from Sunday teaching sessions
DIAGNOSTIC_TO_SUPPLEMENT: dict[str, list[str]] = {
    # VCS/Biotoxin triggers (must address early)
    "vcs fail": ["Pectasol-C", "Apex", "Cell Synergy"],
    "failed vcs": ["Pectasol-C", "Apex", "Cell Synergy"],
    "vcs failure": ["Pectasol-C", "Apex", "Cell Synergy"],
    "vcs low": ["Pectasol-C", "Apex", "Cell Synergy"],

    # pH issues
    "low ph": ["Cell Synergy", "Tri Salts"],
    "acidic ph": ["Cell Synergy", "Tri Salts"],
    "ph under 6.5": ["Cell Synergy", "Tri Salts"],
    "metabolic acidosis": ["Cell Synergy", "Tri Salts"],

    # Urinalysis markers
    "protein in urine": ["X-39"],
    "proteinuria": ["X-39"],
    "ub rate": ["X-39"],
    "msh issues": ["X-39"],

    # Iron/ferritin
    "high ferritin": ["Deuterium Drops"],
    "elevated ferritin": ["Deuterium Drops"],
    "iron overload": ["Deuterium Drops"],
    "deuterium": ["Deuterium Drops"],

    # Biotoxin support
    "biotoxin illness": ["Pectasol-C", "Apex", "Cell Synergy"],
    "biotoxic": ["Pectasol-C", "Apex", "Cell Synergy"],
    "mold toxicity": ["Pectasol-C", "Apex"],
    "mycotoxin": ["Pectasol-C", "Apex"],
    "detox support": ["Pectasol-C"],

    # Circulation
    "circulation issues": ["Serculate"],
    "poor circulation": ["Serculate"],
    "blood flow": ["Serculate"],
    "low heart": ["Serculate"],
    "heart low": ["Serculate"],
    "cardiovascular": ["Serculate"],

    # General/foundational - these conditions typically need Cell Synergy
    "energetic debt": ["Cell Synergy"],
    "general support": ["Cell Synergy"],
    "foundational": ["Cell Synergy"],
    "low physiological resources": ["Cell Synergy"],
    "diabetes": ["Cell Synergy", "X-39"],
    "diabetic": ["Cell Synergy", "X-39"],
    "neurological": ["Cell Synergy"],

    # Hydration/specific gravity
    "high specific gravity": ["Deuterium Drops"],
    "dehydration": ["Deuterium Drops"],
    "concentrated urine": ["Deuterium Drops"],

    # Kidney-related (often need Deuterium)
    "kidney issues": ["Deuterium Drops"],
    "kidney problems": ["Deuterium Drops"],
    "kidney failure": ["Deuterium Drops"],
    "low egfr": ["Deuterium Drops"],

    # Anemia (needs Deuterium for oxygen support)
    "anemia": ["Deuterium Drops"],
    "low hemoglobin": ["Deuterium Drops"],
}

# Dynamic protocol loading from database
# Loaded lazily on first use, cached with TTL
from app.services.protocol_loader import get_known_frequencies, get_known_supplements


def _get_frequencies() -> set[str]:
    """Get known frequency names (loaded from DB with caching)."""
    return get_known_frequencies()


def _get_supplements() -> set[str]:
    """Get known supplement names."""
    return get_known_supplements()

# Canonical body systems used in the DB/search filters
ALLOWED_BODY_SYSTEMS = {
    "endocrine",
    "cardiovascular",
    "digestive",
    "immune",
    "nervous",
    "respiratory",
    "musculoskeletal",
    "reproductive",
    "urinary",
    "integumentary",
    "lymphatic",
}


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
    # Protocol suggestions from diagnostic mappings
    suggested_frequencies: list[str] = field(default_factory=list)
    suggested_supplements: list[str] = field(default_factory=list)
    diagnostic_patterns: list[str] = field(default_factory=list)

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
            suggested_frequencies=data.get("suggested_frequencies", []) or [],
            suggested_supplements=data.get("suggested_supplements", []) or [],
            diagnostic_patterns=data.get("diagnostic_patterns", []) or [],
        )

    def all_tags(self) -> list[str]:
        """Get all extracted tags for database matching."""
        tags = set()
        tags.update(self.conditions)
        tags.update(self.symptoms)
        tags.update(self.lab_markers)
        return list(tags)

    def all_protocols(self) -> list[str]:
        """Get all suggested protocols (frequencies + supplements) for boosting."""
        protocols = set()
        protocols.update(self.suggested_frequencies)
        protocols.update(self.suggested_supplements)
        return list(protocols)


def extract_protocols_from_diagnostics(text: str) -> tuple[list[str], list[str], list[str]]:
    """
    Extract suggested frequencies and supplements from diagnostic patterns in text.

    Scans text for known diagnostic patterns (from DIAGNOSTIC_TO_FREQUENCY and
    DIAGNOSTIC_TO_SUPPLEMENT mappings) and returns the corresponding protocols.

    Args:
        text: Query or diagnostic text to analyze

    Returns:
        Tuple of (frequencies, supplements, matched_patterns)
    """
    text_lower = text.lower()
    frequencies: set[str] = set()
    supplements: set[str] = set()
    matched_patterns: list[str] = []

    # Check frequency mappings
    for pattern, freqs in DIAGNOSTIC_TO_FREQUENCY.items():
        if pattern in text_lower:
            frequencies.update(freqs)
            matched_patterns.append(pattern)

    # Check supplement mappings
    for pattern, supps in DIAGNOSTIC_TO_SUPPLEMENT.items():
        if pattern in text_lower:
            supplements.update(supps)
            matched_patterns.append(pattern)

    return list(frequencies), list(supplements), matched_patterns


def detect_explicit_protocols(text: str) -> tuple[list[str], list[str]]:
    """
    Detect explicitly mentioned protocol names in text.

    Scans for known frequency and supplement names that are directly
    mentioned in the query (e.g., "What does Alpha Theta do?").

    Args:
        text: Text to scan for protocol mentions

    Returns:
        Tuple of (mentioned_frequencies, mentioned_supplements)
    """
    text_lower = text.lower()

    # Use dynamic protocol lists from database
    known_frequencies = _get_frequencies()
    known_supplements = _get_supplements()

    mentioned_frequencies = [
        freq for freq in known_frequencies
        if freq in text_lower
    ]

    mentioned_supplements = [
        supp for supp in known_supplements
        if supp in text_lower
    ]

    return mentioned_frequencies, mentioned_supplements


def enrich_analysis_with_protocols(analysis: "QueryAnalysis", query: str) -> "QueryAnalysis":
    """
    Enrich a QueryAnalysis with protocol suggestions from diagnostic mappings.

    This post-processes the analysis to add suggested frequencies and supplements
    based on diagnostic patterns found in the query.

    Args:
        analysis: The base QueryAnalysis from AI or fallback
        query: The original query text

    Returns:
        Enriched QueryAnalysis with protocol suggestions
    """
    # Extract from diagnostic patterns
    frequencies, supplements, patterns = extract_protocols_from_diagnostics(query)

    # Also check conditions for protocol mappings
    for condition in analysis.conditions:
        cond_freqs, cond_supps, cond_patterns = extract_protocols_from_diagnostics(condition)
        frequencies.extend(cond_freqs)
        supplements.extend(cond_supps)
        patterns.extend(cond_patterns)

    # Detect explicit protocol mentions
    mentioned_freqs, mentioned_supps = detect_explicit_protocols(query)
    frequencies.extend(mentioned_freqs)
    supplements.extend(mentioned_supps)

    # Update analysis with deduplicated results
    analysis.suggested_frequencies = list(set(frequencies))
    analysis.suggested_supplements = list(set(supplements))
    analysis.diagnostic_patterns = list(set(patterns))

    return analysis


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
            parsed = QueryAnalysis.from_dict(data)
            parsed.body_systems = _filter_allowed_systems(
                _normalize_body_systems(parsed.body_systems)
            )
            # Enrich with protocol suggestions from diagnostic mappings
            enriched = enrich_analysis_with_protocols(parsed, query)
            return enriched

    except Exception as e:
        print(f"Warning: Query analysis failed: {e}")

    # Fallback: basic keyword extraction
    fallback = _fallback_analysis(query)
    fallback.body_systems = _filter_allowed_systems(
        _normalize_body_systems(fallback.body_systems)
    )
    # Enrich fallback with protocol suggestions
    enriched_fallback = enrich_analysis_with_protocols(fallback, query)
    return enriched_fallback


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
        # HRV and autonomic nervous system conditions
        "hrv": "autonomic_dysfunction",
        "heart rate variability": "autonomic_dysfunction",
        "sns switched": "sns_switched",
        "sns switch": "sns_switched",
        "sympathetic switched": "sns_switched",
        "sympathetic dominance": "sympathetic_dominance",
        "pns negative": "pns_negative",
        "parasympathetic negative": "pns_negative",
        "negative zone": "pns_negative",
        "autonomic": "autonomic_dysfunction",
        "ptsd": "ptsd",
        "trauma": "emotional_trauma",
        "deal breaker": "deal_breaker",
        "fight or flight": "sympathetic_dominance",
        # VCS, biotoxin, and leptin-related conditions
        "vcs": "biotoxin_illness",
        "visual contrast": "biotoxin_illness",
        "contrast sensitivity": "biotoxin_illness",
        "biotoxin": "biotoxin_illness",
        "biotoxic": "biotoxin_illness",
        "leptin": "leptin_resistance",
        "leptin resist": "leptin_resistance",
        "msh": "msh_deficiency",
        "alpha msh": "msh_deficiency",
        "melanocyte": "msh_deficiency",
        "marcons": "marcons_infection",
        "staph": "staph_infection",
        "mold": "mold_toxicity",
        "mycotoxin": "mold_toxicity",
        "cirs": "biotoxin_illness",
        "pentasol": "biotoxin_protocol",
        "binder": "biotoxin_protocol",
        "detox": "detoxification",
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
        # HRV and autonomic nervous system
        "hrv": "nervous",
        "sns": "nervous",
        "pns": "nervous",
        "sympathetic": "nervous",
        "parasympathetic": "nervous",
        "autonomic": "nervous",
        "heart rate variability": "nervous",
        "valsalva": "nervous",
        "ortho": "nervous",
        # VCS and biotoxin (affects multiple systems)
        "vcs": "immune",
        "visual contrast": "immune",
        "biotoxin": "immune",
        "leptin": "endocrine",
        "msh": "endocrine",
        "mold": "immune",
        "cirs": "immune",
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


def _normalize_body_systems(systems: list[str]) -> list[str]:
    """
    Lightweight normalization: lowercase and trim trailing "system(s)".
    Canonical enforcement happens in _filter_allowed_systems.
    """
    normalized = []
    for s in systems or []:
        key = s.strip().lower()
        # Drop trailing "system"/"systems"
        if key.endswith(" systems"):
            key = key[: -len(" systems")]
        elif key.endswith(" system"):
            key = key[: -len(" system")]
        key = key.strip()
        normalized.append(key)

    return normalized


def _filter_allowed_systems(systems: list[str]) -> list[str]:
    """Keep only body systems that are in the allowed canonical set."""
    return [s for s in systems if s in ALLOWED_BODY_SYSTEMS]

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
