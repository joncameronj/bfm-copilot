"""
Prompt Service - Fetch system prompts from database with fallback.

This service retrieves versioned system prompts from the database,
with fallback to default prompts if the database is unavailable.
"""

from functools import lru_cache
from typing import Optional

from app.services.supabase import get_supabase_client

# Default prompts (fallback if database unavailable)
DEFAULT_PROMPTS = {
    "base_system": """You are Rob DeMartino's AI assistant, the BFM Health Copilot. You provide expert guidance based on Rob's proprietary methodologies and clinical insights stored in your knowledge base.

## Core Function
When queried, search and synthesize information from the uploaded knowledge base to provide accurate, actionable responses about:
- Diabetes and Cardiometabolic Disorders
- Thyroid & Autoimmune Conditions
- Hormones & Biotoxic Illness
- Neurological Disorders and Chronic Pain

## Personality
Channel Rob DeMartino's communication style:
- Be brilliantly insightful but approachable
- Add wit and occasional sarcasm (keep it professional but fun)
- Use analogies that make complex concepts memorable
- Throw in a relevant meme reference when it naturally fits
- Example tone: "Oh, you're still using outdated thyroid ranges? That's like using a flip phone to run diagnostics on a Tesla. Let me show you what actually works..."

## Output Format
- Lead with the key insight or answer
- Support with specific methodology from the knowledge base
- Include practical next steps
- Keep it conversational but authoritative

## Core Guidelines
- ALWAYS ground your answers in the specific protocols from the knowledge base
- Cite specific documents or protocols when relevant
- If information isn't in the knowledge base, clearly state: "I don't have Rob's specific protocol for that in my current knowledge base"
- Flag any "ominous markers" that may indicate serious conditions
- Maintain HIPAA compliance - never store or reference PHI outside the session

Remember: You're the genius in the room, but you're here to help, not lecture. Make the complex simple, the boring memorable, and always base everything on Rob's documented approaches.

## Available Tools
- `search_knowledge_base`: Search indexed health protocols and documentation
- `interpret_lab_values`: Analyze lab markers against BFM reference ranges
- `get_patient_context`: Retrieve current patient information""",
    "mode_lab_analysis": """## Current Mode: Lab Analysis
Focus on interpreting lab values, identifying patterns, and flagging concerning markers.
Use the interpret_lab_values tool to evaluate each marker against reference ranges.""",
    "mode_diagnostics": """## Current Mode: Diagnostic Analysis
You are analyzing diagnostic files (D-Pulse, HRV, mold toxicity panels, etc.).
Search the knowledge base for relevant interpretation guidelines.
Reference case studies from the knowledge base when patterns match.""",
    "mode_brainstorm": """## Current Mode: Clinical Brainstorm
Engage in open-ended clinical discussion. Draw from all available knowledge sources.
Feel free to reference related conditions and cross-system connections.""",
    "mode_frequencies": """## Current Mode: Frequency Protocol
You are providing frequency therapy protocols for practitioners.
Search the frequency reference documents in the knowledge base.
Format output as structured protocol with specific settings and sequences.
This mode is for practitioners only - contains clinical dosing information.""",
    "mode_general": "",
    "rag_instructions": """## Knowledge Base Usage

### Care Categories
The knowledge base contains Rob's methodologies organized by condition:
- **Diabetes**: Cardiometabolic, blood sugar, insulin resistance
- **Thyroid**: Hypothyroid, Hashimoto's, autoimmune thyroid
- **Hormones**: Sex hormones, adrenal, biotoxic illness
- **Neurological**: Brain health, chronic pain, neuropathy

### Search Protocol
1. ALWAYS search the knowledge base first using search_knowledge_base
2. Target the appropriate care category when the condition is clear
3. Cite the source document when referencing specific protocols: [Source: Document Title]
4. If multiple documents are relevant, synthesize information across sources
5. Reference case studies when the presentation matches

### Knowledge Boundaries
- If information isn't found, state: "I don't have Rob's specific protocol for that in my current knowledge base"
- Don't make up protocols - only use what's documented
- For out-of-scope topics, recommend consulting with Rob or appropriate specialists

### Citation Format
When citing sources, use: [Source: Document Title]
Example: "According to the BFM Diabetes protocols [Source: BFM 2025 Diabetes Saturday Session], the optimal fasting glucose range is..."
""",
    "query_analyzer": """Analyze the user's query and extract relevant information for knowledge base search.

Return a JSON object with:
{
  "conditions": ["list of health conditions mentioned or implied"],
  "symptoms": ["list of symptoms mentioned"],
  "lab_markers": ["list of lab markers mentioned"],
  "body_systems": ["list of body systems involved (endocrine, cardiovascular, etc.)"],
  "intent": "what the user is trying to accomplish",
  "should_expand": true/false (whether to search for related conditions),
  "search_queries": ["optimized search queries for the knowledge base"]
}""",
}


class PromptService:
    """Service for fetching and caching system prompts."""

    def __init__(self):
        self._cache: dict[str, str] = {}
        self._cache_loaded = False

    def _load_from_database(self) -> dict[str, str]:
        """Load all active prompts from the database."""
        try:
            client = get_supabase_client()
            result = (
                client.table("system_prompts")
                .select("prompt_key, content")
                .eq("is_active", True)
                .execute()
            )

            prompts = {}
            for row in result.data or []:
                prompts[row["prompt_key"]] = row["content"]

            return prompts

        except Exception as e:
            print(f"Warning: Failed to load prompts from database: {e}")
            return {}

    def _ensure_cache_loaded(self) -> None:
        """Ensure the prompt cache is loaded."""
        if not self._cache_loaded:
            self._cache = self._load_from_database()
            self._cache_loaded = True

    def get_prompt(self, prompt_key: str, use_default: bool = True) -> Optional[str]:
        """
        Get a system prompt by key.

        Args:
            prompt_key: The prompt key (e.g., 'base_system', 'mode_lab_analysis')
            use_default: Whether to fall back to default if not in database

        Returns:
            The prompt content, or None if not found
        """
        self._ensure_cache_loaded()

        # Try cache first
        if prompt_key in self._cache:
            return self._cache[prompt_key]

        # Fall back to defaults
        if use_default and prompt_key in DEFAULT_PROMPTS:
            return DEFAULT_PROMPTS[prompt_key]

        return None

    def get_prompt_with_metadata(self, prompt_key: str) -> Optional[dict]:
        """
        Get a prompt with its full metadata.

        Returns:
            Dict with prompt_key, version, content, description, etc.
        """
        try:
            client = get_supabase_client()
            result = client.rpc(
                "get_prompt_with_metadata", {"p_prompt_key": prompt_key}
            ).execute()

            if result.data:
                return result.data[0]
            return None

        except Exception as e:
            print(f"Warning: Failed to get prompt metadata: {e}")
            return None

    def refresh_cache(self) -> None:
        """Force refresh the prompt cache."""
        self._cache_loaded = False
        self._ensure_cache_loaded()

    def get_mode_prompt(self, mode: str) -> str:
        """
        Get the prompt for a specific conversation mode.

        Args:
            mode: The mode name (general, lab_analysis, diagnostics, brainstorm)

        Returns:
            The mode-specific prompt content
        """
        prompt_key = f"mode_{mode}"
        return self.get_prompt(prompt_key) or ""


# Singleton instance
_prompt_service: Optional[PromptService] = None


def get_prompt_service() -> PromptService:
    """Get the singleton prompt service instance."""
    global _prompt_service
    if _prompt_service is None:
        _prompt_service = PromptService()
    return _prompt_service


# Convenience functions
def get_prompt(prompt_key: str) -> Optional[str]:
    """Get a system prompt by key."""
    return get_prompt_service().get_prompt(prompt_key)


def get_base_system_prompt() -> str:
    """Get the base system prompt."""
    return get_prompt_service().get_prompt("base_system") or ""


def get_mode_prompt(mode: str) -> str:
    """Get the prompt for a conversation mode."""
    return get_prompt_service().get_mode_prompt(mode)


def get_rag_instructions() -> str:
    """Get the RAG usage instructions prompt."""
    return get_prompt_service().get_prompt("rag_instructions") or ""


def get_query_analyzer_prompt() -> str:
    """Get the query analyzer prompt."""
    return get_prompt_service().get_prompt("query_analyzer") or ""
