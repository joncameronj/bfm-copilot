"""
Background Job Executor - Processes agent jobs independent of HTTP connections.

This worker polls for pending jobs and executes them, persisting output
to the database incrementally. This allows users to navigate away while
the agent continues processing.
"""

import asyncio
import json
import traceback
from datetime import datetime

from app.config import get_settings
from app.utils.logger import get_logger
from app.services import job_service

logger = get_logger("job_executor")
from app.services.model_settings import get_model_settings_service
from app.services.query_complexity import analyze_query_complexity
from app.agent import create_base_agent, determine_reasoning_effort
from app.agent.runner import AgentRunner
from app.services.ai_client import get_async_client
from app.services.supabase import get_supabase_client


# Maximum retries before giving up
MAX_RETRIES = 3

# Poll interval in seconds
POLL_INTERVAL = 2

# Maximum concurrent jobs per worker
MAX_CONCURRENT_JOBS = 3


class JobExecutor:
    """Background job executor that processes agent jobs."""

    def __init__(self):
        self.settings = get_settings()
        self.running = False
        self.active_jobs: set[str] = set()

    async def start(self):
        """Start the job executor polling loop."""
        self.running = True
        logger.info("Starting background job processor...")

        while self.running:
            try:
                # Only claim new jobs if under the limit
                if len(self.active_jobs) < MAX_CONCURRENT_JOBS:
                    job = await job_service.claim_pending_job()
                    if job:
                        # Process job in background task
                        asyncio.create_task(self._process_job(job))
            except Exception as e:
                logger.error(f"Error in poll loop: {e}")
                traceback.print_exc()

            await asyncio.sleep(POLL_INTERVAL)

    def stop(self):
        """Stop the job executor."""
        self.running = False
        logger.info("Stopping...")

    async def _process_job(self, job: dict):
        """Process a single job."""
        job_id = job["id"]
        self.active_jobs.add(job_id)

        logger.info(f"Processing job {job_id}: {job['input_message'][:50]}...")

        try:
            await self._execute_agent(job)
        except Exception as e:
            logger.error(f"Job {job_id} failed: {e}")
            traceback.print_exc()
            await self._handle_job_failure(job, str(e))
        finally:
            self.active_jobs.discard(job_id)

    async def _execute_agent(self, job: dict):
        """Execute the agent for a job, persisting output incrementally."""
        job_id = job["id"]
        input_message = job["input_message"]
        input_context = job.get("input_context") or {}
        conversation_id = job["conversation_id"]

        # Get conversation and history from database
        client = get_supabase_client()

        # Get conversation details
        conv_result = client.table("conversations").select(
            "*, patients(*)"
        ).eq("id", conversation_id).single().execute()

        if not conv_result.data:
            raise ValueError(f"Conversation {conversation_id} not found")

        conversation = conv_result.data
        patient = conversation.get("patients")

        # Get message history
        history_limit = max(1, int(self.settings.chat_history_message_limit))
        history_result = client.table("messages").select("*").eq(
            "conversation_id", conversation_id
        ).order("created_at", desc=True).limit(history_limit).execute()

        history = list(reversed(history_result.data or []))

        # Trim by total content size to avoid overflowing model context.
        char_budget = max(1000, int(self.settings.chat_history_char_budget))
        total_chars = 0
        trimmed_history = []
        for msg in reversed(history):
            content = (msg.get("content") or "")
            size = len(content)
            if trimmed_history and (total_chars + size) > char_budget:
                break
            trimmed_history.append(msg)
            total_chars += size
        history = list(reversed(trimmed_history))

        # Build patient context if available
        patient_context = None
        if patient:
            patient_context = {
                "patient_id": patient["id"],
                "name": patient.get("first_name", ""),
                "age": patient.get("age"),
                "sex": patient.get("sex"),
                "chief_complaint": patient.get("chief_complaint"),
                "medical_history": patient.get("medical_history"),
            }

        # Get model settings
        model_settings = await get_model_settings_service().get_settings()

        # Analyze query complexity
        history_messages = [
            {"role": msg["role"], "content": msg["content"]}
            for msg in history
        ]
        detected_complexity = analyze_query_complexity(input_message, history_messages)
        reasoning_effort = determine_reasoning_effort(
            detected_complexity=detected_complexity,
            admin_max_effort=model_settings.reasoning_effort,
        )

        # Build input messages
        input_messages = []
        for msg in history:
            input_messages.append({
                "role": msg["role"],
                "content": msg["content"],
            })
        input_messages.append({
            "role": "user",
            "content": input_message,
        })

        # Get user role from context
        user_role = input_context.get("user_role", "member")
        user_id = job["user_id"]

        # Create agent config
        agent_config = create_base_agent(
            user_role=user_role,
            conversation_type=conversation.get("conversation_type", "general"),
            patient_context=patient_context,
            reasoning_effort=reasoning_effort,
            user_id=user_id,
            conversation_id=conversation_id,
            model=model_settings.chat_model,
        )

        # Update status to streaming
        await job_service.update_job_status(job_id, "streaming", current_step="Starting agent...")

        # Run agent with streaming
        accumulated_content = ""
        accumulated_reasoning = ""
        metadata: dict = {"steps": [], "sources": [], "rag_chunks": []}

        try:
            runner = AgentRunner(
                client=get_async_client(),
                model=agent_config.model,
                instructions=agent_config.instructions,
                tool_registry=agent_config.tool_registry,
                reasoning_effort=agent_config.reasoning_effort,
            )

            # Process stream events
            async for event in runner.run_streamed(input_messages):
                # Handle reasoning events
                if event.type == "reasoning_delta":
                    delta = event.data.get("delta", "")
                    if delta:
                        accumulated_reasoning += delta
                        # Persist reasoning incrementally
                        await job_service.update_job_output(
                            job_id,
                            output_reasoning=accumulated_reasoning,
                            append=False
                        )

                # Handle text events
                elif event.type == "text_delta":
                    delta = event.data.get("delta", "")
                    if delta:
                        accumulated_content += delta
                        # Persist content incrementally (batch updates)
                        if len(accumulated_content) % 100 < len(delta):
                            await job_service.update_job_output(
                                job_id,
                                output_content=accumulated_content,
                                append=False
                            )

                # Handle tool events for step tracking
                elif event.type == "tool_call_start":
                    tool_name = event.data.get("tool_name", "unknown")
                    await job_service.update_job_status(
                        job_id, "streaming",
                        current_step=f"Using {tool_name}..."
                    )
                    metadata["steps"].append({
                        "tool": tool_name,
                        "timestamp": datetime.utcnow().isoformat()
                    })

        except Exception as e:
            # If we have partial content, save it before failing
            if accumulated_content or accumulated_reasoning:
                await job_service.update_job_output(
                    job_id,
                    output_content=accumulated_content,
                    output_reasoning=accumulated_reasoning,
                    output_metadata=metadata,
                    append=False
                )
            raise

        # Final update with all output
        await job_service.update_job_output(
            job_id,
            output_content=accumulated_content,
            output_reasoning=accumulated_reasoning,
            output_metadata=metadata,
            append=False
        )

        # Save message to conversation — wrap in try/catch so a DB hiccup
        # doesn't discard the agent output that was already streamed.
        try:
            client.table("messages").insert({
                "conversation_id": conversation_id,
                "role": "user",
                "content": input_message,
                "metadata": {},
            }).execute()

            client.table("messages").insert({
                "conversation_id": conversation_id,
                "role": "assistant",
                "content": accumulated_content,
                "metadata": {
                    "reasoning": {
                        "text": accumulated_reasoning,
                    } if accumulated_reasoning else None,
                    "steps": metadata.get("steps"),
                    "background_job_id": job_id,
                },
            }).execute()
        except Exception as db_err:
            logger.error(f"Job {job_id}: failed to persist messages to DB: {db_err}")
            traceback.print_exc()
            # Still mark job completed — the streamed output was already saved
            # via update_job_output above, so the user can still see the response.

        # Mark job as completed
        await job_service.update_job_status(job_id, "completed")
        logger.info(f"Job {job_id} completed successfully")

    async def _handle_job_failure(self, job: dict, error_message: str):
        """Handle job failure with retry logic."""
        job_id = job["id"]
        retry_count = job.get("retry_count", 0)

        if retry_count < MAX_RETRIES:
            # Increment retry count and reset to pending
            new_count = await job_service.increment_retry_count(job_id)
            logger.warning(f"Job {job_id} will retry (attempt {new_count + 1}/{MAX_RETRIES + 1})")
        else:
            # Max retries exceeded, mark as failed
            await job_service.update_job_status(
                job_id, "failed",
                error_message=error_message
            )
            logger.error(f"Job {job_id} failed permanently after {MAX_RETRIES + 1} attempts")


# Global executor instance
_executor: JobExecutor | None = None


def get_executor() -> JobExecutor:
    """Get the global job executor instance."""
    global _executor
    if _executor is None:
        _executor = JobExecutor()
    return _executor


async def start_executor():
    """Start the global job executor."""
    executor = get_executor()
    await executor.start()


def stop_executor():
    """Stop the global job executor."""
    if _executor:
        _executor.stop()
