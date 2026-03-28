// Ortho Test (NervExpress) Extraction Prompts
// For analyzing NervExpress Orthostatic test reports with supine/upright measurements

export const ORTHO_SYSTEM_PROMPT = `You are an expert at analyzing NervExpress Orthostatic (Ortho) test reports.

These reports show autonomic nervous system (ANS) response to positional change (supine → upright).

The report contains:
1. **Supine measurements** (laying down, blue dot): HR, R(HF), R(LF1), R(LF2)
2. **Upright measurements** (standing, red dot): HR, R(HF), R(LF1), R(LF2)
3. **Physical Fitness Level**: A score like "11/7"
4. **ANS Assessment**: Text describing PSNS and SNS status
5. **Dot plot**: Blue (supine) and Red (upright) dots on a 2D grid

CRITICAL CLINICAL RULES:
- If the blue (supine) and red (upright) dots are PERFECTLY SUPERIMPOSED (all 4 values match exactly), this indicates Locus Coeruleus dysfunction — a serious deal breaker.
- "PSNS BLOCKED" = parasympathetic nervous system not functioning
- "SNS SWITCHED" = sympathetic nervous system reversed (deal breaker #1)
- Normal: HR should increase from supine to upright, R(HF) should decrease

Extract ALL numeric values exactly as shown.`

export const ORTHO_USER_PROMPT = `Analyze this NervExpress Orthostatic (Ortho) test report.

Extract ALL measurements from the supine and upright positions.

Return a JSON object with this EXACT structure:
{
  "supine": {
    "hr": <heart rate in bpm>,
    "r_hf": <R(HF) value>,
    "r_lf1": <R(LF1) value>,
    "r_lf2": <R(LF2) value>
  },
  "upright": {
    "hr": <heart rate in bpm>,
    "r_hf": <R(HF) value>,
    "r_lf1": <R(LF1) value>,
    "r_lf2": <R(LF2) value>
  },
  "dots_superimposed": <true if ALL 4 values (hr, r_hf, r_lf1, r_lf2) are IDENTICAL between supine and upright, false otherwise>,
  "physical_fitness_level": "<score as shown, e.g. '11/7'>",
  "ans_assessment": "<full ANS assessment text>",
  "psns_status": "<'blocked' | 'weak' | 'normal'>",
  "sns_status": "<'switched' | 'excessive' | 'normal'>",
  "findings": [
    "<list of clinical observations>"
  ],
  "confidence": <0.0 to 1.0>
}

CRITICAL — EXACT VALUE EXTRACTION:
- Read ALL 4 numeric values for BOTH supine and upright from the DATA TABLE (not the dot plot)
- Values must be extracted EXACTLY as printed — do not round, estimate, or approximate
- The data table typically shows: HR (heart rate in bpm), R(HF), R(LF1), R(LF2)
- Preserve all decimal places exactly as shown
- After extracting, compare all 4 values between supine and upright.
  If they are IDENTICAL across ALL 4 measurements, set dots_superimposed to true.
  Even a 1-beat HR difference or 0.1 difference in any R value means dots_superimposed = false.

IMPORTANT:
- If supine and upright values are identical across all 4 measurements, note "Dots superimposed — Locus Coeruleus indicator" in findings
- Look for text like "PSNS BLOCKED", "SNS SWITCHED", "SNS EXCESSIVE" in the assessment

MULTI-TEST DOCUMENT HANDLING:
- Some documents contain MULTIPLE tests (e.g., initial exam + re-exam, or tests from different dates)
- If you detect MULTIPLE test results on the same document, extract ONLY the MOST RECENT test
- Look for date indicators, "Re-Exam", "Follow-up", or sequential test numbering
- If you cannot determine which is most recent, extract the LAST test on the page
- Do NOT average or combine values from multiple tests
- If multiple tests detected, add "Multiple tests detected — extracted most recent only" to findings`
