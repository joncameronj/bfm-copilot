// D-Pulse Extraction Prompts
// For analyzing BFM D-Pulse diagnostic reports with percentage-based organ energy levels

export const D_PULSE_SYSTEM_PROMPT = `You are an expert at analyzing D-Pulse (DePuls+) diagnostic reports used in BioField Mastery (BFM).

D-Pulse reports show organ and system energy levels as PERCENTAGES (0-100%). The format is:

1. **HEADER METRICS** (top section):
   - Stress Index: 10-100 units (normal range)
   - Index of Vegetative Balance: 35-140 units (normal range)
   - Brain Activity: percentage
   - Immunity: percentage
   - Physiological Resources Volume: 150-600 units (normal range)

2. **GASTROINTESTINAL ORGANS**: Stomach, Liver, Spleen, Gallbladder, Pancreas, Colon, Small Intestine
   Each with a percentage and a colored circle indicator

3. **FUNCTIONAL SYSTEMS**: Heart, Blood Vessels, Lymph Nodes, Kidneys, Bladder, Lungs, Brain, Thyroid, Trachea, Reproductive Organs
   Each with a percentage and a colored circle indicator

4. **VERTEBRAL COLUMN**: Cervical, Thoracic, Lumbar, Sacrum, Coccyx
   Each with a percentage and a colored circle indicator

CLASSIFICATION THRESHOLDS (BFM clinical rules):
- RED (Deal Breaker): < 40% - Critical, requires immediate FSM protocol
- YELLOW (Caution): 40-60% - Needs monitoring and support
- GREEN (Normal): > 60% - Healthy energy level

THE SEVEN DEAL BREAKERS (always check these organs):
1. Heart - if < 40% → "Heart Support 2" or "Heart Health"
2. Liver - if < 40% → "Liver Inflame" or "Liver Tox"
3. Kidney - if < 40% → "Kidney Support", "Kidney Vitality", or "Kidney Repair"
4. Cervical - if < 40% → autonomic dysfunction, may indicate switched sympathetics
5. Thoracic - if < 40% → spinal energy issues, "Medula Support"
6. Lumbar - if < 40% → lower back/sacral issues
7. Sacrum - if < 40% → "Sacral Plexus"

IMPORTANT: The image shows PERCENTAGES next to teal/green circles. Read the NUMBERS, not the circle colors.
The circles may all appear teal/green regardless of the percentage — the NUMBER is what matters.`

export const D_PULSE_USER_PROMPT = `Analyze this D-Pulse (DePuls+) diagnostic report image.

Extract ALL organ/system percentages and system-level metrics visible in the report.

Return a JSON object with this EXACT structure:
{
  "stress_index": <number or null>,
  "vegetative_balance": <number or null>,
  "brain_activity": <percentage number or null>,
  "immunity": <percentage number or null>,
  "physiological_resources": <number or null>,
  "markers": [
    {
      "name": "Heart",
      "percentage": <0-100>,
      "status": "green" | "yellow" | "red"
    },
    {
      "name": "Liver",
      "percentage": <0-100>,
      "status": "green" | "yellow" | "red"
    }
    // ... ALL organs listed in the report
  ],
  "seven_deal_breakers": {
    "heart": { "percentage": <number>, "status": "green" | "yellow" | "red" },
    "liver": { "percentage": <number>, "status": "green" | "yellow" | "red" },
    "kidney": { "percentage": <number>, "status": "green" | "yellow" | "red" },
    "cervical": { "percentage": <number>, "status": "green" | "yellow" | "red" },
    "thoracic": { "percentage": <number>, "status": "green" | "yellow" | "red" },
    "lumbar": { "percentage": <number>, "status": "green" | "yellow" | "red" },
    "sacrum": { "percentage": <number>, "status": "green" | "yellow" | "red" }
  },
  "deal_breakers": [
    "Heart (26%)",
    "Kidney (16%)"
  ],
  "caution_areas": [
    "Small Intestine (48%)",
    "Liver (44%)"
  ],
  "overall_status": "normal" | "caution" | "critical",
  "green_count": <count of markers >60%>,
  "yellow_count": <count of markers 40-60%>,
  "red_count": <count of markers <40%>,
  "average_energy": <average percentage across all organ markers>,
  "raw_notes": "<any additional text>",
  "confidence": <0.0 to 1.0>
}

CLASSIFICATION RULES:
- "red" = percentage < 40% (DEAL BREAKER)
- "yellow" = percentage 40-60% (CAUTION)
- "green" = percentage > 60% (NORMAL)
- "overall_status": "critical" if any red markers exist, "caution" if any yellow, "normal" if all green

CRITICAL: Read the PERCENTAGE NUMBERS carefully. They appear next to each organ name.
Include EVERY organ/system listed in the report. Do not skip any.
The "deal_breakers" array should list ONLY organs with percentage < 40%, formatted as "OrganName (XX%)".
The "caution_areas" array should list organs with percentage 40-60%, formatted as "OrganName (XX%)".`
