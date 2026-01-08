"""
Base Agent Definition - BFM Copilot agent using OpenAI Agents SDK.

Creates the main agent with role-based configuration, RAG tools,
and dynamic reasoning capabilities.
"""

from typing import Literal

from agents import Agent, ModelSettings
from openai.types.shared import Reasoning

from app.agent.system_prompts import get_system_prompt
from app.models.messages import PatientContext
from app.tools.rag_search import create_search_knowledge_base_tool


def create_base_agent(
    user_role: Literal["admin", "practitioner", "member"] = "member",
    conversation_type: str = "general",
    patient_context: PatientContext | None = None,
    reasoning_effort: str = "high",
    user_id: str = "system",
    conversation_id: str | None = None,
    model: str = "gpt-5.2",
) -> Agent:
    """
    Create the BFM Copilot agent with role-based configuration.

    This preserves all current functionality:
    - Role-based content filtering (system prompt)
    - Patient context injection
    - Dynamic reasoning effort
    - Conversation type modes

    Args:
        user_role: User role for content filtering (admin, practitioner, member)
        conversation_type: Conversation mode (general, lab_analysis, diagnostics, brainstorm)
        patient_context: Optional patient context to include in system prompt
        reasoning_effort: Reasoning effort level (low, medium, high)
        user_id: User ID for RAG access control
        conversation_id: Optional conversation ID for logging
        model: Model to use (default: gpt-5.2)

    Returns:
        Configured Agent instance
    """
    # Build system prompt with role-specific instructions
    instructions = get_system_prompt(
        conversation_type=conversation_type,
        patient_context=patient_context,
        user_role=user_role,
        include_rag_instructions=True,
    )

    # Create search tool with user context injected via closure
    # This preserves the existing search_knowledge_base functionality
    search_tool = create_search_knowledge_base_tool(
        user_id=user_id,
        user_role=user_role,
        conversation_id=conversation_id,
    )

    # Create agent with all current features preserved
    agent = Agent(
        name="bfm_copilot",
        model=model,
        instructions=instructions,
        tools=[search_tool],
        model_settings=ModelSettings(
            reasoning=Reasoning(
                effort=reasoning_effort,  # Dynamic: low/medium/high
                summary="detailed",
            )
        ),
    )

    return agent


def determine_reasoning_effort(
    detected_complexity: str,
    admin_max_effort: str = "high",
) -> str:
    """
    Determine the reasoning effort based on query complexity.

    This preserves the dynamic reasoning effort logic from the original
    implementation, allowing lower effort for simple queries to optimize
    cost and latency.

    Args:
        detected_complexity: Detected query complexity (low, medium, high)
        admin_max_effort: Maximum effort allowed by admin settings

    Returns:
        Actual reasoning effort to use
    """
    # Only override to lower effort if beneficial
    if detected_complexity == "low" and admin_max_effort == "high":
        return "low"
    elif detected_complexity == "medium" and admin_max_effort == "high":
        return "medium"

    return admin_max_effort
