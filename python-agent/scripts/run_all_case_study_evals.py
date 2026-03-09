#!/usr/bin/env python3
"""
Run the BFM Protocol Engine against ALL 20 case studies.

Builds a DiagnosticBundle for each case study from manually extracted
diagnostic values (HRV, D-Pulse, UA/VCS), runs the protocol engine,
and outputs a comprehensive markdown report.

Categories: Hormones (5), Diabetes (5), Neurological (5), Thyroid (5)
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

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


def build_hormones_cs1() -> DiagnosticBundle:
    """Hormones CS1: SE 8, SR 5, Sacrum 22% RED, VCS 19/32 FAIL."""
    return DiagnosticBundle(
        hrv=HRVData(
            system_energy=8,
            stress_response=5,
            switched_sympathetics=False,
            pns_negative=True,
            vagus_dysfunction=False,
        ),
        brainwave=BrainwaveData(alpha=11, beta=19, delta=37, gamma=9, theta=24),
        dpulse=DPulseData(
            stress_index=144,
            vegetative_balance=253,
            physiological_resources=179,
            organs=[
                DPulseOrgan("Heart", 56),
                DPulseOrgan("Lungs", 35),
                DPulseOrgan("Liver", 48),
                DPulseOrgan("Kidneys", 45),
                DPulseOrgan("Sacrum", 22),
                DPulseOrgan("Stomach", 42),
                DPulseOrgan("Spleen", 40),
                DPulseOrgan("Colon", 38),
                DPulseOrgan("Small Intestine", 36),
                DPulseOrgan("Thoracic", 40),
                DPulseOrgan("Cervical", 44),
                DPulseOrgan("Lumbar", 35),
                DPulseOrgan("Bladder", 40),
                DPulseOrgan("Thyroid", 42),
                DPulseOrgan("Brain", 38),
                DPulseOrgan("Reproductive", 38),
            ],
        ),
        ua=UAData(ph=7.0, protein_positive=False),
        vcs=VCSData(score_correct=19, score_total=32, passed=False),
    )


def build_hormones_cs2() -> DiagnosticBundle:
    """Hormones CS2: SE 6, SR 3, all D-Pulse ~100%, VCS 31/32."""
    return DiagnosticBundle(
        hrv=HRVData(
            system_energy=6,
            stress_response=3,
            switched_sympathetics=True,
            pns_negative=False,
            vagus_dysfunction=False,
        ),
        brainwave=BrainwaveData(alpha=7, beta=23, delta=5, gamma=42, theta=12),
        dpulse=DPulseData(
            stress_index=33,
            vegetative_balance=24,
            physiological_resources=504,
            organs=[
                DPulseOrgan("Heart", 100),
                DPulseOrgan("Lungs", 100),
                DPulseOrgan("Liver", 100),
                DPulseOrgan("Kidneys", 100),
                DPulseOrgan("Sacrum", 100),
                DPulseOrgan("Stomach", 100),
                DPulseOrgan("Spleen", 100),
                DPulseOrgan("Colon", 100),
                DPulseOrgan("Small Intestine", 100),
                DPulseOrgan("Thoracic", 100),
                DPulseOrgan("Cervical", 100),
                DPulseOrgan("Lumbar", 100),
                DPulseOrgan("Bladder", 100),
                DPulseOrgan("Thyroid", 100),
                DPulseOrgan("Brain", 100),
                DPulseOrgan("Reproductive", 100),
            ],
        ),
        ua=UAData(ph=6.47, protein_positive=True, protein_value="15"),
        vcs=VCSData(score_correct=31, score_total=32, passed=True),
    )


def build_hormones_cs3() -> DiagnosticBundle:
    """Hormones CS3: SE 10, SR 6, catastrophic D-Pulse, Nitrite positive."""
    return DiagnosticBundle(
        hrv=HRVData(
            system_energy=10,
            stress_response=6,
            switched_sympathetics=False,
            pns_negative=True,
            vagus_dysfunction=True,
        ),
        brainwave=BrainwaveData(alpha=30, beta=33, delta=17, gamma=11, theta=9),
        dpulse=DPulseData(
            stress_index=477,
            vegetative_balance=687,
            physiological_resources=72,
            organs=[
                DPulseOrgan("Heart", 5),
                DPulseOrgan("Lungs", 15),
                DPulseOrgan("Liver", 10),
                DPulseOrgan("Kidneys", 12),
                DPulseOrgan("Sacrum", 5),
                DPulseOrgan("Stomach", 8),
                DPulseOrgan("Spleen", 6),
                DPulseOrgan("Colon", 10),
                DPulseOrgan("Small Intestine", 20),
                DPulseOrgan("Thoracic", 9),
                DPulseOrgan("Cervical", 12),
                DPulseOrgan("Lumbar", 8),
                DPulseOrgan("Bladder", 10),
                DPulseOrgan("Thyroid", 8),
                DPulseOrgan("Brain", 7),
                DPulseOrgan("Reproductive", 6),
            ],
        ),
        ua=UAData(
            ph=6.02,
            protein_positive=True,
            protein_value="Trace",
            specific_gravity=1.030,
        ),
        vcs=None,  # Did Not Record
        labs=[
            LabMarker(name="Leukocytes", value=15, unit="WBC/uL", status="high"),
            LabMarker(name="Nitrite", value=1, status="high"),
            LabMarker(name="Ketones", value=50, unit="mg/dL", status="high"),
        ],
    )


def build_hormones_cs4() -> DiagnosticBundle:
    """Hormones CS4: SE 12, SR 7, ALL D-Pulse single digits, VCS 11/32 FAIL."""
    return DiagnosticBundle(
        hrv=HRVData(
            system_energy=12,
            stress_response=7,
            switched_sympathetics=False,
            pns_negative=True,
            vagus_dysfunction=True,
        ),
        brainwave=BrainwaveData(alpha=6, beta=3, delta=59, gamma=1, theta=31),
        dpulse=DPulseData(
            stress_index=844,
            vegetative_balance=1012,
            physiological_resources=22,
            organs=[
                DPulseOrgan("Heart", 1),
                DPulseOrgan("Lungs", 1),
                DPulseOrgan("Liver", 8),
                DPulseOrgan("Kidneys", 3),
                DPulseOrgan("Sacrum", 3),
                DPulseOrgan("Stomach", 2),
                DPulseOrgan("Spleen", 2),
                DPulseOrgan("Colon", 4),
                DPulseOrgan("Small Intestine", 14),
                DPulseOrgan("Thoracic", 2),
                DPulseOrgan("Cervical", 5),
                DPulseOrgan("Lumbar", 4),
                DPulseOrgan("Bladder", 3),
                DPulseOrgan("Thyroid", 2),
                DPulseOrgan("Brain", 2),
                DPulseOrgan("Reproductive", 3),
            ],
        ),
        ua=UAData(ph=6.01, protein_positive=False),
        vcs=VCSData(score_correct=11, score_total=32, passed=False),
        labs=[
            LabMarker(name="Uric Acid", value=100, unit="mg/dL", status="high"),
            LabMarker(name="Bilirubin", value=17, unit="umol/L", status="high"),
        ],
    )


def build_hormones_cs5() -> DiagnosticBundle:
    """Hormones CS5: SE 13, SR 1, ALL D-Pulse 1%, complete system failure."""
    return DiagnosticBundle(
        hrv=HRVData(
            system_energy=13,
            stress_response=1,
            switched_sympathetics=False,
            pns_negative=True,
            vagus_dysfunction=True,
        ),
        brainwave=BrainwaveData(alpha=18, beta=50, delta=1, gamma=24, theta=7),
        dpulse=DPulseData(
            stress_index=1876,
            vegetative_balance=3752,
            physiological_resources=4,
            organs=[
                DPulseOrgan("Heart", 1),
                DPulseOrgan("Lungs", 1),
                DPulseOrgan("Liver", 1),
                DPulseOrgan("Kidneys", 1),
                DPulseOrgan("Sacrum", 1),
                DPulseOrgan("Stomach", 1),
                DPulseOrgan("Spleen", 1),
                DPulseOrgan("Colon", 1),
                DPulseOrgan("Small Intestine", 1),
                DPulseOrgan("Thoracic", 1),
                DPulseOrgan("Cervical", 1),
                DPulseOrgan("Lumbar", 1),
                DPulseOrgan("Bladder", 1),
                DPulseOrgan("Thyroid", 1),
                DPulseOrgan("Brain", 1),
                DPulseOrgan("Reproductive", 1),
            ],
        ),
        ua=UAData(ph=4.89, protein_positive=False, specific_gravity=1.030),
        vcs=VCSData(score_correct=3, score_total=32, passed=False),
        labs=[
            LabMarker(name="Uric Acid", value=300, unit="mg/dL", status="high"),
            LabMarker(name="Bilirubin", value=17, unit="umol/L", status="high"),
            LabMarker(name="Salinity", value=300, status="high"),
        ],
    )


def build_diabetes_cs1() -> DiagnosticBundle:
    """Diabetes CS1: SE 9, SR 5, Heart 16% RED, Blood Moderate 80, VCS 21/32 FAIL."""
    return DiagnosticBundle(
        hrv=HRVData(
            system_energy=9,
            stress_response=5,
            switched_sympathetics=False,
            pns_negative=True,
            vagus_dysfunction=False,
        ),
        brainwave=BrainwaveData(alpha=10, beta=4, delta=72, gamma=1, theta=13),
        dpulse=DPulseData(
            stress_index=200,
            vegetative_balance=300,
            physiological_resources=96,
            organs=[
                DPulseOrgan("Heart", 16),
                DPulseOrgan("Lungs", 25),
                DPulseOrgan("Liver", 30),
                DPulseOrgan("Kidneys", 20),
                DPulseOrgan("Sacrum", 18),
                DPulseOrgan("Stomach", 22),
                DPulseOrgan("Spleen", 20),
                DPulseOrgan("Colon", 25),
                DPulseOrgan("Small Intestine", 28),
                DPulseOrgan("Thoracic", 20),
                DPulseOrgan("Cervical", 22),
                DPulseOrgan("Lumbar", 18),
                DPulseOrgan("Bladder", 20),
                DPulseOrgan("Thyroid", 22),
                DPulseOrgan("Brain", 18),
                DPulseOrgan("Reproductive", 20),
            ],
        ),
        ua=UAData(ph=7.0, protein_positive=True, protein_value="Trace"),
        vcs=VCSData(score_correct=21, score_total=32, passed=False),
        labs=[
            LabMarker(name="Blood", value=80, unit="RBC/uL", status="high"),
        ],
    )


def build_diabetes_cs2() -> DiagnosticBundle:
    """Diabetes CS2: SE 13, SR 7, nearly all RED, Heavy Metals Mercury/Nickel."""
    return DiagnosticBundle(
        hrv=HRVData(
            system_energy=13,
            stress_response=7,
            switched_sympathetics=False,
            pns_negative=True,
            vagus_dysfunction=True,
        ),
        brainwave=BrainwaveData(alpha=12, beta=16, delta=51, gamma=8, theta=13),
        dpulse=DPulseData(
            stress_index=400,
            vegetative_balance=500,
            physiological_resources=84,
            organs=[
                DPulseOrgan("Heart", 14),
                DPulseOrgan("Lungs", 18),
                DPulseOrgan("Liver", 20),
                DPulseOrgan("Kidneys", 10),
                DPulseOrgan("Sacrum", 2),
                DPulseOrgan("Stomach", 15),
                DPulseOrgan("Spleen", 12),
                DPulseOrgan("Colon", 18),
                DPulseOrgan("Small Intestine", 22),
                DPulseOrgan("Thoracic", 7),
                DPulseOrgan("Cervical", 15),
                DPulseOrgan("Lumbar", 10),
                DPulseOrgan("Bladder", 12),
                DPulseOrgan("Thyroid", 14),
                DPulseOrgan("Brain", 10),
                DPulseOrgan("Reproductive", 12),
            ],
        ),
        ua=UAData(
            ph=6.0,
            protein_positive=False,
            heavy_metals=["Mercury", "Nickel"],
        ),
        vcs=VCSData(score_correct=31, score_total=32, passed=True),
    )


def build_diabetes_cs3() -> DiagnosticBundle:
    """Diabetes CS3: SE 10, SR 6, mostly YELLOW, Bilirubin, VCS 32/32."""
    return DiagnosticBundle(
        hrv=HRVData(
            system_energy=10,
            stress_response=6,
            switched_sympathetics=False,
            pns_negative=True,
            vagus_dysfunction=False,
        ),
        brainwave=BrainwaveData(alpha=13, beta=21, delta=28, gamma=15, theta=22),
        dpulse=DPulseData(
            stress_index=180,
            vegetative_balance=250,
            physiological_resources=152,
            organs=[
                DPulseOrgan("Heart", 53),
                DPulseOrgan("Lungs", 45),
                DPulseOrgan("Liver", 48),
                DPulseOrgan("Kidneys", 42),
                DPulseOrgan("Sacrum", 38),
                DPulseOrgan("Stomach", 40),
                DPulseOrgan("Spleen", 42),
                DPulseOrgan("Colon", 45),
                DPulseOrgan("Small Intestine", 48),
                DPulseOrgan("Thoracic", 40),
                DPulseOrgan("Cervical", 42),
                DPulseOrgan("Lumbar", 38),
                DPulseOrgan("Bladder", 40),
                DPulseOrgan("Thyroid", 42),
                DPulseOrgan("Brain", 38),
                DPulseOrgan("Reproductive", 40),
            ],
        ),
        ua=UAData(
            ph=5.48,
            protein_positive=True,
            protein_value="Trace",
            specific_gravity=1.030,
        ),
        vcs=VCSData(score_correct=32, score_total=32, passed=True),
        labs=[
            LabMarker(name="Bilirubin", value=17, unit="umol/L", status="high"),
        ],
    )


def build_diabetes_cs4() -> DiagnosticBundle:
    """Diabetes CS4: SE 12, SR 7, Heart 26%, Kidneys 16%, VCS 28/32."""
    return DiagnosticBundle(
        hrv=HRVData(
            system_energy=12,
            stress_response=7,
            switched_sympathetics=True,
            pns_negative=True,
            vagus_dysfunction=True,
        ),
        brainwave=BrainwaveData(alpha=8, beta=15, delta=10, gamma=8, theta=16),
        dpulse=DPulseData(
            stress_index=300,
            vegetative_balance=400,
            physiological_resources=80,
            organs=[
                DPulseOrgan("Heart", 26),
                DPulseOrgan("Lungs", 30),
                DPulseOrgan("Liver", 35),
                DPulseOrgan("Kidneys", 16),
                DPulseOrgan("Sacrum", 20),
                DPulseOrgan("Stomach", 28),
                DPulseOrgan("Spleen", 25),
                DPulseOrgan("Colon", 30),
                DPulseOrgan("Small Intestine", 32),
                DPulseOrgan("Thoracic", 22),
                DPulseOrgan("Cervical", 25),
                DPulseOrgan("Lumbar", 20),
                DPulseOrgan("Bladder", 22),
                DPulseOrgan("Thyroid", 25),
                DPulseOrgan("Brain", 20),
                DPulseOrgan("Reproductive", 22),
            ],
        ),
        ua=UAData(ph=6.27, protein_positive=True, protein_value="5"),
        vcs=VCSData(score_correct=28, score_total=32, passed=True),
    )


def build_diabetes_cs5() -> DiagnosticBundle:
    """Diabetes CS5: SE 12, SR 7, nearly all RED, Glucose 110, VCS 24/32."""
    return DiagnosticBundle(
        hrv=HRVData(
            system_energy=12,
            stress_response=7,
            switched_sympathetics=False,
            pns_negative=True,
            vagus_dysfunction=True,
        ),
        brainwave=BrainwaveData(alpha=7, beta=1, delta=42, gamma=1, theta=48),
        dpulse=DPulseData(
            stress_index=350,
            vegetative_balance=450,
            physiological_resources=52,
            organs=[
                DPulseOrgan("Heart", 1),
                DPulseOrgan("Lungs", 5),
                DPulseOrgan("Liver", 8),
                DPulseOrgan("Kidneys", 3),
                DPulseOrgan("Sacrum", 2),
                DPulseOrgan("Stomach", 4),
                DPulseOrgan("Spleen", 3),
                DPulseOrgan("Colon", 6),
                DPulseOrgan("Small Intestine", 4),
                DPulseOrgan("Thoracic", 3),
                DPulseOrgan("Cervical", 5),
                DPulseOrgan("Lumbar", 3),
                DPulseOrgan("Bladder", 4),
                DPulseOrgan("Thyroid", 3),
                DPulseOrgan("Brain", 2),
                DPulseOrgan("Reproductive", 3),
            ],
        ),
        ua=UAData(ph=6.0, protein_positive=True, protein_value="Trace"),
        vcs=VCSData(score_correct=24, score_total=32, passed=True),
        labs=[
            LabMarker(name="Glucose", value=110, unit="mg/dL", status="high"),
            LabMarker(name="Urobilinogen", value=1, status="high"),
        ],
    )


def build_neuro_cs1() -> DiagnosticBundle:
    """Neuro CS1: SE 9, SR 3, Heart 22% RED, Liver 31% RED, Heavy Metals Copper."""
    return DiagnosticBundle(
        hrv=HRVData(
            system_energy=9,
            stress_response=3,
            switched_sympathetics=False,
            pns_negative=False,
            vagus_dysfunction=False,
        ),
        brainwave=BrainwaveData(alpha=4, beta=5, delta=79, gamma=2, theta=9),
        dpulse=DPulseData(
            stress_index=200,
            vegetative_balance=280,
            physiological_resources=116,
            organs=[
                DPulseOrgan("Heart", 22),
                DPulseOrgan("Lungs", 35),
                DPulseOrgan("Liver", 31),
                DPulseOrgan("Kidneys", 40),
                DPulseOrgan("Sacrum", 35),
                DPulseOrgan("Stomach", 38),
                DPulseOrgan("Spleen", 35),
                DPulseOrgan("Colon", 40),
                DPulseOrgan("Small Intestine", 42),
                DPulseOrgan("Thoracic", 35),
                DPulseOrgan("Cervical", 38),
                DPulseOrgan("Lumbar", 32),
                DPulseOrgan("Bladder", 35),
                DPulseOrgan("Thyroid", 38),
                DPulseOrgan("Brain", 30),
                DPulseOrgan("Reproductive", 35),
            ],
        ),
        ua=UAData(
            ph=7.45,
            protein_positive=True,
            protein_value="15",
            heavy_metals=["Copper"],
        ),
        vcs=VCSData(score_correct=28, score_total=32, passed=True),
    )


def build_neuro_cs2() -> DiagnosticBundle:
    """Neuro CS2: SE 8, SR 5, no RED, Protein 100!, Heavy Metals Cadmium."""
    return DiagnosticBundle(
        hrv=HRVData(
            system_energy=8,
            stress_response=5,
            switched_sympathetics=False,
            pns_negative=False,
            vagus_dysfunction=False,
        ),
        brainwave=BrainwaveData(alpha=38, beta=10, delta=31, gamma=7, theta=14),
        dpulse=DPulseData(
            stress_index=150,
            vegetative_balance=200,
            physiological_resources=183,
            organs=[
                DPulseOrgan("Heart", 44),
                DPulseOrgan("Lungs", 48),
                DPulseOrgan("Liver", 50),
                DPulseOrgan("Kidneys", 45),
                DPulseOrgan("Sacrum", 42),
                DPulseOrgan("Stomach", 46),
                DPulseOrgan("Spleen", 44),
                DPulseOrgan("Colon", 48),
                DPulseOrgan("Small Intestine", 50),
                DPulseOrgan("Thoracic", 42),
                DPulseOrgan("Cervical", 45),
                DPulseOrgan("Lumbar", 40),
                DPulseOrgan("Bladder", 42),
                DPulseOrgan("Thyroid", 45),
                DPulseOrgan("Brain", 40),
                DPulseOrgan("Reproductive", 42),
            ],
        ),
        ua=UAData(
            ph=6.4,
            protein_positive=True,
            protein_value="100",
            heavy_metals=["Cadmium"],
        ),
        vcs=VCSData(score_correct=26, score_total=32, passed=True),
    )


def build_neuro_cs3() -> DiagnosticBundle:
    """Neuro CS3: SE 11, SR 5, ALL catastrophic single digits, Heavy Metals Copper."""
    return DiagnosticBundle(
        hrv=HRVData(
            system_energy=11,
            stress_response=5,
            switched_sympathetics=False,
            pns_negative=True,
            vagus_dysfunction=True,
        ),
        brainwave=BrainwaveData(alpha=3, beta=1, delta=67, gamma=1, theta=28),
        dpulse=DPulseData(
            stress_index=600,
            vegetative_balance=800,
            physiological_resources=15,
            organs=[
                DPulseOrgan("Heart", 2),
                DPulseOrgan("Lungs", 5),
                DPulseOrgan("Liver", 4),
                DPulseOrgan("Kidneys", 3),
                DPulseOrgan("Sacrum", 1),
                DPulseOrgan("Stomach", 3),
                DPulseOrgan("Spleen", 2),
                DPulseOrgan("Colon", 4),
                DPulseOrgan("Small Intestine", 6),
                DPulseOrgan("Thoracic", 2),
                DPulseOrgan("Cervical", 4),
                DPulseOrgan("Lumbar", 2),
                DPulseOrgan("Bladder", 3),
                DPulseOrgan("Thyroid", 2),
                DPulseOrgan("Brain", 1),
                DPulseOrgan("Reproductive", 2),
            ],
        ),
        ua=UAData(
            ph=6.0,
            protein_positive=True,
            protein_value="15",
            heavy_metals=["Copper"],
        ),
        vcs=None,  # No VCS recorded
    )


def build_neuro_cs4() -> DiagnosticBundle:
    """Neuro CS4: SE 11, SR 6, nearly all RED, Heavy Metals Zinc/Copper/Cadmium."""
    return DiagnosticBundle(
        hrv=HRVData(
            system_energy=11,
            stress_response=6,
            switched_sympathetics=False,
            pns_negative=True,
            vagus_dysfunction=True,
        ),
        brainwave=BrainwaveData(alpha=11, beta=6, delta=52, gamma=8, theta=24),
        dpulse=DPulseData(
            stress_index=350,
            vegetative_balance=450,
            physiological_resources=45,
            organs=[
                DPulseOrgan("Heart", 5),
                DPulseOrgan("Lungs", 10),
                DPulseOrgan("Liver", 12),
                DPulseOrgan("Kidneys", 8),
                DPulseOrgan("Sacrum", 1),
                DPulseOrgan("Stomach", 7),
                DPulseOrgan("Spleen", 5),
                DPulseOrgan("Colon", 10),
                DPulseOrgan("Small Intestine", 15),
                DPulseOrgan("Thoracic", 5),
                DPulseOrgan("Cervical", 8),
                DPulseOrgan("Lumbar", 5),
                DPulseOrgan("Bladder", 6),
                DPulseOrgan("Thyroid", 5),
                DPulseOrgan("Brain", 4),
                DPulseOrgan("Reproductive", 5),
            ],
        ),
        ua=UAData(
            ph=6.99,
            protein_positive=True,
            protein_value="15",
            heavy_metals=["Zinc", "Copper", "Cadmium"],
        ),
        vcs=VCSData(score_correct=24, score_total=32, passed=True),
        labs=[
            LabMarker(name="Blood", value=5, unit="RBC/uL", status="high"),
            LabMarker(name="Ketones", value=5, unit="mg/dL", status="high"),
        ],
    )


def build_neuro_cs5() -> DiagnosticBundle:
    """Neuro CS5: SE 6, SR 5, all 80-100%, pH 8.54, VCS 21/32 FAIL."""
    return DiagnosticBundle(
        hrv=HRVData(
            system_energy=6,
            stress_response=5,
            switched_sympathetics=False,
            pns_negative=False,
            vagus_dysfunction=False,
        ),
        brainwave=BrainwaveData(alpha=25, beta=21, delta=31, gamma=8, theta=15),
        dpulse=DPulseData(
            stress_index=50,
            vegetative_balance=60,
            physiological_resources=400,
            organs=[
                DPulseOrgan("Heart", 95),
                DPulseOrgan("Lungs", 90),
                DPulseOrgan("Liver", 88),
                DPulseOrgan("Kidneys", 85),
                DPulseOrgan("Sacrum", 82),
                DPulseOrgan("Stomach", 88),
                DPulseOrgan("Spleen", 85),
                DPulseOrgan("Colon", 90),
                DPulseOrgan("Small Intestine", 92),
                DPulseOrgan("Thoracic", 85),
                DPulseOrgan("Cervical", 88),
                DPulseOrgan("Lumbar", 80),
                DPulseOrgan("Bladder", 82),
                DPulseOrgan("Thyroid", 88),
                DPulseOrgan("Brain", 85),
                DPulseOrgan("Reproductive", 82),
            ],
        ),
        ua=UAData(
            ph=8.54,
            protein_positive=True,
            protein_value="15",
            heavy_metals=["Cadmium", "Copper"],
        ),
        vcs=VCSData(score_correct=21, score_total=32, passed=False),
    )


def build_thyroid_cs1() -> DiagnosticBundle:
    """Thyroid CS1: SE 7, SR 6, all depleted, pH 5.0, VCS 32/32."""
    return DiagnosticBundle(
        hrv=HRVData(
            system_energy=7,
            stress_response=6,
            switched_sympathetics=False,
            pns_negative=True,
            vagus_dysfunction=False,
        ),
        brainwave=BrainwaveData(alpha=22, beta=12, delta=48, gamma=5, theta=8),
        dpulse=DPulseData(
            stress_index=211,
            vegetative_balance=300,
            physiological_resources=139,
            organs=[
                DPulseOrgan("Heart", 40),
                DPulseOrgan("Lungs", 30),
                DPulseOrgan("Liver", 35),
                DPulseOrgan("Kidneys", 28),
                DPulseOrgan("Sacrum", 20),
                DPulseOrgan("Stomach", 32),
                DPulseOrgan("Spleen", 28),
                DPulseOrgan("Colon", 35),
                DPulseOrgan("Small Intestine", 38),
                DPulseOrgan("Thoracic", 25),
                DPulseOrgan("Cervical", 30),
                DPulseOrgan("Lumbar", 22),
                DPulseOrgan("Bladder", 25),
                DPulseOrgan("Thyroid", 28),
                DPulseOrgan("Brain", 25),
                DPulseOrgan("Reproductive", 28),
            ],
        ),
        ua=UAData(ph=5.0, protein_positive=True, protein_value="Trace"),
        vcs=VCSData(score_correct=32, score_total=32, passed=True),
    )


def build_thyroid_cs2() -> DiagnosticBundle:
    """Thyroid CS2: SE 11, SR 6, Heart 15%, Sacrum 9%, pH 6.5, VCS 31/32."""
    return DiagnosticBundle(
        hrv=HRVData(
            system_energy=11,
            stress_response=6,
            switched_sympathetics=False,
            pns_negative=True,
            vagus_dysfunction=False,
        ),
        brainwave=BrainwaveData(alpha=16, beta=19, delta=50, gamma=10, theta=5),
        dpulse=DPulseData(
            stress_index=224,
            vegetative_balance=359,
            physiological_resources=84,
            organs=[
                DPulseOrgan("Heart", 15),
                DPulseOrgan("Lungs", 28),
                DPulseOrgan("Liver", 34),
                DPulseOrgan("Kidneys", 33),
                DPulseOrgan("Sacrum", 9),
                DPulseOrgan("Stomach", 27),
                DPulseOrgan("Spleen", 28),
                DPulseOrgan("Colon", 27),
                DPulseOrgan("Small Intestine", 22),
                DPulseOrgan("Thoracic", 27),
                DPulseOrgan("Cervical", 30),
                DPulseOrgan("Lumbar", 32),
                DPulseOrgan("Bladder", 28),
                DPulseOrgan("Thyroid", 28),
                DPulseOrgan("Brain", 26),
                DPulseOrgan("Reproductive", 28),
                DPulseOrgan("Blood Vessels", 28),
                DPulseOrgan("Lymph Nodes", 28),
                DPulseOrgan("Trachea", 28),
                DPulseOrgan("Coccyx", 26),
                DPulseOrgan("Gallbladder", 26),
                DPulseOrgan("Pancreas", 28),
            ],
        ),
        ua=UAData(ph=6.5, protein_positive=True, protein_value="Trace"),
        vcs=VCSData(score_correct=31, score_total=32, passed=True),
    )


def build_thyroid_cs3() -> DiagnosticBundle:
    """Thyroid CS3: SE 12, SR 7, ALL 1% catastrophic, pH 5.75, Protein 30+, VCS 16/32 FAIL."""
    return DiagnosticBundle(
        hrv=HRVData(
            system_energy=12,
            stress_response=7,
            switched_sympathetics=False,
            pns_negative=True,
            vagus_dysfunction=True,
        ),
        brainwave=BrainwaveData(alpha=9, beta=4, delta=65, gamma=3, theta=19),
        dpulse=DPulseData(
            stress_index=1540,
            vegetative_balance=1847,
            physiological_resources=11,
            organs=[
                DPulseOrgan("Heart", 1),
                DPulseOrgan("Lungs", 7),
                DPulseOrgan("Liver", 4),
                DPulseOrgan("Kidneys", 1),
                DPulseOrgan("Sacrum", 1),
                DPulseOrgan("Stomach", 1),
                DPulseOrgan("Spleen", 1),
                DPulseOrgan("Colon", 1),
                DPulseOrgan("Small Intestine", 1),
                DPulseOrgan("Thoracic", 1),
                DPulseOrgan("Cervical", 1),
                DPulseOrgan("Lumbar", 1),
                DPulseOrgan("Bladder", 1),
                DPulseOrgan("Thyroid", 1),
                DPulseOrgan("Brain", 1),
                DPulseOrgan("Reproductive", 1),
                DPulseOrgan("Blood Vessels", 1),
                DPulseOrgan("Lymph Nodes", 1),
                DPulseOrgan("Trachea", 1),
                DPulseOrgan("Coccyx", 1),
                DPulseOrgan("Gallbladder", 2),
                DPulseOrgan("Pancreas", 1),
            ],
        ),
        ua=UAData(ph=5.75, protein_positive=True, protein_value="30+", specific_gravity=1.025),
        vcs=VCSData(score_correct=16, score_total=32, passed=False),
    )


def build_thyroid_cs4() -> DiagnosticBundle:
    """Thyroid CS4 (Joanna Saxton): SE 9, SR 3, Heart 27%, Lungs 16%, pH 7, VCS 26/32."""
    return DiagnosticBundle(
        hrv=HRVData(
            system_energy=9,
            stress_response=3,
            switched_sympathetics=False,
            pns_negative=True,
            vagus_dysfunction=False,
        ),
        brainwave=BrainwaveData(alpha=8, beta=5, delta=66, gamma=5, theta=17),
        dpulse=DPulseData(
            stress_index=367,
            vegetative_balance=469,
            physiological_resources=81,
            organs=[
                DPulseOrgan("Heart", 27),
                DPulseOrgan("Lungs", 16),
                DPulseOrgan("Liver", 17),
                DPulseOrgan("Kidneys", 27),
                DPulseOrgan("Sacrum", 25),
                DPulseOrgan("Stomach", 26),
                DPulseOrgan("Spleen", 32),
                DPulseOrgan("Colon", 19),
                DPulseOrgan("Small Intestine", 24),
                DPulseOrgan("Thoracic", 17),
                DPulseOrgan("Cervical", 15),
                DPulseOrgan("Lumbar", 31),
                DPulseOrgan("Bladder", 17),
                DPulseOrgan("Thyroid", 32),
                DPulseOrgan("Brain", 18),
                DPulseOrgan("Reproductive", 32),
                DPulseOrgan("Blood Vessels", 32),
                DPulseOrgan("Lymph Nodes", 32),
                DPulseOrgan("Trachea", 32),
                DPulseOrgan("Coccyx", 27),
                DPulseOrgan("Gallbladder", 17),
                DPulseOrgan("Pancreas", 32),
            ],
        ),
        ua=UAData(ph=7.0, protein_positive=True, protein_value="Trace"),
        vcs=VCSData(score_correct=26, score_total=32, passed=True),
    )


def build_thyroid_cs5() -> DiagnosticBundle:
    """Thyroid CS5 (Rosalia Barbosa): SE 10, SR 7, Heart 36%, pH 6.5, VCS 17/32 FAIL."""
    return DiagnosticBundle(
        hrv=HRVData(
            system_energy=10,
            stress_response=7,
            switched_sympathetics=False,
            pns_negative=True,
            vagus_dysfunction=False,
        ),
        brainwave=BrainwaveData(alpha=11, beta=18, delta=50, gamma=3, theta=19),
        dpulse=DPulseData(
            stress_index=284,
            vegetative_balance=409,
            physiological_resources=84,
            organs=[
                DPulseOrgan("Heart", 36),
                DPulseOrgan("Lungs", 32),
                DPulseOrgan("Liver", 35),
                DPulseOrgan("Kidneys", 40),
                DPulseOrgan("Sacrum", 20),
                DPulseOrgan("Stomach", 30),
                DPulseOrgan("Spleen", 44),
                DPulseOrgan("Colon", 21),
                DPulseOrgan("Small Intestine", 34),
                DPulseOrgan("Thoracic", 22),
                DPulseOrgan("Cervical", 23),
                DPulseOrgan("Lumbar", 32),
                DPulseOrgan("Bladder", 39),
                DPulseOrgan("Thyroid", 44),
                DPulseOrgan("Brain", 37),
                DPulseOrgan("Reproductive", 44),
                DPulseOrgan("Blood Vessels", 44),
                DPulseOrgan("Lymph Nodes", 44),
                DPulseOrgan("Trachea", 44),
                DPulseOrgan("Coccyx", 32),
                DPulseOrgan("Gallbladder", 34),
                DPulseOrgan("Pancreas", 44),
            ],
        ),
        ua=UAData(ph=6.5, protein_positive=True, protein_value="Trace"),
        vcs=VCSData(score_correct=17, score_total=32, passed=False),
        labs=[
            LabMarker(name="Blood", value=1, unit="Trace", status="high"),
        ],
    )


# =============================================================================
# ALL CASE STUDIES
# =============================================================================

ALL_CASE_STUDIES = [
    ("Hormones", "CS1", build_hormones_cs1),
    ("Hormones", "CS2", build_hormones_cs2),
    ("Hormones", "CS3", build_hormones_cs3),
    ("Hormones", "CS4", build_hormones_cs4),
    ("Hormones", "CS5", build_hormones_cs5),
    ("Diabetes", "CS1", build_diabetes_cs1),
    ("Diabetes", "CS2", build_diabetes_cs2),
    ("Diabetes", "CS3", build_diabetes_cs3),
    ("Diabetes", "CS4", build_diabetes_cs4),
    ("Diabetes", "CS5", build_diabetes_cs5),
    ("Neurological", "CS1", build_neuro_cs1),
    ("Neurological", "CS2", build_neuro_cs2),
    ("Neurological", "CS3", build_neuro_cs3),
    ("Neurological", "CS4", build_neuro_cs4),
    ("Neurological", "CS5", build_neuro_cs5),
    ("Thyroid", "CS1", build_thyroid_cs1),
    ("Thyroid", "CS2", build_thyroid_cs2),
    ("Thyroid", "CS3", build_thyroid_cs3),
    ("Thyroid", "CS4", build_thyroid_cs4),
    ("Thyroid", "CS5", build_thyroid_cs5),
]


def format_case_study_result(
    category: str,
    cs_name: str,
    bundle: DiagnosticBundle,
    result,
) -> str:
    """Format a single case study result as markdown."""
    lines = []
    lines.append(f"### {category} — {cs_name}")
    lines.append("")

    # Summary of input data
    if bundle.hrv:
        h = bundle.hrv
        lines.append(f"**HRV:** SE {h.system_energy}, SR {h.stress_response}")
        flags = []
        if h.switched_sympathetics:
            flags.append("SNS SWITCHED")
        if h.pns_negative:
            flags.append("PNS Negative")
        if h.vagus_dysfunction:
            flags.append("Vagus Dysfunction")
        if flags:
            lines.append(f"**HRV Flags:** {', '.join(flags)}")

    if bundle.brainwave:
        bw = bundle.brainwave
        lines.append(
            f"**Brainwaves:** Alpha {bw.alpha}%, Beta {bw.beta}%, "
            f"Delta {bw.delta}%, Gamma {bw.gamma}%, Theta {bw.theta}%"
        )

    if bundle.dpulse:
        dp = bundle.dpulse
        heart = dp.get_organ("Heart")
        lines.append(
            f"**D-Pulse:** SI {dp.stress_index}, VB {dp.vegetative_balance}, "
            f"PR {dp.physiological_resources}, Heart {heart}%"
        )
        red_organs = [
            o for o in dp.organs if o.percentage < 40 and o.name in [
                "Heart", "Lungs", "Liver", "Kidneys", "Sacrum", "Stomach",
                "Brain", "Thyroid", "Colon", "Bladder", "Reproductive",
            ]
        ]
        if red_organs:
            red_list = ", ".join(f"{o.name} ({o.percentage}%)" for o in sorted(red_organs, key=lambda x: x.percentage))
            lines.append(f"**RED Organs (<40%):** {red_list}")

    if bundle.ua:
        ua = bundle.ua
        parts = [f"pH {ua.ph}"]
        if ua.protein_positive:
            parts.append(f"Protein {ua.protein_value or 'Positive'}")
        if ua.heavy_metals:
            parts.append(f"Heavy Metals: {', '.join(ua.heavy_metals)}")
        lines.append(f"**UA:** {', '.join(parts)}")

    if bundle.vcs:
        v = bundle.vcs
        status = "PASS" if v.passed else "FAIL"
        lines.append(f"**VCS:** {v.score_correct}/{v.score_total} ({status})")
    else:
        lines.append("**VCS:** Not recorded")

    lines.append("")

    # Deal Breakers
    if result.deal_breakers_found:
        lines.append("#### Deal Breakers Found")
        for db in result.deal_breakers_found:
            lines.append(f"- {db}")
        lines.append("")

    # Protocols
    protocols = result.deduplicated_protocols()
    if protocols:
        lines.append("#### Protocols")
        lines.append("")
        lines.append("| Priority | Protocol | Trigger | Category |")
        lines.append("|----------|----------|---------|----------|")
        for p in protocols:
            priority_label = {1: "P1-DEAL BREAKER", 2: "P2-HIGH", 3: "P3-STANDARD"}.get(p.priority, f"P{p.priority}")
            lines.append(f"| {priority_label} | **{p.name}** | {p.trigger} | {p.category} |")
        lines.append("")

    # Supplements
    supplements = result.deduplicated_supplements()
    if supplements:
        lines.append("#### Supplements")
        lines.append("")
        lines.append("| Supplement | Trigger | Dosage | Timing |")
        lines.append("|------------|---------|--------|--------|")
        for s in supplements:
            lines.append(f"| **{s.name}** | {s.trigger} | {s.dosage} | {s.timing} |")
        lines.append("")

    # Cross-correlations
    if result.cross_correlations:
        lines.append("#### Cross-Correlations")
        for cc in result.cross_correlations:
            lines.append(f"- {cc}")
        lines.append("")

    lines.append("---")
    lines.append("")
    return "\n".join(lines)


def main():
    """Run protocol engine on all 20 case studies and generate markdown report."""
    output_lines = []
    output_lines.append("# BFM Protocol Engine — Full Case Study Evaluation")
    output_lines.append("")
    output_lines.append("**Generated by:** `run_all_case_study_evals.py`")
    output_lines.append(f"**Total Case Studies:** {len(ALL_CASE_STUDIES)}")
    output_lines.append("")

    # Summary stats
    total_protocols = 0
    total_supplements = 0
    total_deal_breakers = 0

    current_category = None
    all_results = []

    for category, cs_name, builder_fn in ALL_CASE_STUDIES:
        if category != current_category:
            output_lines.append(f"## {category} Case Studies")
            output_lines.append("")
            current_category = category

        bundle = builder_fn()
        result = run_protocol_engine(bundle)

        protocols = result.deduplicated_protocols()
        supplements = result.deduplicated_supplements()

        total_protocols += len(protocols)
        total_supplements += len(supplements)
        total_deal_breakers += len(result.deal_breakers_found)

        all_results.append((category, cs_name, bundle, result))

        section = format_case_study_result(category, cs_name, bundle, result)
        output_lines.append(section)

    # Summary at top
    summary = []
    summary.append("# BFM Protocol Engine — Full Case Study Evaluation")
    summary.append("")
    summary.append("**Generated by:** `run_all_case_study_evals.py`")
    summary.append(f"**Total Case Studies:** {len(ALL_CASE_STUDIES)}")
    summary.append(f"**Total Unique Protocols Recommended:** {total_protocols}")
    summary.append(f"**Total Unique Supplements Recommended:** {total_supplements}")
    summary.append(f"**Total Deal Breakers Found:** {total_deal_breakers}")
    summary.append("")

    # Quick reference table
    summary.append("## Quick Reference Summary")
    summary.append("")
    summary.append("| Case Study | SE | SR | Heart% | pH | VCS | Deal Breakers | # Protocols | # Supplements |")
    summary.append("|------------|----|----|--------|----|-----|---------------|-------------|---------------|")

    for category, cs_name, bundle, result in all_results:
        se = bundle.hrv.system_energy if bundle.hrv else "?"
        sr = bundle.hrv.stress_response if bundle.hrv else "?"
        heart = bundle.dpulse.get_organ("Heart") if bundle.dpulse else "?"
        ph = bundle.ua.ph if bundle.ua else "?"
        vcs = f"{bundle.vcs.score_correct}/{bundle.vcs.score_total}" if bundle.vcs else "N/R"
        n_db = len(result.deal_breakers_found)
        n_proto = len(result.deduplicated_protocols())
        n_supp = len(result.deduplicated_supplements())
        summary.append(
            f"| {category} {cs_name} | {se} | {sr} | {heart} | {ph} | {vcs} | {n_db} | {n_proto} | {n_supp} |"
        )

    summary.append("")
    summary.append("---")
    summary.append("")

    # Replace header with summary version
    output_lines = summary + output_lines[5:]  # Skip the original header lines

    # Write output
    output_path = os.path.join(
        os.path.dirname(__file__), "..", "..", "docs", "protocol-engine-eval-all-case-studies.md"
    )
    output_path = os.path.normpath(output_path)

    with open(output_path, "w") as f:
        f.write("\n".join(output_lines))

    print(f"Report written to: {output_path}")
    print(f"Total case studies: {len(ALL_CASE_STUDIES)}")
    print(f"Total protocols: {total_protocols}")
    print(f"Total supplements: {total_supplements}")
    print(f"Total deal breakers: {total_deal_breakers}")


if __name__ == "__main__":
    main()
