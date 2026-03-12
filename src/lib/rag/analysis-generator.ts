// Diagnostic Analysis Generator
// Runs Protocol Engine (deterministic) → Eval Agent (Claude Opus) → frequency validation → save
// The eval agent replaces the previous RAG + TypeScript AI call pipeline.

import { createClient } from '@/lib/supabase/server'
import { getPythonAgentUrl } from '@/lib/agent/url'
import {
  filterAndValidateProtocol,
  deduplicateFrequenciesAcrossProtocols,
  type BatchValidationResult,
} from './frequency-validator'
import { logValidationTelemetry } from './validation-telemetry'
import { checkDemoMode } from '@/lib/demo-mode'
import { mapEvalReportToGeneratedAnalysis, type EvalReport } from './eval-to-protocols'
import type { RecommendedFrequency, Supplementation } from '@/types/diagnostic-analysis'
import type { DiagnosticDataSummary } from '@/types/diagnostic-extraction'

// ============================================
// TYPES
// ============================================

interface PatientContext {
  id: string
  firstName: string
  lastName: string
  gender: string
  dateOfBirth: string
  chiefComplaints: string | null
  medicalHistory: string | null
  currentMedications: string[] | null
  allergies: string[] | null
}

interface DiagnosticFile {
  id: string
  filename: string
  fileType: string
}

interface ProtocolEngineResult {
  protocols: Array<{
    name: string
    priority: number
    trigger: string
    category: string
    notes: string
  }>
  supplements: Array<{
    name: string
    trigger: string
    dosage: string
    timing: string
    notes: string
  }>
  deal_breakers: string[]
  cross_correlations: string[]
}

interface GeneratedAnalysis {
  summary: string
  protocols: Array<{
    title: string
    description: string
    category: string
    frequencies: RecommendedFrequency[]
    priority: number
  }>
  supplementation: Supplementation[]
  ragContext: never[] // Empty — eval agent uses inline protocols, not RAG
  reasoningChain: string[]
  extractedData: DiagnosticDataSummary | null
  evalReport?: EvalReport // Full eval report for rich frontend display
}

// ============================================
// MAIN ANALYSIS GENERATOR
// ============================================

export async function generateDiagnosticAnalysis(
  diagnosticUploadId: string,
  patientId: string,
  practitionerId: string,
  userRole: 'practitioner' | 'member' = 'practitioner'
): Promise<GeneratedAnalysis> {
  const supabase = await createClient()

  // 1. Get patient context
  const { data: patient, error: patientError } = await supabase
    .from('patients')
    .select('id, first_name, last_name, gender, date_of_birth, chief_complaints, medical_history, current_medications, allergies')
    .eq('id', patientId)
    .single()

  if (patientError || !patient) {
    throw new Error('Patient not found')
  }

  const patientContext: PatientContext = {
    id: patient.id,
    firstName: patient.first_name,
    lastName: patient.last_name,
    gender: patient.gender,
    dateOfBirth: patient.date_of_birth,
    chiefComplaints: patient.chief_complaints,
    medicalHistory: patient.medical_history,
    currentMedications: patient.current_medications,
    allergies: patient.allergies,
  }

  // 2. Get diagnostic files
  const { data: diagnosticFilesRaw, error: filesError } = await supabase
    .from('diagnostic_files')
    .select('id, filename, file_type')
    .eq('upload_id', diagnosticUploadId)

  if (filesError) {
    throw new Error('Failed to fetch diagnostic files')
  }

  const diagnosticFiles: DiagnosticFile[] = (diagnosticFilesRaw || []).map((f) => ({
    id: f.id,
    filename: f.filename,
    fileType: f.file_type,
  }))

  // 2a. Check for demo mode
  const demoResponse = await checkDemoMode(supabase, diagnosticFiles)
  if (demoResponse) {
    const extractedData = await getExtractedDiagnosticData(diagnosticUploadId, supabase)
    return {
      ...demoResponse,
      ragContext: [],
      extractedData,
    }
  }

  // 3. Fetch extracted diagnostic values (from Vision API)
  const extractedData = await getExtractedDiagnosticData(diagnosticUploadId, supabase)

  // 4. Run deterministic protocol engine on extracted data
  let engineResult: ProtocolEngineResult | null = null
  if (extractedData) {
    try {
      const engineInput = {
        ...extractedData,
        patient_context: {
          chief_complaints: patientContext.chiefComplaints,
          medical_history: patientContext.medicalHistory,
          current_medications: patientContext.currentMedications ?? [],
          allergies: patientContext.allergies ?? [],
        },
      }

      const engineResponse = await fetch(`${getPythonAgentUrl()}/agent/protocols/engine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extracted_data: engineInput }),
      })
      if (engineResponse.ok) {
        engineResult = await engineResponse.json() as ProtocolEngineResult
        console.log(
          `[Protocol Engine] Found ${engineResult.protocols.length} protocols, ` +
          `${engineResult.supplements.length} supplements, ` +
          `${engineResult.deal_breakers.length} deal breakers`
        )
      } else {
        console.warn(`[Protocol Engine] Failed: ${engineResponse.status} ${engineResponse.statusText}`)
      }
    } catch (engineError) {
      console.warn('[Protocol Engine] Unavailable, eval agent will handle all protocols:', engineError)
    }
  }

  // 5. Guard: eval agent requires extracted data
  // getExtractedDiagnosticData always returns an object (never null) — check if it has real data
  const hasExtractedData = extractedData && (
    extractedData.hrv !== null ||
    extractedData.dPulse !== null ||
    extractedData.ua !== null ||
    extractedData.vcs !== null ||
    extractedData.brainwave !== null ||
    extractedData.ortho !== null ||
    extractedData.valsalva !== null ||
    extractedData.bloodPanel !== null
  )
  if (!hasExtractedData) {
    throw new Error(
      'No extracted diagnostic data available for this upload. ' +
      'Ensure diagnostic files have been uploaded and extraction has completed before generating analysis.'
    )
  }

  // 6. Handle member role — educational-only response (no protocols)
  if (userRole === 'member') {
    return {
      summary: 'Your diagnostic results have been reviewed. For treatment guidance, please consult with your practitioner or refer to your program materials.',
      protocols: [],
      supplementation: [],
      ragContext: [],
      reasoningChain: [],
      extractedData,
    }
  }

  // 7. Find the diagnostic_analysis_id for the eval agent
  // The generate-analysis route creates a pending record before calling us.
  // We need that ID to pass to the eval agent.
  const { data: analysisRecord } = await supabase
    .from('diagnostic_analyses')
    .select('id')
    .eq('diagnostic_upload_id', diagnosticUploadId)
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!analysisRecord) {
    throw new Error('No diagnostic analysis record found for this upload')
  }

  // 8. Call the Python eval agent (synchronous — ~3-5 min)
  const pythonAgentUrl = getPythonAgentUrl()
  console.log(`[Eval Agent] Calling POST ${pythonAgentUrl}/agent/eval/for-analysis`)

  const evalResponse = await fetch(`${pythonAgentUrl}/agent/eval/for-analysis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      diagnostic_analysis_id: analysisRecord.id,
      patient_id: patientId,
    }),
  })

  if (!evalResponse.ok) {
    const errorBody = await evalResponse.text()
    throw new Error(`Eval agent failed (${evalResponse.status}): ${errorBody}`)
  }

  const evalData = await evalResponse.json() as { eval_report: EvalReport; patient_name: string }
  const evalReport = evalData.eval_report as EvalReport

  console.log(
    `[Eval Agent] Complete: urgency=${evalReport.urgency?.score}, ` +
    `frequencies=${evalReport.frequency_phases?.length}, ` +
    `supplements=${evalReport.supplementation?.length}, ` +
    `deal_breakers=${evalReport.deal_breakers?.length}`
  )

  // 9. Map EvalReport → GeneratedAnalysis shape
  const mapped = mapEvalReportToGeneratedAnalysis(evalReport)

  // 10. Validate ALL frequencies against approved list
  const validatedProtocols: Array<{
    title: string
    description: string
    category: string
    frequencies: RecommendedFrequency[]
    priority: number
    validationReport?: BatchValidationResult
  }> = []

  for (const p of mapped.protocols) {
    const rawFrequencies = p.frequencies.map(f => ({
      name: f.name || '',
      rationale: f.rationale,
    }))

    const { filteredProtocol, validationReport } = await filterAndValidateProtocol({
      title: p.title,
      frequencies: rawFrequencies,
    })

    // Log validation telemetry (non-blocking)
    if (validationReport.validCount > 0 || validationReport.rejectedCount > 0) {
      const aiRationales = new Map<string, string>()
      for (const f of rawFrequencies) {
        if (f.rationale) {
          aiRationales.set(f.name, f.rationale)
        }
      }

      logValidationTelemetry(
        { diagnosticUploadId },
        validationReport,
        aiRationales,
      ).catch(err => console.error('[Telemetry] Failed to log:', err))
    }

    if (validationReport.rejectedCount > 0) {
      console.warn(
        `[Frequency Validation] Protocol "${p.title}": ${validationReport.rejectedCount} frequencies rejected:`,
        validationReport.rejectedFrequencies.map(f => ({
          name: f.frequencyName,
          reason: f.rejectionReason,
          error: f.error,
        }))
      )
    }

    if (filteredProtocol.frequencies.length > 0) {
      validatedProtocols.push({
        title: p.title,
        description: p.description,
        category: p.category,
        frequencies: filteredProtocol.frequencies.map(f => ({
          id: crypto.randomUUID(),
          name: f.name,
          rationale: f.rationale,
        })),
        priority: p.priority,
        validationReport,
      })
    } else {
      console.warn(`[Frequency Validation] Protocol "${p.title}" dropped - no valid frequencies`)
    }
  }

  // 11. Deduplicate frequencies across all protocols
  const {
    deduplicatedProtocols,
    deduplicationLog,
    totalDeduplicated,
  } = deduplicateFrequenciesAcrossProtocols(validatedProtocols)

  if (totalDeduplicated > 0) {
    console.log(
      `[Frequency Deduplication] Removed ${totalDeduplicated} duplicate frequencies:`,
      deduplicationLog.map((d) => ({
        frequency: d.frequencyName,
        keptIn: d.keptInProtocol,
        removedFrom: d.removedFromProtocols,
      }))
    )
  }

  // 12. Engine reconciliation DISABLED — the eval agent with all 9 master protocols
  // inline is the ground truth. The deterministic engine was injecting incorrect
  // protocols (e.g., SNS Balance when switched_sympathetics=false) because it trusts
  // Vision extraction booleans without clinical context. The eval agent (Claude Opus)
  // interprets data holistically and produces more accurate results.
  // Engine results are still logged above (step 4) for debugging/telemetry.

  return {
    summary: mapped.summary,
    protocols: deduplicatedProtocols,
    supplementation: mapped.supplementation,
    ragContext: [],
    reasoningChain: mapped.reasoningChain,
    extractedData,
    evalReport,
  }
}

// ============================================
// EXTRACTED DATA FETCHER
// ============================================

/**
 * Fetch extracted diagnostic values from Vision API processing
 */
async function getExtractedDiagnosticData(
  diagnosticUploadId: string,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<DiagnosticDataSummary | null> {
  try {
    const { data: files, error } = await supabase
      .from('diagnostic_files')
      .select(`
        id,
        file_type,
        filename,
        diagnostic_extracted_values(
          extracted_data,
          extraction_confidence,
          status
        )
      `)
      .eq('upload_id', diagnosticUploadId)

    if (error || !files) {
      console.warn('No extracted diagnostic data found:', error?.message)
      return null
    }

    const summary: DiagnosticDataSummary = {
      hrv: null,
      dPulse: null,
      ua: null,
      vcs: null,
      brainwave: null,
      ortho: null,
      valsalva: null,
      bloodPanel: null,
      dealBreakers: [],
      findings: [],
      protocolTriggers: {
        phLow: false,
        proteinPositive: false,
        vcsLow: false,
      },
    }

    files.forEach((file) => {
      const extraction = (file.diagnostic_extracted_values as Array<{
        extracted_data: Record<string, unknown>
        extraction_confidence: number
        status: string
      }>)?.[0]

      if (!extraction || (extraction.status !== 'complete' && extraction.status !== 'needs_review')) return

      const data = extraction.extracted_data

      switch (file.file_type) {
        case 'hrv':
          summary.hrv = data as unknown as DiagnosticDataSummary['hrv']
          if (data.findings && Array.isArray(data.findings)) {
            summary.findings.push(...(data.findings as string[]))
          }
          if (data.deal_breakers && Array.isArray(data.deal_breakers)) {
            summary.dealBreakers.push(...(data.deal_breakers as string[]))
          }
          if (data.brainwave && !summary.brainwave) {
            const bw = data.brainwave as Record<string, number>
            summary.brainwave = {
              alpha: { value: bw.alpha, status: bw.alpha < 10 ? 'low' : bw.alpha > 25 ? 'high' : 'normal' },
              beta: { value: bw.beta, status: bw.beta > 25 ? 'high' : 'normal' },
              delta: { value: bw.delta, status: bw.delta > 20 ? 'high' : 'normal' },
              gamma: { value: bw.gamma, status: bw.gamma > 30 ? 'high' : 'normal' },
              theta: { value: bw.theta, status: bw.theta > bw.alpha ? 'high' : 'normal' },
              patterns: {
                dominant_wave: (['delta', 'theta', 'alpha', 'beta', 'gamma'] as const)
                  .reduce((max, wave) => (bw[wave] ?? 0) > (bw[max] ?? 0) ? wave : max, 'alpha' as const),
                imbalances: [
                  ...(bw.alpha < 10 ? ['Low alpha'] : []),
                  ...(bw.beta > 25 ? ['High beta'] : []),
                  ...(bw.gamma > 30 ? ['High gamma'] : []),
                  ...(bw.delta > 20 ? ['High waking delta'] : []),
                  ...(bw.theta > bw.alpha ? ['Theta > Alpha (reversed field)'] : []),
                ],
              },
              findings: [],
              fsm_indicators: [],
            } as unknown as DiagnosticDataSummary['brainwave']
          }
          break

        case 'd_pulse':
          summary.dPulse = data as unknown as DiagnosticDataSummary['dPulse']
          if (data.deal_breakers && Array.isArray(data.deal_breakers)) {
            summary.dealBreakers.push(...(data.deal_breakers as string[]))
          }
          break

        case 'urinalysis':
          summary.ua = data as unknown as DiagnosticDataSummary['ua']
          if (data.findings && Array.isArray(data.findings)) {
            summary.findings.push(...(data.findings as string[]))
          }
          {
            const ph = data.ph as { value?: number; status?: string } | undefined
            if (ph?.status === 'low' || (ph?.value && ph.value < 6.5)) {
              summary.protocolTriggers.phLow = true
            }
            const protein = data.protein as { status?: string } | undefined
            if (protein?.status === 'trace' || protein?.status === 'positive') {
              summary.protocolTriggers.proteinPositive = true
            }
            const vcsFromUA = data.vcs_score as { correct?: number; total?: number; passed?: boolean } | undefined
            if (vcsFromUA && !summary.vcs) {
              if (vcsFromUA.passed === false) {
                summary.protocolTriggers.vcsLow = true
              }
              summary.vcs = {
                passed: vcsFromUA.passed ?? true,
                biotoxin_likely: vcsFromUA.passed === false,
                severity: vcsFromUA.passed === false ? 'moderate' : 'none',
                findings: vcsFromUA.passed === false
                  ? [`VCS ${vcsFromUA.correct}/${vcsFromUA.total} - FAILED (below 24/32 threshold)`]
                  : [`VCS ${vcsFromUA.correct}/${vcsFromUA.total} - passing`],
              } as unknown as DiagnosticDataSummary['vcs']
            }
          }
          break

        case 'vcs':
          summary.vcs = data as unknown as DiagnosticDataSummary['vcs']
          if (data.findings && Array.isArray(data.findings)) {
            summary.findings.push(...(data.findings as string[]))
          }
          if (data.passed === false || data.biotoxin_likely === true) {
            summary.protocolTriggers.vcsLow = true
          }
          break

        case 'brainwave':
          summary.brainwave = data as unknown as DiagnosticDataSummary['brainwave']
          if (data.findings && Array.isArray(data.findings)) {
            summary.findings.push(...(data.findings as string[]))
          }
          break

        case 'blood_panel':
          summary.bloodPanel = data as unknown as DiagnosticDataSummary['bloodPanel']
          if (data.ominous_triggers && Array.isArray(data.ominous_triggers)) {
            summary.dealBreakers.push(...(data.ominous_triggers as string[]))
          }
          break

        case 'ortho':
          summary.ortho = data as unknown as DiagnosticDataSummary['ortho']
          if (data.findings && Array.isArray(data.findings)) {
            summary.findings.push(...(data.findings as string[]))
          }
          break

        case 'valsalva':
          summary.valsalva = data as unknown as DiagnosticDataSummary['valsalva']
          if (data.findings && Array.isArray(data.findings)) {
            summary.findings.push(...(data.findings as string[]))
          }
          break
      }
    })

    return summary
  } catch (err) {
    console.error('Error fetching extracted diagnostic data:', err)
    return null
  }
}

// ============================================
// SAVE ANALYSIS TO DATABASE
// ============================================

export async function saveAnalysisToDatabase(
  diagnosticUploadId: string,
  patientId: string,
  practitionerId: string,
  analysis: GeneratedAnalysis
): Promise<{ analysisId: string; recommendationIds: string[] }> {
  const supabase = await createClient()

  // 1. Create diagnostic_analyses record
  const { data: analysisRecord, error: analysisError } = await supabase
    .from('diagnostic_analyses')
    .insert({
      diagnostic_upload_id: diagnosticUploadId,
      patient_id: patientId,
      practitioner_id: practitionerId,
      summary: analysis.summary,
      raw_analysis: {
        protocols: analysis.protocols,
        supplementation: analysis.supplementation,
        eval_report: analysis.evalReport || null,
      },
      supplementation: analysis.supplementation || [],
      status: 'complete',
      is_archived: false,
      rag_context: {},
    })
    .select('id')
    .single()

  if (analysisError || !analysisRecord) {
    throw new Error(`Failed to save analysis: ${analysisError?.message}`)
  }

  const analysisId = analysisRecord.id

  // 2. Create protocol_recommendations records
  const recommendationIds: string[] = []

  for (const protocol of analysis.protocols) {
    const { data: recRecord, error: recError } = await supabase
      .from('protocol_recommendations')
      .insert({
        diagnostic_analysis_id: analysisId,
        patient_id: patientId,
        title: protocol.title,
        description: protocol.description,
        category: protocol.category,
        recommended_frequencies: protocol.frequencies,
        supplementation: [],
        priority: protocol.priority,
        status: 'recommended',
      })
      .select('id')
      .single()

    if (recError) {
      console.error('Failed to save recommendation:', recError)
      continue
    }

    if (recRecord) {
      recommendationIds.push(recRecord.id)
    }
  }

  return { analysisId, recommendationIds }
}
