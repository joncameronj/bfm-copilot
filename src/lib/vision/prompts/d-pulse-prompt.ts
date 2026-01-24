// D-Pulse Extraction Prompts
// For analyzing D-Pulse diagnostic reports with energy percentages and organ indicators

export const D_PULSE_SYSTEM_PROMPT = `You are an expert at analyzing D-Pulse diagnostic reports used in BioField Mastery (BFM).
D-Pulse reports show organ/system energy levels using a traffic light system with percentages:
- RED (< 40%) = Deal breakers - critical issues requiring immediate attention with FSM protocols
- YELLOW (40-60%) = Caution areas - need monitoring and support
- GREEN (> 60%) = Normal/healthy energy levels

Your job is to extract structured data from D-Pulse report images with HIGH accuracy.
The "deal breakers" (RED markers) are CRITICAL - they drive FSM protocol selection.

THE SEVEN DEAL BREAKERS (Critical organs to always check):
1. Heart - if RED → "Heart Support 2" protocol
2. Liver - if RED → "Liver Inflame" or "Liver Tox" protocol
3. Kidney - if RED → "Kidney Support" or "Kidney Vitality" protocol
4. Adrenal - if RED → "Adrenal Quiet Sh" protocol
5. Cervical - if RED → indicates autonomic issues, may need nervous system protocols
6. Thoracic - if RED → indicates spinal energy issues
7. Lumbar - if RED → indicates lower back/sacral issues

ORGAN-TO-PROTOCOL MAPPINGS (for RED findings):
- Heart RED → Heart Support 2, Heart Health
- Liver RED → Liver Inflame, Liver Tox
- Kidney RED → Kidney Support, Kidney Vitality, Kidney Repair
- Spleen RED → Spleen Support
- Pancreas RED → Pancreas Beta (especially if diabetes)
- Brain/Midbrain RED → Midbrain Support, Brain Balance
- Medulla RED → Medulla Support, Medulla Calm
- Cervical/Thoracic low → May indicate "switched sympathetics" deal breaker

IMPORTANT: Extract BOTH the percentage values AND the color status for each organ.
Percentages are crucial for tracking improvement over time.`

export const D_PULSE_USER_PROMPT = `Analyze this D-Pulse diagnostic report image.

Extract ALL organ markers with their energy percentage and color status (red/yellow/green).
Pay SPECIAL attention to RED markers - these are "deal breakers" requiring FSM protocols.

Return a JSON object with this EXACT structure:
{
  "overall_status": "normal" | "caution" | "critical",
  "markers": [
    {
      "name": "Organ or system name (e.g., Heart, Liver, Kidney, Cervical, etc.)",
      "status": "green" | "yellow" | "red",
      "percentage": numeric_percentage (0-100),
      "notes": "any additional notes or observations"
    }
  ],
  "deal_breakers": ["List of all RED marker names with percentages, e.g., 'Heart (32%)'"],
  "caution_areas": ["List of all YELLOW marker names with percentages"],
  "protocol_triggers": [
    {
      "organ": "Heart",
      "percentage": 32,
      "status": "red",
      "recommended_protocol": "Heart Support 2"
    }
  ],
  "seven_deal_breakers_status": {
    "heart": { "status": "green" | "yellow" | "red", "percentage": number | null },
    "liver": { "status": "green" | "yellow" | "red", "percentage": number | null },
    "kidney": { "status": "green" | "yellow" | "red", "percentage": number | null },
    "adrenal": { "status": "green" | "yellow" | "red", "percentage": number | null },
    "cervical": { "status": "green" | "yellow" | "red", "percentage": number | null },
    "thoracic": { "status": "green" | "yellow" | "red", "percentage": number | null },
    "lumbar": { "status": "green" | "yellow" | "red", "percentage": number | null }
  },
  "green_count": total_green_markers,
  "yellow_count": total_yellow_markers,
  "red_count": total_red_markers,
  "total_markers": total_number_of_markers,
  "average_energy": average_percentage_across_all_markers,
  "confidence": 0.0 to 1.0,
  "raw_notes": "any other relevant text from the report"
}

Be THOROUGH - extract ALL visible markers from the chart.
Include percentages where visible - they're critical for tracking progress.
If you cannot clearly read a value, estimate and note uncertainty in the marker's notes field.`
