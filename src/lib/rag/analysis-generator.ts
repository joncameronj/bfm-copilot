// Diagnostic Analysis Generator
// Runs Protocol Engine (deterministic) → Eval Agent (Claude Sonnet) → frequency validation → save
// The eval agent replaces the previous RAG + TypeScript AI call pipeline.
//
// ASYNC ARCHITECTURE (2026-03-13):
// The eval agent takes 2-5 minutes. To avoid Vercel serverless timeout (60s),
// the flow is split into two phases:
//   Phase 1 (POST): extraction + fire eval as background job → return immediately
//   Phase 2 (GET polling): detect eval completion → finalize (validate + save) → mark complete

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

interface DiagnosticFile {
  id: string
  filename: string
  fileType: string
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
  _practitionerId: string,
  userRole: 'practitioner' | 'member' = 'practitioner'
): Promise<GeneratedAnalysis> {
  const supabase = await createClient()

  // 1. Get diagnostic files
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

  // 1a. Check for demo mode
  const demoResponse = await checkDemoMode(supabase, diagnosticFiles)
  if (demoResponse) {
    return {
      ...demoResponse,
      ragContext: [],
      extractedData: null,
    }
  }

  // 2. Handle member role — educational-only response (no protocols)
  if (userRole === 'member') {
    return {
      summary: 'Your diagnostic results have been reviewed. For treatment guidance, please consult with your practitioner or refer to your program materials.',
      protocols: [],
      supplementation: [],
      ragContext: [],
      reasoningChain: [],
      extractedData: null,
    }
  }

  // 3. Find the diagnostic_analysis_id for the eval agent
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

  // 4. Fire the eval agent as a BACKGROUND JOB (async — returns immediately)
  // The eval takes 2-5 min; we cannot block the Vercel serverless function.
  // The GET polling handler will finalize when the eval report is ready.
  await startEvalBackgroundJob(analysisRecord.id, patientId)

  // Return partial result — the eval will complete in the background.
  // Finalization (frequency validation, protocol save) happens in finalizeAnalysisFromEvalReport().
  return {
    summary: '',
    protocols: [],
    supplementation: [],
    ragContext: [],
    reasoningChain: [],
    extractedData: null,
  }
}


// ============================================
// ASYNC EVAL: START BACKGROUND JOB
// ============================================

/**
 * Fire the eval agent as a background job on the Python backend.
 * Returns immediately — the eval runs async and stores results in diagnostic_eval_reports.
 */
export async function startEvalBackgroundJob(
  diagnosticAnalysisId: string,
  patientId: string,
): Promise<{ jobId: string }> {
  const pythonAgentUrl = getPythonAgentUrl()
  console.log(`[Eval Agent] Firing background job: POST ${pythonAgentUrl}/agent/eval`)

  const evalResponse = await fetch(`${pythonAgentUrl}/agent/eval`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      diagnostic_analysis_id: diagnosticAnalysisId,
      patient_id: patientId,
    }),
  })

  if (!evalResponse.ok) {
    const errorBody = await evalResponse.text()
    throw new Error(`Eval agent background job failed (${evalResponse.status}): ${errorBody}`)
  }

  const jobData = await evalResponse.json() as { job_id: string; status: string }
  console.log(`[Eval Agent] Background job started: job_id=${jobData.job_id}, status=${jobData.status}`)
  return { jobId: jobData.job_id }
}


// ============================================
// ASYNC EVAL: CHECK & FINALIZE
// ============================================

/**
 * Check if the eval report is ready and finalize the analysis.
 * Called during GET polling. Returns null if eval is still processing.
 */
export async function finalizeAnalysisFromEvalReport(
  diagnosticAnalysisId: string,
  diagnosticUploadId: string,
  patientId: string,
): Promise<GeneratedAnalysis | null> {
  const supabase = await createClient()

  // Check if eval report exists and is complete
  const { data: evalReport } = await supabase
    .from('diagnostic_eval_reports')
    .select('id, status, report_json, error_message')
    .eq('diagnostic_analysis_id', diagnosticAnalysisId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!evalReport) {
    console.log(`[Finalize] No eval report found for analysis ${diagnosticAnalysisId}`)
    return null
  }

  if (evalReport.status === 'error') {
    throw new Error(`Eval agent failed: ${evalReport.error_message || 'Unknown error'}`)
  }

  if (evalReport.status !== 'complete') {
    // Still processing
    return null
  }

  // Eval is complete — finalize the analysis
  const evalReportData = evalReport.report_json as EvalReport
  console.log(
    `[Finalize] Eval report ready: urgency=${evalReportData.urgency?.score}, ` +
    `frequencies=${evalReportData.frequency_phases?.length}, ` +
    `supplements=${evalReportData.supplementation?.length}, ` +
    `deal_breakers=${evalReportData.deal_breakers?.length}`
  )

  // Map EvalReport → GeneratedAnalysis shape
  const mapped = mapEvalReportToGeneratedAnalysis(evalReportData)

  // --- LAYER DIAGNOSTIC LOGGING ---
  // Log what Claude generated per phase BEFORE any validation/dedup
  const phaseCountsBefore: Record<number, string[]> = {}
  for (const p of mapped.protocols) {
    phaseCountsBefore[p.priority] = p.frequencies.map(f => f.name)
  }
  for (const [phase, names] of Object.entries(phaseCountsBefore)) {
    console.log(
      `[Layer Debug] Phase ${phase} BEFORE validation: ${names.length} frequencies:`,
      names,
    )
  }
  // --- END LAYER DIAGNOSTIC LOGGING ---

  // Validate ALL frequencies against approved list
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
      source_reference: f.source_reference,
      diagnostic_trigger: f.diagnostic_trigger,
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

    // --- LAYER DIAGNOSTIC LOGGING ---
    console.log(
      `[Layer Debug] Protocol "${p.title}" (priority=${p.priority}): ` +
      `${rawFrequencies.length} raw → ${filteredProtocol.frequencies.length} validated ` +
      `(${validationReport.validCount} valid, ${validationReport.rejectedCount} rejected)`,
    )
    if (validationReport.rejectedCount > 0) {
      console.log(
        `[Layer Debug] REJECTED from "${p.title}":`,
        validationReport.rejectedFrequencies.map(f => `${f.frequencyName} (${f.rejectionReason})`),
      )
    }
    // --- END LAYER DIAGNOSTIC LOGGING ---

    if (filteredProtocol.frequencies.length > 0) {
      validatedProtocols.push({
        title: p.title,
        description: p.description,
        category: p.category,
        frequencies: filteredProtocol.frequencies.map(f => ({
          id: crypto.randomUUID(),
          name: f.name,
          rationale: f.rationale,
          source_reference: (f as Record<string, unknown>).source_reference as string | undefined,
          diagnostic_trigger: (f as Record<string, unknown>).diagnostic_trigger as string | undefined,
        })),
        priority: p.priority,
        validationReport,
      })
    } else {
      console.warn(`[Frequency Validation] Protocol "${p.title}" DROPPED - no valid frequencies (ALL ${rawFrequencies.length} rejected)`)
    }
  }

  // Deduplicate frequencies across all protocols
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

  // --- LAYER DIAGNOSTIC LOGGING: FINAL STATE ---
  for (const dp of deduplicatedProtocols) {
    console.log(
      `[Layer Debug] FINAL Protocol "${dp.title}" (priority=${dp.priority}): ` +
      `${dp.frequencies.length} frequencies: [${dp.frequencies.map(f => f.name).join(', ')}]`,
    )
  }
  const finalPhaseCounts = deduplicatedProtocols.reduce<Record<number, number>>((acc, p) => {
    acc[p.priority] = (acc[p.priority] || 0) + p.frequencies.length
    return acc
  }, {})
  console.log(
    `[Layer Debug] FINAL SUMMARY: ` +
    `Layer 1=${finalPhaseCounts[1] || 0}, Layer 2=${finalPhaseCounts[2] || 0}, Layer 3=${finalPhaseCounts[3] || 0}`,
  )
  if (!finalPhaseCounts[2]) {
    console.error(
      `[Layer Debug] WARNING: Layer 2 has ZERO frequencies after finalization! ` +
      `Input had ${phaseCountsBefore[2]?.length || 0} layer-2 frequencies. ` +
      `Check validation rejections and deduplication above.`,
    )
  }
  // --- END LAYER DIAGNOSTIC LOGGING ---

  // Get extracted data for the response
  const extractedData = await getExtractedDiagnosticData(diagnosticUploadId, supabase)

  return {
    summary: mapped.summary,
    protocols: deduplicatedProtocols,
    supplementation: mapped.supplementation,
    ragContext: [],
    reasoningChain: mapped.reasoningChain,
    extractedData,
    evalReport: evalReportData,
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
          status,
          created_at
        )
      `)
      .eq('upload_id', diagnosticUploadId)

    if (error || !files) {
      console.warn('No extracted diagnostic data found:', error?.message)
      return null
    }

    if (files.length === 0) {
      console.warn(`[getExtractedDiagnosticData] No diagnostic_files rows for upload ${diagnosticUploadId}`)
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
      // Sort extractions by created_at desc so we always pick the latest one
      // (retries create updated records; we want the most recent result)
      const extractions = (file.diagnostic_extracted_values as Array<{
        extracted_data: Record<string, unknown>
        extraction_confidence: number
        status: string
        created_at: string
      }>) || []
      extractions.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))

      const extraction = extractions.find(
        (e) => e.status === 'complete' || e.status === 'needs_review'
      )
      if (!extraction) return

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
