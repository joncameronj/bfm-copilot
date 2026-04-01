"""Agent Runner - Custom tool-calling loop using the Anthropic SDK.

Replaces the xai-sdk streaming loop with Anthropic's stateless messages API.
Handles multi-turn tool calling via message accumulation.
"""

import asyncio
import json
import re
from dataclasses import dataclass
from typing import AsyncGenerator, Literal

import anthropic

from app.agent.tool_registry import ToolRegistry
from app.utils.logger import get_logger

logger = get_logger("runner")


# Maximum tool-call iterations (safety limit)
MAX_TOOL_ITERATIONS = 10
DEEP_DIVE_NOTICE_PREFIX = "[DEEP_DIVE_NOTICE]"


def extract_system_notices(result: str) -> tuple[str, list[str]]:
    """Extract internal notice lines from tool output before forwarding to model."""
    lines = (result or "").splitlines()
    notices: list[str] = []
    cleaned_lines: list[str] = []
    pattern = re.compile(rf"^{re.escape(DEEP_DIVE_NOTICE_PREFIX)}\s*(.+)$")

    for line in lines:
        match = pattern.match(line.strip())
        if match:
            notices.append(match.group(1).strip())
            continue
        cleaned_lines.append(line)

    cleaned = "\n".join(cleaned_lines).lstrip()
    return cleaned, notices


@dataclass
class StreamEvent:
    """Event emitted by the agent runner during streaming."""

    type: Literal[
        "reasoning_delta",
        "text_delta",
        "text_done",
        "tool_call_start",
        "tool_call_args_delta",
        "tool_call_args_done",
        "tool_call_complete",
        "done",
        "error",
    ]
    data: dict


def _get_thinking_config(reasoning_effort: str | None) -> dict | None:
    """Map reasoning effort string to Anthropic extended thinking config."""
    if not reasoning_effort or reasoning_effort == "low":
        return None
    if reasoning_effort == "medium":
        return {"type": "enabled", "budget_tokens": 5000}
    # high
    return {"type": "enabled", "budget_tokens": 10000}


def _strip_thinking_blocks(content):
    """
    Strip thinking blocks from assistant message content.

    When extended thinking is enabled, assistant messages in conversation history
    must include 'signature' on thinking blocks. Rather than tracking signatures
    through interrupted responses and DB round-trips, we simply strip thinking
    blocks — the model doesn't need its previous reasoning to continue.
    """
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        filtered = [block for block in content if not (
            isinstance(block, dict) and block.get("type") == "thinking"
        )]
        # If only thinking blocks were present, return empty text
        return filtered if filtered else [{"type": "text", "text": ""}]
    return content


class AgentRunner:
    """Custom agent runner with tool-calling loop over Anthropic streaming."""

    def __init__(
        self,
        client: anthropic.AsyncAnthropic,
        model: str,
        instructions: str,
        tool_registry: ToolRegistry | None = None,
        reasoning_effort: str | None = None,
    ):
        self.client = client
        self.model = model
        self.instructions = instructions
        self.tool_registry = tool_registry
        self.reasoning_effort = reasoning_effort

    async def run_streamed(
        self,
        messages: list[dict],
    ) -> AsyncGenerator[StreamEvent, None]:
        """
        Stream agent response with automatic tool-call looping.

        Args:
            messages: List of {"role": ..., "content": ...} dicts (history + current)

        Yields:
            StreamEvent objects for reasoning, text, tool calls, and completion
        """
        # Build Anthropic tools list
        tools = self.tool_registry.get_tool_definitions() if self.tool_registry else None

        # Build thinking config
        thinking = _get_thinking_config(self.reasoning_effort)

        # Build messages for Anthropic (stateless - full history each call)
        # Strip thinking blocks from history — they require signatures that we
        # don't persist through DB round-trips or interrupted responses.
        conversation: list[dict] = [
            {"role": m["role"], "content": _strip_thinking_blocks(m["content"])}
            for m in messages
        ]

        overload_retries = 0
        for iteration in range(MAX_TOOL_ITERATIONS):
            create_params: dict = {
                "model": self.model,
                "system": self.instructions,
                "messages": conversation,
                "max_tokens": 8192,
            }
            if tools:
                create_params["tools"] = tools
            if thinking:
                create_params["thinking"] = thinking

            assistant_content_blocks: list[dict] = []
            accumulated_text = ""
            tool_uses: list[dict] = []
            current_tool_input_json = ""
            current_tool_block: dict | None = None

            try:
                async with self.client.messages.stream(**create_params) as stream:
                    async for event in stream:
                        event_type = event.type

                        # --- Thinking / Reasoning ---
                        if event_type == "content_block_start":
                            block = event.content_block
                            if block.type == "thinking":
                                assistant_content_blocks.append({
                                    "type": "thinking",
                                    "thinking": "",
                                })
                            elif block.type == "text":
                                assistant_content_blocks.append({
                                    "type": "text",
                                    "text": "",
                                })
                            elif block.type == "tool_use":
                                current_tool_block = {
                                    "type": "tool_use",
                                    "id": block.id,
                                    "name": block.name,
                                    "input": {},
                                }
                                current_tool_input_json = ""
                                assistant_content_blocks.append(current_tool_block)

                                yield StreamEvent(
                                    type="tool_call_start",
                                    data={
                                        "tool_name": block.name,
                                        "call_id": block.id,
                                    },
                                )

                        elif event_type == "content_block_delta":
                            delta = event.delta
                            if delta.type == "thinking_delta":
                                # Update the thinking block (for streaming to frontend)
                                if assistant_content_blocks and assistant_content_blocks[-1]["type"] == "thinking":
                                    assistant_content_blocks[-1]["thinking"] += delta.thinking
                                yield StreamEvent(
                                    type="reasoning_delta",
                                    data={"delta": delta.thinking},
                                )
                            elif delta.type == "text_delta":
                                accumulated_text += delta.text
                                if assistant_content_blocks and assistant_content_blocks[-1]["type"] == "text":
                                    assistant_content_blocks[-1]["text"] += delta.text
                                yield StreamEvent(
                                    type="text_delta",
                                    data={"delta": delta.text},
                                )
                            elif delta.type == "input_json_delta":
                                current_tool_input_json += delta.partial_json

                        elif event_type == "content_block_stop":
                            # If we just finished a tool_use block, parse the input
                            if current_tool_block is not None:
                                try:
                                    parsed_input = json.loads(current_tool_input_json) if current_tool_input_json else {}
                                except json.JSONDecodeError:
                                    parsed_input = {}
                                current_tool_block["input"] = parsed_input

                                tool_uses.append({
                                    "id": current_tool_block["id"],
                                    "name": current_tool_block["name"],
                                    "input": parsed_input,
                                })

                                yield StreamEvent(
                                    type="tool_call_args_done",
                                    data={
                                        "tool_name": current_tool_block["name"],
                                        "call_id": current_tool_block["id"],
                                        "arguments": json.dumps(parsed_input),
                                    },
                                )

                                current_tool_block = None
                                current_tool_input_json = ""

            except anthropic.APIStatusError as e:
                # 529 (overloaded) and 503 (service unavailable) — retry with backoff.
                # Use status_code check instead of anthropic.OverloadedError /
                # anthropic.ServiceUnavailableError because those are not exported
                # from the top-level anthropic namespace in all SDK versions.
                if e.status_code in (529, 503):
                    overload_retries += 1
                    if overload_retries <= 3:
                        wait_secs = 2 ** overload_retries  # 2s, 4s, 8s
                        logger.warning(
                            f"Anthropic overloaded (attempt {overload_retries}/3), retrying in {wait_secs}s"
                        )
                        await asyncio.sleep(wait_secs)
                        continue
                    yield StreamEvent(
                        type="error",
                        data={"error": "Anthropic API is temporarily overloaded. Please try again in a moment."},
                    )
                    return
                # If thinking is not supported by this model, retry without it
                if thinking and "thinking" in str(e).lower():
                    logger.warning(
                        "Model does not support extended thinking. Retrying without thinking."
                    )
                    thinking = None
                    continue
                yield StreamEvent(type="error", data={"error": e.message})
                return
            except anthropic.APIError as e:
                yield StreamEvent(type="error", data={"error": str(e)})
                return

            # Append assistant response to conversation history.
            # Strip thinking blocks (avoids signature requirement) and ensure
            # only API-accepted fields are present (no 'parsed_output' etc).
            conversation.append({
                "role": "assistant",
                "content": _strip_thinking_blocks(assistant_content_blocks),
            })

            # Execute tool calls if any
            if tool_uses and self.tool_registry:
                tool_results = []
                for tu in tool_uses:
                    raw_result = await self.tool_registry.execute(tu["name"], tu["input"])
                    result, notices = extract_system_notices(raw_result)
                    if not result.strip():
                        result = "Search complete. Please provide guidance based on your clinical expertise."

                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": tu["id"],
                        "content": result,
                    })

                    yield StreamEvent(
                        type="tool_call_complete",
                        data={
                            "tool_name": tu["name"],
                            "call_id": tu["id"],
                            "result_preview": result[:200] if result else "",
                            "notices": notices,
                        },
                    )

                # Append tool results as a user message and continue the loop
                conversation.append({"role": "user", "content": tool_results})
                continue

            # No tool calls - we're done
            if accumulated_text:
                yield StreamEvent(
                    type="text_done",
                    data={"content": accumulated_text},
                )
            break

        yield StreamEvent(type="done", data={})
