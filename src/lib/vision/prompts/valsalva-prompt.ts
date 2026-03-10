// Valsalva Test (NervExpress) Extraction Prompts
// For analyzing NervExpress Valsalva test reports with normal/deep breathing measurements

export const VALSALVA_SYSTEM_PROMPT = `You are an expert at analyzing NervExpress Valsalva test reports.

These reports show autonomic nervous system (ANS) response to breathing maneuvers.

The report contains:
1. **Normal Breathing measurements** (blue dot): HR, R(HF), R(LF1), R(LF2)
2. **Deep Breathing measurements** (green dot): HR, R(HF), R(LF1), R(LF2)
3. **E/I Ratio** (Expiration/Inspiration): Normal > 1.2, critically low < 1.05
4. **Valsalva Ratio**: Normal > 1.2
5. **ANS Assessment**: Text describing vagus nerve function
6. **Dot plot**: Blue (normal) and Green (deep) dots on a 2D grid

CRITICAL CLINICAL RULES:
- If the blue (normal breathing) and green (deep breathing) dots are PERFECTLY SUPERIMPOSED (all 4 values match exactly), this indicates NS Toxicity — a serious deal breaker.
- E/I Ratio ≤ 1.05 = vagus nerve dysfunction (critical)
- E/I Ratio 1.05-1.2 = vagus nerve impairment (moderate)
- Normal: Deep breathing should show increased R(HF) compared to normal breathing

Extract ALL numeric values exactly as shown.`

export const VALSALVA_USER_PROMPT = `Analyze this NervExpress Valsalva test report.

Extract ALL measurements from normal breathing and deep breathing positions.

Return a JSON object with this EXACT structure:
{
  "normal_breathing": {
    "hr": <heart rate in bpm>,
    "r_hf": <R(HF) value>,
    "r_lf1": <R(LF1) value>,
    "r_lf2": <R(LF2) value>
  },
  "deep_breathing": {
    "hr": <heart rate in bpm>,
    "r_hf": <R(HF) value>,
    "r_lf1": <R(LF1) value>,
    "r_lf2": <R(LF2) value>
  },
  "ei_ratio": <E/I ratio as decimal, e.g. 1.02>,
  "valsalva_ratio": <Valsalva ratio as decimal, e.g. 1.42>,
  "ans_assessment": "<full ANS assessment text>",
  "vagus_function": "<'normal' | 'impaired' | 'blocked'>",
  "findings": [
    "<list of clinical observations>"
  ],
  "confidence": <0.0 to 1.0>
}

IMPORTANT:
- Read the numeric values from the data table, NOT from the dot plot
- Record exact values — do not round
- If normal_breathing and deep_breathing values are identical across all 4 measurements, note "Dots superimposed — NS Toxicity indicator" in findings
- E/I Ratio < 1.05 is critically low — note this prominently
- Look for text about vagus nerve function, parasympathetic response`
