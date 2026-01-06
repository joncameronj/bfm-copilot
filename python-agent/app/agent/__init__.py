"""
Agent module - OpenAI Agents SDK integration.

This module provides agent definitions and streaming utilities for
the BFM Copilot AI assistant.
"""

from app.agent.streaming import SSEEventMapper
from app.agent.definitions.base_agent import create_base_agent, determine_reasoning_effort

__all__ = [
    "SSEEventMapper",
    "create_base_agent",
    "determine_reasoning_effort",
]
