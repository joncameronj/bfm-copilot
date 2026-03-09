"""
SSE Event Mapper - Maps custom AgentRunner StreamEvents to SSE format.

This module bridges the agent runner's streaming events to the frontend's
expected Server-Sent Events format, maintaining backward compatibility
with the existing event types.
"""

import json
import time
from typing import AsyncGenerator, Literal

from app.agent.runner import StreamEvent
from app.utils.logger import get_logger

logger = get_logger("streaming")


class SSEEventMapper:
    """
    Maps AgentRunner StreamEvents to SSE format.

    This class processes the runner's async generator output and converts
    each event into the SSE format expected by the frontend, preserving
    backward compatibility with existing event types.
    """

    def __init__(
        self,
        user_id: str,
        user_role: Literal["admin", "practitioner", "member"],
    ):
        self.user_id = user_id
        self.user_role = user_role
        self.step_counter = 0
        self.reasoning_start_time: float | None = None
        self.active_tool_steps: dict[str, dict] = {}

    async def emit_sse(self, event_type: str, data: dict) -> str:
        return f"data: {json.dumps({'type': event_type, **data})}\n\n"

    async def process_stream(
        self,
        events: AsyncGenerator[StreamEvent, None],
    ) -> AsyncGenerator[str, None]:
        """
        Process AgentRunner stream and yield SSE events.

        Maps StreamEvent types to the SSE format the frontend expects:
        - step_start, reasoning_delta, reasoning_done, step_complete
        - text_delta, text_done
        - tool_call, step_update, deep_dive_notice
        - done, error

        Args:
            events: AsyncGenerator of StreamEvent from AgentRunner.run_streamed()

        Yields:
            SSE-formatted event strings
        """
        try:
            async for event in events:
                # Reasoning deltas
                if event.type == "reasoning_delta":
                    if self.reasoning_start_time is None:
                        self.reasoning_start_time = time.time()
                        self.step_counter += 1
                        yield await self.emit_sse("step_start", {
                            "step_id": f"reasoning-{self.step_counter}",
                            "label": "Thinking...",
                        })

                    elapsed_ms = int((time.time() - self.reasoning_start_time) * 1000)
                    yield await self.emit_sse("reasoning_delta", {
                        "delta": event.data["delta"],
                        "elapsed_ms": elapsed_ms,
                    })

                # Text deltas
                elif event.type == "text_delta":
                    # If reasoning was happening, close it first
                    if self.reasoning_start_time is not None:
                        elapsed_ms = int((time.time() - self.reasoning_start_time) * 1000)
                        yield await self.emit_sse("step_complete", {
                            "step_id": f"reasoning-{self.step_counter}",
                        })
                        yield await self.emit_sse("reasoning_done", {
                            "summary": None,
                            "elapsed_ms": elapsed_ms,
                        })
                        self.reasoning_start_time = None

                    yield await self.emit_sse("text_delta", {
                        "delta": event.data["delta"],
                    })

                # Text done
                elif event.type == "text_done":
                    yield await self.emit_sse("text_done", {
                        "content": event.data.get("content", ""),
                    })

                # Tool call starting
                elif event.type == "tool_call_start":
                    # Close reasoning step if still open
                    if self.reasoning_start_time is not None:
                        elapsed_ms = int((time.time() - self.reasoning_start_time) * 1000)
                        yield await self.emit_sse("step_complete", {
                            "step_id": f"reasoning-{self.step_counter}",
                        })
                        yield await self.emit_sse("reasoning_done", {
                            "summary": None,
                            "elapsed_ms": elapsed_ms,
                        })
                        self.reasoning_start_time = None

                    tool_name = event.data.get("tool_name", "unknown")
                    call_id = event.data.get("call_id", "")

                    self.step_counter += 1
                    step_id = f"tool-{self.step_counter}"
                    self.active_tool_steps[call_id] = {
                        "step_id": step_id,
                        "name": tool_name,
                    }

                    # User-friendly labels for tools
                    labels = {
                        "search_knowledge_base": "Searching for information...",
                        "search_medical_sources": "Searching medical sources...",
                    }
                    label = labels.get(tool_name, "Processing...")

                    yield await self.emit_sse("step_start", {
                        "step_id": step_id,
                        "label": label,
                    })

                # Tool call arguments done (emit tool_call event for frontend)
                elif event.type == "tool_call_args_done":
                    tool_name = event.data.get("tool_name", "")
                    call_id = event.data.get("call_id", "")
                    arguments = event.data.get("arguments", "")

                    yield await self.emit_sse("tool_call", {
                        "toolCall": {
                            "id": call_id,
                            "type": "function",
                            "function": {
                                "name": tool_name,
                                "arguments": arguments,
                            },
                        },
                    })

                    # Emit step_update with search query details
                    step_info = self.active_tool_steps.get(call_id)
                    if step_info and tool_name == "search_knowledge_base":
                        try:
                            args = json.loads(arguments)
                            query = args.get("query", "")
                            if query:
                                truncated = query[:50] + ("..." if len(query) > 50 else "")
                                yield await self.emit_sse("step_update", {
                                    "step_id": step_info["step_id"],
                                    "label": f"Searching: {truncated}",
                                })
                        except Exception:
                            pass

                # Tool call complete
                elif event.type == "tool_call_complete":
                    call_id = event.data.get("call_id", "")
                    step_info = self.active_tool_steps.get(call_id)
                    if step_info:
                        yield await self.emit_sse("step_complete", {
                            "step_id": step_info["step_id"],
                        })

                    for notice in event.data.get("notices", []) or []:
                        if not notice:
                            continue
                        yield await self.emit_sse("deep_dive_notice", {
                            "level": "warning",
                            "message": notice,
                        })

                # Done
                elif event.type == "done":
                    pass  # Will emit done below

                # Error
                elif event.type == "error":
                    yield await self.emit_sse("error", {
                        "error": event.data.get("error", "Unknown error"),
                    })

            # Stream complete
            yield await self.emit_sse("done", {})
            yield "data: [DONE]\n\n"

        except Exception as e:
            import traceback
            logger.error(f"SSE Mapper Error: {e}")
            traceback.print_exc()
            yield await self.emit_sse("error", {"error": str(e)})
            yield "data: [DONE]\n\n"
