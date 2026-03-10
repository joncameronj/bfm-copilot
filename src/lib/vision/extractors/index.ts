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
      return extractHRV(imageUrl)
    case 'urinalysis':
      return extractUA(imageUrl)
    case 'vcs':
      return extractVCS(imageUrl)
    case 'brainwave':
      return extractBrainwave(imageUrl)
    case 'ortho':
      return extractOrtho(imageUrl)
    case 'valsalva':
      return extractValsalva(imageUrl)
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
 * Blood panel extraction
 */
async function extractBloodPanel(imageUrl: string): Promise<ExtractionResult<BloodPanelExtractedData>> {
  const systemPrompt = `You are an expert at analyzing blood panel / lab results.
Extract all visible lab markers with their values, units, and reference ranges.
Identify any markers that are out of range (high or low).
Look for "ominous markers" - critical values that require attention.`

  const userPrompt = `Analyze this blood panel / lab result image.

Extract ALL visible lab markers.

Return a JSON object with this structure:
{
  "markers": [
    {
      "name": "Marker name",
      "value": numeric_value,
      "unit": "unit of measurement",
      "reference_range": "normal range if shown",
      "status": "low" | "normal" | "high"
    }
  ],
  "ominous_triggers": ["List of critical/ominous markers identified"],
  "total_markers": number_of_markers_extracted,
  "out_of_range_count": number_outside_normal,
  "affected_categories": ["thyroid", "inflammation", etc],
  "confidence": 0.0 to 1.0
}

Be thorough - extract ALL visible markers.`

  return extractFromImage<BloodPanelExtractedData>(imageUrl, systemPrompt, userPrompt)
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
