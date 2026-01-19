/**
 * Persist blood panel data from diagnostic extraction to lab tables
 *
 * When blood work is uploaded through the diagnostics flow, the extracted data
 * should also be saved to lab_results and lab_values tables so it appears in
 * the patient's lab section and can be used for supplementation recommendations.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { BloodPanelExtractedData, BloodMarker } from '@/types/diagnostic-extraction'

interface PersistResult {
  success: boolean
  labResultId?: string
  labValuesCount?: number
  error?: string
}

/**
 * Persist blood panel extracted data to lab_results and lab_values tables.
 * This bridges the diagnostic extraction flow with the existing lab tracking system.
 */
export async function persistBloodPanelToLabTables(
  supabase: SupabaseClient,
  extractedData: BloodPanelExtractedData,
  uploadId: string,
  userId: string
): Promise<PersistResult> {
  try {
    // 1. Get patient_id from diagnostic_uploads
    const { data: upload, error: uploadError } = await supabase
      .from('diagnostic_uploads')
      .select('patient_id')
      .eq('id', uploadId)
      .single()

    if (uploadError || !upload?.patient_id) {
      return {
        success: false,
        error: `Failed to get patient_id from upload: ${uploadError?.message || 'Upload not found'}`,
      }
    }

    const patientId = upload.patient_id

    // 2. Create lab_results record
    const { data: labResult, error: labResultError } = await supabase
      .from('lab_results')
      .insert({
        patient_id: patientId,
        user_id: userId,
        test_date: new Date().toISOString().split('T')[0],
        ominous_count: extractedData.ominous_triggers?.length || 0,
        ominous_markers_triggered: extractedData.ominous_triggers || [],
        notes: `Auto-extracted from diagnostic upload`,
        source_type: 'diagnostic_upload',
      })
      .select('id')
      .single()

    if (labResultError || !labResult) {
      return {
        success: false,
        error: `Failed to create lab_results: ${labResultError?.message}`,
      }
    }

    const labResultId = labResult.id

    // 3. Get lab_markers for name matching
    const { data: labMarkers, error: markersError } = await supabase
      .from('lab_markers')
      .select('id, name, display_name')

    if (markersError) {
      console.warn('Failed to fetch lab_markers:', markersError.message)
      // Continue without lab values - the lab result is still created
      return {
        success: true,
        labResultId,
        labValuesCount: 0,
      }
    }

    // Build marker name lookup map (case-insensitive)
    const markerMap = new Map<string, string>()
    for (const marker of labMarkers || []) {
      // Add both name and display_name for matching
      markerMap.set(marker.name.toLowerCase().trim(), marker.id)
      if (marker.display_name) {
        markerMap.set(marker.display_name.toLowerCase().trim(), marker.id)
      }
    }

    // 4. Map extracted markers to lab_values
    const labValues: Array<{
      lab_result_id: string
      marker_id: string
      value: number
      evaluation: string
      is_ominous: boolean
    }> = []

    const ominousTriggers = new Set(
      (extractedData.ominous_triggers || []).map(t => t.toLowerCase().trim())
    )

    for (const marker of extractedData.markers || []) {
      const markerId = findMarkerId(marker, markerMap)
      if (markerId) {
        labValues.push({
          lab_result_id: labResultId,
          marker_id: markerId,
          value: marker.value,
          evaluation: marker.status === 'high' ? 'high' : marker.status === 'low' ? 'low' : 'normal',
          is_ominous: ominousTriggers.has(marker.name.toLowerCase().trim()),
        })
      } else {
        console.warn(`[Lab Persist] No marker match for: "${marker.name}"`)
      }
    }

    // 5. Insert lab_values if we have any matches
    if (labValues.length > 0) {
      const { error: valuesError } = await supabase
        .from('lab_values')
        .insert(labValues)

      if (valuesError) {
        console.error('Failed to insert lab_values:', valuesError.message)
        // Don't fail the whole operation - lab_result is still created
      }
    }

    console.log(
      `[Lab Persist] Created lab_result ${labResultId} with ${labValues.length} values for patient ${patientId}`
    )

    return {
      success: true,
      labResultId,
      labValuesCount: labValues.length,
    }
  } catch (error) {
    console.error('[Lab Persist] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Find the marker ID by trying various name matching strategies
 */
function findMarkerId(
  marker: BloodMarker,
  markerMap: Map<string, string>
): string | undefined {
  const name = marker.name.toLowerCase().trim()

  // Direct match
  if (markerMap.has(name)) {
    return markerMap.get(name)
  }

  // Try common abbreviation mappings
  const abbreviationMap: Record<string, string[]> = {
    'wbc': ['white blood cell count', 'white blood cells'],
    'rbc': ['red blood cell count', 'red blood cells'],
    'hgb': ['hemoglobin'],
    'hct': ['hematocrit'],
    'mcv': ['mean corpuscular volume'],
    'mch': ['mean corpuscular hemoglobin'],
    'mchc': ['mean corpuscular hemoglobin concentration'],
    'rdw': ['red cell distribution width'],
    'plt': ['platelet count', 'platelets'],
    'mpv': ['mean platelet volume'],
    'tsh': ['thyroid stimulating hormone'],
    't4': ['thyroxine'],
    't3': ['triiodothyronine'],
    'ft4': ['free thyroxine', 'free t4'],
    'ft3': ['free triiodothyronine', 'free t3'],
    'alt': ['alanine aminotransferase', 'sgpt'],
    'ast': ['aspartate aminotransferase', 'sgot'],
    'alp': ['alkaline phosphatase'],
    'ggt': ['gamma-glutamyl transferase'],
    'bun': ['blood urea nitrogen'],
    'egfr': ['estimated glomerular filtration rate'],
    'crp': ['c-reactive protein'],
    'ldl': ['ldl cholesterol', 'low density lipoprotein'],
    'hdl': ['hdl cholesterol', 'high density lipoprotein'],
    'vldl': ['vldl cholesterol', 'very low density lipoprotein'],
    'a1c': ['hemoglobin a1c', 'hba1c', 'glycated hemoglobin'],
  }

  // Try abbreviation expansion
  const expansions = abbreviationMap[name]
  if (expansions) {
    for (const exp of expansions) {
      if (markerMap.has(exp)) {
        return markerMap.get(exp)
      }
    }
  }

  // Try reverse lookup (if extracted name is the full form)
  for (const [abbr, expansions] of Object.entries(abbreviationMap)) {
    if (expansions.includes(name) && markerMap.has(abbr)) {
      return markerMap.get(abbr)
    }
  }

  // Try partial match as last resort
  for (const [mapName, id] of markerMap) {
    if (mapName.includes(name) || name.includes(mapName)) {
      return id
    }
  }

  return undefined
}
