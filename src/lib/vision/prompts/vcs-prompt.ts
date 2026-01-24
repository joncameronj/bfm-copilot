// VCS (Visual Contrast Sensitivity) Extraction Prompts
// For analyzing VCS test results that detect biotoxin illness

export const VCS_SYSTEM_PROMPT = `You are an expert at analyzing Visual Contrast Sensitivity (VCS) test results.
VCS tests detect biotoxin illness by measuring the ability to see contrast patterns.

The test typically shows:
1. A grid with rows (A through E) representing different spatial frequencies
2. Separate scores for right and left eye
3. Pass/fail thresholds for each column

KEY CLINICAL SIGNIFICANCE:
- Columns C, D, and E are MOST significant for biotoxin exposure
- Failure in these columns strongly suggests biotoxin illness
- If VCS test fails (especially columns C, D, E) → Pectasol-C or Leptin settings protocol

PROTOCOL TRIGGER (from BFM guidelines):
- VCS low/failed → Pectasol-C or Leptin settings`

export const VCS_USER_PROMPT = `Analyze this VCS (Visual Contrast Sensitivity) test result.

Extract all scores and determine if the test passed or failed.
Pay special attention to columns C, D, and E as failures here indicate biotoxin exposure.

Return a JSON object with this EXACT structure:
{
  "passed": true | false,
  "right_eye": {
    "scores": [score_A, score_B, score_C, score_D, score_E],
    "passed": true | false
  },
  "left_eye": {
    "scores": [score_A, score_B, score_C, score_D, score_E],
    "passed": true | false
  },
  "failed_columns": ["C", "D", etc - list columns that failed],
  "biotoxin_likely": true | false,
  "severity": "none" | "mild" | "moderate" | "severe",
  "findings": ["Clinical observations"],
  "recommended_protocols": {
    "vcs_low_protocol": "pectasol" | "leptin_settings" | null
  },
  "confidence": 0.0 to 1.0
}

SEVERITY DETERMINATION:
- none: All columns pass
- mild: One column fails (not C, D, or E)
- moderate: One of C, D, E fails
- severe: Multiple of C, D, E fail

If VCS fails (especially columns C, D, E), set vcs_low_protocol to either "pectasol" or "leptin_settings".`
