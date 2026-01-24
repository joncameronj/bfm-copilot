# RAG Knowledge Base Refactor - Protocol Mappings Reference

## Overview

This document captures the diagnostic-to-protocol mappings derived from Dr. Rob's Sunday teaching sessions. These mappings enable the hybrid RAG approach where:

1. **Direct mappings** translate diagnostic findings into protocol recommendations
2. **Protocol-aware chunking** preserves protocol context in Sunday content
3. **Protocol boosting** prioritizes search results that match expected protocols

---

## Case Study Ground Truth

### Thyroid Case Study 1 (thyroid-cs1)

**Frequencies:**
- SNS Balance
- Medula Support
- Pit P Support

**Supplements:**
- Serculate
- Cell Synergy
- Tri Salts
- X-39
- Deuterium Drops

---

### Neurological Case Study 5 (neurological-cs5)

**Frequencies:**
- Vagus Support
- PNS Support
- Cyto Lower
- Leptin Resist
- Kidney Support

**Supplements:**
- Cell Synergy
- Pectasol-C
- Apex
- Deuterium Drops

---

### Hormones Case Study 2 (hormones-cs2)

**Frequencies:**
- CP-P (Central Pain Protocol)
- Alpha Theta
- Biotoxin

**Supplements:**
- Cell Synergy
- X-39

**Key Diagnostics:**
- Low alpha (7%) - indicates pain, circadian issues
- High beta/gamma - midbrain set point too high
- Low pH (6.47) - energetic debt
- Protein in urine - MSH/UB rate dysfunction

---

### Diabetes Case Study 4 (diabetes-cs4)

**Frequencies:**
- SNS Balance
- Alpha Theta
- Sacral Plexus

**From Labs:**
- NS EMF
- Kidney Vitality
- Kidney Repair

**Supplements:**
- Cell Synergy
- X-39
- Deuterium Drops

---

## Diagnostic-to-Frequency Mappings

These mappings are implemented in `python-agent/app/tools/query_analyzer.py`:

### Brainwave Patterns

| Diagnostic Pattern | Recommended Frequencies |
|-------------------|------------------------|
| Low alpha / Alpha under 10% | Alpha Theta |
| High beta / Beta dominant | CP-P, SNS Balance |
| High gamma / Racing brain | CP-P |
| Theta > alpha / Reversed field | Alpha Theta |
| High delta / High waking delta | Melanin |

### HRV/Autonomic Patterns

| Diagnostic Pattern | Recommended Frequencies |
|-------------------|------------------------|
| PNS negative / Parasympathetic negative | PNS Support, Vagus Support |
| SNS switched / Sympathetic switched | SNS Balance |
| Sympathetic dominance | SNS Balance |
| Vagus nerve issues | Vagus Support |
| Autonomic dysfunction | PNS Support, SNS Balance |

### Organ-Specific

| Diagnostic Pattern | Recommended Frequencies |
|-------------------|------------------------|
| Pituitary issues | Pit P Support |
| Medulla issues | Medula Support |
| Sacral issues | Sacral Plexus |
| Kidney issues | Kidney Support, Kidney Vitality, Kidney Repair |

### Biotoxin Markers

| Diagnostic Pattern | Recommended Frequencies |
|-------------------|------------------------|
| Failed VCS / VCS fail | Biotoxin, Leptin Resist |
| Biotoxin illness / Biotoxic | Biotoxin |
| High cytokines / Cytokine storm | Cyto Lower |
| Leptin resistance | Leptin Resist |
| EMF exposure | NS EMF |

---

## Diagnostic-to-Supplement Mappings

### pH Issues

| Diagnostic Pattern | Recommended Supplements |
|-------------------|------------------------|
| Low pH / Acidic pH / pH under 6.5 | Cell Synergy, Tri Salts |
| Metabolic acidosis | Cell Synergy, Tri Salts |
| Energetic debt | Cell Synergy |

### Urinalysis Markers

| Diagnostic Pattern | Recommended Supplements |
|-------------------|------------------------|
| Protein in urine / Proteinuria | X-39 |
| UB rate dysfunction | X-39 |
| MSH issues | X-39 |

### Iron/Ferritin

| Diagnostic Pattern | Recommended Supplements |
|-------------------|------------------------|
| High ferritin / Elevated ferritin | Deuterium Drops |
| Iron overload | Deuterium Drops |

### Biotoxin Support

| Diagnostic Pattern | Recommended Supplements |
|-------------------|------------------------|
| Biotoxin illness | Pectasol-C, Apex |
| Mold toxicity / Mycotoxin | Pectasol-C, Apex |
| Detox support | Pectasol-C |

### Circulation

| Diagnostic Pattern | Recommended Supplements |
|-------------------|------------------------|
| Circulation issues / Poor circulation | Serculate |
| Blood flow issues | Serculate |

---

## Implementation Architecture

### Phase 1: Query Analysis Enhancement

**File:** `python-agent/app/tools/query_analyzer.py`

- `DIAGNOSTIC_TO_FREQUENCY` - Dictionary mapping diagnostic patterns to frequencies
- `DIAGNOSTIC_TO_SUPPLEMENT` - Dictionary mapping diagnostic patterns to supplements
- `extract_protocols_from_diagnostics()` - Scans text for diagnostic patterns
- `detect_explicit_protocols()` - Detects directly mentioned protocol names
- `enrich_analysis_with_protocols()` - Post-processes QueryAnalysis with mappings

The `QueryAnalysis` dataclass now includes:
- `suggested_frequencies: list[str]`
- `suggested_supplements: list[str]`
- `diagnostic_patterns: list[str]`

### Phase 2: Protocol-Aware Chunking

**File:** `python-agent/app/embeddings/chunker.py`

- `FREQUENCY_PATTERNS` - Regex patterns for frequency detection
- `SUPPLEMENT_PATTERNS` - Regex patterns for supplement detection
- `DIAGNOSTIC_CONTEXT_PATTERNS` - Patterns for diagnostic context
- `extract_protocols_from_text()` - Extracts all protocol mentions from text
- `chunk_with_protocols()` - Chunks documents with protocol metadata
- `enrich_chunks_with_protocols()` - Post-processes existing chunks

The `TextChunk` dataclass now includes:
- `protocols: list[str]` - Protocol names found in chunk
- `has_protocol_context: bool` - Whether chunk has protocol content

### Phase 3: Protocol Boosting in Search

**File:** `python-agent/app/tools/rag_search.py`

- `_boost_by_protocols()` - Boosts results containing target protocols
- `_extract_target_protocols()` - Gets protocols from QueryAnalysis

The `SearchResult` dataclass now includes:
- `matched_protocols: list[str]` - Protocols matched in result
- `protocol_boost: float` - Boost amount applied

**Boosting Logic:**
1. Extract target protocols from query analysis
2. Scan each result's content for protocol mentions
3. Calculate boost based on match ratio (0.15 * matches/targets)
4. Apply 1.5x multiplier for Sunday content
5. Re-sort results by boosted similarity

---

## Chunking Strategy for Sunday Content

Sunday seminar transcripts are conversational and protocols are often mentioned:
- In response to specific case study findings
- As part of teaching explanations
- In the context of diagnostic patterns

**Strategy:**
1. Chunk by paragraphs to preserve semantic boundaries
2. When a paragraph contains protocol mentions:
   - Include surrounding context (1 paragraph before/after)
   - Tag chunk with all detected protocols
3. Store protocol metadata for search filtering/boosting

**Example:**
```
"For low alpha patterns, we run Alpha Theta to balance circadian rhythms."

Chunk metadata:
- protocols: ["Alpha Theta"]
- has_protocol_context: True
- diagnostics: ["low alpha"]
```

---

## Testing Procedures

### Test Case: Thyroid Case Study 1

**Query:** "Patient with thyroid issues, sympathetic switched, pituitary dysfunction"

**Expected Protocols:**
- Frequencies: SNS Balance, Pit P Support
- Supplements: Cell Synergy

**Validation:**
1. Run query through `analyze_query()`
2. Check `suggested_frequencies` contains expected values
3. Run through `sunday_first_search()`
4. Verify results are boosted for protocol matches

### Test Case: Hormones Case Study 2

**Query:** "27yo female with low alpha 7%, high beta, low pH 6.47, protein in urine"

**Expected Protocols:**
- Frequencies: Alpha Theta, CP-P, Biotoxin
- Supplements: Cell Synergy, X-39

**Validation:**
1. Verify diagnostic patterns detected
2. Verify all expected protocols in suggestions
3. Verify boosted search results contain case study content

### Test Case: Neurological Case Study 5

**Query:** "Biotoxin illness, failed VCS, high cytokines, leptin resistance"

**Expected Protocols:**
- Frequencies: Biotoxin, Leptin Resist, Cyto Lower
- Supplements: Pectasol-C, Apex

---

## Maintenance Notes

### Adding New Protocol Mappings

1. Add pattern to `DIAGNOSTIC_TO_FREQUENCY` or `DIAGNOSTIC_TO_SUPPLEMENT` in `query_analyzer.py`
2. Add detection pattern to `FREQUENCY_PATTERNS` or `SUPPLEMENT_PATTERNS` in `chunker.py`
3. Update this document with the new mapping
4. Run tests to verify detection

### Adding New Case Studies

1. Create protocol reference file in `agent-assets/{category}/{category}-casestudies/{id}/`
2. Add ground truth to this document
3. Create test case for validation

---

## Key Teaching Quotes from Sunday Sessions

These quotes inform the diagnostic-to-protocol mappings:

> "The lower their alpha, the higher the pain"

> "If theta is greater than alpha, the field is reversed - circadian rhythms are screwed up"

> "If beta is high, sympathetics are set too high, midbrain is setting the point too high"

> "High waking delta means low direct current in the system"

> "Protein in urine is cellular debris - cells turning over too fast, MSH/UB rate issue"

> "pH under 6.5 is problematic - Cell Synergy is the staple for energetic debt"

> "For low alpha, run Alpha Theta to reconnect to Schumann resonance"

> "If beta is dominant, CP-P central pain will calm the midbrain down"

> "Biotoxin setting is a strong one, detoxes the areas where all those toxins will hit in the system"
