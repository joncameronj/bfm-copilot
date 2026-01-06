# Start Development Servers

Start both the Next.js frontend and Python agent backend for local development.

## Instructions

Run both servers in parallel:

1. **Next.js Frontend** (port 3000):
   ```bash
   npm run dev
   ```

2. **Python Agent** (port 8000):
   ```bash
   cd python-agent && source .venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

Start both servers as background tasks so the user can continue working. Use the Bash tool with `run_in_background: true` for each server.

After starting, inform the user:
- Frontend: http://localhost:3000
- Python Agent: http://localhost:8000

Wait a few seconds and verify both servers are responding.
