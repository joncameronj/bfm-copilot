// Urinalysis (UA) Extraction Prompts
// For analyzing BFM urinalysis test results including VCS score

export const UA_SYSTEM_PROMPT = `You are an expert at analyzing urinalysis (UA) test results used in BioField Mastery (BFM).

BFM UA reports typically show BOTH urinalysis results AND a Visual Contrast Scale (VCS) score on the same page.

KEY MARKERS AND BFM THRESHOLDS:

1. **pH** (CRITICAL - Deal Breaker):
   - LOW: pH < 6.5 → Triggers Cell Synergy or Tri-Salts protocol
   - OPTIMAL: pH 6.5-7.5
   - HIGH: pH > 7.5
   - NOTE: BFM uses 6.5 as the threshold (not the standard medical 6.0)

2. **Protein** (CRITICAL - Deal Breaker):
   - NEGATIVE: Normal
   - TRACE or higher: Triggers X-39 patches protocol
   - Protein in urine = cellular debris, MSH/UB rate dysfunction
   - Even a numeric value > 0 (like "5" or "15") counts as positive

3. **Specific Gravity**:
   - Normal: 1.010-1.020
   - High (>1.025): May indicate dehydration → Deuterium Drops

4. **Visual Contrast Scale (VCS)** (often on same page):
   - Format: "XX/32" (e.g., "31/32" or "21/32")
   - PASSING: 24 or more correct out of 32
   - FAILING: Less than 24 out of 32 → Biotoxin illness → Pectasol-C, Leptin Resist protocols

5. **Heavy Metals** (sometimes listed):
   - If present, note which metals (e.g., Cadmium, Copper, Lead)

6. **Other markers**: Leukocytes, Nitrite, Urobilinogen, Blood, Ketones, Bilirubin, Glucose

PROTOCOL TRIGGERS:
- pH < 6.5 → Cell Synergy or Tri-Salts (supplement)
- Protein positive → X-39 patches (supplement)
- VCS < 24/32 → Biotoxin, Pectasol-C, Leptin Resist
- Glucose positive → consider diabetic protocols
- Specific Gravity > 1.025 → Deuterium Drops`

export const UA_USER_PROMPT = `Analyze this urinalysis (UA) test result image.

This BFM UA report may include BOTH urinalysis results AND a Visual Contrast Scale (VCS) score.
Extract ALL visible data.

Return a JSON object with this EXACT structure:
{
  "ph": {
    "value": <exact numeric pH value, e.g. 6.47>,
    "status": "low" | "optimal" | "high"
  },
  "specific_gravity": {
    "value": <exact numeric value, e.g. 1.015>,
    "status": "low" | "normal" | "high"
  },
  "protein": {
    "value": "<exact value as shown: 'Neg', 'Trace', '5', '15', '1+', '2+', '3+'>",
    "status": "negative" | "trace" | "positive"
  },
  "glucose": {
    "value": "<value as shown>",
    "status": "negative" | "positive"
  },
  "ketones": {
    "value": "<value as shown>",
    "status": "negative" | "trace" | "positive"
  },
  "blood": {
    "value": "<value as shown>",
    "status": "negative" | "positive"
  },
  "leukocytes": { "value": "<value>", "status": "<status>" },
  "nitrites": { "value": "<value>", "status": "<status>" },
  "bilirubin": { "value": "<value>", "status": "<status>" },
  "urobilinogen": { "value": "<value>", "status": "<status>" },
  "heavy_metals": ["Cadmium", "Copper"] or null,
  "vcs_score": {
    "correct": <number correct, e.g. 31>,
    "total": 32,
    "passed": <true if correct >= 24, false otherwise>
  },
  "findings": [
    "pH 6.47 is LOW (under BFM threshold of 6.5) - deal breaker",
    "Protein 15 is POSITIVE - cellular debris, MSH/UB rate issue",
    "VCS 31/32 - passing but borderline"
  ],
  "recommended_protocols": {
    "ph_low_protocol": "cell_synergy" | "trisalts" | null,
    "protein_protocol": "x39_patches" | null
  },
  "confidence": <0.0 to 1.0>
}

pH STATUS RULES (BFM thresholds):
- "low": pH < 6.5 (this is a DEAL BREAKER in BFM)
- "optimal": pH 6.5 - 7.5
- "high": pH > 7.5

PROTEIN RULES:
- "negative": Shows "Neg" or "Negative"
- "trace": Shows "Trace"
- "positive": Shows any positive value (numeric like 5, 15, or 1+, 2+, 3+)
- ANY non-negative protein value triggers X-39 patches

VCS SCORE:
- Look for "Visual Contrast Scale" section, usually at bottom of page
- Format is typically "XX/32" or "XX / 32"
- 24+ identified = passing
- Below 24 = FAILING (biotoxin illness indicator)

HEAVY METALS:
- Look for "Heavy Metals" section
- If "None" → set to null
- If metals listed → include as array of strings

If pH is low, set ph_low_protocol to "cell_synergy".
If protein shows any positive value, set protein_protocol to "x39_patches".`
