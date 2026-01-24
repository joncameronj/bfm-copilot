# Feature Spec: Diagnostic-to-Protocol Mapping System

## Overview

Build a system that analyzes uploaded diagnostic files (HRV, D-Pulse, UA, Labs) and generates accurate protocol recommendations with full attribution and clinical reasoning.

---

## Problem Statement

### Current Issues
1. **Inconsistent outputs** - Same case study produces different protocol recommendations
2. **Missing protocols** - Diabetes-CS4 missing Sacral Plexus frequency
3. **No attribution** - Protocols don't link back to source documents
4. **No clinical reasoning** - No explanation of WHY each protocol is recommended
5. **Protocols page lacks context** - Lists all protocols but doesn't explain WHEN to use each

### Ground Truth Requirements (from Sunday Sessions)

| Case Study | Frequencies | Supplements | From Labs |
|------------|-------------|-------------|-----------|
| **thyroid-cs1** | SNS Balance, Medula Support, Pit P Support | Serculate, Cell Synergy, Tri Salts, X-39, Deuterium Drops | - |
| **hormones-cs2** | CP-P, Alpha Theta, Biotoxin | Cell Synergy, X-39 | - |
| **neurological-cs5** | Vagus Support, PNS Support, Cyto Lower, Leptin Resist, Kidney Support | Cell Synergy, Pectasol-C, Apex, Deuterium Drops | - |
| **diabetes-cs4** | SNS Balance, Alpha Theta, Sacral Plexus | Cell Synergy, X-39, Deuterium | NS EMF, Kidney Vitality, Kidney Repair |

---

## Feature Requirements

### 1. Document Attribution Tracking

When diagnostics are uploaded, each finding must track its source:

```typescript
interface DiagnosticFinding {
  id: string;
  source_document: string;        // "Male Case Study 4 Lab 1 of 2.jpg"
  document_type: "hrv" | "depulse" | "ua" | "labs" | "nes";
  marker: string;                 // "eGFR", "Alpha %", "pH"
  value: string | number;
  reference_range: string;
  status: "normal" | "low" | "high" | "critical";
  interpretation: string;         // "Stage 5 CKD"
}
```

### 2. Protocol Recommendation with Attribution

Each protocol links to the finding(s) that triggered it:

```typescript
interface ProtocolRecommendation {
  id: string;
  name: string;                   // "Sacral Plexus"
  type: "frequency" | "supplement";
  priority: 1 | 2 | 3;           // 1 = critical, 2 = important, 3 = supportive
  triggers: DiagnosticTrigger[];  // What findings triggered this
  category: string;               // "general" | "thyroid" | "diabetes" | etc.
  dr_robs_notes: string;          // Clinical reasoning
  teaching_source: string;        // "Sunday Diabetes Seminar"
}

interface DiagnosticTrigger {
  finding_id: string;
  source_document: string;
  marker: string;
  value: string;
  reason: string;                 // "Low alpha (8%) indicates circadian disruption"
}
```

### 3. Dr. Rob's Notes Generation

For each major protocol recommendation, generate clinical reasoning by:
1. Searching Sunday chunks for content about that protocol
2. Finding the teaching that explains WHEN and WHY to use it
3. Extracting the clinical reasoning into a readable note

Example output:
```
[Sacral Plexus - Diabetes-CS4]
"In diabetic patients with glucose spillover and autonomic dysfunction,
the sacral plexus frequency supports the pelvic autonomic nerves that
regulate bladder and bowel function, which are commonly affected in
diabetic neuropathy."
- Source: Sunday Diabetes Seminar, Case Study 4 Discussion
```

---

## UI Requirements

### Patient Profile - Protocol Recommendations Panel

When viewing a patient with uploaded diagnostics:

```
┌─────────────────────────────────────────────────────────────┐
│ Protocol Recommendations                                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ FREQUENCIES (7)                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ⚡ Kidney Support                          Priority: 1   │ │
│ │    Source: Labs 1/2 • eGFR 11 (Stage 5 CKD)             │ │
│ │    [View Details]                                        │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ⚡ Sacral Plexus                           Priority: 2   │ │
│ │    Source: Labs • Glucose 179 + UA Glucose Trace        │ │
│ │    [View Details]                                        │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ⚡ Alpha Theta                             Priority: 2   │ │
│ │    Source: HRV • Alpha 8% (very low)                    │ │
│ │    [View Details]                                        │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ SUPPLEMENTS (5)                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 💊 Cell Synergy                           Priority: 1   │ │
│ │    Source: UA • pH 6.27 (low)                           │ │
│ │    [View Details]                                        │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### [View Details] Tooltip/Modal

When clicking "View Details" on a protocol card:

```
┌─────────────────────────────────────────────────────────────┐
│ Sacral Plexus Frequency                                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ WHY THIS PROTOCOL                                            │
│ ─────────────────                                            │
│ This patient shows diabetic glucose spillover (Glucose 179   │
│ in labs, Trace glucose in UA) combined with autonomic        │
│ dysfunction (Stress Response 7/7). The sacral plexus         │
│ frequency supports pelvic autonomic function commonly        │
│ affected in diabetic neuropathy.                             │
│                                                              │
│ TRIGGERED BY                                                 │
│ ─────────────────                                            │
│ • Labs 1/2: Glucose 179 (diabetic range)                    │
│ • UA: Glucose Trace (spillover)                             │
│ • HRV: Stress Response 7 (worst)                            │
│                                                              │
│ DR. ROB'S TEACHING                                           │
│ ─────────────────                                            │
│ "In diabetes cases with autonomic involvement, sacral        │
│ plexus addresses the nerve supply to bladder, bowel, and    │
│ reproductive organs that get damaged by high glucose."       │
│ — Sunday Diabetes Seminar                                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Protocols Page - Category & When to Use

On the main Protocols page (`/protocols`):

```
┌─────────────────────────────────────────────────────────────┐
│ Protocols Library                                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Filter: [All] [General] [Thyroid] [Diabetes] [Neuro] [...]  │
│                                                              │
│ ┌───────────────────────────┐ ┌───────────────────────────┐ │
│ │ ⚡ Alpha Theta             │ │ ⚡ SNS Balance             │ │
│ │ Category: GENERAL          │ │ Category: GENERAL          │ │
│ │                            │ │                            │ │
│ │ Run when:                  │ │ Run when:                  │ │
│ │ • Low alpha (<15%)         │ │ • SNS switched             │ │
│ │ • Theta > Alpha            │ │ • High stress index        │ │
│ │ • Circadian disruption     │ │ • Poor stress response     │ │
│ │                            │ │                            │ │
│ │ [View Full Details]        │ │ [View Full Details]        │ │
│ └───────────────────────────┘ └───────────────────────────┘ │
│                                                              │
│ ┌───────────────────────────┐ ┌───────────────────────────┐ │
│ │ ⚡ Sacral Plexus           │ │ ⚡ Pit P Support           │ │
│ │ Category: DIABETES         │ │ Category: THYROID          │ │
│ │                            │ │                            │ │
│ │ Run when:                  │ │ Run when:                  │ │
│ │ • Diabetic patient         │ │ • Thyroid conditions       │ │
│ │ • Glucose spillover        │ │ • Pituitary involvement    │ │
│ │ • Autonomic dysfunction    │ │ • HPT axis dysfunction     │ │
│ │                            │ │                            │ │
│ │ [View Full Details]        │ │ [View Full Details]        │ │
│ └───────────────────────────┘ └───────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Protocol Categorization Logic

A protocol is marked as **GENERAL** if it appears in 2+ case study categories:

| Protocol | Thyroid | Hormones | Neuro | Diabetes | Category |
|----------|---------|----------|-------|----------|----------|
| Alpha Theta | - | ✓ | - | ✓ | **GENERAL** |
| SNS Balance | ✓ | - | - | ✓ | **GENERAL** |
| Cell Synergy | ✓ | ✓ | ✓ | ✓ | **GENERAL** |
| X-39 | ✓ | ✓ | - | ✓ | **GENERAL** |
| Sacral Plexus | - | - | - | ✓ | Diabetes |
| Pit P Support | ✓ | - | - | - | Thyroid |
| Biotoxin | - | ✓ | ✓ | - | **GENERAL** |
| Vagus Support | - | - | ✓ | - | Neuro |

---

## Missing Diagnostic-to-Protocol Mappings

### Sacral Plexus for Diabetes

**Current gap**: No pattern triggers Sacral Plexus from diabetes diagnostic data.

**Required mapping**:
```python
# When these conditions exist together, recommend Sacral Plexus
DIABETES_SACRAL_PLEXUS_TRIGGERS = {
    "diabetes + autonomic dysfunction": ["Sacral Plexus"],
    "glucose spillover": ["Sacral Plexus"],  # Glucose in UA when diabetic
    "diabetic neuropathy": ["Sacral Plexus"],
}
```

**Diagnostic pattern to add**:
- Labs: Glucose > 125 mg/dL (diabetic)
- UA: Glucose present (spillover)
- HRV: Stress Response poor (autonomic involvement)
- → Recommend: Sacral Plexus

### Labs-Driven Protocols for Diabetes-CS4

Per ground truth, labs should trigger additional protocols:

| Lab Finding | Protocol | Reasoning |
|-------------|----------|-----------|
| eGFR < 30 | Kidney Vitality | Severe kidney dysfunction |
| eGFR < 15 | Kidney Repair | End-stage renal |
| Anemia + Kidney disease | NS EMF | Supports oxygen carrying |

---

## Implementation Plan

### Phase 1: Data Model Updates

1. Add `diagnostic_findings` table to track uploaded document findings
2. Add `protocol_triggers` table linking protocols to findings
3. Add `protocol_categories` to mark General vs Specific

### Phase 2: Diagnostic Processing Pipeline

1. When files uploaded, extract structured findings
2. Run pattern matching against diagnostic-to-protocol mappings
3. Store findings with source document attribution
4. Generate protocol recommendations with triggers

### Phase 3: Dr. Rob's Notes Integration

1. For each protocol recommendation, search Sunday chunks
2. Find teaching content that explains WHEN to use that protocol
3. Extract reasoning into `dr_robs_notes` field
4. Link to source teaching material

### Phase 4: UI Implementation

1. Patient Profile - Protocol Recommendations panel with attribution
2. Protocol cards with [View Details] tooltip
3. Protocols page - Category filter and "Run when" descriptions

---

## Database Schema Changes

```sql
-- Track individual findings from uploaded documents
CREATE TABLE diagnostic_findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id),
    source_document TEXT NOT NULL,           -- filename
    document_type TEXT NOT NULL,             -- 'hrv', 'depulse', 'ua', 'labs'
    marker TEXT NOT NULL,                    -- 'eGFR', 'Alpha %', 'pH'
    value TEXT NOT NULL,
    reference_range TEXT,
    status TEXT,                             -- 'normal', 'low', 'high', 'critical'
    interpretation TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link protocol recommendations to their triggers
CREATE TABLE protocol_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id),
    protocol_name TEXT NOT NULL,
    protocol_type TEXT NOT NULL,             -- 'frequency', 'supplement'
    priority INTEGER DEFAULT 2,
    category TEXT DEFAULT 'general',
    dr_robs_notes TEXT,
    teaching_source TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Join table for which findings triggered which protocols
CREATE TABLE protocol_triggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recommendation_id UUID REFERENCES protocol_recommendations(id),
    finding_id UUID REFERENCES diagnostic_findings(id),
    reason TEXT NOT NULL                     -- "Low alpha indicates circadian disruption"
);

-- Protocol metadata for the protocols library page
CREATE TABLE protocol_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL,                      -- 'frequency', 'supplement'
    category TEXT DEFAULT 'general',         -- 'general', 'thyroid', 'diabetes', etc.
    run_when TEXT[],                         -- Array of conditions when to run
    description TEXT,
    dr_robs_teaching TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## API Changes

### POST /api/patients/{id}/diagnostics/analyze

Analyze uploaded diagnostics and generate protocol recommendations:

```typescript
// Request
{
  document_ids: string[];  // IDs of uploaded diagnostic documents
}

// Response
{
  findings: DiagnosticFinding[];
  protocols: {
    frequencies: ProtocolRecommendation[];
    supplements: ProtocolRecommendation[];
  };
  dr_robs_notes: {
    topic: string;
    note: string;
    teaching_source: string;
  }[];
}
```

### GET /api/protocols

Get all protocol definitions with "run when" conditions:

```typescript
// Response
{
  protocols: {
    id: string;
    name: string;
    type: "frequency" | "supplement";
    category: "general" | "thyroid" | "diabetes" | "neuro" | "hormones";
    run_when: string[];
    description: string;
    dr_robs_teaching: string;
  }[];
}
```

---

## Next Steps

1. [ ] Add missing Sacral Plexus mapping for diabetes
2. [ ] Add labs-driven protocol mappings (Kidney Vitality, Kidney Repair, NS EMF)
3. [ ] Create database migrations for new tables
4. [ ] Build diagnostic analysis pipeline with attribution
5. [ ] Implement Dr. Rob's Notes generation using RAG
6. [ ] Update Patient Profile UI with protocol recommendations panel
7. [ ] Update Protocols page with categories and "Run when" descriptions
8. [ ] Add [View Details] tooltip functionality

---

## Success Criteria

1. **Accuracy**: Each case study produces correct protocols matching ground truth
2. **Attribution**: Every protocol recommendation links to source document + finding
3. **Reasoning**: Dr. Rob's Notes explains WHY each protocol is recommended
4. **Consistency**: Same diagnostic data always produces same recommendations
5. **Education**: Protocols page teaches practitioners WHEN to use each protocol
