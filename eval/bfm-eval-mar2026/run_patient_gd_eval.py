#!/usr/bin/env python3
"""
Run Claude Opus eval for Patient GD (Geraldine DeMartino).

Data extracted from:
- depuls5-2-24.pdf (ALL organs at 1%, stress index 1876, brain 0%, immunity 0%)
- HRV In Office Template PDF.pdf (SE=13, SR=1, PNS=-4.0, SNS=1.5, Beta-dominant brainwave)
- ortho 5-2-24.pdf (Physical Fitness 13/1, PNS sharply decreased, single extrasystoles)
- valsalva 5-2-24.pdf (E/I=1.01 low, Valsalva=2.02 athletic, trigeminy+bigeminy+extrasystoles)
- UA Results 1st Test -PDF.pdf (pH=4.89, VCS=3/32, Uric Acid=300, SG=1.025)
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


def build_patient_gd_bundle() -> DiagnosticBundle:
    """Build DiagnosticBundle from Patient GD's actual diagnostic PDFs."""
    return DiagnosticBundle(
        hrv=HRVData(
            system_energy=13,           # Maximum energetic debt (worst)
            stress_response=1,          # Best stress response
            switched_sympathetics=False, # NOT switched — per answer key, more vagus pattern
            pns_negative=True,          # PNS at -4.0 (deeply negative)
            vagus_dysfunction=True,     # E/I=1.01 (very low <1.3), deep breathing barely helps PNS
            calm_sns=1.5,              # SNS activity from Ortho conclusion
            calm_pns=-4.0,             # PNS activity from Ortho conclusion
        ),
        brainwave=BrainwaveData(
            delta=1,
            theta=7,
            alpha=18,
            beta=50,     # Beta dominant — deal breaker (Beta > Alpha)
            gamma=24,
        ),
        dpulse=DPulseData(
            organs=[
                # GI organs — ALL at 1%
                DPulseOrgan("Stomach", 1),
                DPulseOrgan("Liver", 1),
                DPulseOrgan("Spleen", 1),
                DPulseOrgan("Gallbladder", 1),
                DPulseOrgan("Pancreas", 1),
                DPulseOrgan("Colon", 1),
                DPulseOrgan("Small Intestine", 1),
                # Functional system organs — ALL at 1%
                DPulseOrgan("Heart", 1),
                DPulseOrgan("Blood Vessels", 1),
                DPulseOrgan("Lymph Nodes", 1),
                DPulseOrgan("Kidneys", 1),
                DPulseOrgan("Bladder", 1),
                DPulseOrgan("Lungs", 1),
                DPulseOrgan("Brain", 1),
                DPulseOrgan("Thyroid", 1),
                DPulseOrgan("Trachea", 1),
                DPulseOrgan("Reproductive", 1),
            ],
        ),
        ua=UAData(
            ph=4.89,                    # Extremely acidic (ref 7.0-7.5)
            protein_positive=False,
            protein_value="Neg",
            specific_gravity=1.025,     # High (ref 1.010-1.020)
        ),
        vcs=VCSData(
            score_correct=3,            # Severely failed (need 24+ to pass)
            score_total=32,
            passed=False,
        ),
        labs=[
            # No LabCorp bloodwork available for this patient
            # Only in-office UA strip results
            LabMarker("Uric Acid (UA strip)", 300, "", "high"),
            LabMarker("Zinc (UA strip)", 0.5, "", "high"),
            LabMarker("Ascorbate (UA strip)", 0.6, "", "high"),
        ],
    )


async def main():
    bundle = build_patient_gd_bundle()
    bundle_dict = asdict(bundle)

    print("=" * 70)
    print("RUNNING EVAL FOR PATIENT GD (Geraldine DeMartino)")
    print("=" * 70)
    print(f"\nBundle size: {len(json.dumps(bundle_dict))} chars")
    print(f"Organs: {len(bundle.dpulse.organs)}")
    print(f"Labs: {len(bundle.labs)}")
    print(f"VCS: {bundle.vcs.score_correct}/{bundle.vcs.score_total} ({'PASS' if bundle.vcs.passed else 'FAIL'})")
    print(f"pH: {bundle.ua.ph}")
    print(f"HRV: SE={bundle.hrv.system_energy}, SR={bundle.hrv.stress_response}")
    print(f"SNS Switched: {bundle.hrv.switched_sympathetics}")
    print(f"PNS Negative: {bundle.hrv.pns_negative}")
    print(f"Vagus Dysfunction: {bundle.hrv.vagus_dysfunction}")
    print(f"Brainwave: D={bundle.brainwave.delta} T={bundle.brainwave.theta} A={bundle.brainwave.alpha} B={bundle.brainwave.beta} G={bundle.brainwave.gamma}")
    print()

    runner = EvalAgentRunner()
    print("Calling Claude Opus 4.6 eval agent...\n")

    report = await runner.run(bundle_dict, patient_name="Geraldine DeMartino (GD)")

    # Output the full report as JSON
    report_json = report.model_dump()

    # Save full report
    output_path = os.path.join(os.path.dirname(__file__), "patient-GD-eval-output.json")
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
    answer_key_path = os.path.join(os.path.dirname(__file__), "answer-keys", "patient-GD.json")
    with open(answer_key_path) as f:
        answer_key = json.load(f)

    # Summary comparison with answer key
    print("=" * 70)
    print("COMPARISON WITH ANSWER KEY")
    print("=" * 70)

    expected_protocols = answer_key["expected_protocols"]
    expected_supps_day1 = answer_key["expected_supplements_day1"]
    expected_supps = answer_key["expected_supplements"]
    expected_deal_breakers = answer_key["expected_deal_breakers"]
    not_expected_deal_breakers = answer_key.get("not_expected_deal_breakers", [])
    do_not_recommend = answer_key.get("do_not_recommend", [])

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

    print("\nExpected Day 1 Supplements vs Actual:")
    for s in expected_supps_day1:
        found = any(s.lower() in as_.lower() for as_ in actual_supps)
        print(f"  {'✓' if found else '✗'} {s}")

    print("\nExpected Supplements (all) vs Actual:")
    for s in expected_supps:
        found = any(s.lower() in as_.lower() for as_ in actual_supps)
        print(f"  {'✓' if found else '✗'} {s}")

    print("\nDo NOT Recommend (should be absent):")
    for s in do_not_recommend:
        name = s.split("(")[0].strip()
        found = any(name.lower() in as_.lower() for as_ in actual_supps)
        print(f"  {'✓ (correct)' if not found else '✗ (INCORRECTLY recommended)'} {s}")

    print(f"\nTotal protocols output: {len(actual_protocols)}")
    print(f"Total supplements output: {len(actual_supps)}")
    print(f"Urgency score: {report.urgency.score}")
    print(f"Expected min urgency: {answer_key['urgency_min']}")
    print(f"Deal breakers found: {len(report.deal_breakers)}")
    for db in report.deal_breakers:
        print(f"  - {db.name}: {db.finding}")


if __name__ == "__main__":
    asyncio.run(main())
