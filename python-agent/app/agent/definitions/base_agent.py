"""
Base Agent Definition - BFM Copilot agent using the Anthropic SDK.

Creates the main agent configuration with role-based settings, RAG tools,
and dynamic reasoning capabilities.
"""

from dataclasses import dataclass
from typing import Literal

from app.agent.system_prompts import get_system_prompt
from app.agent.tool_registry import ToolRegistry
from app.models.messages import PatientContext
from app.tools.rag_search import (
    RAG_SEARCH_TOOL_SCHEMA,
    RAG_SEARCH_TOOL_DESCRIPTION,
    create_search_handler,
)
from app.tools.web_search import (
    WEB_SEARCH_TOOL_SCHEMA,
    WEB_SEARCH_TOOL_DESCRIPTION,
    create_web_search_handler,
)
from app.services.ai_client import get_chat_model


@dataclass
class AgentConfig:
    """Configuration for the BFM Copilot agent."""

    name: str
    model: str
    instructions: str
    tool_registry: ToolRegistry
    reasoning_effort: str


def create_base_agent(
    user_role: Literal["admin", "practitioner", "member"] = "member",
    conversation_type: str = "general",
    patient_context: PatientContext | None = None,
    reasoning_effort: str = "high",
    user_id: str = "system",
    conversation_id: str | None = None,
    model: str | None = None,
    deep_dive: bool = False,
) -> AgentConfig:
    """
    Create the BFM Copilot agent config with role-based configuration.

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
        model: Model to use (default: from AI provider settings)
        deep_dive: Whether to enable deep-dive retrieval guardrails for tool calls

    Returns:
        Configured AgentConfig instance
    """
    # Get model from provider if not explicitly specified
    if model is None:
        model = get_chat_model()

    # Build system prompt with role-specific instructions
    instructions = get_system_prompt(
        conversation_type=conversation_type,
        patient_context=patient_context,
        user_role=user_role,
        include_rag_instructions=True,
    )

    # Build tool registry
    tool_registry = ToolRegistry()

    # Register RAG search tool with user context injected via closure
    tool_registry.register(
        name="search_knowledge_base",
        description=RAG_SEARCH_TOOL_DESCRIPTION,
        parameters=RAG_SEARCH_TOOL_SCHEMA,
        handler=create_search_handler(
            user_id=user_id,
            user_role=user_role,
            conversation_id=conversation_id,
            deep_dive=deep_dive,
        ),
    )

    # Register web search tool
    tool_registry.register(
        name="search_medical_sources",
        description=WEB_SEARCH_TOOL_DESCRIPTION,
        parameters=WEB_SEARCH_TOOL_SCHEMA,
        handler=create_web_search_handler(),
    )

    return AgentConfig(
        name="bfm_copilot",
        model=model,
        instructions=instructions,
        tool_registry=tool_registry,
        reasoning_effort=reasoning_effort,
    )


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
