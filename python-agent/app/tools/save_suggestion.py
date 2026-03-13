"""
Save Wellness Suggestion Tool - Saves educational wellness suggestions for members.

CRITICAL LEGAL CONSTRAINT:
- Educational purposes ONLY
- NO protocols, dosing, frequencies, or treatment instructions
- Use support/promote/help language only
- Forbidden words: cure, fix, heal, protocol, frequency, supplement dose
"""

import json
import re

from app.services.supabase import get_supabase_client


SAVE_SUGGESTION_TOOL_DESCRIPTION = (
    "Save an educational wellness suggestion for the member based on "
    "Dr. Rob DeMartino's BFM Foundations course content. "
    "CRITICAL: Educational only — no protocols, dosing, frequencies, or treatment. "
    "Use 'support/promote/help' language only. "
    "Forbidden words: cure, fix, heal, protocol, frequency, supplement dose."
)

SAVE_SUGGESTION_TOOL_SCHEMA = {
    "type": "object",
    "properties": {
        "content": {
            "type": "string",
            "description": "Educational suggestion text. Must use supportive language only.",
        },
        "category": {
            "type": "string",
            "enum": ["general", "nutrition", "lifestyle", "sleep", "light", "environment"],
            "description": "Category of the wellness suggestion.",
        },
        "source_module": {
            "type": "string",
            "description": "Course module reference (e.g., 'Module 3: The 3 Pillars')",
        },
    },
    "required": ["content", "category"],
}

# Patterns that indicate forbidden clinical content
FORBIDDEN_PATTERNS = [
    re.compile(r"\d+\s*(mg|IU|ml|mcg|iu|Mg|ML)", re.IGNORECASE),
    re.compile(r"\b(cure|fix|heal|protocol|frequency|dosing|dose)\b", re.IGNORECASE),
]


def validate_suggestion_content(content: str) -> str | None:
    """Validate suggestion content for legal compliance. Returns error message or None."""
    for pattern in FORBIDDEN_PATTERNS:
        match = pattern.search(content)
        if match:
            return f"Suggestion contains forbidden content: '{match.group()}'. Rewrite using educational language only."
    return None


def create_save_suggestion_handler(user_id: str, conversation_id: str | None = None):
    """Create a closure-based handler for saving wellness suggestions."""

    async def handler(
        content: str,
        category: str,
        source_module: str | None = None,
    ) -> str:
        # Validate content for legal compliance
        validation_error = validate_suggestion_content(content)
        if validation_error:
            return json.dumps({"error": validation_error})

        try:
            supabase = get_supabase_client()

            source_context = None
            if source_module:
                source_context = json.dumps({"module": source_module})

            row = {
                "user_id": user_id,
                "content": content,
                "category": category,
                "status": "pending",
                "source_context": source_context,
                "conversation_id": conversation_id,
                "iteration_count": 0,
            }

            result = supabase.table("suggestions").insert(row).execute()

            if result.data:
                return json.dumps({
                    "success": True,
                    "suggestion_id": result.data[0]["id"],
                    "message": "Educational wellness suggestion saved successfully.",
                })
            else:
                return json.dumps({"error": "Failed to save suggestion"})

        except Exception as e:
            return json.dumps({"error": f"Failed to save suggestion: {str(e)}"})

    return handler
