"""
Regression tests for _normalize_bundle and its helper functions.

These tests lock down existing behavior BEFORE any changes are made
to the urobilinogen, NS Tox, or multi-test handling logic.
"""

import pytest

from app.api.routes.eval import (
    _is_positive,
    _is_glucose_positive,
    _is_urobilinogen_positive,
    _check_exact_match,
    _coerce_float,
    _normalize_bundle,
)


# ============================================================================
# _is_positive() — denylist logic
# ============================================================================


class TestIsPositive:
    """Lock down the denylist behavior of _is_positive()."""

    def test_dict_status_positive(self):
        assert _is_positive({"value": "1+", "status": "positive"}) is True

    def test_dict_status_abnormal(self):
        assert _is_positive({"value": "High", "status": "abnormal"}) is True

    def test_dict_status_negative(self):
        assert _is_positive({"value": "Neg", "status": "negative"}) is False

    def test_dict_value_negative_string(self):
        assert _is_positive({"value": "Negative", "status": "normal"}) is False

    def test_dict_value_neg_short(self):
        assert _is_positive({"value": "neg", "status": ""}) is False

    def test_dict_value_zero(self):
        assert _is_positive({"value": "0", "status": ""}) is False

    def test_dict_value_empty(self):
        assert _is_positive({"value": "", "status": ""}) is False

    def test_dict_value_trace(self):
        """Trace is not in the denylist, so it's treated as positive."""
        assert _is_positive({"value": "Trace", "status": "normal"}) is True

    def test_dict_value_numeric_nonzero(self):
        """A numeric value like '0.2' is not in the denylist — treated as positive.
        THIS IS THE UROBILINOGEN BUG: '0.2' (normal level) passes through."""
        assert _is_positive({"value": "0.2", "status": "normal"}) is True

    def test_dict_value_normal_word(self):
        """The word 'Normal' is not in the denylist — treated as positive.
        THIS IS THE UROBILINOGEN BUG variant."""
        assert _is_positive({"value": "Normal", "status": "normal"}) is True

    def test_raw_truthy(self):
        assert _is_positive("some value") is True

    def test_raw_falsy_none(self):
        assert _is_positive(None) is False

    def test_raw_falsy_empty(self):
        assert _is_positive("") is False

    def test_raw_falsy_zero(self):
        assert _is_positive(0) is False

    def test_empty_dict(self):
        assert _is_positive({}) is False


# ============================================================================
# _is_urobilinogen_positive() — allowlist logic (mirrors glucose pattern)
# ============================================================================


class TestIsUrobilinogenPositive:
    """Verify the new allowlist prevents standard '0.2' from triggering."""

    def test_explicit_status_positive(self):
        assert _is_urobilinogen_positive({"value": "2+", "status": "positive"}) is True

    def test_value_1plus(self):
        assert _is_urobilinogen_positive({"value": "1+", "status": ""}) is True

    def test_value_2plus(self):
        assert _is_urobilinogen_positive({"value": "2+", "status": ""}) is True

    def test_value_4plus(self):
        assert _is_urobilinogen_positive({"value": "4+", "status": ""}) is True

    def test_value_8plus(self):
        assert _is_urobilinogen_positive({"value": "8+", "status": ""}) is True

    def test_value_word_positive(self):
        assert _is_urobilinogen_positive({"value": "positive", "status": ""}) is True

    def test_standard_0_2_is_negative(self):
        """0.2 mg/dL is the standard normal reference — must be negative."""
        assert _is_urobilinogen_positive({"value": "0.2", "status": "normal"}) is False

    def test_normal_word_is_negative(self):
        assert _is_urobilinogen_positive({"value": "Normal", "status": "normal"}) is False

    def test_negative_status(self):
        assert _is_urobilinogen_positive({"value": "Neg", "status": "negative"}) is False

    def test_none(self):
        assert _is_urobilinogen_positive(None) is False

    def test_empty_dict(self):
        assert _is_urobilinogen_positive({}) is False

    def test_non_dict(self):
        assert _is_urobilinogen_positive("positive") is False

    # --- Hallucination defense tests (value-trumps-status) ---

    def test_hallucination_0_2_with_positive_status(self):
        """THE KEY BUG: vision says value='0.2' but status='positive'. Must be False."""
        assert _is_urobilinogen_positive({"value": "0.2", "status": "positive"}) is False

    def test_hallucination_0_2_mg_dl_with_positive_status(self):
        """Same hallucination with units attached."""
        assert _is_urobilinogen_positive({"value": "0.2 mg/dL", "status": "positive"}) is False

    def test_hallucination_normal_with_positive_status(self):
        """Vision reads 'Normal' but marks status 'positive'."""
        assert _is_urobilinogen_positive({"value": "Normal", "status": "positive"}) is False

    def test_hallucination_neg_with_positive_status(self):
        """Vision reads 'Neg' but marks status 'positive'."""
        assert _is_urobilinogen_positive({"value": "Neg", "status": "positive"}) is False

    def test_hallucination_negative_with_positive_status(self):
        """Vision reads 'Negative' but marks status 'positive'."""
        assert _is_urobilinogen_positive({"value": "Negative", "status": "positive"}) is False

    def test_hallucination_empty_value_with_positive_status(self):
        """Vision has no value extracted but hallucinates positive status."""
        assert _is_urobilinogen_positive({"value": "", "status": "positive"}) is False

    def test_genuine_elevated_2_0_with_positive_status(self):
        """Value 2.0 is genuinely elevated — should still be True."""
        assert _is_urobilinogen_positive({"value": "2.0", "status": "positive"}) is True

    def test_genuine_elevated_1_0_with_positive_status(self):
        """Value 1.0 is elevated above 0.2 — status positive is correct."""
        assert _is_urobilinogen_positive({"value": "1.0", "status": "positive"}) is True

    def test_value_positive_trumps_negative_status(self):
        """If value is '2+' but status is somehow 'negative', value wins."""
        assert _is_urobilinogen_positive({"value": "2+", "status": "negative"}) is True


# ============================================================================
# _is_glucose_positive() — allowlist logic
# ============================================================================


class TestIsGlucosePositive:
    """Lock down the allowlist behavior of _is_glucose_positive()."""

    def test_explicit_status_positive(self):
        assert _is_glucose_positive({"value": "2+", "status": "positive"}) is True

    def test_value_plus(self):
        assert _is_glucose_positive({"value": "+", "status": ""}) is True

    def test_value_1plus(self):
        assert _is_glucose_positive({"value": "1+", "status": ""}) is True

    def test_value_2plus(self):
        assert _is_glucose_positive({"value": "2+", "status": ""}) is True

    def test_value_3plus(self):
        assert _is_glucose_positive({"value": "3+", "status": ""}) is True

    def test_value_word_positive(self):
        assert _is_glucose_positive({"value": "positive", "status": ""}) is True

    def test_negative_status(self):
        assert _is_glucose_positive({"value": "Neg", "status": "negative"}) is False

    def test_normal_numeric(self):
        """Numeric value without explicit positive status is negative."""
        assert _is_glucose_positive({"value": "0.2", "status": "normal"}) is False

    def test_normal_word(self):
        assert _is_glucose_positive({"value": "Normal", "status": "normal"}) is False

    def test_none(self):
        assert _is_glucose_positive(None) is False

    def test_empty_dict(self):
        assert _is_glucose_positive({}) is False

    def test_non_dict(self):
        assert _is_glucose_positive("positive") is False


# ============================================================================
# _check_exact_match() — Locus Coeruleus / NS Tox
# ============================================================================


class TestCheckExactMatch:
    """Lock down exact matching for dot superimposition detection."""

    def test_identical_values(self):
        a = {"hr": 72, "r_hf": 3.5, "r_lf1": 2.1, "r_lf2": 1.8}
        b = {"hr": 72, "r_hf": 3.5, "r_lf1": 2.1, "r_lf2": 1.8}
        assert _check_exact_match(a, b) is True

    def test_off_by_one_hr(self):
        a = {"hr": 72, "r_hf": 3.5, "r_lf1": 2.1, "r_lf2": 1.8}
        b = {"hr": 73, "r_hf": 3.5, "r_lf1": 2.1, "r_lf2": 1.8}
        assert _check_exact_match(a, b) is False

    def test_off_by_decimal_r_hf(self):
        a = {"hr": 72, "r_hf": 3.5, "r_lf1": 2.1, "r_lf2": 1.8}
        b = {"hr": 72, "r_hf": 3.6, "r_lf1": 2.1, "r_lf2": 1.8}
        assert _check_exact_match(a, b) is False

    def test_off_by_decimal_r_lf1(self):
        a = {"hr": 72, "r_hf": 3.5, "r_lf1": 2.1, "r_lf2": 1.8}
        b = {"hr": 72, "r_hf": 3.5, "r_lf1": 2.2, "r_lf2": 1.8}
        assert _check_exact_match(a, b) is False

    def test_missing_key_in_a(self):
        a = {"hr": 72, "r_hf": 3.5, "r_lf1": 2.1}
        b = {"hr": 72, "r_hf": 3.5, "r_lf1": 2.1, "r_lf2": 1.8}
        assert _check_exact_match(a, b) is False

    def test_missing_key_in_b(self):
        a = {"hr": 72, "r_hf": 3.5, "r_lf1": 2.1, "r_lf2": 1.8}
        b = {"hr": 72, "r_hf": 3.5, "r_lf1": 2.1}
        assert _check_exact_match(a, b) is False

    def test_none_value_in_a(self):
        a = {"hr": None, "r_hf": 3.5, "r_lf1": 2.1, "r_lf2": 1.8}
        b = {"hr": 72, "r_hf": 3.5, "r_lf1": 2.1, "r_lf2": 1.8}
        assert _check_exact_match(a, b) is False

    def test_both_empty(self):
        assert _check_exact_match({}, {}) is False

    def test_integer_and_float_same_value(self):
        """72 == 72.0 in Python, should match."""
        a = {"hr": 72, "r_hf": 3.5, "r_lf1": 2.1, "r_lf2": 1.8}
        b = {"hr": 72.0, "r_hf": 3.5, "r_lf1": 2.1, "r_lf2": 1.8}
        assert _check_exact_match(a, b) is True


# ============================================================================
# _coerce_float()
# ============================================================================


class TestCoerceFloat:
    def test_int(self):
        assert _coerce_float(5) == 5.0

    def test_float(self):
        assert _coerce_float(3.14) == 3.14

    def test_string_numeric(self):
        assert _coerce_float("6.47") == 6.47

    def test_string_non_numeric(self):
        assert _coerce_float("high") is None

    def test_none(self):
        assert _coerce_float(None) is None

    def test_empty_string(self):
        assert _coerce_float("") is None


# ============================================================================
# _normalize_bundle() — full integration
# ============================================================================


class TestNormalizeBundle:
    """Test the full normalization pipeline with realistic data."""

    def test_ua_urobilinogen_positive_via_status(self):
        """Explicit positive status should set urobilinogen_positive=True."""
        bundle = _normalize_bundle({
            "urinalysis": {
                "urobilinogen": {"value": "2+", "status": "positive"},
            }
        })
        assert bundle["ua"]["urobilinogen_positive"] is True

    def test_ua_urobilinogen_normal_value_is_negative(self):
        """'0.2' (standard reference) with 'normal' status should be negative (FIXED)."""
        bundle = _normalize_bundle({
            "urinalysis": {
                "urobilinogen": {"value": "0.2", "status": "normal"},
            }
        })
        assert bundle["ua"]["urobilinogen_positive"] is False

    def test_ua_urobilinogen_word_normal_is_negative(self):
        """'Normal' value should be negative."""
        bundle = _normalize_bundle({
            "urinalysis": {
                "urobilinogen": {"value": "Normal", "status": "negative"},
            }
        })
        assert bundle["ua"]["urobilinogen_positive"] is False

    def test_ua_urobilinogen_hallucination_0_2_positive_status(self):
        """THE KEY HALLUCINATION: value='0.2' with status='positive' must not propagate."""
        bundle = _normalize_bundle({
            "urinalysis": {
                "urobilinogen": {"value": "0.2", "status": "positive"},
            }
        })
        assert bundle["ua"]["urobilinogen_positive"] is False

    def test_ua_urobilinogen_hallucination_normal_positive_status(self):
        """Hallucination variant: value='Normal' with status='positive'."""
        bundle = _normalize_bundle({
            "urinalysis": {
                "urobilinogen": {"value": "Normal", "status": "positive"},
            }
        })
        assert bundle["ua"]["urobilinogen_positive"] is False

    def test_ua_urobilinogen_negative(self):
        bundle = _normalize_bundle({
            "urinalysis": {
                "urobilinogen": {"value": "Neg", "status": "negative"},
            }
        })
        assert bundle["ua"]["urobilinogen_positive"] is False

    def test_ua_glucose_normal_is_negative(self):
        """Glucose uses allowlist — '0.2' should NOT be positive."""
        bundle = _normalize_bundle({
            "urinalysis": {
                "glucose": {"value": "0.2", "status": "normal"},
            }
        })
        assert bundle["ua"]["glucose_positive"] is False

    def test_ua_glucose_explicit_positive(self):
        bundle = _normalize_bundle({
            "urinalysis": {
                "glucose": {"value": "2+", "status": "positive"},
            }
        })
        assert bundle["ua"]["glucose_positive"] is True

    def test_ua_bilirubin_positive(self):
        bundle = _normalize_bundle({
            "urinalysis": {
                "bilirubin": {"value": "1+", "status": "positive"},
            }
        })
        assert bundle["ua"]["bilirubin_positive"] is True

    def test_ua_protein_positive(self):
        bundle = _normalize_bundle({
            "urinalysis": {
                "protein": {"value": "Trace", "status": "trace"},
            }
        })
        assert bundle["ua"]["protein_positive"] is True

    def test_ua_ph_extraction(self):
        bundle = _normalize_bundle({
            "urinalysis": {
                "ph": {"value": 6.2, "status": "low"},
            }
        })
        assert bundle["ua"]["ph"] == 6.2

    def test_ua_specific_gravity(self):
        bundle = _normalize_bundle({
            "urinalysis": {
                "specific_gravity": {"value": 1.005, "status": "low"},
            }
        })
        assert bundle["ua"]["specific_gravity"] == 1.005

    def test_valsalva_dots_superimposed(self):
        """Identical values should set valsalva_dots_superimposed=True."""
        bundle = _normalize_bundle({
            "hrv": {
                "system_energy": 5,
                "calm_position": {"pns": -1.0, "sns": 2.0},
            },
            "valsalva": {
                "normal_breathing": {"hr": 72, "r_hf": 3.5, "r_lf1": 2.1, "r_lf2": 1.8},
                "deep_breathing": {"hr": 72, "r_hf": 3.5, "r_lf1": 2.1, "r_lf2": 1.8},
            },
        })
        assert bundle["hrv"]["valsalva_dots_superimposed"] is True

    def test_valsalva_dots_not_superimposed(self):
        """Different values should keep valsalva_dots_superimposed=False."""
        bundle = _normalize_bundle({
            "hrv": {
                "system_energy": 5,
                "calm_position": {"pns": -1.0, "sns": 2.0},
            },
            "valsalva": {
                "normal_breathing": {"hr": 72, "r_hf": 3.5, "r_lf1": 2.1, "r_lf2": 1.8},
                "deep_breathing": {"hr": 74, "r_hf": 4.0, "r_lf1": 2.3, "r_lf2": 2.0},
            },
        })
        assert bundle["hrv"]["valsalva_dots_superimposed"] is False

    def test_ortho_dots_superimposed(self):
        """Identical supine/upright values should set ortho_dots_superimposed=True."""
        bundle = _normalize_bundle({
            "hrv": {
                "system_energy": 5,
                "calm_position": {"pns": -1.0, "sns": 2.0},
            },
            "ortho": {
                "supine": {"hr": 65, "r_hf": 4.0, "r_lf1": 3.0, "r_lf2": 2.5},
                "upright": {"hr": 65, "r_hf": 4.0, "r_lf1": 3.0, "r_lf2": 2.5},
            },
        })
        assert bundle["hrv"]["ortho_dots_superimposed"] is True

    def test_ortho_dots_not_superimposed(self):
        bundle = _normalize_bundle({
            "hrv": {
                "system_energy": 5,
                "calm_position": {"pns": -1.0, "sns": 2.0},
            },
            "ortho": {
                "supine": {"hr": 65, "r_hf": 4.0, "r_lf1": 3.0, "r_lf2": 2.5},
                "upright": {"hr": 80, "r_hf": 2.0, "r_lf1": 4.0, "r_lf2": 3.0},
            },
        })
        assert bundle["hrv"]["ortho_dots_superimposed"] is False

    def test_valsalva_vision_flag_triggers_superimposition(self):
        """Vision-reported dots_superimposed=True should trigger even if values differ slightly."""
        bundle = _normalize_bundle({
            "hrv": {
                "system_energy": 5,
                "calm_position": {"pns": -1.0, "sns": 2.0},
            },
            "valsalva": {
                "normal_breathing": {"hr": 72, "r_hf": 3.5, "r_lf1": 2.1, "r_lf2": 1.8},
                "deep_breathing": {"hr": 73, "r_hf": 3.5, "r_lf1": 2.1, "r_lf2": 1.8},
                "dots_superimposed": True,
            },
        })
        assert bundle["hrv"]["valsalva_dots_superimposed"] is True

    def test_ortho_vision_flag_triggers_superimposition(self):
        """Vision-reported dots_superimposed=True on Ortho should trigger Locus Coeruleus."""
        bundle = _normalize_bundle({
            "hrv": {
                "system_energy": 5,
                "calm_position": {"pns": -1.0, "sns": 2.0},
            },
            "ortho": {
                "supine": {"hr": 65, "r_hf": 4.0, "r_lf1": 3.0, "r_lf2": 2.5},
                "upright": {"hr": 66, "r_hf": 4.0, "r_lf1": 3.0, "r_lf2": 2.5},
                "dots_superimposed": True,
            },
        })
        assert bundle["hrv"]["ortho_dots_superimposed"] is True

    def test_vision_flag_false_and_values_differ_no_trigger(self):
        """Neither flag nor values match — should NOT trigger."""
        bundle = _normalize_bundle({
            "hrv": {
                "system_energy": 5,
                "calm_position": {"pns": -1.0, "sns": 2.0},
            },
            "valsalva": {
                "normal_breathing": {"hr": 72, "r_hf": 3.5, "r_lf1": 2.1, "r_lf2": 1.8},
                "deep_breathing": {"hr": 80, "r_hf": 5.0, "r_lf1": 3.1, "r_lf2": 2.8},
                "dots_superimposed": False,
            },
        })
        assert bundle["hrv"]["valsalva_dots_superimposed"] is False

    def test_valsalva_without_hrv_no_crash(self):
        """Valsalva superimposition check requires HRV to exist for the flag."""
        bundle = _normalize_bundle({
            "valsalva": {
                "normal_breathing": {"hr": 72, "r_hf": 3.5, "r_lf1": 2.1, "r_lf2": 1.8},
                "deep_breathing": {"hr": 72, "r_hf": 3.5, "r_lf1": 2.1, "r_lf2": 1.8},
            },
        })
        # Should not crash, but HRV not present so no flag to set
        assert "hrv" not in bundle

    def test_hrv_switched_sympathetics_override(self):
        """Lower-left quadrant (both negative) should override switched=True."""
        bundle = _normalize_bundle({
            "hrv": {
                "calm_position": {"pns": -2.0, "sns": -1.5},
                "patterns": {"switched_sympathetics": True},
            }
        })
        assert bundle["hrv"]["switched_sympathetics"] is False

    def test_hrv_switched_sympathetics_valid(self):
        """True switched (SNS positive, PNS negative) should remain True."""
        bundle = _normalize_bundle({
            "hrv": {
                "calm_position": {"pns": -2.0, "sns": 3.0},
                "patterns": {"switched_sympathetics": True},
            }
        })
        assert bundle["hrv"]["switched_sympathetics"] is True

    def test_brainwave_standalone_over_embedded(self):
        """Standalone brainwave extraction takes priority over HRV-embedded."""
        bundle = _normalize_bundle({
            "hrv": {
                "system_energy": 5,
                "brainwave": {"alpha": 10, "theta": 20},
            },
            "brainwave": {"alpha": 15, "theta": 25, "beta": 30, "delta": 10, "gamma": 20},
        })
        assert bundle["brainwave"]["alpha"] == 15
        assert bundle["brainwave"]["theta"] == 25

    def test_dpulse_organ_mapping(self):
        bundle = _normalize_bundle({
            "d_pulse": {
                "stress_index": 55,
                "markers": [
                    {"name": "Heart", "percentage": 42},
                    {"name": "Liver", "percentage": 38},
                ],
            }
        })
        assert bundle["dpulse"]["stress_index"] == 55
        assert len(bundle["dpulse"]["organs"]) == 2
        assert bundle["dpulse"]["organs"][0]["name"] == "Heart"
        assert bundle["dpulse"]["organs"][0]["percentage"] == 42

    def test_blood_panel_markers(self):
        bundle = _normalize_bundle({
            "blood_panel": {
                "markers": [
                    {"name": "Ferritin", "value": 450, "unit": "ng/mL", "status": "high"},
                    {"name": "CRP", "value": 3.2, "unit": "mg/L", "status": "high"},
                ],
            }
        })
        assert len(bundle["labs"]) == 2
        assert bundle["labs"][0]["name"] == "Ferritin"
        assert bundle["labs"][0]["value"] == 450.0

    def test_vcs_standalone(self):
        bundle = _normalize_bundle({
            "vcs": {"passed": False, "score_correct": 20, "score_total": 32},
        })
        assert bundle["vcs"]["passed"] is False
        assert bundle["vcs"]["score_correct"] == 20

    def test_vcs_embedded_in_ua(self):
        bundle = _normalize_bundle({
            "urinalysis": {
                "vcs_score": {"passed": True, "score_correct": 31, "score_total": 32},
            }
        })
        assert bundle["vcs"]["passed"] is True
        assert bundle["vcs"]["score_correct"] == 31

    def test_empty_bundle(self):
        bundle = _normalize_bundle({})
        assert bundle == {}

    def test_normalization_order_independent(self):
        """File-type ordering should NOT affect normalization output.
        Verifies parallelized extraction doesn't degrade quality."""
        # Build the same bundle in two different key orderings
        bundle_a = _normalize_bundle({
            "hrv": {"system_energy": 5, "calm_position": {"pns": -1.0, "sns": 2.0}},
            "urinalysis": {"ph": {"value": 6.2}},
            "valsalva": {
                "normal_breathing": {"hr": 72, "r_hf": 3.5, "r_lf1": 2.1, "r_lf2": 1.8},
                "deep_breathing": {"hr": 72, "r_hf": 3.5, "r_lf1": 2.1, "r_lf2": 1.8},
            },
            "d_pulse": {"stress_index": 55, "markers": [{"name": "Heart", "percentage": 42}]},
        })
        bundle_b = _normalize_bundle({
            "d_pulse": {"stress_index": 55, "markers": [{"name": "Heart", "percentage": 42}]},
            "valsalva": {
                "normal_breathing": {"hr": 72, "r_hf": 3.5, "r_lf1": 2.1, "r_lf2": 1.8},
                "deep_breathing": {"hr": 72, "r_hf": 3.5, "r_lf1": 2.1, "r_lf2": 1.8},
            },
            "urinalysis": {"ph": {"value": 6.2}},
            "hrv": {"system_energy": 5, "calm_position": {"pns": -1.0, "sns": 2.0}},
        })
        assert bundle_a == bundle_b

    def test_ua_uric_acid_from_findings_fallback(self):
        bundle = _normalize_bundle({
            "urinalysis": {
                "findings": ["Uric acid 8.5 mg/dL - high"],
            }
        })
        assert bundle["ua"]["uric_acid"] == 8.5
        assert bundle["ua"]["uric_acid_status"] == "high"
