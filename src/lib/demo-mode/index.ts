// Demo Mode Logic
// Detects case study files and returns hard-coded responses when demo mode is enabled

import { createClient } from '@/lib/supabase/server'
import { DEMO_RESPONSES, type CaseStudyKey, type DemoResponse } from './responses'

interface DiagnosticFile {
  id: string
  filename: string
  fileType: string
}

/**
 * Check if demo mode is enabled in system_config
 */
export async function isDemoModeEnabled(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<boolean> {
  const { data: setting, error } = await supabase
    .from('system_config')
    .select('value')
    .eq('key', 'demo_mode_enabled')
    .single()

  if (error || !setting) {
    return false
  }

  // Parse the value - stored as JSON string
  const value = typeof setting.value === 'string'
    ? setting.value.replace(/^"|"$/g, '')
    : String(setting.value)

  return value === 'true'
}

/**
 * Detect which case study the diagnostic files belong to
 * Returns null if not a recognized case study
 */
export function detectCaseStudy(files: DiagnosticFile[]): CaseStudyKey | null {
  // Join all filenames for pattern matching
  const joined = files.map(f => f.filename).join(' ').toLowerCase()

  // Check for each case study pattern
  // Order matters - more specific patterns first
  if (joined.includes('thyroid case study 1') || joined.includes('thyroid-case-study-1') || joined.includes('thyroid_case_study_1')) {
    return 'thyroid-cs1'
  }

  if (joined.includes('neuro case study 5') || joined.includes('neuro-case-study-5') || joined.includes('neuro_case_study_5') || joined.includes('neurological case study 5')) {
    return 'neurological-cs5'
  }

  // Note: "Case Study 2" without prefix could be hormones
  if (joined.includes('hormones case study 2') || joined.includes('hormone case study 2') || joined.includes('case study 2')) {
    return 'hormones-cs2'
  }

  if (joined.includes('male case study 4') || joined.includes('diabetes case study 4') || joined.includes('male-case-study-4')) {
    return 'diabetes-cs4'
  }

  return null // Not a recognized case study
}

/**
 * Get the hard-coded demo response for a case study
 */
export function getDemoResponse(caseStudyKey: CaseStudyKey): DemoResponse {
  return DEMO_RESPONSES[caseStudyKey]
}

/**
 * Main entry point: Check if we should return a demo response
 * Returns null if demo mode is off or files don't match a case study
 */
export async function checkDemoMode(
  supabase: Awaited<ReturnType<typeof createClient>>,
  diagnosticFiles: DiagnosticFile[]
): Promise<DemoResponse | null> {
  // First check if demo mode is enabled
  const demoEnabled = await isDemoModeEnabled(supabase)

  if (!demoEnabled) {
    return null
  }

  // Check if these files match a case study
  const caseStudyKey = detectCaseStudy(diagnosticFiles)

  if (!caseStudyKey) {
    console.log('[Demo Mode] Demo mode enabled but files do not match any case study')
    return null
  }

  console.log(`[Demo Mode] Detected case study: ${caseStudyKey} - returning hard-coded response`)

  return getDemoResponse(caseStudyKey)
}

// Re-export types
export type { CaseStudyKey, DemoResponse }
