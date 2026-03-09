# BFM Copilot Python Agent

Python backend for the BFM Copilot AI assistant with xAI support and RAG capabilities.

## Setup

```bash
uv venv
source .venv/bin/activate
uv pip install -e .
```

## Usage

### Start the server
```bash
uvicorn app.main:app --reload
```

### Index documents
```bash
python scripts/index_docs.py ../docs/protocols --dry-run
python scripts/index_docs.py ../docs/protocols --global
```
