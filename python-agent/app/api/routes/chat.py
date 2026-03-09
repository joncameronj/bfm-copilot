"""
Chat API Routes - Streaming chat endpoint using the Anthropic SDK.

This module provides the main chat endpoints for the BFM Copilot AI assistant.
The streaming endpoint uses a custom AgentRunner for tool-calling loops
over the Anthropic messages API.
"""

import json
import re
import asyncio
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.models.requests import ChatRequest
from app.agent.system_prompts import get_system_prompt
from app.agent import create_base_agent, determine_reasoning_effort, SSEEventMapper
from app.agent.runner import AgentRunner
from app.services.output_validator import validate_output, check_for_clinical_leakage
from app.services.model_settings import get_model_settings_service
from app.services.query_complexity import analyze_query_complexity
from app.services.ai_client import get_async_client
from app.services.supabase import get_supabase_client
from app.services.protocol_loader import get_known_supplements
from app.tools.rag_search import sunday_first_search
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

    async def fetch_category_section(label: str, keyword: str) -> str:
        query = _build_presearch_query(message, keyword)
        try:
            results = await sunday_first_search(
                query=query,
                user_id=user_id,
                user_role=user_role,  # type: ignore[arg-type]
                conversation_id=conversation_id,
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
    detected_complexity = analyze_query_complexity(request.message, request.history)
    reasoning_effort = determine_reasoning_effort(
        detected_complexity=detected_complexity,
        admin_max_effort=admin_max_effort,
    )
    if request.deep_dive:
        reasoning_effort = "high"
    return detected_complexity, reasoning_effort


@router.post("/chat")
async def chat_stream(
    request: ChatRequest,
):
    """
    Stream agent responses via SSE using the Anthropic messages API.

    This endpoint uses our custom AgentRunner for automatic tool orchestration
    with streaming via the Anthropic SDK.

    Features preserved from original implementation:
    - Query complexity analysis for dynamic reasoning effort
    - Role-based content filtering
    - Patient context injection
    - Real-time reasoning and source streaming
    """
    # Get dynamic model settings from admin panel (with caching)
    model_settings = await get_model_settings_service().get_settings()

    detected_complexity, reasoning_effort = _resolve_reasoning_effort(
        request=request,
        admin_max_effort=model_settings.reasoning_effort,
    )

    logger.info(
        "Query complexity: %s, reasoning effort: %s, deep_dive: %s",
        detected_complexity,
        reasoning_effort,
        request.deep_dive,
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
        model=model_settings.chat_model,
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

    # Hard guard for protocol/supplement questions:
    # - Practitioner/admin: pre-search Sunday chunks and inject evidence.
    # - Member: enforce educational-only override with course callout.
    if _is_protocol_or_supplement_query(request.message):
        user_id = request.user_id or "system"
        user_role = request.user_role or "member"
        if user_role in {"practitioner", "admin"}:
            sunday_context = await _build_sunday_presearch_context(
                message=request.message,
                user_id=user_id,
                user_role=user_role,
                conversation_id=request.conversation_id,
                deep_dive=request.deep_dive,
            )
            has_deuterium_evidence = "deuterium" in sunday_context.lower()
            agent_config.instructions += (
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
                agent_config.instructions += (
                    "\n\n[VALIDATION NOTE] Sunday evidence for Deuterium is present above. "
                    "Do NOT state that Deuterium Drops are unavailable in BFM protocols. "
                    "Answer directly from this retrieved context and avoid additional tool calls unless the user asks for deeper detail."
                )
        else:
            agent_config.instructions += (
                "\n\n[MEMBER SAFETY OVERRIDE]\n"
                "The user is a member. Do NOT provide protocols, frequencies, dosing, timing, or treatment steps.\n"
                "Use base knowledge to provide educational context only.\n"
                "Use an analogy-first explanation style.\n"
                "End with a clear Course Connection that points them to their purchased BFM course materials.\n"
                "If a specific module title is available in retrieved context, name it. Otherwise say:\n"
                "\"Review the lesson in your purchased BFM course on this topic and discuss specifics with your practitioner.\""
            )

    async def event_generator():
        """Generate SSE events from AgentRunner streaming response."""
        logger.info(f"Starting Anthropic stream for: {request.message[:50]}...")
        logger.debug(f"Model: {agent_config.model}, Reasoning effort: {reasoning_effort}")

        try:
            # Create SSE event mapper
            mapper = SSEEventMapper(
                user_id=request.user_id or "system",
                user_role=request.user_role or "member",
            )

            # Create agent runner with Anthropic async client
            runner = AgentRunner(
                client=get_async_client(),
                model=agent_config.model,
                instructions=agent_config.instructions,
                tool_registry=agent_config.tool_registry,
                reasoning_effort=agent_config.reasoning_effort,
            )

            # Run agent with streaming and process through SSE mapper
            stream = runner.run_streamed(input_messages)
            async for sse_event in mapper.process_stream(stream):
                yield sse_event

        except Exception as e:
            import traceback
            logger.error(f"Chat streaming error: {e}")
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
):
    """
    Non-streaming chat endpoint with role-based filtering.

    Uses the Anthropic messages API for synchronous responses.
    Useful for testing and debugging.
    """
    from app.agent.runner import _get_thinking_config

    client = get_async_client()

    # Get dynamic model settings from admin panel (with caching)
    model_settings = await get_model_settings_service().get_settings()

    _, reasoning_effort = _resolve_reasoning_effort(
        request=request,
        admin_max_effort=model_settings.reasoning_effort,
    )

    # Build system prompt with role-specific instructions
    system_prompt = get_system_prompt(
        conversation_type=request.conversation_type,
        patient_context=request.patient_context,
        user_role=request.user_role,
    )

    if _is_protocol_or_supplement_query(request.message):
        user_id = request.user_id or "system"
        user_role = request.user_role or "member"
        if user_role in {"practitioner", "admin"}:
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
    api_messages = []
    for msg in request.history:
        api_messages.append({"role": msg.role, "content": msg.content})
    api_messages.append({"role": "user", "content": request.message})

    # Build thinking config
    thinking_config = _get_thinking_config(reasoning_effort)

    try:
        create_params: dict = {
            "model": model_settings.chat_model,
            "system": system_prompt,
            "messages": api_messages,
            "max_tokens": 8192,
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
            "model": model_settings.chat_model,
            "was_filtered": was_filtered,
            "leakage_detected": leakage_check.get("has_leakage", False),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
