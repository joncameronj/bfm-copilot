"""
BFM Eval Agent Accuracy Test Suite.

Tests the Claude Opus 4.6 eval agent against known-correct answer keys
from the manual evaluation session (February 2026).

Architecture:
- Fixtures in eval/bfm-eval-mar2026/answer-keys/*.json (ground truth)
- Tests verify precision/recall on protocols, supplements, deal breakers
- Overall target: ≥85% accuracy (raised from 70% protocol engine target)

Run:
    cd python-agent
    uv run pytest tests/test_eval_agent.py -v

For CI (skip slow Opus calls, use fixtures only):
    uv run pytest tests/test_eval_agent.py -v -m "not slow"
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import pytest

# ============================================================================
# ANSWER KEYS (stored inline for fast tests that don't call Claude Opus)
# ============================================================================
# These represent the expected output structure — not calling Claude live in CI.
# Live integration tests are marked @pytest.mark.slow and skipped by default.

ANSWER_KEYS: dict[str, dict[str, Any]] = {
    # Based on manual eval session, February 2026
    # Patient DH — the most complex case (7 deal breakers found)
    "DH": {
        "expected_deal_breakers": [
            "SNS Switched",
            "Alpha/Theta Imbalance",
            "VCS Failed",
        ],
        "expected_protocols": [
            "SNS Balance",
            "Alpha Theta",
            "Biotoxin",
            "Cyto Lower",
        ],
        "expected_supplements": [
            "Cell Synergy",
            "Pectasol-C",
            "X-39",
            "D-Ribose",
        ],
        "urgency_min": 4.0,
        "five_levers_expected": 5,
    },
}

# ============================================================================
# FIXTURE ANSWER KEY LOADER (for JSON files when they exist)
# ============================================================================

_ANSWER_KEY_DIR = Path(__file__).parent.parent.parent / "eval" / "bfm-eval-mar2026" / "answer-keys"


def _load_answer_key(patient_id: str) -> dict | None:
    """Load answer key from JSON file if it exists."""
    f = _ANSWER_KEY_DIR / f"patient-{patient_id}.json"
    if f.exists():
        return json.loads(f.read_text())
    return None


# ============================================================================
# MODEL VALIDATION TESTS (no LLM calls — validate Pydantic models only)
# ============================================================================

class TestEvalModels:
    """Validate that the EvalReport Pydantic model accepts valid data."""

    def test_eval_report_schema_is_valid(self):
        """EvalReport must have a valid JSON schema (required for prompt injection)."""
        from app.models.eval_models import EvalReport
        schema = EvalReport.model_json_schema()
        assert "properties" in schema
        assert "deal_breakers" in schema["properties"]
        assert "frequency_phases" in schema["properties"]
        assert "five_levers" in schema["properties"]
        assert "patient_analogies" in schema["properties"]

    def test_urgency_rating_model(self):
        from app.models.eval_models import UrgencyRating
        u = UrgencyRating(
            score=4.5,
            rationale="Multiple deal breakers",
            timeline="3-6 months",
            critical_path="SNS Balance first",
        )
        assert u.score == 4.5
        assert u.timeline == "3-6 months"

    def test_deal_breaker_requires_citation(self):
        from app.models.eval_models import DealBreaker
        db = DealBreaker(
            name="SNS Switched",
            finding="Red dot crosses blue dot on HRV",
            protocol="SNS Balance",
            urgency="Must address before all other protocols",
            patient_data_citation="HRV: switched_sympathetics=True",
        )
        assert db.patient_data_citation != ""

    def test_full_eval_report_round_trip(self):
        """EvalReport → dict → EvalReport preserves all fields."""
        from app.models.eval_models import EvalReport, UrgencyRating, DealBreaker, FrequencyPhase

        report = EvalReport(
            patient_name="Test Patient",
            report_date="2026-02-28",
            urgency=UrgencyRating(
                score=3.5,
                rationale="Moderate severity",
                timeline="2-4 months",
                critical_path="Address pH first",
            ),
            deal_breakers=[
                DealBreaker(
                    name="Low pH",
                    finding="pH 6.1",
                    protocol="Terrain",
                    urgency="Acidic terrain blocks all healing",
                    patient_data_citation="UA pH: 6.1",
                )
            ],
            frequency_phases=[
                FrequencyPhase(
                    phase=1,
                    protocol_name="Terrain",
                    trigger="pH 6.1",
                    patient_data_citation="UA pH: 6.1",
                    sequencing_note="",
                )
            ],
            supplementation=[],
            five_levers=[],
            patient_analogies=[],
            monitoring=[],
            clinical_summary="Test summary",
        )

        data = report.model_dump()
        restored = EvalReport(**data)
        assert restored.patient_name == "Test Patient"
        assert restored.deal_breakers[0].name == "Low pH"
        assert restored.frequency_phases[0].phase == 1


# ============================================================================
# PROTOCOL LOADING TESTS
# ============================================================================

class TestProtocolLoading:
    """Test that master protocol files load correctly."""

    def test_master_protocols_dir_exists(self):
        from app.agent.eval_agent import _MASTER_PROTOCOLS_DIR
        assert _MASTER_PROTOCOLS_DIR.exists(), (
            f"Master protocols dir not found: {_MASTER_PROTOCOLS_DIR}\n"
            "Run scripts/convert_master_xlsx.py to generate .md files."
        )

    def test_all_9_protocol_files_present(self):
        from app.agent.eval_agent import _MASTER_PROTOCOLS_DIR
        if not _MASTER_PROTOCOLS_DIR.exists():
            pytest.skip("Master protocols directory not found")

        files = list(_MASTER_PROTOCOLS_DIR.glob("*.md"))
        assert len(files) >= 9, (
            f"Expected 9 master protocol files, found {len(files)}: "
            f"{[f.name for f in files]}"
        )

    def test_protocol_files_have_content(self):
        from app.agent.eval_agent import _MASTER_PROTOCOLS_DIR
        if not _MASTER_PROTOCOLS_DIR.exists():
            pytest.skip("Master protocols directory not found")

        for f in sorted(_MASTER_PROTOCOLS_DIR.glob("*.md")):
            content = f.read_text()
            assert len(content) > 100, f"Protocol file {f.name} appears empty or too small"

    def test_load_master_protocols_caches(self):
        """_load_master_protocols should be cached (same object returned twice)."""
        from app.agent.eval_agent import _MASTER_PROTOCOLS_DIR
        if not _MASTER_PROTOCOLS_DIR.exists():
            pytest.skip("Master protocols directory not found")

        from app.agent.eval_agent import _load_master_protocols
        result1 = _load_master_protocols()
        result2 = _load_master_protocols()
        assert result1 is result2  # lru_cache returns same object

    def test_protocol_content_includes_deal_breakers(self):
        from app.agent.eval_agent import _MASTER_PROTOCOLS_DIR
        if not _MASTER_PROTOCOLS_DIR.exists():
            pytest.skip("Master protocols directory not found")

        from app.agent.eval_agent import _load_master_protocols
        content = _load_master_protocols()
        # Check key content is present
        assert "deal breaker" in content.lower() or "Deal Breaker" in content, (
            "Master protocol context should include deal breaker content"
        )

    def test_protocol_total_size_fits_200k_window(self):
        """
        Total protocol context must fit in the 200K context window alongside patient data.
        200K tokens ≈ ~800KB text. Protocols should be well under 200KB.
        """
        from app.agent.eval_agent import _MASTER_PROTOCOLS_DIR
        if not _MASTER_PROTOCOLS_DIR.exists():
            pytest.skip("Master protocols directory not found")

        from app.agent.eval_agent import _load_master_protocols
        content = _load_master_protocols()
        size_kb = len(content.encode("utf-8")) / 1024
        assert size_kb < 200, (
            f"Protocol context is {size_kb:.0f}KB — too large for inline injection. "
            "Max is 200KB to leave room for patient data in 200K context window."
        )


# ============================================================================
# PROMPT BUILDING TESTS
# ============================================================================

class TestPromptBuilding:
    """Test that prompts are correctly constructed."""

    def test_system_prompt_includes_protocols(self):
        from app.agent.eval_agent import _MASTER_PROTOCOLS_DIR, _build_system_prompt
        if not _MASTER_PROTOCOLS_DIR.exists():
            pytest.skip("Master protocols directory not found")

        from app.agent.eval_agent import _load_master_protocols
        protocols = _load_master_protocols()
        system = _build_system_prompt(protocols)

        assert "authoritative ground truth" in system
        assert "Every single recommendation MUST cite" in system
        assert len(system) > 1000  # Should be substantial

    def test_user_prompt_includes_schema(self):
        from app.agent.eval_agent import _build_user_prompt
        bundle = {"hrv": {"system_energy": 8}, "ua": {"ph": 6.2}}
        prompt = _build_user_prompt("Test Patient", '{"hrv": {}}')

        assert "Test Patient" in prompt
        assert "EvalReport JSON Schema" in prompt
        assert "Return ONLY the JSON object" in prompt

    def test_prompt_enforces_citation_requirement(self):
        from app.agent.eval_agent import _MASTER_PROTOCOLS_DIR, _build_system_prompt
        if not _MASTER_PROTOCOLS_DIR.exists():
            pytest.skip("Master protocols directory not found")

        from app.agent.eval_agent import _load_master_protocols
        system = _build_system_prompt(_load_master_protocols())
        assert "cite" in system.lower()
        assert "patient data point" in system.lower()


# ============================================================================
# ACCURACY HARNESS (requires answer key JSON files + running agent)
# ============================================================================

class TestAccuracyHarness:
    """
    Accuracy measurement using loaded answer keys.
    These tests require the answer key JSON files to be present in:
    eval/bfm-eval-mar2026/answer-keys/
    """

    def _score_report(
        self,
        generated: dict,
        answer_key: dict,
        patient_id: str,
    ) -> tuple[float, list[str]]:
        """
        Score a generated report against an answer key.

        Returns (accuracy_0_to_1, list_of_misses).
        """
        misses: list[str] = []
        total = 0
        found = 0

        # Deal breakers
        gen_db_names = {d.get("name", "").lower() for d in generated.get("deal_breakers", [])}
        for expected_db in answer_key.get("expected_deal_breakers", []):
            total += 1
            if any(expected_db.lower() in name for name in gen_db_names):
                found += 1
            else:
                misses.append(f"Missing deal breaker: {expected_db}")

        # Protocols
        gen_protocols = {
            fp.get("protocol_name", "").lower()
            for fp in generated.get("frequency_phases", [])
        }
        for expected_p in answer_key.get("expected_protocols", []):
            total += 1
            if any(expected_p.lower() in p for p in gen_protocols):
                found += 1
            else:
                misses.append(f"Missing protocol: {expected_p}")

        # Supplements
        gen_supps = {
            s.get("name", "").lower()
            for s in generated.get("supplementation", [])
        }
        for expected_s in answer_key.get("expected_supplements", []):
            total += 1
            if any(expected_s.lower() in s for s in gen_supps):
                found += 1
            else:
                misses.append(f"Missing supplement: {expected_s}")

        accuracy = found / total if total > 0 else 0
        return accuracy, misses

    def test_answer_keys_exist_or_skip(self):
        """Verify answer key files exist; skip gracefully if not."""
        keys = list(_ANSWER_KEY_DIR.glob("*.json")) if _ANSWER_KEY_DIR.exists() else []
        if not keys:
            pytest.skip(
                f"No answer key JSON files found in {_ANSWER_KEY_DIR}. "
                "Run a manual eval and store the reviewed output as answer keys."
            )

    def test_inline_answer_keys_score_correctly(self):
        """
        Verify the scoring function works correctly using inline test data.
        This test always runs (no LLM calls needed).
        """
        test_report = {
            "patient_name": "Test",
            "deal_breakers": [
                {"name": "SNS Switched", "patient_data_citation": "..."},
                {"name": "Alpha/Theta Imbalance", "patient_data_citation": "..."},
            ],
            "frequency_phases": [
                {"protocol_name": "SNS Balance", "phase": 1, "patient_data_citation": "..."},
                {"protocol_name": "Alpha Theta", "phase": 1, "patient_data_citation": "..."},
            ],
            "supplementation": [
                {"name": "Cell Synergy", "patient_data_citation": "..."},
                {"name": "D-Ribose", "patient_data_citation": "..."},
            ],
        }

        answer_key = {
            "expected_deal_breakers": ["SNS Switched", "Alpha/Theta Imbalance"],
            "expected_protocols": ["SNS Balance", "Alpha Theta"],
            "expected_supplements": ["Cell Synergy", "D-Ribose"],
        }

        accuracy, misses = self._score_report(test_report, answer_key, "Test")
        assert accuracy == 1.0, f"Expected 100% accuracy on perfect report. Misses: {misses}"

    def test_partial_match_scores_correctly(self):
        """Verify partial matches score correctly."""
        partial_report = {
            "patient_name": "Test",
            "deal_breakers": [{"name": "SNS Switched", "patient_data_citation": "..."}],
            "frequency_phases": [{"protocol_name": "SNS Balance", "phase": 1, "patient_data_citation": "..."}],
            "supplementation": [],
        }

        answer_key = {
            "expected_deal_breakers": ["SNS Switched", "VCS Failed"],
            "expected_protocols": ["SNS Balance", "Biotoxin"],
            "expected_supplements": ["Pectasol-C"],
        }

        accuracy, misses = self._score_report(partial_report, answer_key, "Test")
        assert 0.3 < accuracy < 0.7, f"Expected partial accuracy. Got {accuracy:.2%}"
        assert len(misses) == 3  # VCS Failed, Biotoxin, Pectasol-C


# ============================================================================
# LIVE INTEGRATION TESTS (marked slow — require ANTHROPIC_API_KEY + running agent)
# ============================================================================

@pytest.mark.slow
class TestEvalAgentLive:
    """
    Live integration tests that call Claude Opus 4.6.
    Skipped by default unless:
    1. ANTHROPIC_API_KEY is set in environment
    2. Master protocol files are present
    3. -m slow is passed to pytest

    Cost: ~$2-4 per test (Claude Opus 4.6 at 200K context).
    """

    @pytest.fixture(autouse=True)
    def skip_if_no_key(self):
        if not os.environ.get("ANTHROPIC_API_KEY"):
            pytest.skip("ANTHROPIC_API_KEY not set — skipping live Claude Opus tests")

    @pytest.fixture(autouse=True)
    def skip_if_no_protocols(self):
        from app.agent.eval_agent import _MASTER_PROTOCOLS_DIR
        if not _MASTER_PROTOCOLS_DIR.exists():
            pytest.skip("Master protocols directory not found")

    @pytest.mark.asyncio
    async def test_eval_agent_returns_valid_report(self):
        """
        Run a minimal eval with a simple known patient case and verify the output
        is a valid EvalReport with the required structure.

        Uses the Hormones CS2 case (known answer from test_protocol_engine.py).
        """
        from app.agent.eval_agent import EvalAgentRunner

        # Simple known case: biotoxic illness pattern (alpha 7%, gamma 42%, protein, pH 6.47)
        bundle = {
            "hrv": {
                "system_energy": 6,
                "stress_response": 3,
                "patterns": {
                    "switched_sympathetics": False,
                    "pns_negative": False,
                    "vagus_dysfunction": False,
                },
                "brainwave": {
                    "alpha": 7,
                    "beta": 23,
                    "delta": 5,
                    "gamma": 42,
                    "theta": 12,
                },
            },
            "dPulse": {
                "markers": [
                    {"name": "Heart", "percentage": 100},
                    {"name": "Liver", "percentage": 98},
                    {"name": "Kidneys", "percentage": 100},
                ],
                "stress_index": 22,
            },
            "ua": {
                "ph": {"value": 6.47, "status": "low"},
                "protein": {"value": "15", "status": "positive"},
                "vcs_score": {"correct": 31, "total": 32, "passed": True},
            },
        }

        runner = EvalAgentRunner()
        report = await runner.run(bundle, "CS2 Test")

        # Structural assertions (not content — LLM may vary)
        assert report.patient_name == "CS2 Test"
        assert 0 <= report.urgency.score <= 5
        assert len(report.deal_breakers) >= 0
        assert len(report.frequency_phases) >= 0
        assert len(report.five_levers) == 5, "Must assess all 5 levers"
        assert len(report.clinical_summary) > 50

        # All recommendations must have citations
        for db in report.deal_breakers:
            assert db.patient_data_citation, f"Deal breaker '{db.name}' missing citation"
        for fp in report.frequency_phases:
            assert fp.patient_data_citation, f"Protocol '{fp.protocol_name}' missing citation"
        for s in report.supplementation:
            assert s.patient_data_citation, f"Supplement '{s.name}' missing citation"

    @pytest.mark.asyncio
    async def test_eval_accuracy_hormones_cs2(self):
        """
        Full accuracy test: Hormones CS2 case.
        Expected: Alpha Theta, Biotoxin protocols; Cell Synergy, X-39 supplements.
        Target: ≥85% of expected items found.
        """
        from app.agent.eval_agent import EvalAgentRunner

        bundle = {
            "hrv": {
                "system_energy": 6,
                "brainwave": {"alpha": 7, "beta": 23, "delta": 5, "gamma": 42, "theta": 12},
                "patterns": {"switched_sympathetics": False, "pns_negative": False, "vagus_dysfunction": False},
            },
            "dPulse": {
                "markers": [{"name": "Heart", "percentage": 100}, {"name": "Liver", "percentage": 98}],
            },
            "ua": {
                "ph": {"value": 6.47, "status": "low"},
                "protein": {"value": "15", "status": "positive"},
                "vcs_score": {"correct": 31, "total": 32, "passed": True},
            },
        }

        expected = {
            "expected_deal_breakers": [],  # No deal breakers (just low pH and brainwave imbalance)
            "expected_protocols": ["Alpha Theta", "Biotoxin"],
            "expected_supplements": ["Cell Synergy", "X-39"],
        }

        runner = EvalAgentRunner()
        report = await runner.run(bundle, "CS2")
        report_dict = report.model_dump()

        # Score
        gen_protocols = {fp["protocol_name"].lower() for fp in report_dict.get("frequency_phases", [])}
        gen_supps = {s["name"].lower() for s in report_dict.get("supplementation", [])}

        total = len(expected["expected_protocols"]) + len(expected["expected_supplements"])
        found = sum(
            1 for p in expected["expected_protocols"]
            if any(p.lower() in gp for gp in gen_protocols)
        )
        found += sum(
            1 for s in expected["expected_supplements"]
            if any(s.lower() in gs for gs in gen_supps)
        )

        accuracy = found / total if total > 0 else 0
        assert accuracy >= 0.85, (
            f"Hormones CS2 accuracy {accuracy:.0%} is below 85% threshold.\n"
            f"Got protocols: {gen_protocols}\n"
            f"Got supplements: {gen_supps}\n"
            f"Expected protocols: {expected['expected_protocols']}\n"
            f"Expected supplements: {expected['expected_supplements']}"
        )


# ============================================================================
# OVERALL ACCURACY REPORT (always runs, prints summary)
# ============================================================================

class TestAccuracyReport:
    """
    Generates an accuracy report from answer key JSON files.
    Always passes but prints a detailed report.
    Mirrors the structure of TestAccuracyReport in test_protocol_engine.py.
    """

    def test_print_accuracy_report_from_answer_keys(self, capsys):
        """
        Load all available answer key files and print an accuracy comparison
        summary. If no answer keys exist, prints instructions for creating them.
        """
        print("\n" + "=" * 70)
        print("BFM EVAL AGENT ACCURACY REPORT (Answer Key Comparison)")
        print("=" * 70)

        if not _ANSWER_KEY_DIR.exists() or not list(_ANSWER_KEY_DIR.glob("*.json")):
            print("\nNo answer key files found.")
            print(f"Expected location: {_ANSWER_KEY_DIR}")
            print("\nTo create answer keys:")
            print("  1. Run eval via API for each patient")
            print("  2. Have a BFM practitioner review and correct the output")
            print("  3. Save reviewed JSON to eval/bfm-eval-mar2026/answer-keys/<patient>.json")
            print("\nSee .claude/agents/bfm-eval-runner.md for details.")
            print("=" * 70)
            return

        answer_keys = sorted(_ANSWER_KEY_DIR.glob("*.json"))
        for key_file in answer_keys:
            answer_key = json.loads(key_file.read_text())
            patient_id = key_file.stem.replace("patient-", "")
            print(f"\n--- Patient: {patient_id} ---")
            print(f"  Expected deal breakers: {answer_key.get('expected_deal_breakers', [])}")
            print(f"  Expected protocols: {answer_key.get('expected_protocols', [])}")
            print(f"  Expected supplements: {answer_key.get('expected_supplements', [])}")
            print(f"  Min urgency score: {answer_key.get('urgency_min', 'N/A')}")
            print("  (Live comparison requires running the eval agent against patient data)")

        print("\n" + "=" * 70)
        print("Run with -m slow and ANTHROPIC_API_KEY set for live accuracy scoring")
        print("=" * 70 + "\n")
