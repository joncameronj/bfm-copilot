// Lab Panel Vision Extractor
// Extracts lab values from images using Anthropic Vision API

import { extractFromImage } from '../vision-client'
import { LAB_PANEL_SYSTEM_PROMPT, LAB_PANEL_USER_PROMPT } from '../prompts/lab-panel-prompt'
import type { ExtractionResult } from '@/types/diagnostic-extraction'

// Response format from Vision API
interface VisionLabValue {
  markerName: string
  value: number
  unit: string | null
  referenceRange: string | null
  flag: 'H' | 'L' | null
  rawName: string
}

interface VisionLabPanelResponse {
  values: VisionLabValue[]
  summary: {
    totalMarkersFound: number
    flaggedCount: number
    flaggedMarkers: string[]
  }
  warnings: string[]
  confidence: number
}

// Output format matching Labs parser
export interface LabPanelExtractedData {
  values: Array<{
    markerName: string
    value: number
    unit: string | null
    referenceRange: string | null
    flag: 'H' | 'L' | null
    rawName: string
    confidence: number
  }>
  summary: {
    totalMarkersFound: number
    flaggedCount: number
    flaggedMarkers: string[]
  }
  warnings: string[]
}

/**
 * Extract lab panel values from an image using Vision API
 */
export async function extractLabPanel(
  imageUrl: string
): Promise<ExtractionResult<LabPanelExtractedData>> {
  try {
    const result = await extractFromImage<VisionLabPanelResponse>(
      imageUrl,
      LAB_PANEL_SYSTEM_PROMPT,
      LAB_PANEL_USER_PROMPT,
      4000 // Max tokens
    )

    if (!result.success) {
      return {
        success: false,
        data: {
          values: [],
          summary: {
            totalMarkersFound: 0,
            flaggedCount: 0,
            flaggedMarkers: [],
          },
          warnings: [result.error || 'Vision extraction failed'],
        },
        confidence: 0,
        rawResponse: result.rawResponse,
        error: result.error,
      }
    }

    // Process and enhance the values with confidence scores
    const processedValues = (result.data.values || []).map((v) => ({
      markerName: v.markerName,
      value: v.value,
      unit: v.unit,
      referenceRange: v.referenceRange,
      flag: v.flag,
      rawName: v.rawName || v.markerName,
      confidence: result.confidence, // Use overall confidence for each value
    }))

    return {
      success: true,
      data: {
        values: processedValues,
        summary: result.data.summary || {
          totalMarkersFound: processedValues.length,
          flaggedCount: processedValues.filter((v) => v.flag).length,
          flaggedMarkers: processedValues.filter((v) => v.flag).map((v) => v.markerName),
        },
        warnings: result.data.warnings || [],
      },
      confidence: result.confidence,
      rawResponse: result.rawResponse,
    }
  } catch (error) {
    console.error('Lab panel Vision extraction error:', error)
    return {
      success: false,
      data: {
        values: [],
        summary: {
          totalMarkersFound: 0,
          flaggedCount: 0,
          flaggedMarkers: [],
        },
        warnings: [error instanceof Error ? error.message : 'Unknown error'],
      },
      confidence: 0,
      rawResponse: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
