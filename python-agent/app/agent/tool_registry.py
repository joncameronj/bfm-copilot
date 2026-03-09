"""Tool Registry - Manages tool definitions and execution for the custom agent runner.

Produces Anthropic-compatible tool definitions for Claude's tool-use API.
"""

import json
from dataclasses import dataclass, field
from typing import Any, Callable, Awaitable


@dataclass
class ToolDefinition:
    """A registered tool with its schema and handler."""

    name: str
    description: str
    parameters: dict[str, Any]
    handler: Callable[..., Awaitable[str]]


class ToolRegistry:
    """Registry of tools available to the agent runner."""

    def __init__(self) -> None:
        self._tools: dict[str, ToolDefinition] = {}

    def register(
        self,
        name: str,
        description: str,
        parameters: dict[str, Any],
        handler: Callable[..., Awaitable[str]],
    ) -> None:
        """Register a tool with its JSON Schema parameters and async handler."""
        self._tools[name] = ToolDefinition(
            name=name,
            description=description,
            parameters=parameters,
            handler=handler,
        )

    def get_tool_definitions(self) -> list[dict]:
        """Return Anthropic-format tool definitions for client.messages.create(tools=[...])."""
        return [
            {
                "name": t.name,
                "description": t.description,
                "input_schema": t.parameters,
            }
            for t in self._tools.values()
        ]

    async def execute(self, tool_name: str, arguments: str | dict) -> str:
        """Execute a registered tool by name with arguments (JSON string or dict)."""
        if tool_name not in self._tools:
            return json.dumps({"error": f"Unknown tool: {tool_name}"})

        tool_def = self._tools[tool_name]
        try:
            args = arguments if isinstance(arguments, dict) else json.loads(arguments) if arguments else {}
            result = await tool_def.handler(**args)
            return result
        except Exception as e:
            return json.dumps({"error": f"Tool execution failed: {str(e)}"})

    @property
    def tool_names(self) -> list[str]:
        return list(self._tools.keys())
