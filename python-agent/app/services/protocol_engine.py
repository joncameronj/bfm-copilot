"""
Protocol Engine - Deterministic protocol selection from Master Protocol Key.

Applies BFM clinical rules to extracted diagnostic data to produce
protocol and supplement recommendations. This replaces fuzzy semantic
search for the structured decision-making part of the pipeline.

Rules compiled from:
- 01-deal-breakers.md
- 02-hrv-brainwave-mapping.md
- 03-dpulse-organ-mapping.md
- 04-lab-diagnostic-mapping.md
- 07-supplement-reference.md
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class ProtocolRecommendation:
    """A single frequency protocol recommendation."""
    name: str
    priority: int  # 1 = highest (deal breaker), 2 = high, 3 = standard
    trigger: str  # What diagnostic finding triggered this
    category: str  # general, autonomic, brainwave, organ, lab, etc.
    notes: str = ""


@dataclass(frozen=True)
class SupplementRecommendation:
    """A single supplement recommendation."""
    name: str
    trigger: str
    dosage: str = ""
    timing: str = ""
    notes: str = ""


@dataclass
class EngineResult:
    """Output from the protocol engine."""
    protocols: list[ProtocolRecommendation] = field(default_factory=list)
    supplements: list[SupplementRecommendation] = field(default_factory=list)
    deal_breakers_found: list[str] = field(default_factory=list)
    cross_correlations: list[str] = field(default_factory=list)

    def deduplicated_protocols(self) -> list[ProtocolRecommendation]:
        """Return protocols deduplicated by name, keeping highest priority."""
        seen: dict[str, ProtocolRecommendation] = {}
        for p in self.protocols:
            existing = seen.get(p.name)
            if existing is None or p.priority < existing.priority:
                seen[p.name] = p
        return sorted(seen.values(), key=lambda p: (p.priority, p.name))

    def deduplicated_supplements(self) -> list[SupplementRecommendation]:
        """Return supplements deduplicated by name."""
        seen: dict[str, SupplementRecommendation] = {}
        for s in self.supplements:
            if s.name not in seen:
                seen[s.name] = s
        return list(seen.values())


# =============================================================================
# DIAGNOSTIC DATA TYPES (mirror the TypeScript extraction types)
# =============================================================================

@dataclass
class HRVData:
    system_energy: int | None = None  # 1-13
    stress_response: int | None = None  # 1-7
    calm_pns: float | None = None
    calm_sns: float | None = None
    stressed_pns: float | None = None
    stressed_sns: float | None = None
    recovery_pns: float | None = None
    recovery_sns: float | None = None
    switched_sympathetics: bool = False
    pns_negative: bool = False
    vagus_dysfunction: bool = False


@dataclass
class BrainwaveData:
    alpha: float = 0
    beta: float = 0
    delta: float = 0
    gamma: float = 0
    theta: float = 0


@dataclass
class DPulseOrgan:
    name: str
    percentage: float


@dataclass
class DPulseData:
    organs: list[DPulseOrgan] = field(default_factory=list)
    stress_index: float | None = None
    vegetative_balance: float | None = None
    brain_activity: float | None = None
    immunity: float | None = None
    physiological_resources: float | None = None

    def get_organ(self, name: str) -> float | None:
        """Get percentage for an organ (case-insensitive)."""
        name_lower = name.lower()
        for org in self.organs:
            if org.name.lower() == name_lower:
                return org.percentage
        return None


@dataclass
class UAData:
    ph: float | None = None
    protein_positive: bool = False
    protein_value: str = ""
    specific_gravity: float | None = None
    glucose_positive: bool = False
    heavy_metals: list[str] = field(default_factory=list)


@dataclass
class VCSData:
    score_correct: int | None = None
    score_total: int = 32
    passed: bool = True


@dataclass
class LabMarker:
    name: str
    value: float
    unit: str = ""
    status: str = "normal"  # low, normal, high


@dataclass
class DiagnosticBundle:
    """All diagnostic data for a patient, used as input to the protocol engine."""
    hrv: HRVData | None = None
    brainwave: BrainwaveData | None = None
    dpulse: DPulseData | None = None
    ua: UAData | None = None
    vcs: VCSData | None = None
    labs: list[LabMarker] = field(default_factory=list)

    def get_lab(self, name: str) -> LabMarker | None:
        """Get a lab marker by name (case-insensitive)."""
        name_lower = name.lower()
        for lab in self.labs:
            if lab.name.lower() == name_lower:
                return lab
        return None


# =============================================================================
# DEAL BREAKER RULES (Priority 1 — must be addressed first)
# =============================================================================

def _apply_deal_breaker_rules(bundle: DiagnosticBundle, result: EngineResult) -> None:
    """Apply the 7 BFM Deal Breakers."""

    # Deal Breaker 1: SNS Switched
    if bundle.hrv and bundle.hrv.switched_sympathetics:
        result.deal_breakers_found.append("SNS Switched")
        result.protocols.append(ProtocolRecommendation(
            name="SNS Balance",
            priority=1,
            trigger="SNS Switched on HRV (red dot crosses to wrong side of blue dot)",
            category="autonomic",
            notes="Deal Breaker #1 — address before other protocols",
        ))

    # Deal Breaker 2: Alpha/Theta Imbalance
    if bundle.brainwave:
        bw = bundle.brainwave
        if bw.theta > 0 and bw.alpha > 0 and bw.theta > bw.alpha:
            ratio = bw.theta / bw.alpha if bw.alpha > 0 else 999
            result.deal_breakers_found.append(
                f"Theta ({bw.theta}%) > Alpha ({bw.alpha}%) — ratio {ratio:.1f}:1"
            )
            result.protocols.append(ProtocolRecommendation(
                name="Alpha Theta",
                priority=1,
                trigger=f"Theta {bw.theta}% > Alpha {bw.alpha}% (reversed field)",
                category="brainwave",
                notes="Deal Breaker #2 — CSF vortex running backwards",
            ))
            result.supplements.append(SupplementRecommendation(
                name="Cell Synergy",
                trigger=f"Theta/Alpha imbalance (ratio {ratio:.1f}:1)",
                dosage="Double scoop if gap >2:1" if ratio > 2 else "1 scoop",
            ))
            result.supplements.append(SupplementRecommendation(
                name="D-Ribose",
                trigger="Theta > Alpha imbalance",
            ))

    # Deal Breaker 3: PNS Negative Zone
    if bundle.hrv and bundle.hrv.pns_negative:
        result.deal_breakers_found.append("PNS Negative Zone")
        result.protocols.append(ProtocolRecommendation(
            name="PNS Support",
            priority=1,
            trigger="PNS in negative zone on HRV (resistance to healing)",
            category="autonomic",
            notes="Deal Breaker #3 — longest to resolve (several months)",
        ))

    # Deal Breaker 4: Vagus Nerve Dysfunction
    if bundle.hrv and bundle.hrv.vagus_dysfunction:
        result.deal_breakers_found.append("Vagus Nerve Dysfunction")
        # Escalating protocol: Vagus Support → Vagas Balance → Vagas Trauma
        if bundle.hrv.switched_sympathetics:
            result.protocols.append(ProtocolRecommendation(
                name="Vagas Balance",
                priority=1,
                trigger="Vagus dysfunction + SNS also switched",
                category="autonomic",
            ))
        else:
            result.protocols.append(ProtocolRecommendation(
                name="Vagus Support",
                priority=1,
                trigger="Vagus nerve dysfunction on HRV (>2 hash marks between dots)",
                category="autonomic",
            ))
        result.supplements.append(SupplementRecommendation(
            name="Vagus Nerve form code",
            trigger="Vagus nerve dysfunction",
            timing="At night",
            notes="Innovita Vagus Nerve form code",
        ))

    # Deal Breaker 5: Low Heart on D-Pulse
    if bundle.dpulse:
        heart = bundle.dpulse.get_organ("Heart")
        if heart is not None and heart < 40:
            result.deal_breakers_found.append(f"Low Heart on D-Pulse ({heart}%)")
            result.protocols.append(ProtocolRecommendation(
                name="Heart Health",
                priority=1,
                trigger=f"Heart {heart}% on D-Pulse (deal breaker <40%)",
                category="organ",
                notes="Deal Breaker #5 — emotional trauma always present",
            ))
            result.supplements.append(SupplementRecommendation(
                name="Serculate",
                trigger=f"Low Heart ({heart}%) on D-Pulse",
                notes="Innovita Serculate",
            ))
            result.supplements.append(SupplementRecommendation(
                name="CoQ10",
                trigger=f"Low Heart ({heart}%) on D-Pulse",
            ))

    # Deal Breaker 6: Low pH
    if bundle.ua and bundle.ua.ph is not None and bundle.ua.ph < 6.5:
        result.deal_breakers_found.append(f"Low pH ({bundle.ua.ph})")
        result.supplements.append(SupplementRecommendation(
            name="Cell Synergy",
            trigger=f"pH {bundle.ua.ph} (under 6.5 threshold)",
            dosage="2-3 scoops" if bundle.ua.ph < 6.2 else "1 scoop minimum",
        ))
        if bundle.ua.ph < 6.2:
            result.supplements.append(SupplementRecommendation(
                name="Tri-Salts",
                trigger=f"pH {bundle.ua.ph} (under 6.2, extra support needed)",
            ))
            result.protocols.append(ProtocolRecommendation(
                name="Terrain",
                priority=1,
                trigger=f"pH {bundle.ua.ph} (if supplements don't move pH)",
                category="metabolic",
                notes="Deal Breaker #6 — use if Cell Synergy + Tri-Salts insufficient",
            ))

    # Deal Breaker 7: VCS Failed
    vcs_failed = False
    if bundle.vcs and not bundle.vcs.passed:
        vcs_failed = True
    elif bundle.ua and bundle.vcs is None:
        # VCS might be embedded in UA data — check if we have VCS data from UA
        pass

    if vcs_failed and bundle.vcs:
        score_str = f"{bundle.vcs.score_correct}/{bundle.vcs.score_total}" if bundle.vcs.score_correct else "failed"
        result.deal_breakers_found.append(f"VCS Failed ({score_str})")
        result.protocols.append(ProtocolRecommendation(
            name="Biotoxin",
            priority=1,
            trigger=f"VCS {score_str} (failed, biotoxin load)",
            category="detox",
            notes="Deal Breaker #7 — mold, Lyme, infections",
        ))
        result.supplements.append(SupplementRecommendation(
            name="Pectasol-C",
            trigger=f"VCS failed ({score_str})",
            notes="Paired with Biotoxin frequency",
        ))

    # UA: Protein positive (not a numbered deal breaker, but always triggers X-39)
    if bundle.ua and bundle.ua.protein_positive:
        result.protocols.append(ProtocolRecommendation(
            name="Leptin Resist",
            priority=2,
            trigger=f"Protein in urine ({bundle.ua.protein_value}) — MSH/UB rate dysfunction",
            category="metabolic",
        ))
        result.supplements.append(SupplementRecommendation(
            name="X-39",
            trigger=f"Protein in urine ({bundle.ua.protein_value})",
            notes="LifeWave X-39 patches for UB rates",
        ))


# =============================================================================
# BRAINWAVE RULES (Priority 2)
# =============================================================================

def _apply_brainwave_rules(bundle: DiagnosticBundle, result: EngineResult) -> None:
    """Apply brainwave pattern rules from HRV & Brainwave Mapping."""
    if not bundle.brainwave:
        return

    bw = bundle.brainwave

    # Beta dominant (already partially covered by deal breakers for theta>alpha)
    if bw.beta > bw.alpha and bw.beta > 25:
        result.protocols.append(ProtocolRecommendation(
            name="CP-P",
            priority=2,
            trigger=f"Beta {bw.beta}% dominant over Alpha {bw.alpha}% (midbrain set point too high)",
            category="brainwave",
            notes="Central Pain Protocol — calms midbrain down",
        ))

    # Combined beta + theta high
    if bw.beta > bw.alpha and bw.theta > bw.alpha:
        # Both already handled individually, but note the combination
        result.cross_correlations.append(
            f"Combined Beta ({bw.beta}%) + Theta ({bw.theta}%) both dominate Alpha ({bw.alpha}%) — run CP-P + Alpha Theta"
        )

    # High Gamma (>40%) — racing thoughts
    if bw.gamma > 40:
        result.protocols.append(ProtocolRecommendation(
            name="Midbrain Support",
            priority=2,
            trigger=f"Gamma {bw.gamma}% (>40% — racing thoughts)",
            category="brainwave",
        ))

    # High waking Delta (>70% according to master key, but >20% is clinically significant)
    if bw.delta > 20:
        result.supplements.append(SupplementRecommendation(
            name="Cell Synergy",
            trigger=f"High waking Delta {bw.delta}% — low direct current",
        ))

    # Low alpha (<10%) — pain indicator
    if bw.alpha < 10:
        result.cross_correlations.append(
            f"Alpha {bw.alpha}% (under 10%) — pain indicator, disconnection from Schumann resonance"
        )


# =============================================================================
# D-PULSE ORGAN RULES (Priority 2-3)
# =============================================================================

def _apply_dpulse_organ_rules(bundle: DiagnosticBundle, result: EngineResult) -> None:
    """Apply D-Pulse organ-to-protocol mappings."""
    if not bundle.dpulse:
        return

    dp = bundle.dpulse

    # Organ-specific protocols for RED (<40%) or YELLOW (<60%) organs
    organ_protocol_map: dict[str, list[tuple[str, str]]] = {
        "liver": [("Liver Inflame", "if enzymes elevated"), ("Liver Tox", "general")],
        "gallbladder": [("Gallbladder Support", "")],
        "kidney": [("Kidney Support", ""), ("Kidney Vitality", "if chronic")],
        "kidneys": [("Kidney Support", ""), ("Kidney Vitality", "if chronic")],
        "bladder": [("Bladder Support", "")],
        "lung": [("Lung Support", "")],
        "lungs": [("Lung Support", "")],
        "sacrum": [("Sacral Plexus", "sacral parasympathetic weakness")],
        "the sacrum": [("Sacral Plexus", "sacral parasympathetic weakness")],
        "brain": [("Midbrain Support", "")],
        "the brain": [("Midbrain Support", "")],
        "thyroid": [("Pit P Support", "check thyroid labs")],
        "the thyroid gland": [("Pit P Support", "check thyroid labs")],
        "small intestine": [("Small Intestine", "leaking / vagus")],
        "the small intestine": [("Small Intestine", "leaking / vagus")],
        "spleen": [("Spleen Support", "")],
    }

    # Supplement map for low organs
    organ_supplement_map: dict[str, list[tuple[str, str]]] = {
        "liver": [("Livergy", "Innovita"), ("Rejuvenation", "DrinkHRW")],
        "kidney": [("Kidney Clear", "Innovita")],
        "kidneys": [("Kidney Clear", "Innovita")],
        "lung": [("Glutathione Patch", "on Lung 1 point")],
        "lungs": [("Glutathione Patch", "on Lung 1 point")],
        "small intestine": [("Ion Gut Health", "")],
        "the small intestine": [("Ion Gut Health", "")],
    }

    for organ in dp.organs:
        pct = organ.percentage
        organ_key = organ.name.lower()

        if pct < 40:
            # RED — deal breaker level (Heart already handled above)
            if organ_key in ("heart",):
                continue  # Already handled in deal breakers

            protocols = organ_protocol_map.get(organ_key, [])
            for proto_name, notes in protocols:
                result.protocols.append(ProtocolRecommendation(
                    name=proto_name,
                    priority=2,
                    trigger=f"{organ.name} {pct}% on D-Pulse (RED, <40%)",
                    category="organ",
                    notes=notes,
                ))

            supplements = organ_supplement_map.get(organ_key, [])
            for supp_name, notes in supplements:
                result.supplements.append(SupplementRecommendation(
                    name=supp_name,
                    trigger=f"Low {organ.name} ({pct}%) on D-Pulse",
                    notes=notes,
                ))

        elif pct < 60:
            # YELLOW — caution, may still warrant protocols
            protocols = organ_protocol_map.get(organ_key, [])
            for proto_name, notes in protocols:
                result.protocols.append(ProtocolRecommendation(
                    name=proto_name,
                    priority=3,
                    trigger=f"{organ.name} {pct}% on D-Pulse (YELLOW, 40-60%)",
                    category="organ",
                    notes=notes,
                ))

    # Cross-correlation: Low Heart + Low Small Intestine = vagus problem
    heart_pct = dp.get_organ("Heart") or dp.get_organ("heart")
    si_pct = dp.get_organ("Small intestine") or dp.get_organ("The small intestine") or dp.get_organ("small intestine")
    if heart_pct is not None and si_pct is not None and heart_pct < 60 and si_pct < 60:
        result.cross_correlations.append(
            f"Low Heart ({heart_pct}%) + Low Small Intestine ({si_pct}%) = residual vagus nerve problem"
        )
        result.protocols.append(ProtocolRecommendation(
            name="Vagus Support",
            priority=2,
            trigger=f"Heart ({heart_pct}%) + Small Intestine ({si_pct}%) both low — vagus pattern",
            category="autonomic",
        ))

    # All systems single digits = catastrophic
    if dp.organs and all(o.percentage < 10 for o in dp.organs):
        result.cross_correlations.append("All systems single digits — catastrophic, electron spin inversion")
        result.protocols.append(ProtocolRecommendation(
            name="Terrain",
            priority=1,
            trigger="All D-Pulse systems in single digits (Krebs cycle backwards)",
            category="metabolic",
        ))
        result.protocols.append(ProtocolRecommendation(
            name="Cyto Lower",
            priority=1,
            trigger="All D-Pulse systems in single digits",
            category="immune",
        ))

    # Physiological resources below normal
    if dp.physiological_resources is not None and dp.physiological_resources < 150:
        result.cross_correlations.append(
            f"Physiological Resources {dp.physiological_resources} (below normal 150-600)"
        )


# =============================================================================
# LAB MARKER RULES (Priority 2-3)
# =============================================================================

def _apply_lab_rules(bundle: DiagnosticBundle, result: EngineResult) -> None:
    """Apply lab marker to protocol mappings from Master Protocol Key."""
    if not bundle.labs:
        return

    # Helper to check if a lab is high
    def is_high(name: str) -> tuple[bool, LabMarker | None]:
        m = bundle.get_lab(name)
        return (m is not None and m.status == "high", m)

    def is_low(name: str) -> tuple[bool, LabMarker | None]:
        m = bundle.get_lab(name)
        return (m is not None and m.status == "low", m)

    # Liver: Elevated ALT/AST/GGT
    for marker_name in ("ALT", "AST", "GGT"):
        high, m = is_high(marker_name)
        if high and m:
            result.protocols.append(ProtocolRecommendation(
                name="Liver Inflame",
                priority=2,
                trigger=f"{marker_name} elevated ({m.value} {m.unit})",
                category="lab",
                notes="Must normalize before proceeding",
            ))
            result.supplements.append(SupplementRecommendation(
                name="Livergy", trigger=f"Elevated {marker_name}",
            ))
            break  # Only add once for liver

    # Inflammation: Elevated CRP
    high, m = is_high("CRP")
    if not high:
        high, m = is_high("hs-CRP")
    if high and m:
        result.protocols.append(ProtocolRecommendation(
            name="Mito Leak",
            priority=2,
            trigger=f"CRP elevated ({m.value}) — Complex 1 mitochondrial leaking",
            category="lab",
        ))
        result.supplements.append(SupplementRecommendation(
            name="CoQ10", trigger="Elevated CRP",
        ))
        result.supplements.append(SupplementRecommendation(
            name="Integra Cell", trigger="Elevated CRP",
        ))

    # Iron/Ferritin
    high_ferritin, ferr = is_high("Ferritin")
    low_iron, iron = is_low("Iron")
    if high_ferritin and ferr:
        result.protocols.append(ProtocolRecommendation(
            name="Ferritin Lower",
            priority=2,
            trigger=f"High Ferritin ({ferr.value})",
            category="lab",
        ))
        result.supplements.append(SupplementRecommendation(
            name="IP6 Gold", trigger="High Ferritin",
            notes="NEVER give iron" if low_iron else "",
        ))
        if low_iron:
            result.supplements.append(SupplementRecommendation(
                name="Mito Synergy", trigger="High Ferritin + Low Iron (copper issue)",
            ))
            result.supplements.append(SupplementRecommendation(
                name="Fatty 15", trigger="High Ferritin + Low Iron (cell membranes)",
            ))

    # Cardiovascular: High Pro-BNP
    high, m = is_high("Pro-BNP")
    if not high:
        high, m = is_high("BNP")
    if high and m:
        result.protocols.append(ProtocolRecommendation(
            name="Kidney Inflame",
            priority=2,
            trigger=f"High Pro-BNP ({m.value}) — paradoxically, kidney freq fixes this",
            category="lab",
        ))

    # Low HDL
    low, m = is_low("HDL")
    if low and m:
        result.protocols.append(ProtocolRecommendation(
            name="Small Intestine",
            priority=3,
            trigger=f"Low HDL ({m.value}) — small intestine leaking",
            category="lab",
        ))
        result.supplements.append(SupplementRecommendation(
            name="Ion Gut Health", trigger="Low HDL",
        ))

    # Thyroid: TPO antibodies
    high, m = is_high("TPO")
    if not high:
        high, m = is_high("TPO Antibodies")
    if high and m:
        result.protocols.append(ProtocolRecommendation(
            name="Thyroid 1",
            priority=2,
            trigger=f"TPO Antibodies positive ({m.value}) — Hashimoto's",
            category="lab",
        ))
        result.supplements.append(SupplementRecommendation(
            name="Thyroiden", trigger="TPO positive",
            notes="Innovita Thyroiden",
        ))

    # Thyroid: TGB antibodies
    high, m = is_high("TGB")
    if not high:
        high, m = is_high("TGB Antibodies")
    if high and m:
        result.protocols.append(ProtocolRecommendation(
            name="Thyroid Infect",
            priority=2,
            trigger=f"TGB Antibodies positive ({m.value}) — more dangerous, faster to resolve",
            category="lab",
        ))

    # High BUN + High Creatinine = Kidney stress
    high_bun, bun = is_high("BUN")
    high_creat, creat = is_high("Creatinine")
    if high_bun and high_creat:
        result.protocols.append(ProtocolRecommendation(
            name="Kidney Vitality",
            priority=2,
            trigger=f"BUN {bun.value if bun else '?'} + Creatinine {creat.value if creat else '?'} (kidney stress)",
            category="lab",
        ))

    # Low eGFR = kidney failure
    low, m = is_low("eGFR")
    if low and m:
        result.protocols.append(ProtocolRecommendation(
            name="Kidney Repair",
            priority=2,
            trigger=f"eGFR {m.value} (kidney function compromised)",
            category="lab",
        ))
        result.supplements.append(SupplementRecommendation(
            name="Deuterium Drops", trigger=f"Low eGFR ({m.value})",
        ))

    # High BUN:Creatinine ratio = EMF damage / dehydration
    if high_bun and bun and creat and creat.value > 0:
        ratio = bun.value / creat.value
        if ratio > 20:
            result.protocols.append(ProtocolRecommendation(
                name="EMF Cord",
                priority=3,
                trigger=f"BUN:Creatinine ratio {ratio:.0f} (>20 — EMF damage/dehydration)",
                category="lab",
            ))

    # High Glucose
    high, m = is_high("Glucose")
    if high and m:
        result.protocols.append(ProtocolRecommendation(
            name="Sacral Plexus",
            priority=2,
            trigger=f"Glucose {m.value} (elevated — diabetic pattern)",
            category="lab",
        ))


# =============================================================================
# CROSS-DIAGNOSTIC CORRELATION
# =============================================================================

def _apply_cross_correlations(bundle: DiagnosticBundle, result: EngineResult) -> None:
    """Detect patterns that only emerge when multiple diagnostics are combined."""

    # Perfect D-Pulse + low alpha + protein = biotoxic illness (machine tricked)
    if bundle.dpulse and bundle.brainwave and bundle.ua:
        avg_pct = (
            sum(o.percentage for o in bundle.dpulse.organs) / len(bundle.dpulse.organs)
            if bundle.dpulse.organs else 0
        )
        if avg_pct > 80 and bundle.brainwave.alpha < 15 and bundle.ua.protein_positive:
            result.cross_correlations.append(
                f"Nearly perfect D-Pulse (avg {avg_pct:.0f}%) but low alpha ({bundle.brainwave.alpha}%) "
                f"+ protein in urine = biotoxic illness pattern (D-Pulse machine being 'tricked')"
            )
            # Ensure Biotoxin protocol is present
            if not any(p.name == "Biotoxin" for p in result.protocols):
                result.protocols.append(ProtocolRecommendation(
                    name="Biotoxin",
                    priority=2,
                    trigger="Biotoxic illness pattern: good D-Pulse + low alpha + protein in urine",
                    category="detox",
                ))
                result.supplements.append(SupplementRecommendation(
                    name="Pectasol-C",
                    trigger="Biotoxic illness pattern detected",
                ))

    # System Energy >= 10 + multiple RED D-Pulse = energetic debt
    if bundle.hrv and bundle.dpulse:
        se = bundle.hrv.system_energy
        red_count = sum(1 for o in bundle.dpulse.organs if o.percentage < 40)
        if se is not None and se >= 10 and red_count >= 3:
            result.cross_correlations.append(
                f"System Energy {se}/13 (debt) + {red_count} RED organs on D-Pulse = severe energetic debt"
            )

    # Labs confirm D-Pulse kidney issues
    if bundle.dpulse and bundle.labs:
        kidney_pct = bundle.dpulse.get_organ("Kidney") or bundle.dpulse.get_organ("Kidneys") or bundle.dpulse.get_organ("kidneys")
        egfr = bundle.get_lab("eGFR")
        if kidney_pct is not None and kidney_pct < 40 and egfr and egfr.status == "low":
            result.cross_correlations.append(
                f"D-Pulse Kidneys ({kidney_pct}%) + eGFR {egfr.value} = labs confirm D-Pulse kidney crisis"
            )

    # VCS borderline + protein in urine = subclinical biotoxin
    if bundle.vcs and bundle.ua:
        if bundle.vcs.passed and bundle.vcs.score_correct is not None:
            if bundle.vcs.score_correct <= 28 and bundle.ua.protein_positive:
                result.cross_correlations.append(
                    f"VCS borderline ({bundle.vcs.score_correct}/32) + protein in urine = subclinical biotoxin load"
                )


# =============================================================================
# MAIN ENTRY POINT
# =============================================================================

def run_protocol_engine(bundle: DiagnosticBundle) -> EngineResult:
    """
    Run the full deterministic protocol engine on a diagnostic bundle.

    This applies all BFM Master Protocol Key rules in order:
    1. Deal Breakers (priority 1)
    2. Brainwave patterns (priority 2)
    3. D-Pulse organ protocols (priority 2-3)
    4. Lab marker protocols (priority 2-3)
    5. Cross-diagnostic correlations

    Returns deduplicated protocols and supplements sorted by priority.
    """
    result = EngineResult()

    _apply_deal_breaker_rules(bundle, result)
    _apply_brainwave_rules(bundle, result)
    _apply_dpulse_organ_rules(bundle, result)
    _apply_lab_rules(bundle, result)
    _apply_cross_correlations(bundle, result)

    # Deduplicate
    result.protocols = result.deduplicated_protocols()
    result.supplements = result.deduplicated_supplements()

    return result


def bundle_from_extracted_data(data: dict) -> DiagnosticBundle:
    """
    Convert extracted diagnostic data (from TypeScript DiagnosticDataSummary)
    into a DiagnosticBundle for the protocol engine.

    This bridges the frontend extraction → Python engine.
    """
    bundle = DiagnosticBundle()

    # HRV
    hrv_data = data.get("hrv")
    if hrv_data:
        patterns = hrv_data.get("patterns", {})
        calm = hrv_data.get("calm_position", {})
        stressed = hrv_data.get("stressed_position", {})
        recovery = hrv_data.get("recovery_position", {})

        bundle.hrv = HRVData(
            system_energy=hrv_data.get("system_energy"),
            stress_response=hrv_data.get("stress_response"),
            calm_pns=calm.get("pns") if calm else None,
            calm_sns=calm.get("sns") if calm else None,
            stressed_pns=stressed.get("pns") if stressed else None,
            stressed_sns=stressed.get("sns") if stressed else None,
            recovery_pns=recovery.get("pns") if recovery else None,
            recovery_sns=recovery.get("sns") if recovery else None,
            switched_sympathetics=patterns.get("switched_sympathetics", False),
            pns_negative=patterns.get("pns_negative", False),
            vagus_dysfunction=patterns.get("vagus_dysfunction", False),
        )

        # Brainwave from HRV
        bw = hrv_data.get("brainwave")
        if bw:
            bundle.brainwave = BrainwaveData(
                alpha=bw.get("alpha", 0),
                beta=bw.get("beta", 0),
                delta=bw.get("delta", 0),
                gamma=bw.get("gamma", 0),
                theta=bw.get("theta", 0),
            )

    # Standalone brainwave (if not already set from HRV)
    bw_data = data.get("brainwave")
    if bw_data and not bundle.brainwave:
        bundle.brainwave = BrainwaveData(
            alpha=bw_data.get("alpha", {}).get("value", 0) if isinstance(bw_data.get("alpha"), dict) else bw_data.get("alpha", 0),
            beta=bw_data.get("beta", {}).get("value", 0) if isinstance(bw_data.get("beta"), dict) else bw_data.get("beta", 0),
            delta=bw_data.get("delta", {}).get("value", 0) if isinstance(bw_data.get("delta"), dict) else bw_data.get("delta", 0),
            gamma=bw_data.get("gamma", {}).get("value", 0) if isinstance(bw_data.get("gamma"), dict) else bw_data.get("gamma", 0),
            theta=bw_data.get("theta", {}).get("value", 0) if isinstance(bw_data.get("theta"), dict) else bw_data.get("theta", 0),
        )

    # D-Pulse
    dp_data = data.get("dPulse") or data.get("d_pulse")
    if dp_data:
        organs = []
        for m in dp_data.get("markers", []):
            pct = m.get("percentage") or m.get("value") or 0
            organs.append(DPulseOrgan(name=m.get("name", ""), percentage=pct))

        bundle.dpulse = DPulseData(
            organs=organs,
            stress_index=dp_data.get("stress_index"),
            vegetative_balance=dp_data.get("vegetative_balance"),
            brain_activity=dp_data.get("brain_activity"),
            immunity=dp_data.get("immunity"),
            physiological_resources=dp_data.get("physiological_resources"),
        )

    # UA
    ua_data = data.get("ua")
    if ua_data:
        ph_obj = ua_data.get("ph", {})
        ph_val = ph_obj.get("value") if isinstance(ph_obj, dict) else ph_obj
        protein_obj = ua_data.get("protein", {})
        protein_status = protein_obj.get("status", "") if isinstance(protein_obj, dict) else ""
        protein_val = protein_obj.get("value", "") if isinstance(protein_obj, dict) else str(protein_obj or "")
        sg_obj = ua_data.get("specific_gravity", {})

        bundle.ua = UAData(
            ph=ph_val,
            protein_positive=protein_status in ("trace", "positive"),
            protein_value=str(protein_val),
            specific_gravity=sg_obj.get("value") if isinstance(sg_obj, dict) else sg_obj,
            glucose_positive=(ua_data.get("glucose", {}).get("status") == "positive"
                              if isinstance(ua_data.get("glucose"), dict) else False),
            heavy_metals=ua_data.get("heavy_metals") or [],
        )

        # VCS from UA
        vcs_from_ua = ua_data.get("vcs_score")
        if vcs_from_ua and not bundle.vcs:
            bundle.vcs = VCSData(
                score_correct=vcs_from_ua.get("correct"),
                score_total=vcs_from_ua.get("total", 32),
                passed=vcs_from_ua.get("passed", True),
            )

    # Standalone VCS
    vcs_data = data.get("vcs")
    if vcs_data and not bundle.vcs:
        bundle.vcs = VCSData(
            score_correct=None,
            score_total=32,
            passed=vcs_data.get("passed", True),
        )

    # Blood Panel → Labs
    bp_data = data.get("bloodPanel") or data.get("blood_panel")
    if bp_data:
        for m in bp_data.get("markers", []):
            bundle.labs.append(LabMarker(
                name=m.get("name", ""),
                value=m.get("value", 0),
                unit=m.get("unit", ""),
                status=m.get("status", "normal"),
            ))

    return bundle
