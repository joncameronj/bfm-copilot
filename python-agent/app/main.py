from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.api.routes import chat, ingest, health, rag
from app.services.model_settings import init_model_settings_service, get_model_settings_service

settings = get_settings()

app = FastAPI(
    title="BFM Medical Copilot Agent",
    description="Python backend for GPT 5.2 powered medical assistant",
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


@app.on_event("startup")
async def startup_event():
    # Initialize model settings service
    init_model_settings_service(
        api_url=settings.frontend_url,
        default_model=settings.openai_model,
        default_reasoning_effort=settings.reasoning_effort,
        default_reasoning_summary=settings.reasoning_summary,
        cache_ttl_seconds=settings.settings_cache_ttl,
    )

    # Fetch initial settings
    model_settings = get_model_settings_service().get_settings_sync()
    print(f"Starting BFM Agent with model: {model_settings.chat_model}")
    print(f"Reasoning effort: {model_settings.reasoning_effort}, summary: {model_settings.reasoning_summary}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=settings.debug)
