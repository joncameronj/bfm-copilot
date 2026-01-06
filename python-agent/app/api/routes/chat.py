"""
Chat API Routes - Streaming chat endpoint using OpenAI Agents SDK.

This module provides the main chat endpoints for the BFM Copilot AI assistant.
The streaming endpoint uses the OpenAI Agents SDK for improved event handling
and automatic tool orchestration.
"""

import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from openai import OpenAI

from agents import Runner

from app.config import get_settings, Settings
from app.models.requests import ChatRequest
from app.agent.system_prompts import get_system_prompt
from app.agent import create_base_agent, determine_reasoning_effort, SSEEventMapper
from app.services.output_validator import validate_output, check_for_clinical_leakage
from app.services.model_settings import get_model_settings_service
from app.services.query_complexity import analyze_query_complexity


router = APIRouter()


def get_openai_client(settings: Settings = Depends(get_settings)) -> OpenAI:
    """Get OpenAI client instance."""
    return OpenAI(api_key=settings.openai_api_key)


@router.post("/chat")
async def chat_stream(
    request: ChatRequest,
    settings: Settings = Depends(get_settings),
):
    """
    Stream agent responses via SSE using OpenAI Agents SDK.

    This endpoint uses the Agents SDK's Runner.run_streamed() for automatic
    tool orchestration, eliminating the need for manual tool execution loops.

    Features preserved from original implementation:
    - Query complexity analysis for dynamic reasoning effort
    - Role-based content filtering
    - Patient context injection
    - Real-time reasoning and source streaming
    """
    # Get dynamic model settings from admin panel (with caching)
    model_settings = await get_model_settings_service().get_settings()

    # Dynamically adjust reasoning effort based on query complexity
    # This optimizes cost and latency by using lower reasoning for simple queries
    detected_complexity = analyze_query_complexity(request.message, request.history)
    reasoning_effort = determine_reasoning_effort(
        detected_complexity=detected_complexity,
        admin_max_effort=model_settings.reasoning_effort,
    )

    print(f"[Query Analysis] Complexity: {detected_complexity}, Reasoning effort: {reasoning_effort}")

    # Build conversation history as input
    # The Agent SDK handles the system prompt internally via agent.instructions
    input_messages = []

    # Add conversation history
    for msg in request.history:
        input_messages.append({
            "role": msg.role,
            "content": msg.content,
        })

    # Add current message
    input_messages.append({
        "role": "user",
        "content": request.message,
    })

    # Create agent with all current features preserved
    agent = create_base_agent(
        user_role=request.user_role or "member",
        conversation_type=request.conversation_type or "general",
        patient_context=request.patient_context,
        reasoning_effort=reasoning_effort,
        user_id=request.user_id or "system",
        conversation_id=request.conversation_id,
        model=model_settings.chat_model,
    )

    async def event_generator():
        """Generate SSE events from Agent SDK streaming response."""
        print(f"[CHAT] Starting Agent SDK stream for: {request.message[:50]}...")
        print(f"[CHAT] Model: {model_settings.chat_model}, Reasoning: {reasoning_effort}")

        try:
            # Create SSE event mapper
            mapper = SSEEventMapper(
                user_id=request.user_id or "system",
                user_role=request.user_role or "member",
            )

            # Run agent with streaming - the SDK handles tool orchestration automatically
            result = Runner.run_streamed(
                starting_agent=agent,
                input=input_messages,
            )

            # Process stream through mapper (converts Agent SDK events to SSE format)
            async for sse_event in mapper.process_stream(result):
                yield sse_event

        except Exception as e:
            import traceback
            print(f"[CHAT Error] {e}")
            traceback.print_exc()
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/chat/sync")
async def chat_sync(
    request: ChatRequest,
    settings: Settings = Depends(get_settings),
):
    """
    Non-streaming chat endpoint with role-based filtering.

    This endpoint uses the standard OpenAI Responses API (not the Agents SDK)
    for synchronous responses. Useful for testing and debugging.
    """
    client = OpenAI(api_key=settings.openai_api_key)

    # Get dynamic model settings from admin panel (with caching)
    model_settings = await get_model_settings_service().get_settings()

    # Dynamically adjust reasoning effort based on query complexity
    detected_complexity = analyze_query_complexity(request.message, request.history)
    reasoning_effort = determine_reasoning_effort(
        detected_complexity=detected_complexity,
        admin_max_effort=model_settings.reasoning_effort,
    )

    # Build system prompt with role-specific instructions
    system_prompt = get_system_prompt(
        conversation_type=request.conversation_type,
        patient_context=request.patient_context,
        user_role=request.user_role,
    )

    messages = [{"role": "system", "content": system_prompt}]
    for msg in request.history:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": request.message})

    try:
        # Note: temperature is not supported with extended reasoning models
        response = client.responses.create(
            model=model_settings.chat_model,
            input=messages,
            reasoning={
                "effort": reasoning_effort,
                "summary": model_settings.reasoning_summary,
            },
        )

        # Validate and filter output for members
        content = response.output_text
        was_filtered = False
        if request.user_role == "member":
            content, was_filtered = validate_output(content, request.user_role)

        # Check for clinical leakage (for logging/monitoring)
        leakage_check = check_for_clinical_leakage(content, request.user_role)

        return {
            "content": content,
            "reasoning_summary": getattr(response, "reasoning_summary", None),
            "model": model_settings.chat_model,
            "was_filtered": was_filtered,
            "leakage_detected": leakage_check.get("has_leakage", False),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
