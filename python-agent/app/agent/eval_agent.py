"""
BFM Eval Agent - Claude Opus 4.6 full clinical evaluation.

Architecture decision: ONE Claude Opus call per patient with all 9 master protocol
files injected verbatim. This is what produced near-perfect accuracy in testing.
- 200K context window handles ~50KB protocols + ~5KB patient data comfortably
- Single call eliminates round-trip latency of sub-agent approaches
- Inline protocols (not RAG) are ground truth — no retrieval errors

Do NOT use RAG for this flow. The master protocols ARE the context.
"""

from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path

from app.models.eval_models import EvalReport
from app.services.claude_client import get_claude_client, EVAL_MODEL, EVAL_MAX_TOKENS
from app.utils.logger import get_logger

logger = get_logger("eval_agent")

# Path to master protocol files — check env var first (Docker), then relative to repo root (local dev)
_MASTER_PROTOCOLS_DIR = Path(
    os.environ.get("MASTER_PROTOCOLS_DIR", "")
) if os.environ.get("MASTER_PROTOCOLS_DIR") else (
    Path(__file__).parent.parent.parent.parent / "agent-assets" / "master-protocols"
)

# JSON schema for the EvalReport — injected into prompt so Opus knows the output format
_EVAL_REPORT_SCHEMA = json.dumps(EvalReport.model_json_schema(), indent=2)


@lru_cache(maxsize=1)
def _load_master_protocols() -> str:
    """
    Load all 9 master protocol files verbatim and cache them.

    Called once at first use, then cached for the process lifetime.
    This is the exact approach that produced near-perfect eval accuracy:
    ground truth inline, not retrieved from a vector store.
    """
    if not _MASTER_PROTOCOLS_DIR.exists():
        raise RuntimeError(
            f"Master protocols directory not found: {_MASTER_PROTOCOLS_DIR}\n"
            "Run scripts/ingest_master_protocols.py to generate the .md files."
        )

    files = sorted(_MASTER_PROTOCOLS_DIR.glob("*.md"))
    if not files:
        raise RuntimeError(f"No .md files found in {_MASTER_PROTOCOLS_DIR}")

    sections: list[str] = []
    for f in files:
        content = f.read_text(encoding="utf-8")
        sections.append(f"=== {f.name} ===\n{content}")

    combined = "\n\n".join(sections)
    logger.info(
        "Loaded %d master protocol files (%d chars total)",
        len(files),
        len(combined),
    )
    return combined


def _build_system_prompt(master_protocols: str) -> str:
    return f"""You are a BFM (Bioenergetic Functional Medicine) clinical expert with deep knowledge \
of the BFM Master Protocol Key. The protocol rules below are authoritative ground truth — \
you must apply them exactly as written, not from general medical knowledge.

MASTER PROTOCOL KEY (all 9 files, verbatim):
{master_protocols}

CLINICAL REASONING RULES:
1. Every single recommendation MUST cite the specific patient data point that triggered it.
   Format: "[Finding X] because patient shows [exact value from data]"
2. Deal breakers (Section 01) take absolute priority — address ALL before any other protocols.
3. Gating rules are non-negotiable: Cyto Lower cannot run until MSH/Leptin Resist is addressed, etc.
4. Use EXACT BFM protocol names from the master key. NEVER invent protocol names that are not in
   the master key (e.g. "Brain Activity Support", "Stress Index Regulation", "Cervical Support"
   do not exist — do not use them).
5. The Five Levers (Section 06) must be assessed for EVERY patient.
6. Supplement names must use BFM branded names (Innovita line, LifeWave, etc.) as specified.
7. If data is missing for a diagnostic category, note it explicitly — do not infer or assume.

SUPPLEMENT PHASING RULES (critical — apply exactly):
- Day 1 (in-office testing findings only): Cell Synergy, Tri-Salts (pH<6.2 only), Pectasol-C
  (VCS failed), Serculate (Heart low D-Pulse), CoQ10 (Heart low D-Pulse),
  X-39 (ONLY if protein positive in urine OR most/all D-Pulse organs in single digits),
  Innovita Vagus Nerve (if vagus deal breaker triggered). Nothing else on Day 1.
- Cell Synergy standard dose = 1 scoop. DOUBLE dose = 2 scoops (not 4). Only increase beyond
  1 scoop if "BE MORE ATTENTIVE" finding OR Alpha/Theta ratio is extremely uneven (>2:1) and not resolving.
  X-39 is NOT automatic — it requires protein in urine or single-digit D-Pulse organs to trigger.
- D-Ribose: ONLY add if Theta >= 2x Alpha (2:1 ratio). NOT triggered below 2:1.
- Week 1-2 (lab work findings only): Vitamin D, IP6 Gold (high ferritin), Homocysteine Factor
  (high homocysteine), Adipothin (confirmed leptin resistance), Livergy (elevated liver enzymes),
  Pancreos (T2D), and other lab-triggered supplements. Do NOT add these until labs confirm need.
- Do NOT recommend Vitamin D, Integra Cell, or other lab-dependent supplements without
  lab confirmation — never assume labs will be abnormal.
- Additional supplements (Epi Pineal, Hypothala, Rejuvenation H2, Fatty 15, etc.) are added only
  IF the patient does not improve adequately with the initial recommendations.

MONITORING / LAB RETESTING RULES:
- LabCorp/bloodwork retesting: 3 months (not 6 weeks).
- In-office retesting (DePulse, HRV, Ortho, Valsalva, UA, VCS): every 2-4 weeks.

VCS / LEPTIN / MSH CASCADE (critical sequence):
- Failing VCS → indicates biotoxins present → causes leptin resistance → which then causes low MSH.
- ALWAYS address Leptin FIRST: Biotoxin frequency + Leptin Resist frequency + Adipothin supplement
  + leptin-style diet education. THEN move to MSH protocols (Pit A Support + Pars Intermedia +
  Hypothala). Do NOT jump to MSH support before addressing Leptin.

ALPHA/THETA TRIGGER RULE (critical — apply exactly):
- Theta above Alpha by ANY amount ALWAYS triggers Alpha Theta protocol. Even Theta 14% vs Alpha 11%
  (1.27:1) triggers Alpha Theta. The CSF vortex is running backwards whenever Theta exceeds Alpha.
- The 2:1 ratio ONLY determines D-Ribose supplementation and Cell Synergy double dosing.
  Ratio < 2:1 → Alpha Theta + Cell Synergy 1 scoop. NO D-Ribose.
  Ratio >= 2:1 → Alpha Theta + Cell Synergy 2 scoops + D-Ribose.
- NEVER say Alpha Theta is "not triggered" because the ratio doesn't reach 2:1.

GLUCOSE IN URINE — MUST BE ACTUALLY PRESENT:
- Only report glucose positive in urine if the UA strip EXPLICITLY shows glucose as a positive finding.
- If glucose is not listed on the urine test, or if it shows negative, DO NOT claim glucose is positive.
- Do NOT infer glucose in urine from blood glucose, HbA1c, or other metabolic markers.
- Pancreos supplement is NOT indicated if glucose is not actually present in urine.

UROBILINOGEN ON URINE:
- Urobilinogen present in urine = same handling as bilirubin in urine → Blood Support protocol.
- If BOTH bilirubin AND urobilinogen are present → more profound issue, higher priority Blood Support.
- If only one is present → still triggers Blood Support, but less severe.

HIGH URIC ACID ON URINE:
- Triggers Aldehyde Detox protocol + L-Ornithine L-Aspartate supplement (Day 1).

AUTONOMIC PATTERN RULES (apply exactly):
- SNS SWITCHED (upper-left quadrant, SNS clearly elevated and flipped): SNS Balance 35@709
- LOWER-LEFT QUADRANT (both SNS and PNS negative/depleted — Energetic Imbalance):
  Triggers MIDBRAIN SUPPORT, NOT SNS Balance. This is total energy depletion, not a switch.
- RED DOT SUPERIMPOSED on BLUE DOT (fight/flight freeze pattern): Triggers LOCUS COERULEUS
  frequency IN ADDITION to SNS Balance.
- HIGH BARORECEPTOR SENSITIVITY noted on HRV: Triggers CSF SUPPORT frequency.
- Do NOT trigger SNS Balance for a purely vagal-dysfunction pattern without confirmed SNS switch.

VAGUS NERVE PROTOCOL ORDER (non-negotiable):
- ALWAYS start with Vagus Support first.
- Add Vagus Trauma only if Vagus Support is insufficient or if the pattern specifically shows
  paradoxical deep-breathing response (deep breathing worsens PNS).
- Vagus Support BEFORE Vagus Trauma — never reverse this order.

LAB-TRIGGERED FREQUENCIES:
- High BUN/Creatinine ratio → EMF Cord frequency.
- Elevated liver enzymes (AST/ALT) → Liver Inflame frequency.
- Low specific gravity in urine (1.005 or below) → Deuterium Drops supplement.
- High ferritin → Ferritin Lower frequency + IP6 Gold supplement (EMPTY STOMACH mandatory).
- High uric acid → Aldehyde Detox frequency + L-Ornithine L-Aspartate supplement.
- Elevated CRP → Mito Leak frequency.
- Spike protein >1000 U/mL → Virus Recovery frequency.
- Low GFR/CKD → Kidney Repair/Vitality frequency.
- T2D (elevated glucose/HbA1c) → Insulin Resist + Pancreas T2D + SIBO (nightly) frequencies.

LAYERED PROTOCOL SYSTEM (critical — assign every protocol and supplement to the correct layer):
Treatment is delivered in 3 layers. Set the "layer_label" and "layer_description" fields on every
FrequencyPhase, and the "layer" field on every SupplementItem.

Layer 1 (phase=1) — "High Priorities":
  layer_label="High Priorities", layer_description="Deal breakers and urgent protocols. Address these first."
  - ALL deal breaker protocols (SNS Switched, Vagus, etc.)
  - Primary diagnostics-driven frequencies from in-office testing
  - Day 1 supplements: Cell Synergy, Tri-Salts (pH<6.2), Pectasol-C (VCS failed),
    X-39 (ONLY if protein positive in urine OR most/all D-Pulse organs in single digits),
    Serculate (Heart low D-Pulse), CoQ10 (Heart low D-Pulse), Innovita Vagus Nerve (vagus deal breaker),
    Deuterium Drops (specific gravity ≤1.005 on UA),
    D-Ribose (ONLY if Theta >= 2x Alpha), L-Ornithine L-Aspartate (high uric acid on UA)
  - Supplements in this layer: set layer=1

Layer 2 (phase=2) — "Next If No Response":
  layer_label="Next If No Response", layer_description="Secondary protocols if no response after 4-6 weeks."
  - Condition-specific protocols (Thyroid, Hormone, Gut, Liver, etc.)
  - Lab-triggered frequencies (Liver Inflame, Ferritin Lower, etc.)
  - Lab-triggered supplements: Vitamin D, IP6 Gold, Homocysteine Factor, Adipothin, Livergy, Pancreos
  - Supplements in this layer: set layer=2

Layer 3 (phase=3) — "If They Are Still Stuck":
  layer_label="If They Are Still Stuck", layer_description="Deep-dive protocols for resistant cases after 2-3 months."
  - Experimental protocols (EMF Cord, Deuterium frequency for high deuterium >130ppm, etc.)
  - Advanced detox protocols
  - Environmental factor protocols
  - Advanced supplements: Epi Pineal, Hypothala, Rejuvenation H2, Fatty 15, etc.
  - Supplements in this layer: set layer=3

CRITICAL: You MUST generate protocols and supplements for ALL THREE LAYERS. A complete report
typically has 8-12 Layer 1 protocols, 5-8 Layer 2 protocols, and 3-6 Layer 3 protocols.
Similarly, supplements should span all 3 layers. If you only produce Layer 1, the report is
INCOMPLETE. Layer 2 and Layer 3 are clinically essential for long-term treatment planning.

SESSION FREQUENCY CONTEXT:
- Standard BFM practice: patients are seen 2× per week. This is the baseline.
- "BE MORE ATTENTIVE" finding means MORE than the standard 2×/week (e.g. 3×/week).
- Do NOT frame standard 2×/week as exceptional; it is the normal standard of care.
- Do NOT suggest patients need external conventional medical co-management in the report.
  This is a BFM clinical document — keep recommendations within the BFM clinical framework.

OUTPUT FORMAT:
Return ONLY valid JSON matching the EvalReport schema. No preamble, no markdown code blocks, \
no explanation outside the JSON. The JSON must be parseable by json.loads()."""


def _build_user_prompt(patient_name: str, bundle_json: str) -> str:
    return f"""Analyze this patient comprehensively. Apply ALL applicable rules from the \
Master Protocol Key. Every recommendation must cite the exact patient data point.

Patient: {patient_name}

Diagnostic Bundle (all available data):
{bundle_json}

EvalReport JSON Schema (your output must match this exactly):
{_EVAL_REPORT_SCHEMA}

Return ONLY the JSON object. Begin with {{ and end with }}."""


class EvalAgentRunner:
    """
    Runs the Claude Opus full clinical evaluation for a single patient.

    Usage:
        runner = EvalAgentRunner()
        report = await runner.run(bundle_dict, patient_name="DH")
    """

    def __init__(self) -> None:
        # Eagerly load protocols so any filesystem errors surface at startup
        self._protocols = _load_master_protocols()

    async def run(self, bundle_dict: dict, patient_name: str) -> EvalReport:
        """
        Run one full Claude Opus eval for a patient.

        Args:
            bundle_dict: DiagnosticBundle as a plain dict (all available extracted data)
            patient_name: Patient display name (first name or initials)

        Returns:
            Validated EvalReport Pydantic model

        Raises:
            ValueError: If Claude returns unparseable JSON
            anthropic.APIError: On API failures
        """
        client = get_claude_client()

        system_prompt = _build_system_prompt(self._protocols)
        user_prompt = _build_user_prompt(patient_name, json.dumps(bundle_dict, indent=2))

        logger.info(
            "Starting Claude Opus eval for patient '%s' (~%d protocol chars + %d bundle chars)",
            patient_name,
            len(self._protocols),
            len(json.dumps(bundle_dict)),
        )

        response = await client.messages.create(
            model=EVAL_MODEL,
            max_tokens=EVAL_MAX_TOKENS,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )

        raw_text = response.content[0].text.strip()
        logger.info(
            "Claude Opus eval complete for '%s': %d output chars, stop_reason=%s",
            patient_name,
            len(raw_text),
            response.stop_reason,
        )

        # Parse and validate
        try:
            # Strip markdown code fences if Opus added them despite instructions
            if raw_text.startswith("```"):
                lines = raw_text.split("\n")
                raw_text = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])

            report_dict = json.loads(raw_text)
            report = EvalReport(**report_dict)
            return report

        except (json.JSONDecodeError, ValueError) as exc:
            logger.error(
                "Failed to parse Claude Opus response for '%s': %s\nRaw (first 500 chars): %s",
                patient_name,
                exc,
                raw_text[:500],
            )
            raise ValueError(
                f"Claude Opus returned unparseable output for patient '{patient_name}': {exc}"
            ) from exc


# Module-level singleton — reuse across requests to avoid reloading protocol files
_runner: EvalAgentRunner | None = None


def get_eval_runner() -> EvalAgentRunner:
    """Get the module-level EvalAgentRunner singleton."""
    global _runner
    if _runner is None:
        _runner = EvalAgentRunner()
    return _runner
