# Protocol Generation Accuracy Guide

## Overview

This document defines the rules and data sources that govern accurate protocol generation in Clinic Copilot. The AI must follow these rules strictly to prevent hallucination of frequency names and ensure clinically accurate recommendations.

---

## Core Principles

### 1. Frequency Names Only - No Hz Values

**CRITICAL:** The AI must output frequency **NAMES** only, never Hz values.

- **WRONG:** `{ "name": "Inflammation", "frequencyA": 40, "frequencyB": 116 }`
- **CORRECT:** `{ "name": "Liver Inflame", "rationale": "Elevated ALT/AST" }`

### 2. Sunday Docs First (RAG Priority)

BFM Sunday transcripts are the **primary source** for protocol recommendations. The RAG system must:

1. Search Sunday docs FIRST (lower similarity threshold)
2. Then search other seminar docs, frequency references, etc.
3. Sunday docs contain the tactical case study walkthroughs with "when to use what"

### 3. Seven Deal Breakers (Address First)

Before any condition-specific protocols, these findings MUST be addressed:

| # | Deal Breaker | Finding | Protocol/Supplement |
|---|--------------|---------|---------------------|
| 1 | Switch Sympathetics | Nervous system reversed | Sympathetic settings |
| 2 | Alpha Theta Ratio | Brainwave pattern off | Alpha Theta |
| 3 | PNS Negative Zone | Parasympathetic depressed | PNS Support |
| 4 | Vagus Nerve | Vagal dysfunction | Vagus settings |
| 5 | Heart Low (D-Pulse) | Cardiac issues on depulse | Heart Support 2 |
| 6 | Low pH | Acidic | Cell Synergy or Trisalts |
| 7 | Failed VCS | Visual Contrast Spectrum fail | Pentasol + Biotoxin setting |

### 4. Diagnostic Analysis Order

Follow this sequence when analyzing patient diagnostics:

1. **HRV** - What's off in autonomic function?
2. **Brainwave** - What FSM protocols indicated?
3. **D-Pulse** - Identify "seven deal breakers" (red markers)
4. **UA (Urinalysis)** - pH low → Cell Synergy/Trisalts; Protein off → X39 patches
5. **VCS** - If failed → Spectasol or Leptin settings; Pentasol + Biotoxin
6. **Labs** - Supplementation recommendations

---

## Approved Frequency Names

### Source Documents

Frequency names are extracted from these Protocol Bank PDF files:

```
agent-assets/hormones/hormones-frequencies-pt1.pdf
agent-assets/hormones/hormones-frequencies-pt2.pdf
agent-assets/neurological/neuro-frequencies.pdf
agent-assets/diabetes/diabetes-frequencies.pdf
agent-assets/thyroid/thyroid-frequencies.pdf
```

### Extracted Frequency Names by Source

#### Thyroid Frequencies (74 protocols)
Source: `agent-assets/thyroid/thyroid-frequencies.pdf` (22 pages)

```
AI EMF, Aldehyde Detox, Alpha Theta, Artery Repair, Artery Vitality,
Autoimmune 2.0, Biotoxin, Blood Support 2, Bone Calm, Bone Repair 2,
Capillary Repair, Capillary Vital, CDR, Concussion SHS, Constipation 1,
CP-P, CSF Support, CT Repair, CT Tox, Cyto Lower, DNA, DNA Rad,
EMF Cord, EMF Immune Syste, EMF Mito 2, EMF NS 2, Ferritin, GI Path,
Gluten Sensitive, GR MT DNA, Heart Support 2, Immune Support 2,
Kidney Repair, Kidney Vitality, Large Intest Sup, Leptin Resist,
Liver Inflame, Medulla Support, Melanin Repair, Mito Function,
Mito Leak2, Mito SupportSHS, Mito Tox, Mito Vitality, MT DNA,
MT DNA Reboot, NS Tox 2, Pars Intermedia, Pineal Support, Pit A Repair,
Pituitary A Supp, Pituitary P Supp, PNS Support, Sacral Plexus, SIBO,
Small Intestine, SNS Balance, Solar Plexus, Spleen Support, Terrain,
Thyroid +81, Thyroid 1, Thyroid CT, Thyroid Goiter, Thyroid Graves,
Thyroid Infect, Thyroid Virus 2, Vagus Balance, Vagus Support,
Vagus Trauma, Vein Repair, Vein Vitality, Viral 1, Viral T&S
```

#### Hormones Frequencies Part 1 (76 protocols)
Source: `agent-assets/hormones/hormones-frequencies-pt1.pdf` (23 pages)

```
Adrenal Quiet Sh, Alpha Theta, Artery Repair, Artery Vitality, Biotoxin,
Blood Support 2, Bone Calm, Bone Pain, Bone Repair 2, Capillary Repair,
Capillary Vital, Concussion SHS, Constipation 1, CP-P, CSF Support,
Cyto Lower, Deuterium, DNA Rad, Dura Support, EMF Cord, EMF Immune Syste,
EMF Mito 2, EMF NS 2, Endometriosis, Fallopian Tubes, Ferritin, GI Path,
Heart Support 2, Hormone Balance, Hypoxia, Kidney Repair, Kidney Vitality,
Large Intestine, Leptin Resist, Liver Inflame, Locus Coeruleus,
Medulla Support, Melanin Repair, Midbrain Support, Mito Function,
Mito Leak2, Mito Tox, Mito Vitality, Mold, MT DNA, MT DNA Reboot,
Nerve Pain Alt, NS Tox 2, Ovarian Cyst, Pars Intermedia, PCOS,
Pineal Support, Pituitary A Supp, Pituitary P Supp, PNS Support,
Prostate Plexus, Prostate Support, Sacral Plexus, Schumann mtDNA,
Small Intestine, SNS Balance, Solar Plexus, Spleen Support, Terrain,
Thyroid +81, Thyroid 1, Thyroid Infect, Thyroid Virus 2, Uterine Fibroid,
Vagus Balance, Vagus MMF, Vagus Support, Vagus Trauma, Vein Repair,
Vein Vitality, Viral 1
```

#### Hormones Frequencies Part 2 (no new protocols)
Source: `agent-assets/hormones/hormones-frequencies-pt2.pdf` (1 page - index only)

This file contains a summary/index of Part 1 protocols with simplified names (e.g., "Heart Support" instead of "Heart Support 2"). These serve as aliases, not new protocols.

#### Neurological Frequencies (49 protocols)
Source: `agent-assets/neurological/neuro-frequencies.pdf` (13 pages)

```
58/.01, 81/89, Amygdala Calm, Artery Repair, Artery Vitality,
Basal Gang Stim, Biotoxin, Brain Balance, Brain Protein,
Capillary Repair, Capillary Vital, Concussion SHS, Cord Degen,
Cord Stim, CP-P, CTF-P, Cyto Lower, EMF MITO, EMF NS 2,
Forebrain Suppor, Hindbrain Stim, Hindbrain Suppor, Kidney Repair,
Kidney Vitality, Leptin Resist, Liver Inflame, Locus Coeruleus,
Medulla Calm, Midbrain Support, Mito Energy, Mito Support, Mito Tox,
MS Attack, Nerve Pain SHS, Nerve Stim, Pars Intermedia,
Pineal Support, Pituitary A Supp, Pituitary P Supp, Sacral Plexus,
SM Stim, Sympathetic Calm, Terrain, Thyroid +81, Thyroid 1,
Thyroid Infect, Thyroid Virus 2, Vein Repair, Vein Support
```

#### Diabetes Frequencies (60 protocols)
Source: `agent-assets/diabetes/diabetes-frequencies.pdf` (17 pages)

```
Alpha Theta, Artery Repair, Artery Vitality, Biotoxin,
Capillary Repair, Capillary Vital, Concussion SHS, Constipation 1,
CP-P, CSF Support, CT SUGAR, Cyto Lower, Deuterium, DNA Rad,
EMF Immune Syste, EMF MITO, EMF NS, GI Path, Gluten Sensitive,
Goiter, Heart Support, Insulin Resis#1, Kidney Repair,
Kidney Vitality, Large Intestine, Leptin Resist, Liver Inflame,
Medulla Support, Mito Leak 2, Mito Tox, Mito Vitality, MT DNA,
Nerve Pain SHS, NS Tox, Pancreas Beta, Pancreas T2D,
Pars Intermedia, Pineal Support, Pituitary A Supp, Pituitary P Supp,
PN Diabetes, PN Tox, PNS Support, Sacral Plexus, SIBO,
Small Intestine, SNS Balance, Solar Plexus, Spleen Support,
Terrain, Thyroid +81, Thyroid 1, Thyroid CT, Thyroid Graves,
Thyroid Infect, Thyroid Virus 2, Vagus Balance, Vagus Support,
Vein Repair, Vein Vitality
```

### Additional Protocols (from Sunday docs)

These protocols are referenced in the Sunday tactical sessions:

- PNS Support
- Switch Sympathetics
- Vagus Nerve
- Pineal
- Terrain
- Cord Stim
- Heart Health
- Liver Tox
- Vein Repair
- Vein Vitality
- Schumann MT DNA

---

## Protocol-to-Finding Mappings

### From D-Pulse Findings

| D-Pulse Finding | Protocol |
|-----------------|----------|
| Heart RED (deal breaker) | Heart Support 2 |
| Liver RED | Liver Inflame |
| Kidney RED | Kidney Repair, Kidney Vitality |
| Inflammation markers | Cyto Lower |

### From HRV Findings

| HRV Finding | Protocol |
|-------------|----------|
| Sympathetic dominant | Bone Calm, Medulla Support |
| Parasympathetic low | PNS Support |
| Alpha/Theta ratio off | Alpha Theta |
| Vagus dysfunction | Vagus settings |

### From UA Findings

| UA Finding | Supplement/Protocol |
|------------|---------------------|
| pH low (< 6.5) | Cell Synergy or Trisalts |
| Protein positive | X39 patches |
| High uric acid | Ammonia support |

### From VCS Findings

| VCS Finding | Supplement/Protocol |
|-------------|---------------------|
| Failed VCS | Pentasol + Biotoxin setting |
| Biotoxin indicated | Cyto Lower |
| Leptin issues | Leptin Resist |

### From Lab Findings

| Lab Finding | Protocol |
|-------------|----------|
| Elevated ALT/AST/GGT | Liver Inflame |
| Elevated CRP | Mito Leak2 |
| Low GFR | Kidney Repair, Kidney Vitality, Pentasol C |
| High LDL/Low HDL ratio | Pentasol (removes plaque) |
| High Ferritin | Ferritin settings, more sunlight |
| High Galectin-3 | Pentasol |

---

## Supplementation Rules

**NOTE:** Supplementation recommendations are for the **PRACTITIONER INTERFACE ONLY**. Members/patients should not see supplement recommendations directly.

| Finding | Supplement |
|---------|------------|
| Failed VCS | Pentasol (lowers biotoxin/galectin-3) |
| Low pH | Cell Synergy or Trisalts |
| Protein off (UA) | X39 patches |
| Kidney issues | Kidney Clear (Navita form code) |
| Liver support | Liver G (Navita), Rejuvenation |
| Infections | Apex (AFTER VCS improves) |
| Core support | Cell Synergy + Cod liver oil |
| High leptin + failed VCS | Leptin Resist + Pentasol |
| Deuterium load | Deuterium-depleted water |
| Low HDL / Leaky gut / GI symptoms | Ion Gut Health |
| Elevated homocysteine / Methylation impairment | Homocysteine Factor |
| Low CoQ10 / Low HDL | CoQ10 |
| High ferritin / Iron overload | IP-6 Gold |
| Thyroid dysfunction (esp. autoimmune) | Thyroiden (Navita) |
| Parent essential fatty acid deficiency (Omega panel) | Body Bio Oil |

---

## Time-Dependent Protocols

Some protocols have specific time requirements:

| Protocol | Duration | Notes |
|----------|----------|-------|
| Cyto Lower | ~1h 45m | Runs neck-to-feet, not eyecare |
| Artery Vitality + Repair | 4 days x 1hr | For pulmonary embolism |
| Vein Vitality + Repair | 4 x 1hr | For DVT |
| MT DNA | Extended | May need multiple runs |

---

## CDR (Cell Danger Response)

The CDR protocol is described as a "closer/finisher" - it should only be run AFTER:

1. All deal breakers are resolved
2. Archimedes levers are addressed
3. Other condition-specific protocols have been applied

---

## Validation Rules

### Before Saving Protocol Recommendations

1. **Validate frequency names** against `approved_frequency_names` table
2. **Reject hallucinated names** - if not in approved list, do not recommend
3. **Fuzzy matching allowed** - Levenshtein distance <= 2 for typo tolerance
4. **Alias support** - Some frequencies have alternate names

### Confidence Scoring

- High confidence (≥0.8): Exact match to approved name + strong Sunday doc reference
- Medium confidence (0.6-0.8): Fuzzy match or weaker doc reference
- Low confidence (<0.6): Flag for review

---

## Source Documentation

### Sunday Documents (Primary Source)

```
agent-assets/diabetes/raw-data/BFM Sun 2025 Diabetes.md
agent-assets/thyroid/raw-data/BFM Sun 2025 Thyroid .md
agent-assets/neurological/raw-data/BFM Sun 2025 Neuro.md
agent-assets/hormones/raw-data/BFM Sun 2025 Hormones.md
```

### Key Sections in Sunday Docs

- "Seven Deal Breakers" - Critical findings to address first
- "Archimedes Levers" - Core system optimization
- Case study walkthroughs - Tactical protocol selection
- Supplementation discussions - When to use what

---

## Database Tables

### approved_frequency_names

Stores the master list of valid frequency protocol names:

```sql
CREATE TABLE approved_frequency_names (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    aliases TEXT[] DEFAULT '{}',
    category TEXT,  -- e.g., 'mito', 'organ', 'system'
    source_image_id UUID,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### recommendation_reasoning

Stores explainability data for each recommendation:

```sql
CREATE TABLE recommendation_reasoning (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protocol_recommendation_id UUID REFERENCES protocol_recommendations(id),
    frequency_name TEXT NOT NULL,
    rag_chunks_used JSONB DEFAULT '[]',
    sunday_doc_references JSONB DEFAULT '[]',
    diagnostic_triggers JSONB DEFAULT '[]',
    reasoning_steps JSONB DEFAULT '[]',
    confidence_score NUMERIC(3,2),
    validated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Explainability Requirements

Every protocol recommendation MUST include:

1. **Source reference** - Which Sunday doc section informed this recommendation
2. **Diagnostic trigger** - What finding prompted this recommendation
3. **Reasoning chain** - Step-by-step logic from finding to protocol
4. **Confidence score** - How confident the system is in this recommendation

Example:

```json
{
  "frequency_name": "Liver Inflame",
  "rationale": "Elevated liver enzymes indicate inflammation",
  "source_reference": {
    "document": "BFM Sun 2025 Diabetes",
    "section": "Liver Markers",
    "quote": "If ALT/AST are elevated, you gotta get those down..."
  },
  "diagnostic_trigger": {
    "type": "lab_panel",
    "finding": "ALT: 65 (elevated)",
    "interpretation": "Liver inflammation present"
  },
  "confidence_score": 0.85
}
```

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2025-01-05 | 1.0 | Initial documentation of protocol accuracy rules |
| 2025-01-05 | 1.1 | Added 74 thyroid frequency protocol names; supplementation is practitioner-only |
| 2025-01-05 | 1.2 | Added 60 diabetes frequency protocol names |
| 2025-01-05 | 1.3 | Added 49 neurological frequency protocol names |
| 2025-01-05 | 1.4 | Added 6 supplements from Sunday docs: Ion Gut Health, Homocysteine Factor, CoQ10, IP-6 Gold, Thyroiden, Body Bio Oil |
| 2025-01-05 | 1.5 | Added 76 hormones frequency protocol names (part 1) |
