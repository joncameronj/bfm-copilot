# syntax=docker/dockerfile:1

FROM python:3.11-slim AS base

# --- Builder stage: install uv and dependencies ---
FROM base AS builder

# Install system dependencies required for building Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install uv (fast Python package manager)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Copy only dependency files first for better cache utilization
COPY --link pyproject.toml ./

# Create virtual environment and install dependencies
RUN uv venv && \
    PATH="/app/.venv/bin:$PATH" uv pip install -r pyproject.toml

# Copy the rest of the application code
COPY --link app ./app
COPY --link scripts ./scripts

# --- Final stage: minimal runtime image ---
FROM base AS final

# Create a non-root user and group
RUN addgroup --system appuser && adduser --system --ingroup appuser appuser

WORKDIR /app

# Copy the virtual environment from the builder
COPY --from=builder /app/.venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH"

# Copy application code
COPY --from=builder /app/app ./app
COPY --from=builder /app/scripts ./scripts
COPY --link pyproject.toml ./

# Copy master protocol markdown files
COPY --link agent-assets/master-protocols ./agent-assets/master-protocols

# Tell eval_agent where to find protocols in the container
ENV MASTER_PROTOCOLS_DIR=/app/agent-assets/master-protocols

# Set permissions
RUN chown -R appuser:appuser /app
USER appuser

# Expose the port (default for uvicorn is 8000)
EXPOSE 8000

# Default command to run the app
CMD ["python", "-m", "app.main"]
