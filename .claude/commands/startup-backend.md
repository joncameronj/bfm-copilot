# Start Python Agent Backend

Start the Python agent (FastAPI) backend for local development.

## Instructions

Run the backend server as a background task using the Bash tool with `run_in_background: true`:

```bash
cd python-agent && source .venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

After starting, inform the user:
- Python Agent: http://localhost:8000
