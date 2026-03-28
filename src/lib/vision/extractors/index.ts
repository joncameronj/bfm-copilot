// Diagnostic Extractors
// Routes diagnostic files to appropriate extraction logic based on file type

import { extractFromImage } from '../vision-client'
import { D_PULSE_SYSTEM_PROMPT, D_PULSE_USER_PROMPT } from '../prompts/d-pulse-prompt'
import { UA_SYSTEM_PROMPT, UA_USER_PROMPT } from '../prompts/ua-prompt'
import { VCS_SYSTEM_PROMPT, VCS_USER_PROMPT } from '../prompts/vcs-prompt'
import { HRV_SYSTEM_PROMPT, HRV_USER_PROMPT } from '../prompts/hrv-prompt'
import { BRAINWAVE_SYSTEM_PROMPT, BRAINWAVE_USER_PROMPT } from '../prompts/brainwave-prompt'
import { ORTHO_SYSTEM_PROMPT, ORTHO_USER_PROMPT } from '../prompts/ortho-prompt'
import { VALSALVA_SYSTEM_PROMPT, VALSALVA_USER_PROMPT } from '../prompts/valsalva-prompt'
import { LAB_PANEL_SYSTEM_PROMPT } from '../prompts/lab-panel-prompt'
import type { DiagnosticType } from '@/types/shared'
import type {
  ExtractionResult,
  HRVExtractedData,
  DPulseExtractedData,
  UAExtractedData,
  VCSExtractedData,
  BrainwaveExtractedData,
  BloodPanelExtractedData,
  OrthoExtractedData,
  ValsalvaExtractedData,
} from '@/types/diagnostic-extraction'

// Type for extracted data based on diagnostic type
type ExtractedDataMap = {
  d_pulse: DPulseExtractedData
  hrv: HRVExtractedData
  urinalysis: UAExtractedData
  vcs: VCSExtractedData
  brainwave: BrainwaveExtractedData
  ortho: OrthoExtractedData
  valsalva: ValsalvaExtractedData
  blood_panel: BloodPanelExtractedData
  nes_scan: Record<string, unknown>
  mold_toxicity: Record<string, unknown>
  other: Record<string, unknown>
}

/**
 * Check extraction result for multi-test indicators and reduce confidence if found.
 * This pushes multi-test extractions into 'needs_review' status (threshold 0.7).
 */
async function applyMultiTestCheck<T>(
  extraction: Promise<ExtractionResult<T>>,
  fileType: string,
): Promise<ExtractionResult<T>> {
  const result = await extraction
  const findings = (result.data as Record<string, unknown>)?.findings
  const hasMultiTest = Array.isArray(findings) && findings.some(
    (f: unknown) => typeof f === 'string' && String(f).toLowerCase().includes('multiple tests')
  )
  if (hasMultiTest) {
    console.warn(`[Multi-Test] ${fileType}: multiple tests detected on document, reducing confidence by 0.15`)
    return { ...result, confidence: Math.max(0, result.confidence - 0.15) }
  }
  return result
}

/**
 * Extract diagnostic values from an image based on file type
 */
export async function extractDiagnosticValues(
  imageUrl: string,
  fileType: DiagnosticType,
  _mimeType?: string
): Promise<ExtractionResult<ExtractedDataMap[typeof fileType]>> {
  switch (fileType) {
    case 'd_pulse':
      return extractDPulse(imageUrl)
    case 'hrv':
      return applyMultiTestCheck(extractHRV(imageUrl), fileType)
    case 'urinalysis':
      return extractUA(imageUrl)
    case 'vcs':
      return extractVCS(imageUrl)
    case 'brainwave':
      return extractBrainwave(imageUrl)
    case 'ortho':
      return applyMultiTestCheck(extractOrtho(imageUrl), fileType)
    case 'valsalva':
      return applyMultiTestCheck(extractValsalva(imageUrl), fileType)
    case 'blood_panel':
      return extractBloodPanel(imageUrl)
    case 'nes_scan':
    case 'mold_toxicity':
    case 'other':
    default:
      return extractGeneric(imageUrl, fileType)
  }
}

/**
 * D-Pulse extraction
 */
async function extractDPulse(imageUrl: string): Promise<ExtractionResult<DPulseExtractedData>> {
  return extractFromImage<DPulseExtractedData>(imageUrl, D_PULSE_SYSTEM_PROMPT, D_PULSE_USER_PROMPT)
}

/**
 * HRV extraction
 */
async function extractHRV(imageUrl: string): Promise<ExtractionResult<HRVExtractedData>> {
  return extractFromImage<HRVExtractedData>(imageUrl, HRV_SYSTEM_PROMPT, HRV_USER_PROMPT)
}

/**
 * Urinalysis extraction
 */
async function extractUA(imageUrl: string): Promise<ExtractionResult<UAExtractedData>> {
  return extractFromImage<UAExtractedData>(imageUrl, UA_SYSTEM_PROMPT, UA_USER_PROMPT)
}

/**
 * VCS extraction
 */
async function extractVCS(imageUrl: string): Promise<ExtractionResult<VCSExtractedData>> {
  return extractFromImage<VCSExtractedData>(imageUrl, VCS_SYSTEM_PROMPT, VCS_USER_PROMPT)
}

/**
 * Brainwave extraction
 */
async function extractBrainwave(imageUrl: string): Promise<ExtractionResult<BrainwaveExtractedData>> {
  return extractFromImage<BrainwaveExtractedData>(imageUrl, BRAINWAVE_SYSTEM_PROMPT, BRAINWAVE_USER_PROMPT)
}

/**
 * Ortho test extraction (NervExpress)
 */
async function extractOrtho(imageUrl: string): Promise<ExtractionResult<OrthoExtractedData>> {
  return extractFromImage<OrthoExtractedData>(imageUrl, ORTHO_SYSTEM_PROMPT, ORTHO_USER_PROMPT)
}

/**
 * Valsalva test extraction (NervExpress)
 */
async function extractValsalva(imageUrl: string): Promise<ExtractionResult<ValsalvaExtractedData>> {
  return extractFromImage<ValsalvaExtractedData>(imageUrl, VALSALVA_SYSTEM_PROMPT, VALSALVA_USER_PROMPT)
}

/**
 * Blood panel extraction — uses dedicated lab panel prompt with 77 marker aliases
 * for accurate name normalization and abbreviation handling.
 */
async function extractBloodPanel(imageUrl: string): Promise<ExtractionResult<BloodPanelExtractedData>> {
  const userPrompt = `Analyze this blood panel / lab result image.

Extract ALL visible lab markers. Use the normalized marker names from the alias list
in your instructions — this is critical for downstream matching.

Return a JSON object with this EXACT structure:
{
  "markers": [
    {
      "name": "Normalized marker name (use aliases from system prompt)",
      "value": numeric_value_only,
      "unit": "unit of measurement or empty string if not shown",
      "reference_range": "normal range if shown, e.g. '4.0-11.0', or null",
      "status": "low" | "normal" | "high"
    }
  ],
  "ominous_triggers": ["List of markers flagged H or critically out of range"],
  "total_markers": number_of_markers_extracted,
  "out_of_range_count": number_flagged_high_or_low,
  "affected_categories": ["thyroid", "inflammation", "lipids", "cbc", "metabolic", etc],
  "confidence": 0.0 to 1.0
}

IMPORTANT:
- Extract EVERY visible marker, even if uncertain about the match
- Use the NORMALIZED name from the alias list (e.g., "TSH" not "Thyroid Stimulating Hormone")
- Use numeric values only (no symbols, just the number)
- Set status to "high" if flagged H or above reference range
- Set status to "low" if flagged L or below reference range
- Set status to "normal" if within reference range or not flagged
- Include ominous_triggers for any critically abnormal values
- Set high confidence (0.8-1.0) when text is clear
- Set lower confidence (0.5-0.7) when text is blurry or uncertain

Be thorough - extract ALL visible lab values from this image.`

  return extractFromImage<BloodPanelExtractedData>(imageUrl, LAB_PANEL_SYSTEM_PROMPT, userPrompt)
}

/**
 * Generic extraction for unsupported types
 */
async function extractGeneric(imageUrl: string, fileType: string): Promise<ExtractionResult<Record<string, unknown>>> {
  const systemPrompt = `You are analyzing a ${fileType} diagnostic report.
Extract any relevant health data visible in the image.`

  const userPrompt = `Analyze this ${fileType} diagnostic image.

Extract all relevant data you can identify.

Return a JSON object with:
{
  "file_type": "${fileType}",
  "data": {
    // Any extracted values
  },
  "findings": ["List of observations"],
  "confidence": 0.0 to 1.0
}

Extract as much relevant information as possible.`

  return extractFromImage<Record<string, unknown>>(imageUrl, systemPrompt, userPrompt)
}
