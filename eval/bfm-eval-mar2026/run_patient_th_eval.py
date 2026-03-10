#!/usr/bin/env python3
"""
Run Claude Opus eval for Patient TH (Tim Haskins).

Data extracted from:
- Depuls 2-3-26.pdf (ALL organs 1-11% — severely depleted, Heart at 1%)
- HRV In Office Template.pdf (SE=11, SR=7, PNS=-4.0, SNS=2.5, Delta 56%)
- Ortho 2-3-26.pdf (Physical Fitness 11/7, PSNS BLOCKED, SNS SWITCHED)
- Valsalva 2-3-26.pdf (E/I=1.02, Valsalva=1.42 — E/I critically low, vagus dysfunction)
- UA Results 1st Test Results.pdf (pH=5.43, VCS=12/32 FAIL, Uric Acid=100)
- HASKINS-TIM-02_10_2026.pdf (LabCorp — CKD Stage 3a, eGFR=50, A1c=9.6%, CRP=3.01,
  Homocysteine=17.6, AST=57, LDH=258, BUN=29, Creatinine=1.64, HDL=37 low,
  Glucose=151, Phosphorus=4.3 high, CO2=20 low, Vitamin D=37.3)
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


def build_patient_th_bundle() -> DiagnosticBundle:
    """Build DiagnosticBundle from Patient TH's actual diagnostic PDFs."""
    return DiagnosticBundle(
        hrv=HRVData(
            system_energy=11,           # Energetic Debt (10-13 range)
            stress_response=7,          # Worst possible
            switched_sympathetics=True,  # "THE SNS PORTION OF THE ANS IS SWITCHED" per Ortho interpretation
            pns_negative=True,          # PNS at -4.0 (deeply negative, PSNS BLOCKED)
            vagus_dysfunction=True,     # Deep breathing shows NO improvement in PNS, E/I=1.02
            calm_sns=2.5,              # SNS activity from Ortho conclusion
            calm_pns=-4.0,             # PNS activity from Ortho conclusion (BLOCKED)
        ),
        brainwave=BrainwaveData(
            delta=56,
            theta=31,
            alpha=8,
            beta=3,
            gamma=2,
        ),
        dpulse=DPulseData(
            stress_index=673,            # Extremely high (norm 10-100)
            vegetative_balance=915,      # Extremely high (norm 35-140)
            brain_activity=5,            # Severely reduced
            immunity=7,                  # Severely reduced
            physiological_resources=34,  # Severely reduced (norm 150-600)
            organs=[
                # GI organs — ALL severely reduced (0-33% red zone)
                DPulseOrgan("Stomach", 10),
                DPulseOrgan("Liver", 5),
                DPulseOrgan("Spleen", 7),
                DPulseOrgan("Gallbladder", 8),
                DPulseOrgan("Pancreas", 7),
                DPulseOrgan("Colon", 7),
                DPulseOrgan("Small Intestine", 9),
                # Functional system organs — ALL severely reduced
                DPulseOrgan("Heart", 1),        # Critical — lowest possible
                DPulseOrgan("Blood Vessels", 7),
                DPulseOrgan("Lymph Nodes", 7),
                DPulseOrgan("Kidneys", 8),
                DPulseOrgan("Bladder", 11),
                DPulseOrgan("Lungs", 8),
                DPulseOrgan("Brain", 9),
                DPulseOrgan("Thyroid", 7),
                DPulseOrgan("Trachea", 7),
                DPulseOrgan("Reproductive", 7),
            ],
        ),
        ua=UAData(
            ph=5.43,                      # Very acidic (ref 7.0-7.5) — worse than typical
            protein_positive=False,       # Negative on in-office UA
            protein_value="Neg",
            specific_gravity=1.015,       # Normal range
            glucose_positive=True,        # 3+ Glucose on LabCorp UA — diabetic spillover
        ),
        vcs=VCSData(
            score_correct=12,             # Failed (needs 24+)
            score_total=32,
            passed=False,
        ),
        labs=[
            # LabCorp Bloodwork (02/10/2026) — comprehensive panel
            # Metabolic / Diabetes
            LabMarker("Glucose", 151, "mg/dL", "high"),
            LabMarker("Hemoglobin A1c", 9.6, "%", "high"),
            LabMarker("Insulin", 7.7, "uIU/mL", "normal"),

            # Kidney function — CKD Stage 3a
            LabMarker("BUN", 29, "mg/dL", "high"),
            LabMarker("Creatinine", 1.64, "mg/dL", "high"),
            LabMarker("eGFR", 50, "mL/min/1.73", "low"),
            LabMarker("Phosphorus", 4.3, "mg/dL", "high"),

            # Liver
            LabMarker("AST (SGOT)", 57, "IU/L", "high"),
            LabMarker("ALT (SGPT)", 44, "IU/L", "normal"),
            LabMarker("LDH", 258, "IU/L", "high"),
            LabMarker("Alkaline Phosphatase", 51, "IU/L", "normal"),
            LabMarker("GGT", 25, "IU/L", "normal"),
            LabMarker("Bilirubin, Total", 0.4, "mg/dL", "normal"),

            # Lipids
            LabMarker("Cholesterol, Total", 146, "mg/dL", "normal"),
            LabMarker("Triglycerides", 117, "mg/dL", "normal"),
            LabMarker("HDL Cholesterol", 37, "mg/dL", "low"),
            LabMarker("LDL Cholesterol", 88, "mg/dL", "normal"),
            LabMarker("VLDL Cholesterol", 21, "mg/dL", "normal"),

            # Inflammatory / Cardiovascular
            LabMarker("C-Reactive Protein, Cardiac", 3.01, "mg/L", "high"),
            LabMarker("Homocysteine", 17.6, "umol/L", "high"),
            LabMarker("Fibrinogen", 341, "mg/dL", "normal"),

            # Thyroid
            LabMarker("TSH", 2.090, "uIU/mL", "normal"),
            LabMarker("T4, Free", 1.37, "ng/dL", "normal"),
            LabMarker("T3, Free", 2.7, "pg/mL", "normal"),
            LabMarker("Reverse T3", 15.7, "ng/dL", "normal"),
            LabMarker("T3", 91, "ng/dL", "normal"),
            LabMarker("TPO Antibody", 16, "IU/mL", "normal"),

            # Vitamins / Minerals
            LabMarker("Vitamin D, 25-Hydroxy", 37.3, "ng/mL", "normal"),
            LabMarker("Magnesium", 2.1, "mg/dL", "normal"),
            LabMarker("Iron", 97, "ug/dL", "normal"),
            LabMarker("Ferritin", 369, "ng/mL", "normal"),
            LabMarker("Iron Saturation", 28, "%", "normal"),

            # Electrolytes
            LabMarker("Sodium", 139, "mmol/L", "normal"),
            LabMarker("Potassium", 3.9, "mmol/L", "normal"),
            LabMarker("Chloride", 101, "mmol/L", "normal"),
            LabMarker("Carbon Dioxide", 20, "mmol/L", "normal"),
            LabMarker("Calcium", 9.8, "mg/dL", "normal"),
            LabMarker("Uric Acid", 8.2, "mg/dL", "normal"),

            # CBC
            LabMarker("WBC", 6.2, "x10E3/uL", "normal"),
            LabMarker("RBC", 5.39, "x10E6/uL", "normal"),
            LabMarker("Hemoglobin", 16.2, "g/dL", "normal"),
            LabMarker("Hematocrit", 48.8, "%", "normal"),
            LabMarker("Platelets", 216, "x10E3/uL", "normal"),

            # In-office UA extras
            LabMarker("Uric Acid (UA strip)", 100, "", "high"),
        ],
    )


async def main():
    bundle = build_patient_th_bundle()
    bundle_dict = asdict(bundle)

    print("=" * 70)
    print("RUNNING EVAL FOR PATIENT TH (Tim Haskins)")
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
    print(f"  - CKD Stage 3a (eGFR=50, Creatinine=1.64, BUN=29)")
    print(f"  - Uncontrolled Diabetes (A1c=9.6%, Glucose=151, Urine Glucose 3+)")
    print(f"  - Cardiovascular inflammation (CRP=3.01, Homocysteine=17.6)")
    print(f"  - Liver stress (AST=57, LDH=258)")
    print(f"  - Heart at 1% on DePuls")
    print(f"  - VCS FAIL 12/32 (biotoxin)")
    print(f"  - pH 5.43 (severely acidic)")
    print(f"  - SNS SWITCHED, PSNS BLOCKED at -4.0")
    print()

    runner = EvalAgentRunner()
    print("Calling Claude Opus 4.6 eval agent...\n")

    report = await runner.run(bundle_dict, patient_name="Tim Haskins (TH)")

    # Output the full report as JSON
    report_json = report.model_dump()

    # Save full report
    output_path = os.path.join(os.path.dirname(__file__), "patient-TH-eval-output.json")
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
