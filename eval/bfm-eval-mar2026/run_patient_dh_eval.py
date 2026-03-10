#!/usr/bin/env python3
"""
Run Claude Opus eval for Patient DH (Denis Hiestand).

Data extracted from:
- DePulse 11-11-25.pdf (organ percentages)
- HRV In Office Template PDF.pdf (SE=11, SR=7, SNS switched, PNS negative, vagus dysfunction)
- Ortho 11-11-25.pdf (Physical Fitness 11/7, ANS assessment)
- Valsalva 11-11-25.pdf (E/I=1.01, Valsalva=1.24 — both low)
- UA Results 1st Test Results PDF.pdf (pH=5.08, VCS=2/32, Uric Acid=700, etc.)
- HIESTAND-DENIS-11_19_2025.pdf (LabCorp bloodwork)
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


def build_patient_dh_bundle() -> DiagnosticBundle:
    """Build DiagnosticBundle from Patient DH's actual diagnostic PDFs."""
    return DiagnosticBundle(
        hrv=HRVData(
            system_energy=11,         # Energetic Debt
            stress_response=7,        # Worst possible
            switched_sympathetics=True,  # "THE PSNS PORTION OF THE ANS IS SWITCHED" + upper-left quadrant plot
            pns_negative=True,        # PNS at -3.5 (negative zone)
            vagus_dysfunction=True,   # Deep breathing shows NO PNS improvement, E/I=1.01, Valsalva=1.24
            calm_sns=1.5,             # SNS activity from Ortho conclusion
            calm_pns=-3.5,            # PNS activity from Ortho conclusion
        ),
        brainwave=BrainwaveData(
            delta=80,
            theta=12,
            alpha=4,
            beta=2,
            gamma=1,
        ),
        dpulse=DPulseData(
            organs=[
                # GI organs
                DPulseOrgan("Stomach", 20),
                DPulseOrgan("Liver", 14),
                DPulseOrgan("Spleen", 6),
                DPulseOrgan("Gallbladder", 10),
                DPulseOrgan("Pancreas", 6),
                DPulseOrgan("Colon", 16),
                DPulseOrgan("Small Intestine", 8),
                # Functional system organs
                DPulseOrgan("Heart", 2),
                DPulseOrgan("Blood Vessels", 6),
                DPulseOrgan("Lymph Nodes", 6),
                DPulseOrgan("Kidneys", 9),
                DPulseOrgan("Bladder", 3),
                DPulseOrgan("Lungs", 14),
                DPulseOrgan("Brain", 6),
                DPulseOrgan("Thyroid", 6),
                DPulseOrgan("Trachea", 6),
                DPulseOrgan("Reproductive", 6),
            ],
        ),
        ua=UAData(
            ph=5.08,                    # Very acidic (ref 7.0-7.5)
            protein_positive=True,
            protein_value="1.0",
            specific_gravity=1.025,     # High (ref 1.010-1.020)
        ),
        vcs=VCSData(
            score_correct=2,            # Severely failed
            score_total=32,
            passed=False,
        ),
        labs=[
            # Metabolic
            LabMarker("Glucose", 91, "mg/dL", "normal"),
            LabMarker("HbA1c", 5.5, "%", "normal"),
            LabMarker("Uric Acid", 4.8, "mg/dL", "normal"),  # LabCorp value (UA strip was 700)
            # Renal
            LabMarker("BUN", 20, "mg/dL", "normal"),
            LabMarker("Creatinine", 1.32, "mg/dL", "high"),
            LabMarker("eGFR", 56, "mL/min/1.73", "low"),     # CKD Stage 3a
            LabMarker("BUN/Creatinine Ratio", 15, "", "normal"),
            # Iron/Ferritin
            LabMarker("Ferritin", 389, "ng/mL", "normal"),   # Within range but high-end
            LabMarker("Iron", 69, "ug/dL", "normal"),
            LabMarker("Iron Saturation", 26, "%", "normal"),
            LabMarker("TIBC", 262, "ug/dL", "normal"),
            # Lipids
            LabMarker("Cholesterol", 286, "mg/dL", "high"),
            LabMarker("Triglycerides", 175, "mg/dL", "high"),
            LabMarker("HDL", 38, "mg/dL", "low"),
            LabMarker("LDL", 214, "mg/dL", "high"),
            # Inflammation
            LabMarker("CRP", 15.89, "mg/L", "high"),         # Very elevated (ref 0-3.00)
            LabMarker("Homocysteine", 18.4, "umol/L", "normal"),  # In range 0-19.2 but elevated
            # Thyroid
            LabMarker("TSH", 0.964, "uIU/mL", "normal"),
            LabMarker("Thyroxine T4", 7.6, "ug/dL", "normal"),
            LabMarker("T3 Uptake", 33, "%", "normal"),
            LabMarker("Free Thyroxine Index", 2.5, "", "normal"),
            LabMarker("T3 Total", 85, "ng/dL", "normal"),
            LabMarker("Free T3", 2.5, "pg/mL", "normal"),
            LabMarker("Reverse T3", 31.4, "ng/dL", "high"),  # Very high (ref 9.2-24.1)
            LabMarker("Free T4", 1.50, "ng/dL", "normal"),
            LabMarker("TPO Antibody", 16, "IU/mL", "normal"),
            LabMarker("Thyroglobulin Antibody", 1.0, "IU/mL", "normal"),
            # Vitamin D
            LabMarker("Vitamin D", 41.9, "ng/mL", "normal"),  # Adequate but suboptimal
            # Liver
            LabMarker("AST", 14, "IU/L", "normal"),
            LabMarker("ALT", 9, "IU/L", "normal"),
            LabMarker("GGT", 16, "IU/L", "normal"),
            LabMarker("Alkaline Phosphatase", 76, "IU/L", "normal"),
            LabMarker("Bilirubin", 0.5, "mg/dL", "normal"),
            LabMarker("LDH", 172, "IU/L", "normal"),
            # Minerals
            LabMarker("Copper", 112, "ug/dL", "normal"),
            LabMarker("Zinc", 67, "ug/dL", "normal"),
            LabMarker("Ceruloplasmin", 31.3, "mg/dL", "high"),
            # SARS-CoV-2 Spike
            LabMarker("SARS-CoV-2 Spike Ab", 11050, "U/mL", "high"),
            # CBC highlights
            LabMarker("Hematocrit", 51.3, "%", "high"),
            LabMarker("Fibrinogen", 479, "mg/dL", "normal"),
            # In-office UA extras (from UA strip)
            LabMarker("Uric Acid (UA strip)", 700, "", "high"),
            LabMarker("Ketone (UA strip)", 4.0, "Mod", "high"),
        ],
    )


async def main():
    bundle = build_patient_dh_bundle()
    bundle_dict = asdict(bundle)

    print("=" * 70)
    print("RUNNING EVAL FOR PATIENT DH (Denis Hiestand)")
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

    report = await runner.run(bundle_dict, patient_name="Denis Hiestand (DH)")

    # Output the full report as JSON
    report_json = report.model_dump()

    # Save full report
    output_path = os.path.join(os.path.dirname(__file__), "patient-DH-eval-output.json")
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
        "SNS Balance", "Alpha Theta", "PNS Support", "Vagus Support",
        "Heart Health", "Terrain", "Biotoxin", "Kidney Repair",
        "Mito Leak", "Virus Recovery", "Ferritin Lower", "Aldehyde Detox",
        "Pit A Support", "Pars Intermedia", "Leptin Resist", "Pineal Support"
    ]
    expected_supps_day1 = [
        "Cell Synergy", "Tri-Salts", "Pectasol-C", "Serculate", "CoQ10", "X-39"
    ]
    expected_supps_week = [
        "Vitamin D", "IP6 Gold", "Homocysteine Factor", "Adipothin"
    ]

    actual_protocols = [fp.protocol_name for fp in report.frequency_phases]
    actual_supps = [s.name for s in report.supplementation]

    print("\nExpected Protocols vs Actual:")
    for p in expected_protocols:
        found = any(p.lower() in ap.lower() for ap in actual_protocols)
        print(f"  {'✓' if found else '✗'} {p}")

    print("\nExpected Day 1 Supplements vs Actual:")
    for s in expected_supps_day1:
        found = any(s.lower() in as_.lower() for as_ in actual_supps)
        print(f"  {'✓' if found else '✗'} {s}")

    print("\nExpected Week 1-2 Supplements vs Actual:")
    for s in expected_supps_week:
        found = any(s.lower() in as_.lower() for as_ in actual_supps)
        print(f"  {'✓' if found else '✗'} {s}")

    print(f"\nTotal protocols output: {len(actual_protocols)}")
    print(f"Total supplements output: {len(actual_supps)}")
    print(f"Urgency score: {report.urgency.score}")
    print(f"Deal breakers: {len(report.deal_breakers)}")
    for db in report.deal_breakers:
        print(f"  - {db.name}: {db.finding}")


if __name__ == "__main__":
    asyncio.run(main())
