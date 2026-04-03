// Vision Extractor for Labs
// Bridges Vision API extraction to Labs parser format

import { extractLabPanel } from '@/lib/vision/extractors/lab-panel-extractor'
import { labMarkers } from '@/data/lab-data'
import { MARKER_ALIASES } from '@/lib/labs/marker-aliases'

// Output format matching pdf-parser.ts
interface ParsedLabValue {
  markerName: string
  markerId: string | null
  value: number
  unit: string | null
  confidence: number
}

interface LabParseResult {
  success: boolean
  values: ParsedLabValue[]
  rawText: string
  warnings: string[]
}

/**
 * Find matching marker in labMarkers database
 */
function findMatchingMarker(testName: string): { id: string; name: string } | null {
  const normalizedTestName = testName.toLowerCase().trim()

  // First try direct match against our markers
  for (const marker of labMarkers) {
    if (
      marker.displayName.toLowerCase() === normalizedTestName ||
      marker.name.toLowerCase() === normalizedTestName
    ) {
      return { id: marker.id, name: marker.displayName }
    }
  }

  // Then try aliases
  for (const [markerName, aliases] of Object.entries(MARKER_ALIASES)) {
    for (const alias of aliases) {
      if (alias.toLowerCase() === normalizedTestName) {
        // Find the marker with this name
        const marker = labMarkers.find(
          (m) =>
            m.displayName.toLowerCase().includes(markerName.toLowerCase()) ||
            m.name.toLowerCase().includes(markerName.toLowerCase())
        )
        if (marker) {
          return { id: marker.id, name: marker.displayName }
        }
      }
    }
  }

  // Try partial match as last resort
  for (const marker of labMarkers) {
    if (
      normalizedTestName.includes(marker.displayName.toLowerCase()) ||
      marker.displayName.toLowerCase().includes(normalizedTestName)
    ) {
      return { id: marker.id, name: marker.displayName }
    }
  }

  return null
}

/**
 * Extract lab panel values from an image using Vision API
 * Returns data in the same format as parseLabPdf() for compatibility
 */
export async function extractLabPanelVision(imageDataUrl: string): Promise<LabParseResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      success: false,
      values: [],
      rawText: '',
      warnings: ['Vision API is not configured (missing ANTHROPIC_API_KEY)'],
    }
  }

  try {
    const visionResult = await extractLabPanel(imageDataUrl)

    if (!visionResult.success) {
      return {
        success: false,
        values: [],
        rawText: visionResult.rawResponse,
        warnings: visionResult.data?.warnings || [visionResult.error || 'Vision extraction failed'],
      }
    }

    const values: ParsedLabValue[] = []
    const warnings: string[] = [...(visionResult.data.warnings || [])]
    const seenMarkers = new Set<string>()

    // Process Vision API results and match to our lab markers
    for (const visionValue of visionResult.data.values) {
      const matchedMarker = findMatchingMarker(visionValue.markerName)

      if (matchedMarker && !seenMarkers.has(matchedMarker.id)) {
        seenMarkers.add(matchedMarker.id)
        values.push({
          markerName: matchedMarker.name,
          markerId: matchedMarker.id,
          value: visionValue.value,
          unit: visionValue.unit,
          confidence: 0.8, // High confidence for matched markers
        })
      } else if (!matchedMarker) {
        // Still track unmatched values with lower confidence
        values.push({
          markerName: visionValue.rawName || visionValue.markerName,
          markerId: null,
          value: visionValue.value,
          unit: visionValue.unit,
          confidence: 0.4,
        })
        warnings.push(
          `Could not match "${visionValue.rawName || visionValue.markerName}" to a known lab marker`
        )
      }
    }

    // Sort by confidence (matched markers first)
    const sortedValues = values.sort((a, b) => b.confidence - a.confidence)

    return {
      success: sortedValues.length > 0,
      values: sortedValues,
      rawText: visionResult.rawResponse,
      warnings,
    }
  } catch (error) {
    console.error('Vision extraction error:', error)
    return {
      success: false,
      values: [],
      rawText: '',
      warnings: [error instanceof Error ? error.message : 'Unknown error'],
    }
  }
}
