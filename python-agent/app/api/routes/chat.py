import json
import time
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from openai import OpenAI

from app.config import get_settings, Settings
from app.models.requests import ChatRequest
from app.agent.system_prompts import get_system_prompt
from app.services.output_validator import validate_output, check_for_clinical_leakage
from app.services.model_settings import get_model_settings_service
from app.tools.rag_search import search_knowledge_base, smart_search

# Tool definition for the Responses API (flat format)
RESPONSES_API_TOOLS = [
    {
        "type": "function",
        "name": "search_knowledge_base",
        "description": """Search the BFM health knowledge base for protocols, lab interpretation guides,
        and clinical documentation. Use this tool to find evidence-based guidelines and reference
        materials relevant to the current patient case or clinical question.""",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query describing what information you need to find",
                },
            },
            "required": ["query"],
            "additionalProperties": False,
        },
        "strict": True,
    }
]

router = APIRouter()


def get_openai_client(settings: Settings = Depends(get_settings)) -> OpenAI:
    """Get OpenAI client instance."""
    return OpenAI(api_key=settings.openai_api_key)


@router.post("/chat")
async def chat_stream(
    request: ChatRequest,
    settings: Settings = Depends(get_settings),
):
    """Stream agent responses via SSE with reasoning visibility and role-based filtering."""
    client = OpenAI(api_key=settings.openai_api_key)

    # Get dynamic model settings from admin panel (with caching)
    model_settings = await get_model_settings_service().get_settings()

    # Build system prompt with role-specific instructions
    system_prompt = get_system_prompt(
        conversation_type=request.conversation_type,
        patient_context=request.patient_context,
        user_role=request.user_role,
    )

    # Build messages array
    messages = [{"role": "system", "content": system_prompt}]

    # Add conversation history
    for msg in request.history:
        messages.append({"role": msg.role, "content": msg.content})

    # Add current message
    messages.append({"role": "user", "content": request.message})

    # Map tool names to user-friendly labels
    STEP_LABELS = {
        "search_knowledge_base": "Searching knowledge base...",
        "smart_search": "Searching BFM protocols...",
        "search_medical_literature": "Searching PubMed...",
        "get_frequency_protocol": "Retrieving frequency protocol...",
        "analyze_query": "Analyzing your question...",
    }

    async def event_generator():
        """Generate SSE events from OpenAI response."""
        reasoning_start_time = time.time()
        in_reasoning = False
        step_counter = 0
        active_tool_steps = {}  # Track active tool call steps
        pending_tool_args = {}  # Accumulate tool arguments for source extraction

        try:
            # Use the Responses API with streaming and dynamic model settings
            response = client.responses.create(
                model=model_settings.chat_model,
                input=messages,
                tools=RESPONSES_API_TOOLS,
                reasoning={
                    "effort": model_settings.reasoning_effort,
                    "summary": model_settings.reasoning_summary,
                },
                stream=True,
            )

            for event in response:
                # Handle reasoning events
                if hasattr(event, "type"):
                    if event.type == "response.reasoning_text.delta":
                        if not in_reasoning:
                            in_reasoning = True
                            reasoning_start_time = time.time()
                            # Emit step_start for reasoning
                            step_counter += 1
                            yield f"data: {json.dumps({'type': 'step_start', 'step_id': f'reasoning-{step_counter}', 'label': 'Thinking...'})}\n\n"
                        elapsed_ms = int((time.time() - reasoning_start_time) * 1000)
                        yield f"data: {json.dumps({'type': 'reasoning_delta', 'delta': event.delta, 'elapsed_ms': elapsed_ms})}\n\n"

                    elif event.type == "response.reasoning_text.done":
                        elapsed_ms = int((time.time() - reasoning_start_time) * 1000)
                        summary = getattr(event, "summary", None)
                        # Emit step_complete for reasoning
                        yield f"data: {json.dumps({'type': 'step_complete', 'step_id': f'reasoning-{step_counter}'})}\n\n"
                        yield f"data: {json.dumps({'type': 'reasoning_done', 'summary': summary, 'elapsed_ms': elapsed_ms})}\n\n"
                        in_reasoning = False

                    elif event.type == "response.output_text.delta":
                        yield f"data: {json.dumps({'type': 'text_delta', 'delta': event.delta})}\n\n"

                    elif event.type == "response.output_text.done":
                        yield f"data: {json.dumps({'type': 'text_done', 'content': event.text})}\n\n"

                    elif event.type == "response.output_item.added":
                        # Check if this is a function call item
                        item = getattr(event, "item", None)
                        if item and getattr(item, "type", None) == "function_call":
                            item_id = getattr(item, "id", None)
                            tool_name = getattr(item, "name", "unknown")

                            if item_id and item_id not in active_tool_steps:
                                step_counter += 1
                                step_id = f"tool-{step_counter}"
                                active_tool_steps[item_id] = {"step_id": step_id, "name": tool_name}
                                label = STEP_LABELS.get(tool_name, f"Running {tool_name}...")
                                yield f"data: {json.dumps({'type': 'step_start', 'step_id': step_id, 'label': label})}\n\n"

                    elif event.type == "response.function_call_arguments.delta":
                        item_id = getattr(event, "item_id", None)
                        delta = getattr(event, "delta", "")

                        if item_id:
                            tool_info = active_tool_steps.get(item_id, {})
                            tool_name = tool_info.get("name", "unknown")
                            yield f"data: {json.dumps({'type': 'tool_call', 'toolCall': {'id': item_id, 'type': 'function', 'function': {'name': tool_name, 'arguments': delta}}})}\n\n"

                            # Accumulate arguments for source extraction
                            if item_id not in pending_tool_args:
                                pending_tool_args[item_id] = ""
                            pending_tool_args[item_id] += delta

                    elif event.type == "response.function_call_arguments.done":
                        # Emit step_complete for tool call
                        item_id = getattr(event, "item_id", None)
                        if item_id and item_id in active_tool_steps:
                            step_id = active_tool_steps[item_id]["step_id"]
                            tool_name = active_tool_steps[item_id].get("name", "unknown")
                            yield f"data: {json.dumps({'type': 'step_complete', 'step_id': step_id})}\n\n"

                            # Extract sources for RAG search
                            if tool_name == "search_knowledge_base" and item_id in pending_tool_args:
                                try:
                                    args = json.loads(pending_tool_args[item_id])
                                    query = args.get("query", "")
                                    if query:
                                        # Run search to get source metadata
                                        results = await smart_search(
                                            query=query,
                                            user_id=request.user_id or "system",
                                            user_role=request.user_role or "member",
                                            limit=5,
                                            threshold=0.6,
                                        )
                                        # Emit sources event
                                        sources = [
                                            {
                                                "id": f"src-{i}",
                                                "title": r.title,
                                                "type": "knowledge",
                                                "category": r.document_category,
                                                "bodySystem": r.body_system,
                                            }
                                            for i, r in enumerate(results)
                                        ]
                                        if sources:
                                            yield f"data: {json.dumps({'type': 'sources', 'sources': sources})}\n\n"
                                except (json.JSONDecodeError, Exception) as e:
                                    print(f"Warning: Failed to extract sources: {e}")

                    elif event.type == "response.done":
                        yield f"data: {json.dumps({'type': 'done'})}\n\n"

                    elif event.type == "error":
                        yield f"data: {json.dumps({'type': 'error', 'error': str(event.error)})}\n\n"

            yield "data: [DONE]\n\n"

        except Exception as e:
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
    """Non-streaming chat endpoint with role-based filtering."""
    client = OpenAI(api_key=settings.openai_api_key)

    # Get dynamic model settings from admin panel (with caching)
    model_settings = await get_model_settings_service().get_settings()

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
        response = client.responses.create(
            model=model_settings.chat_model,
            input=messages,
            reasoning={
                "effort": model_settings.reasoning_effort,
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
