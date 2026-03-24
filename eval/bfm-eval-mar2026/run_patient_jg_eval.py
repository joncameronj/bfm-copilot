#!/usr/bin/env python3
"""
Run Claude Opus eval for Patient JG (Jennifer Giles).

Data extracted from:
- Depuls 3-11-26.pdf (All organs 34-59% yellow zone, Lungs 34% lowest, Stress Index 104)
- HRV In Office Template.pdf (SE=10, SR=5, PNS=-2.0, SNS=1.0, Delta 80%)
- Ortho 3-11-26.pdf (Physical Fitness 10/5, PNS decreased, SNS average/moderate)
- Valsalva 3-11-26.pdf (E/I=1.06 low, Valsalva=1.37 average, vagus underperforming)
- UA Results 1st Test Results.pdf (pH=5.27, Magnesium=15 high, Uric Acid=100, VCS=23/32 FAIL)
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


def build_patient_jg_bundle() -> DiagnosticBundle:
    """Build DiagnosticBundle from Patient JG's actual diagnostic PDFs."""
    return DiagnosticBundle(
        hrv=HRVData(
            system_energy=10,            # Energetic Debt (10-13 range)
            stress_response=5,           # Moderate-poor (1=best, 7=worst)
            switched_sympathetics=False,  # SNS at 1.0, not switched per Ortho
            pns_negative=True,           # PNS at -2.0 (negative PSNS zone)
            vagus_dysfunction=True,      # E/I=1.06 (low <1.3), deep breathing shows negative PNS changes
            calm_sns=1.0,               # SNS activity from Ortho conclusion
            calm_pns=-2.0,              # PNS activity from Ortho conclusion
        ),
        brainwave=BrainwaveData(
            delta=80,                    # Very high delta — deep fatigue/sleep dominance
            theta=9,
            alpha=6,
            beta=3,
            gamma=2,
        ),
        dpulse=DPulseData(
            stress_index=104,            # Slightly elevated (norm 10-100)
            vegetative_balance=166,      # Elevated (norm 35-140)
            brain_activity=32,           # Reduced (norm 66-100%)
            immunity=47,                 # Reduced (norm 66-100%)
            physiological_resources=150, # Borderline low (norm 150-600)
            organs=[
                # GI organs — all in yellow zone (34-65%)
                DPulseOrgan("Stomach", 47),
                DPulseOrgan("Liver", 40),
                DPulseOrgan("Spleen", 59),
                DPulseOrgan("Gallbladder", 38),
                DPulseOrgan("Pancreas", 59),
                DPulseOrgan("Colon", 49),
                DPulseOrgan("Small Intestine", 54),
                # Functional system organs — yellow zone
                DPulseOrgan("Heart", 52),
                DPulseOrgan("Blood Vessels", 59),
                DPulseOrgan("Lymph Nodes", 59),
                DPulseOrgan("Kidneys", 41),
                DPulseOrgan("Bladder", 48),
                DPulseOrgan("Lungs", 34),         # Lowest organ
                DPulseOrgan("Brain", 39),
                DPulseOrgan("Thyroid", 59),
                DPulseOrgan("Trachea", 59),
                DPulseOrgan("Reproductive", 59),
            ],
        ),
        ua=UAData(
            ph=5.27,                      # Very acidic (ref 7.0-7.5), flagged
            protein_positive=False,       # Negative
            protein_value="Neg",
            specific_gravity=1.015,       # Normal range
            glucose_positive=False,       # Not flagged on UA
        ),
        vcs=VCSData(
            score_correct=23,             # Failed (needs 24+)
            score_total=32,
            passed=False,
        ),
        labs=[
            # No bloodwork for this patient — only in-office UA extras
            LabMarker("Uric Acid (UA strip)", 100, "", "high"),
            LabMarker("Magnesium (UA strip)", 15, "", "high"),
        ],
    )


async def main():
    bundle = build_patient_jg_bundle()
    bundle_dict = asdict(bundle)

    print("=" * 70)
    print("RUNNING EVAL FOR PATIENT JG (Jennifer Giles)")
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
    print(f"Glucose Positive (UA): {bundle.ua.glucose_positive}")
    print()

    # Key clinical flags
    print("KEY CLINICAL FLAGS:")
    print(f"  - Energetic Debt (SE=10, SR=5)")
    print(f"  - PNS negative at -2.0 (parasympathetic suppressed)")
    print(f"  - Vagus dysfunction (E/I=1.06, deep breathing worsens PNS)")
    print(f"  - Delta 80% (extreme fatigue/sleep dominance)")
    print(f"  - All organs yellow zone (34-59%), Lungs lowest at 34%")
    print(f"  - Brain activity 32%, Immunity 47%")
    print(f"  - VCS FAIL 23/32 (biotoxin)")
    print(f"  - pH 5.27 (severely acidic)")
    print(f"  - Uric Acid 100 (5x normal)")
    print(f"  - Magnesium 15 (elevated on UA strip)")
    print(f"  - Physical Fitness Level 10/5")
    print()

    runner = EvalAgentRunner()
    print("Calling Claude Opus 4.6 eval agent...\n")

    report = await runner.run(bundle_dict, patient_name="Jennifer Giles (JG)")

    # Output the full report as JSON
    report_json = report.model_dump()

    # Save full report
    output_path = os.path.join(os.path.dirname(__file__), "patient-JG-eval-output.json")
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

    # Print deal breakers
    print("=" * 70)
    print("DEAL BREAKERS")
    print("=" * 70)
    for db in report.deal_breakers:
        print(f"  - {db.name}: {db.finding}")
        print(f"    Protocols: {', '.join(db.protocols_triggered)}")
    print()

    # Print urgency
    print(f"Urgency score: {report.urgency.score}")
    print(f"Urgency rationale: {report.urgency.rationale}")
    print()

    # Print cross-correlations
    if report.cross_correlations:
        print("=" * 70)
        print("CROSS-CORRELATIONS")
        print("=" * 70)
        for cc in report.cross_correlations:
            print(f"  - {cc.finding}")
            print(f"    Clinical significance: {cc.clinical_significance}")
            print()

    print(f"\nTotal protocols output: {len(report.frequency_phases)}")
    print(f"Total supplements output: {len(report.supplementation)}")
    print(f"Deal breakers: {len(report.deal_breakers)}")


if __name__ == "__main__":
    asyncio.run(main())
