from dotenv import load_dotenv
load_dotenv()  # Load .env into os.environ BEFORE other imports

import asyncio
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.api.routes import chat, ingest, health, rag, jobs, protocols, eval, labs
from app.services.model_settings import init_model_settings_service, get_model_settings_service
from app.services.ai_client import get_chat_model
from app.worker.job_executor import start_executor, stop_executor
from app.utils.logger import get_logger

logger = get_logger("main")

settings = get_settings()

app = FastAPI(
    title="BFM Medical Copilot Agent",
    description="Python backend for AI-powered medical assistant (Anthropic Claude)",
    version="0.1.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, tags=["Health"])
app.include_router(chat.router, prefix="/agent", tags=["Chat"])
app.include_router(ingest.router, prefix="/agent", tags=["Ingest"])
app.include_router(rag.router, prefix="/agent", tags=["RAG"])
app.include_router(jobs.router, prefix="/agent", tags=["Jobs"])
app.include_router(protocols.router, prefix="/agent", tags=["Protocols"])
app.include_router(eval.router, prefix="/agent", tags=["Eval"])
app.include_router(labs.router, prefix="/agent", tags=["Labs"])


@app.on_event("startup")
async def startup_event():
    # Validate Anthropic API key on startup
    chat_model = get_chat_model()
    logger.info(f"AI Provider: Anthropic (model: {chat_model})")

    # Initialize model settings service
    init_model_settings_service(
        api_url=settings.frontend_url,
        default_model=chat_model,
        default_reasoning_effort=settings.reasoning_effort,
        default_reasoning_summary=settings.reasoning_summary,
        cache_ttl_seconds=settings.settings_cache_ttl,
    )

    # Fetch initial settings
    model_settings = get_model_settings_service().get_settings_sync()
    logger.info(f"Starting BFM Agent with model: {model_settings.chat_model}")
    logger.info(f"Reasoning effort: {model_settings.reasoning_effort}, summary: {model_settings.reasoning_summary}")

    # Start background job executor (unless disabled)
    if os.environ.get("DISABLE_JOB_WORKER") != "true":
        task = asyncio.create_task(start_executor())
        def _on_executor_done(t: asyncio.Task) -> None:
            if t.cancelled():
                logger.warning("Job executor task was cancelled")
            elif t.exception():
                logger.error("Job executor crashed: %s", t.exception(), exc_info=t.exception())
        task.add_done_callback(_on_executor_done)
        logger.info("Background job executor started")


@app.on_event("shutdown")
async def shutdown_event():
    # Stop background job executor
    stop_executor()
    logger.info("Background job executor stopped")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=settings.debug)
