#!/usr/bin/env python3
"""
Run Claude Opus eval for Patient GG (Gregory Geiger).

Data extracted from:
- Depuls 8-12-25.pdf (organ percentages — ALL in 0-33% red zone)
- HRV In Office Template PDF.pdf (SE=11, SR=7, PNS=-3.0, SNS=1.5, PNS negative, vagus dysfunction)
- Ortho 8-12-25.pdf (Physical Fitness 11/7, ANS assessment, PSNS stable — NOT switched)
- Valsalva 8-12-25.pdf (E/I=1.04, Valsalva=1.32 — E/I low, Valsalva average)
- UA Results 1st Test Results PDF.pdf (pH=5.79, VCS=8/32, Protein=3.0, Uric Acid=300)
- NO bloodwork panel available for this patient
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


def build_patient_gg_bundle() -> DiagnosticBundle:
    """Build DiagnosticBundle from Patient GG's actual diagnostic PDFs."""
    return DiagnosticBundle(
        hrv=HRVData(
            system_energy=11,           # Energetic Debt
            stress_response=7,          # Worst possible
            switched_sympathetics=False, # PSNS is STABLE per Ortho interpretation; SNS NOT switched
            pns_negative=True,          # PNS at -3.0 (negative zone)
            vagus_dysfunction=True,     # Deep breathing shows NEGATIVE changes in PNS, E/I=1.04
            calm_sns=1.5,              # SNS activity from Ortho conclusion
            calm_pns=-3.0,             # PNS activity from Ortho conclusion
        ),
        brainwave=BrainwaveData(
            delta=61,
            theta=18,
            alpha=10,
            beta=7,
            gamma=4,
        ),
        dpulse=DPulseData(
            organs=[
                # GI organs — ALL severely reduced (0-33%)
                DPulseOrgan("Stomach", 1),
                DPulseOrgan("Liver", 7),
                DPulseOrgan("Spleen", 5),
                DPulseOrgan("Gallbladder", 1),
                DPulseOrgan("Pancreas", 5),
                DPulseOrgan("Colon", 3),
                DPulseOrgan("Small Intestine", 5),
                # Functional system organs — ALL severely reduced (0-33%)
                DPulseOrgan("Heart", 1),
                DPulseOrgan("Blood Vessels", 5),
                DPulseOrgan("Lymph Nodes", 5),
                DPulseOrgan("Kidneys", 1),
                DPulseOrgan("Bladder", 1),
                DPulseOrgan("Lungs", 1),
                DPulseOrgan("Brain", 5),
                DPulseOrgan("Thyroid", 5),
                DPulseOrgan("Trachea", 5),
                DPulseOrgan("Reproductive", 5),
            ],
        ),
        ua=UAData(
            ph=5.79,                      # Very acidic (ref 7.0-7.5)
            protein_positive=True,
            protein_value="3.0",           # Flagged
            specific_gravity=1.015,        # Normal range (1.010-1.020)
        ),
        vcs=VCSData(
            score_correct=8,              # Failed (needs 24+)
            score_total=32,
            passed=False,
        ),
        labs=[
            # No LabCorp bloodwork available — only UA strip extras
            LabMarker("Uric Acid (UA strip)", 300, "", "high"),
            LabMarker("Magnesium (UA strip)", 20, "", "high"),
            LabMarker("Ascorbate (UA strip)", 2.8, "", "high"),
        ],
    )


async def main():
    bundle = build_patient_gg_bundle()
    bundle_dict = asdict(bundle)

    print("=" * 70)
    print("RUNNING EVAL FOR PATIENT GG (Gregory Geiger)")
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
    print()

    runner = EvalAgentRunner()
    print("Calling Claude Opus 4.6 eval agent...\n")

    report = await runner.run(bundle_dict, patient_name="Gregory Geiger (GG)")

    # Output the full report as JSON
    report_json = report.model_dump()

    # Save full report
    output_path = os.path.join(os.path.dirname(__file__), "patient-GG-eval-output.json")
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

    # Summary comparison with answer key
    print("=" * 70)
    print("COMPARISON WITH ANSWER KEY")
    print("=" * 70)
    expected_protocols = [
        "Alpha Theta", "PNS Support", "Vagus Support", "Vagus Trauma",
        "CSF Support", "Heart Health", "Biotoxin", "Kidney Repair",
        "Leptin Resist", "Pineal Support", "Pit A Support", "Pars Intermedia"
    ]
    not_expected_protocols = [
        "SNS Balance"
    ]
    expected_supps_day1 = [
        "Cell Synergy", "Pectasol-C", "Serculate", "CoQ10",
        "X-39", "Innovita Vagus Nerve"
    ]
    expected_supps_all = [
        "Cell Synergy", "Pectasol-C", "Serculate", "CoQ10",
        "X-39", "Innovita Vagus Nerve", "D-Ribose", "Kidney Clear"
    ]

    actual_protocols = [fp.protocol_name for fp in report.frequency_phases]
    actual_supps = [s.name for s in report.supplementation]

    print("\nExpected Protocols vs Actual:")
    for p in expected_protocols:
        found = any(p.lower() in ap.lower() for ap in actual_protocols)
        print(f"  {'✓' if found else '✗'} {p}")

    print("\nShould NOT be present:")
    for p in not_expected_protocols:
        found = any(p.lower() in ap.lower() for ap in actual_protocols)
        print(f"  {'✗ WRONG' if found else '✓ Correct'} {p} {'(found!)' if found else '(not found)'}")

    print("\nExpected Day 1 Supplements vs Actual:")
    for s in expected_supps_day1:
        found = any(s.lower() in as_.lower() for as_ in actual_supps)
        print(f"  {'✓' if found else '✗'} {s}")

    print("\nAll Expected Supplements vs Actual:")
    for s in expected_supps_all:
        found = any(s.lower() in as_.lower() for as_ in actual_supps)
        print(f"  {'✓' if found else '✗'} {s}")

    print(f"\nTotal protocols output: {len(actual_protocols)}")
    print(f"Total supplements output: {len(actual_supps)}")
    print(f"Urgency score: {report.urgency.score}")
    print(f"Deal breakers: {len(report.deal_breakers)}")
    for db in report.deal_breakers:
        print(f"  - {db.name}: {db.finding}")

    # Check sequencing: Vagus Support should come BEFORE Vagus Trauma
    vagus_support_idx = None
    vagus_trauma_idx = None
    for i, fp in enumerate(report.frequency_phases):
        if "vagus support" in fp.protocol_name.lower():
            vagus_support_idx = i
        if "vagus trauma" in fp.protocol_name.lower():
            vagus_trauma_idx = i
    print("\nSequencing Check:")
    if vagus_support_idx is not None and vagus_trauma_idx is not None:
        if vagus_support_idx < vagus_trauma_idx:
            print("  ✓ Vagus Support comes before Vagus Trauma")
        else:
            print("  ✗ WRONG: Vagus Trauma before Vagus Support!")
    elif vagus_support_idx is not None:
        print("  ✓ Vagus Support present (Vagus Trauma absent)")
    else:
        print("  ✗ Vagus Support not found")

    # Check SNS Balance is NOT present
    sns_balance_found = any("sns balance" in ap.lower() for ap in actual_protocols)
    if not sns_balance_found:
        print("  ✓ SNS Balance correctly NOT triggered (SNS not switched)")
    else:
        print("  ✗ WRONG: SNS Balance triggered but SNS is NOT switched!")


if __name__ == "__main__":
    asyncio.run(main())
