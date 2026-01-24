"""
SSE Event Mapper - Maps OpenAI Agents SDK events to SSE format.

This module bridges the Agent SDK's streaming events to the frontend's
expected Server-Sent Events format, maintaining backward compatibility
while adding support for new Agent SDK event types.
"""

import json
import time
from typing import AsyncGenerator, Literal

from agents import Runner


class SSEEventMapper:
    """
    Maps OpenAI Agents SDK streaming events to SSE format.

    This class processes the Agent SDK's stream_events() output and converts
    each event into the SSE format expected by the frontend, preserving
    backward compatibility with existing event types while supporting
    new Agent SDK features.
    """

    def __init__(
        self,
        user_id: str,
        user_role: Literal["admin", "practitioner", "member"],
    ):
        """
        Initialize the SSE event mapper.

        Args:
            user_id: User ID for RAG search (source emission)
            user_role: User role for RAG filtering (source emission)
        """
        self.user_id = user_id
        self.user_role = user_role
        self.step_counter = 0
        self.reasoning_start_time: float | None = None
        self.active_tool_steps: dict[str, dict] = {}
        self.current_tool_name: str | None = None
        self.current_tool_arguments: str = ""

    async def emit_sse(self, event_type: str, data: dict) -> str:
        """
        Format an event as an SSE message.

        Args:
            event_type: The event type (text_delta, reasoning_delta, etc.)
            data: Event data to include

        Returns:
            Formatted SSE string
        """
        return f"data: {json.dumps({'type': event_type, **data})}\n\n"

    async def process_stream(
        self,
        result: Runner,
    ) -> AsyncGenerator[str, None]:
        """
        Process Agent SDK stream and yield SSE events.

        This method handles three types of Agent SDK events:
        1. RawResponsesStreamEvent - Token-by-token LLM output (text, reasoning)
        2. RunItemStreamEvent - Semantic boundaries (tool start/end, message complete)
        3. AgentUpdatedStreamEvent - Agent handoff (future multi-agent support)

        Args:
            result: The RunResultStreaming from Runner.run_streamed()

        Yields:
            SSE-formatted event strings
        """
        try:
            async for event in result.stream_events():
                event_type = getattr(event, "type", None)

                # Debug: Log all event types to diagnose missing reasoning events
                if event_type == "raw_response_event":
                    raw_type = getattr(event.data, "type", "unknown")
                    print(f"[SSE Debug] raw_response_event: {raw_type}")

                # ============================================================
                # Raw Response Events (token-level streaming)
                # ============================================================
                if event_type == "raw_response_event":
                    raw_data = event.data

                    # Reasoning text delta (streaming reasoning tokens)
                    if raw_data.type == "response.reasoning_text.delta":
                        if self.reasoning_start_time is None:
                            self.reasoning_start_time = time.time()
                            self.step_counter += 1
                            yield await self.emit_sse("step_start", {
                                "step_id": f"reasoning-{self.step_counter}",
                                "label": "Thinking...",
                            })

                        elapsed_ms = int((time.time() - self.reasoning_start_time) * 1000)
                        yield await self.emit_sse("reasoning_delta", {
                            "delta": raw_data.delta,
                            "elapsed_ms": elapsed_ms,
                        })

                    # Reasoning text done
                    elif raw_data.type == "response.reasoning_text.done":
                        if self.reasoning_start_time is not None:
                            elapsed_ms = int((time.time() - self.reasoning_start_time) * 1000)
                            yield await self.emit_sse("step_complete", {
                                "step_id": f"reasoning-{self.step_counter}",
                            })
                            summary = getattr(raw_data, "summary", None)
                            yield await self.emit_sse("reasoning_done", {
                                "summary": summary,
                                "elapsed_ms": elapsed_ms,
                            })
                            self.reasoning_start_time = None

                    # Output text delta (streaming response tokens)
                    elif raw_data.type == "response.output_text.delta":
                        yield await self.emit_sse("text_delta", {
                            "delta": raw_data.delta,
                        })

                    # Output text done
                    elif raw_data.type == "response.output_text.done":
                        yield await self.emit_sse("text_done", {
                            "content": raw_data.text,
                        })

                    # Function call output item added (tool call starting)
                    elif raw_data.type == "response.output_item.added":
                        item = getattr(raw_data, "item", None)
                        if item and getattr(item, "type", None) == "function_call":
                            item_id = getattr(item, "id", None)
                            call_id = getattr(item, "call_id", None) or item_id
                            tool_name = getattr(item, "name", "unknown")

                            self.step_counter += 1
                            step_id = f"tool-{self.step_counter}"
                            self.active_tool_steps[item_id] = {
                                "step_id": step_id,
                                "name": tool_name,
                                "call_id": call_id,
                            }
                            self.current_tool_name = tool_name
                            self.current_tool_arguments = ""

                            # User-friendly labels for tools (natural language)
                            labels = {
                                "search_knowledge_base_tool": "Searching for information...",
                                "search_knowledge_base": "Searching for information...",
                            }
                            label = labels.get(tool_name, "Processing...")

                            yield await self.emit_sse("step_start", {
                                "step_id": step_id,
                                "label": label,
                            })

                    # Function call arguments delta (streaming tool arguments)
                    elif raw_data.type == "response.function_call_arguments.delta":
                        delta = getattr(raw_data, "delta", "")
                        self.current_tool_arguments += delta

                        yield await self.emit_sse("tool_call", {
                            "toolCall": {
                                "id": getattr(raw_data, "item_id", ""),
                                "type": "function",
                                "function": {
                                    "name": self.current_tool_name,
                                    "arguments": delta,
                                },
                            },
                        })

                    # Function call arguments done
                    elif raw_data.type == "response.function_call_arguments.done":
                        item_id = getattr(raw_data, "item_id", None)

                        # Note: We no longer proactively emit sources here.
                        # The search tool will run its own search and return results.
                        # This eliminates a duplicate RAG search (saves 10-20s).
                        # Sources will be emitted when the tool completes via run_item_stream_event.

                        # Emit step update with search query details (if applicable)
                        if item_id and item_id in self.active_tool_steps:
                            step_info = self.active_tool_steps[item_id]

                            # Parse query from arguments for search tools
                            if step_info["name"] in ["search_knowledge_base_tool", "search_knowledge_base"]:
                                try:
                                    args = json.loads(self.current_tool_arguments)
                                    query = args.get("query", "")
                                    if query:
                                        truncated = query[:50] + ("..." if len(query) > 50 else "")
                                        yield await self.emit_sse("step_update", {
                                            "step_id": step_info["step_id"],
                                            "label": f"Searching: {truncated}",
                                        })
                                except Exception:
                                    pass

                        # Note: step_complete is emitted when the tool actually finishes
                        # (in run_item_stream_event when function_call_output is received)

                # ============================================================
                # Run Item Events (semantic boundaries)
                # ============================================================
                elif event_type == "run_item_stream_event":
                    run_item = event.item

                    # Tool call output completed - mark the step as complete now
                    if hasattr(run_item, "type") and run_item.type == "function_call_output":
                        # Find the step by call_id and mark complete
                        call_id = getattr(run_item, "call_id", None)
                        for item_id, step_info in self.active_tool_steps.items():
                            if step_info.get("call_id") == call_id:
                                yield await self.emit_sse("step_complete", {
                                    "step_id": step_info["step_id"],
                                })
                                break

                    # Message output completed
                    elif hasattr(run_item, "type") and run_item.type == "message":
                        # Could emit message_complete event here if needed
                        pass

                # ============================================================
                # Agent Updated Events (agent handoffs)
                # ============================================================
                elif event_type == "agent_updated_stream_event":
                    old_agent = getattr(event, "old_agent", None)
                    new_agent = getattr(event, "new_agent", None)

                    yield await self.emit_sse("agent_handoff", {
                        "from_agent": old_agent.name if old_agent else None,
                        "to_agent": new_agent.name if new_agent else "unknown",
                        "reason": "Agent switched to handle specialized task",
                    })

            # Stream complete
            yield await self.emit_sse("done", {})
            yield "data: [DONE]\n\n"

        except Exception as e:
            import traceback
            print(f"[SSE Mapper Error] {e}")
            traceback.print_exc()
            yield await self.emit_sse("error", {"error": str(e)})
            yield "data: [DONE]\n\n"

