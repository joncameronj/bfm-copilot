#!/usr/bin/env python3
"""
Compare Protocol Engine (production) vs Eval Agent (AI) vs Answer Key for Patient JW.

This test feeds the same DiagnosticBundle through:
1. Protocol Engine (deterministic Python rules) — production path
2. Eval Agent output (pre-generated JSON from Claude Opus)
3. Answer key (Dr. Rob's expected results)

Then reports differences in protocols, supplements, and deal breakers.
"""

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "python-agent"))

from dataclasses import asdict
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


def build_patient_jw_bundle() -> DiagnosticBundle:
    """Same bundle used in run_patient_jw_eval.py."""
    return DiagnosticBundle(
        hrv=HRVData(
            system_energy=10,
            stress_response=7,
            switched_sympathetics=False,
            pns_negative=True,
            vagus_dysfunction=True,
            calm_sns=-1.0,
            calm_pns=-2.5,
        ),
        brainwave=BrainwaveData(
            delta=47, theta=31, alpha=10, beta=10, gamma=2,
        ),
        dpulse=DPulseData(
            organs=[
                DPulseOrgan("Stomach", 37),
                DPulseOrgan("Liver", 32),
                DPulseOrgan("Spleen", 36),
                DPulseOrgan("Gallbladder", 40),
                DPulseOrgan("Pancreas", 36),
                DPulseOrgan("Colon", 39),
                DPulseOrgan("Small Intestine", 31),
                DPulseOrgan("Heart", 32),
                DPulseOrgan("Blood Vessels", 36),
                DPulseOrgan("Lymph Nodes", 36),
                DPulseOrgan("Kidneys", 30),
                DPulseOrgan("Bladder", 28),
                DPulseOrgan("Lungs", 40),
                DPulseOrgan("Brain", 31),
                DPulseOrgan("Thyroid", 36),
                DPulseOrgan("Trachea", 36),
                DPulseOrgan("Reproductive", 36),
            ],
        ),
        ua=UAData(
            ph=6.43,
            protein_positive=False,
            protein_value="Neg",
            specific_gravity=1.005,
        ),
        vcs=VCSData(
            score_correct=25,
            score_total=32,
            passed=True,
        ),
        labs=[
            LabMarker("Uric Acid (UA strip)", 100, "", "high"),
        ],
    )


def normalize(name: str) -> str:
    """Normalize protocol/supplement name for comparison."""
    return name.lower().strip().replace("  ", " ")


def load_eval_output() -> dict:
    path = os.path.join(os.path.dirname(__file__), "patient-JW-eval-output.json")
    with open(path) as f:
        return json.load(f)


def load_answer_key() -> dict:
    path = os.path.join(os.path.dirname(__file__), "answer-keys", "patient-JW.json")
    with open(path) as f:
        return json.load(f)


def fuzzy_match(needle: str, haystack: list[str]) -> bool:
    """Check if needle is found in any item of haystack (case-insensitive substring)."""
    n = normalize(needle)
    return any(n in normalize(h) for h in haystack)


def main():
    # Run protocol engine
    bundle = build_patient_jw_bundle()
    engine_result = run_protocol_engine(bundle)

    engine_protocols = [p.name for p in engine_result.protocols]
    engine_supplements = [s.name for s in engine_result.supplements]
    engine_deal_breakers = engine_result.deal_breakers_found

    # Load eval agent output
    eval_output = load_eval_output()
    eval_protocols = [fp["protocol_name"] for fp in eval_output["frequency_phases"]]
    eval_supplements = [s["name"] for s in eval_output["supplementation"]]
    eval_deal_breakers = [db["name"] for db in eval_output["deal_breakers"]]

    # Load answer key
    answer_key = load_answer_key()
    expected_protocols = answer_key["expected_protocols"]
    not_expected_protocols = answer_key.get("not_expected_protocols", [])
    expected_supplements = answer_key["expected_supplements"]
    expected_deal_breakers = answer_key["expected_deal_breakers"]
    not_expected_deal_breakers = answer_key.get("not_expected_deal_breakers", [])

    print("=" * 80)
    print("PATIENT JW: Protocol Engine vs Eval Agent vs Answer Key")
    print("=" * 80)

    # ── DEAL BREAKERS ──
    print("\n" + "─" * 80)
    print("DEAL BREAKERS")
    print("─" * 80)
    print(f"\n{'Expected':<40} {'Engine':<15} {'Eval':<15}")
    print("-" * 70)
    for db in expected_deal_breakers:
        in_engine = "✓" if fuzzy_match(db, engine_deal_breakers) else "✗ MISSING"
        in_eval = "✓" if fuzzy_match(db, eval_deal_breakers) else "✗ MISSING"
        print(f"  {db:<38} {in_engine:<15} {in_eval:<15}")

    print(f"\n  Should NOT be deal breakers:")
    for db in not_expected_deal_breakers:
        in_engine = "✓ correct" if not fuzzy_match(db, engine_deal_breakers) else "✗ WRONG"
        in_eval = "✓ correct" if not fuzzy_match(db, eval_deal_breakers) else "✗ WRONG"
        print(f"  {db:<38} {in_engine:<15} {in_eval:<15}")

    # ── PROTOCOLS ──
    print("\n" + "─" * 80)
    print("FREQUENCY PROTOCOLS")
    print("─" * 80)
    print(f"\n{'Expected':<40} {'Engine':<15} {'Eval':<15}")
    print("-" * 70)
    for p in expected_protocols:
        in_engine = "✓" if fuzzy_match(p, engine_protocols) else "✗ MISSING"
        in_eval = "✓" if fuzzy_match(p, eval_protocols) else "✗ MISSING"
        print(f"  {p:<38} {in_engine:<15} {in_eval:<15}")

    print(f"\n  Should NOT be protocols:")
    for p in not_expected_protocols:
        in_engine = "✓ correct" if not fuzzy_match(p, engine_protocols) else "✗ WRONG"
        in_eval = "✓ correct" if not fuzzy_match(p, eval_protocols) else "✗ WRONG"
        print(f"  {p:<38} {in_engine:<15} {in_eval:<15}")

    # ── SUPPLEMENTS ──
    print("\n" + "─" * 80)
    print("SUPPLEMENTS")
    print("─" * 80)
    print(f"\n{'Expected':<40} {'Engine':<15} {'Eval':<15}")
    print("-" * 70)
    for s in expected_supplements:
        in_engine = "✓" if fuzzy_match(s, engine_supplements) else "✗ MISSING"
        in_eval = "✓" if fuzzy_match(s, eval_supplements) else "✗ MISSING"
        print(f"  {s:<38} {in_engine:<15} {in_eval:<15}")

    # ── ENGINE vs EVAL: DIFF ──
    print("\n" + "─" * 80)
    print("PROTOCOL DIFF: Engine-only vs Eval-only")
    print("─" * 80)

    engine_only_protos = [p for p in engine_protocols if not fuzzy_match(p, eval_protocols)]
    eval_only_protos = [p for p in eval_protocols if not fuzzy_match(p, engine_protocols)]

    print(f"\n  Engine has but Eval does NOT ({len(engine_only_protos)}):")
    for p in engine_only_protos:
        priority = next((pr.priority for pr in engine_result.protocols if pr.name == p), "?")
        print(f"    - {p} (priority={priority})")

    print(f"\n  Eval has but Engine does NOT ({len(eval_only_protos)}):")
    for p in eval_only_protos:
        layer = next((fp["phase"] for fp in eval_output["frequency_phases"] if fp["protocol_name"] == p), "?")
        print(f"    - {p} (layer={layer})")

    # ── SUPPLEMENT DIFF ──
    print("\n" + "─" * 80)
    print("SUPPLEMENT DIFF: Engine-only vs Eval-only")
    print("─" * 80)

    engine_only_supps = [s for s in engine_supplements if not fuzzy_match(s, eval_supplements)]
    eval_only_supps = [s for s in eval_supplements if not fuzzy_match(s, engine_supplements)]

    print(f"\n  Engine has but Eval does NOT ({len(engine_only_supps)}):")
    for s in engine_only_supps:
        print(f"    - {s}")

    print(f"\n  Eval has but Engine does NOT ({len(eval_only_supps)}):")
    for s in eval_only_supps:
        print(f"    - {s}")

    # ── FULL LISTS ──
    print("\n" + "─" * 80)
    print("FULL ENGINE OUTPUT")
    print("─" * 80)
    print(f"\n  Deal Breakers ({len(engine_deal_breakers)}):")
    for db in engine_deal_breakers:
        print(f"    - {db}")
    print(f"\n  Protocols ({len(engine_protocols)}):")
    for p in engine_result.protocols:
        print(f"    [P{p.priority}] {p.name} — {p.trigger}")
    print(f"\n  Supplements ({len(engine_supplements)}):")
    for s in engine_result.supplements:
        print(f"    - {s.name} — {s.trigger}")
    print(f"\n  Cross-Correlations ({len(engine_result.cross_correlations)}):")
    for cc in engine_result.cross_correlations:
        print(f"    - {cc}")

    # ── SCORE ──
    print("\n" + "=" * 80)
    print("SCORE SUMMARY")
    print("=" * 80)

    engine_proto_hits = sum(1 for p in expected_protocols if fuzzy_match(p, engine_protocols))
    eval_proto_hits = sum(1 for p in expected_protocols if fuzzy_match(p, eval_protocols))
    engine_supp_hits = sum(1 for s in expected_supplements if fuzzy_match(s, engine_supplements))
    eval_supp_hits = sum(1 for s in expected_supplements if fuzzy_match(s, eval_supplements))
    engine_db_hits = sum(1 for d in expected_deal_breakers if fuzzy_match(d, engine_deal_breakers))
    eval_db_hits = sum(1 for d in expected_deal_breakers if fuzzy_match(d, eval_deal_breakers))

    engine_false_protos = sum(1 for p in not_expected_protocols if fuzzy_match(p, engine_protocols))
    eval_false_protos = sum(1 for p in not_expected_protocols if fuzzy_match(p, eval_protocols))

    print(f"\n  {'Metric':<35} {'Engine':<15} {'Eval':<15}")
    print("  " + "-" * 65)
    print(f"  {'Deal Breakers':<35} {engine_db_hits}/{len(expected_deal_breakers):<13} {eval_db_hits}/{len(expected_deal_breakers):<13}")
    print(f"  {'Expected Protocols':<35} {engine_proto_hits}/{len(expected_protocols):<13} {eval_proto_hits}/{len(expected_protocols):<13}")
    print(f"  {'False Positive Protocols':<35} {engine_false_protos}/{len(not_expected_protocols):<13} {eval_false_protos}/{len(not_expected_protocols):<13}")
    print(f"  {'Expected Supplements':<35} {engine_supp_hits}/{len(expected_supplements):<13} {eval_supp_hits}/{len(expected_supplements):<13}")
    print(f"  {'Total Protocols Output':<35} {len(engine_protocols):<15} {len(eval_protocols):<15}")
    print(f"  {'Total Supplements Output':<35} {len(engine_supplements):<15} {len(eval_supplements):<15}")

    # Agreement between Engine and Eval
    shared_protos = [p for p in engine_protocols if fuzzy_match(p, eval_protocols)]
    print(f"\n  Engine↔Eval Protocol Agreement: {len(shared_protos)} shared out of {len(set(engine_protocols) | set(eval_protocols))} unique")

    shared_supps = [s for s in engine_supplements if fuzzy_match(s, eval_supplements)]
    print(f"  Engine↔Eval Supplement Agreement: {len(shared_supps)} shared out of {len(set(engine_supplements) | set(eval_supplements))} unique")


if __name__ == "__main__":
    main()
