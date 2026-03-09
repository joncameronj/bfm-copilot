# BFM Eval Runner Agent

A project-level Claude Code agent for running offline BFM clinical evaluations and accuracy testing against known answer keys.

## Purpose

Run structured BFM clinical evaluations against diagnostic data without touching the UI. Useful for:
- Validating accuracy of Claude Opus recommendations against known answer keys
- Testing new patients before adding them to the app
- Debugging eval agent behavior
- Generating answer key JSON from practitioner-reviewed evaluations

## Tools Available

- Read, Glob, Grep — for reading eval fixtures and answer keys
- Bash — for running Python scripts and calling the eval API
- Write — for storing generated answer keys

## Usage

### Run eval for a single patient

```bash
# Assumes Python agent is running at localhost:8000
curl -X POST http://localhost:8000/agent/eval \
  -H 'Content-Type: application/json' \
  -d '{"diagnostic_analysis_id": "<uuid>", "patient_id": "<uuid>"}'
```

### Run batch eval (up to 5 patients)

```bash
curl -X POST http://localhost:8000/agent/eval/batch \
  -H 'Content-Type: application/json' \
  -d '{
    "patients": [
      {"diagnostic_analysis_id": "<uuid1>", "patient_id": "<pid1>"},
      {"diagnostic_analysis_id": "<uuid2>", "patient_id": "<pid2>"}
    ]
  }'
```

### Poll for completion

```bash
# By report ID (from POST response)
curl http://localhost:8000/agent/eval/<report_id>

# By analysis ID
curl http://localhost:8000/agent/eval/by-analysis/<analysis_id>
```

### Run accuracy tests

```bash
cd python-agent
uv run pytest tests/test_eval_agent.py -v --tb=short
```

## Directory Structure

```
eval/bfm-eval-mar2026/
  patient-DH/           # Patient DH diagnostic files
  patient-JB/
  patient-TC/
  patient-ML/
  patient-RS/
  answer-keys/
    patient-DH.json     # Ground truth from manual eval
    patient-JB.json
    ...
```

## Answer Key Format

Answer keys are `EvalReport` JSON matching `python-agent/app/models/eval_models.py`:

```json
{
  "patient_name": "DH",
  "report_date": "2026-02-28",
  "urgency": {
    "score": 4.5,
    "rationale": "...",
    "timeline": "...",
    "critical_path": "..."
  },
  "deal_breakers": [...],
  "frequency_phases": [...],
  "supplementation": [...],
  "five_levers": [...],
  "patient_analogies": [...],
  "monitoring": [...],
  "clinical_summary": "...",
  "confidence_notes": ""
}
```

## Accuracy Scoring

The test suite (`tests/test_eval_agent.py`) compares generated reports against answer keys:
- **Protocol accuracy**: Did the model find all expected protocols?
- **Supplement accuracy**: Were all required supplements recommended?
- **Deal breaker detection**: Were all deal breakers identified?
- **Target threshold**: ≥85% overall accuracy

## Creating New Answer Keys

1. Run eval via API for the patient
2. Have a BFM practitioner review and correct the output
3. Save the corrected JSON to `eval/bfm-eval-mar2026/answer-keys/<patient>.json`
4. Add a test class to `tests/test_eval_agent.py` referencing the new answer key

## Cost Notes

Each eval call costs approximately $2-4 in Claude Opus tokens.
- All 5 patients in parallel: ~$10-20 total, ~3 minutes
- Always gate behind explicit user action — never auto-trigger
