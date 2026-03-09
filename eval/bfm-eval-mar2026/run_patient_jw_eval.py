#!/usr/bin/env python3
"""
Run Claude Opus eval for Patient JW (Jennifer Weber).

Data extracted from:
- Depuls 2-24-26.pdf (all organs 28-43%, stress index 173, brain 27%, immunity 42%)
- HRV In Office Template.pdf (SE=10, SR=7, lower-left quadrant: SNS=-1.0, PNS=-2.5)
- Ortho 2-24-26.pdf (Physical Fitness 10/7, PNS decreased significantly, single extrasystoles)
- Valsalva 2-24-26.pdf (E/I=1.07, Valsalva=1.29 — both low, no PNS improvement w/ deep breathing)
- UA Results 1st Test Results.pdf (pH=6.43, VCS=25/32 PASS, SG=1.005 LOW, Uric Acid=100)
"""

import asyncio
import json
import os
import sys

# Add python-agent to path
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
)
from app.agent.eval_agent import EvalAgentRunner


def build_patient_jw_bundle() -> DiagnosticBundle:
    """Build DiagnosticBundle from Patient JW's actual diagnostic PDFs."""
    return DiagnosticBundle(
        hrv=HRVData(
            system_energy=10,            # Energetic Debt
            stress_response=7,           # Worst possible
            switched_sympathetics=False, # NOT switched — lower-left quadrant (both depleted)
            pns_negative=True,           # PNS at -2.5 (negative zone)
            vagus_dysfunction=True,      # E/I=1.07, Valsalva=1.29, deep breathing shows NO PNS improvement
            calm_sns=-1.0,              # SNS activity from Ortho conclusion (moderate decrease)
            calm_pns=-2.5,             # PNS activity from Ortho conclusion (significant decrease)
        ),
        brainwave=BrainwaveData(
            delta=47,
            theta=31,
            alpha=10,
            beta=10,
            gamma=2,
        ),
        dpulse=DPulseData(
            organs=[
                # GI organs
                DPulseOrgan("Stomach", 37),
                DPulseOrgan("Liver", 32),
                DPulseOrgan("Spleen", 36),
                DPulseOrgan("Gallbladder", 40),
                DPulseOrgan("Pancreas", 36),
                DPulseOrgan("Colon", 39),
                DPulseOrgan("Small Intestine", 31),
                # Functional system organs
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
            ph=6.43,                     # Acidic (ref 7.0-7.5)
            protein_positive=False,
            protein_value="Neg",
            specific_gravity=1.005,      # LOW (ref 1.010-1.020) — triggers Deuterium Drops
        ),
        vcs=VCSData(
            score_correct=25,            # Passing (need 24+)
            score_total=32,
            passed=True,
        ),
        labs=[
            # No LabCorp bloodwork available for this patient
            # Only in-office UA strip results
            LabMarker("Uric Acid (UA strip)", 100, "", "high"),
        ],
    )


async def main():
    bundle = build_patient_jw_bundle()
    bundle_dict = asdict(bundle)

    print("=" * 70)
    print("RUNNING EVAL FOR PATIENT JW (Jennifer Weber)")
    print("=" * 70)
    print(f"\nBundle size: {len(json.dumps(bundle_dict))} chars")
    print(f"Organs: {len(bundle.dpulse.organs)}")
    print(f"Labs: {len(bundle.labs)}")
    print(f"VCS: {bundle.vcs.score_correct}/{bundle.vcs.score_total} ({'PASS' if bundle.vcs.passed else 'FAIL'})")
    print(f"pH: {bundle.ua.ph}")
    print(f"Specific Gravity: {bundle.ua.specific_gravity}")
    print(f"HRV: SE={bundle.hrv.system_energy}, SR={bundle.hrv.stress_response}")
    print(f"SNS Switched: {bundle.hrv.switched_sympathetics}")
    print(f"PNS Negative: {bundle.hrv.pns_negative}")
    print(f"Vagus Dysfunction: {bundle.hrv.vagus_dysfunction}")
    print(f"Calm SNS: {bundle.hrv.calm_sns}, Calm PNS: {bundle.hrv.calm_pns}")
    print(f"Brainwave: D={bundle.brainwave.delta} T={bundle.brainwave.theta} A={bundle.brainwave.alpha} B={bundle.brainwave.beta} G={bundle.brainwave.gamma}")
    print()

    runner = EvalAgentRunner()
    print("Calling Claude Opus 4.6 eval agent...\n")

    report = await runner.run(bundle_dict, patient_name="Jennifer Weber (JW)")

    # Output the full report as JSON
    report_json = report.model_dump()

    # Save full report
    output_path = os.path.join(os.path.dirname(__file__), "patient-JW-eval-output.json")
    with open(output_path, "w") as f:
        json.dump(report_json, f, indent=2)
    print(f"\nFull report saved to: {output_path}\n")

    # Print focused output: frequencies and supplements
    print("=" * 70)
    print("FREQUENCY PROTOCOLS")
    print("=" * 70)
    for fp in report.frequency_phases:
        layer = f"[Layer {fp.phase}] {fp.layer_label}" if fp.layer_label else f"[Phase {fp.phase}]"
        print(f"  {layer}: {fp.protocol_name}")
        print(f"    Trigger: {fp.trigger}")
        print(f"    Citation: {fp.patient_data_citation}")
        if fp.sequencing_note:
            print(f"    Sequencing: {fp.sequencing_note}")
        print()

    print("=" * 70)
    print("SUPPLEMENTS")
    print("=" * 70)
    for supp in report.supplementation:
        layer_str = f"[Layer {supp.layer}]" if supp.layer else "[Unassigned]"
        print(f"  {layer_str} {supp.name} (priority={supp.priority})")
        print(f"    Trigger: {supp.trigger}")
        if supp.dosage:
            print(f"    Dosage: {supp.dosage}")
        if supp.timing:
            print(f"    Timing: {supp.timing}")
        print(f"    Citation: {supp.patient_data_citation}")
        print()

    # Load answer key for comparison
    answer_key_path = os.path.join(os.path.dirname(__file__), "answer-keys", "patient-JW.json")
    with open(answer_key_path) as f:
        answer_key = json.load(f)

    # Summary comparison with answer key
    print("=" * 70)
    print("COMPARISON WITH ANSWER KEY")
    print("=" * 70)

    expected_protocols = answer_key["expected_protocols"]
    not_expected_protocols = answer_key.get("not_expected_protocols", [])
    expected_supps_day1 = answer_key["expected_supplements_day1"]
    expected_supps = answer_key["expected_supplements"]
    expected_deal_breakers = answer_key["expected_deal_breakers"]
    not_expected_deal_breakers = answer_key.get("not_expected_deal_breakers", [])

    actual_protocols = [fp.protocol_name for fp in report.frequency_phases]
    actual_supps = [s.name for s in report.supplementation]
    actual_deal_breakers = [db.name for db in report.deal_breakers]

    print("\nExpected Deal Breakers:")
    for db in expected_deal_breakers:
        found = any(db.lower() in adb.lower() for adb in actual_deal_breakers)
        print(f"  {'✓' if found else '✗'} {db}")

    print("\nShould NOT be Deal Breakers:")
    for db in not_expected_deal_breakers:
        found = any(db.lower() in adb.lower() for adb in actual_deal_breakers)
        print(f"  {'✓ (correct)' if not found else '✗ (INCORRECTLY flagged)'} {db}")

    print("\nExpected Protocols vs Actual:")
    for p in expected_protocols:
        found = any(p.lower() in ap.lower() for ap in actual_protocols)
        print(f"  {'✓' if found else '✗'} {p}")

    print("\nShould NOT be Protocols:")
    for p in not_expected_protocols:
        found = any(p.lower() in ap.lower() for ap in actual_protocols)
        print(f"  {'✓ (correct)' if not found else '✗ (INCORRECTLY recommended)'} {p}")

    print("\nExpected Day 1 Supplements vs Actual:")
    for s in expected_supps_day1:
        found = any(s.lower() in as_.lower() for as_ in actual_supps)
        print(f"  {'✓' if found else '✗'} {s}")

    print("\nExpected Supplements (all) vs Actual:")
    for s in expected_supps:
        found = any(s.lower() in as_.lower() for as_ in actual_supps)
        print(f"  {'✓' if found else '✗'} {s}")

    print(f"\nTotal protocols output: {len(actual_protocols)}")
    print(f"Total supplements output: {len(actual_supps)}")
    print(f"Urgency score: {report.urgency.score}")
    print(f"Expected urgency range: {answer_key['urgency_min']}-{answer_key['urgency_max']}")
    print(f"Deal breakers found: {len(report.deal_breakers)}")
    for db in report.deal_breakers:
        print(f"  - {db.name}: {db.finding}")


if __name__ == "__main__":
    asyncio.run(main())
