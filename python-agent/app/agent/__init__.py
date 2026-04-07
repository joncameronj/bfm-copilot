"""
Agent module - Anthropic SDK based agent with custom runner.

This module provides agent definitions and streaming utilities for
the BFM Copilot AI assistant.
"""

from app.agent.streaming import SSEEventMapper
from app.agent.definitions.base_agent import (
    create_base_agent,
    determine_reasoning_effort,
    determine_model_for_complexity,
    AgentConfig,
)

__all__ = [
    "SSEEventMapper",
    "create_base_agent",
    "determine_reasoning_effort",
    "determine_model_for_complexity",
    "AgentConfig",
]
