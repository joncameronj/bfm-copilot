#!/usr/bin/env python3
"""
Run Protocol Engine (production) against ALL 5 Mar2026 patient answer keys.
Reports per-patient and overall accuracy for deal breakers, protocols, and supplements.
"""

import json
import os
import sys
import types
import importlib.util

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "python-agent"))

from app.services.protocol_engine import (
    DiagnosticBundle,
    HRVData,
    BrainwaveData,
    DPulseData,
    DPulseOrgan,
    UAData,
    VCSData,
    LabMarker,
    run_protocol_engine,
)

EVAL_DIR = os.path.dirname(__file__)


def load_bundle_builder(script_path: str, func_name: str):
    """Load a bundle builder function from an eval script, mocking out eval_agent imports."""
    # Create a mock for app.agent.eval_agent so importing doesn't fail
    mock_eval = types.ModuleType("app.agent.eval_agent")
    mock_eval.EvalAgentRunner = None
    sys.modules["app.agent.eval_agent"] = mock_eval
    # Also mock the parent packages that trigger cryptography
    for mod_name in ["app.agent", "app.agent.definitions", "app.agent.definitions.base_agent",
                     "app.agent.system_prompts", "app.services.prompt_service",
                     "app.services.supabase"]:
        if mod_name not in sys.modules:
            sys.modules[mod_name] = types.ModuleType(mod_name)

    spec = importlib.util.spec_from_file_location("_tmp_eval", script_path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return getattr(mod, func_name)


def normalize(name: str) -> str:
    return name.lower().strip().replace("  ", " ")


def fuzzy_match(needle: str, haystack: list[str]) -> bool:
    n = normalize(needle)
    return any(n in normalize(h) for h in haystack)


PATIENTS = [
    ("DH", "run_patient_dh_eval.py", "build_patient_dh_bundle"),
    ("GD", "run_patient_gd_eval.py", "build_patient_gd_bundle"),
    ("GG", "run_patient_gg_eval.py", "build_patient_gg_bundle"),
    ("JW", "test_engine_vs_eval.py", "build_patient_jw_bundle"),
    ("TH", "run_patient_th_eval.py", "build_patient_th_bundle"),
]


def main():
    totals = {"db_hit": 0, "db_total": 0, "proto_hit": 0, "proto_total": 0,
              "fp_hit": 0, "fp_total": 0, "supp_hit": 0, "supp_total": 0}

    for initials, script, func_name in PATIENTS:
        # Load bundle builder (mocking eval_agent to avoid cryptography import)
        mod_path = os.path.join(EVAL_DIR, script)
        builder = load_bundle_builder(mod_path, func_name)
        bundle = builder()

        # Load answer key
        ak_path = os.path.join(EVAL_DIR, "answer-keys", f"patient-{initials}.json")
        with open(ak_path) as f:
            ak = json.load(f)

        # Run engine
        result = run_protocol_engine(bundle)
        engine_protos = [p.name for p in result.protocols]
        engine_supps = [s.name for s in result.supplements]
        engine_dbs = result.deal_breakers_found

        expected_dbs = ak["expected_deal_breakers"]
        expected_protos = ak["expected_protocols"]
        not_expected_protos = ak.get("not_expected_protocols", [])
        expected_supps = ak["expected_supplements"]

        db_hits = sum(1 for d in expected_dbs if fuzzy_match(d, engine_dbs))
        proto_hits = sum(1 for p in expected_protos if fuzzy_match(p, engine_protos))
        fp_count = sum(1 for p in not_expected_protos if fuzzy_match(p, engine_protos))
        supp_hits = sum(1 for s in expected_supps if fuzzy_match(s, engine_supps))

        print(f"\n{'='*70}")
        print(f"Patient {initials}")
        print(f"{'='*70}")
        print(f"  Deal Breakers: {db_hits}/{len(expected_dbs)}")

        # Show missing deal breakers
        missing_dbs = [d for d in expected_dbs if not fuzzy_match(d, engine_dbs)]
        if missing_dbs:
            for d in missing_dbs:
                print(f"    MISSING: {d}")

        print(f"  Protocols:     {proto_hits}/{len(expected_protos)}")

        # Show missing protocols
        missing_protos = [p for p in expected_protos if not fuzzy_match(p, engine_protos)]
        if missing_protos:
            for p in missing_protos:
                print(f"    MISSING: {p}")

        print(f"  False Pos:     {fp_count}/{len(not_expected_protos)}")
        if fp_count > 0:
            for p in not_expected_protos:
                if fuzzy_match(p, engine_protos):
                    print(f"    FALSE POS: {p}")

        print(f"  Supplements:   {supp_hits}/{len(expected_supps)}")
        missing_supps = [s for s in expected_supps if not fuzzy_match(s, engine_supps)]
        if missing_supps:
            for s in missing_supps:
                print(f"    MISSING: {s}")

        print(f"  Engine output: {len(engine_protos)} protos, {len(engine_supps)} supps, {len(engine_dbs)} DBs")

        totals["db_hit"] += db_hits
        totals["db_total"] += len(expected_dbs)
        totals["proto_hit"] += proto_hits
        totals["proto_total"] += len(expected_protos)
        totals["fp_hit"] += fp_count
        totals["fp_total"] += len(not_expected_protos)
        totals["supp_hit"] += supp_hits
        totals["supp_total"] += len(expected_supps)

    # Overall
    print(f"\n{'='*70}")
    print("OVERALL SCORE")
    print(f"{'='*70}")
    db_pct = totals["db_hit"] / totals["db_total"] * 100 if totals["db_total"] else 0
    proto_pct = totals["proto_hit"] / totals["proto_total"] * 100 if totals["proto_total"] else 0
    supp_pct = totals["supp_hit"] / totals["supp_total"] * 100 if totals["supp_total"] else 0
    total_hit = totals["db_hit"] + totals["proto_hit"] + totals["supp_hit"]
    total_possible = totals["db_total"] + totals["proto_total"] + totals["supp_total"]
    overall_pct = total_hit / total_possible * 100 if total_possible else 0

    print(f"  Deal Breakers: {totals['db_hit']}/{totals['db_total']} ({db_pct:.1f}%)")
    print(f"  Protocols:     {totals['proto_hit']}/{totals['proto_total']} ({proto_pct:.1f}%)")
    print(f"  False Pos:     {totals['fp_hit']}/{totals['fp_total']}")
    print(f"  Supplements:   {totals['supp_hit']}/{totals['supp_total']} ({supp_pct:.1f}%)")
    print(f"  OVERALL:       {total_hit}/{total_possible} ({overall_pct:.1f}%)")
    print(f"  Target: ≥85%  {'✓ PASS' if overall_pct >= 85 else '✗ FAIL'}")


if __name__ == "__main__":
    main()
