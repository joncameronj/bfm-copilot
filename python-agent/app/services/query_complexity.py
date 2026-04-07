"""Query Complexity Analyzer

Analyzes incoming queries to determine the appropriate reasoning effort level.
This helps optimize cost and latency by using lower reasoning effort for simple questions
while preserving full reasoning power for complex clinical queries.
"""

import re
from typing import Literal


def analyze_query_complexity(
    message: str,
    history: list | None = None,
    has_files: bool = False,
) -> Literal["low", "medium", "high"]:
    """
    Analyze query and return appropriate reasoning effort level.

    This also drives model selection: "low" routes to the fast model (Haiku),
    while "medium"/"high" route to the full chat model (Sonnet).

    Args:
        message: The user's current message
        history: Optional conversation history (not used currently, reserved for future)
        has_files: Whether the message includes file attachments

    Returns:
        "low", "medium", or "high" reasoning effort level
    """
    # Normalize message
    cleaned = message.strip().lower()
    word_count = len(cleaned.split())

    # Simple heuristics
    low_indicators = 0
    high_indicators = 0

    # 0. Greetings and small-talk → always low
    greeting_patterns = [
        r'^(hi|hello|hey|thanks|thank you|ok|okay|yes|no|sure|got it|sounds good)\s*[!.?]*$',
        r'^good\s+(morning|afternoon|evening)\s*[!.?]*$',
    ]
    for pattern in greeting_patterns:
        if re.match(pattern, cleaned):
            return "low"

    # 1. File attachments bump complexity — analyzing files needs more power
    if has_files:
        high_indicators += 1

    # 2. Message length
    # Low: < 20 words - usually factual lookups
    # High: > 50 words - usually complex multi-part queries
    if word_count < 20:
        low_indicators += 2
    elif word_count > 50:
        high_indicators += 1

    # 3. Question type patterns
    # Low: What, when, where, who, define, explain briefly
    simple_question_patterns = [
        r'^what\s+is',
        r'^when\s+',
        r'^where\s+',
        r'^who\s+',
        r'^define\s+',
        r'^what\s+are\s+',
        r'^\s*define',
        r'^\s*explain\s+\w+\s+\w+\s*\??\s*$',  # "explain X Y" - usually simple
    ]
    for pattern in simple_question_patterns:
        if re.match(pattern, cleaned):
            low_indicators += 1
            break

    # High: How to treat, differential diagnosis, protocol design, case analysis
    complex_patterns = [
        r'how\s+to\s+treat',
        r'differential\s+diagnosis',
        r'protocol',
        r'patient\s+has',
        r'case\s+of',
        r'presenting\s+with',
        r'experiencing',
        r'contradicting',
        r'conflicting',
        r'both\s+high\s+and\s+low',
        r'unusual\s+',
        r'ominous',
    ]
    for pattern in complex_patterns:
        if re.search(pattern, cleaned):
            high_indicators += 1
            break

    # 4. Clinical data presence
    # High: Has numbers, ranges, lab values
    if re.search(r'\d+\s*-\s*\d+|\d+\s*(mg|iu|ml|mcg|ng|pg|meq)', cleaned):
        high_indicators += 1

    # 5. Logical connectors suggesting multi-part analysis
    # Medium/High: "and", "but", "however", "despite", "although"
    complexity_words = ['but', 'however', 'despite', 'although', 'contradicts', 'versus']
    for word in complexity_words:
        if word in cleaned:
            high_indicators += 1
            break

    # 6. Request complexity
    # High: "help me design", "what should", "how would you"
    if any(phrase in cleaned for phrase in ['help me design', 'what should', 'how would you', 'recommend', 'suggest protocol']):
        high_indicators += 1

    # 6. Multi-condition / comorbidity queries
    # Multiple medical terms in one query = complex clinical reasoning
    medical_terms = [
        'hypothyroidism', 'hyperthyroidism', 'hashimoto', 'adrenal', 'insulin',
        'diabetes', 'cortisol', 'thyroid', 'autoimmune', 'inflammation',
        'neurological', 'hormonal', 'deficiency', 'resistance', 'toxicity',
        'supplements', 'dosing', 'frequency', 'concurrent', 'comorbid',
        'levothyroxine', 'antibodies', 'elevated', 'depleted',
    ]
    medical_count = sum(1 for term in medical_terms if term in cleaned)
    if medical_count >= 3:
        high_indicators += 2  # Strong signal — complex clinical query

    # Decision logic
    # High indicators outweigh low indicators
    if high_indicators >= 2:
        return "high"
    elif high_indicators == 1 and low_indicators < 2:
        return "high"
    elif low_indicators >= 2 and high_indicators == 0:
        return "low"
    else:
        return "medium"
