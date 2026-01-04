"""
Output Validator - Validates and filters AI responses based on user role.

Ensures members don't receive clinical content like dosages or treatment protocols.
Provides defense-in-depth against prompt injection and data leakage.
"""

import re
from typing import Literal

# Patterns that indicate clinical content (dosages, protocols, etc.)
CLINICAL_PATTERNS = [
    # Dosage patterns (e.g., "500 mg", "100 IU", "2 ml")
    r"\b\d+\s*(mg|mcg|ug|μg|IU|ml|mL|cc|g|gram|grams)\b",
    # Frequency patterns (e.g., "twice daily", "BID", "every 4 hours")
    r"\b(twice|three times|once|twice|thrice)\s+(daily|a day|per day|weekly)\b",
    r"\b(BID|TID|QID|QD|PRN|q\d+h)\b",
    r"\bevery\s+\d+\s+(hours?|days?)\b",
    # Dosing terminology
    r"\b(dose|dosage|dosing|titrate|titration)\b",
    # Administration terminology
    r"\b(administer|prescribe|prescribed|prescription)\b",
    # Protocol terminology (when combined with specific instructions)
    r"\b(loading dose|maintenance dose|therapeutic dose)\b",
    # Specific treatment instructions
    r"\b(take|inject|infuse)\s+\d+",
]

# Compiled regex for efficiency
CLINICAL_REGEX = re.compile("|".join(CLINICAL_PATTERNS), re.IGNORECASE)

# Keywords that suggest health-related content (for adding disclaimers)
HEALTH_KEYWORDS = [
    "supplement", "vitamin", "mineral", "health", "wellness",
    "nutrition", "diet", "exercise", "sleep", "stress",
    "hormone", "thyroid", "adrenal", "cortisol", "insulin",
    "inflammation", "immune", "gut", "digestion", "metabolism",
]

# Disclaimer for member responses
MEMBER_DISCLAIMER = """

---
*This information is for educational purposes only and is not intended as medical advice. Please consult your healthcare provider for personalized recommendations and before making any changes to your health regimen.*
"""

# Warning for filtered content
FILTERED_CONTENT_WARNING = """

---
*Note: Some clinical details have been generalized. For specific treatment recommendations, please consult your healthcare provider.*
"""


class OutputValidator:
    """Validates and filters AI responses based on user role."""

    def __init__(self, user_role: Literal["admin", "practitioner", "member"]):
        """
        Initialize the validator with a user role.

        Args:
            user_role: The user's role for content filtering
        """
        self.user_role = user_role

    def validate_and_filter(self, response: str) -> tuple[str, bool]:
        """
        Validate and filter response for role appropriateness.

        Args:
            response: The AI-generated response text

        Returns:
            tuple: (filtered_response, was_modified)
        """
        if self.user_role != "member":
            # Practitioners and admins get unfiltered content
            return response, False

        was_modified = False

        # Check for clinical content in member responses
        if self._contains_clinical_content(response):
            response = self._filter_clinical_content(response)
            was_modified = True

        # Add disclaimer for health-related content
        if self._is_health_content(response) and not was_modified:
            response = response + MEMBER_DISCLAIMER
            was_modified = True

        return response, was_modified

    def _contains_clinical_content(self, text: str) -> bool:
        """Check if text contains clinical content patterns."""
        return bool(CLINICAL_REGEX.search(text))

    def _filter_clinical_content(self, response: str) -> str:
        """
        Filter clinical specifics from member responses.

        Replaces specific dosages and clinical instructions with
        generalized guidance.
        """
        # Replace dosage mentions with general guidance
        filtered = CLINICAL_REGEX.sub(
            "[specific dosing - consult your healthcare provider]",
            response
        )
        return filtered + FILTERED_CONTENT_WARNING

    def _is_health_content(self, text: str) -> bool:
        """Check if text contains health-related content."""
        text_lower = text.lower()
        return any(keyword in text_lower for keyword in HEALTH_KEYWORDS)


def validate_output(
    response: str,
    user_role: Literal["admin", "practitioner", "member"]
) -> tuple[str, bool]:
    """
    Convenience function to validate and filter a response.

    Args:
        response: The AI-generated response text
        user_role: The user's role for content filtering

    Returns:
        tuple: (filtered_response, was_modified)
    """
    validator = OutputValidator(user_role)
    return validator.validate_and_filter(response)


def check_for_clinical_leakage(
    response: str,
    user_role: str,
) -> dict:
    """
    Check if clinical content leaked to a member response.

    Used for logging and monitoring.

    Args:
        response: The response text to check
        user_role: The user's role

    Returns:
        dict with leakage analysis
    """
    if user_role != "member":
        return {"has_leakage": False, "patterns_found": []}

    patterns_found = []
    for pattern in CLINICAL_PATTERNS:
        matches = re.findall(pattern, response, re.IGNORECASE)
        if matches:
            patterns_found.extend(matches)

    return {
        "has_leakage": len(patterns_found) > 0,
        "patterns_found": patterns_found[:10],  # Limit to first 10
        "total_matches": len(patterns_found),
    }
