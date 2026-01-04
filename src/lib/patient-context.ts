import { SupabaseClient } from '@supabase/supabase-js'
import type { PatientChatContext, QuickAction } from '@/types/patient-context'

/**
 * Calculate age from date of birth
 */
function calculateAge(dateOfBirth: string): number {
  const today = new Date()
  const birthDate = new Date(dateOfBirth)
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  return age
}

/**
 * Build complete patient context for chat
 */
export async function buildPatientChatContext(
  supabase: SupabaseClient,
  patientId: string
): Promise<PatientChatContext> {
  // Fetch patient with related data
  const { data: patient, error: patientError } = await supabase
    .from('patients')
    .select(`
      id,
      first_name,
      last_name,
      date_of_birth,
      gender,
      email,
      phone,
      chief_complaints,
      medical_history,
      current_medications,
      allergies,
      status
    `)
    .eq('id', patientId)
    .single()

  if (patientError || !patient) {
    throw new Error(`Patient not found: ${patientId}`)
  }

  // Fetch lab results
  const { data: labs } = await supabase
    .from('lab_results')
    .select('id, test_date, ominous_count, ominous_markers_triggered')
    .eq('patient_id', patientId)
    .order('test_date', { ascending: false })

  // Fetch diagnostic analyses
  const { data: analyses } = await supabase
    .from('diagnostic_analyses')
    .select(`
      id,
      summary,
      status,
      created_at,
      protocol_recommendations (
        id,
        status
      )
    `)
    .eq('patient_id', patientId)
    .eq('status', 'complete')
    .order('created_at', { ascending: false })

  // Fetch treatment sessions
  const { data: sessions } = await supabase
    .from('treatment_sessions')
    .select('id, session_date, effect, frequencies_used')
    .eq('patient_id', patientId)
    .order('session_date', { ascending: false })

  // Process lab data
  const labResults = labs || []
  const latestLab = labResults[0]
  const allOminousMarkers = labResults
    .flatMap(lab => lab.ominous_markers_triggered || [])
    .filter((marker, index, self) => self.indexOf(marker) === index)
    .slice(0, 10)

  // Process diagnostic data
  const diagnosticAnalyses = analyses || []
  const latestAnalysis = diagnosticAnalyses[0]
  const pendingRecommendations = diagnosticAnalyses
    .flatMap(a => (a.protocol_recommendations as { id: string; status: string }[]) || [])
    .filter(r => r.status === 'recommended')
    .length

  // Process treatment data
  const treatmentSessions = sessions || []
  const positiveOutcomes = treatmentSessions.filter(s => s.effect === 'positive').length
  const recentFrequencies = treatmentSessions
    .slice(0, 5)
    .flatMap(s => {
      const freqs = s.frequencies_used as { name: string }[] | null
      return freqs?.map(f => f.name) || []
    })
    .filter((name, index, self) => self.indexOf(name) === index)
    .slice(0, 5)

  return {
    patient: {
      id: patient.id,
      name: `${patient.first_name} ${patient.last_name}`,
      age: calculateAge(patient.date_of_birth),
      gender: patient.gender,
      dateOfBirth: patient.date_of_birth,
      email: patient.email || undefined,
      phone: patient.phone || undefined,
      status: patient.status,
    },
    clinical: {
      chiefComplaints: patient.chief_complaints || '',
      medicalHistory: patient.medical_history || '',
      currentMedications: patient.current_medications || [],
      allergies: patient.allergies || [],
    },
    labs: {
      hasLabs: labResults.length > 0,
      count: labResults.length,
      latestLabDate: latestLab?.test_date,
      ominousMarkersCount: labResults.reduce((sum, lab) => sum + (lab.ominous_count || 0), 0),
      ominousMarkers: allOminousMarkers.length > 0 ? allOminousMarkers : undefined,
    },
    diagnostics: {
      hasAnalyses: diagnosticAnalyses.length > 0,
      count: diagnosticAnalyses.length,
      latestAnalysisSummary: latestAnalysis?.summary?.slice(0, 200),
      pendingRecommendations,
    },
    treatments: {
      hasTreatments: treatmentSessions.length > 0,
      totalSessions: treatmentSessions.length,
      lastSessionDate: treatmentSessions[0]?.session_date,
      positiveOutcomes,
      recentFrequencies: recentFrequencies.length > 0 ? recentFrequencies : undefined,
    },
  }
}

/**
 * Generate contextual quick actions based on patient data
 */
export function generateQuickActions(context: PatientChatContext): QuickAction[] {
  const actions: QuickAction[] = []

  // Always add chief complaint action if they have one
  if (context.clinical.chiefComplaints) {
    actions.push({
      id: 'analyze-complaint',
      label: 'Analyze Chief Complaint',
      icon: 'Search01Icon',
      prompt: `Please analyze ${context.patient.name}'s chief complaint: "${context.clinical.chiefComplaints}". Consider their medical history and suggest potential FSM protocols.`,
    })
  }

  // Lab-based actions
  if (context.labs.hasLabs) {
    if (context.labs.ominousMarkersCount && context.labs.ominousMarkersCount > 0) {
      actions.push({
        id: 'review-ominous',
        label: 'Review Ominous Markers',
        icon: 'Alert02Icon',
        prompt: `Review the ominous markers found in ${context.patient.name}'s labs: ${context.labs.ominousMarkers?.join(', ')}. What do these indicate and what protocols might help?`,
      })
    } else {
      actions.push({
        id: 'review-labs',
        label: 'Review Lab Results',
        icon: 'TestTube01Icon',
        prompt: `Summarize ${context.patient.name}'s lab results and identify any areas of concern or optimization opportunities.`,
      })
    }
  } else {
    actions.push({
      id: 'no-labs',
      label: 'Discuss Without Labs',
      icon: 'MessageQuestion01Icon',
      prompt: `${context.patient.name} doesn't have labs on file yet. Based on their chief complaint "${context.clinical.chiefComplaints || 'not specified'}" and medical history, what initial protocols would you suggest?`,
    })
  }

  // Diagnostic-based actions
  if (context.diagnostics.hasAnalyses) {
    if (context.diagnostics.pendingRecommendations && context.diagnostics.pendingRecommendations > 0) {
      actions.push({
        id: 'pending-protocols',
        label: `${context.diagnostics.pendingRecommendations} Pending Protocols`,
        icon: 'Clipboard01Icon',
        prompt: `${context.patient.name} has ${context.diagnostics.pendingRecommendations} pending protocol recommendations. Review these and help me decide which to execute first.`,
      })
    }
  }

  // Treatment-based actions
  if (context.treatments.hasTreatments) {
    actions.push({
      id: 'review-progress',
      label: 'Review Treatment Progress',
      icon: 'ChartLineData01Icon',
      prompt: `Review ${context.patient.name}'s treatment history (${context.treatments.totalSessions} sessions, ${context.treatments.positiveOutcomes} positive outcomes). What patterns do you see and what should we try next?`,
    })
  } else {
    actions.push({
      id: 'start-treatment',
      label: 'Start Treatment Plan',
      icon: 'HeartbeatIcon',
      prompt: `Help me create an initial treatment plan for ${context.patient.name}. They present with "${context.clinical.chiefComplaints || 'symptoms not specified'}".`,
    })
  }

  // Limit to 3 actions for clean UI
  return actions.slice(0, 3)
}

/**
 * Format patient context as a system message for the AI
 */
export function formatContextForAI(context: PatientChatContext): string {
  const lines: string[] = [
    '[PATIENT_CONTEXT]',
    JSON.stringify(context, null, 2),
    '[/PATIENT_CONTEXT]',
    '',
    'You have received full context about this patient. Generate a brief opening message that:',
    '1. Confirms you\'ve reviewed their profile',
    '2. Summarizes key points: chief complaint, relevant history, medications',
    '3. Notes any concerning items (ominous markers, allergies)',
    '4. Ends with "What would you like help with today?"',
    '',
    'Keep it concise (3-4 sentences). Be professional but warm.',
  ]
  return lines.join('\n')
}
