"""
Chat API Routes - Streaming chat endpoint using the Anthropic SDK.

This module provides the main chat endpoints for the BFM Copilot AI assistant.
The streaming endpoint uses a custom AgentRunner for tool-calling loops
over the Anthropic messages API.
"""

import json
import re
import asyncio
import time
from typing import AsyncGenerator
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response, StreamingResponse

from app.models.requests import ChatRequest
from app.agent.system_prompts import get_system_prompt
from app.agent import create_base_agent, determine_reasoning_effort
from app.agent.runner import _get_thinking_config, _strip_thinking_blocks, compute_max_tokens, DEFAULT_MAX_TOKENS
from app.services.output_validator import validate_output, check_for_clinical_leakage
from app.services.model_settings import get_model_settings_service
from app.services.query_complexity import analyze_query_complexity
from app.services.ai_client import get_async_client, get_opus_model
from app.services.supabase import get_supabase_client
from app.services.protocol_loader import get_known_supplements
from app.tools.rag_search import sunday_first_search
from app.tools.query_analyzer import analyze_query
from app.embeddings.embedder import embed_query
from app.utils.logger import get_logger

logger = get_logger("chat")

router = APIRouter()


PROTOCOL_SUPPLEMENT_QUERY_PATTERNS = [
    r"\bprotocols?\b",
    r"\bsupplement(?:s|ation)?\b",
    r"\bfrequency\b",
    r"\bwhen do i give\b",
    r"\bwhen should i give\b",
    r"\bhow do i dose\b",
    r"\bdos(?:e|ing)\b",
    r"\bdeuterium\b",
    r"\bdrops?\b",
    # Five Levers / Archimedes Levers — always need RAG grounding
    r"\b(?:5|five)\s+levers?\b",
    r"\barchimedes\s+levers?\b",
    r"\bmaster\s+levers?\b",
    r"\bthe\s+levers?\b",
]

NORMAL_PRESEARCH_LIMIT = 5
NORMAL_PRESEARCH_THRESHOLD = 0.25
NORMAL_PRESEARCH_MIN_SUNDAY = 1
NORMAL_PRESEARCH_EXCERPTS_PER_CATEGORY = 2

DEEP_PRESEARCH_LIMIT = 18
DEEP_PRESEARCH_THRESHOLD = 0.20
DEEP_PRESEARCH_MIN_SUNDAY = 6
DEEP_PRESEARCH_EXCERPTS_PER_CATEGORY = 5


def _is_protocol_or_supplement_query(message: str) -> bool:
    """Return True when the query likely needs protocol/supplement grounding."""
    text = (message or "").lower()
    return any(re.search(pattern, text) for pattern in PROTOCOL_SUPPLEMENT_QUERY_PATTERNS)


DEFINITIONAL_QUERY_PATTERNS = [
    r"^what (?:is|are|does|do)\b",
    r"^(?:can you )?(?:explain|define|describe)\b",
    r"^(?:tell me )?(?:about |what ).{0,40}(?:mean|means|is)\b",
    r"^how (?:is|are|does|do) .{1,30} (?:defined|work)\b",
]


def _is_definitional_query(message: str) -> bool:
    """Return True for simple definitional questions that don't need presearch."""
    text = (message or "").lower().strip()
    return any(re.search(pattern, text) for pattern in DEFINITIONAL_QUERY_PATTERNS)


# Health/science terms that signal a query needs BFM knowledge (RAG + Sonnet).
# BFM redefines how many substances and body systems work through frequency
# medicine, so even "What is vitamin D?" needs the BFM perspective, not Haiku.
_HEALTH_RELATED_PATTERNS = re.compile(
    r"\b("
    # Vitamins, minerals, supplements
    r"vitamin|mineral|magnesium|zinc|iron|calcium|potassium|selenium|iodine|"
    r"b12|folate|omega|coq10|glutathione|melatonin|probiotics?|"
    # Hormones and markers
    r"hormone|insulin|cortisol|thyroid|tsh|t3|t4|estrogen|testosterone|"
    r"progesterone|dhea|leptin|ghrelin|serotonin|dopamine|oxytocin|"
    # Body systems and conditions
    r"adrenal|liver|kidney|gut|brain|nervous|immune|lymph|mitochondri|"
    r"autoimmune|inflammation|diabetes|hypothyroid|hyperthyroid|hashimoto|"
    r"anemia|fatigue|insomnia|anxiety|depression|"
    # BFM-specific terms
    r"deuterium|frequency|frequencies|protocol|supplement|dosing|dose|"
    r"fsm|bfm|bioenergetic|mold|toxicity|detox|parasite|"
    r"hrv|brainwave|valsalva|ortho|urinalysis|"
    # Medical/clinical terms
    r"blood\s*panel|lab\s*results?|marker|diagnosis|symptom|treatment|"
    r"patient|clinical|pathology|deficiency|resistance|"
    # General health
    r"health|wellness|healing|nutrition|diet|fasting|sleep|stress|exercise|"
    r"chronic|acute|pain|energy|weight|metaboli"
    r")\b",
    re.IGNORECASE,
)


def _is_health_related_query(message: str) -> bool:
    """Return True if the query contains any health, medical, or BFM-related terms.

    Used by prompt routing to ensure health queries always use Sonnet (with RAG)
    instead of Haiku, since BFM teaches unique perspectives on many substances
    and body systems that differ from mainstream medicine.
    """
    return bool(_HEALTH_RELATED_PATTERNS.search(message or ""))


def _build_presearch_query(base_message: str, category_keyword: str) -> str:
    """Build a focused query for category-specific Sunday presearch."""
    return f"{base_message} {category_keyword} sunday protocols supplements"


def _clip_excerpt(text: str, max_len: int = 420) -> str:
    text = (text or "").strip().replace("\n", " ")
    return text if len(text) <= max_len else text[: max_len - 3] + "..."


def _allowed_role_scopes(user_role: str) -> set[str]:
    if user_role == "admin":
        return {"educational", "clinical", "both"}
    if user_role == "practitioner":
        return {"clinical", "both"}
    return {"educational", "both"}


def _extract_named_supplements(message: str, max_terms: int = 3) -> list[str]:
    """Extract explicitly mentioned known supplements from query text."""
    text = (message or "").lower()
    matches: list[str] = []
    for supp in sorted(get_known_supplements(), key=len, reverse=True):
        if supp in text:
            matches.append(supp)
        if len(matches) >= max_terms:
            break
    return matches


def _category_matches(care_category: str | None, category_keyword: str) -> bool:
    if not care_category:
        return False
    return care_category.lower() == category_keyword.lower()


async def _keyword_sunday_fallback(
    term: str,
    category_keyword: str,
    user_id: str,
    user_role: str,
    max_results: int = 2,
) -> list[tuple[str, str]]:
    """
    Direct Sunday keyword probe against chunks for term recall.

    Uses service-role client, then applies access filtering to avoid cross-scope leakage.
    """
    client = get_supabase_client()
    allowed_scopes = _allowed_role_scopes(user_role)

    # 1) Candidate Sunday documents for this category.
    docs_result = (
        client.table("documents")
        .select("id, title, filename, care_category, role_scope, status, user_id, is_global, seminar_day, document_category")
        .eq("seminar_day", "sunday")
        .in_("status", ["indexed", "completed"])
        .execute()
    )
    documents = docs_result.data or []

    accessible_doc_ids: list[str] = []
    doc_title_by_id: dict[str, str] = {}
    for d in documents:
        role_scope = (d.get("role_scope") or "educational").lower()
        if role_scope not in allowed_scopes:
            continue
        if not _category_matches(d.get("care_category"), category_keyword):
            continue
        is_global = bool(d.get("is_global"))
        owner = d.get("user_id")
        doc_category = (d.get("document_category") or "").lower()
        # Shared Sunday seminar content should be searchable clinic-wide even when
        # not explicitly marked global. Keep role-scope filtering above.
        is_shared_seminar_category = doc_category in {
            "protocol",
            "care_guide",
            "reference",
            "seminar_transcript",
        }
        if not (is_global or owner == user_id or is_shared_seminar_category):
            continue
        doc_id = d.get("id")
        if not doc_id:
            continue
        accessible_doc_ids.append(doc_id)
        doc_title_by_id[doc_id] = d.get("title") or d.get("filename") or "Unknown Source"

    if not accessible_doc_ids:
        return []

    # 2) Keyword-match chunks within accessible Sunday docs.
    chunks_result = (
        client.table("document_chunks")
        .select("document_id, content")
        .in_("document_id", accessible_doc_ids)
        .ilike("content", f"%{term}%")
        .limit(max_results * 4)
        .execute()
    )
    rows = chunks_result.data or []

    out: list[tuple[str, str]] = []
    seen_pairs: set[tuple[str, str]] = set()
    for row in rows:
        doc_id = row.get("document_id")
        content = row.get("content") or ""
        if not doc_id or not content:
            continue
        source = doc_title_by_id.get(doc_id, "Unknown Source")
        key = (source, content[:200])
        if key in seen_pairs:
            continue
        seen_pairs.add(key)
        out.append((source, _clip_excerpt(content)))
        if len(out) >= max_results:
            break

    return out


async def _build_sunday_presearch_context(
    message: str,
    user_id: str,
    user_role: str,
    conversation_id: str | None,
    deep_dive: bool = False,
) -> str:
    """
    Preload Sunday-only evidence across all four BFM categories.

    This enforces the retrieval intent before generation for supplement/protocol queries.
    """
    categories: list[tuple[str, str]] = [
        ("Diabetes", "diabetes"),
        ("Thyroid", "thyroid"),
        ("Hormones", "hormones"),
        ("Neurological", "neurological"),
    ]
    named_supplements = _extract_named_supplements(message)
    limit = DEEP_PRESEARCH_LIMIT if deep_dive else NORMAL_PRESEARCH_LIMIT
    threshold = DEEP_PRESEARCH_THRESHOLD if deep_dive else NORMAL_PRESEARCH_THRESHOLD
    min_sunday_results = DEEP_PRESEARCH_MIN_SUNDAY if deep_dive else NORMAL_PRESEARCH_MIN_SUNDAY
    max_excerpts_per_category = (
        DEEP_PRESEARCH_EXCERPTS_PER_CATEGORY
        if deep_dive
        else NORMAL_PRESEARCH_EXCERPTS_PER_CATEGORY
    )

    # Compute query analysis and embedding ONCE, shared across all 4 category searches.
    # This reduces API calls from 4+4 (per category) to 1+1 total.
    shared_analysis = await analyze_query(message)
    shared_embedding = await embed_query(message)

    async def fetch_category_section(label: str, keyword: str) -> str:
        query = _build_presearch_query(message, keyword)
        try:
            results = await sunday_first_search(
                query=query,
                user_id=user_id,
                user_role=user_role,  # type: ignore[arg-type]
                conversation_id=conversation_id,
                analysis=shared_analysis,
                precomputed_embedding=shared_embedding,
                include_related=True,
                limit=limit,
                threshold=threshold,
                min_sunday_results=min_sunday_results,
            )
            sunday_results = [r for r in results if r.seminar_day == "sunday"][:max_excerpts_per_category]
            if not sunday_results:
                # Keyword fallback for known supplement terms (e.g., "deuterium drops")
                fallback_lines: list[str] = []
                for term in named_supplements:
                    direct_hits = await _keyword_sunday_fallback(
                        term=term,
                        category_keyword=keyword,
                        user_id=user_id,
                        user_role=user_role,
                        max_results=max_excerpts_per_category,
                    )
                    for source, excerpt in direct_hits:
                        fallback_lines.append(
                            f"- [Source: {source}] {excerpt} (keyword fallback: {term})"
                        )

                if fallback_lines:
                    return f"### {label}\n" + "\n".join(fallback_lines)
                return f"### {label}\n- No Sunday chunk retrieved for this category."

            lines = [f"### {label}"]
            for r in sunday_results:
                lines.append(
                    f"- [Source: {r.title}] {_clip_excerpt(r.content)}"
                )
            return "\n".join(lines)
        except Exception as e:
            logger.warning(f"Sunday presearch failed for {label}: {e}")

            # Semantic/vector search can fail independently (for example, embedding
            # provider outages). Fall back to direct keyword probes so known
            # supplement terms in Sunday chunks still appear in context.
            fallback_lines: list[str] = []
            for term in named_supplements:
                direct_hits = await _keyword_sunday_fallback(
                    term=term,
                    category_keyword=keyword,
                    user_id=user_id,
                    user_role=user_role,
                    max_results=max_excerpts_per_category,
                )
                for source, excerpt in direct_hits:
                    fallback_lines.append(
                        f"- [Source: {source}] {excerpt} (keyword fallback after presearch error: {term})"
                    )

            if fallback_lines:
                return f"### {label}\n" + "\n".join(fallback_lines)
            return f"### {label}\n- Sunday presearch failed for this category."

    sections = await asyncio.gather(
        *(fetch_category_section(label, keyword) for label, keyword in categories)
    )
    return "\n\n".join(sections)


def _resolve_reasoning_effort(request: ChatRequest, admin_max_effort: str) -> tuple[str, str]:
    """
    Resolve detected complexity + final reasoning effort for this request.
    Deep dive always runs high reasoning regardless of complexity.
    """
    has_files = bool(request.file_ids)
    detected_complexity = analyze_query_complexity(
        request.message, request.history, has_files=has_files
    )
    reasoning_effort = determine_reasoning_effort(
        detected_complexity=detected_complexity,
        admin_max_effort=admin_max_effort,
    )
    if request.deep_dive:
        reasoning_effort = "high"
    return detected_complexity, reasoning_effort


def _select_model(
    detected_complexity: str,
    chat_model: str,
    fast_model: str,
    deep_dive: bool,
    is_health_query: bool,
) -> str:
    """
    Select the appropriate model based on query complexity.

    - Low complexity + non-health → Haiku (fast, sub-second)
    - Low/medium complexity + health → Sonnet (needs RAG grounding for BFM perspective)
    - High complexity or deep dive → Opus (max reasoning)

    BFM redefines how many substances and body systems work through frequency
    medicine, so even "What is vitamin D?" needs Sonnet + RAG, not Haiku.
    """
    if deep_dive or detected_complexity == "high":
        return get_opus_model()
    if detected_complexity == "low" and not is_health_query:
        return fast_model
    return chat_model


def _emit_sse(event_type: str, data: dict) -> str:
    return f"data: {json.dumps({'type': event_type, **data})}\n\n"


def _sse_response_from_result(content: str, reasoning_content: str = "") -> Response:
    chunks: list[str] = []

    if reasoning_content:
        chunks.append(_emit_sse("step_start", {
            "step_id": "reasoning-1",
            "label": "Thinking...",
        }))
        chunks.append(_emit_sse("reasoning_delta", {
            "delta": reasoning_content,
            "elapsed_ms": 0,
        }))
        chunks.append(_emit_sse("step_complete", {
            "step_id": "reasoning-1",
        }))
        chunks.append(_emit_sse("reasoning_done", {
            "summary": None,
            "elapsed_ms": 0,
        }))

    if content:
        chunks.append(_emit_sse("text_delta", {
            "delta": content,
        }))
        chunks.append(_emit_sse("text_done", {
            "content": content,
        }))

    chunks.append(_emit_sse("done", {}))
    chunks.append("data: [DONE]\n\n")

    return Response(
        "".join(chunks),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


async def _stream_chat_response(
    client,
    create_params: dict,
    tool_registry,
    user_role: str,
) -> AsyncGenerator[str, None]:
    """
    Stream chat response as SSE events with tool-calling and thinking support.

    Yields step_start/step_complete for presearch and tool calls,
    reasoning_delta for thinking tokens, and text_delta for response tokens.
    Handles up to 5 tool-call iterations before returning the final answer.
    """
    for iteration in range(5):
        tool_uses: list[dict] = []
        current_tool: dict | None = None
        current_tool_json = ""
        assistant_blocks: list[dict] = []
        accumulated_text = ""
        reasoning_started = False
        reasoning_start_time: float | None = None

        try:
            async with client.messages.stream(**create_params) as stream:
                async for event in stream:
                    if event.type == "content_block_start":
                        block = event.content_block
                        if block.type == "thinking":
                            reasoning_started = True
                            reasoning_start_time = time.time()
                            yield _emit_sse("step_start", {
                                "step_id": f"reasoning-{iteration + 1}",
                                "label": "Thinking...",
                            })
                            assistant_blocks.append({"type": "thinking", "thinking": ""})
                        elif block.type == "text":
                            if reasoning_started:
                                elapsed = int((time.time() - (reasoning_start_time or time.time())) * 1000)
                                yield _emit_sse("step_complete", {"step_id": f"reasoning-{iteration + 1}"})
                                yield _emit_sse("reasoning_done", {"summary": None, "elapsed_ms": elapsed})
                                reasoning_started = False
                            assistant_blocks.append({"type": "text", "text": ""})
                        elif block.type == "tool_use":
                            current_tool = {"id": block.id, "name": block.name, "input": {}}
                            current_tool_json = ""
                            assistant_blocks.append({
                                "type": "tool_use",
                                "id": block.id,
                                "name": block.name,
                                "input": {},
                            })

                    elif event.type == "content_block_delta":
                        delta = event.delta
                        if delta.type == "thinking_delta":
                            if assistant_blocks and assistant_blocks[-1].get("type") == "thinking":
                                assistant_blocks[-1]["thinking"] += delta.thinking
                            elapsed = int((time.time() - (reasoning_start_time or time.time())) * 1000)
                            yield _emit_sse("reasoning_delta", {"delta": delta.thinking, "elapsed_ms": elapsed})
                        elif delta.type == "text_delta":
                            if assistant_blocks and assistant_blocks[-1].get("type") == "text":
                                assistant_blocks[-1]["text"] += delta.text
                            accumulated_text += delta.text
                            yield _emit_sse("text_delta", {"delta": delta.text})
                        elif delta.type == "input_json_delta":
                            current_tool_json += delta.partial_json

                    elif event.type == "content_block_stop":
                        if current_tool is not None:
                            try:
                                current_tool["input"] = json.loads(current_tool_json) if current_tool_json else {}
                            except json.JSONDecodeError:
                                current_tool["input"] = {}
                            for ab in assistant_blocks:
                                if ab.get("type") == "tool_use" and ab.get("id") == current_tool["id"]:
                                    ab["input"] = current_tool["input"]
                                    break
                            tool_uses.append(current_tool)
                            current_tool = None
                            current_tool_json = ""

            # Close any open reasoning block
            if reasoning_started and reasoning_start_time:
                elapsed = int((time.time() - reasoning_start_time) * 1000)
                yield _emit_sse("step_complete", {"step_id": f"reasoning-{iteration + 1}"})
                yield _emit_sse("reasoning_done", {"summary": None, "elapsed_ms": elapsed})

        except Exception as e:
            logger.error("Streaming error in iteration %d: %s", iteration, e, exc_info=e)
            yield _emit_sse("error", {"error": str(e)})
            yield "data: [DONE]\n\n"
            return

        # No tool calls → final response
        if not tool_uses:
            break

        # Execute each tool and emit step events
        tool_results = []
        for tu in tool_uses:
            tool_label = tu["name"].replace("_", " ").title()
            step_id = f"tool-{iteration + 1}-{tu['name']}"
            yield _emit_sse("step_start", {"step_id": step_id, "label": f"Searching {tool_label}..."})
            try:
                tool_result = await tool_registry.execute(tu["name"], tu["input"])
            except Exception as e:
                tool_result = json.dumps({"error": str(e)})
            tool_results.append({"type": "tool_result", "tool_use_id": tu["id"], "content": tool_result})
            yield _emit_sse("step_complete", {"step_id": step_id})

        # Append assistant turn (tool_use blocks only, no thinking) + tool results
        safe_assistant_blocks = [ab for ab in assistant_blocks if ab.get("type") != "thinking"]
        create_params["messages"] = list(create_params["messages"]) + [
            {"role": "assistant", "content": safe_assistant_blocks},
            {"role": "user", "content": tool_results},
        ]
        # Extended thinking cannot be used in follow-up turns after tool use
        create_params.pop("thinking", None)
        create_params["max_tokens"] = DEFAULT_MAX_TOKENS
        accumulated_text = ""

    # Final member validation (runs on complete accumulated text)
    if user_role == "member" and accumulated_text:
        accumulated_text, _ = validate_output(accumulated_text, user_role)

    check_for_clinical_leakage(accumulated_text, user_role)
    yield _emit_sse("text_done", {"content": accumulated_text})
    yield _emit_sse("done", {})
    yield "data: [DONE]\n\n"


@router.post("/chat")
async def chat_stream(
    request: ChatRequest,
):
    """
    Stream SSE chat responses for the frontend.

    Uses client.messages.stream() for real-time token delivery — showing
    thinking progress, tool step events, and text as it arrives.
    Supports up to 5 tool-call iterations (RAG search, web search).
    """
    # Get dynamic model settings from admin panel (with caching)
    model_settings = await get_model_settings_service().get_settings()

    detected_complexity, reasoning_effort = _resolve_reasoning_effort(
        request=request,
        admin_max_effort=model_settings.reasoning_effort,
    )

    # Select model based on complexity and health-relevance
    is_health_query = _is_health_related_query(request.message)

    if model_settings.prompt_routing_enabled:
        selected_model = _select_model(
            detected_complexity=detected_complexity,
            chat_model=model_settings.chat_model,
            fast_model=model_settings.fast_model,
            deep_dive=request.deep_dive,
            is_health_query=is_health_query,
        )
        # Bump reasoning to medium when health query gets promoted from low
        if is_health_query and detected_complexity == "low" and reasoning_effort == "low":
            reasoning_effort = "medium"
    else:
        selected_model = model_settings.chat_model

    logger.info(
        "Query complexity: %s, reasoning effort: %s, model: %s, deep_dive: %s, routing: %s",
        detected_complexity,
        reasoning_effort,
        selected_model,
        request.deep_dive,
        "enabled" if model_settings.prompt_routing_enabled else "disabled",
    )

    # Build conversation history as input
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

    # Create agent config with all current features preserved
    agent_config = create_base_agent(
        user_role=request.user_role or "member",
        conversation_type=request.conversation_type or "general",
        patient_context=request.patient_context,
        reasoning_effort=reasoning_effort,
        user_id=request.user_id or "system",
        conversation_id=request.conversation_id,
        model=selected_model,
        deep_dive=request.deep_dive,
    )

    if request.deep_dive:
        agent_config.instructions += (
            "\n\n[DEEP DIVE MODE]\n"
            "You MUST call search_knowledge_base at least once before your final answer.\n"
            "Use high-reasoning analysis and search broadly within Sunday-first evidence.\n"
            "Synthesize across more chunks before concluding.\n"
            "If retrieval was capped by system guardrails, explicitly acknowledge this constraint."
        )

    # If force_web_search is enabled, append a hint to the agent instructions
    if request.force_web_search:
        agent_config.instructions += (
            "\n\n[SYSTEM HINT] The user has explicitly requested a web search for this query. "
            "You MUST use the search_medical_sources tool to find relevant information before responding."
        )

    # Protocol/supplement guard setup (member override applied immediately;
    # practitioner presearch deferred to the generator so step events show live)
    is_protocol_query = _is_protocol_or_supplement_query(request.message)
    is_definitional = _is_definitional_query(request.message)
    needs_presearch = is_protocol_query and not is_definitional
    user_role = request.user_role or "member"
    user_id = request.user_id or "system"

    if is_protocol_query and user_role not in {"practitioner", "admin"}:
        agent_config.instructions += (
            "\n\n[MEMBER SAFETY OVERRIDE]\n"
            "The user is a member. Do NOT provide protocols, frequencies, dosing, timing, or treatment steps.\n"
            "Use base knowledge to provide educational context only.\n"
            "Use an analogy-first explanation style.\n"
            "End with a clear Course Connection that points them to their purchased BFM course materials.\n"
            "If a specific module title is available in retrieved context, name it. Otherwise say:\n"
            "\"Review the lesson in your purchased BFM course on this topic and discuss specifics with your practitioner.\""
        )

    logger.info(
        "Starting streaming chat response for: %s... (model=%s effort=%s)",
        request.message[:50],
        selected_model,
        reasoning_effort,
    )

    client = get_async_client()
    api_messages = []
    for msg in request.history:
        api_messages.append({"role": msg.role, "content": _strip_thinking_blocks(msg.content)})
    api_messages.append({"role": "user", "content": request.message})

    thinking_config = _get_thinking_config(reasoning_effort, agent_config.model)
    tool_definitions = agent_config.tool_registry.get_tool_definitions() if agent_config.tool_registry else None

    create_params: dict = {
        "model": agent_config.model,
        "system": agent_config.instructions,
        "messages": api_messages,
        "max_tokens": compute_max_tokens(thinking_config),
    }
    if thinking_config:
        create_params["thinking"] = thinking_config
    if tool_definitions:
        create_params["tools"] = tool_definitions

    async def generate() -> AsyncGenerator[str, None]:
        # Run presearch inside the generator so the "Searching knowledge base..."
        # step event appears in the UI while retrieval is happening.
        if is_protocol_query and user_role in {"practitioner", "admin"}:
            if needs_presearch:
                yield _emit_sse("step_start", {
                    "step_id": "presearch",
                    "label": "Searching knowledge base...",
                })
                try:
                    sunday_context = await _build_sunday_presearch_context(
                        message=request.message,
                        user_id=user_id,
                        user_role=user_role,
                        conversation_id=request.conversation_id,
                        deep_dive=request.deep_dive,
                    )
                    has_deuterium_evidence = "deuterium" in sunday_context.lower()
                    presearch_addendum = (
                        "\n\n[CRITICAL: SUNDAY-FIRST PRESEARCH CONTEXT]\n"
                        "The system pre-searched Sunday chunks across Diabetes, Thyroid, Hormones, and Neurological categories.\n"
                        "Use this Sunday evidence first for protocol/supplement answers.\n"
                        "If a supplement/protocol appears in these sources, do NOT claim it is unapproved or unavailable.\n"
                        "Always cite sources using [Source: Document Title].\n"
                        "Only cite source titles that appear in retrieved context. Never invent source names.\n"
                        "Do not invent dosing or timing values. If not explicitly present in retrieved evidence, ask for follow-up context.\n"
                        "Only if Sunday evidence is absent may you use non-Sunday context conservatively.\n\n"
                        f"{sunday_context}"
                    )
                    if has_deuterium_evidence:
                        presearch_addendum += (
                            "\n\n[VALIDATION NOTE] Sunday evidence for Deuterium is present above. "
                            "Do NOT state that Deuterium Drops are unavailable in BFM protocols. "
                            "Answer directly from this retrieved context and avoid additional tool calls unless the user asks for deeper detail."
                        )
                    create_params["system"] = agent_config.instructions + presearch_addendum
                except Exception as presearch_err:
                    logger.warning("Presearch failed, continuing without context: %s", presearch_err)
                yield _emit_sse("step_complete", {"step_id": "presearch"})
            else:
                logger.info("Skipping presearch for definitional query: %s", request.message[:80])

        async for chunk in _stream_chat_response(
            client, create_params, agent_config.tool_registry, user_role,
        ):
            yield chunk

    return StreamingResponse(
        generate(),
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
):
    """
    Non-streaming chat endpoint with role-based filtering.

    Uses the Anthropic messages API for synchronous responses.
    Useful for testing and debugging.
    """
    client = get_async_client()

    # Get dynamic model settings from admin panel (with caching)
    model_settings = await get_model_settings_service().get_settings()

    detected_complexity, reasoning_effort = _resolve_reasoning_effort(
        request=request,
        admin_max_effort=model_settings.reasoning_effort,
    )

    sync_is_health = _is_health_related_query(request.message)

    if model_settings.prompt_routing_enabled:
        sync_selected_model = _select_model(
            detected_complexity=detected_complexity,
            chat_model=model_settings.chat_model,
            fast_model=model_settings.fast_model,
            deep_dive=request.deep_dive,
            is_health_query=sync_is_health,
        )
        if sync_is_health and detected_complexity == "low" and reasoning_effort == "low":
            reasoning_effort = "medium"
    else:
        sync_selected_model = model_settings.chat_model

    # Build system prompt with role-specific instructions
    system_prompt = get_system_prompt(
        conversation_type=request.conversation_type,
        patient_context=request.patient_context,
        user_role=request.user_role,
    )

    sync_is_protocol = _is_protocol_or_supplement_query(request.message)
    sync_is_definitional = _is_definitional_query(request.message)
    sync_needs_presearch = sync_is_protocol and not sync_is_definitional

    if sync_is_protocol:
        user_id = request.user_id or "system"
        user_role = request.user_role or "member"
        if user_role in {"practitioner", "admin"}:
            if sync_needs_presearch:
                sunday_context = await _build_sunday_presearch_context(
                    message=request.message,
                    user_id=user_id,
                    user_role=user_role,
                    conversation_id=request.conversation_id,
                    deep_dive=request.deep_dive,
                )
                has_deuterium_evidence = "deuterium" in sunday_context.lower()
                system_prompt += (
                    "\n\n[CRITICAL: SUNDAY-FIRST PRESEARCH CONTEXT]\n"
                    "Use this Sunday evidence first for protocol/supplement answers.\n"
                    "If a supplement/protocol appears in these sources, do NOT claim it is unapproved or unavailable.\n"
                    "Always cite sources using [Source: Document Title].\n"
                    "Only cite source titles that appear in retrieved context. Never invent source names.\n\n"
                    "Do not invent dosing or timing values. If not explicitly present in retrieved evidence, ask for follow-up context.\n\n"
                    f"{sunday_context}"
                )
                if has_deuterium_evidence:
                    system_prompt += (
                        "\n\n[VALIDATION NOTE] Sunday evidence for Deuterium is present above. "
                        "Do NOT state that Deuterium Drops are unavailable in BFM protocols."
                    )
        else:
            system_prompt += (
                "\n\n[MEMBER SAFETY OVERRIDE]\n"
                "The user is a member. Do NOT provide protocols, frequencies, dosing, timing, or treatment steps.\n"
                "Use base knowledge to provide educational context only.\n"
                "Use an analogy-first explanation style.\n"
                "End with a clear Course Connection that points them to their purchased BFM course materials.\n"
                "If a specific module title is available in retrieved context, name it. Otherwise say:\n"
                "\"Review the lesson in your purchased BFM course on this topic and discuss specifics with your practitioner.\""
            )

    if request.deep_dive:
        system_prompt += (
            "\n\n[DEEP DIVE MODE]\n"
            "Use high-reasoning analysis and search broadly within Sunday-first evidence.\n"
            "Synthesize across more chunks before concluding.\n"
            "If retrieval was capped by system guardrails, explicitly acknowledge this constraint."
        )

    # Build messages array (stateless)
    # Strip thinking blocks from history to avoid signature requirement issues
    api_messages = []
    for msg in request.history:
        api_messages.append({"role": msg.role, "content": _strip_thinking_blocks(msg.content)})
    api_messages.append({"role": "user", "content": request.message})

    # Build thinking config
    thinking_config = _get_thinking_config(reasoning_effort, sync_selected_model)

    try:
        create_params: dict = {
            "model": sync_selected_model,
            "system": system_prompt,
            "messages": api_messages,
            "max_tokens": compute_max_tokens(thinking_config),
        }
        if thinking_config:
            create_params["thinking"] = thinking_config

        response = await client.messages.create(**create_params)

        # Extract text content (skip thinking blocks)
        content = ""
        reasoning_content = ""
        for block in response.content:
            if block.type == "text":
                content += block.text
            elif block.type == "thinking":
                reasoning_content += block.thinking

        # Validate and filter output for members
        was_filtered = False
        if request.user_role == "member":
            content, was_filtered = validate_output(content, request.user_role)

        # Check for clinical leakage (for logging/monitoring)
        leakage_check = check_for_clinical_leakage(content, request.user_role)

        return {
            "content": content,
            "reasoning_summary": reasoning_content or None,
            "model": sync_selected_model,
            "was_filtered": was_filtered,
            "leakage_detected": leakage_check.get("has_leakage", False),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
